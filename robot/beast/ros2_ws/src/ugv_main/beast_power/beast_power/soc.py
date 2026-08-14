# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""3S Li-ion state-of-charge from pack bus voltage.

Curve source (document in-code per PR-2a):
  Piecewise-linear open-circuit voltage (OCV) model for a typical NMC/Li-ion
  cell, scaled ×3 for a series-3 pack. Cell knees follow widely published
  resting OCV tables (≈4.20 V = 100 % … ≈3.00 V = 0 %). That chemistry
  table is ``_3S_OCV_CHEM`` / ``chemistry_voltage_to_soc``.

  ``voltage_to_soc`` — what ``/ugv/voltage.percentage`` publishes — is the
  same shape renormalized to this pack's measured usable window:

  * ``PACK_HARD_EMPTY_V`` = 8.332 V (CSV cutoff 2026-08-07T23:19:19Z)
  * ``PACK_USABLE_FULL_V`` = 12.364 V (clean-log Vmax, 2026-08-14: highest
    real-clock CSV row, 2026-08-13T19:28Z under ~0.8 A discharge just after
    a completed charge — true rest OCV is higher, so 100 % stays honest)

  Mid-curve knees are still generic until rested step samples exist. Under
  load the bus sags and SOC reads low; under charge it reads high. That is
  expected for OCV-only SOC.

This module is pure Python (no rclpy / smbus) so CI and Windows pytest can
exercise it without ROS.
"""

from __future__ import annotations

import math

# (pack_voltage_V, soc_fraction 0..1), sorted ascending by voltage.
# Cell × 3: 3.00 → 9.00 V … 4.20 → 12.60 V. Chemistry shape only.
_3S_OCV_CHEM: tuple[tuple[float, float], ...] = (
    (9.00, 0.00),
    (9.60, 0.01),
    (9.90, 0.04),
    (10.20, 0.08),
    (10.50, 0.15),
    (10.80, 0.25),
    (11.10, 0.40),
    (11.40, 0.55),
    (11.70, 0.70),
    (12.00, 0.80),
    (12.30, 0.90),
    (12.60, 1.00),
)

# Backward alias — older tests imported the chemistry table under this name.
_3S_OCV_SOC = _3S_OCV_CHEM

# Chemistry full (legacy fake % is V/12.6). Not the published usable window.
PACK_FULL_V = 12.6
PACK_EMPTY_V = 9.0

# Measured usable window on this bench (see module docstring).
PACK_HARD_EMPTY_V = 8.332
PACK_USABLE_FULL_V = 12.364


def chemistry_voltage_to_soc(voltage_v: float) -> float:
    """Map pack bus volts to generic 3S OCV fraction in [0, 1].

    12.6 V = 1.0. Not what ``/ugv/voltage.percentage`` publishes.
    """
    if not math.isfinite(voltage_v):
        return math.nan
    if voltage_v <= _3S_OCV_CHEM[0][0]:
        return 0.0
    if voltage_v >= _3S_OCV_CHEM[-1][0]:
        return 1.0

    for i in range(1, len(_3S_OCV_CHEM)):
        v0, s0 = _3S_OCV_CHEM[i - 1]
        v1, s1 = _3S_OCV_CHEM[i]
        if voltage_v <= v1:
            t = (voltage_v - v0) / (v1 - v0)
            return s0 + t * (s1 - s0)

    return 1.0


def voltage_to_soc(voltage_v: float) -> float:
    """Map pack bus volts to usable SOC fraction in [0, 1].

    Renormalizes the generic 3S shape so this charger's measured rest high
    is 100 % and the logged hard cutoff is 0 %. Values outside that window
    clamp to 0 or 1. Does not invent a reading for a missing sensor —
    callers must not call this when ``present`` is false.
    """
    if not math.isfinite(voltage_v):
        # Any non-finite volts (NaN, ±inf) is a failed measurement and returns
        # NaN. Letting ±inf fall through to the clamps below would fabricate
        # '100 %' / '0 %' from a broken sensor.
        return math.nan
    if voltage_v <= PACK_HARD_EMPTY_V:
        return 0.0
    if voltage_v >= PACK_USABLE_FULL_V:
        return 1.0

    chem = chemistry_voltage_to_soc(voltage_v)
    if not math.isfinite(chem):
        return math.nan
    scale = chemistry_voltage_to_soc(PACK_USABLE_FULL_V)
    if not math.isfinite(scale) or scale <= 0.0:
        return math.nan
    usable = chem / scale
    if usable <= 0.0:
        return 0.0
    if usable >= 1.0:
        return 1.0
    return usable


def legacy_fake_percentage(voltage_v: float) -> float:
    """Reproduce ugv_bringup's fake V/12.6 field for brownout comparisons."""
    return float(voltage_v) / PACK_FULL_V
