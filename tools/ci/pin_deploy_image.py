#!/usr/bin/env python3
# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Write a published image digest into the coldaine-homelab pin its consumer watches.

Publishing an image is not deploying it. Nothing in Kubernetes and nothing on
BEAST-01 watches GHCR; both consumers poll a git-tracked pin in the
coldaine-homelab repository and act when it changes:

    surface   pin file                                consumer
    hangar    infra/k8s/apps/hangar/deployment.yaml   Flux `target-apps`
                                                      (GitRepository 1m,
                                                      Kustomization 10m)
    beast     deployments/beast-01/manifest.yaml      `beast-pull.timer`
                                                      (boot + hourly)

Until `.github/workflows/deploy-pin.yml` existed, nothing wrote those pins and
both were bumped by hand — which is why a merged change did not ship. This
script is that workflow's only writer.

It is deliberately strict. Every edit is anchored on a pattern that must match
exactly once; a missing or ambiguous anchor raises `PinError` and exits
non-zero rather than leaving the file untouched. A silent no-op here is the
worst outcome available: CI goes green and reports a deploy while nothing
ships, which is precisely the failure the digest pin was introduced to end.

Idempotent: re-pinning a digest that is already present exits 0 and reports
that nothing changed, so a re-run of a workflow never produces an empty commit.

The transform functions are pure str -> str so they can be tested without a
checkout; see tools/ci/test_pin_deploy_image.py.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
SOURCE_SHA_RE = re.compile(r"^[0-9a-f]{7,40}$")

# One provenance line, rewritten in place on every pin. Marked so a later run
# can find and replace its own previous line without disturbing the
# hand-written comments around it.
PROVENANCE_PREFIX = "# deploy-pin:"
PROVENANCE_LINE_RE = re.compile(rf"^[ \t]*{re.escape(PROVENANCE_PREFIX)}.*\n", re.MULTILINE)

# hangar: the digest-pinned container image line in the Deployment.
HANGAR_IMAGE_RE = re.compile(
    r"^(?P<indent>[ \t]*)image:[ \t]*(?P<ref>ghcr\.io/[^@\s]+)@sha256:(?P<digest>[0-9a-f]{64})[ \t]*$",
    re.MULTILINE,
)

PIN_FILES = {
    "hangar": "infra/k8s/apps/hangar/deployment.yaml",
    "beast": "deployments/beast-01/manifest.yaml",
}


class PinError(RuntimeError):
    """The pin file did not look the way this script requires."""


def provenance(source_sha: str, run_url: str) -> str:
    """The single generated comment line, without indent or trailing newline."""
    return f"{PROVENANCE_PREFIX} RobotOverview main {source_sha} via {run_url}"


def _require_one(matches: list[re.Match[str]], what: str, path: str) -> re.Match[str]:
    if not matches:
        raise PinError(
            f"{path}: no {what} found. The pin file changed shape; "
            f"update tools/ci/pin_deploy_image.py in the same commit."
        )
    if len(matches) > 1:
        lines = ", ".join(str(m.string.count("\n", 0, m.start()) + 1) for m in matches)
        raise PinError(
            f"{path}: {len(matches)} {what} found (lines {lines}); expected exactly one. "
            f"Refusing to guess which one deploys."
        )
    return matches[0]


def pin_hangar(text: str, digest: str, source_sha: str, run_url: str) -> str:
    """Replace the Deployment's image digest and rewrite the provenance line above it."""
    stripped = PROVENANCE_LINE_RE.sub("", text)
    match = _require_one(
        list(HANGAR_IMAGE_RE.finditer(stripped)), "digest-pinned image line", PIN_FILES["hangar"]
    )
    indent = match.group("indent")
    replacement = (
        f"{indent}{provenance(source_sha, run_url)}\n"
        f"{indent}image: {match.group('ref')}@{digest}"
    )
    return stripped[: match.start()] + replacement + stripped[match.end() :]


def _set_scalar(text: str, key: str, value: str, path: str) -> str:
    """Set a flat top-level `key: value` in a YAML file, quoting the value."""
    pattern = re.compile(rf"^(?P<indent>[ \t]*){re.escape(key)}:[ \t]*.*$", re.MULTILINE)
    match = _require_one(list(pattern.finditer(text)), f"`{key}:` key", path)
    replacement = f"{match.group('indent')}{key}: \"{value}\""
    return text[: match.start()] + replacement + text[match.end() :]


def pin_beast(text: str, digest: str, source_sha: str, run_url: str) -> str:
    """Set the pull agent's digest + provenance in the BEAST-01 manifest.

    Only `digest` and `source_sha` are written. `image` is deliberately left as
    it is: beast-pull's `desired_ref()` prefers `digest` when both are set, so
    writing both would create two sources of truth for one decision.
    """
    path = PIN_FILES["beast"]
    stripped = PROVENANCE_LINE_RE.sub("", text)
    out = _set_scalar(stripped, "digest", digest, path)
    out = _set_scalar(out, "source_sha", source_sha, path)

    # Provenance rides above `digest:`, the field that actually triggers a pull.
    digest_line = _require_one(
        list(re.compile(r"^(?P<indent>[ \t]*)digest:.*$", re.MULTILINE).finditer(out)),
        "`digest:` key",
        path,
    )
    indent = digest_line.group("indent")
    return (
        out[: digest_line.start()]
        + f"{indent}{provenance(source_sha, run_url)}\n"
        + out[digest_line.start() :]
    )


PINNERS = {"hangar": pin_hangar, "beast": pin_beast}


def read_preserving_newlines(path: Path) -> tuple[str, str]:
    """Read a file as text, normalized to `\\n`, plus the newline it actually uses.

    Python's default write translates `\\n` to `os.linesep`, so a Windows run of
    this script would rewrite every line of a LF file as CRLF — a one-line pin
    would land as a whole-file diff against a repository Flux applies. Read and
    write the file's own convention instead of the host's.
    """
    with path.open("r", encoding="utf-8", newline="") as handle:
        raw = handle.read()
    return raw.replace("\r\n", "\n"), ("\r\n" if "\r\n" in raw else "\n")


def write_preserving_newlines(path: Path, text: str, newline: str) -> None:
    with path.open("w", encoding="utf-8", newline=newline) as handle:
        handle.write(text)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--surface", required=True, choices=sorted(PIN_FILES))
    parser.add_argument("--repo-root", required=True, type=Path, help="coldaine-homelab checkout")
    parser.add_argument("--digest", required=True, help="sha256:<64 hex> manifest digest")
    parser.add_argument("--source-sha", required=True, help="RobotOverview commit that built it")
    parser.add_argument("--run-url", required=True, help="URL of the run that published it")
    args = parser.parse_args(argv)

    if not DIGEST_RE.match(args.digest):
        parser.error(f"--digest must be sha256:<64 hex>, got {args.digest!r}")
    if not SOURCE_SHA_RE.match(args.source_sha):
        parser.error(f"--source-sha must be a hex commit sha, got {args.source_sha!r}")

    path = args.repo_root / PIN_FILES[args.surface]
    if not path.is_file():
        print(f"FAIL {path} does not exist", file=sys.stderr)
        return 1

    before, newline = read_preserving_newlines(path)
    try:
        after = PINNERS[args.surface](before, args.digest, args.source_sha, args.run_url)
    except PinError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1

    if after == before:
        print(f"no change: {args.surface} already pinned to {args.digest}")
        return 0

    write_preserving_newlines(path, after, newline)
    print(f"pinned {args.surface} -> {args.digest} (RobotOverview {args.source_sha})")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
