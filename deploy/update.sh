#!/usr/bin/env bash
#
# Pembaruan eBisnis.id dari GitHub.
#
#   sudo bash /opt/ebisnis/app/deploy/update.sh              # ke ujung branch main
#   sudo bash /opt/ebisnis/app/deploy/update.sh v7.0.0       # ke tag tertentu
#
# Urutan: backup database -> ambil source -> build -> migration -> restart ->
# health check. Bila health check gagal, aplikasi otomatis dikembalikan ke
# commit sebelumnya.
#
# CATATAN PENTING TENTANG ROLLBACK
#   Pengembalian otomatis hanya mengembalikan APLIKASI, bukan database.
#   Migration bersifat additive (expand-and-contract), sehingga versi lama tetap
#   dapat berjalan di atas schema yang sudah dimutakhirkan. Bila suatu rilis
#   memuat migration yang tidak reversible, hal itu dinyatakan pada catatan
#   rilisnya dan pemulihan database memakai backup yang dibuat langkah pertama.

set -Eeuo pipefail

APP_USER=ebisnis
APP_DIR=/opt/ebisnis/app
ENV_FILE=/etc/ebisnis/ebisnis.env
BACKUP_DIR=/var/backups/ebisnis
TARGET=${1:-}
KEEP_BACKUPS=10

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Jalankan dengan sudo."
[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR bukan repository Git. Jalankan install.sh lebih dahulu."
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE tidak ditemukan."

as_app() { sudo -u "$APP_USER" bash -lc "$*"; }
PREVIOUS=$(as_app "git -C '$APP_DIR' rev-parse HEAD")

# ---------------------------------------------------------------------------
log "1/7  Backup database"
# ---------------------------------------------------------------------------
# shellcheck disable=SC1090
ADMIN_URL=$(grep -E '^DATABASE_ADMIN_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
[[ -n "$ADMIN_URL" ]] || die "DATABASE_ADMIN_URL tidak ada pada $ENV_FILE."

install -d -m 700 "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ebisnis-$STAMP.dump"

if pg_dump --dbname="$ADMIN_URL" --format=custom --file="$BACKUP_FILE" 2>/tmp/pgdump.err; then
  chmod 600 "$BACKUP_FILE"
  echo "    $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  cat /tmp/pgdump.err >&2
  die "Backup gagal. Pembaruan dihentikan — tidak ada perubahan yang dilakukan."
fi

# Simpan sejumlah backup terakhir saja.
ls -1t "$BACKUP_DIR"/ebisnis-*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

# ---------------------------------------------------------------------------
log "2/7  Ambil source"
# ---------------------------------------------------------------------------
as_app "git -C '$APP_DIR' fetch --all --tags --prune"

if [[ -n "$TARGET" ]]; then
  as_app "git -C '$APP_DIR' checkout --quiet '$TARGET'"
else
  BRANCH=$(as_app "git -C '$APP_DIR' rev-parse --abbrev-ref HEAD")
  [[ "$BRANCH" == "HEAD" ]] && BRANCH=main
  as_app "git -C '$APP_DIR' checkout --quiet '$BRANCH'"
  as_app "git -C '$APP_DIR' pull --ff-only origin '$BRANCH'"
fi

NEW=$(as_app "git -C '$APP_DIR' rev-parse HEAD")
if [[ "$PREVIOUS" == "$NEW" ]]; then
  echo "    Sudah pada versi terbaru ($(as_app "git -C '$APP_DIR' rev-parse --short HEAD")). Tidak ada yang dikerjakan."
  exit 0
fi
echo "    ${PREVIOUS:0:7} -> ${NEW:0:7}"
as_app "git -C '$APP_DIR' log --oneline '$PREVIOUS'..'$NEW'" | sed 's/^/      /' || true

# Symlink .env dipastikan tetap benar setelah checkout.
ln -sfn "$ENV_FILE" "$APP_DIR/apps/api/.env"
chown -h "$APP_USER":"$APP_USER" "$APP_DIR/apps/api/.env"

rollback() {
  warn "Mengembalikan aplikasi ke ${PREVIOUS:0:7}"
  as_app "git -C '$APP_DIR' checkout --quiet '$PREVIOUS'"
  as_app "cd '$APP_DIR' && pnpm install --frozen-lockfile && pnpm db:generate && pnpm build" || true
  systemctl restart ebisnis-api || true
  cat <<EOF

  Aplikasi dikembalikan ke commit sebelumnya.
  Database TIDAK dikembalikan. Backup tersedia bila diperlukan:

      $BACKUP_FILE

  Pemulihan database (menimpa data saat ini, lakukan hanya bila yakin):
      pg_restore --clean --if-exists --dbname="\$DATABASE_ADMIN_URL" $BACKUP_FILE

EOF
  exit 1
}

# ---------------------------------------------------------------------------
log "3/7  Install dependency dan build"
# ---------------------------------------------------------------------------
as_app "cd '$APP_DIR' && pnpm install --frozen-lockfile" || rollback
as_app "cd '$APP_DIR' && pnpm db:generate && pnpm build"  || rollback

# ---------------------------------------------------------------------------
log "4/7  Migration"
# ---------------------------------------------------------------------------
as_app "cd '$APP_DIR/apps/api' && pnpm exec prisma migrate status" || true
as_app "cd '$APP_DIR/apps/api' && pnpm exec prisma migrate deploy" || rollback

# ---------------------------------------------------------------------------
log "5/7  Restart layanan"
# ---------------------------------------------------------------------------
install -m 644 "$APP_DIR/deploy/systemd/ebisnis-api.service" /etc/systemd/system/ebisnis-api.service
systemctl daemon-reload
systemctl restart ebisnis-api

# ---------------------------------------------------------------------------
log "6/7  Health check"
# ---------------------------------------------------------------------------
HEALTHY=0
for i in $(seq 1 30); do
  if curl -fsS -m 3 http://127.0.0.1:3000/health | grep -q '"status":"ok"'; then HEALTHY=1; break; fi
  sleep 2
done
if [[ $HEALTHY -ne 1 ]]; then
  journalctl -u ebisnis-api -n 50 --no-pager
  rollback
fi
curl -s http://127.0.0.1:3000/health | sed 's/^/    /'

as_app "cd '$APP_DIR' && pnpm seed:verify" || warn "Verifikasi seed melaporkan masalah — periksa keluarannya."

# ---------------------------------------------------------------------------
log "7/7  Apache"
# ---------------------------------------------------------------------------
install -m 644 "$APP_DIR/deploy/apache/ebisnis-app.inc" /etc/apache2/conf-available/ebisnis-app.inc
install -m 644 "$APP_DIR/deploy/apache/ebisnis.conf"    /etc/apache2/sites-available/ebisnis.conf
apache2ctl configtest && systemctl reload apache2

cat <<EOF

  Pembaruan selesai.

  Versi     : $(as_app "git -C '$APP_DIR' describe --tags --always")
  Commit    : ${NEW:0:7}
  Sebelumnya: ${PREVIOUS:0:7}
  Backup    : $BACKUP_FILE

  Kembali ke versi sebelumnya bila diperlukan:
      sudo bash $APP_DIR/deploy/update.sh $PREVIOUS

EOF
