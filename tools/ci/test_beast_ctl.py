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


def test_policy_dump_lists_every_managed_unit():
    r = run("policy")
    assert r.returncode == 0
    units = {line.split("|")[0] for line in r.stdout.strip().splitlines()}
    # If a unit file exists in deploy/systemd but is absent here, an operator
    # will hit a password prompt the first time they touch it.
    systemd_dir = REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "systemd"
    for path in systemd_dir.glob("beast-*.service"):
        stem = path.stem.replace("@", "") + ("@" if "@" in path.stem else "")
        assert stem in units, f"{path.name} has no beast-ctl policy entry"


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
