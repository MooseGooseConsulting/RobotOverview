# Continuous deploy — cockpit and robot

Status: **Phase 1 implemented in this PR. Phase 1 is inert until a secret exists (§3).
Phase 2 is a work order, not done.**

Written 2026-08-14 against live evidence: `admin@homelab-target` (Flux resources, hangar
Deployment), `ssh beast-01-ts` (unit and pull-agent state), the GitHub API for
`MooseGooseConsulting/coldaine-homelab`, and every workflow in `.github/workflows/`.

---

## 1. The finding

**Publishing an image is not deploying it, and no tag makes it so.** Nothing in Kubernetes
and nothing on BEAST-01 watches GHCR. Kubernetes reacts to a change in the Deployment
*spec*; a tag moving underneath a spec that did not change is not an event.

That is why reverting to `:latest` would not fix this, and coldaine-homelab
[PR #285](https://github.com/MooseGooseConsulting/coldaine-homelab/pull/285) contains its
own proof: it recorded that `:latest` had moved on to a newer build **while the pod kept
serving the old one**. The two candidate tag configurations both fail, for the same reason:

| | Behaviour | Deploys on push? |
|---|---|---|
| `:latest` + `IfNotPresent` | Pod never re-pulls | No |
| `:latest` + `Always` | Re-pulls **on pod start** — and nothing starts a pod | No |
| digest pin | Spec changes, so the rollout is an event | Yes — but only if something writes it |

Something has to write the change. Nothing did.

### Both consumers already poll a pin

The pull half of this system was built and is correct. Only the writer was missing.

| Surface | Pin file (in `coldaine-homelab`) | Consumer | Latency | State |
|---|---|---|---|---|
| Cockpit / web | `infra/k8s/apps/hangar/deployment.yaml` | Flux `target-apps` | GitRepository 1 min + Kustomization 10 min → **≤ ~11 min** | **Live** |
| Robot | `deployments/beast-01/manifest.yaml` | `beast-pull.timer` | boot + hourly | **Not installed** (§4) |

Verified 2026-08-14:

- `GitRepository/homelab-git` → `https://github.com/MooseGooseConsulting/coldaine-homelab.git`,
  `interval: 1m`; `Kustomization/target-apps` → `./infra/k8s/apps`, `interval: 10m`,
  `prune: true`, with `hangar_hangar_apps_Deployment` in its inventory. Flux owns the rollout.
- `main` on `coldaine-homelab` is **not** branch-protected, so CI can push to it directly.
- The deployed digest is `sha256:20a8fc82…` = RobotOverview `main` `7481575` (#199), i.e. the
  cockpit in production is roughly two weeks behind `main`.

### Why not Flux image automation

It is the textbook answer and it is the wrong one here:

- `image.toolkit.fluxcd.io` returns **no API resources** on this cluster — neither
  `image-reflector-controller` nor `image-automation-controller` is installed. This is not a
  config change; it is installing and credentialing two controllers plus git write access
  for Flux.
- It solves one of the two surfaces well. Driving the BEAST-01 manifest from an `ImagePolicy`
  means teaching it a file that is not a Kubernetes manifest, to serve a consumer that is not
  Kubernetes.
- It knows tags, not provenance. CI knows the exact RobotOverview commit that produced the
  build and can record it; a registry watcher can only infer it.

One writer in CI covers both surfaces, adds no cluster components, and keeps the rollback
property that digest pinning bought: **revert the pin commit.**

---

## 2. Phase 1 — the writer (this PR)

`.github/workflows/deploy-pin.yml` runs after `Build RobotOverview image` or
`Build BEAST ROS image` succeeds on `main`, and:

1. Maps the upstream workflow to a surface (`hangar` / `beast`).
2. **Refuses to pin a commit whose tests failed.** `image.yml` publishes on `main`
   independently of the test workflows, so a green image can contain broken code. The gate
   names this repo's own test workflows — `Hangar web tests`, `Beast power tests`,
   `Beast ROS command spine`, `Beast storage tests`. A workflow that did not run (path
   filter) has no check run and correctly does not block. Third-party advisory checks are
   deliberately excluded.
3. Resolves the manifest digest from GHCR by the `sha-<commit>` tag, rather than plumbing the
   build step's output across the `workflow_run` boundary. This also proves the tag exists and
   is pullable before anything is committed.
4. Runs `tools/ci/pin_deploy_image.py` against a checkout of `coldaine-homelab`.
5. Commits and pushes to `main` there, retrying with `git pull --rebase` up to 3×.

`workflow_dispatch` takes `surface` + optional `sha` for a manual re-pin or a rollback to a
known-good commit.

### The pin writer is strict on purpose

`tools/ci/pin_deploy_image.py` anchors every edit on a pattern that must match **exactly
once** and raises otherwise. The failure mode it is built against is not a crash — it is a
silent no-op: if the anchor stops matching, CI goes green and reports a deploy while nothing
ships, which is exactly the class of failure the digest pin was introduced to end.

It is idempotent (a re-run produces a byte-identical file, so no empty commits) and preserves
each file's own line endings, so a local Windows run cannot rewrite an LF manifest as CRLF.

For `beast` it writes `digest` and `source_sha` **only**, never `image`: `beast-pull`'s
`desired_ref()` prefers `digest` when both are set, and two fields deciding one thing is one
too many.

---

## 3. Arming Phase 1 — the one manual step

`coldaine-homelab` is **private**, so the default `GITHUB_TOKEN` cannot reach it. Until the
secret exists, `deploy-pin.yml` fails on its first step with an explicit message and nothing
else changes — no partial state.

Patrick creates this; an agent must not:

1. GitHub → Settings → Developer settings → **Fine-grained personal access token**
   - Resource owner: `MooseGooseConsulting`
   - Repository access: **only** `MooseGooseConsulting/coldaine-homelab`
   - Permissions: **Contents: Read and write** (nothing else)
   - Expiry: whatever you will actually remember to rotate
2. `MooseGooseConsulting/RobotOverview` → Settings → Secrets and variables → Actions →
   New repository secret, named **`HOMELAB_DEPLOY_TOKEN`**.

**Done when:** merge anything to `main`, then within ~15 minutes
`https://hangar.moosegoose.xyz/api/hangar/preflight` is served by a pod whose image digest
matches the newest commit. Check the run's job summary — it prints the digest, whether it
pushed, and where to look.

A GitHub App would be the better long-term credential (no expiry, scoped installation). It is
strictly more setup for the same result today; take it when the PAT's first rotation annoys
you enough.

---

## 4. Phase 2 — make the robot pin actually drive the robot

**Not done. This phase is the work order.**

Ground truth on BEAST-01, 2026-08-14, read-only over `ssh beast-01-ts`:

```
beast-ros-base       active     <- host colcon build from a git checkout
beast-ros-container  inactive
beast-cockpit        active
beast-pull.timer     inactive
/usr/local/bin/beast-pull        does not exist
/etc/beast/current-image         does not exist
```

The entire pull architecture — `beast-pull.sh`, `run-beast-container.sh`, `verify-beast.sh`,
`beast-pull.{service,timer}`, `beast-ros-container.service`, `rollback-beast.sh` — is written
and looks sound (candidate container → verify → atomic swap or restore, `/etc/beast/rollback-hold`
kill switch, source-mode fallback). **It has simply never been installed.** The robot is
deployed today by `robot/beast/ros2_ws/deploy/deploy-to-beast.sh`, by hand.

Note the doc drift this exposes: `deploy-to-beast.sh` calls itself "the manual override /
Phase 0 source-sync path" and says twice that "canonical pull deploy lives in
`coldaine-homelab/deployments/beast-01/`". There is no canonical pull deploy running. The
manual override is the only path. Fix that header in the same PR that closes this phase.

### The hazard to design around

Installing the agent while `manifest.yaml` carries a digest means **the first timer tick swaps
the robot from source mode to container mode, unattended, up to an hour later** —
`swap_to_candidate()` does `systemctl disable --now beast-ros-base` and enables
`beast-ros-container`. That is a correct implementation of a decision nobody has consciously
made yet. It must be made while watching the robot, not by a timer at 3 a.m.

Also unresolved before any of this: source mode and container mode are not equivalent yet.
Device passthrough (`/dev/ttyTHS1` or the by-id ESP32 symlink, `i2c-7` for the INA219),
`/data/beast` storage paths, the Tailscale Serve loopback for `beast-cockpit`, and the
`--symlink-install` development loop all need to be shown working in a container before the
swap is a promotion rather than a regression.

### Work order

- **P2.1** Confirm `ghcr.io/moosegooseconsulting/beast-ros:latest` exists and is `linux/arm64`.
  `beast-ros-image.yml` is path-filtered, so it may never have run on `main`.
  If absent: `workflow_dispatch` it and check GHCR.
- **P2.2** On the robot, install with the timer **masked** and `/etc/beast/rollback-hold`
  present. Nothing may swap on a schedule before a human has watched one swap.
- **P2.3** Run `beast-pull` once by hand, supervised, robot **parked and disarmed**. Prove:
  candidate starts; `verify-beast` passes inside it; ESP32 serial and `i2c-7` reachable;
  `/data/beast` writable; drive-path probe passes (the `/cmd_vel_ui` → `twist_mux` →
  `beast_base` reject-while-disarmed check from `deploy-to-beast.sh --verify-only`).
- **P2.4** Prove rollback the same way — force a verify failure and confirm it restores.
- **P2.5** Only then clear `rollback-hold` and unmask the timer.
- **P2.6** Add a **parked gate** to `beast-pull`: skip the swap while `/ugv/allow_motion` is
  true or a mission recording is active, and re-check on the next tick. A stack restart is a
  brief outage; an outage mid-drive on a robot whose ESP32 latches its last velocity command
  is not an outage, it is a runaway. This gate does not exist today and Phase 2 must not
  complete without it.
- **P2.7** Update `deploy-to-beast.sh`'s header, `docs/beast-ops.md` Quick connect (dated),
  and `docs/deploy.md` to describe what actually runs.

**Done when:** a merge to `main` that touches `robot/beast/ros2_ws/**` reaches the robot
within an hour with no human action, the robot refuses the swap while armed, and a failed
verify rolls back on its own.

**Not in scope:** switching the robot to container mode as a *goal*. Phase 2 is finished when
auto-deploy works and is safe. If P2.3 shows container mode is a regression, the correct
outcome is a source-mode pull agent (`git fetch` → `--ff-only` → `colcon build` → restart →
verify → revert on failure), which is `deploy-to-beast.sh` steps 1–4 on a timer. Say so and
build that instead; do not force the container pivot to satisfy a plan.

---

## 5. Test surfaces

Tiers as defined in [`2026-08-14-verification-surfaces.md`](2026-08-14-verification-surfaces.md).

| Unit | Tier | Evidence | Status |
|---|---|---|---|
| Pin writer transforms | T1 | `tools/ci/test_pin_deploy_image.py` (16 tests) via `CI tools tests` | **ADDED** |
| Anchor still matches the real files | T1 | Fixtures are trimmed copies of both real pin files; they fail loudly when the anchors move | **ADDED** |
| Idempotency / no empty commits | T1 | `test_rerunning_leaves_the_file_byte_identical` | **ADDED** |
| Line-ending preservation | T1 | `test_the_file_keeps_its_own_line_endings` | **ADDED** |
| Refusal on ambiguity | T1 | `test_hangar_refuses_an_ambiguous_file_rather_than_guessing` | **ADDED** |
| Workflow YAML validity | T0 | `yaml.safe_load` on both files | Done in-session |
| Digest resolves from GHCR | T2 | The workflow's own `imagetools inspect` step — fails the run if not | Built in |
| Failing-tests gate | T2 | **CANNOT** be unit-tested; exercised only by a real red commit on `main` | Accepted gap |
| End-to-end cockpit deploy | T2 | First merge after the secret exists: preflight served by the new digest | **Phase 1 done-when** |
| Robot swap + rollback | T3 | Supervised, robot parked (P2.3 / P2.4) | **Phase 2** |
| Parked gate holds while armed | T3 | Owner-observed: arm the robot, tick the timer, confirm no swap | **Phase 2, P2.6** |

The honest gap: nothing tests that Flux *reacts*. That is Flux's own contract, it is already
exercised by every other app in `infra/k8s/apps`, and the Phase 1 done-when observes it
end-to-end anyway.

---

## 6. Delete this file when

Phase 2 is complete and `docs/deploy.md` + `docs/beast-ops.md` describe the running system.
Phase 1 alone is not enough — a plan that stops at the surface that was easy is the drift
this repo keeps generating.
