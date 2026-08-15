# BEAST ROS Full Audit

## Overview
Exhaustive audit artifact detailing the ROS packages within the `robot/beast/ros2_ws/src` workspace, evaluating their provenance, runtime usage, and required actions.

## Package Ledger

| Package | Provenance | Purpose | Currently Built? | Currently Deployed? | Currently Running? | Runtime Consumers | Runtime Publishers | Runtime Subscribers | Standard ROS Equivalent | Keep/Harden/Port/Park/Replace | Evidence | Required Work | Implementation Status | Proof Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `beast_base` | Main (`ugv_main`) | Serial bridge & safety | Yes | Yes | Yes | robot_localization, Nav2 | - | `cmd_vel` | - | Keep | Extracted | Phase 1 Strip | TBD |
| `beast_power` | Main (`ugv_main`) | Power monitoring | Yes | Yes | Yes | - | `/ugv/voltage` | - | - | Keep | INA219 source of truth | - | TBD |
| `cartographer` | Vendor (`ugv_else`) | SLAM | Yes | TBD | No | - | - | - | `ros-humble-cartographer-ros` | Replace | Duplicated by vendor code | Use apt pkg | TBD |
| `costmap_converter` | Vendor (`ugv_else`) | Nav2 Plugin | Yes | TBD | No | Nav2 | - | - | `ros-humble-costmap-converter` | Replace | Duplicated by vendor code | Use apt pkg | TBD |
| `costmap_converter_msgs` | Vendor (`ugv_else`) | Msgs | Yes | TBD | No | - | - | - | `ros-humble-costmap-converter` | Replace | Duplicated by vendor code | Use apt pkg | TBD |
| `emcl2_ros2` | Vendor (`ugv_else`) | Localization | No, Parked | No | No | - | - | - | Navigation2 (AMCL) | Park | Inappropriate / Obsolete | Remove | TBD |
| `explore_lite` | Vendor (`ugv_else`) | Frontier Exploration | No, Parked | No | No | - | - | - | `ros-humble-m-explore` | Park | Duplicated by vendor code | Use apt pkg | TBD |
| `gz_ros2_control` | Vendor (`ugv_else`) | Sim | Yes | TBD | No | - | - | - | `ros-humble-gz-ros2-control` | Replace | Duplicated by vendor code | Use apt pkg | TBD |
| `ldlidar` | Vendor (`ugv_else`) | LiDAR Driver | Yes | Yes | Yes | rf2o, slam_toolbox | `/scan` | - | - | Keep/Harden | No standard apt pkg | - | TBD |
| `openslam_gmapping` | Vendor (`ugv_else`) | SLAM | Yes | TBD | No | - | - | - | `slam_toolbox` | Park | Inappropriate / Obsolete | Remove | TBD |
| `rf2o_laser_odometry` | Vendor (`ugv_else`) | Laser Odometry | Yes | Yes | Yes | robot_localization | `odom_rf2o` | `/scan` | `ros-humble-rf2o-laser-odometry` | Replace | Duplicated by vendor code | Use apt pkg | TBD |
| `robot_pose_publisher` | Vendor (`ugv_else`) | Pose | Yes | TBD | No | - | - | - | `ros-humble-robot-pose-publisher` | Replace | Duplicated by vendor code | Use apt pkg | TBD |
| `slam_gmapping` | Vendor (`ugv_else`) | SLAM wrapper | Yes | TBD | No | - | - | - | `slam_toolbox` | Park | Inappropriate / Obsolete | Remove | TBD |
| `teb_local_planner` | Vendor (`ugv_else`) | Nav2 Local Planner | Yes | TBD | TBD | Nav2 | `/cmd_vel_nav` | - | `ros-humble-teb-local-planner` | Replace | Duplicated by vendor code | Use apt pkg | TBD |
| `teb_msgs` | Vendor (`ugv_else`) | Nav2 Msgs | Yes | TBD | TBD | - | - | - | `ros-humble-teb-msgs`| Replace | Duplicated by vendor code | Use apt pkg | TBD |
| `ugv_bringup` | Main (`ugv_main`) | Launch/Config | Yes | Yes | Yes | - | - | - | - | Harden | Misused in Nav/SLAM (double launch) | Fix `bringup_lidar` inclusions | TBD |
| `ugv_chat_ai` | Main (`ugv_main`) | LLM Agent | Yes | TBD | No | - | - | - | - | Keep | Custom AI | - | TBD |
| `ugv_cockpit` | Main (`ugv_main`) | Status/Mux Spine | Yes | Yes | Yes | - | `/cmd_vel` | `/cmd_vel_*` | `ros-humble-twist-mux` | Keep | Custom orchestration | - | TBD |
| `ugv_description` | Main (`ugv_main`) | URDF | Yes | Yes | Yes | tf2 | - | - | - | Keep | Robot specific | - | TBD |
| `ugv_gazebo` | Main (`ugv_main`) | Simulation | Yes | No | No | - | - | - | - | Keep | Robot specific | - | TBD |
| `ugv_msgs` | Main (`ugv_main`) | Custom Msgs | Yes | Yes | Yes | - | - | - | - | Keep | Robot specific | - | TBD |
| `ugv_nav` | Main (`ugv_main`) | Nav2 config | Yes | TBD | TBD | - | - | - | - | Harden | `bringup_lidar` double inclusion | Fix Nav2 launch | TBD |
| `ugv_slam` | Main (`ugv_main`) | SLAM config | Yes | TBD | TBD | - | - | - | - | Harden | `bringup_lidar` double inclusion | Fix SLAM launch | TBD |
| `ugv_tools` | Main (`ugv_main`) | Teleop / Scripts | Yes | Yes | Yes | - | `/cmd_vel_joy_*`| - | `teleop_twist_joy` | Harden | Retargeted demos mixed with standard | Revert demos | TBD |
| `ugv_vision` | Main (`ugv_main`) | Vision config | Yes | TBD | TBD | - | - | - | `depthai_ros_driver` | Harden | Uses `depthai_ros_driver` | Revert retargeted demos | TBD |
| `ugv_voice` | Main (`ugv_main`) | TTS | Yes | Yes | Yes | - | - | - | - | Keep | Robot specific | - | TBD |
| `ugv_web_app` | Main (`ugv_main`) | Old UI | No, Parked | No | No | - | - | - | - | Park | Replaced by Hangar | Delete (Phase 2) | TBD |
| `vizanti` | Vendor (`ugv_else`) | Old UI | No, Parked | No | No | - | - | - | - | Park | Replaced by Hangar | Delete (Phase 2) | TBD |
| `vizanti_cpp` | Vendor (`ugv_else`) | Old UI | No, Parked | No | No | - | - | - | - | Park | Replaced by Hangar | Delete (Phase 2) | TBD |
| `vizanti_demos` | Vendor (`ugv_else`) | Old UI | No, Parked | No | No | - | - | - | - | Park | Replaced by Hangar | Delete (Phase 2) | TBD |
| `vizanti_msgs` | Vendor (`ugv_else`) | Old UI | No, Parked | No | No | - | - | - | - | Park | Replaced by Hangar | Delete (Phase 2) | TBD |
| `vizanti_server` | Vendor (`ugv_else`) | Old UI | No, Parked | No | No | - | - | - | - | Park | Replaced by Hangar | Delete (Phase 2) | TBD |

## Sub-Tasks C, D, E Findings

### NAV2 / EXPLORATION
* **Alternative Selection**: Compared `explore_lite` against modern alternatives. The most robust replacement for ROS 2 Humble is `frontier_exploration_ros2` (by mertgulerx).
* **Reasoning**: Unlike `nav2_reflex_explore`, `frontier_exploration_ros2` natively supports return-to-start (RTS), global/local costmap filtering (blacklist validation), and provides MRTSP (Minimum Ratio Traveling Salesman Problem) bounded-horizon optimizations alongside standard Nav2 integration.

### LIVE ROBOT GRAPH
* **cmd_vel routing**: `twist_mux` is explicitly the ONLY publisher allowed on `/cmd_vel`. 
* **Bypassing the mux**: No autonomous nodes bypass the multiplexer. In `ugv_nav/launch/nav_bringup/navigation_launch.py`, `controller_server` remaps its output `/cmd_vel` to `cmd_vel_nav_raw`. This routes through the velocity smoother and collision monitor to output `cmd_vel_nav`. Finally, `twist_mux` pulls `cmd_vel_nav` and orchestrates it to the actual `/cmd_vel`.

### SLAM / ODOMETRY
* **Config Inspection**: Both Nav2 and SLAM launch files (`nav.launch.py` and `slam_toolbox.launch.py`) include `bringup_lidar.launch.py`.
* **Duplicate RF2O nodes**: Yes. Because `bringup_lidar.launch.py` conditionally starts `rf2o_laser_odometry_node` (and `ekf`, and `twist_mux`), running both SLAM and Nav2 alongside the live base service launches duplicate instances of `rf2o`, `ekf`, and `twist_mux`, causing TF tree collisions.
* **Map wedges / spinning**: `slam_toolbox_online_async.yaml` contains `minimum_travel_heading: 0.2` and `minimum_travel_distance: 0.2`. No rigid bounds were found to prevent the map from wedging or "circling" during continuous rotational slippage (pure spin in place without valid odometry bounds).

### Additional Gate Findings

* **Gate 12 (Diagnostics/Honesty)**: Nav2 lifecycle transitions are actively managed via `nav2_lifecycle_manager`, and `robot_state_publisher` is present in description and Gazebo launches. However, explicit system diagnostics (`diagnostic_updater`) are missing from the custom control packages (e.g., `beast_base` and `ugv_cockpit`). The system currently lacks a unified /diagnostics topic for node health monitoring outside of Nav2 lifecycle states.
* **Gate 16 (Test the Explorer logic)**: Unit tests for logic such as the Explorer logic currently cannot be run locally because the local BEAST Docker container fails to build. This represents a strict blocker for verifying independent business logic off-robot.
* **Gate 18 (Physical Motion Contract)**: Backup behaviors and BT (Behavior Tree) recoveries such as `allow_reversing` require further evaluation. Due to sensor blind spots, reversing backwards cannot be safely verified by the Nav2 costmaps alone. These backup maneuvers therefore mandate explicit physical testing on the live robot to observe the kinematic bounds and collision risks.

## Hard Gate 19: Final Subagent Red Team Findings

### Reviewer 1: Command & Safety Bypasses
* **Watchdog Validation**: While `ugv_cockpit` orchestrates software checks, the actual physical `/cmd_vel` timeout (if the Orin or bridge node crashes mid-drive) requires explicit live physical testing to guarantee the hardware halts.
* **Blind Reversing**: Backward motion bypasses LiDAR safety constraints due to physical sensory occlusion. Nav2 controllers and backup behaviors that allow backing up pose an unmitigated physical risk.

### Reviewer 2: Duplicate Lifecycle & Launch Ownership
* **Recursive Bringups**: Both SLAM and Nav2 launches recursively rely on `bringup_lidar`. If both are launched or combined with the base service, they blindly spawn duplicate instances of `rf2o`, `ekf`, and sensor drivers, creating severe TF tree ghosting and resource exhaustion.
* **Orphaned States**: Vendor nodes lack proper `nav2_util::LifecycleNode` integration, causing them to run hot immediately instead of waiting for the strict Nav2 lifecycle manager to transition them to `Active`.

### Reviewer 3: Test Fidelity & Mocking
* **Blocked Integration Tests**: Since the local `beast` Docker container is broken/down, off-robot integration tests are physically blocked. 
* **Superficial Assertions**: Current workspace tests largely consist of trivial linting or compile checks. Behavior logic (like the frontier explorer or multiplexer timeouts) is heavily mocked or not tested at all for real topic latency and dropouts.

### Reviewer 4: Lingering Vendor/Custom Logic vs Standard ROS 2
* **Zombie Clutter**: Parked vendor forks like `emcl2_ros2`, `explore_lite`, `costmap_converter`, and custom versions of `cartographer` still populate the tree. They obscure standard ROS 2 equivalents and present severe maintainability risks. 
* **Redundant Interfaces**: Maintaining duplicate vendor messages when standard `nav2_msgs`, `sensor_msgs`, or `geometry_msgs` are natively supported creates unnecessary serialization overhead.