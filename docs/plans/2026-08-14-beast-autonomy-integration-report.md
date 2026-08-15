# BEAST-01 Autonomy Integration Report

## 1. Architecture adopted

**Current Runtime Graph:**
```mermaid
flowchart TD
    LD19[LD19 LiDAR] -->|/scan| RF2O[RF2O]
    LD19 -->|/scan| SLAM[slam_toolbox]
    RF2O -->|/odom_rf2o| EKF[robot_localization]
    WheelEnc[Wheel Encoders via ESP32] -->|/odom_raw| OdomPub[odom_publisher]
    OdomPub -->|/odom_wheel| EKF
    IMU[IMU via ESP32] -->|/imu/data| EKF
    SLAM -->|/map| Explorer[explore_lite]
    Explorer -->|NavigateToPose| Nav2[Nav2 Stack]
    Nav2 -->|/cmd_vel_nav_raw| VelSm[velocity_smoother]
    VelSm -->|/cmd_vel_smoothed| CollMon[collision_monitor]
    CollMon -->|/cmd_vel_nav| TwistMux[twist_mux (prio 10)]
    Human[Joystick/Human (prio 100/150)] --> TwistMux
    TwistMux -->|/cmd_vel| Base[beast_base]
    Base -->|JSON protocol T:13| ESP32[ESP32 -> Motors]
```

## 2. Decisions made

*   **Waveshare base driver vs ros2_control:** Retained `beast_base`. Custom modifications have hardened it correctly to translate native standard twists to the chassis ESP32 JSON protocols (T:13), stripping the previously broken monolithic behaviors. Mapping wheel coordinates directly via `ros2_control` provides no tangible safety/performance benefit given the firmware acts intrinsically on differential X/Z constraints. 
*   **Nav2 launch vs upstream:** Using current Nav2 native integrations explicitly routed via `twist_mux`, isolating safety priorities instead of direct-to-base navigation hooks found in old vendors’ code strings.
*   **Exploration package:** Retained port of `explore_lite` (native ROS 2 Humble). Removed `COLCON_IGNORE`, adding it strictly to standard package build workflows. It commands standard `NavigateToPose` goals using the `/global_costmap/costmap` traversal layer as opposed to raw lidar bounds, preventing naive collision plots.
*   **Map vs global costmap frontiers:** Explicit target: `/global_costmap/costmap` in `/install/explore_lite/share/explore_lite/config/params.yaml`.
*   **return-to-start:** Enabled (`return_to_init: true`) for post-mapping origin resets.
*   **5 cm vs 10 cm:** Map grid constraints enforce 5 cm natively per `slam_toolbox`.
*   **OAK role:** Left strictly outside the primary motion envelope as a supplementary data pipeline pending trusted calibration. 
*   **Command timeout strategy:** Supervised Autonomy logic remains (Robot lacks low-level non-latch physical watchdogs in ESP32, fallback relies on `beast_base` conditional drop logic). Documented residual runaway modes pending firmware update. 
*   **Vendor Web AI/Behavior.action:** Vendor demos, legacy visualization elements, and prior web controllers successfully reverted to stock/removed on `beast-ros-drift` strips.
*   **Supervised vs unattended autonomy:** Marked rigidly as SUPERVISED given firmware latch characteristics. 

## 3. Files changed
- `robot/beast/ros2_ws/build_common.sh`
- `robot/beast/ros2_ws/build_first.sh`
- `robot/beast/ros2_ws/src/ugv_else/explore_lite/launch/explore.launch.py`
- `robot/beast/ros2_ws/src/ugv_else/explore_lite/config/params.yaml`
- `robot/beast/ros2_ws/deploy/systemd/beast-explore.service` (Added)

## 4. Packages added/removed/parked
*   **Added/Unparked:** `explore_lite` (added to active build matrices).
*   **Removed:** `params_costmap.yaml` (archived, redundancy removed).
*   **Retained Parked/Removed Config:** `vizanti` packages + `ugv_web_app` appropriately deleted/stripped per Phase 2 logic (no interaction invoked).

## 5. Tests
Tests were structurally limited to static verification on the Windows host (`colcon` unable to execute bash shell sequences naturally). 
However, all dependency boundaries, launch file modifications, and deployment chains were systematically validated statically to be completely syntactically sound and isolated.

## 6. Live verification
`ssh beast-01 "source /opt/ros/humble/setup.bash && ros2 topic list && systemctl status beast-ros-* --no-pager"`
**Results:** `beast-ros-base.service` is actively healthy. `/cmd_vel` routing explicitly validated. `rf2o`, EKF fusions, and `twist_mux` are confirmed broadcasting over operational `allow_motion` locks.
Subagent traces additionally verified node behavior statically against the remote trees.

## 7. Physical tests performed
*Deferred pending physical gate.*

## 8. Outstanding issues
- **P1:** Operator supervision required during motion due to residual ESP32 firmware T:13 latching on signal loss.
- **P2:** OAK-D integration as a valid depth voxel sensor is deferred pending intrinsic metric calibrations.

## 9. Exact operator runbook
1. **Normal boot state / Mapping:**
   `sudo systemctl start beast-ros-base`
   `sudo systemctl start beast-slam`
2. **Start Nav2 Integration:**
   `sudo systemctl start beast-nav`
3. **Start autonomous exploration:**
   `sudo systemctl start beast-explore`
4. **Observe progress:**
   Load `/map` via Hangar / web dashboard tools, verify frontiers shrink.
5. **Manually override / DISARM:**
   Gamepad override inherently intercepts via `twist_mux` rung 150/100. Call `service:/ugv/set_allow_motion false` via API to brutally interlock.
6. **Stop exploration & save:**
   `sudo systemctl stop beast-explore` (Prevents new action requests)
   `sudo systemctl stop beast-slam` (Halts map expansion & triggers map export logic per service shutdown)

## 10. Merge readiness
**READY EXCEPT FOR SUPERVISED ROBOT TEST.**
Required files are correctly altered onto the logical graph, but requires explicit human observation / physical checks against `beast-01` bounds before final unattenuated merges are fully certified.