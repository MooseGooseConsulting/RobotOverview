# Verification surfaces for the 2026-08-14 BEAST plan set

Status: **Reference, live for as long as the 2026-08-14 plans are.** Written 2026-08-14
after reading all five plans, the already-implemented teleop work on
`claude/beast-teleop-control-law`, every workflow in `.github/workflows/`, and a read-only
live session on BEAST-01 (`ssh beast-01-ts`; no publish, no service action, no change to
motion authority — the robot was **ARMED** throughout and stayed that way).

This document answers one question per unit of work, in the same idiom for all five plans:
**how do we know this is correct, who can prove it, and what does it cost to check.** Each
plan states its own "done when" in its own voice; none of them says what tier of evidence
each item deserves, or which items CI will silently let you revert.

**It is not a plan.** It adds no work order and grants no approval. §1–§3 are shared
preamble. §4–§8 are one section per plan, each self-contained: **when a plan is executed
and deleted, delete its section here in the same PR.** When the last one goes, delete this
file.

---

## 1. The verification ladder

Cheapest first. Every unit below is assigned the **cheapest tier that actually proves it**,
plus any higher tier that is genuinely required. "Prove it at T3" when T2 would do is
wasted supervised time; "prove it at T1" when only the owner can judge it is a lie.

| Tier | What it is | Cost |
|---|---|---|
| **T0 static** | Typecheck, lint, `grep` assertion, `next build`, `systemd-analyze verify`. No behaviour exercised. | Seconds. Any agent. |
| **T1 unit/CI** | Automated test that runs without hardware. Each row says whether the test **EXISTS**, must be **ADDED**, or **CANNOT** exist — and names the file. | Minutes. CI. |
| **T2 disarmed wire** | Motion authority disarmed. `beast_base` rejects non-zero commands and sends a stop, **while the topic still carries the exact published output** — so behaviour is provable by `ros2 topic echo` with **zero motion**. See §3. | One owner disarm/re-arm. No supervision of the robot itself. |
| **T3 supervised bench** | Owner present, robot in clear space or on blocks, hand on the power switch. Reserved for what genuinely cannot be proven at T0–T2. | A scheduled session. |
| **T4 owner judgement** | Subjective acceptance only the owner can give. The teleop feel gate is the archetype. | A session, and it can fail a green PR. |
| **UNVERIFIABLE** | Stated plainly rather than dressed up as a check. "We cannot prove this until X" is the correct answer sometimes. | — |

**"Can regress silently"** in the last column of every table means: *if a future PR reverts
this, does CI go red?* A **No** is a defect in the verification surface, not in the plan.
Every **No** below is flagged and paired with the specific test that would fix it.

### What CI actually runs today

Read this before assuming a test has a home.

| Workflow | Triggers on | Actually runs |
|---|---|---|
| `web-tests.yml` | `src/**`, `db/**`, config files | `npm run lint`, `npm run typecheck`, `npm run test:run` (all of `src/__tests__/`) |
| `beast-ros-spine.yml` | `robot/beast/ros2_ws/**` | **only** `ugv_cockpit/test/**` and `beast_base/test/**` |
| `beast-power-tests.yml` | `beast_power/**` | `beast_power/test` host tier + an `rclpy`-over-DDS integration tier |
| `beast-storage-tests.yml` | `deploy/storage/**`, `deploy/systemd/**` | `deploy/storage/tests` (unittest) + `systemd-analyze verify deploy/systemd/beast-*` |
| `beast-ros-image.yml` | Dockerfile + 7 named packages | arm64 image build (its own `--packages-select` list) |
| `image.yml` | everything | web Docker image build |

Three consequences that shape every table below:

1. **Nothing runs on `docs/**` or `.claude/**`.** Every doc-drift and command-drift unit in
   Plans C, D and E is invisible to CI *by construction* — not because the assertions are
   hard, but because no workflow is watching those paths.
2. **`beast-ros-spine.yml` triggers on the whole ROS subtree but executes two packages'
   tests.** `ugv_tools/test/`, `ugv_bringup/test/`, `ugv_slam/test/`, `ugv_vision/test/`
   and the rest never run. A test written for `keyboard_ctrl` today would sit dead.
3. **`beast-ros-image.yml` builds from its own package list**, so it will not notice a
   `build_common.sh` / `build_first.sh` omission. See §9.

---

## 2. Trust boundary — read this before implementing any of these plans

**These five plans were written in one session, on 2026-08-14, by five agents that
cross-checked each other and caught real errors in each other's work.** The record of that
is visible in the plans themselves: the teleop plan retracts two of its own earlier drafts
(the `0.18 m/s` default, the rate limiter); the vendored-surface plan formally retracts the
"`ugv_tools` is not built" finding and names the exact shell mistake that produced it; the
roslib plan opens by correcting the premise its own commissioning task was written on. That
is genuine cross-checking and it caught things.

**It is not review against reality.** Nobody has read these against the code and the robot
after the fact. Two independent errors of the same kind already propagated *inside* this
session — a dead workspace path (§3) and a claim about a package's build status — and one
of them landed in a plan written the same day (`D21`).

Per this repo's own rule: **code is truth.** So:

- **Every executing agent must re-verify its plan's premises before implementing.** Not the
  whole plan — the specific facts its first commit depends on. Each plan's §1/§0
  "live ground truth" section is a hypothesis with a date on it, not a fact.
- **The verification surface below is what makes that cheap.** T0 and T2 rows are re-derivation
  recipes as much as they are acceptance checks. Run the T0 greps and the T2 echoes *first*,
  not last.
- **A premise that no longer holds invalidates the unit that depends on it, not the plan.**
  Say so in the PR and stop; do not fix the plan's prose and carry on.
- **A reviewer accepting one of these PRs is entitled to ask, per unit, which tier was run
  and by whom.** That is the entire point of this document.

Three facts underpin most of the safety reasoning across all five plans. Re-verify these
before trusting anything downstream of them:

| Fact | Re-derive with | Verified |
|---|---|---|
| The ESP32 latches its last velocity; there is **no** `cmd_vel` watchdog | `grep -rn "cmd_vel_timeout" robot/beast/ros2_ws/src/` → nothing; `ros2 param list \| grep cmd_vel_timeout` on the robot → nothing | 2026-08-07 live, re-confirmed 2026-08-14 |
| `beast_base` gates the serial write on `allow_motion` | `base_node.py:358-375` | code, this session |
| `beast_base` is absent from both build allowlists | `grep -n beast_base robot/beast/ros2_ws/build_common.sh robot/beast/ros2_ws/build_first.sh` → nothing | code, this session |

---

## 3. Two mechanics every executing agent needs

### 3.1 The T2 disarmed wire — the underused tier

This is the highest-value tier in the ladder and every plan under-uses it. The mechanism,
from `robot/beast/ros2_ws/src/ugv_main/beast_base/beast_base/base_node.py:358-375`:

```python
def cmd_vel_callback(self, msg):
    linear_velocity = msg.linear.x
    angular_velocity = msg.angular.z

    if not self.allow_motion:
        if linear_velocity != 0.0 or angular_velocity != 0.0:
            ...  # rate-limited warning
            self.send_stop_command()
        return

    data = json.dumps({'T': '13', 'X': linear_velocity, 'Z': angular_velocity}) + "\n"
    self.base_controller.send_command(data.encode())
```

With `allow_motion` false, a non-zero Twist reaching `beast_base` produces a `T:13 0,0` on
the serial line and **nothing else**. The `T:13 X,Z` frame is never sent. But every topic
upstream of it — `/cmd_vel_ui`, `/cmd_vel_joy_operator`, `/cmd_vel_joy_robot`,
`/cmd_vel_nav`, and the mux output `/cmd_vel` — still carries the **exact bytes the
publisher emitted**. `twist_mux` still arbitrates. `cockpit_status` still reports.

**So: the entire command path is observable, at full fidelity, with the robot physically
incapable of moving.**

```bash
ssh beast-01-ts
source /opt/ros/humble/setup.bash
source /home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash

ros2 param get /beast_base allow_motion      # must print False before you start
ros2 topic echo /cmd_vel_ui                  # or whichever rung you are proving
```

**Cost, stated honestly.** Disarming is a service call — `/ugv/set_allow_motion` — and it
changes motion authority, so **the owner runs it**, not the agent. It is the safe
direction (the true→false edge sends an explicit stop), and re-arming afterwards is the
step to not forget. That is the whole cost: two service calls and a second SSH session.

**Three limits, so nobody over-claims a T2 pass.**

1. T2 proves **what was published**, not what the robot would *do*. The `X`/`Z` →
   per-track conversion happens inside ESP32 firmware we do not own. Magnitudes still need
   T3 or T4.
2. While disarmed, `beast_base` sends a stop on *every* non-zero command it receives, so
   the serial line carries a stream of `T:13 0,0`. Harmless, and it is what you should see.
3. T2 says nothing about arbitration *outcomes under contention* unless you drive two rungs
   at once — which is exactly what makes it the right tier for the mux-priority claims in
   Plan C.

**Also T2, with nothing to disarm:** a read-only `ros2 topic echo` on a non-command topic
(`/scan`, `/cockpit/status`, `/ugv/allow_motion`) involves no motion authority at all and
costs one SSH session. Rows below tagged **T2 (read-only)** mean exactly that.

### 3.2 The sourcing trap — do not reproduce this

It has already produced two wrong findings inside this plan set. The ROS workspace on
BEAST-01 is:

```
/home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash
```

`~/ugv_ws`, `~/beast/ugv_ws` and `/home/ws/ugv_ws` **do not exist**. `~/.bashrc` on the
robot sources no ROS overlay, by design.

- **Never write `source … 2>/dev/null`.** `source` on a missing path fails *silently* and
  does not abort an `&&` chain the way a missing binary would. Suppressing stderr removes
  the last signal you had.
- `ros2 pkg executables <missing>` prints `Package '<x>' not found` **and exits 0**. It does
  not look like an error.
- `ros2 node list` and `ros2 topic list` need **no** overlay, so they keep working and make
  the broken probe look trustworthy. That is the shape of a real finding, which is why it
  fooled people.

> **Cross-check, mandatory:** if `ros2 pkg` or `ros2 param` reports something missing, run
> `ros2 node list` **first**. **If nodes list but packages do not, your overlay did not
> source and the result is meaningless.**

A stale *command* is worse than a stale *claim*: a stale claim misleads one reader; a stale
command manufactures fabricated evidence that the next three commits reason from. Rank
command drift above prose drift in every sweep.

---

## 4. Plan: cockpit teleop control law rewrite

`docs/plans/2026-08-14-cockpit-teleop-control-law-rewrite.md`

**Status note that changes the tiering:** this plan is **already implemented** on branch
`claude/beast-teleop-control-law` (`641d6fa`), with `src/lib/ros/drive-law.ts` (172 lines),
`src/__tests__/drive-law.test.ts` (15 tests across 4 describes) and
`src/__tests__/command-rail.test.tsx` (20 tests, up from 6).
It is mutation-tested and it is **the worked example of what "good"
looks like** for the other four plans: a pure module with no React, a truth table, and every
constant asserted against its imported name rather than a literal.

Verify that branch against `main` before re-implementing anything below.

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| A1 | `composeTwist` + the constants (`drive-law.ts`) | T0, **T1 EXISTS** | `npx vitest run src/__tests__/drive-law.test.ts`; `npm run typecheck` | CI | No |
| A2 | Held key-set + **per-key release recompute** (the headline fix) | **T1 EXISTS**, T2 | `command-rail.test.tsx` → *"releasing A while holding W keeps driving forward — NO zero at all"*; echo shows `linear.x` rise to 0.39 with **no zero Twist between** | CI; owner for T2 | No |
| A3 | Throttle presets + SHIFT boost | **T1 EXISTS** (2 tests), T2 | *"pressing 2 mid-drive…"*, *"SHIFT boosts to max_rate and releasing restores the SELECTED preset"*; echo magnitudes scale as printed | CI; owner for T2 | No |
| A4 | Waveshare-parity constant **values** | **T1 EXISTS** | *"carries Waveshare ugv_rpi/config.yaml args_config verbatim"* | CI | No |
| A4b | Whether those values are **right for this chassis** | **T4** | §9.3 default-speed and `ANGULAR_MAX` items | Owner | n/a — inherently |
| A5 | Reverse yaw sense (`REVERSE_YAW_SENSE`) | **T1 EXISTS**, **T4** for the choice | *"REVERSE INVERTS STEERING: S+A yields NEGATIVE angularZ"*; owner records which sense he wants (§9.3) | CI; owner | No (a silent flip fails the test) |
| A6 | Checked 5-zero stop tail | **T1 EXISTS**, T2 | tail-length tests; echo shows **exactly 5** zeros ~20 ms apart, then silence | CI; owner for T2 | No |
| A7 | `STOP NOT CONFIRMED` banner + DISARM button | **T1 EXISTS** (2 tests), T3 for a real socket kill | banner tests; T3 = kill `rosbridge_websocket` with a key held | CI; owner for T3 | No |
| A8 | Pending-stop **re-fire on reconnect** (`CommandRail.tsx:321`) | **T1 ADD**, T3 | no test asserts the reconnect effect re-runs `runStopTail` | — | **YES** → add to `command-rail.test.tsx` |
| A9 | UI surfaces: throttle selector, live readout, BOOST chip, per-arrow lighting, ceiling line | **T1 EXISTS** (3 tests) | *"renders the throttle selector, the live commanded readout and the ceiling"*, *"lights each D-pad arrow on its own held flag"* | CI | No |
| A10 | Focus guard incl. `isContentEditable` (`CommandRail.tsx:344`) | **T1 PARTIAL** | *"ignores the throttle number keys while an input has focus"* covers `INPUT` only; the `contentEditable` branch is unasserted | — | **YES** → extend the existing test |
| A11 | `releaseAll` on `visibilitychange:hidden`, `pointercancel`, gate-close | **T1 PARTIAL** | only `blur` is asserted (*"window blur clears BOTH the held keys and a stuck boost flag"*); the other three listeners at `CommandRail.tsx:396-414` and the gate effect at `:316` are unasserted | — | **YES** → three tests |
| A12 | §9.1 grep assertions (no `LINEAR_STEP`/`ANGULAR_STEP`; exactly one `publishTwist(0, 0)`; no discarded `publish` return) | **T0 only** | `grep -rn "LINEAR_STEP\|ANGULAR_STEP" src/` | agent, at the desk | **YES** — no CI runs these greps |
| A13 | Zero-bypass tripwire (literal zeros, never ramped) | **T1 EXISTS** | *"the stop tail publishes literal zero, never a ramped value"* — passes trivially today; it is the tripwire for §4's hard requirement. **Do not delete as redundant.** | CI | No |
| A14 | **Owner feel gate (§9.3)** — 9 pass/fail items, armed, supervised | **T4** | course correction without stopping; a real arc; clean arc exit; throttle steps; BOOST in/out; stops when expected; immediate response; reverse steering sense; default speed | **Owner only** | n/a — inherently. A green suite does **not** satisfy this. |
| A15 | Close-out: `docs/beast-ops.md` Quick connect dated, `append_insight`, delete plan | T0 / **UNVERIFIABLE** in CI | manual | agent + owner | **YES** |

**Silent-regression flags for this plan: A8, A10, A11, A12, A15.** All five are cheap. A8,
A10 and A11 are three tests in a file that already exists and already runs in CI —
`src/__tests__/command-rail.test.tsx`. A12 becomes a source-guard test in the same file, in
the shape `ros-client.test.ts:396` already uses (read the source as text and assert on it).

**Note on A14.** This is the only unit in the entire plan set whose failure mode is
"everything is green and the work is not done". The plan says so explicitly and it is right:
*if the owner drives it and it still does not feel right, this work order is not done,
regardless of test status.* The correct response is to diff against the Waveshare reference
item by item — **not** to add features from §6.

---

## 5. Plan: cockpit ROS client — roslib convergence

`docs/plans/2026-08-14-cockpit-ros-client-roslib-convergence.md`

**The premise is T2-verifiable in one command and should be re-run before starting:**

```bash
ros2 topic echo /scan --once --field ranges | tr , '\n' | grep -ic nan
```

Measured 149 on 2026-08-14. If that number is zero, rosbridge was upgraded or the LiDAR
crop changed, and the whole plan needs re-deriving.

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| B1 | Extract `src/lib/ros/frame.ts` (`repairNonFiniteTokens`, `parseRosbridgeFrame`) verbatim; `client.ts` imports | T0 (`git diff` shows deletions + one import, nothing else — a **review** assertion, not an automated one), **T1 ADD** | new `src/__tests__/frame.test.ts`: bare `NaN` repaired, `NaN` inside a quoted string untouched, escaped quote not a terminator | reviewer; CI once added | No, once added |
| B2 | Make the no-lookbehind scan cover **both** files | **T1 EDIT** | `src/__tests__/ros-client.test.ts:396` — *"uses no lookbehind assertions anywhere in the client"*. After the move it is **vacuous** unless edited | CI | **YES** — the test still passes while guarding nothing. Highest-risk item in this plan. |
| B3 | `nan-tolerant-transport.ts` + `Ros({ transportFactory })` at `ros-singleton.ts:315` | **T1 ADD**, T2 (read-only) for the premise | `ros-singleton.test.ts`: raw `/scan` frame with bare `NaN` through the transport → `scanAlive` true, state stays `'connected'` | CI | No, once added |
| B4 | `onError` no longer sets `state='error'` while the socket is connected | **T1 ADD** | `ros-singleton.test.ts`: an `'error'` event while `ros.isConnected` leaves `stop()` able to dispatch a cancel | CI | No, once added |
| B5 | `ros.connect()` rejection handled; `RosHandle.connect` retyped | T0 (typecheck), **T1 ADD** | **the plan names no test for this.** A bad URL becomes an unhandled rejection — fatal under Node's default | — | **YES** as written → add a rejecting-`connect` case |
| B6 | `sendGoal` result callback | **T1 ADD** | **the plan names no test for this.** roslib calls `resultCallback(values)` unconditionally on `STATUS_SUCCEEDED`; today a **successful** nav2 action throws | — | **YES** as written → add a `STATUS_SUCCEEDED` case |
| B7 | Guard comments at the top of `ros-singleton.ts` and `client.ts` | **T0** | grep | agent | **YES** (low stakes) |
| B8 | Source guard: no file under `src/lib/` or `src/components/` references `roslib`, static or dynamic | **T1 ADD** | a source-scan test — **this is the thing that keeps the verdict** | CI | No, once added |
| B9 | Extend the message-type contract test to `STATUS_TOPICS` in `ros-singleton.ts` | **T1 ADD** | `/ugv/allow_motion`, `/ugv/voltage`, `/scan` — a second, currently **unpinned** copy of the same DDS type strings | CI | No, once added |

**Silent-regression flags: B2, B5, B6, B7.** B2 is the dangerous one — it does not fail, it
stops guarding, and the thing it guards is an iOS-Safari compatibility trap that will not
show up in CI or on a desk.

**The structural gap this plan sits on.** `src/__tests__/ros-singleton.test.ts` injects a
mock `RosLibLike` and **never loads roslib**. Consequences worth stating in the PR:

- Every defect in §5 of the plan is invisible to CI *today*, which is why they shipped.
- The `roslib` dependency could be **deleted from `package.json` and no test would fail**,
  while the agent's `/scan` liveness, nav2 motion tools and `stop()` would break at runtime.
  B8 is the fix for that specific hole and it is worth more than its size suggests.

**Blast radius, for the reviewer.** This plan is a hard blocker on autonomy Phases 3–5 (see
§7). Its acceptance bar is therefore higher than its diff size implies: an agent-issued
`stop()` that silently refuses to cancel a Nav2 goal is the failure this fixes.

---

## 6. Plan: BEAST input paths + twist_mux rungs

`docs/plans/2026-08-14-beast-input-paths-and-mux-rungs.md`

Four work items with very different verification profiles. **Item B/rung-100 is the live
hazard and it is also the item with the worst CI story in the entire plan set.**

### 6.1 Work item A — browser gamepad on `/cmd_vel_ui`

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| C1 | `src/lib/teleop/gamepad.ts` — radial deadzone, expo, standard-mapping gate, trigger latch | T0, **T1 ADD** | `src/__tests__/teleop-gamepad.test.ts`: diagonal at `m = DEADZONE ± ε`; `expo(1) === 1` and monotonic; a `-1`-at-rest pad is suppressed by the latch; non-standard mapping yields no intent | CI | No, once added |
| C2 | `useGamepad.ts` — rAF read, `GAMEPAD_SAMPLE_STALE_MS` → synthetic neutral, connect/disconnect | **T1 ADD** | same file, fake rAF: a vanished index yields **exactly one** neutral sample | CI | No, once added |
| C3 | `arbitrate.ts` `pickIntent` | **T1 ADD** | `src/__tests__/teleop-arbitrate.test.ts`: never sums; newest non-neutral wins; a neutral sample is delivered once then stops competing | CI | No, once added |
| C4 | **Deadman ON by default** | **T1 ADD** | assert the default. A silent flip of this is a runaway on a spine with no watchdog and a latching ESP32 | CI | **YES** until added — highest-value single assertion in this item |
| C5 | Caps are the **same constant** as WASD's, not a copy | **T1 ADD** | import-identity assertion against `drive-law.ts` — not a numeric equality, which a copy would also satisfy | CI | **YES** until added |
| C6 | Pad status line in `CommandRail` (identity, mapping, deadman state) | **T1 ADD** render test; T3 with a real pad | `command-rail.test.tsx` | CI; owner for T3 | No, once added |
| C7 | A standard pad actually drives on rung 50; each release path yields exactly one zero | **T2**, then **T3** | T2: echo `/cmd_vel_ui` while disarmed — deadman release, unplug, tab hide, window blur each show one zero then silence. T3: the same armed | Owner | n/a (runtime) |

### 6.2 Work item B, rung 100 — `keyboard_ctrl` SIGHUP (the live hazard)

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| C8 | `SIGHUP` added to the handled set | **T1 CANNOT run today**, **T2** | a test in `ugv_tools/test/` **has no CI home** — `beast-ros-spine.yml` runs only `ugv_cockpit/test` and `beast_base/test`. T2 is the real proof (below) | owner for T2 | **YES** |
| C9 | `finally` emits the `ZERO_TAIL_LIMIT` burst **before** `destroy_node()` | **T1 CANNOT run today**, **T2** | same | owner for T2 | **YES** |
| C10 | Readable-but-empty stdin breaks the loop into the same `finally` | **T1 CANNOT run today**, **T2** | same | owner for T2 | **YES** |
| C11 | `joy_ctrl` pygame-optional import + `joystick_profile` param | **T1 CANNOT run today**, T3 | same; T3 = node starts with no pygame present | owner | **YES** |

**The T2 procedure for C8–C10 is the model for this whole document** — it proves a
signal-handling safety fix with zero motion risk:

1. Owner disarms: `/ugv/set_allow_motion` false; confirm `/ugv/allow_motion` reads `false`.
2. Second SSH session: `ros2 topic echo /cmd_vel_joy_operator`.
3. First session: `ros2 run ugv_tools keyboard_ctrl`, press `i` to latch a forward drive.
   Confirm a non-zero Twist streaming at 20 ms.
4. Kill the **link**, not the process: close the SSH client abruptly, or `kill -HUP <pid>`
   from a third session — SIGHUP is what sshd actually sends.
5. **Pass:** the echo shows the 5-message zero tail, then silence. **Before the fix:** the
   non-zero Twist simply stops mid-stream, and the ESP32 keeps executing it.
6. Repeat for `kill -TERM` and Ctrl-C.
7. Owner re-arms.

**These four units are the plan set's worst CI story: a live safety fix with no possible
automated regression guard until `beast-ros-spine.yml` is widened.** See §9, test T-2/T-3.

**What T2 does not cover, and must be said in the PR rather than assumed away:** `SIGKILL`,
host power loss, and a silent network partition holding a live pty. Hence the operating
rule the plan lands — **no `tmux`/`screen` while driving**, because a detached multiplexer
keeps the pty alive, so the SSH drop delivers neither SIGHUP nor EOF. That rule is
**UNVERIFIABLE** by any test; it is a doc entry and an operator habit.

### 6.3 Work item B, rung 150 — robot-side pad

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| C12 | `ros-humble-joy` installed on the robot | **T3 / UNVERIFIABLE by CI** | `ros2 pkg prefix joy` resolves (robot state, not repo state) | Owner (needs sudo) | n/a |
| C13 | `beast-teleop-joy.service` unit file | **T0** | `systemd-analyze verify deploy/systemd/beast-*.service` — the new file is picked up **automatically** by `beast-storage-tests.yml`'s existing glob and path filter | CI | Syntax only. **`SupplementaryGroups=input` and the absence of `WantedBy` are unasserted** |
| C14 | Pad enumerates as `/dev/input/js*`; `cmd_vel_joy_robot` shows `Publisher count: 1` | **T2 (read-only)** | `ls /dev/input/js*`; `ros2 topic hz /joy`; `ros2 topic info cmd_vel_joy_robot` | Owner | n/a |
| C15 | Bench pass steps 3–6: drives; priority proof over rung 50; zero-tail proof; gate proof | **T3 supervised** | plan §7, owner present, robot on blocks or clear space | Owner | n/a |
| C16 | **Bench step 7 — disconnect proof** | **T3, outcome currently UNKNOWN** | unplug the pad with the stick held forward. If the robot keeps driving, that is the expected-and-unacceptable result and `joy_ctrl` needs a `/joy` liveness timeout **before** this rung may be boot-enabled | Owner | n/a — **this is honestly unverifiable until run, and it is the step that decides a safety question** |
| C17 | The unit is **not** `systemctl enable`d in the same change | **T0** | `grep -L WantedBy deploy/systemd/beast-teleop-joy.service` | reviewer | **YES** → extend the existing `test_systemd_unit_is_installable_but_not_self_enabling` pattern |

### 6.4 Work items C and D — UI honesty and the whitelist verdict

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| C18 | `cockpit_status.py` emits `rung_publishers` KeyValue | **T1 ADD**, T2 (read-only) | pytest in `ugv_cockpit/test/` — **which does run in CI**; T2 = `ros2 topic echo /cockpit/status` | CI; owner for T2 | No, once added |
| C19 | `cockpit_contract.py` `format_rung_publishers` / `parse_rung_publishers` round-trip, incl. malformed ⇒ `{}` and never raises | **T1 ADD** | `ugv_cockpit/test/` — pure, no ROS | CI | No, once added |
| C20 | `client.ts` parses to `rungPublishers`; **absent key ⇒ `null`, never `{}`, never zeros** | **T1 ADD** | `ros-client.test.ts` | CI | **YES** until added — an older robot build must render UNKNOWN, not UNAVAILABLE, and getting this backwards is a lie on a safety surface |
| C21 | `CommandRail` four-state ladder + evidence in `title` | **T1 ADD** | `command-rail.test.tsx` fixtures for **all four** states + a status message *missing* the key ⇒ UNKNOWN | CI | No, once added |
| C22 | Rung **display labels** change; the `source` wire strings do **not** | **T1 EXISTS** | `ugv_cockpit/test/test_twist_mux_spine.py` + `test_cockpit_status_contract.py` — both in CI | CI | No |
| C23 | Docstring "five topics" → "four" | **T0** | grep | agent | **YES** → one cheap assertion in `test_cockpit_bridge.py` comparing the docstring count to `len(TOPICS_PUB_GLOB)` |
| C24 | **The three "do NOT whitelist" negatives** (`cmd_vel_joy_operator`, `/cmd_vel`, `/cmd_vel_estop_lock`) | **T1 EXISTS** | `test_cockpit_bridge.py` → `test_mux_ladder_topics_are_not_publishable`, `test_every_twist_mux_rung_is_covered_by_the_forbidden_list`, `test_publish_glob_is_exactly_the_client_contract`. **All three run in CI today.** | CI | **No — already guarded.** State this in the PR so nobody re-derives it. |

**Silent-regression flags for this plan: C4, C5, C8, C9, C10, C11, C13 (partial), C17, C20,
C23.** C8–C11 are the serious ones and they cannot be fixed by writing a test — they need
`beast-ros-spine.yml` widened first.

---

## 7. Plan: BEAST autonomy on-ramp

`docs/plans/2026-08-14-beast-autonomy-on-ramp.md`

Six phases. **Phases 3–5 are hard-blocked on Plan B (§5) landing** — every goal is a
`NavigateToPose` action and the cancel path can silently refuse. That block is itself a
verification claim, and it is re-checkable at T1 once B3/B4 land: `getStatus().scanAlive`
must be a real boolean rather than permanently `null`.

The plan is disproportionately T3, and correctly so — it is a switch-it-on plan, and most of
what it turns on is only observable on a moving robot. The rows below say where cheaper
tiers were available and are not being used.

### Phase 0 — map store (no motion)

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| D1 | `beast-slam.service` gains `After=`/`Wants=time-sync.target` | **T0**, **T3** for proof | `systemd-analyze verify` runs on this path today — but it checks **syntax**, not the presence of an ordering directive. T3 = `journalctl -u beast-slam.service -b` after a **cold** boot showing a real wall-clock start and no `karto::Exception` | CI (syntax); owner (cold boot) | **YES** — deleting the directive keeps CI green |
| D2 | `slam_toolbox_beast_fresh.yaml` + `BEAST_SLAM_PARAMS` selection | T0 (file exists), **T3** | owner restart, confirm which params loaded | owner | **YES** |
| D3 | Owner archives the current map stem | **T3 / UNVERIFIABLE by CI** | file copy on the robot | Owner | n/a |
| D4 | **F12: `beast_base` into both build allowlists** | **T1 ADD** | see §9 test **T-1**. **This is the same unit as Plan E's §3 (E1/E2) — one test covers both, and the two plans must not both add it.** Coordinate, or the second PR gets a merge conflict in a file that decides whether the robot has a boot stop | CI | **YES today — the type case** |

### Phase 1 — calibration (owner-supervised, motion)

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| D5 | Runs A–D: `bias_z`, `k_lin`, `s_gyro`, `b_eff`, closure | **T3 supervised**, then **UNVERIFIABLE** by CI | `ros2 bag record` + offline extraction. Motion commanded by the **owner on the joystick, never by a script** | Owner | n/a — the artifact is the bag + an `append_insight`, not a test |
| D6 | `wheel_base` becomes a ROS parameter with the measured default | **T1 ADD — but has no CI home** | `ugv_bringup/test/` is run by **no workflow**. Needs §9 test **T-2** first | — | **YES** |
| D7 | `/100` cm→m divisor and/or gyro LSB scale corrected at source | **T1 ADD** | `beast_base/test/` **does** run in CI — pin the constants there | CI | No, once added |
| D8 | `ekf.yaml` `vy` decision (`odom0_config[7]`) | **T0** yaml read | no CI home today; the reason must be written into the yaml | agent | **YES** |

**Gate worth restating:** Phase 2 does not start until Runs A and C pass, because **a gyro
whose bias or scale is wrong produces a map that looks fine.** `slam_toolbox` will
contentedly scan-match a slowly rotating world. There is no T0/T1/T2 check for that; it is
T3 or nothing.

### Phase 2 — first real map (owner-supervised, motion)

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| D9 | Frame plumbing before driving | **T2 (read-only)** | `ros2 topic hz /map`; `tf2_echo map odom` stays still at rest; `ros2 topic echo /map --once --field info`. **If `map→odom` jumps while parked, stop — that is Phase 1 leaking** | Owner | n/a |
| D10 | The drive pattern and map quality (single-thickness walls, closed loop, stable raster) | **T3 supervised**, **T4** for "is this a usable map" | visual + `/map info` across two publishes | Owner | n/a |
| D11 | Cell ceiling ≤ 250k, decided **before** the run | **T1 EXISTS (client half)**, **T1 ADD (save-script half)** | `ros-client.test.ts` → *"unsubscribes /map when the grid exceeds MAP_MAX_CELLS"*. `deploy/bin/beast-slam-save`'s refusal has **no test** and it fails **silently** — you would drive for an hour and save nothing | CI (half) | **YES** for the save-script half |
| D12 | Persistence via `ExecStop` (owner stops the service; never `kill` the node) | **T3** | `beast-slam-save` output + the archived `bak-` path | Owner | n/a |

### Phase 3 — Nav2 on the saved map (**blocked on §5**)

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| D13 | Nav2 bringup with `rpp.yaml`; full lifecycle activation | **T2 (read-only)**, T3 | `ros2 lifecycle get` on all eight + both lifecycle managers. **A half-activated stack accepts goals and never moves** | Owner | n/a |
| D14 | `/cmd_vel` has **exactly one** publisher; `/cmd_vel_nav` shows `collision_monitor` + `behavior_server` | **T2 (read-only)** | `ros2 topic info /cmd_vel -v` | Owner | n/a |
| D15 | Recovery-behaviour constraint: `backup` removed from the default BT, or distance 0.0 | **T1 ADD** | `ugv_cockpit/test/test_behavior_server_config.py` exists **and runs in CI** — this is the right home, and it is a pure XML/YAML parse. **Keep `Spin`** — an in-place rotation sweeps the LiDAR through the 104° rear blind wedge | CI | **YES** until added — and this one drives the robot backwards into unsensed space |
| D16 | Goals 1–5 escalating, abort path rehearsed at every step | **T3 supervised** | joystick first (rung 150 pre-empts in one message), then cockpit DISARM. **An agent-issued Nav2 cancel is not an abort path** while §5 stands | Owner | n/a |
| D17 | `beast-nav.service` exists and is **not** enabled | **T0**, T1 extendable | `systemd-analyze verify` picks it up via the existing glob; the not-self-enabling assertion has a precedent in `test_cockpit_bridge.py` | CI | **YES** for the enable half |

### Phase 4 — `/goal_pose` and click-to-nav (**blocked on §5 and Phase 3**)

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| D18 | `/goal_pose` added to `TOPICS_PUB_GLOB` **and** `ROS_PUBLICATIONS` | **T1 EXISTS** | `test_cockpit_bridge.py::test_publish_glob_is_exactly_the_client_contract` enforces the two lists in lockstep **in both directions, today**. Adding to one and not the other fails CI | CI | **No — already guarded.** Say so in the PR. |
| D19 | `/plan` added to `TOPICS_SUB_GLOB` **and** `ROS_SUBSCRIPTIONS` | **T1 EXISTS** | `test_subscribe_glob_is_exactly_the_client_contract` | CI | No |
| D20 | SpatialView inverse transform built as one `DOMMatrix`, used for both draw and pick | **T1 ADD** | round-trip test: a click at the canvas centre maps to the robot's own map-frame pose within one cell | CI | No, once added |
| D21 | Goal control **disabled** when `allow_motion` is false or `/map` is stale | **T1 ADD** | `command-rail.test.tsx` / SpatialView test | CI | **YES** until added |
| D22 | `header.frame_id: 'map'` and a stamp on every goal | **T1 ADD**, T2 (read-only) | a goal in the wrong frame is **not an error** — it is a goal somewhere else | CI | **YES** until added |
| D23 | Tape-measured accuracy at a known floor point | **T3 supervised** | owner present, tape measure | Owner | n/a |

### Phase 5 — un-park `explore_lite` (**blocked on §5 and Phases 2–4**)

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| D24 | Un-park: delete `COLCON_IGNORE`, add to **both** allowlists, update the `build_common.sh` header comment and `AGENTS.md` — all in one commit | **T1 — covered by test T-1** | the two-way allowlist test catches both directions: a package un-parked but not allowlisted, **and** a parked package left in an allowlist (colcon errors on a selected package it cannot discover) | CI | No, once T-1 exists |
| D25 | Costmap topic choice (`config/params.yaml` vs `params_costmap.yaml`) | **T0** | read the config; record the choice in the commit | agent | **YES** |
| D26 | One supervised single-room exploration, `progress_timeout: 30.0` | **T3 supervised** | SLAM + Nav2 both up, one room, owner's hand on the joystick. **Do not turn it loose in the house** | Owner | n/a |

**Silent-regression flags for this plan: D1, D2, D4, D6, D8, D11 (save-script half), D15,
D17 (enable half), D21, D22, D25.** D4 and D15 are the two that matter most: D4 is the boot
stop, D15 drives the robot into its own blind sector.

---

## 8. Plan: BEAST vendored surface + doc drift

`docs/plans/2026-08-14-beast-vendor-parked-surface-and-doc-drift.md`

**This plan contains the type case for the whole document.** `beast_base` — the package
that owns the ESP32 serial link, the `allow_motion` gate and the unconditional boot stop —
is absent from `build_common.sh`'s `PACKAGES` array and from both
`build_first.sh --packages-select` blocks. `git log -S"beast_base"` on those two files
returns nothing: the string has never existed in either. **Its sibling `beast_power`, split
out of `ugv_bringup` in the same 2026-08-07 strip-down, *is* in both** — so the omission is
provable, not a judgement call. A from-scratch `build_first.sh`
provision produces a workspace where `beast-ros-base.service` fails at
`bringup_lidar.launch.py:159` — so the boot stop is never sent, on a robot whose ESP32
latches its last velocity. **A missing name in a build allowlist is a missing boot stop, and
nothing in CI looked.**

| # | Unit of work | Tier(s) | Concrete check | Who runs it | Regress silently? |
|---|---|---|---|---|---|
| E1 | `beast_base` → `build_common.sh` `PACKAGES` and `build_first.sh`'s second block | **T0** now, **T1** after E2 | `grep -n beast_base robot/beast/ros2_ws/build_common.sh robot/beast/ros2_ws/build_first.sh` | CI once E2 lands | **YES today — the defect this plan exists to fix** |
| E2 | **The two-way allowlist regression test** | **T1 ADD** | see §9 test **T-1**. Green CI on this **gates everything after it** in the plan's own execution order | CI | — (it *is* the guard) |
| E3 | `WS=/home/ws/ugv_ws` → the real workspace, in both build scripts | **T0** | `grep -n '^WS=' build_common.sh build_first.sh` | agent | **YES** → fold into T-5 |
| E4 | Delete the `vizanti` tree — **after owner confirmation that D6 still stands** | **T0** grep gate, **owner decision** | `grep -rni "vizanti" robot/beast/ros2_ws/` returns nothing in the working tree. The owner-conflict is real: D6 recorded "delete"; `361dcc3` parked instead with an unsigned rationale | agent; **Owner approves** | n/a |
| E5 | Delete `ugv_web_app`; fix `ros2.sh:65-66`, `docs/installation.md:93` | **T0** grep gate | `grep -rni "ugv_web_app\|roarm_web_app"` | agent | n/a |
| E6 | Doc sweep: `web_app.md` deleted, mkdocs nav entry removed, ~25 links/markers cleared | **T0** grep; **no CI builds mkdocs** | `mkdocs build` locally | agent | **YES** |
| E7 | Negatives: `explore_lite`/`emcl2` stay parked; `cartographer` stays **built** | **T1** via T-1's reverse assertion | parking `cartographer` breaks `ros2 launch ugv_nav nav.launch.py` for **every** localization mode, `amcl` included | CI once T-1 lands | **YES** today |
| E8 | Robot-side prune of stale `install/`/`build/` trees for the four parked packages | **T2 (read-only)**, T3 restart | `ros2 pkg list \| grep -E 'vizanti\|ugv_web_app'` empty **after** the prune. Until then the docs' "fails with package not found" claim is true for a fresh build and **false for this robot** | Owner | **YES** — robot state, not repo state |
| E9 | **D1–D4: the four safety-relevant stale claims** (twist_mux.yaml, vision.md, teleoperation.md, teleop_twist_joy.launch.py) | **T0** grep gate | `grep -rni "cmd_vel_timeout\|watchdog_state\|_cmd_vel_watchdog" robot/beast/ros2_ws/src/` returns nothing | agent | **YES** → §9 test **T-5**. These four each tell a reader that something stops the robot when nothing does. |
| E10 | D5: `ugv_bringup/package.xml` watchdog comment + the `diagnostic_msgs` dep | **T0** | grep | agent | **YES** |
| E11 | D6/D7: the `/imu/data` false premise | **T1 EXISTS but currently pins the WRONG claim** | `test_cockpit_bridge.py:65,270` **and** — not named in the plan — `src/__tests__/ros-client.test.ts:270` *"never subscribes /imu/data — nothing publishes it on this robot"*. Live: `/imu/data` has **publisher count 2**. **Three instances, two test suites; the plan names one suite.** Fixing only the ROS side leaves the web suite defending the false claim in CI | CI | No (once all three are corrected) |
| E12 | D8–D16: repo docs, dated-history conversions, and the D16 plan deletions | **T0** grep; **owner confirmation** for `2026-07-31-beast-command-deck-spec.md` and `2026-08-01-beast-cockpit-future-roadmap.md` | grep for present-tense watchdog claims | agent; Owner approves the deletes | **YES** |
| E13 | **D17/D18: command drift** — the `beast-paces` safety gate and the `beast-ops.md` ground-truth block both source a workspace that does not exist | **T0** grep gate, **T2 execute-as-written** | `grep -rn "ugv_ws/install\|~/ugv_ws\|beast/ugv_ws\|/home/ws/ugv_ws" docs/ .claude/ robot/` returns nothing but dated past-tense history. **Then run every corrected command as written and paste the real output in the PR** — a repointed command that was not run is the same defect with a newer path | agent + owner | **YES** → §9 test **T-5** |
| E14 | D19: rewrite `beast-control-topology.md`'s repo half; **keep `:98-107` and `:109` verbatim** | **T0** — two assertions, one positive one negative | no `Coldaine/ugv_ws`, no worktree table, no Vizanti, no safety monitor; **and** the Authority-stack invariant still present | agent | **YES** — and losing the kept half would delete the clearest safety statement in the tree |
| E15 | D20: Quick connect branch/SHA | **T2 (read-only)** | `ssh beast-01-ts 'cd ~/beast/RobotOverview && git branch --show-current && git rev-parse --short HEAD'` → **verified `main` @ `98a11a1` on 2026-08-14 this session** | agent | **YES** — a HEAD SHA in prose rots faster than anything else in the doc; the fix is shipping the re-probe command beside it |
| E16 | D21: flag the sibling plan's dead path to its owner rather than editing across plans | **T0** | `grep -rn "ugv_ws/install" docs/plans/` immediately before starting **and again before closing** | agent | **YES** |
| E17 | Four `append_insight` calls to Datacore | **UNVERIFIABLE by CI** (needs DB + `HANGAR_INGEST_TOKEN`) | confirm they render at `/datacore` | agent | **YES** |

**Silent-regression flags: E1, E3, E6, E7, E8, E9, E10, E12, E13, E14, E15, E16, E17.** That
count is not an indictment of the plan — it is the honest shape of a doc-drift sweep in a
repo where **no workflow watches `docs/` or `.claude/` at all.** Two tests (T-1 and T-5 in
§9) collapse most of that column to **No**.

---

## 9. What CI does not cover today, and the minimum set of tests worth adding

### 9.1 The gaps, in order of what they cost when they bite

1. **Four package-list surfaces, no cross-check — and they already disagree.** Counted
   directly, 2026-08-14:

   | Surface | `beast_power` | `beast_base` |
   |---|---|---|
   | `robot/beast/ros2_ws/build_common.sh` (`PACKAGES=(…)`, 23 entries) | present | **absent** |
   | `robot/beast/ros2_ws/build_first.sh` (two `--packages-select` blocks) | present | **absent** |
   | `robot/beast/ros2_ws/Dockerfile` (`COPY` list **and** its own `--packages-select`) | present (`:59`, `:83`) | present (`:60`, `:83`) |
   | `robot/beast/ros2_ws/deploy/deploy-to-beast.sh:73` (`PACKAGES="…"` default) | present | present |

   **The sharp version of the defect: `beast_power` and `beast_base` were split out of
   `ugv_bringup` in the same 2026-08-07 strip-down, and someone added one to the two build
   scripts and not the other.** That is not an ambiguity about which list is canonical — it
   is a clean, provable omission, and it is the strongest possible argument for T-1. The two
   surfaces that carry `beast_base` are the two nobody documented as the first-build path;
   the two that omit it are the ones `docs/` tells you to run.

   `beast-ros-image.yml` stays green because the Dockerfile carries its own list —
   **the image build cannot catch this class of defect.** Neither can anything else.

   Note the path: the deploy script is at **`robot/beast/ros2_ws/deploy/deploy-to-beast.sh`**.
   A sibling plan cites `robot/beast/ros2_ws/deploy-to-beast.sh`, which does not exist —
   re-derive before quoting it.
2. **`beast-ros-spine.yml` triggers on the whole ROS subtree and runs two packages' tests.**
   `ugv_tools/test/`, `ugv_bringup/test/`, `ugv_slam/test/`, `ugv_vision/test/`,
   `ugv_voice/test/`, `ugv_chat_ai/test/` never execute. Four units in Plan C (§6.2) and one
   in Plan D (D6) therefore **cannot have a CI home even if someone writes the test**.
3. **No workflow watches `docs/**` or `.claude/**`.** Every doc-drift, command-drift and
   Quick-connect unit is unguarded by construction. Plan E already *wrote* the right
   assertions in its §6 "done when" — they simply have no runner.
4. **`ros-singleton.test.ts` injects mocks and never loads roslib.** The entire server
   bridge is untested against a real wire frame. The `roslib` dependency could be deleted
   and nothing would fail, while the agent's `stop()` broke at runtime.
5. **`systemd-analyze verify` is syntax-only.** It will not notice `After=time-sync.target`
   disappearing from `beast-slam.service`, nor a new unit quietly gaining a `WantedBy`.
6. **`deploy/bin/beast-slam-save`'s 250k-cell refusal has no test**, and it fails
   **silently**. The client half of the same ceiling *is* pinned in `ros-client.test.ts`.
7. **Three greps in the teleop plan's §9.1 are desk-only.** Nothing re-runs them.

### 9.2 Minimum set of new automated tests

Ordered by value per line of test code. The first two unlock the rest.

| | Test | Home | Covers |
|---|---|---|---|
| **T-1** | **Package-list cross-check, both directions.** Enumerate `package.xml` under `robot/beast/ros2_ws/src`, skip any with a `COLCON_IGNORE` at or above it, assert parity across **all four surfaces by name** — `build_common.sh` `PACKAGES`, both `build_first.sh --packages-select` blocks, the `Dockerfile`'s `COPY` list and its `--packages-select`, and `robot/beast/ros2_ws/deploy/deploy-to-beast.sh:73`'s `PACKAGES` default — **and conversely** that no parked name appears in any of them. Seed it with the case that motivates it: `beast_power` and `beast_base` were extracted together and only one reached the build scripts. Pure file parsing, no ROS. | `ugv_cockpit/test/test_build_allowlists.py` — **runs in the existing spine step with no workflow edit** | E1, E2, E7, D4, D24. **The boot-stop defect and the `explore_lite` un-park, in one file.** |
| **T-2** | **Widen `beast-ros-spine.yml`** to run `src/ugv_main/*/test` (or at minimum add `ugv_tools/test` and `ugv_bringup/test` to the existing `pytest` invocation). One line of YAML plus a `PYTHONPATH` entry. | `.github/workflows/beast-ros-spine.yml` | Unblocks T-3, D6, D8. Without it, four live-hazard units in Plan C are permanently unguardable. |
| **T-3** | **`keyboard_ctrl` shutdown contract.** `SIGHUP` is in the handled set; the `finally` path emits `ZERO_TAIL_LIMIT` zeros **before** `destroy_node()`; a readable-but-empty stdin exits the loop into that same path. Import the module and assert on the handler registration and call order — no TTY, no ROS graph. | `ugv_tools/test/test_keyboard_ctrl_shutdown.py` (needs T-2) | C8, C9, C10 — a live hazard on rung 100 with, today, no possible regression guard. |
| **T-4** | **`ros-singleton` wire-frame + source guard.** (a) Feed a raw bare-`NaN` `/scan` string through the transport → `scanAlive === true`, state stays `'connected'`. (b) An `'error'` event while `isConnected` leaves `stop()` able to dispatch. (c) No file under `src/lib/` or `src/components/` references `roslib`. (d) Pin `STATUS_TOPICS`' DDS type strings. | `src/__tests__/ros-singleton.test.ts` + `frame.test.ts` | B3, B4, B8, B9 — and it is what makes the Nav2 phases' unblock claim checkable. |
| **T-5** | **Repo invariant greps as a test.** Assert: no `~/ugv_ws` / `beast/ugv_ws` / `/home/ws/ugv_ws` outside dated past-tense history; no `cmd_vel_timeout\|watchdog_state\|_cmd_vel_watchdog` under `robot/beast/ros2_ws/src/`; no `LINEAR_STEP\|ANGULAR_STEP` under `src/`; `beast-control-topology.md` still carries its Authority-stack invariant. **Then add `docs/**` and `.claude/**` to that workflow's path filter** — the assertions are worthless without a trigger. | a vitest under `src/__tests__/` (cheapest — `web-tests.yml` already runs on push and PR) **plus a path-filter edit** | E3, E9, E13, E14, E16, A12. Turns the largest silent column in this document into red CI. |
| **T-6** | **systemd unit contract.** `beast-slam.service` carries `After=time-sync.target`; no unit under `deploy/systemd/` gains a `WantedBy` without an explicit allowlist entry. | extend `deploy/storage/tests/` — `beast-storage-tests.yml` already globs `deploy/systemd/beast-*` and triggers on that path | D1, D17, C13, C17 |
| **T-7** | **Teleop release-path and guard tests.** `visibilitychange:hidden`, `pointercancel`, gate-close-clears-the-held-set, `isContentEditable`, pending-stop re-fire on reconnect. All five are **implemented** on `claude/beast-teleop-control-law` and none is asserted. | `src/__tests__/command-rail.test.tsx` | A8, A10, A11 |
| **T-8** | **`beast-slam-save` ceiling.** The save script's 250k refusal, which today fails silently after an hour of driving. | `deploy/storage/tests/` or a new `deploy/bin` test lane | D11 |

**T-1 alone is worth more than the rest combined**, because it is the only one that guards a
defect which is currently *invisible and safety-relevant*: a build script that silently
produces a robot with no boot stop.

---

## 10. Roll-up

Units of work identified: **16** (teleop) + **9** (roslib) + **24** (input paths) + **26**
(autonomy) + **17** (vendored surface) = **92**.

Units whose verification **includes** each tier (units commonly span two or three, so the
column sums past 92):

| Tier | Units | Notes |
|---|---|---|
| **T0 static** | 26 | Of these, **14 are T0-only with no CI runner** — the single largest source of silent regression in the set. |
| **T1 unit/CI** | 51 | **16 EXIST** (9 of them on the already-implemented teleop branch); **2 PARTIAL**; **29 must be ADDED**; **4 CANNOT run today** (`ugv_tools/test` has no workflow step). |
| **T2 disarmed wire** | 17 | Systematically under-used. It is the right tier for the whole teleop control law, all three `keyboard_ctrl` shutdown units, the gamepad release paths, and every "is the plumbing right" check in autonomy Phases 2–3. |
| **T3 supervised bench** | 18 | Concentrated in autonomy Phases 1–5 and the rung-150 bench pass, correctly. |
| **T4 owner judgement** | 4 | The teleop feel gate (9 sub-items), the parity constants' correctness, the reverse-steering sense, and "is this a usable map". |
| **UNVERIFIABLE** | 6 | Robot-state units (apt install, stale-tree prune), the Datacore insights, bench step 7's outcome, and Phase 1's measurements. Named as such rather than dressed up. The "no `tmux` while driving" operating rule belongs here too — it is an operator habit, not a testable property. |

**Units that can regress silently: 43 of 92.** Adding T-1 through T-8 brings that to
**roughly 9**, and every remaining one is either robot state or owner judgement — i.e.
honestly outside CI's reach.

---

*Housekeeping: this file is not listed in `docs/plans/README.md`'s "Live work orders" table
because it is a reference, not a work order. Whoever lands the first PR out of the
2026-08-14 set should decide whether it wants a row; if it gets one, mark it
**Reference — delete last**.*
