# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
#
# Node structure adapted from LeoRover leo_robot-ros2 charging_monitor
# (MIT, https://github.com/LeoRover/leo_robot-ros2). Publishes
# sensor_msgs/BatteryState + std_msgs/Bool instead of leo_msgs.
"""ROS 2 node: INA219 → /ugv/voltage + /ugv/charging_active."""

from __future__ import annotations

import math
import struct
import time
from typing import Callable, Optional

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import BatteryState
from std_msgs.msg import Bool

from beast_power.ina219 import Ina219, SMBusLike
from beast_power.soc import (
    STATE_CRITICAL,
    STATE_MINUTES_TO_CUTOFF,
    STATE_RESERVE,
    STATE_UNKNOWN,
)
from beast_power.telemetry import (
    BatteryTelemetry,
    build_telemetry,
    to_battery_fields,
)


def _default_bus_factory() -> SMBusLike:
    import smbus2

    return smbus2.SMBus()


class PowerNode(Node):
    """Publish honest BatteryState and charging_active from the driver-board INA219.

    The sensor is the ROS driver board's battery monitor at 0x41 on i2c-7,
    verified live 2026-08-07 (see docs/beast-ops.md Quick connect).

    Sole owner of ``/ugv/voltage`` since the 2026-08-07 cutover: ugv_bringup no
    longer publishes BatteryState (its percentage was a fake V/12.6), and
    bringup_lidar.launch.py starts this node under the ``use_power`` argument.
    The service user must be in the ``i2c`` group.
    """

    def __init__(
        self,
        bus_factory: Optional[Callable[[], SMBusLike]] = None,
    ) -> None:
        super().__init__('beast_power')

        self.declare_parameter('i2c_bus_nr', 7)
        # 0x41 verified live on /dev/i2c-7 2026-08-07 (0x40 was a LeoRover default).
        self.declare_parameter('sensor_address', 0x41)
        self.declare_parameter('data_publish_rate', 1.0)
        self.declare_parameter('reconnect_interval_sec', 5.0)
        self.declare_parameter('current_sign', 1.0)
        self.declare_parameter('charging_current_threshold_a', 0.05)
        self.declare_parameter('voltage_topic', '/ugv/voltage')
        self.declare_parameter('charging_topic', '/ugv/charging_active')
        self.declare_parameter('frame_id', 'base_link')

        self._i2c_bus_nr = (
            self.get_parameter('i2c_bus_nr').get_parameter_value().integer_value
        )
        self._sensor_address = (
            self.get_parameter('sensor_address')
            .get_parameter_value()
            .integer_value
        )
        self._rate_hz = (
            self.get_parameter('data_publish_rate')
            .get_parameter_value()
            .double_value
        )
        self._reconnect_interval_sec = (
            self.get_parameter('reconnect_interval_sec')
            .get_parameter_value()
            .double_value
        )
        self._current_sign = (
            self.get_parameter('current_sign').get_parameter_value().double_value
        )
        self._charge_threshold = (
            self.get_parameter('charging_current_threshold_a')
            .get_parameter_value()
            .double_value
        )
        voltage_topic = (
            self.get_parameter('voltage_topic')
            .get_parameter_value()
            .string_value
        )
        charging_topic = (
            self.get_parameter('charging_topic')
            .get_parameter_value()
            .string_value
        )
        self._frame_id = (
            self.get_parameter('frame_id').get_parameter_value().string_value
        )

        if self._rate_hz <= 0:
            raise ValueError('data_publish_rate must be positive')
        if self._reconnect_interval_sec <= 0:
            raise ValueError('reconnect_interval_sec must be positive')
        if not math.isfinite(self._charge_threshold) or self._charge_threshold <= 0:
            raise ValueError('charging_current_threshold_a must be finite and > 0')

        factory = bus_factory or _default_bus_factory
        self._bus = factory()
        self._sensor = Ina219(
            self._bus,
            self._sensor_address,
            current_sign=self._current_sign,
        )
        self._sensor_ok = False
        self._next_open_attempt = 0.0

        self._voltage_pub = self.create_publisher(BatteryState, voltage_topic, 10)
        self._charging_pub = self.create_publisher(Bool, charging_topic, 10)

        self._timer = None
        self._last_pack_state = STATE_UNKNOWN

    def start(self) -> None:
        self._try_open_sensor()
        self._timer = self.create_timer(1.0 / self._rate_hz, self._publish_once)

    def _try_open_sensor(self) -> bool:
        now = time.monotonic()
        if now < self._next_open_attempt:
            return False
        self._next_open_attempt = now + self._reconnect_interval_sec
        try:
            self._sensor.open(self._i2c_bus_nr)
        except OSError as exc:
            self._sensor_ok = False
            self.get_logger().error(
                f'INA219 open failed ({exc}); retrying in '
                f'{self._reconnect_interval_sec:.1f}s and publishing '
                'absent-sensor status'
            )
            return False

        self._sensor_ok = True
        self.get_logger().info(
            f'INA219 ready on i2c-{self._i2c_bus_nr} '
            f'addr=0x{self._sensor_address:02x}; publishing at '
            f'{self._rate_hz:.1f} Hz'
        )
        return True

    def shutdown(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        self._sensor.close()

    def _publish_once(self) -> None:
        telemetry = self._sample()
        self._log_pack_state(telemetry)
        self._voltage_pub.publish(self._to_battery_msg(telemetry))
        charging = Bool()
        charging.data = telemetry.charging_active
        self._charging_pub.publish(charging)

    def _log_pack_state(self, telemetry: BatteryTelemetry) -> None:
        """Announce band changes once, with the measured minutes behind them.

        Edge-triggered, not throttled: at 1 Hz a level-triggered warning would
        emit 3600 identical lines an hour and get filtered out by the reader,
        which is how a real low-pack warning goes unseen. The percentage is
        deliberately NOT the thing reported here — the band is measured, the
        percentage still rides a borrowed chemistry table.
        """
        state = telemetry.pack_state
        if state == self._last_pack_state:
            return
        self._last_pack_state = state
        if state not in (STATE_RESERVE, STATE_CRITICAL):
            return
        low, high = STATE_MINUTES_TO_CUTOFF[state]
        log = (
            self.get_logger().error
            if state == STATE_CRITICAL
            else self.get_logger().warning
        )
        log(
            f'pack state {state}: {telemetry.voltage:.3f} V terminal at '
            f'{telemetry.current:+.2f} A -> OCV ~{telemetry.open_circuit_voltage:.3f} V; '
            f'~{low:.0f}-{high:.0f} min to cutoff at this load (measured)'
        )

    def _absent_telemetry(self) -> BatteryTelemetry:
        return build_telemetry(
            None,
            present=False,
            charging_current_threshold_a=self._charge_threshold,
        )

    def _drop_sensor(self, reason: str) -> None:
        """Close a failed bus and schedule reconnect.

        Any I²C failure — config probe or measurement read — lands here, so a
        wedged bus fd is reopened after ``reconnect_interval_sec`` instead of
        failing every publish tick until process restart.
        """
        self._sensor.close()
        self._sensor_ok = False
        self._next_open_attempt = time.monotonic() + self._reconnect_interval_sec
        self.get_logger().warning(reason)

    def _sample(self) -> BatteryTelemetry:
        if not self._sensor_ok and not self._try_open_sensor():
            return self._absent_telemetry()

        try:
            sensor_ready = self._sensor.ensure_ready()
        except (OSError, struct.error) as exc:
            self._drop_sensor(
                f'I2C config probe failed ({exc}); connection closed and retry scheduled'
            )
            return self._absent_telemetry()

        if not sensor_ready:
            self._drop_sensor(
                'I2C not responding; connection closed and retry scheduled'
            )
            return self._absent_telemetry()

        try:
            reading = self._sensor.read()
        except (OSError, struct.error) as exc:
            self._drop_sensor(
                f'I2C read failed ({exc}); connection closed and retry scheduled'
            )
            return self._absent_telemetry()

        return build_telemetry(
            reading,
            present=True,
            charging_current_threshold_a=self._charge_threshold,
        )

    def _to_battery_msg(self, telemetry: BatteryTelemetry) -> BatteryState:
        msg = BatteryState(**to_battery_fields(telemetry))
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = self._frame_id
        return msg


def main(args=None) -> None:
    rclpy.init(args=args)
    node = None
    try:
        node = PowerNode()
        node.start()
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        if node is not None:
            node.shutdown()
            node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
