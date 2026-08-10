#Requires -Version 7.0
<#
.SYNOPSIS
  Verify Hangar can reach BEAST-01 cockpit rosbridge over Tailscale Serve (WSS).

.DESCRIPTION
  Catches the failure mode where Tailscale SSH still works but Command Deck shows
  ROBOT UNREACHABLE because tag:robot ACL lacks tcp:443, serve is down, or
  beast-cockpit is inactive.

.PARAMETER WsUrl
  Rosbridge WebSocket URL. Defaults to BEAST_COCKPIT_WS_URL or the Hangar default.

.PARAMETER SkipTopic
  Only check TCP/WSS handshake; do not wait for /cockpit/status.

.PARAMETER TimeoutSec
  Per-step timeout (default 10).
#>
[CmdletBinding()]
param(
    [string]$WsUrl = '',
    [switch]$SkipTopic,
    [int]$TimeoutSec = 10
)

$ErrorActionPreference = 'Stop'
$script:fail = 0

function Write-Pass([string]$Message) { Write-Host "PASS  $Message" }
function Write-Fail([string]$Message) { Write-Host "FAIL  $Message"; $script:fail = 1 }
function Write-Warn([string]$Message) { Write-Host "WARN  $Message" }

if ([string]::IsNullOrWhiteSpace($WsUrl)) {
    $WsUrl = if (-not [string]::IsNullOrWhiteSpace($env:BEAST_COCKPIT_WS_URL)) {
        $env:BEAST_COCKPIT_WS_URL.Trim()
    } else {
        'wss://beast-01.tyrannosaurus-magellanic.ts.net/'
    }
}

$uri = [Uri]$WsUrl
$hostName = $uri.Host
$port = if ($uri.Port -gt 0) { $uri.Port } else { if ($uri.Scheme -eq 'wss') { 443 } else { 80 } }

Write-Host "Verify BEAST cockpit bridge: $WsUrl"

# --- TCP ---
try {
    $tcp = [System.Net.Sockets.TcpClient]::new()
    $iar = $tcp.BeginConnect($hostName, $port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne([TimeSpan]::FromSeconds($TimeoutSec))) {
        $tcp.Close()
        Write-Fail "TCP ${hostName}:${port} timed out after ${TimeoutSec}s"
        Write-Warn "Differential: if ssh beast-01-ts works → ACL missing tcp:443 or serve down."
        Write-Warn "If SSH also times out → robot/tailscaled offline (not an ACL regression)."
        Write-Warn "ACL: doppler run --project homelab --config dev -- pwsh -File scripts/Verify-BeastCockpitAcl.ps1"
        Write-Warn "Serve: sudo systemctl start beast-cockpit-serve  (or beast-01-serve.sh)"
        exit 1
    }
    $tcp.EndConnect($iar)
    $tcp.Close()
    Write-Pass "TCP ${hostName}:${port} open"
} catch {
    Write-Fail "TCP ${hostName}:${port} failed: $($_.Exception.Message)"
    Write-Warn "If ssh beast-01-ts works, check tag:robot ACL includes tcp:443 and tailscale serve on the robot."
    exit 1
}

# --- WSS + optional /cockpit/status ---
Add-Type -AssemblyName System.Net.Http | Out-Null
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$cts = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds($TimeoutSec))
try {
    $connectTask = $ws.ConnectAsync($uri, $cts.Token)
    if (-not $connectTask.Wait([TimeSpan]::FromSeconds($TimeoutSec))) {
        Write-Fail "WSS handshake timed out"
        exit 1
    }
    $connectTask.GetAwaiter().GetResult()
    Write-Pass "WSS connected"
} catch {
    Write-Fail "WSS connect failed: $($_.Exception.Message)"
    Write-Warn "On robot: systemctl is-active beast-cockpit; tailscale serve status"
    Write-Warn "Serve recipe: infra/network/tailscale/beast-01-serve.sh (coldaine-homelab)"
    try { $ws.Dispose() } catch {}
    exit 1
}

if (-not $SkipTopic) {
    # Prefer /ugv/voltage — always on when beast-ros-base is healthy.
    # /cockpit/status is 1 Hz DiagnosticArray; rosbridge historically choked on
    # wrong msg packages and byte level fields in some clients.
    $subscribe = @{
        op    = 'subscribe'
        id    = 'verify-voltage'
        topic = '/ugv/voltage'
        type  = 'sensor_msgs/msg/BatteryState'
    } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($subscribe)
    $segment = [ArraySegment[byte]]::new($bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()

    $buffer = [byte[]]::new(65536)
    $got = $false
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
    while ([DateTime]::UtcNow -lt $deadline -and -not $got) {
        $recvCts = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(2))
        try {
            $recvSeg = [ArraySegment[byte]]::new($buffer)
            $result = $ws.ReceiveAsync($recvSeg, $recvCts.Token).GetAwaiter().GetResult()
            $text = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
            # rosbridge JSON-escapes slashes: "\/ugv\/voltage"
            if ($text -match 'ugv(?:\\/|/)voltage' -and $text -match '"op"\s*:\s*"publish"') {
                $got = $true
                Write-Pass '/ugv/voltage published over bridge'
            } elseif ($text -match '"op"\s*:\s*"status"' -and $text -match 'error|Error|refused|Unable') {
                Write-Fail "rosbridge status error: $($text.Substring(0, [Math]::Min(180, $text.Length)))"
                break
            }
        } catch {
            # receive timeout — keep waiting until deadline
        } finally {
            $recvCts.Dispose()
        }
    }
    if (-not $got -and $script:fail -eq 0) {
        Write-Fail "/ugv/voltage not received within ${TimeoutSec}s (bridge allowlist / beast_power?)"
    }
}

try {
    $ws.CloseAsync(
        [System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure,
        'verify done',
        [System.Threading.CancellationToken]::None
    ).Wait(2000) | Out-Null
} catch {}
$ws.Dispose()

if ($script:fail -ne 0) { exit 1 }
Write-Host 'OK    beast cockpit path ready'
exit 0
