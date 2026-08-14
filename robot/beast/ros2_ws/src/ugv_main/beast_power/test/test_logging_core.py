# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Tests for the durable power-log sink and coulomb counter."""

from __future__ import annotations

import errno
import logging
import math
import os

import pytest

from beast_power.logging_core import (
    COLUMNS,
    ChargeIntegrator,
    DurableCsvWriter,
    LogAlreadyActive,
    build_row,
    fcntl,
    resume_integrator,
)


def _line_count(path):
    """Newline count with the handle deterministically closed (review nit:
    bare open().read() leaks an fd under ResourceWarning handling)."""
    with open(path) as handle:
        return len(handle.read().strip().split('\n'))


# The header written to disk, spelled out literally: a wrong COLUMNS constant
# must fail these tests rather than self-validate against itself.
_LITERAL_HEADER = (
    'utc,mono_s,dt_s,voltage_v,current_a,power_w,percentage,'
    'legacy_fake_pct,charge_mah,energy_wh,power_supply_status,'
    'power_supply_health,present,charging_active,note'
)


def _row(**overrides):
    base = dict(
        utc='2026-08-07T22:48:17.000Z',
        mono_s=1.0,
        dt_s=1.0,
        voltage_v=10.25,
        current_a=-0.14,
        percentage=0.09,
        legacy_fake_pct=0.813,
        charge_mah=-1.5,
        energy_wh=-0.015,
        power_supply_status=2,
        power_supply_health=1,
        present=True,
        charging_active=False,
        note='',
    )
    base.update(overrides)
    return build_row(**base)


class TestChargeIntegrator:
    def test_discharge_accumulates_negative_mah(self):
        acc = ChargeIntegrator()
        # 1.0 A out for 3600 s = -1000 mAh.
        for _ in range(3600):
            acc.add(-1.0, 12.0, 1.0)
        assert acc.charge_mah == pytest.approx(-1000.0, rel=1e-9)
        assert acc.energy_wh == pytest.approx(-12.0, rel=1e-9)

    def test_charge_accumulates_positive(self):
        acc = ChargeIntegrator()
        acc.add(2.0, 12.6, 1800.0)
        # dt clamps to max_gap_s (10 s), not 1800 s.
        assert acc.charge_mah == pytest.approx(2.0 * 1000.0 * (10.0 / 3600.0))
        assert acc.gaps_clamped == 1

    def test_long_gap_cannot_fabricate_capacity(self):
        """A suspended logger must not invent charge from one stale sample."""
        acc = ChargeIntegrator(max_gap_s=5.0)
        acc.add(-1.0, 12.0, 86400.0)
        assert abs(acc.charge_mah) < 2.0
        assert acc.gaps_clamped == 1

    @pytest.mark.parametrize('dt', [0.0, -1.0, math.nan, math.inf])
    def test_bad_dt_contributes_nothing(self, dt):
        acc = ChargeIntegrator()
        acc.add(-1.0, 12.0, dt)
        assert acc.charge_mah == 0.0
        assert acc.energy_wh == 0.0

    @pytest.mark.parametrize('bad_gap', [0.0, -1.0, math.nan, math.inf])
    def test_bad_max_gap_s_rejected(self, bad_gap):
        """NaN/inf slip past a naive `<= 0` check and disable clamping."""
        with pytest.raises(ValueError):
            ChargeIntegrator(max_gap_s=bad_gap)

    def test_absent_current_contributes_nothing(self):
        acc = ChargeIntegrator()
        acc.add(None, 12.0, 1.0)
        acc.add(math.nan, 12.0, 1.0)
        assert acc.charge_mah == 0.0

    def test_absent_voltage_still_counts_charge(self):
        """Charge needs only current; energy needs both."""
        acc = ChargeIntegrator()
        acc.add(-1.0, None, 3600.0)
        assert acc.charge_mah != 0.0
        assert acc.energy_wh == 0.0

    def test_seeded_integrator_keeps_prior_total(self):
        acc = ChargeIntegrator(charge_mah=-123.4, energy_wh=-1.5)
        acc.add(-1.0, 12.0, 1.0)
        assert acc.charge_mah == pytest.approx(-123.4 - 1000.0 / 3600.0)
        assert acc.energy_wh == pytest.approx(-1.5 - 12.0 / 3600.0)


class TestBuildRow:
    def test_column_count_matches_header(self):
        assert len(_row()) == len(COLUMNS)

    def test_power_is_voltage_times_current(self):
        cells = _row(voltage_v=10.0, current_a=-0.5)
        assert cells[COLUMNS.index('power_w')] == '-5.0000'

    def test_missing_sensor_writes_empty_not_zero(self):
        """Empty cell = not measured; 0.0 would read as a real measurement."""
        cells = _row(voltage_v=None, current_a=math.nan, present=False)
        assert cells[COLUMNS.index('voltage_v')] == ''
        assert cells[COLUMNS.index('current_a')] == ''
        assert cells[COLUMNS.index('power_w')] == ''
        assert cells[COLUMNS.index('present')] == '0'

    def test_unknown_charging_is_empty_not_false(self):
        cells = _row(charging_active=None)
        assert cells[COLUMNS.index('charging_active')] == ''
        assert _row(charging_active=False)[COLUMNS.index('charging_active')] == '0'

    @pytest.mark.parametrize('field', ['utc', 'note'])
    @pytest.mark.parametrize('bad', ['a,b', 'a\nb', 'a\rb'])
    def test_free_text_cells_reject_comma_and_newline(self, field, bad):
        """One raw comma shifts every column for every downstream parse."""
        with pytest.raises(ValueError):
            _row(**{field: bad})


class TestDurableCsvWriter:
    def test_writes_header_once_and_appends(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row())
        w.close()

        w2 = DurableCsvWriter(path)
        w2.write_row(_row())
        w2.close()

        lines = open(path).read().strip().split('\n')
        assert lines[0] == _LITERAL_HEADER
        assert len(lines) == 3

    def test_creates_parent_directory(self, tmp_path):
        path = str(tmp_path / 'nested' / 'deeper' / 'p.csv')
        DurableCsvWriter(path).close()
        assert os.path.exists(path)

    def test_row_is_flushed_and_visible_before_next_sample(self, tmp_path):
        """Flush, not fsync: a row is readable through a second handle before
        the next is taken. Power-cut durability itself is not provable from
        userspace — this pins the half of the guarantee that is."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path, fsync_every_n=1)
        w.write_row(_row())
        # Read through a separate handle without closing the writer.
        assert len(open(path).read().strip().split('\n')) == 2
        w.close()

    def test_write_after_close_raises_and_stays_out_of_the_file(self, tmp_path):
        """A closed writer must not silently reopen: it would write WITHOUT
        the exclusive lock close() released, interleaving unlocked rows into
        a file another process may now legitimately hold."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row())
        w.close()
        with pytest.raises(ValueError):
            w.write_row(_row())
        assert _line_count(path) == 2  # header + one row; the zombie wrote nothing

    def test_rotation_keeps_backups(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path, max_bytes=400, backup_count=2)
        for _ in range(60):
            w.write_row(_row())
        w.close()

        assert os.path.exists(path)
        assert os.path.exists(path + '.1')
        assert os.path.exists(path + '.2')
        assert not os.path.exists(path + '.3')

    def test_rotated_file_has_header(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path, max_bytes=400, backup_count=1)
        for _ in range(40):
            w.write_row(_row())
        w.close()
        assert open(path).readline().strip() == _LITERAL_HEADER

    def test_zero_backups_truncates_and_cannot_fill_disk(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path, max_bytes=400, backup_count=0)
        for _ in range(80):
            w.write_row(_row())
        w.close()
        assert os.path.getsize(path) < 1200
        assert not os.path.exists(path + '.1')

    def test_truncated_header_refuses_to_append(self, tmp_path):
        """A crash mid-header-write leaves a partial header line; appending
        rows under a garbage column list would corrupt every downstream parse,
        so refuse loudly instead of silently interleaving data."""
        path = str(tmp_path / 'p.csv')
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write('utc,mono_s,dt_s,volta\n')  # header truncated mid-write
        with pytest.raises(ValueError):
            DurableCsvWriter(path)
        # Refusal leaves the file untouched and releases the lock: a second
        # attempt hits the same refusal, not LogAlreadyActive.
        assert open(path, encoding='utf-8').read() == 'utc,mono_s,dt_s,volta\n'
        with pytest.raises(ValueError):
            DurableCsvWriter(path)

    def test_terminatorless_header_refuses_to_append(self, tmp_path):
        """A power loss can persist every header character but not the
        trailing newline; an 'a' append would then merge the first data row
        into the header text. An unterminated header must be rejected like
        any other corrupt one."""
        path = str(tmp_path / 'p.csv')
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write(_LITERAL_HEADER)  # exact header, NO trailing newline
        with pytest.raises(ValueError):
            DurableCsvWriter(path)
        assert open(path, encoding='utf-8').read() == _LITERAL_HEADER
        with pytest.raises(ValueError):
            DurableCsvWriter(path)

    def test_truncated_header_refuses_before_tail_repair_can_run(
            self, tmp_path, caplog):
        """Precedence: a truncated header — possibly the file's only line —
        must refuse loudly, never be silently 'repaired' by tail truncation
        (truncating it would empty the file and lose provenance). The tail
        repair runs first but has no newline to truncate back to, so it
        leaves the file untouched and the header guard raises."""
        path = str(tmp_path / 'p.csv')
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write(_LITERAL_HEADER)  # no trailing newline
        with caplog.at_level(logging.WARNING, logger='beast_power.logging_core'):
            with pytest.raises(ValueError):
                DurableCsvWriter(path)
        # File byte-identical after refusal; the repair's only warning is its
        # decline — never a truncation.
        with open(path, encoding='utf-8') as handle:
            assert handle.read() == _LITERAL_HEADER
        assert len(caplog.records) == 1
        assert 'left untouched' in caplog.records[0].getMessage()

    def test_partial_tail_row_is_truncated_on_open(self, tmp_path, caplog):
        """A SIGKILL/power-cut inside the kernel write() persists a partial
        final row (proven by fault injection in the Phase 3 integration test).
        On open the writer must drop that unterminated tail back to the last
        newline so the next append starts a clean line — never merge the new
        row into the partial one."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row(utc='row-1'))
        w.write_row(_row(utc='row-2'))
        w.close()
        # Simulate the persisted prefix of an in-flight row (no newline).
        partial = 'PARTIAL_TAIL_MARKER,2026-08-07T22:48:17.000Z'
        with open(path, 'a', encoding='utf-8') as handle:
            handle.write(partial)

        with caplog.at_level(logging.WARNING, logger='beast_power.logging_core'):
            w2 = DurableCsvWriter(path)
            w2.write_row(_row(utc='row-3'))
            w2.close()

        with open(path, encoding='utf-8') as handle:
            raw = handle.read()
        # The partial tail is gone; every line is complete and newline-ended.
        assert 'PARTIAL_TAIL_MARKER' not in raw
        assert raw.endswith('\n')
        assert raw.count('\n') == 4  # header + rows 1..3
        lines = raw.strip().split('\n')
        assert lines[0] == _LITERAL_HEADER
        assert lines[3].startswith('row-3')  # new row starts on a clean line
        # Repair warned once, naming exactly the bytes it dropped.
        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.WARNING
        assert 'unterminated' in caplog.records[0].getMessage()
        assert f'{len(partial)} byte(s)' in caplog.records[0].getMessage()

    def test_file_ending_exactly_at_newline_is_untouched(
            self, tmp_path, caplog):
        """A cleanly terminated log must open without truncation: the original
        bytes are a byte-identical prefix of the file after reopen."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row(utc='row-1'))
        w.write_row(_row(utc='row-2'))
        w.close()
        with open(path, encoding='utf-8') as handle:
            before = handle.read()

        with caplog.at_level(logging.WARNING, logger='beast_power.logging_core'):
            w2 = DurableCsvWriter(path)
            w2.write_row(_row(utc='row-3'))
            w2.close()

        with open(path, encoding='utf-8') as handle:
            raw = handle.read()
        assert raw.startswith(before)
        assert raw.count('\n') == before.count('\n') + 1
        assert caplog.records == []

    @pytest.mark.parametrize(
        'kwargs',
        [
            {'max_bytes': 0},
            {'max_bytes': float('nan')},
            {'max_bytes': float('inf')},
            {'max_bytes': True},
            {'max_bytes': 1.5},
            {'backup_count': -1},
            {'fsync_every_n': 0},
            {'fsync_every_n': float('nan')},
            {'fsync_every_n': float('inf')},
            {'fsync_every_n': True},
            {'fsync_every_n': 1.5},
        ],
    )
    def test_rejects_invalid_config(self, tmp_path, kwargs):
        """NaN/inf slip past a bare `<= 0` check (both comparisons are False),
        and then rotation/fsync never fire — silent disk fill and zero
        durability. Bools and non-integral values make rotation/fsync behavior
        surprising and are rejected too; integral floats (YAML `5e6`) stay
        accepted."""
        with pytest.raises(ValueError):
            DurableCsvWriter(str(tmp_path / 'p.csv'), **kwargs)

    def test_integral_float_config_accepted(self, tmp_path):
        """YAML configs legitimately yield integral floats; they must behave
        like the ints they stand for (rotation + fsync both fire)."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(
            path, max_bytes=400.0, fsync_every_n=2.0, backup_count=1
        )
        for _ in range(10):
            w.write_row(_row())
        w.close()
        assert os.path.exists(path)


@pytest.mark.skipif(fcntl is None, reason='POSIX file locking only')
class TestExclusiveLock:
    """Two writers on one path interleave two charge integrals — observed live
    on 2026-08-07 and the reason this lock exists."""

    def test_second_writer_is_refused(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        first = DurableCsvWriter(path)
        try:
            with pytest.raises(LogAlreadyActive):
                DurableCsvWriter(path)
        finally:
            first.close()

    def test_tail_repair_happens_under_the_lock(self, tmp_path):
        """_open repairs a partial tail only after lock acquisition: the first
        writer truncates it and keeps holding the lock, so a second writer is
        still refused — truncation can never race another appender."""
        path = str(tmp_path / 'p.csv')
        first = DurableCsvWriter(path)
        first.write_row(_row(utc='row-1'))
        first.close()
        with open(path, 'a', encoding='utf-8') as handle:
            handle.write('PARTIAL_TAIL_MARKER,2026-08-07T22:48:17.000Z')
        try:
            first = DurableCsvWriter(path)
            with open(path, encoding='utf-8') as handle:
                assert 'PARTIAL_TAIL_MARKER' not in handle.read()
            with pytest.raises(LogAlreadyActive):
                DurableCsvWriter(path)
        finally:
            first.close()

    def test_lock_released_on_close(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        DurableCsvWriter(path).close()
        DurableCsvWriter(path).close()  # must not raise

    def test_refused_writer_leaves_data_untouched(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        first = DurableCsvWriter(path)
        first.write_row(_row())
        try:
            with pytest.raises(LogAlreadyActive):
                DurableCsvWriter(path)
        finally:
            first.close()
        assert _line_count(path) == 2

    def test_rotation_keeps_the_lock(self, tmp_path):
        """Rotation reopens the data file; the sidecar lock must survive it."""
        path = str(tmp_path / 'p.csv')
        first = DurableCsvWriter(path, max_bytes=400, backup_count=1)
        try:
            for _ in range(40):
                first.write_row(_row())
            with pytest.raises(LogAlreadyActive):
                DurableCsvWriter(path)
        finally:
            first.close()

    def test_exclusive_false_allows_second_writer(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        a = DurableCsvWriter(path, exclusive=False)
        b = DurableCsvWriter(path, exclusive=False)
        a.close()
        b.close()


class _FcntlBoom:
    """fcntl stand-in whose flock always fails the same way."""

    LOCK_EX = 2
    LOCK_NB = 4
    LOCK_UN = 8

    def __init__(self, exc):
        self._exc = exc

    def flock(self, fd, op):
        raise self._exc


class TestLockFailureModes:
    """The lock must only cry 'already active' for actual contention."""

    def test_contention_errno_maps_to_log_already_active(
            self, tmp_path, monkeypatch):
        exc = OSError(errno.EAGAIN, 'resource temporarily unavailable')
        monkeypatch.setattr('beast_power.logging_core.fcntl', _FcntlBoom(exc))
        with pytest.raises(LogAlreadyActive):
            DurableCsvWriter(str(tmp_path / 'p.csv'))

    def test_operational_errno_reraises_as_os_error(
            self, tmp_path, monkeypatch):
        """ENOLCK/EOPNOTSUPP/EPERM are not contention — misreporting them
        sends the operator hunting for a second process that does not exist."""
        monkeypatch.setattr(
            'beast_power.logging_core.fcntl',
            _FcntlBoom(OSError(errno.ENOLCK, 'no locks available')),
        )
        with pytest.raises(OSError) as excinfo:
            DurableCsvWriter(str(tmp_path / 'p.csv'))
        assert excinfo.type is OSError  # not LogAlreadyActive

    def test_close_with_fsync_failure_still_releases_lock(
            self, tmp_path, monkeypatch):
        """A dying disk at close() must not leak the lock into the next boot."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row())

        def bad_fsync(fd):
            raise OSError(errno.EIO, 'disk gone')

        monkeypatch.setattr(os, 'fsync', bad_fsync)
        with pytest.raises(OSError):
            w.close()
        assert w._closed is True
        assert w._lock_handle is None
        # Lock really released: a fresh writer acquires it on the same path.
        w2 = DurableCsvWriter(path)
        monkeypatch.undo()  # restore fsync before the clean close
        w2.close()


class TestUtcIsRealClock:
    def test_epoch_rows_are_not_real(self):
        from beast_power.logging_core import utc_is_real_clock

        assert not utc_is_real_clock('1970-01-01T00:00:42.957Z')
        assert not utc_is_real_clock('2019-12-31T23:59:59.000Z')
        assert not utc_is_real_clock('')
        assert not utc_is_real_clock('not-a-date')

    def test_synced_clock_is_real(self):
        from beast_power.logging_core import utc_is_real_clock

        assert utc_is_real_clock('2026-08-14T05:50:56.249Z')
        assert utc_is_real_clock('2020-01-01T00:00:00.000Z')


class TestResumeIntegrator:
    def test_missing_file_is_zero(self, tmp_path):
        assert resume_integrator(str(tmp_path / 'nope.csv')) == (0.0, 0.0)

    def test_empty_file_is_zero(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        open(path, 'w', encoding='utf-8').close()
        assert resume_integrator(path) == (0.0, 0.0)

    def test_last_row_resumes(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row(charge_mah=-10.0, energy_wh=-0.1))
        w.write_row(_row(charge_mah=-123.4, energy_wh=-1.5))
        w.close()
        assert resume_integrator(path) == pytest.approx((-123.4, -1.5))

    def test_pre_ntp_rows_still_carry_their_totals(self, tmp_path):
        """A boot that never reaches NTP must not lose its integral.

        Rows written before the clock syncs carry an empty utc and
        note=pre_ntp_clock, but charge_mah/energy_wh come from the monotonic
        integrator and are valid regardless of the wall clock. Skipping them
        here used to discard the whole session's accumulated charge — exactly
        the offline capacity run the integral exists to measure.
        """
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row(utc='2026-08-10T16:15:06.000Z', charge_mah=-50.0, energy_wh=-0.5))
        w.write_row(_row(utc='', note='pre_ntp_clock', charge_mah=-77.5, energy_wh=-0.9))
        w.close()
        assert resume_integrator(path) == pytest.approx((-77.5, -0.9))

    def test_rows_with_unusable_totals_are_skipped(self, tmp_path):
        """Empty/non-finite charge cells carry nothing to resume from."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row(utc='2026-08-10T16:15:06.000Z', charge_mah=-50.0, energy_wh=-0.5))
        # _num renders NaN as an empty cell — "not measured".
        w.write_row(_row(charge_mah=float('nan'), energy_wh=float('nan')))
        w.close()
        with open(path, 'a', encoding='utf-8', newline='') as handle:
            handle.write('2026-08-10T16:17:06.000Z,junk\n')
        assert resume_integrator(path) == pytest.approx((-50.0, -0.5))

    def test_header_only_is_zero(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        DurableCsvWriter(path).close()
        assert resume_integrator(path) == (0.0, 0.0)

    def test_header_only_active_file_falls_back_to_newest_backup(self, tmp_path):
        """Rotation moves the totals to <path>.1 and leaves a header-only
        active file; a restart right then must resume from the backup, not
        zero."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row(charge_mah=-321.0, energy_wh=-3.9))
        w.close()
        os.replace(path, f'{path}.1')
        DurableCsvWriter(path).close()
        assert resume_integrator(path) == pytest.approx((-321.0, -3.9))

    def test_active_rows_beat_backup(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row(charge_mah=-1.0, energy_wh=-0.01))
        w.close()
        os.replace(path, f'{path}.1')
        w = DurableCsvWriter(path)
        w.write_row(_row(charge_mah=-2.0, energy_wh=-0.02))
        w.close()
        assert resume_integrator(path) == pytest.approx((-2.0, -0.02))
