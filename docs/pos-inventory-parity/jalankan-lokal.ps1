# Uji lokal eBisnis POS Inventory (Windows PowerShell).
# Database: ebisnis / user root / pass root123 (ubah lewat variabel di bawah bila beda).
#
# Cara pakai dari Command Prompt (di dalam folder repo):
#   powershell -ExecutionPolicy Bypass -File docs\pos-inventory-parity\jalankan-lokal.ps1
# Bila Postgres di port 5434:
#   powershell -ExecutionPolicy Bypass -Command "$env:DB_PORT='5434'; & docs\pos-inventory-parity\jalankan-lokal.ps1"
#
# Aman: TIDAK menimpa .env yang sudah ada. Berhenti di langkah pertama yang gagal.

$ErrorActionPreference = 'Stop'

$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { '5432' }   # env.production.example memakai 5434
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { 'ebisnis' }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { 'root' }
$DB_PASS = if ($env:DB_PASS) { $env:DB_PASS } else { 'root123' }

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $RepoRoot
Write-Host "==> Repo: $RepoRoot" -ForegroundColor Cyan

function Invoke-Step([string]$cmd) {
  Write-Host ">> $cmd" -ForegroundColor Yellow
  & cmd /c $cmd
  if ($LASTEXITCODE -ne 0) { throw "Gagal (exit $LASTEXITCODE): $cmd" }
}

function New-Secret([int]$n) {
  $b = New-Object byte[] $n
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  [Convert]::ToBase64String($b)
}

function Write-EnvFile([string]$target) {
  if (Test-Path $target) { Write-Host "    $target sudah ada - tidak ditimpa." ; return }
  $jwtA = New-Secret 48 ; $jwtR = New-Secret 48 ; $enc = New-Secret 32
  $content = @"
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=platform
DIRECT_DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=platform
DATABASE_ADMIN_URL=postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}
JWT_ACCESS_SECRET=$jwtA
JWT_REFRESH_SECRET=$jwtR
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
PLATFORM_SCHEMA=platform
PLATFORM_AUDIT_SCHEMA=platform__audit
DEMO_SCHEMA=demo
DEMO_AUDIT_SCHEMA=demo__audit
TENANT_SCHEMA_SUFFIX_AUDIT=__audit
TENANT_SCHEMA_BASE_MAX_LENGTH=48
CREDENTIAL_ENCRYPTION_KEYS=prod1:$enc
CREDENTIAL_ENCRYPTION_ACTIVE_KEY=prod1
BOOTSTRAP_SUPER_ADMIN_USERNAME=admin
BOOTSTRAP_SUPER_ADMIN_PASSWORD=admin123
BOOTSTRAP_SUPER_ADMIN_FORCE_PASSWORD_CHANGE=false
DEFAULT_LOCALE=id
SUPPORTED_LOCALES=id,en
APP_URL=http://localhost:5173
WEB_URL=http://localhost:5173
LOG_LEVEL=info
"@
  Set-Content -Path $target -Value $content -Encoding ascii
  Write-Host "    $target dibuat."
}

Write-Host "==> 1/6  Toolchain (Node 22 + pnpm 9.15.4)" -ForegroundColor Cyan
node -v
Invoke-Step "corepack enable"
Invoke-Step "corepack prepare pnpm@9.15.4 --activate"
Invoke-Step "pnpm -v"

Write-Host "==> 2/6  .env (root + apps\api, dibuat bila belum ada)" -ForegroundColor Cyan
Write-EnvFile (Join-Path $RepoRoot '.env')
Write-EnvFile (Join-Path $RepoRoot 'apps\api\.env')

Write-Host "==> 3/6  Install dependency" -ForegroundColor Cyan
Invoke-Step "pnpm install --frozen-lockfile"

Write-Host "==> 4/6  Gate statik (lint + test + build)" -ForegroundColor Cyan
Invoke-Step "pnpm check"

Write-Host "==> 5/6  Database: generate + migrate + tenant + verifikasi seed" -ForegroundColor Cyan
Invoke-Step "pnpm db:validate"
Invoke-Step "pnpm db:generate"
Invoke-Step "pnpm db:deploy"
Invoke-Step "pnpm migrate:tenants"
Write-Host ">> pnpm seed:verify" -ForegroundColor Yellow
& cmd /c "pnpm seed:verify"
if ($LASTEXITCODE -ne 0) { Write-Host "    (seed:verify memberi peringatan - periksa keluarannya)" -ForegroundColor DarkYellow }

Write-Host "==> 6/6  SELESAI" -ForegroundColor Green
Write-Host "    Nyalakan aplikasi:  pnpm dev"
Write-Host "    Web: http://localhost:5173   API: http://localhost:3000"
Write-Host "    Login super admin: admin / admin123"
Write-Host ""
Write-Host "    Prasyarat Postgres: database '$DB_NAME' sudah ada dan role '$DB_USER' punya hak CREATE."
Write-Host "    Contoh buat DB:  psql -U postgres -c ""CREATE DATABASE $DB_NAME OWNER $DB_USER;"""
