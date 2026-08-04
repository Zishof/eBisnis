#!/usr/bin/env bash
#
# Memastikan pelanggan inventory pertama -- Caruban Medika Nusantara
# (cmnmedika-inventory.ebisnis.id) -- terdaftar, punya schema sendiri, akun
# awal, dan impor legacy DBF bila berkasnya tersedia.
#
# Idempotent:
#   - tenant/schema/domain dibuat melalui CLI internal dan aman dipanggil ulang;
#   - akun CMN disinkronkan ulang sesuai kredensial awal yang diminta;
#   - impor legacy ditandai marker `CMN_LEGACY_IMPORT_V1`, sehingga tidak
#     menimpa berulang jika data sudah masuk.
#
# Untuk impor DBF di server, salin folder lama ke:
#   /opt/ebisnis/imports/cmn-inventory
# atau set:
#   CMN_LEGACY_DBF_DIR=/path/ke/5-Inventory

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/ebisnis/app}"
APP_USER="${APP_USER:-ebisnis}"

log()  { printf '    %s\n' "$1"; }
warn() { printf '    [!] %s\n' "$1"; }

if sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/api' && pnpm exec ts-node -P tsconfig.json src/cli/onboard-cmn-inventory.cli.ts"; then
  log "Caruban Medika Nusantara siap atau sudah lengkap."
else
  warn "Penyiapan Caruban Medika Nusantara gagal -- deploy tetap dilanjutkan; periksa log di atas."
fi
