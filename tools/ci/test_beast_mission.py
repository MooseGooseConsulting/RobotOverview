"""beast-mission is the only sanctioned way to command BEAST-01 motion.

It exists because nothing in this stack stops the robot when a command source
goes quiet. ugv_cockpit/config/twist_mux.yaml states it directly: twist_mux
only arbitrates WHOSE command gets through, the cmd_vel silence watchdog was
removed by owner decision D8 on 2026-08-07, and the ESP32 latches the last
velocity indefinitely. "The publisher stopped" is not a stop.

So the stop is not a nicety of this script — it IS the script. These tests
guard the properties that make it safe, because every one of them is a thing a
well-meaning edit could quietly remove while leaving something that still
appears to work in the common case.

Argument validation runs before the ROS setup files are sourced, so those paths
are exercised for real here. The motion paths cannot run without a robot; they
are asserted structurally.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "robot/beast/ros2_ws/deploy/bin/beast-mission"

BASH = shutil.which("bash")
needs_bash = pytest.mark.skipif(BASH is None, reason="bash not available")


@pytest.fixture(scope="module")
def source() -> str:
    return SCRIPT.read_text(encoding="utf-8")


def run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [BASH, str(SCRIPT), *args], capture_output=True, text=True, timeout=30
    )


# --------------------------------------------------------------------------
# Argument validation — really executed
# --------------------------------------------------------------------------


@needs_bash
@pytest.mark.parametrize("args", [(), ("only-name",), ("name", "10")])
def test_too_few_arguments_refuse(args: tuple[str, ...]) -> None:
    """A mission with no body must not arm the robot and then sit there."""
    result = run(*args)
    assert result.returncode == 2
    assert "usage" in (result.stdout + result.stderr).lower()


@needs_bash
@pytest.mark.parametrize(
    "name",
    [
        "spin; rm -rf /",
        "$(id)",
        "`id`",
        "../../etc/shadow",
        "spin&touch /tmp/pwned",
        "spin|tee",
    ],
)
def test_mission_name_rejects_injection(name: str) -> None:
    """The name becomes a log path; it must never become shell."""
    result = run(name, "5", "true")
    assert result.returncode == 2, f"{name!r} was not refused"
    assert "illegal characters" in (result.stdout + result.stderr)


@needs_bash
@pytest.mark.parametrize("bound", ["-5", "abc", "1.5", "", "10s", "0x10"])
def test_max_seconds_must_be_a_positive_integer(bound: str) -> None:
    """`timeout` is the only thing bounding a moving robot. Garbage in it is
    not a cosmetic bug — a bound that fails to parse is a bound that does not
    apply."""
    result = run("probe", bound, "true")
    assert result.returncode == 2
    assert "max_seconds" in (result.stdout + result.stderr)


@needs_bash
def test_validation_happens_before_ros_is_sourced(source: str) -> None:
    """Order matters: refusing bad input must not depend on a ROS install."""
    validation = source.index("max_seconds must be")
    sourcing = source.index("source /opt/ros/humble/setup.bash")
    assert validation < sourcing, (
        "argument validation moved below the ROS sourcing; bad arguments would "
        "then fail on a missing setup.bash instead of being refused cleanly"
    )


# --------------------------------------------------------------------------
# The stop contract — structural
# --------------------------------------------------------------------------


def test_trap_covers_every_exit_path(source: str) -> None:
    """EXIT alone is not enough to reason about; INT and TERM are how a human
    or systemd ends a run, and both must still stop the robot."""
    assert re.search(r"^trap stop_everything EXIT INT TERM$", source, re.M), (
        "the stop must be trapped on EXIT, INT and TERM"
    )


def test_all_three_stop_layers_are_present(source: str) -> None:
    """Each layer covers a failure the others do not: the mux lock masks the
    source, the zero tail overwrites the latched value, and allow_motion makes
    beast_base emit its own T:13 0,0 independent of the mux entirely."""
    stop = source[source.index("stop_everything()") :]
    assert "/cmd_vel_estop_lock" in stop, "layer 1 (mux estop lock) missing"
    assert "/cmd_vel_ui" in stop, "layer 2 (zero tail) missing"
    assert "/ugv/set_allow_motion" in stop, "layer 3 (allow_motion false) missing"
    assert "{data: false}" in stop


def test_zero_tail_outranks_nav_on_the_mux(source: str) -> None:
    """twist_mux.yaml: cmd_vel_ui is priority 50, cmd_vel_nav is 10. Sending
    the zero on a rung at or below nav's would let Nav2 keep winning while the
    stop believed it had succeeded."""
    stop = source[source.index("stop_everything()") :]
    assert "/cmd_vel_ui" in stop
    assert "/cmd_vel_nav" not in stop, (
        "the zero tail must not be published on the nav rung — it would lose "
        "arbitration to Nav2 itself"
    )


def test_stop_sequence_is_not_short_circuited(source: str) -> None:
    """A failure inside the stop must not skip the rest of the stop."""
    stop = source[source.index("stop_everything()") :]
    assert "set +e" in stop, (
        "the stop handler must disable errexit; otherwise the first failing "
        "layer aborts the handler and the robot keeps driving"
    )


def test_estop_lock_is_republished_not_published_once(source: str) -> None:
    """twist_mux subscribes to lock topics VOLATILE, so a single --once publish
    can lose the discovery race, and the lock does not survive a mux restart.
    twist_mux.yaml makes periodic republish a contract on the client."""
    stop = source[source.index("stop_everything()") :]
    engage = stop[: stop.index("zero tail")]
    assert "-r 2" in engage or re.search(r"-r \d", engage), (
        "the estop lock must be held at a repeating rate while engaged"
    )


def test_lock_is_released_so_it_cannot_wedge_the_next_session(source: str) -> None:
    """A lock left engaged silently blocks the NEXT mission, and an operator
    debugging that has no way to see why."""
    stop = source[source.index("stop_everything()") :]
    assert "{data: false}" in stop
    release = stop.rindex("cmd_vel_estop_lock")
    disarm = stop.index("set_allow_motion")
    assert release > disarm, (
        "the lock must only be released after allow_motion is false, or "
        "something could race in behind the release while still armed"
    )


def test_body_is_bounded_by_timeout(source: str) -> None:
    """An unbounded mission body is an unbounded moving robot."""
    assert re.search(r'timeout .*"\$MAXSEC" "\$@"', source), (
        "the mission body must run under `timeout $MAXSEC`"
    )
    assert "--kill-after" in source, (
        "a body that ignores SIGTERM must still be killed, or the bound is "
        "advisory rather than enforced"
    )


def test_no_eval_or_string_shelling(source: str) -> None:
    """The body is passed as an argv array and must stay one."""
    assert not re.search(r"\beval\b", source)
    assert '"$@"' in source


def test_arm_failure_does_not_run_the_body(source: str) -> None:
    """If arming failed, driving commands would be sent to a robot in an
    unknown gate state."""
    assert re.search(r"ARM FAILED.*\n.*exit 1|\|\| \{ say \"ARM FAILED\"; exit 1; \}", source), (
        "a failed arm must exit before the mission body runs"
    )


def test_stale_lock_is_cleared_before_arming(source: str) -> None:
    """Otherwise a mission drives into a mux that is masking it and looks
    mysteriously dead — the same symptom as a hardware fault, which is the
    worst kind of ambiguity to introduce on a robot."""
    # Anchor on the emitted line, not the bare word: "ARMED" also appears in
    # the header prose, which would silently widen this slice to the whole file.
    pre = source[: source.index('say "ARMED"')]
    assert "cmd_vel_estop_lock" in pre
    assert "{data: false}" in pre
