import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.substitutions import LaunchConfiguration
from launch.actions import DeclareLaunchArgument, OpaqueFunction, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.conditions import LaunchConfigurationEquals, IfCondition, UnlessCondition

import launch
from launch import LaunchContext
from launch.utilities import perform_substitutions

class LaunchConfigAsBool(launch.Substitution):
    """
    Converts a LaunchConfiguration value into a normalized boolean string: 'true' or 'false'.

    Allows CLI arguments like 'True', 'true', '1', 'yes' and 'False', 'false', '0', 'no'.
    Returns a string 'true' or 'false' for use in PythonExpression and IfCondition contexts.
    """

    def __init__(self, name: str) -> None:
        super().__init__()
        self._config = LaunchConfiguration(name)

    def perform(self, context: LaunchContext) -> str:
        value = perform_substitutions(context, [self._config])
        if value.strip().lower() in ['true', '1', 'yes', 'on']:
            return 'True'
        return 'False'

    def describe(self) -> str:
        return f'LaunchConfigAsBool({self._config.describe()})'

# Function to set up the launch description
def launch_setup(context, *args, **kwargs):
    # Get the package share directories for ugv_nav, nav2_bringup, and emcl2
    ugv_nav_dir = get_package_share_directory('ugv_nav')
    nav2_bringup_dir = get_package_share_directory('nav2_bringup')

    use_slam = context.launch_configurations['use_slam']

    use_sim_time = LaunchConfiguration('use_sim_time')
    use_localization = LaunchConfiguration('use_localization')
    use_localization_text = context.launch_configurations['use_localization']
    use_localplan = context.launch_configurations['use_localplan']
    
    # Get the paths to the different localplan config files
    teb_param_path = os.path.join(ugv_nav_dir, 'params', 'teb.yaml')
    dwa_param_path = os.path.join(ugv_nav_dir, 'params', 'dwa.yaml')
    rpp_param_path = os.path.join(ugv_nav_dir, 'params', 'rpp.yaml')
    mppi_param_path = os.path.join(ugv_nav_dir, 'params', 'mppi.yaml')

    # Create a dictionary to map the localplan and localization configurations to their respective config files
    config_map = {
        ('teb'): teb_param_path,
        ('dwa'): dwa_param_path,
        ('rpp'): rpp_param_path,
        ('mppi'): mppi_param_path,
    }
    param_file = config_map.get((use_localplan), teb_param_path)

    # Get the map yaml path
    map_yaml_path = LaunchConfiguration('map', default=os.path.join(ugv_nav_dir, 'maps', 'map.yaml'))
    pbstream_path = LaunchConfiguration('pbstream', default=os.path.join(ugv_nav_dir, 'maps', 'map.pbstream'))
    posegraph_path = LaunchConfiguration('posegraph', default=os.path.join(ugv_nav_dir, 'maps', 'map'))
    slam_toolbox_params_file = LaunchConfiguration('slam_toolbox_params_file', default=os.path.join(ugv_nav_dir, 'params', 'slam_toolbox_localization.yaml'))
    
    rviz_config = 'nav_2d'

    if use_localization_text=='rtabmap':
        rviz_config = 'nav_3d'

    # Include the bringup_lidar launch description.
    #
    # WARNING (BEAST-01): bringup_lidar.launch.py now also starts the command
    # spine (ugv_cockpit/launch/twist_mux.launch.py). On BEAST-01 the base stack
    # normally already runs as beast-ros-base.service, so launching this file
    # on top of a live service starts a SECOND twist_mux — two arbiters
    # publishing the same /cmd_vel from independent views of the ladder, which
    # is exactly the multi-publisher condition the spine exists to remove
    # (the e-stop lock only masks sources in the mux that receives it).
    # Stop the service first (`sudo systemctl stop beast-ros-base`) or launch
    # nav2 alone against the running base. There is no guard here: ROS 2 lets
    # duplicate nodes coexist, so this is a comment, not an assertion.
    bringup_lidar_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(get_package_share_directory('ugv_bringup'), 'launch', 'bringup_lidar.launch.py')),
        launch_arguments={
            'use_rviz': LaunchConfiguration('use_rviz'),
            'rviz_config': rviz_config,
            'allow_motion': LaunchConfiguration('allow_motion'),
        }.items(),
        condition=IfCondition(
            launch.substitutions.PythonExpression([
                "'", LaunchConfiguration('use_sim_time'), "' == 'false' and ",
                "'", LaunchConfiguration('start_base'), "' == 'true'"
            ])
        )
    )

    bringup_gazebo_launch = IncludeLaunchDescription(PythonLaunchDescriptionSource(
        [os.path.join(get_package_share_directory('ugv_gazebo'), 'launch'),
         '/bringup_gazebo.launch.py']),
        launch_arguments={
            'use_rviz': LaunchConfiguration('use_rviz'),
            'rviz_config': rviz_config,
        }.items(),
        condition=IfCondition(use_sim_time)        
    )

    oak_d_lite_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
        [os.path.join(get_package_share_directory('ugv_vision'), 'launch'),
            '/oak_d_lite.launch.py']
        ),
        condition=UnlessCondition(use_sim_time),
    )

    nav2_bringup_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(ugv_nav_dir, 'launch/nav_bringup', 'nav2_bringup.launch.py')),
        launch_arguments={
            'map': map_yaml_path,
            'pbstream': pbstream_path,
            'posegraph': posegraph_path,
            'params_file': param_file,
            'slam_toolbox_params_file': slam_toolbox_params_file,
            'use_sim_time': use_sim_time,
            'use_localization': use_localization,
            'use_slam': use_slam,
            'use_keepout_zones': LaunchConfiguration('use_keepout_zones'),
            'keepout_mask': LaunchConfiguration('keepout_mask'),
        }.items(),
    )
    
    # Include the robot_pose_publisher launch description
    robot_pose_publisher_launch = IncludeLaunchDescription(PythonLaunchDescriptionSource(
        [os.path.join(get_package_share_directory('robot_pose_publisher'), 'launch'),
         '/robot_pose_publisher_launch.py']),
        launch_arguments={
            'use_sim_time': use_sim_time,
        }.items(),
    ) 
    
    if use_localization_text=='rtabmap':
        # Return the list of launch descriptions
        return [
            oak_d_lite_launch,
            bringup_lidar_launch,
            bringup_gazebo_launch,
            nav2_bringup_launch,
            robot_pose_publisher_launch,
        ]
    else:     
        return [
            bringup_lidar_launch,
            bringup_gazebo_launch,
            nav2_bringup_launch,
            robot_pose_publisher_launch,
        ]

# Function to generate the launch description
def generate_launch_description():
    # Return the launch description
    ugv_nav_dir = get_package_share_directory('ugv_nav')

    return LaunchDescription([
        DeclareLaunchArgument('use_sim_time',default_value='false',description='Use simulation/Gazebo clock'),
        DeclareLaunchArgument('start_base', default_value='false', description='Launch bringup_lidar. Set to false if beast-ros-base is running.'),
        DeclareLaunchArgument('use_slam',default_value='false',description='Whether run a SLAM'),
        DeclareLaunchArgument('use_rviz', default_value='false',description='Whether to launch RViz2'),
        DeclareLaunchArgument(
            'allow_motion',
            default_value='true',
            description=(
                'Forwarded to bringup_lidar; the manual allow_motion gate remains available. '
                'Never stack this launch on a live beast-ros-base (second twist_mux) — '
                'stop the service first.'
            ),
        ),
        DeclareLaunchArgument('use_localplan', default_value='teb', description='Choose which localplan to use: dwa,teb,rpp,mppi'),
        DeclareLaunchArgument('use_localization', default_value='amcl', description='Choose which localization to use: amcl,emcl,cartographer,slam_toolbox,rtabmap'),
        DeclareLaunchArgument('use_keepout_zones', default_value='false', description='Enable Nav2 keepout zones'),
        DeclareLaunchArgument(
            'keepout_mask',
            default_value=os.path.join(ugv_nav_dir, 'maps', 'mask.yaml'),
            description='Path to keepout mask yaml'),
        OpaqueFunction(function=launch_setup)
    ])

# Main function to run the launch description
if __name__ == '__main__':
    generate_launch_description()
