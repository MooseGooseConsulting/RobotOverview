"""Tests for beast-pull's changed-path -> colcon package mapping.

The mapping decides what an UNATTENDED deploy rebuilds on a robot that moves,
so its two failure modes both matter and neither is loud:

  * rebuild too little -> a stale compiled artefact sits beside a freshly
    symlinked source file and the robot looks deployed while running old code.
    This is exactly the drift recorded in docs/beast-ops.md on 2026-08-14.
  * select a parked package -> colcon errors on a package it cannot discover,
    which fails the whole deploy for a package we deliberately do not build.

Exercised through the script's `--print-build-set` dry run against a synthetic
git repo, so no ROS, no robot, and no network are involved.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BEAST_PULL = REPO_ROOT / "robot" / "beast" / "ros2_ws" / "deploy" / "bin" / "beast-pull"
WS_REL = "robot/beast/ros2_ws"

# CI (ci-tools-tests.yml) runs on ubuntu, where this is always present. Locally
# on Windows it resolves to Git Bash; skip rather than fail if neither exists.
BASH = shutil.which("bash")

pytestmark = pytest.mark.skipif(BASH is None, reason="bash is required to run beast-pull")

# Rebuilt on every deploy regardless of the diff (beast-pull's ALWAYS_PACKAGES).
ALWAYS = {"beast_power", "beast_base", "ugv_bringup", "ugv_cockpit"}


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def _add_package(repo: Path, group: str, name: str, parked: bool = False) -> Path:
    pkg = repo / WS_REL / "src" / group / name
    pkg.mkdir(parents=True, exist_ok=True)
    (pkg / "package.xml").write_text(f"<package><name>{name}</name></package>\n")
    (pkg / f"{name}.py").write_text("# source\n")
    if parked:
        (pkg / "COLCON_IGNORE").write_text("")
    return pkg


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A throwaway workspace shaped like robot/beast/ros2_ws/src."""
    repo = tmp_path / "RobotOverview"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "test@example.invalid")
    _git(repo, "config", "user.name", "test")

    for name in ("beast_base", "beast_power", "ugv_bringup", "ugv_cockpit", "ugv_nav", "ugv_vision"):
        _add_package(repo, "ugv_main", name)
    # Parked EXACTLY as the robot parks vizanti: ONE marker at the group
    # directory, and the nested packages carry no marker of their own. The walk
    # must honor the ancestor marker or colcon gets handed a package it cannot
    # discover.
    _add_package(repo, "ugv_else", "vizanti", parked=True)
    _add_package(repo, "ugv_else/vizanti", "vizanti_cpp", parked=False)
    (repo / "docs").mkdir()
    (repo / "docs" / "notes.md").write_text("# docs\n")

    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "base")
    return repo


def build_set(repo: Path, from_ref: str, to_ref: str) -> set[str]:
    # POSIX paths on both sides: the script is bash, and on Windows a native
    # Python passing `C:\...` would hand backslash escapes to the shell.
    result = subprocess.run(
        [BASH, BEAST_PULL.as_posix(), "--print-build-set", from_ref, to_ref],
        capture_output=True,
        text=True,
        env={**os.environ, "BEAST_REPO_DIR": repo.as_posix()},
    )
    assert result.returncode == 0, (
        f"beast-pull --print-build-set failed ({result.returncode})\n"
        f"stdout: {result.stdout}\nstderr: {result.stderr}"
    )
    return set(result.stdout.split())


def commit_touching(repo: Path, *rel_paths: str) -> str:
    for rel in rel_paths:
        target = repo / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("a") as fh:
            fh.write("# touched\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "change")
    return _git(repo, "rev-parse", "HEAD").strip()


def test_always_packages_are_built_even_for_an_unrelated_change(repo: Path) -> None:
    base = _git(repo, "rev-parse", "HEAD").strip()
    head = commit_touching(repo, "docs/notes.md")
    assert build_set(repo, base, head) == ALWAYS


def test_changed_package_is_added_to_the_build_set(repo: Path) -> None:
    base = _git(repo, "rev-parse", "HEAD").strip()
    head = commit_touching(repo, f"{WS_REL}/src/ugv_main/ugv_nav/ugv_nav.py")
    assert build_set(repo, base, head) == ALWAYS | {"ugv_nav"}


def test_multiple_changed_packages_are_all_added(repo: Path) -> None:
    base = _git(repo, "rev-parse", "HEAD").strip()
    head = commit_touching(
        repo,
        f"{WS_REL}/src/ugv_main/ugv_nav/ugv_nav.py",
        f"{WS_REL}/src/ugv_main/ugv_vision/ugv_vision.py",
    )
    assert build_set(repo, base, head) == ALWAYS | {"ugv_nav", "ugv_vision"}


def test_parked_packages_are_never_selected(repo: Path) -> None:
    """colcon errors on a selected package carrying COLCON_IGNORE."""
    base = _git(repo, "rev-parse", "HEAD").strip()
    head = commit_touching(repo, f"{WS_REL}/src/ugv_else/vizanti/vizanti.py")
    got = build_set(repo, base, head)
    assert "vizanti" not in got
    assert got == ALWAYS


def test_ancestor_colcon_ignore_parks_nested_packages(repo: Path) -> None:
    """vizanti_cpp has no marker of its own — only the group dir is marked.

    colcon ignores the whole subtree below a COLCON_IGNORE, so selecting the
    nested package would fail the entire deploy. This is the robot's actual
    layout: one marker at src/ugv_else/vizanti/ parks five nested packages.
    """
    base = _git(repo, "rev-parse", "HEAD").strip()
    head = commit_touching(repo, f"{WS_REL}/src/ugv_else/vizanti/vizanti_cpp/vizanti_cpp.py")
    got = build_set(repo, base, head)
    assert "vizanti_cpp" not in got
    assert "vizanti" not in got


def test_package_added_by_the_target_commit_is_built(repo: Path) -> None:
    """The build set must resolve against the TARGET tree, not the checkout.

    beast-pull computes the set before moving the checkout, so a package the
    target commit ADDS has no package.xml on disk yet. The worktree is pinned
    back to base to prove the mapping never touches the filesystem.
    """
    base = _git(repo, "rev-parse", "HEAD").strip()
    _add_package(repo, "ugv_main", "ugv_newcomer")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "add package")
    head = _git(repo, "rev-parse", "HEAD").strip()
    _git(repo, "checkout", "-q", base)
    assert build_set(repo, base, head) == ALWAYS | {"ugv_newcomer"}


def test_deleted_package_resolves_to_nothing(repo: Path) -> None:
    """Paths whose package no longer exists in the target must drop out —
    a deleted package cannot be built, and selecting it would error."""
    base = _git(repo, "rev-parse", "HEAD").strip()
    _git(repo, "rm", "-rq", f"{WS_REL}/src/ugv_main/ugv_vision")
    _git(repo, "commit", "-qm", "remove package")
    head = _git(repo, "rev-parse", "HEAD").strip()
    assert build_set(repo, base, head) == ALWAYS


def test_cross_package_rename_rebuilds_both_packages(repo: Path) -> None:
    """A file moved between packages must rebuild BOTH sides.

    With git's default rename detection, the diff emits only the destination
    path, so the source package would silently keep its stale artefacts —
    exactly how beast_base was once extracted from ugv_bringup. The script
    diffs with --no-renames to see both endpoints.
    """
    base = _git(repo, "rev-parse", "HEAD").strip()
    _git(
        repo,
        "mv",
        f"{WS_REL}/src/ugv_main/ugv_nav/ugv_nav.py",
        f"{WS_REL}/src/ugv_main/ugv_vision/ugv_nav.py",
    )
    _git(repo, "commit", "-qm", "move node between packages")
    head = _git(repo, "rev-parse", "HEAD").strip()
    assert build_set(repo, base, head) == ALWAYS | {"ugv_nav", "ugv_vision"}


def test_package_name_comes_from_the_name_tag_not_the_directory(repo: Path) -> None:
    """colcon selects by the <name> tag; directory names are convention only."""
    base = _git(repo, "rev-parse", "HEAD").strip()
    pkg = repo / WS_REL / "src" / "ugv_main" / "ugv_extras_dir"
    pkg.mkdir(parents=True)
    (pkg / "package.xml").write_text("<package><name>ugv_extras</name></package>\n")
    (pkg / "node.py").write_text("# source\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "add mismatched-name package")
    head = _git(repo, "rev-parse", "HEAD").strip()
    got = build_set(repo, base, head)
    assert "ugv_extras" in got
    assert "ugv_extras_dir" not in got


def test_a_deploy_with_no_source_changes_still_rebuilds_the_boot_path(repo: Path) -> None:
    """beast_base is the drive path; it is never skipped, whatever the diff."""
    base = _git(repo, "rev-parse", "HEAD").strip()
    head = commit_touching(repo, "docs/notes.md")
    assert "beast_base" in build_set(repo, base, head)
