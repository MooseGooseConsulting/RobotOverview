---
title: Deployment — verified facts
last_verified: 2026-08-14
---

# Deployment — verified facts

The Hangar cluster facts below were verified against `admin@homelab-target` and
`coldaine-homelab` on 2026-07-31 (LAN Gateway + Postgres canaries). The separate cockpit section
is a repository/deployment inventory, not a claim that the robot runtime was probed. Normalized
cutover includes reconstruction read path, op-verb ingest, and Datacore briefings in DB with
bodies. When this page and reality disagree, reality wins — check the named live surface before
building on anything here.

**This repo** owns the Hangar app code, `Dockerfile`, and content tooling.
**[`coldaine-homelab`](https://github.com/MooseGooseConsulting/coldaine-homelab)** owns runtime
manifests, secrets (via Doppler/ESO), Gateway listeners, and Flux reconciliation.

## What runs today

- **Workload:** Deployment `hangar` in namespace `hangar` (Flux `target-apps` →
  `infra/k8s/apps/hangar/`, GitRepository 1 min + Kustomization 10 min, `prune: true`).
  Image is **digest-pinned** since 2026-07-31
  ([coldaine-homelab PR #285](https://github.com/MooseGooseConsulting/coldaine-homelab/pull/285)):
  `ghcr.io/moosegooseconsulting/robot-overview@sha256:999186404f…` (main `5375738`, #218 —
  verified in-cluster 2026-08-14) with `imagePullPolicy: IfNotPresent`.
  Until 2026-08-14 this pin was hand-edited and had gone stale at `7481575` (#199),
  **37 commits behind main**, because nothing wrote it. That is the gap `deploy-pin.yml` closes.
  `:latest` + `Always` is retired and must not come back: it does not auto-deploy either.
  `IfNotPresent` never re-pulls, and `Always` only re-pulls **when a pod starts** — nothing
  starts one on an image push. Only a spec change rolls a Deployment.
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
  on `main` (and PR proof tags). `.github/workflows/deploy-pin.yml` then writes the digest
  into `coldaine-homelab` — see "Shipping a change". Shipwright is installed on the cluster
  but is not the Hangar image path today.
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

Merge app code to `RobotOverview` `main`. That is the whole procedure.

`.github/workflows/deploy-pin.yml` runs after the image build succeeds, refuses to pin a
commit whose test workflows failed, resolves the published manifest digest from GHCR, and
commits it to `coldaine-homelab/infra/k8s/apps/hangar/deployment.yaml`. Flux reconciles
within ~11 minutes (GitRepository 1 min + Kustomization 10 min) and rolls the Deployment.

- **Verify:** `GET https://hangar.moosegoose.xyz/api/hangar/preflight` and Shell DATA lamp = PG.
  The workflow's job summary prints the digest it pinned and where to look.
- **Roll back:** revert the pin commit in `coldaine-homelab`. This is the property digest
  pinning bought and `:latest` gives away.
- **Re-pin by hand:** `workflow_dispatch` on **Pin deployed image** with `surface: hangar` and
  an explicit `sha` — the way to redeploy an older known-good commit. An automatic pin only ever
  moves production to whatever `main` is *now*, so re-running an old build cannot roll it back.
- **Credential:** no PAT and no deploy key (deploy keys are disabled on `coldaine-homelab`).
  The workflow mints a GitHub App installation token from the org's existing `cold-claude-code`
  app, scoped to `coldaine-homelab` alone with Contents: write, expiring with the job. The app id
  and private key are mirrored from Doppler `homelab`/`dev` (`CLAUDE_GITHUB_APP_ID`,
  `CLAUDE_GITHUB_PRIVATE_KEY`) into the `HOMELAB_DEPLOY_APP_ID` /
  `HOMELAB_DEPLOY_APP_PRIVATE_KEY` repository secrets.

The writer is `tools/ci/pin_deploy_image.py`. It is deliberately strict: every edit is anchored
on a pattern that must match exactly once, and it fails loudly rather than leaving the file
untouched, because a silent no-op reads as a successful deploy while nothing ships. If it
starts failing, the manifest changed shape — fix the anchor, do not bypass it.

Full reasoning, including why Flux image automation was rejected and what the robot still
needs: [`docs/plans/2026-08-14-continuous-deploy-both-surfaces.md`](plans/2026-08-14-continuous-deploy-both-surfaces.md).

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

- **The robot's auto-deploy is proven but awaits one owner action to arm.** The
  source-mode agent (`robot/beast/ros2_ws/deploy/bin/beast-pull` + hourly timer,
  following `refs/deploy/beast-01`, advanced by `deploy-pin.yml`'s `deploy-ref`
  job after the test gate) passed its full supervised rollout on 2026-08-14:
  watched first swap (verify 15/15), forced-rollback proof (broken commit →
  rollback → verified → failed-target remembered), and parked-gate proof
  (commanded `/cmd_vel` while disarmed → deploy skipped, journal-verified
  motion-free). Remaining step **R5, owner-only**: reinstall
  `/etc/sudoers.d/beast-ops` from the tree (`deploy/bin/install-beast-sudoers.sh`),
  `systemctl enable --now beast-pull.timer`, and remove
  `/data/beast/deploy/pull-hold` — details in `docs/beast-ops.md` Quick connect.
  Until then a merge reaches the robot only via a supervised manual tick.
  The homelab `deployments/beast-01/manifest.yaml` pin is provenance only — the
  robot deploys from source and reads neither the manifest nor the GHCR image.
- Wiki catalog objects are fresh 2026-08-10 HTML captures (hashes unset in the upload source
  map); the 2026-07-01 `.md` snapshots from UGV-Beast-Archive are gone.
- Shipwright `Build` for Hangar is optional future work; not required for production today.
