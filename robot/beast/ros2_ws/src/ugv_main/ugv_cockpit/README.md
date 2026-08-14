# ugv_cockpit — BEAST-01 Command Deck bridge

Robot-side half of the [Hangar Command Deck](https://hangar.moosegoose.xyz/cockpit).
Exposes BEAST-01's live telemetry and OAK-D optics to the browser cockpit over a
single rosbridge WebSocket, and adds the three derived topics the cockpit needs
that no stock topic provides.

This package adds a **remote command ingress**, by design: it stands up the
rosbridge WebSocket the cockpit uses to *publish* command topics (`/cmd_vel_ui`,
gimbal, LED, e-stop lock) — so it owns the boundary that keeps a browser on the
existing priority-50 mux rung and off `/cmd_vel` entirely. It adds no bypass
around the existing mux or motion gate. There is no authentication on
that socket. Motion safety rests on three things, in order:

1. the **loopback bind + topic whitelist** in `launch/rosbridge.launch.py`,
2. `twist_mux` arbitration ([Command Arbitration](../../../docs/command_arbitration.md)),
3. `ugv_bringup`'s `allow_motion` gate.

The full security model, the rosbridge enforcement details, and the
commissioning check that proves the whitelist is live are in
[docs/cockpit.md](../../../docs/cockpit.md). Read that before changing a glob:
every way of getting one wrong fails **silently**.

## What it publishes

| Node | Topic | Purpose |
|---|---|---|
| `depth_colorizer` | `/cockpit/depth/compressed` (`CompressedImage`, JPEG ~6 Hz) | Raw 16UC1 depth (~614 KB/frame) is unusable in a browser; clip → TURBO colormap → JPEG. |
| `overhead_clearance` | `/cockpit/overhead_clearance` (`Float32`, m) | "Will I fit under this duct?" — image-space min on the top depth band. Mission Undercroft's defining question. |
| `cockpit_status` | `/cockpit/status` (`DiagnosticArray`) | Active mux source and command age, `/cmd_vel` publisher count, arming state, disk free, Jetson temps, Wi-Fi RSSI. |

`/scan`, `/odom`, `/ugv/voltage`, `/imu/raw`, `/diagnostics`,
`/ugv/allow_motion`, `/oak/rgb/image_raw/compressed`, `/map`, and `/tf`
come from `beast-ros-base` + slam_toolbox + the OAK launch and
are simply carried on the same bridge.

> **`/imu/raw`, not `/imu/data`.** `ugv_bringup` publishes `sensor_msgs/Imu` on
> `imu/raw`; its `imu/data_raw` publisher is commented out and no filter node
> republishes as `imu/data`. Nothing on this robot publishes `/imu/data`. The
> cockpit client's matching change (`/imu/data` → `/imu/raw`) is **merged** on
> RobotOverview main (#148), so this glob entry is simply correct as it stands.

`cockpit_status` also consumes the `/ugv/allow_motion` (`Bool`) topic
`ugv_bringup` publishes, so the cockpit's drive gate reflects
what the robot enforces rather than what the UI last sent. It is subscribed
`TRANSIENT_LOCAL` to match the publisher, and aged out after 3 s.

> **Aged out means the key is omitted, not published as `false`.** Before the
> first message and after 3 s of silence, `allow_motion` is
> absent from `/cockpit/status` entirely; the entry stays, at WARN, naming the
> silent topic. A published `false` would render in the cockpit as a confident
> LOCKED / OFF-LINE rather than "no publisher" — conservative-looking, and
> therefore never investigated. See [docs/cockpit.md](../../../docs/cockpit.md).
>
> **This half only works with the client half.** Absence is honest only because
> RobotOverview renders a missing key as UNKNOWN and gates drive on the
> robot-reported `allow_motion` — merged on main in #148/#149. Do not change the
> omission rule without checking that repo.

## Transport

`cockpit_rosbridge` on **127.0.0.1:9090** — loopback only, `authenticate: false`,
`use_compression: true`, with an explicit publish/subscribe topic whitelist, no
`rosapi_node`, only the four topic opcodes registered, and an origin allowlist.
`tailscale serve` fronts it and is the only *network* path in; it also provisions
the real Let's Encrypt cert so an HTTPS page can open a valid `wss://` (a plain
`ws://` is blocked as mixed content):

```bash
# One-time: enable HTTPS certs for the tailnet in the admin console, then:
sudo tailscale serve --bg --https=443 http://127.0.0.1:9090
# Confirm it survives reboot:
tailscale serve status
```

The cockpit app then points `BEAST_COCKPIT_WS_URL` at
`wss://beast-01.tyrannosaurus-magellanic.ts.net`.

> **The tailnet is the perimeter.** rosbridge's `check_origin` returns `True`
> unconditionally (verified, `humble` branch) and WebSocket handshakes are exempt
> from the same-origin policy, so any page in any tab on a tailnet-joined machine
> could connect and publish — the same trust level as anyone else on the tailnet.
> `cockpit_rosbridge` optionally restricts browser origins:
>
> ```bash
> # /etc/beast/ugv.env — optional restrict-to-list; unset = accept all origins
> COCKPIT_ALLOWED_ORIGINS=https://hangar.example.ts.net
> ```
>
> Unset accepts every origin. Clients that send no `Origin` at all — non-browser
> tooling — are always admitted; see
> [docs/cockpit.md](../../../docs/cockpit.md).

**Do not widen the bind address or a glob without reading
[docs/cockpit.md](../../../docs/cockpit.md).** An unset glob is allow-all, a
double-quoted entry matches nothing, and rosbridge denies publishes *silently* —
the browser's button still looks like it worked. `test/test_cockpit_bridge.py`
is the merge gate on all of it.

## Run it

```bash
# Cockpit only (camera + bridge + derived topics); beast-ros-base supplies the rest.
ros2 launch ugv_cockpit cockpit.launch.py use_camera:=true use_bridge:=true

# Bridge alone (telemetry-only, no camera):
ros2 launch ugv_cockpit cockpit.launch.py use_camera:=false
```

The OAK camera is launched **here**, not in `beast-ros-base.service`, so its USB
bandwidth and power are only spent when someone is actually watching.

## Service

`deploy/systemd/beast-cockpit.service` runs the full cockpit `Wants=`/`After=`
`beast-ros-base.service`. It ships **disabled**: installing the workspace must
not open a control socket. Install it, then decide separately whether to enable
it.

```bash
sudo install -D -m 0644 deploy/systemd/beast-cockpit.service \
  /etc/systemd/system/beast-cockpit.service
sudo systemctl daemon-reload

sudo systemctl start beast-cockpit.service          # this session only
sudo systemctl enable --now beast-cockpit.service   # every boot — a decision
sudo systemctl disable --now beast-cockpit.service  # close it again

systemctl status beast-cockpit.service
ros2 topic list | grep cockpit   # expect the three /cockpit/* topics
```

Then run the commissioning check in
[docs/cockpit.md](../../../docs/cockpit.md#commissioning-check-prove-the-boundary-is-live):
a broken whitelist is invisible from the browser, so this is the only thing that
distinguishes "enforced" from "looks enforced".

## Standalone behavior_server (PR-4a)

Opt-in Hangar agent primitives — **not** started by `cockpit.launch.py` or
`beast-ros-base`:

```bash
# Jetson once:
sudo apt-get install -y ros-humble-nav2-behaviors \
  ros-humble-nav2-lifecycle-manager ros-humble-nav2-costmap-2d \
  ros-humble-nav2-velocity-smoother

ros2 launch ugv_cockpit behavior_server.launch.py
ros2 action list   # /spin /backup /drive_on_heading /wait
```

Params: `config/behavior_server.yaml`. The odom-frame rolling local costmap
consumes `/scan`; the behavior output passes through a robot-side 0.15 m/s
velocity clamp before `cmd_vel_nav` (twist_mux priority 10). It does not touch
`allow_motion`.

## Dependencies

`rosbridge_server` is an apt package (`ros-humble-rosbridge-suite`) pulled by
`build_first.sh` — confirm it is installed (`ros2 pkg list | grep rosbridge`).
`cv_bridge`, `depthai_ros_driver`, OpenCV, and NumPy are already on the robot.
`nav2_behaviors`, `nav2_lifecycle_manager`, `nav2_costmap_2d`, and
`nav2_velocity_smoother` are required only for the standalone behavior stack.
