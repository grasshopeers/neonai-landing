#!/usr/bin/env pwsh
# Build and deploy NeonAi landing to Cloudflare Pages
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "[..] Building site..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[..] Deploying to Cloudflare Pages (neonai-landing)..."
wrangler pages deploy dist --project-name neonai-landing --commit-dirty=true
exit $LASTEXITCODE
