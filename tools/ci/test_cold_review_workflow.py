# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Contract tests for the OpenHands Cold Review workflow and skill.

These are the cheap checks that notice a silent regression (wrong model,
effort flag hacks, pull_request_target, missing auth cleanup) before a
wet-run burns a ChatGPT window.
"""

from __future__ import annotations

from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
WORKFLOW = REPO / ".github" / "workflows" / "cold-review.yml"
SKILL = REPO / ".agents" / "skills" / "custom-codereview-guide.md"


def _load_workflow() -> dict:
    text = WORKFLOW.read_text(encoding="utf-8")
    # The file starts with a comment block, then `name:` / `on:`.
    return yaml.safe_load(text)


def _on(wf: dict) -> dict:
    # PyYAML 1.1 treats the key `on` as boolean True.
    return wf.get("on") or wf[True]


def test_workflow_and_skill_paths_exist():
    assert WORKFLOW.is_file()
    assert SKILL.is_file()
    assert SKILL.name != "code-review.md"
    skill = SKILL.read_text(encoding="utf-8")
    assert "triggers:" in skill
    assert "/codereview" in skill


def test_triggers_and_guards():
    raw = WORKFLOW.read_text(encoding="utf-8")
    wf = _load_workflow()
    assert "pull_request_target" not in raw
    assert set(_on(wf)["pull_request"]["types"]) == {
        "opened",
        "ready_for_review",
        "labeled",
        "synchronize",
    }
    job = wf["jobs"]["review"]
    predicate = job["if"]
    assert "github.event.pull_request.draft == false" in predicate
    assert "github.event.pull_request.head.repo.full_name == github.repository" in predicate
    assert "github.event.label.name == 'review-this'" in predicate


def test_runner_environment_concurrency_and_permissions():
    wf = _load_workflow()
    job = wf["jobs"]["review"]
    assert job["runs-on"] == "moosegoose-general"
    assert job["environment"] == "openhands-review"
    assert wf["concurrency"]["group"] == "cold-review-${{ github.event.pull_request.number }}"
    assert wf["concurrency"]["cancel-in-progress"] is True
    assert wf["permissions"] == {
        "contents": "read",
        "pull-requests": "write",
        "issues": "write",
    }


def test_setup_node_user_space_gh_and_auth_lifecycle():
    raw = WORKFLOW.read_text(encoding="utf-8")
    wf = _load_workflow()
    steps = wf["jobs"]["review"]["steps"]
    uses = [step.get("uses", "") for step in steps]
    assert any(u.startswith("actions/setup-node@") for u in uses)
    setup_node = next(s for s in steps if str(s.get("uses", "")).startswith("actions/setup-node@"))
    assert setup_node["with"]["node-version"] == "22"

    gh_step = next(s for s in steps if s.get("name") == "User-space gh")
    assert "$HOME/.local/bin" in gh_step["run"]
    assert "sudo apt" not in gh_step["run"]

    restore = next(s for s in steps if s.get("name") == "Restore Codex auth")
    assert "CODEX_AUTH_JSON_B64 missing" in restore["run"]
    assert "$HOME/.codex/auth.json" in restore["run"]
    assert "chmod 600" in restore["run"]

    cleanup = next(s for s in steps if s.get("name") == "Cleanup Codex auth")
    assert cleanup.get("if") == "always()"
    assert 'rm -f "$HOME/.codex/auth.json"' in cleanup["run"]
    assert "pull_request_target" not in raw


def test_stock_openhands_acp_luna_xhigh_no_effort_hacks():
    wf = _load_workflow()
    review = next(
        s
        for s in wf["jobs"]["review"]["steps"]
        if s.get("name") == "Run PR Review"
    )
    assert review["uses"] == "OpenHands/extensions/plugins/pr-review@main"
    assert review["with"]["agent-kind"] == "acp"
    assert review["with"]["acp-command"] == "npx -y @agentclientprotocol/codex-acp"
    assert review["with"]["llm-model"] == "gpt-5.6-luna/xhigh"
    assert review["with"]["github-token"] == "${{ steps.app.outputs.token }}"
    # Rejected silent no-ops from earlier drafts.
    assert "-c " not in review["with"]["acp-command"]
    assert "model_reasoning_effort" not in review["with"]["acp-command"]
    assert "/max" not in review["with"]["llm-model"]

    app = next(s for s in wf["jobs"]["review"]["steps"] if s.get("name") == "App token")
    assert app["uses"].startswith("actions/create-github-app-token@")
    assert app["with"]["app-id"] == "${{ vars.OPENHANDS_COLD_REVIEW_APP_ID }}"
    assert app["with"]["private-key"] == "${{ secrets.OPENHANDS_COLD_REVIEW_PRIVATE_KEY }}"
