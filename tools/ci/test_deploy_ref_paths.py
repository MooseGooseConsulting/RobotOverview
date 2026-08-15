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


# This model implements only the subset of GitHub's `paths:` syntax the filter
# actually uses: `*`, `**`, and a leading `!`. GitHub also supports `?`, `+`,
# and character classes, and its `**` can match zero path segments in ways this
# translation does not reproduce. That gap is not hypothetical — it is exactly
# how `robot/beast/ros2_ws/README.md` slipped through `**/*.md`. So rather than
# grow the model toward a full reimplementation (which would be a second thing
# to get wrong), `test_filter_uses_only_the_modelled_glob_subset` fails loudly
# the moment the filter adopts a construct this cannot faithfully evaluate.
MODELLED_GLOB_CHARS = set("*")
UNMODELLED_GLOB_CHARS = set("?+[]")


def _image_workflow_triggers() -> dict:
    wf = yaml.safe_load(IMAGE_WF.read_text(encoding="utf-8"))
    # PyYAML parses the `on:` key as the boolean True.
    return wf.get("on", wf.get(True))


def _image_workflow_paths(trigger: str = "push") -> list[str]:
    return _image_workflow_triggers()[trigger]["paths"]


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


def test_guard_refuses_a_truncated_compare() -> None:
    """GitHub's compare endpoint caps `commits` (250) and `files` (300) and does
    NOT error when it truncates — it simply returns less. A truncated range
    cannot prove the absence of a newer robot commit, and concluding "nothing
    newer" from a short page would pin superseded code onto a machine that
    moves: the same absence-of-evidence mistake this file exists to prevent,
    arriving from the other direction."""
    src = PIN_WF.read_text(encoding="utf-8")
    assert "total_commits" in src, (
        "the guard must compare total_commits against the returned page before "
        "concluding no newer robot commit exists"
    )
    assert "300" in src, "the guard must treat a file list at the API cap as truncated"


def test_guard_costs_one_api_call() -> None:
    """Walking commits would cost one getCommit per intervening commit, worst
    exactly when main is advancing quickly — the case this guard exists to
    tolerate. A rate-limited pin fails closed into the same stranding it fixes.
    The compare endpoint's aggregate `files` answers the question directly."""
    src = PIN_WF.read_text(encoding="utf-8")
    guard = src[src.index("if (surface === 'beast')") : src.index("if (stranded)")]
    # Comments in this block deliberately DISCUSS getCommit to explain why it is
    # absent; assert against code only, or the explanation trips its own test.
    code = "\n".join(
        line for line in guard.splitlines() if not line.strip().startswith("//")
    )
    assert "cmp.data.files" in code, "the guard must use the aggregate file list"
    assert "getCommit" not in code, (
        "no per-commit getCommit inside the staleness guard — use the compare "
        "response's aggregate `files` instead"
    )
    assert "for (" not in code, "the guard must not iterate commits"


def test_pull_request_and_push_filters_agree() -> None:
    """beast-ros-image.yml carries the same `paths:` list twice. If they drift,
    PR builds stop exercising the rule that main pushes deploy on — so the gate
    a change was reviewed under is not the gate that ships it."""
    triggers = _image_workflow_triggers()
    assert triggers["pull_request"]["paths"] == triggers["push"]["paths"], (
        "beast-ros-image.yml's pull_request and push `paths:` filters diverged"
    )


def test_filter_uses_only_the_modelled_glob_subset() -> None:
    """_matches_workflow_filter models `*`, `**` and a leading `!` — nothing
    else. If the filter adopts `?`, `+` or a character class, this model can
    stay green while GitHub behaves differently, which is precisely the class of
    bug that let README.md through. Fail loudly instead of silently drifting."""
    for trigger in ("pull_request", "push"):
        for pattern in _image_workflow_paths(trigger):
            body = pattern[1:] if pattern.startswith("!") else pattern
            offenders = UNMODELLED_GLOB_CHARS & set(body)
            assert not offenders, (
                f"{pattern!r} uses glob construct(s) {sorted(offenders)} that "
                f"_matches_workflow_filter does not model — extend the model (and "
                f"these tests) before using them, or the filter and this gate can "
                f"disagree without failing"
            )
