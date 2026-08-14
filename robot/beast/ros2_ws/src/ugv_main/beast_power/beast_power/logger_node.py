# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""ROS 2 node: durable CSV log of /ugv/voltage + /ugv/charging_active."""

from __future__ import annotations

import math
import sys
import time
from datetime import datetime, timezone
from typing import Optional

import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile, ReliabilityPolicy
from sensor_msgs.msg import BatteryState
from std_msgs.msg import Bool

from beast_power.logging_core import (
    ChargeIntegrator,
    DurableCsvWriter,
    LogAlreadyActive,
    build_row,
    resume_integrator,
    utc_is_real_clock,
)
from beast_power.soc import legacy_fake_percentage


class PowerLogger(Node):
    """Record what ``beast_power`` publishes, durably, for offline analysis.

    Subscribes rather than opening its own I²C handle. ``beast_power`` is the
    sole owner of the sensor since the 2026-08-07 cutover, so a second reader
    would contend on the bus and — worse — could disagree with the topic the
    rest of the stack acts on. What this file records is what the robot
    believed at the time, which is the thing worth having after a brownout.

    Runs in the same launch as ``beast_power`` under ``use_power``, so the log
    starts and stops with the sensor it describes.
    """

    def __init__(self) -> None:
        super().__init__('beast_power_logger')

        self.declare_parameter('output_path', '/data/beast/power/power-log.csv')
        self.declare_parameter('voltage_topic', '/ugv/voltage')
        self.declare_parameter('charging_topic', '/ugv/charging_active')
        self.declare_parameter('max_bytes', 64 * 1024 * 1024)
        self.declare_parameter('backup_count', 5)
        # 1 = every sample durable before the next is taken. The pack can cut
        # power between any two rows; that is the event being measured.
        self.declare_parameter('fsync_every_n', 1)
        self.declare_parameter('max_gap_s', 10.0)
        self.declare_parameter('log_absent_samples', True)

        output_path = (
            self.get_parameter('output_path').get_parameter_value().string_value
        )
        voltage_topic = (
            self.get_parameter('voltage_topic').get_parameter_value().string_value
        )
        charging_topic = (
            self.get_parameter('charging_topic').get_parameter_value().string_value
        )
        max_bytes = (
            self.get_parameter('max_bytes').get_parameter_value().integer_value
        )
        backup_count = (
            self.get_parameter('backup_count').get_parameter_value().integer_value
        )
        fsync_every_n = (
            self.get_parameter('fsync_every_n').get_parameter_value().integer_value
        )
        max_gap_s = (
            self.get_parameter('max_gap_s').get_parameter_value().double_value
        )
        self._log_absent = (
            self.get_parameter('log_absent_samples')
            .get_parameter_value()
            .bool_value
        )

        if not math.isfinite(max_gap_s) or max_gap_s <= 0:
            raise ValueError('max_gap_s must be positive and finite')

        resumed_mah, resumed_wh = resume_integrator(output_path)
        self._integrator = ChargeIntegrator(
            max_gap_s=max_gap_s,
            charge_mah=resumed_mah,
            energy_wh=resumed_wh,
        )
        self._writer = DurableCsvWriter(
            output_path,
            max_bytes=max_bytes,
            backup_count=backup_count,
            fsync_every_n=fsync_every_n,
        )

        self._last_mono: Optional[float] = None
        self._charging: Optional[bool] = None
        self._rows = 0
        self._pre_clock_rows = 0
        self._start_note = 'session_start'

        # Battery telemetry is sampled state, not a stream to replay: keep the
        # last message and tolerate loss rather than blocking the publisher.
        qos = QoSProfile(
            history=HistoryPolicy.KEEP_LAST,
            depth=10,
            reliability=ReliabilityPolicy.BEST_EFFORT,
            durability=DurabilityPolicy.VOLATILE,
        )
        self._battery_sub = self.create_subscription(
            BatteryState, voltage_topic, self._on_battery, qos
        )
        self._charging_sub = self.create_subscription(
            Bool, charging_topic, self._on_charging, qos
        )

        self.get_logger().info(
            f'Power logging to {self._writer.path} '
            f'(fsync every {fsync_every_n} row(s), rotate at '
            f'{max_bytes // (1024 * 1024)} MiB, keep {backup_count}; '
            f'resumed {resumed_mah:.1f} mAh / {resumed_wh:.2f} Wh)'
        )

    def _on_charging(self, msg: Bool) -> None:
        self._charging = bool(msg.data)

    def _on_battery(self, msg: BatteryState) -> None:
        if not msg.present and not self._log_absent:
            return

        # time.monotonic, not the ROS clock: dt feeds charge integration, and
        # an NTP step on a robot that boots without a network would otherwise
        # inject a fictitious hour of current into the capacity measurement.
        mono = time.monotonic()
        dt = 0.0 if self._last_mono is None else mono - self._last_mono
        self._last_mono = mono

        voltage = msg.voltage if math.isfinite(msg.voltage) else None
        current = msg.current if math.isfinite(msg.current) else None

        self._integrator.add(current, voltage, dt)

        utc = datetime.now(timezone.utc).isoformat(
            timespec='milliseconds'
        ).replace('+00:00', 'Z')

        note = self._start_note
        self._start_note = ''

        # No RTC battery: a cold boot stamps epoch-1970 until NTP steps the
        # clock (~100 s). Those timestamps poisoned every Vmax analysis and
        # needed a hand GC — but the *sample* is real. Voltage, current, and
        # the monotonic integral above are all valid; only the wall clock is
        # not. So drop the bad cell, not the row: write an empty utc (this
        # file's "not measured" convention, see _num) and mark the row so
        # analysis can filter it. A session whose clock never syncs — fresh
        # flash, wiped /var, timesyncd off — therefore still lands its
        # evidence instead of logging nothing at all for the whole run.
        if not utc_is_real_clock(utc):
            utc = ''
            note = f'{note} pre_ntp_clock'.strip()
            self._pre_clock_rows += 1
            if self._pre_clock_rows == 1:
                self.get_logger().warning(
                    'System clock is pre-NTP (epoch); logging rows with an '
                    'empty utc and note=pre_ntp_clock until it syncs.'
                )
        elif self._pre_clock_rows:
            # Mark the transition in the CSV itself. Without it the first
            # post-sync row shows a charge_mah jump against a small dt_s with
            # nothing in the file explaining the discontinuity.
            self.get_logger().info(
                f'Clock synced; {self._pre_clock_rows} row(s) carry '
                'note=pre_ntp_clock'
            )
            note = f'{note} clock_synced'.strip()
            self._pre_clock_rows = 0

        legacy = legacy_fake_percentage(voltage) if voltage is not None else None

        try:
            self._writer.write_row(
                build_row(
                    utc=utc,
                    mono_s=mono,
                    dt_s=dt,
                    voltage_v=voltage,
                    current_a=current,
                    percentage=msg.percentage,
                    legacy_fake_pct=legacy,
                    charge_mah=self._integrator.charge_mah,
                    energy_wh=self._integrator.energy_wh,
                    power_supply_status=int(msg.power_supply_status),
                    power_supply_health=int(msg.power_supply_health),
                    present=bool(msg.present),
                    charging_active=self._charging,
                    note=note,
                )
            )
        except OSError as exc:
            # A full or read-only /data must not take the power node's
            # subscriber thread down with it; the sensor keeps publishing.
            self.get_logger().error(f'Power log write failed: {exc}')
            return

        self._rows += 1

    def shutdown(self) -> None:
        self._writer.close()
        self.get_logger().info(
            f'Power log closed after {self._rows} row(s); '
            f'net {self._integrator.charge_mah:.1f} mAh, '
            f'{self._integrator.energy_wh:.2f} Wh'
        )


def main(args=None) -> None:
    rclpy.init(args=args)
    node = None
    try:
        node = PowerLogger()
        rclpy.spin(node)
    except LogAlreadyActive as exc:
        # Exit non-zero and stay out of the file. A hand-started logger
        # overlapping the launch-managed one interleaves two charge integrals
        # into one CSV, which is worse than no second logger at all.
        print(f'beast_power_logger: {exc}', file=sys.stderr)
        if rclpy.ok():
            rclpy.shutdown()
        raise SystemExit(1)
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
