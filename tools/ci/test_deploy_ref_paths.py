"""The robot's deploy gate depends on two path filters agreeing.

`beast-ros-image.yml` decides which commits get an image build at all, and a
build completing is the only thing that triggers `deploy-pin.yml`. Inside
deploy-pin, the beast staleness guard re-implements the same filter in
JavaScript to answer "is this still the newest commit that changes what the
robot runs?".

Two copies of one rule, in two languages, in two files. If they drift, the
robot silently stops deploying — and the workflow still reports success, which
is how the original gap survived unnoticed:

  #236 touched beast_power, its image build ran 8m55s, #238 (.github only)
  merged inside that window, #236's pin skipped as "old", and #238 never built
  because it touched no robot path. refs/deploy/beast-01 stayed at #237 and the
  SoC fix could never deploy on its own.

These tests pin the rule itself and assert both copies still express it.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

REPO = Path(__file__).resolve().parents[2]
IMAGE_WF = REPO / ".github/workflows/beast-ros-image.yml"
PIN_WF = REPO / ".github/workflows/deploy-pin.yml"

# The rule, stated once. (path, should_deploy_the_robot)
CASES = [
    ("robot/beast/ros2_ws/src/ugv_main/beast_power/beast_power/soc.py", True),
    ("robot/beast/ros2_ws/src/ugv_main/beast_base/beast_base/base_node.py", True),
    ("robot/beast/ros2_ws/deploy/bin/beast-pull", True),
    ("robot/beast/ros2_ws/deploy/systemd/beast-nav.service", True),
    ("robot/beast/ros2_ws/build_common.sh", True),
    # Docs and prose cost the robot a full stop/rebuild/restart/verify cycle
    # for no behaviour change, so they are deliberately carved out.
    ("robot/beast/ros2_ws/docs/mapping.md", False),
    ("robot/beast/ros2_ws/docs/index.md", False),
    ("robot/beast/ros2_ws/README.md", False),
    ("robot/beast/ros2_ws/src/ugv_main/beast_power/README.md", False),
    # Nothing outside the robot tree changes what the robot runs...
    ("src/data/types.ts", False),
    ("docs/beast-ops.md", False),
    ("tools/ci/test_beast_ctl.py", False),
    (".github/workflows/ci-tools-tests.yml", False),
    # ...except the image workflow itself, which gates the whole path.
    (".github/workflows/beast-ros-image.yml", True),
]


def _image_workflow_paths() -> list[str]:
    wf = yaml.safe_load(IMAGE_WF.read_text(encoding="utf-8"))
    # PyYAML parses the `on:` key as the boolean True.
    triggers = wf.get("on", wf.get(True))
    return triggers["push"]["paths"]


def _matches_workflow_filter(path: str, patterns: list[str]) -> bool:
    """Evaluate GitHub's `paths:` semantics: last matching pattern wins."""
    verdict = False
    for pattern in patterns:
        negated = pattern.startswith("!")
        glob = pattern[1:] if negated else pattern
        regex = "^" + re.escape(glob).replace(r"\*\*", ".*").replace(r"\*", "[^/]*") + "$"
        if re.match(regex, path):
            verdict = not negated
    return verdict


@pytest.mark.parametrize("path,should_deploy", CASES)
def test_image_workflow_filter_matches_the_rule(path: str, should_deploy: bool) -> None:
    """A path missing here is a robot change that never builds, so never pins."""
    patterns = _image_workflow_paths()
    assert _matches_workflow_filter(path, patterns) is should_deploy, (
        f"{path}: beast-ros-image.yml paths filter disagrees with the rule"
    )


@pytest.mark.parametrize("path,should_deploy", CASES)
def test_pin_guard_filter_matches_the_rule(path: str, should_deploy: bool) -> None:
    """The JS guard in deploy-pin.yml must classify paths identically.

    Re-implemented rather than parsed: the point is that the same INPUTS reach
    the same VERDICT, so a reader changing one copy sees this fail.
    """
    src = PIN_WF.read_text(encoding="utf-8")

    # Keep this in lockstep with the `robotPath` / `affectsRobot` closures.
    def guard(p: str) -> bool:
        return (
            p.startswith("robot/beast/ros2_ws/")
            and not p.startswith("robot/beast/ros2_ws/docs/")
            and not p.endswith(".md")
        ) or p == ".github/workflows/beast-ros-image.yml"

    # Assert the guard in the workflow still looks like what we modelled; a
    # rewrite that changes these predicates must update this test too.
    for fragment in (
        "f.startsWith('robot/beast/ros2_ws/')",
        "!f.startsWith('robot/beast/ros2_ws/docs/')",
        "!f.endsWith('.md')",
        "'.github/workflows/beast-ros-image.yml'",
    ):
        assert fragment in src, f"deploy-pin.yml guard no longer contains {fragment!r}"

    assert guard(path) is should_deploy, f"{path}: pin guard disagrees with the rule"


def test_guard_only_relaxes_staleness_for_beast() -> None:
    """Hangar must still require main's tip — the cluster serves main itself."""
    src = PIN_WF.read_text(encoding="utf-8")
    assert "if (surface === 'beast')" in src, (
        "the robot-path staleness relaxation must be scoped to the beast surface"
    )
    assert "stranded = true;" in src, "the non-beast branch must still strand"


def test_guard_refuses_commits_not_on_main() -> None:
    """A re-run from an abandoned branch must never reach the robot."""
    src = PIN_WF.read_text(encoding="utf-8")
    assert "'behind'" in src and "'diverged'" in src, (
        "the beast guard must reject compare statuses that mean `sha` is not an "
        "ancestor of main, or a re-run of an abandoned branch could deploy"
    )
