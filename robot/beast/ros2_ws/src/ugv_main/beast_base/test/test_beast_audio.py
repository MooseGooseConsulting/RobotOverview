# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Behavioral tests for the beast_base low-battery voice warning.

``spd-say`` and the 5 s double-fire guard are the whole point: the ESP32
streams the same low voltage at 20 Hz, so without the guard every frame would
spawn a subprocess.  The OLED T:3 "V:" line is written FIRST, unconditionally —
it is the reliable channel on a headless robot; voice is best-effort and
latches off after the first ``spd-say`` failure.  The fire threshold is
0.1 < V < 9 (a real low-cell read); a full pack or a dead-rail glitch must
never fire.
"""

import pytest

from beast_base.beast_audio import LowBatteryVoice


class RecordingCommands:
    def __init__(self):
        self.commands = []

    def __call__(self, data):
        self.commands.append(data)


class RecordingLogger:
    def __init__(self):
        self.errors = []

    def error(self, message, **kwargs):
        self.errors.append(message)


class DummyThread:
    """Records the constructor args but never runs the worker."""

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def start(self):
        pass


def make_voice(commands=None, logger=None):
    """get_logger is CALLABLE (base_node passes the bound node method)."""
    if logger is None:
        logger = RecordingLogger()
    return LowBatteryVoice(commands or RecordingCommands(), lambda: logger)


def frame(volts_cv):
    return {"T": 1001, "v": volts_cv}


def test_low_voltage_fires_the_warning():
    commands = RecordingCommands()
    voice = LowBatteryVoice(commands, lambda: RecordingLogger())
    voice._warn_interval = 0.0  # never block on the double-fire guard

    voice.check(frame(720))  # 7.2 V — low cell

    assert voice._last_warn > 0.0
    # No assertion on commands here: the worker thread writes the OLED line
    # FIRST now (not after spd-say), so whether it has landed yet is a race
    # this test must not depend on.


def test_full_voltage_does_not_fire():
    voice = make_voice()
    voice._warn_interval = 0.0

    voice.check(frame(1240))  # 12.4 V — fine

    assert voice._last_warn == 0.0


def test_glitch_voltage_does_not_fire():
    voice = make_voice()
    voice._warn_interval = 0.0

    voice.check(frame(0))     # dead rail / probe glitch
    voice.check(frame(1200))  # > 9 V

    assert voice._last_warn == 0.0


def test_double_fire_guard_suppresses_repeats_within_interval(monkeypatch):
    fired = {'count': 0}

    class CountingThread(DummyThread):
        def start(self):
            fired['count'] += 1

    monkeypatch.setattr('beast_base.beast_audio.threading.Thread', CountingThread)
    # Constant monotonic: the first check fires (10 - 0 >= 5 s), every later
    # check is within the 5 s interval and must be suppressed.
    monkeypatch.setattr('beast_base.beast_audio.time.monotonic', lambda: 10.0)
    voice = make_voice()

    for _ in range(10):  # ESP32 streams the same low voltage at 20 Hz
        voice.check(frame(720))

    assert fired['count'] == 1


def test_warning_fires_again_after_the_interval(monkeypatch):
    fired = {'count': 0}

    class CountingThread(DummyThread):
        def start(self):
            fired['count'] += 1

    monkeypatch.setattr('beast_base.beast_audio.threading.Thread', CountingThread)
    voice = make_voice()

    monkeypatch.setattr(
        'beast_base.beast_audio.time.monotonic',
        lambda: voice._last_warn + 6.0,  # each check is 6 s after the last fire
    )
    for _ in range(3):
        voice.check(frame(720))

    assert fired['count'] == 3


def test_worker_writes_the_oled_line_when_speech_succeeds(monkeypatch):
    monkeypatch.setattr(
        'beast_base.beast_audio.subprocess.run',
        lambda *args, **kwargs: None,
    )
    commands = RecordingCommands()
    logger = RecordingLogger()
    voice = LowBatteryVoice(commands, lambda: logger)

    voice._low_battery_warn_worker(7.20)

    assert b'{"T": "3", "lineNum": 2, "Text": "V:7.2"}\n' in commands.commands
    assert logger.errors == []
    assert voice._voice_broken is False


def test_worker_still_writes_oled_and_latches_voice_when_speech_fails(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError('spd-say missing')

    monkeypatch.setattr('beast_base.beast_audio.subprocess.run', boom)
    commands = RecordingCommands()
    logger = RecordingLogger()
    voice = LowBatteryVoice(commands, lambda: logger)

    voice._low_battery_warn_worker(7.20)

    # The OLED line is the reliable channel: written even when voice fails.
    assert b'{"T": "3", "lineNum": 2, "Text": "V:7.2"}\n' in commands.commands
    assert voice._voice_broken is True
    assert any('spd-say failure' in e for e in logger.errors)


def test_voice_stays_off_after_first_failure_but_oled_keeps_firing(monkeypatch):
    calls = {'n': 0}

    def boom(*args, **kwargs):
        calls['n'] += 1
        raise RuntimeError('spd-say missing')

    monkeypatch.setattr('beast_base.beast_audio.subprocess.run', boom)
    commands = RecordingCommands()
    voice = LowBatteryVoice(commands, lambda: RecordingLogger())

    voice._low_battery_warn_worker(7.20)
    voice._low_battery_warn_worker(7.20)
    voice._low_battery_warn_worker(7.20)

    assert calls['n'] == 1  # spd-say attempted exactly once
    assert len(commands.commands) == 3  # OLED line every time
    assert voice._voice_broken is True
