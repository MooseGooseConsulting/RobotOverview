import { describe, expect, it } from 'vitest';
import {
  ANGULAR_MAX,
  ARC_ANGULAR_SCALE,
  ARC_LINEAR_SCALE,
  LINEAR_MAX,
  RATE_BOOST,
  RATE_DEFAULT_INDEX,
  RATE_LABELS,
  RATE_PRESETS,
  STOP_TAIL_COUNT,
  STOP_TAIL_INTERVAL_MS,
  anyHeld,
  composeTwist,
  effectiveRate,
  idleInput,
  isZeroIntent,
  straightSpeedAt,
  type DriveInput,
  type DriveKey,
} from '@/lib/ros/drive-law';

/** Build an input from a compact `{f,b,l,r}` bit tuple. */
function input(
  bits: [boolean, boolean, boolean, boolean],
  rateIndex = RATE_DEFAULT_INDEX,
  boost = false,
): DriveInput {
  const [forward, backward, left, right] = bits;
  return { held: { forward, backward, left, right }, rateIndex, boost };
}

const PRECISION = 12;

describe('drive-law constants — Waveshare parity', () => {
  it('carries Waveshare ugv_rpi/config.yaml args_config verbatim', () => {
    // max_speed / min_rate / mid_rate / max_rate. If these drift, the port has
    // stopped being a port.
    expect(LINEAR_MAX).toBe(1.3);
    expect([...RATE_PRESETS]).toEqual([0.3, 0.66, 1.0]);
    expect(RATE_BOOST).toBe(1.0);
    // Waveshare boots at min_rate (`var speed_rate = 0.3`).
    expect(RATE_PRESETS[RATE_DEFAULT_INDEX]).toBe(0.3);
    expect(RATE_LABELS).toHaveLength(RATE_PRESETS.length);
  });

  it('derives the arc ratios from slow_speed/max_speed', () => {
    // forward = (max + slow) / (2 * max); yaw = (max − slow) / (2 * max),
    // with max_speed 1.3 and slow_speed 0.2.
    expect(ARC_LINEAR_SCALE).toBeCloseTo((1.3 + 0.2) / (2 * 1.3), 3);
    expect(ARC_ANGULAR_SCALE).toBeCloseTo((1.3 - 0.2) / (2 * 1.3), 3);
    // Turn-in-place is L = −max, R = +max — a yaw component of exactly 1.0,
    // which is why only the arc case is scaled.
    expect(ARC_LINEAR_SCALE + ARC_ANGULAR_SCALE).toBeCloseTo(1.0, 3);
  });

  it('mirrors keyboard_ctrl.py ZERO_TAIL_LIMIT=5 @ LOOP_PERIOD=0.02', () => {
    expect(STOP_TAIL_COUNT).toBe(5);
    expect(STOP_TAIL_INTERVAL_MS).toBe(20);
    // The whole tail must finish well inside twist_mux's 0.5 s `ui` timeout so
    // the rung expires and hands the floor back down the ladder.
    expect(STOP_TAIL_COUNT * STOP_TAIL_INTERVAL_MS).toBeLessThan(500);
  });

  it('SLOW is the everyday default and is faster than the 0.2 m/s it replaces', () => {
    expect(straightSpeedAt(0)).toBeCloseTo(0.39, 6);
    expect(straightSpeedAt(1)).toBeCloseTo(0.858, 6);
    expect(straightSpeedAt(2)).toBeCloseTo(1.3, 6);
    expect(straightSpeedAt(RATE_DEFAULT_INDEX)).toBeGreaterThan(0.2);
  });
});

describe('composeTwist — the 16-combination truth table', () => {
  const rate = RATE_PRESETS[RATE_DEFAULT_INDEX];
  const lin = LINEAR_MAX * rate;
  const ang = ANGULAR_MAX * rate;
  const arcLin = lin * ARC_LINEAR_SCALE;
  const arcAng = ang * ARC_ANGULAR_SCALE;

  // [forward, backward, left, right] → [linearX, angularZ]
  const table: Array<{
    name: string;
    bits: [boolean, boolean, boolean, boolean];
    linearX: number;
    angularZ: number;
  }> = [
    { name: 'idle', bits: [false, false, false, false], linearX: 0, angularZ: 0 },
    { name: 'W', bits: [true, false, false, false], linearX: lin, angularZ: 0 },
    { name: 'S', bits: [false, true, false, false], linearX: -lin, angularZ: 0 },
    { name: 'A (spin CCW)', bits: [false, false, true, false], linearX: 0, angularZ: ang },
    { name: 'D (spin CW)', bits: [false, false, false, true], linearX: 0, angularZ: -ang },
    { name: 'W+S (cancel)', bits: [true, true, false, false], linearX: 0, angularZ: 0 },
    { name: 'A+D (cancel)', bits: [false, false, true, true], linearX: 0, angularZ: 0 },
    { name: 'W+A (arc)', bits: [true, false, true, false], linearX: arcLin, angularZ: arcAng },
    { name: 'W+D (arc)', bits: [true, false, false, true], linearX: arcLin, angularZ: -arcAng },
    { name: 'S+A (arc)', bits: [false, true, true, false], linearX: -arcLin, angularZ: -arcAng },
    { name: 'S+D (arc)', bits: [false, true, false, true], linearX: -arcLin, angularZ: arcAng },
    { name: 'W+S+A', bits: [true, true, true, false], linearX: 0, angularZ: ang },
    { name: 'W+S+D', bits: [true, true, false, true], linearX: 0, angularZ: -ang },
    { name: 'W+A+D', bits: [true, false, true, true], linearX: lin, angularZ: 0 },
    { name: 'S+A+D', bits: [false, true, true, true], linearX: -lin, angularZ: 0 },
    { name: 'all four', bits: [true, true, true, true], linearX: 0, angularZ: 0 },
  ];

  it('covers all 16 combinations', () => {
    expect(table).toHaveLength(16);
  });

  it.each(table)('$name', ({ bits, linearX, angularZ }) => {
    const twist = composeTwist(input(bits));
    expect(twist.linearX).toBeCloseTo(linearX, PRECISION);
    expect(twist.angularZ).toBeCloseTo(angularZ, PRECISION);
  });
});

describe('composeTwist — composition', () => {
  it('W+A yields BOTH axes non-zero at the arc ratios — this is the whole point', () => {
    const twist = composeTwist(input([true, false, true, false]));
    const rate = RATE_PRESETS[RATE_DEFAULT_INDEX];
    expect(twist.linearX).toBeCloseTo(LINEAR_MAX * rate * ARC_LINEAR_SCALE, PRECISION);
    expect(twist.angularZ).toBeCloseTo(ANGULAR_MAX * rate * ARC_ANGULAR_SCALE, PRECISION);
    expect(twist.linearX).not.toBe(0);
    expect(twist.angularZ).not.toBe(0);
  });

  it('an arc is slower and gentler than the straight and the spin it blends', () => {
    const straight = composeTwist(input([true, false, false, false]));
    const spin = composeTwist(input([false, false, true, false]));
    const arc = composeTwist(input([true, false, true, false]));
    expect(Math.abs(arc.linearX)).toBeLessThan(Math.abs(straight.linearX));
    expect(Math.abs(arc.angularZ)).toBeLessThan(Math.abs(spin.angularZ));
  });

  it('W+S and A+D cancel to EXACTLY zero — a deliberate divergence from Waveshare', () => {
    // Waveshare's if/else chain has no branch for either pair and silently keeps
    // the previous L/R, so the robot carries on doing whatever it was doing.
    const axial = composeTwist(input([true, true, false, false]));
    const yaw = composeTwist(input([false, false, true, true]));
    expect(axial).toEqual({ linearX: 0, angularZ: 0 });
    expect(yaw).toEqual({ linearX: 0, angularZ: 0 });
    expect(isZeroIntent(axial)).toBe(true);
  });

  it('REVERSE INVERTS STEERING: S+A yields NEGATIVE angularZ (Waveshare parity)', () => {
    // Do not flip this silently. Waveshare's moveProcess gives backward+left
    // L = −slow_speed, R = −max_speed, whose differential is negative — `A`
    // while reversing yaws clockwise, the way a car does. This conflicts with
    // ugv_tools/keyboard_ctrl.py's moveBindings ("." = (-1, 1)), which IS built
    // and launchable on this robot. Parity wins because it is what the owner
    // drove and liked; it is an owner decision to confirm on the first drive,
    // and whichever sense he picks, both surfaces should end up matching.
    const reverseLeft = composeTwist(input([false, true, true, false]));
    expect(reverseLeft.linearX).toBeLessThan(0);
    expect(reverseLeft.angularZ).toBeLessThan(0);

    // Forward+left is the mirror image: same steering key, opposite yaw sign.
    const forwardLeft = composeTwist(input([true, false, true, false]));
    expect(forwardLeft.angularZ).toBeGreaterThan(0);
    expect(reverseLeft.angularZ).toBeCloseTo(-forwardLeft.angularZ, PRECISION);

    // Spin-in-place is NOT affected — there is no axial direction to reverse.
    expect(composeTwist(input([false, false, true, false])).angularZ).toBeGreaterThan(0);
  });
});

describe('effectiveRate — throttle and boost', () => {
  it('scales both axes linearly at every preset', () => {
    RATE_PRESETS.forEach((rate, index) => {
      const straight = composeTwist(input([true, false, false, false], index));
      const spin = composeTwist(input([false, false, true, false], index));
      expect(straight.linearX).toBeCloseTo(LINEAR_MAX * rate, PRECISION);
      expect(spin.angularZ).toBeCloseTo(ANGULAR_MAX * rate, PRECISION);
    });
  });

  it('boost overrides the preset WITHOUT mutating rateIndex', () => {
    const boosted = input([true, false, false, false], 0, true);
    expect(effectiveRate(boosted)).toBe(RATE_BOOST);
    expect(composeTwist(boosted).linearX).toBeCloseTo(LINEAR_MAX * RATE_BOOST, PRECISION);
    // The selected preset survives, so releasing SHIFT lands back on it —
    // never on full, never on zero.
    expect(boosted.rateIndex).toBe(0);
    expect(effectiveRate({ ...boosted, boost: false })).toBe(RATE_PRESETS[0]);
  });

  it('boost from CRUISE still lands back on CRUISE', () => {
    const cruise = input([true, false, false, false], 1);
    expect(effectiveRate({ ...cruise, boost: true })).toBe(RATE_BOOST);
    expect(effectiveRate(cruise)).toBe(RATE_PRESETS[1]);
  });

  it('clamps an out-of-range rateIndex instead of producing NaN', () => {
    expect(effectiveRate(input([false, false, false, false], -5))).toBe(RATE_PRESETS[0]);
    expect(effectiveRate(input([false, false, false, false], 99))).toBe(
      RATE_PRESETS[RATE_PRESETS.length - 1],
    );
  });
});

describe('drive-law helpers', () => {
  it('idleInput boots held-nothing at the default preset with no boost', () => {
    const fresh = idleInput();
    expect(anyHeld(fresh)).toBe(false);
    expect(fresh.rateIndex).toBe(RATE_DEFAULT_INDEX);
    expect(fresh.boost).toBe(false);
    expect(isZeroIntent(composeTwist(fresh))).toBe(true);
  });

  it('anyHeld tracks direction keys only — throttle and boost are not "held"', () => {
    expect(anyHeld(input([false, false, false, false], 2, true))).toBe(false);
    (['forward', 'backward', 'left', 'right'] as DriveKey[]).forEach((key) => {
      const one = idleInput();
      one.held[key] = true;
      expect(anyHeld(one)).toBe(true);
    });
  });
});
