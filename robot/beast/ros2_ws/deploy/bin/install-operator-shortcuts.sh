#!/usr/bin/env bash
# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
#
# install-operator-shortcuts.sh - install beast-gamepad + desktop launcher on BEAST-01.
#   BEAST_HOST=beast-01-ts robot/beast/ros2_ws/deploy/bin/install-operator-shortcuts.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BEAST_HOST:-beast-01-ts}"
ssh_opts=(-o ConnectTimeout=10 -o BatchMode=yes)

say() { printf '\n== %s ==\n' "$*"; }

sudo_pw=""
if [ -n "${BEAST_SUDO_PASSWORD:-}" ]; then
  sudo_pw="$BEAST_SUDO_PASSWORD"
elif command -v doppler >/dev/null 2>&1; then
  sudo_pw="$(doppler secrets get BEAST_JETSON_ADMIN_PASSWORD \
    --project homelab --config dev --plain 2>/dev/null || true)"
fi

say "reach $HOST"
ssh "${ssh_opts[@]}" "$HOST" 'echo ok' >/dev/null

say "stage files"
scp "${ssh_opts[@]}" \
  "$ROOT/bin/beast-gamepad" \
  "$ROOT/desktop/beast-gamepad.desktop" \
  "$HOST:/tmp/"

say "install"
# Only gio metadata is best-effort; a failed install must fail the script.
remote='sudo install -m 0755 /tmp/beast-gamepad /usr/local/bin/beast-gamepad \
  && mkdir -p "$HOME/Desktop" \
  && install -m 0755 /tmp/beast-gamepad.desktop "$HOME/Desktop/beast-gamepad.desktop" \
  && { gio set "$HOME/Desktop/beast-gamepad.desktop" metadata::trusted true 2>/dev/null || true; } \
  && echo installed'

if [ -n "$sudo_pw" ]; then
  printf '%s\n' "$sudo_pw" \
    | ssh "${ssh_opts[@]}" "$HOST" "sudo -S -p '' -v && $remote"
else
  ssh -t "$HOST" "sudo -v && $remote"
fi

say "done - plug pad, then beast-gamepad or Desktop → BEAST Gamepad Teleop"
