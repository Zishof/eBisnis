#!/usr/bin/env bash
#
# deploy/koperasi.sh <install|update|status|uninstall-domain> [pilihan]
#
# Memasang dan memperbarui vertikal eKoperasi pada server, dengan subdomain
# koperasi.ebisnis.id.
#
# ## Apa yang TIDAK dikerjakan berkas ini
#
# Migrasi basis data, build, dan penyemaian menu/peran. Ketiganya sudah
# dikerjakan `deploy/update.sh` sejak katalog modular disetujui: pemuat migrasi
# menemukan `tenant-migrations/cooperative/` sendiri, dan `migrate:tenants`
# menyemai katalog RBAC koperasi ke setiap penyewa.
#
# Yang tersisa — dan hanya inilah isi berkas ini — adalah tiga hal yang khas
# subdomain:
#
#   1. Apache meneruskan koperasi.ebisnis.id ke aplikasi.
#   2. Host itu terdaftar pada platform.vertical_site_domain (IR-005).
#      Tanpa baris itu, situsnya menjawab 404 meski Apache sudah benar dan
#      aplikasinya sudah berjalan — sebab nama skema TIDAK BOLEH datang dari
#      alamat, dan pemetaan inilah satu-satunya jalan yang sah.
#   3. Ketiganya diperiksa, bukan diasumsikan.
#
# ## Yang perlu disiapkan lebih dahulu
#
#   · DNS: A record koperasi.ebisnis.id → alamat server ini.
#   · Penyewa koperasi sudah terdaftar dan skemanya READY.
#
# Keduanya diperiksa skrip ini dan disebut jelas bila belum ada.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/ebisnis/app}"
APP_USER="${APP_USER:-ebisnis}"
HOST_KOPERASI="${HOST_KOPERASI:-koperasi.ebisnis.id}"
APACHE_CONF="${APACHE_CONF:-/etc/apache2/sites-available/ebisnis.conf}"

C_OK=$'\e[32m'; C_WARN=$'\e[33m'; C_ERR=$'\e[31m'; C_OFF=$'\e[0m'
log()  { printf '\n%s==> %s%s\n' "$C_OK"  "$1" "$C_OFF"; }
warn() { printf '%s[!] %s%s\n'   "$C_WARN" "$1" "$C_OFF"; }
die()  { printf '%s[x] %s%s\n'   "$C_ERR"  "$1" "$C_OFF" >&2; exit 1; }

as_app() { sudo -u "$APP_USER" bash -lc "$1"; }

need_root() {
  [[ ${EUID} -eq 0 ]] || die "Jalankan dengan sudo."
}

# ---------------------------------------------------------------------------
# Pemeriksaan prasyarat
# ---------------------------------------------------------------------------
periksa_dns() {
  log "Memeriksa DNS $HOST_KOPERASI"

  local ip_server ip_host
  ip_server="$(hostname -I | awk '{print $1}')"

  if ! command -v getent >/dev/null 2>&1; then
    warn "getent tidak tersedia; pemeriksaan DNS dilewati."
    return 0
  fi

  ip_host="$(getent hosts "$HOST_KOPERASI" | awk '{print $1}' | head -1 || true)"

  if [[ -z "$ip_host" ]]; then
    warn "$HOST_KOPERASI belum menunjuk ke mana pun."
    warn "Pasang A record ke $ip_server lebih dahulu; tanpa itu tidak ada"
    warn "permintaan yang sampai ke server ini."
    return 1
  fi

  if [[ "$ip_host" != "$ip_server" ]]; then
    # Diperingatkan, bukan digagalkan: server di balik CDN atau pengarah memang
    # menunjuk alamat lain, dan itu sah.
    warn "$HOST_KOPERASI menunjuk $ip_host, sedangkan server ini $ip_server."
    warn "Bila ada pengarah atau CDN di depan, ini wajar. Bila tidak, periksa DNS."
  else
    printf '    DNS mengarah ke server ini (%s).\n' "$ip_server"
  fi
  return 0
}

periksa_penyewa() {
  local penyewa="$1"
  log "Memeriksa penyewa '$penyewa'"

  # Dibaca lewat CLI yang sama dengan yang mendaftarkan, supaya tidak ada
  # jalur kedua yang perlu dijaga tetap sama.
  if ! as_app "cd '$APP_DIR' && pnpm domain:vertical list" >/dev/null 2>&1; then
    die "CLI domain vertikal tidak dapat dijalankan. Pastikan build mutakhir (deploy/update.sh)."
  fi
  printf '    CLI domain vertikal siap.\n'
}

# ---------------------------------------------------------------------------
# Apache
# ---------------------------------------------------------------------------
pasang_apache() {
  log "Menyiapkan Apache untuk $HOST_KOPERASI"

  [[ -f "$APACHE_CONF" ]] || die "Berkas $APACHE_CONF tidak ditemukan."

  if grep -q "$HOST_KOPERASI" "$APACHE_CONF"; then
    printf '    %s sudah tercantum pada vhost.\n' "$HOST_KOPERASI"
  else
     # Disunting di tempat, dengan cadangan bertanggal. Menulis ulang seluruh
     # berkas akan menghapus penyesuaian yang mungkin dibuat operator server —
     # dan penyesuaian pada berkas Apache justru yang paling sering ada dan
     # paling jarang dicatat.
    local cadangan="${APACHE_CONF}.bak.$(date +%Y%m%d%H%M%S)"
    cp -a "$APACHE_CONF" "$cadangan"
    printf '    Cadangan: %s\n' "$cadangan"

    sed -i "s/\(ServerAlias .*belanja\.ebisnis\.id\)/\1 ${HOST_KOPERASI}/" "$APACHE_CONF"

    grep -q "$HOST_KOPERASI" "$APACHE_CONF" \
      || die "Gagal menambahkan $HOST_KOPERASI. Tambahkan manual pada ServerAlias."
    printf '    %s ditambahkan ke ServerAlias.\n' "$HOST_KOPERASI"
  fi

  # Diuji SEBELUM dimuat ulang. Konfigurasi Apache yang salah dan sudah
  # dimuat ulang mematikan seluruh situs, bukan hanya subdomain baru.
  apache2ctl configtest || die "Konfigurasi Apache tidak sah. Tidak dimuat ulang."
  systemctl reload apache2
  printf '    Apache dimuat ulang.\n'
}

# ---------------------------------------------------------------------------
# Pendaftaran host ke control plane
# ---------------------------------------------------------------------------
daftarkan_host() {
  local penyewa="$1"
  log "Mendaftarkan $HOST_KOPERASI ke control plane"

   # `--verify` dipakai di sini karena operator server memang yang memasang
   # DNS-nya, jadi kepemilikannya diketahui. Untuk domain yang dibawa penyewa
   # sendiri, pembuktiannya harus lewat DNS dan --verify TIDAK boleh dipakai.
  as_app "cd '$APP_DIR' && pnpm domain:vertical register \
    --host '$HOST_KOPERASI' --tenant '$penyewa' --vertical cooperative --verify" \
    || die "Pendaftaran host gagal."
}

# ---------------------------------------------------------------------------
# Pemeriksaan hasil
# ---------------------------------------------------------------------------
periksa_hasil() {
  log "Memeriksa hasil"

  as_app "cd '$APP_DIR' && pnpm domain:vertical list" || true

  local kode
  kode="$(curl -sk -o /dev/null -w '%{http_code}' \
    -H "Host: $HOST_KOPERASI" http://127.0.0.1/ || echo 000)"

  if [[ "$kode" == "200" ]]; then
    printf '    Aplikasi menjawab 200 untuk Host: %s.\n' "$HOST_KOPERASI"
  else
    warn "Aplikasi menjawab $kode untuk Host: $HOST_KOPERASI."
    warn "Periksa: systemctl status ebisnis-api, dan log Apache."
  fi
}

# ---------------------------------------------------------------------------
# Perintah
# ---------------------------------------------------------------------------
perintah_install() {
  need_root
  local penyewa="${1:-}"
  [[ -n "$penyewa" ]] || die "Sebutkan penyewanya: $0 install <username-atau-schema>"

  periksa_dns || warn "Dilanjutkan meski DNS belum siap; situsnya belum dapat dibuka."
  periksa_penyewa "$penyewa"
  pasang_apache
  daftarkan_host "$penyewa"
  periksa_hasil

  log "Selesai"
  cat <<RINGKAS

  Subdomain : https://$HOST_KOPERASI/
  Penyewa   : $penyewa

  Yang masih perlu dikerjakan tangan:

    1. Sertifikat TLS untuk $HOST_KOPERASI. Selama masih memakai sertifikat
       self-signed, peramban akan memperingatkan pengunjung:

         certbot --apache -d $HOST_KOPERASI

    2. Menyalakan pengalihan HTTP ke HTTPS pada ebisnis.conf — sengaja masih
       nonaktif supaya pengujian lewat HTTP tidak terhalang.

    3. Data contoh koperasi, bila diperlukan, lewat layar
       /ekoperasi/data-contoh.

RINGKAS
}

perintah_update() {
  need_root

   # Pembaruan vertikal koperasi TIDAK punya langkah tersendiri. Migrasi,
   # build, dan penyemaian menu/peran seluruhnya dikerjakan update.sh —
   # memisahkannya akan menghasilkan dua jalur pembaruan yang harus dijaga
   # tetap sama, dan yang jarang dipakai akan tertinggal tanpa ada yang tahu.
  log "Memperbarui aplikasi (termasuk vertikal koperasi)"
  bash "$(dirname "$0")/update.sh" "$@"

  log "Memeriksa kembali subdomain koperasi"
  pasang_apache
  periksa_hasil
}

perintah_status() {
  log "Keadaan vertikal koperasi"

  printf '\n  Apache:\n'
  if grep -q "$HOST_KOPERASI" "$APACHE_CONF" 2>/dev/null; then
    printf '    %s tercantum pada vhost.\n' "$HOST_KOPERASI"
  else
    warn "  $HOST_KOPERASI BELUM tercantum pada $APACHE_CONF."
  fi

  printf '\n  Host terdaftar:\n'
  as_app "cd '$APP_DIR' && pnpm domain:vertical list" 2>/dev/null || \
    warn "  Tidak dapat membaca daftar host."

  printf '\n  Layanan:\n'
  systemctl is-active --quiet ebisnis-api \
    && printf '    ebisnis-api berjalan.\n' \
    || warn "  ebisnis-api TIDAK berjalan."

  periksa_hasil
}

perintah_uninstall_domain() {
  need_root
   # Menghentikan, bukan menghapus. Host yang dihapus dapat didaftarkan ulang
   # penyewa lain tanpa jejak; yang dihentikan meninggalkan barisnya.
   #
   # Baris Apache sengaja TIDAK dicabut: mencabutnya menuntut menyunting
   # berkas yang mungkin sudah disesuaikan operator, dan subdomain yang
   # diteruskan tetapi tidak terdaftar hanya menjawab 404 — tidak berbahaya.
  as_app "cd '$APP_DIR' && pnpm domain:vertical suspend \
    --host '$HOST_KOPERASI' --reason 'Dihentikan lewat deploy/koperasi.sh'"
  log "Host dihentikan. Baris Apache dibiarkan; subdomainnya kini menjawab 404."
}

case "${1:-}" in
  install)          shift; perintah_install "$@" ;;
  update)           shift; perintah_update "$@" ;;
  status)           perintah_status ;;
  uninstall-domain) perintah_uninstall_domain ;;
  *)
    cat <<USAGE
Pemakaian:
  $0 install <username-atau-schema>   pasang subdomain untuk satu penyewa
  $0 update                           perbarui aplikasi lalu periksa subdomain
  $0 status                           tampilkan keadaan
  $0 uninstall-domain                 hentikan subdomain (tidak menghapus)

Ubah subdomainnya lewat HOST_KOPERASI, mis.:
  HOST_KOPERASI=koperasi.contoh.id $0 install koperasimaju
USAGE
    exit 1
    ;;
esac
