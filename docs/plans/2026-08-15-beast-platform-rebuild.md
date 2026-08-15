# BEAST-01 platform rebuild — make the repo the authority

**Status:** PROPOSED — 2026-08-15. Owner-requested after a session that spent its whole
budget patching symptoms. This plan is the design pass that the 2026-07-11 Pi→Orin port
implied and nobody has done. It reframes, but does not delete, the 2026-08-07 strip-down
and the 2026-08-14 vendored-surface plans: those correctly catalogue drift; this one names
why drift keeps being generated.

## The one-sentence diagnosis

**The repository is not the authority on the robot, and no mechanism tells you when it is
wrong.** Everything painful is an instance of that. It is not a code-volume problem — every
line-count we measured this session (2,467 ours; ~8,300 glue; ~28,000 inert vendor) failed to
explain the pain, because the pain is structural, not dimensional.

Three properties, each independently sufficient to cause a bad week:

1. **Nothing in the repo declares what runs.** `beast-install-systemd-units` copies all 17
   unit files and never runs `systemctl enable`. Which 9 of 17 start at boot exists **only**
   as symlinks in `*.target.wants/` on one NVMe, created by hand across 35 days, recorded
   nowhere. Restore every file from git onto a fresh disk and the robot boots running nothing,
   with no document saying what should be on.
2. **Nothing in the repo declares what the machine is.** 17 facts live only on that disk —
   including a one-line udev rule (`03e7`, `MODE 0666`) without which the OAK-D will not open,
   five group memberships, ~28 hand-installed `ros-humble-*` packages, four third-party apt
   sources, and `pip install --user smbus2`, on which the entire power path depends.
3. **Mechanisms report success when they fail.** See the evidence tier below. This is the one
   that makes debugging cost 10× — you never get to investigate one layer, because no layer's
   green light is admissible.

## Evidence tier — what is observed vs. what is read

Stated explicitly because an earlier draft of this argument blurred the two and inflated the
count by one. (`beast-ctl`'s `mask` verb failed **loudly** — a fictional capability, not a
silent failure. It does not belong on this list.)

**Observed firing, 2026-08-11 → 2026-08-15 (7):**

| What | Evidence |
| --- | --- |
| `refs/deploy/beast-01` sat 4 commits stale; the pin workflow ran **green** | GitHub API; ref at `69e411d` while `main` was at `d97a3c8` |
| `beast-slam-save` printed "not running, nothing to save" and **exited 0**, twice, with pid 5392 up | two consecutive contradictory invocations; `ins-beast-slam-save-discovery-race` |
| slam_toolbox alive, `/map` publishing at 0.2 Hz, map frozen at 237×54 | `use_sim_time:=true` leak from `online_async_launch.py` |
| `map→odom` bit-identical for 3 minutes while wheel odometry accumulated ~1.0 m | TF samples; destroyed the map, wedged the costmap at cost 99 under the robot |
| Robot still turning **0.335 rad/s ten seconds** after the command ended | `odom→base_link` yaw samples; `ins-beast-latching-runaway-measured` |
| Three scripts in `/usr/local/sbin` older than the repo, fixes merged, deploy reported success | md5 diff vs `deploy/bin`; `ins-beast-runs-stale-binaries` |
| 17 units byte-identical to git; enablement exists only as symlinks | `systemctl` vs repo comparison |

**Read in code, not observed firing (2):** `ros2 launch` returns 0 on child node death
(`return_code` set only on exception paths; ros2/launch#666 open, PR #712 unmerged); the verify's
gate restore re-arms on any `gate_before` that is not the literal string `false`, including the
empty string returned when the 8-second read times out.

**Recorded by a prior session (1):** `deploy-to-beast.sh` built new code, aborted before
restarting, and left `git rev-parse HEAD` reading correct.

## How it got here — the port, not a drift

Traced through git, not assumed:

| Date | Event |
| --- | --- |
| 2025-11-25 → 2026-07-10 | Waveshare `ugv_ws` (`037dfca`, DUDULRX). **Zero `deploy/`, zero systemd files** — verified against the tree |
| **2026-07-11** | First Coldaine commits. Titles: *Adapt Beast bringup for **Jetson** safety*, *Support **JetPack** OpenCV*, *Fix **Humble** rf2o metadata* — and `3777a09` **"Add disabled Jetson base service"** |
| 2026-07-12 | Storage foundation (#2–#5) |
| 2026-08-03 | `1e8a167` subtree-merges the fork into RobotOverview |
| 2026-08-07 | `7e86feb` *"strip automatic safety apparatus + cmd_vel watchdog"* |
| 2026-08-10 | Cockpit outage → **8 deploy files in one day** |
| 2026-08-14 | Autonomy on-ramp → **13 deploy files in one day** |

122 commits total (70 pre-import, 52 post). Of the 52 touching `robot/`, **33 touch `deploy/`** —
a directory the vendor never shipped and which contains none of the robot's behaviour.

Day one was a **hardware port**: Raspberry Pi → Jetson Orin Nano Super 8GB (JetPack 6.2.2 /
R36.5). Waveshare's SD image and their `/home/ws/ugv_ws` container path both stopped applying,
which silently transferred three responsibilities to us:

- **the environment** — the image used to carry it → now 17 undeclared facts
- **the supervision** — a human at a terminal used to be it → now 1,870 lines of bash
- **the deploy** — the image *was* the deploy → now `beast-pull`, 647 lines

The port was correct; you want the compute. What never happened is the sentence that should
have followed it: *"and therefore we now need a provisioning story, a supervision story, and a
deploy story."* Each got improvised instead, on the day it first drew blood. Read the script
headers in birth order and the pattern is explicit — *"Installed 2026-08-10 after the cockpit
outage"*, *"after Wi-Fi dark period"*, *"added AFTER a posegraph explosion destroyed the only
good map"*. Nobody wrote a deploy system. Thirteen times, something failed quietly and someone
wrote a script so that one thing would not fail quietly again.

Each script is one of the vanished operator's jobs: `beast-verify` = *is it up?*;
`beast-mission` = *stop*; `beast-deploy-guard` = *don't start, it's mid-build*; `beast-pull` =
*get the new code*; `beast-link-watch` = *wifi died*; `beast-slam-save` = *save the map first*;
`beast-ctl` = *you may do that*. **1,870 lines of bash is the price of the missing human.**

## Done condition

All five, and none of them is a line count:

1. A fresh Orin, flashed and given this repo, reaches a verified-running BEAST-01 with **no
   undocumented step** — no tribal knowledge, no "and then you also have to…".
2. `git` states which units are enabled; changing that set is a reviewed diff, not an SSH session.
3. `provision.sh --check` fails loudly when the machine diverges from the repo, and runs in
   `beast-verify`.
4. A ROS node dying makes its systemd unit fail. `systemctl is-active` is admissible evidence.
5. The workspace is built from a pinned manifest of upstream packages plus a named, justified
   list of what is genuinely ours.

## Phases

Ordered so that **everything that only records** precedes **everything that changes**. The
recording phases are zero-risk, and they are the safety net for the rest. They are also urgent
in a way the others are not: that knowledge is one dead NVMe away from being gone, and it decays
out of context fast.

### P0 — Capture, change nothing *(zero risk; do first)*

Inputs: live robot over `ssh beast-01-ts`.

- Dump the enablement set: every unit, `is-enabled` + `is-active`, to a file in the repo.
- Dump the machine facts already inventoried (17 items) into a draft `provision.sh` that is
  **not yet run** — the file is a record first, an installer second.
- Emit: `robot/beast/provision/state-2026-08-15.md` — the observed truth, dated.

Done when: a reader can reconstruct which services run and what the machine has, from git alone.

### P1 — The repo declares enablement

- `beast-install-systemd-units` gains an enable/disable pass driven by a list **in the repo**.
- The list is explicit about the never-enable contract (`beast-nav` ships with no `[Install]`
  section and stays hand-started; that is a decision, and it should read as one).
- Test in `tools/ci`: the declared set matches the unit files present.

Done when: `systemctl enable` is never again typed by a human, and "born disabled" cannot recur.

### P2 — The repo declares the machine

- `provision.sh`, idempotent, plus `--check`. No Ansible, no Nix, no new dependency — the bug is
  *undeclared*, not *not-declared-in-a-framework*, and one robot does not justify a config
  management system.
- Wire `--check` into `beast-verify` so divergence is a verify failure, not a discovery.

Done when: the udev rule, the groups, the apt set, `smbus2`, and linger are all in git and checked.

### P3 — Workspace from a manifest, not a fork

The big deletion, and the one the owner has been asking for since *"what packages from ROS 2 are
we shipping?"*

- Replace the 51,361-line vendored tree with a `.repos` manifest naming upstream packages at
  pinned versions. Our entire net delta from the fork point is ~913 lines, most of it the
  `/cmd_vel` → `/cmd_vel_nav` retarget, which becomes a remap.
- `ugv_nav` (1,550 SLOC of launch files copied verbatim from `nav2_bringup`, Intel copyright
  headers intact, 92-line delta) becomes `nav2_bringup` + our params.
- **Carry forward exactly four things**, each with a written reason:
  1. `beast_power` — genuinely ours; INA219, load-compensated SoC, properly tested
  2. the `twist_mux` arbitration ladder
  3. the nav2 params (`rpp.yaml`, RotationShim, velocity smoother caps) — *tuned knowledge*
  4. the ESP32 T-code protocol table

Done when: the stack comes up from upstream packages plus those four, and the drive path is
unchanged.

### P4 — Supervision on nodes, not launch files

`ExecStart=/bin/bash -lc 'source … && exec ros2 launch …'` puts systemd three levels above
anything real, watching a wrapper that returns 0 when its children die. Replace with direct node
invocation per service, one at a time, starting with `beast-slam` (the change is already drafted
on `claude/beast-slam-direct-node`).

Done when: killing a node fails its unit. Several of the seven observed silent failures die here.

### P5 — `ros2_control` for the drive path

The right destination — `diff_drive_controller` supplies the `cmd_vel` timeout that
`beast-mission` currently fakes in 155 lines of trap handler, plus real joint states and odometry.
**Sequenced last on purpose:** it is the only phase that writes genuinely new code
(a `hardware_interface` plugin speaking Waveshare's JSON protocol — parse inbound `T:1001` at
20 Hz, emit `T:13` on write) against firmware we do not own. Its failure mode is "the robot does
not move," or worse, "moves wrong."

Do not start P5 until P0–P4 are done and the robot is verifiably healthy on a known-good base.

## Watch out for

Traps that will bite a rebuild specifically, each verified this session:

1. **`cartographer` is not Google Cartographer.** It is a 31-line Waveshare package that
   name-shadows it, built only because `ugv_nav/localization_launch.py` calls
   `get_package_share_directory('cartographer')` **unconditionally**. Park or delete it and AMCL
   breaks. Fix the call before touching the package.
2. **`beast_base` is missing from both build allowlists** (`build_common.sh`, `build_first.sh`).
   Already flagged as a live hazard in the vendored-surface plan. A clean rebuild from those
   scripts yields a workspace where `beast-ros-base.service` fails and the startup stop never
   fires — on a robot whose ESP32 latches velocity. Those scripts also hardcode
   `WS=/home/ws/ugv_ws`, a container path the robot has never used.
3. **Four dependencies work only by accident.** `ugv_bringup` launches `robot_localization`,
   `ugv_tools` launches `joy`, `ugv_slam` launches `slam_toolbox`/`cartographer_ros`/`rtabmap` —
   none declared in `package.xml`. A manifest-based rebuild is exactly what exposes these.
4. **Tuned params look like config but are knowledge.** `rpp.yaml`'s RotationShim wrapping
   RegulatedPurePursuit, `allow_reversing: false`, and the effective speed cap living in the
   velocity smoother (`[0.26, 0.0, 1.0]`) rather than RPP's `desired_linear_vel` — that shape is
   deliberate for a robot with a 104° blind wedge astern. Regenerating defaults silently loses it.
5. **`use_sim_time` defaults to `true`** in `online_async_launch.py` and is applied **after** the
   params file, overriding it. Any path that keeps a launch file re-imports this bug.
6. **The install path cannot install.** `deploy-to-beast.sh`'s `install_bin_if_needed` falls
   through to a break-glass password no unattended path can supply, prints
   `WARN cannot passwordless-install`, and **continues successfully**. Three scripts are stale on
   the robot right now because of it. Anything new placed in `/usr/local/sbin` inherits this.
7. **`beast-ctl` must stay root-owned in `/usr/local/sbin`.** `/home/beast` is writable by
   `beast`, so allowlisting a path under it in sudoers is a trivial root escalation. It must never
   be executed from the repo checkout.
8. **Never command motion from a foreground SSH process.** No `cmd_vel` watchdog exists
   (owner decision D8, 2026-08-07). Any test procedure must send explicit zeros; ceasing to publish
   is not stopping. Measured: 0.335 rad/s ten seconds after the command ended.
9. **In-place rotation corrupts the map.** Do not use "slow spin to build coverage" as a mapping
   prerequisite — it froze `map→odom` for three minutes and wedged the costmap. Prefer translating
   survey motion, and verify both that the map grew *and* that `map→odom` is moving.
10. **The verify's gate restore is fail-open** and runs on an hourly timer.
11. **`beast-mission`'s EXIT trap fires at body exit**, so a mission body that post-processes
    after driving keeps driving through it. Zero immediately after the drive segment, not at exit.

## Anti-goals

- **No big-bang rewrite.** Nav2 autonomously drove 1.9 m and stopped 0.096 m from goal on
  2026-08-15. Every phase must leave a robot that drives.
- **No vanity deletion.** The ~28,000 SLOC of never-launched vendor packages (`openslam_gmapping`,
  `teb_local_planner`, `costmap_converter`, `ugv_voice`, …) are **inert**. `beast-pull` rebuilds
  only the four always-packages plus what changed, so they are not even a recurring build cost.
  Removing them is cosmetic and fixes nothing. They may fall out of P3 for free; they are not a
  goal.
- **No config-management framework** for one robot.
- **Do not delete `beast-pull`.** 647 lines, but it works and it is tested. Revisit only after P4.
- **No script #17.** If the answer to a phase is "write another supervisor," the phase is wrong.

## Verification

- P0: a second reader reconstructs the running set from git alone, then diffs against the live
  robot and finds nothing.
- P1/P2: `tools/ci` tests; `provision.sh --check` green on the live robot; deliberately break one
  fact and confirm it fails.
- P3: full stack up from the manifest; `beast-verify` 15/15.
- P4: `kill -9` a node, confirm its unit enters `failed`. This is the phase's whole point.
- P5: bench-first on blocks, then the T2/T3 goal ladder, with explicit-zero stops throughout.

## Related

Supersedes nothing outright. Reframes the 2026-08-07 strip-down and the 2026-08-14
vendored-surface plan: both catalogue drift correctly, and P3 removes the surface that generates
it. The autonomy on-ramp's Phase 0 (`beast-slam.service` repair) is folded into P4.
