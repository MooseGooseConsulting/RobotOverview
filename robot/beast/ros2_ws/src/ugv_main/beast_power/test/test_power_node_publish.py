# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""PowerNode publish path runs for real: strict stubs, driven timer tick.

``PowerNode.__init__`` executes here (no ``object.__new__`` shortcuts), so a
parameter-default regression fails instead of shipping invisibly, and
``_publish_once`` publishes real BatteryState / Bool messages onto the strict
message stubs — a field typo in the mapping now fails these tests.
"""

from __future__ import annotations

import math

import pytest

from beast_power.ina219 import FakeSMBus
from beast_power.power_node import PowerNode
from beast_power.soc import voltage_to_soc
from beast_power.telemetry import (
    POWER_SUPPLY_HEALTH_GOOD,
    POWER_SUPPLY_HEALTH_UNKNOWN,
    POWER_SUPPLY_STATUS_CHARGING,
    POWER_SUPPLY_STATUS_DISCHARGING,
    POWER_SUPPLY_STATUS_UNKNOWN,
)
from sensor_msgs.msg import BatteryState
from std_msgs.msg import Bool


def _started_node(bus) -> PowerNode:
    node = PowerNode(bus_factory=lambda: bus)
    node.start()
    return node


def test_init_executes_and_uses_declared_parameter_defaults():
    """__init__ really runs: declared defaults must survive to the attributes
    the publish path reads, and publishers must carry the strict message
    types."""
    bus = FakeSMBus(bus_voltage_v=12.0, current_a=0.0)
    node = PowerNode(bus_factory=lambda: bus)

    assert node._i2c_bus_nr == 7
    assert node._sensor_address == 0x41
    assert node._rate_hz == pytest.approx(1.0)
    assert node._reconnect_interval_sec == pytest.approx(5.0)
    assert node._charge_threshold == pytest.approx(0.05)
    assert node._frame_id == 'base_link'
    assert node.publishers[0][0] is BatteryState
    assert node.publishers[1][0] is Bool
    assert node.publishers[0][1].topic == '/ugv/voltage'
    assert node.publishers[1][1].topic == '/ugv/charging_active'


def test_publish_once_publishes_all_fields_for_discharge_sample():
    bus = FakeSMBus(bus_voltage_v=11.4, current_a=-0.25)
    node = _started_node(bus)
    assert node._sensor_ok is True
    assert len(node.timers) == 1

    node.timers[0].callback()  # one publish tick

    msg = node._voltage_pub.published[-1]
    assert msg.header.frame_id == 'base_link'
    assert msg.present is True
    assert msg.voltage == pytest.approx(11.4, abs=0.01)
    assert msg.current == pytest.approx(-0.25, abs=0.01)
    assert msg.percentage == pytest.approx(voltage_to_soc(11.4), abs=0.02)
    assert msg.power_supply_status == POWER_SUPPLY_STATUS_DISCHARGING
    assert msg.power_supply_health == POWER_SUPPLY_HEALTH_GOOD
    assert msg.location == 'driver_board_ina219'

    assert node._charging_pub.published[-1].data is False


def test_publish_once_charging_sets_bool_and_status():
    bus = FakeSMBus(bus_voltage_v=11.8, current_a=0.4)
    node = _started_node(bus)

    node.timers[0].callback()

    assert node._voltage_pub.published[-1].power_supply_status == (
        POWER_SUPPLY_STATUS_CHARGING
    )
    assert node._charging_pub.published[-1].data is True


def test_publish_once_absent_sensor_percentage_stays_nan():
    """Absent sensor: _publish_once publishes absent status — percentage NaN,
    never 0.0 — and charging_active False."""
    bus = FakeSMBus(absent=True)
    node = _started_node(bus)
    assert node._sensor_ok is False

    node.timers[0].callback()

    msg = node._voltage_pub.published[-1]
    assert msg.present is False
    assert msg.voltage == 0.0
    assert msg.current == 0.0
    assert math.isnan(msg.percentage)
    assert msg.percentage != 0.0
    assert msg.power_supply_status == POWER_SUPPLY_STATUS_UNKNOWN
    assert msg.power_supply_health == POWER_SUPPLY_HEALTH_UNKNOWN

    assert node._charging_pub.published[-1].data is False
