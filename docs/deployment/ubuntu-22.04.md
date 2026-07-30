# Instalasi eBisnis.id pada Ubuntu 22.04

Panduan dari server kosong sampai aplikasi dapat diakses, ditambah cara
memperbarui saat ada perubahan sistem.

## Arsitektur yang dipasang

```
Internet
   │
   ▼
Apache 2.4  :80 / :443
   ├─ /api/, /health, /docs  ──proxy──►  NestJS  127.0.0.1:3000  (systemd)
   └─ selainnya              ──statis──►  hasil build React
                                              │
                                              ▼
                                   PostgreSQL  HOST:5434  db "ebisnis"
```

Aplikasi Node **tidak** menyajikan berkas statis, dan React **tidak** memanggil
API lintas origin. Apache yang menyatukan keduanya pada satu alamat, sehingga
tidak ada masalah CORS maupun campuran HTTP/HTTPS.

Aplikasi baru disajikan pada **root** (`/`), bukan pada context path
`/ebisnis/` seperti sistem Java lama. Konfigurasi Apache pada repositori ini
sudah menghapus redirect `/` → `/ebisnis/`; bila redirect lama dibiarkan,
hasilnya 404.

## Prasyarat

| Kebutuhan | Keterangan |
| --- | --- |
| Ubuntu 22.04 dengan akses `sudo` | |
| Database PostgreSQL | `ebisnis` pada `HOST:5434`, boleh kosong |
| Pengguna database berhak `CREATE` | dipakai untuk membuat schema tiap tenant |
| Port 5434 terjangkau dari server aplikasi | uji dengan `psql` sebelum mulai |
| Personal Access Token GitHub | scope `repo`; repositori bersifat privat |
| DNS `ebisnis.id` mengarah ke server | boleh menyusul; sementara pakai alamat IP |

Uji koneksi database lebih dahulu — bila langkah ini gagal, seluruh instalasi
akan gagal pada tahap migration:

```bash
psql "postgresql://USER:PASSWORD@HOST:5434/ebisnis" -c "select version()"
```

Bila kata sandi memuat karakter `@ : / ? # & %`, tuliskan ter-URL-encode pada
connection string. Contoh: `p@ss:w/rd` menjadi `p%40ss%3Aw%2Frd`.

## Instalasi

### 1. Siapkan berkas konfigurasi

Berkas ini memuat kredensial dan **tidak pernah** masuk repositori.

```bash
sudo install -d -m 700 /etc/ebisnis
sudo curl -fsSL -o /etc/ebisnis/ebisnis.env \
  https://raw.githubusercontent.com/Zishof/eBisnis/main/deploy/env.production.example
sudo nano /etc/ebisnis/ebisnis.env
```

Untuk repositori privat, `curl` di atas tidak berhasil tanpa token. Lebih mudah:
clone dulu (langkah 2), lalu `sudo cp deploy/env.production.example
/etc/ebisnis/ebisnis.env`.

Yang wajib diisi:

```ini
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5434/ebisnis?schema=platform
DIRECT_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5434/ebisnis?schema=platform
DATABASE_ADMIN_URL=postgresql://USER:PASSWORD@HOST:5434/ebisnis

JWT_ACCESS_SECRET=<hasil openssl rand -base64 48>
JWT_REFRESH_SECRET=<hasil openssl rand -base64 48, berbeda dari yang di atas>

CORS_ORIGINS=https://ebisnis.id,https://www.ebisnis.id
APP_URL=https://ebisnis.id
WEB_URL=https://ebisnis.id

BOOTSTRAP_SUPER_ADMIN_USERNAME=admin
BOOTSTRAP_SUPER_ADMIN_PASSWORD=<kata sandi awal, min 10 karakter>
```

Bangkitkan secret:

```bash
openssl rand -base64 48
```

Ketentuan kata sandi: minimal 10 karakter, memuat huruf kecil, huruf besar,
angka, dan simbol.

```bash
sudo chmod 640 /etc/ebisnis/ebisnis.env
```

### 2. Jalankan instalasi

```bash
sudo install -d /opt/ebisnis
sudo git clone https://github.com/Zishof/eBisnis.git /opt/ebisnis/app
sudo bash /opt/ebisnis/app/deploy/install.sh
```

Saat diminta kredensial GitHub, isi username dan **token** sebagai kata sandi.

Skrip mengerjakan: paket dasar, Node 22, pnpm, klien PostgreSQL 17, pengguna
sistem `ebisnis`, install dependency, build, `prisma migrate deploy`,
pembuatan super admin, systemd, dan Apache. Berjalan sekitar 5–10 menit.

Skrip berhenti dengan pesan jelas bila `/etc/ebisnis/ebisnis.env` belum ada,
dan **tidak** menimpanya bila sudah ada.

### 3. Verifikasi

```bash
curl -s http://127.0.0.1:3000/health
systemctl status ebisnis-api --no-pager
curl -sI http://localhost/ | head -3
```

`/health` yang sehat mengembalikan `"status":"ok"` dan `"database":"up"`.

Buka `http://<alamat-ip-server>/`. Yang tampil adalah **website utama**
langsung, bukan redirect ke `/ebisnis/`. Tombol **Daftar** membuka `/daftar`
dan pendaftaran dapat langsung dipakai.

## Membuat akun

### Super admin

Sudah dibuat oleh `install.sh` dari `BOOTSTRAP_SUPER_ADMIN_*`.

Masuk pada `https://ebisnis.id/masuk` memakai username `admin`. Kata sandi
**wajib diganti pada login pertama** — itu memang dirancang begitu, dan seed
berikutnya tidak akan mengembalikannya ke nilai awal.

Setelah berhasil masuk, kosongkan kembali nilai kata sandinya:

```bash
sudo nano /etc/ebisnis/ebisnis.env     # BOOTSTRAP_SUPER_ADMIN_PASSWORD=
```

Akun ini memegang role `PLATFORM_SUPER_ADMIN` dan membuka portal `/platform`:
kelola tenant, paket dan harga, diskon, CMS website, serta audit trail.

Bila kata sandi super admin terlupa, isi ulang
`BOOTSTRAP_SUPER_ADMIN_PASSWORD`, jalankan `sudo -u ebisnis bash -lc "cd
/opt/ebisnis/app && pnpm seed:platform"`, lalu kosongkan lagi. Seed hanya
menyetel kata sandi bila akunnya belum ada; untuk akun yang sudah ada gunakan
pemulihan lewat portal platform.

### Akun pedagang

Dua cara, keduanya memakai alur yang sama.

**Lewat website** — buka `/daftar`, isi formulir. Ini yang akan dipakai
pedagang sungguhan.

**Lewat baris perintah** — berguna untuk menyiapkan akun uji:

```bash
sudo -u ebisnis bash -lc "cd /opt/ebisnis/app && \
  node scripts/deploy/create-merchant.mjs \
    --api http://127.0.0.1:3000 \
    --web https://ebisnis.id \
    --username tokoberkah \
    --name 'Toko Berkah' \
    --email pemilik@tokoberkah.example \
    --password 'GantiKataSandiIni#2026'"
```

Setiap pendaftaran membuat schema `<username>` dan `<username>__audit`
tersendiri, lalu mengisinya dengan data contoh: kategori produk, satuan,
pemasok, pelanggan, gudang, outlet, dan menu. Username menjadi nama schema
sehingga **permanen** dan tidak dapat diubah.

Bila `--password` tidak diberikan, server yang membuat kata sandi sementara dan
menampilkannya **satu kali** pada keluaran perintah.

### Mencoba unggah katalog produk

Masuk sebagai pedagang, lalu **Katalog → Produk**. Data contoh sudah mengisi
kategori dan satuan, sehingga produk baru dapat langsung dibuat tanpa menyiapkan
master lebih dahulu.

Catatan jujur tentang keadaan saat ini: unggah massal lewat berkas
CSV/Excel **belum tersedia**. Produk dibuat satu per satu lewat antarmuka, atau
lewat API `POST /api/v1/products`. Impor massal termasuk pekerjaan yang belum
dikerjakan.

## Pembaruan

Setelah ada perubahan yang sudah masuk `main` di GitHub:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Urutannya: **backup database → ambil source → build → migration → restart →
health check**.

Bila health check gagal, aplikasi **otomatis dikembalikan** ke commit
sebelumnya dan skrip keluar dengan status gagal. Backup selalu dibuat sebelum
apa pun disentuh; bila backup gagal, pembaruan dibatalkan dan tidak ada yang
berubah.

Memperbarui ke rilis tertentu:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh v7.0.0
```

Kembali ke versi sebelumnya:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh <commit-sebelumnya>
```

Commit sebelumnya dicetak pada akhir setiap pembaruan yang berhasil.

### Batas rollback

Pengembalian otomatis mengembalikan **aplikasi**, bukan database. Migration
proyek ini bersifat additive (expand-and-contract), sehingga versi lama tetap
berjalan di atas schema yang sudah dimutakhirkan. Bila suatu rilis memuat
migration yang tidak reversible, hal itu dinyatakan pada catatan rilisnya.

Pemulihan database dari backup — **menimpa data saat ini**, lakukan hanya bila
yakin:

```bash
sudo ls -lh /var/backups/ebisnis/
sudo -u ebisnis pg_restore --clean --if-exists \
  --dbname="postgresql://USER:PASSWORD@HOST:5434/ebisnis" \
  /var/backups/ebisnis/ebisnis-YYYYmmdd-HHMMSS.dump
```

Sepuluh backup terakhir disimpan; yang lebih lama dihapus otomatis.

## Operasi harian

```bash
systemctl status ebisnis-api          # status layanan
journalctl -u ebisnis-api -f          # log langsung
journalctl -u ebisnis-api -n 200      # 200 baris terakhir
systemctl restart ebisnis-api         # restart

tail -f /var/log/apache2/ebisnis-error.log
tail -f /var/log/apache2/ebisnis-ssl-access.log

curl -s http://127.0.0.1:3000/health
sudo -u ebisnis bash -lc "cd /opt/ebisnis/app && pnpm seed:verify"
```

## HTTPS dengan sertifikat tepercaya

Instalasi memakai sertifikat self-signed sehingga browser memberi peringatan.
Setelah DNS `ebisnis.id` mengarah ke server:

```bash
sudo apt-get install -y certbot python3-certbot-apache
sudo certbot --apache -d ebisnis.id -d www.ebisnis.id
```

Setelah sertifikat terpasang, aktifkan pengalihan HTTP → HTTPS dengan membuka
komentar blok `RewriteEngine` pada VirtualHost `:80` di
`/etc/apache2/sites-available/ebisnis.conf`, lalu:

```bash
sudo apache2ctl configtest && sudo systemctl reload apache2
```

Aktifkan HSTS hanya setelah HTTPS benar-benar stabil — browser mengingatnya dan
sulit dibatalkan.

## Hubungan dengan sistem Java lama

Sebelumnya port 80/443 mem-proxy aplikasi Java pada `38.47.178.42:3009` dengan
context `/ebisnis/`. Konfigurasi baru memakai port 80/443 untuk aplikasi ini,
dan sistem lama tetap dapat diakses lewat **port 3449** yang dipertahankan apa
adanya.

Bila sistem lama sudah tidak dipakai, hapus kedua blok `<VirtualHost *:3449>`
pada `deploy/apache/ebisnis.conf`.

## Pemecahan masalah

| Gejala | Penyebab yang paling sering | Tindakan |
| --- | --- | --- |
| Halaman putih, aset 404 | `DocumentRoot` salah atau build belum jalan | pastikan `/opt/ebisnis/app/apps/web/dist/index.html` ada |
| Akses langsung ke `/daftar` menghasilkan 404 | `FallbackResource` tidak aktif | pastikan `ebisnis-app.inc` ter-`Include` dan `mod_rewrite` aktif |
| Halaman tampil, semua permintaan API gagal | urutan `ProxyPass` | `/api/` harus diproksikan sebelum penyajian statis |
| `502 Proxy Error` | layanan API mati | `journalctl -u ebisnis-api -n 50` |
| API gagal start, log menyebut `P1001` | database tidak terjangkau | uji `psql` dari server, periksa firewall port 5434 |
| API gagal start, log menyebut `P1000` | kredensial salah atau kurang URL-encode | periksa kembali `DATABASE_URL` |
| `migrate deploy` gagal `permission denied` | pengguna DB tidak berhak `CREATE` | beri hak pada database `ebisnis` |
| Login selalu `429 Too Many Requests` | rate limit melihat satu IP karena proxy | naikkan `THROTTLE_AUTH_LIMIT` sementara, dan perbaiki pembacaan IP asal |
| Redirect berputar ke `/ebisnis/` | konfigurasi Apache lama masih aktif | `sudo a2dissite` konfigurasi lama, pastikan hanya `ebisnis.conf` aktif |

Bila API gagal start, penyebabnya hampir selalu terbaca pada baris pertama:

```bash
journalctl -u ebisnis-api -n 50 --no-pager
```

## Yang belum ada

Supaya harapannya tepat sejak awal:

- **Impor katalog massal** (CSV/Excel) belum ada; produk dibuat satu per satu.
- **Pembayaran Esmartlink** ada adapternya tetapi `ESMARTLINK_ENABLED=false`
  dan belum pernah diuji terhadap sandbox sungguhan.
- **Endpoint CRUD master belum memverifikasi permission** — setiap pengguna
  tenant yang terautentikasi dapat mengubah data master pada tenant-nya.
  Terdaftar pada `docs/upgrade-v6/01-v5-regression-status.md` sebagai temuan
  V6-0-F03 dan dijadwalkan diperbaiki lebih dahulu sebelum fitur baru.
- **Referral, multi-investor, website tenant, workflow, akuntansi penuh,
  ticketing, dan GPS** belum diimplementasikan.
- **Backup terjadwal** belum ada; `update.sh` hanya membuat backup saat
  pembaruan. Untuk produksi, pasang cron `pg_dump` harian tersendiri.
