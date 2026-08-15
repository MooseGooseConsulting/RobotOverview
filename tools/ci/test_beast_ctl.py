"""Tests for beast-ctl's privilege policy table.

beast-ctl is the ONLY command in /etc/sudoers.d/beast-ops that takes arguments,
so it is the whole attack surface of passwordless root on BEAST-01. sudoers can
no longer refuse a bad unit or verb on our behalf — this table does, and these
tests are what keep it honest.

Two failure modes, both bad and neither loud:

  * too permissive -> the beast user reaches a unit or verb nobody reviewed.
    The injection and unmanaged-unit cases below are the guards.
  * too restrictive -> an unattended deploy dies on `sudo: a password is
    required` at 2 a.m. That is precisely what the 193-line systemctl
    allowlist this replaced did to `is-enabled beast-wifi-telemetry.timer`.

Exercised through BEAST_CTL_DRYRUN, so no systemd, no root, and no robot.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BEAST_CTL = REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "bin" / "beast-ctl"
SUDOERS = REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "sudoers" / "beast-ops"

BASH = shutil.which("bash") or r"C:\Program Files\Git\bin\bash.exe"
pytestmark = pytest.mark.skipif(
    not Path(BASH).exists(), reason="bash unavailable (Windows without Git Bash)"
)


def run(*args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ, BEAST_CTL_DRYRUN="1")
    return subprocess.run(
        [BASH, str(BEAST_CTL), *args],
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )


# --- things that MUST work; each one is a real caller ------------------------
@pytest.mark.parametrize(
    "args,expect",
    [
        # beast-pull's restart path
        (["restart", "beast-ros-base"], "systemctl restart beast-ros-base"),
        (["try-restart", "beast-cockpit"], "systemctl try-restart beast-cockpit"),
        # the .service suffix must be accepted — systemctl accepts either, and
        # callers are inconsistent about it
        (["restart", "beast-ros-base.service"], "systemctl restart beast-ros-base.service"),
        # the exact call the old allowlist refused, which is why this exists
        (["is-enabled", "beast-wifi-telemetry.timer"], "systemctl is-enabled beast-wifi-telemetry.timer"),
        # R5 arming
        (["enable", "--now", "beast-pull.timer"], "systemctl enable beast-pull.timer --now"),
        (["enable", "beast-pull.timer", "--now"], "systemctl enable beast-pull.timer --now"),
        # templated mission recorders
        (["start", "beast-mission-record@undercroft"], "systemctl start beast-mission-record@undercroft"),
        # beast-nav may be hand-started and stopped, and beast-pull stops it
        (["start", "beast-nav"], "systemctl start beast-nav"),
        (["stop", "beast-nav"], "systemctl stop beast-nav"),
    ],
)
def test_permitted(args, expect):
    r = run(*args)
    assert r.returncode == 0, r.stderr
    assert r.stdout.strip() == expect


# --- the never-enable contract ----------------------------------------------
# beast-nav ships without an [Install] section; nav sessions are supervised and
# must never come up on their own. Enforced here as well as in the unit file,
# because a policy stated in only one place is a policy that drifts.
@pytest.mark.parametrize("verb", ["enable", "disable", "restart", "try-restart", "mask"])
def test_beast_nav_is_start_stop_only(verb):
    r = run(verb, "beast-nav")
    assert r.returncode == 2
    assert "not permitted" in r.stderr


# --- mask is not offered, because it cannot work ------------------------------
# systemd masks a unit by symlinking its name to /dev/null in
# /etc/systemd/system, and beast-install-systemd-units installs every beast unit
# as a real file in exactly that directory — so mask fails with "File
# /etc/systemd/system/<unit> already exists" for all of them. The policy table
# granted `mask` on all four timers until 2026-08-15 and never could have
# honoured it. A capability that reads as available and fails at the moment
# someone needs it is worse than no entry at all; `stop` and `disable` are the
# real controls. See the header comment before adding it back.
@pytest.mark.parametrize(
    "unit",
    [
        "beast-pull.timer",
        "beast-wifi-telemetry.timer",
        "beast-link-watch.timer",
        "beast-storage-maintenance.timer",
        "beast-ros-base",
        "beast-slam",
    ],
)
@pytest.mark.parametrize("verb", ["mask", "unmask"])
def test_mask_is_refused_everywhere(unit, verb):
    r = run(verb, unit)
    assert r.returncode == 2, f"{verb} {unit} was permitted"
    assert "not permitted" in r.stderr


def test_policy_table_advertises_no_mask_class():
    """`beast-ctl policy` is the operator-facing inventory; it must not list a
    class the script cannot perform."""
    r = run("policy")
    assert r.returncode == 0
    assert "mask" not in r.stdout, "the policy dump still advertises a mask class"


# --- default deny ------------------------------------------------------------
@pytest.mark.parametrize(
    "args,needle",
    [
        # a unit nobody reviewed
        (["restart", "sshd"], "not managed"),
        (["stop", "tailscaled"], "not managed"),
        # command injection through the unit slot
        (["start", "beast-nav; rm -rf /"], "illegal characters"),
        (["start", "beast-nav$(id)"], "illegal characters"),
        # path traversal is caught by the character class, before the table
        (["start", "../../etc/shadow"], "illegal characters"),
        # verbs outside the table, including the dangerous ones
        (["poweroff", "beast-ros-base"], "not permitted"),
        (["kill", "beast-ros-base"], "not permitted"),
        (["link", "beast-ros-base"], "not permitted"),
        # flags outside the table
        (["restart", "beast-ros-base", "--force"], "not permitted"),
        (["restart", "beast-ros-base", "--signal=SIGKILL"], "not permitted"),
        # --now changes what enable/disable mean; it must not ride along on
        # a verb where it would silently do something else
        (["start", "--now", "beast-pull.timer"], "only valid with enable/disable"),
        # argument-count confusion
        (["restart", "beast-slam", "beast-cockpit"], "more than one unit"),
        (["restart"], "usage"),
        (["restart", "--now"], "no unit"),
    ],
)
def test_refused(args, needle):
    r = run(*args)
    assert r.returncode == 2, f"expected refusal, got rc={r.returncode}: {r.stdout}"
    assert needle in r.stderr


def policy_key(filename: str) -> str:
    """Map a deploy/systemd filename to the key beast-ctl looks up.

    Mirrors the script: strip a trailing `.service` (but NOT `.timer` — a timer
    is a distinct unit with its own policy row), and collapse a template to its
    `name@` form.
    """
    key = filename[: -len(".service")] if filename.endswith(".service") else filename
    if "@" in key:
        key = key.split("@", 1)[0] + "@"
    return key


def test_policy_dump_lists_every_managed_unit():
    r = run("policy")
    assert r.returncode == 0
    units = {line.split("|")[0] for line in r.stdout.strip().splitlines()}
    # If a unit file exists in deploy/systemd but is absent here, an operator
    # will hit a password prompt the first time they touch it. Timers count:
    # they are the units the old allowlist actually got wrong (`is-enabled
    # beast-wifi-telemetry.timer` was refused), so a test that scanned only
    # *.service would leave the exact class of drift this PR exists to kill.
    systemd_dir = REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "systemd"
    found = sorted(
        p.name for p in systemd_dir.iterdir() if p.name.startswith("beast-") and p.is_file()
    )
    assert found, "no beast-* unit files found; the glob or the layout moved"
    for name in found:
        assert name.endswith((".service", ".timer")), f"unexpected unit kind: {name}"
        assert policy_key(name) in units, f"{name} has no beast-ctl policy entry"


def test_every_timer_unit_is_in_the_policy():
    """Explicit timer guard — the old allowlist's holes were all timers."""
    systemd_dir = REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "systemd"
    timers = sorted(p.name for p in systemd_dir.glob("beast-*.timer"))
    assert timers, "expected at least one beast-* timer unit"
    dumped = {line.split("|")[0] for line in run("policy").stdout.strip().splitlines()}
    for name in timers:
        assert name in dumped, f"{name} missing from the policy table"
        # and the read verb the old sudoers refused must actually work
        r = run("is-enabled", name)
        assert r.returncode == 0, r.stderr
        assert r.stdout.strip() == f"systemctl is-enabled {name}"


# --- callers must have migrated too -----------------------------------------
# Tightening sudoers only helps if nothing still calls the old way. A leftover
# `sudo -n systemctl restart beast-cockpit` does not fail at review time — it
# fails on the robot, at 2 a.m., as a password prompt on a headless machine.
#
# Scope is deliberately `sudo -n` only. That is the automated, must-be-
# allowlisted path, and it is exactly what the sudoers rewrite can break.
# Interactive `sudo systemctl …` is the break-glass fallback: it authenticates
# with BEAST_JETSON_ADMIN_PASSWORD and does not consult the beast-ops
# allowlist at all, so it stays valid and must not be flagged here.
# daemon-reload and reboot take no unit and stay legitimately direct.
DIRECT_OK = ("daemon-reload", "reboot")
SCAN_DIRS = ("robot/beast/ros2_ws/deploy", "tools/beast", "tools/ci")
SCAN_SUFFIXES = (".sh", ".ps1", ".py", "")


def iter_scanned_files():
    for rel in SCAN_DIRS:
        base = REPO_ROOT / rel
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if path.is_file() and path.suffix in SCAN_SUFFIXES:
                yield path


def test_no_caller_still_sudoes_systemctl_with_a_unit():
    offenders = []
    for path in iter_scanned_files():
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for n, line in enumerate(text.splitlines(), 1):
            # Comment lines are prose, not call sites — including the comment
            # above, which quotes the very pattern this test hunts for.
            if line.lstrip().startswith("#"):
                continue
            for match in re.finditer(
                r"sudo\s+-n\s+(?:-\w+\s+)*(?:/usr/bin/)?systemctl\s+(\S+)", line
            ):
                verb = match.group(1)
                if verb.startswith("-") or any(ok in line for ok in DIRECT_OK):
                    continue
                offenders.append(f"{path.relative_to(REPO_ROOT).as_posix()}:{n}: {line.strip()}")
    assert not offenders, "sudo systemctl with a unit must go through beast-ctl:\n" + "\n".join(
        offenders
    )


def test_sudoers_grants_only_beast_ctl_for_unit_ops():
    """The whole point: no bare systemctl-with-a-unit may remain allowlisted."""
    text = SUDOERS.read_text()
    assert "/usr/local/sbin/beast-ctl *" in text
    # daemon-reload and reboot take no unit and stay direct; anything else
    # would be a hole straight past beast-ctl's table.
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if "/usr/bin/systemctl" not in line:
            continue
        assert any(
            allowed in line for allowed in ("daemon-reload", "reboot")
        ), f"sudoers still allowlists a unit operation directly: {line}"
