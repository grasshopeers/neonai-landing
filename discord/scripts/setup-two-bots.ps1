# Two-bot setup: ticket bot 24/7 + staff bot on your PC
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== NeonAi Two-Bot Setup ===`n" -ForegroundColor Cyan

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example — fill in tokens first.`n"
}

$envContent = Get-Content .env -Raw
if ($envContent -notmatch 'DISCORD_TICKET_BOT_TOKEN=(.+)' -or $Matches[1].Trim() -eq '' -or $Matches[1] -match 'your_ticket') {
  Write-Host @"
STEP 1 — Create the ticket bot (one-time):
  • Open https://discord.com/developers/applications
  • New Application → name it "NeonAi Tickets"
  • Bot → Reset Token → copy the token
  • Enable: Server Members Intent + Message Content Intent

"@ -ForegroundColor Yellow

  $ticketToken = Read-Host "Paste DISCORD_TICKET_BOT_TOKEN here"
  if ([string]::IsNullOrWhiteSpace($ticketToken)) {
    Write-Host "No token entered. Aborting." -ForegroundColor Red
    exit 1
  }

  if ($envContent -match 'DISCORD_TICKET_BOT_TOKEN=') {
    $envContent = $envContent -replace 'DISCORD_TICKET_BOT_TOKEN=.*', "DISCORD_TICKET_BOT_TOKEN=$ticketToken"
  } else {
    $envContent = "$envContent`nDISCORD_TICKET_BOT_TOKEN=$ticketToken`n"
  }
  Set-Content .env $envContent.TrimEnd()
  Write-Host "✓ Saved ticket bot token to .env`n" -ForegroundColor Green
}

Write-Host "STEP 2 — Verify ticket bot invite..." -ForegroundColor Cyan
npm run discover-ticket-bot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nSTEP 3 — Delete OLD verify/ticket panels from the main NeonAi bot in Discord," -ForegroundColor Yellow
Write-Host "        then press Enter to repost panels with the ticket bot..."
Read-Host

Write-Host "`nReposting panels..." -ForegroundColor Cyan
npm run repost-panels
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host @"

STEP 4 — Deploy ticket bot 24/7 (pick one):
  • Render: https://dashboard.render.com → New → Blueprint → connect GitHub repo
    Use discord/render.yaml (Worker, not Web Service)
  • Or keep running locally: npm run ticket-bot

STEP 5 — Staff commands on your PC:
  npm run bot

"@ -ForegroundColor Green

$start = Read-Host "Start ticket bot locally now? (y/n)"
if ($start -eq 'y') {
  npm run ticket-bot
}
