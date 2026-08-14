/**
 * BEAST-01 cockpit drive control law — pure, no React, no side effects.
 *
 * This is a PORT of Waveshare's original Pi cockpit (`waveshareteam/ugv_rpi`,
 * `templates/control.js` — `move_buttons` / `moveProcess()` / `speedCtrl()` and
 * `config.yaml`'s `args_config`). The owner drove that cockpit and it felt good;
 * ours did not. Waveshare is therefore the proven reference, not a starting
 * point to improve on. Divergences are marked DIVERGENCE and justified inline —
 * there are exactly two, and neither changes how driving feels.
 *
 * WIRE-FORMAT NOTE (do not paper over this): Waveshare's browser sent
 * `{"T":1,"L":…,"R":…}` — raw per-track wheel speeds. Our cockpit sends a
 * geometry_msgs/Twist that `beast_base` forwards as `{"T":"13","X":…,"Z":…}`.
 * Different firmware commands, different units. What is ported here is the
 * STRUCTURE and the DIMENSIONLESS RATIOS; the magnitudes are Waveshare's
 * starting point, to be confirmed on the first supervised drive.
 */

export type DriveKey = 'forward' | 'backward' | 'left' | 'right';

export type DriveHeld = Record<DriveKey, boolean>;

export type DriveInput = {
  /** Which direction keys/buttons are held RIGHT NOW. Set membership, not edges. */
  held: DriveHeld;
  /** Index into RATE_PRESETS — the sticky throttle the operator selected. */
  rateIndex: number;
  /** SHIFT held. Overrides the preset without overwriting it. */
  boost: boolean;
};

export type DriveIntent = { linearX: number; angularZ: number };

// ── CEILING ─────────────────────────────────────────────────────────────────
// Waveshare's `max_speed`, ported. There is NO robot-side clamp anywhere:
// `beast_base.cmd_vel_callback` forwards linear.x/angular.z to the ESP32 raw
// (base_node.py) and twist_mux does not clamp either. This constant IS the
// speed cap for the entire chain.
export const LINEAR_MAX = 1.3; // m/s

// The one number with no Waveshare equivalent: its browser was differential
// L/R and never named a yaw rate. 1.0 rad/s is what the nav2 params in this
// repo use for max_vel_theta, and commanded yaw currently UNDER-delivers on
// this chassis (tracks scrub; the track-width calibration is owned elsewhere),
// so it is conservative in practice. Expect to tune it on the first drive.
export const ANGULAR_MAX = 1.0; // rad/s

// ── THROTTLE ────────────────────────────────────────────────────────────────
// Waveshare's own rate ladder — ugv_rpi/config.yaml `args_config`:
// min_rate 0.3 / mid_rate 0.66 / max_rate 1.0.
export const RATE_PRESETS = [0.3, 0.66, 1.0] as const;
export const RATE_LABELS = ['SLOW', 'CRUISE', 'FAST'] as const;
/** Waveshare boots at min_rate (`var speed_rate = 0.3`); so do we. */
export const RATE_DEFAULT_INDEX = 0;
/** SHIFT → max_rate while held (control.js `if (move_buttons.shift == 1) speed_rate = max_rate`). */
export const RATE_BOOST = 1.0;

// ── ARC GEOMETRY ────────────────────────────────────────────────────────────
// Waveshare's arc is L = slow_speed, R = max_speed (forward+left). Converted to
// DIMENSIONLESS ratios so they survive the T:1(L,R) → T:13(X,Z) format change:
//   max_speed = 1.3, slow_speed = 0.2   (config.yaml args_config)
//   forward component = (max + slow) / (2 * max) = 0.577
//   yaw     component = (max − slow) / (2 * max) = 0.423
// Turn-in-place is L = −max, R = +max, i.e. a yaw component of exactly 1.0 —
// which is why only the arc case is scaled.
export const ARC_LINEAR_SCALE = 0.577;
export const ARC_ANGULAR_SCALE = 0.423;

// ── STOP TAIL ───────────────────────────────────────────────────────────────
// DIVERGENCE 1 (safety, not feel): Waveshare sent a single zero. BEAST-01 lost
// its robot-side cmd_vel watchdog on 2026-08-07 and the ESP32 latches its last
// command, so the in-tree ugv_tools/keyboard_ctrl.py sends five zeros for
// exactly this reason (ZERO_TAIL_LIMIT = 5 @ LOOP_PERIOD = 0.02). This matches
// existing in-repo precedent to replace a deleted safety net. It only fires
// once the operator has already asked to stop, so it changes nothing about how
// driving feels. 5 × 20 ms = 100 ms of zeros, then silence — well inside the
// mux's 0.5 s `ui` timeout, so the rung still expires and hands the floor back
// down the ladder instead of masking nav forever.
export const STOP_TAIL_COUNT = 5;
export const STOP_TAIL_INTERVAL_MS = 20;

/**
 * Waveshare parity: steering inverts when reversing.
 *
 * `moveProcess` gives backward+left `L = −slow_speed, R = −max_speed`, whose
 * differential (R − L) is NEGATIVE — pressing `A` while reversing yaws
 * clockwise, the way a car does when you steer left in reverse.
 *
 * NOTE — this conflicts with `ugv_tools/keyboard_ctrl.py`'s `moveBindings`
 * (`"."` = `(-1, 1)`: reverse with POSITIVE turn), and that package IS built on
 * the robot and launchable on demand. Waveshare parity wins here because it is
 * the behaviour the owner actually drove and liked. This is an owner decision
 * to confirm on the first drive; flipping it is this one line, and whichever
 * sense he picks, both surfaces should end up matching it.
 */
export const REVERSE_YAW_SENSE = (axial: number): 1 | -1 => (axial < 0 ? -1 : 1);

/** A fresh, nothing-held key set. */
export function idleHeld(): DriveHeld {
  return { forward: false, backward: false, left: false, right: false };
}

/** A fresh input at the default throttle with nothing held. */
export function idleInput(): DriveInput {
  return { held: idleHeld(), rateIndex: RATE_DEFAULT_INDEX, boost: false };
}

/** Structural copy — the React view state must not alias the live ref. */
export function cloneInput(input: DriveInput): DriveInput {
  return { held: { ...input.held }, rateIndex: input.rateIndex, boost: input.boost };
}

/** True if any direction key is held. Throttle/boost alone are not "held". */
export function anyHeld(input: DriveInput): boolean {
  const h = input.held;
  return h.forward || h.backward || h.left || h.right;
}

export function isZeroIntent(intent: DriveIntent): boolean {
  return intent.linearX === 0 && intent.angularZ === 0;
}

/**
 * The throttle in effect right now. SHIFT overrides the selected preset
 * WITHOUT overwriting it, so releasing SHIFT lands back on the preset —
 * never on full, never on zero (control.js: the shift branch assigns
 * `speed_rate` directly and leaves `defaultSpeed` alone; the else branch
 * calls `speedCtrl(defaultSpeed)`).
 */
export function effectiveRate(input: DriveInput): number {
  if (input.boost) return RATE_BOOST;
  const index = Math.min(RATE_PRESETS.length - 1, Math.max(0, Math.trunc(input.rateIndex)));
  return RATE_PRESETS[index];
}

/** Straight-line speed a preset commands — the number the throttle buttons print. */
export function straightSpeedAt(rateIndex: number): number {
  return LINEAR_MAX * effectiveRate({ held: idleHeld(), rateIndex, boost: false });
}

/**
 * The entire control law: held set + throttle in, one Twist out. Pure.
 *
 * Composition is in Twist space (linear.x / angular.z), not differential L/R,
 * because the wire is Twist from the browser through twist_mux to beast_base —
 * the X/Z → per-track conversion happens inside ESP32 firmware we do not own.
 * Converting back to L/R here would require hard-coding a track width the
 * browser would have to assume, duplicating a constant another agent owns.
 */
export function composeTwist(input: DriveInput): DriveIntent {
  const rate = effectiveRate(input);
  const lin = LINEAR_MAX * rate;
  const ang = ANGULAR_MAX * rate;

  // DIVERGENCE 2 (vendor bug): Waveshare's if/else chain has NO branch for
  // W+S or A+D, so it silently keeps the PREVIOUS L/R — the robot carries on
  // doing whatever it was doing. We cancel to zero, which is what the operator
  // means by pressing both.
  const axial = (input.held.forward ? 1 : 0) - (input.held.backward ? 1 : 0); // -1 | 0 | 1
  const yawKey = (input.held.left ? 1 : 0) - (input.held.right ? 1 : 0); // -1 | 0 | 1

  if (axial === 0 && yawKey === 0) return { linearX: 0, angularZ: 0 };
  // Spin in place — Waveshare's L = −max, R = +max: yaw at the full rate.
  if (axial === 0) return { linearX: 0, angularZ: yawKey * ang };
  // Straight — Waveshare's L = R = ±max.
  if (yawKey === 0) return { linearX: axial * lin, angularZ: 0 };
  // Arc — Waveshare's slow_speed/max_speed pair, as ratios.
  return {
    linearX: axial * lin * ARC_LINEAR_SCALE,
    angularZ: yawKey * ang * ARC_ANGULAR_SCALE * REVERSE_YAW_SENSE(axial),
  };
}
