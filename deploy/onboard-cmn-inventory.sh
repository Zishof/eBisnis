#!/usr/bin/env bash
#
# Memastikan pelanggan inventory pertama -- Caruban Medika Nusantara
# (cmnmedika-inventory.ebisnis.id) -- terdaftar, punya schema sendiri, akun
# awal, dan impor legacy DBF bila berkasnya tersedia.
#
# Idempotent:
#   - tenant/schema/domain dibuat melalui CLI internal dan aman dipanggil ulang;
#   - akun CMN disinkronkan ulang sesuai kredensial awal yang diminta;
#   - impor legacy ditandai marker `CMN_LEGACY_IMPORT_V2`, sehingga tidak
#     menimpa berulang jika data sudah masuk;
#   - metadata audit DBF tetap disinkronkan ulang pada deploy berikutnya.
#
# Untuk impor DBF di server, salin folder lama ke:
#   /opt/ebisnis/imports/cmn-inventory
# atau set:
#   CMN_LEGACY_DBF_DIR=/path/ke/5-Inventory
#
# Deploy cepat:
#   CMN_LEGACY_IMPORT_ASYNC=1  (default) menjalankan import DBF besar di background
#   CMN_LEGACY_IMPORT_ASYNC=0  menunggu import DBF selesai seperti perilaku lama
#   CMN_SKIP_LEGACY_IMPORT=1   melewati import DBF sepenuhnya

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/ebisnis/app}"
APP_USER="${APP_USER:-ebisnis}"
CMN_LEGACY_IMPORT_ASYNC="${CMN_LEGACY_IMPORT_ASYNC:-1}"
LOG_DIR="${CMN_LEGACY_IMPORT_LOG_DIR:-/var/log/ebisnis}"
LOCK_FILE="${CMN_LEGACY_IMPORT_LOCK_FILE:-/tmp/ebisnis-cmn-legacy-import.lock}"
SKIP_BACKGROUND_IMPORT=0

log()  { printf '    %s\n' "$1"; }
warn() { printf '    [!] %s\n' "$1"; }

if [[ "${CMN_SKIP_LEGACY_IMPORT:-0}" == "1" ]]; then
  CLI_ARGS="--skip-legacy-import"
  SKIP_BACKGROUND_IMPORT=1
elif [[ "$CMN_LEGACY_IMPORT_ASYNC" == "1" ]]; then
  CLI_ARGS="--skip-legacy-import"
else
  CLI_ARGS=""
fi

if sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/api' && pnpm exec ts-node -P tsconfig.json src/cli/onboard-cmn-inventory.cli.ts $CLI_ARGS"; then
  log "Caruban Medika Nusantara siap atau sudah lengkap."
else
  warn "Penyiapan Caruban Medika Nusantara gagal -- deploy tetap dilanjutkan; periksa log di atas."
  exit 0
fi

if [[ "$CMN_LEGACY_IMPORT_ASYNC" != "1" ]]; then
  exit 0
fi

if [[ "$SKIP_BACKGROUND_IMPORT" == "1" ]]; then
  log "Import legacy CMN dilewati penuh karena CMN_SKIP_LEGACY_IMPORT=1."
  exit 0
fi

if ! command -v flock >/dev/null 2>&1; then
  warn "flock tidak tersedia; import legacy CMN background dilewati. Jalankan manual: pnpm --filter @ebisnis/api exec ts-node -P tsconfig.json src/cli/onboard-cmn-inventory.cli.ts --legacy-import-only"
  exit 0
fi

install -d -o "$APP_USER" -g "$APP_USER" -m 755 "$LOG_DIR"
LOG_FILE="$LOG_DIR/cmn-legacy-import-$(date +%Y%m%d-%H%M%S).log"

sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/api' && nohup bash -lc 'flock -n \"$LOCK_FILE\" pnpm exec ts-node -P tsconfig.json src/cli/onboard-cmn-inventory.cli.ts --legacy-import-only' > '$LOG_FILE' 2>&1 &" || {
  warn "Import legacy CMN background gagal dijadwalkan."
  exit 0
}

log "Import legacy CMN berjalan di background."
log "Pantau log: tail -f $LOG_FILE"
