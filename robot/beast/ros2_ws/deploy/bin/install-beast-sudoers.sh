#!/bin/bash
# Install scoped passwordless sudo for user `beast` (ops allowlist only).
# Requires a one-time password/Doppler sudo to land; thereafter agents use -n.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/sudoers/beast-ops"
DST=/etc/sudoers.d/beast-ops
HELPER_SRC="$ROOT/bin/beast-install-systemd-units"
HELPER_DST=/usr/local/sbin/beast-install-systemd-units

if [ ! -f "$SRC" ]; then
  echo "missing $SRC" >&2
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
# Strip CR if edited on Windows; sudoers rejects CRLF.
tr -d '\r' < "$SRC" > "$tmp"
visudo -cf "$tmp"

install -m 0755 "$HELPER_SRC" "$HELPER_DST"
install -m 0440 "$tmp" "$DST"
visudo -cf "$DST"
echo "installed $DST and $HELPER_DST"
echo "gate: sudo -n systemctl is-active beast-cockpit && sudo -n tailscale serve status"
