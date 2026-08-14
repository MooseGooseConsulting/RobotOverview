"""Tests for beast-prune's orphan detection and its removal gate.

colcon has no prune: `colcon build --packages-select <set>` only ever
touches the packages it is given, so a package deleted, renamed, or parked
with COLCON_IGNORE keeps its build/<name> and install/<name> directories
forever, and install/setup.bash — a --symlink-install tree — keeps sourcing
them. The 2026-08-14 SLAM survey found exactly this live (vizanti, emcl2,
explore_lite, ugv_web_app still in install/), and Codex flagged the same gap
from the delete-a-package direction on PR #224. That review also closed the
"prune it inside beast-pull" suggestion: "doing it with rm -rf from an
unattended agent is a bigger hazard than the stale artefacts." So the two
things these tests guard are:

  * detection stays correct -> an orphan (or a live package) must never be
    misclassified, in either direction: a live package flagged as an orphan
    would get destroyed by --prune, and a real orphan missed would keep
    running exactly the drift this tool exists to catch.
  * the removal gate stays closed -> --prune must never delete without an
    explicit --yes or a real confirmation, and beast-pull must never gain a
    call into this script (that would reintroduce the exact hazard PR #224's
    review declined).

Exercised through the script's `BEAST_PRUNE_COLCON_LIST` test hook (a file
standing in for `colcon list --names-only`) against a synthetic build/install
tree, so no ROS, no colcon, and no robot are involved.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BEAST_PRUNE = REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "bin" / "beast-prune"
BEAST_PULL = REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "bin" / "beast-pull"
BEAST_PULL_SERVICE = (
    REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "systemd" / "beast-pull.service"
)
BEAST_PULL_TIMER = (
    REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "systemd" / "beast-pull.timer"
)

# CI (ci-tools-tests.yml) runs on ubuntu, where this is always present. Locally
# on Windows it resolves to Git Bash; skip rather than fail if neither exists.
BASH = shutil.which("bash")

pytestmark = pytest.mark.skipif(BASH is None, reason="bash is required to run beast-prune")


def _make_pkg_dir(root: Path, tree: str, name: str) -> None:
    d = root / tree / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "marker").write_text("payload\n")


@pytest.fixture
def ws(tmp_path: Path) -> Path:
    """A throwaway workspace shaped like robot/beast/ros2_ws, with a repo
    root one level up (matching BEAST_REPO_DIR -> .../robot/beast/ros2_ws)."""
    repo = tmp_path / "RobotOverview"
    workspace = repo / "robot" / "beast" / "ros2_ws"
    workspace.mkdir(parents=True)
    return workspace


def _write_available(tmp_path: Path, *names: str) -> Path:
    p = tmp_path / "available.txt"
    p.write_text("\n".join(names) + "\n" if names else "\n")
    return p


def run_prune(ws: Path, available: Path, *args: str, stdin_devnull: bool = True):
    env = {
        **os.environ,
        "BEAST_REPO_DIR": str(ws.parent.parent.parent),
        "BEAST_PRUNE_COLCON_LIST": str(available),
        # Point the deploy-in-progress check at a directory that never
        # exists so tests don't depend on /data/beast on the CI runner.
        "BEAST_STATE_DIR": str(ws.parent / "state-does-not-exist"),
    }
    kwargs = dict(capture_output=True, text=True, env=env)
    if stdin_devnull:
        kwargs["stdin"] = subprocess.DEVNULL
    # start_new_session detaches from any controlling terminal the test
    # runner happens to have, so the --prune tty gate behaves the same
    # (refuses) regardless of how pytest itself was invoked.
    return subprocess.run([BASH, str(BEAST_PRUNE), *args], start_new_session=True, **kwargs)


def test_no_orphans_when_everything_is_known(ws: Path) -> None:
    _make_pkg_dir(ws, "build", "beast_base")
    _make_pkg_dir(ws, "install", "beast_base")
    available = _write_available(ws.parent, "beast_base", "ugv_bringup")
    result = run_prune(ws, available)
    assert result.returncode == 0
    assert "no orphaned package trees found" in result.stdout


def test_orphan_in_both_trees_is_reported(ws: Path) -> None:
    _make_pkg_dir(ws, "build", "vizanti")
    _make_pkg_dir(ws, "install", "vizanti")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available)
    assert result.returncode == 0
    assert "vizanti" in result.stdout
    assert "1 orphaned package tree(s) found" in result.stdout


def test_orphan_present_in_only_install_is_still_detected(ws: Path) -> None:
    """Ament-python style packages can leave a directory in only one tree —
    detection must not require BOTH build/ and install/ to hold it."""
    _make_pkg_dir(ws, "install", "vizanti_cpp")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available)
    assert result.returncode == 0
    assert "vizanti_cpp" in result.stdout


def test_known_package_is_never_flagged_even_if_only_in_one_tree(ws: Path) -> None:
    _make_pkg_dir(ws, "install", "beast_base")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available)
    assert result.returncode == 0
    assert "no orphaned package trees found" in result.stdout


def test_top_level_files_are_never_flagged(ws: Path) -> None:
    """setup.bash, local_setup.bash, COLCON_IGNORE etc. are files, not
    package directories, and must never appear as orphans."""
    install = ws / "install"
    install.mkdir(parents=True)
    (install / "setup.bash").write_text("# ros\n")
    (install / "local_setup.bash").write_text("# ros\n")
    (install / "COLCON_IGNORE").write_text("")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available)
    assert result.returncode == 0
    assert "no orphaned package trees found" in result.stdout


def test_hidden_directories_are_never_flagged(ws: Path) -> None:
    (ws / "install" / ".cache").mkdir(parents=True)
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available)
    assert result.returncode == 0
    assert "no orphaned package trees found" in result.stdout


def test_missing_build_and_install_dirs_is_a_clean_noop(ws: Path) -> None:
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available)
    assert result.returncode == 0
    assert "nothing to prune" in result.stdout


def test_check_flag_exits_nonzero_when_orphans_found(ws: Path) -> None:
    _make_pkg_dir(ws, "install", "emcl2")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available, "--check")
    assert result.returncode == 1
    assert "emcl2" in result.stdout


def test_check_flag_exits_zero_when_clean(ws: Path) -> None:
    _make_pkg_dir(ws, "install", "beast_base")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available, "--check")
    assert result.returncode == 0


def test_report_mode_never_deletes_anything(ws: Path) -> None:
    target = ws / "install" / "vizanti"
    _make_pkg_dir(ws, "install", "vizanti")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available)
    assert result.returncode == 0
    assert target.is_dir()


def test_prune_without_yes_and_without_a_tty_refuses_and_deletes_nothing(ws: Path) -> None:
    """The core safety gate: no confirmation channel available and no --yes
    means beast-prune must refuse outright, not fall back to deleting."""
    target = ws / "install" / "vizanti"
    _make_pkg_dir(ws, "install", "vizanti")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available, "--prune")
    assert result.returncode != 0
    assert "refusing to prune without --yes" in (result.stdout + result.stderr)
    assert target.is_dir()


def test_prune_with_yes_removes_only_orphaned_trees(ws: Path) -> None:
    _make_pkg_dir(ws, "build", "beast_base")
    _make_pkg_dir(ws, "install", "beast_base")
    _make_pkg_dir(ws, "build", "vizanti")
    _make_pkg_dir(ws, "install", "vizanti")
    _make_pkg_dir(ws, "install", "vizanti_cpp")
    available = _write_available(ws.parent, "beast_base", "ugv_bringup")

    result = run_prune(ws, available, "--prune", "--yes")

    assert result.returncode == 0, result.stdout + result.stderr
    # Orphans gone...
    assert not (ws / "build" / "vizanti").exists()
    assert not (ws / "install" / "vizanti").exists()
    assert not (ws / "install" / "vizanti_cpp").exists()
    # ...known package left untouched.
    assert (ws / "build" / "beast_base").is_dir()
    assert (ws / "install" / "beast_base").is_dir()


def test_prune_with_yes_and_nothing_orphaned_is_a_noop(ws: Path) -> None:
    _make_pkg_dir(ws, "install", "beast_base")
    available = _write_available(ws.parent, "beast_base")
    result = run_prune(ws, available, "--prune", "--yes")
    assert result.returncode == 0
    assert "nothing to prune" in result.stdout
    assert (ws / "install" / "beast_base").is_dir()


def test_prune_refuses_while_a_deploy_is_in_progress(ws: Path) -> None:
    _make_pkg_dir(ws, "install", "vizanti")
    available = _write_available(ws.parent, "beast_base")
    state_dir = ws.parent / "state"
    state_dir.mkdir()
    (state_dir / "in-progress").write_text("deadbeef beast_base\n")

    env = {
        **os.environ,
        "BEAST_REPO_DIR": str(ws.parent.parent.parent),
        "BEAST_PRUNE_COLCON_LIST": str(available),
        "BEAST_STATE_DIR": str(state_dir),
    }
    result = subprocess.run(
        [BASH, str(BEAST_PRUNE), "--prune", "--yes"],
        capture_output=True,
        text=True,
        env=env,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    assert result.returncode != 0
    assert "deploy in progress" in (result.stdout + result.stderr)
    assert (ws / "install" / "vizanti").is_dir()


def test_broken_colcon_list_is_a_hard_error_not_an_empty_report(ws: Path) -> None:
    """An empty available-package list means colcon itself is broken (or the
    test hook is misconfigured) — not "every package is orphaned". Treating
    it as the latter would --prune the entire workspace on a colcon fault."""
    _make_pkg_dir(ws, "install", "beast_base")
    available = _write_available(ws.parent)  # empty
    result = run_prune(ws, available)
    assert result.returncode == 1
    assert (ws / "install" / "beast_base").is_dir()


def test_beast_prune_is_not_wired_into_beast_pull() -> None:
    """PR #224's review declined to prune from beast-pull: 'doing it with
    rm -rf from an unattended agent is a bigger hazard than the stale
    artefacts.' beast-prune must stay reachable only by hand."""
    assert "beast-prune" not in BEAST_PULL.read_text()
    assert "beast-prune" not in BEAST_PULL_SERVICE.read_text()
    assert "beast-prune" not in BEAST_PULL_TIMER.read_text()
