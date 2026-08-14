"""BEAST-01 standalone Nav2 behavior_server (PR-4a / Set 4a).

Lands stock ``ros-humble-nav2-behaviors`` action servers for the Hangar agent
command path without bringing up bt_navigator, planner, or a map:

  * /spin
  * /backup
  * /drive_on_heading
  * /wait

Frames are odom-only (see config/behavior_server.yaml). A rolling local
costmap consumes ``/scan`` for collision checking. Velocity flows through a
robot-side smoother that clamps linear motion to 0.15 m/s before publishing
onto twist_mux's ``/cmd_vel_nav`` input (priority 10). Human teleop on higher
mux rungs still wins.

---------------------------------------------------------------------------
INSTALL (Jetson) — required apt package
---------------------------------------------------------------------------
  sudo apt-get update
  sudo apt-get install -y ros-humble-nav2-behaviors \
    ros-humble-nav2-lifecycle-manager ros-humble-nav2-costmap-2d \
    ros-humble-nav2-velocity-smoother

Verified present on beast-01 (2026-08-02, read-only):
  ros-humble-nav2-behaviors 1.1.20-1jammy (arm64).

---------------------------------------------------------------------------
What this launch deliberately does NOT do
---------------------------------------------------------------------------
  * Does not set ``allow_motion`` / arm the robot.
  * Does not include itself from bringup or cockpit.launch — opt-in only.
  * Does not replace the mux e-stop lock. (It does not replace a cmd_vel
    watchdog either — there is none; it was removed 2026-08-07, owner
    decision D8. Anything driving here must stop by command.)

On-robot verify (motion locked — allow_motion false / default):

  ros2 launch ugv_cockpit behavior_server.launch.py
  ros2 action list   # expect /spin /backup /drive_on_heading /wait
  # Send a small Spin goal while disarmed; wheels must not move.
"""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    default_params = os.path.join(
        get_package_share_directory('ugv_cockpit'),
        'config',
        'behavior_server.yaml',
    )

    params_file_arg = DeclareLaunchArgument(
        'params_file',
        default_value=default_params,
        description=(
            'Path to the standalone behavior_server + lifecycle_manager '
            'ros__parameters YAML (ugv_cockpit/config/behavior_server.yaml).'
        ),
    )

    use_sim_time_arg = DeclareLaunchArgument(
        'use_sim_time',
        default_value='false',
        description='Use /clock (Gazebo). Must match twist_mux / bringup.',
    )

    autostart_arg = DeclareLaunchArgument(
        'autostart',
        default_value='true',
        description='Lifecycle manager transitions the behavior stack to active.',
    )

    # Remap timed_behavior.hpp's Twist publisher into the robot-side clamp.
    # Same reason as ugv_nav/launch/nav_bringup/navigation_launch.py —
    # without this remap, spin/backup/drive_on_heading drive /cmd_vel and
    # bypass both the clamp and twist_mux entirely.
    behavior_server_node = Node(
        package='nav2_behaviors',
        executable='behavior_server',
        name='behavior_server',
        output='screen',
        parameters=[
            LaunchConfiguration('params_file'),
            {
                'use_sim_time': ParameterValue(
                    LaunchConfiguration('use_sim_time'), value_type=bool
                ),
            },
        ],
        remappings=[
            ('/tf', 'tf'),
            ('/tf_static', 'tf_static'),
            ('cmd_vel', 'cmd_vel_behavior_raw'),
        ],
    )

    local_costmap_node = Node(
        package='nav2_costmap_2d',
        executable='nav2_costmap_2d',
        name='local_costmap',
        output='screen',
        parameters=[
            LaunchConfiguration('params_file'),
            {
                'use_sim_time': ParameterValue(
                    LaunchConfiguration('use_sim_time'), value_type=bool
                ),
            },
        ],
        remappings=[
            ('/tf', 'tf'),
            ('/tf_static', 'tf_static'),
        ],
    )

    velocity_smoother_node = Node(
        package='nav2_velocity_smoother',
        executable='velocity_smoother',
        name='velocity_smoother',
        output='screen',
        parameters=[
            LaunchConfiguration('params_file'),
            {
                'use_sim_time': ParameterValue(
                    LaunchConfiguration('use_sim_time'), value_type=bool
                ),
            },
        ],
        remappings=[
            ('cmd_vel', 'cmd_vel_behavior_raw'),
            ('smoothed_cmd_vel', 'cmd_vel_nav'),
        ],
    )

    lifecycle_manager_node = Node(
        package='nav2_lifecycle_manager',
        executable='lifecycle_manager',
        name='lifecycle_manager_behavior',
        output='screen',
        parameters=[
            LaunchConfiguration('params_file'),
            {
                'use_sim_time': ParameterValue(
                    LaunchConfiguration('use_sim_time'), value_type=bool
                ),
                'autostart': ParameterValue(
                    LaunchConfiguration('autostart'), value_type=bool
                ),
                'node_names': [
                    'local_costmap',
                    'behavior_server',
                    'velocity_smoother',
                ],
            },
        ],
    )

    return LaunchDescription([
        params_file_arg,
        use_sim_time_arg,
        autostart_arg,
        local_costmap_node,
        behavior_server_node,
        velocity_smoother_node,
        lifecycle_manager_node,
    ])
