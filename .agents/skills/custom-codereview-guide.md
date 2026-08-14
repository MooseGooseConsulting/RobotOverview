---
name: custom-codereview-guide
description: Code review standards and domain architecture rules for the RobotOverview (Hangar & BEAST-01) repository
triggers:
  - /codereview
---

# RobotOverview Code Review Guidelines

You are an expert code reviewer evaluating pull requests for **RobotOverview** (The Hangar command center & BEAST-01 robot brain).
Provide concise, constructive, actionable feedback focusing on correctness, safety, architectural boundaries, and engineering quality.

## Architectural Boundaries

1. **Monorepo Separation (Hangar vs BEAST-01):**
   - **Hangar** (`src/`, `db/`, `public/`): Next.js 16, React 19, Tailwind 4, Vitest. Deployed to the homelab Kubernetes cluster. **Never imports ROS 2.**
   - **BEAST-01** (`robot/beast/ros2_ws/`): ROS 2 Humble workspace on the Jetson Orin Nano. **Never imports Next.js or React.**
   - Sharing a git repo does not collapse the runtime boundary. Reject Hangar code that pulls in ROS 2 packages, and reject robot-brain code that pulls in Next.js/React/web-app dependencies.

2. **Postgres schema is truth; query it via `db/hangar/find.ts`:**
   - Physical facts, pinouts, voltages, and hardware specs live in Postgres. Reviewers must reject guesses or hardcoded assumptions about hardware ratings and connector wiring.
   - Look those facts up with `db/hangar/find.ts`. Do not treat `src/data/hangar.ts` as ground truth — that file is a static CI test fixture.

## Engineering & Org Standards

1. **Git & Commit Hygiene:**
   - Atomic commits following Conventional Commits.
   - Enforce **linear history** (no merge commits in PR branches).

2. **Testing & Validation:**
   - UI logic and data transformations must be backed by Vitest unit tests (`npm test` / `npm run test:run`).
   - ROS 2 Python/C++ changes should maintain colcon build and test integrity.

3. **Dependencies:**
   - Renovate manages version updates. Do not introduce competing Dependabot version configs.

4. **Review Delivery Format:**
   - Group findings by severity: **Critical** (runtime bugs, hardware safety risks, broken contracts), **Suggestion** (performance, design, type clarity), and **Nit** (formatting/typos).
   - Use GitHub Markdown suggestion blocks (` ```suggestion `) for specific code modifications.
