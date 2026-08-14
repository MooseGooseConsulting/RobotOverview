"""BEAST-01 Command Deck — full cockpit bring-up.

Brings up everything the browser cockpit needs that is NOT already in
beast-ros-base.service:

  * OAK-D camera (RGB compressed + aligned depth) — launched HERE, not in the
    boot service, so its USB bandwidth and power are only spent when someone is
    actually watching.
  * depth_colorizer     -> /cockpit/depth/compressed
  * overhead_clearance  -> /cockpit/overhead_clearance
  * cockpit_status      -> /cockpit/status
  * rosbridge_websocket -> :9090 (tailscale serve proxies to wss://)

LiDAR (/scan), odom, voltage, IMU and diagnostics come from beast-ros-base and
are simply exposed through the same bridge. The bridge is also an intentional
remote command ingress, restricted to the existing mux, actuator, and e-stop
topics; it adds no route around the mux or the motion gate. (There is no
cmd_vel watchdog to route around — it was removed 2026-08-07, owner decision
D8 — so a bridge client that stops publishing has not stopped the robot.)
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    IncludeLaunchDescription,
    OpaqueFunction,
)
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    cockpit_share = get_package_share_directory('ugv_cockpit')

    use_camera_arg = DeclareLaunchArgument(
        'use_camera', default_value='true',
        description='Launch the OAK-D camera (RGB + depth) with the cockpit'
    )
    use_bridge_arg = DeclareLaunchArgument(
        'use_bridge', default_value='true',
        description='Launch rosbridge_websocket on port 9090'
    )
    oak_params_arg = DeclareLaunchArgument(
        'oak_params_file',
        default_value=os.path.join(cockpit_share, 'config', 'oak_cockpit.yaml'),
        description='depthai_ros_driver params; cockpit variant publishes RGB'
    )

    # Resolve the vision package lazily so telemetry-only launch (use_camera:=false)
    # does not require ugv_vision to be installed just to build the description.
    def _oak_launch(context, *args, **kwargs):
        vision_share = get_package_share_directory('ugv_vision')
        return [IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                os.path.join(vision_share, 'launch', 'oak_d_lite.launch.py')
            ),
            launch_arguments={
                'params_file': LaunchConfiguration('oak_params_file'),
            }.items(),
        )]

    oak_launch = OpaqueFunction(
        function=_oak_launch,
        condition=IfCondition(LaunchConfiguration('use_camera')),
    )

    rosbridge_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(cockpit_share, 'launch', 'rosbridge.launch.py')
        ),
        condition=IfCondition(LaunchConfiguration('use_bridge')),
    )

    depth_colorizer = Node(
        package='ugv_cockpit', executable='depth_colorizer',
        name='depth_colorizer', output='screen',
    )
    overhead_clearance = Node(
        package='ugv_cockpit', executable='overhead_clearance',
        name='overhead_clearance', output='screen',
    )
    cockpit_status = Node(
        package='ugv_cockpit', executable='cockpit_status',
        name='cockpit_status', output='screen',
        # The deployed cockpit is a physical-robot surface and deliberately
        # shares twist_mux's physical default clock. It is not a simulation
        # launch and exposes no independent clock override that could drift
        # from the arbiter it mirrors.
        parameters=[{'use_sim_time': False}],
    )

    return LaunchDescription([
        use_camera_arg,
        use_bridge_arg,
        oak_params_arg,
        oak_launch,
        rosbridge_launch,
        depth_colorizer,
        overhead_clearance,
        cockpit_status,
    ])
