#!/usr/bin/env bash
#
# Memastikan tenant PELANGGAN PERTAMA -- Pondok Pesantren Raudlatul Ulum,
# Bojonegoro (raudlatul-ulum.santri.info) -- terdaftar dan terisi data
# awalnya, dipanggil dari update.sh SETELAH health check lulus.
#
# BERBEDA dari deploy/ensure-demo-pesantren.sh: tenant ini bukan sandbox
# demo bersama, melainkan pelanggan sungguhan dengan datanya sendiri. Karena
# itu TIDAK ADA subjek demo tetap di sini -- pemilik yang login adalah
# pemilik sungguhan yang dibuat sekali saat registrasi, dan skrip data
# (scripts/onboard-raudlatul-ulum/seed.js) menulis profil/berita/unit
# pendidikan/mata pelajaran/akun staf langsung lewat SQL supaya dapat
# dipanggil ulang tanpa bergantung pada kata sandi pemilik yang hanya
# muncul sekali pada respons registrasi.
#
# Idempotent pada DUA lapis:
#   1. Pendaftaran tenant (POST /public/pesantren/registrations) -- hanya
#      terjadi bila registry belum punya baris untuk schema ini sama sekali.
#   2. scripts/onboard-raudlatul-ulum/seed.js -- AMAN dipanggil berulang;
#      setiap bagian memeriksa keberadaan barisnya sendiri sebelum menulis
#      (lihat komentar di dalam skrip itu). Karena itu dipanggil TANPA
#      syarat pada kedua cabang di bawah (READY lama maupun baru).
#
# Kegagalan di skrip ini TIDAK menggagalkan deploy -- pelanggan yang gagal
# terisi datanya jauh lebih baik ditangani manual daripada seluruh
# pembaruan aplikasi dibatalkan karenanya.
#
# Pakai:
#   APP_DIR=/opt/ebisnis/app APP_USER=ebisnis ADMIN_URL=postgres://... \
#   PSQL_BIN=/usr/lib/postgresql/17/bin/psql bash deploy/onboard-raudlatul-ulum.sh

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/ebisnis/app}"
APP_USER="${APP_USER:-ebisnis}"
API_URL="${API_URL:-http://127.0.0.1:3000/api/v1}"
PSQL_BIN="${PSQL_BIN:-psql}"
SCHEMA=admin_raudlatululum

: "${ADMIN_URL:?ADMIN_URL (DATABASE_ADMIN_URL) wajib diisi}"

log()  { printf '    %s\n' "$1"; }
warn() { printf '    [!] %s\n' "$1"; }

status_registry() {
  "$PSQL_BIN" "$ADMIN_URL" -tAc \
    "SELECT status FROM platform.tenant_schema_registry WHERE schema_name = '$SCHEMA'" \
    2>/dev/null | tr -d '[:space:]' || true
}

jalankan_seed() {
  local SKRIP_DIR="$APP_DIR/scripts/onboard-raudlatul-ulum"
  local WORKDIR="$APP_DIR/apps/api"
  local SKRIP_DEST="$WORKDIR/onboard-raudlatul-ulum-seed.js"
  # `seed.js` membaca gambar (logo, hero, poster berita) dari `assets/`
  # SEJAJAR dirinya sendiri (`path.join(__dirname, 'assets')`) -- begitu
  # skripnya disalin ke $WORKDIR supaya node_modules API ikut terpakai,
  # `assets/` WAJIB ikut disalin ke tempat yang sama, atau seluruh gambar
  # senyap dilewati ("berkas belum ada") tanpa menggagalkan deploy sama
  # sekali. Persis cacat yang terjadi pada percobaan pertama fitur ini.
  local ASSETS_DEST="$WORKDIR/assets"

  cp "$SKRIP_DIR/seed.js" "$SKRIP_DEST"
  rm -rf "$ASSETS_DEST"
  cp -r "$SKRIP_DIR/assets" "$ASSETS_DEST"
  if sudo -u "$APP_USER" bash -lc "cd '$WORKDIR' && DATABASE_ADMIN_URL='$ADMIN_URL' SEED_SCHEMA='$SCHEMA' node '$SKRIP_DEST'"; then
    rm -f "$SKRIP_DEST"
    rm -rf "$ASSETS_DEST"
    return 0
  else
    rm -f "$SKRIP_DEST"
    rm -rf "$ASSETS_DEST"
    return 1
  fi
}

STATUS=$(status_registry)

if [[ "$STATUS" == "READY" ]]; then
  log "Raudlatul Ulum ($SCHEMA) sudah terdaftar dan siap."
  if jalankan_seed; then
    log "Data situs, unit pendidikan, mata pelajaran, tagihan percobaan, dan akun staf sudah/kini lengkap."
  else
    warn "Gagal menjalankan skrip data Raudlatul Ulum -- tangani manual (lihat log di atas)."
  fi
  exit 0
fi

if [[ -n "$STATUS" ]]; then
  warn "Raudlatul Ulum ($SCHEMA) terdaftar tapi status=$STATUS (bukan READY). Dilewati -- tangani manual."
  exit 0
fi

log "Raudlatul Ulum ($SCHEMA) belum terdaftar. Mendaftarkan lewat alur publik pendaftaran pesantren..."

RESPONSE=$(curl -sS -m 30 -X POST "$API_URL/public/pesantren/registrations" \
  -H 'Content-Type: application/json' \
  -d '{
    "namaPondok": "Raudlatul Ulum",
    "slugSitus": "raudlatul-ulum",
    "desiredUsername": "admin_raudlatululum",
    "email": "admin@raudlatululum.santri.info",
    "tipePesantren": "SALAFIYAH",
    "santriDilayani": "PUTRA_PUTRI",
    "jenjang": ["MI", "DINIYAH_TAKMILIYAH"],
    "tahunBerdiri": 2006,
    "namaPengasuh": "KH. Masyhuri Dahlan",
    "afiliasi": "Nahdlatul Ulama",
    "provinsi": "Jawa Timur",
    "kabupatenKota": "Kabupaten Bojonegoro",
    "kecamatan": "Bojonegoro Kota",
    "desaKelurahan": "Campurejo",
    "alamat": "Desa Campurejo, Kecamatan Bojonegoro, Kabupaten Bojonegoro, Jawa Timur",
    "penanggungJawab": "Pengurus Pondok Raudlatul Ulum",
    "teleponPenanggungJawab": "081234500000",
    "acceptTerms": true,
    "acceptPrivacy": true,
    "includeSampleData": false
  }' || true)

if ! grep -q '"success":true' <<<"$RESPONSE"; then
  warn "Pendaftaran Raudlatul Ulum gagal -- deploy tetap dilanjutkan. Respons:"
  printf '%s\n' "$RESPONSE" | sed 's/^/        /'
  exit 0
fi

log "Berhasil didaftarkan. Menunggu status READY..."
for _ in $(seq 1 15); do
  STATUS=$(status_registry)
  [[ "$STATUS" == "READY" ]] && break
  sleep 2
done

if [[ "$STATUS" != "READY" ]]; then
  warn "Belum READY setelah menunggu -- lewati penyiapan data, tangani manual."
  exit 0
fi

log "Menyiapkan profil situs, unit pendidikan, mata pelajaran, tagihan percobaan, dan akun staf..."
if jalankan_seed; then
  log "Raudlatul Ulum (raudlatul-ulum.santri.info) siap dengan data lengkap."
else
  warn "Skrip data gagal -- tenant tetap terdaftar, tetapi datanya perlu diisi manual."
fi
