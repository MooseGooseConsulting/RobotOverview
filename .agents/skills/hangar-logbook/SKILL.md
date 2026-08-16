---
name: hangar-logbook
description: Record durable Hangar mission, Beast operations, inventory, research, and repository updates. Use when preserving what happened in RobotOverview, adding mission after-action notes, recording field insights, adding activity-ticker events, updating Beast runbook facts, or deciding which Hangar surface should hold a durable update.
---

# Hangar Logbook

Turn session work into durable Hangar memory without confusing the delivery mechanism
with the product model.

## Core Rules

- Pick a short uppercase codename before drafting the entry, e.g. `OP-BEAST-CONTACT`,
  `MSN-UNDERCROFT-DRYRUN`, `INTK-BEAST-KIT`, `RND-WIFI-TAIL`, or `REP-DOC-GUARDRAILS`.
- Draft one coherent human record first; map it to storage surfaces after the record makes sense.
- Persist to existing Hangar surfaces. Do not invent a new log file unless the user asks.
- Omit secrets, passwords, tokens, private keys, and raw credential material.
- Record teleop, navigation, and autonomous / policy runs the same way — omit secrets, keep
  fail-safe facts in the runbook when they change.
- Include next steps only when they exist, and persist them instead of leaving them only in chat.

## Current Persistence

Live facts go through `POST /api/hangar/ingest` (`AGENTS.md` op verbs), not
`src/data/hangar.ts`. That file is a stale CI fixture. Query live Hangar rows with
`doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts <term>`
before asserting hardware or inventory, and before asking Patrick.

- `src/data/types.ts` defines the TypeScript shape.
- `db/hangar/schema.sql`, `db/hangar/standup.md` own schema and migrations.
- `src/data/hangar.ts` / `src/data/datacore-corpus.ts` are CI fixtures and loud
  offline fallbacks only. Never edit them for live content.

Postgres homes for the logbook lanes: `insights`, `activity_log`, and
`mission_after_actions`. Land durable writes with ingest (`append_insight`,
`append_activity`, mission after-actions on `land_mission` / the mission record).
Do not regenerate seed from a fixture edit.

## Storage Router

Use the narrowest durable home that fits:

- `missions[].afterAction`: mission-scoped debrief bullets and next mission steps. Rendered on
  mission detail pages as the after-action log.
- `insights[]`: durable field knowledge, decisions, gotchas, and research lessons. Rendered in
  **Datacore** (`/datacore`) and linkable to units and missions. Long-form research briefs live
  under `/datacore/...` (see `src/data/datacore-briefings.ts`).
- `activity[]`: one-line global timeline events for the command-center ticker.
- `docs/beast-ops.md`: BEAST network, endpoints, control protocol, telemetry, video recovery,
  safety, and operating procedure.
- `docs/NORTH_STAR.md`: only intent, goals, anti-goals, or product philosophy changes.
- `docs/deploy.md`: only verified deployment/runtime facts and gaps.
- `db/hangar/standup.md`: only data/backend shape, seed, migrations, and read-cutover status.
- `AGENTS.md`: only agent operating rules and command/workflow routing.

Do not use `docs/history/` as guidance. It is evidence only after checking current code, manifests,
or live state.

## Draft Shape

Draft this shape before editing files:

```markdown
## <CODENAME>
<Human Title>

Date: YYYY-MM-DD
Kind: beast-mission-update | mission-aar | inventory-update | research-update | repo-update
Unit: <unit id, callsign, or none>
Mission Links: <mission ids or none>
Status: planned | completed | completed-with-followups | blocked

### Signal
One tight paragraph with the important change.

### Timeline
- Factual sequence of the work.

### Outcome
- Current state after the work.

### Evidence
- Commands, endpoints, tests, screenshots, device readings, PRs, or observations that prove it.

### Lessons Learned
- Durable lessons or gotchas useful outside the original chat.

### Next Steps
- Required or optional follow-up, only when follow-up exists.

### Persistence Map
- Mission after-action:
- Insight:
- Activity:
- Runbook/docs:
```

## Apply The Entry

1. Query Hangar (`find.ts`) and inspect `src/data/types.ts`, the relevant app page,
   and any owner doc before writing. Do not treat `src/data/hangar.ts` as live.
2. Add or update only the surfaces needed by the draft, via ingest for live facts.
3. Preserve existing ID and ordering style. Use stable lowercase IDs for new records.
4. Never edit `src/data/hangar.ts` or `src/data/datacore-corpus.ts` for live content.
5. Run focused validation:
   - `npm run lint`
   - `npm run test:run` or focused tests touching the changed data/surface
   - `npm run build` when UI, routing, or generated data changed materially
6. Report exactly where the entry landed: mission id and after-action bullet, insight id,
   activity id, runbook/doc section, next-step location, commit hash, and PR link.

## Ask Before Editing

Ask for a quick user check before editing when the entry changes mission status or objectives,
introduces a new mission, records sensitive network/access facts, or the right home is ambiguous
between mission after-action, insight, activity, and runbook.
