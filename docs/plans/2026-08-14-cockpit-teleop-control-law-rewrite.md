# Cockpit teleop control law — browser-side rewrite (work order)

Status: **Open, not started.** Written 2026-08-14 after reading the current
`CommandRail.tsx`, the vendored ROS teleop, and Waveshare's original Pi cockpit
(`waveshareteam/ugv_rpi`, `templates/control.js` + `config.yaml`) side by side. Scope is
**browser-side only** — no ROS package, launch file, or firmware change is in this plan.

This is a **work order**, not a record of reasoning: it names inputs, the exact changes,
what to emit, and how to tell when it is done. **Code is truth** — if this document and
the code disagree, the code is right and this document is stale.

**The premise.** The owner drove the original Waveshare Pi cockpit and it felt good. He
says ours feels bad. **Waveshare is therefore the proven reference, not a starting point
to improve on.** The bar for adding anything Waveshare did not have is high, and
"theoretically better" does not clear it. Where this plan diverges from the reference it
says so explicitly and gives a reason. Everything else is a port.

## 0. What is wrong today

`src/components/cockpit/CommandRail.tsx` is the cockpit's only driving surface and it is
the least capable teleop in the building. Verified against the file at `98a11a1`:

1. **No composition.** The keydown `switch` (lines 160–177) calls
   `setDriveIntent(x, z)`, which **replaces** the whole intent. `W` then `A` does not
   arc — the second key overwrites the first. There are no diagonals.
2. **Blanket stop on any release.** `handleKeyUp` (line 181) calls `clearDriveIntent()`
   if **any** of `w/a/s/d` goes up. Releasing `A` while still holding `W` stops the robot
   dead in the middle of a turn. This is almost certainly the single largest contributor
   to "it feels bad": you cannot correct your course without stopping.
3. **No throttle at all.** `LINEAR_STEP = 0.2` m/s and `ANGULAR_STEP = 0.4` rad/s
   (lines 29–30) are hard-coded. WASD is bang-bang: 0 % or 100 % of a ceiling that is
   itself six times below the reference cockpit's.
4. **An unchecked single-zero stop.** `clearDriveIntent` (lines 103–114) calls
   `publishTwist(0, 0)` and **throws away the boolean** — unlike `setDriveIntent`, which
   checks it. There is **no robot-side `cmd_vel` watchdog** (removed 2026-08-07 —
   see the module docstring of
   `robot/beast/ros2_ws/src/ugv_main/beast_base/beast_base/base_node.py`, lines 7–10) and
   the ESP32 **latches its last command** (live-proven 2026-08-07: +0.81 m of travel
   during 5 s of command silence). A socket that dies on the stop publish therefore
   leaves the robot driving, and the UI says nothing.

Fact that frames the whole plan: **`beast_base.cmd_vel_callback` forwards `linear.x` /
`angular.z` to the ESP32 as `{"T":"13","X":…,"Z":…}` with no clamp of any kind**
(`base_node.py:358–375`). `twist_mux` does not clamp either. **The browser constant is
the only speed cap in the chain.**

## 1. Inputs — read these before writing code

| Input | Why |
|---|---|
| `src/components/cockpit/CommandRail.tsx` | The file being rewritten. |
| `src/lib/ros/client.ts` (`publish`, line 983; `ROS_PUBLICATIONS`, line 41; `callService`, line 1000) | `publish` returns `false` iff the socket is not `OPEN`. `/cmd_vel_ui` is already advertised as `geometry_msgs/msg/Twist` — **no change needed there.** |
| `src/__tests__/command-rail.test.tsx` | Every existing behavioural assertion; §8 names what moves. |
| Reference clone: `ugv_rpi/templates/control.js` (`move_buttons`, `moveProcess`, `speedCtrl`, `onkeydown`/`onkeyup`, lines 801–1016) and `ugv_rpi/config.yaml` (`args_config`) | **The behaviour being ported.** `max_speed: 1.3`, `slow_speed: 0.2`, `min_rate: 0.3`, `mid_rate: 0.66`, `max_rate: 1.0`. |
| `robot/beast/ros2_ws/src/ugv_main/beast_base/beast_base/base_node.py` | `cmd_vel_callback` (no clamp), `send_stop_command`, the `allow_motion` gate, the no-watchdog docstring. |
| `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/config/twist_mux.yaml` | `ui` rung: topic `cmd_vel_ui`, `timeout: 0.5`, `priority: 50`. **NOTE:** this file's prose still claims a 0.5 s robot-side `cmd_vel_timeout` watchdog exists. It does not. That stale copy is the open M6 sweep item of `2026-08-07-beast-ros-drift-inventory-and-stripdown.md` — do not "fix" it here, but do not believe it either. |
| `robot/beast/ros2_ws/src/ugv_main/ugv_tools/ugv_tools/keyboard_ctrl.py` | Precedent for the stop tail (`ZERO_TAIL_LIMIT = 5` @ `LOOP_PERIOD = 0.02`) **and a live conflicting convention** — this package **is** built on the robot and `keyboard_ctrl` is launchable on demand. See §3.4 before choosing a steering sense. |

**Wire-format difference you must not paper over.** Waveshare's browser sent
`{"T":1,"L":…,"R":…}` — raw per-track wheel speeds, scaled by `speed_rate` in
`cmdJsonCmd`. Our cockpit sends a `geometry_msgs/Twist`, which `beast_base` forwards as
`{"T":"13","X":…,"Z":…}`. These are **different firmware commands with different
units**. Waveshare's `1.3` and `0.2` are wheel-speed numbers on the `T:1` path; they are
**not** m/s on the `T:13` path. Port the *structure* and the *dimensionless ratios*;
treat the magnitudes as a starting point to be confirmed on the first drive (§9.3), not
as calibrated m/s.

## 2. Ceiling, throttle, rate limit — three mechanisms, not one

The repo conflates these. Naming them separately is what makes the rest of this plan
legible:

| Mechanism | What it means | Today | Waveshare | This plan |
|---|---|---|---|---|
| **Ceiling** | The maximum the robot may *ever* be commanded to do. | `LINEAR_STEP = 0.2` m/s in the browser — and, per §0, the only cap anywhere in the chain. | `max_speed: 1.3` | **Port it.** §3.3 |
| **Throttle** | What fraction of the ceiling the operator is asking for *right now*. | **Nothing.** WASD is bang-bang: 0 % or 100 %. | `min/mid/max_rate` = `0.3 / 0.66 / 1.0`, keys `1`/`2`/`3`, `SHIFT` → `max_rate` while held. | **Port it.** §3.5 |
| **Rate limit** | How fast the commanded value may *change* (m/s², rad/s²). | **Nothing**, anywhere in the teleop path. | **Nothing.** | **Port that too — i.e. none.** §6 keeps it as an optional, honestly-caveated follow-on. |

**The owner's question — "shouldn't we have some sort of throttle, it shouldn't go full
bore all the time?" — is answered by the throttle row, not by the ceiling row.** Today
there is no throttle at all, which is exactly why the current control has to keep the
ceiling pinned at `0.2` to stay safe: a bang-bang control with no throttle can only be
made gentle by making it slow. Adding the throttle is what lets the ceiling go up without
the robot always going full bore. The two changes belong together.

**Waveshare provided a ceiling and a throttle and no rate limit, and we are porting
exactly that.** A rate limiter adds input lag, and input lag is the complaint we are
fixing — see §6 before proposing one.

## 3. The control law

### 3.1 Decision: compose in Twist space, not differential L/R space

**Compose in Twist space (`linear.x`, `angular.z`).** Reasons, in order of weight:

1. The wire is Twist from the browser through `twist_mux` all the way to
   `beast_base`; the `X`/`Z` → per-track conversion happens **inside the ESP32
   firmware**, which we do not own.
2. Composing in L/R would require converting back with `Z = (R − L) / W`. `W` is a
   track width the browser would have to assume. The only track width in this repo —
   `0.143864` in `ugv_bringup/ugv_bringup/odom_publisher.py:68` — is **geometric**, and
   it under-delivers commanded yaw on a tracked chassis because tracks scrub. **Another
   agent owns that calibration.** Hard-coding a guessed `W` in the browser would put a
   second, contradictory copy of that constant in the codebase. Do not.
3. Every other rung on the mux thinks in Twist. A UI that thinks in L/R would be the
   only source with a different mental model.

**Coupling to flag, not to resolve here:** because commanded yaw currently
under-delivers, the *measured* turn rate for a given `angular.z` will be lower than the
number this UI prints. That is a robot-side calibration defect, not a browser bug. Do not
compensate for it in the browser; when the calibration lands, this UI gets more accurate
for free.

### 3.2 Held key-set + per-key release recompute — the core fix

Port Waveshare's `move_buttons` structure. New pure module — **create
`src/lib/ros/drive-law.ts`** (no React, no side effects, unit-testable):

```ts
export type DriveKey = 'forward' | 'backward' | 'left' | 'right';

export type DriveInput = {
  held: Record<DriveKey, boolean>;
  rateIndex: number;  // index into RATE_PRESETS
  boost: boolean;     // SHIFT held
};

export type DriveIntent = { linearX: number; angularZ: number };

export function effectiveRate(input: DriveInput): number {
  return input.boost ? RATE_BOOST : RATE_PRESETS[input.rateIndex];
}

/** Pure. The entire control law. Given the held set and the throttle, produce one Twist. */
export function composeTwist(input: DriveInput): DriveIntent {
  const rate = effectiveRate(input);
  const lin = LINEAR_MAX * rate;
  const ang = ANGULAR_MAX * rate;

  // Opposing keys cancel. Waveshare's if/else chain has NO branch for W+S or A+D and
  // therefore silently keeps the PREVIOUS L/R — a vendor bug. We cancel to zero.
  const axial = (input.held.forward ? 1 : 0) - (input.held.backward ? 1 : 0); // -1|0|1
  const yawKey = (input.held.left   ? 1 : 0) - (input.held.right    ? 1 : 0); // -1|0|1

  if (axial === 0 && yawKey === 0) return { linearX: 0, angularZ: 0 };
  if (axial === 0) return { linearX: 0, angularZ: yawKey * ang };       // spin in place
  if (yawKey === 0) return { linearX: axial * lin, angularZ: 0 };       // straight
  return {                                                              // arc
    linearX:  axial * lin * ARC_LINEAR_SCALE,
    angularZ: yawKey * ang * ARC_ANGULAR_SCALE * REVERSE_YAW_SENSE(axial),
  };
}
```

(`REVERSE_YAW_SENSE` is defined in §3.4 — it is `1` for forward and, by default, `-1`
for reverse.)

In `CommandRail`, the held set lives in **a ref, mirrored to state for render**. The ref
is what the event handlers and the republish interval read (no stale closures); the state
is what the JSX reads.

```ts
const driveInputRef = useRef<DriveInput>({
  held: { forward: false, backward: false, left: false, right: false },
  rateIndex: RATE_DEFAULT_INDEX,
  boost: false,
});
const [driveView, setDriveView] = useState<{ input: DriveInput; twist: DriveIntent }>(…);
```

Every mutation goes through **one** function:

```ts
/** Mutate the ref, recompute, publish or stop. The ONLY path that changes drive state. */
const applyDriveInput = useCallback((mutate: (d: DriveInput) => void) => {
  mutate(driveInputRef.current);
  const twist = composeTwist(driveInputRef.current);
  setDriveView({ input: { ...driveInputRef.current }, twist });
  if (twist.linearX === 0 && twist.angularZ === 0) runStopTail('intent returned to zero');
  else setDriveIntent(twist);
}, [setDriveIntent, runStopTail]);
```

- `keydown w/a/s/d` → `applyDriveInput(d => { d.held.forward = true })`. **Idempotent** —
  a duplicate keydown sets an already-true flag and recomputes to the same Twist. Keep
  the `e.repeat` early-return as belt-and-braces; set membership is the real guard.
- `keyup w/a/s/d` → `applyDriveInput(d => { d.held.forward = false })`. **This is the
  per-key release recompute — the headline fix.** Releasing `A` while holding `W`
  recomputes to `{ lin, 0 }`: full straight-line forward, no stop, no gap. Waveshare does
  exactly this (`onkeyup` → `updateMoveButton(key, 0)` → `moveProcess()`).
- `Space` / `Escape` → `releaseAll('operator stop')`: clear **all four** flags and
  `boost`, then run the stop tail.
- `blur` / `pointercancel` / `visibilitychange:hidden` → `releaseAll(...)`. Clearing
  `boost` here is load-bearing: a `Shift` keyup that lands on another window never
  reaches us, and a stuck boost flag would make the next keypress full-rate.
- The existing gate effect (`if (!driveEnabled)`) → `releaseAll('gate closed')`. It must
  clear the held set, not just publish a zero, so that a gate reopening under a
  physically-still-held key does **not** resume motion. A fresh keydown is required.

`holdProps` changes shape from `holdProps(linearX, angularZ)` to `holdProps(key: DriveKey)`;
`onPointerDown` sets that one flag, `onPointerUp` / `onPointerCancel` /
`onLostPointerCapture` clear that one flag. Multi-touch on a tablet then composes
diagonals exactly like the keyboard does.

### 3.3 Constants — Waveshare parity

Put these in `src/lib/ros/drive-law.ts` and export them:

```ts
// ── CEILING ─────────────────────────────────────────────────────────────────
// Waveshare's max_speed, ported. There is NO robot-side clamp (beast_base forwards
// X/Z raw, twist_mux does not clamp) — this IS the cap for the whole chain.
export const LINEAR_MAX = 1.3;   // m/s

// The one number with no Waveshare equivalent: its browser was differential L/R and
// never named a yaw rate. 1.0 rad/s is what every nav2 params file in this repo uses
// for max_vel_theta, and commanded yaw currently UNDER-delivers (§3.1), so it is
// conservative in practice. Expect to tune it on the first drive (§9.3).
export const ANGULAR_MAX = 1.0;  // rad/s

// ── THROTTLE ────────────────────────────────────────────────────────────────
// Waveshare's own rate ladder — ugv_rpi/config.yaml args_config.
export const RATE_PRESETS = [0.3, 0.66, 1.0] as const;   // min / mid / max_rate
export const RATE_LABELS  = ['SLOW', 'CRUISE', 'FAST'] as const;
export const RATE_DEFAULT_INDEX = 0;   // Waveshare boots at min_rate; so do we
export const RATE_BOOST = 1.0;         // SHIFT → max_rate while held

// ── ARC GEOMETRY ────────────────────────────────────────────────────────────
// Derived from Waveshare's two wheel constants as DIMENSIONLESS ratios so they
// survive the T:1(L,R) → T:13(X,Z) format change:
//   max_speed = 1.3, slow_speed = 0.2   (config.yaml args_config)
//   forward component = (max + slow) / (2 * max) = 0.577
//   yaw     component = (max − slow) / (2 * max) = 0.423  (turn-in-place = 1.0)
export const ARC_LINEAR_SCALE  = 0.577;
export const ARC_ANGULAR_SCALE = 0.423;

// ── STOP TAIL ───────────────────────────────────────────────────────────────
// Mirrors ugv_tools/keyboard_ctrl.py ZERO_TAIL_LIMIT=5 @ LOOP_PERIOD=0.02.
export const STOP_TAIL_COUNT = 5;
export const STOP_TAIL_INTERVAL_MS = 20;   // 5 × 20 ms = 100 ms of zeros, then silence
```

Resulting speeds — **these match the reference cockpit the owner liked**:

| Throttle | Key | `linear.x` straight | `linear.x` in an arc | `angular.z` spin |
|---|---|---|---|---|
| SLOW (default) | `1` | **0.39 m/s** | 0.23 m/s | 0.30 rad/s |
| CRUISE | `2` | 0.86 m/s | 0.50 m/s | 0.66 rad/s |
| FAST | `3` | 1.30 m/s | 0.75 m/s | 1.00 rad/s |
| BOOST | `SHIFT` | 1.30 m/s | 0.75 m/s | 1.00 rad/s |

The default of `1.3 × 0.3 = 0.39` m/s is Waveshare's own default straight-line speed and
is just under **2×** today's `0.2`. **An earlier draft of this plan proposed a Stage 1
default of `0.18` m/s. That was a precaution, not evidence, and it was wrong** — shipping
a default slower than the status quo does not answer a complaint that the robot is too
slow and too twitchy. No measured evidence was found that this chassis cannot take
`1.3` m/s: `find.ts` returns no speed rating for the unit, and the reference cockpit
shipped `1.3` for this class of robot and the owner drove it happily. **Ship parity.**
`DRIVE_PUBLISH_HZ` stays at `10`.

The first supervised drive should still *start* at SLOW and step up through the presets
(§9.3). That is a drive protocol, not a code gate — no constant is held back for it.

### 3.4 Sign convention on reverse — Waveshare parity, flagged as an owner call

Waveshare's `moveProcess` gives backward+left `L = −slow_speed, R = −max_speed`, whose
differential is **negative**: pressing `A` while reversing yaws **clockwise**, the way a
car does when you steer left in reverse. **Port that.**

```ts
// 1 forward, -1 reverse. Waveshare parity: steering inverts when reversing.
// Set to () => 1 for tank-style absolute yaw. Owner preference — see below.
const REVERSE_YAW_SENSE = (axial: number) => (axial < 0 ? -1 : 1);
```

**An earlier draft of this plan chose the opposite** (absolute yaw sign, `A` always
counter-clockwise) for consistency with `ugv_tools/keyboard_ctrl.py`'s `moveBindings`
(`"."` = `(-1, 1)` — reverse with **positive** turn). A later draft then dismissed that
argument by claiming `ugv_tools` is not built on the robot. **That claim was false — see
the sourcing trap in §7.** `ugv_tools` **is** built: with the workspace overlay sourced,
`ros2 pkg executables ugv_tools` lists `behavior_ctrl`, `joy_ctrl`, `keyboard_ctrl`, and
`ros2 pkg prefix ugv_tools` resolves to
`/home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/ugv_tools` (verified
2026-08-14).

So the conflict is **real and active, not hypothetical**: two teleop surfaces exist on
this robot and they disagree about what `A` means while reversing. `keyboard_ctrl` is not
*running* right now (no such node in `ros2 node list`, and mux rung 100 has no live
publisher), but it is an on-demand SSH tool the owner can start at any time.

Waveshare parity is still the default here — it is the behaviour the owner actually drove
and liked, and that outranks internal consistency with a tool that is currently unused.
But this is now a **decision to resolve, not a caveat to note**: §9.3 asks the owner which
sense he wants, and **whichever he picks, both surfaces should end up matching it.**
Changing `keyboard_ctrl`'s `moveBindings` is out of scope for this PR — record the answer
in an `append_insight` (§9.4) and hand it to whoever owns `ugv_tools`. The constant above
is a one-line flip.

### 3.5 Throttle: presets and SHIFT boost

- `1` / `2` / `3` → `applyDriveInput(d => { d.rateIndex = 0|1|2 })`. Changing the preset
  **mid-drive recomputes and republishes immediately** — no key release needed. This is
  Waveshare's `speedCtrl` behaviour.
- `Shift` keydown → `d.boost = true`; `Shift` keyup → `d.boost = false`. Also cleared by
  `releaseAll`. Waveshare's `moveProcess` does this (`if (move_buttons.shift == 1)
  speed_rate = max_rate; else speedCtrl(defaultSpeed);`) — the preset is **restored**, not
  overwritten. Releasing `SHIFT` must land back on the selected preset, never on full and
  never on zero.
- The republish interval publishes `composeTwist(driveInputRef.current)` each tick, so
  boost and preset changes take effect on the next tick even if the immediate publish
  were somehow missed.
- The existing `INPUT`/`TEXTAREA` focus guard must also cover `isContentEditable`, or the
  number keys will change the throttle while the operator types in a chat box.

### 3.6 UI (per `docs/rich-ui.md` — enrich, never flatten)

Replace the single line `Cap: {LINEAR_STEP.toFixed(2)} m/s · {DRIVE_PUBLISH_HZ} Hz held`
(line 447) with:

1. **Throttle selector** — three real buttons (pointer operators have no keyboard),
   labelled `SLOW` / `CRUISE` / `FAST`, each showing its straight-line speed
   (`0.39` / `0.86` / `1.30 m/s`). Active segment glows emerald. Keyboard hint `1 2 3`.
2. **Live commanded readout** — monospace, from `driveView.twist`:
   `X +0.39 m/s · Z +0.00 rad/s`, `0.00` when idle. This is the honest surface: it shows
   what left the browser, not what the robot achieved.
3. **`BOOST` chip** (amber) rendered while `driveView.input.boost` is true.
4. **D-pad arrows light individually when held.** A `W+A` diagonal visibly lights two
   arrows — the cheap, visible proof that composition works. One `clsx` branch per button.
5. **Ceiling line**, replacing the old "Cap:" copy:
   `Ceiling {LINEAR_MAX} m/s · {ANGULAR_MAX} rad/s · {DRIVE_PUBLISH_HZ} Hz held`.
   The word is *ceiling*, not *cap* — it is what FAST reaches, not a limiter.
6. Keep the existing `COMMANDING` pulse; extend the keyboard hint to
   `WASD · 1/2/3 · SHIFT · Spc`.

**Do not change the button `title` attributes** (`Forward (W)`, `Left (A)`, `Right (D)`,
`Reverse (S)`, `Stop (Space) — releases intent`). The existing tests select by title;
keeping them stable keeps §8's churn to the assertions that genuinely changed.

## 4. Checked multi-zero stop tail

**This is the one mechanism in this plan that Waveshare did not have, and it is not
over-reach.** BEAST-01 lost its `cmd_vel` watchdog on 2026-08-07, the ESP32 latches its
last command, and the in-tree `keyboard_ctrl.py` already sends five zeros for exactly
this reason. This is matching existing in-repo precedent to replace a deleted safety net,
not inventing a new control behaviour. It changes nothing about how driving *feels*: it
only fires when the operator has already asked to stop.

Delete `clearDriveIntent` and its docstring (lines 94–114) — the docstring's argument
("WHY ONE AND NOT A STREAM OF ZEROS") is **superseded**. Replace with:

```ts
const runStopTail = useCallback((reason: string) => {
  clearRepublishInterval();
  clearPendingTailTimer();
  driveIntentRef.current = null;
  setDriving(false);

  let sent = 0;
  const tick = () => {
    if (!publishTwist(0, 0)) { onStopTailFailed(reason, sent); return; }
    sent += 1;
    if (sent >= STOP_TAIL_COUNT) { tailTimerRef.current = null; setStopUnconfirmed(null); return; }
    tailTimerRef.current = setTimeout(tick, STOP_TAIL_INTERVAL_MS);
  };
  tick();   // first zero fires SYNCHRONOUSLY — a keyup still stops in the same tick
}, [publishTwist, onStopTailFailed]);
```

Five zeros over 100 ms, then silence — the same shape as `keyboard_ctrl.py`'s tail, well
inside the mux's 0.5 s `ui` timeout so the rung still expires promptly and hands the floor
back down the ladder. Redundant frames, not a stream: an idle-but-publishing source at
priority 50 would mask `nav` (10) forever.

**Releasing the last key is a stop, not a ramp-down.** The first zero goes out
synchronously and at full magnitude. Do not soften this.

**HARD REQUIREMENT — zero commands bypass any future limiter.** No rate limiter is being
added by this plan (§2, §6). If one is ever added, `runStopTail` must keep calling
`publishTwist(0, 0)` with **literal zeros**, never through the limiter, and must reset the
limiter's state to zero so the next keydown starts from a standstill. A stop that ramps is
not a stop: on a robot whose ESP32 latches and has no watchdog, that converts Space from
an e-stop into a decel curve. Whoever adds a limiter owns the test named in §8.

**When `publish()` returns `false`** (`onStopTailFailed`) — the socket is not `OPEN`, so
retrying in the same tick is pointless:

1. **Abort the remaining tail.** Further sends would fail identically.
2. **Raise a sticky, non-dismissible fault.** New state
   `stopUnconfirmed: { at: number; sent: number; reason: string } | null` — separate from
   the existing `fault` string, which any later successful publish clears. Render a
   full-width red banner **above** the D-pad, `role="alert"`:

   > **STOP NOT CONFIRMED** — {sent} of {STOP_TAIL_COUNT} zero commands left the browser.
   > The robot may still be driving: the ESP32 latches its last command and there is no
   > robot-side cmd_vel watchdog. **[DISARM MOTION]**

3. **The banner carries a DISARM button** that calls
   `rosClient.callService('/ugv/set_allow_motion', { data: false })` — the enforced
   robot-side gate, which survives a node restart. Sending the operator to hunt for the
   safety strip while the robot may be moving is not acceptable UI.
4. **Arm a pending stop.** `pendingStopRef.current = true`. An effect watching
   `connection` re-fires `runStopTail('reconnect — stop was never confirmed')` the moment
   the state returns to `'connected'`.
5. **Clear only on a confirmed full tail** — all `STOP_TAIL_COUNT` publishes returned
   `true`. No dismiss affordance; an operator must not be able to click away an
   unconfirmed stop.

`setDriveIntent`'s existing failure path (lines 121–134) routes into `runStopTail` too, so
a drive publish that fails produces the same banner rather than a silent single zero over
an already-dead socket.

## 5. What does not change

`ROS_PUBLICATIONS` (`/cmd_vel_ui`, `geometry_msgs/msg/Twist`), `rosClient.publish`, the
`driveGateReason` ladder, the mux rung display, the LED and gimbal sections,
`DRIVE_PUBLISH_HZ = 10`, and the comment at lines 21–27 (still accurate — the mux still
expires a source after 0.5 s). No ROS, launch, service, or firmware file is touched.

## 6. Explicitly OPTIONAL follow-ons — NOT part of the parity work

Do not build these in the parity PR. They are listed so a later agent does not re-derive
them, and so a reviewer does not mistake their absence for an oversight.

- **Browser-side slew / acceleration limiter.** Would cap how fast `linear.x` and
  `angular.z` may change (e.g. `0.8 m/s²`, `3.2 rad/s²`, integrated on the publish tick).
  **An earlier draft of this plan had this in the parity work and gated the ceiling
  increase behind it. That was wrong on two counts and has been reversed.** First,
  **Waveshare had no rate limiting and it felt responsive** — the reference we are
  porting is the evidence, and a limiter is precisely the kind of "theoretically better"
  addition the premise of this work order rules out. Second, its justification was
  odometry quality: step-commanding 0 → full breaks static friction, the tracks slip, and
  the ESP32 encoders (`odl`/`odr`, `base_node.py:350–355`) over-count, injecting error
  into the odometry the EKF and SLAM consume. **That is a mapping concern, not a piloting
  one.** A limiter adds input lag, and input lag is the exact complaint being fixed here —
  **it may well make piloting feel worse.** If it is ever revisited, evaluate the SLAM
  benefit and the piloting cost as two separate questions, measure both, and honour the
  zero-bypass hard requirement in §4. **Do not gate any ceiling change behind it.**
- **Reverse-speed cap** (`REVERSE_SCALE = 0.5` when `axial < 0`). The operator's camera
  faces forward, so reversing is blind. Waveshare's reverse is symmetric, so this is a
  deliberate divergence, not parity — its own PR, its own justification.
- **Yaw-rate scaling against linear speed**, so fast straights do not become snap spins.
  Must land **after** the track-width calibration; tuning a falloff on top of a
  mis-scaled yaw command bakes the error into a second constant.
- **Analog stick / gamepad on the UI rung.** The reference clone has it
  (`readGamepad`, `control.js:1116`). Out of scope; the robot already has two
  higher-priority joy rungs (150 / 100). Neither has a *running* publisher today, but
  `ugv_tools` **is** built (§3.4), so `joy_ctrl` and `keyboard_ctrl` can both be started
  on demand — assume they may be live when reasoning about arbitration.

## 7. Robot-side velocity smoother — evaluated, not adopted

Recorded so this is not re-proposed as if it were new. **Facts, all verified live
2026-08-14 — an earlier draft of this section got the first one backwards:**

1. **`nav2_velocity_smoother` does NOT run.** It is *configured* and *launched from
   source* — `ugv_nav/launch/nav_bringup/navigation_launch.py:209` (and `:289`) and
   `ugv_cockpit/launch/behavior_server.launch.py:124` — with the chain documented at
   `navigation_launch.py:60–73`:
   `controller_server →(cmd_vel→cmd_vel_nav_raw)→ velocity_smoother →(cmd_vel_smoothed)→
   collision_monitor →(cmd_vel_nav)→ twist_mux`. **But none of that is running.**
   `ros2 node list --spin-time 4` shows no `velocity_smoother`, no `collision_monitor`,
   and **no nav2 node at all**; the only trace is the `/cmd_vel_nav` topic, which exists
   because `twist_mux` subscribes to it. An earlier draft asserted "it runs" by reading
   launch files instead of the robot. **Launch files describe intent; `ros2 node list`
   describes reality.** So there is no acceleration limiting anywhere in the live system
   — not on teleop, not on autonomy.
2. **Its numbers are untouched vendor boilerplate, so they are not evidence of any local
   intent about this chassis.** `git log --oneline -- .../ugv_nav/params/dwa.yaml` returns
   **exactly one commit** — the subtree import `1e8a167`. This repo has never modified
   that file. A blob diff against vendor `037dfca` confirms the **only** deltas are two
   `collision_monitor` lines (`use_sim_time: True→False`,
   `cmd_vel_out_topic: "cmd_vel"→"cmd_vel_nav"`). `max_accel: [0.4, 0.0, 1.0]`,
   `max_decel`, `max_vel_x: 0.26`, the commented-out `# acc_lim_x: 2.5` and the
   turtlebot3_simulations comment (`dwa.yaml:174–175`), and the whole `velocity_smoother`
   block are all present verbatim at baseline. **Nobody here chose `0.4 m/s²`**, and
   `0.26 m/s` is nav2's stock TurtleBot3 example value, not a Beast measurement. Do not
   cite any of it as a considered decision about this robot.
3. **Defect, vendor-inherited:** `decel_lim_theta` is declared **twice** in `dwa.yaml`
   (`-1.0` at line 183, `-3.2` at line 185). YAML last-wins, so `-3.2` silently applies.
   Present at `037dfca` too. **The autonomy on-ramp agent owns the nav params — not this
   plan.** Flagged only.

**Sourcing trap — read this before reporting anything as "missing" on BEAST-01.**
`ros2 pkg …` and most `ros2` introspection resolve against whatever overlay your shell
sourced. With only `/opt/ros/humble/setup.bash`,
`ros2 pkg executables ugv_tools` prints *"Package 'ugv_tools' not found"* — a statement
about your shell, not about the robot. The live workspace is
**`/home/beast/beast/RobotOverview/robot/beast/ros2_ws/install`**; `~/ugv_ws` and
`~/beast/ugv_ws` **do not exist**. Sourcing a non-existent overlay under `2>/dev/null`
fails silently and leaves you with bare humble — which is exactly how the false
"`ugv_tools` is not built" claim in §3.4 was produced.

> **Cross-check:** if `ros2 pkg` or `ros2 param` says something is missing, run
> `ros2 node list` first — it needs no overlay. **If nodes list but packages don't, your
> overlay did not source and the result is meaningless.** (`ros2 pkg` does also exit
> non-zero here, so the exit code is a second signal — but the message is what people
> read, and the message reads like a fact about the robot.)

**The proposal** would be a *second* smoother instance **downstream** of the mux, on
`/cmd_vel` between `twist_mux` and `beast_base`. **Honest advantage:** one node would
protect every command source — the browser UI, the BT pad at rung 150, `keyboard_ctrl` at
100, and nav — instead of the browser protecting only itself. A browser-side limiter is
trivially bypassed by any other publisher; an upstream node is not.

**Blocking objection:** it would sit below the mux and would therefore ramp the zero-tail
stop as well. The entire safety topology on this robot rests on "an explicit `T:13` zero
is the only halt" (ESP32 latches, no watchdog). A smoother with `max_decel: -0.4` turns a
100 ms stop at `1.3` m/s into a multi-second decel ramp, and `velocity_timeout: 1.0` means
it keeps emitting its own ramp for up to a second after the source goes silent — it would
*manufacture* commands nobody sent. That is a change to the stop path, not an addition to
it. **Evaluate it with the nav/autonomy work, with a deliberate zero-bypass design. Do
not design it here and do not build it in this PR.**

## 8. Test impact

Existing file: `src/__tests__/command-rail.test.tsx` (6 tests). Every one is named below.

**Mock change (affects the whole file):** the `@/lib/ros/client` mock at lines 12–31
exposes only `rosClient.publish`. Add `callService: vi.fn(async () => ({ ok: true }))` —
the STOP-NOT-CONFIRMED banner's DISARM button calls it, and an undefined function will
throw on render-with-banner.

**Must change:**

1. `"publishes held intent at 10 Hz and exactly one zero on release"` — rename to
   `"publishes held intent at 10 Hz and a checked 5-zero tail on release"`.
   `expect(zeroes).toHaveLength(1)` becomes `toHaveLength(STOP_TAIL_COUNT)` after
   advancing fake timers past `STOP_TAIL_COUNT × STOP_TAIL_INTERVAL_MS`; the total-count
   assertions shift accordingly. `linear.x` is now
   `LINEAR_MAX × RATE_PRESETS[RATE_DEFAULT_INDEX]` = `0.39`, not `0.2` — **assert against
   the imported constants, never a literal.**
2. `"stops a held pointer intent when the pointer leaves"` — the final publish is still
   zero, but there are now five of them and they arrive on timers. Advance past the tail
   before asserting; assert the tail length as well as the last value.
   `getByTitle("Forward (W)")` still resolves (§3.6 pins the titles).

**Unchanged — verify they still pass, do not edit:**

3. `"does not gate drive controls while charging — no automatic interlock …"`
4. `"fails closed when motion state is unknown"`
5. `"gates drive controls when motion is disarmed"`
6. `"does not gate drive controls on Ethernet connection — no automatic interlock …"`

**Also verify, expect no change:** `src/__tests__/ros-client.test.ts:225` asserts
`/cmd_vel_ui` → `geometry_msgs/msg/Twist`. This plan does not touch `ROS_PUBLICATIONS`.

**New file: `src/__tests__/drive-law.test.ts`** — pure unit tests on `composeTwist`:

- The full 16-combination truth table of `{forward, backward, left, right}` at
  `RATE_PRESETS[0]`, asserting both `linearX` and `angularZ`.
- `W+A` yields **both** non-zero, at `LINEAR_MAX × rate × ARC_LINEAR_SCALE` and
  `ANGULAR_MAX × rate × ARC_ANGULAR_SCALE`.
- `W+S` and `A+D` cancel to exactly zero (the vendor-bug divergence, §3.2).
- `S+A` yields **negative** `angularZ` — Waveshare's reverse-inverts-steering parity
  (§3.4). Name the test after the convention so a future agent cannot silently flip it,
  and reference §3.4 in the test body since this is an owner preference.
- Each preset and `boost` scales both axes linearly; `boost` overrides the preset without
  mutating `rateIndex`.

**New tests in `command-rail.test.tsx`:**

- Releasing `A` while holding `W` publishes a **forward** Twist and **no zero at all**.
  (The headline regression this plan exists to fix — write it first.)
- Releasing `W` while holding `A` transitions to spin-in-place with no zero in between.
- Pressing `2` mid-drive raises the commanded magnitude on the very next publish without
  interrupting the stream.
- Holding `Shift` boosts to `RATE_BOOST`; releasing restores the **selected preset**, not
  full and not zero.
- `window.blur` while `Shift` and `W` are held clears both — a subsequent `W` commands at
  the preset rate.
- A duplicate `keydown` for an already-held key does not double-publish and does not reset
  the republish interval.
- The stop tail aborts and renders `STOP NOT CONFIRMED` when `publish` returns `false` on
  the second zero; the banner reports `1 of 5`.
- The sticky banner survives a later *successful* unrelated publish (LED slider) and
  clears only after a confirmed full tail.
- Number keys are ignored while an `<input>` has focus.
- The active throttle preset and the live `X … · Z …` readout render (a
  `docs/rich-ui.md` surface assertion — work that does not reach the screen is not
  finished).
- **`"the stop tail publishes literal zero, never a ramped value"`** — asserts the first
  frame after `Space` at FAST is exactly `0.0` on both axes. No limiter exists today, so
  this passes trivially; it is here as the tripwire for §4's hard requirement. **Do not
  delete it as redundant.**

## 9. Done when

### 9.1 At the desk — no robot required

- [ ] `npx vitest run src/__tests__/drive-law.test.ts src/__tests__/command-rail.test.tsx`
      green, including the full 16-row truth table.
- [ ] Full `npx vitest run` no worse than the pre-change baseline. Capture the baseline
      **first** — the `localStorage.clear is not a function` failures under Node 25 are
      environmental and pre-existing, not a regression from this work.
- [ ] `npx tsc --noEmit` and the repo lint pass.
- [ ] `grep -rn "LINEAR_STEP\|ANGULAR_STEP" src/` returns nothing.
- [ ] `grep -n "publishTwist(0, 0)" src/components/cockpit/CommandRail.tsx` returns
      exactly **one** call site, inside `runStopTail`'s `tick`.
- [ ] No `rosClient.publish(` call in `CommandRail.tsx` discards its return value.
- [ ] `ROS_PUBLICATIONS` unchanged; `src/__tests__/ros-client.test.ts` untouched and green.
- [ ] `docs/plans/README.md` "Live work orders" table has a row for this plan.

### 9.2 On the robot with motion DISARMED — no motion, most of the control law

This is the high-value review path: **`beast_base.cmd_vel_callback` rejects non-zero
commands and sends a stop while `allow_motion` is false, yet `/cmd_vel_ui` still carries
exactly what the browser sent.** The whole control law is readable without the robot
moving a millimetre.

```bash
ssh beast-01-ts
source /opt/ros/humble/setup.bash
source /home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash
ros2 param get /beast_base allow_motion          # must print False before you start
ros2 topic echo /cmd_vel_ui
```

- [ ] `W` alone → `linear.x` = `0.39`, `angular.z` = `0.0`.
- [ ] `W+A` → **both** non-zero, at the `ARC_*` ratios (`0.23` / `0.13`).
- [ ] Release `A`, keep `W` → `linear.x` rises to `0.39`, `angular.z` → `0.0`,
      **and no zero Twist appears between them.** This is the headline fix; see it on the
      wire before driving.
- [ ] `S+A` → negative `linear.x`, **negative** `angular.z` (Waveshare parity, §3.4).
- [ ] `2`, `3`, `SHIFT` scale the magnitudes exactly as the UI prints them; releasing
      `SHIFT` returns to the selected preset.
- [ ] Release everything → exactly **5** zero Twists ~20 ms apart, then silence.
- [ ] Kill `rosbridge_websocket` while a key is held → the `STOP NOT CONFIRMED` banner
      appears; restarting it re-fires the tail and clears the banner.

### 9.3 Owner feel gate — REQUIRED, supervised, motion ARMED

**The premise of this work order is subjective: the owner says the controls do not feel
great. Nothing in §9.1 or §9.2 can detect that.** This gate is not optional and not a
nicety — it is the acceptance criterion. One session, safe open space, owner at the
keyboard, robot armed. Each item is pass/fail as felt, not as measured:

- [ ] **Course correction without stopping.** Hold `W` and tap `A` twice. The robot yaws
      briefly and keeps going. **Fail if it stops, hitches, or stutters at any point.**
- [ ] **A real arc.** Hold `W+A` around a corner. One continuous curve.
      **Fail if it is stop-pivot-go.**
- [ ] **Exit the arc cleanly.** From `W+A`, release `A` while still holding `W`. The
      robot straightens and continues at full straight-line speed. **Fail on any pause.**
- [ ] **Throttle steps.** Driving at SLOW, press `2`, then `3`. Speed changes immediately
      and mid-drive. **Fail if it requires releasing a key, or if it hitches.**
- [ ] **BOOST in and out.** Hold `SHIFT` at SLOW: immediate jump to full. Release:
      immediate settle back to SLOW. **Fail if it settles to full, to zero, or lags.**
- [ ] **Stops when expected.** At FAST, release all keys. It stops where the owner
      expects. **Fail on coast, lurch, or drift.** Repeat with `Space`.
- [ ] **Immediate response.** The robot starts moving the instant a key goes down.
      **Fail on any perceptible lag** — this is the explicit check that no accidental
      rate limiting crept in (§6).
- [ ] **Reverse steering sense.** Hold `S+A`. Record whether the direction matches the
      owner's expectation. Either answer is acceptable; §3.4 is a one-line flip. Write
      down which one he wants.
- [ ] **Default speed.** SLOW (`0.39` m/s) is a usable everyday default — not too slow,
      not alarming. Record the answer; it is the number the owner complained about.

**If the owner drives it and it still does not feel right, this work order is NOT done —
regardless of test status.** The next step is then to **compare against the Waveshare
reference behaviour**, item by item, using the clone at `ugv_rpi/templates/control.js`.
**It is not to add features.** Every mechanism in §6 was withheld for this reason; do not
reach for them as a fix without first showing where this port diverges from the
reference.

### 9.4 Close-out

- [ ] `docs/beast-ops.md` Quick connect updated, dated, with anything learned
      (AGENTS.md rule).
- [ ] An `append_insight` landed for any durable finding — in particular the answers to
      the reverse-steering and default-speed questions, and any tuned value of
      `ANGULAR_MAX`, which §3.3 expects to change on the first drive.
- [ ] **Delete this plan.** Executed plans are not archived; git is the archive.
