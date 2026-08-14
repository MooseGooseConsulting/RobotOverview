# Web App

!!! danger "Parked — nothing on this page builds or runs"
    **`ugv_web_app`** and the five **`vizanti`** packages carry a `COLCON_IGNORE` and are off the allowlists in `build_common.sh` / `build_first.sh`, so every command below fails with *package not found*. `ugv_web_app` is superseded by the Hangar cockpit ([Web Cockpit Bridge](cockpit.md)); Vizanti's launch files also opened an unauthenticated rosbridge on **`0.0.0.0:5001`** — neutralized 2026-08-07, not run since.

    To bring one back: delete that package's `COLCON_IGNORE` and re-add its name to the allowlists in `build_common.sh` / `build_first.sh`. The rest of this page describes the vendor capability as it stands in-tree.

Browser-based control and visualization in **`ugv_web_app`** (Vizanti). Optional — not required for the core tutorial.

Use it from a phone or PC when you want a web alternative to RViz: **teleop**, **camera feeds**, **map / scan / TF**, **Nav2 goals**, and **map save/load** — depending on which robot stack is already running.

For voice and LLM chat, see [Experimental](experimental.md).

---

## Prerequisites

1. **Build and source** **`ugv_ws`** ([Installation](installation.md)).
2. **T0** — the robot stack you need for your task ([Hardware Driver](bringup.md), [Vision](vision.md), [Mapping](mapping.md), or [Navigation](navigation.md)).

`ugv_web_app` **does not** start motors, LiDAR, camera, SLAM, or Nav2 — it only starts the Vizanti web server and rosbridge.

---

## Overview

### Before you start

| Do | Do not |
|----|--------|
| Keep **T0** running while using the browser | **`Ctrl+C`** on **T0** while driving or mapping from the web UI |
| Open the URL printed in the terminal (same network as the robot) | Run [Web AI](experimental.md#web-ai) and Web App at the same time |
| Know which rung you are on before using the **Teleop** widget | Use Web **Teleop** + keyboard/gamepad + Nav2 + LiDAR/vision motion **at the same time** |

The **Teleop** widget publishes **`/cmd_vel_ui`** — the UI rung, [`twist_mux`](command_arbitration.md) priority 50. Keyboard (100) and an on-robot gamepad (150) both outrank it, so browser teleop goes dead the moment someone touches those. It outranks Nav2 and the demos (10). See [Command Arbitration](command_arbitration.md) and [Teleoperation — One motion source at a time](teleoperation.md#one-motion-source-at-a-time).

### Web App vs Web AI

| | **Web App** (`ugv_web_app`) | **Web AI** (`ugv_chat_ai`) |
|---|-----|-----|
| **Purpose** | Vizanti — viz, teleop, Nav widgets | LLM chat → **`behavior_ctrl`** |
| **Typical URL** | `http://<robot-ip>:5100` | `http://<robot-ip>:5000` |
| **Launch** | `ros2 launch ugv_web_app bringup.launch.py` | `ros2 run ugv_chat_ai app` (+ **T0** + **T1** `behavior_ctrl`) |

Default Vizanti web port is **5100**; rosbridge uses **5001**. Always use the URL from the terminal log.

### Tasks {#tasks}

| Goal | **T0** (robot stack) | **T1** (Web App) | Common widgets |
|------|----------------------|------------------|----------------|
| Teleop only | [bringup](bringup.md#launch-physical-robot) | `ros2 launch ugv_web_app bringup.launch.py` | **Teleop** → `/cmd_vel_ui` → `twist_mux` |
| Camera view | [Vision](vision.md) `demo.launch.py` (e.g. `cam_webrtc`) | same | **Image** / **WebRTC** on camera topic |
| Mapping | [Mapping](mapping.md) SLAM launch | same | **Scan**, **Map**, **Teleop**, save map |
| Navigation | [Navigation](navigation.md) `nav.launch.py` | same | **Map**, **Path**, **2D Goal Pose**, **Initial pose** |

Add widgets from the **+** menu in the browser. Layout is saved in the browser (localStorage). See the [Vizanti wiki](https://github.com/MoffKalast/vizanti/wiki) for widget details.

---

## Workflow

| Role | What to run |
|----------|-------------|
| **T0** | Your task stack — bringup, vision, SLAM, or Nav (see [Tasks](#tasks) above) |
| **T1** | **`ros2 launch ugv_web_app bringup.launch.py`** |

**T1** (`install/setup.bash` sourced):

```bash
ros2 launch ugv_web_app bringup.launch.py
```

Open the URL printed in the terminal, for example:

`http://<robot-ip>:5100`

Host binding defaults to **`0.0.0.0`** (reachable from other devices on the LAN).

Optional launch argument:

| Argument | Default | Description |
|----------|---------|-------------|
| `host` | `0.0.0.0` | Flask bind address |

If the program no longer needs to run, press **`Ctrl+C`** in **T1** first; leave **T0** running if you are still mapping or navigating.

### Launch nodes

`ugv_web_app` includes **`vizanti_server.launch.py`**. Typical nodes:

| Node / process | Role |
|----------------|------|
| `vizanti_flask_node` | Web UI (Flask) |
| `vizanti_rosbridge` | `rosbridge_websocket` (browser ↔ ROS) |
| `vizanti_tf_handler_node` | TF consolidation for the 2D view |
| `vizanti_service_handler_node` | Map save/load, node helpers |
| `rosapi` / `rosapi_launch` | Topic and launch introspection |
| `roarm_control` | Only if **`ROARM_MODEL`** is set (arm kits) |

**T0** supplies robot data (`/scan`, `/map`, `/cmd_vel` subscribers, camera topics, etc.) — not started by **T1**.

Source: `src/ugv_main/ugv_web_app/launch/bringup.launch.py`.

---

## Verify

With **T0** and **T1** running:

```bash
ros2 topic list
```

You should see topics from **T0** (e.g. `/scan`, `/odom`). In the browser, open **Settings** → confirm rosbridge connects (default **5001** on the robot).

**Robot on map (2D SLAM / Nav2 only)** — launches with **`robot_pose_publisher`** publish **`/robot_pose`**. Skip this block if **T0** is RTAB-Map, bringup-only, or vision:

```bash
ros2 topic echo /robot_pose --once
```

**RTAB-Map** — no **`/robot_pose`** from **`robot_pose_publisher`**. Use TF in the browser map widget, or inspect pose-related topics from **T0**:

```bash
ros2 topic list | grep -i pose
```

Refresh the page if widgets stay empty after **T0** has been up for a few seconds.

---

## Troubleshooting

| Symptom | Likely cause | What to try |
|---------|--------------|-------------|
| Page loads, no ROS data | **T0** not running or rosbridge disconnected | Start **T0**; check **Settings** / rosbridge status |
| Empty map / no robot | Wrong **T0** for the task | SLAM or Nav launch for maps; bringup alone for teleop-only |
| Teleop does nothing | A higher **`twist_mux`** rung is holding the floor (keyboard 100 / on-robot gamepad 150 vs the widget's 50), the widget is pointed at the wrong topic, or no bringup | Stop keyboard / gamepad teleop; confirm the widget's topic is **`/cmd_vel_ui`**; ensure **T0** includes **`ugv_bringup`** (which now also starts `twist_mux`) |
| No camera widget image | Camera not publishing | Start [Vision](vision.md) demo; pick matching image topic in widget |
| Port **5100** busy | Old Web App session | **`Ctrl+C`** prior **T1** or `pkill` stale process |
| Confused with Web AI | Different package and port | [Web AI](experimental.md#web-ai) is **`ugv_chat_ai`** on **5000** |
| Page unreachable on phone hotspot | Mobile data routing | Disable mobile data so traffic stays on the robot Wi‑Fi |

---

## Related Tutorials

| Chapter | What it adds |
|---------|----------------|
| [Hardware Driver](bringup.md) | **T0** for teleop-only |
| [Teleoperation](teleoperation.md) | Keyboard / gamepad (stop before Web Teleop) |
| [Vision](vision.md) | Camera topics for image widgets |
| [Mapping](mapping.md) | SLAM **T0** + save map |
| [Navigation](navigation.md) | Nav2 **T0** + goals from web |
| [Experimental](experimental.md) | Web AI (separate app) |
| [Gazebo](gazebo.md) | Simulation **T0** |

**Next:** [Navigation](navigation.md) if you came from [Mapping](mapping.md); otherwise continue your current tutorial path.
