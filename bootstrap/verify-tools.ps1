# Verify local tooling expected by Hangar agents and deployment workflows.
#Requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet("core", "dev", "deploy", "all")]
    [string]$Profile = "all"
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "refresh-windows-path.ps1")
Update-BootstrapPath
. (Join-Path $PSScriptRoot "ToolProfiles.ps1")

$requiredCommands = Get-ToolProfileCommands -SelectedProfile $Profile
Write-Host "Verifying Hangar tooling profile '$Profile'..." -ForegroundColor Cyan

$missingCommands = @()
foreach ($cmd in $requiredCommands) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "OK: $cmd -> $($found.Source)" -ForegroundColor Green
    } else {
        Write-Host "MISSING: $cmd" -ForegroundColor Red
        $missingCommands += $cmd
    }
}

if ($missingCommands.Count -gt 0) {
    throw "Missing required command(s): $($missingCommands -join ', ')"
}
