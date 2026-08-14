"""Regression gate for BEAST-01 state-of-charge load compensation.

On 2026-08-14 the robot published ``percentage = 0.0169`` (1.7 %) at 9.656 V
while drawing ~1.3 A, and a navigation session was ended on the strength of
it. The pack's own logs put 12-16 minutes of runtime below that sample.

The defect was not the shape of the curve. ``soc.py`` holds a *resting* OCV
table, and ``telemetry.build_telemetry`` was looking up a *loaded* terminal
voltage in it. Terminal voltage sits below open circuit by I x R_internal, so
every reading under load under-reported SOC, in proportion to the load — worst
precisely when the robot was working hardest.

These tests pin the corrected behaviour and, more importantly, the invariants
that must survive any future re-fit of the curve: no fabricated SOC from a
failed sensor, no reading above 100 % for a pack that has never been observed
full, monotonicity in both voltage and current, and the incident sample never
reading near-dead again.

soc.py is deliberately pure Python (no rclpy, no smbus), so it is loaded here
straight off the path rather than requiring the ROS workspace to be built.
"""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SOC_PY = (
    REPO_ROOT
    / "robot"
    / "beast"
    / "ros2_ws"
    / "src"
    / "ugv_main"
    / "beast_power"
    / "beast_power"
    / "soc.py"
)


def _load_soc():
    spec = importlib.util.spec_from_file_location("beast_soc_under_test", SOC_PY)
    assert spec is not None and spec.loader is not None, f"cannot load {SOC_PY}"
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


soc = _load_soc()

# The 2026-08-14 sample that ended the navigation session.
ABORT_V = 9.656
ABORT_A = -1.3

# Load the robot actually drives at, from the logged run-to-empty discharges.
NAV_LOAD_A = -1.4


def test_soc_module_is_present_and_pure_python():
    """A moved or ROS-coupled soc.py would silently skip this whole gate."""
    assert SOC_PY.is_file()
    imports = [
        line.strip()
        for line in SOC_PY.read_text(encoding="utf-8").splitlines()
        if line.startswith(("import ", "from "))
    ]
    assert imports, "expected at least the __future__ import"
    for line in imports:
        assert not any(
            dep in line for dep in ("rclpy", "smbus", "sensor_msgs", "std_msgs")
        ), f"soc.py must stay importable without ROS, found: {line}"


# --------------------------------------------------------------------------
# The incident
# --------------------------------------------------------------------------


def test_uncompensated_lookup_still_reproduces_the_1_7_percent():
    """Pin the bug itself, so the fix is demonstrably the compensation.

    Called without a current — an ammeter-less caller — the answer is the old
    one. That is not a regression: it is the honest answer when load is
    unknown. What must never happen again is the node dropping a current it
    HAS (see the next test).
    """
    assert soc.voltage_to_soc(ABORT_V) == pytest.approx(0.0169, abs=0.0005)


def test_abort_sample_does_not_report_near_dead_once_load_is_accounted_for():
    """9.656 V at -1.3 A had 12-16 measured minutes left. Never ~2 % again."""
    compensated = soc.voltage_to_soc(ABORT_V, ABORT_A)
    assert compensated > 0.03, (
        f"9.656 V at -1.3 A reported {compensated:.4f}; the uncompensated "
        "lookup that aborted a nav session read 0.0169"
    )
    assert compensated > 2 * soc.voltage_to_soc(ABORT_V)


def test_abort_sample_is_a_working_band_not_a_stop_signal():
    """`reserve` is ~5-17 measured minutes. `critical` is the one that stops."""
    assert soc.pack_state(ABORT_V, ABORT_A) == soc.STATE_RESERVE


def test_measured_cutoff_maps_to_the_bottom():
    """8.368 V under load is the measured hard-dead point — 0 %, not 'a bit left'.

    Compensation must not lift the pack off the floor: at -1.5 A the estimated
    OCV is ~8.58 V, still below the chemistry table's 9.00 V zero.
    """
    assert soc.voltage_to_soc(8.368, -1.5) == pytest.approx(0.0)
    assert soc.voltage_to_soc(8.332, -1.5) == pytest.approx(0.0)
    assert soc.pack_state(8.368, -1.5) == soc.STATE_CRITICAL


# --------------------------------------------------------------------------
# "We have never seen this pack full"
# --------------------------------------------------------------------------


def test_nothing_ever_reports_above_100_percent():
    """The pack has never been observed at 12.6 V; 100 % is a clamp, not a scale.

    Compensation makes this sharper, not softer: a charging reading is
    corrected DOWNWARD, and a discharging reading above the observed ceiling
    would otherwise be pushed past it.
    """
    for volts in (12.364, 12.4, 12.6, 13.0, 20.0):
        for amps in (None, -2.0, 0.0, 2.0):
            value = soc.voltage_to_soc(volts, amps)
            assert value <= 1.0, f"{volts} V at {amps} A reported {value}"


def test_soc_is_always_a_fraction():
    volts = [8.0 + 0.05 * n for n in range(100)]
    for v in volts:
        for amps in (None, -3.5, -1.4, 0.0, 1.0, 3.5):
            value = soc.voltage_to_soc(v, amps)
            assert 0.0 <= value <= 1.0


# --------------------------------------------------------------------------
# Invariants any future re-fit must keep
# --------------------------------------------------------------------------


def test_mapping_is_monotonic_in_voltage():
    """More volts is never less charge, at any fixed load."""
    for amps in (None, -2.0, -1.4, 0.0, 1.0):
        volts = [8.0 + 0.02 * n for n in range(250)]
        values = [soc.voltage_to_soc(v, amps) for v in volts]
        assert all(b >= a for a, b in zip(values, values[1:])), f"non-monotonic at {amps} A"


def test_mapping_is_monotonic_in_current():
    """At fixed terminal volts, heavier discharge implies MORE charge remaining.

    The terminal is sagging under load; the same volts under a bigger load
    means a healthier pack behind it. A future curve that inverted this would
    punish the robot for driving.
    """
    for volts in (9.2, 9.656, 10.5, 11.5, 12.2):
        amps = [-3.0 + 0.1 * n for n in range(61)]  # -3.0 A .. +3.0 A
        values = [soc.voltage_to_soc(volts, a) for a in amps]
        assert all(b <= a for a, b in zip(values, values[1:])), f"non-monotonic at {volts} V"


def test_pack_state_bands_are_ordered_and_cover_the_range():
    """Bands must walk critical -> nominal as the pack fills, with no gaps."""
    order = [soc.STATE_CRITICAL, soc.STATE_RESERVE, soc.STATE_LOW, soc.STATE_NOMINAL]
    seen = []
    for n in range(300):
        state = soc.pack_state(8.0 + 0.02 * n, NAV_LOAD_A)
        if not seen or state != seen[-1]:
            seen.append(state)
    assert seen == order


def test_every_band_has_a_measured_minutes_range():
    """A band with no measured runtime behind it is a guess wearing a name."""
    for state in (soc.STATE_CRITICAL, soc.STATE_RESERVE, soc.STATE_LOW, soc.STATE_NOMINAL):
        low, high = soc.STATE_MINUTES_TO_CUTOFF[state]
        assert 0.0 <= low < high


# --------------------------------------------------------------------------
# The correction itself
# --------------------------------------------------------------------------


def test_ocv_sign_convention_matches_the_package():
    """Positive current is charging. Discharge estimates ABOVE the terminal."""
    assert soc.estimate_ocv(10.0, -1.0) == pytest.approx(10.0 + soc.PACK_INTERNAL_R_OHM)
    assert soc.estimate_ocv(10.0, 1.0) == pytest.approx(10.0 - soc.PACK_INTERNAL_R_OHM)
    assert soc.estimate_ocv(10.0, 0.0) == pytest.approx(10.0)


def test_internal_resistance_is_in_the_measured_band():
    """0.14 ohm was regressed from power-log.csv by three estimators (0.121 /
    0.145 / ~0.137) and cross-checks against 3S of NCR18650GA. A value outside
    this range is a typo or an un-evidenced edit, not a re-fit."""
    assert 0.09 <= soc.PACK_INTERNAL_R_OHM <= 0.20


def test_saturated_current_cannot_drive_an_unbounded_correction():
    """The INA219 full-scales at +/-3.11 A and a saturated register reads WRONG.

    Without a cap, a garbage current would move the voltage arbitrarily far
    and fabricate a SOC — the same class of lie as the old V/12.6 percentage.
    """
    capped = soc.estimate_ocv(10.0, -1000.0)
    assert capped == pytest.approx(
        10.0 + soc.MAX_COMPENSATED_CURRENT_A * soc.PACK_INTERNAL_R_OHM
    )
    assert soc.estimate_ocv(10.0, -1000.0) == soc.estimate_ocv(10.0, -3.0)


def test_missing_current_is_not_treated_as_zero_current():
    """`None` means 'not measured'. It must not silently assert 'no load'."""
    assert soc.estimate_ocv(10.0, None) == pytest.approx(10.0)
    assert soc.voltage_to_soc(10.0, None) == soc.voltage_to_soc(10.0)


# --------------------------------------------------------------------------
# A broken sensor must never become a confident number
# --------------------------------------------------------------------------


@pytest.mark.parametrize("bad", [float("inf"), float("-inf"), float("nan")])
def test_non_finite_voltage_returns_nan_not_a_clamp(bad):
    assert math.isnan(soc.voltage_to_soc(bad))
    assert math.isnan(soc.voltage_to_soc(bad, -1.4))
    assert soc.pack_state(bad, -1.4) == soc.STATE_UNKNOWN


@pytest.mark.parametrize("bad", [float("inf"), float("-inf"), float("nan")])
def test_non_finite_current_falls_back_to_the_terminal_reading(bad):
    """A failed ammeter must not move the voltage, and must not poison the SOC.

    Returning NaN here would be worse than useless: the voltage reading is
    still good, and the uncompensated answer is merely pessimistic.
    """
    assert soc.estimate_ocv(10.0, bad) == pytest.approx(10.0)
    assert soc.voltage_to_soc(10.0, bad) == pytest.approx(soc.voltage_to_soc(10.0))


# --------------------------------------------------------------------------
# Charging: the same correction, the other way
# --------------------------------------------------------------------------


def test_charging_reading_is_corrected_downward():
    """Under charge the terminal reads HIGH; uncorrected it fakes a fuller pack.

    This is the same defect with the sign flipped, and it is why the FULL
    status in telemetry.py was reachable on a pack this charger has never
    actually filled.
    """
    assert soc.voltage_to_soc(12.0, 1.5) < soc.voltage_to_soc(12.0)
    assert soc.voltage_to_soc(12.0, -1.5) > soc.voltage_to_soc(12.0)
