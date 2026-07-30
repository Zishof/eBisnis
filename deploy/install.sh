#!/usr/bin/env bash
#
# Instalasi eBisnis.id pada Ubuntu 20.04, 22.04, atau 24.04.
#
# Menyiapkan sistem, meng-clone source dari GitHub, membangun, menerapkan
# migration, membuat super admin, lalu menyalakan layanan.
#
# Jalankan sebagai root:  sudo bash install.sh
#
# TIDAK menyentuh data yang sudah ada: bila database berisi tabel, migration
# hanya menambah yang belum diterapkan.

set -Eeuo pipefail

APP_USER=ebisnis
APP_DIR=/opt/ebisnis/app
ENV_FILE=/etc/ebisnis/ebisnis.env
LOG_DIR=/var/log/ebisnis
STATE_DIR=/var/lib/ebisnis
BACKUP_DIR=/var/backups/ebisnis
REPO_URL=${REPO_URL:-https://github.com/Zishof/eBisnis.git}
BRANCH=${BRANCH:-main}
NODE_MAJOR=22

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Jalankan dengan sudo."
[[ -r /etc/os-release ]] && . /etc/os-release

# Codename dipakai untuk repositori APT PostgreSQL. Jangan di-hardcode: nilainya
# berbeda antar rilis (focal untuk 20.04, jammy untuk 22.04, noble untuk 24.04)
# dan repositori yang salah membuat apt gagal dengan pesan yang membingungkan.
CODENAME=${VERSION_CODENAME:-$(lsb_release -cs 2>/dev/null || echo '')}
[[ -n "$CODENAME" ]] || die "Tidak dapat menentukan codename rilis Ubuntu."

case "${VERSION_ID:-}" in
  20.04|22.04|24.04) : ;;
  *) warn "Diuji pada Ubuntu 20.04, 22.04, dan 24.04; terdeteksi ${PRETTY_NAME:-tidak diketahui}." ;;
esac
echo "    ${PRETTY_NAME:-?} (codename: $CODENAME)"

# ---------------------------------------------------------------------------
log "1/10  Paket dasar"
# ---------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git rsync apache2 ufw ${EXTRA_PACKAGES:-}

# ---------------------------------------------------------------------------
log "2/10  Node.js ${NODE_MAJOR} dan pnpm"
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
corepack enable
corepack prepare pnpm@9.15.4 --activate
echo "    node $(node -v), pnpm $(pnpm -v)"

# ---------------------------------------------------------------------------
log "3/10  Klien PostgreSQL"
# ---------------------------------------------------------------------------
# pg_dump menolak bekerja bila versinya lebih tua daripada server. Backup pada
# update.sh bergantung padanya, jadi ketidaksesuaian versi harus ketahuan
# sekarang, bukan saat pembaruan pertama.
#
# Repositori utama PGDG hanya memuat rilis Ubuntu yang masih didukung. Rilis
# yang sudah EOL dipindahkan ke apt-archive, dan arsip itu TETAP memuat klien
# versi baru — sehingga backup tetap dapat dibuat tanpa menaikkan versi sistem
# operasi. Karena itu arsip dicoba sebelum menyerah ke klien bawaan distribusi.
if ! command -v pg_dump >/dev/null || ! pg_dump --version | grep -qE ' 1[6-9]| 2[0-9]'; then
  PG_BASE=""
  for host in "https://apt.postgresql.org/pub/repos/apt" \
              "https://apt-archive.postgresql.org/pub/repos/apt"; do
    if curl -fsI -m 20 "${host}/dists/${CODENAME}-pgdg/Release" >/dev/null 2>&1; then
      PG_BASE="$host"
      break
    fi
  done

  if [[ -n "$PG_BASE" ]]; then
    [[ "$PG_BASE" == *apt-archive* ]] && \
      warn "'${CODENAME}' sudah tidak ada di repositori utama PGDG; memakai arsip."
    install -d /usr/share/postgresql-common/pgdg
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
${PG_BASE} ${CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq
    # Pasang versi tertinggi yang tersedia untuk rilis ini.
    for v in 17 16 15 14 13; do
      if apt-get install -y -qq "postgresql-client-$v" 2>/dev/null; then
        echo "    postgresql-client-$v terpasang."
        break
      fi
    done
  else
    warn "Tidak ada repositori PGDG untuk '${CODENAME}', termasuk arsip."
    warn "Memakai klien PostgreSQL bawaan distribusi."
    apt-get install -y -qq postgresql-client || true
  fi
fi

# /usr/bin/pg_dump pada Debian/Ubuntu adalah wrapper postgresql-common yang
# memilih versi berdasarkan cluster default, BUKAN versi tertinggi yang
# terpasang. Bila mesin ini punya cluster lokal versi lama, wrapper akan memakai
# versi lama itu walau klien 17 sudah dipasang. Karena itu binary aslinya
# dicari langsung.
resolve_pg_bin() {
  local name=$1 best="" bestver=0 dir ver
  for dir in /usr/lib/postgresql/*/bin; do
    [[ -x "$dir/$name" ]] || continue
    ver=$(basename "$(dirname "$dir")")
    [[ "$ver" =~ ^[0-9]+$ ]] || continue
    (( ver > bestver )) && { bestver=$ver; best="$dir/$name"; }
  done
  [[ -n "$best" ]] && echo "$best" || command -v "$name" 2>/dev/null || true
}

PG_DUMP=$(resolve_pg_bin pg_dump)
PSQL=$(resolve_pg_bin psql)

if [[ -n "$PG_DUMP" ]]; then
  CLIENT_VER=$("$PG_DUMP" --version | grep -oE '[0-9]+' | head -1)
  echo "    pg_dump versi $CLIENT_VER  ($PG_DUMP)"
  if [[ "$PG_DUMP" != "$(command -v pg_dump 2>/dev/null)" ]]; then
    echo "    Catatan: /usr/bin/pg_dump menunjuk versi lain; skrip memakai path di atas."
  fi
else
  CLIENT_VER=0
  warn "pg_dump tidak tersedia."
fi

# ---------------------------------------------------------------------------
log "4/10  Pengguna sistem dan direktori"
# ---------------------------------------------------------------------------
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 755 /opt/ebisnis "$LOG_DIR" "$STATE_DIR"

# /etc/ebisnis harus dapat DITELUSURI oleh pengguna aplikasi. Berkas di dalamnya
# boleh 640, tetapi tanpa izin x pada direktorinya berkas itu tetap tidak dapat
# dibuka, dan dotenv gagal tanpa pesan — gejalanya muncul jauh kemudian sebagai
# "Environment variable not found: DATABASE_URL" dari Prisma.
install -d -o root -g "$APP_USER" -m 750 /etc/ebisnis

# Backup hanya disentuh root (update.sh berjalan sebagai root), jadi tetap 700.
install -d -o root -g root -m 700 "$BACKUP_DIR"

# ---------------------------------------------------------------------------
log "5/10  Konfigurasi environment"
# ---------------------------------------------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  echo "    $ENV_FILE sudah ada — tidak ditimpa."
else
  die "$ENV_FILE belum ada.

Buat lebih dahulu dari contoh, isi nilainya, lalu jalankan ulang skrip ini:

    sudo install -d -o root -g $APP_USER -m 750 /etc/ebisnis
    sudo cp deploy/env.production.example $ENV_FILE
    sudo chown root:$APP_USER $ENV_FILE
    sudo chmod 640 $ENV_FILE
    sudo nano $ENV_FILE

Yang WAJIB diisi: DATABASE_URL, DIRECT_DATABASE_URL, DATABASE_ADMIN_URL,
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, BOOTSTRAP_SUPER_ADMIN_PASSWORD,
CORS_ORIGINS, APP_URL, WEB_URL."
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

# Buktikan pengguna aplikasi benar-benar dapat membacanya. Tanpa pemeriksaan ini,
# kesalahan izin baru terlihat beberapa langkah kemudian sebagai pesan Prisma
# yang menyesatkan tentang variabel lingkungan.
if ! sudo -u "$APP_USER" test -r "$ENV_FILE"; then
  die "Pengguna '$APP_USER' tidak dapat membaca $ENV_FILE.

Periksa izin direktori dan berkasnya:
    ls -ld /etc/ebisnis
    ls -l  $ENV_FILE

Yang benar:
    /etc/ebisnis        drwxr-x---  root:$APP_USER   (750)
    $ENV_FILE  -rw-r-----  root:$APP_USER   (640)"
fi
echo "    Konfigurasi dapat dibaca oleh $APP_USER."

# ---------------------------------------------------------------------------
log "6/10  Ambil source dari GitHub"
# ---------------------------------------------------------------------------
if [[ -d "$APP_DIR/.git" ]]; then
  echo "    Repository sudah ada."
  # Clone yang terlanjur dibuat sebagai root tidak dapat dipakai user aplikasi.
  # Diperbaiki di sini, bukan dibiarkan gagal dengan pesan izin yang samar.
  if [[ "$(stat -c '%U' "$APP_DIR")" != "$APP_USER" ]]; then
    echo "    Kepemilikan bukan $APP_USER — memperbaiki."
    chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
  fi
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --all --tags --prune
else
  install -d -o "$APP_USER" -g "$APP_USER" "$(dirname "$APP_DIR")"
  install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
  echo "    Repository privat memerlukan autentikasi."
  echo "    Cara yang dianjurkan: deploy key SSH, dan REPO_URL memakai bentuk SSH."
  echo "    Lihat docs/deployment/ubuntu.md bagian \"Akses ke repository privat\"."
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$BRANCH"
sudo -u "$APP_USER" git -C "$APP_DIR" config core.hooksPath .githooks

# Satu sumber konfigurasi untuk runtime NestJS dan Prisma CLI.
ln -sfn "$ENV_FILE" "$APP_DIR/apps/api/.env"
chown -h "$APP_USER":"$APP_USER" "$APP_DIR/apps/api/.env"

# Frontend memanggil API pada origin yang sama; Apache yang mem-proxy /api.
printf 'VITE_API_BASE_URL=/api/v1\nVITE_APP_NAME=eBisnis.id\n' > "$APP_DIR/apps/web/.env"
chown "$APP_USER":"$APP_USER" "$APP_DIR/apps/web/.env"

# ---------------------------------------------------------------------------
log "7/10  Install dependency dan build"
# ---------------------------------------------------------------------------
# Dependency pengembangan sengaja ikut dipasang: seed:platform, seed:verify,
# dan docs:generate berjalan lewat ts-node.
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && pnpm install --frozen-lockfile"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && pnpm db:generate && pnpm build"

# ---------------------------------------------------------------------------
log "8/10  Migration dan super admin"
# ---------------------------------------------------------------------------
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/api' && pnpm exec prisma migrate deploy"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && pnpm seed:platform"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && pnpm seed:verify" || warn "Verifikasi seed melaporkan masalah — periksa keluarannya."

# Bandingkan versi server dengan versi pg_dump selagi koneksi sudah terbukti.
# Lebih baik ketahuan sekarang daripada saat pembaruan pertama gagal backup.
ADMIN_URL=$(grep -E '^DATABASE_ADMIN_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
SERVER_VER=$(sudo -u "$APP_USER" "${PSQL:-psql}" "$ADMIN_URL" -tAc "SHOW server_version" 2>/dev/null | grep -oE '^[0-9]+' || echo '')
if [[ -n "$SERVER_VER" && "$CLIENT_VER" -gt 0 ]]; then
  echo "    Server PostgreSQL $SERVER_VER, pg_dump $CLIENT_VER"
  if [[ "$CLIENT_VER" -lt "$SERVER_VER" ]]; then
    warn "pg_dump ($CLIENT_VER) LEBIH TUA daripada server ($SERVER_VER)."
    warn "deploy/update.sh tidak akan dapat membuat backup dan akan berhenti."
    warn "Lihat docs/deployment/ubuntu.md bagian \"Backup ketika pg_dump lebih tua\"."
  fi
fi

# ---------------------------------------------------------------------------
log "9/10  systemd"
# ---------------------------------------------------------------------------
install -m 644 "$APP_DIR/deploy/systemd/ebisnis-api.service" /etc/systemd/system/ebisnis-api.service
systemctl daemon-reload
systemctl enable --now ebisnis-api

for i in $(seq 1 30); do
  curl -fsS -m 3 http://127.0.0.1:3000/health >/dev/null 2>&1 && break
  [[ $i -eq 30 ]] && { journalctl -u ebisnis-api -n 40 --no-pager; die "API tidak merespons /health."; }
  sleep 2
done
echo "    API sehat."

# ---------------------------------------------------------------------------
log "10/10  Apache"
# ---------------------------------------------------------------------------
a2enmod proxy proxy_http headers rewrite ssl deflate expires >/dev/null
install -m 644 "$APP_DIR/deploy/apache/ebisnis-app.inc" /etc/apache2/conf-available/ebisnis-app.inc
install -m 644 "$APP_DIR/deploy/apache/ebisnis.conf"    /etc/apache2/sites-available/ebisnis.conf

if [[ ! -f /etc/ssl/certs/apache-selfsigned.crt ]]; then
  warn "Sertifikat /etc/ssl/certs/apache-selfsigned.crt tidak ditemukan; membuat self-signed sementara."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/apache-selfsigned.key \
    -out    /etc/ssl/certs/apache-selfsigned.crt \
    -subj "/C=ID/ST=DKI Jakarta/L=Jakarta/O=eBisnis/CN=ebisnis.id" 2>/dev/null
fi

a2ensite ebisnis >/dev/null
a2dissite 000-default >/dev/null 2>&1 || true
apache2ctl configtest
systemctl reload apache2

if ufw status | grep -q "Status: active"; then
  ufw allow 'Apache Full' >/dev/null || true
fi

# ---------------------------------------------------------------------------
log "Selesai"
# ---------------------------------------------------------------------------
cat <<EOF

  Aplikasi   : http://$(hostname -I | awk '{print $1}')/   dan  https://ebisnis.id/
  Health     : curl -s http://127.0.0.1:3000/health
  Log API    : journalctl -u ebisnis-api -f
  Commit     : $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)

  Login super admin memakai BOOTSTRAP_SUPER_ADMIN_USERNAME dan
  BOOTSTRAP_SUPER_ADMIN_PASSWORD dari $ENV_FILE.
  Kata sandi WAJIB diganti pada login pertama.

  Pembaruan berikutnya cukup:  sudo bash $APP_DIR/deploy/update.sh

EOF
