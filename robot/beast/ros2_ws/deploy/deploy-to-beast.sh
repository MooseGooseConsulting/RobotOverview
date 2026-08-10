#!/usr/bin/env bash
# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
#
# deploy-to-beast.sh — the durable path for landing repo changes on BEAST-01.
#
# Run from any checkout of this repo (Windows Git Bash / Linux / macOS):
#
#   robot/beast/ros2_ws/deploy/deploy-to-beast.sh [ref] [--packages "p1 p2"]
#   robot/beast/ros2_ws/deploy/deploy-to-beast.sh --verify-only
#
# What a full run does, over SSH to $BEAST_HOST (default beast-01 / LAN mDNS;
# override e.g. BEAST_HOST=beast-01-ts for Tailscale, or a direct Wi-Fi IP):
#   1. fetch + fast-forward the on-robot checkout to <ref> (default origin/main);
#      refuses to touch a dirty tree.
#   2. colcon build --symlink-install the affected packages
#      (default: beast_power beast_base ugv_bringup ugv_cockpit — the base
#      service set).
#   3. install deploy/storage payloads and systemd units, daemon-reload,
#      restart beast-ros-base and try-restart beast-cockpit (one sudo prompt).
#   4. verify the live graph (see --verify-only below) and print a dated
#      evidence block to paste into docs/beast-ops.md "Quick connect".
#
# Canonical pull deploy lives in coldaine-homelab/deployments/beast-01/
# (install-beast.sh + beast-pull). This script is the manual override / Phase 0
# source-sync path.
#
# --verify-only runs only step 4 (no sudo, read-only). Use it any time to
# detect drift between the repo and the robot — the checks below encode the
# contract the merged code promises:
#   * beast-ros-base active; beast-cockpit active unless intentionally disabled
#   * beast_power running and the SOLE publisher of /ugv/voltage
#   * /ugv/charging_active has a publisher
#   * beast_power_logger running and /data/beast/power/power-log.csv growing
#   * INA219 pack volts vs ESP32 pack volts agree within 0.2 V (soft warn if
#     the ESP32 serial frame cannot be read)
#   * ugv_safety_monitor is gone (strip 2026-08-07)
#   * INA219 config register is not the 0x399F factory value (soft warn)
#   * DRIVE PATH live: a non-zero twist on /cmd_vel_ui while disarmed reaches
#     beast_base's callback (rejection logged in the journal). Node presence
#     is NOT proof of this: on 2026-08-07 a deploy restart left Fast DDS SHM
#     wedged between twist_mux and beast_base while every node check passed,
#     and the robot could not be driven until the next clean restart. The
#     probe safes the robot briefly (disarm -> rejected burst -> restore the
#     prior gate state); it never moves the robot. If it FAILs on a freshly
#     restarted stack, restart beast-ros-base once more and re-verify before
#     suspecting code.
#
# All ros2 CLI calls here run under a UDP-only Fast DDS profile (written to
# /tmp on the robot): the default SHM transport has proven unreliable for
# late-joining CLI participants on this host and produced false FAILs
# (stale daemon view, undelivered echoes).
#
# Honest limits: build runs on the Jetson (~minutes); the restart is a brief
# stack outage — run parked.
#
# sudo: step 3 needs root on the robot. The password is resolved from
# $BEAST_SUDO_PASSWORD, else Doppler homelab/dev BEAST_JETSON_ADMIN_PASSWORD
# (docs/beast-ops.md "Credential map"), else an interactive prompt. It is
# passed over stdin, never on a command line.

set -euo pipefail

# Default LAN/mDNS. Override: BEAST_HOST=beast-01-ts or BEAST_HOST=192.168.0.187
HOST="${BEAST_HOST:-beast-01}"
REPO_DIR="/home/beast/beast/RobotOverview"
WS_DIR="$REPO_DIR/robot/beast/ros2_ws"
PACKAGES="beast_power beast_base ugv_bringup ugv_cockpit"
REF="origin/main"
VERIFY_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --verify-only) VERIFY_ONLY=1 ;;
    --packages) shift; PACKAGES="${1:?--packages needs an argument}" ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) REF="$1" ;;
  esac
  shift
done

say() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

ssh_opts=(-o ConnectTimeout=10 -o BatchMode=yes)

# --- sudo credential ---------------------------------------------------------
# Step 3 needs root on the robot. Resolve the password up front, before the
# long build, so a missing credential fails in seconds rather than after
# minutes of colcon. Order: explicit env override, then Doppler
# (homelab/dev BEAST_JETSON_ADMIN_PASSWORD — see docs/beast-ops.md "Credential
# map"), then an interactive prompt. The Doppler path is what lets an agent or
# CI run this end to end; a human at a terminal still gets the old behaviour.
sudo_pw=""
sudo_pw_source=""
if [ -n "${BEAST_SUDO_PASSWORD:-}" ]; then
  sudo_pw="$BEAST_SUDO_PASSWORD"
  sudo_pw_source="\$BEAST_SUDO_PASSWORD"
elif command -v doppler >/dev/null 2>&1; then
  sudo_pw="$(doppler secrets get BEAST_JETSON_ADMIN_PASSWORD \
    --project homelab --config dev --plain 2>/dev/null || true)"
  [ -n "$sudo_pw" ] && sudo_pw_source="Doppler homelab/dev"
fi

run_verify() {
  say "verify live graph on $HOST"
  ssh "${ssh_opts[@]}" "$HOST" 'bash -s' <<'REMOTE'
# ROS setup scripts reference unbound vars; enable -u only after sourcing.
source /opt/ros/humble/setup.bash
source /home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash 2>/dev/null || true
set -u

# UDP-only profile for every CLI call below (see script header).
cat > /tmp/beast_verify_fastdds_udp.xml <<'XML'
<?xml version="1.0" encoding="UTF-8" ?>
<profiles xmlns="http://www.eprosima.com/XMLSchemas/fastRTPS_Profiles">
  <transport_descriptors>
    <transport_descriptor>
      <transport_id>udp_only</transport_id>
      <type>UDPv4</type>
    </transport_descriptor>
  </transport_descriptors>
  <participant profile_name="udp_only_participant" is_default_profile="true">
    <rtps>
      <userTransports>
        <transport_id>udp_only</transport_id>
      </userTransports>
      <useBuiltinTransports>false</useBuiltinTransports>
    </rtps>
  </participant>
</profiles>
XML
export FASTRTPS_DEFAULT_PROFILES_FILE=/tmp/beast_verify_fastdds_udp.xml
# Drop any daemon started under the default (SHM) profile; the next CLI call
# respawns one under the UDP profile so its cached graph is trustworthy.
ros2 daemon stop >/dev/null 2>&1 || true

fail=0
ok()   { printf 'PASS  %s\n' "$*"; }
bad()  { printf 'FAIL  %s\n' "$*"; fail=1; }
warn() { printf 'WARN  %s\n' "$*"; }

for svc in beast-ros-base beast-cockpit; do
  svc_state="$(systemctl is-active "$svc" 2>/dev/null || true)"
  if [ "$svc" = beast-cockpit ] \
      && [ "$svc_state" = inactive ] \
      && [ "$(systemctl is-enabled "$svc" 2>/dev/null || true)" = disabled ]; then
    warn "$svc inactive (operator-disabled)"
  elif [ "$svc_state" = active ]; then
    ok "$svc active"
  else
    bad "$svc ${svc_state:-not active}"
  fi
done

nodes="$(ros2 node list 2>/dev/null || true)"
echo "$nodes" | grep -qx '/beast_power' \
  && ok "beast_power running" || bad "beast_power not in node graph"
echo "$nodes" | grep -qx '/ugv_safety_monitor' \
  && bad "ugv_safety_monitor still running (strip not deployed)" \
  || ok "ugv_safety_monitor absent"
echo "$nodes" | grep -qx '/beast_power_logger' \
  && ok "beast_power_logger running" \
  || bad "beast_power_logger not in node graph (power CSV not being recorded)"

vpubs="$(ros2 topic info /ugv/voltage 2>/dev/null | awk '/Publisher count/ {print $3}')"
[ "$vpubs" = "1" ] && ok "/ugv/voltage has exactly 1 publisher" \
  || bad "/ugv/voltage publisher count = ${vpubs:-unknown}"
vowner="$(ros2 topic info /ugv/voltage -v 2>/dev/null | awk '/Node name/ {print $3; exit}')"
[ "$vowner" = "beast_power" ] && ok "/ugv/voltage published by beast_power" \
  || bad "/ugv/voltage published by ${vowner:-unknown}"

cpubs="$(ros2 topic info /ugv/charging_active 2>/dev/null | awk '/Publisher count/ {print $3}')"
[ "${cpubs:-0}" -ge 1 ] 2>/dev/null && ok "/ugv/charging_active has a publisher" \
  || bad "/ugv/charging_active has no publisher"

cfg="$(i2cget -y 7 0x41 0x00 w 2>/dev/null || true)"
if [ -z "$cfg" ]; then
  warn "INA219 unreadable on i2c-7 (sensor or wiring issue)"
elif [ "$cfg" = "0x9f39" ]; then
  warn "INA219 config still factory 0x399F — beast_power has not configured the chip"
else
  ok "INA219 configured ($cfg)"
fi

sample="$(timeout 6 ros2 topic echo --once /ugv/voltage 2>/dev/null || true)"
sample_present="$(printf '%s\n' "$sample" | awk -F': ' '/^[[:space:]]*present:/ {print $2; exit}')"
sample_voltage="$(printf '%s\n' "$sample" | awk -F': ' '/^[[:space:]]*voltage:/ {print $2; exit}')"
case "$sample_present" in
  true)
    [ -n "$sample_voltage" ] \
      && ok "/ugv/voltage live: ${sample_voltage} V" \
      || bad "/ugv/voltage present=true but voltage is missing"
    ;;
  false)
    bad "/ugv/voltage reports INA219 absent"
    ;;
  *)
    warn "no usable /ugv/voltage sample within 6 s"
    ;;
esac

# --- power log: durable CSV must exist and keep growing ---
# The logger fsyncs every row, so an absent sensor still grows the file
# (honest empty-cell rows). Flat line count = stalled logger = missing data.
power_csv="/data/beast/power/power-log.csv"
if [ -f "$power_csv" ]; then
  lines1="$(wc -l < "$power_csv" 2>/dev/null || echo 0)"
  sleep 6
  lines2="$(wc -l < "$power_csv" 2>/dev/null || echo 0)"
  if [ "$lines2" -gt "$lines1" ] 2>/dev/null; then
    ok "power log growing: $lines1 -> $lines2 lines over 6 s"
  else
    bad "power log NOT growing ($lines1 -> $lines2 over 6 s) — logger stalled"
  fi
else
  bad "power log missing at $power_csv"
fi

# --- two-instrument cross-check: driver-board INA219 vs ESP32 pack ADC ---
# /ugv/voltage is beast_power's (INA219 on i2c-7) since the 2026-08-07
# cutover; the ESP32's own pack reading ("v", centivolts) rides its T:1001
# serial frame, not a topic. This taps that stream READ-ONLY (os.open + read,
# no termios writes, no DTR/RTS toggling) just long enough for ONE frame.
#
# ACCEPTED RISK (single stolen frame): the tap reads the tty beast_base is
# continuously draining, so it can consume frames the base parser would have
# taken. Reads are capped small (64 B) and stop at the first 'v' frame, so in
# the normal case exactly one frame is stolen — the base parser validates and
# discards a missing/garbled frame (its read-fail recovery is designed for
# transient serial noise), verify runs on a stationary robot, and the whole
# tap lasts < 1 s. Unreadable/parse-failure stays WARN-level; only a real
# disagreement between the two instruments FAILs.
#
# The CSV-growth wait has already run by here, so nothing delays this pair:
# the ESP32 frame is captured first (the variable-wait read), then the INA219
# sample is echoed immediately after — both readings land within ~1 s of each
# other instead of straddling the 6 s wait.
esp32_port="${UGV_SERIAL_PORT:-}"
if [ -z "$esp32_port" ]; then
  esp32_port="$(systemctl show -p Environment beast-ros-base 2>/dev/null \
    | tr ' ' '\n' | sed -n 's/^UGV_SERIAL_PORT=//p' | head -1)"
fi
[ -z "$esp32_port" ] && [ -e /dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00 ] \
  && esp32_port="/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00"
[ -z "$esp32_port" ] && [ -e /dev/ttyTHS1 ] && esp32_port="/dev/ttyTHS1"

if [ -n "$esp32_port" ] && [ -e "$esp32_port" ]; then
  esp32_voltage="$(timeout 8 python3 - "$esp32_port" <<'PY' || true
import json, os, sys, time

port = sys.argv[1]
try:
    fd = os.open(port, os.O_RDONLY | os.O_NOCTTY | os.O_NONBLOCK)
except OSError:
    sys.exit(2)
buf = b''
deadline = time.monotonic() + 5
try:
    while time.monotonic() < deadline:
        try:
            # Small reads (64 B ≈ one frame): stop at the first 'v' frame
            # instead of draining a 4096-byte buffer that would swallow
            # several of beast_base's frames in one go.
            chunk = os.read(fd, 64)
        except BlockingIOError:
            chunk = b''
        if not chunk:
            time.sleep(0.02)
            continue
        buf += chunk
        while b'\n' in buf:
            line, buf = buf.split(b'\n', 1)
            if not line.strip():
                continue
            try:
                frame = json.loads(line)
            except ValueError:
                continue
            if isinstance(frame, dict) and 'v' in frame:
                print(frame['v'] / 100.0)
                sys.exit(0)
    sys.exit(3)
finally:
    os.close(fd)
PY
)"
  # INA219 sample taken IMMEDIATELY after the ESP32 frame: same time window.
  cross_voltage="$(timeout 6 ros2 topic echo --once /ugv/voltage 2>/dev/null \
    | awk -F': ' '/^[[:space:]]*voltage:/ {print $2; exit}')"
  if [ -n "$cross_voltage" ] && [ -n "$esp32_voltage" ]; then
    delta="$(awk -v a="$cross_voltage" -v b="$esp32_voltage" \
      'BEGIN { d = (a > b) ? a - b : b - a; printf "%.3f", d }')"
    if awk -v d="$delta" 'BEGIN { exit !(d <= 0.2) }'; then
      ok "INA219 vs ESP32 volts agree: /ugv/voltage ${cross_voltage} V, ESP32 ${esp32_voltage} V (delta ${delta} V)"
    else
      bad "INA219 vs ESP32 volts DISAGREE: /ugv/voltage ${cross_voltage} V, ESP32 ${esp32_voltage} V (delta ${delta} V > 0.2 V)"
    fi
  elif [ -n "$esp32_voltage" ]; then
    warn "no /ugv/voltage sample within 6 s — cross-check skipped"
  else
    warn "could not read ESP32 pack voltage (serial tap returned nothing) — cross-check skipped"
  fi
else
  warn "ESP32 serial port not found (${esp32_port:-unknown}) — cross-check skipped"
fi

# --- drive-path probe: /cmd_vel_ui -> twist_mux -> /cmd_vel -> beast_base ---
# Motion-free by construction: the gate is disarmed for the burst, so the
# callback rejects every command and sends stops. PASS requires the reject
# warning in the journal — proof the mux output reached the base node, which
# is exactly the link the 2026-08-07 SHM wedge broke silently.
gate_before="$(timeout 8 ros2 topic echo --once /ugv/allow_motion 2>/dev/null | awk '/^data:/ {print $2; exit}')"
probe_stamp="$(date '+%Y-%m-%d %H:%M:%S')"
timeout 15 ros2 service call /ugv/set_allow_motion std_srvs/srv/SetBool '{data: false}' >/dev/null 2>&1 || true
timeout 8 ros2 topic pub -r 10 /cmd_vel_ui geometry_msgs/msg/Twist \
  '{linear: {x: 0.3, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}' >/dev/null 2>&1 || true
sleep 1
rejections="$(journalctl -u beast-ros-base --since "$probe_stamp" --no-pager 2>/dev/null \
  | grep -c 'Rejected non-zero cmd_vel' || true)"
# Always restore the gate to whatever it was before the probe.
if [ "$gate_before" = "false" ]; then
  timeout 15 ros2 service call /ugv/set_allow_motion std_srvs/srv/SetBool '{data: false}' >/dev/null 2>&1 || true
else
  timeout 15 ros2 service call /ugv/set_allow_motion std_srvs/srv/SetBool '{data: true}' >/dev/null 2>&1 || true
fi
if [ "${rejections:-0}" -ge 1 ] 2>/dev/null; then
  ok "drive path live: /cmd_vel_ui -> twist_mux -> beast_base (reject logged while disarmed)"
else
  bad "drive path wedged: mux output not reaching beast_base — restart beast-ros-base once, re-verify"
fi

exit "$fail"
REMOTE
}

if [ "$VERIFY_ONLY" = 1 ]; then
  run_verify
  exit $?
fi

say "1/4 sync robot checkout to $REF"
ssh "${ssh_opts[@]}" "$HOST" bash -s -- "$REPO_DIR" "$REF" <<'REMOTE'
set -euo pipefail
repo_dir="$1"
ref="$2"

git -C "$repo_dir" fetch origin --prune
if [ -n "$(git -C "$repo_dir" status --porcelain --untracked-files=all)" ]; then
  echo "on-robot tree is dirty; refusing to deploy" >&2
  exit 1
fi

target_sha="$(git -C "$repo_dir" rev-parse --verify "$ref^{commit}")"
git -C "$repo_dir" merge --ff-only "$ref"
actual_sha="$(git -C "$repo_dir" rev-parse HEAD)"
if [ "$actual_sha" != "$target_sha" ]; then
  echo "checkout is at $actual_sha, not requested ref $target_sha; refusing to build" >&2
  exit 1
fi
git -C "$repo_dir" log --oneline -1
REMOTE

say "2/4 colcon build: $PACKAGES"
ssh "${ssh_opts[@]}" "$HOST" "bash -lc 'cd \"$WS_DIR\" \
  && source /opt/ros/humble/setup.bash \
  && colcon build --packages-select $PACKAGES --symlink-install'"

say "3/4 install storage/systemd units + restart"
# One ssh session so a single sudo timestamp covers install, reload, restart.
remote_privileged="sudo install -m 0644 '$WS_DIR'/deploy/systemd/*.service /etc/systemd/system/ \
  && sudo install -m 0644 '$WS_DIR'/deploy/systemd/*.timer /etc/systemd/system/ \
  && sudo '$WS_DIR'/deploy/storage/install.sh --apply \
  && sudo systemctl daemon-reload \
  && sudo systemctl restart beast-ros-base \
  && sudo systemctl try-restart beast-cockpit \
  && sleep 20"

if [ -n "$sudo_pw" ]; then
  echo "sudo: using $sudo_pw_source"
  # Password goes over stdin, never argv — argv is world-readable in ps on the
  # robot. The leading `sudo -S -v` consumes it and caches the timestamp, so
  # every later sudo in this same session needs no password.
  printf '%s\n' "$sudo_pw" \
    | ssh "${ssh_opts[@]}" "$HOST" "sudo -S -p '' -v && $remote_privileged"
else
  echo "sudo: no stored credential found — prompting interactively"
  ssh -t "$HOST" "sudo -v && $remote_privileged"
fi

say "4/4 post-deploy verification"
if run_verify; then
  say "deploy of $REF verified on $HOST"
  date -u '+Paste into docs/beast-ops.md Quick connect: deploy verified %Y-%m-%dT%H:%MZ'
else
  say "DEPLOYED BUT VERIFICATION FAILED — inspect before relying on the robot"
  exit 1
fi
