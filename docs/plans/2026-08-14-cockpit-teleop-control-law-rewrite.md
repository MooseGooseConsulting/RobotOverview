# Cockpit teleop control law — remaining work

Status: **shipped on main via #215** (2026-08-14). The control law is
`src/lib/ros/drive-law.ts` (pure: held-set composition, throttle ladder, arc
ratios, stop-tail constants) plus `src/components/cockpit/CommandRail.tsx`
(wiring: events in, publishes out), covered by `src/__tests__/drive-law.test.ts`
and `src/__tests__/command-rail.test.tsx`. **Code is truth** — read those files,
not a description of them. **Do not re-port the control law.**

What is left is on this page: the ceiling correction, the on-robot wire check,
the owner feel gate, and the follow-ons that were deliberately withheld.

This document no longer carries illustrative snippets of the implementation.
The ones it used to carry omitted guards the shipped code has — `setDriveIntent`
cancels a still-scheduled stop tail via `clearPendingTailTimer`, and
`releaseAll` only stops when `wasCommanding`, which is why a gate that is
already closed on mount does not raise a false STOP NOT CONFIRMED. Reviewing
prose against code produced findings against code that was already right. Read
the code.

## 1. The ceiling is wrong at 1.3 m/s — #219 corrects it to 0.2

`LINEAR_MAX = 1.3` as shipped is a **unit error**, not a ported ceiling.
Waveshare's `max_speed: 1.3` and `slow_speed: 0.2` are scalars on its
`{"T":1,"L":…,"R":…}` per-track wheel-speed command. Our cockpit publishes a
`geometry_msgs/Twist` that `beast_base` forwards as `{"T":"13","X":…,"Z":…}` — a
different firmware command with different units — and **nothing in the chain
clamps it**: `cmd_vel_callback` forwards `linear.x` / `angular.z` raw
(`base_node.py`), `twist_mux` does not clamp, and the robot-side `cmd_vel`
watchdog was removed 2026-08-07. Shipping `1.3` therefore multiplied the prior
`LINEAR_STEP = 0.2` m/s cap by 6.5 on an unclamped path.

An earlier revision of this document asserted that `1.3` "matches the reference
cockpit the owner liked" and told the implementer to ship parity. **That was
false, and it contradicted this same document's own wire-format note.** The
*dimensionless* halves of the port survive the format change and stand:
`RATE_PRESETS` (`0.3 / 0.66 / 1.0`), `RATE_BOOST`, `ARC_LINEAR_SCALE = 0.577`
and `ARC_ANGULAR_SCALE = 0.423`. The magnitudes do not. `ANGULAR_MAX = 1.0`
rad/s has no Waveshare equivalent at all and is still expected to be tuned on
the first drive.

Everything below states expectations as **formulas over the exported
constants**, never as literal m/s, so the checks survive #219.

## 2. Open — on the robot, motion DISARMED

The high-value review path: `beast_base.cmd_vel_callback` rejects non-zero
commands and sends a stop while `allow_motion` is false, yet `/cmd_vel_ui` still
carries exactly what the browser sent. The whole control law is readable without
the robot moving.

```bash
ssh beast-01-ts
source /opt/ros/humble/setup.bash
source /home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash
ros2 param get /beast_base allow_motion          # must print False before you start
ros2 topic echo /cmd_vel_ui
```

- [ ] `W` alone → `linear.x` = `LINEAR_MAX × RATE_PRESETS[0]`, `angular.z` = 0.
- [ ] `W+A` → **both** non-zero, at the `ARC_*` ratios.
- [ ] Release `A`, keep `W` → `linear.x` rises to the straight-line value,
      `angular.z` → 0, **and no zero Twist appears between them.** This is the
      headline fix; see it on the wire before driving.
- [ ] `S+A` → negative `linear.x`, **negative** `angular.z` (`REVERSE_YAW_SENSE`).
- [ ] `2`, `3`, `SHIFT` scale both axes exactly as the UI prints them; releasing
      `SHIFT` returns to the selected preset, never to full and never to zero.
- [ ] Release everything → exactly `STOP_TAIL_COUNT` zero Twists ~20 ms apart,
      then silence.
- [ ] Kill `rosbridge_websocket` while a key is held → `STOP NOT CONFIRMED`
      appears; restarting it re-fires the tail and clears the banner.

## 3. Open — owner feel gate (REQUIRED, supervised, motion ARMED)

**The premise of this work was subjective: the owner said the controls did not
feel great. No test detects that.** This gate is the acceptance criterion. One
session, safe open space, owner at the keyboard, robot armed. Pass/fail as felt:

- [ ] **Course correction without stopping.** Hold `W`, tap `A` twice. It yaws
      briefly and keeps going. **Fail on any stop, hitch, or stutter.**
- [ ] **A real arc.** Hold `W+A` around a corner — one continuous curve.
      **Fail if it is stop-pivot-go.**
- [ ] **Exit the arc cleanly.** From `W+A`, release `A` while holding `W`. It
      straightens and continues at full straight-line speed. **Fail on a pause.**
- [ ] **Throttle steps.** At SLOW, press `2`, then `3`. Speed changes
      immediately, mid-drive. **Fail if a key release is required.**
- [ ] **BOOST in and out.** Hold `SHIFT` at SLOW: immediate jump to full;
      release: immediate settle back to SLOW. **Fail if it settles to full, to
      zero, or lags.**
- [ ] **Stops when expected.** At FAST, release all keys, then repeat with
      `Space`. **Fail on coast, lurch, or drift.**
- [ ] **Immediate response.** Motion starts the instant a key goes down. **Fail
      on any perceptible lag** — the explicit check that no rate limiting crept
      in (§5).
- [ ] **Reverse steering sense.** Hold `S+A`. Waveshare parity inverts steering
      in reverse; `ugv_tools/keyboard_ctrl.py`'s `moveBindings` does the
      opposite, and that package **is** built on the robot and launchable on
      demand. Two teleop surfaces, one disagreement. Either answer is
      acceptable — `REVERSE_YAW_SENSE` is a one-line flip — but **whichever he
      picks, both surfaces must end up matching it.** Changing `ugv_tools` is a
      separate PR; record the answer and hand it over.
- [ ] **Default speed.** Is `LINEAR_MAX × RATE_PRESETS[0]` a usable everyday
      default — not too slow, not alarming? This is the number he complained
      about; record the answer and any tuned `ANGULAR_MAX`.

**If he drives it and it still does not feel right, this is NOT done regardless
of test status.** The next step is to compare against the Waveshare reference
(`ugv_rpi/templates/control.js`) item by item. **It is not to add features** —
everything in §5 was withheld for exactly this reason.

## 4. Open — three untested exit paths

Owned by [`2026-08-14-verification-surfaces.md`](2026-08-14-verification-surfaces.md);
listed here only so nobody assumes #215 covered them.

- **A8** — pending stop re-fires on reconnect.
- **A10** — `isContentEditable` focus guard.
- **A11** — `releaseAll` on `visibilitychange` / `pointercancel` / gate close.

## 5. Deliberately NOT built — do not re-derive

- **Browser-side slew / acceleration limiter.** Waveshare had none and felt
  responsive; a limiter adds input lag, which is the exact complaint being
  fixed. Its only real justification is odometry quality (step commands break
  static friction, tracks slip, the ESP32 encoders over-count, and the error
  reaches the EKF and SLAM) — **a mapping concern, not a piloting one.** If it
  is ever revisited, measure the SLAM benefit and the piloting cost separately,
  and honour the hard requirement below. **Do not gate a ceiling change behind
  it.**
- **HARD REQUIREMENT if a limiter is ever added:** `runStopTail` must keep
  publishing **literal zeros**, never through the limiter, and must reset the
  limiter's state to zero so the next keydown starts from a standstill. A stop
  that ramps is not a stop on a robot whose ESP32 latches and has no watchdog —
  it turns `Space` from an e-stop into a decel curve. The tripwire test
  `"the stop tail publishes literal zero, never a ramped value"` exists for
  this; **do not delete it as redundant.**
- **Reverse-speed cap** (`REVERSE_SCALE` when `axial < 0`). The camera faces
  forward, so reversing is blind. Waveshare's reverse is symmetric, so this is a
  deliberate divergence — its own PR, its own justification.
- **Yaw-rate scaling against linear speed.** Must land **after** the track-width
  calibration; tuning a falloff on top of a mis-scaled yaw command bakes the
  error into a second constant.
- **Analog stick / gamepad on the UI rung.** Out of scope — the robot already
  has two higher-priority joy rungs (150 / 100), and `ugv_tools` is built, so
  `joy_ctrl` and `keyboard_ctrl` may be started at any time. Assume they can be
  live when reasoning about arbitration.

## 6. Evaluated and rejected — robot-side velocity smoother below the mux

Recorded so it is not re-proposed as new.

**`nav2_velocity_smoother` does not run.** It is *configured* and launched from
source (`ugv_nav/launch/nav_bringup/navigation_launch.py`,
`ugv_cockpit/launch/behavior_server.launch.py`), but `ros2 node list` shows no
`velocity_smoother`, no `collision_monitor`, and **no nav2 node at all** — only
the `/cmd_vel_nav` topic, which exists because `twist_mux` subscribes to it.
**Launch files describe intent; `ros2 node list` describes reality.** There is
no acceleration limiting anywhere in the live system, on teleop or autonomy.

Its numbers are **untouched vendor boilerplate**, not local intent:
`ugv_nav/params/dwa.yaml` has exactly one commit — the subtree import — and the
only deltas against vendor are two `collision_monitor` lines. `max_accel:
[0.4, 0.0, 1.0]` and `max_vel_x: 0.26` are nav2's stock TurtleBot3 values.
**Nobody here chose them.** Vendor-inherited defect, flagged only:
`decel_lim_theta` is declared twice (`-1.0`, then `-3.2`); YAML last-wins. The
nav params belong to the autonomy on-ramp, not to this work.

The proposal would be a second smoother **downstream of the mux**, on
`/cmd_vel`. **Honest advantage:** one node protects every source — the browser,
the BT pad (150), `keyboard_ctrl` (100), and nav — where a browser-side limiter
is trivially bypassed by any other publisher. **Blocking objection:** below the
mux it would ramp the zero tail too, and `velocity_timeout: 1.0` means it keeps
emitting its own ramp for up to a second after the source goes silent — it would
*manufacture* commands nobody sent. The entire safety topology rests on "an
explicit `T:13` zero is the only halt". That is a change to the stop path, not
an addition to it. **Evaluate it with the nav/autonomy work, with a deliberate
zero-bypass design.**

**Sourcing trap — read before reporting anything "missing" on BEAST-01.**
`ros2 pkg` and most `ros2` introspection resolve against whatever overlay your
shell sourced. With only `/opt/ros/humble/setup.bash`, `ros2 pkg executables
ugv_tools` prints *"Package 'ugv_tools' not found"* — a statement about your
shell, not the robot. The live workspace is
`/home/beast/beast/RobotOverview/robot/beast/ros2_ws/install`; `~/ugv_ws` and
`~/beast/ugv_ws` do not exist, and sourcing a missing overlay under
`2>/dev/null` fails silently. If `ros2 pkg` says something is missing, run
`ros2 node list` first — it needs no overlay. **If nodes list but packages
don't, your overlay did not source and the result is meaningless.**

## 7. Close-out

- [ ] `docs/beast-ops.md` Quick connect updated and dated with anything learned
      (AGENTS.md rule).
- [ ] An `append_insight` landed for the durable answers — the reverse-steering
      sense, the default speed, and any tuned `ANGULAR_MAX`.
- [ ] **Delete this file.** Executed plans are not archived; git is the archive.
