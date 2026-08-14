# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""End-to-end fake-bus: open → configure → read → telemetry."""

from __future__ import annotations

import pytest

from beast_power.ina219 import (
    CALIBRATION_REG_VALUE,
    CONFIG_REG_VALUE,
    FakeSMBus,
    Ina219,
    REG_CALIBRATION,
    REG_CONFIG,
)
from beast_power.soc import voltage_to_soc
from beast_power.telemetry import (
    POWER_SUPPLY_STATUS_CHARGING,
    build_telemetry,
)


def test_open_writes_config_and_calibration():
    bus = FakeSMBus(bus_voltage_v=12.0, current_a=0.0)
    sensor = Ina219(bus, 0x40)
    sensor.open(7)
    assert bus.opened_bus == 7
    assert bus._regs[REG_CONFIG] == CONFIG_REG_VALUE
    assert bus._regs[REG_CALIBRATION] == CALIBRATION_REG_VALUE


def test_read_round_trip_voltage_and_soc():
    bus = FakeSMBus(bus_voltage_v=11.4, current_a=-0.25)
    sensor = Ina219(bus, 0x40)
    sensor.open(1)
    reading = sensor.read()
    assert reading.bus_voltage_v == pytest.approx(11.4, abs=0.01)
    assert reading.current_a == pytest.approx(-0.25, abs=0.01)

    tel = build_telemetry(
        reading, present=True, charging_current_threshold_a=0.05
    )
    assert tel.present is True
    assert tel.charging_active is False
    assert tel.percentage == pytest.approx(voltage_to_soc(11.4), abs=1e-6)


def test_charging_sample_sets_bool_and_status():
    bus = FakeSMBus(bus_voltage_v=11.8, current_a=0.4)
    sensor = Ina219(bus, 0x40)
    sensor.open(7)
    tel = build_telemetry(sensor.read(), present=True)
    assert tel.charging_active is True
    assert tel.power_supply_status == POWER_SUPPLY_STATUS_CHARGING


def test_ensure_ready_repairs_corrupted_config():
    bus = FakeSMBus(bus_voltage_v=12.0, current_a=0.0)
    sensor = Ina219(bus, 0x40)
    sensor.open(7)
    bus._regs[REG_CONFIG] = 0
    bus._regs[REG_CALIBRATION] = 0
    assert sensor.ensure_ready() is True
    assert bus._regs[REG_CONFIG] == CONFIG_REG_VALUE
    assert bus._regs[REG_CALIBRATION] == CALIBRATION_REG_VALUE


def test_reopen_closes_previous_bus_fd():
    """open() on an already-open driver must close the old fd, not leak it."""
    bus = FakeSMBus(bus_voltage_v=12.0, current_a=0.0)
    sensor = Ina219(bus, 0x40)
    sensor.open(7)
    sensor.open(7)
    assert bus.close_count == 1
    assert sensor.read().bus_voltage_v == pytest.approx(12.0, abs=0.01)
