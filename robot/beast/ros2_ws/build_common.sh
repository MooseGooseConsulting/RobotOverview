#!/bin/bash
set -e

WS=/home/ws/ugv_ws
cd $WS || exit 1

# Parked 2026-08-14 — these carry a COLCON_IGNORE and must NOT be listed here;
# colcon errors on a selected package it cannot discover:
#   vizanti, vizanti_cpp, vizanti_demos, vizanti_msgs, vizanti_server
#     — the vizanti launch files opened an unauthenticated rosbridge on
#       0.0.0.0:5001; neutralized 2026-08-07, not run since.
#   ugv_web_app  — superseded by the Hangar cockpit (ugv_cockpit).
#   explore_lite — standalone frontier-exploration workflow (docs/navigation.md);
#                  no service we run launches it.
#   emcl2        — alternative localizer. ugv_nav instantiates it only under
#                  use_localization:=emcl (localization_launch.py), a mode we
#                  do not use; that arg will fail while this is parked.
# To bring one back: delete its COLCON_IGNORE and re-add the name below.
#
# cartographer stays built even though the robot maps with slam_toolbox (from
# apt, see deploy/systemd/beast-slam.service): ugv_nav's localization_launch.py
# calls get_package_share_directory('cartographer') unconditionally, so dropping
# it breaks `ros2 launch ugv_nav nav.launch.py` for EVERY localization mode,
# amcl included. Park it only together with a guard on that call.
PACKAGES=(
  cartographer
  costmap_converter_msgs
  costmap_converter
  gz_ros2_control
  openslam_gmapping
  slam_gmapping
  ldlidar
  rf2o_laser_odometry
  robot_pose_publisher
  teb_msgs
  teb_local_planner
  ugv_msgs
  beast_power
  # beast_base is the ESP32 bridge — the drive path, and the node that sends the
  # unconditional startup stop (beast_base/base_node.py). bringup_lidar.launch.py
  # launches it by name, so a workspace built without it cannot boot the stack or
  # fire the boot stop. It was missing from this list until 2026-08-14.
  beast_base
  ugv_bringup
  ugv_cockpit
  ugv_chat_ai
  ugv_description
  ugv_gazebo
  ugv_nav
  ugv_slam
  ugv_tools
  ugv_vision
  ugv_voice
)

echo "=============================="
echo "  Select packages to build"
echo "=============================="

for i in "${!PACKAGES[@]}"; do
  printf "[%2d] %s\n" $((i+1)) "${PACKAGES[$i]}"
done

echo
read -p "Please enter the package number to be compiled (space-separated): " SELECTION

SELECTED_PKGS=""

for index in $SELECTION; do
  pkg="${PACKAGES[$((index-1))]}"
  if [ -n "$pkg" ]; then
    SELECTED_PKGS="$SELECTED_PKGS $pkg"
  else
    echo "❌ Invalid number: $index"
    exit 1
  fi
done

echo
echo "✔ The following packages will be compiled.:"
echo "$SELECTED_PKGS"
echo

colcon build \
  --packages-select $SELECTED_PKGS \
  --symlink-install \
  --executor sequential

echo
echo "===== Build finished ====="
source install/setup.bash
echo "✔ Workspace sourced."
