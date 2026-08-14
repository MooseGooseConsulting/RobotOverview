# Install/verify local workstation tooling for Hangar agents and deploy-adjacent work.
# This intentionally does not install or run Docker/Podman/container tooling.
#Requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$VerifyOnly,
    [switch]$SkipProjectDependencies,
    [ValidateSet("core", "dev", "deploy", "all")]
    [string]$Profile = "all"
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "refresh-windows-path.ps1")
Update-BootstrapPath
. (Join-Path $PSScriptRoot "ToolProfiles.ps1")

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Get-ProfilePackages([string]$SelectedProfile) {
    # Only entries with a winget Id are installable here; commands like
    # node/npm/pwsh are verify-only (see ToolProfiles.ps1).
    return @(Get-ToolProfileEntries -SelectedProfile $SelectedProfile | Where-Object { $_.Id })
}

function Install-WingetPackageIfMissing([string]$Command, [string]$PackageId) {
    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Host "OK: $Command already installed." -ForegroundColor Green
        return
    }

    if (-not $IsWindows) {
        throw "$Command is missing. Automatic install is only wired for Windows; install package '$PackageId' with your OS package manager."
    }

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$Command is missing and winget is not available to install '$PackageId'."
    }

    Write-Host "Installing $PackageId for missing command '$Command'..." -ForegroundColor Cyan
    winget install --id $PackageId --silent --accept-source-agreements --accept-package-agreements
    Update-BootstrapPath

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Installed '$PackageId', but '$Command' is still not visible on PATH."
    }
}

if (-not $VerifyOnly) {
    $packages = Get-ProfilePackages -SelectedProfile $Profile
    foreach ($pkg in $packages) {
        Install-WingetPackageIfMissing -Command $pkg.Command -PackageId $pkg.Id
    }

    if (-not $SkipProjectDependencies -and ($Profile -eq "core" -or $Profile -eq "all")) {
        Push-Location $repoRoot
        try {
            if (-not (Test-Path "node_modules")) {
                Write-Host "Installing project dependencies with npm ci..." -ForegroundColor Cyan
                npm ci
            } else {
                Write-Host "OK: node_modules already present." -ForegroundColor Green
            }
        } finally {
            Pop-Location
        }
    }
}

& (Join-Path $PSScriptRoot "verify-tools.ps1") -Profile $Profile
