# BEAST control topology

Stable map of how Hangar (this repo) and the robot brain (`ugv_ws`) share authority
over BEAST-01. Architecture decisions live in the
[master plan](plans/2026-08-02-control-plane-architecture.md). **Volatile live facts**
(SSH paths, pack voltage, boot args, HEAD SHAs, bridge presence) live only in
[`docs/beast-ops.md`](beast-ops.md) Quick connect — re-verify there; do not copy
dated probe numbers into this doc.

## Where the repos live (read this first)

**`ugv_ws` is not inside RobotOverview.** Opening this Hangar folder will never show
the robot brain source tree. Two sibling clones on the Windows PC, one GitHub fork,
one checkout on the Jetson:

| Role | Path / URL |
| --- | --- |
| Hangar (this repo) | `D:\_projects\RobotOverview` → GitHub `Coldaine/RobotOverview` |
| Robot brain — main clone | `D:\_projects\ugv_ws` → GitHub [Coldaine/ugv_ws](https://github.com/Coldaine/ugv_ws) (fork of Waveshare) |
| Robot brain — feature worktrees | `D:\_projects\.worktrees\ugv_ws-*` (e.g. `ugv_ws-pr1-safety`, `ugv_ws-pr4-behaviors`) — same git object DB, different checked-out branches |
| On BEAST-01 | `~/beast/ugv_ws` (same remote; **this** is what actually runs) |
| Hangar cluster manifests | separate repo `coldaine-homelab` — not robot code |

```text
D:\_projects\
  RobotOverview\          ← you are here (Hangar UI / docs / plans)
  ugv_ws\                 ← robot ROS workspace (main checkout)
  .worktrees\
    ugv_ws-pr1-safety\    ← often: beast/pr1-safety-spine
    ugv_ws-pr4-behaviors\ ← often: beast/pr4-agent-behaviors (may match robot HEAD)
    ugv_ws-pr3-lidar\     …
    ugv_ws-pr10\          …
```

List worktrees anytime: `git -C D:\_projects\ugv_ws worktree list`.
**Which branch the robot is on** is a live fact — only Quick connect in
[`docs/beast-ops.md`](beast-ops.md) is authoritative (re-probe with
`git -C ~/beast/ugv_ws rev-parse --short HEAD` + `git branch --show-current`).

Cross-link from the robot side (sibling on disk, not in this git tree):
`D:\_projects\ugv_ws\docs\BEAST.md`.

## Dual-repo map

| Surface | Repo | Owns |
| --- | --- | --- |
| Hangar UI + agent | [RobotOverview](.) (this repo) | `/cockpit`, `/agent`, inventory/wiki, ingest API, Next.js chat + Zod tools, server `roslib` |
| Robot brain | [Coldaine/ugv_ws](https://github.com/Coldaine/ugv_ws) | ROS 2 Humble: bringup, twist_mux, lidar, behaviors, safety monitor, power, rosbridge/systemd |
| Cluster runtime | `coldaine-homelab` | k8s/Flux deploy of Hangar — not robot code |
| Ops ground truth | [`docs/beast-ops.md`](beast-ops.md) | Dated reachability, boot args, voltage, `/scan` proof, bridge state, **robot HEAD** |

Sync path for robot code: edit in `ugv_ws` (or a worktree) → push → pull on Jetson →
`colcon build` → restart named units → prove → dated beast-ops note. Hangar never
deploys to the Jetson
(see [Syncing robot code](beast-ops.md#syncing-robot-code-to-beast-01)).

```mermaid
flowchart LR
  subgraph hangarRepo ["RobotOverview — Hangar"]
    UI["/cockpit + agent chat"]
    API["ingest / Postgres / Datacore"]
  end
  subgraph brain ["Coldaine/ugv_ws — Jetson"]
    ROS["ROS 2 Humble graph"]
    RB["rosbridge :9090"]
  end
  subgraph ops ["beast-ops Quick connect"]
    GT["dated live facts only"]
  end
  UI -->|"WSS over tailnet"| RB
  RB --> ROS
  hangarRepo -.->|"never deploys code"| brain
  brain -.->|"probe stamps"| ops
```

## Authority stack

Higher proposes; lower disposes. Every motion source keeps a named twist_mux rung.
The LLM is outer-loop only — four vetoes away from the motors.

```mermaid
flowchart TB
  LLM["LLM planner (offboard, CORE-PRIME)"] -->|"tool calls only, seconds-scale"| CH["Next.js route + roslib singleton"]
  OPW["Hangar drive pad / Vizanti"] -->|"cmd_vel_ui"| RBX["rosbridge :9090"]
  CH -->|"nav2 action goals"| RBX
  RBX --> BS["behavior_server: Spin / BackUp / DriveOnHeading"]
  BS -->|"raw nav twist"| CM["collision_monitor: stop/slowdown polygons"]
  CM -->|"cmd_vel_nav · prio 10"| MUX["twist_mux — the ONLY /cmd_vel publisher"]
  PAD["browser pad / Vizanti"] -->|"cmd_vel_ui · prio 50"| MUX
  KBD["operator keyboard (SSH)"] -->|"prio 100"| MUX
  JPD["on-robot gamepad"] -->|"prio 150"| MUX
  ES["CLI e-stop lock"] -.->|"prio 255 masks everything"| MUX
  MUX --> BR["beast_base: allow_motion gate + startup stop"]
  BR --> ESP["ESP32 (JSON T:13 @115200)"]
  ESP --> TRK["tracks"]
```

Invariant: browser/LLM propose; Jetson/ESP32 dispose — manual `allow_motion`,
mux priorities, Nav2 collision monitor, and an unconditional startup stop. There is no
automatic Ethernet/charging interlock and no Jetson-side `cmd_vel` silence watchdog
on the current branch. Command sources send a zero on release; if a source disappears
without one, the ESP32 may retain its last command until another command or reboot.
A human always outranks autonomy; someone at the robot outranks everyone; e-stop
outranks the humans; `beast_base` can refuse them all.

The current service default is motion-enabled; operators must use the manual `/ugv/set_allow_motion` gate. Live state and publisher counts: [beast-ops Quick connect](beast-ops.md#quick-connect).

## Machine topology

```mermaid
flowchart TB
  subgraph pc ["Windows PC — dev only"]
    DEV["Cursor + repo clones (RobotOverview, ugv_ws)"]
  end
  subgraph prime ["CORE-PRIME — homelab"]
    K8S["Hangar app (k8s, Flux)"]
    OLL["Ollama planner :11434"]
  end
  subgraph jet ["BEAST-01 — Jetson Orin Nano"]
    TSS["tailscale serve → WSS"]
    RBS["rosbridge 127.0.0.1:9090"]
    ROSG["ROS 2 Humble graph (bringup, mux, behaviors, EKF, ldlidar)"]
    TSS --> RBS
    RBS --> ROSG
  end
  subgraph chassis ["chassis hardware"]
    ESP2["ESP32 driver board"]
    LD2["LD19 LiDAR"]
    OAK2["OAK-D Lite (USB)"]
    PWR2["driver-board INA219 (I2C)"]
  end
  K8S -->|"WSS over tailnet"| TSS
  OLL -->|"OpenAI-compatible endpoint"| K8S
  ROSG -->|"USB serial 115200"| ESP2
  LD2 --> ROSG
  OAK2 --> ROSG
  PWR2 -.->|"/dev/i2c-7 / 0x41"| ROSG
  DEV -.->|"git push + ssh, no CI/CD to robot"| jet
```

Cockpit bridge (`beast-cockpit.service` / loopback `:9090` + Tailscale Serve WSS) is
Set 1b — presence is a live fact in beast-ops, not assumed here. Stock boot already
brings up the ROS graph via `beast-ros-base.service` (LiDAR on when
`use_lidar:=true`; see Quick connect for current args and `/scan` proof).

## Topic map

```mermaid
flowchart LR
  subgraph ros ["Jetson ROS graph"]
    LD["ldlidar → /scan"]
    PWR["beast_power → /ugv/voltage + /ugv/charging_active (observability)"]
    BRB["beast_base → /imu/raw + /ugv/allow_motion (Set 1a)"]
    EKF["EKF → /odom"]
    BSV["behavior_server ⇄ nav2 actions (Set 4a)"]
  end
  RB["rosbridge :9090<br/>subscribe globs up · publish globs down"]
  subgraph hangar ["Hangar (RobotOverview)"]
    UI["/cockpit browser client (roslib)"]
    API["agent chat route (server roslib, Set 4b)"]
  end
  LD --> RB
  PWR --> RB
  BRB --> RB
  EKF --> RB
  RB --> UI
  RB --> API
  UI -->|"cmd_vel_ui · PT/LED · /ugv/set_allow_motion"| RB
  API -->|"nav2 action goals + cancel"| RB
  RB --> BSV
```

Nothing crosses the bridge that is not in a glob. Browser and server share one
bridge; the robot sees topics, not clients. Closed-glob contract:
[Command Deck spec](plans/archived/2026-07-31-beast-command-deck-spec.md).

## What Hangar never does

| Never | Why |
| --- | --- |
| Deploy or `colcon build` on the Jetson | Robot brain is `ugv_ws` only; Hangar is the portal |
| Own safety authority (`allow_motion`, mux) | Jetson disposes; Hangar proposes |
| Stream LLM `cmd_vel` or unbounded odom loops | Skills are stock nav2 behaviors with `time_allowance` |
| Bypass rosbridge globs / invent a FastAPI motion API | One bridge; Zod tools + glob allowlist are the intent contract |
| Arm motion from CI, seed data, or offline fixtures | Arming is a supervised on-robot procedure after crawl+kill |
| Treat fixture `src/data/hangar.ts` as live robot state | Facts are Postgres + beast-ops probes |
| Duplicate dated voltage / HEAD / route metrics here | Those drift; Quick connect is the only current-state surface |

## Related

- Intent: [`docs/NORTH_STAR.md`](NORTH_STAR.md) (G7)
- Live ops: [`docs/beast-ops.md`](beast-ops.md)
- Master plan + PR sets: [`docs/plans/2026-08-02-control-plane-architecture.md`](plans/2026-08-02-control-plane-architecture.md)
- Advanced cockpit idea bank (not a live plan): Datacore
  [`/datacore/briefing/beast-cockpit-future-roadmap`](/datacore/briefing/beast-cockpit-future-roadmap)
  · thin pointer [`docs/plans/2026-08-01-beast-cockpit-future-roadmap.md`](plans/2026-08-01-beast-cockpit-future-roadmap.md)
