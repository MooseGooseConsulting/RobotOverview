# Deploying to BEAST-01

## Canonical deploy — source-mode pull agent (this repo)

**Everything lives HERE.** BEAST-01 deploys from source, with zero
credentials on the robot, because this repo is public:

1. A merge to `main` touching `robot/beast/ros2_ws/**` runs the test gate;
   `.github/workflows/deploy-pin.yml`'s `deploy-ref` job then force-updates
   **`refs/deploy/beast-01`** to the gated commit. The robot never tracks
   `main` directly — that would deploy red commits to a machine that moves.
2. On the robot, `bin/beast-pull` (hourly via `systemd/beast-pull.timer`)
   fetches that ref, skips if the robot is in motion (`/cmd_vel` **and**
   measured `/odom_wheel`) or a mission recording is active, stops the
   stack, checks out detached, rebuilds only the changed packages (union of
   the four base packages), reinstalls unit files if they changed, restarts,
   and runs `bin/beast-verify`. A failed verify rolls back to the previous
   sha and re-verifies; a failed rollback sets a self-hold and stops trying.
3. `bin/beast-verify` is the single landed contract for "is it deployed" —
   the same file is piped over ssh by `deploy-to-beast.sh --verify-only`, so
   the manual and unattended paths cannot drift.

Rollback for the fleet is one command:
`git push --force origin <previous-sha>:refs/deploy/beast-01`.

Kill switches: `/etc/beast/pull-hold` (operator, root-owned) and
`/data/beast/deploy/pull-hold` (self-hold after a failed rollback). While
`/data/beast/deploy/in-progress` exists, `bin/beast-deploy-guard` keeps
`beast-ros-base` from booting into a mid-rebuild workspace; the next pull
tick rebuilds and recovers.

**Rollout state:** the units ship in this tree but the timer stays
**masked** until the supervised rollout (install → watched first swap →
forced-rollback proof → parked-gate proof) has passed. The container image
(`beast-ros-image.yml`) still builds and the homelab manifest still pins it,
but both are provenance only — the robot reads neither.

## Orphaned build/install trees — `bin/beast-prune`

colcon has no prune. `beast-pull` only ever rebuilds the packages it
selects — a package deleted, renamed, or parked with `COLCON_IGNORE` keeps
its `build/<name>` and `install/<name>` directories forever, and because
`install/` is a `--symlink-install` tree, `install/setup.bash` keeps
sourcing them: an orphaned package stays discoverable and launchable long
after `colcon list` in the checkout stops naming it. The 2026-08-14 SLAM
survey found this live — `vizanti`, `emcl2`, `explore_lite`, and
`ugv_web_app` (every currently parked package) still had directories under
`install/`.

`bin/beast-prune` reports, and on request removes, those orphans by
comparing `build/`/`install/` package directories against `colcon list
--names-only` in the current checkout:

```bash
beast-prune                  # report-only (default) — never deletes anything
beast-prune --check          # report-only; exit 1 if any orphan is found
beast-prune --prune          # remove orphans; prompts for confirmation on a tty
beast-prune --prune --yes    # remove orphans without prompting
```

**Deliberately not part of the unattended timer path.** PR #224's review
declined to prune from `beast-pull` itself: "doing it with `rm -rf` from an
unattended agent is a bigger hazard than the stale artefacts." `beast-prune`
is a separate, hand-run tool — `beast-pull`, its service, and its timer
never invoke it (`tools/ci/test_beast_prune.py` asserts this). Run it in
report-only mode first; only pass `--prune` once you have read the report,
and only with `--yes` once you are certain — it refuses to prompt without a
real terminal, so it can never be accidentally scripted into deleting.

## Manual override — `deploy-to-beast.sh` (recovery)

This directory also holds `deploy-to-beast.sh`: the **manual override**
(SSH → git ff → colcon on the Jetson → restart host systemd). Use it when
the pull agent is held, masked, or broken, or when you need a forced deploy
without waiting for the hourly tick.

From any clone of this repo (Windows Git Bash, Linux, macOS):

```bash
robot/beast/ros2_ws/deploy/deploy-to-beast.sh            # deploy origin/main
robot/beast/ros2_ws/deploy/deploy-to-beast.sh --verify-only   # drift check, read-only
```

## Operator shortcuts (cockpit + gamepad)

| Shortcut | Where | What |
|---|---|---|
| `tools/beast/Open-Beast-Cockpit.url` / `.ps1` | Workstation | Opens [https://hangar.moosegoose.xyz/cockpit](https://hangar.moosegoose.xyz/cockpit) |
| `deploy/bin/beast-gamepad` | Robot (`/usr/local/bin` after install) | Launches USB gamepad teleop |
| `deploy/desktop/beast-gamepad.desktop` | Robot `~/Desktop` after install | Double-click gamepad teleop |

Install on the robot (Tailscale or LAN):

```bash
BEAST_HOST=beast-01-ts robot/beast/ros2_ws/deploy/bin/install-operator-shortcuts.sh
```

Gamepad is **not** part of `beast-ros-base` boot — plug the pad, then run the
shortcut. Cockpit needs `beast-cockpit.service` active (it is on the live
robot as of 2026-08-10).

### Host selection

Default `BEAST_HOST` is `beast-01` (LAN / mDNS). Override when needed:

```bash
BEAST_HOST=beast-01-ts robot/beast/ros2_ws/deploy/deploy-to-beast.sh   # Tailscale
BEAST_HOST=beast@192.168.0.187 robot/beast/ros2_ws/deploy/deploy-to-beast.sh # direct Wi-Fi IP
```

`deploy-to-beast.sh` drives `$BEAST_HOST` through four steps: fast-forward the
on-robot checkout (refuses a dirty tree), `colcon build --symlink-install` the
base service packages (`beast_power beast_base ugv_bringup ugv_cockpit`,
override with `--packages`), install `deploy/storage/` payloads and
`deploy/systemd/` service/timer units + `daemon-reload`, restart
`beast-ros-base`, and `try-restart beast-cockpit` without activating an
intentionally disabled cockpit, then verify the live graph and exit non-zero
on any broken contract.

The verification contract is what "landed" means for the host systemd path:

- `beast-ros-base` active; `beast-cockpit` active unless intentionally disabled
- `beast_power` running and the **sole** publisher of `/ugv/voltage`
- `/ugv/charging_active` has a publisher
- `ugv_safety_monitor` absent (stripped 2026-08-07)
- INA219 config register no longer the `0x399F` factory value
- **drive path live**: a non-zero twist on `/cmd_vel_ui` while disarmed reaches
  `beast_base`'s callback (rejection logged) — node presence is not proof of
  this. 2026-08-07: a deploy restart wedged Fast DDS SHM between `twist_mux`
  and `beast_base` while every node check passed; the robot could not be
  driven until the next clean restart. The probe is motion-free (disarm →
  rejected burst → restores the prior gate state). If it FAILs on a freshly
  restarted stack, restart `beast-ros-base` once more and re-verify.

All ros2 CLI calls in the verify run under a UDP-only Fast DDS profile
(written to `/tmp/beast_verify_fastdds_udp.xml` on the robot) — the default
SHM transport proved unreliable for late-joining CLI participants on this
host and produced false FAILs.

Run `--verify-only` freely — no sudo, read-only, and it prints PASS/FAIL per
check. Run it *before* assuming any doc claim about the robot is current.

## House rules

- **After pull cutover, do not require same-day human deploys.** The pull
  agent catches up on the robot's schedule. Until cutover, Phase 0 still uses
  this script after robot-facing merges.
- After a manual deploy, paste the script's dated verification output into the
  `docs/beast-ops.md` **Quick connect** block.
- The restart is a brief stack outage — deploy parked, never mid-mission.
- First-time Jetson setup follows the [Jetson UART gate and Beast software runbook](../../../../docs/beast-jetson-flash-runbook.md#jetson-uart-gate-and-beast-software). Use its `rosdep` procedure; this deploy script assumes the
  workspace already builds.

## Other units here

`deploy/systemd/` carries the cockpit, storage, blackbox/mission record,
slam, and pull-agent units. These ARE the canonical copies:
`bin/beast-install-systemd-units` installs every `*.service`/`*.timer` from
this directory wholesale, and an unattended deploy whose span touches
`deploy/systemd/**` reinstalls them automatically.

Power logging is **not** a separate process to remember any more. The
`beast_power_logger` node runs inside `bringup_lidar.launch.py` under
`use_power`, writing `/data/beast/power/power-log.csv`. It starts and stops
with the stack, survives reboots because `beast-ros-base.service` does, and
fsyncs every row so a brownout log keeps its tail. It replaced
`deploy/diagnostics/power_log.py`, a manual script that died at its first
reboot and — after the 2026-08-07 cutover made `/ugv/voltage` the INA219 —
logged one sensor twice under two column names.
