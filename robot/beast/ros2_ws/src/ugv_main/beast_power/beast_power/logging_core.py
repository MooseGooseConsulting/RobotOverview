# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Durable CSV sink and coulomb counter for BEAST-01 pack telemetry.

Replaces ``deploy/diagnostics/power_log.py``, a bench instrument that opened
its own I²C handle and cross-checked the INA219 against ``/ugv/voltage``. After
the 2026-08-07 cutover those became the same sensor, so the cross-check logged
one source twice under two names. This module records the pack from the single
owner (``beast_power``) instead, and adds the integration the old script could
not do.

Two requirements drive the design:

* **Survive the power cut.** A brownout log that loses its tail is worthless —
  the last seconds before collapse are the measurement. Rows are flushed and
  ``fsync``'d, so an unclean shutdown costs at most ``fsync_every_n`` samples.
* **Measure capacity, don't assume it.** ``ChargeIntegrator`` accumulates
  current over time, so a full-to-brownout run yields observed mAh rather than
  an inherited datasheet number.

Pure Python (no rclpy, no smbus) so CI and Windows pytest exercise rotation,
row building, and integration without ROS.
"""

from __future__ import annotations

import csv
import errno
import logging
import math
import os
from dataclasses import dataclass
from typing import Optional, Sequence

try:  # POSIX only; Windows CI exercises everything except the lock itself.
    import fcntl
except ImportError:  # pragma: no cover - platform dependent
    fcntl = None

_logger = logging.getLogger(__name__)


class LogAlreadyActive(RuntimeError):
    """Another process already holds the write lock for this log path."""

COLUMNS: tuple[str, ...] = (
    'utc',
    'mono_s',
    'dt_s',
    'voltage_v',
    'current_a',
    'power_w',
    'percentage',
    'legacy_fake_pct',
    'charge_mah',
    'energy_wh',
    'power_supply_status',
    'power_supply_health',
    'present',
    'charging_active',
    'note',
)


def _num(value: Optional[float], places: int) -> str:
    """Format a float for CSV, rendering None/NaN as an empty cell.

    An empty cell means "not measured". Writing 0.0 for a missing sensor would
    be indistinguishable from a real zero reading, which is exactly the kind of
    fabricated value the power cutover removed.
    """
    if value is None:
        return ''
    if not math.isfinite(value):
        return ''
    return f'{value:.{places}f}'


@dataclass
class ChargeIntegrator:
    """Accumulate charge (mAh) and energy (Wh) from sampled current.

    Sign follows ``BatteryState.current``: positive is into the pack, so a
    discharge run drives ``charge_mah`` negative and observed capacity is its
    magnitude between full and cutoff.

    Absolute scale is fixed by ``RSHUNT`` in ``ina219.py`` — 0.010 Ω, verified
    off the board 2026-08-07 (PR #187). Scope: that shunt sits in the buck/5 V
    logic branch only (Jetson, LiDAR, ESP32, logic); the motor, bus-servo, and
    IO-load branches tap DC_IN before R21, so their current never crosses this
    sensor. ``charge_mah``/``energy_wh`` are therefore logic-rail truth, not
    whole-pack truth, and a capacity run is only valid while EVERY bypassed
    branch is idle (motors still, servos holding no torque, IO loads off). The
    integral is linear in RSHUNT, so any future rescale is one multiply away —
    that is why raw samples stay in the CSV.
    """

    max_gap_s: float = 10.0
    charge_mah: float = 0.0
    energy_wh: float = 0.0
    _gaps_clamped: int = 0

    def __post_init__(self) -> None:
        # NaN/inf pass a naive `<= 0` check (both comparisons are False) and
        # would disable gap clamping entirely: `dt_s > NaN` is never True, so
        # one stale sample could integrate an unbounded interval and fabricate
        # charge. Same rejection rule the INA219 threshold validation uses.
        if not math.isfinite(self.max_gap_s) or self.max_gap_s <= 0.0:
            raise ValueError('max_gap_s must be positive and finite')

    def add(self, current_a: Optional[float], voltage_v: Optional[float],
            dt_s: float) -> None:
        """Integrate one sample over ``dt_s`` seconds.

        Non-finite or non-positive ``dt_s`` contributes nothing. Gaps longer
        than ``max_gap_s`` clamp to ``max_gap_s``: a suspended process or a
        stalled sensor must not invent hours of charge transfer from one stale
        reading.
        """
        if not math.isfinite(dt_s) or dt_s <= 0.0:
            return
        if dt_s > self.max_gap_s:
            dt_s = self.max_gap_s
            self._gaps_clamped += 1

        if current_a is not None and math.isfinite(current_a):
            self.charge_mah += current_a * 1000.0 * (dt_s / 3600.0)
            if voltage_v is not None and math.isfinite(voltage_v):
                self.energy_wh += current_a * voltage_v * (dt_s / 3600.0)

    @property
    def gaps_clamped(self) -> int:
        return self._gaps_clamped


def _utc_year(utc: str) -> Optional[int]:
    """Best-effort year from an ISO utc cell. None if unparseable."""
    if len(utc) < 4:
        return None
    try:
        year = int(utc[:4])
    except ValueError:
        return None
    if year < 1000:
        return None
    return year


def resume_integrator(path: str) -> tuple[float, float]:
    """Seed charge/energy from the last durable CSV row.

    The integrator lives in RAM and used to start at 0.0 on every
    ``beast_power_logger`` start, so a ``beast-ros-base`` restart zeroed the
    running total even though the file already stored it. Read the last row
    with finite ``charge_mah`` / ``energy_wh`` and a real clock (year ≥ 2020).
    Missing, empty, or unreadable files return ``(0.0, 0.0)``.
    """
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return (0.0, 0.0)
    try:
        with open(path, encoding='utf-8', newline='') as handle:
            reader = csv.DictReader(handle)
            last: Optional[tuple[float, float]] = None
            for row in reader:
                year = _utc_year(row.get('utc') or '')
                if year is None or year < 2020:
                    continue
                try:
                    charge_mah = float(row['charge_mah'])
                    energy_wh = float(row['energy_wh'])
                except (KeyError, TypeError, ValueError):
                    continue
                if not math.isfinite(charge_mah) or not math.isfinite(energy_wh):
                    continue
                last = (charge_mah, energy_wh)
    except OSError:
        return (0.0, 0.0)
    return last if last is not None else (0.0, 0.0)


def build_row(
    *,
    utc: str,
    mono_s: float,
    dt_s: float,
    voltage_v: Optional[float],
    current_a: Optional[float],
    percentage: Optional[float],
    legacy_fake_pct: Optional[float],
    charge_mah: float,
    energy_wh: float,
    power_supply_status: Optional[int],
    power_supply_health: Optional[int],
    present: bool,
    charging_active: Optional[bool],
    note: str = '',
) -> list[str]:
    """Render one telemetry sample as CSV cells ordered per ``COLUMNS``.

    Free-text cells (``utc``, ``note``) are written raw into a comma-joined
    line, so they must not contain ``,`` ``\\n`` or ``\\r`` — one unescaped
    comma would shift every column for every downstream parse of the file,
    and a newline would splice a fake record into the series. Reject them
    here, at the boundary, rather than corrupt the log quietly.
    """
    for label, text in (('utc', utc), ('note', note)):
        if any(ch in text for ch in (',', '\n', '\r')):
            raise ValueError(
                f'{label} must not contain comma or newline: {text!r}'
            )

    if (voltage_v is not None and math.isfinite(voltage_v)
            and current_a is not None and math.isfinite(current_a)):
        power_w: Optional[float] = voltage_v * current_a
    else:
        power_w = None

    return [
        utc,
        _num(mono_s, 3),
        _num(dt_s, 3),
        _num(voltage_v, 4),
        _num(current_a, 5),
        _num(power_w, 4),
        _num(percentage, 5),
        _num(legacy_fake_pct, 5),
        _num(charge_mah, 4),
        _num(energy_wh, 5),
        '' if power_supply_status is None else str(power_supply_status),
        '' if power_supply_health is None else str(power_supply_health),
        '1' if present else '0',
        '' if charging_active is None else ('1' if charging_active else '0'),
        note,
    ]


class DurableCsvWriter:
    """Append-only CSV with size rotation and explicit durability.

    ``fsync_every_n=1`` (the default) means every sample is on stable storage
    before the next one is taken, which is the point: this file has to be
    readable after the pack collapses mid-write, not after a clean shutdown.
    Raise it only if the write rate is high enough for fsync to hurt.

    ``exclusive`` takes a whole-file lock and is on by default. Two writers on
    one path is not a harmless duplicate: each carries its own
    ``ChargeIntegrator``, so their rows interleave with two unrelated
    ``charge_mah`` series and the capacity integral silently becomes garbage.
    That happened on 2026-08-07 when a hand-started node overlapped the
    launch-managed one. Failing loudly at startup is much better than
    discovering it in the data afterwards.
    """

    def __init__(
        self,
        path: str,
        *,
        columns: Sequence[str] = COLUMNS,
        max_bytes: int = 64 * 1024 * 1024,
        backup_count: int = 5,
        fsync_every_n: int = 1,
        exclusive: bool = True,
    ) -> None:
        # NaN/inf slip past a naive `<= 0` check (both comparisons are False)
        # and would disable rotation entirely: `tell() >= NaN` is never True,
        # so an unattended logger fills the disk instead of rotating. Same
        # rejection rule the INA219 threshold validation uses. Bools are ints
        # to Python and would silently mean 1; non-integral floats would make
        # rotation/fsync fire at surprising times — both rejected. Integral
        # floats stay accepted because YAML configs legitimately produce 5e6.
        if isinstance(max_bytes, bool):
            raise ValueError('max_bytes must be a number, not a bool')
        if not math.isfinite(max_bytes) or max_bytes <= 0:
            raise ValueError('max_bytes must be positive and finite')
        if max_bytes != int(max_bytes):
            raise ValueError('max_bytes must be an integral number of bytes')
        if backup_count < 0:
            raise ValueError('backup_count must be >= 0')
        if isinstance(fsync_every_n, bool):
            raise ValueError('fsync_every_n must be a number, not a bool')
        if not math.isfinite(fsync_every_n) or fsync_every_n < 1:
            raise ValueError('fsync_every_n must be >= 1 and finite')
        if fsync_every_n != int(fsync_every_n):
            raise ValueError('fsync_every_n must be an integral count')

        self._path = path
        self._columns = list(columns)
        self._max_bytes = max_bytes
        self._backup_count = backup_count
        self._fsync_every_n = fsync_every_n
        self._exclusive = exclusive
        self._since_sync = 0
        self._handle = None
        self._lock_handle = None
        self._closed = False

        parent = os.path.dirname(os.path.abspath(path))
        if parent:
            os.makedirs(parent, exist_ok=True)
        if exclusive:
            self._acquire_lock()
        try:
            self._open()
        except Exception:
            self._release_lock()
            raise

    def _acquire_lock(self) -> None:
        """Take an exclusive lock on a sidecar file, or refuse to start.

        The lock lives beside the CSV rather than on the CSV's own descriptor
        so that rotation — which closes and reopens the data file — never drops
        it. The lock is advisory and released automatically if the holder dies,
        so a brownout does not leave a stale lock blocking the next boot.
        """
        if fcntl is None:  # pragma: no cover - platform dependent
            return
        lock_path = f'{self._path}.lock'
        handle = open(lock_path, 'a+', encoding='utf-8')
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            handle.close()
            if exc.errno in (errno.EACCES, errno.EAGAIN, errno.EWOULDBLOCK):
                raise LogAlreadyActive(
                    f'another process is already logging to {self._path} '
                    f'(lock: {lock_path}); refusing to interleave a second '
                    'charge integral into one file'
                ) from exc
            # Anything else (ENOLCK, EOPNOTSUPP on a non-flock filesystem,
            # EPERM…) is an operational failure, not contention — misreporting
            # it as "already active" would send the operator hunting for a
            # second process that does not exist.
            raise
        self._lock_handle = handle

    def _release_lock(self) -> None:
        if self._lock_handle is None:
            return
        try:
            if fcntl is not None:  # pragma: no branch
                fcntl.flock(self._lock_handle.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass
        self._lock_handle.close()
        self._lock_handle = None

    @property
    def path(self) -> str:
        return self._path

    def _open(self) -> None:
        needs_header = (
            not os.path.exists(self._path)
            or os.path.getsize(self._path) == 0
        )
        # Repair the tail BEFORE opening the append handle, on one descriptor
        # (scan + ftruncate + fsync): a pathname-based truncate after the
        # append handle opened could hit a different inode if an external
        # process replaced the path mid-open — fd-based repair-then-open
        # closes that race. _check_header still runs on the append handle
        # below, so a truncated header refuses loudly after the repair has
        # already declined to touch it (an unterminated header-only file has
        # no newline to truncate back to).
        repaired_ident = (
            None if needs_header else self._repair_partial_tail()
        )
        self._handle = open(self._path, 'a+', encoding='utf-8', newline='')
        try:
            if not needs_header:
                if not self._repair_matches(repaired_ident):
                    _logger.warning(
                        f'{self._path}: log file was replaced between tail '
                        'repair and open; appending to the file now at this '
                        'path'
                    )
                self._check_header()
        except Exception:
            self._handle.close()
            self._handle = None
            raise
        if needs_header:
            self._handle.write(','.join(self._columns) + '\n')
            self._sync_now()
        else:
            self._handle.seek(0, os.SEEK_END)

    def _check_header(self) -> None:
        """Refuse to append under a truncated or corrupt header.

        A crash mid-header-write leaves a partial first line — including a
        header whose every character persisted but whose trailing newline did
        not, after which an append would merge the first data row into the
        header text. Either way appending would shift every column for every
        downstream parse of the file, so fail loudly at startup rather than
        corrupt the log quietly.
        """
        assert self._handle is not None
        self._handle.seek(0)
        first_line = self._handle.readline()
        self._handle.seek(0, os.SEEK_END)
        expected = ','.join(self._columns)
        # endswith('\n') covers both \n and \r\n; a bare unterminated header
        # must still be rejected.
        if (not first_line.endswith('\n')
                or first_line.rstrip('\r\n') != expected):
            raise ValueError(
                f'{self._path} opens with a truncated or corrupt header '
                f'{first_line.rstrip()!r}, expected {expected!r}; refusing '
                'to append rows under it'
            )

    def _repair_partial_tail(self) -> tuple | None:
        """Truncate an unterminated final line left by an interrupted write.

        A SIGKILL/power-cut landing inside the kernel's write() persists only
        a prefix of the in-flight row (proven by fault injection in the Phase
        3 SIGKILL integration test), so the file ends without a trailing
        newline and an append would merge the first new row into that partial
        line — one corrupt merged record, column shift for every downstream
        parse. Completed rows always end in '\\n' (write_row appends the
        trailing newline with the row), so an unterminated tail can only ever
        be an interrupted row: dropping it back to the last newline loses
        nothing durable.

        The scan and the truncation share ONE descriptor — os.open O_RDWR,
        os.ftruncate, os.fsync, close — and run before the append handle is
        opened, so no pathname-based second resolution can ever truncate a
        different inode than the one the writer appends to. Returns the
        repaired file's (st_dev, st_ino) so _open can verify the append
        handle landed on the same file, or None when nothing was truncated.

        A file with no newline anywhere (e.g. an unterminated header-only
        file) is left untouched: truncating it to zero would silently destroy
        provenance, and _check_header will refuse it loudly right after.
        Runs under the writer lock (_open is called after lock acquisition),
        so no other appender can race the truncate.
        """
        fd = os.open(self._path, os.O_RDWR)
        try:
            size = os.fstat(fd).st_size
            if size == 0:
                return None
            os.lseek(fd, size - 1, os.SEEK_SET)
            if os.read(fd, 1) == b'\n':
                return None  # already ends on a completed line

            # Scan backward for the last newline; the partial tail is at most
            # one row (~200 bytes), so this usually reads a single chunk.
            chunk = 64 * 1024
            pos = size
            keep = None
            while pos > 0:
                start = max(0, pos - chunk)
                os.lseek(fd, start, os.SEEK_SET)
                data = os.read(fd, pos - start)
                idx = data.rfind(b'\n')
                if idx != -1:
                    keep = start + idx + 1
                    break
                pos = start
            if keep is None:
                # No newline anywhere: a truncated header-only file. Leave it
                # for _check_header to refuse loudly — never empty it.
                _logger.warning(
                    f'{self._path}: unterminated tail with no recoverable '
                    'newline; left untouched for the header guard'
                )
                return None
            os.ftruncate(fd, keep)
            os.fsync(fd)
            st = os.fstat(fd)
            identity = (st.st_dev, st.st_ino)
        finally:
            os.close(fd)
        _logger.warning(
            f'{self._path}: dropped {size - keep} byte(s) of an unterminated '
            'trailing row left by an interrupted write; repaired the log tail'
        )
        return identity

    def _repair_matches(self, identity: tuple | None) -> bool:
        """True when the open append handle is the file the repair truncated.

        st_dev/st_ino are stable on POSIX; on Windows st_ino is commonly 0,
        so the check is skipped rather than trusted. A stat failure also
        skips — a warning is preferable to refusing a boot over an
        unverifiable identity.
        """
        if identity is None:
            return True
        try:
            st = os.fstat(self._handle.fileno())
        except OSError:
            return True
        if st.st_ino == 0:
            return True
        return (st.st_dev, st.st_ino) == identity

    def _sync_now(self) -> None:
        if self._handle is None:
            return
        self._handle.flush()
        os.fsync(self._handle.fileno())
        self._since_sync = 0

    def _rotate(self) -> None:
        """Shift ``path`` to ``path.1`` … dropping the oldest backup.

        With ``backup_count == 0`` the file is simply truncated, so an
        unattended logger can never fill the disk.
        """
        if self._handle is not None:
            self._sync_now()
            self._handle.close()
            self._handle = None

        if self._backup_count == 0:
            if os.path.exists(self._path):
                os.remove(self._path)
            self._open()
            return

        oldest = f'{self._path}.{self._backup_count}'
        if os.path.exists(oldest):
            os.remove(oldest)
        for index in range(self._backup_count - 1, 0, -1):
            src = f'{self._path}.{index}'
            if os.path.exists(src):
                os.replace(src, f'{self._path}.{index + 1}')
        if os.path.exists(self._path):
            os.replace(self._path, f'{self._path}.1')
        self._open()

    def write_row(self, cells: Sequence[str]) -> None:
        if self._closed:
            # A closed writer must stay closed. Silently reopening here would
            # resume writing WITHOUT the exclusive lock (close() released it),
            # so a second process could then hold the lock legitimately while
            # this zombie interleaves rows — the exact corruption the lock
            # exists to prevent.
            raise ValueError('write_row on a closed DurableCsvWriter')
        if self._handle is None:
            self._open()
        if self._handle.tell() >= self._max_bytes:
            self._rotate()

        self._handle.write(','.join(cells) + '\n')
        self._since_sync += 1
        if self._since_sync >= self._fsync_every_n:
            self._sync_now()

    def close(self) -> None:
        # finally layers: a failing fsync must not leak the data fd, and
        # neither failure may skip releasing the lock or marking the writer
        # terminal — a leaked lock blocks the next boot's logger.
        try:
            if self._handle is not None:
                try:
                    self._sync_now()
                finally:
                    self._handle.close()
                    self._handle = None
        finally:
            self._release_lock()
            self._closed = True
