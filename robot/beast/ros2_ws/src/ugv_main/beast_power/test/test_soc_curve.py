# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""3S OCV SOC curve math — no hardware, no ROS."""

from __future__ import annotations

import math
import pytest

from beast_power.soc import (
    PACK_HARD_EMPTY_V,
    PACK_USABLE_FULL_V,
    chemistry_voltage_to_soc,
    legacy_fake_percentage,
    voltage_to_soc,
)


def test_usable_endpoints_clamp():
    assert voltage_to_soc(PACK_USABLE_FULL_V) == pytest.approx(1.0)
    assert voltage_to_soc(12.6) == pytest.approx(1.0)
    assert voltage_to_soc(13.0) == pytest.approx(1.0)
    assert voltage_to_soc(PACK_HARD_EMPTY_V) == pytest.approx(0.0)
    assert voltage_to_soc(8.0) == pytest.approx(0.0)


def test_usable_renormalizes_chemistry_shape():
    scale = chemistry_voltage_to_soc(PACK_USABLE_FULL_V)
    assert scale == pytest.approx(0.921333, abs=1e-5)
    assert voltage_to_soc(11.1) == pytest.approx(0.40 / scale, abs=0.01)
    assert voltage_to_soc(10.8) == pytest.approx(0.25 / scale, abs=0.01)
    assert voltage_to_soc(12.0) == pytest.approx(0.80 / scale, abs=0.01)


def test_usable_mid_curve_is_renormalized_not_chemistry_85():
    scale = chemistry_voltage_to_soc(PACK_USABLE_FULL_V)
    mid = voltage_to_soc(12.15)
    assert mid == pytest.approx(0.85 / scale, abs=0.02)


def test_deep_discharge_is_low_soc_not_fake_percent():
    """A deeply discharged pack: honest SOC ~0 while fake V/12.6 still reads ~70%."""
    v = 8.8
    assert voltage_to_soc(v) == pytest.approx(0.0)
    fake = legacy_fake_percentage(v)
    assert fake == pytest.approx(8.8 / 12.6, abs=1e-6)
    assert fake > 0.6  # the lie that HonestyRail calls out


def test_nan_voltage_never_reports_full_soc():
    assert math.isnan(voltage_to_soc(math.nan))
    assert math.isnan(chemistry_voltage_to_soc(math.nan))


def test_legacy_fake_percentage_nan_stays_nan():
    """Pin current behavior: NaN in -> NaN out. A future 'fix' that clamps
    garbage volts to 0/1 would fabricate a percentage for a failed sensor —
    the exact lie this field was replaced to remove."""
    assert math.isnan(legacy_fake_percentage(math.nan))


@pytest.mark.parametrize('bad', [float('inf'), float('-inf'), float('nan')])
def test_non_finite_voltage_returns_nan(bad):
    """Garbage volts must not clamp to 0/1: +inf currently reports '100 %
    battery', -inf '0 %'. Any non-finite input is a failed measurement, so it
    returns NaN like NaN does — never a fabricated SOC."""
    assert math.isnan(voltage_to_soc(bad))
    assert math.isnan(chemistry_voltage_to_soc(bad))


# The 12 chemistry OCV knots written out literally, independent of
# _3S_OCV_CHEM, so a silent table edit fails this file's assertions instead
# of self-validating against the edited table.
_CHEM_KNOTS = (
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


@pytest.mark.parametrize('voltage,expected', _CHEM_KNOTS)
def test_chemistry_knot_is_exact(voltage, expected):
    """Chemistry table is unchanged; usable SOC is a wrapper around it."""
    assert chemistry_voltage_to_soc(voltage) == pytest.approx(expected)


def test_chemistry_table_is_strictly_sorted_ascending():
    from beast_power.soc import _3S_OCV_CHEM

    assert len(_3S_OCV_CHEM) == len(_CHEM_KNOTS) == 12
    voltages = [v for v, _ in _3S_OCV_CHEM]
    assert all(v < nxt for v, nxt in zip(voltages, voltages[1:]))


def test_usable_full_is_this_chargers_ceiling_not_12_6():
    """12.364 V is 100 % usable; chemistry still calls it ~92 %."""
    assert voltage_to_soc(12.364) == pytest.approx(1.0)
    assert chemistry_voltage_to_soc(12.364) == pytest.approx(0.921333, abs=1e-5)
    assert chemistry_voltage_to_soc(12.6) == pytest.approx(1.0)
    # The old 2026-08-10 pin is now honest ~95 %, not a fake ceiling.
    assert voltage_to_soc(12.232) == pytest.approx(0.877333 / 0.921333, abs=1e-5)
