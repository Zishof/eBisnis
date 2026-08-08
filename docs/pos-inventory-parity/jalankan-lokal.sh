#!/usr/bin/env bash
#
# Uji lokal eBisnis POS Inventory.
# Database: ebisnis / user root / pass root123 (ubah lewat variabel di bawah bila beda).
#
# Cara pakai (dari root repo):
#   bash docs/pos-inventory-parity/jalankan-lokal.sh
#
# Aman: TIDAK menimpa .env yang sudah ada. Berhenti di langkah pertama yang gagal.
#
set -Eeuo pipefail

# ---- Konfigurasi DB (ubah bila perlu) ----
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"        # env.production.example memakai 5434; sesuaikan dengan Postgres Anda
DB_NAME="${DB_NAME:-ebisnis}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root123}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"
echo "==> Repo: $REPO_ROOT"

echo "==> 1/6  Toolchain (Node 22 + pnpm 9.15.4)"
node -v
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm -v

write_env() {
  local target="$1"
  if [[ -f "$target" ]]; then
    echo "    $target sudah ada — tidak ditimpa."
    return
  fi
  local JWT_A JWT_R ENC
  JWT_A="$(openssl rand -base64 48 | tr -d '\n')"
  JWT_R="$(openssl rand -base64 48 | tr -d '\n')"
  ENC="$(openssl rand -base64 32 | tr -d '\n')"
  cat > "$target" <<EOF
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?schema=platform
DIRECT_DATABASE_URL=postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?schema=platform
DATABASE_ADMIN_URL=postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME
JWT_ACCESS_SECRET=$JWT_A
JWT_REFRESH_SECRET=$JWT_R
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
PLATFORM_SCHEMA=platform
PLATFORM_AUDIT_SCHEMA=platform__audit
DEMO_SCHEMA=demo
DEMO_AUDIT_SCHEMA=demo__audit
TENANT_SCHEMA_SUFFIX_AUDIT=__audit
TENANT_SCHEMA_BASE_MAX_LENGTH=48
CREDENTIAL_ENCRYPTION_KEYS=prod1:$ENC
CREDENTIAL_ENCRYPTION_ACTIVE_KEY=prod1
BOOTSTRAP_SUPER_ADMIN_USERNAME=admin
BOOTSTRAP_SUPER_ADMIN_PASSWORD=admin123
BOOTSTRAP_SUPER_ADMIN_FORCE_PASSWORD_CHANGE=false
DEFAULT_LOCALE=id
SUPPORTED_LOCALES=id,en
APP_URL=http://localhost:5173
WEB_URL=http://localhost:5173
LOG_LEVEL=info
EOF
  echo "    $target dibuat."
}

echo "==> 2/6  Konfigurasi .env (root + apps/api, dibuat hanya bila belum ada)"
write_env "$REPO_ROOT/.env"
write_env "$REPO_ROOT/apps/api/.env"

echo "==> 3/6  Install dependency"
pnpm install --frozen-lockfile

echo "==> 4/6  Gate statik (lint + test + build) — sama dengan release gate deploy"
pnpm check

echo "==> 5/6  Database: generate + migrate + tenant + verifikasi seed"
pnpm db:validate
pnpm db:generate
pnpm db:deploy
pnpm migrate:tenants
pnpm seed:verify || echo "    (seed:verify memberi peringatan — periksa keluarannya)"

echo "==> 6/6  SELESAI"
echo "    Nyalakan aplikasi:  pnpm dev"
echo "    Web:  http://localhost:5173    API:  http://localhost:3000"
echo "    Login super admin: admin / admin123"
echo ""
echo "    Prasyarat Postgres: database '$DB_NAME' sudah ada dan role '$DB_USER'"
echo "    punya hak CREATE (untuk membuat schema tenant). Contoh:"
echo "      createdb -U $DB_USER $DB_NAME   ||   psql -U postgres -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
