# BEAST-01 input paths and the dead mux rungs — work order

Status: **Open, not started.** Written 2026-08-14 after a read-only live session on
`beast-01-ts`. Scope is the *input* side of the command spine: what can put a Twist on a
`twist_mux` rung, and why two of the four rungs have no publisher and no way to get one
today. The control law inside the UI rung is a **sibling plan** —
`docs/plans/2026-08-14-cockpit-teleop-control-law-rewrite.md` (WASD rewrite) — and §2 is
the seam between them. Do not implement across that line.

This is a **work order**: inputs, exact changes, what to emit, done-when. **Code is
truth** — if this document and the code disagree, the code is right and this document is
stale; update it, don't preserve it.

## 0. Read this before touching anything — the workspace path in prior notes is wrong

`~/ugv_ws` **does not exist on BEAST-01**. The deployed ROS 2 workspace is:

```
/home/beast/beast/RobotOverview/robot/beast/ros2_ws
```

(from `beast-ros-base.service`'s `ConditionPathExists` and `ExecStart`, verified live
2026-08-14). Every `ros2 pkg …` result derived from `source ~/ugv_ws/install/setup.bash`
is void — that sources nothing, leaves only `/opt/ros/humble` on the path, and makes every
workspace package report "not found". At least one prior finding in this review
("`ugv_tools` is NOT BUILT") is exactly that artifact. **`ugv_tools` is built.**

Correct preamble for any read-only check:

```bash
ssh beast-01-ts
source /opt/ros/humble/setup.bash
source /home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash
```

## 1. Live ground truth — 2026-08-14, read-only

Everything in this section came off the robot this session. Re-verify before building on
it; the robot drifts and this list ages.

**Spine, running.** `/twist_mux` is up; live `ros2 param dump /twist_mux` matches
`robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/config/twist_mux.yaml` exactly — rungs 150
`cmd_vel_joy_robot`, 100 `cmd_vel_joy_operator`, 50 `cmd_vel_ui`, 10 `cmd_vel_nav`, all
`timeout: 0.5`; lock `estop` on `cmd_vel_estop_lock`, priority 255, `timeout: 0.0`.
`/cmd_vel` has exactly 1 publisher (twist_mux) and 1 subscription (`beast_base`).

**All four rungs have zero publishers.** `ros2 topic info` on each of
`cmd_vel_joy_robot` / `cmd_vel_joy_operator` / `cmd_vel_ui` / `cmd_vel_nav` reports
`Publisher count: 0`, `Subscription count: 2` (twist_mux + `cockpit_status`). No browser
was attached during the probe; `cmd_vel_ui` gets a publisher when one is.

**`ugv_tools` is BUILT and installed** — `ros2 pkg prefix ugv_tools` →
`…/ros2_ws/install/ugv_tools`; `ros2 pkg executables ugv_tools` →
`behavior_ctrl`, `joy_ctrl`, `keyboard_ctrl`. It is **not parked** (no `COLCON_IGNORE` in
`src/ugv_main/ugv_tools`, locally or on the robot) and it is **already in both
allowlists** — `build_common.sh` `PACKAGES` and both `colcon build --packages-select`
batches in `build_first.sh`. **There is no allowlist bug to fix. Do not "fix" it.**
Parked packages are `vizanti` (5), `ugv_web_app`, `explore_lite`, `emcl2_ros2` — confirmed
by `COLCON_IGNORE` in the deployed `src/` too.

**Rung 100 is reachable TODAY.** `ugv_tools keyboard_ctrl` publishes on
`cmd_vel_joy_operator` (`keyboard_ctrl.py:150`) and needs nothing but an interactive TTY
(`main()` refuses a non-TTY stdin). `ros2 run ugv_tools keyboard_ctrl` over SSH is a live,
working, priority-100 drive path right now. It is not "structurally impossible" — it is
"nobody is running it". See the hazard in §5.

**Rung 150 is blocked by TWO things, not one.**

1. `joy` is not installed. `ros2 pkg prefix joy` → not found;
   `ros2 pkg list | grep -iE 'joy|teleop'` → nothing.
   `ugv_tools/launch/teleop_twist_joy.launch.py:29` names `package='joy',
   executable='joy_node'`. Available for install: `apt-cache policy` on arm64 shows
   `ros-humble-joy` **3.3.0-1jammy.20260725.194016** and
   `ros-humble-teleop-twist-joy` **2.4.8-1jammy.20260725.194451** as candidates from the
   already-configured `packages.ros.org/ros2/ubuntu jammy/main arm64` repo.
   `libSDL2-2.0.so.0` is already on the box.
2. **`pygame` is not installed** (`ModuleNotFoundError`), and
   `ugv_tools/ugv_tools/joy_ctrl.py:16` imports it at module scope and calls
   `get_joystick_names()` (which runs `pygame.init()` / `pygame.quit()`) from
   `JoyTeleop.__init__`. The package being *built* does not mean the node *starts* —
   `--symlink-install` never imports it. This blocker is invisible to `ros2 pkg
   executables` and would only surface as a launch crash.

**No pad hardware present.** `/dev/input` has `event0..event6` and **no `js*`** (the
earlier "event0..event3" observation is stale — the count grew). `/proc/bus/input/devices`
names them: `gpio-keys`, four HDMI/DP audio, `USB Camera: USB Camera`,
`Solid State System Co.,Ltd. USB PnP Audio Device`. None is a gamepad. Bluetooth `hci0` is
present and unblocked, `bluetooth.service` active, **`bluetoothctl devices` is empty** — no
pad has ever been paired.

**nav2 (rung 10) is installed, idle.** `ros2 pkg prefix nav2_bringup` / `nav2_controller`
→ `/opt/ros/humble`. No nav2 node in `ros2 node list`. Idle-but-possible, as expected.
Out of scope here.

**rosbridge live globs match the source exactly.**
`ros2 param get /rosbridge_websocket topics_pub_glob` →
`[/cmd_vel_ui, /ugv/led_ctrl, /pt_joint_position_controller/commands, /ugv/pt_steady_ctrl]`;
`services_glob` → `[/ugv/set_allow_motion]`. Same as
`ugv_cockpit/launch/rosbridge.launch.py`.

**`/cockpit/status` carries no per-rung evidence.** The `twist_mux` DiagnosticStatus emits
exactly three KeyValues — `active_source`, `command_age`, `publisher_count` — and
`publisher_count` counts publishers on **`/cmd_vel`** (the mux *output*), not on any rung
(`cockpit_status.py:256`, `_mux_status`). Live sample: `active_source: NONE`,
`command_age: -1`, `publisher_count: 1`. The UI therefore has no evidence at all about
rung availability. This is the root of the honesty defect in §6.

**Two facts that contradict other docs, both worth landing:**

- `beast_base` **is running** (`/beast_base` in `ros2 node list`, `beast_base` in
  `install/`). `docs/plans/2026-08-07-beast-ros-drift-inventory-and-stripdown.md` still
  says the Phase 1 `beast_base` extraction is open. The service still *launches* through
  `ugv_bringup bringup_lidar.launch.py`, which is consistent with that plan's design, but
  the extraction itself has landed and deployed. Reconcile that plan, don't re-do it here.
- The deployed checkout is branch **`main` @ `98a11a1`**. `docs/beast-ops.md` Quick connect
  claims `feat/cockpit-map-render` @ `edae18d` (2026-08-14 05:58Z). **The first PR out of
  this plan must correct that Quick connect line, dated** (AGENTS.md rule). Untracked on
  the robot: `deploy/bin/beast-wifi-telemetry`, `deploy/systemd/beast-wifi-telemetry.{service,timer}`
  — a unit is running from files that are not in git.

## 2. The seam with the WASD control-law rewrite — read before writing any browser code

`docs/plans/2026-08-14-cockpit-teleop-control-law-rewrite.md` owns the control law and the
publisher. This plan owns **one more input feeding it**. The split is not negotiable,
because two independent tickers both publishing `/cmd_vel_ui` at 10 Hz with different
intents is a robot that jitters between two commands and an operator who cannot tell which
one is winning.

**That plan owns:** the intent→Twist mapping, the publish ticker and its rate, the
release/stop semantics (the single zero Twist), the caps, and the `driveGateReason` gate.

**This plan owns:** a `useGamepad()` hook that produces normalized samples and **nothing
else**. It must not call `rosClient.publish`, must not own a timer that publishes, and
must not read `status.allowMotion`.

**The interface between them.** A shared module — `src/lib/teleop/intent.ts` — exporting:

```ts
export type IntentSource = 'wasd' | 'gamepad';
export type DriveIntentSample = {
  linearX: number;      // m/s, already capped
  angularZ: number;     // rad/s, already capped
  at: number;           // performance.now() of the sample
  source: IntentSource;
  neutral: boolean;     // true when both components are exactly 0
};
```

**If the WASD plan has already landed an equivalent type, adopt theirs verbatim and delete
this paragraph. Do not create a second intent type.** Check before writing.

**Local arbitration (this plan defines it, the WASD plan's ticker consumes it).** The
browser needs its own tiny arbiter *above* the publisher, because both sources sit on the
same mux rung and twist_mux cannot separate them:

- Never sum, average, or max the two sources. Exactly one source holds the floor.
- The floor goes to the source whose most recent **non-neutral** sample is newest.
- A source that goes neutral relinquishes the floor *after* its neutral sample has been
  handed to the ticker once (so the stop actually reaches the wire), then stops competing.
- No hold-off, no hysteresis timer. Both sources are the same human; "most recent real
  input wins" is what that human expects, and a hysteresis window would eat the first
  keystroke after they put the pad down.

Emit this as `src/lib/teleop/arbitrate.ts` with a pure function
`pickIntent(samples: DriveIntentSample[]): DriveIntentSample | null` and a unit test. Pure
and pushable to the WASD plan's ticker without either side importing the other's React.

## 3. Work item A — browser Gamepad API onto `/cmd_vel_ui`

**Inputs to read first:** `src/components/cockpit/CommandRail.tsx` (the existing
`setDriveIntent` / `clearDriveIntent` / `holdProps` pattern and the release listeners at
lines ~186–203), `src/lib/ros/client.ts` (`ROS_PUBLICATIONS`, `publish()` returns a
boolean the caller must honour), and the two pieces of prior art below.

**Prior art — study, then leave behind.**

- `robot/beast/ros2_ws/src/ugv_else/vizanti/vizanti_server/public/templates/teleop/teleop_script.js`
  lines **1209–1351**: `gamepadconnected` / `gamepaddisconnected` handlers, a
  `requestAnimationFrame(gamepadCtrl)` loop, an `invert_angular` option, nipplejs virtual
  stick, and an acceleration ramp at ~336–353 that doubles the ramp rate when the target
  is zero (i.e. decelerate faster than you accelerate — worth copying as a *concept*).
  **Vizanti is parked (`COLCON_IGNORE`) and slated for deletion in strip-down Phase 2.**
  Read it now; do not import from it, do not link to it from shipped code.
- The Waveshare RPi web app's `templates/control.js` lines **1093–1147**: the same event
  pair, a 0.02 deadzone, and `readGamepad()` publishing **only when the value changed**.
  That change-detection is **wrong for this spine** — twist_mux expires a source after
  0.5 s of silence, so a stick held at full deflection would emit one message and then let
  the rung expire while the stick is still pinned. Same trap `teleop_twist_joy.launch.py`
  documents at length for `autorepeat_rate`. Stream at a fixed rate; never publish on
  change.

**Exact changes.**

Create `src/lib/teleop/gamepad.ts` (pure, no React) and `src/lib/teleop/useGamepad.ts`
(the hook). Constants live in the pure module so tests can reach them.

1. **Read in `requestAnimationFrame`, publish on the WASD plan's fixed-rate ticker.**
   `navigator.getGamepads()` returns a *snapshot* — it must be re-called every frame; the
   objects are not live. rAF is the right *reader* because it is frame-synced and because
   the browser pauses it on a hidden tab, which is the behaviour we want for reading.
   It is **not a stop**: a paused rAF just stops producing samples, and the mux + the
   latching ESP32 turn "no samples" into "keep driving". The publish side must stay on the
   existing interval so a paused reader is seen as *neutral*, not as *absent*.
   Concretely: if no gamepad sample has arrived for `GAMEPAD_SAMPLE_STALE_MS = 150`, the
   hook emits a synthetic neutral sample and drops the floor.
2. **Standard mapping only.** Accept a pad only when `gp.mapping === 'standard'`. A
   non-standard pad renders as "connected — unmapped, not driving" and contributes no
   intent. This is why we do not need `joy_ctrl.py`'s per-model tables
   (`SHANWAN_Android_Gamepad` / `Xbox_360_Controller`, lines 37–79): the browser already
   normalizes. Guessing indices on an unknown pad is how you get full reverse from a
   trigger.
3. **Radial deadzone, not per-axis.** Per-axis deadzone leaves a square dead region and
   makes diagonals jump. Given raw `(x, y)`: `m = Math.hypot(x, y)`;
   `if (m < DEADZONE) → (0, 0)`; else `s = (m - DEADZONE) / (1 - DEADZONE)` and output
   `(x / m * s, y / m * s)`. `DEADZONE = 0.12`. (Vizanti's 0.02 is too tight for a worn
   stick; `joy_ctrl`'s per-axis 0.2 is coarse and square.)
4. **Expo after the deadzone rescale, before the cap.**
   `expo(v) = Math.sign(v) * (EXPO * Math.abs(v) ** 3 + (1 - EXPO) * Math.abs(v))`,
   `EXPO = 0.6`. Monotonic, fixed points at 0 and ±1, so the cap still means the cap.
5. **Axes.** Left stick: `axes[1]` → forward/back (**negate** — up is −1 in the standard
   mapping), `axes[0]` → yaw. Yaw sign must match the existing UI: in `CommandRail.tsx`,
   left is `+ANGULAR_STEP` and right is `−ANGULAR_STEP`, so `angularZ = −expo(axes[0]) *
   ANGULAR_CAP`. Ship an `invertAngular` toggle (vizanti has one for a reason) persisted
   in `localStorage` under `beast.teleop.invertAngular`, defaulting **false**.
6. **Caps are shared with WASD, in one constant.** The gamepad must not exceed the WASD
   cap — an analog stick must never become a stealth speed increase. Import the caps from
   the WASD plan's module; if it has not landed yet, mirror today's values
   (`LINEAR_STEP = 0.2` m/s, `ANGULAR_STEP = 0.4` rad/s) and leave a `TODO` naming the
   sibling plan. **Do not define a second pair of caps.**
7. **Deadman, ON by default.** Intent is produced only while `buttons[5]` (RB) is held. A
   pad face-down on a desk with a drifting stick is a runaway, and there is no cmd_vel
   watchdog and no firmware timeout — the ESP32 latches (strip-down §2 fact 1). Expose it
   as a UI toggle `beast.teleop.deadman`; turning it off must show a persistent warning
   chip in the teleop panel, not a silent preference.
8. **Trigger-as-throttle: feature-detected, off by default, latched.**
   Browsers disagree about triggers — some expose them as `buttons[6] / buttons[7]` with
   an analog `.value`, some as axes, and **some pads report a resting trigger as −1
   rather than 0**. So: use the throttle only when `typeof gp.buttons?.[6]?.value ===
   'number' && typeof gp.buttons?.[7]?.value === 'number'`; never index a fixed axis.
   Compute `throttle = clamp(buttons[7].value - buttons[6].value, -1, 1)` (RT forward,
   LT reverse) and apply it as a *multiplier* on the stick's forward component when the
   stick is neutral, so it cannot fight the stick. **Latch requirement:** ignore the
   trigger entirely until it has read within `±0.05` of zero at least once since connect.
   Without that latch, a pad reporting −1 at rest commands full reverse the instant it is
   plugged in. This is the concrete bug the latch exists to prevent — keep the comment.
9. **Connect / disconnect.** Bind `gamepadconnected` and `gamepaddisconnected`, **and**
   re-scan `navigator.getGamepads()` every frame — Chrome does not expose pads (or fire
   the event) until the page has seen a user gesture, so events alone silently produce
   "my pad does nothing until I click". On disconnect, or on an index that vanishes from
   the snapshot, emit **one neutral sample and drop the floor** — do not merely stop
   reading, or the last non-zero intent stays latched in the ESP32.
10. **Reuse the existing release paths.** `blur`, `visibilitychange → hidden`, and
    `pointercancel` already release in `CommandRail.tsx`. The gamepad hook must route its
    release through the same shared arbiter, not add a parallel set of listeners.
11. **Rung is 50, and stays 50.** A browser pad is a UI surface. It publishes
    `/cmd_vel_ui`. It does **not** get rung 100 — see §7 for why that would be a real
    safety regression.

**What to emit.**

- `src/lib/teleop/gamepad.ts`, `src/lib/teleop/useGamepad.ts`,
  `src/lib/teleop/arbitrate.ts` (+ `intent.ts` if the WASD plan has not landed it).
- `CommandRail.tsx`: mount the hook, feed the arbiter, and render a pad status line —
  connected/absent, the pad's `gp.id`, mapping standard/unmapped, deadman held/released.
  Silence is not a status.
- Tests: `src/__tests__/teleop-gamepad.test.ts` — deadzone is radial (a diagonal at
  `m = DEADZONE - ε` is zero; at `m = DEADZONE + ε` is near-zero and continuous), expo is
  monotonic with `expo(1) === 1`, the trigger latch suppresses a `-1`-at-rest pad, a
  vanished index yields exactly one neutral sample, and a non-standard mapping yields no
  intent. `src/__tests__/teleop-arbitrate.test.ts` — never sums; newest non-neutral wins;
  a neutral sample is delivered once then stops competing.

**Done when:** a standard pad drives the robot on rung 50 with the deadman held; releasing
the deadman, unplugging the pad, hiding the tab, or blurring the window each produce
exactly one zero Twist and then silence; WASD and the pad never publish in the same tick;
`CommandRail` shows the pad's identity and deadman state; caps are provably the same
constant as WASD's; all tests green.

## 4. Work item B — restore rung 150 (robot-side pad)

This is the only item that creates motion authority independent of the browser. It is last
in the sequence (§7) and it is its own PR.

**What must be installed on the robot** (owner runs; all need sudo — this plan's agent
must not install anything):

```bash
sudo apt update
sudo apt install ros-humble-joy          # 3.3.0-1jammy, arm64, candidate verified 2026-08-14
```

`ros-humble-teleop-twist-joy` (2.4.8) is **not** required — `teleop_twist_joy.launch.py`
uses `joy_node` plus `ugv_tools`' own `joy_ctrl`, not upstream's `teleop_node`. Do not
install it just because the launch file is named after it.

**The pygame blocker — patch, don't install.** `joy_ctrl.py` needs `pygame` only to read
the connected joystick's *name* so it can pick between two hard-coded index tables. That
is dead weight on a robot we want reproducible, and worse: `get_joystick_names()` runs
`pygame.init()` / `pygame.joystick.init()` inside `JoyTeleop.__init__`, grabbing an SDL
handle in the same process-family as `joy_node`'s own SDL. Preferred fix, in
`robot/beast/ros2_ws/src/ugv_main/ugv_tools/ugv_tools/joy_ctrl.py`:

- Wrap the `import pygame` in `try/except ImportError` and set a module flag.
- When pygame is unavailable, skip `get_joystick_names()` and use `Xbox_360_Controller`
  (already the `get_joystick_mapping` fallback for unknown names, line 108).
- Log once, at INFO, which mapping was chosen and why.
- Add a `joystick_profile` ROS parameter (`'auto' | 'xbox' | 'shanwan'`) so the operator
  can force a mapping without pygame. Default `'auto'`.

Fallback if the patch is rejected: `sudo apt install python3-pygame`. Record which route
was taken — a later agent must not be able to guess.

**Hardware requirements for the pad.** It must present as a Linux joystick
(`/dev/input/js*`); `ros-humble-joy` reads `js*` via SDL2, which is already on the box.

- **Recommended first bring-up: a wired USB pad, or a 2.4 GHz pad with its own dongle.**
  It enumerates instantly and removes Bluetooth pairing from the failure surface. Nothing
  is paired today (`bluetoothctl devices` empty), so a BT pad means a pairing session
  before it means a driving session.
- If BT: `hci0` is present and unblocked. An 8BitDo (hardware XInput/DInput switch) is the
  least surprising; an Xbox Wireless Controller over BT may want `xpadneo`, which is an
  out-of-tree DKMS module on a Jetson — extra risk, note it before choosing.
- `/dev/input/event*` is `root:input 0660`, and **`beast-ros-base.service`'s
  `SupplementaryGroups=dialout video render i2c audio` does not include `input`.** The joy
  unit needs it.

**Deploy path — a separate unit, not folded into the drive spine.** Create
`robot/beast/ros2_ws/deploy/systemd/beast-teleop-joy.service`, modelled on
`beast-ros-base.service`:

- `User=beast`, `Group=beast`, `SupplementaryGroups=input dialout` — **`input` is the new
  one**.
- `EnvironmentFile=/etc/beast/ugv.env`, `Environment=XDG_RUNTIME_DIR=/run/user/1000`.
- `ExecStart=/bin/bash -lc 'source /opt/ros/humble/setup.bash && source
  /home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash && exec ros2
  launch ugv_tools teleop_twist_joy.launch.py'`.
- `ConditionPathExistsGlob=/dev/input/js*` so it does not restart-thrash with no pad
  attached.
- `Restart=on-failure`, `RestartSec=5`, `KillSignal=SIGINT`.
- **`WantedBy` — do NOT `systemctl enable` it in the same change that installs it.**
  Boot-enabling the highest-priority drive rung is a separate, deliberate decision after
  the bench pass in §7.

**Build scripts: no change.** `ugv_tools` is already in `build_common.sh` `PACKAGES` and
both `build_first.sh` batches, and is already built on the robot. State this in the PR so
the next reader does not re-investigate.

**Rung 100 — nothing to build, but a real defect to FIX.** `ros2 run ugv_tools
keyboard_ctrl` from an SSH TTY is a working priority-100 drive path today, and it has a
live path to "robot keeps driving with nobody controlling it". It outranks the browser,
`keyboard_ctrl.py` is in-tree, and we own it. This is a code fix, not a doc note.

**The defect, precisely** (`robot/beast/ros2_ws/src/ugv_main/ugv_tools/ugv_tools/keyboard_ctrl.py`):

1. Drive keys **latch** — the node's own help text (line 39) says "Drive keys latch until
   Space/k stops. No auto-stop on key release." A latched non-zero Twist streams at
   `LOOP_PERIOD` (20 ms) for as long as the loop runs.
2. **`SIGHUP` is not handled.** `main()` installs handlers for `SIGINT` and `SIGTERM` only
   (lines 203–204). A dropped SSH link makes sshd send **SIGHUP** to the session leader;
   Python's default disposition terminates the process immediately — no `finally`, no
   `atexit`, no zero Twist. The last latched velocity is the last thing on the wire.
3. Even on the handled signals, the `finally` block publishes **exactly one** zero Twist
   (line 330) and then immediately calls `destroy_node()` / `rclpy.shutdown()`. rclpy has
   no flush; destroying a publisher can discard an unsent sample. One publish followed by
   an immediate teardown is not a reliable stop, and it contradicts this same file's own
   `ZERO_TAIL_LIMIT` doctrine (lines 79–95), which exists precisely because a single zero
   is not trusted.

On a spine with **no cmd_vel watchdog** (removed 2026-08-07) and a **latching ESP32**
(strip-down §2 fact 1), the result is a robot that keeps driving.

**The fix.**

- Add `signal.SIGHUP` to the handled set alongside `SIGINT` / `SIGTERM`, reusing the
  existing `_exit_signal_handler`. Guard it with `getattr(signal, 'SIGHUP', None)` so the
  module still imports on a platform without it.
- **Keep the handler trivial.** It must only restore the TTY and `raise SystemExit(128 +
  signum)` — as it already does. Do **not** publish from inside a signal handler: rclpy is
  not async-signal-safe, and a publish there can deadlock against the very shutdown it is
  trying to beat. The handler's job is to make the existing `except (KeyboardInterrupt,
  SystemExit)` / `finally` path run; the `finally` does the stopping.
- **Replace the single zero publish in `finally` with the bounded zero-tail burst** the
  file already specifies: publish `Twist()` `ZERO_TAIL_LIMIT` (5) times with `LOOP_PERIOD`
  (20 ms) sleeps between — 100 ms of zeros, the same tail the normal stop path emits.
  Wrap it in `try/except` (it already is) so a dead context cannot turn a stop into a
  traceback.
- **Ordering is load-bearing.** The burst must run **before** `destroy_node()` and
  `rclpy.shutdown()`, inside `finally` — not as an `atexit` hook. `atexit` handlers run
  after the interpreter has begun tearing down and can fire after `rclpy.shutdown()`, at
  which point the publish is a no-op that logs nothing. The existing
  `atexit.register(term.restore)` (line 197) stays where it is; it touches only the TTY.
- **Detect stdin EOF.** `drain_keys()` (lines 169–178) does `if c: buf.append(c)`; on a
  closed pty `sys.stdin.read(1)` returns `''`, `select` keeps reporting the fd readable,
  and the loop spins forever **still publishing the latched command**. Treat an empty read
  on a readable fd as loss of control: break out of the loop and fall into the same
  `finally` stop path. This covers the case where the pty closes without a signal reaching
  us.

**Verification — no motion required, and none should be risked.**

1. DISARM motion first: `ros2 service call /ugv/set_allow_motion std_srvs/srv/SetBool
   "{data: false}"`. Confirm `/ugv/allow_motion` reads `false`. `beast_base` now gates the
   serial write, so nothing below can move the robot.
2. Second SSH session: `ros2 topic echo /cmd_vel_joy_operator`.
3. First SSH session: `ros2 run ugv_tools keyboard_ctrl`, press `i` to latch a forward
   drive. Confirm the echo shows a non-zero Twist streaming.
4. **Kill the link, not the process**: close the SSH client abruptly (or from a third
   session, `kill -HUP <pid>` — SIGHUP is what sshd actually sends).
5. **Pass condition:** the echo shows the 5-message zero tail arriving after the kill, then
   silence. Before the fix, it shows the non-zero Twist simply stopping mid-stream.
6. Repeat for `kill -TERM` and Ctrl-C to confirm the burst replaced the single publish on
   the already-handled signals.
7. RE-ARM when done.

**What this does NOT cover — state it in the PR, do not let it be assumed away.**

- **`SIGKILL`** and a host power-loss cannot be intercepted by any in-process handler. The
  last latched Twist stays latched in the ESP32.
- **A silent network partition** where the process survives with a live pty. sshd only
  sends SIGHUP once `ClientAliveInterval`/TCP keepalive expires, which can be minutes; the
  loop keeps streaming the latched command the whole time.
- **Therefore: do not run `keyboard_ctrl` inside `tmux` or `screen`** while driving. A
  detached multiplexer keeps the pty alive, so the SSH drop delivers no SIGHUP and no EOF
  — the session survives the operator and keeps driving. That is strictly worse than being
  killed. (An earlier draft of this plan recommended tmux; it was wrong.)
- The residual exposure is exactly the hole the removed cmd_vel watchdog used to cover.
  Closing it properly needs a robot-side liveness timeout, which is out of scope here —
  note it as the standing argument for one, and see §7 step 7 of the bench pass, where the
  same question decides whether rung 150 may be boot-enabled.

**Also write it down.** After the fix lands, add the drive command and the residual
hazard to `docs/beast-ops.md` Quick connect, dated — including the "no tmux while
driving" rule, which is now an operating instruction and not a nice-to-have.

**Done when (rung 100):** `keyboard_ctrl` handles SIGHUP; the `finally` path emits the
`ZERO_TAIL_LIMIT` burst before `destroy_node()`; a readable-but-empty stdin breaks the
loop into that same path; the DISARMED verification above shows the zero tail arriving on
`/cmd_vel_joy_operator` after an abrupt SSH kill; the uncovered cases and the "no tmux
while driving" rule are in the PR body and in `docs/beast-ops.md` Quick connect, dated.

**Done when (rung 150):** `ros2 pkg prefix joy` resolves on the robot; `joy_ctrl` starts with no
pygame present (or the install route is recorded); a pad enumerates as `/dev/input/js0`;
`beast-teleop-joy.service` starts, `/joy` publishes, and `cmd_vel_joy_robot` shows
`Publisher count: 1`; the supervised bench pass in §7 is signed off; the unit is
**not** boot-enabled unless that decision was made explicitly and recorded;
`docs/beast-ops.md` Quick connect updated and dated.

## 5. Work item C — the UI honesty fix, driven by evidence

`CommandRail.tsx`'s `rungState()` (lines 281–292) knows exactly one thing: whether
`status.muxSource` equals this rung's display string. Everything that is not ACTIVE
becomes **IDLE**, which reads as "available, just not driving". For rung 150 that is false
— there is no `joy_node`, no pygame, and no pad. The cockpit ships a `HonestyRail`; it
should not be lying two panels over.

**Do not hard-code a list of unavailable rungs.** That list would be right for about a
week and would then be a second source of truth about the robot, living in the browser.
Make the robot say it.

**Robot side.** `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/ugv_cockpit/cockpit_status.py`,
`_mux_status()` (line 249):

- Add one KeyValue, `rung_publishers`, whose value is a compact CSV of
  `<key>=<count>` over `MUX_SOURCES` in ladder order, e.g.
  `joy_robot=0,joy_operator=0,ui=1,nav=0`. Counts come from
  `self.count_publishers(topic)` — a plain rclpy `Node` method. `cockpit_status` already
  subscribes to all four rungs (lines 178–183), so this adds **no new subscriptions**, and
  it is a subscriber not a publisher, so it cannot inflate its own counts.
- One key rather than four keeps the DiagnosticArray small and keeps the parse in one
  place. Use the same `key` tokens as `MUX_SOURCES` (`joy_robot`, `joy_operator`, `ui`,
  `nav`) — the client already relies on that tuple's display strings, so reusing its keys
  keeps one vocabulary.
- Add the key name to `cockpit_contract.py` next to `KEY_ACTIVE_SOURCE` (line 43) as
  `KEY_RUNG_PUBLISHERS = 'rung_publishers'`, and a pure
  `format_rung_publishers(counts) -> str` / `parse_rung_publishers(s) -> dict` pair beside
  the existing `resolve_active_source` so both sides can be unit-tested without ROS.
- **Do not add a new topic.** Riding inside `/cockpit/status` means `topics_sub_glob`
  needs no change — see §6.

**Client side.** `src/lib/ros/client.ts`, the `/cockpit/status` `twist_mux` branch
(lines 1135–1141):

- Parse `rung_publishers` into `rungPublishers: Record<string, number> | null` on
  `StatusData`. **Absent key ⇒ `null`, never `{}` and never zeros.** An older robot build
  that does not emit the key must render UNKNOWN, not UNAVAILABLE. The file already
  applies exactly this discipline to `active_source` ("No fallback to 'NONE': absent means
  unknown") — follow it.

**`CommandRail.tsx`.** Replace `rungState(source)` with `rungState(key, display)` over
four states:

| State | Condition | Meaning |
|---|---|---|
| `UNKNOWN` | `status.muxSource === null` **or** `rungPublishers === null` | no evidence |
| `ACTIVE` | `status.muxSource === display` | winning arbitration |
| `IDLE` | `rungPublishers[key] > 0` | a live publisher exists, not winning |
| `UNAVAILABLE` | `rungPublishers[key] === 0` | nothing can drive this rung |

Render UNAVAILABLE in a distinctly dimmer/struck treatment than IDLE — the whole point is
that an operator can tell them apart at a glance. Put the evidence in the `title`:
`"0 publishers on cmd_vel_joy_robot"`.

**Fix the rung labels in the same change.** Once a browser gamepad ships on rung 50, the
current labels actively mislead:

- 150 `BT Pad · Robot` → **`Robot-side pad (joy_ctrl)`**
- 100 `Operator Pad` → **`Operator pad / keyboard (robot-side)`** — the name is the single
  worst offender: an operator with a pad in their hands will read it as *their* pad.
- 50 `UI Teleop (WASD)` → **`UI teleop — WASD + browser pad`**
- 10 `nav2` — unchanged

The `source` strings that match `status.muxSource` are **wire contract** and come from
`cockpit_contract.py:84–89` (`SOURCE_JOY_ROBOT` carries a U+00B7 MIDDLE DOT and is
compared with `===`). Change the **display label** only; leave the `source` values alone
unless you change both sides in the same commit and move
`ugv_cockpit/test/test_twist_mux_spine.py` with them.

Add a footnote under the ladder when any rung is UNAVAILABLE, naming the reason from
evidence — e.g. `150 UNAVAILABLE — no publisher on cmd_vel_joy_robot`. Grep
`src/components/cockpit/HonestyRail.tsx` for a duplicate or contradicting claim about the
ladder and reconcile it in the same PR.

**What to emit.** Robot: `cockpit_status.py`, `cockpit_contract.py`, and a pytest for
`format_rung_publishers` / `parse_rung_publishers` round-tripping (including the
malformed-string case, which must yield `{}` and never raise). Web: `client.ts`,
`CommandRail.tsx`, and `src/__tests__/command-rail.test.tsx` fixtures for **all four**
states — with an explicit test that a status message *missing* `rung_publishers` renders
UNKNOWN and not IDLE.

**Interim, if the robot-side change cannot ship in the first PR:** a static
`available: false` on 150/100 is acceptable **only** if it carries the observation date and
the reason string in the tooltip, and only as a stepping stone in the same plan. The
hard-coded list is the thing being removed; do not let it become the answer.

**Done when:** with the current robot state the ladder renders 150 UNAVAILABLE, 100
UNAVAILABLE, 50 ACTIVE-or-IDLE depending on the browser, 10 UNAVAILABLE; starting
`keyboard_ctrl` over SSH flips 100 to IDLE within one status period with no UI reload; a
robot build without the new key renders every rung UNKNOWN; tests green both sides.

## 6. Work item D — the rosbridge publish whitelist: verdict, no change

Read `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/launch/rosbridge.launch.py`. Live
params confirm the file (§1).

**Verdict: the browser gamepad needs no whitelist change.** It publishes `/cmd_vel_ui`,
which is already the first entry in `TOPICS_PUB_GLOB`. The honesty evidence rides inside
`/cockpit/status`, already in `TOPICS_SUB_GLOB`. Nothing in §3 or §5 touches the boundary.

**Changes to explicitly NOT make, and why** — record these in the PR so the next agent
does not "discover" them as gaps:

- **`cmd_vel_joy_operator` (rung 100).** Would let a browser outrank the on-site pad from
  anywhere on the tailnet. Rung 100 means "a process on the robot's own graph"; the
  browser is a UI surface and belongs on 50. This is the single change most likely to be
  proposed and it is a real safety regression.
- **`/cmd_vel`.** The mux output. Publishing it bypasses arbitration entirely. The
  docstring already explains that this glob is the only thing stopping it.
- **`/cmd_vel_estop_lock`.** Tempting for a gamepad panic button, and wrong. twist_mux
  subscribes to lock topics VOLATILE with `timeout: 0.0`: a one-shot publish can lose the
  discovery race, and the lock does not survive a mux restart. The cockpit's stop is the
  **`/ugv/set_allow_motion` service** — already whitelisted, gates the serial write inside
  `beast_base`, and survives restarts. A gamepad panic button must call that service.
  (If one is added: it is a *service call*, so it needs no glob change either.)

**One real defect to fix, one word.** The module docstring (line ~21) says
`topics_pub_glob` is "a closed list of the **five** topics the shipped cockpit
advertises". It is **four** — `TOPICS_PUB_GLOB` has four entries, `ROS_PUBLICATIONS` in
`src/lib/ros/client.ts` has four, and the constant's own comment two dozen lines down
correctly says "the four topics". A whitelist's documentation has to be exact. Fix it.

**Out of scope, already owned elsewhere:** `config/twist_mux.yaml` lines ~30–35 and ~72–74
still describe the removed 0.5 s `cmd_vel_timeout` watchdog as if it existed. That is
defect **M6** on the strip-down plan's Phase 1 sweep list
(`2026-08-07-beast-ros-drift-inventory-and-stripdown.md` §5). Do not fix it here; do not
write new comments that depend on it.

## 7. Sequencing, gates, and what this does to motion authority

**Gate 0 — re-verify.** Re-run §1's checks with the correct workspace path before starting.
Anything in §1 that no longer holds invalidates the item that depends on it.

**Order.**

1. **C + D** — UI honesty and the docstring fix. **Changes nothing that can move the
   robot.** Ship first: it makes every later step legible, and it removes the misleading
   "Operator Pad" label *before* a browser pad exists to be confused with it. Also lands
   the `docs/beast-ops.md` Quick connect correction from §1 (deployed branch is `main` @
   `98a11a1`, not `feat/cockpit-map-render` @ `edae18d`), dated.
2. **B, rung 100 half** — **fix** the `keyboard_ctrl` SIGHUP / single-zero defect (§4),
   then document it. Small, in-tree, needs no hardware and no pad; the verification runs
   with motion DISARMED, so it can land alongside (1) without a supervised session. That
   the hazard is not *new* is a reason not to panic about it — it is not a reason to leave
   it. Do not let this slip behind the hardware work in (4).
3. **A** — browser gamepad. Blocked on the WASD control-law rewrite landing, because it
   consumes that plan's ticker and caps. Do not start it against a moving target.
4. **B, rung 150 half** — `joy` on the robot. Own PR, own supervised bench session, last.

**Motion authority, stated plainly.**

- **C and D widen nothing.** No new publisher, no new topic, no glob change.
- **A widens the UI rung from discrete to continuous.** It does not raise the cap, does
  not add a rung, does not change the `allow_motion` gate, and does not change what the
  bridge admits. The genuinely new failure mode is a *drifting or abandoned stick* on a
  spine with no cmd_vel watchdog and a latching ESP32. That is what the deadman default,
  the radial deadzone, the trigger latch, and the disconnect→neutral rule are for. If a
  reviewer wants the deadman off by default, that is a deliberate widening and should be
  argued in the PR, not defaulted into.
- **B/rung-100 narrows authority — it is the one item here that takes risk away.** It adds
  no new drive path; it makes an existing one stop when its operator disappears. Today a
  dropped SSH link mid-latched-drive leaves the robot driving at rung 100, outranking the
  browser. After the fix, SIGHUP and stdin-EOF both produce the zero tail. SIGKILL, host
  power-loss, and a silent partition holding a live pty remain uncovered (§4) — that
  residue is the standing argument for a robot-side liveness timeout.
- **B/rung-150 is the real widening.** It adds a publisher on the robot itself, at the
  highest drive rung, that can override the browser and keeps working when the browser is
  closed, the tailnet is down, or the operator has walked away from the laptop. It is
  still under `/ugv/set_allow_motion` — that gate lives in `beast_base` at the serial
  write, so a disarm still stops it — but it is the only item here that creates motion
  authority independent of the cockpit. Consequences: do not boot-enable
  `beast-teleop-joy.service` in the same change that installs it; run the bench pass
  first; record the enable decision explicitly if it is ever made.

**Supervised bench pass for rung 150** (owner present, robot on blocks or in clear space,
hand on the power switch — this plan's agent must not run it):

1. Pad enumerates: `ls /dev/input/js*`, `ros2 topic hz /joy` with the stick moving.
2. `cmd_vel_joy_robot` shows `Publisher count: 1`; the cockpit ladder flips 150 to IDLE.
3. Stick forward → robot drives; ladder shows 150 ACTIVE.
4. **Priority proof:** drive from the browser (rung 50), then take the stick — the pad
   wins mid-command.
5. **Zero-tail proof:** centre the stick; the robot stops, and within ~0.5 s the ladder
   drops 150 out of ACTIVE and a browser command gets through again (this is
   `ZERO_TAIL_LIMIT = 5` doing its job — see `joy_ctrl.py:82–99`).
6. **Gate proof:** with the stick held forward, DISARM from the cockpit — the robot stops
   and stays stopped.
7. **Disconnect proof:** with the stick held forward, unplug/power off the pad — note
   exactly what happens. There is no watchdog; if the robot keeps driving, that is the
   expected-and-unacceptable result and `joy_ctrl` needs a `/joy` liveness timeout before
   this rung is enabled at boot. **This is the step that decides whether rung 150 is
   allowed to be a boot service.**
8. Update `docs/beast-ops.md` Quick connect, dated, with what was learned.

**Out of scope here:** the WASD control law (sibling plan), rung 10 / nav2 bring-up,
deleting vizanti (strip-down Phase 2), the `twist_mux.yaml` stale-watchdog comments
(strip-down Phase 1), and the untracked `beast-wifi-telemetry` files on the robot (flag
them; they belong to whoever wrote them).

## 8. Rollback

- **C / D** — revert the PR; the robot side degrades to "no `rung_publishers` key", which
  the client is required to render as UNKNOWN. No robot restart needed beyond
  `beast-cockpit.service`.
- **A** — revert the PR; WASD is untouched because the gamepad is a separate intent source
  behind a shared arbiter. If the arbiter itself is suspect, `pickIntent` is pure and unit-
  tested; bisect there.
- **B/100** — revertible, but **do not revert it casually**: reverting restores a path that
  keeps driving when its operator's link dies. If the signal handling causes trouble, fix
  forward. The `finally` zero-tail burst and the SIGHUP handler are independent hunks and
  can be bisected separately.
- **B/150** — `sudo systemctl stop --now beast-teleop-joy.service` removes the rung
  instantly; the mux simply expires it after 0.5 s and the floor falls to 50. Uninstalling
  `ros-humble-joy` is not required to make the robot safe. The `joy_ctrl.py` pygame patch
  is independently revertible and affects nothing while the unit is stopped.
