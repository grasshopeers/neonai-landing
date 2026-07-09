# Kill any existing NeonAi bot processes, then start one instance
$existing = Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -match 'src/bot\.ts' }

foreach ($proc in $existing) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}

Set-Location $PSScriptRoot\..
npm run bot
