# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Tests for the coldaine-homelab pin writer.

The fixtures below are trimmed copies of the two real pin files. If a test here
fails after someone edits coldaine-homelab, that is the script working as
designed: the anchor moved, and the pin writer must be updated deliberately
rather than silently no-op into a green build that ships nothing.
"""

from __future__ import annotations

import pytest

from pin_deploy_image import PIN_FILES, PinError, main, pin_beast, pin_hangar

OLD = "sha256:" + "2" * 64
NEW = "sha256:" + "a" * 64
SHA = "c01273e5f0b1a2c3d4e5f60718293a4b5c6d7e8f"
RUN = "https://github.com/MooseGooseConsulting/RobotOverview/actions/runs/1234"

HANGAR = f"""\
# Hangar (RobotOverview) — GHCR image from GitHub Actions; Flux owns rollout.
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: hangar
          # RobotOverview main 7481575 (#199 library stream fix)
          image: ghcr.io/moosegooseconsulting/robot-overview@{OLD}
          imagePullPolicy: IfNotPresent
"""

BEAST = f"""\
schema_version: 1
unit: beast-01
registry: ghcr.io
repository: moosegooseconsulting/beast-ros
image: ""
# Optional: sha256:... digest once published. When set, pull agent uses @digest.
digest: ""
# Git SHA of RobotOverview that produced the image (provenance only).
source_sha: ""
manifest_url: https://raw.githubusercontent.com/MooseGooseConsulting/coldaine-homelab/main/x.yaml
"""


def test_hangar_replaces_digest_and_keeps_the_rest():
    out = pin_hangar(HANGAR, NEW, SHA, RUN)
    assert f"image: ghcr.io/moosegooseconsulting/robot-overview@{NEW}" in out
    assert OLD not in out
    # Hand-written comments and neighbouring keys survive untouched.
    assert "# RobotOverview main 7481575 (#199 library stream fix)" in out
    assert "imagePullPolicy: IfNotPresent" in out
    assert out.startswith("# Hangar (RobotOverview)")


def test_hangar_writes_one_provenance_line_at_the_image_indent():
    out = pin_hangar(HANGAR, NEW, SHA, RUN)
    prov = [line for line in out.splitlines() if "# deploy-pin:" in line]
    assert len(prov) == 1
    assert SHA in prov[0] and RUN in prov[0]
    # Same indent as the image line it annotates (10 spaces in a container list).
    assert prov[0].startswith(" " * 10 + "# deploy-pin:")


@pytest.mark.parametrize("pin, fixture", [(pin_hangar, HANGAR), (pin_beast, BEAST)])
def test_pinning_twice_is_idempotent(pin, fixture):
    once = pin(fixture, NEW, SHA, RUN)
    assert pin(once, NEW, SHA, RUN) == once


@pytest.mark.parametrize("pin, fixture", [(pin_hangar, HANGAR), (pin_beast, BEAST)])
def test_repinning_replaces_provenance_rather_than_stacking_it(pin, fixture):
    older = pin(fixture, OLD if pin is pin_beast else NEW, "0" * 40, "run/1")
    newer = pin(older, NEW, SHA, RUN)
    prov = [line for line in newer.splitlines() if "# deploy-pin:" in line]
    assert len(prov) == 1
    assert "run/1" not in newer


def test_hangar_refuses_a_file_with_no_pinned_image():
    with pytest.raises(PinError, match="no digest-pinned image line"):
        pin_hangar("kind: Deployment\nspec: {}\n", NEW, SHA, RUN)


def test_hangar_refuses_an_ambiguous_file_rather_than_guessing():
    two = HANGAR + f"        - name: sidecar\n          image: ghcr.io/x/y@{OLD}\n"
    with pytest.raises(PinError, match="expected exactly one"):
        pin_hangar(two, NEW, SHA, RUN)


def test_beast_sets_digest_and_source_sha_only():
    out = pin_beast(BEAST, NEW, SHA, RUN)
    assert f'digest: "{NEW}"' in out
    assert f'source_sha: "{SHA}"' in out
    # `image` is left alone: beast-pull's desired_ref() prefers digest, so
    # writing both would create two sources of truth for one decision.
    assert 'image: ""' in out
    # The URL containing a colon is not mistaken for a key to rewrite.
    assert "manifest_url: https://raw.githubusercontent.com" in out


def test_beast_provenance_sits_above_the_digest_key():
    lines = pin_beast(BEAST, NEW, SHA, RUN).splitlines()
    idx = next(i for i, line in enumerate(lines) if line.startswith("digest:"))
    assert lines[idx - 1].startswith("# deploy-pin:")


def test_beast_refuses_a_manifest_missing_the_digest_key():
    with pytest.raises(PinError, match="no `digest:` key"):
        pin_beast("schema_version: 1\nunit: beast-01\nsource_sha: \"\"\n", NEW, SHA, RUN)


def _run(root, surface, digest=NEW):
    return main(
        [
            "--surface", surface,
            "--repo-root", str(root),
            "--digest", digest,
            "--source-sha", SHA,
            "--run-url", RUN,
        ]
    )


@pytest.mark.parametrize(
    "surface, fixture, newline",
    [
        (surface, fixture, newline)
        for surface, fixture in (("hangar", HANGAR), ("beast", BEAST))
        for newline in ("\n", "\r\n")
    ],
)
def test_the_file_keeps_its_own_line_endings(tmp_path, surface, fixture, newline):
    """A Windows run must not rewrite an LF file as CRLF.

    Python's default text write translates to `os.linesep`, which would turn a
    one-line pin into a whole-file diff against a repository Flux applies.
    """
    path = tmp_path / PIN_FILES[surface]
    path.parent.mkdir(parents=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write(fixture.replace("\n", newline))

    assert _run(tmp_path, surface) == 0

    raw = path.read_bytes()
    assert raw.count(b"\r\n") == (0 if newline == "\n" else raw.count(b"\n"))
    assert NEW.encode() in raw


def test_rerunning_leaves_the_file_byte_identical(tmp_path):
    path = tmp_path / PIN_FILES["hangar"]
    path.parent.mkdir(parents=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write(HANGAR)

    assert _run(tmp_path, "hangar") == 0
    once = path.read_bytes()
    assert _run(tmp_path, "hangar") == 0
    assert path.read_bytes() == once
