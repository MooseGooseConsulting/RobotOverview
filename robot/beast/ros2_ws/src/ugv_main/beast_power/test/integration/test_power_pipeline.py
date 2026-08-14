# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Real-ROS integration tier: rclpy + DDS pub/sub → BatteryState → CSV.

The host suite exercises the strict-stub tier: it proves ``PowerNode.__init__``
really runs and ``_publish_once`` really publishes against the strict message
stand-ins, but nothing in that tier proves the two nodes talk to each other
over DDS with the field set the rest of the stack reads. This file is that
tier: real rclpy context, real ``PowerNode`` / ``PowerLogger`` nodes, real
``sensor_msgs/BatteryState`` over a real wire, a real CSV on disk.

The ONE boundary faked is the hardware: ``smbus2`` is stubbed at the
``sys.modules`` level (a register dict + a fail flag), because the point of
this tier is the real ROS graph — the INA219 register decode math is already
pinned by the datasheet-vector unit tests, and re-simulating the chip here
would only test the simulator.

Runs only where rclpy is a genuinely installed package (the CI
``ros:humble-ros-base`` container). On the host — where the parent
conftest.py has installed its spec-less rclpy stand-in — this module skips
wholesale with a clear reason, so ``-m "not integration"`` and a bare run both
stay green.
"""

from __future__ import annotations

import csv
import importlib
import math
import os
import struct
import subprocess
import sys
import time
from pathlib import Path
from types import ModuleType

import pytest

pytestmark = pytest.mark.integration

try:
    import rclpy
except ImportError:
    rclpy = None  # type: ignore[assignment]

# The host conftest installs a spec-less rclpy stand-in that imports fine but
# is NOT the real thing — the spec check is what distinguishes them.
if rclpy is None or getattr(rclpy, '__spec__', None) is None:
    pytest.skip(
        'integration tests need a real ROS 2 install (rclpy + DDS over '
        'loopback); run them in the CI ros:humble-ros-base container — the '
        'host suite exercises the strict-stub tier instead',
        allow_module_level=True,
    )

from rclpy.node import Node  # noqa: E402
from rclpy.qos import QoSProfile, ReliabilityPolicy  # noqa: E402
from sensor_msgs.msg import BatteryState  # noqa: E402
from std_msgs.msg import Bool  # noqa: E402

from beast_power.ina219 import (  # noqa: E402
    BUS_VOLTAGE_LSB,
    CURRENT_LSB,
    POWER_LSB,
    REG_BUSVOLTAGE,
    REG_CURRENT,
    REG_POWER,
    REG_SHUNTVOLTAGE,
    RSHUNT,
    SHUNT_VOLTAGE_LSB,
)
from beast_power.logger_node import PowerLogger  # noqa: E402
from beast_power.logging_core import COLUMNS, build_row  # noqa: E402
from beast_power.soc import voltage_to_soc  # noqa: E402
from beast_power.power_node import PowerNode  # noqa: E402
from beast_power.telemetry import (  # noqa: E402
    POWER_SUPPLY_HEALTH_GOOD,
    POWER_SUPPLY_HEALTH_UNKNOWN,
    POWER_SUPPLY_STATUS_DISCHARGING,
    POWER_SUPPLY_STATUS_UNKNOWN,
)


# ---------------------------------------------------------------------------
# Hardware boundary: minimal smbus2 stand-in (no conftest.py in this dir — a
# second module named ``conftest`` would shadow the parent's in sys.modules
# and break test_conftest_install.py).
# ---------------------------------------------------------------------------


class FakeSMBus2:
    """Minimal ``smbus2.SMBus``: register dict + fail flag, no chip simulation.

    ``regs`` maps register number to a 16-bit value; ``write_i2c_block_data``
    stores the 2-byte big-endian payload, ``read_i2c_block_data`` returns it.
    ``fail`` makes every transfer raise ``OSError`` — the wedged-bus state the
    node must survive. ``close`` never raises, mirroring reality: a wedged fd
    is still closable, and PowerNode's reconnect path closes the bus without
    error handling.
    """

    def __init__(self) -> None:
        self.regs: dict[int, int] = {}
        self.fail = False
        self.opened_bus: int | None = None
        self.close_count = 0

    def open(self, bus_nr: int) -> None:
        if self.fail:
            raise OSError('FakeSMBus2: no such device (fail flag set)')
        self.opened_bus = int(bus_nr)

    def close(self) -> None:
        self.close_count += 1
        self.opened_bus = None

    def write_i2c_block_data(
        self, address: int, register: int, data: list[int]
    ) -> None:
        self._raise_if_fail()
        self.regs[register] = int.from_bytes(bytes(data[:2]), 'big')

    def read_i2c_block_data(
        self, address: int, register: int, length: int
    ) -> list[int]:
        self._raise_if_fail()
        value = self.regs.get(register, 0) & 0xFFFF
        return list(struct.pack('>H', value)[:length])

    def _raise_if_fail(self) -> None:
        if self.fail:
            raise OSError('FakeSMBus2: I2C transfer failed (wedged)')


def _install_smbus2_stub() -> None:
    """Put the fake bus into ``sys.modules`` unless smbus2 is really installed.

    Same ``__spec__`` rule the parent conftest uses: a genuine installed
    package always wins, a spec-less injected stub is overwritten. The real
    node's ``_default_bus_factory`` does ``import smbus2`` lazily, so the stub
    only needs to be present before any node opens a bus.
    """
    try:
        module = importlib.import_module('smbus2')
    except ImportError:
        module = None
    if module is not None and getattr(module, '__spec__', None) is not None:
        return
    stub = ModuleType('smbus2')
    stub.SMBus = FakeSMBus2
    sys.modules['smbus2'] = stub


_install_smbus2_stub()

_PKG_ROOT = Path(__file__).resolve().parents[2]

# CSV column index lookup so assertions survive column reordering.
_CI = {name: i for i, name in enumerate(COLUMNS)}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _qos(reliability: ReliabilityPolicy) -> QoSProfile:
    return QoSProfile(depth=10, reliability=reliability)


def _make_subscriber(name, msg_type, topic, qos, sink):
    """A bare real node with one subscription appending to ``sink``."""
    node = Node(name)
    node.create_subscription(msg_type, topic, sink.append, qos)
    return node


def _spin_until(nodes, predicate, timeout_s: float = 8.0) -> bool:
    """Spin real nodes until ``predicate()`` or timeout; True when it hit.

    Spins every node in ``nodes`` (timers and subscriptions live on their own
    node) and tolerates discovery latency — callers use this instead of fixed
    sleeps so a slow first match cannot flake the suite.
    """
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        for node in nodes:
            rclpy.spin_once(node, timeout_sec=0.02)
        if predicate():
            return True
    return False


def _set_measurement(bus, bus_voltage_v: float, current_a: float) -> None:
    """Encode volts/amps into the fake's measurement registers.

    Test-side ENCODING using the production LSB constants, so the real
    ``Ina219.read()`` decode runs end to end — this is not a chip simulator,
    and the decode math itself is already pinned by the datasheet vectors.
    """
    bus_raw = int(round(bus_voltage_v / BUS_VOLTAGE_LSB))
    bus.regs[REG_BUSVOLTAGE] = (bus_raw & 0x1FFF) << 3

    current_raw = int(round(current_a / CURRENT_LSB))
    current_raw = max(-32768, min(32767, current_raw))
    bus.regs[REG_CURRENT] = current_raw & 0xFFFF

    shunt_raw = int(round(current_a * RSHUNT / SHUNT_VOLTAGE_LSB))
    shunt_raw = max(-32768, min(32767, shunt_raw))
    bus.regs[REG_SHUNTVOLTAGE] = shunt_raw & 0xFFFF

    # Power register wraps two's complement on the chip for negative
    # (discharge) power; emit the same raw value so the driver's signed
    # decode sees the physical sign.
    power_raw = int(round(bus_voltage_v * current_a / POWER_LSB))
    bus.regs[REG_POWER] = power_raw & 0xFFFF


def _read_csv_rows(path: Path) -> list[list[str]]:
    with open(path, newline='', encoding='utf-8') as handle:
        return list(csv.reader(handle))


def _csv_row_count(path: Path) -> int:
    """Data rows in the CSV (header excluded); 0 when absent/header-only.

    Safe to poll while the logger/subprocess is live: rows are flushed and
    fsynced per write, so a reader only ever sees complete lines.
    """
    if not path.exists():
        return 0
    return max(0, len(_read_csv_rows(path)) - 1)


@pytest.fixture
def ros() -> None:
    """One real rclpy context per test, with a fast publish/reconnect cadence.

    The shortened cadence arrives through the real ROS parameter override path
    (the same ``-p`` machinery the launch file uses), so the tests exercise the
    node's parameter plumbing rather than a poked attribute — 5 Hz keeps a CI
    run at seconds instead of tens of seconds.
    """
    rclpy.init(args=[
        '--ros-args',
        '-p', 'data_publish_rate:=5.0',
        '-p', 'reconnect_interval_sec:=0.5',
    ])
    yield
    if rclpy.ok():
        rclpy.shutdown()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_real_pubsub_battery_fields_and_present_transition(ros):
    """Real PowerNode over DDS: honest fields on both sides of a present flip.

    The node starts with a dead bus (absent-sensor status: present=False,
    percentage NaN, status UNKNOWN), the bus heals, and the reconnect window
    elapses — a real subscriber sees the transition and asserts every field the
    rest of the stack depends on.
    """
    bus = FakeSMBus2()
    _set_measurement(bus, 12.0, -0.3)
    bus.fail = True  # start absent: open() raises OSError

    node = PowerNode(bus_factory=lambda: bus)
    node.start()

    voltage_sink: list = []
    charging_sink: list = []
    voltage_sub = _make_subscriber(
        'itest_fields_voltage', BatteryState, '/ugv/voltage',
        _qos(ReliabilityPolicy.RELIABLE), voltage_sink)
    charging_sub = _make_subscriber(
        'itest_fields_charging', Bool, '/ugv/charging_active',
        _qos(ReliabilityPolicy.RELIABLE), charging_sink)

    try:
        # Phase 1 — sensor absent: honest status, never a fabricated SOC.
        assert _spin_until(
            [node, voltage_sub, charging_sub],
            lambda: any(not m.present for m in voltage_sink),
        ), 'never observed an absent-sensor sample over DDS'
        absent = [m for m in voltage_sink if not m.present]
        assert absent
        for msg in absent:
            assert msg.present is False
            assert msg.voltage == 0.0
            assert math.isnan(msg.percentage)
            assert msg.power_supply_status == POWER_SUPPLY_STATUS_UNKNOWN
            assert msg.power_supply_health == POWER_SUPPLY_HEALTH_UNKNOWN

        # Phase 2 — bus healed, reconnect window elapsed: real telemetry.
        bus.fail = False
        assert _spin_until(
            [node, voltage_sub, charging_sub],
            lambda: any(m.present for m in voltage_sink),
        ), 'real telemetry never resumed after the bus healed'
        present = [m for m in voltage_sink if m.present]
        assert present
        for msg in present[-5:]:
            assert msg.present is True
            assert msg.voltage == pytest.approx(12.0, abs=0.05)
            assert msg.current == pytest.approx(-0.3, abs=0.05)
            assert math.isfinite(msg.percentage)
            assert 0.0 <= msg.percentage <= 1.0
            assert msg.power_supply_status == POWER_SUPPLY_STATUS_DISCHARGING
            assert msg.power_supply_health == POWER_SUPPLY_HEALTH_GOOD

        # The Bool topic carries the same charging truth (discharging run).
        assert charging_sink
        assert all(msg.data is False for msg in charging_sink)
    finally:
        node.shutdown()
        node.destroy_node()
        voltage_sub.destroy_node()
        charging_sub.destroy_node()


def test_power_logger_writes_real_csv(tmp_path):
    """Real PowerLogger subscribed to the real topics writes a real CSV.

    Rows appear as the sensor publishes; absent-sensor rows stay honest —
    percentage is an empty cell (the node publishes NaN, which must never be
    rendered as a number), present=0 disambiguates the deliberate 0.0 volts,
    and status is UNKNOWN — the first row carries the session_start note, and
    dt tracks the publish cadence.
    """
    csv_path = tmp_path / 'power-log.csv'
    # output_path through the real parameter override path — the same -p
    # machinery the launch file uses — so the logger writes where the test can
    # read it; the default /data/... path is robot-only.
    rclpy.init(args=[
        '--ros-args',
        '-p', 'data_publish_rate:=5.0',
        '-p', 'reconnect_interval_sec:=0.5',
        '-p', f'output_path:={csv_path}',
    ])
    bus = FakeSMBus2()
    _set_measurement(bus, 12.0, -0.3)
    bus.fail = True  # absent phase first: honest rows must be logged too
    node = None
    logger = None
    try:
        node = PowerNode(bus_factory=lambda: bus)
        node.start()
        logger = PowerLogger()

        # Absent phase: the logger's BEST_EFFORT sub discovers the publisher
        # and starts recording honest absent rows (empty cells, present=0).
        assert _spin_until(
            [node, logger], lambda: _csv_row_count(csv_path) >= 3,
        ), 'logger never recorded rows while the sensor was absent'

        bus.fail = False
        assert _spin_until(
            [node, logger], lambda: _csv_row_count(csv_path) >= 8,
        ), 'logger never recorded real-telemetry rows after the bus healed'
    finally:
        if node is not None:
            node.shutdown()
            node.destroy_node()
        if logger is not None:
            logger.shutdown()
            logger.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()

    rows = _read_csv_rows(csv_path)
    assert rows[0] == list(COLUMNS), 'header row does not match COLUMNS'
    data = rows[1:]
    assert len(data) >= 8

    # session_start note on the first row only.
    assert data[0][_CI['note']] == 'session_start'
    assert all(row[_CI['note']] == '' for row in data[1:])

    # Honest absent rows: percentage is an empty cell (NaN on the wire, never
    # rendered as a number); the deliberate 0.0 volts (and its derived legacy
    # fake %) are disambiguated by present=0; status is UNKNOWN.
    absent = [r for r in data if r[_CI['present']] == '0']
    present = [r for r in data if r[_CI['present']] == '1']
    assert absent, 'no absent-sensor rows were logged'
    assert present, 'no present-sensor rows were logged'
    for row in absent:
        assert row[_CI['percentage']] == ''
        assert row[_CI['voltage_v']] == '0.0000'  # deliberate zero, present=0 disambiguates
        assert row[_CI['current_a']] == '0.00000'
        assert row[_CI['power_supply_status']] == '0'  # UNKNOWN
        assert row[_CI['power_supply_health']] == '0'  # UNKNOWN
    for row in present:
        assert float(row[_CI['voltage_v']]) == pytest.approx(12.0, abs=0.05)
        assert float(row[_CI['current_a']]) == pytest.approx(-0.3, abs=0.05)
        assert float(row[_CI['percentage']]) == pytest.approx(
            voltage_to_soc(12.0), abs=0.02
        )
        assert row[_CI['power_supply_status']] == '2'  # DISCHARGING

    # dt ≈ sample period (5 Hz → 0.2 s). The first row's dt is 0.0 by design
    # (no previous sample); everything after must be a plausible sample gap.
    dts = [float(r[_CI['dt_s']]) for r in data]
    assert dts[0] == 0.0
    later = dts[1:]
    assert later, 'no rows after the first'
    assert all(0.0 < dt <= 1.5 for dt in later), f'implausible dt values: {later}'
    assert sorted(later)[len(later) // 2] <= 1.0, f'median dt too large: {later}'


def test_sigkill_mid_write_leaves_only_complete_rows(tmp_path):
    """SIGKILL a writer subprocess mid-row: completed rows survive intact.

    The contract under test is the one the design actually makes: DurableCsvWriter
    flushes and fsyncs each row before the next, so a kill that skips
    close()/final-fsync costs at most the IN-FLIGHT row — every completed
    (fsynced) row is on stable storage, complete, and a strict contiguous
    prefix of the written series.

    NOTE — what this test deliberately does NOT promise is "no partial line":
    the spec for this test originally asserted the CSV always ends with a
    newline, and fault injection on Linux PROVED that does not hold. A SIGKILL
    landing inside the kernel's write() of a row persists the copied prefix in
    the page cache — the file then ends with a partial line (reproduced in CI:
    "CSV must end with a newline" failed). That is a real, if narrow, durability
    limitation: the next boot's append would merge a fresh row into that
    partial tail and shift every column for one record. The header is guarded
    on open (_check_header) but a partial TAIL is not. Fixing it is a
    production change (truncate/repair a partial tail on open), out of scope
    here per the task rules — reported in the PR instead. This test pins the
    actual guarantee: completed rows intact + contiguous, and the partial tail
    (when present) confined to a single in-flight row, never damage to a
    completed one.
    """
    csv_path = tmp_path / 'power-log.csv'
    program = tmp_path / 'writer_program.py'
    program.write_text(_WRITER_PROGRAM, encoding='utf-8')

    env = dict(os.environ)
    env['PYTHONPATH'] = str(_PKG_ROOT) + os.pathsep + env.get('PYTHONPATH', '')
    proc = subprocess.Popen(
        [sys.executable, str(program), str(csv_path)],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        assert _wait_for_proc_rows(proc, csv_path, min_rows=3), \
            'writer subprocess produced no rows before timeout'
        proc.kill()  # SIGKILL: no cleanup, no close(), no final fsync
        proc.wait(timeout=10)
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=10)

    rows = _read_csv_rows(csv_path)
    assert rows[0] == list(COLUMNS)
    data = rows[1:]
    assert len(data) >= 3

    raw = csv_path.read_text(encoding='utf-8')
    lines = raw.split('\n')
    # csv.reader yields an unterminated final line as a row too; the complete
    # rows are everything before the (possible) in-flight partial tail.
    complete = data if raw.endswith('\n') else data[:-1]
    tail = None if raw.endswith('\n') else lines[-1]

    # Every completed row is a full, intact row.
    assert len(complete) >= 3
    for row in complete:
        assert len(row) == len(COLUMNS), f'partial/corrupt row: {row!r}'
        assert row[_CI['present']] == '1'
        assert row[_CI['voltage_v']] != ''

    # Contiguous prefix: rows carry voltage 12.0000 + 0.0010 * i; any splice
    # or corruption of a completed row would break the sequence.
    expected = [f'{12.0 + i * 0.001:.4f}' for i in range(len(complete))]
    assert [row[_CI['voltage_v']] for row in complete] == expected

    if tail is None:
        assert len(complete) == len(data)  # nothing truncated at EOF
    else:
        # Damage confined to the in-flight row: exactly one unterminated tail
        # line that is a PREFIX of the very next expected row.
        assert len(complete) == len(data) - 1
        assert tail != ''
        assert len(data[-1]) <= len(COLUMNS)
        expected_next = _expected_row_text(len(complete))
        assert expected_next.startswith(tail), (
            f'partial tail is not a prefix of the in-flight row: {tail!r}'
        )


def test_qos_incompatibility_delivers_nothing_by_design(ros):
    """QoS compatibility asserted BY DELIVERY, not by introspection.

    The real graph's shape — RELIABLE publisher (PowerNode) to BEST_EFFORT
    subscriber (PowerLogger) — must deliver; the reverse polarity (BEST_EFFORT
    publisher to RELIABLE subscriber) never matches, so a naive 'fix' that
    flips either end to the wrong profile silently blackholes the topic. This
    test pins both directions.
    """
    pub_node = Node('itest_qos_pub')
    sub_node = Node('itest_qos_sub')
    try:
        # Compatible control: RELIABLE pub -> BEST_EFFORT sub. Humble rclpy
        # has no wait_for_matched, so discovery is observed through the
        # middleware's matched-subscription count while both nodes spin.
        compat_sink: list = []
        compat_pub = pub_node.create_publisher(
            Bool, '/ugv/itest_qos_compat',
            _qos(ReliabilityPolicy.RELIABLE))
        sub_node.create_subscription(
            Bool, '/ugv/itest_qos_compat', compat_sink.append,
            _qos(ReliabilityPolicy.BEST_EFFORT))
        assert _spin_until(
            [pub_node, sub_node],
            lambda: compat_pub.get_subscription_count() >= 1,
        ), 'RELIABLE pub / BEST_EFFORT sub never matched — the real graph depends on this pair'
        for _ in range(5):
            msg = Bool()
            msg.data = True
            compat_pub.publish(msg)
        assert _spin_until(
            [pub_node, sub_node], lambda: len(compat_sink) >= 5,
        ), 'RELIABLE pub -> BEST_EFFORT sub delivered nothing'

        # Incompatible pair: BEST_EFFORT pub vs RELIABLE sub never matches.
        mismatch_sink: list = []
        mismatch_pub = pub_node.create_publisher(
            Bool, '/ugv/itest_qos_mismatch',
            _qos(ReliabilityPolicy.BEST_EFFORT))
        sub_node.create_subscription(
            Bool, '/ugv/itest_qos_mismatch', mismatch_sink.append,
            _qos(ReliabilityPolicy.RELIABLE))
        for _ in range(5):
            msg = Bool()
            msg.data = True
            mismatch_pub.publish(msg)
        assert not _spin_until(
            [pub_node, sub_node], lambda: len(mismatch_sink) > 0, timeout_s=2.5,
        ), 'incompatible QoS pair delivered a message — the profile must block it'
        assert mismatch_sink == []
        # Middleware agrees: the RELIABLE sub never matched the BE pub.
        assert mismatch_pub.get_subscription_count() == 0
    finally:
        pub_node.destroy_node()
        sub_node.destroy_node()


def test_wedged_bus_publishes_absent_then_heals(ros):
    """Wedged-bus recovery on the REAL node, end to end.

    A healthy bus wedges mid-run: every transfer raises, the node publishes
    honest absent status (and must NOT crash its publish timer), then the bus
    heals and real telemetry resumes after the reconnect window.
    """
    bus = FakeSMBus2()
    _set_measurement(bus, 11.4, -0.25)

    node = PowerNode(bus_factory=lambda: bus)
    node.start()

    sink: list = []
    sub = _make_subscriber(
        'itest_wedge', BatteryState, '/ugv/voltage',
        _qos(ReliabilityPolicy.RELIABLE), sink)
    try:
        # Healthy from the start: real telemetry.
        assert _spin_until([node, sub], lambda: any(m.present for m in sink)), \
            'no healthy samples before the wedge'
        assert not any(not m.present for m in sink)
        assert sink[-1].voltage == pytest.approx(11.4, abs=0.05)
        assert sink[-1].current == pytest.approx(-0.25, abs=0.05)
        assert sink[-1].power_supply_status == POWER_SUPPLY_STATUS_DISCHARGING

        # Wedge mid-run: absent status published, node keeps ticking.
        bus.fail = True
        assert _spin_until([node, sub], lambda: any(not m.present for m in sink)), \
            'node never published absent status while wedged'
        assert sink[-1].present is False
        assert math.isnan(sink[-1].percentage)
        assert sink[-1].power_supply_status == POWER_SUPPLY_STATUS_UNKNOWN

        # Heal: reconnect window elapses, real telemetry resumes.
        bus.fail = False
        assert _spin_until([node, sub], lambda: sink[-1].present), \
            'real telemetry never resumed after the bus healed'
        assert sink[-1].present is True
        assert sink[-1].voltage == pytest.approx(11.4, abs=0.05)
        assert sink[-1].current == pytest.approx(-0.25, abs=0.05)
        assert sink[-1].power_supply_status == POWER_SUPPLY_STATUS_DISCHARGING
    finally:
        node.shutdown()
        node.destroy_node()
        sub.destroy_node()


# ---------------------------------------------------------------------------
# SIGKILL subprocess program (kept out of the test body so the kill lands in
# a plain writer loop, not a test helper).
# ---------------------------------------------------------------------------

_WRITER_PROGRAM = r'''
import sys

from beast_power.logging_core import COLUMNS, DurableCsvWriter, build_row

path = sys.argv[1]
writer = DurableCsvWriter(path, columns=COLUMNS, fsync_every_n=1)
i = 0
# Wide note cells widen the write() -> fsync() window so a SIGKILL landing
# mid-row is plausible rather than theoretical.
note = 'x' * 4096
while True:
    writer.write_row(build_row(
        utc=f'2026-01-01T00:00:{i % 60:02d}Z',
        mono_s=i / 10.0,
        dt_s=0.1,
        voltage_v=12.0 + i * 0.001,
        current_a=-0.3,
        percentage=0.8,
        legacy_fake_pct=0.95,
        charge_mah=0.0,
        energy_wh=0.0,
        power_supply_status=2,
        power_supply_health=1,
        present=True,
        charging_active=False,
        note=note,
    ))
    i += 1
'''


def _expected_row_text(i: int) -> str:
    """Render writer row ``i`` exactly as _WRITER_PROGRAM does (for tail checks).

    Must mirror the writer program byte-for-byte; the SIGKILL test uses it to
    prove a partial tail is a prefix of the very next expected row. Any drift
    between the two fails that assertion, which is the point.
    """
    cells = build_row(
        utc=f'2026-01-01T00:00:{i % 60:02d}Z',
        mono_s=i / 10.0,
        dt_s=0.1,
        voltage_v=12.0 + i * 0.001,
        current_a=-0.3,
        percentage=0.8,
        legacy_fake_pct=0.95,
        charge_mah=0.0,
        energy_wh=0.0,
        power_supply_status=2,
        power_supply_health=1,
        present=True,
        charging_active=False,
        note='x' * 4096,
    )
    return ','.join(cells) + '\n'


def _wait_for_proc_rows(
    proc, csv_path: Path, min_rows: int, timeout_s: float = 20.0
) -> bool:
    """True when the writer put ``min_rows`` complete rows on disk or died."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if _csv_row_count(csv_path) >= min_rows:
            return True
        if proc.poll() is not None:
            return False
        time.sleep(0.02)
    return False
