# BEAST-01 rebuild — the execution ladder

**Status:** PROPOSED — 2026-08-27; amended 2026-08-28 after owner discussion (preserve-list
candidates from the autonomy on-ramp's executed phases, decision 5, the plans-harvest rule).
Companion to the governing clean-room rebuild plan held on
[PR #247](https://github.com/MooseGooseConsulting/RobotOverview/pull/247)
(`docs/plans/2026-08-15-beast-platform-rebuild.md`). That plan owns **what survives and why**
(the preserve list, the evidence, the watch-outs). This document owns **how the work is
sequenced**: rungs, artifacts, gates, and the five decisions the owner must ratify before
rung 1 starts. Nothing here relaxes the plan; where the two disagree, the plan wins until the
owner says otherwise.

**The ladder property:** the robot is never broken. The old stack runs untouched until rung 7;
every rung below 7 is revertible by doing nothing; rung 7 itself keeps a one-command rollback.
Robot hardware is only involved at rungs 5–7. Everything else runs offline or in CI.

**Snapshot warning:** the plan's counts (17 units, 13 scripts, parked `explore_lite`) date from
2026-08-15. #245 landed after it: `explore_lite` un-parked, `beast-explore.service` added, Nav2
and SLAM params re-tuned. Every rung extracts from **current `main`**, never from the plan's
numbers, and never from a contributor's memory of them.

## What already exists (do not rebuild these)

Verified in this repo on 2026-08-27 — the rebuild inherits them:

- **Self-hosted runners** `moosegoose-general` and `moosegoose-n5-large` carry CI (#251).
- **An arm64 robot image already builds**: `.github/workflows/beast-ros-image.yml` →
  `ghcr.io/moosegooseconsulting/beast-ros`, `linux/arm64` via buildx with GHA layer caching
  (`cache-from/to: type=gha, scope=beast-ros`), from `ros:humble-ros-base`.
- **A rollback-proven deploy exists**: source-mode `beast-pull` passed its supervised rollout
  2026-08-14 — watched swap, forced-rollback proof, parked-gate proof (`docs/deploy.md`,
  Known gaps). The robot reads neither the homelab manifest nor the GHCR image today.
- **`tools/ci/test_deploy_ref_paths.py`** holds the image workflow's path filter and
  deploy-pin's guard to one rule.

The rebuild's job is not to invent this machinery; it is to shrink what the machinery carries
until the pinned manifest, the image, and the deploy tool are small enough to be obviously
correct.

## Rung 0 — Ratify (owner; ~30 minutes; no robot)

Five decisions block everything below. Recommendations attached; the decision is the owner's.

1. **Merge PR #247 as the governing plan**, after these corrections:
   - Every measured number in the preserve list cited to a Hangar insight id. Known
     discrepancy to resolve at rung 1: the plan states an 8.332 V pack hard trip; review
     tooling reports `ins-beast-pack-cutoff-measured` as 8.368 V. Do not guess — resolve
     from the DB record's provenance (rung 1 owns this).
   - Note in the plan that its counts are a 2026-08-15 snapshot (see Snapshot warning above).
   - **Three preserve-list additions surfaced 2026-08-28.** The plan's burden-of-proof rule
     still applies, but each carries evidence the six items don't cover:
     1. **The camera-to-cockpit pipeline.** `docs/NORTH_STAR.md` G7 names *video* as a
        portal surface, so this is decided by intent, not taste — yet the only node serving
        it (`cam_oak_webrtc` in `ugv_vision`) dies at Phase D with no named successor. The
        pipeline's shape and the OAK-D device facts become a seventh knowledge item; a
        small owned camera node joins the new tree.
     2. **The measured calibration constants and EKF fusion config.** The autonomy
        on-ramp's Phase 1 (2026-08-14) measured `b_eff`/`wheel_base`, the gyro bias, and
        the linear scale, and landed them as parameters with the `ekf.yaml` fusion
        decisions and written rationale. The insights (`ins-beast-odom-calibration-2026-08-14`
        and siblings) record the findings, but the **operative values live in old-tree
        launch/param files that Phase D deletes**. They cost a supervised owner session on
        the real floor; rung 1 extracts them into `params/` with insight ids like every
        other number.
     3. **Kinematics and the robot model.** Wheel radius, track width, and the URDF
        (`ugv_description`) are chassis facts embedded in vendor code;
        `diff_drive_controller` and every TF consumer need them on day 1.
2. **`ugv_cockpit` disposition** (the review's open question). Recommendation: carry it as an
   explicitly temporary shim with a written expiry — the same mechanism the plan already
   grants `beast_base` — and let the roslib-convergence plan's close-out decide its final
   home. It must not block the rebuild and must not survive by inertia.
3. **Artifact form for the new tree** — researched 2026-08-28; the evidence moved this
   recommendation. Two real practitioner paths:
   - **Container as the deploy vehicle** — the mainstream way robot stacks ship in 2026:
     CI builds the arm64 image, the robot's systemd units run it (host networking +
     `--ipc=host` for DDS, explicit `--device` maps by-id, the node as PID 1 so death
     propagates to the container exit and systemd sees it); update is pull + restart,
     rollback is retagging to the retained `previous` image. The decisive property: the
     artifact CI proved at rung 3 is **byte-for-byte the artifact the robot runs** — C2
     stops being a proxy proof. The classic Jetson-container trap — CUDA/TensorRT/multimedia
     userspace in the container must match the flashed JetPack, so generic Ubuntu bases
     break subtly — does **not** bite this robot today: the stack is CPU-only ROS and the
     OAK-D runs its inference on-camera, so the pinned `ros:humble-ros-base` the existing
     Dockerfile already uses is correct. Record the rule with the decision: **the day
     Orin-GPU inference enters scope, the base must switch to an L4T/JetPack-aligned image
     (`nvcr.io/nvidia/l4t-jetpack` or `dustynv/ros`) matched to the flashed JetPack**, and
     the units gain `--runtime nvidia` — or it fails in exactly the ways the field warns
     about.
   - **Source release dirs with A/B symlinks** (`/opt/beast/releases/<sha>` +
     `current`/`previous`): keeps `beast-pull`'s proven semantics with no docker in the
     robot's runtime loop, but keeps on-robot colcon builds alive — the path that
     historically drifted — and leaves C2 proving the manifests rather than the shipped
     artifact.
   Recommendation: **container as the deploy vehicle**, with `beast-pull`'s proven gates
   (health-verify before swap, parked gate while motion-armed, failed-target memory)
   carried into the successor tool, and release dirs as the fallback if robot-side
   container plumbing throws surprises at rung 5. Either way, OS-layer A/B (`ROOTFS_AB` /
   `nvbootctrl`) stays out of scope: it is real and fleet-proven (RDFM, meta-tegra), but it
   is a flash-time partition-layout choice that halves rootfs storage, requires a
   boot-health service calling `nvbootctrl mark-boot-successful` on every boot (otherwise
   the retry counter silently switches slots — watchdog resets and kernel panics decrement
   it too), and has documented auto-recovery quirks on Orin Nano r36.x. Application and OS
   updates stay separate planes; the flash runbook remains the OS-layer recovery.
4. **Repo shape: stay one repo.** The split that matters — knowledge out of the repo — is
   already designed: facts live in the Hangar DB, code lives here. The confusion has come
   from knowledge leaking into markdown, not from the monorepo. Splitting now would freeze
   today's tangle into two repos and double coordination across the cockpit bridge, ingest
   API, and shared types during the riskiest project of the year. Re-evaluate after rung 7,
   when the robot tree is a few packages and a split would be cheap — if the pain is gone,
   the split was never the fix.
5. **Run the first real mapping run on the old stack before cutover** (recommended;
   declining does not block the rebuild). The autonomy on-ramp's Phase 2 has never run.
   It is owner-driven WASD with `slam_toolbox` observing — not gated by the roslib NaN
   defect (F13), which only blocks agent-issued goals. The map stem lands in
   `/data/beast/maps/`, off-tree and untouched by Phase D, and gives rung 5's
   side-by-side a real map and identical goals to compare old stack against new.
   Without it, C1 validates on the residue of the 2026-08-13 incident. Decline if robot
   time is the constraint; nothing below depends on it.

Emit: #247 merged; the five decisions recorded in one `append_activity` entry.
Done when: an agent starting rung 1 can cite a decision for all five without asking.

## Rung 1 — Knowledge extraction and memory triage (DB access; no robot)

Phase A of the plan, plus the triage that makes it trustworthy. The owner's stated worry is
real: some recorded incidents are mis-diagnoses, and nothing currently distinguishes them
from instrument readings. Triage by **evidence class**, not by re-litigating incidents:

1. Sweep `insights` (`find.ts`, then the ingest API). Classify each as:
   - **measurement** — an instrument read a number (pack trip voltage, wheel-travel ratio,
     yaw decay samples). Keep unconditionally; these are the crown jewels.
   - **identity** — what the hardware is: device paths, pinouts, protocol frames, package
     lineage. Keep; verify the cheap ones (`ls` on the robot at rung 5).
   - **diagnosis** — a causal story about an incident ("X froze because Y"). Keep **only as
     hypothesis** unless the mechanism was reproduced; tag it so no future agent cites it as
     fact. The rebuild consumes measurements and identity facts; it treats diagnoses as
     leads.
   - **procedure** — how-to knowledge; keep if its subject survives rung 7.
   Never delete — supersede or re-tag (`append_insight` with a correction linking the old
   id). Deleting recorded history is how the next mis-diagnosis loses its context.
2. Resolve the 8.332 / 8.368 V discrepancy from the DB record's provenance and correct
   whichever surface is wrong, with a dated note.
3. Land the preserve-list briefing (`land_briefing`, kind `plan` — full `bodyMarkdown`):
   the plan's six knowledge items, extracted from **current `main`** (post-#245 Nav2/SLAM
   tuning, the current twist_mux ladder, the current unit set), every number carrying its
   insight id.
4. **One adversarial cross-check pass** over the old tree — a fresh agent, prompt: "find
   anything genuinely ours that is not on the preserve list." Burden of proof is on
   inclusion; findings go to the owner as candidates, never silently onto the list. This is
   the only archaeology in the whole ladder. Do not comb further: the 2026-08-15 audit
   already measured the tree, and the plan's anti-goal stands — "we found we still needed
   it" is the mechanism that built the current system.
5. **Harvest the plans directory.** Most live plans in `docs/plans/` are work orders
   against the old tree, and several carry hazards that exist **only in their prose**:
   the rosbridge bare-`NaN` defect and its consequences for the agent-side stop, the
   `keyboard_ctrl` SIGHUP hazard, the no-RTC `time-sync.target` ordering rule, the ESP32
   velocity latch, the abort-path order. Land each as an insight with its evidence class
   before the code it describes is deleted. The triage rule mirrors the memory triage —
   a doc is (a) a work order against code Phase D deletes: harvest its hazards, then
   delete it in the same commit that deletes its target; (b) a hardware fact: belongs in
   the DB, not markdown; (c) an operating fact about the *new* stack: rewritten fresh,
   never ported. The roslib-convergence plan is the exception that proves the rule: it
   targets the web app (`src/server/beast/ros-singleton.ts`), survives Phase D untouched,
   and proceeds in parallel — the rebuild neither waits for it nor absorbs it.

Done when: the briefing renders in Datacore; every numeric fact in it cites an insight id;
each insight carries an evidence class; the voltage discrepancy is closed with provenance;
the plans-directory hazards are landed as insights.

## Rung 2 — Pin the world (no robot)

New tree at `robot/beast/brain/` (name is a rung-0 amendment if the owner prefers another).
Empty start; every file typed on purpose, from the rung-1 briefing — never from the robot:

- `beast.repos` — vcs manifest; every source dependency at an exact SHA.
- `apt.manifest` — the exact `ros-humble-*` and system package list, versioned. Written from
  the preserve list; rung 3 exists to catch what it misses, loudly.
- `base.lock` — the machine identity the tree assumes: JetPack / L4T version, Ubuntu base,
  and the digest of the CI proof image. When the Jetson is reflashed, this file is the
  contract the flash must satisfy (`docs/beast-jetson-flash-runbook.md` is the procedure).
- `beast_power/` — carried verbatim with its tests. The one code survivor.
- `params/` — Nav2, twist_mux, slam_toolbox with rationale comments and insight ids;
  `use_sim_time: false` in the params file, never a launch argument.
- `systemd/` — fresh units, direct `ExecStart`, plus an **enablement manifest**: the repo
  states which units are enabled; changing that set is a reviewed diff.
- `provision.sh` — written from the manifests, with `--check`.

Done when: every file in the new tree is deliberate (no copies beyond `beast_power`), and
`provision.sh --check` runs clean against a container built from `base.lock`.

## Rung 3 — CI proof: rebuildable-from-nothing, every commit (no robot)

This is the plan's C2 turned from a one-time test into a standing gate, and the direct answer
to "how do we recreate the image": after the rebuild, the image is `base.lock`'s pinned base
plus `apt.manifest` plus a colcon build of two or three small packages — minutes, mostly
cache hits.

- New workflow (successor to `beast-ros-image.yml`, same runners, same buildx/GHA cache):
  build arm64 from the pinned base digest → run `provision.sh` → `rosdep`/apt from
  `apt.manifest` → colcon build → smoke: start each node against fake hardware endpoints
  (recorded `T:1001` frames on a pty for the base; no-op ports elsewhere), assert alive,
  then kill one and assert the failure **propagates** — the "node death is visible" property
  the old stack lacks, checked on every commit.
- Layer order: base → apt (keyed on `apt.manifest` hash) → source deps (keyed on
  `beast.repos`) → our packages. A dependency change rebuilds one layer; a code change
  rebuilds only ours.
- Build-speed honesty: today's workflow builds arm64 under QEMU on amd64 runners, and QEMU
  costs roughly 3–10× on compile-heavy layers (measured reports; one full ROS workspace:
  8 h emulated vs 1 h native). Post-rebuild that cost is confined to the colcon layer of
  two or three small packages, so the existing QEMU + layer-cache path is acceptable. If it
  grows, the standard fix is a **native arm64 builder** — GitHub's hosted `ubuntu-24.04-arm`
  runners or a self-hosted arm64 machine — building per-arch and merging manifests with
  `imagetools create`; not more cache, and never CI on the robot itself.
- Stated honestly, as the plan does: a container cannot prove udev rules, group
  memberships, or the RTC ordering. Those are rung 6's job. Everything else that made
  bring-up historically fail — missing apt package, undeclared pip dep, accidental
  dependency — fails **this** gate, loudly, before it reaches hardware.

Done when: green from a cache-cold runner, and deliberately deleting one manifest entry
fails the build with the missing package named.

## Rung 4 — `beast_hardware` (the plan's riskiest item; bench only)

The `ros2_control` SystemInterface speaking T-code. Built against recordings, not the robot:

- Parse recorded inbound `T:1001` streams byte-for-byte in unit tests; emit `T:13` goldens.
- Runs in the rung-3 smoke against the fake pty.
- The fallback stands as written in the plan: if not ready when rungs 5–6 are, carry
  `beast_base` as a shim with a written expiry — tracked debt, not preserve-list creep.

Done when: CI-green against recordings; first live bench contact happens at rung 5 with
wheels off the ground.

## Rung 5 — C1: functional, on the robot, side-by-side

Stand the new stack up beside the old one in its rung-0 artifact form — the candidate
image (or a release dir under `/opt/beast/releases/<sha>`) with differently-named units,
nothing enabled. Old stack untouched and running. Supervised bring-up under the `/beast-paces`
staging discipline (ground-truth checks, cmd_vel-timeout gate, explicit zeros — never rely
on ceasing to publish). Rollback: do nothing; the old stack was never stopped.

Rung 5 also carries the **OAK-D Lite qualification** — the hardware half of the camera
preserve item. The repo record (`docs/beast-ops.md`, first light 2026-07-31): RGB and
aligned depth both ~16 FPS, TF correct, MXID `1944301091FCBE2F00` — a working camera,
but negotiating `USB SPEED: HIGH` (USB 2.0), with the in-box Lite cable presumed the
cause and a written five-minute discriminator that has never been run: a known-USB3
USB-C cable into a direct Orin USB3 port, then read the driver log. `SUPER` (+ ~30 FPS)
clears the unit — the limitation was the cable. Still `HIGH` on a known-good cable and
port makes the unit or the Orin port genuinely suspect, and that verdict decides whether
the camera item means "carry the pipeline" or "replace the sensor first". Check IMU
presence on this Lite revision in the same session (unchecked since first light — the
`depthai` python module was absent). Land the verdict as a measurement-class insight
either way; if the owner has observed symptoms since 2026-07-31 that live in no record,
capture them as the hypothesis this test discriminates.

Done when: the new stack drives supervised, on the robot the old stack still owns, and
the OAK qualification verdict is in the DB.

## Rung 6 — C2: fresh metal

Fresh flash per `docs/beast-jetson-flash-runbook.md`, then `provision.sh` — nothing else.
This is the only step that proves udev (`03e7`), groups, and boot ordering with no RTC.
Every fix discovered here lands in the manifests first, then re-runs; a hand-fix on the
robot that skips the manifest recreates the old failure mode in the new tree.

Done when: flash + provision + enable reaches a driving robot with no undocumented step —
the plan's done-condition 1.

## Rung 7 — Cut over, then delete in one commit

- The deploy tool (successor to `beast-pull`, one tool, small), in the rung-0 artifact
  form: fetch the new image (or release) → stand it up dark → health gate → swap (retag
  `current`, or flip the symlink) → restart enabled units → verify; on failure swap back
  to the retained `previous` and remember the failed target. The parked gate (no swap
  while motion-armed) carries over unchanged. This is the two-image workflow made literal:
  the robot always holds the last-good artifact, and rollback is one retag.
- Enablement flips to the new units, from the repo's enablement manifest.
- Then the plan's Phase D exactly as written: delete `robot/beast/ros2_ws` — the whole old
  tree, scripts, units — in a single commit. Deleted, not parked.

Done when: the plan's done-conditions 1–6 hold, and rollback from the new tree's first bad
deploy is one command that was exercised once on purpose.

## Rung 8 — Close out

Per the plan's Phase E: update `docs/beast-ops.md` Quick connect (dated), `docs/deploy.md`,
`README.md`, `AGENTS.md`'s parked-package list (obsolete after deletion); retire the
strip-down and vendored-surface plans; delete the executed plans including this one;
`append_activity` the cutover. **Plans die with their target code** (the rung-1 harvest
rule): every plan whose subject was deleted at rung 7 is deleted here, its hazards already
in the DB — an orphaned work order against code that no longer exists is doc drift waiting
to mislead the next agent. Two items specific to this ladder:

- Verify nothing robot-side references `coldaine-homelab` — that repo is frozen for
  demolition, and the Hangar app's deploy pin currently writes into it. The app-side pin
  needs a new home when `homelab-next` stands up; the robot must not be waiting on it.
- Record the robot's cluster dependency surface in `docs/deploy.md`: Hangar Postgres and CI
  runners, nothing else — the robot must keep driving with the cluster down.

## Sequencing and parallelism

Rung 0 gates everything. Rungs 2–4 start after rung 1 and can run concurrently (different
agents, no shared files beyond the briefing). Rung 5 needs 2+3; rung 4 can trail into 5's
window under the `beast_base` fallback. Rungs 5–7 are owner-supervised robot sessions.
Rung 6 can precede or follow 5 — it needs hardware access but not the old stack.

Naive agents are the right executors for rungs 2–4 precisely **because** of rung 1: the
clean-room design means they need the briefing and the gates, not the history. No agent on
rungs 2–4 needs to read the old tree; wanting to is the smell the plan exists to kill.
