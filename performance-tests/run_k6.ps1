# =============================================================================
# Reicrew AI — Progressive k6 Load Test Runner (Windows PowerShell)
# =============================================================================
# Runs k6 at progressive concurrency levels: smoke → 10 → 25 → 50 → 100
#
# Usage:
#   .\performance-tests\run_k6.ps1
#
# Prerequisites:
#   1. Install k6: winget install k6  OR  download from https://grafana.com/docs/k6/latest/get-started/installation/
#   2. Create performance-tests\config.env (see config.env.example)
# =============================================================================

param(
    [string]$ConfigFile = "performance-tests\config.env",
    [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResultsDir = Join-Path $ScriptDir "results\k6"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$FullResultsDir = Join-Path $ResultsDir $Timestamp

Write-Host ""
Write-Host "╔" -NoNewline -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -NoNewline -ForegroundColor Cyan
Write-Host "╗" -ForegroundColor Cyan
Write-Host "║   Reicrew AI — Database & Backend Load Test Suite   ║" -ForegroundColor Cyan
Write-Host "��" -NoNewline -ForegroundColor Cyan
Write-Host "═���════════════════════════════════════════════════════" -NoNewline -ForegroundColor Cyan
Write-Host "╣" -ForegroundColor Cyan
Write-Host "║  Stages: smoke → 10 → 25 → 50 → 100 concurrent VUs ║" -ForegroundColor Cyan
Write-Host "║  Results: $FullResultsDir ║" -ForegroundColor Cyan
Write-Host "╚" -NoNewline -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -NoNewline -ForegroundColor Cyan
Write-Host "╝" -ForegroundColor Cyan
Write-Host ""

# Load config.env
if (-not (Test-Path $ConfigFile)) {
    Write-Host "❌ Config file not found: $ConfigFile" -ForegroundColor Red
    Write-Host "   Copy config.env.example to config.env and fill in your values." -ForegroundColor Yellow
    exit 1
}

Write-Host "📄 Loading config from $ConfigFile"
Get-Content $ConfigFile | ForEach-Object {
    if ($_ -match '^\s*([^#].+?)\s*=\s*(.+?)\s*$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

# Validate
$supabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
$anonKey = [Environment]::GetEnvironmentVariable("SUPABASE_ANON_KEY")
$serviceKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_KEY")

if (-not $serviceKey -and -not $anonKey) {
    Write-Host "❌ SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY must be set in config.env" -ForegroundColor Red
    exit 1
}

# Check if k6 is installed
$k6Path = (Get-Command "k6" -ErrorAction SilentlyContinue).Source
if (-not $k6Path) {
    Write-Host "❌ k6 is not installed. Install it first:" -ForegroundColor Red
    Write-Host "   winget install k6" -ForegroundColor Yellow
    Write-Host "   Or download from: https://grafana.com/docs/k6/latest/get-started/installation/" -ForegroundColor Yellow
    exit 1
}

# Create results directory
New-Item -ItemType Directory -Force -Path $FullResultsDir | Out-Null

# Define stages
$Stages = @("smoke", "10", "25", "50", "100")
if ($SkipSmoke) {
    $Stages = @("10", "25", "50", "100")
}

$TestScript = Join-Path $ScriptDir "k6_load_test.js"

foreach ($Stage in $Stages) {
    Write-Host ""
    Write-Host ("─" * 50) -ForegroundColor DarkGray
    Write-Host "  ▶ Stage: $Stage concurrent virtual users" -ForegroundColor Green
    Write-Host ("─" * 50) -ForegroundColor DarkGray
    Write-Host ""

    $outputJson = Join-Path $FullResultsDir "stage_${Stage}.json"
    $outputSummary = Join-Path $FullResultsDir "stage_${Stage}_summary.json"
    $outputLog = Join-Path $FullResultsDir "stage_${Stage}.log"

    & k6 run `
        --out "json=$outputJson" `
        --summary-export="$outputSummary" `
        -e "STAGE=$Stage" `
        -e "SUPABASE_URL=$supabaseUrl" `
        -e "SUPABASE_ANON_KEY=$anonKey" `
        -e "SUPABASE_SERVICE_KEY=$serviceKey" `
        $TestScript 2>&1 | Tee-Object -FilePath $outputLog

    Write-Host ""
    Write-Host "  ✓ Stage $Stage complete." -ForegroundColor Green
    Write-Host ""
}

Write-Host ""
Write-Host "╔" -NoNewline -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -NoNewline -ForegroundColor Cyan
Write-Host "╗" -ForegroundColor Cyan
Write-Host "║                    COMPLETE                        ║" -ForegroundColor Cyan
Write-Host "║  All results saved to: $FullResultsDir  ║" -ForegroundColor Cyan
Write-Host "╚" -NoNewline -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -NoNewline -ForegroundColor Cyan
Write-Host "╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Load testing complete." -ForegroundColor Green
