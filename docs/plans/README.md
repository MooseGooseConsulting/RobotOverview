# Plans

Proposed work, written to be executed by an agent that was not present when the plan was written.
A plan here is a work order, not a record of reasoning: it names inputs, what to do, what to emit,
and how to tell when it is done. Executed plans are deleted, not archived — git history is the
archive. Research briefings are not plans; they live in the Datacore `briefings` table.

**Code is truth.** A plan describes intended work; it never governs. If a plan and the code
disagree, the code is right and the plan is stale.

## Live work orders

| Plan | What it covers | Blocking? |
| --- | --- | --- |
| [BEAST-01 Command Deck + sensor fusion](2026-07-31-beast-command-deck-plan.md) | Historical cockpit context. Its robot-side safety-spine work is superseded by the 2026-08-07 strip-down; the Hangar cockpit remains product scope. | Superseded for robot-side work |
| [BEAST ROS 2 strip-down](2026-08-07-beast-ros-drift-inventory-and-stripdown.md) | Remaining BEAST ROS 2 custom-drift strip after #174: Phase 1 extracts `beast_base` from the vendor `ugv_bringup.py` and removes `/ugv/watchdog_state` consumers; Phase 2 deletes vizanti + `ugv_web_app` and reverts the 12 demo retargets; Phase 3 drift audit + robot ground truth, then the plan is deleted. | Phase 2 partial (H2 neutralized, not deleted); Phase 1 extraction open |
| [Finish the wiring model](2026-07-30-wiring-model-completion.md) | One spine, two eyes: The Board consumes `wiring.ts`, corpus extraction (schematics, firmware, photos, CAD), facts landed with zone citations, operator answers on screen. Merges the 2026-07-27 unification, extraction, and CAD plans. | Q1/Q2 safety-relevant (wrong 40-pin numbering puts 5 V into a Jetson UART pin); X1 gates drilling |
| [Continuous deploy — cockpit and robot](2026-08-14-continuous-deploy-both-surfaces.md) | Publishing an image never deployed it: both consumers poll a git-tracked pin in `coldaine-homelab` and nothing wrote them. Phase 1 (the CI writer) is implemented and armed with the org's existing `cold-claude-code` GitHub App; Phase 2 installs the BEAST-01 pull agent, with a parked gate, and is open. | Phase 2 gates robot auto-deploy |
| [BEAST NVMe storage — implementation](2026-07-11-beast-nvme-storage-implementation.md) | Command-level storage utility + systemd units under `robot/beast/ros2_ws`. **NOT APPLIED** — do not provision until `docs/beast-ops.md` says otherwise. The design decision is folded into `docs/beast-ops.md` (NVMe storage policy). | Parked behind the physical Orin host swap |

## Related, outside this directory

- Datacore briefings `artifact-intake` / `beast-evidence-manifest` — identity index and
  evidence register for `keyArtifactstosort/` (formerly markdown registers; read in Datacore)
- Datacore briefing `beast-ros2-stack-review-2026-08-07` — BEAST-01 ROS 2 stack map and
  reuse review (formerly `robot/beast/ros2_ws/docs/ros2-stack-review-2026-08-07.md`; read in
  Datacore)
- `keyArtifactstosort/Artifacts/ros-driver/` — traced-connectivity extraction outputs
  (the executed work of the deleted enumeration plan; Phase 3 of the wiring plan lands it)
- `keyArtifactstosort/agents.md` — binaries-only retention for that tree
- Robot-control LLM research (RND-ROBOT-LLM) lives as a Datacore briefing in Postgres,
  not as repo markdown
