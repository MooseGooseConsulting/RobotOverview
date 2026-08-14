'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  rosClient,
  useCockpitStatus,
  useCockpitBridge,
  useConnectionState,
} from '@/lib/ros/client';
import {
  Sliders,
  Lightbulb,
  RotateCcw,
  Move,
  Sparkles,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ANGULAR_MAX,
  LINEAR_MAX,
  RATE_LABELS,
  RATE_PRESETS,
  STOP_TAIL_COUNT,
  STOP_TAIL_INTERVAL_MS,
  anyHeld,
  cloneInput,
  composeTwist,
  idleHeld,
  idleInput,
  isZeroIntent,
  straightSpeedAt,
  type DriveIntent,
  type DriveInput,
  type DriveKey,
} from '@/lib/ros/drive-law';

// ── DRIVE INTENT ────────────────────────────────────────────────────────────
// Held intent, not edge-triggered pulses. A button press sets the intent and a
// 10 Hz interval republishes it until release, because twist_mux expires a
// source after 0.5 s of silence — a single Twist on mousedown makes the robot
// twitch and stop, which is exactly what the old edge-triggered drive() did.
//
// The control law itself (composition, throttle, arcs, stop tail) lives in
// `@/lib/ros/drive-law` — a pure module ported from Waveshare's Pi cockpit.
// This component owns only the wiring: events in, publishes out.
const DRIVE_PUBLISH_HZ = 10;
const DRIVE_PUBLISH_MS = 1000 / DRIVE_PUBLISH_HZ;

/** Keyboard → drive key. Waveshare's `moveKeyMap`, minus the keycode numbers. */
const DRIVE_KEY_BY_KEYBOARD: Record<string, DriveKey> = {
  w: 'forward',
  s: 'backward',
  a: 'left',
  d: 'right',
};

/**
 * One change to the drive input. Declarative rather than a mutator callback so
 * the held set is replaced, never mutated in place — React's ref rules forbid
 * handing `ref.current` to a function, and an immutable swap keeps the rendered
 * mirror honest.
 */
type DrivePatch = {
  key?: DriveKey;
  down?: boolean;
  rateIndex?: number;
  boost?: boolean;
};

const PAN_MIN = -3.14;
const PAN_MAX = 3.14;
const TILT_MIN = -0.523;
const TILT_MAX = 1.571;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const signed = (v: number, digits: number) => (v < 0 ? '' : '+') + v.toFixed(digits);

export function CommandRail() {
  const status = useCockpitStatus();
  const bridge = useCockpitBridge();
  const connection = useConnectionState();

  // LED States (0 - 255)
  const [io4, setIo4] = useState(0);
  const [io5, setIo5] = useState(0);

  // Gimbal States (pan: -3.14..3.14, tilt: -0.523..1.571)
  const [pan, setPan] = useState(0.0);
  const [tilt, setTilt] = useState(0.0);
  const [steady, setSteady] = useState(false);

  // Last control that failed to reach the socket (M3 — never leave the UI
  // showing a state the robot was never told about).
  const [fault, setFault] = useState<string | null>(null);

  const [driving, setDriving] = useState(false);

  // A stop whose zeros did NOT leave the browser. Deliberately separate from
  // `fault`, which any later successful publish clears: the robot may still be
  // driving, so this one is sticky and has no dismiss affordance.
  const [stopUnconfirmed, setStopUnconfirmed] = useState<{
    at: number;
    sent: number;
    reason: string;
  } | null>(null);

  const gimbalBoxRef = useRef<HTMLDivElement | null>(null);
  const driveIntentRef = useRef<DriveIntent | null>(null);
  const driveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStopRef = useRef(false);

  // The held key-set is the source of truth for the control law. It lives in a
  // ref so event handlers and the republish interval read it without stale
  // closures; `driveView` is the mirror the JSX renders.
  const driveInputRef = useRef<DriveInput>(idleInput());
  const [driveView, setDriveView] = useState<{ input: DriveInput; twist: DriveIntent }>(() => {
    const input = idleInput();
    return { input, twist: composeTwist(input) };
  });

  const connected = connection === 'connected';

  // ── MOTION GATE: DISARM STATE ─────────────────────────────────────────────
  // Motion is disabled when the robot is disarmed (via /ugv/set_allow_motion,
  // an operator action in the safety strip), or when the bridge refuses the
  // drive topic. No automatic charging/Ethernet interlock — that apparatus
  // (ugv_safety_monitor) was removed 2026-08-07; charging/Ethernet state
  // remain telemetry fields when a publisher supplies them, but they never
  // block driving here.
  const driveGateReason: string | null = !connected
    ? 'robot unreachable'
    : status.allowMotion === false
      ? 'motion disarmed — RE-ARM in the safety strip'
      : status.allowMotion !== true
        ? 'motion state unknown — waiting for /ugv/allow_motion'
        : bridge.deadTopics.includes('/cmd_vel_ui')
        ? 'bridge refused /cmd_vel_ui'
        : null;
  const driveEnabled = driveGateReason === null;

  const isDead = (topic: string) => bridge.deadTopics.includes(topic);

  const publishTwist = useCallback((linearX: number, angularZ: number): boolean => {
    return rosClient.publish('/cmd_vel_ui', {
      linear: { x: linearX, y: 0.0, z: 0.0 },
      angular: { x: 0.0, y: 0.0, z: angularZ },
    });
  }, []);

  const clearRepublishInterval = useCallback(() => {
    if (driveTimerRef.current !== null) {
      clearInterval(driveTimerRef.current);
      driveTimerRef.current = null;
    }
  }, []);

  const clearPendingTailTimer = useCallback(() => {
    if (tailTimerRef.current !== null) {
      clearTimeout(tailTimerRef.current);
      tailTimerRef.current = null;
    }
  }, []);

  /**
   * A stop whose zeros did not reach the socket. Retrying in the same tick is
   * pointless — `publish` returns false precisely because the socket is not
   * OPEN — so abort the rest of the tail, raise the sticky banner, and arm a
   * re-fire for the moment the link comes back.
   */
  const onStopTailFailed = useCallback((reason: string, sent: number) => {
    tailTimerRef.current = null;
    pendingStopRef.current = true;
    setStopUnconfirmed({ at: Date.now(), sent, reason });
  }, []);

  /**
   * Stop by command, and check that the command left the browser.
   *
   * Five zeros over 100 ms, then silence — the same shape as
   * `ugv_tools/keyboard_ctrl.py`'s tail (ZERO_TAIL_LIMIT = 5 @ 20 ms). BEAST-01
   * has no robot-side cmd_vel watchdog (removed 2026-08-07) and the ESP32
   * latches its last command, so an unheard stop leaves the robot driving.
   * Redundant frames, NOT a stream: an idle-but-publishing source on the
   * priority-50 rung would mask nav (10) forever, so the tail is bounded and
   * ends well inside the mux's 0.5 s `ui` timeout.
   *
   * Releasing the last key is a stop, not a ramp-down: the first zero goes out
   * synchronously and at full magnitude.
   */
  const runStopTail = useCallback(
    (reason: string) => {
      clearRepublishInterval();
      clearPendingTailTimer();
      driveIntentRef.current = null;
      setDriving(false);

      let sent = 0;
      const tick = () => {
        // HARD REQUIREMENT: literal zeros. If a rate limiter is ever added it
        // must be bypassed here and reset to zero — a stop that ramps is not a
        // stop on a robot whose ESP32 latches and has no watchdog.
        if (!publishTwist(0, 0)) {
          onStopTailFailed(reason, sent);
          return;
        }
        sent += 1;
        if (sent >= STOP_TAIL_COUNT) {
          tailTimerRef.current = null;
          pendingStopRef.current = false;
          setStopUnconfirmed(null);
          return;
        }
        tailTimerRef.current = setTimeout(tick, STOP_TAIL_INTERVAL_MS);
      };
      tick();
    },
    [clearRepublishInterval, clearPendingTailTimer, publishTwist, onStopTailFailed],
  );

  const setDriveIntent = useCallback(
    (intent: DriveIntent) => {
      if (!driveEnabled) return;
      driveIntentRef.current = intent;
      setDriving(true);
      if (!publishTwist(intent.linearX, intent.angularZ)) {
        setFault('drive: /cmd_vel_ui publish failed — command did not leave the browser');
        runStopTail('drive publish failed');
        return;
      }
      setFault(null);
      if (driveTimerRef.current === null) {
        driveTimerRef.current = setInterval(() => {
          if (driveIntentRef.current === null) return;
          // Recompose from the live held set every tick, so a throttle or boost
          // change takes effect even if its immediate publish were missed.
          const next = composeTwist(driveInputRef.current);
          if (isZeroIntent(next)) {
            runStopTail('intent returned to zero');
            return;
          }
          driveIntentRef.current = next;
          if (!publishTwist(next.linearX, next.angularZ)) {
            setFault('drive: socket closed mid-command — intent cleared');
            runStopTail('socket closed mid-command');
          }
        }, DRIVE_PUBLISH_MS);
      }
    },
    [driveEnabled, publishTwist, runStopTail],
  );

  /**
   * Update the held set, recompute, publish or stop. The ONLY path that changes
   * drive state — which is what makes per-key release a recompute rather than a
   * blanket stop. Releasing A while W is held recomputes to full straight-line
   * forward: no zero, no gap, no hitch.
   */
  const applyDriveInput = useCallback(
    (patch: DrivePatch, reason: string) => {
      const prev = driveInputRef.current;
      const next: DriveInput = {
        held: patch.key ? { ...prev.held, [patch.key]: patch.down === true } : { ...prev.held },
        rateIndex: patch.rateIndex ?? prev.rateIndex,
        boost: patch.boost ?? prev.boost,
      };
      driveInputRef.current = next;
      const twist = composeTwist(next);
      setDriveView({ input: cloneInput(next), twist });
      if (isZeroIntent(twist)) {
        // Only a transition OUT of motion is a stop. Selecting a throttle while
        // parked must not claim the mux rung with a burst of zeros.
        if (driveIntentRef.current !== null) runStopTail(reason);
        return;
      }
      setDriveIntent(twist);
    },
    [setDriveIntent, runStopTail],
  );

  /**
   * Drop every held key and the boost flag, then stop.
   *
   * Clearing `boost` is load-bearing: a Shift keyup that lands on another
   * window never reaches us, and a stuck boost flag would make the next
   * keypress full-rate. `force` is for an explicit operator stop (Space, the
   * STOP button), which must reach the wire even if we had already gone silent
   * — the same reason keyboard_ctrl.py puts Space in MOTION_KEYS.
   */
  const releaseAll = useCallback(
    (reason: string, force = false) => {
      const prev = driveInputRef.current;
      const wasCommanding = driveIntentRef.current !== null || anyHeld(prev);
      const next: DriveInput = { held: idleHeld(), rateIndex: prev.rateIndex, boost: false };
      driveInputRef.current = next;
      setDriveView({ input: cloneInput(next), twist: composeTwist(next) });
      if (wasCommanding || force) {
        runStopTail(reason);
        return;
      }
      clearRepublishInterval();
      setDriving(false);
    },
    [runStopTail, clearRepublishInterval],
  );

  // The gate can close underneath a held button (e-stop pressed, link dropped,
  // robot disarms). Clear the HELD SET, not just the published intent, so a
  // gate reopening under a physically-still-held key does not resume motion —
  // a fresh keydown is required.
  useEffect(() => {
    if (!driveEnabled) releaseAll('drive gate closed');
  }, [driveEnabled, releaseAll]);

  // A stop that never left the browser is re-fired the moment the link is back.
  useEffect(() => {
    if (connection === 'connected' && pendingStopRef.current) {
      pendingStopRef.current = false;
      runStopTail('reconnect — stop was never confirmed');
    }
  }, [connection, runStopTail]);

  // Tear the timers down with the component so a route change cannot leave a
  // drive republishing from an unmounted tree.
  useEffect(
    () => () => {
      clearRepublishInterval();
      clearPendingTailTimer();
    },
    [clearRepublishInterval, clearPendingTailTimer],
  );

  // ── KEYBOARD ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      // isContentEditable matters as much as INPUT/TEXTAREA here: without it the
      // number keys change the throttle while the operator types in a chat box.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return;
      // Key auto-repeat would re-fire the immediate publish dozens of times a
      // second; the held interval already covers it. Set membership below is the
      // real guard — this is belt-and-braces.
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      const driveKey = DRIVE_KEY_BY_KEYBOARD[key];
      if (driveKey) {
        // Waveshare's `move_buttons[moveKey] === 0` guard: a keydown for an
        // already-held key is not an event at all.
        if (driveInputRef.current.held[driveKey]) return;
        applyDriveInput({ key: driveKey, down: true }, `${driveKey} pressed`);
        return;
      }

      if (key === 'shift') {
        if (driveInputRef.current.boost) return;
        applyDriveInput({ boost: true }, 'boost engaged');
        return;
      }

      // '1' | '2' | '3' → throttle preset index, Waveshare's low/middle/fast.
      const preset = Number(key) - 1;
      if (Number.isInteger(preset) && preset >= 0 && preset < RATE_PRESETS.length) {
        if (driveInputRef.current.rateIndex === preset) return;
        // Changing the preset mid-drive recomputes and republishes immediately —
        // no key release needed (Waveshare's speedCtrl behaviour).
        applyDriveInput({ rateIndex: preset }, 'throttle changed');
        return;
      }

      if (key === ' ' || key === 'escape') releaseAll('operator stop', true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const driveKey = DRIVE_KEY_BY_KEYBOARD[key];
      if (driveKey) {
        if (!driveInputRef.current.held[driveKey]) return;
        // THE HEADLINE FIX: one key up is a recompute of the remaining held set,
        // not a stop. Waveshare: onkeyup → updateMoveButton(key, 0) → moveProcess().
        applyDriveInput({ key: driveKey, down: false }, `${driveKey} released`);
        return;
      }
      if (key === 'shift') {
        if (!driveInputRef.current.boost) return;
        applyDriveInput({ boost: false }, 'boost released');
      }
    };

    // A keyup that lands on another window never reaches us, so the intent would
    // stay held with the operator's hand off the keyboard. Blur, tab-hide and
    // cancelled pointers all mean "we are no longer in control" — release.
    const handleBlur = () => releaseAll('focus lost');
    const handlePointerCancel = () => releaseAll('pointer cancelled');
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') releaseAll('tab hidden');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pointercancel', handlePointerCancel);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pointercancel', handlePointerCancel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [applyDriveInput, releaseAll]);

  // Pointer (not mouse) events so touch works; capture keeps the release event
  // bound to this element even if the finger slides off it. One flag per button,
  // so multi-touch on a tablet composes diagonals exactly like the keyboard.
  // Waveshare's `move_buttons[moveKey] === 0/1` guards: an event for a key that
  // is already in that state is not an event at all. Set membership — not the
  // browser's repeat flag — is what makes a held key idempotent.
  const pressDriveKey = useCallback(
    (driveKey: DriveKey) => {
      if (driveInputRef.current.held[driveKey]) return;
      applyDriveInput({ key: driveKey, down: true }, `${driveKey} pressed`);
    },
    [applyDriveInput],
  );

  const releaseDriveKey = useCallback(
    (driveKey: DriveKey) => {
      if (!driveInputRef.current.held[driveKey]) return;
      applyDriveInput({ key: driveKey, down: false }, `${driveKey} released`);
    },
    [applyDriveInput],
  );

  const holdProps = (driveKey: DriveKey) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pressDriveKey(driveKey);
    },
    onPointerUp: () => releaseDriveKey(driveKey),
    onPointerCancel: () => releaseDriveKey(driveKey),
    onLostPointerCapture: () => releaseDriveKey(driveKey),
    style: { touchAction: 'none' as const },
  });

  const selectRate = (index: number) => {
    if (driveInputRef.current.rateIndex === index) return;
    applyDriveInput({ rateIndex: index }, 'throttle changed');
  };

  const disarmMotion = () => {
    void rosClient.setMotionAllowed(false);
  };

  // Each arrow lights on its own flag, so a W+A diagonal visibly lights two —
  // the cheap, visible proof that composition works.
  const padClass = (driveKey: DriveKey) =>
    clsx(
      'btn border rounded-lg aspect-square text-md flex items-center justify-center select-none',
      !driveEnabled
        ? 'border-rim/40 bg-panel-2/30 text-zinc-600 cursor-not-allowed'
        : driveView.input.held[driveKey]
          ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-400 text-glow-emerald'
          : 'border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2',
    );

  // ── LED / GIMBAL PUBLISHERS (M3: honour the return value) ──────────────────
  const updateLEDs = (nextIo4: number, nextIo5: number) => {
    const prev = { io4, io5 };
    setIo4(nextIo4);
    setIo5(nextIo5);
    if (!rosClient.publish('/ugv/led_ctrl', { data: [nextIo4, nextIo5] })) {
      setIo4(prev.io4);
      setIo5(prev.io5);
      setFault('LED: /ugv/led_ctrl publish failed — sliders reverted');
      return;
    }
    setFault(null);
  };

  const updateGimbal = (nextPan: number, nextTilt: number) => {
    const roundedPan = Math.round(clamp(nextPan, PAN_MIN, PAN_MAX) * 100) / 100;
    const roundedTilt = Math.round(clamp(nextTilt, TILT_MIN, TILT_MAX) * 100) / 100;
    const prev = { pan, tilt };
    setPan(roundedPan);
    setTilt(roundedTilt);
    if (
      !rosClient.publish('/pt_joint_position_controller/commands', {
        data: [roundedPan, roundedTilt],
      })
    ) {
      setPan(prev.pan);
      setTilt(prev.tilt);
      setFault('Gimbal: publish failed — crosshair reverted');
      return;
    }
    setFault(null);
  };

  const resetGimbal = () => updateGimbal(0.0, 0.0);

  const toggleSteady = () => {
    const nextSteady = !steady;
    setSteady(nextSteady);
    // Steady command maps: [mode, y_bias]. Float32MultiArray robot-side.
    if (!rosClient.publish('/ugv/pt_steady_ctrl', { data: [nextSteady ? 1.0 : 0.0, 0.0] })) {
      setSteady(steady);
      setFault('Steady: /ugv/pt_steady_ctrl publish failed — toggle reverted');
      return;
    }
    setFault(null);
  };

  // Drag anywhere in the gimbal box to aim. Pointer position maps linearly onto
  // the true joint ranges (see the axis labels) — no rescaling that would make
  // a commanded angle read as something it is not.
  const aimFromPointer = (clientX: number, clientY: number) => {
    const box = gimbalBoxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    const fx = clamp((clientX - box.left) / box.width, 0, 1);
    const fy = clamp((clientY - box.top) / box.height, 0, 1);
    updateGimbal(PAN_MIN + fx * (PAN_MAX - PAN_MIN), TILT_MAX - fy * (TILT_MAX - TILT_MIN));
  };

  const gimbalDraggingRef = useRef(false);
  const gimbalDead = isDead('/pt_joint_position_controller/commands');

  const rungState = (source: string) => {
    if (status.muxSource === null) return { label: 'UNKNOWN', active: false, unknown: true };
    const active = status.muxSource === source;
    return { label: active ? 'ACTIVE' : 'IDLE', active, unknown: false };
  };

  const rungs = [
    { pri: 150, name: 'BT Pad · Robot', source: 'BT pad · robot', tone: 'cyan' as const },
    { pri: 100, name: 'Operator Pad', source: 'Operator pad', tone: 'cyan' as const },
    { pri: 50, name: 'UI Teleop (WASD)', source: 'UI teleop', tone: 'emerald' as const },
    { pri: 10, name: 'nav2', source: 'nav2', tone: 'cyan' as const },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* ── TWIST_MUX LADDER ─────────────────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none mb-3">
          <Sliders className="h-3.5 w-3.5" /> twist_mux ladder{' '}
          <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">→ /cmd_vel</span>
        </h2>

        <div className="flex flex-col gap-1.5">
          {rungs.map((r) => {
            const state = rungState(r.source);
            return (
              <div
                key={r.pri}
                className={clsx(
                  'grid grid-cols-[36px_1fr_auto] gap-2 items-center border border-rim/60 rounded-md px-3 py-1.5 bg-hull/40 font-mono text-xs',
                  state.active &&
                    r.tone === 'cyan' &&
                    'border-cyan-500/50 bg-cyan-950/20 text-glow-cyan text-cyan-400 font-bold',
                  state.active &&
                    r.tone === 'emerald' &&
                    'border-emerald-500/50 bg-emerald-950/20 text-glow-emerald text-emerald-400 font-bold',
                )}
              >
                <span className="font-extrabold text-ink-dim/70">{r.pri}</span>
                <span className="tracking-wide">{r.name}</span>
                <span
                  className={clsx(
                    'font-bold text-[9px] uppercase tracking-widest',
                    state.unknown
                      ? 'text-ink-dim/50'
                      : state.active
                        ? r.tone === 'emerald'
                          ? 'text-emerald-400'
                          : 'text-cyan'
                        : 'text-zinc-600',
                  )}
                  title={state.unknown ? '/cockpit/status has no publisher yet' : undefined}
                >
                  {state.label}
                </span>
              </div>
            );
          })}
        </div>

        {status.muxSource === null && (
          <p className="font-mono text-[9px] text-ink-dim/70 mt-2 leading-snug">
            Ladder state is UNKNOWN — /cockpit/status is not published by the robot yet.
          </p>
        )}
      </section>

      {/* ── TELEOP AND GIMBAL CONTROLS ───────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none mb-3">
          <Move className="h-3.5 w-3.5" /> Teleop · gimbal
        </h2>

        {stopUnconfirmed && (
          <div
            className="mb-3 flex flex-col gap-2 rounded-md border border-red-500/60 bg-red-950/40 px-2.5 py-2 font-mono text-[9.5px] leading-snug text-red-300"
            role="alert"
          >
            <span className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span>
                <b className="uppercase tracking-wider text-red-400">Stop not confirmed</b> —{' '}
                {stopUnconfirmed.sent} of {STOP_TAIL_COUNT} zero commands left the browser. The
                robot may still be driving: the ESP32 latches its last command and there is no
                robot-side cmd_vel watchdog.
              </span>
            </span>
            <button
              onClick={disarmMotion}
              className="self-start rounded border border-red-500/70 bg-red-500/15 px-2 py-1 font-bold uppercase tracking-widest text-red-200 hover:bg-red-500/25"
              title="Disarm motion — /ugv/set_allow_motion false"
            >
              Disarm motion
            </button>
          </div>
        )}

        {!driveEnabled && (
          <div
            className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-950/20 px-2.5 py-1.5 font-mono text-[9.5px] leading-tight text-amber-400"
            role="status"
          >
            <Ban className="h-3.5 w-3.5 shrink-0" />
            <span>
              <b className="uppercase tracking-wider">Drive disabled</b> — {driveGateReason}
            </span>
          </div>
        )}

        {/* ── THROTTLE ─────────────────────────────
            Waveshare's rate ladder. Real buttons because pointer operators have
            no keyboard; each prints the straight-line speed it commands, so the
            selector is a readout as well as a control. */}
        <div className="mb-3 flex flex-col gap-1">
          <div className="flex items-center justify-between font-mono text-[8.5px] uppercase tracking-widest text-ink-dim/70 leading-none">
            <span>Throttle</span>
            <span className="text-zinc-500">1 2 3</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {RATE_LABELS.map((label, index) => {
              const active = !driveView.input.boost && driveView.input.rateIndex === index;
              const shadowed = driveView.input.boost && driveView.input.rateIndex === index;
              return (
                <button
                  key={label}
                  onClick={() => selectRate(index)}
                  aria-pressed={active}
                  title={`${label} — ${straightSpeedAt(index).toFixed(2)} m/s straight (${index + 1})`}
                  className={clsx(
                    'flex flex-col items-center gap-0.5 rounded-md border px-1 py-1 font-mono leading-none select-none',
                    active
                      ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-400 text-glow-emerald'
                      : shadowed
                        ? 'border-amber-500/40 bg-panel-2/40 text-amber-500/70'
                        : 'border-rim bg-panel-2/40 text-ink-dim hover:border-cyan/40 hover:text-cyan',
                  )}
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
                  <span className="text-[8px] opacity-80">
                    {straightSpeedAt(index).toFixed(2)} m/s
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {/* DIRECTIONAL DRIVING PAD */}
          <div className="flex flex-col justify-between">
            <div className="grid grid-cols-3 grid-rows-3 gap-1.5 justify-center max-w-[120px] mx-auto">
              <span className="blank bg-transparent" />
              <motion.button
                whileTap={{ scale: 0.9, y: 2 }}
                {...holdProps('forward')}
                disabled={!driveEnabled}
                className={padClass('forward')}
                title={driveEnabled ? 'Forward (W)' : `Disabled — ${driveGateReason}`}
              >
                ▲
              </motion.button>
              <span className="blank bg-transparent" />

              <motion.button
                whileTap={{ scale: 0.9, y: 2 }}
                {...holdProps('left')}
                disabled={!driveEnabled}
                className={padClass('left')}
                title={driveEnabled ? 'Left (A)' : `Disabled — ${driveGateReason}`}
              >
                ◀
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9, y: 2 }}
                onClick={() => releaseAll('operator stop', true)}
                className="btn border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded-lg aspect-square text-sm flex items-center justify-center font-bold select-none"
                title="Stop (Space) — releases intent"
              >
                ■
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9, y: 2 }}
                {...holdProps('right')}
                disabled={!driveEnabled}
                className={padClass('right')}
                title={driveEnabled ? 'Right (D)' : `Disabled — ${driveGateReason}`}
              >
                ▶
              </motion.button>

              <span className="blank bg-transparent" />
              <motion.button
                whileTap={{ scale: 0.9, y: 2 }}
                {...holdProps('backward')}
                disabled={!driveEnabled}
                className={padClass('backward')}
                title={driveEnabled ? 'Reverse (S)' : `Disabled — ${driveGateReason}`}
              >
                ▼
              </motion.button>
              <span className="blank bg-transparent" />
            </div>

            <div className="text-center font-mono text-[8.5px] uppercase tracking-widest font-bold mt-3 leading-none">
              <span className={driveEnabled ? 'text-amber-500/80' : 'text-zinc-600'}>
                Keyboard: WASD · 1/2/3 · Shift · Spc
              </span>
              {/* The honest surface: what left the browser, not what the robot
                  achieved. Commanded yaw currently under-delivers on this
                  chassis — that is a robot-side calibration defect, and this
                  readout deliberately does not compensate for it. */}
              <div className="mt-1.5 font-normal normal-case tracking-normal text-[10px] text-ink-dim">
                <span
                  className={driving ? 'text-emerald-400' : 'text-zinc-500'}
                  title="Commanded — what left the browser, not what the robot achieved"
                >
                  X {signed(driveView.twist.linearX, 2)} m/s · Z{' '}
                  {signed(driveView.twist.angularZ, 2)} rad/s
                </span>
              </div>
              {driveView.input.boost && (
                <div className="mt-1 inline-block rounded border border-amber-500/60 bg-amber-950/30 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-amber-400">
                  BOOST
                </div>
              )}
              <div className="text-zinc-500 font-normal scale-90 mt-1">
                Ceiling {LINEAR_MAX.toFixed(2)} m/s · {ANGULAR_MAX.toFixed(2)} rad/s ·{' '}
                {DRIVE_PUBLISH_HZ} Hz held
              </div>
              {driving && (
                <div className="text-emerald-400 font-bold scale-90 mt-1 animate-pulse">
                  COMMANDING
                </div>
              )}
            </div>
          </div>

          {/* GIMBAL SCANNING DISPLAY */}
          <div className="flex flex-col gap-2 relative">
            <div
              ref={gimbalBoxRef}
              onPointerDown={(e) => {
                if (gimbalDead) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                gimbalDraggingRef.current = true;
                aimFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (!gimbalDraggingRef.current) return;
                aimFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                gimbalDraggingRef.current = false;
              }}
              onPointerCancel={() => {
                gimbalDraggingRef.current = false;
              }}
              onLostPointerCapture={() => {
                gimbalDraggingRef.current = false;
              }}
              style={{ touchAction: 'none' }}
              className={clsx(
                'gimbal aspect-video border border-rim/60 rounded-lg relative bg-[linear-gradient(rgba(54,224,224,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(54,224,224,0.06)_1px,transparent_1px)] bg-[size:16px_16px] bg-hull/75 flex items-center justify-center',
                gimbalDead ? 'opacity-40 cursor-not-allowed' : 'cursor-crosshair',
              )}
              title={gimbalDead ? 'Bridge refused the gimbal topic' : 'Drag to aim the pan-tilt head'}
            >
              {/* The tilt range is ASYMMETRIC (-0.523 … +1.571 rad), so neutral
                  does NOT sit at the vertical midpoint — it sits where 0 rad
                  actually falls on that range. The labelled axis and the neutral
                  guide below make that legible instead of centring the crosshair
                  and lying about where the head is pointing. */}
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-ink-dim/25"
                style={{ top: `${((TILT_MAX - 0) / (TILT_MAX - TILT_MIN)) * 100}%` }}
              />
              <div
                className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-ink-dim/25"
                style={{ left: '50%' }}
              />

              <div
                className="pointer-events-none absolute w-4.5 h-4.5 translate-x-[-50%] translate-y-[-50%] transition-all duration-150"
                style={{
                  left: `${((pan - PAN_MIN) / (PAN_MAX - PAN_MIN)) * 100}%`,
                  top: `${((TILT_MAX - tilt) / (TILT_MAX - TILT_MIN)) * 100}%`,
                }}
              >
                <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-amber shadow-[0_0_8px_#ffb020]" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] bg-amber shadow-[0_0_8px_#ffb020]" />
              </div>

              {/* Axis extents, so the crosshair position is readable as a real
                  joint angle rather than an arbitrary spot in a box. */}
              <span className="pointer-events-none absolute top-0.5 right-1 font-mono text-[6.5px] text-ink-dim/60 leading-none">
                tilt +{TILT_MAX.toFixed(2)}
              </span>
              <span className="pointer-events-none absolute bottom-0.5 right-1 font-mono text-[6.5px] text-ink-dim/60 leading-none">
                tilt {TILT_MIN.toFixed(2)}
              </span>
              <span className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-[7px] text-ink-dim/70 leading-none">
                P: {pan.toFixed(2)} · T: {tilt.toFixed(2)} rad
              </span>
            </div>

            {/* Gimbal Controls */}
            <div className="flex items-center justify-between gap-1 mt-1">
              <button
                onClick={resetGimbal}
                className="border border-rim bg-panel-2/40 hover:border-cyan/40 hover:text-cyan rounded px-2 py-0.5 font-mono text-[9px] select-none flex items-center gap-1 text-ink-dim uppercase"
                title="Center Gimbal"
              >
                <RotateCcw className="h-3 w-3" /> Center
              </button>
              <button
                onClick={toggleSteady}
                disabled={isDead('/ugv/pt_steady_ctrl')}
                className={clsx(
                  'border rounded px-1.5 py-0.5 font-mono text-[9px] select-none flex items-center gap-1 uppercase',
                  isDead('/ugv/pt_steady_ctrl')
                    ? 'border-rim/40 text-zinc-600 cursor-not-allowed'
                    : steady
                      ? 'border-emerald-500/50 bg-emerald-900/10 text-emerald-400'
                      : 'bg-panel-2/40 border-rim hover:border-cyan/40 hover:text-cyan text-ink-dim',
                )}
                title="Toggle steady mode"
              >
                <Sparkles className="h-3 w-3" /> {steady ? 'Steady On' : 'Steady Off'}
              </button>
            </div>
          </div>
        </div>

        {fault && (
          <p className="mt-3 rounded border border-red-500/40 bg-red-950/25 px-2.5 py-1.5 font-mono text-[9.5px] leading-tight text-red-400">
            {fault}
          </p>
        )}
      </section>

      {/* ── LED LIGHT RAIL CONTROLLERS ───────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md gap-3.5">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none">
          <Lightbulb className="h-3.5 w-3.5" /> LED rail{' '}
          <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/ugv/led_ctrl</span>
        </h2>

        {isDead('/ugv/led_ctrl') && (
          <p className="rounded border border-red-500/40 bg-red-950/25 px-2.5 py-1.5 font-mono text-[9.5px] text-red-400">
            Bridge refused /ugv/led_ctrl — headlights are dead.
          </p>
        )}

        <div className="flex flex-col gap-2.5 font-mono text-[10.5px]">
          {/* IO4 LED Chassis Headlight */}
          <div className="grid grid-cols-[40px_1fr_40px] gap-2 items-center">
            <span className="hud-label text-[9px] uppercase leading-none text-ink-dim/80">IO4</span>
            <input
              type="range"
              min="0"
              max="255"
              value={io4}
              disabled={isDead('/ugv/led_ctrl')}
              onChange={(e) => updateLEDs(Number(e.target.value), io5)}
              className="accent-amber bg-transparent w-full cursor-pointer h-1 rounded-full select-none disabled:cursor-not-allowed"
              title="Chassis headlights PWM duty"
            />
            <span className="text-right text-glow-amber text-amber font-bold leading-none select-none">
              {io4.toString().padStart(3, '0')}
            </span>
          </div>

          {/* IO5 LED Spotlight PT */}
          <div className="grid grid-cols-[40px_1fr_40px] gap-2 items-center">
            <span className="hud-label text-[9px] uppercase leading-none text-ink-dim/80">IO5</span>
            <input
              type="range"
              min="0"
              max="255"
              value={io5}
              disabled={isDead('/ugv/led_ctrl')}
              onChange={(e) => updateLEDs(io4, Number(e.target.value))}
              className="accent-amber bg-transparent w-full cursor-pointer h-1 rounded-full select-none disabled:cursor-not-allowed"
              title="Pan-tilt spotlight PWM duty"
            />
            <span className="text-right text-glow-amber text-amber font-bold leading-none select-none">
              {io5.toString().padStart(3, '0')}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
