# BEAST-01 autonomy on-ramp — from teleop to navigating a space (Phases 0–5)

Status: **Not started.** Written 2026-08-14 from a read-only live session on BEAST-01
(`ssh beast-01-ts`) plus a Hangar DB sweep. Nothing below has been executed. The session
that wrote this started no service, published to no `cmd_vel` or goal topic, and caused no
motion; **every phase step that moves the robot is written as owner-supervised** and says so.

This is a **work order**, not a record of reasoning: it names inputs, exact changes, what to
emit, and how to tell when each phase is done. **Code is truth** — if this document and the
code disagree, the code is right and this document is stale; update it, don't preserve it.

Scope: the path from "teleop only" to "autonomously navigates a space." Out of scope:
cockpit input surfaces in general (another agent owns those; Phase 4 is deliberately the
thinnest thing that puts a destination on the wire), the storage stack, and the BEAST ROS 2
strip-down (see [2026-08-07](2026-08-07-beast-ros-drift-inventory-and-stripdown.md)).

## 0. Where this actually starts

The full Nav2 stack, `slam_toolbox`, `explore_lite` and four tuned controller param sets are
already installed and vendored. `beast-slam.service` already exists, already persists a
posegraph, already guards against the map explosion that happened on 2026-08-13. None of it
runs. **This is not a build-it plan; it is a switch-it-on-in-the-right-order plan**, and the
order is set by two things the live check found, one thing the code says that contradicts the
premise this plan was commissioned under (§2), and one defect owned by another plan that gates
everything autonomous (§4).

## 1. Live ground truth — 2026-08-14, read-only

Verified this session over SSH. Re-verify before building on any of it (`docs/beast-ops.md`
drifts; this section will too).

**Running** (`ros2 node list`): `LDLiDAR_LD19`, `beast_base`, `beast_power`,
`beast_power_logger`, `ekf_filter_node`, `odom_publisher`, `rf2o_laser_odometry`,
`robot_state_publisher`, `twist_mux`, `rosbridge_websocket`, `oak` / `oak_container`,
`depth_colorizer`, `overhead_clearance`, `cockpit_status`, `controller_manager`,
`joint_state_broadcaster`, `pt_joint_position_controller`. `allow_motion` is true.

**Not running:** no Nav2 node of any kind. No `/map` topic, no `map→odom` TF. Topic list
carries `/cmd_vel_nav` (the mux rung) but nothing publishes it.

**`beast-slam.service` is `enabled` and `inactive` — and it *crashed at the last boot*.**
`journalctl -u beast-slam.service -b` shows the posegraph deserializing cleanly
(`Load From File /data/beast/maps/beast-map.posegraph` … `**Finished serializing Dataset**`,
`Registering sensor: [Custom Described Lidar]`), then:

```
Dec 31 18:01:31 … [async_slam_toolbox_node-1] Registering sensor: [Custom Described Lidar]
Dec 31 18:00:34 … systemd[1]: Started BEAST-01 slam_toolbox online_async (persistent 2D map).
Aug 14 00:50:50 … terminate called after throwing an instance of 'karto::Exception'
Aug 14 00:50:54 … process has died [pid 1967, exit code -6, …]
```

The `Dec 31 18:0x` stamps and the launch log directory `1969-12-31-18-00-36-…` are the tell:
**it started pre-NTP and aborted on the clock jump.** `systemctl show beast-slam.service -p
After` returns `-.mount sysinit.target basic.target systemd-journald.socket
network-online.target system.slice beast-ros-base.service` — **no `time-sync.target`**.
The Hangar already holds this exact lesson (`ins-beast-rtc-outage-2026-08-10`): the Orin has
no RTC battery, cold boot starts at epoch 0, and the fix pattern
(`tailscaled.service.d/time-sync.conf` = `After=time-sync.target`, plus `fake-hwclock`) is
already applied to `tailscaled` and **not** to `beast-slam`. `timedatectl` now reads synced;
`fake-hwclock.service` and `systemd-timesyncd.service` are both enabled.

**Map store** `/data/beast/maps/`: `beast-map.posegraph` **6.4 MB**, `beast-map.data` 18 KB,
`beast-map.pgm` 5 KB, `beast-map.yaml` (`resolution: 0.05`, `origin: [-1.92, -1.34, 0]`),
plus `bak-2026-08-14-pre-remap/` and `bak-2026-08-14-stem-at-stop/` from 2026-08-13. The
journal's last successful save reads `Received a 69 X 74 map @ 0.05 m/pix`. **A 6.4 MB
posegraph that rasters to 69×74 cells is not a map of a space** — it is the residue of the
2026-08-13 incident recorded in `deploy/bin/beast-slam-save` lines 12–15.

**`/etc/beast/ugv.env`**: `UGV_MODEL=ugv_beast`, `LDLIDAR_MODEL=ld19`, by-id serial path,
`UGV_LIDAR_ANGLE_CROP_MIN=218.0` / `MAX=322.0`, crop enabled.

**Oddity to re-check, not acted on here:** `ros2 node list` shows `/rf2o_laser_odometry`
**twice** with the graph's duplicate-name warning, while `ros2 topic info /odom_rf2o -v`
reports exactly one publisher. Probably a stale graph entry from a restart; confirm before
Phase 2 with `ros2 node info` on each, because two rf2o instances would double-feed the EKF.

## 2. The correction that reorders this plan

This plan was commissioned on the premise that `odom_publisher.py:141`'s
`dth = (dright - dleft) / self.wheel_base`, with the geometric track width `0.143864`
(`:64–72`), is the coupling that gates map quality. **The code says it is not — today.**

`ugv_bringup/config/ekf.yaml:89–93` fuses `odom0: odom_wheel` with

```
odom0_config: [false,false,false,  false,false,false,  true,true,false,  false,false,false,  false,false,false]
#              x     y     z       roll  pitch yaw      vx   vy   vz      vroll vpitch vyaw   ax    ay    az
```

— **vx and vy only.** Pose x/y/yaw and yaw-rate from `odom_wheel` are all `false`.
`odom_publisher`'s `pub_odom_tf` defaults false (`bringup_lidar.launch.py:24–27`, and the
launch never overrides it), so it publishes no transform either. The EKF's yaw comes from
`odom1: odom_rf2o` (`ekf.yaml:126–134` — x, y, yaw, vyaw, `differential: true`) and
`imu0: imu/data` **vyaw only** (`:147–152`). Two yaw-*rate* sources, no absolute yaw.

Consequences, stated plainly:

- **`wheel_base` does not currently reach the EKF, the TF tree, `slam_toolbox`, or Nav2.**
  It corrupts `/odom_wheel`'s pose orientation, which nothing consumes. Fixing it is
  bookkeeping today and load-bearing the moment anyone sets `pub_odom_tf: true` or adds
  yaw/vyaw to `odom0_config` — which is exactly the kind of change a later agent makes
  casually. Measure it and make it a visible parameter anyway.
- **The constants that DO gate map quality are the gyro-z scale and bias, and the wheel
  linear scale.** `beast_base/base_node.py:351–353` divides `odl`/`odr` by 100 under the
  comment `ASSUMED: odl/odr are cm from firmware`, and that feeds `vx`. The ICM-20948
  `16.4 LSB/dps` gyro scale is likewise ASSUMED (`base_node.py` header; strip-down §2 fact 2)
  and feeds `vyaw`. Both go straight into the EKF and therefore into the odometry prior
  `slam_toolbox` scan-matches against.
- **`odom_publisher` never sets `twist.twist.linear.y`** (it publishes 0) while the EKF is
  told to trust it at covariance `1e-3` (`odom_publisher.py:19–25`, `:185–187`). On a
  *tracked* chassis the instantaneous centre of rotation shifts under skid, so body-frame
  lateral velocity is genuinely non-zero mid-turn. That tight zero fights `rf2o` during
  turns. It is a real defect and Phase 1 decides it with data.

`beast_base/base_node.py`'s own header still says *"Calibrate wheel odom / EKF before
mapping."* It is right. Phase 1 does that — just not for the reason the brief assumed.

## 3. Code facts every phase depends on

| # | Fact | Source of truth |
|---|---|---|
| F1 | LiDAR crop is applied in the **driver** and writes **NaN**, not `inf` or 0 | `ugv_else/ldlidar/src/demo.cpp:269–274` |
| F2 | Blind sector is **body 128°–232°** (104°, rear mast); scan bearing + 90° = body bearing, live-verified 2026-08-10 | `src/lib/ros/client.ts:84–89`; Hangar `ins-beast-scan-body-yaw-verified-2026-08-10` |
| F3 | Nav2's velocity chain is already remapped onto the mux: `controller_server`→`cmd_vel_nav_raw`→`velocity_smoother`→`cmd_vel_smoothed`→`collision_monitor`→`cmd_vel_nav`→`twist_mux`→`/cmd_vel` | `ugv_nav/launch/nav_bringup/navigation_launch.py:60–79, 143, 218`; `params/*.yaml` `cmd_vel_out_topic` |
| F4 | `behavior_server` is the exception — remapped **straight onto `cmd_vel_nav`** in both the plain-node and composable branches, because Humble's `timed_behavior.hpp` makes its own `cmd_vel` publisher | `navigation_launch.py:173–187`, `:269–275` |
| F5 | `cmd_vel_nav` is mux rung **10** — below UI (50), remote human (100), and the joystick at the robot (150); 0.5 s timeout per rung | `ugv_cockpit/config/twist_mux.yaml:94–97` |
| F6 | **`ugv_nav/launch/nav.launch.py` and `ugv_slam/launch/slam_toolbox.launch.py` both include `bringup_lidar.launch.py`** → a second `twist_mux` against the live `beast-ros-base`. Neither is usable on BEAST-01 as written | `nav.launch.py:74–93`; `slam_toolbox.launch.py:36–48` (both carry the WARNING) |
| F7 | Effective speed cap is the smoother, not the controller: `max_velocity: [0.26, 0.0, 1.0]` | `ugv_nav/params/rpp.yaml:403–417` |
| F8 | `collision_monitor` watches **`/scan` only** (the `/oak/points` source is commented out of `observation_sources`); `PolygonStop` 0.30 m box, `PolygonSlow` 0.34 m box; `FootprintApproach` is configured but **not listed in `polygons`**, so it is inert | `params/rpp.yaml:419+`, `params/mppi.yaml:496–552` |
| F9 | Cockpit publish whitelist is 4 topics; **no `/goal_pose`**. Glob violations fail **silently** | `ugv_cockpit/launch/rosbridge.launch.py:100–103`, docstring `:37–61`; `client.ts:41–46` |
| F10 | 250k-cell ceiling exists in **two** places: the client refuses ingest and unsubscribes `/map`; the save script **refuses to save** | `client.ts:70`, `:1244–1251`, `:901–912`; `deploy/bin/beast-slam-save:23–48` |
| F11 | ESP32 **latches its last velocity**; no firmware timeout, no cmd_vel silence watchdog. Killing a publisher is never a stop | strip-down plan §2 fact 1 (live-proven 2026-08-07) |
| F12 | `beast_base` is **absent from the build allowlists** (`build_common.sh` `PACKAGES`, `build_first.sh` second colcon block) despite being what the launch and the service run | `build_common.sh`, `build_first.sh:210–218` |
| F13 | rosbridge 2.0.7 serialises floats with `json.dumps` and no `allow_nan=False`, emitting bare `NaN` tokens — **invalid JSON**. One live `/scan` frame measured **149** of them. Direct consequence of F1: the driver's crop writes NaN into 104° of every scan | verified live 2026-08-14 by a sibling agent; owning plan [2026-08-14-cockpit-ros-client-roslib-convergence.md](2026-08-14-cockpit-ros-client-roslib-convergence.md) |

## 4. Blocking dependency, and which stop to trust

**The agent-side stop is not trustworthy for Nav2 goals until F13 is fixed.** This plan does
not fix it and must not try — [2026-08-14-cockpit-ros-client-roslib-convergence.md](2026-08-14-cockpit-ros-client-roslib-convergence.md)
owns that work. Fold the constraint in, do not re-investigate it.

The mechanism, as verified live: `src/server/beast/ros-singleton.ts` reaches the robot through
`roslib`, whose `handleJsonMessage` is a plain `JSON.parse`. Every `/scan` frame carrying bare
`NaN` tokens therefore throws and is surfaced as an `'error'`. In that file:

- `onError` sets `state = 'error'` while the socket is open and healthy — continuously, at scan
  rate.
- `getStatus().scanAlive` is permanently `null`.
- `stop()` guards on `state !== 'connected'` and returns `bridge_unavailable`, *"Cancel not
  sent."* `runAction` carries the same guard.
- `getStatus()` calls `start()`, which resets `state` when `ros.isConnected` — so the state
  flaps, and whether `stop()` works depends on how recently something happened to read status.

**Net: the agent-side stop can silently refuse to cancel a Nav2 goal, nondeterministically,
because a LiDAR frame failed to parse.** The browser cockpit client is **not** affected — it
carries its own NaN repair; only the server-side `roslib` bridge is.

**Which phases this gates:**

| Phase | Gated by F13? | Why |
|---|---|---|
| 0 — map store repairs | **No** | No motion at all. |
| 1 — calibration | **No** | Motion is owner-on-joystick only. No Nav2 action, no agent-issued goal, no agent stop in the loop. |
| 2 — first mapping run | **No** | Same: owner drives, `slam_toolbox` observes. No Nav2 action server is even running. |
| 3 — Nav2 bringup and first goals | **BLOCKED** | Every goal is a `NavigateToPose` action; cancelling one is exactly the path that can silently refuse. |
| 4 — `/goal_pose` + click-to-nav | **BLOCKED** | Puts a destination on the wire from a UI surface; the cancel path must be real before the request path exists. |
| 5 — `explore_lite` un-park | **BLOCKED** | An action client issuing goals in a loop — the case where a refused cancel matters most. |

**The fallback stop, and why it is sound.** Independent of the bridge entirely:
`/ugv/set_allow_motion` (SetBool) is a **service on `beast_base`**, and the flag it latches
gates the **serial write itself** — the `T:13` frame is never sent while it is false, and the
true→false edge sends an explicit `T:13 0,0` stop. It does not traverse `roslib`, does not read
`/scan`, and does not depend on any bridge state machine. It also survives a restart, which the
`twist_mux` estop lock does not (`twist_mux.yaml:137–163`). The browser cockpit's DISARM control
calls it, and it is the only service on the rosbridge whitelist
(`rosbridge.launch.py:131`).

**Therefore, for Phases 3–5, the supervised abort order is:**

1. **Joystick** — rung 150 pre-empts autonomy within one message (F5). Fastest, and it keeps
   the robot under command rather than merely stopping it.
2. **Cockpit DISARM** — `/ugv/set_allow_motion` false. Independent of the bridge fault.
3. **Nav2 goal cancel from an agent** — *do not rely on it*, and do not write a phase step that
   depends on it, until F13's owning plan has landed.

And F11 still holds underneath all three: the ESP32 latches its last velocity, so killing a
node or a launch is **not** a stop.

## 5. Execution phases

Each phase is its own PR, ends green on CI (`beast-ros-spine`, plus the web suite for `src/`
changes), and — when robot-facing — deploys via `robot/beast/ros2_ws/deploy/deploy-to-beast.sh`
(owner runs it; needs robot sudo) with the `docs/beast-ops.md` Quick connect block updated,
dated, at the end (AGENTS.md rule). Durable findings land as `append_insight`, not as commit
messages.

### Phase 0 — make the map store survivable (no motion)

**Gate: nothing downstream is trustworthy until this passes.** Mapping onto a service that
dies at every boot produces artifacts nobody can reason about — which is exactly what
`/data/beast/maps` currently holds.

**Inputs:** §1 journal excerpt; Hangar `ins-beast-rtc-outage-2026-08-10`; the existing
`deploy/systemd/tailscaled.service.d/` drop-in as the precedent.

**Changes:**

1. `deploy/systemd/beast-slam.service` `[Unit]` — add `After=time-sync.target` and
   `Wants=time-sync.target` alongside the existing `After=`. Copy the reasoning comment from
   the tailscaled drop-in; this is the same failure with a different victim. `fake-hwclock`
   is enabled but the journal proves the boot still ran at 1969, so if `time-sync.target`
   alone does not settle it, order after `fake-hwclock.service` too and re-check.
2. **Resume policy.** `deploy/config/slam_toolbox_beast.yaml:30–31` resumes the persisted
   posegraph at *every* start (`map_file_name` + `map_start_at_dock: true`). Do **not** carry
   the 6.4 MB incident posegraph into the first real run. Add a second params file
   `deploy/config/slam_toolbox_beast_fresh.yaml` — identical minus those two keys — and select
   between them in the unit with `Environment=BEAST_SLAM_PARAMS=…` (default: resume).
   Document the Humble quirk already noted at `slam_toolbox_beast.yaml:25–29`: `map_file_name`
   *alone* does not load, it errors and starts fresh.
3. Owner archives the current stem: `cp -a /data/beast/maps/beast-map.* /data/beast/maps/bak-2026-08-14-preflight/`.
   File copy, not a service action.
4. F12 while you are here: add `beast_base` to `build_common.sh`'s `PACKAGES` array and to
   `build_first.sh`'s second `--packages-select` block. A clean `build_first.sh` on a reflashed
   Jetson currently does not build the node the base service launches.

**Emit:** `journalctl -u beast-slam.service -b` from the next cold boot showing a real
wall-clock start and no `karto::Exception`; `systemctl show beast-slam.service -p After`;
the archive path; a note of whether the resume path works on the archived posegraph at all
(if it still aborts post-NTP, the posegraph itself is corrupt and that is a separate finding
worth an insight).

**Done when:** a cold boot brings `beast-slam` up post-NTP and it stays up ≥5 min; an owner
`systemctl restart beast-slam` still saves through `ExecStop`; the previous stem is archived;
both build allowlists name `beast_base`.

### Phase 1 — calibrate the constants that reach the EKF (owner-supervised, motion)

**Read §2 first.** All three constants get measured in one sitting — the same spin test
yields them — but they get *fixed* in order of what they actually reach.

**Preconditions:** Phase 0 done. Owner physically present and within arm's reach of the
robot. `allow_motion` true. Joystick paired (rung 150 is the override). Cockpit DISARM
reachable. A clear ~4 m × 4 m of **the floor the robot will later map** — yaw scrub is a
property of the surface, so calibrating on tile and mapping on carpet measures nothing.

**Rig (read-only; no new publisher touches `cmd_vel`):**

```bash
ros2 bag record -o /data/beast/calib/$(date -u +%Y%m%dT%H%M%SZ) \
  /odom/odom_raw /imu/raw /odom_wheel /odom /odom_rf2o /cmd_vel /scan
```

Every number below is extracted from that bag offline. **Motion is commanded by the owner on
the joystick, never by a script.**

| Run | Procedure | Yields |
|---|---|---|
| **A** | 120 s stationary, powered, untouched | `bias_z = mean(imu.angular_velocity.z)` and its σ |
| **B** | 3.00 m taped straight line, 3 passes at ~0.15 m/s | `d_rep = (Δ Σleft + Δ Σright)/2` from `/odom/odom_raw`; `k_lin = 3.00 / d_rep` |
| **C** | Spin in place, exactly 3 full turns, 3 passes each direction, ~0.5 rad/s (mark floor and chassis, count visually) | `Δψ_true = ±18.850 rad`; `Δψ_gyro = ∫(gz − bias_z)dt`; `s_gyro = Δψ_true / Δψ_gyro`; `b_eff = (ΣΔright − ΣΔleft) / Δψ_true` |
| **D** | 2 m × 2 m box, four 90° corners, return to start, twice | Closure error in x, y, yaw from `/odom` **and** from `/odom_wheel` separately — the before-number |

Reading the results:

- **`bias_z`** — if `|bias_z| > 0.01 rad/s` the EKF yaw drifts ~0.6 °/s with the robot
  stationary, and that alone smears a map. This is the single most important number here.
- **`s_gyro`** — outside `1.00 ± 0.02` means the assumed 16.4 LSB/dps is wrong. Fix it in
  `beast_base`'s IMU scaling, at the source. Do not compensate in the EKF.
- **`k_lin`** — inside `1.00 ± 0.03` confirms the cm→m assumption at `base_node.py:353`.
  Outside it, the divisor is wrong at the source; fix it there, never add a second scale
  factor downstream.
- **`b_eff`** — computed straight from encoder deltas, so it does **not** depend on the
  current `0.143864`. Expect `b_eff > 0.143864` (lateral track scrub widens the effective
  turning width). **Measure it. Do not import a ratio from skid-steer literature.**

**Changes to land:**

- `ugv_bringup/ugv_bringup/odom_publisher.py` — declare `wheel_base` as a ROS parameter with
  the measured `b_eff` as the default, keeping the `UGV_MODEL` dict (`:64–72`) as the fallback
  for other models; set it in `bringup_lidar.launch.py`'s `base_node` parameters block beside
  `pub_odom_tf`. A hard-coded per-model constant nobody can see or override is how this stayed
  wrong and unnoticed.
- Only if Run B says so: the `/100` at `beast_base/base_node.py:353`, with the `ASSUMED`
  comment rewritten as a measured one citing the bag.
- Only if Run C says so: the gyro LSB scale in `beast_base`.
- `ekf.yaml` decision on `vy` (§2, last bullet). Two defensible options: **(a)** leave
  `odom0_config[7] = true` and keep the non-holonomic constraint; **(b)** set it `false` and
  let `rf2o` carry lateral motion. Choose **(b)** only if Runs C/D show the EKF fighting
  `rf2o` mid-turn — visible as `/odom` yaw lagging the gyro integral inside a turn and
  snapping after it. Whichever you choose, write the reason into the yaml.

**Emit:** a table of `bias_z` ± σ, `k_lin` ×3, `s_gyro` ×6, `b_eff` ×6, and Run D closure
before/after; the surface it was measured on; the bag paths. Land
`append_insight` (`id: ins-beast-odom-calibration-2026-08-xx`, confidence high, `bay:
robotics`, `units: ["beast"]`) — this is durable hardware truth and belongs in Postgres, not
only in a diff.

**Done when:** `wheel_base` is a parameter with a measured default; Run C repeated after the
change puts `Δψ_wheel` within 3 % of `Δψ_gyro` over ±3 turns in **both** directions; Run D
closure improves or is documented as unchanged with the reason; the insight is landed.

**Gate:** Phase 2 does not start until Runs A and C pass. **A gyro whose bias or scale is
wrong produces a map that looks fine** — `slam_toolbox` will contentedly scan-match a slowly
rotating world.

### Phase 2 — the first real map of a real space (owner-supervised, motion)

**Inputs:** Phases 0 and 1 done. `beast-ros-base` running. Fresh-start params selected
(Phase 0 change 2). Owner walking beside the robot with the joystick.

**Bring-up.** Not `ros2 launch ugv_slam slam_toolbox.launch.py` — F6. The only supported path
is the service, which launches stock `slam_toolbox online_async_launch.py` against the
already-running base: owner runs `sudo systemctl start beast-slam`.

Before driving, confirm the frame plumbing (read-only):

```bash
ros2 topic hz /map                       # ~0.2 Hz — map_update_interval: 5.0
ros2 run tf2_ros tf2_echo map odom       # must exist, must stay ~still at rest
ros2 topic echo /map --once --field info
```

If `map→odom` jumps while the robot is parked, **stop** — that is Phase 1 leaking.

**Drive pattern** (owner on the joystick, rung 150):

1. Largest open room. Robot stationary, 10 s of scans before the first move.
2. Perimeter first, ~0.15 m/s, walls held at 1–3 m. `minimum_travel_distance: 0.2` and
   `minimum_travel_heading: 0.2` mean slower genuinely buys more keyframes per metre.
3. **Turn slowly.** `coarse_search_angle_offset: 0.349` (20°) is the entire per-match angular
   correction budget. A fast skid turn can exceed it between keyframes.
4. Doorways: approach square, pause, cross, pause. A doorway taken at an angle with 104° blind
   astern is the classic place a posegraph tears.
5. **Close the loop deliberately.** Return to the exact start pose (mark the floor) and sit
   10 s. `loop_search_maximum_distance: 3.0` with `loop_match_minimum_chain_size: 10` means a
   loop only closes if you come back within 3 m of a visited node with ≥10 scans of chain.
   A tour that never revisits never closes and never corrects.
6. Re-drive one interior traverse to give the optimizer a second constraint set.

**What "good" means, checked before saving:**

- `/map` `info` stable in size across two consecutive publishes. A raster that grows while the
  robot is parked means drift is inventing space.
- Walls one cell thick, not two parallel ghosts 20–40 cm apart. Double walls = loop closure did
  not fire; drive the loop again rather than saving.
- The start pose closes — the robot glyph on the cockpit SpatialView lands where it physically is.
- `width × height ≤ 250_000` (below).

**The cell ceiling, honestly.** F10: the client refuses ingest above 250k cells and
unsubscribes `/map`; the save script **refuses to write** above it. At the 5 cm resolution in
`slam_toolbox_beast.yaml:37`, 250k cells is a 25 m × 25 m **axis-aligned bounding box** — not
625 m² of floor, because `slam_toolbox` rasters the bounding box of everything seen, unknown
cells included. **A single-storey house with a 20 m diagonal will exceed it.** Three options,
in order of preference:

1. **Map one room or one wing per stem.** Fits how the robot is actually used; no code change.
2. **Drop the raster to 0.10 m for whole-floor maps** — `resolution:` in
   `slam_toolbox_beast.yaml`, and the matching `resolution:` in both Nav2 costmaps. Quartering
   the cell count fits a 50 m × 50 m box. On a chassis with `robot_radius: 0.15`, 10 cm cells
   are coarse and doorway clearance gets tight, but it is the honest option when the house map
   is the goal.
3. **Raise `MAP_MAX_CELLS` and teach the client to reassemble rosbridge `op: fragment`.**
   `client.ts:901–912` currently *drops* `/map` on the first fragment because it cannot
   reassemble. This is real work and the wrong first move — it puts an ~80 MB JSON grid through
   the browser on a 5 s timer.

**Decide before the run, not after.** The save script refuses silently over the ceiling
(`beast-slam-save:44–48`) — you would drive for an hour and save nothing.

**Persistence.** `ExecStop` runs `deploy/bin/beast-slam-save`, which archives the previous stem
to a timestamped `bak-` directory, then calls `slam_toolbox`'s own `serialize_map`
(`.posegraph` + `.data`) and `save_map` (`.pgm` + `.yaml`) into `/data/beast/maps/beast-map.*`.
Two artifacts, two purposes: the posegraph is what `slam_toolbox` resumes and keeps optimizing;
the `.pgm`/`.yaml` pair is what Nav2's `map_server` loads in Phase 3. The save is `ExecStop`,
not `ExecStopPost`, deliberately (unit header lines 7–9 — the first version saved nothing).
**Owner stops the service to save. Never `kill` the node.**

**Emit:** final `w × h × resolution`; the `beast-slam-save` output; the archived `bak-` path;
a cockpit SpatialView screenshot with the map under the robot; drive time and rooms covered.
Land the dimensions and the surface as an insight.

**Done when:** `/data/beast/maps/beast-map.{posegraph,data,pgm,yaml}` describe a real room or
wing, under the ceiling, single-thickness walls, closed loop; a service restart resumes it
without a `karto` abort; the cockpit renders it.

### Phase 3 — Nav2 on the saved map (owner-supervised, motion)

**Blocked on F13** — see §4. Do not start this phase until
[2026-08-14-cockpit-ros-client-roslib-convergence.md](2026-08-14-cockpit-ros-client-roslib-convergence.md)
has landed and `getStatus().scanAlive` is a real boolean rather than permanently `null`. This
phase is the first one that issues `NavigateToPose` actions, and therefore the first one whose
cancel path can silently refuse.

**Inputs:** Phase 2's saved `.pgm`/`.yaml`. `beast-ros-base` running. `beast-slam` **stopped**
(localization comes from AMCL here, not from SLAM).

**Which controller — start with `rpp.yaml`.** Four param sets are in-tree and none has ever run
on this robot. The reasoning is about this chassis, not about controller fashion:

- `rpp.yaml`'s `FollowPath` is `RotationShimController` wrapping
  `RegulatedPurePursuitController`, with **`allow_reversing: false`** and
  **`use_rotate_to_heading: true`**. A robot with 104° blind **astern** should turn to face
  where it is going and should never reverse into unsensed space. RPP's shape is the shape of
  this robot's sensing.
- It has the fewest coupled parameters of the four, so a bad follow is diagnosable.
- `dwa.yaml` (DWB) samples a velocity space — the classic poor fit for skid-steer, where the
  commanded-to-achieved yaw map is exactly what Phase 1 just showed is uncertain.
- `teb.yaml` is the vendor default (`nav.launch.py:173`) and a time-elastic-band optimizer with
  far more knobs than a 0.26 m/s tracked base needs.
- `mppi.yaml` is the most capable and the most expensive — a sampling optimizer at
  `controller_frequency: 20.0` on an Orin Nano already running the OAK pipeline. Its
  `motion_model: "DiffDrive"` (`:185`) is correct for this base, so it is the right **second**
  controller once RPP proves the plumbing. Revisit for smoothness, not for first light.

Whichever runs, F7 applies: the effective cap is the smoother's `[0.26, 0.0, 1.0]`, not RPP's
`desired_linear_vel: 0.5`.

**Bring-up — not `ros2 launch ugv_nav nav.launch.py`** (F6; that file's own WARNING at
`:74–84` says why). Launch the nav layer alone:

```bash
ros2 launch ugv_nav nav2_bringup.launch.py \
  map:=/data/beast/maps/beast-map.yaml \
  params_file:=$(ros2 pkg prefix ugv_nav)/share/ugv_nav/params/rpp.yaml \
  use_slam:=False use_localization:=amcl autostart:=true
```

Verify the invocation against the file before running it: `map` is declared with **no default**
(`nav2_bringup.launch.py:134–136`), so a missing `map:=` is a launch error, and
`use_composition` defaults **True** (`:188–190`), which puts everything in `nav2_container`.
Once proven, promote it to `deploy/systemd/beast-nav.service` modelled on `beast-slam.service`
(`After=beast-ros-base.service time-sync.target`, `User=beast`,
`EnvironmentFile=-/etc/beast/ugv.env`, no `ExecStop` save). **Do not `systemctl enable` it in
this phase.** A Nav2 stack that autostarts on a robot nobody is watching is the thing this
repo's safety spine exists to prevent.

**Lifecycle.** `autostart:=true` hands `nav2_lifecycle_manager` the configure+activate sequence
for `controller_server`, `smoother_server`, `planner_server`, `behavior_server`,
`velocity_smoother`, `collision_monitor`, `bt_navigator`, `waypoint_follower`
(`navigation_launch.py:42–49`, `:230–238`). `map_server` and `amcl` are activated by a
**second** manager from `localization_launch.py`. Check both rather than trusting them:

```bash
ros2 service call /lifecycle_manager_navigation/is_active std_srvs/srv/Trigger
ros2 lifecycle get /controller_server    # …and planner_server, bt_navigator, collision_monitor, map_server, amcl
```

A half-activated stack accepts goals and never moves.

**How `cmd_vel_nav` reaches the motors** — F3/F4/F5. The chain is already built; do not rebuild
it:

```
controller_server  --(cmd_vel → cmd_vel_nav_raw)-->  velocity_smoother
velocity_smoother  --(cmd_vel_smoothed)---------->   collision_monitor
collision_monitor  --(cmd_vel_out_topic: cmd_vel_nav)-->  twist_mux  (rung 10)
twist_mux          --(cmd_vel_out → /cmd_vel)---->   beast_base → ESP32 T:13
behavior_server    --(cmd_vel → cmd_vel_nav)----->   twist_mux      (bypasses the chain, on purpose)
```

Rung 10 means any human input on 50/100/150 pre-empts autonomy within one message, and the
0.5 s per-rung timeout hands the floor back after the human stops. Both the plain-node and
composable branches carry the remaps — a fix in only one is a fix in neither
(`navigation_launch.py:269–275`).

**Verify at runtime, before the first goal:** `ros2 topic info /cmd_vel -v` must show
**exactly one publisher** (`twist_mux`); `ros2 topic info /cmd_vel_nav -v` should show
`collision_monitor` and `behavior_server`.

**What the safety layers do — and do not — cover.** `velocity_smoother` bounds accel/decel and
caps speed; with `feedback: "OPEN_LOOP"` it smooths its own last command, not measured motion,
so it cannot notice the tracks are slipping. `collision_monitor` (F8) enforces a 0.30 m stop
box and a 0.34 m slowdown box around `base_footprint` — **fed by a scan with a 104° hole
astern**, and by `/scan` only, since the `/oak/points` source is commented out of
`observation_sources`. `FootprintApproach` is configured but absent from `polygons`, so the
predictive approach check is not running; note it, do not enable it mid-phase.

**The rear blind sector in the costmaps.** F1 + F2: the crop writes **NaN**, and NaN readings
are dropped by the scan→cloud conversion, so the wedge is **neither marked nor cleared**.

- **Global costmap** inherits `map.pgm`'s cells there. A good Phase 2 map largely fills the
  wedge — the robot drove past facing other ways — while a poor one leaves an unknown corridor
  trailing the robot.
- **Local costmap** is `rolling_window: true`, 3 m × 3 m (`rpp.yaml:279–283`). An obstacle
  marked while it was in front **stays marked** as the robot passes, because nothing astern can
  raytrace it away. Expect stale phantom obstacles behind the robot. That is the fail-safe
  direction, and it is also why the robot may refuse to back out of a dead end.
- **Constrain the recovery behaviours.** `params/*.yaml` enables `Spin`, `BackUp`,
  `DriveOnHeading`, `Wait`, `AssistedTeleop`. `BackUp` — and `DriveOnHeading` with a negative
  distance — drives **into the blind wedge with the collision monitor blind in that
  direction**. For the first supervised runs, remove `backup` from the default tree
  (`ugv_nav/behavior_trees/navigate_to_pose_w_replanning_goal_patience_and_recovery.xml`) or
  set its distance to 0.0. **Keep `Spin`:** an in-place rotation sweeps the LiDAR *through* the
  wedge, which is the correct recovery for this sensor geometry. Revisit only if a rear sensor
  lands.

**First goals — owner-supervised, escalating:**

1. Goal at the **current pose**. Proves the action server, the BT and the goal checker with no
   motion.
2. **1 m straight ahead**, clear floor, owner's hand on the joystick.
3. **3 m with one 90° turn.**
4. **Through a doorway.**
5. **A goal requiring replanning** — owner steps into the committed path.

Abort path at every step, in §4's order: **joystick first** (rung 150 pre-empts within one
message), then **cockpit DISARM** (`/ugv/set_allow_motion` false → `beast_base` stops the
serial write and sends `T:13 0,0`). **An agent-issued Nav2 goal cancel is not an abort path
here** while F13 stands. F11: the ESP32 latches its last velocity — killing a node is never a
stop.

**Emit:** lifecycle state of every node; `/cmd_vel` publisher count; a `ros2 bag` of goals 2–5
covering `/cmd_vel_nav`, `/cmd_vel`, `/odom`, `/scan`, `/local_costmap/costmap`; tape-measured
goal-reach error for goal 2; the recovery-behaviour edit.

**Done when:** goals 1–4 complete with nobody touching the joystick (owner present); goal 5
replans rather than aborting; `/cmd_vel` never shows two publishers; joystick pre-emption is
demonstrated mid-goal and the robot yields the floor and then resumes.

### Phase 4 — `/goal_pose` publisher and click-to-nav on SpatialView

**Blocked on F13** (§4) as well as on Phase 3. The request path must not exist before the
cancel path is real — shipping a click-to-nav button while the agent-side stop can refuse
nondeterministically is the wrong order.

Deliberately thin. Another agent owns cockpit input generally; this is only the destination
affordance and its contract.

**Robot side — one line, and it is a safety change.** `ugv_cockpit/launch/rosbridge.launch.py`
`TOPICS_PUB_GLOB` (`:100–103`): add `/goal_pose`. That file's own docstring constraints apply
(F9) — bracketed, single-quoted-or-bare, **one** string, and every violation fails **silently**.
Do not touch `topics_glob` (`:161–163`); it merges into both lists. Put the admissibility
argument in the comment beside the change: `/goal_pose` is not a velocity — it is a request to
`bt_navigator`, which routes through the planner, the controller, `collision_monitor`, and
finally the mux's **lowest** rung, so a browser goal is outranked by every human input and
still gated by `allow_motion`.

Add one subscription too, so the UI is honest about what happened: `/plan`
(`nav_msgs/msg/Path`) into `TOPICS_SUB_GLOB` and into `ROS_SUBSCRIPTIONS`. That file says to
keep the two lists in lockstep (`:113–115`) — obey it.

**Client side (`src/lib/ros/client.ts`, `src/components/cockpit/SpatialView.tsx`):**

- Add `{ topic: '/goal_pose', type: 'geometry_msgs/msg/PoseStamped' }` to `ROS_PUBLICATIONS`
  (`:41–46`). The type string is load-bearing — DDS matches on type, and a wrong one is a
  silently dead control (`:7–19`). `ROS_PUBLICATIONS` is already advertised at connect
  (`:963`); `publish()` (`:983`) is the send path.
- The message **must** carry `header.frame_id: 'map'` and a stamp. A goal in the wrong frame is
  not an error; it is a goal somewhere else.
- **The inverse transform.** SpatialView's forward chain is `SpatialView.tsx:104–121`:
  `canvas = T(Cx,Cy) · M_bc · R(−ryaw) · T(−r) · T(origin) · S(res)`, with
  `M_bc = (0, −scale, −scale, 0)` and the robot's map pose composed from `map→odom` ∘ `/odom`.
  Click-to-map is that chain inverted. **Build the chain once as a `DOMMatrix`, use it for
  `ctx.setTransform`, and call `.inverse().transformPoint()` on the click** — so the picture and
  the goal cannot drift apart. That is the same discipline the blind-sector wedge already uses
  (`:124–130`: drawn from the same constants the parser deletes from, after it drifted by 90°
  once already).
- **Affordance: the goal must be deliberate.** Shift-click, or a `SET GOAL` toggle that arms a
  single click, then a confirm chip showing the map-frame x/y before publishing. Heading:
  default to the bearing from the robot to the click; drag-to-set is nice-to-have, not a
  blocker. **Disable the control entirely when `allow_motion` is false or `/map` is stale** — a
  goal into a stale map is a goal into a lie, and the cockpit's whole honesty contract
  (`client.ts:161–177`) says render UNKNOWN rather than a confident wrong thing.
- Tests: `src/__tests__/ros-client.test.ts` pins every publication type — add `/goal_pose`.
  Add a transform round-trip test: a click at the canvas centre must map to the robot's own
  map-frame pose within one cell.

**Emit:** the glob diff; a tape-measured goal accuracy for one known floor point; screenshots
of the armed, confirming, and disabled states.

**Done when:** `/goal_pose` publishes from the cockpit with `frame_id: 'map'`; a click at a
known floor point produces a goal within one cell of it (owner present, tape-measured); the
control is disabled when disarmed or when `/map` is stale; the pub glob and `ROS_PUBLICATIONS`
agree; `/plan` renders; tests green.

### Phase 5 — un-park `explore_lite`

**Gate:** Phases 2, 3 and 4 all done, **and F13 fixed** (§4). Frontier exploration is Nav2
running itself in a loop — the last thing to enable, not the first, and the case where a
silently-refused cancel does the most damage.

**Steps, exactly per AGENTS.md's un-park rule (all in one commit — colcon errors on a selected
package it cannot discover):**

1. Delete `robot/beast/ros2_ws/src/ugv_else/explore_lite/COLCON_IGNORE`.
2. Add `explore_lite` to `build_common.sh`'s `PACKAGES` array **and** to `build_first.sh`'s
   second `--packages-select` block; remove its entry from the parked list in the
   `build_common.sh` header comment.
3. Update the parked list in `AGENTS.md` ("Currently parked: `vizanti` (5 packages),
   `ugv_web_app`, `explore_lite`, `emcl2`") and any `robot/beast/ros2_ws/docs/` mention.
4. Build: `colcon build --packages-select explore_lite`. It is `ament_cmake` with
   `add_executable(explore)` (CMakeLists:80) and `nav2_costmap_2d` / `nav2_msgs` deps.

**Config decision before the first run.** `explore.launch.py` loads `config/params.yaml` — the
`/**` wildcard file, with `costmap_topic: map`, `robot_base_frame: base_link`,
`min_frontier_size: 0.75`, `return_to_init: true`. The sibling `config/params_costmap.yaml`
targets `/global_costmap/costmap` instead. **Choose the global costmap** — exploring an
inflated costmap is safer than exploring the raw `/map` — and say so in the commit. Note that
`return_to_init: true` sends the robot home when frontiers run out, through the same blind rear
sector Phase 3 constrained.

**Why this phase is cheap once Phase 3 is real:** `explore` is a `NavigateToPose` **action
client**. It never touches `/goal_pose` and never touches `/cmd_vel` — it hands goals to
`bt_navigator`, so the collision monitor, mux rung 10, `allow_motion` and joystick pre-emption
all still apply unchanged.

**First run:** SLAM in mapping mode **and** Nav2 both up, in **one room**, owner present with a
hand on the joystick, `progress_timeout: 30.0` so a stuck frontier gives up. Do not turn it
loose in the house.

**Done when:** `explore_lite` builds from a clean `build_first.sh`; the allowlists, the
`COLCON_IGNORE` set and the AGENTS.md parked list all agree with the tree; one supervised
single-room exploration completes and either beats the hand-driven map on coverage or the
reason it does not is written down.

## 6. What still will not work after all of this

Say this out loud rather than letting it be discovered.

1. **No unattended operation.** Nothing above earns the robot the right to drive with nobody
   watching. F11 — the ESP32 latches its last velocity and the `cmd_vel` silence watchdog was
   deliberately removed (owner decision D8). A dead publisher is not a stop. Autonomy that
   outlives the operator's attention requires re-opening that decision first.
2. **The rear stays blind.** 104° of the world astern is NaN at the driver. No Nav2 tuning
   creates data. Reversing, backing out of dead ends, and anything approaching from behind
   remain unsafe. The fixes are physical — a rear sensor, or relocating the mast. The Hangar's
   open LiDAR decision (`beast-lidar-open`: Mid-360S vs Airy 96, plus the unresolved
   servo-vs-rigid mounting question) is this same problem wearing a procurement hat.
3. **No multi-floor, no stairs, no elevators**, and no knowledge of anything below the LiDAR
   plane — a floor cable, a threshold strip, a pet.
4. **The 250k-cell ceiling is a product constraint, not just a client one.** Until `client.ts`
   reassembles rosbridge fragments, a whole-house map at 5 cm cannot be *shown* in the cockpit
   at all. Phase 2 buys room-scale or 10 cm; neither is "the house at 5 cm, on screen."
5. **Localization on a saved map is untested.** Phase 3 uses `amcl` because it is the vendor
   default. `slam_toolbox_localization.yaml` is in-tree and unexercised; `emcl2` is parked
   (and `use_localization:=emcl` will fail while it is). Kidnapped-robot recovery,
   initial-pose-on-boot, and what the cockpit shows when AMCL is lost are all open.
6. **No semantic map.** The robot will know a wall is at (x, y). It will not know it is a
   kitchen. The OAK-D runs and contributes nothing to navigation — its pointcloud is commented
   out of `collision_monitor`'s sources and it feeds no costmap layer.
7. **Calibration is per-surface.** Phase 1's numbers hold for one floor. Carpet, tile and the
   pool deck each scrub differently, and nothing here detects that the surface changed.
8. **No mission persistence.** A goal is a one-shot. Named waypoints, patrol routes and "go to
   the kitchen" need a Hangar-side model that does not exist; `nav2_waypoint_follower` runs and
   nothing feeds it.
9. **One global map stem.** `/data/beast/maps/beast-map.*` plus timestamped backups. Multiple
   named spaces, and selecting one at Nav2 startup, is not built.
10. **Even after F13's fix, an agent-issued cancel is one stop among three, not the stop.**
    §4's order stands permanently: the joystick and the `allow_motion` disarm are the paths
    that do not traverse a bridge, a parser, or a state machine. Any future design that makes
    a software cancel the *primary* abort re-introduces exactly the class of failure F13 is.

## 7. Rollback

- **Phase 0** — revert the unit and params changes; `systemctl daemon-reload`; the archived
  `bak-2026-08-14-preflight/` stem restores the pre-plan map store byte for byte.
- **Phase 1** — revert the PR. The `wheel_base` parameter falls back to the `UGV_MODEL` dict;
  the bags in `/data/beast/calib/` survive independently, so the measurements are not lost with
  the code.
- **Phase 2** — every save archives the previous stem to a timestamped `bak-` directory first
  (`beast-slam-save:50–55`). Restoring is a copy. Owner stops the service before copying.
- **Phase 3** — Nav2 is launched, never enabled. Stopping the launch removes every Nav2
  publisher; `twist_mux` keeps arbitrating the human rungs with `cmd_vel_nav` simply silent.
- **Phase 4** — revert the glob line and the `ROS_PUBLICATIONS` entry. With `/goal_pose` off
  the whitelist, rosbridge denies the advertise **silently** (F9), so verify the revert by
  confirming the client's publish has no effect, not by expecting an error.
- **Phase 5** — restore the `COLCON_IGNORE` and remove the name from both allowlists, in one
  commit. Re-parking is the same two edits and one file.

When a phase's facts stop being true, update this file. When the last phase lands, **delete
it** — executed plans are not archived; git is the archive.
