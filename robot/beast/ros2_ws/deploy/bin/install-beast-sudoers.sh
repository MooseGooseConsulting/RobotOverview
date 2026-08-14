#!/bin/bash
# Install scoped passwordless sudo for user `beast` (ops allowlist only).
# Requires a one-time password/Doppler sudo to land; thereafter agents use -n.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/sudoers/beast-ops"
DST=/etc/sudoers.d/beast-ops
HELPER_SRC="$ROOT/bin/beast-install-systemd-units"
HELPER_DST=/usr/local/sbin/beast-install-systemd-units
CTL_SRC="$ROOT/bin/beast-ctl"
CTL_DST=/usr/local/sbin/beast-ctl

if [ ! -f "$SRC" ]; then
  echo "missing $SRC" >&2
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
# Strip CR if edited on Windows; sudoers rejects CRLF.
tr -d '\r' < "$SRC" > "$tmp"
visudo -cf "$tmp"

for src in "$HELPER_SRC" "$CTL_SRC"; do
  [ -f "$src" ] || { echo "missing $src" >&2; exit 1; }
done

# Order matters: the helpers must exist BEFORE the sudoers file that names
# them, or there is a window where every `sudo -n` in the deploy path resolves
# to a missing binary and falls through to a password prompt on a headless
# robot. Root-owned /usr/local/sbin, never the repo checkout — /home/beast is
# writable by `beast`, so allowlisting a path under it would hand that user
# root the moment it edits its own script.
install -m 0755 -o root -g root "$HELPER_SRC" "$HELPER_DST"
install -m 0755 -o root -g root "$CTL_SRC" "$CTL_DST"
install -m 0440 "$tmp" "$DST"
visudo -cf "$DST"
echo "installed $DST, $HELPER_DST, $CTL_DST"
echo "gate: sudo -n /usr/local/sbin/beast-ctl is-active beast-cockpit && sudo -n tailscale serve status"
