$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "NeonAi tickets"
Write-Host "Folder: $PSScriptRoot"
Write-Host ""

$procIds = New-Object System.Collections.Generic.List[int]

try {
  $listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop
  foreach ($listener in $listeners) {
    if ($listener.OwningProcess -and $listener.OwningProcess -ne 0) {
      $procIds.Add([int]$listener.OwningProcess)
    }
  }
} catch {
  Write-Host "Port lookup needs another method: $($_.Exception.Message)"
}

netstat -ano | ForEach-Object {
  if ($_ -match ":3000\s+\S+\s+LISTENING\s+(\d+)\s*$") {
    $procIds.Add([int]$Matches[1])
  }
}

Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  if ($_.CommandLine -match "cloud-bots") {
    $procIds.Add([int]$_.ProcessId)
  }
}

$unique = $procIds | Where-Object { $_ -gt 0 } | Select-Object -Unique
if (-not $unique) {
  Write-Host "No bot was running. Starting one."
} else {
  foreach ($procId in $unique) {
    Write-Host "Stopping process $procId"
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
    } catch {
      Write-Host ""
      Write-Host "Could not stop process $procId."
      Write-Host $_.Exception.Message
      Write-Host "Right-click start-tickets.bat and choose Run as administrator."
      exit 1
    }
  }
  Start-Sleep -Seconds 2
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "npm was not found. Install Node.js, then open a new window and try again."
  exit 1
}

Write-Host ""
Write-Host "Starting NeonAi tickets. Leave this window open."
Write-Host ""
& npm.cmd run cloud-bots
$code = $LASTEXITCODE
if ($code -ne 0) {
  Write-Host ""
  Write-Host "The bot exited with code $code."
  exit $code
}
