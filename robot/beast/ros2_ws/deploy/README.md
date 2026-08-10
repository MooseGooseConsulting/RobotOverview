# Deploying to BEAST-01

## Canonical deploy (pull model)

**Canonical deploy manifests live in
[Coldaine/coldaine-homelab](https://github.com/Coldaine/coldaine-homelab)
`deployments/beast-01/` (private, 0 stars)**
— install scripts, systemd/container run units, `manifest.yaml` (image
digest), `beast-pull`, and `verify-beast`. Merging robot code to
`RobotOverview` `main` builds
`ghcr.io/moosegooseconsulting/beast-ros:sha-<SHA>` (see
`.github/workflows/beast-ros-image.yml`); the homelab bump + on-robot pull
agent land it when the robot is next online.

First-time / host install: run `install-beast.sh` from that homelab tree.
Ongoing updates: `beast-pull` (service + timer) — no same-day human deploy
required once cut over.

Live verify of the running graph (drive path, power CSV, …) is owned by
homelab `verify-beast`, not this repo.

## Manual override — `deploy-to-beast.sh` (Phase 0 / recovery)

This directory still holds `deploy-to-beast.sh`: the **manual override** and
Phase 0 source-sync path (SSH → git ff → colcon on the Jetson → restart host
systemd). Use it when the pull agent is not yet cut over, or when you need a
forced recovery deploy without waiting for a GHCR image.

From any clone of this repo (Windows Git Bash, Linux, macOS):

```bash
robot/beast/ros2_ws/deploy/deploy-to-beast.sh            # deploy origin/main
robot/beast/ros2_ws/deploy/deploy-to-beast.sh --verify-only   # drift check, read-only
```

### Host selection

Default `BEAST_HOST` is `beast-01` (LAN / mDNS). Override when needed:

```bash
BEAST_HOST=beast-01-ts robot/beast/ros2_ws/deploy/deploy-to-beast.sh   # Tailscale
BEAST_HOST=192.168.0.187 robot/beast/ros2_ws/deploy/deploy-to-beast.sh # direct Wi-Fi IP
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

`deploy/systemd/` also carries the cockpit, storage, and blackbox/mission
record units — still the Phase 0 / override copies. Canonical copies move to
`coldaine-homelab/deployments/beast-01/systemd/` as that tree lands.

Power logging is **not** a separate process to remember any more. The
`beast_power_logger` node runs inside `bringup_lidar.launch.py` under
`use_power`, writing `/data/beast/power/power-log.csv`. It starts and stops
with the stack, survives reboots because `beast-ros-base.service` does, and
fsyncs every row so a brownout log keeps its tail. It replaced
`deploy/diagnostics/power_log.py`, a manual script that died at its first
reboot and — after the 2026-08-07 cutover made `/ugv/voltage` the INA219 —
logged one sensor twice under two column names.
