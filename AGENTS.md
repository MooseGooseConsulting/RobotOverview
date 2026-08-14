# AGENTS.md

## Read this first: the facts are in Postgres, not in the repo

**`grep` cannot find this project's facts.** Specs, hardware detail, connector pinouts,
measured findings and prior research live in the Hangar database. The repo holds code,
tests and docs — and `src/data/hangar.ts` is a **CI fixture that is stale by design and
is the first thing `grep` hits**. Finding something plausible there is the failure mode,
not the success case.

So: **any time you are about to ask, assume, guess, estimate, or re-derive a fact about
the hardware, the robot, the inventory, or past work — run this first.**

```bash
doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts <term>
doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts --full <term>
```

Concrete triggers. If you catch yourself writing or thinking any of these, you owe a
`find.ts` call before the sentence leaves your mouth:

- "Can you tell me / send me / photograph / measure …?" — it is probably already recorded.
- "I'll assume the pack is …", "presumably 12 V", "typically these are …"
- "This isn't documented anywhere" / "we don't have a record of" — you have not checked yet.
- "What is the … rated at?" for any part, cable, connector, rail, or unit.
- Picking a threshold, abort floor, timeout, rate limit or tolerance for your own script
  or subagent. A number that gets compared against a sensor reading, or that gates an
  action on the robot, is a hardware claim — nobody has to have asked you a question.
- Starting research on a topic — check `briefings` and `insights` before redoing it.
- Reaching for `grep` to answer a *hardware* question rather than a *code* question.

It searches `assets` (including the `specs` JSON, where most hardware detail hides),
`terminals` (connectors, rails, voltages), `sockets`, `insights`, and `briefings`.
Only ask Patrick for something after `find.ts` comes back empty — and say where you
looked. Re-asking for recorded facts is the single most expensive mistake in this repo:
on 2026-08-07 an agent asked him to photograph a battery and a charger whose specs were
both already stored (`assets.stock-ups`, `terminals.ups-charge-in`).

A thin search is not evidence of absence. Keyword guesses only find what you thought to
guess, and the richest detail sits in briefing **prose**, not in `specs` — so search by
distinctive *value* (part numbers, brands, capacities: `NCR`, `mAh`, `2600`) as well as by
category word, and name the terms and tables you tried whenever you report absence. On
2026-08-14 an agent searched `assets` for "18650 / cell / battery", enumerated all 25
assets, and reported the cell model unrecorded; `NCR18650GA` was in the `artifact-intake`
briefing all along.

Insights are dated claims, not an index — they drift exactly like the docs do.
`ins-beast-pack-capacity-unknown` (2026-08-08) says the cell model and the full-charge
anchor are unrecorded; the model was already in a briefing, and the anchor has since been
measured (`ins-beast-full-charge-vmax-2026-08-14`). "X is unknown" is evidence about that
insight's `captured_at`, never about today — re-search before repeating it, and land a
superseding insight when it is wrong.

Two different questions, two different sources: the **DB** holds what the hardware
**is**; **SSH to the robot** tells you what it is **doing** (see "Robot ground truth").
Findings flow back the same way — see "Writing facts".

## What this repo is

The Hangar is Patrick's personal command center for his physical tech: inventory, wiki,
want list, and a live portal to the robots it tracks — styled as a base-builder game
(Next.js 16 / React 19 / Tailwind 4). Flagship unit: BEAST-01, a Waveshare UGV Beast.
**The UI is the product** — work that doesn't reach the screen isn't finished.

This is one monorepo with two independently deployed surfaces:

- Hangar web app: repository root (`src`, `db`, `public`), deployed through the cluster.
- BEAST-01 robot brain: `robot/beast/ros2_ws`, built on the Jetson with ROS 2 Humble.

Robot changes are made, reviewed, and merged here. Do not recreate a `Coldaine/ugv_ws`
fork or a second local clone. Never deploy the Hangar web app to the Jetson; sharing a
repository does not collapse the runtime safety boundary.

`robot/beast/ros2_ws` is a vendored fork of `waveshareteam/ugv_ws`. We own it; normal
delete/refactor rules apply. Before planning a vendor sync, run `find.ts subtree` —
lineage and last-measured merge distance are recorded there, and both age.

Do not delete a vendor package we don't run — **park** it: add a `COLCON_IGNORE` file to
its directory **and** remove its name from the allowlists in `build_common.sh` /
`build_first.sh` (colcon errors on a selected package it cannot discover). Re-enabling is
then one file deletion. Currently parked: `vizanti` (5 packages), `ugv_web_app`,
`explore_lite`, `emcl2`.

Start here: [`README.md`](README.md) — what this repo is and where everything lives.
Intent: [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md) — a statement of intent, nearly frozen.
Read it; do not edit it casually. Tactical state belongs in the owner docs below.
Working on UI? Follow [`docs/rich-ui.md`](docs/rich-ui.md) — enrich surfaces, never flatten.

## Content workflow

### Reading facts

`db/hangar/find.ts` — see "Read this first" at the top of this file. Do not skip it
because you are already mid-task; a wrong assumption laundered through three commits is
more expensive than one query.

### Handing facts to subagents

A brief is read as authoritative and then enforced against real hardware, so facts,
identities and numbers you pass *down* need the same sourcing bar as facts you tell
Patrick — a record id, or an explicit "invented, unverified" label. And the caveat travels
with the fact: `artifact-intake` deliberately records provenance limits beside its contents
("not confirmed to be BEAST-01's own chassis"; "preservation capture, not an approved BEAST
part"). Quoting the content while dropping the disclaimer converts a carefully hedged
record into a false assertion.

On 2026-08-14 one session did both in an afternoon. It handed a driving subagent a "hard
abort below 9.9 V" pack floor reasoned from nothing — the record says 8.368 V measured hard
cutoff with ~9.6 V recommended as the operational floor (`ins-beast-pack-cutoff-measured`;
`terminals.ups-rail-out` is 9–12.6 V) — and that invented number aborted a live navigation
test with ~1.3 V and ~12 measured minutes of reserve left. It then told a research subagent
the UPS is a Waveshare "UPS Power Module (C)", lifted from a directory name in
`artifact-intake` a few lines above the caveat calling that module a preservation capture,
not an installed part — and its 15–19 V input contradicts `terminals.ups-charge-in`
(DC5521, 12.6 V / 2 A).

### Writing facts

Facts and research persist to Postgres via `POST /api/hangar/ingest` (Bearer
`HANGAR_INGEST_TOKEN` from Doppler `homelab`/`dev`). A session that learns something
durable and writes it only to `docs/` or a commit message has not recorded it where the
app can surface it — land an `append_insight` too. **Never edit `src/data/hangar.ts`
or `src/data/datacore-corpus.ts` for live content** — they are CI fixtures and loud
offline fallbacks only (regenerate corpus with `npx tsx db/hangar/gen-datacore-corpus.ts`).
Types: `src/data/types.ts`. Schema/migrations: [`db/hangar/standup.md`](db/hangar/standup.md).
Deploy facts: [`docs/deploy.md`](docs/deploy.md).

```http
POST /api/hangar/ingest
Authorization: Bearer $HANGAR_INGEST_TOKEN
Content-Type: application/json

{ "op": "<verb>", "input": { … } }
```

Research packs/briefings render at `/datacore` from the `briefings` table (`body_markdown`
for all kinds). Fresh seed includes the corpus; the repo holds code, tests, plans, and
docs — never author research bodies as new markdown files.

### Op verbs

| Op | Input shape |
| --- | --- |
| `append_insight` | `{ id, title, body, confidence: "high"\|"medium"\|"low", source?, bay?, capturedAt?, units?, missions?, tags? }` |
| `append_activity` | `{ id, kind: "acquired"\|"price-drop"\|"shipped"\|"insight"\|"mission"\|"researched", text, at? }` |
| `patch_status` | `{ target: "unit"\|"item"\|"wishlist", id, status }` |
| `assign_loadout` | `{ hostAssetId, slot, assetId: string\|null }` |
| `link_insight` | `{ insightId, units?, missions? }` |
| `land_unit` | Strict full unit record (`id`, `name`, `bay`, `class`, `status`, `summary`, `specs`, …) |
| `land_item` | Strict full inventory item (`id`, `name`, `bay`, `category`, `status`, `summary`, `description`, `specs`, …) |
| `land_wishlist` | Strict full wishlist (`id`, `name`, `category`, `rationale`, `price`, `status`, …) |
| `land_mission` | Strict full mission (`id`, `code`, `name`, `status`, `objective`, `requisitionedUnits`, `requiredLoadout`, `wishlist`, `objectives`, `constraints`, …) |
| `land_document` | Strict full document (`id`, `title`, `kind`, `libraryPath`, `url?`, `units?`, `note?`) |
| `land_briefing` | `{ id, title, kind: "research"\|"plan", summary, tags?, aliases?, packId?, capturedAt?, href?, bodyMarkdown, repoPath? }` — **always** put the full markdown in `bodyMarkdown` (plans too); `repoPath` is provenance only; **never** write research markdown into the repo |
| `land_pack` | `{ id, title, code, summary, hubBriefingId?, topics: string[] }` |

Common path — `append_insight`:

```json
{
  "op": "append_insight",
  "input": {
    "id": "ins-beast-uart-5v-hazard",
    "title": "40-pin 5 V on UART pins will kill the Orin",
    "body": "Jetson Orin NX UART pins are 1.8 V. Do not land kit 5 V UART wiring on those pads.",
    "confidence": "high",
    "source": "Waveshare UGV Beast schematic + Jetson Orin NX pinmux",
    "bay": "robotics",
    "units": ["beast"],
    "tags": ["wiring", "safety", "orin"]
  }
}
```

`units` / `missions` must name existing entity ids or the API returns 409. The flagship
unit's id is `beast` (`BEAST-01` is its callsign, not its id); mission ids are short slugs
(`undercroft`, `perimeter-mapping`, `pool-deck-patrol`), not `MSN-*` codes.

### Errors

Agents must read the response and fix the payload — do not retry blind.

- **400** — Zod validation (`issues` lists field errors)
- **401 / 503** — auth (`Unauthorized` / `HANGAR_INGEST_TOKEN` not configured) or DB unavailable
- **404** — missing entity (named `id` / `insightId` in body)
- **409** — bad refs or invalid status (named ids in `missingUnits`, `missingMissions`, `missingAssets`, `allowed`, …)

## Robot ground truth — verify live, then trust docs

Hardware sessions happen outside this repo's loop, so `docs/beast-ops.md` **drifts** — on
2026-07-30 it claimed "no control surface" while the robot was running its full ROS stack.
Status claims in that doc are hypotheses, not facts. Before asserting anything about
BEAST-01's live state (what's running, what's connected, what's possible):

1. Reach the robot: `ssh beast-01-ts` (Tailscale, stable — prefer this; LAN IPs drift) or
   `ssh beast-01` (mDNS/Wi-Fi) — current paths, fallback state, and the Doppler credential
   map are in the **Quick connect** block at the top of `docs/beast-ops.md`.
2. Run the ground-truth check commands in that block; answer from their output.
3. If the robot is unreachable, say so and label doc-derived claims with their
   last-verified date — never present them as current.
4. Any session that learns a robot fact updates the Quick connect block (dated) before it
   ends. Deeper sections are history; the top block is the only "current state" surface.

## Where docs live

Update the owner doc, not wherever is convenient:

- intent/goals/anti-goals -> `docs/NORTH_STAR.md` (rare, deliberate changes only)
- repo structure ("where does X live") -> `README.md`
- verified deploy/runtime facts and gaps -> `docs/deploy.md`
- BEAST operating facts -> `docs/beast-ops.md` (current state only — history belongs elsewhere)
- completed Pi->Orin migration, reflash procedure -> `docs/beast-jetson-flash-runbook.md`
- BEAST ROS source, launch, service, and package docs -> `robot/beast/ros2_ws`
- data/backend shape, migrations, corpus + cutover status -> `db/hangar/standup.md`
- rich UI reasoning rubric -> `docs/rich-ui.md`
- agent/process rules -> this file

Keep dependent docs light: one-line summary plus link, never the same paragraph twice.
