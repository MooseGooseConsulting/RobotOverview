# Open the Hangar Command Deck for BEAST-01 in the default browser.
# Requires: workstation on the tailnet (or network path that reaches Hangar),
# and beast-cockpit.service + tailscale serve on the robot.
#
# Optional: -Verify runs tools/beast/Verify-Beast-Cockpit.ps1 first (TCP 443 + WSS).
[CmdletBinding()]
param(
    [switch]$Verify,
    [switch]$SkipOpen
)

$ErrorActionPreference = 'Stop'
$url = 'https://hangar.moosegoose.xyz/cockpit'
$bridge = if (-not [string]::IsNullOrWhiteSpace($env:BEAST_COCKPIT_WS_URL)) {
    $env:BEAST_COCKPIT_WS_URL.Trim()
} else {
    'wss://beast-01.tyrannosaurus-magellanic.ts.net/'
}

$hangarDefaultBridge = 'wss://beast-01.tyrannosaurus-magellanic.ts.net/'
$verifyScript = Join-Path $PSScriptRoot 'Verify-Beast-Cockpit.ps1'
if ($Verify) {
    # Hangar /cockpit uses the *deployed* server env, not this workstation.
    # Default matches Hangar; if BEAST_COCKPIT_WS_URL is set locally, still
    # smoke-test the Hangar default so -Verify matches what the browser opens.
    $verifyUrl = if ($env:BEAST_COCKPIT_WS_URL) { $hangarDefaultBridge } else { $bridge }
    if ($verifyUrl -ne $bridge) {
        Write-Host "WARN  verifying Hangar default ($verifyUrl); local BEAST_COCKPIT_WS_URL=$bridge"
    }
    & $verifyScript -WsUrl $verifyUrl
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Bridge verify failed — not opening Hangar. Fix ACL/serve/cockpit, then retry.'
        exit $LASTEXITCODE
    }
}

if (-not $SkipOpen) {
    Start-Process $url
    Write-Host "Opened $url"
}

Write-Host "Hangar page: $url (bridge from Hangar server env; default $hangarDefaultBridge)"
Write-Host "Workstation bridge hint: $bridge"
Write-Host "Smoke test: pwsh -File $verifyScript"
Write-Host "If ROBOT UNREACHABLE but ssh beast-01-ts works: tag:robot ACL needs tcp:443 + tailscale serve."
Write-Host "On robot: systemctl is-active beast-cockpit; sudo -n systemctl restart beast-cockpit-serve"
