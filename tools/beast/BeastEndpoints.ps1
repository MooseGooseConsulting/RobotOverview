<#
.SYNOPSIS
  Shared BEAST-01 cockpit endpoint constants for tools/beast/*.ps1.

.DESCRIPTION
  Single source of truth for the rosbridge WSS bridge URL and the Hangar
  cockpit page URL, so a tailnet rename or Hangar path change touches one
  file instead of every tools/beast/*.ps1 script. Dot-source it:

    . "$PSScriptRoot/BeastEndpoints.ps1"

  Mirrors src/lib/beast-constants.ts (BEAST_COCKPIT_WS_URL_DEFAULT) on the
  Hangar web app side — keep both in sync if the tailnet hostname changes.
  This file only defines values/functions; it has no side effects and is
  safe to dot-source from any script or an interactive shell.
#>

# Tailscale Serve MagicDNS WSS default for the BEAST-01 rosbridge.
$BeastCockpitWsUrlDefault = 'wss://beast-01.tyrannosaurus-magellanic.ts.net/'

# Hangar Command Deck cockpit page (workstation-facing, not robot-facing).
$HangarCockpitUrl = 'https://hangar.moosegoose.xyz/cockpit'

function Get-BeastCockpitWsUrl {
    <#
    .SYNOPSIS
      Resolve the rosbridge WSS URL.

    .DESCRIPTION
      Returns $env:BEAST_COCKPIT_WS_URL (trimmed) when set, else
      $BeastCockpitWsUrlDefault. Mirrors resolveBeastCockpitWsUrl() in
      src/lib/beast-constants.ts.
    #>
    [CmdletBinding()]
    param()
    if (-not [string]::IsNullOrWhiteSpace($env:BEAST_COCKPIT_WS_URL)) {
        return $env:BEAST_COCKPIT_WS_URL.Trim()
    }
    return $BeastCockpitWsUrlDefault
}
