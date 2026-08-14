# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""BatteryState field mapping: every field by name, nothing swapped, NaN honesty.

``to_battery_fields`` is the pure mapping the node feeds to
``BatteryState(**fields)``. These tests name every field, so a percentage /
charge swap, a dropped ``present``, or a NaN landing in the wrong field fails
here — and the strict message stub turns a typo like ``precentage`` into an
``AttributeError`` instead of a silently invented attribute.
"""

from __future__ import annotations

import math

import pytest

from beast_power.ina219 import Ina219Reading
from beast_power.soc import voltage_to_soc
from beast_power.telemetry import (
    POWER_SUPPLY_HEALTH_GOOD,
    POWER_SUPPLY_HEALTH_UNKNOWN,
    POWER_SUPPLY_STATUS_DISCHARGING,
    POWER_SUPPLY_STATUS_UNKNOWN,
    POWER_SUPPLY_TECHNOLOGY_LION,
    build_telemetry,
    to_battery_fields,
)
from sensor_msgs.msg import BatteryState

# The telemetry-derived fields; the message's header is node-owned, and
# cell_voltage / cell_temperature are left at their message defaults.
_FIELD_NAMES = {
    'voltage',
    'current',
    'charge',
    'capacity',
    'design_capacity',
    'percentage',
    'power_supply_status',
    'power_supply_health',
    'power_supply_technology',
    'present',
    'temperature',
    'location',
    'serial_number',
}


def test_to_battery_fields_has_exactly_the_message_fields():
    """Every key the message carries, no more and no less.

    A dropped ``present`` (missing key) or an invented key (``precentage``)
    fails this set comparison even before message construction.
    """
    tel = build_telemetry(
        Ina219Reading(-0.008, 11.4, -0.8, 9.12), present=True
    )
    assert set(to_battery_fields(tel)) == _FIELD_NAMES


def test_every_battery_state_field_by_name():
    """Discharge sample: all 15 message fields asserted by name."""
    tel = build_telemetry(
        Ina219Reading(-0.008, 11.4, -0.8, 9.12),
        present=True,
        charging_current_threshold_a=0.05,
    )
    msg = BatteryState(**to_battery_fields(tel))

    assert msg.header.frame_id == ''
    assert msg.voltage == pytest.approx(11.4)
    assert msg.current == pytest.approx(-0.8)
    assert math.isnan(msg.charge)
    assert math.isnan(msg.capacity)
    assert math.isnan(msg.design_capacity)
    # Load-compensated against the -0.8 A in the reading above. Asserting the
    # bare `voltage_to_soc(11.4)` would re-pin the loaded-volts-into-a-resting
    # -table bug that ended a nav session on 2026-08-14.
    assert msg.percentage == pytest.approx(voltage_to_soc(11.4, -0.8))
    assert msg.percentage > voltage_to_soc(11.4)
    assert msg.power_supply_status == POWER_SUPPLY_STATUS_DISCHARGING
    assert msg.power_supply_health == POWER_SUPPLY_HEALTH_GOOD
    assert msg.power_supply_technology == POWER_SUPPLY_TECHNOLOGY_LION
    assert msg.present is True
    assert math.isnan(msg.temperature)
    assert msg.location == 'driver_board_ina219'
    assert msg.serial_number == ''
    assert msg.cell_voltage == []
    assert msg.cell_temperature == []


def test_percentage_and_charge_are_not_swapped():
    """percentage holds SOC; charge stays NaN (no integrator on this path).

    The classic swap puts SOC in ``charge`` and 0.0 or NaN in ``percentage`` —
    both assertions below fail for that bug.
    """
    tel = build_telemetry(Ina219Reading(0.005, 12.3, 0.4, 4.92), present=True)
    msg = BatteryState(**to_battery_fields(tel))

    # +0.4 A is CHARGING, so compensation pulls the estimate DOWN: the
    # terminal is being held above open circuit by the charger.
    assert msg.percentage == pytest.approx(voltage_to_soc(12.3, 0.4))
    assert msg.percentage < voltage_to_soc(12.3)
    # 12.3 V under the 12.364 V clean-log full pin: high but honestly not
    # 100 %. Compensated for the +0.4 A charge current (OCV ~12.244 V) it is
    # 95.7 %, where the raw terminal lookup claimed 97.7 % — the charger was
    # paying for those two points, not the cells.
    assert msg.percentage == pytest.approx(0.956585, abs=1e-5)
    assert math.isnan(msg.charge)


def test_absent_sensor_percentage_stays_nan_never_zero():
    """Absent sensor: percentage must remain NaN, never degrade to 0.0.

    0.0 would read as an honest "empty pack" and a caller gating on
    ``percentage == 0`` could act on garbage volts.
    """
    tel = build_telemetry(None, present=False)
    fields = to_battery_fields(tel)

    assert fields['present'] is False
    assert math.isnan(fields['percentage'])
    assert fields['percentage'] != 0.0  # NaN != 0.0; the honesty check.

    msg = BatteryState(**fields)
    assert msg.present is False
    assert math.isnan(msg.percentage)
    assert msg.percentage != 0.0
    assert msg.power_supply_status == POWER_SUPPLY_STATUS_UNKNOWN
    assert msg.power_supply_health == POWER_SUPPLY_HEALTH_UNKNOWN
    assert msg.voltage == 0.0


def test_strict_stub_rejects_unknown_field_typo():
    """The harness contract: a typo in mapping code must fail loudly."""
    with pytest.raises(AttributeError):
        BatteryState(precentage=0.5)


def test_strict_stub_rejects_unknown_attribute_set_and_read():
    msg = BatteryState()
    with pytest.raises(AttributeError):
        msg.precentage = 0.5
    with pytest.raises(AttributeError):
        _ = msg.precentage
