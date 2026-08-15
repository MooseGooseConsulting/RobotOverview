"""BEAST-01 base node — ESP32 serial bridge + sensor republish (runs on the Jetson).

Extracted from ``ugv_bringup`` in Phase 1 of the ROS strip-down work order
(docs/plans/2026-08-07-beast-ros-drift-inventory-and-stripdown.md); behaviour is
preserved, not rewritten.

No AI-added cmd_vel silence watchdog: the ESP32 may retain its last command when a
source goes silent, so command-source zero tails and the manual gate matter. This node
sends an unconditional T:13 stop during startup before any other work. The only software
motion gate is `allow_motion` (parameter + `/ugv/set_allow_motion` service).

Telemetry honesty (see also RobotOverview docs/beast-ops.md Quick connect):
  MOVED    /ugv/voltage is owned by beast_power (driver-board INA219, real volts
           + signed current + status) since the 2026-08-07 cutover. This node no
           longer publishes BatteryState — its old percentage was a fake V/12.6.
  REAL     ESP32 JSON "v" is still read here, but only to gate the low-battery
           voice warning (its ADC reads ~1.2% low vs the INA219).
  ASSUMED  IMU/mag LSB scales (vendor ICM-20948); odom odl/odr ÷100 as cm→m

Calibration: do not "tune" ASSUMED fields. Vendor IMU scales are fine to start
(spot-check 1 g at rest). Calibrate wheel odom / EKF before mapping. Mag only if
using compass.

Deploy to beast-01: edit RobotOverview/robot/beast/ros2_ws → merge the
RobotOverview PR → the merge advances refs/deploy/beast-01 and the robot's
hourly beast-pull agent rebuilds, restarts, and verifies on its own (see
deploy/README.md). The Hangar web app never deploys to the robot.
"""

import rclpy
from rclpy.node import Node
from rclpy.parameter import Parameter
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile
from rcl_interfaces.msg import SetParametersResult
from std_msgs.msg import Header, Bool, Float32MultiArray
from std_srvs.srv import SetBool
from geometry_msgs.msg import Twist
from sensor_msgs.msg import Imu, MagneticField, JointState

import os
import json
import threading
import time
import netifaces

from .base_ctrl import BaseController
from .beast_audio import LowBatteryVoice

def get_all_ips():
    ip_dict = {}
    interfaces = netifaces.interfaces()
    for iface in interfaces:
        if iface == 'lo':
            continue
        addrs = netifaces.ifaddresses(iface)
        inet = addrs.get(netifaces.AF_INET)
        if inet:
            ip_dict[iface] = inet[0]['addr']
    return ip_dict


def select_interface_ip(ip_map, configured_name, interface_kind):
    if configured_name:
        return ip_map.get(configured_name, "N/A")

    if interface_kind == 'wifi':
        candidates = [
            name for name in ip_map
            if name.startswith('wl')
            or os.path.isdir(f'/sys/class/net/{name}/wireless')
        ]
    else:
        candidates = [
            name for name in ip_map
            if name == 'eth0' or name.startswith('en')
        ]

    return ip_map[sorted(candidates)[0]] if candidates else "N/A"


def default_serial_port():
    configured = os.getenv('UGV_SERIAL_PORT')
    if configured:
        return configured
    if os.path.exists('/etc/nv_tegra_release'):
        # cp210x re-enumeration lands on the by-id path, not ttyTHS1 (verified
        # live 2026-08-07). The deployed truth is UGV_SERIAL_PORT in
        # deploy/systemd/ugv.env.example; this is only the no-env fallback.
        return '/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00'
    return '/dev/ttyAMA0'


# ROS node class for bringing up the UGV system and publishing sensor data
class BeastBaseNode(Node):
    def __init__(self):
        super().__init__('beast_base')
        # Publishers for IMU data, magnetic field data, odometry, and voltage
        # self.imu_data_raw_publisher_ = self.create_publisher(Imu, "imu/data_raw", 20)
        # Canonical topic is imu/data (EKF / rf2o / odom_publisher / cockpit).
        # imu/raw is a same-payload alias for acceptance scripts that still echo it.
        self.imu_data_publisher_ = self.create_publisher(Imu, "imu/data", 20)
        self.imu_data_raw_publisher_ = self.create_publisher(Imu, "imu/raw", 20)
        self.imu_mag_publisher_ = self.create_publisher(MagneticField, "imu/mag", 20)
        self.odom_publisher_ = self.create_publisher(Float32MultiArray, "odom/odom_raw", 20)
        # /ugv/voltage is beast_power's (sole owner since 2026-08-07). The ESP32
        # "v" field is still consumed below, but only for the voice warning.

        # Subscribe to velocity commands (cmd_vel topic)
        self.cmd_vel_sub_ = self.create_subscription(Twist, "cmd_vel", self.cmd_vel_callback, 20)
        # Subscribe to joint states (joint_states topic)
        self.joint_states_sub = self.create_subscription(JointState, 'joint_states', self.joint_states_callback, 20)
        self.last_pt_sent_data = None
        # Subscribe to LED control data (ugv/led_ctrl topic)
        self.led_ctrl_sub = self.create_subscription(Float32MultiArray, 'ugv/led_ctrl', self.led_ctrl_callback, 20)

        self.pt_steady_ctrl_sub = self.create_subscription(Float32MultiArray, 'ugv/pt_steady_ctrl', self.pt_steady_ctrl_callback, 20)

        self.declare_parameter('serial_port', default_serial_port())
        self.declare_parameter('baud_rate', 115200)
        self.declare_parameter('wifi_interface', '')
        self.declare_parameter('ethernet_interface', '')
        self.declare_parameter('allow_motion', True)
        serial_port_name = self.get_parameter('serial_port').value
        baud_rate = self.get_parameter('baud_rate').value
        self.wifi_interface = self.get_parameter('wifi_interface').value
        self.ethernet_interface = self.get_parameter('ethernet_interface').value
        self.allow_motion = bool(self.get_parameter('allow_motion').value)
        self._applying_allow_motion = False

        # Initialize the base controller with the UART port and baud rate
        self.base_controller = BaseController(serial_port_name, baud_rate)
        self._voice = LowBatteryVoice(
            self.base_controller.send_command, self.get_logger
        )
        self._disarmed_cmd_warn_interval = 5.0
        self._last_disarmed_cmd_warn = 0.0
        request_data = json.dumps({"T":131,"cmd":1}) + "\n"
        self.base_controller.send_command(request_data.encode())
        # Unconditional stop at startup: clear any velocity the ESP32 may be
        # latching from before this node started, regardless of allow_motion.
        self.send_stop_command()

        # Safety state for the cockpit. /ugv/allow_motion is the enforced gate
        # value this node latched at startup — not the parameter server's current
        # value, which nothing re-reads. Publishing the enforced value makes the
        # cockpit's gate honest.
        #
        # ORDERING IS LOAD-BEARING: this publisher is created AFTER the serial
        # port is open and the startup stop has been sent. Creating a publisher
        # can raise (QoS/RMW/name errors), and a raise here before the stop would
        # leave a robot whose ESP32 is still latching whatever velocity it held
        # at power-on, with no node alive to stop it. Telemetry for the cockpit
        # is never allowed to precede the robot's own safing.
        safety_qos = QoSProfile(
            depth=1,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            history=HistoryPolicy.KEEP_LAST,
        )
        self.allow_motion_publisher_ = self.create_publisher(
            Bool, '/ugv/allow_motion', safety_qos
        )
        self.publish_allow_motion()

        # 1 Hz heartbeat of the same latched value. TRANSIENT_LOCAL durability
        # delivers to LATE subscribers, but cockpit_status judges bringup
        # liveness by message FRESHNESS (BRINGUP_STALE_S = 3 s): a sample
        # published once at startup ages out and the cockpit reports
        # allow_motion UNKNOWN forever — observed live on the robot
        # 2026-08-07. The heartbeat is that liveness signal, not ceremony.
        self._allow_motion_heartbeat = self.create_timer(
            1.0, self.publish_allow_motion
        )
        self.create_service(
            SetBool, '/ugv/set_allow_motion', self._set_allow_motion_cb
        )
        self.add_on_set_parameters_callback(self._on_set_parameters)

        # Software Watchdog
        self._last_cmd_vel_time = self.get_clock().now()
        # True if we sent a non-zero velocity recently, preventing unnecessary duplicate zeroes
        self._is_moving = False 
        self._watchdog_timer = self.create_timer(0.1, self._watchdog_callback)

        # Timer to periodically execute the feedback loop
        self.feedback_thread = threading.Thread(target=self.feedback_loop_thread, daemon=True)
        self.feedback_thread.start()
        self.ip_thread = threading.Thread(target=self.ip_thread_func, daemon=True)
        self.ip_thread.start()

        self.set_ugv_version()

    def publish_allow_motion(self):
        msg = Bool()
        msg.data = bool(self.allow_motion)
        self.allow_motion_publisher_.publish(msg)

    def apply_allow_motion(self, allow, source='unknown'):
        """Flip the enforced motion gate and stop immediately when disabling."""
        desired = bool(allow)
        previous = bool(self.allow_motion)
        if desired == previous:
            return previous, desired

        self.allow_motion = desired
        if previous and not desired:
            self.send_stop_command()
            self.get_logger().warning(
                f'allow_motion disabled via {source}; stop sent immediately'
            )
        elif not previous and desired:
            self.get_logger().warning(f'allow_motion enabled via {source}')
        if getattr(self, 'allow_motion_publisher_', None) is not None:
            self.publish_allow_motion()
        return previous, desired

    def _set_allow_motion_cb(self, request, response):
        previous, desired = self.apply_allow_motion(
            request.data, source='service:/ugv/set_allow_motion'
        )
        if previous != desired:
            self._applying_allow_motion = True
            try:
                self.set_parameters([
                    Parameter('allow_motion', Parameter.Type.BOOL, desired)
                ])
            finally:
                self._applying_allow_motion = False
        response.success = True
        response.message = (
            f'allow_motion={str(desired).lower()} '
            f'(was {str(previous).lower()})'
        )
        return response

    def _on_set_parameters(self, params):
        result = SetParametersResult(successful=True)
        if self._applying_allow_motion:
            return result
        for param in params:
            if param.name != 'allow_motion':
                continue
            if param.type_ != Parameter.Type.BOOL:
                result.successful = False
                result.reason = 'allow_motion must be a bool'
                return result
            self.apply_allow_motion(
                param.value, source='parameter:allow_motion'
            )
        return result

    def set_ugv_version(self):
        model = os.getenv("UGV_MODEL", "ugv_rover")
        ugv_main = 2

        if model == "ugv_rover":
            ugv_main = 2
        elif model == "ugv_beast":
            ugv_main = 3
        elif model == "rasp_rover":
            ugv_main = 1
        else:
            ugv_main = 2

        version_data = json.dumps({"T":900,"main":ugv_main,"module":"0"}) + "\n"
        self.base_controller.send_command(version_data.encode())

    def feedback_loop_thread(self):
        rate = self.create_rate(20)
        while rclpy.ok():
            try:
                data = self.base_controller.feedback_data()
                self.base_controller.base_data = data
                if data and data["T"] == 1001:
                    self.publish_imu_mag()
                    self.publish_odom_raw()
                    self._voice.check(data)
                    self.publish_imu_data_raw()

            except Exception as e:
                self.get_logger().error(f"[feedback_loop_thread] error: {e}")
            rate.sleep()

    def ip_thread_func(self):
        last_wlan_ip = None
        last_eth_ip = None

        rate = self.create_rate(20)

        while rclpy.ok():
            ip_map = get_all_ips()
            wlan_ip = select_interface_ip(ip_map, self.wifi_interface, 'wifi')
            eth_ip = select_interface_ip(ip_map, self.ethernet_interface, 'ethernet')

            if wlan_ip != last_wlan_ip:
                last_wlan_ip = wlan_ip
                data = json.dumps({'T': '3', 'lineNum': 1, 'Text': f"W:{wlan_ip}"}) + "\n"
                self.base_controller.send_command(data.encode())

            if eth_ip != last_eth_ip:
                last_eth_ip = eth_ip
                data = json.dumps({'T': '3', 'lineNum': 0, 'Text': f"E:{eth_ip}"}) + "\n"
                self.base_controller.send_command(data.encode())

            rate.sleep()

    # Publish IMU data to the ROS topic "imu/data_raw"
    def publish_imu_data_raw(self):
        msg = Imu()
        msg.header = Header()
        msg.header.stamp = self.get_clock().now().to_msg()  # Get the current timestamp
        # ASSUMED: sensor is not at the chassis origin; covariances left at msg defaults (0).
        msg.header.frame_id = "base_link"
        imu_raw_data = self.base_controller.base_data

        # ASSUMED vendor scale (ICM-20948 ±4g / 8192 LSB/g) — not calibrated on this robot.
        msg.linear_acceleration.x = 9.8 * float(imu_raw_data["ax"]) / 8192
        msg.linear_acceleration.y = 9.8 * float(imu_raw_data["ay"]) / 8192
        msg.linear_acceleration.z = 9.8 * float(imu_raw_data["az"]) / 8192

        # ASSUMED vendor scale (±2000 dps / 16.4 LSB/dps) — not calibrated on this robot.
        msg.angular_velocity.x = 3.1415926 * float(imu_raw_data["gx"]) / (16.4 * 180)
        msg.angular_velocity.y = 3.1415926 * float(imu_raw_data["gy"]) / (16.4 * 180)
        msg.angular_velocity.z = 3.1415926 * float(imu_raw_data["gz"]) / (16.4 * 180)

        # REP-145: orientation_covariance[0] < 0 means orientation is not provided.
        msg.orientation_covariance[0] = -1.0
        # Conservative diagonal cov so EKF does not treat gyros as perfect.
        msg.angular_velocity_covariance[0] = 0.02
        msg.angular_velocity_covariance[4] = 0.02
        msg.angular_velocity_covariance[8] = 0.02
        msg.linear_acceleration_covariance[0] = 0.04
        msg.linear_acceleration_covariance[4] = 0.04
        msg.linear_acceleration_covariance[8] = 0.04

        if hasattr(self, "imu_data_publisher_"):
            self.imu_data_publisher_.publish(msg)
        self.imu_data_raw_publisher_.publish(msg)

    # Publish magnetic field data to the ROS topic "imu/mag"
    def publish_imu_mag(self):
        msg = MagneticField()
        msg.header = Header()
        msg.header.stamp = self.get_clock().now().to_msg()  # Get the current timestamp
        # ASSUMED: same frame_id caveat as imu/raw; covariances left at defaults.
        msg.header.frame_id = "base_link"
        imu_raw_data = self.base_controller.base_data

        # ASSUMED vendor scale (0.15 µT/LSB) — not calibrated on this robot.
        msg.magnetic_field.x = float(imu_raw_data["mx"]) * 0.15
        msg.magnetic_field.y = float(imu_raw_data["my"]) * 0.15
        msg.magnetic_field.z = float(imu_raw_data["mz"]) * 0.15

        self.imu_mag_publisher_.publish(msg)  # Publish the magnetic field data

    # Publish odometry data to the ROS topic "odom/odom_raw" m
    def publish_odom_raw(self):
        odom_raw_data = self.base_controller.base_data
        # ASSUMED: odl/odr are cm from firmware (/100 → m). L/R are ESP32-reported wheel
        # speeds as-is — not fused odometry; EKF consumers must not treat this as ground truth.
        array = [odom_raw_data["odl"]/100, odom_raw_data["odr"]/100,odom_raw_data["L"], odom_raw_data["R"]]
        msg = Float32MultiArray(data=array)
        self.odom_publisher_.publish(msg)  # Publish the odometry data

    # Callback for processing velocity commands m/s
    def cmd_vel_callback(self, msg):
        self._last_cmd_vel_time = self.get_clock().now()
        linear_velocity = msg.linear.x
        angular_velocity = msg.angular.z

        if not self.allow_motion:
            if linear_velocity != 0.0 or angular_velocity != 0.0:
                now = time.monotonic()
                if now - self._last_disarmed_cmd_warn >= self._disarmed_cmd_warn_interval:
                    self._last_disarmed_cmd_warn = now
                    self.get_logger().warning(
                        'Rejected non-zero cmd_vel while allow_motion is false'
                    )
                self.send_stop_command()
                self._is_moving = False
            return

        self._is_moving = (linear_velocity != 0.0 or angular_velocity != 0.0)

        # Send the velocity data to the UGV as a JSON string
        data = json.dumps({'T': '13', 'X': linear_velocity, 'Z': angular_velocity}) + "\n"
        self.base_controller.send_command(data.encode())

    def _watchdog_callback(self):
        if not self._is_moving:
            return
        elapsed = self.get_clock().now() - self._last_cmd_vel_time
        if elapsed.nanoseconds > 500_000_000:
            self.get_logger().warning('Watchdog timeout: no cmd_vel received for 500ms, stopping robot')
            self.send_stop_command()
            self._is_moving = False

    def send_stop_command(self):
        data = json.dumps({'T': '13', 'X': 0.0, 'Z': 0.0}) + "\n"
        self.base_controller.send_command(data.encode())

    def joint_states_callback(self, msg):
        if len(msg.name) != len(msg.position):
            self.get_logger().warning(
                'Malformed joint_states: name/position length mismatch; ignoring'
            )
            return

        required = ('pt_base_link_to_pt_link1', 'pt_link1_to_pt_link2')
        if not all(joint in msg.name for joint in required):
            self.get_logger().warning(
                f'Malformed joint_states: missing one of {required}; ignoring'
            )
            return

        header = {
            'stamp': {
                'sec': msg.header.stamp.sec,
                'nanosec': msg.header.stamp.nanosec,
            },
            'frame_id': msg.header.frame_id,
        }

        # Extract joint positions and convert to degrees
        name = msg.name
        position = msg.position

        x_rad = position[name.index('pt_base_link_to_pt_link1')]
        y_rad = position[name.index('pt_link1_to_pt_link2')]

        x_degree = (180 * x_rad) / 3.1415926
        y_degree = (180 * y_rad) / 3.1415926

        # Send the joint data as a JSON string to the UGV
        joint_data = json.dumps({
            'T': 133,
            'X': -x_degree,
            'Y': y_degree,
            "SPD": 0,
            "ACC": 0,
        }) + "\n"

        if joint_data == self.last_pt_sent_data:
            return

        self.last_pt_sent_data = joint_data

        self.base_controller.send_command(joint_data.encode())

    # Callback for processing LED control commands 0-255
    def led_ctrl_callback(self, msg):
        if len(msg.data) < 2:
            self.get_logger().warning(
                'Malformed led_ctrl: expected at least 2 values; ignoring'
            )
            return

        IO4 = msg.data[0]
        IO5 = msg.data[1]

        IO4 = max(0, min(IO4, 255))
        IO5 = max(0, min(IO5, 255))

        # Send LED control data as a JSON string to the UGV
        led_ctrl_data = json.dumps({
            'T': 132,
            "IO4": IO4,
            "IO5": IO5,
        }) + "\n"

        self.base_controller.send_command(led_ctrl_data.encode())

    def pt_steady_ctrl_callback(self, msg):
        if len(msg.data) < 2:
            self.get_logger().warning(
                'Malformed pt_steady_ctrl: expected at least 2 values; ignoring'
            )
            return

        mode = int(msg.data[0])
        y_value = msg.data[1]

        mode = max(0, min(mode, 1))

        # Send LED control data as a JSON string to the UGV
        pt_steady_ctrl_data = json.dumps({
            'T': 137,
            "s": mode,
            "y": y_value,
        }) + "\n"

        self.base_controller.send_command(pt_steady_ctrl_data.encode())


# Main function to initialize the ROS node and start spinning
def main(args=None):
    rclpy.init(args=args)  # Initialize ROS
    node = BeastBaseNode()  # Create the BEAST-01 base node
    try:
        rclpy.spin(node)  # Keep the node running
    except Exception as exc:
        node.get_logger().error(f'Unhandled exception in spin: {exc}')
        try:
            node.send_stop_command()
        except Exception as stop_exc:
            node.get_logger().error(
                f'Failed to send stop after spin failure: {stop_exc}'
            )
        raise
    finally:
        node.destroy_node()  # Shutdown ROS
        if rclpy.ok():
            rclpy.shutdown()  # Shutdown ROS

if __name__ == '__main__':
    main()
