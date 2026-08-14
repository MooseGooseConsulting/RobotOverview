# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""3S Li-ion state-of-charge from pack bus voltage and current.

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

Load compensation — the point of this module
--------------------------------------------
The table above is a *resting* OCV table. The INA219 measures the pack at
its terminals, and under load the terminals sit below open circuit by the
IR drop across the pack's internal resistance. Feeding a loaded reading
straight into a resting table therefore under-reports SOC systematically,
and it is worst exactly when it matters: the drop is proportional to
current, and drive load is highest when the robot is doing something.

That bug shipped. On 2026-08-14 the robot published ``percentage = 0.0169``
(1.7 %) at 9.656 V while drawing ~1.3 A, and a navigation session was ended
on the strength of it. Compensated, that sample is OCV ≈ 9.84 V, and the
robot's own logs put 12–16 minutes of runtime below that point.

So ``voltage_to_soc`` now takes the current alongside the voltage and maps
the *estimated OCV* through the table:

    OCV ≈ V_terminal − I × R_internal        (I > 0 is charging)

``PACK_INTERNAL_R_OHM`` = 0.14 Ω, regressed from the robot's own
``/data/beast/power/power-log.csv`` over post-RSHUNT-fix rows
(2026-08-10 onward — earlier currents are 10× low, see
``ins-beast-ina219-rshunt-r010``). Three independent estimators agree:

  * 1 s load steps, |ΔI| > 0.25 A, n = 36 → median 0.121 Ω
  * 45 s windowed OLS of V against I, n = 25 → median 0.145 Ω
  * three clean charger-removal transitions (10 s medians either side,
    at 12.13 V, 10.42 V and 12.17 V) → 0.137, 0.147, 0.136 Ω

Cross-check: the cells are Panasonic NCR18650GA, whose typical DC internal
resistance is ~35–50 mΩ; 3S in series is ~0.105–0.150 Ω before pack wiring
and protection FETs. 0.14 Ω sits where it should.

What is still NOT known, and is deliberately not invented here
--------------------------------------------------------------
* **Pack capacity (mAh) is unrecorded** and there is no coulomb counting in
  this path, so nothing here is a fuel gauge (``ins-beast-pack-capacity-unknown``).
* **The pack has never been observed full.** 12.6 V has never been seen;
  the charger floats near 12.1 V. 100 % means "the most this charger has
  ever put in", not "full" — hence ``PACK_USABLE_FULL_V``, not 12.6.
* **The mid-curve knees are still generic, and NMC-shaped at that, while
  the cells are NCA.** Rested step samples have never been taken. The
  compensated percentage is therefore still only as good as a borrowed
  table: better than the loaded reading it replaces, but not trustworthy
  to a few points, and known to read low in the bottom band.
* **R is treated as constant.** Internal resistance rises as a cell
  empties, so a constant R under-corrects near the bottom. That errs
  toward reporting *less* charge than there is, which is the safe
  direction, but it means the compensation is a floor on the correction
  rather than the whole of it. The log did not contain enough deep-band
  load steps to fit R(V) without inventing it.

Because of all that, consumers that need to make a *decision* should gate on
``pack_state`` — bands anchored on measured time-to-cutoff, not on a table —
rather than on a percentage threshold. See ``pack_state``.

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

# Chemistry nameplate full. Live for exactly one purpose: reproducing the
# legacy V/12.6 percentage in `legacy_fake_percentage` so the CSV can carry
# the old lie beside the honest number. It is NOT this pack's 100 %.
PACK_FULL_V = 12.6

# Measured usable window on this bench (see module docstring).
PACK_HARD_EMPTY_V = 8.332
PACK_USABLE_FULL_V = 12.364

# Pack internal resistance, ohms — regressed from power-log.csv (docstring).
PACK_INTERNAL_R_OHM = 0.14

# The INA219 is configured with CURRENT_LSB 95 µA, giving a signed-16-bit
# full scale of ±3.11 A (`ins-beast-ina219-rshunt-r010`). A saturated
# register reads *wrong*, not merely high, so a reading beyond full scale is
# not trusted to size an IR correction: the magnitude used for compensation
# is capped here. At the cap the correction is 3.0 × 0.14 = 0.42 V.
MAX_COMPENSATED_CURRENT_A = 3.0

# `pack_state` band edges, in estimated OCV volts. These are NOT chemistry
# knees — they are read off measured time-to-cutoff in two independent
# run-to-empty discharges at the ~1.3–1.5 A load the robot actually drives
# at (2026-08-14 01:35Z→02:29Z and 2026-08-10 22:25Z→22:38Z). Minutes below
# each edge, run A / run B:
#
#     OCV 10.30 V → 26.5 / >12.7 min      <- STATE_LOW_MIN_OCV_V
#     OCV  9.90 V → 17.0 /  12.2 min      <- STATE_RESERVE_MIN_OCV_V
#     OCV  9.84 V → 16.4 /  12.0 min      (the 2026-08-14 abort sample)
#     OCV  9.40 V →  7.6 /   7.6 min
#     OCV  9.20 V →  4.7 /   5.0 min      <- STATE_CRITICAL_MAX_OCV_V
#     OCV  9.00 V →  2.5 /   3.0 min
#
# The two runs agree within a minute below OCV 9.9 V, which is the evidence
# that OCV — not terminal voltage — is the thing that predicts runtime.
# These minutes are at ~1.4 A; a heavier load empties the pack sooner.
STATE_LOW_MIN_OCV_V = 10.30
STATE_RESERVE_MIN_OCV_V = 9.90
STATE_CRITICAL_MAX_OCV_V = 9.20

STATE_NOMINAL = 'nominal'
STATE_LOW = 'low'
STATE_RESERVE = 'reserve'
STATE_CRITICAL = 'critical'
STATE_UNKNOWN = 'unknown'

# Measured minutes-to-cutoff spanned by each band at ~1.4 A, for operators
# and log messages. A range, because that is what two runs actually showed.
STATE_MINUTES_TO_CUTOFF: dict[str, tuple[float, float]] = {
    STATE_NOMINAL: (27.0, 105.0),
    STATE_LOW: (17.0, 27.0),
    STATE_RESERVE: (5.0, 17.0),
    STATE_CRITICAL: (0.0, 5.0),
}


def chemistry_voltage_to_soc(voltage_v: float) -> float:
    """Map pack OCV volts to generic 3S OCV fraction in [0, 1].

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


def estimate_ocv(voltage_v: float, current_a: float | None) -> float:
    """Estimate open-circuit volts from a loaded terminal reading.

    ``OCV = V_terminal − I × R``, with this package's sign convention that
    positive current is charging (see ``telemetry.is_charging``). So a
    discharging pack (I < 0) estimates *above* its terminal voltage, and a
    charging pack estimates *below* it — both are the same correction.

    ``current_a`` of ``None`` means "not measured": the terminal voltage is
    returned unchanged rather than a guessed correction being applied. A
    non-finite current is treated the same way, because a failed current
    read must not move the voltage. A non-finite *voltage* is a failed
    measurement and stays NaN.
    """
    if not math.isfinite(voltage_v):
        return math.nan
    if current_a is None or not math.isfinite(current_a):
        return float(voltage_v)

    capped = max(-MAX_COMPENSATED_CURRENT_A, min(MAX_COMPENSATED_CURRENT_A, float(current_a)))
    return float(voltage_v) - capped * PACK_INTERNAL_R_OHM


def voltage_to_soc(voltage_v: float, current_a: float | None = None) -> float:
    """Map a pack reading to usable SOC fraction in [0, 1].

    Estimates OCV from ``voltage_v`` and ``current_a`` (see ``estimate_ocv``),
    then renormalizes the generic 3S shape so this charger's measured high is
    100 % and the logged hard cutoff is 0 %. Values outside that window clamp
    to 0 or 1.

    ``current_a`` is optional so an ammeter-less caller still gets the old
    uncompensated answer instead of an exception — but that answer reads low
    under load, which is the defect this argument exists to fix. Callers with
    a current reading must pass it.

    Does not invent a reading for a missing sensor — callers must not call
    this when ``present`` is false.
    """
    ocv = estimate_ocv(voltage_v, current_a)
    if not math.isfinite(ocv):
        # Any non-finite volts (NaN, ±inf) is a failed measurement and returns
        # NaN. Letting ±inf fall through to the clamps below would fabricate
        # '100 %' / '0 %' from a broken sensor.
        return math.nan
    if ocv <= PACK_HARD_EMPTY_V:
        return 0.0
    if ocv >= PACK_USABLE_FULL_V:
        return 1.0

    chem = chemistry_voltage_to_soc(ocv)
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


def pack_state(voltage_v: float, current_a: float | None = None) -> str:
    """Name the pack's operating band from measured time-to-cutoff.

    Returns one of ``nominal`` / ``low`` / ``reserve`` / ``critical``, or
    ``unknown`` for a failed measurement. Prefer this over a percentage
    threshold for anything that makes a decision: the band edges come from
    two logged run-to-empty discharges, whereas the percentage still rides a
    borrowed chemistry table with no rested samples behind it.

    ``reserve`` is a working band, not a stop signal — it is roughly 5 to 17
    measured minutes, and it is where the 2026-08-14 session was aborted
    believing it had 1.7 %. ``critical`` is the one that means land now.
    """
    ocv = estimate_ocv(voltage_v, current_a)
    if not math.isfinite(ocv):
        return STATE_UNKNOWN
    if ocv <= STATE_CRITICAL_MAX_OCV_V:
        return STATE_CRITICAL
    if ocv <= STATE_RESERVE_MIN_OCV_V:
        return STATE_RESERVE
    if ocv <= STATE_LOW_MIN_OCV_V:
        return STATE_LOW
    return STATE_NOMINAL


def legacy_fake_percentage(voltage_v: float) -> float:
    """Reproduce ugv_bringup's fake V/12.6 field for brownout comparisons."""
    return float(voltage_v) / PACK_FULL_V
