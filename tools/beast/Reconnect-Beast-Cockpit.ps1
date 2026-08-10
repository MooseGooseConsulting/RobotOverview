#Requires -Version 7.0
<#
.SYNOPSIS
  After BEAST power-on: wait for SSH, restore cockpit Serve path, verify WSS.

.DESCRIPTION
  Use when the robot was power-cycled or the Hangar deck shows ROBOT UNREACHABLE
  after an ACL/serve change. Does not deploy code — only restores runtime path:
    beast-ros-base / beast-cockpit → tailscale serve :443 → WSS smoke test.

  Sudo on the robot: BEAST_SUDO_PASSWORD, else Doppler BEAST_JETSON_ADMIN_PASSWORD.

.PARAMETER HostName
  SSH host (default tries beast-01-ts, then beast-01, then beast@192.168.0.187).

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
$candidates = @(
    $(if ($HostName) { $HostName } else { $null })
    'beast-01-ts'
    'beast-01'
    'beast@192.168.0.187'
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

$sudoPw = $env:BEAST_SUDO_PASSWORD
$sudoSrc = '$BEAST_SUDO_PASSWORD'
if ([string]::IsNullOrWhiteSpace($sudoPw) -and (Get-Command doppler -ErrorAction SilentlyContinue)) {
    $sudoPw = doppler secrets get BEAST_JETSON_ADMIN_PASSWORD --project homelab --config dev --plain 2>$null
    if (-not [string]::IsNullOrWhiteSpace($sudoPw)) { $sudoSrc = 'Doppler homelab/dev' }
}
if ([string]::IsNullOrWhiteSpace($sudoPw)) {
    Write-Host 'WARN  no sudo password — Serve/start may fail if passwordless sudo is unset'
} else {
    Write-Host "sudo: using $sudoSrc"
}

$remoteFile = Join-Path ([System.IO.Path]::GetTempPath()) ("beast-reconnect-{0}.sh" -f [guid]::NewGuid().ToString('n'))
@'
set -euo pipefail
ok(){ printf "PASS  %s\n" "$*"; }
bad(){ printf "FAIL  %s\n" "$*"; exit 1; }
warn(){ printf "WARN  %s\n" "$*"; }

systemctl is-active --quiet beast-ros-base && ok "beast-ros-base active" || bad "beast-ros-base not active"
if systemctl is-active --quiet beast-cockpit; then
  ok "beast-cockpit active"
else
  warn "starting beast-cockpit"
  sudo systemctl start beast-cockpit
  systemctl is-active --quiet beast-cockpit && ok "beast-cockpit started" || bad "beast-cockpit failed to start"
fi

if systemctl cat beast-cockpit-serve.service >/dev/null 2>&1; then
  sudo systemctl start beast-cockpit-serve.service || true
fi

sudo tailscale serve --bg --https=443 http://127.0.0.1:9090

sleep 2
ss -ltn 2>/dev/null | awk '{print $4}' | grep -qx '127.0.0.1:9090' \
  && ok "rosbridge on 127.0.0.1:9090" \
  || bad "nothing listening on 127.0.0.1:9090"
serve="$(tailscale serve status 2>/dev/null || true)"
printf '%s\n' "$serve" | grep -q '127.0.0.1:9090' \
  && ok "tailscale serve fronts 9090" \
  || bad "tailscale serve not fronting 9090"
printf '%s\n' "$serve"
'@ | Set-Content -LiteralPath $remoteFile -Encoding utf8NoBOM

try {
    if (-not [string]::IsNullOrWhiteSpace($sudoPw)) {
        # Cache sudo timestamp on the robot (password on stdin only), then run restore.
        $sudoPw | & ssh -o BatchMode=yes -o ConnectTimeout=15 $sshHost "sudo -S -p '' -v"
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'FAIL  sudo -v on robot failed'
            exit 1
        }
    }
    Get-Content -LiteralPath $remoteFile -Raw | & ssh -o BatchMode=yes -o ConnectTimeout=20 $sshHost 'bash -s'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Remove-Item -LiteralPath $remoteFile -Force -ErrorAction SilentlyContinue
}

if (-not $SkipVerify) {
    $verify = Join-Path $PSScriptRoot 'Verify-Beast-Cockpit.ps1'
    & $verify
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "OK    cockpit path reconnected via $sshHost"
Write-Host 'Open: https://hangar.moosegoose.xyz/cockpit'
exit 0
