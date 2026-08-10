# syntax=docker/dockerfile:1
#
# BEAST-01 ROS 2 Humble workspace image (linux/arm64).
#
# Base choice: ros:humble-ros-base (multi-arch). Built on GHA via Buildx
# --platform linux/arm64 (QEMU). This is NOT an NVIDIA L4T / JetPack base —
# CUDA/TensorRT/depthai GPU stacks are out of scope for the bringup image.
# On the Jetson host, coldaine-homelab/deployments/beast-01 mounts devices
# (--device i2c-7, ESP32/LiDAR serial by-id, video; --network=host) into the
# running container. A future L4T-based variant is optional if GPU nodes are
# required; keep host JetPack (R36.5 / JP 6.2.2) for that path.
#
# Runtime verify (drive-path, power CSV, …) lives with the pull agent:
#   coldaine-homelab/deployments/beast-01/ (verify-beast / beast-pull) —
# not in this image.

FROM --platform=$TARGETPLATFORM ros:humble-ros-base AS build

ARG TARGETPLATFORM=linux/arm64
ARG DEBIAN_FRONTEND=noninteractive

WORKDIR /ws

# Build + runtime apt deps for the bringup package set. Skip keys that are
# either host-mounted later (depthai) or not needed for base bringup (nav2,
# rviz GUI).
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      cmake \
      git \
      python3-colcon-common-extensions \
      python3-pip \
      python3-rosdep \
      python3-serial \
      python3-smbus2 \
      python3-netifaces \
      python3-numpy \
      python3-opencv \
      python3-yaml \
      ros-humble-robot-localization \
      ros-humble-twist-mux \
      ros-humble-xacro \
      ros-humble-robot-state-publisher \
      ros-humble-joint-state-publisher \
      ros-humble-tf2 \
      ros-humble-tf2-ros \
      ros-humble-tf2-geometry-msgs \
      ros-humble-diagnostic-msgs \
      ros-humble-cv-bridge \
      libeigen3-dev \
    && rm -rf /var/lib/apt/lists/*

# Bringup package set + C++ lidar/odom deps (matches deploy-to-beast.sh
# packages plus what bringup_lidar.launch.py includes at runtime).
COPY src/ugv_main/beast_power src/ugv_main/beast_power
COPY src/ugv_main/beast_base src/ugv_main/beast_base
COPY src/ugv_main/ugv_bringup src/ugv_main/ugv_bringup
COPY src/ugv_main/ugv_cockpit src/ugv_main/ugv_cockpit
COPY src/ugv_main/ugv_description src/ugv_main/ugv_description
COPY src/ugv_else/ldlidar src/ugv_else/ldlidar
COPY src/ugv_else/rf2o_laser_odometry src/ugv_else/rf2o_laser_odometry

# rosdep for workspace packages; skip keys we intentionally omit from the
# image (GPU / Nav2 / RViz GUI). Fail soft if rosdep already initialized.
RUN rosdep init 2>/dev/null || true \
 && rosdep update --rosdistro humble \
 && rosdep install --from-paths src --ignore-src -y -r \
      --rosdistro humble \
      --skip-keys "depthai_ros_driver depthai_descriptions ugv_vision \
        nav2_behaviors nav2_costmap_2d nav2_lifecycle_manager \
        nav2_velocity_smoother rosbridge_server rosbridge_library \
        rviz2 joint_state_publisher_gui controller_manager \
        position_controllers joint_state_broadcaster" \
 && rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-c"]
RUN source /opt/ros/humble/setup.bash \
 && colcon build \
      --packages-select \
        beast_power beast_base ugv_bringup ugv_cockpit ugv_description \
        ldlidar rf2o_laser_odometry \
 && rm -rf /ws/build /ws/log /ws/src

# --- runtime ---
FROM --platform=$TARGETPLATFORM ros:humble-ros-base

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3-serial \
      python3-smbus2 \
      python3-netifaces \
      python3-numpy \
      python3-opencv \
      python3-yaml \
      ros-humble-robot-localization \
      ros-humble-twist-mux \
      ros-humble-xacro \
      ros-humble-robot-state-publisher \
      ros-humble-joint-state-publisher \
      ros-humble-tf2 \
      ros-humble-tf2-ros \
      ros-humble-tf2-geometry-msgs \
      ros-humble-diagnostic-msgs \
      ros-humble-cv-bridge \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /ws
COPY --from=build /ws/install /ws/install

# Staging defaults; host /etc/beast/ugv.env overrides via compose/systemd.
ENV UGV_MODEL=ugv_beast \
    LDLIDAR_MODEL=ld19 \
    ROS_DISTRO=humble \
    PYTHONUNBUFFERED=1

# Device access is provided by the host run unit (coldaine-homelab), not here.
# Live graph verify lives in coldaine-homelab (verify-beast / beast-pull).
ENTRYPOINT ["/bin/bash", "-c", "\
  source /opt/ros/humble/setup.bash && \
  source /ws/install/setup.bash && \
  exec ros2 launch ugv_bringup bringup_lidar.launch.py \
    use_lidar:=true use_rviz:=false allow_motion:=true \
    \"$@\"", "--"]

CMD []
