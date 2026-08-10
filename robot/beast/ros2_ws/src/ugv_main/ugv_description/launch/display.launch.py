import os
import xacro
from launch import LaunchDescription
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from ament_index_python.packages import PackageNotFoundError, get_package_share_directory
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.conditions import IfCondition, UnlessCondition


def _share_or_none(package_name: str):
    try:
        return get_package_share_directory(package_name)
    except PackageNotFoundError:
        return None


# Resolve RViz configs only for the selected profile so optional packages
# (ugv_slam / ugv_nav) are not required when use_rviz:=false or when those
# packages are omitted from a bringup image.
def get_rviz_config_file(context):
    rviz_config = context.launch_configurations['rviz_config']

    ugv_description_dir = get_package_share_directory('ugv_description')
    ugv_bringup_dir = get_package_share_directory('ugv_bringup')

    config_map = {
        'description': os.path.join(ugv_description_dir, 'rviz', 'view_description.rviz'),
        'bringup': os.path.join(ugv_bringup_dir, 'rviz', 'view_bringup.rviz'),
    }

    if rviz_config in ('slam_2d', 'slam_3d'):
        ugv_slam_dir = get_package_share_directory('ugv_slam')
        config_map['slam_2d'] = os.path.join(ugv_slam_dir, 'rviz', 'view_slam_2d.rviz')
        config_map['slam_3d'] = os.path.join(ugv_slam_dir, 'rviz', 'view_slam_3d.rviz')
    elif rviz_config in ('nav_2d', 'nav_3d'):
        ugv_nav_dir = get_package_share_directory('ugv_nav')
        config_map['nav_2d'] = os.path.join(ugv_nav_dir, 'rviz', 'view_nav_2d.rviz')
        config_map['nav_3d'] = os.path.join(ugv_nav_dir, 'rviz', 'view_nav_3d.rviz')

    return config_map.get(rviz_config, config_map['description'])


def launch_setup(context, *args, **kwargs):
    rviz_config = context.launch_configurations['rviz_config']
    use_rviz = context.launch_configurations.get('use_rviz', 'false').lower() == 'true'
    share_dir = get_package_share_directory('ugv_description')
    UGV_MODEL = os.environ['UGV_MODEL']
    xacro_file_name = UGV_MODEL + '.xacro'
    xacro_file = os.path.join(
        share_dir,
        'urdf/bases',
        xacro_file_name)

    mappings = {"use_gazebo": "false"}
    robot_description_config = xacro.process_file(xacro_file, mappings=mappings)
    robot_description = robot_description_config.toxml()

    use_joint_state_publisher_gui = 'true' if rviz_config == 'description' else context.launch_configurations.get('use_joint_state_publisher_gui', 'false')

    robot_state_publisher_node = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        name='robot_state_publisher',
        parameters=[
            {'robot_description': robot_description}
        ]
    )

    joint_state_publisher_gui_node = Node(
        package='joint_state_publisher_gui',
        executable='joint_state_publisher_gui',
        name='joint_state_publisher_gui',
        condition=IfCondition(use_joint_state_publisher_gui)
    )

    nodes = [
        robot_state_publisher_node,
        joint_state_publisher_gui_node,
    ]

    # ros2_control is required by the full desktop bringup, but optional on
    # minimal images that intentionally omit controller_manager. Skip cleanly
    # when the package is absent so base lidar bringup can still start.
    if use_joint_state_publisher_gui != 'true' and _share_or_none('controller_manager') is not None:
        ros2_controllers_config = os.path.join(share_dir, 'config', 'ros2_controllers.yaml')
        nodes.append(Node(
            package="controller_manager",
            executable="ros2_control_node",
            parameters=[
                ros2_controllers_config
            ],
            remappings=[
                ("/controller_manager/robot_description", "/robot_description"),
            ],
            condition=UnlessCondition(use_joint_state_publisher_gui)
        ))
        for controller in ("joint_state_broadcaster", "pt_joint_position_controller"):
            nodes.append(Node(
                package='controller_manager',
                executable='spawner',
                arguments=[controller],
                condition=UnlessCondition(use_joint_state_publisher_gui)
            ))

    if use_rviz:
        rviz_config_file = get_rviz_config_file(context)
        nodes.append(Node(
            package='rviz2',
            executable='rviz2',
            name='rviz2',
            output='screen',
            arguments=['-d', rviz_config_file],
            condition=IfCondition(LaunchConfiguration('use_rviz'))
        ))

    return nodes


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('use_joint_state_publisher_gui', default_value='false', description='Whether to launch joint_state_publisher GUI'),
        DeclareLaunchArgument('use_rviz', default_value='false', description='Whether to launch RViz2'),
        DeclareLaunchArgument('rviz_config', default_value='description', description='Choose which rviz configuration to use: description, bringup, slam_2d, slam_3d, nav_2d, nav_3d'),
        OpaqueFunction(function=launch_setup)
    ])
