#!/usr/bin/env bash
#
# Memastikan sandbox demo MitraInap.id (mitrainap_demo) ada dan diakses
# subjek demo tetap, dipanggil dari update.sh SETELAH health check lulus
# (API harus hidup untuk menerima pendaftaran publik). Pola sama persis
# dengan ensure-demo-pesantren.sh -- lihat komentar di sana untuk
# penjelasan lengkap dua lapis idempotensi yang dipakai ulang di sini
# (pendaftaran tenant sekali, subjek demo+peran di SETIAP pemanggilan).
#
# BERBEDA dari ensure-demo-pesantren.sh: TIDAK ADA langkah data contoh
# besar. Belum ada skrip seed hospitality (belum ada volume reservasi
# nyata untuk dianalisis polanya, sama seperti alasan MI-8/MI-9/MI-10
# menunda pickup/pace/forecast) -- sandbox demo ini SENGAJA hanya berisi
# ruang kerja kosong siap pakai, bukan properti/kamar contoh. Menambahkan
# data contoh menyusul saat benar-benar dibutuhkan, bukan ditulis sekarang
# hanya supaya langkah ini terlihat lengkap.
#
# Kegagalan di skrip ini TIDAK menggagalkan deploy.
#
# Pakai:
#   APP_DIR=/opt/ebisnis/app APP_USER=ebisnis ADMIN_URL=postgres://... \
#   PSQL_BIN=/usr/lib/postgresql/17/bin/psql bash deploy/ensure-demo-mitrainap.sh

set -Eeuo pipefail

APP_USER="${APP_USER:-ebisnis}"
API_URL="${API_URL:-http://127.0.0.1:3000/api/v1}"
PSQL_BIN="${PSQL_BIN:-psql}"
SCHEMA=mitrainap_demo

: "${ADMIN_URL:?ADMIN_URL (DATABASE_ADMIN_URL) wajib diisi}"

log()  { printf '    %s\n' "$1"; }
warn() { printf '    [!] %s\n' "$1"; }

status_registry() {
  "$PSQL_BIN" "$ADMIN_URL" -tAc \
    "SELECT status FROM platform.tenant_schema_registry WHERE schema_name = '$SCHEMA'" \
    2>/dev/null | tr -d '[:space:]' || true
}

# ---------------------------------------------------------------------------
# Subjek demo tetap (DEMO_PLATFORM_USER_ID) + peran HOSPITALITY_ADMIN.
#
# Subjek yang SAMA (UUID tetap) dipakai seluruh vertikal -- lihat komentar
# panjang pada `pastikan_subjek_demo` di ensure-demo-pesantren.sh, berlaku
# sama persis di sini. Dipanggil TANPA syarat oleh KEDUA cabang di bawah.
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

  SELECT id INTO v_role_id FROM \"$SCHEMA\".role WHERE code = 'HOSPITALITY_ADMIN' LIMIT 1;

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
  log "Sandbox demo MitraInap.id ($SCHEMA) sudah ada dan siap."
  if pastikan_subjek_demo; then
    log "Subjek demo tetap sudah/kini memegang HOSPITALITY_ADMIN."
  else
    warn "Gagal memeriksa/memberi peran subjek demo tetap -- sesi 'Coba Demo' mungkin tidak melihat menu apa pun."
  fi
  exit 0
fi

if [[ -n "$STATUS" ]]; then
  warn "Sandbox demo MitraInap.id ($SCHEMA) terdaftar tapi status=$STATUS (bukan READY). Dilewati -- tangani manual."
  exit 0
fi

log "Sandbox demo MitraInap.id ($SCHEMA) belum ada. Mendaftarkan lewat alur publik yang sama dengan pendaftar asli..."

RESPONSE=$(curl -sS -m 30 -X POST "$API_URL/public/hospitality/registrations" \
  -H 'Content-Type: application/json' \
  -d '{
    "namaProperti": "MitraInap Demo",
    "slugSitus": "mitrainap-demo",
    "desiredUsername": "mitrainap_demo",
    "email": "demo@mitrainap.id",
    "acceptTerms": true,
    "acceptPrivacy": true
  }' || true)

if ! grep -q '"success":true' <<<"$RESPONSE"; then
  warn "Pendaftaran sandbox demo MitraInap.id gagal -- deploy tetap dilanjutkan. Respons:"
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
  warn "Belum READY setelah menunggu -- lewati penyiapan subjek demo, tangani manual."
  exit 0
fi

log "Menyiapkan subjek demo tetap dengan peran HOSPITALITY_ADMIN..."
pastikan_subjek_demo || warn "Gagal menyiapkan subjek demo -- sesi 'Coba Demo' mungkin tidak melihat menu apa pun."

log "Sandbox demo MitraInap.id ($SCHEMA) siap (ruang kerja kosong -- lihat catatan berkas ini soal data contoh)."
