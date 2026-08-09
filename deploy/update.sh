#!/usr/bin/env bash
#
# Pembaruan eBisnis.id dari GitHub.
#
#   sudo bash /opt/ebisnis/app/deploy/update.sh              # ke ujung branch main
#   sudo bash /opt/ebisnis/app/deploy/update.sh v7.0.0       # ke tag tertentu
#   sudo bash /opt/ebisnis/app/deploy/update.sh --force      # bangun ulang meski commit sama
#   sudo SKIP_RELEASE_TESTS=1 bash .../update.sh              # darurat; build tetap wajib
#
# Urutan: backup database -> ambil source -> release gate/build -> migration ->
# restart -> health check -> onboarding idempoten -> Apache. Bila langkah wajib
# gagal, aplikasi otomatis dikembalikan ke commit sebelumnya.
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
KEEP_BACKUPS=3
EXPECTED_PNPM_VERSION=9.15.4
DEPLOY_LOCK=/run/lock/ebisnis-update.lock
APACHE_ROLLBACK_DIR=

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
if [[ -n "$TARGET" && ! "$TARGET" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]]; then
  die "Target Git memuat karakter yang tidak diizinkan: $TARGET"
fi

as_app() { sudo -u "$APP_USER" bash -lc "$*"; }

# Satu host hanya boleh menjalankan satu update pada satu waktu. Tanpa lock,
# dua proses dapat checkout commit berbeda, menerapkan migration bersamaan,
# dan saling menimpa deployment stamp. File descriptor diwariskan saat skrip
# menjalankan ulang dirinya setelah git pull.
if [[ -z "${EBISNIS_DEPLOY_LOCKED:-}" ]]; then
  command -v flock >/dev/null 2>&1 || die "Perintah flock tidak tersedia (paket util-linux)."
  exec 9>"$DEPLOY_LOCK"
  flock -n 9 || die "Pembaruan lain sedang berjalan (lock: $DEPLOY_LOCK)."
  export EBISNIS_DEPLOY_LOCKED=1
fi

# Jangan menimpa hotfix atau eksperimen tracked yang dibuat langsung di
# server. Untracked artifacts sengaja diizinkan karena folder rilis POS dapat
# dikelola operator di luar Git.
if ! as_app "git -C '$APP_DIR' diff --quiet -- && git -C '$APP_DIR' diff --cached --quiet --"; then
  die "Working tree server mempunyai perubahan tracked. Commit/stash perubahan itu sebelum deploy."
fi

NODE_MAJOR=$(node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)
[[ "$NODE_MAJOR" =~ ^[0-9]+$ && "$NODE_MAJOR" -ge 20 ]] \
  || die "Node.js >=20 diperlukan; terdeteksi: $(node --version 2>/dev/null || echo tidak-ada)."
PNPM_VERSION=$(as_app "cd '$APP_DIR' && pnpm --version" 2>/dev/null || true)
[[ "$PNPM_VERSION" == "$EXPECTED_PNPM_VERSION" ]] \
  || die "pnpm $EXPECTED_PNPM_VERSION diperlukan; terdeteksi: ${PNPM_VERSION:-tidak-ada}. Jalankan corepack prepare pnpm@$EXPECTED_PNPM_VERSION --activate."

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
[[ "$PREVIOUS" =~ ^[0-9a-f]{40,64}$ ]] || die "Commit sebelumnya tidak valid: $PREVIOUS"

# ---------------------------------------------------------------------------
log "1/10  Backup database"
# ---------------------------------------------------------------------------
# shellcheck disable=SC1090
ADMIN_URL=$(grep -E '^DATABASE_ADMIN_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
[[ -n "$ADMIN_URL" ]] || die "DATABASE_ADMIN_URL tidak ada pada $ENV_FILE."

# Prisma multi-schema menyimpan histori migration di schema `platform`. URL
# tanpa `?schema=platform` dapat terhubung ke database tetapi gagal saat
# inisialisasi persistence migration. Fail-fast sebelum backup/build panjang,
# dan jangan pernah mencetak URL yang dapat memuat password.
DATABASE_URL_VALUE=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
DIRECT_DATABASE_URL_VALUE=$(grep -E '^DIRECT_DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
for DB_URL_LABEL in DATABASE_URL DIRECT_DATABASE_URL DATABASE_ADMIN_URL; do
  case "$DB_URL_LABEL" in
    DATABASE_URL) DB_URL_VALUE=$DATABASE_URL_VALUE ;;
    DIRECT_DATABASE_URL) DB_URL_VALUE=$DIRECT_DATABASE_URL_VALUE ;;
    DATABASE_ADMIN_URL) DB_URL_VALUE=$ADMIN_URL ;;
  esac
  [[ -n "$DB_URL_VALUE" ]] || die "$DB_URL_LABEL tidak ada pada $ENV_FILE."
  [[ "$DB_URL_VALUE" =~ [\?\&]schema=platform([\&]|$) ]] \
    || die "$DB_URL_LABEL wajib memuat parameter schema=platform. Nilai aktual disembunyikan."
done

install -d -m 700 "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ebisnis-$STAMP.dump"
BACKUP_PID=

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
    # Dimulai pada proses sebelum dijalankan ulang (lihat catatan EBISNIS_REEXECED
    # di atas) -- membuatnya lagi di sini akan menghasilkan dump kedua yang
    # percuma dari database yang belum sempat berubah. `exec` mengganti isi
    # proses tetapi mempertahankan PID-nya, sehingga proses pg_dump latar
    # belakang yang dimulai sebelum exec tetap anak proses yang SAMA di sini
    # dan tetap dapat ditunggu lewat PID-nya.
    BACKUP_FILE="$EBISNIS_BACKUP_FILE"
    BACKUP_PID="${EBISNIS_BACKUP_PID:-}"
    echo "    dimulai sebelum menjalankan ulang skrip, masih berjalan di latar belakang: $BACKUP_FILE"
  else
    # Dijalankan di latar belakang: baris "3/10" yang mengikuti (install,
    # lint, test, build) tidak menyentuh database sama sekali, sehingga aman
    # tumpang tindih dengan pg_dump. Ditunggu tepat sebelum "4/10 Migration"
    # -- langkah pertama yang benar-benar mengubah database -- supaya jaminan
    # "backup ada sebelum migration berjalan" tetap utuh.
    echo "    memakai $PG_DUMP (versi $CLIENT_VER), server versi ${SERVER_VER:-?}"
    echo "    dijalankan di latar belakang, ditunggu tepat sebelum 4/10 Migration."
    "$PG_DUMP" --dbname="$ADMIN_URL" --format=custom --file="$BACKUP_FILE" 2>/tmp/pgdump.err &
    BACKUP_PID=$!
  fi
fi

# Simpan sejumlah backup terakhir saja.
# Nama backup sepenuhnya dibentuk skrip (timestamp tanpa spasi/metakarakter),
# sehingga pengurutan mtime melalui ls aman untuk kumpulan terkontrol ini.
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/ebisnis-*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

# ---------------------------------------------------------------------------
log "2/10  Ambil source"
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
[[ "$NEW" =~ ^[0-9a-f]{40,64}$ ]] || die "Commit target tidak valid: $NEW"

DEPLOYED=$(cat "$DEPLOY_STAMP" 2>/dev/null || true)
if [[ -n "$DEPLOYED" && ! "$DEPLOYED" =~ ^[0-9a-f]{40,64}$ ]]; then
  die "Isi deployment stamp tidak valid: $DEPLOY_STAMP"
fi
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
  export EBISNIS_REEXECED=1 EBISNIS_PREVIOUS="$PREVIOUS" EBISNIS_BACKUP_FILE="$BACKUP_FILE" EBISNIS_BACKUP_PID="$BACKUP_PID"
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

  # Bila kegagalan terjadi sesudah konfigurasi Apache baru disalin tetapi
  # sebelum reload dinyatakan sehat, kembalikan berkas konfigurasi lama juga.
  # Tanpa ini Apache memang masih memakai konfigurasi lama di memori, tetapi
  # restart host berikutnya dapat gagal karena berkas rusak tertinggal di disk.
  if [[ -n "${APACHE_ROLLBACK_DIR:-}" && -d "$APACHE_ROLLBACK_DIR" ]]; then
    for name in ebisnis-app.inc ebisnis.conf; do
      case "$name" in
        ebisnis-app.inc) destination=/etc/apache2/conf-available/ebisnis-app.inc ;;
        ebisnis.conf) destination=/etc/apache2/sites-available/ebisnis.conf ;;
      esac
      if [[ -f "$APACHE_ROLLBACK_DIR/$name.missing" ]]; then
        rm -f "$destination"
      elif [[ -f "$APACHE_ROLLBACK_DIR/$name" ]]; then
        install -m 644 "$APACHE_ROLLBACK_DIR/$name" "$destination"
      fi
    done
    apache2ctl configtest >/dev/null 2>&1 && systemctl reload apache2 || true
  fi

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
log "3/10  Dependency, release gate, dan build"
# ---------------------------------------------------------------------------
as_app "cd '$APP_DIR' && pnpm install --frozen-lockfile" || rollback

# Berkas migration yang pernah ada pada commit terakhir terpasang tidak boleh
# berubah. Ini dijalankan sebelum migration menyentuh database, sehingga typo,
# rename, manifest drift, SQL destruktif, atau edit migration applied menghentikan
# deploy saat backup masih utuh dan layanan lama masih berjalan.
MIGRATION_BASE=${DEPLOYED:-$PREVIOUS}
as_app "git -C '$APP_DIR' cat-file -e '${MIGRATION_BASE}^{commit}'" || rollback
if ! as_app "git -C '$APP_DIR' merge-base --is-ancestor '$MIGRATION_BASE' HEAD"; then
  warn "Target bukan turunan linear dari commit terakhir terpasang ${MIGRATION_BASE:0:7}."
  warn "Deploy non-fast-forward berisiko menghapus migration dari source yang masih tercatat di database."
  rollback
fi
as_app "cd '$APP_DIR' && node scripts/ci/verify-migrations.mjs '$MIGRATION_BASE'" || rollback
as_app "cd '$APP_DIR' && node scripts/ci/verify-mitrainap-release.mjs" || rollback

if [[ "${SKIP_RELEASE_TESTS:-0}" == "1" ]]; then
  warn "SKIP_RELEASE_TESTS=1 — lint dan unit test dilewati atas permintaan eksplisit."
else
  as_app "cd '$APP_DIR' && pnpm lint" || rollback

  # Test tidak boleh mewarisi URL database produksi dari apps/api/.env.
  # Seluruh URL diarahkan ke port loopback tertutup; unit test yang tanpa
  # sengaja mencoba koneksi nyata akan gagal, bukan menyentuh data pelanggan.
  TEST_DATABASE_URL='postgresql://deploy_gate:blocked@127.0.0.1:1/deploy_gate?schema=platform'
  as_app "cd '$APP_DIR' && \
    export CI=true NODE_ENV=test \
      DATABASE_URL='$TEST_DATABASE_URL' \
      DIRECT_DATABASE_URL='$TEST_DATABASE_URL' \
      DATABASE_ADMIN_URL='$TEST_DATABASE_URL' && \
    pnpm --filter @ebisnis/api test -- --runInBand && \
    pnpm --filter @ebisnis/web test" || rollback
fi
as_app "cd '$APP_DIR' && pnpm db:generate && pnpm build" || rollback

# Backup latar belakang dari "1/10" ditunggu di sini -- tepat sebelum langkah
# pertama yang benar-benar mengubah database. `wait` pada PID spesifik bekerja
# walau backup dimulai pada proses sebelum `exec` menjalankan ulang skrip ini,
# karena `exec` mempertahankan PID prosesnya sendiri.
if [[ -n "$BACKUP_PID" ]]; then
  log "Menunggu backup database (PID $BACKUP_PID) selesai sebelum migration"
  if wait "$BACKUP_PID"; then
    chmod 600 "$BACKUP_FILE"
    echo "    $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
  else
    cat /tmp/pgdump.err >&2
    die "Backup gagal. Pembaruan dihentikan sebelum migration — tidak ada perubahan pada database."
  fi
fi

# ---------------------------------------------------------------------------
log "4/10  Migration platform dan seluruh tenant"
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
log "5/10  Restart layanan"
# ---------------------------------------------------------------------------
install -m 644 "$APP_DIR/deploy/systemd/ebisnis-api.service" /etc/systemd/system/ebisnis-api.service
systemctl daemon-reload || rollback
systemctl restart ebisnis-api || rollback

# ---------------------------------------------------------------------------
log "6/10  Health check"
# ---------------------------------------------------------------------------
HEALTHY=0
for attempt in $(seq 1 30); do
  if curl -fsS -m 3 http://127.0.0.1:3000/health | grep -q '"status":"ok"'; then
    HEALTHY=1
    echo "    sehat pada percobaan $attempt/30"
    break
  fi
  sleep 2
done
if [[ $HEALTHY -ne 1 ]]; then
  journalctl -u ebisnis-api -n 50 --no-pager
  rollback
fi
curl -s http://127.0.0.1:3000/health | sed 's/^/    /'

as_app "cd '$APP_DIR' && pnpm seed:verify" || warn "Verifikasi seed melaporkan masalah — periksa keluarannya."

# ---------------------------------------------------------------------------
log "7-9/10  Onboarding sandbox/pelanggan contoh (latar belakang)"
# ---------------------------------------------------------------------------
# Keempat proses ini (ePesantren, MitraInap, Raudlatul Ulum, CMN Inventory) TIDAK PERNAH
# menggagalkan deploy (lihat masing-masing `|| warn` di bawah) dan tidak ada
# langkah sesudahnya -- termasuk Apache pada "10/10" -- yang bergantung pada
# hasilnya. Karena itu keempatnya dijalankan paralel satu sama lain DAN paralel
# dengan Apache, bukan berurutan; hasilnya baru ditunggu tepat sebelum
# `DEPLOY_STAMP` ditulis, supaya skrip tidak keluar sementara mereka masih
# berjalan. Beda dengan backup pada "1/10": tidak ada satu pun langkah wajib
# yang menunggu keempatnya, jadi tidak perlu titik `wait` di tengah.
#
# `${PSQL:-psql}` sebab `$PSQL` hanya diisi di dalam langkah backup, dan tidak
# ada sama sekali bila dipanggil dengan SKIP_DB_BACKUP=1.
# APP_DIR pada sisi kanan sengaja dievaluasi oleh shell pemanggil; assignment
# di kiri hanya meneruskan nilainya ke proses onboarding.
# shellcheck disable=SC2097,SC2098
APP_DIR="$APP_DIR" APP_USER="$APP_USER" ADMIN_URL="$ADMIN_URL" PSQL_BIN="${PSQL:-psql}" \
  bash "$APP_DIR/deploy/ensure-demo-pesantren.sh" >/tmp/ensure-demo-pesantren.log 2>&1 &
PESANTREN_PID=$!

# shellcheck disable=SC2097,SC2098
# Mendaftarkan mitrainap_demo (bila belum ada) lewat alur publik yang sama
# dengan pendaftar asli -- lihat deploy/ensure-demo-mitrainap.sh (MI-3)
# untuk jaminan idempotensinya. Kegagalan di sini tidak pernah menggagalkan
# deploy.
APP_DIR="$APP_DIR" APP_USER="$APP_USER" ADMIN_URL="$ADMIN_URL" PSQL_BIN="${PSQL:-psql}" \
  bash "$APP_DIR/deploy/ensure-demo-mitrainap.sh" >/tmp/ensure-demo-mitrainap.log 2>&1 &
MITRAINAP_PID=$!

# Mendaftarkan raudlatul-ulum.santri.info (bila belum ada) lewat alur publik
# yang sama dengan pendaftar asli, lalu menyiapkan profil situs, unit
# pendidikan, mata pelajaran, tagihan percobaan, dan akun staf -- lihat
# deploy/onboard-raudlatul-ulum.sh untuk jaminan idempotensinya. BERBEDA dari
# sandbox demo di atas: ini pelanggan sungguhan, bukan tenant bersama.
# Kegagalan di sini tidak pernah menggagalkan deploy.
APP_DIR="$APP_DIR" APP_USER="$APP_USER" ADMIN_URL="$ADMIN_URL" PSQL_BIN="${PSQL:-psql}" \
  bash "$APP_DIR/deploy/onboard-raudlatul-ulum.sh" >/tmp/onboard-raudlatul-ulum.log 2>&1 &
RAUDLATUL_PID=$!

# Penyalinan DBF tetap sinkron (cepat, lokal) sebab skrip onboarding di
# bawahnya butuh berkasnya sudah di tempat sebelum ia mulai.
# Membuat schema `cmnmedika_inventory`, akun pemilik/sales/admin, domain
# cmnmedika-inventory.ebisnis.id, serta impor DBF legacy bila foldernya tersedia.
# Kegagalan di sini tidak menggagalkan deploy utama.
CMN_BUNDLED_IMPORT_DIR="$APP_DIR/deploy/imports/cmn-inventory"
CMN_IMPORT_DIR=/opt/ebisnis/imports/cmn-inventory
if [[ -d "$CMN_BUNDLED_IMPORT_DIR" ]]; then
  install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$CMN_IMPORT_DIR"
  find "$CMN_BUNDLED_IMPORT_DIR" -maxdepth 1 -type f -iname '*.dbf' -print0 \
    | xargs -0 -r -I{} install -m 640 -o "$APP_USER" -g "$APP_USER" "{}" "$CMN_IMPORT_DIR/"
fi
# shellcheck disable=SC2097,SC2098
APP_DIR="$APP_DIR" APP_USER="$APP_USER" \
  bash "$APP_DIR/deploy/onboard-cmn-inventory.sh" >/tmp/onboard-cmn-inventory.log 2>&1 &
CMN_PID=$!

# ---------------------------------------------------------------------------
log "10/10  Apache"
# ---------------------------------------------------------------------------
POS_UPDATE_DIR=/opt/ebisnis/updates/pos
install -d -o "$APP_USER" -g "$APP_USER" -m 755 "$POS_UPDATE_DIR"

# Asset POS/Inventory/Apotik Flutter boleh hidup publik di server, sementara repository
# tetap private. Artefak yang ikut dalam repository private disalin dulu ke
# folder publik update, supaya server yang belum punya token GitHub Release pun
# tetap dapat melayani /update/ebisnis-inventory-sales.apk dan .exe.
LOCAL_INVENTORY_RELEASE_DIR="$APP_DIR/artifacts/inventory-release"
if [[ -d "$LOCAL_INVENTORY_RELEASE_DIR" ]]; then
  shopt -s nullglob
  for asset in "$LOCAL_INVENTORY_RELEASE_DIR"/ebisnis-inventory-sales-*.apk \
               "$LOCAL_INVENTORY_RELEASE_DIR"/ebisnis-inventory-sales-*-windows.exe \
               "$LOCAL_INVENTORY_RELEASE_DIR"/ebisnis-inventory-sales-*-windows.zip \
               "$LOCAL_INVENTORY_RELEASE_DIR"/ebisnis-inventory-sales.apk; do
    install -m 644 -o "$APP_USER" -g "$APP_USER" "$asset" "$POS_UPDATE_DIR/$(basename "$asset")"
  done

  latest_inventory_apk=$(
    find "$LOCAL_INVENTORY_RELEASE_DIR" -maxdepth 1 -type f -name 'ebisnis-inventory-sales-*.apk' \
      | sort -V \
      | tail -1
  )
  if [[ -n "$latest_inventory_apk" ]]; then
    install -m 644 -o "$APP_USER" -g "$APP_USER" "$latest_inventory_apk" \
      "$POS_UPDATE_DIR/ebisnis-inventory-sales.apk"
  fi

  latest_inventory_exe=$(
    find "$LOCAL_INVENTORY_RELEASE_DIR" -maxdepth 1 -type f -name 'ebisnis-inventory-sales-*-windows.exe' \
      | sort -V \
      | tail -1
  )
  if [[ -n "$latest_inventory_exe" ]]; then
    install -m 644 -o "$APP_USER" -g "$APP_USER" "$latest_inventory_exe" \
      "$POS_UPDATE_DIR/ebisnis-inventory-sales.exe"
  fi
  shopt -u nullglob
fi

# Rilis POS Apotik memakai namespace berkas sendiri supaya tidak pernah terpilih
# sebagai pembaruan POS retail. Endpoint publik memilih versi terbaru dari
# `emedik-pos-apotik-<versi>-windows.exe` dan `.apk` di folder yang sama.
LOCAL_APOTIK_RELEASE_DIR="$APP_DIR/artifacts/apotik-release"
if [[ -d "$LOCAL_APOTIK_RELEASE_DIR" ]]; then
  shopt -s nullglob
  for asset in "$LOCAL_APOTIK_RELEASE_DIR"/emedik-pos-apotik-*.apk \
               "$LOCAL_APOTIK_RELEASE_DIR"/emedik-pos-apotik-*-windows.exe; do
    install -m 644 -o "$APP_USER" -g "$APP_USER" "$asset" "$POS_UPDATE_DIR/$(basename "$asset")"
  done
  shopt -u nullglob
fi

# Bila token server tersedia, tarik juga asset dari GitHub Release private ke
# folder publik ini. Token TIDAK pernah dikirim ke klien; klien hanya membaca
# https://ebisnis.id/update/...
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

latest_inventory_apk=$(
  find "$POS_UPDATE_DIR" -maxdepth 1 -type f -name 'ebisnis-inventory-sales-*.apk' \
    | sort -V \
    | tail -1
)
if [[ -n "$latest_inventory_apk" ]]; then
  install -m 644 -o "$APP_USER" -g "$APP_USER" "$latest_inventory_apk" \
    "$POS_UPDATE_DIR/ebisnis-inventory-sales.apk"
fi

latest_inventory_exe=$(
  find "$POS_UPDATE_DIR" -maxdepth 1 -type f -name 'ebisnis-inventory-sales-*-windows.exe' \
    | sort -V \
    | tail -1
)
if [[ -n "$latest_inventory_exe" ]]; then
  install -m 644 -o "$APP_USER" -g "$APP_USER" "$latest_inventory_exe" \
    "$POS_UPDATE_DIR/ebisnis-inventory-sales.exe"
fi

APACHE_ROLLBACK_DIR=$(mktemp -d /tmp/ebisnis-apache.XXXXXX)
for source_and_destination in \
  "ebisnis-app.inc:/etc/apache2/conf-available/ebisnis-app.inc" \
  "ebisnis.conf:/etc/apache2/sites-available/ebisnis.conf"; do
  name=${source_and_destination%%:*}
  destination=${source_and_destination#*:}
  if [[ -f "$destination" ]]; then
    cp -a "$destination" "$APACHE_ROLLBACK_DIR/$name"
  else
    touch "$APACHE_ROLLBACK_DIR/$name.missing"
  fi
done

install -m 644 "$APP_DIR/deploy/apache/ebisnis-app.inc" /etc/apache2/conf-available/ebisnis-app.inc
install -m 644 "$APP_DIR/deploy/apache/ebisnis.conf"    /etc/apache2/sites-available/ebisnis.conf
apache2ctl configtest || rollback
systemctl reload apache2 || rollback

rm -f "$APACHE_ROLLBACK_DIR"/ebisnis-app.inc \
      "$APACHE_ROLLBACK_DIR"/ebisnis-app.inc.missing \
      "$APACHE_ROLLBACK_DIR"/ebisnis.conf \
      "$APACHE_ROLLBACK_DIR"/ebisnis.conf.missing
rmdir "$APACHE_ROLLBACK_DIR"
APACHE_ROLLBACK_DIR=

# Keempatnya sudah berjalan sejak "7-9/10", tumpang tindih dengan Apache di
# atas. Ditunggu di sini -- bukan di tengah -- karena tidak ada langkah wajib
# yang bergantung padanya; ini semata memastikan skrip tidak keluar sementara
# proses latar belakang masih berjalan, bukan gerbang keberhasilan deploy.
for entry in \
  "Sandbox demo ePesantren:$PESANTREN_PID:/tmp/ensure-demo-pesantren.log" \
  "Sandbox demo MitraInap:$MITRAINAP_PID:/tmp/ensure-demo-mitrainap.log" \
  "Pelanggan Raudlatul Ulum:$RAUDLATUL_PID:/tmp/onboard-raudlatul-ulum.log" \
  "Pelanggan CMN Inventory:$CMN_PID:/tmp/onboard-cmn-inventory.log"; do
  nama=${entry%%:*}
  sisa=${entry#*:}
  pid=${sisa%%:*}
  logfile=${sisa#*:}
  if wait "$pid"; then
    echo "    $nama: selesai"
  else
    warn "$nama gagal — lihat $logfile"
  fi
done

# Penanda baru ditulis setelah API sehat DAN konfigurasi reverse proxy lolos.
# Build atau health yang sukses tetapi Apache gagal bukan deployment selesai.
install -d -m 755 "$(dirname "$DEPLOY_STAMP")"
printf '%s
' "$NEW" > "$DEPLOY_STAMP"

cat <<EOF

  Pembaruan selesai.

  Versi     : $(as_app "git -C '$APP_DIR' describe --tags --always")
  Commit    : ${NEW:0:7}
  Sebelumnya: ${PREVIOUS:0:7}
  Backup    : $BACKUP_FILE

  Kembali ke versi sebelumnya bila diperlukan:
      sudo bash $APP_DIR/deploy/update.sh ${DEPLOYED:-$PREVIOUS}

EOF
