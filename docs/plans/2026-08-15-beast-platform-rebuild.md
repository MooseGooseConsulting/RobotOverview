# BEAST-01 platform rebuild — tear it down, keep a short list, build it back

**Status:** PROPOSED — 2026-08-15. Owner-directed. This is a **clean-room rebuild**, not a
migration. The new tree starts empty; the default for every file, package and script is *does
not exist*, and anything that survives must be named on the preserve list with a written reason.

It reframes but does not delete the 2026-08-07 strip-down and the 2026-08-14 vendored-surface
plans: those correctly catalogue drift. This one removes the surface that generates it.

## Why a rebuild and not a migration

The first draft of this plan was six migration phases. It was wrong, and the reason is worth
stating because it is the same reason the robot is in this state:

**Subtraction from a bad shape cannot reach a good shape.** Every migration phase has to reason
about the existing system — carry it, guard it, cut over from it — so the old structure
constrains every step. That is exactly how the 1,870 lines of shell were built: thirteen
locally-correct steps, each a reasonable response to the previous one's failure. More
locally-correct steps, even subtractive ones, do not leave a local optimum.

The concrete tell: that draft wrote `provision.sh` by recording the current robot and then
validated it with `--check` **against that same robot**. It would have passed trivially — that
machine has everything, including every undeclared accident — and enshrined them as declarations.

A clean-room rebuild inverts the default. Nothing is carried by inertia. Every file has to be
typed on purpose, and anything we forget shows up as a failure during bring-up rather than as a
silent dependency that works until the day it doesn't.

**Risk profile is not worse than the migration.** The new tree is built offline, alongside, while
the robot keeps running the old stack. Nothing is deleted until the replacement has run on
hardware. The difference is only that the end state is designed rather than eroded.

## The one-sentence diagnosis

**The repository is not the authority on the robot, and no mechanism tells you when it is
wrong.** It is not a code-volume problem — every line count measured this session (2,467 ours;
~8,300 glue; ~28,000 inert vendor) failed to explain the pain, because the pain is structural.

1. **Nothing in the repo declares what runs.** `beast-install-systemd-units` copies all 17 unit
   files and never runs `systemctl enable`. Which 9 of 17 start at boot exists **only** as
   symlinks in `*.target.wants/` on one NVMe, created by hand across 35 days.
2. **Nothing in the repo declares what the machine is.** 17 facts live only on that disk —
   including a one-line udev rule (`03e7`, `MODE 0666`) without which the OAK-D will not open,
   five group memberships, ~28 hand-installed `ros-humble-*` packages, four third-party apt
   sources, and `pip install --user smbus2`, on which the whole power path depends.
3. **Mechanisms report success when they fail.** Seven observed this week. This is the one that
   makes debugging cost 10× — no layer's green light is admissible, so every investigation
   restarts from "is any of this even true?"

## Evidence tier — observed vs. read

Stated explicitly because an earlier draft blurred them and inflated the count by one.
(`beast-ctl`'s `mask` verb failed **loudly** — a fictional capability, not a silent failure. It
does not belong on this list.)

**Observed firing, 2026-08-11 → 2026-08-15 (7):**

| What | Evidence |
| --- | --- |
| `refs/deploy/beast-01` sat 4 commits stale; the pin workflow ran **green** | ref at `69e411d` while `main` was `d97a3c8` |
| `beast-slam-save` printed "not running, nothing to save" and **exited 0**, twice, with pid 5392 up | two consecutive contradictory invocations |
| slam_toolbox alive, `/map` publishing at 0.2 Hz, map frozen at 237×54 | `use_sim_time:=true` leak from `online_async_launch.py` |
| `map→odom` bit-identical for 3 minutes while wheel odometry accumulated ~1.0 m | destroyed the map; costmap wedged at cost 99 under the robot |
| Robot still turning **0.335 rad/s ten seconds** after the command ended | `odom→base_link` yaw samples |
| Three scripts in `/usr/local/sbin` older than the repo, fixes merged, deploy reported success | md5 diff vs `deploy/bin` |
| 17 units byte-identical to git; enablement exists only as symlinks | `systemctl` vs repo |

**Read in code, not observed (2):** `ros2 launch` returns 0 on child node death (`return_code`
set only on exception paths; ros2/launch#666 open, PR #712 unmerged); the verify's gate restore
re-arms on any `gate_before` that is not literally `false`, including the empty string a timed-out
read returns.

**Recorded by a prior session (1):** `deploy-to-beast.sh` built new code, aborted before
restarting, and left `git rev-parse HEAD` reading correct.

## How it got here — a port, not a drift

| Date | Event |
| --- | --- |
| 2025-11-25 → 2026-07-10 | Waveshare `ugv_ws` (`037dfca`, DUDULRX). **Zero `deploy/`, zero systemd files** — verified against the tree |
| **2026-07-11** | First Coldaine commits: *Adapt Beast bringup for **Jetson** safety*, *Support **JetPack** OpenCV* — and `3777a09` **"Add disabled Jetson base service"** |
| 2026-08-03 | `1e8a167` subtree-merges the fork into RobotOverview |
| 2026-08-07 | `7e86feb` *"strip automatic safety apparatus + cmd_vel watchdog"* |
| 2026-08-10 | Cockpit outage → **8 deploy files in one day** |
| 2026-08-14 | Autonomy on-ramp → **13 deploy files in one day** |

122 commits (70 pre-import, 52 post). Of the 52 touching `robot/`, **33 touch `deploy/`** — a
directory the vendor never shipped, containing none of the robot's behaviour.

Day one was a **hardware port**: Raspberry Pi → Jetson Orin Nano Super 8GB (JetPack 6.2.2 /
R36.5). Waveshare's SD image and their `/home/ws/ugv_ws` container path both stopped applying,
silently transferring three responsibilities to us — **the environment**, **the supervision**,
and **the deploy**. The port was correct; you want the compute. The sentence that should have
followed it never got said, so each responsibility was improvised on the day it first drew blood.
Read the script headers in birth order and they admit it: *"Installed 2026-08-10 after the
cockpit outage"*, *"after Wi-Fi dark period"*, *"added AFTER a posegraph explosion destroyed the
only good map"*.

Each script is one of the vanished operator's jobs. **1,870 lines of bash is the price of the
missing human.**

## The preserve list

**This is the whole plan.** Everything in `robot/beast/ros2_ws` — 51,361 lines, 32 packages, 13
scripts, 17 units — is deleted at Phase D unless it appears below. Survival requires a reason,
and "it currently works" is not one.

### Code that survives (1 package)

| Item | Lines | Why it survives |
| --- | ---: | --- |
| `beast_power` | 1,168 | Genuinely ours and genuinely differentiated: INA219 on `i2c-7`, load-compensated SoC (`OCV = V + |I|·0.14Ω`), durable CSV logging with interrupted-tail repair, datasheet-vector tests. No upstream package does this for this hardware. |

That is the list. One package, 1,168 lines, out of 51,361.

**`ugv_cockpit` (800) needs an owner decision, not a default.** It is the Hangar bridge, and the
Hangar app is a separately deployed surface. Either it moves to the app side or it is rebuilt as
a thin `rosbridge` config. It should not survive by inertia into a robot workspace.

### Knowledge that survives (extracted to artifacts, not code)

Expensive to re-derive, invisible in a diff, and the actual reason a rebuild is safe:

1. **Nav2 tuning rationale** — RotationShim wrapping RegulatedPurePursuit, `allow_reversing:
   false`, `use_rotate_to_heading: true`, effective speed cap living in the velocity smoother
   (`[0.26, 0.0, 1.0]`) not RPP's `desired_linear_vel`. That shape is deliberate for a robot with
   a 104° blind wedge astern. Regenerating defaults silently loses it.
2. **ESP32 T-code protocol** — `T:13` drive, `T:131` startup enable (unverified), `T:132` LED,
   `T:133` pan-tilt, `T:137`, `T:3` OLED, `T:900` model, inbound `T:1001` at 20 Hz. The input to
   the `ros2_control` hardware interface.
3. **twist_mux ladder** — `cmd_vel_joy_robot` 150 > `cmd_vel_joy_operator` 100 > `cmd_vel_ui` 50
   > `cmd_vel_nav` 10; `locks.estop` at 255 with `timeout: 0.0`. Including the property that
   expiry only *removes* a source — it never emits a zero.
4. **Hardware paths** — ESP32 at `/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00`
   (**not** `/dev/ttyTHS1`, which docs claimed for weeks), LiDAR by-id, INA219 on `i2c-7`, udev
   `03e7` for the OAK-D, groups `dialout i2c video render docker`.
5. **Pack limits** — 8.332 V measured hard trip, ~9.6 V operational floor, 0.14 Ω internal
   resistance, charger 12.6 V / 2 A. Never re-derive these; an invented 9.9 V floor already
   aborted a live test with ~12 minutes of reserve left.
6. **The traps** — the "Watch out for" section below, carried forward verbatim.

Deliverable: these land as a Hangar briefing (knowledge belongs in the DB, per AGENTS.md), and
the params files in the new tree carry (1) and (3) with the rationale in comments.

### Everything else is deleted

Named so nobody has to guess: all 13 `deploy/bin` scripts, all 17 systemd units, the entire
vendored fork including `ugv_nav` (1,550 lines of `nav2_bringup` launch files copied verbatim
with Intel copyright headers intact, 92-line delta), `beast_base` (whose `base_ctrl.py` is
byte-identical upstream and whose job becomes the `ros2_control` hardware interface),
`ugv_bringup`, `ugv_slam`, `ugv_tools`, `ugv_vision`, `cartographer`, and the ~28,000 lines of
never-launched vendor packages.

## Done condition

1. A fresh Orin, flashed and given this repo, reaches a verified-running BEAST-01 with **no
   undocumented step**.
2. `git` states which units are enabled; changing that set is a reviewed diff, not an SSH session.
3. A ROS node dying makes its systemd unit fail. `systemctl is-active` is admissible evidence.
4. The workspace builds from a pinned upstream manifest plus `beast_power`.
5. `robot/beast/ros2_ws` is **deleted** — not parked, not ignored, deleted.
6. `deploy/bin` no longer exists as a concept: no supervisor scripts, no verify script, no
   privilege wrapper. If any survives, it carries a written reason a standard mechanism could
   not do its job.

## Phases

### A — Extract the preserve list *(offline + robot reads; nothing changes)*

Produce the preserve list above as real artifacts: the knowledge briefing landed in Hangar, and
a short repo document naming exactly what Phase B may copy. **Nothing may be copied into the new
tree that is not named here.** This is the only gate between the old tree and the new one.

Done when: a reader who has never seen the old tree can build the new one from this list.

### B — Build the new tree, clean, offline

New workspace root. Empty. Every file typed on purpose:

- `beast.repos` — pinned upstream manifest (slam_toolbox, nav2, ldlidar, rf2o,
  robot_localization, depthai, twist_mux, joy, teleop_twist_joy). Several already come from apt.
- `beast_power` — the one carried package.
- `beast_hardware` — **new code**: a `ros2_control` `SystemInterface` speaking the T-code
  protocol (parse inbound `T:1001` at 20 Hz → joint states; emit `T:13` on write). This is the
  riskiest item in the plan; see below.
- `params/` — nav2, twist_mux, slam_toolbox, carrying the preserved tuning with rationale in
  comments. `use_sim_time` explicitly `false`, in the params file, not a launch argument.
- `systemd/` — units written fresh: direct node `ExecStart`, no `bash -lc`, no `ros2 launch`
  wrapper, no `source` chain. Enablement declared in the repo.
- `provision.sh` — written **from the preserve list**, not from the robot. `--check` mode.

No robot required for any of this.

**Fallback on the risky item:** if `beast_hardware` is not ready when the rest is, carry
`beast_base` as an explicitly temporary shim, tracked as a debt item with a written expiry — not
absorbed silently into the preserve list.

### C — Prove it, twice, because one test cannot prove both things

**C1 — functional.** Bring the new tree up on the current robot at a different workspace path,
with differently-named units, nothing enabled. Proves the stack works. **Cannot prove the
declaration is complete** — that machine already has everything, including every undeclared
accident.

**C2 — declaration completeness.** Run `provision.sh` somewhere that does *not* already have
everything: a container on the Jetson from the JetPack base image, or a fresh flash. Every
missing apt package, pip install and env assumption surfaces here, loudly. Note the limit
honestly: a container will **not** catch udev rules or group memberships, so those need a fresh
flash or explicit inspection.

Done when: C1 drives, and C2 comes up from nothing.

### D — Cut over, then delete in one commit

Switch the robot to the new tree. Then delete `robot/beast/ros2_ws` entirely — 51,361 lines, 13
scripts, 17 units — in a single commit. **Deleted, not migrated, not parked.** Git history is the
archive; that is what `docs/plans/README.md` already says about plans and it applies here.

### E — Close out

Delete this plan (executed plans are deleted, not archived). Update `docs/beast-ops.md` Quick
connect, `docs/deploy.md`, and `README.md`. Retire the strip-down and vendored-surface plans,
whose subject no longer exists.

## Watch out for

Verified this session. Carried into Phase A as preserved knowledge.

1. **`cartographer` is not Google Cartographer.** A 31-line Waveshare package that name-shadows
   it, alive only because `ugv_nav/localization_launch.py` calls
   `get_package_share_directory('cartographer')` **unconditionally**. Irrelevant after D, but it
   will bite anyone who touches the old tree first.
2. **Four dependencies work only by accident** — `ugv_bringup`→`robot_localization`,
   `ugv_tools`→`joy`, `ugv_slam`→`slam_toolbox`/`cartographer_ros`/`rtabmap`, none declared in
   `package.xml`. C2 is designed to surface exactly this class.
3. **Tuned params look like config but are knowledge.** See preserve item (1). The single most
   losable thing in the rebuild.
4. **`use_sim_time` defaults to `true`** in `online_async_launch.py` and is applied *after* the
   params file, overriding it. It froze the map for a full session. Any design that keeps a launch
   file re-imports this.
5. **`ros2 launch` returns 0 on child node death.** The root cause of the supervision gap; the
   reason B uses direct nodes.
6. **No `cmd_vel` watchdog exists** (D8, 2026-08-07). Never command motion from a foreground SSH
   process. Any test must send explicit zeros — ceasing to publish is not stopping. Measured:
   0.335 rad/s ten seconds after the command ended.
7. **In-place rotation corrupts the map.** Do not use "slow spin for coverage" as a mapping
   prerequisite; it froze `map→odom` for three minutes and wedged the costmap. Prefer translating
   survey motion and verify `map→odom` is actually moving.
8. **Wheel travel is ~55–60% of commanded** — open-loop rotation angle is untrustworthy
   independently of (7). Relevant to calibrating `diff_drive_controller`.
9. **`beast-ctl` must stay root-owned in `/usr/local/sbin`** for as long as it exists.
   `/home/beast` is writable by `beast`, so allowlisting a path under it is a trivial root
   escalation. It must never be executed from the repo checkout.
10. **The install path cannot install.** `deploy-to-beast.sh`'s `install_bin_if_needed` falls
    through to a break-glass password no unattended path can supply, prints
    `WARN cannot passwordless-install`, and **continues successfully**. Three scripts are stale on
    the robot right now because of it.
11. **The robot has no RTC battery** (Orin Nano carrier leaves J3 unpopulated). It cold-boots at
    epoch 0 until NTP wins — ~100 s of 1969 timestamps at the 2026-08-14 boot, which killed
    `beast-cockpit-serve` outright. Unit ordering in B must account for it; `wl-ds3231-rtc` is the
    recorded hardware fix.

## Anti-goals

These constrain *how* the rebuild happens. None is a reason to preserve more.

- **Nothing is deleted before its replacement runs on hardware.** The robot drove autonomously on
  2026-08-15 and must keep driving. This bounds sequence, not scope — Phase D deletes everything
  regardless of how comfortable the old tree feels by then.
- **Do not count inert code as progress.** The ~28,000 SLOC of never-launched vendor packages
  cost nothing — `beast-pull` does not even rebuild them. They vanish with the tree at D. That is
  a side effect, never an achievement, and must not be reported as one.
- **No config-management framework** for one robot. The bug is *undeclared*, not
  *not-declared-in-Ansible*.
- **No script #17.** If the answer to any phase is "write another supervisor," the phase is
  wrong. The new tree ends with fewer moving parts than the old one, or it has failed.
- **The preserve list does not grow during execution.** Additions require the same written
  justification as the original entries, recorded in the plan. "We found we still needed it" is
  the exact mechanism that built the current system.
