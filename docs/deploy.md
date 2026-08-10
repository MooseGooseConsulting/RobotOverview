---
title: Deployment — verified facts
last_verified: 2026-08-10
---

# Deployment — verified facts

The Hangar cluster facts below were verified against `admin@homelab-target` and
`coldaine-homelab` on 2026-07-31 (LAN Gateway + Postgres canaries). The separate cockpit section
is a repository/deployment inventory, not a claim that the robot runtime was probed. Normalized
cutover includes reconstruction read path, op-verb ingest, and Datacore briefings in DB with
bodies. When this page and reality disagree, reality wins — check the named live surface before
building on anything here.

**This repo** owns the Hangar app code, `Dockerfile`, and content tooling.
**[`coldaine-homelab`](https://github.com/Coldaine/coldaine-homelab)** owns runtime
manifests, secrets (via Doppler/ESO), Gateway listeners, and Flux reconciliation.

## What runs today

- **Workload:** Deployment `hangar` in namespace `hangar` (Flux `target-apps` →
  `infra/k8s/apps/hangar/`). Image is **digest-pinned** since 2026-07-31
  ([coldaine-homelab PR #285](https://github.com/Coldaine/coldaine-homelab/pull/285)):
  `ghcr.io/coldaine/robot-overview@sha256:177180e6…` (the PR #134 build, verified against
  the running pod) with `imagePullPolicy: IfNotPresent`. `:latest` + `Always` is retired.
- **Database:** Logical DB `hangar` on CloudNativePG `pg18-core` (`data-platform`).
  App env from Secret `hangar-runtime-secrets` (`HANGAR_DB_*`, `HANGAR_INGEST_TOKEN`,
  `DATACORE_LIBRARY_URL`, `HANGAR_LIBRARY_*`).
  Readiness probe is `GET /api/hangar/preflight` — a Ready pod means Postgres is reachable.
- **Hardware library:** Garage bucket `hangar-library` (platform bootstrap + Hangar ESO keys).
  Hangar serves `GET /api/hangar/library/…` (path-style S3 GET, ClusterIP Garage only).
  Catalog Open links use `DATACORE_LIBRARY_URL=https://hangar.moosegoose.xyz/api/hangar/library`.
  Existence register: `db/hangar/library-manifest.json` (16/16 catalog keys as of 2026-08-10).
  Off-cluster mirror: N5 `/tank/dev-archive/hangar-library/` snapshot
  `@hangar-library-2026-08-10` (SHA256 spot-checked vs Garage for CAD + schematic).
- **UI spine:** Reconstructs HangarData from normalized tables at request time
  (`getHangarSpine` → `buildHangarDataFromDb`). Agents write via op-verb
  `POST /api/hangar/ingest` (Bearer `HANGAR_INGEST_TOKEN`) — verb table in
  [`AGENTS.md`](../AGENTS.md). Static `hangar.ts` is the offline/fixture fallback only
  (loudly indicated in the Shell when used).
- **Datacore:** Packs/briefings read from the `briefings` table (seed includes the full
  research corpus). Verified live: 12 briefings with non-empty `body_markdown`, including
  plan kinds. When Postgres is unavailable, the app serves `src/data/datacore-corpus.ts`
  under a **DATACORE OFFLINE** banner (content + loud state — not an empty wall).
- **Build:** GitHub Actions (`.github/workflows/image.yml`) builds and publishes to GHCR
  on `main` (and PR proof tags). Shipwright is installed on the cluster but is not the
  Hangar image path today.
- **Route:** HTTPRoute `hangar` → hostname `hangar.moosegoose.xyz` on Gateway
  `platform-gateway` listener `https-hangar` (TLS via cert-manager DNS-01). LAN path:
  Gateway VIP `192.168.30.201` (verify with
  `curl --resolve hangar.moosegoose.xyz:443:192.168.30.201 https://hangar.moosegoose.xyz/api/hangar/preflight`).
  Public Cloudflare tunnel ingress is dashboard-managed; confirm the hostname still points
  at the platform Gateway if WAN access times out.
  If the hostname times out on LAN, suspect a stale UDM **Local DNS Record** first (on
  2026-07-31 one pointed at dead `192.168.30.200`; fixed to `.201` same day and verified),
  not Cloudflare — the tunnel is egress-only for one hostname.

## Cockpit deployment state

- **Hangar transport (defaulted):** `BEAST_COCKPIT_WS_URL` defaults to
  `wss://beast-01.tyrannosaurus-magellanic.ts.net/` in `src/lib/beast-constants.ts`; the env var
  is an override, not a requirement. The `/cockpit` and `/agent` routes serialize it into client
  props. This avoids build-time inlining but is **not a secret or an authentication boundary**;
  browser users can inspect it. The actual access control is (a) tailnet reachability — the
  `wss://` endpoint only resolves and only accepts connections from inside the tailnet — and
  (b) the robot-side rosbridge topic glob whitelist, which bounds what a connected client may
  publish. **Treat the URL as public and the tailnet as the perimeter.** If the robot is offline,
  the Cockpit shows a loud disconnected state.
- **Robot-side service (live):** `beast-cockpit.service` is enabled and active on BEAST-01
  (verified 2026-08-03); the loopback-only rosbridge binds `127.0.0.1:9090`, and Tailscale Serve
  fronts it as `wss://beast-01.tyrannosaurus-magellanic.ts.net/` on the tailnet only.
  `COCKPIT_ALLOWED_ORIGINS` is **unset**, so the bridge accepts any browser origin (tailnet is
  the perimeter); set it in `/etc/beast/ugv.env` only if origins should be restricted.

## Shipping a change

1. Merge app code to `RobotOverview` `main` → GHA publishes a new GHCR image.
2. Bump the `@sha256:` image ref in `coldaine-homelab/infra/k8s/apps/hangar/deployment.yaml`
   to the new build's digest and merge — Flux (`target-apps`, 10 min interval) reconciles and
   rolls the Deployment. Merging code alone deploys nothing.
3. Verify: `GET https://hangar.moosegoose.xyz/api/hangar/preflight` and Shell DATA lamp = PG.

## Agent ingest

Op-verb API (`{ "op", "input" }`); auth, shapes, and errors in [`AGENTS.md`](../AGENTS.md).
Token: Doppler `homelab`/`dev` → `HANGAR_INGEST_TOKEN`.

## Fresh-environment bootstrap

See also [`db/hangar/standup.md`](../db/hangar/standup.md).

```bash
# schema + migrations (paths in standup.md)
psql … -f db/hangar/schema.sql
# then apply db/hangar/migrations/* in date order (see standup.md)

# Corpus fixture (when research bodies change) → seed → apply
npx tsx db/hangar/gen-datacore-corpus.ts
npx tsx db/hangar/gen-seed.ts --out db/hangar/seed.sql
psql … -f db/hangar/seed.sql
# Datacore is full after seed — ingest-research-corpus.ts is repair/re-land only.
```

## Known gaps

- The pinned digest lags `main` until the next deliberate digest bump in
  `coldaine-homelab/infra/k8s/apps/hangar/deployment.yaml` (step 2 above). The library proxy
  ships only after that bump rolls the Hangar image.
- Wiki catalog objects are fresh 2026-08-10 HTML captures (hashes unset in the upload source
  map); the 2026-07-01 `.md` snapshots from UGV-Beast-Archive are gone.
- Shipwright `Build` for Hangar is optional future work; not required for production today.
