# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Current sign: positive amperes mean charging."""

from __future__ import annotations

import pytest

from beast_power.ina219 import CURRENT_LSB, FakeSMBus, Ina219, REG_CURRENT
from beast_power.telemetry import (
    POWER_SUPPLY_STATUS_CHARGING,
    POWER_SUPPLY_STATUS_DISCHARGING,
    POWER_SUPPLY_STATUS_FULL,
    POWER_SUPPLY_STATUS_NOT_CHARGING,
    build_telemetry,
    is_charging,
)


def test_is_charging_threshold():
    assert is_charging(0.05, 0.05) is True
    assert is_charging(0.049, 0.05) is False
    assert is_charging(-0.2, 0.05) is False
    assert is_charging(0.0, 0.05) is False


def test_is_charging_nan_current_is_not_charging():
    """NaN current must never claim charging: `nan >= threshold` is False, so
    the deadband keeps it on the not-charging side of the flag."""
    assert is_charging(float('nan'), 0.05) is False


def test_is_charging_rejects_negative_threshold():
    with pytest.raises(ValueError):
        is_charging(0.1, -0.01)


def test_is_charging_rejects_zero_threshold():
    """threshold=0 would report an idle 0.0 A sample as charging (0.0 >= 0)."""
    with pytest.raises(ValueError):
        is_charging(0.0, 0.0)


def test_is_charging_rejects_nan_threshold():
    """nan <= 0 is False, so a bare sign check lets NaN through — and then
    every current comparison is False, silently reporting never-charging."""
    with pytest.raises(ValueError):
        is_charging(0.1, float('nan'))
    with pytest.raises(ValueError):
        is_charging(0.1, float('inf'))


def test_build_telemetry_charging_vs_discharging():
    from beast_power.ina219 import Ina219Reading

    charge = build_telemetry(
        Ina219Reading(0.01, 11.8, 0.5, 6.0),
        present=True,
        charging_current_threshold_a=0.05,
    )
    assert charge.charging_active is True
    assert charge.power_supply_status == POWER_SUPPLY_STATUS_CHARGING
    assert charge.current == pytest.approx(0.5)

    discharge = build_telemetry(
        Ina219Reading(-0.01, 11.4, -0.8, 9.0),
        present=True,
        charging_current_threshold_a=0.05,
    )
    assert discharge.charging_active is False
    assert discharge.power_supply_status == POWER_SUPPLY_STATUS_DISCHARGING
    assert discharge.current == pytest.approx(-0.8)


def test_build_telemetry_full_status():
    """At/above full_soc while charge current flows, status is FULL — the
    charger is connected but the pack is done, so 'charging' would be a lie."""
    from beast_power.ina219 import Ina219Reading

    tel = build_telemetry(
        Ina219Reading(0.01, 12.6, 0.5, 6.0),
        present=True,
        charging_current_threshold_a=0.05,
    )
    assert tel.charging_active is True
    assert tel.power_supply_status == POWER_SUPPLY_STATUS_FULL


def test_build_telemetry_not_charging_status():
    """Current inside the deadband is NOT_CHARGING — idle 0.0 A is not
    discharging, and NaN current must not invent a charging claim."""
    from beast_power.ina219 import Ina219Reading

    idle = build_telemetry(
        Ina219Reading(0.01, 11.4, 0.0, 6.0),
        present=True,
        charging_current_threshold_a=0.05,
    )
    assert idle.charging_active is False
    assert idle.power_supply_status == POWER_SUPPLY_STATUS_NOT_CHARGING

    nan_current = build_telemetry(
        Ina219Reading(float('nan'), 11.4, float('nan'), float('nan')),
        present=True,
        charging_current_threshold_a=0.05,
    )
    assert nan_current.charging_active is False
    assert nan_current.power_supply_status == POWER_SUPPLY_STATUS_NOT_CHARGING


def test_fake_bus_current_sign_flip():
    """If the shunt is wired backwards, current_sign=-1 restores convention."""
    import struct

    bus = FakeSMBus(bus_voltage_v=12.0, current_a=0.5)  # raw bus says +0.5 A
    sensor = Ina219(bus, 0x40, current_sign=-1.0)
    sensor.open(7)
    reading = sensor.read()
    assert reading.current_a == pytest.approx(-0.5, abs=CURRENT_LSB * 2)

    # Raw register still positive; only the driver sign flips publish path.
    raw = bus.read_i2c_block_data(0x40, REG_CURRENT, 2)
    raw_signed = struct.unpack('>h', bytes(raw))[0]
    assert raw_signed > 0
