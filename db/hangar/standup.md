---
title: Hangar DB — Master Inventory Standup
date: 2026-06-26
author: Patrick MacLyman
status: living
last_confirmed: 2026-07-31
---

# Hangar DB — Postgres-first standup

The relational backend for the Hangar: one master inventory of all gear, a claims graph
for research, and the connected model (North Star AG1).

## Corpus model

- **Claims graph.** Insights carry confidence, provenance, and source; assets/missions
  carry lifecycle statuses; research longform lives in `briefings` / `briefing_packs`
  (markdown in `body_markdown`, not in the repo).
- **Two-tier retention.** Structured facts and research bodies are DB rows. Vendor
  binaries stay in `keyArtifactstosort/` (binaries-only; awaiting Garage) —
  see `keyArtifactstosort/agents.md`.

## Status

**Normalized cutover LIVE (verified 2026-07-31):**

- UI read path reconstructs HangarData from normalized tables
  (`getHangarSpine` → `buildHangarDataFromDb`). Loud static fallback when Postgres is
  missing or errors.
- Agents write via op-verb ingest (`POST /api/hangar/ingest`) — see [`AGENTS.md`](../../AGENTS.md).
- Datacore packs/briefings render from the `briefings` table. Fresh `seed.sql` includes the
  full research corpus (12 briefings + packs with `body_markdown`). Offline serves
  `src/data/datacore-corpus.ts` under a loud **DATACORE OFFLINE** banner — never an empty wall.
- Plan briefings store bodies in Postgres too (`repo_path` is provenance only).
- `content_snapshots` is dropped by `migrations/2026-07-31-drop-content-snapshots.sql`
  (supersedes `2026-07-30-content-snapshots.sql`).

## Where it lives

Logical `hangar` database on CloudNativePG `pg18-core` (`data-platform`), provisioned in
`coldaine-homelab`. Role **`hangar` owns all tables**. App credentials (`HANGAR_DB_*`,
`HANGAR_INGEST_TOKEN`) via ExternalSecret / Doppler `homelab`/`dev`.

On `icarus-laptop`, do not start local containers. Use the cluster DB (LAN
`pg18-core-rw-lan` / `192.168.30.205`) with Doppler injection.

## Files

- `find.ts` — **search the live DB from the CLI** (assets, terminals, sockets,
  documents, nets, activity, missions, capabilities, wishlist, insights,
  briefings). `doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts <term>`.
  Use this before asking anyone for a hardware spec; `grep` only finds the CI fixtures.
  `FIND_SURFACES` / `FIND_SURFACE_SKIP` are the coverage contract — a new
  `CREATE TABLE` must land in one of them.
- `schema.sql` — full rebuild DDL for normalized inventory tables.
- `migrations/` — additive live migrations, including
  `2026-07-31-hangar-corpus.sql` (corpus tables),
  `2026-07-31-briefings-body-required.sql` (all kinds require `body_markdown`), and
  `2026-07-31-drop-content-snapshots.sql` (drop legacy snapshot table).
- `research-corpus-registry.ts` / `gen-datacore-corpus.ts` — refresh
  `src/data/datacore-corpus.ts` (offline fixture + seed source for bodies).
- `gen-seed.ts` / `seed.sql` — hangar spine **and** Datacore corpus (CI / fresh-DB bootstrap).
- `ingest-research-corpus.ts` — repair / re-land corpus on a live DB that already has the spine.
  Run: `npx tsx db/hangar/ingest-research-corpus.ts` with `HANGAR_DB_*`. Not required for
  first paint after a full seed apply.

## App read / write path

- **Read (spine):** reconstruct from normalized tables; static fixture only on fallback.
- **Read (Datacore):** `briefings` / `briefing_packs` via `src/server/hangar/briefings.ts`;
  static corpus fixture on DB failure (loud banner).
- **Write:** op-verb ingest ([`AGENTS.md`](../../AGENTS.md)).
- **Preflight:** `GET /api/hangar/preflight`.

## Rebuild from scratch

```bash
# 1. Base schema
psql … -f db/hangar/schema.sql

# 2. Apply migrations (corpus + body-required + drop snapshot, in date order)
psql … -f db/hangar/migrations/2026-07-31-hangar-corpus.sql
psql … -f db/hangar/migrations/2026-07-31-briefings-body-required.sql
psql … -f db/hangar/migrations/2026-07-31-drop-content-snapshots.sql
# (plus any earlier additive migrations not already folded into schema.sql)

# 3. Refresh corpus fixture (when research bodies change), then seed
npx tsx db/hangar/gen-datacore-corpus.ts
npx tsx db/hangar/gen-seed.ts --out db/hangar/seed.sql
psql … -f db/hangar/seed.sql
# Datacore is full after this step — no separate corpus ritual required.
```

For live DBs with data, prefer additive migrations + `ingest-research-corpus.ts` — do not casually wipe.
