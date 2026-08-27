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
| [BEAST-01 platform rebuild](2026-08-15-beast-platform-rebuild.md) | **Governing plan — clean-room rebuild, not a migration.** The repo is not the authority on the robot and nothing reports when it is wrong: enablement and 17 machine facts exist only on one NVMe, and 7 mechanisms were observed reporting success while failing. `robot/beast/ros2_ws` (51,361 lines, 13 scripts, 17 units) is **deleted**; the preserve list is one package (`beast_power`) plus extracted knowledge. Phases: extract → build clean offline → prove twice → cut over and delete. Retires the strip-down and vendored-surface plans, whose subject ceases to exist. | Not blocking. Phase A gates everything: nothing may enter the new tree that is not on the preserve list |
| [BEAST-01 Command Deck + sensor fusion](2026-07-31-beast-command-deck-plan.md) | Historical cockpit context. Its robot-side safety-spine work is superseded by the 2026-08-07 strip-down; the Hangar cockpit remains product scope. | Superseded for robot-side work |
| [BEAST ROS 2 strip-down](2026-08-07-beast-ros-drift-inventory-and-stripdown.md) | Remaining BEAST ROS 2 custom-drift strip after #174: Phase 1 extracted `beast_base` from the vendor `ugv_bringup.py` and removed `/ugv/watchdog_state` consumers (**done, #176**); Phase 2 deletes vizanti + `ugv_web_app` and reverts the 12 demo retargets; Phase 3 drift audit + robot ground truth, then the plan is deleted. | Phase 2 partial (H2 neutralized, not deleted); Phase 1 extraction done (#176) |
| [Finish the wiring model](2026-07-30-wiring-model-completion.md) | One spine, two eyes: The Board consumes `wiring.ts`, corpus extraction (schematics, firmware, photos, CAD), facts landed with zone citations, operator answers on screen. Merges the 2026-07-27 unification, extraction, and CAD plans. | Q1/Q2 safety-relevant (wrong 40-pin numbering puts 5 V into a Jetson UART pin); X1 gates drilling |
| [Continuous deploy — cockpit and robot](2026-08-14-continuous-deploy-both-surfaces.md) | Publishing an image never deployed it: both consumers poll a git-tracked pin in `coldaine-homelab` and nothing wrote them. Phase 1 (the CI writer) is implemented and armed with the org's existing `cold-claude-code` GitHub App; Phase 2 installs the BEAST-01 pull agent, with a parked gate, and is open. | Phase 2 gates robot auto-deploy |
| [BEAST NVMe storage — implementation](2026-07-11-beast-nvme-storage-implementation.md) | Command-level storage utility + systemd units under `robot/beast/ros2_ws`. **NOT APPLIED** — do not provision until `docs/beast-ops.md` says otherwise. The design decision is folded into `docs/beast-ops.md` (NVMe storage policy). | Parked behind the physical Orin host swap |
| [Cockpit teleop control law rewrite](2026-08-14-cockpit-teleop-control-law-rewrite.md) | Control law shipped on main via #215. Leftover: owner feel gate + close-out, plus the three untested exit paths in verification-surfaces (A8 / A10 / A11). Do not re-port. | Owner feel gate still open; A8/A10/A11 untested |
| [Cockpit ROS client — roslib convergence](2026-08-14-cockpit-ros-client-roslib-convergence.md) | Verdict: keep the custom browser client AND the dependency. rosbridge emits bare `NaN` (invalid JSON) so roslib's `JSON.parse` cannot read this robot's wire. Fixes the server bridge, which conflates decode errors with connection state. | **Blocks all Nav2 phases** — agent `stop()` can silently refuse to cancel a goal |
| [BEAST input paths + twist_mux rungs](2026-08-14-beast-input-paths-and-mux-rungs.md) | Browser Gamepad API onto `/cmd_vel_ui`; restore rung 150 (`joy` + `pygame` both missing); UI honesty fix for rungs that cannot have a publisher; and a real fix for `keyboard_ctrl`'s unhandled SIGHUP. | SIGHUP item is a live hazard on rung 100, which outranks the browser |
| [BEAST autonomy on-ramp](2026-08-14-beast-autonomy-on-ramp.md) | Phase 0 repairs `beast-slam.service` (no `time-sync.target` ordering on a robot with no RTC battery), then calibration, first real map, Nav2 bringup, `/goal_pose`, `explore_lite` un-park. | Phases 3–5 blocked on the roslib-convergence plan |
| [BEAST vendored surface + doc drift](2026-08-14-beast-vendor-parked-surface-and-doc-drift.md) | VERIFY PARKED `vizanti` and `ugv_web_app` (deleting them would violate the AGENTS.md park invariant); LEAVE PARKED `explore_lite`/`emcl2`; RESTORE `beast_base` to both build allowlists; 22 drift items, including stale "Ctrl+C stops via watchdog" claims. | **`beast_base` absent from both build scripts — a clean rebuild loses the boot stop** |
| [Verification surfaces (2026-08-14 set)](2026-08-14-verification-surfaces.md) | Reference, not a work order: the evidence tier each unit of the five plans below deserves, which tests exist vs. must be added, and which items CI would silently let you revert. Delete each section with its plan. | No — reference |

### Execution order for the 2026-08-14 set

Dependency-ordered, not priority-ordered. Each item's evidence lives in its own plan.

1. **`beast_base` build allowlist** (vendored-surface plan). One line. Until it lands, any
   `build_first.sh` provision yields a workspace where `beast-ros-base.service` fails and the
   unconditional startup stop never fires, on a robot whose ESP32 latches its last velocity.
2. **`/beast-paces` skill + command drift** (vendored-surface plan, D17/D18). The fail-closed
   watchdog gate sources a path that does not exist, so its verdict is correct only by accident.
   Stale commands manufacture false evidence — they outrank stale prose.
3. **Teleop feel gate + close-out** (teleop plan). The rewrite shipped in #215. Remaining:
   the owner feel gate and the three untested exit paths (verification-surfaces A8/A10/A11).
   If it does not feel right, it is not done regardless of test status.
4. **`keyboard_ctrl` SIGHUP** (input-paths plan). Live hazard today at rung 100.
5. **`ros-singleton` NaN repair** (roslib plan). Unblocks a trustworthy autonomous stop.
6. **Autonomy on-ramp** (autonomy plan). Phase 0 first; phases 3–5 gated on (5).

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
