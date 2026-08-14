#!/usr/bin/env python3
import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import EnvironmentVariable, LaunchConfiguration
from launch_ros.actions import Node
from launch.conditions import IfCondition
from ament_index_python.packages import get_package_share_directory


def launch_setup(context, *args, **kwargs):
    LDLIDAR_MODEL = os.environ.get('LDLIDAR_MODEL', 'ld19').lower()
    product_name_map = {
        'ld06': 'LDLiDAR_LD06',
        'ld19': 'LDLiDAR_LD19',
        'stl27l': 'LDLiDAR_STL27L'
    }

    port_baudrate_map = {
        'ld06': 230400,
        'ld19': 230400,
        'stl27l': 921600
    }

    product_name = product_name_map.get(LDLIDAR_MODEL)
    port_baudrate = port_baudrate_map.get(LDLIDAR_MODEL)

    if not product_name:
        raise ValueError(f"Unsupported LDLIDAR_MODEL: {LDLIDAR_MODEL}")

    ldlidar_node = Node(
        package='ldlidar',
        executable='ldlidar_node',
        name=product_name,
        output='screen',
        parameters=[{
            'product_name': product_name,
            'topic_name': LaunchConfiguration('topic_name'),
            'frame_id': LaunchConfiguration('frame_id'),
            'port_name': LaunchConfiguration('port_name'),
            'port_baudrate': port_baudrate,
            'laser_scan_dir': LaunchConfiguration('laser_scan_dir'),
            'enable_angle_crop_func': LaunchConfiguration('enable_angle_crop_func'),
            'angle_crop_min': LaunchConfiguration('angle_crop_min'),
            'angle_crop_max': LaunchConfiguration('angle_crop_max'),
            'bins': LaunchConfiguration('bins')
        }]
    )

    rviz_config = os.path.join(
        get_package_share_directory('ldlidar'),
        'rviz',
        'view.rviz'
    )

    rviz2_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2_show_ldlidar',
        arguments=['-d', rviz_config],
        condition=IfCondition(LaunchConfiguration('use_rviz')),
        output='screen'
    )

    return [ldlidar_node, rviz2_node]

def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('topic_name', default_value='scan'),
        DeclareLaunchArgument('frame_id', default_value='base_lidar_link'),
        DeclareLaunchArgument('port_name', default_value='/dev/ttyACM0'),
        DeclareLaunchArgument('laser_scan_dir', default_value='true'),
        # bins/crop defaults come from /etc/beast/ugv.env (see ugv.env.example).
        DeclareLaunchArgument(
            'enable_angle_crop_func',
            default_value=EnvironmentVariable(
                'UGV_LIDAR_ENABLE_ANGLE_CROP', default_value='true'
            ),
        ),
        DeclareLaunchArgument(
            'angle_crop_min',
            default_value=EnvironmentVariable(
                'UGV_LIDAR_ANGLE_CROP_MIN', default_value='218.0'
            ),
        ),
        DeclareLaunchArgument(
            'angle_crop_max',
            default_value=EnvironmentVariable(
                'UGV_LIDAR_ANGLE_CROP_MAX', default_value='322.0'
            ),
        ),
        DeclareLaunchArgument(
            'bins',
            default_value=EnvironmentVariable(
                'UGV_LIDAR_BINS', default_value='480'
            ),
        ),
        DeclareLaunchArgument('use_rviz', default_value='false'),
        OpaqueFunction(function=launch_setup)
    ])
