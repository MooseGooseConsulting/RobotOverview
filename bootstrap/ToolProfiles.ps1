<#
.SYNOPSIS
  Shared tool-profile data for bootstrap/install-tools.ps1 and bootstrap/verify-tools.ps1.

.DESCRIPTION
  Single source of truth for the core/dev/deploy tool profiles, so a tool
  added to install but not verify (or vice versa) can't silently happen.
  Each entry has a Command (what Get-Command checks) and an Id (winget
  package id; $null when install-tools.ps1 does not install this command
  itself — e.g. node/npm/pwsh are expected to already be present via other
  tooling, but verify-tools.ps1 still checks for them).

  Dot-source this file, then use the helper functions below:

    . (Join-Path $PSScriptRoot "ToolProfiles.ps1")
    Get-ToolProfileEntries -SelectedProfile "core"   # Command+Id pairs (installable only when Id is set)
    Get-ToolProfileCommands -SelectedProfile "core"  # Command names only, full profile
#>

$ToolProfiles = [ordered]@{
    core = @(
        @{ Command = "git"; Id = "Git.Git" },
        @{ Command = "node"; Id = $null },
        @{ Command = "npm"; Id = $null },
        @{ Command = "pwsh"; Id = $null },
        @{ Command = "task"; Id = "Task.Task" }
    )
    dev = @(
        @{ Command = "gh"; Id = "GitHub.cli" },
        @{ Command = "gitleaks"; Id = "Gitleaks.Gitleaks" }
    )
    deploy = @(
        @{ Command = "kubectl"; Id = "Kubernetes.kubectl" }
    )
}

function Get-ToolProfileEntries([string]$SelectedProfile) {
    if ($SelectedProfile -eq "all") {
        return @($ToolProfiles.core + $ToolProfiles.dev + $ToolProfiles.deploy)
    }

    return @($ToolProfiles[$SelectedProfile])
}

function Get-ToolProfileCommands([string]$SelectedProfile) {
    return @(Get-ToolProfileEntries -SelectedProfile $SelectedProfile | ForEach-Object { $_.Command })
}
