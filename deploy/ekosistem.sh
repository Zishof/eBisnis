#!/usr/bin/env bash
#
# Satu perintah untuk memasang dan memperbarui SELURUH ekosistem.
#
#   sudo bash /opt/ebisnis/app/deploy/ekosistem.sh pasang     # pemasangan portal pertama kali
#   sudo bash /opt/ebisnis/app/deploy/ekosistem.sh perbarui   # perbarui seluruh modul
#   sudo bash /opt/ebisnis/app/deploy/ekosistem.sh periksa    # periksa saja, tanpa mengubah apa pun
#
# ---------------------------------------------------------------------------
# Mengapa berkas ini ada, padahal sudah ada update.sh
# ---------------------------------------------------------------------------
#
# `update.sh` sudah memperbarui SELURUH modul sekaligus — itu memang akibat dari
# satu aplikasi, satu basis data, satu build. Yang belum dilakukannya adalah dua
# hal yang khusus milik ekosistem lima portal:
#
#   1. memastikan registry portal terisi, dan
#   2. memastikan kelima domain benar-benar menjawab sesudahnya.
#
# Tanpa yang kedua, pembaruan dapat dinyatakan berhasil sementara satu portal
# menjawab 404 — dan yang menemukannya adalah pengunjung, bukan yang memperbarui.
#
# Berkas ini TIDAK menyalin isi `update.sh`. Ia memanggilnya. Dua penyalin yang
# berjalan sendiri-sendiri akan berselisih pada perubahan pertama yang
# terburu-buru, dan yang berselisih di jalur penyebaran baru ketahuan saat
# menyebarkan.

set -Eeuo pipefail

APP_USER=${APP_USER:-ebisnis}
APP_DIR=${APP_DIR:-/opt/ebisnis/app}
API_URL=${API_URL:-http://127.0.0.1:3000}

PERINTAH=${1:-perbarui}

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  [v] %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  [!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

as_app() { sudo -u "$APP_USER" bash -lc "$*"; }

# Seluruh portal beserta host publiknya. Sengaja ditulis di sini DAN diseed dari
# `portal.catalog.ts`; uji `portal.catalog.spec.ts` mengikat keduanya lewat
# daftar label terpesan, dan langkah `periksa` di bawah membandingkan keduanya
# terhadap kenyataan.
HOST_PUBLIK=(
  ebisnis.id
  enterprise-education.id
  santri.info
  emedik.id
  ekoperasi.id
  info-desa.id
)

[[ $EUID -eq 0 ]] || die "Jalankan dengan sudo."
[[ -d "$APP_DIR" ]] || die "$APP_DIR tidak ada. Jalankan deploy/install.sh lebih dahulu."

# ---------------------------------------------------------------------------
# periksa — tidak mengubah apa pun
# ---------------------------------------------------------------------------
periksa_kesehatan() {
  log "Memeriksa peladen"
  if curl -fsS -m 5 "$API_URL/health" | grep -q '"status":"ok"'; then
    ok "peladen menjawab sehat"
  else
    die "peladen tidak menjawab sehat pada $API_URL/health"
  fi
}

periksa_portal() {
  log "Memeriksa registry portal"

  local jawaban
  jawaban=$(curl -fsS -m 10 "$API_URL/api/v1/public/portals" 2>/dev/null || true)

  if [[ -z "$jawaban" ]]; then
    warn "endpoint portal belum menjawab — registry mungkin belum diseed"
    return 1
  fi

  local kurang=0
  for kode in EBISNIS ENTERPRISE_EDUCATION EMEDIK EKOPERASI INFO_DESA; do
    if grep -q "\"$kode\"" <<<"$jawaban"; then
      ok "portal $kode terdaftar"
    else
      warn "portal $kode TIDAK terdaftar"
      kurang=1
    fi
  done
  return $kurang
}

periksa_domain() {
  log "Memeriksa kelima domain dari luar"

  # Diperiksa lewat nama, bukan lewat 127.0.0.1: yang hendak dibuktikan adalah
  # DNS, TLS, Apache, DAN aplikasi bekerja bersama. Memeriksa lewat localhost
  # melewatkan tiga dari empat, dan tiga itulah yang paling sering putus.
  local gagal=0
  for host in "${HOST_PUBLIK[@]}"; do
    local kode
    kode=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "https://$host/" 2>/dev/null || echo 000)
    case "$kode" in
      200|301|302) ok "https://$host -> $kode" ;;
      000)         warn "https://$host TIDAK terjangkau (DNS, TLS, atau firewall)"; gagal=1 ;;
      *)           warn "https://$host -> $kode"; gagal=1 ;;
    esac
  done
  return $gagal
}

# ---------------------------------------------------------------------------
# seed portal — aman diulang
# ---------------------------------------------------------------------------
seed_portal() {
  log "Menyeed registry portal"
  # Seed platform bersifat idempoten: baris yang sudah ada diperbarui, bukan
  # digandakan. Karena itu langkah ini aman dijalankan pada setiap pembaruan,
  # dan portal yang ditambahkan kelak muncul tanpa langkah manual.
  as_app "cd '$APP_DIR' && pnpm seed:platform"
  ok "registry portal diseed"
}

case "$PERINTAH" in
  periksa)
    periksa_kesehatan
    periksa_portal || warn "registry portal belum lengkap"
    periksa_domain || warn "sebagian domain belum menjawab"
    log "Pemeriksaan selesai — tidak ada yang diubah"
    ;;

  pasang)
    log "Memasang ekosistem lima portal"
    seed_portal
    periksa_kesehatan
    periksa_portal || die "registry portal gagal diseed"
    if ! periksa_domain; then
      warn "Sebagian domain belum menjawab."
      warn "Registry sudah benar; yang tersisa di luar aplikasi:"
      warn "  - DNS kelima apex domain mengarah ke server ini"
      warn "  - sertifikat TLS memuat kelima domain"
      warn "  - deploy/apache/ekosistem.conf terpasang dan Apache di-reload"
    fi
    log "Pemasangan selesai"
    ;;

  perbarui)
    # Seluruh modul diperbarui oleh satu panggilan ini: satu aplikasi, satu
    # build, satu basis data. Backup, migrasi platform, migrasi tenant, restart,
    # health check, dan pengembalian otomatis bila gagal — seluruhnya miliknya.
    log "Memperbarui seluruh modul"
    bash "$APP_DIR/deploy/update.sh" "${2:-}"

    seed_portal
    periksa_kesehatan
    periksa_portal || warn "registry portal belum lengkap"

    if periksa_domain; then
      log "Pembaruan selesai — kelima domain menjawab"
    else
      # TIDAK dinyatakan gagal: aplikasinya sudah sehat dan sudah melewati
      # health check serta pengembalian otomatis. Yang belum menjawab ada di
      # lapisan DNS/TLS/Apache, dan mengembalikan aplikasi karenanya justru
      # membatalkan pembaruan yang sebenarnya berhasil.
      warn "Pembaruan aplikasi BERHASIL, tetapi sebagian domain belum menjawab."
      warn "Periksa DNS, sertifikat, dan konfigurasi Apache."
    fi
    ;;

  *)
    die "Perintah tidak dikenal: $PERINTAH (pakai: pasang | perbarui | periksa)"
    ;;
esac
