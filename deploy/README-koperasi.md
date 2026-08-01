# Memasang eKoperasi pada server — subdomain `koperasi.ebisnis.id`

Untuk sementara satu subdomain saja: `koperasi.ebisnis.id`. Bentuk yang
memberi tiap koperasi subdomainnya sendiri (`koperasimaju.ekoperasi.id`) sudah
didukung mekanismenya — `platform.vertical_site_domain` menerima banyak host —
tetapi belum dipakai.

---

## Yang sudah otomatis, dan tidak perlu dikerjakan lagi

`deploy/update.sh` sudah menangani seluruh bagian basis data dan aplikasi:

| Langkah | Sejak |
| --- | --- |
| Migrasi tabel koperasi (11 migrasi modul) | katalog migrasi modular, IR-001 |
| Menu, peran, dan hak akses koperasi | penyemaian RBAC vertikal, IR-004 |
| Katalog peristiwa akuntansi koperasi | IR-003 |
| Penangan pembayaran saldo anggota | IR-002 |

Artinya: **`update.sh` biasa sudah memasang eKoperasi.** Yang tidak
ditanganinya hanyalah hal yang khas subdomain, dan itulah isi
`deploy/koperasi.sh`.

---

## Prasyarat

1. **DNS.** `A` record `koperasi.ebisnis.id` → alamat server.
2. **Penyewa koperasi sudah terdaftar** dan skemanya berstatus `READY`.

Keduanya diperiksa skrip dan disebut jelas bila belum ada.

---

## Memasang

```bash
sudo bash /opt/ebisnis/app/deploy/koperasi.sh install <username-penyewa>
```

Yang dikerjakannya:

1. Memeriksa DNS — memperingatkan bila belum mengarah, tidak menggagalkan
   (server di balik CDN memang menunjuk alamat lain).
2. Menambahkan `koperasi.ebisnis.id` ke `ServerAlias` pada kedua vhost,
   **dengan cadangan bertanggal**, lalu `apache2ctl configtest` **sebelum**
   `reload` — konfigurasi Apache yang salah dan sudah dimuat ulang mematikan
   seluruh situs, bukan hanya subdomain baru.
3. Mendaftarkan host ke `platform.vertical_site_domain`.
4. Memeriksa hasilnya dengan permintaan ber-`Host:` ke aplikasi.

### Mengapa langkah 3 tidak dapat dilewati

Tanpa baris di `vertical_site_domain`, subdomainnya menjawab **404** meski
Apache sudah benar dan aplikasinya berjalan.

Itu disengaja. Pengunjung tanpa sesi tidak membawa konteks penyewa, dan
satu-satunya jalan lain adalah menerima nama skema dari alamat — yang dilarang
tegas, sebab alamat semacam itu dapat dicoba nama demi nama sampai menemukan
skema yang ada. Pemetaan host → penyewa inilah jalur yang sah (IR-005).

---

## Memperbarui

```bash
sudo bash /opt/ebisnis/app/deploy/koperasi.sh update
```

Memanggil `update.sh` apa adanya, lalu memeriksa kembali subdomainnya.

Sengaja **tidak** punya jalur pembaruan tersendiri: dua jalur yang harus dijaga
tetap sama akan berbeda pada suatu hari, dan yang jarang dipakai akan
tertinggal tanpa ada yang tahu.

Memakai `update.sh` langsung juga benar — subdomainnya tidak berubah.

---

## Memeriksa keadaan

```bash
sudo bash /opt/ebisnis/app/deploy/koperasi.sh status
```

---

## Menghentikan subdomain

```bash
sudo bash /opt/ebisnis/app/deploy/koperasi.sh uninstall-domain
```

Menghentikan, **bukan menghapus**. Host yang dihapus dapat didaftarkan ulang
penyewa lain tanpa jejak; yang dihentikan meninggalkan barisnya.

Baris Apache sengaja dibiarkan — mencabutnya menuntut menyunting berkas yang
mungkin sudah disesuaikan operator, dan subdomain yang diteruskan tetapi tidak
terdaftar hanya menjawab 404.

---

## Mengelola host secara langsung

```bash
sudo -u ebisnis bash -lc 'cd /opt/ebisnis/app && pnpm domain:vertical list'
sudo -u ebisnis bash -lc 'cd /opt/ebisnis/app && pnpm domain:vertical register \
  --host koperasi.ebisnis.id --tenant koperasimaju --vertical cooperative --verify'
```

**`--verify` hanya untuk domain milik kita sendiri.** Operator server yang
memasang DNS-nya memang mengetahui kepemilikannya. Untuk domain yang dibawa
penyewa (`koperasi-mereka.com`), pembuktiannya harus lewat DNS, dan `--verify`
tidak boleh dipakai — tanpa itu siapa pun dapat mendaftarkan host milik orang
lain dan memperoleh permintaan yang ditujukan ke sana beserta konteks
penyewanya.

---

## Setelah terpasang

**Sertifikat TLS.** Selama masih self-signed, peramban memperingatkan
pengunjung:

```bash
sudo certbot --apache -d koperasi.ebisnis.id
```

**Pengalihan HTTP → HTTPS** pada `ebisnis.conf` masih nonaktif dengan sengaja,
supaya pengujian lewat HTTP tidak terhalang. Nyalakan setelah sertifikatnya
tepercaya.

**Data contoh** — 60 anggota, RAT lengkap, dan SHU yang dibagikan — dipasang
dari layar `/ekoperasi/data-contoh`, bukan dari skrip server. Ia menulis ke
skema penyewa, dan yang berhak memutuskannya adalah pengurus koperasinya.

**Terbitkan situsnya.** Jalur publik hanya melayani situs yang sudah
diterbitkan pengurus. Selama `is_published` masih false, `koperasi.ebisnis.id`
menjawab 404 — jawaban yang sama persis dengan host yang tidak terdaftar, dan
itu disengaja.

### Yang dilihat pengunjung di akar subdomain

`https://koperasi.ebisnis.id/` mengalihkan ke `/ekoperasi/situs`, mengikuti
cara yang sudah dipakai `belanja.ebisnis.id`. Tanpa pengalihan itu subdomainnya
menjawab 200 dan tampak berhasil dipasang, sementara satu-satunya jalan menuju
situs koperasi adalah mengetik `/ekoperasi/situs` — alamat yang tidak akan
pernah ditebak pengunjung.

Alamat lain tetap dapat dibuka dari subdomain ini: `/masuk`, `/harga`,
`/ekoperasi/portal` untuk anggota, dan `/app/koperasi` untuk pengurus.

---

## Yang belum ada

**TLS belum terpasang, dan ini yang paling penting.** Formulir pendaftaran
calon anggota menerima nama, nomor telepon, pekerjaan, dan alamat rumah. Selama
subdomainnya dilayani lewat HTTP, seluruh isian itu melintas terbaca. Pasang
sertifikatnya **sebelum** memberitahukan alamatnya kepada calon anggota:

```bash
sudo certbot --apache -d koperasi.ebisnis.id
```

**Pembatas laju per alamat IP belum bekerja di belakang Apache.**
`ThrottlerGuard` menghitung per `req.ip`, dan aplikasi belum menyetel
`trust proxy` — sehingga setiap pengunjung tampak datang dari alamat proxy.
Diajukan lewat [IR-006](../docs/integration-requests/cooperative/006-alamat-asli-di-belakang-proxy.md);
perbaikannya satu baris pada `main.ts` dan milik sesi Core.

Sampai itu dikerjakan, yang menahan banjir adalah batas yang **tidak
bergantung pada alamat IP**: 50 lamaran per koperasi per hari dan jeda 6 jam
per nomor telepon. Batas kerusakan terburuk: 50 baris karantina per koperasi
per hari, tanpa satu pun baris anggota terbentuk.
