param(
  [switch]$SkipStart
)

$ErrorActionPreference = "Stop"
$taskName = "NeonAi-TicketBot"
$discordDir = Split-Path $PSScriptRoot -Parent
$logFile = Join-Path $discordDir "ticket-bot.log"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js not found"
}

$cmd = 'cd /d "' + $discordDir + '" && npm run ticket-bot >> "' + $logFile + '" 2>&1'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $cmd" -WorkingDirectory $discordDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

if (-not $SkipStart) {
  $running = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'ticket-bot' }
  if ($running) {
    Write-Host ("Ticket bot already running (PID " + $running.ProcessId + "). Task registered for next logon.")
  } else {
    Start-ScheduledTask -TaskName $taskName
    Write-Host ("Scheduled task " + $taskName + " registered and started.")
  }
} else {
  Write-Host ("Scheduled task " + $taskName + " registered (starts at next logon).")
}

Write-Host ("Logs: " + $logFile)
