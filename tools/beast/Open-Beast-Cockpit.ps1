# Open the Hangar Command Deck for BEAST-01 in the default browser.
# Requires: workstation on the tailnet (or network path that reaches Hangar),
# and beast-cockpit.service + tailscale serve on the robot.
$url = "https://hangar.moosegoose.xyz/cockpit"
Start-Process $url
Write-Host "Opened $url"
Write-Host "Bridge default: wss://beast-01.tyrannosaurus-magellanic.ts.net/"
Write-Host "If DISCONNECTED: ssh beast-01-ts 'systemctl is-active beast-cockpit'"
