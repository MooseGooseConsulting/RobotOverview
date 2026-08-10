#Requires -Version 7.0
<#
.SYNOPSIS
  After BEAST power-on: wait for SSH, restore cockpit Serve path, verify WSS.

.DESCRIPTION
  Use when the robot was power-cycled or the Hangar deck shows ROBOT UNREACHABLE
  after an ACL/serve change. Does not deploy code — only restores runtime path:
    beast-ros-base / beast-cockpit → tailscale serve :443 → WSS smoke test.

  Sudo on the robot: BEAST_SUDO_PASSWORD, else Doppler BEAST_JETSON_ADMIN_PASSWORD.
  Prefers beast-01-ts (Tailscale); falls back to LAN aliases.

.PARAMETER HostName
  SSH host override.

.PARAMETER WaitSec
  How long to wait for SSH before giving up (default 180).
#>
[CmdletBinding()]
param(
    [string]$HostName = '',
    [int]$WaitSec = 180,
    [switch]$SkipVerify
)

$ErrorActionPreference = 'Stop'
# Prefer Tailscale SSH — mDNS Host beast-01 often fails from this workstation.
$candidates = @(
    $(if ($HostName) { $HostName } else { $null })
    'beast-01-ts'
    'beast@192.168.0.187'
    'beast-01'
) | Where-Object { $_ } | Select-Object -Unique

function Test-Ssh([string]$Target) {
    & ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new $Target 'echo OK' 2>$null
    return ($LASTEXITCODE -eq 0)
}

Write-Host "Waiting up to ${WaitSec}s for BEAST SSH..."
$deadline = [DateTime]::UtcNow.AddSeconds($WaitSec)
$sshHost = $null
while ([DateTime]::UtcNow -lt $deadline -and -not $sshHost) {
    foreach ($c in $candidates) {
        if (Test-Ssh $c) {
            $sshHost = $c
            break
        }
    }
    if (-not $sshHost) { Start-Sleep -Seconds 5 }
}
if (-not $sshHost) {
    Write-Host "FAIL  no SSH to: $($candidates -join ', ')"
    Write-Host 'HINT  power on, wait for green, confirm Tailscale/LAN, then re-run.'
    exit 1
}
Write-Host "PASS  SSH $sshHost"

# Prefer scoped passwordless sudo (/etc/sudoers.d/beast-ops). Doppler only if -n fails.
$needPw = $true
$probe = & ssh -o BatchMode=yes -o ConnectTimeout=10 $sshHost 'sudo -n true 2>/dev/null; sudo -n systemctl is-active beast-cockpit >/dev/null 2>&1; echo $?'
if ($probe -match '0') {
    $needPw = $false
    Write-Host 'sudo: passwordless beast-ops allowlist'
}

$sudoPw = ''
$sudoSrc = ''
if ($needPw) {
    $sudoPw = $env:BEAST_SUDO_PASSWORD
    $sudoSrc = '$BEAST_SUDO_PASSWORD'
    if ([string]::IsNullOrWhiteSpace($sudoPw) -and (Get-Command doppler -ErrorAction SilentlyContinue)) {
        $sudoPw = doppler secrets get BEAST_JETSON_ADMIN_PASSWORD --project homelab --config dev --plain 2>$null
        if (-not [string]::IsNullOrWhiteSpace($sudoPw)) { $sudoSrc = 'Doppler homelab/dev (break-glass)' }
    }
    if ([string]::IsNullOrWhiteSpace($sudoPw)) {
        Write-Host 'WARN  no sudo password and passwordless sudo unset — Serve/start may fail'
    } else {
        Write-Host "sudo: using $sudoSrc"
    }
}

$remoteBody = @'
set -euo pipefail
ok(){ printf "PASS  %s\n" "$*"; }
bad(){ printf "FAIL  %s\n" "$*"; exit 1; }
warn(){ printf "WARN  %s\n" "$*"; }

systemctl is-active --quiet beast-ros-base && ok "beast-ros-base active" || bad "beast-ros-base not active"
if systemctl is-active --quiet beast-cockpit; then
  ok "beast-cockpit active"
else
  warn "starting beast-cockpit"
  sudo -n systemctl start beast-cockpit 2>/dev/null || sudo systemctl start beast-cockpit
  systemctl is-active --quiet beast-cockpit && ok "beast-cockpit started" || bad "beast-cockpit failed to start"
fi

# restart (not start): RemainAfterExit oneshot ignores start while already active
if systemctl cat beast-cockpit-serve.service >/dev/null 2>&1; then
  sudo -n systemctl restart beast-cockpit-serve.service 2>/dev/null \
    || sudo systemctl restart beast-cockpit-serve.service || true
fi

sudo -n tailscale serve --bg --https=443 http://127.0.0.1:9090 2>/dev/null \
  || sudo tailscale serve --bg --https=443 http://127.0.0.1:9090

sleep 2
ss -ltn 2>/dev/null | awk '{print $4}' | grep -qx '127.0.0.1:9090' \
  && ok "rosbridge on 127.0.0.1:9090" \
  || bad "nothing listening on 127.0.0.1:9090"
serve="$(tailscale serve status 2>/dev/null || true)"
printf '%s\n' "$serve" | grep -q '127.0.0.1:9090' \
  && ok "tailscale serve fronts 9090" \
  || bad "tailscale serve not fronting 9090"
printf '%s\n' "$serve"
'@

$runner = @'
set -euo pipefail
read -r SUDO_PW || true
if [ -n "${SUDO_PW:-}" ]; then
  printf '%s\n' "$SUDO_PW" | sudo -S -p '' -v
fi
exec bash -s
'@

$payload = ($(if ($sudoPw) { $sudoPw } else { '' })) + "`n" + $remoteBody
$payload | & ssh -o BatchMode=yes -o ConnectTimeout=20 $sshHost $runner
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipVerify) {
    $verify = Join-Path $PSScriptRoot 'Verify-Beast-Cockpit.ps1'
    & $verify
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "OK    cockpit path reconnected via $sshHost"
Write-Host 'Open: https://hangar.moosegoose.xyz/cockpit'
exit 0
