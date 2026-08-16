# Derived extractions — ROS Driver for Robots

Staging home for **derived** work products (not vendor re-downloads). Do not put
re-downloadable vendor zips here — those stay under `../reference/` and are gitignored
as `reference/*.zip`.

Source schematic (authoritative PDF):
`../RasperryPIversionofROS_Driver_for_Robots.pdf`
(byte-identical to `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`).

## Active: `ros-driver/current/`

**`ros_driver_traced_connectivity_v1`** — path-trace revision 1 (108 edges). This is the
authority for board connectivity and supply topology. Use it for wiring questions.

| File | Notes |
|---|---|
| `ros_driver_traced_connectivity_v1.zip` | Archive copy |
| `ros_driver_traced_connectivity_v1/ros_driver_traced_connectivity_v1.md` | Narrative + supply topology |
| `ros_driver_traced_connectivity_v1/ros_driver_path_edges.csv` | Edge table |
| `ros_driver_traced_connectivity_v1/ros_driver_traced_graph.json` | Graph form |
| `ros_driver_traced_connectivity_v1/ros_driver_source_load_matrix.csv` | Source / load matrix |

## Superseded: `ros-driver/superseded/`

**`ros_driver_complete_extraction`** — earlier logical/inventory dump (BOM, pin→net, EDIF).
Kept for persistence only (`../agents.md`: do not delete). Not promoted into Hangar inventory
or any parts catalog. Do not prefer it over traced for electrical claims.

## Other files in this folder

| File | Notes |
|---|---|
| `Screenshot 2026-07-27 111058.png` | Not part of either zip. Opened and described 2026-08-06 — see below |

### `Screenshot 2026-07-27 111058.png` — contents

1156×641 PNG, 875,655 B. A **photographic** top-down frame (not a render) looking into the
opened battery compartment of a tracked UGV chassis, tracks left and right, plain grey backdrop.
Visible and legible:

- **Three 18650 cells**, green wrap, silkscreen `NCR18650GA` — Panasonic/Sanyo 3.4 Ah nominal.
  They sit in a holder, not a sealed pack.
- **A gearmotor** at left with the Waveshare label `DGGM-3865-12V-EN` and rating **`DC 12V 240rpm`**.
- A small PCB edge-on between the cells and the motor, plus red/black/white lead pairs routed to
  the compartment wall.

This is the only image in `keyArtifactstosort/` showing real assembled hardware rather than a
vendor render or a web-page capture — the intake register's "none of these is a photograph"
line scopes to the twelve **root-level** images, not to this file.

**Owner-confirmed BEAST-01 bay (2026-08-14).** The wrap SKU is Panasonic/Sanyo `NCR18650GA`
(3.6 V, 3.4 Ah nominal), three cells in the Waveshare UPS Module 3S holder (`stock-ups`).
This is not UPS Power Module (C). Do not treat an earlier "provenance unstated" hedge as
current — that line was an agent disclaimer, not an owner fact.

## `../tmp/pdfs/ros-driver-1.png`

1684×1190 PNG, 348,460 B. A raster of **page 1 of the ROS Driver for Robots schematic** —
the same single page as `../RasperryPIversionofROS_Driver_for_Robots.pdf`, rendered to bitmap.
All nine schematic blocks are legible (`10DOF` / `IIC` / `USB to UART` / `IO Control` /
`PWR-IN` + `5V-5A` / `Power` / `Type_C` / `ESP-32UE` / `MicroSD` / `Motor` / bus-servo control).
It is an unannotated intermediate of `public/datacore/beast-schematic-annotated.png`, which is
the same page with the four numbered study regions overlaid. **Derived and reproducible from
the PDF — not a source artifact**; `tmp/` is a scratch path and nothing should cite it. Prefer
the PDF, or the annotated PNG for narrative use.
