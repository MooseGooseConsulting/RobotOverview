# Web Cockpit Bridge

**The cockpit bridge is the only network surface the web cockpit talks to, there is
no authentication on it, and its topic whitelist is the only thing that keeps a
browser off `/cmd_vel`.**

The cockpit lives in this monorepo's web surface (route `/cockpit`). It speaks the
**rosbridge protocol** over a WebSocket. This page is the independently deployed robot
side: what it admits, why, and how to prove the boundary is real.

Package layout, node parameters and day-to-day operation:
[`src/ugv_main/ugv_cockpit/README.md`](../src/ugv_main/ugv_cockpit/README.md).

!!! danger "Disabled by default — enabling it is an operator decision"
    `beast-cockpit.service` ships **not enabled**. Bringing the robot up does not open
    a control socket: `bringup_lidar.launch.py` includes the twist_mux spine but never
    `cockpit.launch.py`, and `beast-ros-base.service` does not pull this unit in.

---

## Where the safety actually comes from

Four things, and none of them is an access-control list:

1. **`address: 127.0.0.1`.** The socket is not on the LAN or the tailnet at all.
   rosbridge's own default binds every interface — overriding that default is most of
   what `launch/rosbridge.launch.py` exists to do. It is not a launch argument, so
   `address:=0.0.0.0` is not one typo away.
2. **The topic whitelist.** A closed list of the five topics the shipped cockpit
   advertises. `/cmd_vel` and every mux rung above `cmd_vel_ui` are absent.
3. **`tailscale serve`** fronts `127.0.0.1:9090` as `wss` on the tailnet — the only
   *network* path in, terminating TLS with a real cert so an HTTPS page can open the
   socket without tripping mixed-content rules.

`authenticate: false` stays, because rosbridge's built-in authentication is a custom
service handshake the shipped client does not implement. Saying the socket is
unauthenticated is honest; calling it an ACL is not.

!!! note "Security model: the tailnet is the perimeter"
    This robot is an operator's personal machine. `tailscale serve` is the only path
    into the bridge, and anyone who can reach the tailnet already has the operator's
    trust level (they can SSH to the box). So the model is: **the tailnet gates
    everything; the whitelist bounds what a connected client may publish.**

    WebSocket handshakes are exempt from the same-origin policy, so upstream rosbridge
    accepts any `Origin` (`check_origin` returns `True`). That is fine here. An
    optional `COCKPIT_ALLOWED_ORIGINS` restrict-to-list exists for an operator who
    wants to name specific origins, but unset means **accept all** — the default is
    "it just works", not "fail closed until configured".

### Configuring the origin restrict-list (optional)

`COCKPIT_ALLOWED_ORIGINS` is an optional comma-separated list of the origins **serving
the cockpit page** — the RobotOverview deployment, not the robot's own hostname. When
set, only those origins are admitted; when unset, every origin is accepted. The
`Origin` header carries the page's origin:

```bash
# /etc/beast/ugv.env  (already read by beast-cockpit.service)
COCKPIT_ALLOWED_ORIGINS=https://hangar.example.ts.net
```

Comparison is exact on `scheme://host[:port]`, case-insensitive, trailing slash
ignored. `http://` does **not** inherit an `https://` entry's trust, and subdomains do
not match.

!!! note "Clients with no `Origin` header are always admitted"
    Browsers always send `Origin` on a WebSocket handshake; page JavaScript can neither
    forge nor suppress it. A **missing** `Origin` means a non-browser client —
    `roslibpy`, a native app, CLI tooling — and those are admitted either way, because
    the tailnet is the perimeter and the whitelist bounds what they may publish.

---

## The whitelist

[`twist_mux`](command_arbitration.md) decides *whose* command wins. It cannot stop a
websocket client from publishing straight onto `/cmd_vel` and skipping arbitration,
because ROS 2 has no notion of topic ownership. **The glob whitelist is what makes the
mux unbypassable from a browser.**

### Client → robot (`topics_pub_glob`)

| Topic | Type | Why it is admitted |
|---|---|---|
| `/cmd_vel_ui` | `geometry_msgs/Twist` | The mux's **priority-50 rung**. A pad at the robot (150) or an operator pad (100) always outranks it |
| `/ugv/led_ctrl` | `std_msgs/Float32MultiArray` | Lights |
| `/pt_joint_position_controller/commands` | `std_msgs/Float64MultiArray` | Pan-tilt |
| `/ugv/pt_steady_ctrl` | `std_msgs/Float32MultiArray` | Pan-tilt levelling |

**Not admitted, deliberately:** `/cmd_vel` (the mux output), `/cmd_vel_joy_robot`,
`/cmd_vel_joy_operator`, `/cmd_vel_nav`, `/cmd_vel_nav_raw`, `/cmd_vel_smoothed` — and
`/cmd_vel_estop_lock`. A client that could reach the velocity topics could bypass the
ladder or impersonate a source that outranks the person standing next to the robot. The
mux lock is excluded because a one-shot publish into a **volatile** lock subscription can
lose the discovery race — the stop silently does nothing — and lock state does not
survive a mux restart. Browser motion authority is the `/ugv/set_allow_motion` **service**
below; the lock topic remains configured for CLI operators over SSH.

### Robot → client (`topics_sub_glob`)

`/ugv/voltage`, `/scan`, `/odom`, `/imu/raw`, `/diagnostics`, `/cockpit/status`,
`/ugv/allow_motion`, `/ugv/watchdog_state`, `/cockpit/overhead_clearance`, `/cockpit/depth/compressed`,
`/oak/rgb/image_raw/compressed`, `/map`, `/tf`. Telemetry only — nothing here can move anything — but
the list stays closed so a client cannot enumerate and read whatever a later PR adds.

!!! note "`/imu/raw`, not `/imu/data`"
    `ugv_bringup` publishes `sensor_msgs/Imu` on **`imu/raw`**; its `imu/data_raw`
    publisher is commented out and no filter node republishes as `imu/data`. Nothing on
    this robot publishes `/imu/data`, so whitelisting it would be dead config that
    reads as a working feed.

    RobotOverview #148 landed the matching `/imu/raw` subscription and corrected
    `/ugv/led_ctrl` plus `/ugv/pt_steady_ctrl` to the robot's `Float32MultiArray`
    contract. The bridge also admits the client's direct allow-motion and watchdog
    subscriptions so safety state does not depend only on the 1 Hz aggregator.

### Services and actions

`services_glob` names exactly one service — **`/ugv/set_allow_motion`**, the cockpit's
DISARM/RE-ARM authority (a `std_srvs/SetBool` whose latched flag lives in `ugv_bringup`
and gates the ESP32 serial write below the mux). `actions_glob` is `[]`. The
`cockpit_rosbridge` wrapper removes the service-advertising and both action capabilities
from the protocol, leaving `CallService` as the only service opcode, gated by that
one-entry glob. `rosapi_node` is **not launched**: rosbridge 2.0.7 force-appends
`/rosapi/*` to any non-empty `services_glob`, so refusing rosapi by configuration alone
is impossible — with ours now non-empty, rosapi staying unlaunched is what keeps the
forced append matching no live service. This closes every service except the motion
authority and the whole action API; it does **not** make the bridge read-only. The
reviewed topic-publish globs and the single SetBool service remain an intentional remote
command ingress through the existing mux/gate/watchdog path.

---

## How rosbridge actually enforces this

Verified against **rosbridge_suite 2.0.7** (what `ros-humble-rosbridge-suite` resolves
to) by reading its source, not its documentation.

- `topics_pub_glob` is checked in `advertise` **and in every individual `publish`**.
  The per-publish check is the load-bearing one: a `publish` op can create a publisher
  for a topic that was never advertised. `topics_sub_glob` gates `subscribe`.
- Matching is `fnmatch.fnmatch(topic, glob)`, fully anchored. With no wildcards in our
  entries only the exact string matches — `/cmd_vel` cannot match `/cmd_vel_ui`, a
  missing leading slash fails closed, and matching is case-sensitive on Linux.

!!! danger "Three ways to write a glob that silently does the wrong thing"
    Each produces a config that looks fine and behaves catastrophically. All three are
    asserted by `test/test_cockpit_bridge.py`.

    - **An unset glob is ALLOW-ALL.** rosbridge maps an empty string to `None`, and
      every capability reads `None` as "no restriction". Forgetting a glob opens the
      bridge; it does not close it. `"[]"` parses to an empty *list*, which is not
      `None` and does deny everything.
    - **The value must be bracketed.** rosbridge slices `value[1:-1]` before splitting,
      so an unbracketed string silently loses its first and last character —
      `/cmd_vel_ui` becomes `cmd_vel_u` and matches nothing.
    - **Double quotes are not stripped.** Only single quotes are. A double-quoted entry
      keeps its quote characters and becomes a glob that matches no topic at all.

    The legacy `topics_glob` is left unset on purpose: it merges into *both* the pub and
    the sub list, so setting it widens the publish whitelist as a side effect of any
    subscribe change.

!!! warning "Denials are silent to the client"
    A rejected publish logs a warning **on the robot** and returns. The browser gets no
    error, no rejection, no callback — the button appears to work. A broken whitelist
    therefore cannot be detected from the cockpit, which is why the commissioning check
    below exists and why the whitelist has a static test.

---

## Commissioning check — prove the boundary is live

!!! warning "NOT YET RUN on hardware (2026-07-31)"
    This check has never been executed on BEAST-01. **The whitelist boundary is
    unproven until it passes there.** Everything above is read from rosbridge's source
    and asserted by `test/test_cockpit_bridge.py`, which is a static check of the
    config — it cannot observe a running server rejecting a real publish. Treat the
    bridge as unverified in the meantime. **Strike this warning when the check has been
    run and passed.**

Run once after installing, and again after any change to the globs.

**Terminal 1 — watch the mux output:**

```bash
ros2 topic echo /cmd_vel
```

**Terminal 2 — watch the bridge's own log:**

```bash
journalctl -u beast-cockpit.service -f
```

**Terminal 3 — try to bypass the mux.** From any rosbridge client (the browser console
on the cockpit page will do), send a publish op aimed at the mux output:

```json
{"op": "publish", "topic": "/cmd_vel",
 "msg": {"linear": {"x": 0.1, "y": 0.0, "z": 0.0},
         "angular": {"x": 0.0, "y": 0.0, "z": 0.0}}}
```

**Pass criteria — all three:**

1. Terminal 1 shows **nothing**. Not a zero Twist, nothing at all.
2. Terminal 2 logs `No match found for topic, cancelling publish to: /cmd_vel`.
3. The client reports no error — that is the expected silent denial, not a fault.

Then repeat with `"topic": "/cmd_vel_ui"` and confirm the opposite: the message lands,
`twist_mux` forwards it, and `/cmd_vel` shows it. A whitelist that denies everything is
just as broken as one that denies nothing, and only this second half catches it.

---

## Motion authority: the browser calls a service, never the mux lock

The cockpit's DISARM/RE-ARM control is a `std_srvs/SetBool` call to
**`/ugv/set_allow_motion`** — the only entry in `services_glob`. The latched flag lives
in `ugv_bringup`, gates the ESP32 serial write below the mux, and survives `twist_mux`
restarts because it does not live in the mux at all. The UI renders ARMED/DISARMED from
the latched `/ugv/allow_motion` echo, never from what it last asked for.

The `/cmd_vel_estop_lock` mux lock stays configured for **CLI operators over SSH**, with
the same caveat as before: `twist_mux` subscribes to it with **volatile** durability, so
a single `--once` publish can be lost to the discovery race and the lock does not survive
a `twist_mux` restart. A CLI operator engaging it must re-publish `true` at ≥ 1 Hz for as
long as the stop is held. Full reasoning:
[Command Arbitration → Emergency lock](command_arbitration.md#emergency-lock).

---

## Deploying

### 1. Dependencies and build

```bash
sudo apt install ros-humble-rosbridge-suite      # also pulled by build_first.sh
colcon build --packages-select ugv_bringup ugv_cockpit --symlink-install
```

`ugv_bringup` is in that list because the cockpit's arming display depends on the two
topics it now publishes — see [Safety state](#safety-state-the-cockpit-gates-on) below.

### 2. Install the units (still not enabled)

```bash
sudo install -D -m 0644 deploy/systemd/beast-cockpit.service \
  /etc/systemd/system/beast-cockpit.service
sudo install -D -m 0644 deploy/systemd/beast-cockpit-serve.service \
  /etc/systemd/system/beast-cockpit-serve.service
sudo systemctl daemon-reload
```

### 3. Expose it over the tailnet

The bridge binds `127.0.0.1:9090` and nothing else. `tailscale serve` terminates TLS
and is the **only** thing that fronts it:

```bash
# Preferred (canonical recipe in coldaine-homelab):
sudo sh infra/network/tailscale/beast-01-serve.sh
# Equivalent one-liner:
sudo tailscale serve --bg --https=443 http://127.0.0.1:9090
tailscale serve status
```

The cockpit then connects to `wss://beast-01.<tailnet>.ts.net/`.

**ACL:** `tag:robot` must grant **`tcp:443`** (plus SSH/ICMP) from operator
principals. SSH-only grants leave `ssh beast-01-ts` healthy while Hangar shows
ROBOT UNREACHABLE. Verify from a workstation on the tailnet:

```powershell
doppler run --project homelab --config dev -- pwsh -File scripts/Verify-BeastCockpitAcl.ps1
pwsh -File tools/beast/Verify-Beast-Cockpit.ps1
```

!!! note "No firewall hole is needed"
    Port 9090 is bound to loopback, so it is unreachable from the LAN and from the
    tailnet whether or not UFW is running. Do **not** add a rule for it: a rule for a
    loopback-only port is at best noise, and at worst a licence to move the bind
    address later. `tailscale serve` needs no inbound rule either — the tailnet arrives
    over WireGuard on Tailscale's own UDP port.

### 4. Start it, deliberately

```bash
sudo systemctl start beast-cockpit.service           # this session only
sudo systemctl enable --now beast-cockpit.service   # every boot — a decision
# Serve oneshot uses RemainAfterExit — use restart to re-apply after ACL wipe
sudo systemctl restart beast-cockpit-serve.service
sudo systemctl enable --now beast-cockpit-serve.service  # optional, with cockpit
sudo systemctl disable --now beast-cockpit.service  # close it again
```

Leaving cockpit (+ serve) enabled means the robot boots with a control socket
listening behind Tailscale Serve. That is a reasonable choice for a robot that
lives behind a tailnet; it is a choice, and it should be made on purpose.

---

## Safety state the cockpit gates on

`ugv_bringup` publishes two topics whose only consumer is the cockpit's safety strip.
They exist so the browser can gate its drive controls on what the **robot** reports,
rather than on what the UI last sent.

| Topic | Type | Contents |
|---|---|---|
| `/ugv/allow_motion` | `std_msgs/Bool` | The arming gate value `ugv_bringup` actually enforces |
| `/ugv/watchdog_state` | `diagnostic_msgs/DiagnosticStatus` | `armed`, `fired`, plus `watching` and `timeout` |

Both are published at 2 Hz with `TRANSIENT_LOCAL` durability, so a client connecting
between ticks gets the current state immediately, and the periodic republish is what
lets `cockpit_status` notice that `ugv_bringup` has died.

- **`allow_motion`** is the value the node latched at startup and enforces in
  `cmd_vel_callback` — not the parameter server's current value, which nothing
  re-reads. Publishing the *enforced* value is what makes the gate honest.
- **`armed`** answers exactly one question: *will the automatic stop happen?* True when
  the stop-on-silence timer exists, is not cancelled, and `cmd_vel_timeout > 0` —
  **independent of `allow_motion`**. A locked robot with a live watchdog reports
  `armed: true`, and the entry level is `OK`. It used to AND in `allow_motion`, which
  made amber "not armed" the resting state of a parked robot; a warning seen every day
  is a warning nobody reads, and a real watchdog failure would have arrived looking
  exactly like normal. `allow_motion` has its own topic and its own field in the strip.
- **`watching`** is the transient internal flag — a non-zero command is in flight and
  the next tick will time it. It flips on every zero command, which is why `armed` is
  the stable value the UI reads.
- **`fired`** latches the watchdog's own stop until something drives again, and is
  republished immediately on the transition rather than waiting for the next tick.
  Nothing outside `ugv_bringup` could observe this: the stop the watchdog sends is
  byte-identical to an operator's, so no external watcher could tell them apart.

!!! danger "Unknown is published as an ABSENT key, never as `false`"
    `cockpit_status` ages both topics out after 3 s — but what it does at the end of
    that window is **omit `allow_motion`, `armed` and `fired` entirely**, not publish
    them as `false`. They are equally absent *before* the first message ever arrives.

    The client renders a missing key as **unknown** and a present key as a reading it
    can trust. `false` is the conservative-looking rendering, and that is exactly what
    makes it the wrong one: on a robot where these publishers are not deployed yet, a
    published `false` shows a confident **LOCKED / OFF-LINE** that never once says *I
    cannot see the robot* — and nobody investigates a panel that looks correct.

    The `bringup` and `cockpit_safety_watchdog` entries themselves stay in the array
    either way, at **WARN**, with a message naming the silent topic, so the gap is
    legible in `ros2 topic echo /cockpit/status` as well as in the UI. Same rule the
    host metrics follow (an unreadable thermal zone must not render as a cold SoC).

!!! warning "These two halves must stay in lockstep — cross-repo"
    Omitting a key is only honest if the consumer renders absence as **UNKNOWN**. A
    client that defaulted a missing key to `false` would reintroduce the same confident
    lie by another route; one that defaulted it to `true` would be far worse.

    The matching client behaviour — absent key → UNKNOWN, and the drive gate keyed on
    the robot-reported `allow_motion` — is **merged** on RobotOverview main (#148,
    #149). Do not change the omission rule on either side alone, and do not "simplify"
    this back to always emitting the keys.

---

## What `/cockpit/status` reports

`cockpit_status` is an observer: it publishes no velocity, holds no lock, and changes
no parameter.

| Entry | Key | Where it comes from |
|---|---|---|
| `cockpit_safety_watchdog` | `armed`, `fired` | `/ugv/watchdog_state`. **Keys omitted** before the first message and again once it is 3 s stale |
| `twist_mux` | `active_source` | Derived by mirroring the ladder over the four rung topics + the lock |
| | `command_age` | Seconds since the winning source's last message; `-1` when nothing is driving |
| | `publisher_count` | Publishers on `/cmd_vel`. Healthy is exactly 1 |
| `bringup` | `allow_motion` | `/ugv/allow_motion`. **Key omitted** before the first message and again once it is 3 s stale |
| `system_metrics` | `wifi_rssi`, `disk_free`, `cpu_temp`, `gpu_temp` | `/proc/net/wireless`, `statvfs`, Jetson thermal zones |

`active_source` is an **outside reconstruction** of twist_mux's rule (highest
non-expired rung, 0.5 s expiry, an engaged lock masks everything). The published
message is suffixed `(mirrored)` so `ros2 topic echo` discloses that an entry named
`twist_mux` is not published by twist_mux.

!!! note "Why not just read twist_mux's own `/diagnostics`?"
    Checked against `ros-teleop/twist_mux`, `humble` branch. Two things an earlier
    draft of this page asserted are **false**, and are corrected here:
    `updateDiagnostics` runs on a **1 Hz wall timer** (`DIAGNOSTICS_PERIOD = 1s`), not
    only when a command arrives, so it does *not* go stale on silence; and
    `getLockPriority()` returns **255** while the e-stop lock is engaged and 0
    otherwise, so lock-engaged and idle *are* distinguishable.

    The actual reasons it cannot drive this strip:

    - `current priority` is the **lock** priority, not the winning source's. It says
      nothing about *which rung holds the floor* — the one fact `active_source` exists
      to report. All four rungs publish the same number.
    - The per-topic `velocity <name>` keys do expose masked/unmasked, but only at 1 Hz
      and only as formatted human-readable strings. That is half this node's 2 Hz
      publish rate, and it would make the cockpit's arbitration display depend on
      parsing upstream's diagnostic prose — not a wire contract, and rewordable in any
      release.

    Mirroring the documented arbitration rule over the same topics is coarser in no
    dimension and does not depend on upstream's presentation strings.

Unreadable host metrics still emit the client's own fallback value (so the string
parses), but the entry level goes to **WARN** and its message names them, so the gap is
visible in `ros2 topic echo` rather than rendering as a cold SoC.
