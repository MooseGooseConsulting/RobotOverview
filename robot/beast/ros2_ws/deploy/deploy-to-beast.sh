#!/usr/bin/env bash
# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
#
# deploy-to-beast.sh — manual override / Phase 0 source-sync path for BEAST-01.
# Canonical pull deploy lives in coldaine-homelab/deployments/beast-01/.
#
# Run from any checkout of this repo (Windows Git Bash / Linux / macOS):
#
#   robot/beast/ros2_ws/deploy/deploy-to-beast.sh [ref] [--packages "p1 p2"]
#   robot/beast/ros2_ws/deploy/deploy-to-beast.sh --verify-only
#
# What a full run does, over SSH to $BEAST_HOST (default beast-01 / LAN mDNS;
# override e.g. BEAST_HOST=beast-01-ts for Tailscale, or a direct Wi-Fi IP):
#   1. sync the on-robot checkout to <ref> (default origin/main). A local
#      commit (unpushed branch) is git-pushed to the robot first so origin
#      is not required. Tracked dirt is reset; untracked files the incoming
#      tree will add are removed so checkout can write them. Other untracked
#      files (e.g. slam / wifi-telemetry scp leftovers) are left alone.
#   2. colcon build --symlink-install the affected packages
#      (default: beast_power beast_base ugv_bringup ugv_cockpit — the base
#      service set).
#   3. install systemd units via the passwordless helper, restart
#      beast-ros-base and try-restart beast-cockpit + beast-wifi-watch.
#      Does NOT restart beast-slam. Doppler sudo is break-glass only.
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
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

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

# Passwordless sudo via /etc/sudoers.d/beast-ops is the routine path
# (systemctl on beast-* units, daemon-reload, beast-install-systemd-units,
# tailscale serve). Doppler BEAST_JETSON_ADMIN_PASSWORD is break-glass only
# and is resolved later if a binary install is not allowlisted.
sudo_pw=""
sudo_pw_source=""

resolve_break_glass_sudo() {
  if [ -n "$sudo_pw" ]; then
    return 0
  fi
  if [ -n "${BEAST_SUDO_PASSWORD:-}" ]; then
    sudo_pw="$BEAST_SUDO_PASSWORD"
    sudo_pw_source="\$BEAST_SUDO_PASSWORD"
    return 0
  fi
  if command -v doppler >/dev/null 2>&1; then
    sudo_pw="$(doppler secrets get BEAST_JETSON_ADMIN_PASSWORD \
      --project homelab --config dev --plain 2>/dev/null || true)"
    if [ -n "$sudo_pw" ]; then
      sudo_pw_source="Doppler homelab/dev (break-glass)"
      return 0
    fi
  fi
  return 1
}

run_verify() {
  say "verify live graph on $HOST"
  # Single source of truth: deploy/bin/beast-verify. Piped over stdin rather
  # than executed by path on the robot, so the workstation verifies with the
  # copy it is deploying FROM — the same property the inline heredoc had.
  # beast-pull runs that same file directly on the robot.
  ssh "${ssh_opts[@]}" "$HOST" 'bash -s' < "$SCRIPT_DIR/bin/beast-verify"
}

if [ "$VERIFY_ONLY" = 1 ]; then
  run_verify
  exit $?
fi

LOCAL_SHA=""
ROBOT_BRANCH="deploy-incoming"
if git -C "$LOCAL_REPO_ROOT" rev-parse --verify "$REF^{commit}" >/dev/null 2>&1; then
  LOCAL_SHA="$(git -C "$LOCAL_REPO_ROOT" rev-parse --verify "$REF^{commit}")"
  current_branch="$(git -C "$LOCAL_REPO_ROOT" branch --show-current || true)"
  if [ -n "$current_branch" ]; then
    ROBOT_BRANCH="$current_branch"
  fi
fi

say "1/4 sync robot checkout to $REF"
if [ -n "$LOCAL_SHA" ]; then
  say "push $LOCAL_SHA -> $HOST:$REPO_DIR (staging ref, checkout as $ROBOT_BRANCH)"
  # ssh:// so Windows Git does not treat host:path as a drive-letter path.
  # The robot is not an LFS remote (no git-lfs-authenticate); skip blob push.
  # Push to a staging ref, never refs/heads/<branch>: if the robot is already
  # checked out on that branch, receive.denyCurrentBranch rejects the push.
  # The remote checkout -B below only needs the object to exist.
  GIT_LFS_SKIP_PUSH=1 git -C "$LOCAL_REPO_ROOT" push --no-thin \
    "ssh://$HOST$REPO_DIR" "+$LOCAL_SHA:refs/deploy/incoming"
  ssh "${ssh_opts[@]}" "$HOST" bash -s -- "$REPO_DIR" "$LOCAL_SHA" "$ROBOT_BRANCH" <<'REMOTE'
set -euo pipefail
repo_dir="$1"
target_sha="$2"
robot_branch="$3"

# Discard tracked dirt (e.g. a one-file rosbridge scp). Do NOT git clean:
# untracked slam / wifi-telemetry leftovers must stay.
git -C "$repo_dir" reset --hard HEAD

# Incoming tree will add files that already exist untracked from prior scp.
# Remove only those paths so checkout can write the committed copies.
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if [ -e "$repo_dir/$f" ] \
      && ! git -C "$repo_dir" ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    rm -f "$repo_dir/$f"
  fi
done < <(git -C "$repo_dir" diff --name-only --diff-filter=A HEAD "$target_sha")

git -C "$repo_dir" checkout -B "$robot_branch" "$target_sha"
actual_sha="$(git -C "$repo_dir" rev-parse HEAD)"
if [ "$actual_sha" != "$target_sha" ]; then
  echo "checkout is at $actual_sha, not requested $target_sha; refusing to build" >&2
  exit 1
fi
git -C "$repo_dir" log --oneline -1
REMOTE
else
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
fi

say "2/4 colcon build: $PACKAGES"
ssh "${ssh_opts[@]}" "$HOST" "bash -lc 'cd \"$WS_DIR\" \
  && source /opt/ros/humble/setup.bash \
  && colcon build --packages-select $PACKAGES --symlink-install'"

say "3/4 install units + restart (passwordless; no slam)"
# Allowlisted via /etc/sudoers.d/beast-ops. Does not restart beast-slam.
# Binary install of wifi-watch/link-watch is not allowlisted; skip when the
# installed copy already matches the tree, otherwise fall back to break-glass.
remote_passwordless=$(cat <<REMOTE
set -euo pipefail
ws='$WS_DIR'
# Set when a binary differs from the tree but passwordless install failed;
# the script then finishes the allowlisted work and exits 2 (see below).
pw_gap=0
sudo -n /usr/local/sbin/beast-install-systemd-units
install_bin_if_needed() {
  src="\$1"
  dest="\$2"
  if [ ! -f "\$src" ]; then
    echo "missing \$src" >&2
    return 1
  fi
  if [ -f "\$dest" ] && cmp -s "\$src" "\$dest"; then
    echo "skip install \$dest (already matches tree)"
    return 0
  fi
  if sudo -n install -m 0755 "\$src" "\$dest"; then
    echo "installed \$dest"
    return 0
  fi
  echo "WARN cannot passwordless-install \$dest; leaving installed copy" >&2
  pw_gap=1
  return 0
}
install_bin_if_needed "\$ws/deploy/bin/beast-wifi-watch" /usr/local/sbin/beast-wifi-watch
install_bin_if_needed "\$ws/deploy/bin/beast-link-watch" /usr/local/sbin/beast-link-watch
install_bin_if_needed "\$ws/deploy/bin/beast-slam-save" /usr/local/sbin/beast-slam-save
install_bin_if_needed "\$ws/deploy/bin/beast-wifi-telemetry" /usr/local/sbin/beast-wifi-telemetry
sudo -n /usr/bin/systemctl daemon-reload
# wifi-watch binary already matched the tree above; do not restart it
# (older sudoers copies may lack try-restart beast-wifi-watch).
sudo -n /usr/bin/systemctl enable --now beast-wifi-telemetry.timer
sudo -n /usr/bin/systemctl restart beast-ros-base
sudo -n /usr/bin/systemctl try-restart beast-cockpit
# Deliberately not: beast-slam
sleep 20
# exit 2 is a deliberate sentinel: everything allowlisted succeeded, but at
# least one binary needs break-glass sudo to install. Any other nonzero rc
# is a real failure and must abort the deploy.
[ "\$pw_gap" -eq 0 ] || exit 2
REMOTE
)

set +e
ssh "${ssh_opts[@]}" "$HOST" "bash -s" <<<"$remote_passwordless"
pw_rc=$?
set -e
if [ "$pw_rc" -eq 0 ]; then
  echo "sudo: passwordless beast-ops path"
elif [ "$pw_rc" -eq 2 ] && resolve_break_glass_sudo; then
  # rc 2 = the remote script's sentinel for "allowlisted work done, but a
  # binary install needs real sudo". Install ALL tree binaries here, then
  # redo the unit install + restarts so the stack runs what was installed.
  echo "sudo: $sudo_pw_source for binary install"
  remote_break_glass="sudo install -m 0755 '$WS_DIR'/deploy/bin/beast-link-watch /usr/local/sbin/beast-link-watch \
    && sudo install -m 0755 '$WS_DIR'/deploy/bin/beast-wifi-watch /usr/local/sbin/beast-wifi-watch \
    && sudo install -m 0755 '$WS_DIR'/deploy/bin/beast-slam-save /usr/local/sbin/beast-slam-save \
    && sudo install -m 0755 '$WS_DIR'/deploy/bin/beast-wifi-telemetry /usr/local/sbin/beast-wifi-telemetry \
    && sudo -n /usr/local/sbin/beast-install-systemd-units \
    && sudo -n systemctl daemon-reload \
    && sudo -n systemctl enable --now beast-wifi-telemetry.timer \
    && sudo -n systemctl try-restart beast-wifi-watch \
    && sudo -n systemctl restart beast-ros-base \
    && sudo -n systemctl try-restart beast-cockpit \
    && sleep 20"
  printf '%s\n' "$sudo_pw" \
    | ssh "${ssh_opts[@]}" "$HOST" "sudo -S -p '' -v && $remote_break_glass"
else
  echo "passwordless deploy failed and no break-glass sudo is available" >&2
  exit 1
fi

say "4/4 post-deploy verification"
if run_verify; then
  say "deploy of $REF verified on $HOST"
  date -u '+Paste into docs/beast-ops.md Quick connect: deploy verified %Y-%m-%dT%H:%MZ'
else
  say "DEPLOYED BUT VERIFICATION FAILED — inspect before relying on the robot"
  exit 1
fi
