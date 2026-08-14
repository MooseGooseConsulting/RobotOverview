#!/bin/bash
set -e

WS=/home/ws/ugv_ws
BASHRC=~/.bashrc

add_if_not_exist () {
    grep -qxF "$1" "$BASHRC" || echo "$1" >> "$BASHRC"
}

echo "=============================="
echo "   UGV Build & Config Script"
echo "=============================="
echo

# ---------- Basic system deps ----------
echo "[1/6] Installing basic dependencies..."
apt-get update
apt-get install -y \
  python3-pip \
  python3-smbus2 \
  python3-colcon-argcomplete \
  alsa-utils \
  screen \
  speech-dispatcher \
  speech-dispatcher-espeak \
  espeak-ng \
  gstreamer1.0-rtsp \

# ---------- Python deps (WARNING) ----------
echo
echo "⚠️  Python dependencies will be installed via pip"
echo "⚠️  It is STRONGLY recommended to use a virtualenv for AI/Vision"
read -p "Continue pip install requirements.txt? [y/N]: " PIP_CONFIRM
if [[ "$PIP_CONFIRM" =~ ^[Yy]$ ]]; then
    python3 -m pip install -r requirements.txt
else
    echo "⏭ Skipped pip install"
fi

# ---------- ROS 2 packages ----------
echo
echo "[2/6] Installing ROS 2 packages..."
# ros-humble-rosbridge-suite is listed explicitly as well as via the
# ros-humble-rosbridge-* glob: ugv_cockpit's cockpit bridge depends on it by
# name (deploy/systemd/beast-cockpit.service, docs/cockpit.md), and that
# dependency should survive anyone tightening the inherited wildcard.
apt-get install -y \
    ros-humble-cartographer-* \
    ros-humble-desktop-* \
    ros-humble-joint-state-publisher-* \
    ros-humble-position-controllers \
    ros-humble-nav2-* \
    ros-humble-rosbridge-* \
    ros-humble-rosbridge-suite \
    ros-humble-rqt-* \
    ros-humble-rtabmap-* \
    ros-humble-twist-mux \
    ros-humble-v4l2-camera \
    ros-humble-depthai-bridge-dbgsym \
    ros-humble-depthai-ros-driver \
    ros-humble-depthai-ros-msgs \
    ros-humble-depthai-ros-msgs-dbgsym \
    ros-humble-depthai-bridge \
    ros-humble-depthai-descriptions \
    ros-humble-depthai-examples \
    ros-humble-depthai-ros-driver-dbgsym \
    ros-humble-depthai \
    ros-humble-depthai-dbgsym \
    ros-humble-depthai-examples-dbgsym \
    ros-humble-depthai-filters \
    ros-humble-depthai-filters-dbgsym \
    ros-humble-depthai-ros
  

# ---------- Gazebo (OPTIONAL) ----------
echo
echo "=============================="
echo "     Gazebo Version Select"
echo "=============================="
echo "⚠️  Gazebo is resource-intensive"
echo "⚠️  Recommended ONLY for desktop / VM"
echo
echo "Select Gazebo version to install:"
echo "  [1] Gazebo Classic (gazebo11)"
echo "  [2] Gazebo Harmonic (gz-sim)"
echo "  [0] Skip Gazebo installation"
echo

read -p "Your choice [0-2]: " GAZEBO_CHOICE

GAZEBO_INSTALLED=false
GZ_VERSION=""

case "$GAZEBO_CHOICE" in

  # ---------- Gazebo Classic ----------
  1)
    echo "✔ Installing Gazebo Classic (gazebo11)..."

    apt-get install -y \
      gazebo \
      gazebo-common \
      gazebo-plugin-base \
      ros-humble-gazebo-ros-pkgs \
      ros-humble-gazebo-ros2-control

    GZ_VERSION="classic"
    GAZEBO_INSTALLED=true

    # Gazebo Classic environment
    add_if_not_exist "source /usr/share/gazebo/setup.bash"
    ;;

  # ---------- Gazebo Harmonic ----------
  2)
    echo "⚠️ Installing Gazebo Harmonic (gz-sim)..."

    # OSRF repository (only needed for gz)
    apt-get install -y \
      curl \
      lsb-release \
      gnupg

    curl -sSL https://packages.osrfoundation.org/gazebo.gpg \
      --output /usr/share/keyrings/pkgs-osrf-archive-keyring.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/pkgs-osrf-archive-keyring.gpg] \
https://packages.osrfoundation.org/gazebo/ubuntu-stable \
$(lsb_release -cs) main" \
      | tee /etc/apt/sources.list.d/gazebo-stable.list > /dev/null

    apt-get update

    apt-get install -y \
      gz-harmonic \
      ros-humble-ros-gzharmonic

    GZ_VERSION="harmonic"
    GAZEBO_INSTALLED=true
    ;;

  # ---------- Skip ----------
  0)
    echo "⏭ Skipped Gazebo installation"
    ;;

  *)
    echo "❌ Invalid choice, skipping Gazebo installation"
    ;;
esac

# ---------- Export Gazebo version ----------
if [ "$GAZEBO_INSTALLED" = true ]; then
  add_if_not_exist "export GZ_VERSION=${GZ_VERSION}"
fi

# ---------- ROS env ----------
echo
echo "[3/6] Configuring ROS environment..."
add_if_not_exist "source /opt/ros/humble/setup.bash"
source ~/.bashrc

# ---------- Model selection ----------
echo
echo "[4/6] Select UGV model:"
select UGV_MODEL in ugv_rover ugv_beast rasp_rover; do
    [ -n "$UGV_MODEL" ] && break
    echo "Invalid selection."
done

echo
echo "Select LiDAR model:"
select LDLIDAR_MODEL in ld19 ld06 stl27l; do
    [ -n "$LDLIDAR_MODEL" ] && break
    echo "Invalid selection."
done

echo
echo "Selected configuration:"
echo "  UGV_MODEL     = $UGV_MODEL"
echo "  LDLIDAR_MODEL = $LDLIDAR_MODEL"
echo "  Gazebo        = $GAZEBO_INSTALLED"

read -p "Save model selection to ~/.bashrc? [y/N]: " SAVE_ENV
if [[ "$SAVE_ENV" =~ ^[Yy]$ ]]; then
    add_if_not_exist "export UGV_MODEL=$UGV_MODEL"
    add_if_not_exist "export LDLIDAR_MODEL=$LDLIDAR_MODEL"
    echo "✔ Model selection saved to ~/.bashrc"
else
    export UGV_MODEL
    export LDLIDAR_MODEL
    echo "✔ Model selection exported for current shell only"
fi

# ---------- Build ----------
echo
echo "[5/6] Building workspace: $WS"
cd "$WS" || exit 1

colcon build \
  --packages-select \
    costmap_converter_msgs costmap_converter \
    gz_ros2_control \
    openslam_gmapping slam_gmapping \
    ldlidar rf2o_laser_odometry \
    robot_pose_publisher \
    teb_msgs teb_local_planner \
    ugv_msgs \
  --symlink-install \
  --executor sequential

colcon build \
  --packages-select \
    ugv_bringup ugv_cockpit ugv_chat_ai ugv_description ugv_gazebo \
    beast_power ugv_nav ugv_slam ugv_tools ugv_vision ugv_voice \
  --symlink-install \
  --executor sequential

# ---------- Final env ----------
echo
echo "[6/6] Finalizing environment..."
add_if_not_exist "source $WS/install/setup.bash"
add_if_not_exist "export PULSE_SERVER=unix:/run/user/1000/pulse/native"
add_if_not_exist "export XDG_RUNTIME_DIR=/run/user/1000"
add_if_not_exist "# ---- ROS 2 & colcon argcomplete ----"

# ROS 2 CLI completion
add_if_not_exist 'if [ -f /usr/share/ros2cli/ros2cli-completion.bash ]; then source /usr/share/ros2cli/ros2cli-completion.bash; fi'
add_if_not_exist 'if [ -f /usr/share/colcon_argcomplete/hook/colcon-argcomplete.bash ]; then source /usr/share/colcon_argcomplete/hook/colcon-argcomplete.bash; fi'

source ~/.bashrc

echo
echo "=============================="
echo "✔ Environment ready."
echo "✔ UGV_MODEL=$UGV_MODEL"
echo "✔ LDLIDAR_MODEL=$LDLIDAR_MODEL"
echo "✔ Gazebo installed: $GAZEBO_INSTALLED"
echo "✔ GZ_VERSION=$GZ_VERSION"
echo "=============================="
