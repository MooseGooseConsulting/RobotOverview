# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Map INA219 samples to BatteryState / charging_active fields (pure logic).

Keeps ROS message construction out of the math path so Windows/CI pytest can
assert curve, sign, and absent-sensor behavior without rclpy.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from beast_power.ina219 import Ina219Reading
from beast_power.soc import (
    STATE_UNKNOWN,
    estimate_ocv,
    pack_state,
    voltage_to_soc,
)

# sensor_msgs/BatteryState power_supply_status constants
POWER_SUPPLY_STATUS_UNKNOWN = 0
POWER_SUPPLY_STATUS_CHARGING = 1
POWER_SUPPLY_STATUS_DISCHARGING = 2
POWER_SUPPLY_STATUS_NOT_CHARGING = 3
POWER_SUPPLY_STATUS_FULL = 4

# sensor_msgs/BatteryState power_supply_health
POWER_SUPPLY_HEALTH_UNKNOWN = 0
POWER_SUPPLY_HEALTH_GOOD = 1

# sensor_msgs/BatteryState power_supply_technology
POWER_SUPPLY_TECHNOLOGY_LION = 2


@dataclass(frozen=True)
class BatteryTelemetry:
    """Honest fields destined for /ugv/voltage + /ugv/charging_active."""

    voltage: float
    current: float
    percentage: float
    present: bool
    charging_active: bool
    power_supply_status: int
    power_supply_health: int
    power_supply_technology: int
    design_capacity: float
    charge: float
    capacity: float
    temperature: float
    location: str
    serial_number: str
    # Load-compensated extras. Not BatteryState fields — that message has
    # nowhere to put them — so `to_battery_fields` deliberately drops them.
    # They exist so the node can warn on the band and so tests can assert the
    # compensation actually happened rather than inferring it from a percent.
    open_circuit_voltage: float = float('nan')
    pack_state: str = STATE_UNKNOWN


def is_charging(current_a: float, threshold_a: float) -> bool:
    """Sign convention: positive current = charging.

    ``threshold_a`` must be finite and > 0: it is the deadband that keeps
    shunt noise near 0 A from chattering the flag — at threshold 0, an idle
    0.0 A sample would read as charging. Current at or above +threshold is
    charging. A NaN threshold would slip past a bare ``<= 0`` check
    (``nan <= 0`` is False) and make every comparison False, silently
    reporting "not charging" forever.
    """
    if not math.isfinite(threshold_a) or threshold_a <= 0:
        raise ValueError('charging_current_threshold_a must be finite and > 0')
    return current_a >= threshold_a


def build_telemetry(
    reading: Optional[Ina219Reading],
    *,
    present: bool,
    charging_current_threshold_a: float = 0.05,
    full_soc: float = 0.98,
) -> BatteryTelemetry:
    """Build published fields from a sample, or a deliberate absent status.

    Absent / failed sensor: ``present=False``, status UNKNOWN, percentage NaN,
    charging_active False — never invent a SOC from garbage volts.
    """
    if not present or reading is None:
        return BatteryTelemetry(
            voltage=0.0,
            current=0.0,
            percentage=float('nan'),
            present=False,
            charging_active=False,
            power_supply_status=POWER_SUPPLY_STATUS_UNKNOWN,
            power_supply_health=POWER_SUPPLY_HEALTH_UNKNOWN,
            power_supply_technology=POWER_SUPPLY_TECHNOLOGY_LION,
            design_capacity=float('nan'),
            charge=float('nan'),
            capacity=float('nan'),
            temperature=float('nan'),
            location='driver_board_ina219',
            serial_number='',
        )

    # Pass the current, not just the volts: the table is a RESTING OCV table,
    # and a loaded terminal reading looked up in it under-reports SOC in
    # proportion to load. Dropping `current_a` here is the 2026-08-14 bug.
    ocv = estimate_ocv(reading.bus_voltage_v, reading.current_a)
    soc = voltage_to_soc(reading.bus_voltage_v, reading.current_a)
    state = pack_state(reading.bus_voltage_v, reading.current_a)
    charging = is_charging(reading.current_a, charging_current_threshold_a)

    if charging:
        status = POWER_SUPPLY_STATUS_CHARGING
        if soc >= full_soc:
            status = POWER_SUPPLY_STATUS_FULL
    elif reading.current_a <= -charging_current_threshold_a:
        status = POWER_SUPPLY_STATUS_DISCHARGING
    else:
        status = POWER_SUPPLY_STATUS_NOT_CHARGING

    return BatteryTelemetry(
        voltage=float(reading.bus_voltage_v),
        current=float(reading.current_a),
        percentage=float(soc),
        present=True,
        charging_active=charging,
        power_supply_status=status,
        power_supply_health=POWER_SUPPLY_HEALTH_GOOD,
        power_supply_technology=POWER_SUPPLY_TECHNOLOGY_LION,
        design_capacity=float('nan'),
        charge=float('nan'),
        capacity=float('nan'),
        temperature=float('nan'),
        location='driver_board_ina219',
        serial_number='',
        open_circuit_voltage=float(ocv),
        pack_state=state,
    )


def to_battery_fields(telemetry: BatteryTelemetry) -> dict[str, object]:
    """Map telemetry to the telemetry-derived ``BatteryState`` fields (pure).

    Returns exactly the fields the node fills from a sample: ``header``
    (stamp + frame_id) is node-owned, and ``cell_voltage`` /
    ``cell_temperature`` stay at their message defaults by design. Because
    the dict is fed straight to ``BatteryState(**fields)``, a typo such as
    ``precentage`` fails loudly against the strict message stub in tests.
    """
    return {
        'voltage': telemetry.voltage,
        'current': telemetry.current,
        'charge': telemetry.charge,
        'capacity': telemetry.capacity,
        'design_capacity': telemetry.design_capacity,
        'percentage': telemetry.percentage,
        'power_supply_status': telemetry.power_supply_status,
        'power_supply_health': telemetry.power_supply_health,
        'power_supply_technology': telemetry.power_supply_technology,
        'present': telemetry.present,
        'temperature': telemetry.temperature,
        'location': telemetry.location,
        'serial_number': telemetry.serial_number,
    }


def percentage_is_honest_absent(percentage: float) -> bool:
    """True when absent-sensor path left percentage as non-numeric status."""
    return math.isnan(percentage)
