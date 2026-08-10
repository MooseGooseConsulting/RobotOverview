# Hardware Library

The source-of-truth CAD, schematics, datasheets, firmware, and captured wiki pages for the
UGV Beast — surfaced in-app as the **Hardware Library** tab of Datacore (`/datacore`), and the
place to look when you need the real board/mechanical reference while designing. The catalog is
data; the bytes live outside the repo. Verify against `src/` before relying on anything here.

## What it is

- **In-app surface:** `/datacore` → **Hardware Library** tab. Documents are grouped by subsystem
  (Driver Board, Power/UPS, Servos, Chassis CAD, Jetson Orin, Code/Firmware, Wiki). Each card
  links to a detail page `/datacore/<docId>`.
- **Interactive driver-board pinout explorer:** the driver-board schematic doc
  (`/datacore/doc-gdb-schematic`) embeds an animated board map — click a port to see what the
  Beast has slotted there. It reads the live `beast` loadout, mirroring the rover schematic.
- **Connected-twin evidence:** a document's detail page lists the wiring `nets[]` that cite it as
  proof, so a schematic is one click from the connections it explains.

## Where the data lives (catalog)

- **Records:** `src/data/hangar.ts` → `documents[]`, typed by `DocumentRef` in
  `src/data/types.ts` (`kind`: schematic | manual | cad | firmware | wiki | datasheet | image).
- **Stable key:** each record's `libraryPath` is a path under `beast/<NN-Subsystem>/…`.
  `hangar-integrity.test.ts` enforces the `beast/` prefix; the UI derives the
  subsystem grouping from the `<NN-Subsystem>` folder, so the numeric prefix sets the order.

## Where the bytes live (hosting)

The binaries are **not** in the repo or the container image.

- **Primary runtime store:** Garage bucket `hangar-library` (ClusterIP-only). Hangar proxies
  downloads at `GET /api/hangar/library/<key>` so browsers never talk to S3.
- **Open links:** `DATACORE_LIBRARY_URL=https://hangar.moosegoose.xyz/api/hangar/library`
  (server-side env on the Hangar Deployment; see `docs/deploy.md`).
- **Object keys:** `libraryPath` with the `beast/` prefix stripped
  (e.g. `05-Chassis-CAD/UGV_Beast_PT_AI_Kit_STEP.zip`).
- **Existence register:** `db/hangar/library-manifest.json` (SHA256, bytes, source, uploaded_at).
  Rebuild/upload with `doppler run --project homelab --config dev -- npx tsx db/hangar/upload-library.ts`
  against a Garage port-forward (`kubectl -n garage port-forward svc/garage 3900:3900`).
- **Off-cluster mirror (required durability):** N5 ZFS
  `/tank/dev-archive/hangar-library/` (layout matches object keys). Snapshot
  `tank/dev-archive@hangar-library-2026-08-10`. Garage-on-Longhorn is not independent DR.

- **Deliberately not `NEXT_PUBLIC_*`.** A `NEXT_PUBLIC_` var is string-inlined into the client
  bundle at `next build` time — the cluster could never set it after the image is built without a
  rebuild. `DATACORE_LIBRARY_URL` is instead read server-side at request time in
  `src/app/layout.tsx` (which is `force-dynamic`) and threaded through `HangarProvider` into the
  store as `libraryBaseUrl`, so the cluster can set/change it as an ordinary Deployment env var —
  no rebuild required.
- The app resolves a document to a URL at render time: `resolveDocumentUrl(doc, libraryBaseUrl)` in
  `src/lib/documents.ts` returns an explicit `url` if set, else `${libraryBaseUrl}/` + the
  library-relative key.
- **Offline-safe when unset:** when `DATACORE_LIBRARY_URL` is unset, the catalog stays fully
  browsable and open links show "library offline" — never a broken link. There is currently no
  reachability probe: if the var is set but the store is actually unreachable, "Open" still
  renders a link, which may 404/time out when clicked.

## Adding a document

1. Copy the file into the library store under the right subsystem folder, keeping the
   `<NN-Subsystem>/` layout.
2. Add a `DocumentRef` to `documents[]` in `src/data/hangar.ts` with a matching
   `libraryPath: 'beast/<NN-Subsystem>/<file>'`, its `kind`, and related `units`.
3. If the file proves a wiring connection, cite its id in the relevant `nets[]` entry.
4. Run `npm run test:run` (integrity) and `npm run typecheck`.

## Provenance

Per-file source URLs and SHA256 hashes are recorded in
`keyArtifactstosort/reference/EVIDENCE-MANIFEST.md` — the hash register that lives with the
artifacts themselves. Use it to check provenance.

## CAD archives (Garage + N5)

Catalog CAD rows and the non-catalog extras live in Garage `hangar-library` (and the N5 mirror).
Do **not** merge CAD binaries onto `main`. The former `data/hardware-cad-assets` LFS side-stash
was retired after Garage + N5 SHA256 proof on 2026-08-10.

| Object key | Contents | Trap |
| --- | --- | --- |
| `05-Chassis-CAD/UGV_Beast_PT_AI_Kit_STEP.zip` | Beast PT STEP geometry (catalog) | Local LFS filename was `…_step.zip` (lowercase) |
| `06-Jetson-Orin/UGV_Beast_PT_Jetson_Orin_3D.zip` | Beast Orin CAD (catalog) | Source filename uses a hyphen: `…Orin-3D.zip` |
| `extra/UGV_Beast_PT_AI_Kit_3D.zip` | **2D drawings** (despite the name) | — |
| `extra/UGV_Beast_PI4B_AI_Kit_step.zip` | Pi kit STEP | — |
| `extra/UGV_Beast_PI4B_AI_Kit_3D.zip` | **2D drawings** (despite the name) | Title block reads "UGV Beast PT" |
| `extra/UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | 2D drawings | **Rover, not Beast** |
| `extra/UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | STEP geometry | **Rover, not Beast** |

**Three naming traps, verified 2026-07-27 (still true):** `_3D.zip` archives contain 2D drawings
(3D geometry is in `_step` / `_STEP`); both "Rover … Orin" archives are Rover kits; the PI4B
`_3D.zip` title block says "PT". One archive uses non-ASCII internal paths (`尺寸图纸`) —
extract with explicit UTF-8 handling.

SHA-256 values for the uploaded set are in `db/hangar/library-manifest.json`. Historical intake
notes remain in `keyArtifactstosort/INTAKE-REGISTER.md` and the evidence register (Datacore
`beast-evidence-manifest` / `keyArtifactstosort/reference/EVIDENCE-MANIFEST.md` when present).

What the CAD is *for* (mounting holes, mast planning, URDF, twin geometry) is tracked as work in
[`docs/plans/2026-07-30-wiring-model-completion.md`](./plans/2026-07-30-wiring-model-completion.md).
