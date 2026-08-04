#!/usr/bin/env bash
#
# Pembaruan eBisnis.id dari GitHub.
#
#   sudo bash /opt/ebisnis/app/deploy/update.sh              # ke ujung branch main
#   sudo bash /opt/ebisnis/app/deploy/update.sh v7.0.0       # ke tag tertentu
#   sudo bash /opt/ebisnis/app/deploy/update.sh --force      # bangun ulang meski commit sama
#
# Urutan: backup database -> ambil source -> build -> migration -> restart ->
# health check -> sandbox demo ePesantren -> Apache. Bila health check gagal,
# aplikasi otomatis dikembalikan ke commit sebelumnya.
#
# CATATAN PENTING TENTANG ROLLBACK
#   Pengembalian otomatis hanya mengembalikan APLIKASI, bukan database.
#   Migration bersifat additive (expand-and-contract), sehingga versi lama tetap
#   dapat berjalan di atas schema yang sudah dimutakhirkan. Bila suatu rilis
#   memuat migration yang tidak reversible, hal itu dinyatakan pada catatan
#   rilisnya dan pemulihan database memakai backup yang dibuat langkah pertama.
#
# CATATAN PENTING TENTANG SKRIP INI MENGUBAH DIRINYA SENDIRI
#   `git pull` pada langkah "Ambil source" dapat menimpa update.sh ini
#   SENDIRI. bash sudah membaca isi lamanya ke buffer sebelum baris itu
#   berjalan, sehingga TANPA penanganan khusus, seluruh langkah SESUDAHNYA
#   tetap memakai isi lama walau berkas di disk sudah baru (lihat variabel
#   EBISNIS_REEXECED). Skrip ini menjalankan ulang dirinya sendiri persis
#   sekali, tepat setelah source dimutakhirkan, supaya perubahan pada
#   update.sh sendiri ikut aktif pada deploy yang SAMA yang menariknya --
#   bukan baru pada deploy berikutnya.

set -Eeuo pipefail

APP_USER=ebisnis
APP_DIR=/opt/ebisnis/app
ENV_FILE=/etc/ebisnis/ebisnis.env
BACKUP_DIR=/var/backups/ebisnis
KEEP_BACKUPS=10

# Commit yang terakhir SELESAI dipasang — bukan sekadar yang ada di working tree.
#
# Keduanya berbeda persis ketika seseorang menjalankan `git pull` manual: source
# maju, tetapi build, `db:generate`, dan `migrate deploy` belum dijalankan. Bila
# perbandingan memakai HEAD, skrip menyimpulkan tidak ada yang perlu dikerjakan
# dan melewatkan seluruh langkah itu — meninggalkan aplikasi yang sudah lama
# dengan source yang sudah baru.
DEPLOY_STAMP=/var/lib/ebisnis/deployed-commit

FORCE=0
TARGET=
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -*)      echo "Argumen tidak dikenal: $arg" >&2; exit 2 ;;
    *)       TARGET=$arg ;;
  esac
done

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Jalankan dengan sudo."
[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR bukan repository Git. Jalankan install.sh lebih dahulu."
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE tidak ditemukan."

as_app() { sudo -u "$APP_USER" bash -lc "$*"; }

# Menjalankan ulang diri sendiri sekali, TEPAT SETELAH source dimutakhirkan
# (lihat titik `exec` di bawah), sebab bash membaca skrip yang sedang berjalan
# dari buffer yang sama sepanjang eksekusi -- `git pull` yang menimpa berkas
# skrip ini SENDIRI di tengah jalan tidak membuat langkah-langkah SESUDAHNYA
# ikut memakai isi yang baru. Tanpa ini, setiap perubahan pada update.sh
# sendiri (mis. langkah baru) baru benar-benar aktif pada deploy KEDUA
# setelahnya -- persis apa yang terjadi pada langkah "Sandbox demo
# ePesantren": deploy yang menambahkannya berjalan tanpa satu pun jejaknya.
#
# `PREVIOUS` wajib disusulkan lewat environment, bukan dihitung ulang: pada
# proses yang dijalankan ulang, HEAD git SUDAH berada di commit baru (checkout
# di langkah berikutnya sudah terjadi pada proses sebelumnya), sehingga
# menghitungnya ulang di sini akan salah menganggap commit baru sebagai
# commit lama.
if [[ -n "${EBISNIS_REEXECED:-}" ]]; then
  PREVIOUS="$EBISNIS_PREVIOUS"
else
  PREVIOUS=$(as_app "git -C '$APP_DIR' rev-parse HEAD")
fi

# ---------------------------------------------------------------------------
log "1/9  Backup database"
# ---------------------------------------------------------------------------
# shellcheck disable=SC1090
ADMIN_URL=$(grep -E '^DATABASE_ADMIN_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
[[ -n "$ADMIN_URL" ]] || die "DATABASE_ADMIN_URL tidak ada pada $ENV_FILE."

install -d -m 700 "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ebisnis-$STAMP.dump"

if [[ "${SKIP_DB_BACKUP:-0}" == "1" ]]; then
  # Jalan keluar untuk kasus backup ditangani di tempat lain, misalnya cron pada
  # host database. Sengaja harus dinyatakan eksplisit setiap kali, tidak
  # disimpan sebagai pengaturan, supaya tidak terlupa bahwa ia aktif.
  warn "SKIP_DB_BACKUP=1 — backup DILEWATI atas permintaan eksplisit."
  warn "Pastikan backup mutakhir memang sudah ada sebelum melanjutkan."
  BACKUP_FILE="(dilewati)"
else
  # /usr/bin/pg_dump adalah wrapper postgresql-common yang memilih versi
  # berdasarkan cluster default, bukan versi tertinggi yang terpasang. Binary
  # aslinya dicari langsung agar klien terbaru benar-benar terpakai.
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

  if [[ -z "$PG_DUMP" ]]; then
    die "pg_dump tidak ditemukan. Pasang klien PostgreSQL, atau jalankan backup
di host database lalu ulangi dengan:  sudo SKIP_DB_BACKUP=1 bash $0"
  fi

  CLIENT_VER=$("$PG_DUMP" --version | grep -oE '[0-9]+' | head -1)
  SERVER_VER=$("${PSQL:-psql}" "$ADMIN_URL" -tAc "SHOW server_version" 2>/dev/null | grep -oE '^[0-9]+' || echo '')

  if [[ -n "$SERVER_VER" && "$CLIENT_VER" -lt "$SERVER_VER" ]]; then
    die "pg_dump versi $CLIENT_VER lebih tua daripada server PostgreSQL $SERVER_VER.

pg_dump menolak membuat dump dari server yang lebih baru, sehingga backup tidak
mungkin dibuat dari mesin ini. Pembaruan dihentikan sebelum ada yang berubah.

Pilihan:
  1. Pasang klien PostgreSQL $SERVER_VER pada server ini.
  2. Jalankan backup pada host database, lalu ulangi dengan:
         sudo SKIP_DB_BACKUP=1 bash $0
  3. Ambil dump lewat container:
         docker run --rm postgres:$SERVER_VER pg_dump --dbname='<URL>' -Fc > backup.dump

Rincian: docs/deployment/ubuntu.md bagian \"Backup ketika pg_dump lebih tua\"."
  fi

  if [[ -n "${EBISNIS_REEXECED:-}" ]]; then
    # Sudah dibuat pada proses sebelum dijalankan ulang (lihat catatan
    # EBISNIS_REEXECED di atas) -- membuatnya lagi di sini akan menghasilkan
    # dump kedua yang percuma dari database yang belum sempat berubah.
    BACKUP_FILE="$EBISNIS_BACKUP_FILE"
    echo "    sudah dibuat sebelum menjalankan ulang skrip: $BACKUP_FILE"
  else
    echo "    memakai $PG_DUMP (versi $CLIENT_VER), server versi ${SERVER_VER:-?}"
    if "$PG_DUMP" --dbname="$ADMIN_URL" --format=custom --file="$BACKUP_FILE" 2>/tmp/pgdump.err; then
      chmod 600 "$BACKUP_FILE"
      echo "    $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
    else
      cat /tmp/pgdump.err >&2
      die "Backup gagal. Pembaruan dihentikan — tidak ada perubahan yang dilakukan."
    fi
  fi
fi

# Simpan sejumlah backup terakhir saja.
ls -1t "$BACKUP_DIR"/ebisnis-*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

# ---------------------------------------------------------------------------
log "2/9  Ambil source"
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

DEPLOYED=$(cat "$DEPLOY_STAMP" 2>/dev/null || true)
if [[ -z "$DEPLOYED" ]]; then
  # Belum pernah ada penanda: instalasi lama, atau penanda terhapus. Yang
  # terpasang tidak dapat dipastikan, jadi dibangun ulang. Membangun ulang
  # tanpa perlu hanya memakan waktu; melewatinya tanpa perlu meninggalkan
  # aplikasi yang tidak sesuai sourcenya.
  echo "    Penanda deployment belum ada — dibangun ulang untuk memastikan."
elif [[ "$DEPLOYED" == "$NEW" && $FORCE -eq 0 ]]; then
  echo "    ${NEW:0:7} sudah terpasang seutuhnya. Tidak ada yang dikerjakan."
  echo "    Untuk membangun ulang: sudo bash $0 --force"
  exit 0
elif [[ "$DEPLOYED" == "$NEW" ]]; then
  echo "    ${NEW:0:7} sudah terpasang, dibangun ulang atas permintaan (--force)."
fi
echo "    ${PREVIOUS:0:7} -> ${NEW:0:7}"
as_app "git -C '$APP_DIR' log --oneline '$PREVIOUS'..'$NEW'" | sed 's/^/      /' || true

# Menjalankan ulang diri sendiri TEPAT SEKALI, sekarang bahwa source sudah
# berada di commit baru -- lihat catatan panjang pada EBISNIS_REEXECED di
# atas. Sesudah titik ini, seluruh langkah memakai isi update.sh yang baru
# saja ditarik, bukan isi yang sudah dibaca bash sebelum `git pull` berjalan.
if [[ -z "${EBISNIS_REEXECED:-}" ]]; then
  export EBISNIS_REEXECED=1 EBISNIS_PREVIOUS="$PREVIOUS" EBISNIS_BACKUP_FILE="$BACKUP_FILE"
  exec bash "$APP_DIR/deploy/update.sh" "$@"
fi

# Symlink .env dipastikan tetap benar setelah checkout.
ln -sfn "$ENV_FILE" "$APP_DIR/apps/api/.env"
chown -h "$APP_USER":"$APP_USER" "$APP_DIR/apps/api/.env"

# Kunci environment baru diperiksa terhadap contoh.
#
# Rilis yang menambah kunci env tidak akan gagal saat dijalankan — ia berjalan
# dengan fitur barunya mati. Kegagalan seperti itu tidak terlihat sampai ada
# yang mencoba memakainya lalu bingung mengapa tidak bekerja. Yang diperiksa
# hanya keberadaan kuncinya; nilainya tetap urusan operator.
CONTOH_ENV="$APP_DIR/deploy/env.production.example"
if [[ -f "$CONTOH_ENV" ]]; then
  KURANG=()
  while IFS= read -r KUNCI; do
    grep -qE "^${KUNCI}=" "$ENV_FILE" || KURANG+=("$KUNCI")
  done < <(grep -oE '^[A-Z][A-Z0-9_]*=' "$CONTOH_ENV" | tr -d '=' | sort -u)

  if [[ ${#KURANG[@]} -gt 0 ]]; then
    echo "    PERHATIAN: ${#KURANG[@]} kunci environment ada pada contoh tetapi tidak pada $ENV_FILE:"
    printf '      %s
' "${KURANG[@]}"
    echo "    Fitur yang bergantung padanya akan mati tanpa pesan galat."
    echo "    Lihat $CONTOH_ENV untuk keterangan masing-masing."
  fi
fi

rollback() {
  # Sasaran pengembalian adalah commit yang terakhir benar-benar berjalan sehat,
  # bukan HEAD sebelum proses ini. Keduanya berbeda setelah `git pull` manual —
  # dan di situ HEAD sebelumnya justru commit yang sedang gagal, sehingga
  # mengembalikannya ke sana tidak memperbaiki apa pun.
  local target=${DEPLOYED:-$PREVIOUS}
  warn "Mengembalikan aplikasi ke ${target:0:7}"
  as_app "git -C '$APP_DIR' checkout --quiet '$target'"
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
log "3/9  Install dependency dan build"
# ---------------------------------------------------------------------------
as_app "cd '$APP_DIR' && pnpm install --frozen-lockfile" || rollback
as_app "cd '$APP_DIR' && pnpm db:generate && pnpm build"  || rollback

# ---------------------------------------------------------------------------
log "4/9  Migration"
# ---------------------------------------------------------------------------
# Schema platform.
as_app "cd '$APP_DIR/apps/api' && pnpm exec prisma migrate status" || true
as_app "cd '$APP_DIR/apps/api' && pnpm exec prisma migrate deploy" || rollback

# Schema tenant.
#
# Terlewat sampai V9-5: langkah ini hanya menerapkan migration platform,
# sehingga setiap schema tenant tertinggal pada versi saat ia dibuat. Tabel
# yang ditambahkan rilis berikutnya tidak pernah ada di sana, dan gejalanya
# baru muncul jauh kemudian sebagai "relation ... does not exist" pada fitur
# yang tampak tidak berhubungan.
#
# Idempotent, dan menolak menerapkan ulang migration yang checksum-nya berbeda
# — perbedaan menghasilkan error, bukan penerapan diam.
as_app "cd '$APP_DIR' && pnpm --filter @ebisnis/api migrate:tenants" || rollback

# ---------------------------------------------------------------------------
log "5/9  Restart layanan"
# ---------------------------------------------------------------------------
install -m 644 "$APP_DIR/deploy/systemd/ebisnis-api.service" /etc/systemd/system/ebisnis-api.service
systemctl daemon-reload
systemctl restart ebisnis-api

# ---------------------------------------------------------------------------
log "6/9  Health check"
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

# Penanda ditulis SETELAH health check lulus, bukan setelah build. Build yang
# menghasilkan aplikasi yang tidak mau menyala bukan deployment yang selesai,
# dan menandainya selesai akan membuat percobaan berikutnya dilewati.
install -d -m 755 "$(dirname "$DEPLOY_STAMP")"
printf '%s
' "$NEW" > "$DEPLOY_STAMP"

# ---------------------------------------------------------------------------
log "7/10  Sandbox demo ePesantren"
# ---------------------------------------------------------------------------
# Mendaftarkan ponpes_demo (bila belum ada) lewat alur publik yang sama
# dengan pendaftar asli, lalu menyemai data contoh besar TEPAT SEKALI --
# lihat deploy/ensure-demo-pesantren.sh untuk jaminan idempotensinya.
# Kegagalan di sini tidak pernah menggagalkan deploy.
#
# `${PSQL:-psql}` sebab `$PSQL` hanya diisi di dalam langkah backup, dan
# tidak ada sama sekali bila dipanggil dengan SKIP_DB_BACKUP=1.
APP_DIR="$APP_DIR" APP_USER="$APP_USER" ADMIN_URL="$ADMIN_URL" PSQL_BIN="${PSQL:-psql}" \
  bash "$APP_DIR/deploy/ensure-demo-pesantren.sh" \
  || warn "Penyiapan sandbox demo ePesantren gagal — periksa manual bila perlu."

# ---------------------------------------------------------------------------
log "8/10  Pelanggan pertama: Raudlatul Ulum"
# ---------------------------------------------------------------------------
# Mendaftarkan raudlatul-ulum.santri.info (bila belum ada) lewat alur publik
# yang sama dengan pendaftar asli, lalu menyiapkan profil situs, unit
# pendidikan, mata pelajaran, tagihan percobaan, dan akun staf -- lihat
# deploy/onboard-raudlatul-ulum.sh untuk jaminan idempotensinya. BERBEDA dari
# sandbox demo di atas: ini pelanggan sungguhan, bukan tenant bersama.
# Kegagalan di sini tidak pernah menggagalkan deploy.
APP_DIR="$APP_DIR" APP_USER="$APP_USER" ADMIN_URL="$ADMIN_URL" PSQL_BIN="${PSQL:-psql}" \
  bash "$APP_DIR/deploy/onboard-raudlatul-ulum.sh" \
  || warn "Penyiapan tenant Raudlatul Ulum gagal — periksa manual bila perlu."

# ---------------------------------------------------------------------------
log "9/10  Pelanggan inventory: Caruban Medika Nusantara"
# ---------------------------------------------------------------------------
# Membuat schema `cmnmedika_inventory`, akun pemilik/sales/admin, domain
# cmnmedika-inventory.ebisnis.id, serta impor DBF legacy bila foldernya tersedia.
# Kegagalan di sini tidak menggagalkan deploy utama.
APP_DIR="$APP_DIR" APP_USER="$APP_USER" \
  bash "$APP_DIR/deploy/onboard-cmn-inventory.sh" \
  || warn "Penyiapan tenant Caruban Medika Nusantara gagal -- periksa manual bila perlu."

# ---------------------------------------------------------------------------
log "10/10  Apache"
# ---------------------------------------------------------------------------
POS_UPDATE_DIR=/opt/ebisnis/updates/pos
install -d -o "$APP_USER" -g "$APP_USER" -m 755 "$POS_UPDATE_DIR"

# Asset POS/Inventory Flutter boleh hidup publik di server, sementara repository
# tetap private. Bila token server tersedia, tarik asset dari GitHub Release
# private ke folder publik ini. Token TIDAK pernah dikirim ke klien; klien hanya
# membaca https://ebisnis.id/update/...
POS_RELEASE_TOKEN=$(
  { grep -E '^(POS_RELEASE_GITHUB_TOKEN|GITHUB_TOKEN)=' "$ENV_FILE" || true; } \
    | head -1 \
    | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//'
)
if [[ -n "$POS_RELEASE_TOKEN" ]]; then
  if command -v curl >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    RELEASES_JSON=$(mktemp)
    ASSETS_LIST=$(mktemp)
    if curl -fsSL \
      -H "Authorization: Bearer $POS_RELEASE_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      https://api.github.com/repos/Zishof/eBisnis/releases \
      -o "$RELEASES_JSON"; then
      node - "$RELEASES_JSON" "$ASSETS_LIST" <<'NODE'
const fs = require('fs');
const releases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const lines = [];
for (const prefix of ['pos-v', 'inventory-v']) {
  const release = releases.find((r) => !r.draft && !r.prerelease && String(r.tag_name || '').startsWith(prefix));
  for (const asset of release?.assets || []) {
    if (/\.(exe|apk)$/i.test(asset.name)) lines.push(`${asset.name}\t${asset.url}`);
  }
}
fs.writeFileSync(process.argv[3], lines.join('\n'));
NODE
      while IFS=$'\t' read -r nama url; do
        [[ -n "$nama" && -n "$url" ]] || continue
        tmp="$POS_UPDATE_DIR/$nama.tmp"
        if curl -fL \
          -H "Authorization: Bearer $POS_RELEASE_TOKEN" \
          -H "Accept: application/octet-stream" \
          "$url" \
          -o "$tmp"; then
          mv "$tmp" "$POS_UPDATE_DIR/$nama"
          chown "$APP_USER:$APP_USER" "$POS_UPDATE_DIR/$nama"
          chmod 644 "$POS_UPDATE_DIR/$nama"
        else
          rm -f "$tmp"
          warn "Gagal mengunduh asset pembaruan $nama dari GitHub Release."
        fi
      done < "$ASSETS_LIST"
    else
      warn "Gagal membaca GitHub Release pembaruan. Asset lama di $POS_UPDATE_DIR tetap dipakai."
    fi
    rm -f "$RELEASES_JSON" "$ASSETS_LIST"
  else
    warn "curl atau node tidak tersedia; asset pembaruan tidak ditarik otomatis."
  fi
else
  warn "POS_RELEASE_GITHUB_TOKEN belum ada; salin .exe/.apk manual ke $POS_UPDATE_DIR."
fi

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
      sudo bash $APP_DIR/deploy/update.sh ${DEPLOYED:-$PREVIOUS}

EOF
