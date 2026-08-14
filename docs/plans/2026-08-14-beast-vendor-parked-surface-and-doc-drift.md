# BEAST vendor parked surface + doc drift — work order

Status: **Not started.** Written 2026-08-14 after a verified sweep of the parked/vendored
surface and a live read-only session on BEAST-01 (`ssh beast-01-ts`, no motion, no service
changes). Every claim below is either code-verified in this tree or live-verified on the
robot; the provenance is named inline.

This is a **work order**, not a record of reasoning: it names inputs, what to do, what to
emit, and how to tell when it is done. **Code is truth** — if this document and the code
disagree, the code is right and this document is stale; update it, don't preserve it.

## 0. Relationship to the 2026-08-07 strip-down plan

[`2026-08-07-beast-ros-drift-inventory-and-stripdown.md`](2026-08-07-beast-ros-drift-inventory-and-stripdown.md)
is the parent. Read it first. This plan does **not** replace it. It does three things to it:

**A. It corrects that plan's own status header (supersede).** The 2026-08-07 plan says
"the Phase 1 `beast_base` extraction … [is] still open," and
[`docs/plans/README.md:16`](README.md) repeats "Phase 1 extraction open." **Phase 1 shipped**
in `5691602` ("feat(beast): extract beast_base package from ugv_bringup (strip-down Phase 1)
(#176)"). Code-verified:

- `robot/beast/ros2_ws/src/ugv_main/beast_base/` exists with `base_node.py`, `base_ctrl.py`,
  `beast_audio.py`, and `test/test_base_node.py`.
- `ugv_bringup/ugv_bringup/` now holds only `__init__.py` + `odom_publisher.py` — the vendor
  node module is gone.
- `ugv_bringup/launch/bringup_lidar.launch.py:159-160` → `package='beast_base'`,
  `executable='beast_base'`.
- `.github/workflows/beast-ros-spine.yml:44,50,54` already points the safety gate at
  `src/ugv_main/beast_base/test`.
- No `/ugv/watchdog_state` consumer remains in `src/` or `ugv_cockpit/` (one **comment**
  survives — §4 D5).
- Live 2026-08-14: `ros2 node list` on beast-01 shows `/beast_base`; `ros2 param list | grep
  cmd_vel_timeout` returns nothing anywhere in the graph.

Fixing both status lines is scope of **this** plan (§4 D12, D13).

**B. It supersedes §5 Phase 2's "Delete" and "Fix references" subsections.** Those were
written against a tree where vizanti and `ugv_web_app` were merely neutralized. Since then
`361dcc3` ("chore(beast): park unused vendor packages") **parked** them — `COLCON_IGNORE` plus
removal from the build allowlists — and additionally parked `explore_lite` and `emcl2_ros2`,
which the 2026-08-07 plan never mentions. `f35a3a1` then stamped ***(parked)*** markers
through ~20 places in the vendor docs. **Parking is now the repo invariant, not an interim
step:** `AGENTS.md` reads *"Do not delete a vendor package we don't run — **park** it: add a
`COLCON_IGNORE` file to its directory **and** remove its name from the allowlists in
`build_common.sh` / `build_first.sh` … Currently parked: `vizanti` (5 packages),
`ugv_web_app`, `explore_lite`, `emcl2`."* That names both packages the 2026-08-07 plan
ordered deleted. Code is truth and the parking shipped, so Phase 2's "Delete" is stale.
"Fix references" therefore means *correcting the docs that still describe a parked package
as a live one* — the ***(parked)*** markers stay — and the reference list in that plan is
wrong. **§2 and §3 below replace it.**

**C. It extends §3 M6 (the stale-comment sweep) with the verified residue.** That sweep list
was executed only in part. §4 is the complete, file:line-verified list, including four
safety-relevant claims the 2026-08-07 plan did not name.

**Explicitly NOT in scope here** (still owned elsewhere — do not touch, do not duplicate):

| Out of scope | Owner |
|---|---|
| The 12 demo `cmd_vel_nav` retargets (all 12 still unreverted — verified) | 2026-08-07 plan §5 Phase 2 / D7 |
| Phase 3 drift audit vs `037dfca`, RSHUNT multimeter, INA219 recal | 2026-08-07 plan §5 Phase 3 |
| The `"roslib": "^2.1.0"` verdict in `package.json` (`src/server/beast/ros-singleton.ts` dynamic-imports it — a missing `from 'roslib'` grep is not "never imported") | the cockpit ROS-client convergence plan — **note the coupling only**: harvesting any vizanti template would reintroduce a hard *browser* roslibjs dependency, which is an argument *against* harvest, not a reason to drop the server dep |
| Cockpit map rendering / SLAM output | separate cockpit work |

## 1. Inputs and how to re-derive

```bash
# Parked packages (marker at a directory parks every package beneath it):
find robot/beast/ros2_ws/src -name COLCON_IGNORE

# Every package in the tree, with parked status — the diff against the allowlists:
find robot/beast/ros2_ws/src -name package.xml

# Robot ground truth (READ ONLY — never publish to cmd_vel, never start/stop a unit).
# The workspace overlay MUST be sourced or every `ros2 pkg` query lies:
ssh beast-01-ts 'W=~/beast/RobotOverview/robot/beast/ros2_ws
  source /opt/ros/humble/setup.bash && source $W/install/setup.bash
  ros2 pkg executables ugv_tools; ros2 node list; ros2 topic list'
```

**Robot workspace — the one true path**, live-verified 2026-08-14:

```
/home/beast/beast/RobotOverview/robot/beast/ros2_ws
```

Every other workspace path in this repo's docs is dead. Verified absent on beast-01 today:
`~/ugv_ws`, `~/beast/ugv_ws`, `/home/ws/ugv_ws`. The last of those is the `WS=` assignment at
the top of **both** `build_common.sh:4` and `build_first.sh:4` — vendor-container residue that
neither script has ever been run with on this robot. Fix those two lines while §3's allowlist
work is open; a build script that `cd`s to a nonexistent directory and `exit 1`s is a
confusing first-run failure.

Robot checkout, live-verified 2026-08-14: branch **`main`**, HEAD **`98a11a1`** (the #210
cleanup merge), with three untracked `beast-wifi-telemetry` files in `deploy/`.

## 2. Parked / vendored / stub surface — verified inventory and verdicts

| # | Surface | Path | State | Size | Verdict |
|---|---|---|---|---|---|
| 1 | `vizanti`, `vizanti_cpp`, `vizanti_demos`, `vizanti_msgs`, `vizanti_server` | `src/ugv_else/vizanti/` | Parked (one `COLCON_IGNORE` at the parent parks all five); launch files neutralized 2026-08-07 | 263 files / 2.6 MB | **LEAVE PARKED, fix the docs that call it live** (§2.1) |
| 2 | `ugv_web_app` | `src/ugv_main/ugv_web_app/` | Parked **and gutted** — one node left | 32 KB | **LEAVE PARKED, fix the docs that call it live** (§2.2) |
| 3 | `explore_lite` | `src/ugv_else/explore_lite/` | Parked | 128 KB | **LEAVE PARKED** (§2.3) |
| 4 | `emcl2` | `src/ugv_else/emcl2_ros2/` | Parked | 147 KB | **LEAVE PARKED** (§2.4) |
| 5 | `cartographer` | `src/ugv_else/cartographer/` | **Not** parked, built, unused at runtime | — | **LEAVE BUILT** (§2.5) |
| 6 | `beast_base` | `src/ugv_main/beast_base/` | Built on the robot, **absent from both allowlists** | — | **RESTORE to the allowlists** (§3) |
| 7 | `ugv_tools` | `src/ugv_main/ugv_tools/` | Built, installed, all three executables discoverable | — | **NO ACTION — prior "not built" finding is retracted** (§3.1) |
| 8 | Stale `install/` + `build/` trees for the four parked packages on beast-01 | robot only | Present; shadow the parked source | — | **PRUNE on deploy** (§2.6) |

### 2.1 vizanti — LEAVE PARKED

**Do not delete it.** `AGENTS.md` states the invariant — park an unused vendor package
(`COLCON_IGNORE` + removal from the `build_common.sh` / `build_first.sh` allowlists), do not
remove it — and names `vizanti` (5 packages) in the parked set. Verified in this tree:
`src/ugv_else/vizanti/COLCON_IGNORE` is present and parks all five, and no vizanti name
appears in either allowlist. **The park is already correct and complete; this plan's job on
vizanti is the docs, not the tree.**

**Owner-decision conflict, resolved by what shipped.** D6 in the 2026-08-07 plan records the
owner's 2026-08-07 decision: *"Delete from tree (interim: neutralized via no-op launch
files)."* `361dcc3` parked instead and `f35a3a1` stamped the docs to match; `AGENTS.md` then
codified parking as the rule for every vendor package. That is the state the repo is in, so
D6 is the stale half. **Record the reversal in the 2026-08-07 plan's D6 row** (parked, not
deleted, per `AGENTS.md`). If Patrick still wants the tree gone, that is a change to the
`AGENTS.md` invariant first and a delete second — do not do it the other way round, and do
not do either in this PR.

The recorded argument for keeping it is that the neutralized launch stubs are *"a tombstone
that keeps [the unauthenticated rosbridge] from quietly returning."* Parking already makes
the stub unreachable — a `COLCON_IGNORE`'d package cannot be launched at all
(`ros2 launch vizanti_server …` fails with *package not found* on a fresh build; see §2.6
for why that is not yet true on this robot) — so the tombstone argument carries no weight
either way. The fact worth preserving — that `vizanti_server.launch.py` /
`vizanti_rws.launch.py` opened a glob-less rosbridge on `0.0.0.0:5001` — belongs in a
Datacore insight regardless of whether the tree stays. Land it (§5 step 5).

**Harvest assessment — nothing to harvest.** `vizanti_server/public/templates/` holds 32
widgets, including the three that overlap the Hangar cockpit:

| vizanti template | Lines | Cockpit counterpart |
|---|---|---|
| `map/map_script.js` + `map_worker.js` | 382 + 89 | `src/components/cockpit/SpatialView.tsx` (occupancy grid → offscreen canvas, 302 lines total for grid **and** scan) |
| `scan/scan_script.js` | 241 | same file |
| `teleop/teleop_script.js` | 1350 | `src/components/cockpit/CommandRail.tsx` (drive pad) |

Every template opens with runtime-coupled dynamic imports against vizanti's own server —
`map_script.js:1-16` pulls `view.js`, `tf.js`, `rosbridge.js`, `persistent.js`, `util.js`,
`status.js`, and `ros_launch_params` from `${base_url}`, then calls a
`vizanti_msgs/srv/SaveMap` service. It is vanilla ES-module JS bound to vizanti's view
transform, its persistence layer, its message package, and a global `ROSLIB`. Dropping any of
it into a React/Next.js surface that reads through `@/lib/ros/client` means a rewrite, not a
port — and it would drag a *browser* roslibjs dependency into a surface that already
loads `roslib` only on the server (`src/server/beast/ros-singleton.ts`).

`AGENTS.md` is explicit that the UI is the product. vizanti is a robot-hosted Django/JS app
that would be a *second, unstyled, unauthenticated* product surface. The two capabilities it
has that the cockpit lacks — a waypoint editor and a `/vizanti/save_map` button — are already
answered on this robot by Nav2 goals and `beast-slam-save`. **So it is never coming back, and
that is exactly what "parked" means. Do not harvest, do not un-park, do not delete.**

**Changes — docs only; the tree, the `COLCON_IGNORE`, and the allowlists are already right:**

- `robot/beast/ros2_ws/docs/command_arbitration.md:30` — rung 50 reads *"On-screen teleop —
  Vizanti's teleop widget, and any browser cockpit."* A parked package cannot publish
  anything, so this names a source that does not exist. → **"On-screen teleop — the Hangar
  cockpit's drive pad (`/cmd_vel_ui`)."**
- `robot/beast/ros2_ws/docs/experimental.md:118,148` — the port-collision notes ("Vizanti
  (Web App) defaults to **5100**") warn about a service that cannot start while parked.
  Mark the Vizanti half ***(parked — cannot bind; no collision)***; keep the `ugv_chat_ai`
  `:5000` fact, which is live.
- `docs/beast-ops.md:660` — see §4 D8.
- `robot/beast/ros2_ws/docs/web_app.md` and `mkdocs.yml:31` — **keep both.** The page already
  opens with an accurate parked banner (`COLCON_IGNORE`, off the allowlists, *package not
  found*, and how to bring it back), which is the documentation a parked package is supposed
  to have. Leave the ***(parked)*** markers `f35a3a1` stamped across `docs/index.md`,
  `bringup.md`, `mapping.md`, `navigation.md`, `teleoperation.md`, `experimental.md`,
  `packages.md` in place; verify each one is present and reads as parked-not-gone rather than
  removing it.
- Verify the park itself instead of verifying a delete:
  `find robot/beast/ros2_ws/src -name COLCON_IGNORE` lists the vizanti parent, and
  `grep -nE 'vizanti' robot/beast/ros2_ws/build_common.sh robot/beast/ros2_ws/build_first.sh`
  matches only the parked-comment block at `build_common.sh:7-18`, never an allowlist entry.
  §3's regression guard makes that permanent.

### 2.2 ugv_web_app — LEAVE PARKED

Same invariant as §2.1: `AGENTS.md` names `ugv_web_app` in the parked set, and
`src/ugv_main/ugv_web_app/COLCON_IGNORE` is present with no allowlist entry anywhere. The
case below is a case for never un-parking it, **not** a licence to delete it.

It is barely a package; it is a stub wearing a package's clothes. The whole tree is
`COLCON_IGNORE`, `package.xml`, `setup.py`/`setup.cfg`, `resource/ugv_web_app`, three vendor
lint tests, `launch/bringup.launch.py`, `__init__.py`, and **one** node, `roarm_control.py`.
The browser UI it existed to serve was already removed upstream of this repo.

The surviving node is dead code on this robot, three ways over:

1. `launch/bringup.launch.py:8` starts it only `if os.environ.get('ROARM_MODEL')`. `ROARM_MODEL`
   is set nowhere in `deploy/`, no systemd unit, and no env file.
2. It subscribes to `/web/joint_states` — a topic whose only publisher was the deleted web UI.
   Live 2026-08-14: `ros2 topic list` on beast-01 has no `/web/*` topic at all.
3. **BEAST-01 has no RoArm.** Hangar DB `assets.beast`: *"Waveshare UGV Beast PT PI5 ROS2 Kit
   Acce … with the stock pan-tilt 5MP camera"*; `terminals.beast-pan-tilt`: *"Pan-Tilt (2×
   ST3215) … Stock 2-DOF camera mount on the servo bus."* Pan-tilt already has a real owner —
   `beast_base`'s T:133 `joint_states` path.

**Trigger that would change the verdict: none foreseen.** Un-parking requires a RoArm on
BEAST-01 *and* a publisher for `/web/joint_states`, and the pan-tilt already has a real owner.
Record that here so a future inventory does not read "parked" as "pending".

**Changes — docs and one dead host-service call; the package stays where it is:**

- `robot/beast/ros2_ws/build_common.sh:12` — leave the `ugv_web_app` parked-comment line; it
  is the record of the park. Confirm it still reads accurately.
- `robot/beast/ros2_ws/ros2.sh:65-66` — `systemctl --user stop roarm_web_app.service` is a
  *host* service from the vendor's Pi image; it does not exist on the Orin, so this is dead
  regardless of the package's parked state. Remove the two lines and the `echo` above them.
- `robot/beast/ros2_ws/docs/installation.md:93` — *"`ros2.sh` stops `ugv-app`, `ugv-jupyter`,
  and `roarm_web_app` host services"* → drop `roarm_web_app` from the list to match.
- The shared `web_app.md` page keeps its parked banner (§2.1).

### 2.3 explore_lite — LEAVE PARKED

Frontier exploration for Nav2. Nothing we run launches it; it is an operator-invoked `T1`
workflow only. It is genuinely inert: no launch file, service, or config in the tree
instantiates it (verified — every hit is a doc mention, all of them already stamped
***(parked)***). 128 KB, no maintenance cost, and a real capability the moment autonomous
mapping becomes a goal.

**Reason to keep it parked:** it drives Nav2 goals, which drive `cmd_vel_nav` (mux rung 10).
Unparking it puts an autonomous motion source on the robot; that is a deliberate safety
decision, not a build-script tidy-up.

**Trigger that changes the verdict:** the first mission that needs unattended area coverage
(`perimeter-mapping` is the likely one). **Un-park steps, exactly:**

1. `rm robot/beast/ros2_ws/src/ugv_else/explore_lite/COLCON_IGNORE`
2. Add `explore_lite` to the `PACKAGES=(…)` array in `build_common.sh` (§3 fixes the shape of
   this list) **and** to the *first* `colcon build --packages-select` block in
   `build_first.sh:203-212` (it is a `ugv_else` dependency-tier package, not a `ugv_main` one).
3. Remove the `explore_lite` line from the parked-comment block at `build_common.sh:7-18`.
4. Drop the ***(parked)*** markers at `robot/beast/ros2_ws/docs/index.md:88,90,152,193`,
   `docs/navigation.md:36,282,293,296`, `docs/gazebo.md:104`, `docs/teleoperation.md:52`.
5. Rebuild on the robot and re-run the `beast-paces` supervised gate before any unattended run.

### 2.4 emcl2 — LEAVE PARKED

Alternative Monte-Carlo localizer. `ugv_nav` instantiates it **only** under
`use_localization:=emcl`
(`ugv_nav/launch/nav_bringup/localization_launch.py:156-161,235-240`), a mode we do not use;
the default is `amcl` (`nav.launch.py:174`). Because the reference is guarded by
`LaunchConfigurationEquals`, parking it does not break any other mode — unlike `cartographer`
(§2.5). The `emcl2_params_file` argument at `nav_bringup/nav2_bringup.launch.py:159-161` still
resolves to a params yaml that exists, so nothing dangles.

**Cost of the park, stated honestly:** `ros2 launch ugv_nav nav.launch.py
use_localization:=emcl` fails with *package not found* on a fresh build. That is documented at
`robot/beast/ros2_ws/docs/index.md:88,150` and `docs/navigation.md:161,186` — leave those
markers in place.

**Trigger:** `amcl` demonstrably failing to hold a pose on the real map, with a comparison run
wanted. **Un-park steps:** identical to §2.3, substituting `emcl2` for `explore_lite` (the
package name is `emcl2`; the *directory* is `emcl2_ros2` — the `COLCON_IGNORE` goes at the
directory, the allowlist entry uses the package name). Doc markers to clear:
`docs/index.md:88,150`, `docs/navigation.md:161,186` (and the EMCL section heading).

### 2.5 cartographer — LEAVE BUILT (do not park)

Not currently parked, and it must stay that way even though the robot maps with `slam_toolbox`
from apt (`deploy/systemd/beast-slam.service`). `ugv_nav`'s `localization_launch.py` calls
`get_package_share_directory('cartographer')` **unconditionally**, so parking it breaks
`ros2 launch ugv_nav nav.launch.py` for *every* localization mode, `amcl` included. This is
already written down at `build_common.sh:20-24` and is correct — the note is included here so
a future inventory does not "clean it up."

**Trigger that would change it:** guarding that `get_package_share_directory` call behind the
same `LaunchConfigurationEquals('use_localization', 'cartographer')` condition the emcl2 nodes
use. Park it only in the same commit as that guard.

### 2.6 Stale robot install trees — PRUNE

Live 2026-08-14, `~/beast/RobotOverview/robot/beast/ros2_ws/`: `install/` and `build/` both
still contain `vizanti`, `vizanti_cpp`, `vizanti_demos`, `vizanti_msgs`, `vizanti_server`,
`ugv_web_app`, `explore_lite`, and `emcl2` — build outputs from before `361dcc3` parked them.
Parking removes a package from the *build*; it does not remove what is already installed. So
on this robot the parked packages are still on `AMENT_PREFIX_PATH` and still launchable, which
means:

- The docs' claim that parked packages "fail with *package not found*" is **true for a fresh
  build and false for this robot right now** — including the parked banner at the top of
  `docs/web_app.md`.
- `use_localization:=emcl` currently works on beast-01 from a stale artifact and would stop
  working after the next clean build — a confusing failure to debug later.
- The neutralized vizanti launch stubs remain launchable on this robot from the stale
  `install/` tree. **This prune, not a source delete, is what makes them unreachable** — and
  it is the whole of what §2.1's "tombstone" argument was actually asking for.

**Change:** before the deploy is declared done, remove the stale trees on the robot. Patrick
runs this (it touches the deployed workspace); it is read-only with respect to running
services and needs no sudo:

```bash
ssh beast-01-ts 'cd ~/beast/RobotOverview/robot/beast/ros2_ws
  rm -rf install/vizanti install/vizanti_cpp install/vizanti_demos install/vizanti_msgs \
         install/vizanti_server install/ugv_web_app install/explore_lite install/emcl2 \
         build/vizanti build/vizanti_cpp build/vizanti_demos build/vizanti_msgs \
         build/vizanti_server build/ugv_web_app build/explore_lite build/emcl2'
```

Then restart `beast-ros-base.service` (Patrick, supervised — it re-sends the unconditional
boot stop) and re-verify `ros2 node list` matches §5's expected set. **Do not** delete
`install/` wholesale; that would take out `beast_base` and require a full rebuild, which
§3 shows the build scripts currently cannot do.

## 3. The build defect: `beast_base` is missing from both allowlists

**This is the real defect. It is not `ugv_tools`.**

`beast_base` — the package that owns the ESP32 serial link, the T:13 velocity path, the
unconditional boot stop, and the `allow_motion` gate — appears in **neither**
`build_common.sh`'s `PACKAGES=(…)` array (lines 25-49) **nor** either
`colcon build --packages-select` block in `build_first.sh` (lines 201-219).

Enumerating `package.xml` under `src/` gives **24 active packages** and 8 parked.
`build_common.sh` lists **23**. The one missing name is `beast_base`.

**Root cause.** `beast_base` was created by `5691602` (#176, strip-down Phase 1) and the
allowlists were never updated: `git log -S"beast_base" -- build_common.sh build_first.sh`
returns nothing — the string has never existed in either file. It went unnoticed because
`deploy/deploy-to-beast.sh:73` carries its own default,
`PACKAGES="beast_power beast_base ugv_bringup ugv_cockpit"`, and every build since #176 has
gone through the deploy path. `361dcc3`'s parking verification checked that
"`beast_power / ugv_cockpit / ugv_bringup / ldlidar` remain visible" — `beast_base` was not on
the list it checked.

**Consequence, and why it is safety-relevant.** A from-scratch provision via `build_first.sh`
— the documented first-build path — produces a workspace with no `beast_base`. Then
`beast-ros-base.service` (`ExecStart … ros2 launch ugv_bringup bringup_lidar.launch.py
use_lidar:=true use_rviz:=false allow_motion:=true`) fails at
`bringup_lidar.launch.py:159`, *package 'beast_base' not found*. The ESP32 bridge never opens
the serial port, so **the unconditional boot stop is never sent** — and per the live-verified
fact that the ESP32 latches its last velocity with no firmware timeout (2026-08-07,
`+0.81 m` during 5 s of command silence), a robot that was powered down mid-command comes back
up with that command still latched and nothing to clear it. A missing name in a build
allowlist is a missing boot stop.

**Fix (exact):**

- `robot/beast/ros2_ws/build_common.sh` — add `beast_base` to the `PACKAGES=(…)` array
  immediately **before** `beast_power` (both are `ugv_main`; `beast_base` is the one the boot
  service needs, so it reads first).
- `robot/beast/ros2_ws/build_first.sh` — add `beast_base` to the **second**
  `colcon build --packages-select` block (line 216, the `ugv_main` tier), before `beast_power`.
- Add a one-line comment above the `PACKAGES` array making the invariant checkable rather than
  remembered: *"Every non-parked package.xml under src/ must appear here — see
  `find src -name package.xml` vs this list."*

**Regression guard (required — this class of bug must not recur).** Add a test to the
`beast-ros-spine` CI job that enumerates `package.xml` files under
`robot/beast/ros2_ws/src`, skips any whose path has a `COLCON_IGNORE` at or above it, and
asserts each remaining `<name>` appears in **both** `build_common.sh` and `build_first.sh` —
and, conversely, that no parked package name appears in either (colcon errors on a selected
package it cannot discover, which is the failure mode AGENTS.md's parking convention exists to
avoid). Put it next to the existing spine tests; it is a pure file-parsing test and needs no
ROS.

### 3.1 `ugv_tools` — retraction

A prior session recorded that `ugv_tools` "is NOT BUILT on the robot
(`ros2 pkg executables ugv_tools` ⇒ *Package 'ugv_tools' not found'*)". **That finding is
wrong and this plan retracts it.** Live 2026-08-14:

```
$ ros2 pkg prefix ugv_tools
/home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/ugv_tools
$ ros2 pkg executables ugv_tools
ugv_tools behavior_ctrl
ugv_tools joy_ctrl
ugv_tools keyboard_ctrl
```

`ugv_tools` is listed in both allowlists, built, installed (`install/ugv_tools/lib/ugv_tools/`
has all three shims), and its `teleop_twist_joy.launch.py` is installed to `share/`.

The "not found" was an environment artifact: `~/.bashrc` on beast-01 sources **neither**
`/opt/ros/humble/setup.bash` **nor** the workspace `install/setup.bash`
(`bash -lic 'echo $AMENT_PREFIX_PATH'` returns empty). Sourcing only `/opt/ros/humble` — the
natural half-measure over a non-interactive SSH — reproduces the exact message, and exits
**0** while doing so, so it does not even look like an error:

```
$ ssh beast-01-ts 'source /opt/ros/humble/setup.bash; ros2 pkg executables ugv_tools'
Package 'ugv_tools' not found
```

**Change (cheap, prevents the next false alarm):** add the two-line source preamble to the
Quick connect block in `docs/beast-ops.md` as the required prefix for *any* `ros2` query over
SSH, and note that `ros2 pkg executables` exits 0 on a missing package. No robot change —
`.bashrc` is deliberately bare so that a login shell does not carry a ROS overlay into
unrelated work; the services source explicitly in their `ExecStart`.

## 4. Doc-drift sweep — every stale claim, with the correction

### 4.0 Principle: a stale copy-paste command is worse than a stale claim

**Rank command drift above prose drift, always.** A stale prose claim misleads a reader, who
may notice it conflicts with something else. A stale *command* hands the reader fabricated
evidence, which they then reason from — and the reasoning looks careful the whole way down.
It is drift that manufactures more drift.

This is not hypothetical. It happened during the session that produced this plan. The
governing mechanic:

```bash
# `source` on a path that does not exist fails SILENTLY (no output, and it does not
# abort the `&&` chain in the way you would expect from a missing binary):
ssh beast-01 'source /opt/ros/humble/setup.bash && source ~/beast/ugv_ws/install/setup.bash \
  && ros2 pkg executables ugv_tools'
Package 'ugv_tools' not found        # ← and it exits 0
```

`ros2 node list` and `ros2 topic list` need **no** workspace overlay, so they keep working and
corroborate that the robot is healthy and the session is connected. Only `ros2 pkg *` and
`ros2 param *` need the overlay. The result is a probe that reports a package as absent, exits
0, and sits next to two commands that look fine — which is exactly the shape of a real
finding. §3.1 records the two wrong conclusions this produced. See §1 for the correct
workspace path.

**Rule for anyone executing this plan:** every `ssh`/`ros2`/`systemctl` snippet in `docs/` and
`.claude/skills/` must be run as written before it is called correct. A command that has not
been executed is not verified, however plausible it reads.

Safety-relevant first. **D1–D4 and D3a–D3f are the ones that can hurt someone**: each tells a reader that
something stops the robot when nothing does. The governing fact, live-verified 2026-08-07 and
re-confirmed today (`no cmd_vel_timeout param anywhere in the graph`): **on command silence
nothing stops BEAST-01.** The ESP32 latches its last velocity; the only halt is an explicit
`T:13 0,0`, which reaches the base from exactly three places — the unconditional boot stop,
the `allow_motion` true→false edge, and a command source's own zero tail
(`ugv_tools` `joy_ctrl` / `keyboard_ctrl`, `ZERO_TAIL_LIMIT=5`). **No demo node has a zero
tail** — verified: `grep -rl ZERO_TAIL src/ugv_main/` matches only `ugv_tools` and the mux
spine test.

| # | File:line | Stale claim | Correction |
|---|---|---|---|
| **D1** | `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/config/twist_mux.yaml:30-35` | *"nothing here sends a zero Twist on timeout. That job belongs entirely to ugv_bringup's own 0.5 s `cmd_vel_timeout` watchdog on the robot side (ugv_bringup.py::_cmd_vel_watchdog_tick) … the Jetson-side watchdog is what guarantees the robot actually stops when nobody is driving. Keep both"* | **A live safety config pointing at a function deleted in #174, in a file whose own header says changing it "is a deliberate safety change."** Replace with: *"nothing here sends a zero Twist on timeout — and **nothing downstream does either.** There is no `cmd_vel_timeout` watchdog: it was removed in #174 (2026-08-07) and `beast_base` does not reimplement it. The ESP32 latches its last velocity indefinitely (live-proven: +0.81 m of wheel travel during 5 s of silence). Expiry here means the rung goes quiet, **not** that the robot stops. The only halts are `beast_base`'s unconditional boot stop, the `allow_motion` true→false edge, and a source's own zero tail — which only `ugv_tools` joy/keyboard send."* |
| **D2** | `robot/beast/ros2_ws/docs/vision.md:23` | *"To stop motion, press **Ctrl+C** in the terminal running the tracking node. Once no source is streaming, twist_mux stops publishing and **ugv_bringup**'s 0.5 s **cmd_vel** watchdog stops the robot."* | **Operator instruction for the exact scenario that failed.** The vision demos have no zero tail; Ctrl+C leaves the ESP32 latched and the robot driving. Replace with: *"**Ctrl+C does not stop the robot.** The tracking nodes send no zero tail, and there is no watchdog — the ESP32 keeps executing the last command. To stop: disarm via `/ugv/set_allow_motion` (`ros2 service call /ugv/set_allow_motion std_srvs/srv/SetBool '{data: false}'`), or drive a zero from a teleop source. Lift the robot before running any tracking demo."* |
| **D3** | `robot/beast/ros2_ws/docs/teleoperation.md:227` | *"Press **Ctrl+C** … twist_mux stops publishing and **ugv_bringup**'s 0.5 s **cmd_vel** watchdog stops the robot — so this takes up to about half a second, not instantly."* | Accidentally right for the wrong reason (`keyboard_ctrl`/`joy_ctrl` *do* send a 5-message zero tail on shutdown — `keyboard_ctrl.py:310`), so the reader learns a rule that fails the moment they Ctrl+C anything else. Replace the mechanism: *"…the teleop node sends a 5-message zero burst on shutdown, which is what stops the robot. There is no watchdog behind it — Ctrl+C on any node **without** a zero tail (the vision and LiDAR demos, `behavior_ctrl`) leaves the last command latched in the ESP32."* Line 39's existing "**Stopping teleop is not stopping the robot**" note is correct — keep it and cross-link. |
| **D3a** | `robot/beast/ros2_ws/docs/lidar.md:16` | The D2 sentence again, for the guard/follow demos: *"To stop motion, press **Ctrl+C** … twist_mux stops publishing and **ugv_bringup**'s 0.5 s **cmd_vel** watchdog stops the robot."* | The LiDAR demos publish `cmd_vel_nav` and have **no zero tail**. Apply D2's replacement text. Keep the existing "lift the robot on a bench" instruction on that line — after the correction it is the only thing there that actually stops anything. |
| **D3b** | `robot/beast/ros2_ws/docs/navigation.md:22` | Same sentence, for `nav.launch.py`. | Nav2 has no zero tail either: Ctrl+C on the nav launch leaves the last `cmd_vel_nav` command latched in the ESP32. D2's replacement text, naming `nav.launch.py`. |
| **D3c** | `robot/beast/ros2_ws/docs/experimental.md:23` | Same sentence, for `behavior_ctrl`. | `grep -rl ZERO_TAIL src/ugv_main/` does not match `behavior_ctrl` — no zero tail, and D3's own correction already names it as an example. D2's replacement text. |
| **D3d** | `robot/beast/ros2_ws/docs/mapping.md:24` | Same sentence, for teleop. | This is the **D3** case, not the D2 case: teleop *does* send the 5-message zero burst, so the outcome is right and only the mechanism is invented. Use D3's replacement wording — do not paste D2's here, or the doc will tell an operator that teleop leaves the robot driving when it does not. |
| **D3e** | `robot/beast/ros2_ws/docs/command_arbitration.md:161` | *"If `twist_mux` dies, `/cmd_vel` has no publisher at all and **ugv_bringup**'s watchdog stops the robot — the fail-closed direction."* | **Inverts the safety argument inside the doc that owns the ladder.** A dead `twist_mux` mid-command leaves the ESP32 driving on the latched velocity with no arbiter left to send a zero; there is nothing fail-closed about it. The no-`respawn` decision still stands on its second reason (a respawned arbiter returns with the e-stop lock released) — keep that, drop the watchdog clause, and say plainly that a dead `twist_mux` needs an explicit stop. |
| **D3f** | `robot/beast/ros2_ws/docs/bringup.md:92` and the *"Why the watchdog has to publish this itself"* note directly below it | Topic-table row for `ugv/watchdog_state` — *"`armed`, `fired`, `watching`, `timeout`. 2 Hz, latched, plus an immediate republish the moment the watchdog stops the robot"* — presented as a live interface. | The topic went with the watchdog in #174 (D5); `beast_base` publishes nothing of the kind. Delete the row and the note. This is the operator-facing twin of D5, which only covers the `package.xml` comment. |
| **D4** | `robot/beast/ros2_ws/src/ugv_main/ugv_tools/launch/teleop_twist_joy.launch.py:39-42` | Justifies `autorepeat_rate` by claiming that without it *"twist_mux expires that source 0.5 s later, and ugv_bringup's cmd_vel watchdog stops the robot mid-command while the stick is still pinned."* | **Inverted.** Without autorepeat the robot does not stop mid-command — it *keeps driving* on the latched command while the mux rung sits expired, and a lower-priority source (a demo, Nav2) can then take the floor under a pinned stick. That is a stronger argument for the same `20.0 Hz`, so the setting stays; only the reasoning changes. Rewrite the bullet accordingly and drop "watchdog." |
| **D5** | `robot/beast/ros2_ws/src/ugv_main/ugv_bringup/package.xml:22-23` | *"`/ugv/watchdog_state` is a DiagnosticStatus: the cockpit's safety strip reads armed/fired from it (see ugv_cockpit/cockpit_status.py)."* | Topic deleted in #174; `cockpit_status.py` no longer reads it. This comment is the last `watchdog_state` reference in the whole subtree. Delete the comment. Then check whether `<depend>diagnostic_msgs</depend>` (line 24) is still needed by anything remaining in `ugv_bringup` (`odom_publisher.py` + launch/config only) — if not, drop it too. |
| **D6** | `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/README.md:37-41` | *"`/imu/raw`, not `/imu/data`. … Nothing on this robot publishes `/imu/data`."* | False since #174. Live: `ros2 topic info /imu/data` → `sensor_msgs/msg/Imu`, **publisher count 2**. `rosbridge.launch.py:109` was already corrected (*"beast_base publishes Imu on `imu/data` (canonical …)"*) — this README contradicts the launch file next to it. Rewrite: `/imu/data` is canonical (EKF / rf2o consume it); `/imu/raw` is a same-payload alias `beast_base` also publishes. |
| **D7** | `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/test/test_cockpit_bridge.py:64-65,270` | *"republishes it as imu/data, so /imu/data does not exist on this robot"* and the docstring *"/imu/data does not exist on BEAST-01; whitelisting it would be dead config."* | Same false premise as D6 — `base_node.py:100-101` publishes **both** `imu/data` and `imu/raw`. **Fix the comments and nothing else.** Do **not** re-derive `EXPECTED_SUB_TOPICS` from what `beast_base` publishes: that list is not an inventory of robot topics, it is the **web client's subscribe contract restated independently** (its own header says so), and `test_subscribe_glob_is_exactly_the_client_contract:264-266` asserts `topics_sub_glob == EXPECTED_SUB_TOPICS` *exactly*. The client subscribes `/imu/raw` (`src/lib/ros/client.ts:25`) and `src/__tests__/ros-client.test.ts:270-274` asserts it never subscribes `/imu/data`; adding `/imu/data` to the Python list would break the equality assertion, widen the bridge past what the client uses, and contradict the web suite. Both assertions at `:276-277` are correct as written — keep them and restate their reason: `/imu/raw` is on the list **because that is the topic the client subscribes**, not because `/imu/data` is absent. The `create_publisher(Imu, "imu/raw"` guard at `:272` is still true and still the right check. The same false sentence is also rendered to the operator at `src/components/cockpit/HonestyRail.tsx:24` and repeated at `src/lib/ros/client.ts:19,24`, `src/components/cockpit/TelemetryRow.tsx:226`, and the test name at `src/__tests__/ros-client.test.ts:270` — correct the wording in all five; change no topic. |
| **D8** | `docs/beast-ops.md:660` | *"Existing separate surfaces remain Vizanti `:5100`/`:5001`, `ugv_chat_ai` `:5000`, and MediaMTX …"* | Vizanti's launch files were neutralized 2026-08-07 and the package is parked (§2.1); nothing on a current build serves `:5100` or `:5001`, and §2.6's prune removes the stale robot artifact that could still start one. Drop the Vizanti clause; keep `ugv_chat_ai` and MediaMTX with their "verify them live" caveat. |
| **D9** | `docs/beast-ops.md:663-664` | *"`beast-ros-base.service` runs `bringup_lidar.launch.py use_lidar:=false use_rviz:=false allow_motion:=false`"* | **Wrong on two of three flags, one of them the motion gate.** The deployed unit's `ExecStart` (`deploy/systemd/beast-ros-base.service:19`) is `use_lidar:=true use_rviz:=false allow_motion:=true`. The doc says the robot boots motion-locked with no LiDAR; it boots **motion-armed with LiDAR up**. Anyone reasoning "it's locked at boot, safe to power on near it" is reasoning from a false premise. Correct the flags and re-date the bullet; the surrounding claim (that `/scan` is empty on a stock boot) is also now false. |
| **D10** | `docs/beast-ops.md:641-645` | *"**cmd_vel-timeout watchdog currently present but scheduled for removal:** … Normal startup is motion-enabled … The watchdog removal is a separate planned change; **do not treat this current branch as having removed it.**"* | Present tense, and the emphasised sentence instructs the reader to assume a safety net that is gone. Rewrite as a dated historical entry — *"2026-07-31 → 2026-08-07: a `cmd_vel_timeout` (0.5 s) briefly existed in `ugv_bringup`; removed in #174 and not carried into `beast_base`"* — and point forward to the Quick connect block. |
| **D11** | `docs/beast-ops.md:415-418`, `:653-656`, `:669-671`, `:683-684` | `:415` *"the current `twist_mux` + `cmd_vel_timeout` stack does stop sending commands … the current ROS-side watchdogs prevent it from mattering"*; `:653` *"BEAST-01 does **not** currently have `beast-cockpit.service` installed/enabled"*; `:669` *"`/cockpit/status`, `/ugv/allow_motion` and `/ugv/watchdog_state` land with `ugv_ws` PR #10 and are **not on the robot yet**"*; `:683` *"The current branch still contains the stale-command watchdog."* | All four are false against live state: `beast-cockpit.service` is **enabled and active**; `/cockpit_status` is a running node and `/ugv/allow_motion` a live topic; `/ugv/watchdog_state` does not exist and never will. These sit in the dated-history section, which AGENTS.md permits — but they use the present tense ("current", "not yet"), which is what makes them read as status. **Convert each to past tense with its date, or delete.** History earns its keep only if a reader can tell it is history. |
| **D12** | `docs/plans/README.md:16` | Blocking column: *"Phase 2 partial (H2 neutralized, not deleted); **Phase 1 extraction open**."* | Phase 1 shipped in `5691602` (#176) — see §0.A. Update to: *"Phase 1 done (#176); Phase 2 open — demo retargets unreverted."* Add a row for **this** plan. |
| **D13** | `docs/plans/2026-08-07-…-stripdown.md:3-8` and §3 M6 | Status header says the Phase 1 extraction is *"still open"*; the M6 sweep list is presented as pending in full. | Update the header to "Phase 2 open" and mark M6 as *"superseded by `2026-08-14-beast-vendor-parked-surface-and-doc-drift.md` §4."* Leave the D7 demo-retarget work where it is — this plan does not take it. |
| **D14** | `.claude/skills/beast-paces/SKILL.md:25-28,59-63` | Correctly **fail-closed** ("stop: do not enable…" if no watchdog exists) — the safest doc in the sweep. But it tells the operator to look for the watchdog in `ugv_bringup` and to run `ros2 param get <node> cmd_vel_timeout`. | The node is `/beast_base` now; `ugv_bringup` no longer has a node module at all, so the check would come back "no such node" rather than "no such param" and could read as an environment problem instead of the intended fail-closed answer. Point it at `beast_base` and keep the fail-closed logic verbatim. **See D17 — the same block's paths are also dead, which is the more serious half.** |
| **D15** | `docs/beast-jetson-flash-runbook.md:1075`, `:1091` | *"**Status (2026-07-31):** The Jetson-side `cmd_vel_timeout` watchdog is implemented in `ugv_bringup`"*; and a live re-gate of it listed as a **required** next step. | The date-stamp on `:1075` makes it defensible history; `:1091` is a live action item for a thing that cannot be tested. Strike the `:1091` item and append to `:1075`: *"— removed 2026-08-07 (#174); see `docs/beast-ops.md` Quick connect."* Line 1185's already-struck-through text is fine as-is. |
| **D16** | `docs/plans/2026-08-02-robot-architecture-pivot-plan-1-safety.md:8-10`, `2026-08-02-llm-autonomous-control.md:9`, `2026-08-02-robot-architecture-pivot-plan-4-llm.md:26`, `2026-08-02-control-plane-architecture.md:19`, `2026-07-31-beast-command-deck-spec.md:87-94`, `docs/plans/beast-command-deck-drafts/` | Each describes `cmd_vel_timeout` as *"our unbreachable physical safety net"* / *"the Ultimate Backstop"* / *"the only lower backstop"*, and several describe the deleted Ethernet/charging interlocks. **None of these files is listed in `docs/plans/README.md`'s "Live work orders" table.** | Untracked, unexecuted plans asserting a safety net that does not exist — the highest-volume source of the false belief. Per the repo rule (*"Executed plans are deleted, not archived — git history is the archive"*), and because these were superseded rather than executed: **delete them**, along with `beast-command-deck-drafts/` (its `twist_mux.yaml:31-34,49` and `README.md:105-129` are the drafts D1 was copied from). Ask Patrick to confirm before deleting `2026-07-31-beast-command-deck-spec.md` and `2026-08-01-beast-cockpit-future-roadmap.md` — the 2026-08-07 plan cites the command-deck line as "historical cockpit context," so it may be wanted. If any is kept, prefix it with a one-line `Status: **Superseded** — cmd_vel_timeout no longer exists; see docs/beast-ops.md.` and add it to the README table. |

### 4.1 Command drift — the §4.0 class, highest priority within the sweep

| # | File:line | Stale command / claim | Correction |
|---|---|---|---|
| **D17** | `.claude/skills/beast-paces/SKILL.md:61-62`, `:112` | The **fail-closed watchdog gate** — the check that decides whether it is safe to drive the robot — instructs: *"look for the timeout in `~/beast/ugv_ws/src`, confirm it is present in the installed workspace (`~/beast/ugv_ws/install`)"*, and `:112` runs `source /opt/ros/humble/setup.bash && source ~/beast/ugv_ws/install/setup.bash`. | **Worst instance of §4.0 in the repo: the safety gate itself cannot be run.** All three paths are absent (verified today). The `ls` on `~/beast/ugv_ws/src` errors — recoverable, an operator sees it. The `source` at `:112` does **not**: it fails silently, and the `ros2 param get` that follows then reports the watchdog absent *for the wrong reason*. The skill's fail-closed verdict ("stop: do not enable") is correct **by accident** here, which is the dangerous kind of correct — the same silent-source failure would equally hide a param that *did* exist. Repoint all three to `~/beast/RobotOverview/robot/beast/ros2_ws` (§1), and add the §4.0 warning inline: *"if `ros2 pkg`/`ros2 param` reports something missing, re-run `ros2 node list` first — it needs no overlay. If nodes list but packages don't, your overlay did not source and the result is meaningless."* Fix with D14 in the same edit. |
| **D18** | `docs/beast-ops.md:545` (and `:540`) | The dated ground-truth copy-paste block: `ssh beast-01 'source /opt/ros/humble/setup.bash && source ~/beast/ugv_ws/install/setup.bash && … ros2 topic list …'`. | **The doc refutes itself.** `:423` says *"the legacy `~/beast/ugv_ws` checkout is gone and the monorepo cutover is deployed"* and `:1063` says *"monorepo cutover COMPLETE; legacy `~/beast/ugv_ws` is gone"* — while `:545` hands out a command that sources it. Two correct prose claims lost to one wrong command, because the command is the part people paste. Repoint to §1's path. Also switch both blocks from `ssh beast-01` to **`ssh beast-01-ts`**: AGENTS.md says prefer Tailscale because LAN IPs drift, and `:438` already records that `beast-01.local` currently resolves to the *Ethernet* address while `:22` calls Ethernet unplugged. Keep `ssh beast-01` only in the explicitly-labelled LAN-fallback rows (`:22`, `:456`, `:1010`). |
| **D19** | `docs/beast-control-topology.md` — whole file, esp. `:10-41`, `:43-57`, and the two mermaid blocks | *"**`ugv_ws` is not inside RobotOverview** … Two sibling clones on the Windows PC, one GitHub fork, one checkout on the Jetson"*, mapping `D:\_projects\ugv_ws` → `Coldaine/ugv_ws` as the "main clone", `D:\_projects\.worktrees\ugv_ws-*` as feature worktrees, and `~/beast/ugv_ws` as *"**this** is what actually runs"*. `:38` gives a probe command against that path. `:48` credits the robot brain to `Coldaine/ugv_ws` and lists a *"safety monitor"* it owns. Both mermaid diagrams label the Jetson subgraph `Coldaine/ugv_ws` and show **Vizanti** as a `cmd_vel_ui` source (twice). | **Assessed whole, as asked — the file is half obsolete and half the best safety writing in the repo. Rewrite the repo half; keep the authority half.** Obsolete: the entire two-repo premise directly contradicts AGENTS.md (*"Do not recreate a `Coldaine/ugv_ws` fork or a second local clone"*) — this file is the most likely reason someone would. `ugv_safety_monitor` was deleted in #174. Vizanti is parked (§2.1) and cannot publish anything, so it is not a `cmd_vel_ui` source. Replace §"Where the repos live" and §"Dual-repo map" with the single-monorepo reality (`robot/beast/ros2_ws` is a vendored fork we own; robot checkout `~/beast/RobotOverview`, currently `main @ 98a11a1`), delete the worktree table and the `D:\_projects\ugv_ws\docs\BEAST.md` cross-link, drop the `:38` probe (it duplicates Quick connect anyway), and relabel both mermaid subgraphs. **Keep verbatim** the Authority-stack invariant at `:98-107` and `:109` — *"no automatic Ethernet/charging interlock and no Jetson-side `cmd_vel` silence watchdog… the ESP32 may retain its last command until another command or reboot"* and *"The current service default is motion-enabled"* — that is the clearest and most accurate statement of BEAST-01's safety reality anywhere in the tree, and D1/D2/D9 should be reworded to agree **with it**. Note the coupling to D16: `:5` calls `plans/2026-08-02-control-plane-architecture.md` "the master plan"; if D16 deletes that file, replace the link here in the same commit rather than leaving it dangling. |
| **D20** | `docs/beast-ops.md` Quick connect, "Deploy 2026-08-14 05:58Z" block | *"Robot checkout is `feat/cockpit-map-render` @ **`edae18d`**"*. | **False as of 2026-08-14, and this is the block AGENTS.md designates as the only "current state" surface.** Live: branch `main`, HEAD `98a11a1` (#210 merge). `edae18d` still exists as a commit object, so the entry was true when written and the branch was merged/moved afterward — which is precisely why a HEAD SHA in prose rots faster than anything else in the doc. Correct it, and add the re-probe command next to it so the next reader verifies instead of trusting: `ssh beast-01-ts 'cd ~/beast/RobotOverview && git branch --show-current && git rev-parse --short HEAD'`. Also note the three untracked `deploy/bin/beast-wifi-telemetry` + `deploy/systemd/beast-wifi-telemetry.{service,timer}` files present on the robot but not committed here. |
| **D21** | `docs/plans/2026-08-14-cockpit-teleop-control-law-rewrite.md:471` | `source /opt/ros/humble/setup.bash; source ~/ugv_ws/install/setup.bash` | Same dead path, already propagating into plans written **today** — evidence that the stale command is reproducing faster than the prose. Sibling plan, not this plan's file to edit: **flag it to its owner** rather than editing across plans. Whoever executes this plan should grep `docs/plans/` for `ugv_ws/install` immediately before starting and again before closing, since new plans keep landing. |
| **D22** | `.claude/skills/beast-paces/SKILL.md:106-107` | Phase 2 step 2 tells the operator to relaunch bringup *"in a foreground SSH session **so Ctrl+C is a kill switch**."* | **False, and the same file already says so.** `:167-168` reads *"Restarting `beast-ros-base.service` does not stop a moving robot — the ESP32 holds the last velocity"*, which is equally true of Ctrl+C on the foreground launch: killing the command source is not a stop. That step is also the one place a supervised session deliberately runs with `allow_motion:=true`. Replace "so Ctrl+C is a kill switch" with the real reason for foregrounding it (the launch stays visible and stoppable; `:118-120` already states what to do if it dies), and name the staged zero in step 1 plus the hardware cut as the actual stops. Fix in the same edit as D14/D17 — one skill, one pass. |

**Do not touch:** `src/data/hangar.ts` and `src/data/datacore-corpus.ts` — CI fixtures, stale
by design (AGENTS.md). Their `watchdog` insight rows describe a *design principle* ("a cheap
onboard reflex … lives on the Pi/ESP32") which remains a legitimate aspiration, not a claim
about deployed code. `db/hangar/seed.sql` likewise. If the live Datacore `watchdog` insight
needs the correction, land it as a new `append_insight` (§5 step 5), never as a fixture edit.

**Already correct — leave alone (recorded so the next sweep does not "fix" them):**
`docs/beast-ops.md:90` ("do not treat Ctrl+C or unplugging the pad as a stop");
`robot/beast/ros2_ws/docs/gazebo.md:19` (its "no further velocity reaches the model" claim is
about the *simulated* model, which has no latching ESP32 behind it — leave it, and do not
copy its phrasing into a hardware doc);
`docs/beast-control-topology.md:100` ("no Jetson-side `cmd_vel` silence watchdog");
`ugv_cockpit/launch/rosbridge.launch.py:109`; `beast_base/base_node.py:7-10`;
`beast_base/test/test_base_node.py:392-393`; `ugv_tools/joy_ctrl.py:96` and
`keyboard_ctrl.py:88-92` (all three explicitly say there is **no** watchdog backstop);
`docs/NORTH_STAR.md:38` (states an intent, not a deployed fact).

## 5. Execution

One PR. Robot-facing, so it deploys the same day via
`robot/beast/ros2_ws/deploy/deploy-to-beast.sh` (Patrick runs it — it needs robot sudo) and
the Quick connect block in `docs/beast-ops.md` is updated, dated, at the end (AGENTS.md rule).

Order matters: **fix the build first**, so that a mid-sequence rebuild cannot produce a
workspace without `beast_base`. **Nothing in this plan deletes a package** — §2.1 and §2.2
are doc corrections over a park that is already correct.

1. **§3 — allowlists + regression guard.** Add `beast_base` to `build_common.sh` and
   `build_first.sh`; add the CI test that diffs `package.xml` names against both lists in both
   directions. Green CI here gates everything after it.
2. **§2.1 + §2.2 — parked-surface docs.** Verify the park (`COLCON_IGNORE` present, no
   allowlist entry) for vizanti and `ugv_web_app`; leave both trees, `docs/web_app.md`, the
   mkdocs nav entry, and the ***(parked)*** markers alone; fix `ros2.sh:65-66`,
   `docs/installation.md:93`, `docs/command_arbitration.md:30`,
   `docs/experimental.md:118,148`; record the D6 reversal in the 2026-08-07 plan.
3. **§4.1 — command drift first.** D17 (the beast-paces safety gate) before anything else in
   §4: until it is repointed, the one procedure that decides whether it is safe to drive
   cannot be executed. Then D18, D20, D19, D21. Fix D14 and D22 in the same edit as D17.
   **Every corrected command must be executed as written and its real output pasted into the
   PR** — a repointed command that was not run is the same defect with a newer path.
4. **§4 — prose drift.** D1–D7 including D3a–D3f (in-tree code/config/test comments and the
   vendor operator docs) and D8–D16 (repo docs and plans) in that order. D1 first; it is the
   one a reader acts on. D3a–D3f are the same two corrections applied six more times — settle
   D2's and D3's wording, then reuse it verbatim, and note which of the two each site takes
   (D3d takes D3's). Reword D1/D2/D9 to agree with the Authority-stack invariant kept at
   `beast-control-topology.md:98-107` (D19) rather than inventing a fourth phrasing of the
   same fact.
5. **Deploy + prune.** `deploy-to-beast.sh`, then §2.6's stale-tree removal, then a supervised
   `beast-ros-base.service` restart. **No motion in this plan** — the restart re-sends the
   unconditional boot stop, which is the safe direction.
6. **Land the facts in Datacore** (`POST /api/hangar/ingest`, Bearer `HANGAR_INGEST_TOKEN`).
   A session that learns something durable and writes it only to `docs/` has not recorded it:
   - `append_insight` `ins-beast-no-cmdvel-watchdog` — confidence `high`, `units: ["beast"]`,
     tags `["safety","ros2","teleop"]`: nothing stops BEAST-01 on command silence; the three
     real halts; Ctrl+C on a demo node is not a stop.
   - `append_insight` `ins-beast-vizanti-rosbridge-exposure` — the fact the vizanti tombstone
     was keeping (glob-less rosbridge on `0.0.0.0:5001`), so it survives outside a parked
     tree nobody reads.
   - `append_insight` `ins-beast-ros-overlay-required` — confidence `high`, `units: ["beast"]`,
     tags `["ros2","ops","method"]`. **The highest-value insight in this plan.** The one true
     workspace path (§1); `~/ugv_ws`, `~/beast/ugv_ws`, `/home/ws/ugv_ws` are all absent;
     `~/.bashrc` carries no ROS overlay by design; `source` on a missing overlay fails
     silently and `ros2 pkg executables` then exits **0** while reporting the package missing;
     `ros2 node list` / `ros2 topic list` need no overlay, so they keep working and make the
     bad probe look trustworthy. Include the disambiguation rule: *nodes list but packages
     don't ⇒ the overlay did not source.*
   - `append_activity` for the strip.
7. **Update `docs/plans/README.md`** — D12's row edit, plus a row for this plan; drop rows for
   anything deleted in D16.
8. **Delete this plan** when §6 is fully green. Executed plans are not archived — git is the
   archive.

## 6. Done when

- `find robot/beast/ros2_ws/src -name package.xml` yields exactly the packages named in
  `build_common.sh`'s `PACKAGES` array plus the parked set, and the new CI test asserts it in
  both directions. `beast_base` is in both build scripts.
- `find robot/beast/ros2_ws/src -name COLCON_IGNORE` still lists all four parked directories,
  and no parked package name appears in either allowlist. **Nothing was deleted.**
- `grep -rni "roarm_web_app" robot/beast/ros2_ws/` returns nothing, and every surviving
  `vizanti` / `ugv_web_app` / `web_app.md` hit in `robot/beast/ros2_ws/docs/` reads as parked
  rather than as an available capability — in particular `command_arbitration.md:30` no longer
  names Vizanti as a `cmd_vel_ui` source.
- `grep -rni "cmd_vel_timeout\|watchdog_state\|_cmd_vel_watchdog" robot/beast/ros2_ws/src/`
  returns nothing.
- `grep -rn "watchdog stops the robot" robot/beast/ros2_ws/ docs/ .claude/` returns nothing,
  and `grep -rni "ctrl+c" robot/beast/ros2_ws/docs/ .claude/skills/` shows no remaining claim
  that Ctrl+C, on its own, stops the robot.
- Every remaining `watchdog` hit under `robot/beast/ros2_ws/` and `docs/` either denies the
  watchdog's existence, is a dated historical entry in past tense, or refers to
  `beast-link-watch` (an unrelated network unit).
- `robot/beast/ros2_ws/mkdocs.yml` builds with no dangling nav entry or broken internal link.
- `docs/beast-ops.md:663`'s service flags match `deploy/systemd/beast-ros-base.service:19`
  verbatim.
- **Command drift is zero.**
  `grep -rn "ugv_ws/install\|~/ugv_ws\|beast/ugv_ws\|/home/ws/ugv_ws" docs/ .claude/ robot/`
  returns nothing except dated past-tense history that names the path as *gone*
  (`beast-ops.md:423`, `:1063`). `WS=` in `build_common.sh:4` / `build_first.sh:4` points at
  the real workspace.
- **Every command in `docs/` and `.claude/skills/` that this PR touched was executed as
  written, and its output is pasted in the PR.** Specifically: the beast-paces watchdog gate
  (D17) runs end-to-end and returns its fail-closed verdict *for the right reason*, and the
  `docs/beast-ops.md` ground-truth block (D18) returns a live topic list.
- `docs/beast-control-topology.md` names one repo, no `Coldaine/ugv_ws`, no worktree table, no
  Vizanti, no safety monitor — and still carries the Authority-stack invariant at `:98-107`
  and `:109` unchanged.
- Quick connect's branch/SHA matches
  `ssh beast-01-ts 'cd ~/beast/RobotOverview && git branch --show-current && git rev-parse --short HEAD'`
  on the day the PR merges, and carries that command inline for the next reader.
- CI green: `beast-ros-spine` (including the new allowlist test) and the web suite.
- Live, after deploy and the §2.6 prune, with the workspace overlay sourced:
  `ros2 pkg list | grep -E 'vizanti|ugv_web_app'` is empty; `ros2 node list` shows
  `/beast_base`, `/beast_power`, `/cockpit_status`, `/twist_mux`, `/odom_publisher`,
  `/ekf_filter_node`, `/rosbridge_websocket`, `/LDLiDAR_LD19` and no vizanti/web-app node;
  `ros2 pkg executables ugv_tools` lists all three.
- The four insights are in Datacore and render at `/datacore`.
- `docs/plans/README.md` matches the surviving plan set.
- This file is deleted.

## 7. Rollback

Nothing here is destructive to running behavior: the build-script change is additive, no
package is deleted, and every doc edit describes what the tree already does. Rollback is
`git revert` of the PR plus a `deploy-to-beast.sh` re-run. §2.6's robot-side prune removes
only stale build artifacts of packages that are already `COLCON_IGNORE`'d; it is regenerable
by un-parking and rebuilding, and nothing we run depends on it. Re-enabling any parked
package remains one file deletion plus two allowlist entries (§2.3 lists the exact steps),
which is the property the park exists to preserve.
