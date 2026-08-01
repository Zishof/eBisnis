# IR-006 · Alamat asli pengunjung di belakang reverse proxy

- **Diajukan oleh:** sesi eKoperasi (K-15)
- **Tanggal:** 2026-08-01
- **Kepada:** sesi Core
- **Status:** menunggu
- **Berkas Core yang tersentuh:** `apps/api/src/main.ts` (satu baris), `apps/api/src/config/configuration.ts` (satu kunci)

## Ringkasan

Pembatas laju berbasis alamat IP tidak bekerja di belakang Apache, dan bukan
karena salah setel di sisi koperasi. `req.ip` bernilai alamat proxy untuk setiap
pengunjung, sehingga seluruh internet berbagi satu ember hitungan.

Ini ditemukan saat mengerjakan K-15, bukan dilaporkan dari luar. Situs koperasi
adalah permukaan publik pertama yang dilayani lewat `koperasi.ebisnis.id`,
sehingga ia yang pertama menabraknya — tetapi masalahnya **milik seluruh
platform**, bukan milik modul koperasi.

## Masalahnya

`ThrottlerGuard` menghitung per `req.ip`. Express menentukan `req.ip` dari
koneksi TCP kecuali `trust proxy` disetel. Pencarian di seluruh `apps/api`:

- `main.ts` tidak pernah memanggil `app.set('trust proxy', …)`.
- Satu-satunya `trustProxy` yang ada adalah `esmartlink.trustProxy`, dipakai
  modul pembayaran untuk memutuskan apakah `X-Forwarded-For` boleh dipercaya
  pada callback penyedia. Ia tidak menyentuh `req.ip` global.

Sementara itu `deploy/apache/ebisnis.conf` meneruskan permintaan lewat
`ProxyPass`. Jadi di produksi, setiap pengunjung tampak datang dari alamat yang
sama.

### Akibatnya bukan sekadar "pembatasnya tidak bekerja"

Akibatnya lebih buruk daripada tidak ada pembatas sama sekali:

> Batas yang ketat berubah menjadi **penolakan layanan terhadap pengguna
> sungguhan.**

Bila route pendaftaran koperasi diberi lima kiriman per jam per alamat, di
produksi itu menjadi lima kiriman per jam untuk seluruh koperasi di seluruh
platform. Satu pengirim sampah menghabiskannya, lalu setiap calon anggota yang
jujur pada jam itu ditolak — di setiap koperasi sekaligus.

Hal yang sama berlaku bagi batas umum 300/menit: ia bukan lagi 300 per
pengunjung melainkan 300 untuk semua orang. Pada trafik kecil hari ini itu tidak
terasa. Ia akan terasa persis ketika platformnya mulai ramai, yaitu saat paling
buruk untuk menemukannya.

## Yang sudah dikerjakan sesi koperasi sambil menunggu

Bukan menunggu dengan tangan kosong, dan bukan pula menambal `main.ts` sendiri
(panduan §3: berkas bersama tidak disunting sesi vertikal).

1. **Route pembacaan situs tidak diberi batas per-route.** Memberinya batas
   lebih ketat daripada route lain justru membuat situs publik paling rapuh
   ketika embernya berbagi.
2. **Route pendaftaran diberi angka yang aman pada kedua keadaan** — 30/jam.
   Longgar bagi pelamar sungguhan yang mengirim sekali, tetap memangkas kiriman
   bertubi-tubi setelah IR-006 mendudukkan alamat aslinya.
3. **Penjagaan sebenarnya dibuat tidak bergantung pada alamat IP sama sekali:**
   batas harian per koperasi (50) dan jeda per nomor telepon (6 jam), keduanya
   di `public-intake.ts`. Keduanya bekerja sama benarnya di belakang proxy
   maupun tidak, dan keduanyalah yang menahan banjir hari ini.

Batas kerusakan terburuk yang tersisa: 50 baris karantina per koperasi per hari,
tanpa satu pun baris anggota terbentuk.

## Usulan

Dua baris, dan keduanya milik Core:

```ts
// configuration.ts
trustProxyHops: int(process.env.TRUST_PROXY_HOPS, 0),

// main.ts, sebelum guard mana pun berjalan
app.set('trust proxy', config.get<number>('trustProxyHops', 0));
```

**Jumlah lompatan, bukan boolean.** `app.set('trust proxy', true)` memercayai
seluruh rantai `X-Forwarded-For`, dan header itu dapat ditulis siapa saja.
Penyerang tinggal mengirim `X-Forwarded-For: <acak>` pada setiap permintaan
untuk memperoleh ember baru setiap kali — pembatas lajunya hilang sepenuhnya,
dan kali ini tanpa jejak. Angka lompatan membuat Express mengambil alamat ke-n
dari belakang, yaitu yang ditulis proxy kita sendiri dan tidak dapat dipalsukan
pengirim.

Nilai bawaan **0** dipilih dengan sengaja: pemasangan yang tidak berada di
belakang proxy tetap berperilaku seperti hari ini, dan yang salah setel akan
terlalu ketat (menghitung semua orang sebagai satu) alih-alih terlalu longgar
(memercayai header palsu). Untuk `koperasi.ebisnis.id` dengan satu Apache di
depan, nilainya `1`.

## Yang TIDAK diminta

- **Bukan** meminta Core menyentuh `ThrottlerGuard`, tracker-nya, atau modul
  auth. Setelah `req.ip` benar, guard yang ada bekerja apa adanya.
- **Bukan** meminta batas laju khusus untuk koperasi. Angka yang dipakai
  sekarang sudah aman pada kedua keadaan.
- **Bukan** meminta penyimpanan alamat IP di mana pun. Modul koperasi menyimpan
  sidik SHA-256 bergaram penyewa, bukan alamatnya.

## Sesudah disetujui

Sesi koperasi akan mengetatkan kembali batas route pendaftaran dan menambahkan
catatan pada changelog. Tidak ada migrasi, tidak ada perubahan skema, dan tidak
ada yang perlu digulung balik bila usulan ini ditolak.
