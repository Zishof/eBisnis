#!/usr/bin/env bash
#
# Instalasi eBisnis.id pada Ubuntu 22.04.
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
[[ "${VERSION_ID:-}" == "22.04" ]] || warn "Diuji pada Ubuntu 22.04; terdeteksi ${PRETTY_NAME:-tidak diketahui}."

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
log "3/10  Klien PostgreSQL 17"
# ---------------------------------------------------------------------------
# Versi klien harus >= versi server, jika tidak pg_dump menolak bekerja.
if ! command -v pg_dump >/dev/null || ! pg_dump --version | grep -qE ' 1[7-9]| 2[0-9]'; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
http://apt.postgresql.org/pub/repos/apt jammy-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq postgresql-client-17
fi
echo "    $(pg_dump --version)"

# ---------------------------------------------------------------------------
log "4/10  Pengguna sistem dan direktori"
# ---------------------------------------------------------------------------
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 755 /opt/ebisnis "$LOG_DIR" "$STATE_DIR"
install -d -o root      -g root       -m 700 /etc/ebisnis "$BACKUP_DIR"

# ---------------------------------------------------------------------------
log "5/10  Konfigurasi environment"
# ---------------------------------------------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  echo "    $ENV_FILE sudah ada — tidak ditimpa."
else
  die "$ENV_FILE belum ada.

Buat lebih dahulu dari contoh, isi nilainya, lalu jalankan ulang skrip ini:

    sudo install -d -m 700 /etc/ebisnis
    sudo cp deploy/env.production.example $ENV_FILE
    sudo chmod 600 $ENV_FILE
    sudo nano $ENV_FILE

Yang WAJIB diisi: DATABASE_URL, DIRECT_DATABASE_URL, DATABASE_ADMIN_URL,
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, BOOTSTRAP_SUPER_ADMIN_PASSWORD,
CORS_ORIGINS, APP_URL, WEB_URL."
fi
chmod 600 "$ENV_FILE"
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

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
  echo "    Lihat docs/deployment/ubuntu-22.04.md bagian \"Akses ke repository privat\"."
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
