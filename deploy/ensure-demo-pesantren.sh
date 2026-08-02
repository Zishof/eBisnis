#!/usr/bin/env bash
#
# Memastikan sandbox demo ePesantren (ponpes_demo) ada, diakses subjek demo
# tetap, dan terisi data contoh, dipanggil dari update.sh SETELAH health
# check lulus (API harus hidup untuk menerima pendaftaran publik).
#
# Idempotent dengan sengaja pada TIGA lapis, masing-masing dengan alasan
# berbeda mengapa ia TIDAK BOLEH hanya berjalan sekali di deploy pertama:
#   1. Pendaftaran tenant (POST /public/pesantren/registrations) -- hanya
#      terjadi bila registry belum punya baris untuk ponpes_demo sama sekali.
#   2. Subjek demo tetap + peran EPESANTREN_ADMIN -- dijalankan di SETIAP
#      pemanggilan, READY lama maupun baru. Ini BUKAN bagian dari alur
#      pendaftaran publik (yang membuat pemilik SUNGGUHAN dengan
#      platform_user_id barunya sendiri) -- subjek demo tetap adalah
#      identitas TERPISAH yang selalu dipakai `createDemoSession()` apa pun
#      tenantnya. Bila langkah ini hanya berjalan sekali (mis. digabung ke
#      dalam blok "baru saja didaftarkan" di bawah), tenant yang SUDAH
#      READY dari deploy sebelumnya -- termasuk yang sempat didaftarkan
#      sebelum baris ini ada -- tidak akan pernah mendapatkannya, dan sesi
#      "Coba Demo Pesantren" akan terus melihat sisi navigasi kosong total
#      serta setiap panggilan API balik PERMISSION_DENIED.
#   3. Skrip data contoh besar (scripts/seed-ponpes-demo/*.js) TIDAK aman
#      dijalankan dua kali (lihat README-nya: menjalankan ulang menambah
#      baris, bukan menimpa) -- karena itu hanya dijalankan TEPAT SEKALI,
#      persis pada pemanggilan yang PERTAMA KALI mendaftarkan tenant ini.
#
# Kegagalan di skrip ini TIDAK menggagalkan deploy -- sandbox demo yang
# gagal terisi jauh lebih baik daripada seluruh pembaruan aplikasi
# dibatalkan karenanya. Setiap kegagalan dicatat dan dilewati.
#
# Pakai:
#   APP_DIR=/opt/ebisnis/app APP_USER=ebisnis ADMIN_URL=postgres://... \
#   PSQL_BIN=/usr/lib/postgresql/17/bin/psql bash deploy/ensure-demo-pesantren.sh
#
# PSQL_BIN sebaiknya diisi dari `$PSQL` yang sudah diresolusi update.sh
# (lihat `resolve_pg_bin` di sana) -- `psql` polos pada PATH server ini bisa
# menunjuk ke cluster versi yang BUKAN versi tertinggi terpasang (lihat
# komentar resolve_pg_bin). Jatuh ke `psql` polos hanya bila tidak diisi.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/ebisnis/app}"
APP_USER="${APP_USER:-ebisnis}"
API_URL="${API_URL:-http://127.0.0.1:3000/api/v1}"
PSQL_BIN="${PSQL_BIN:-psql}"
SCHEMA=ponpes_demo

: "${ADMIN_URL:?ADMIN_URL (DATABASE_ADMIN_URL) wajib diisi}"

log()  { printf '    %s\n' "$1"; }
warn() { printf '    [!] %s\n' "$1"; }

status_registry() {
  "$PSQL_BIN" "$ADMIN_URL" -tAc \
    "SELECT status FROM platform.tenant_schema_registry WHERE schema_name = '$SCHEMA'" \
    2>/dev/null | tr -d '[:space:]' || true
}

# ---------------------------------------------------------------------------
# Subjek demo tetap (DEMO_PLATFORM_USER_ID) + peran EPESANTREN_ADMIN.
#
# Pola sama persis dengan `TenantBootstrapService.createDemoSubject()`
# (dipakai schema `demo` bersama), hanya perannya EPESANTREN_ADMIN -- BUKAN
# DEMO_USER, yang `allModules: true`-nya akan membatalkan seluruh
# penyempitan menu demo santri.info.
#
# Dipanggil TANPA syarat oleh KEDUA cabang di bawah (READY lama maupun
# baru) -- lihat lapis idempotensi ke-2 pada dokumentasi di atas.
# ---------------------------------------------------------------------------
pastikan_subjek_demo() {
  "$PSQL_BIN" "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE
  v_subject_id uuid;
  v_role_id uuid;
BEGIN
  SELECT id INTO v_subject_id FROM \"$SCHEMA\".user_subject
    WHERE platform_user_id = '00000000-0000-4000-8000-00000000de00'::uuid LIMIT 1;

  IF v_subject_id IS NULL THEN
    INSERT INTO \"$SCHEMA\".user_subject
      (platform_user_id, code, name, username_snapshot, is_owner, status, is_system)
    VALUES
      ('00000000-0000-4000-8000-00000000de00'::uuid, 'DEMO', 'Pengguna Demo', 'demo', FALSE, 'ACTIVE', TRUE)
    RETURNING id INTO v_subject_id;
  END IF;

  SELECT id INTO v_role_id FROM \"$SCHEMA\".role WHERE code = 'EPESANTREN_ADMIN' LIMIT 1;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO \"$SCHEMA\".user_role_assignment (user_subject_id, role_id)
    VALUES (v_subject_id, v_role_id)
    ON CONFLICT (user_subject_id, role_id) DO NOTHING;
  END IF;
END \$\$;
" >/dev/null
}

STATUS=$(status_registry)

if [[ "$STATUS" == "READY" ]]; then
  log "Sandbox demo ePesantren ($SCHEMA) sudah ada dan siap."
  if pastikan_subjek_demo; then
    log "Subjek demo tetap sudah/kini memegang EPESANTREN_ADMIN. Tidak ada data contoh yang disemai ulang."
  else
    warn "Gagal memeriksa/memberi peran subjek demo tetap -- sesi 'Coba Demo Pesantren' mungkin tidak melihat menu apa pun."
  fi
  exit 0
fi

if [[ -n "$STATUS" ]]; then
  warn "Sandbox demo ePesantren ($SCHEMA) terdaftar tapi status=$STATUS (bukan READY). Dilewati -- tangani manual."
  exit 0
fi

log "Sandbox demo ePesantren ($SCHEMA) belum ada. Mendaftarkan lewat alur publik yang sama dengan pendaftar asli..."

RESPONSE=$(curl -sS -m 30 -X POST "$API_URL/public/pesantren/registrations" \
  -H 'Content-Type: application/json' \
  -d '{
    "namaPondok": "Ponpes Demo",
    "slugSitus": "ponpes-demo",
    "desiredUsername": "ponpes_demo",
    "email": "demo@ponpes-demo.sch.id",
    "tipePesantren": "KOMBINASI",
    "santriDilayani": "PUTRA_PUTRI",
    "jenjang": ["DINIYAH_TAKMILIYAH", "TAHFIZ", "MTS", "MA"],
    "acceptTerms": true,
    "acceptPrivacy": true,
    "includeSampleData": true
  }' || true)

if ! grep -q '"success":true' <<<"$RESPONSE"; then
  warn "Pendaftaran sandbox demo ePesantren gagal -- deploy tetap dilanjutkan. Respons:"
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
  warn "Belum READY setelah menunggu -- lewati penyiapan subjek demo dan data contoh, tangani manual."
  exit 0
fi

log "Menyiapkan subjek demo tetap dengan peran EPESANTREN_ADMIN..."
pastikan_subjek_demo || warn "Gagal menyiapkan subjek demo -- sesi 'Coba Demo Pesantren' mungkin tidak melihat menu apa pun."

# ---------------------------------------------------------------------------
# Tahun ajaran ACTIVE -- prasyarat skrip data contoh (lihat
# scripts/seed-ponpes-demo/README.md). Tidak ada satu pun endpoint API untuk
# membuatnya (celah produk yang sudah ada sebelum baris ini, bukan yang
# diperkenalkannya) -- baris bootstrap sekali ini HANYA menyentuh sandbox
# yang baru saja didaftarkan di atas, bukan penyuntingan tenant sungguhan.
# ---------------------------------------------------------------------------
log "Menyiapkan tahun ajaran ACTIVE (prasyarat data contoh; belum ada jalur API untuk ini)..."
TAHUN=$(date +%Y)
"$PSQL_BIN" "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "
  INSERT INTO \"$SCHEMA\".pesantren_tahun_ajaran (code, name, tanggal_mulai, tanggal_selesai, status, is_sample)
  SELECT '${TAHUN}/$((TAHUN + 1))', 'Tahun Ajaran ${TAHUN}/$((TAHUN + 1))',
         make_date(${TAHUN}, 7, 1), make_date($((TAHUN + 1)), 6, 30), 'ACTIVE', true
  WHERE NOT EXISTS (
    SELECT 1 FROM \"$SCHEMA\".pesantren_tahun_ajaran WHERE status = 'ACTIVE' AND deleted_at IS NULL
  );
" >/dev/null || { warn "Gagal menyiapkan tahun ajaran -- lewati penyemaian data contoh."; exit 0; }

log "Menjalankan skrip data contoh besar (~1000 santri, 100 guru, dst) -- tepat sekali..."
SEED_DIR="$APP_DIR/scripts/seed-ponpes-demo"
WORKDIR="$APP_DIR/apps/api"

for SKRIP in 01-fondasi.js 02-asrama-rombongan.js 03-keuangan-akademik.js 04-kesiswaan-katering.js 05-kepegawaian-psb.js; do
  cp "$SEED_DIR/$SKRIP" "$WORKDIR/$SKRIP"
  log "  -> $SKRIP"
  if ! sudo -u "$APP_USER" bash -lc "cd '$WORKDIR' && DATABASE_ADMIN_URL='$ADMIN_URL' SEED_SCHEMA='$SCHEMA' node '$SKRIP'"; then
    warn "$SKRIP gagal -- menghentikan penyemaian data contoh (tahap sebelumnya tetap tersimpan)."
    rm -f "$WORKDIR"/0*.js
    exit 0
  fi
done
rm -f "$WORKDIR"/0*.js

log "Sandbox demo ePesantren ($SCHEMA) siap dengan data contoh lengkap."
