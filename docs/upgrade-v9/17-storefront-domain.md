# 17 — Toko Online, Domain Terverifikasi, dan Storefront Resolver (V9-3)

Menutup C1–C5 pada [matriks gap](02-v8-to-v9-gap-matrix.md), dan menutup empat
risiko KRITIS: R12, R13, R14, dan R15 pada
[register risiko](08-security-risk-register.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel baru | 2 |
| Enum baru | 3 |
| Endpoint baru | 9 |
| Test baru | 61 |

## Mengapa `Website` tidak dipakai

`Website` dan `WebsiteDomain` sudah ada dan sekilas cocok. Keduanya **tidak**
dipakai:

| | `WebsiteDomain` | yang dibutuhkan |
| --- | --- | --- |
| `tenantId` | tidak ada | wajib |
| Verifikasi kepemilikan | tidak ada | wajib |
| Melayani | situs pemasaran platform | toko tenant |

Memakainya berarti mencampur konten platform dengan konten tenant pada satu
tabel tanpa pemisah — persis jenis kesalahan yang membuat satu kekeliruan query
menampilkan halaman tenant lain.

## Normalisasi host

Host adalah satu-satunya hal yang menentukan toko mana yang ditampilkan kepada
pengunjung anonim, dan ia sepenuhnya dikendalikan pengirim permintaan. Maka ia
dinormalkan lebih dulu, tidak pernah dicocokkan apa adanya.

Yang **dibuang**: port, spasi, titik akhir DNS, skema, dan perbedaan huruf.
Empat bentuk berikut menjadi satu:

```text
Toko.com   toko.com.   toko.com:443   HTTPS://TOKO.COM   ->   toko.com
```

Tanpa ini, keempatnya menjadi entri berbeda pada registry dan hanya satu yang
cocok — sehingga tenant yang mendaftarkan `Toko.com` menemukan domainnya tidak
berfungsi tanpa penjelasan.

Yang **ditolak**, dan alasannya:

| Bentuk | Alasan |
| --- | --- |
| `evil.com@tokojoni.com` | dibaca berbeda oleh pengurai yang berbeda |
| `tokojoni.com/../admin` | jalur tidak pernah sah pada header Host |
| `192.168.1.1`, `[::1]` | alamat langsung melewati DNS |
| `localhost` | kurang dari dua label |
| dua header `Host` | perilaku bergantung pada proxy di depan aplikasi |
| `tokojonı.com` | huruf yang menyerupai tetapi berbeda |

## Empat aturan resolver

**1. Host dinormalkan lebih dulu.** Nilai mentah tidak pernah dicocokkan.

**2. Hanya domain yang sudah terverifikasi dilayani.** Status dan stempel waktu
harus sejalan; `VERIFIED` tanpa `verifiedAt` ditolak.

**3. Host tak dikenal ditolak, bukan diarahkan ke toko bawaan.** Ini yang paling
mudah dilanggar tanpa disadari. Mengarahkan host tak dikenal ke toko bawaan
tampak ramah, tetapi ia berarti setiap kesalahan DNS yang mengarah ke platform
menampilkan katalog milik orang lain.

**4. Nama schema selalu dari registry.** Menurunkannya dari host adalah cara
paling langsung membocorkan data tenant lain. Diuji dengan schema yang sengaja
tidak menyerupai host.

### Penolakan tidak menjelaskan diri

Empat host berbeda menghasilkan jawaban yang identik:

```text
belanja.ebisnis.id   -> 200  mode MARKETPLACE
domain-asing.com     -> 404  "Toko tidak ditemukan pada alamat ini."
192.168.1.1          -> 404  "Toko tidak ditemukan pada alamat ini."
evil.com@toko.com    -> 404  "Toko tidak ditemukan pada alamat ini."
```

Log mencatat alasan yang berbeda-beda untuk penyelidikan:

```text
UNKNOWN_HOST : Host "domain-asing.com" tidak terdaftar.
INVALID_HOST : Alamat IP tidak dapat dipakai sebagai domain toko.
INVALID_HOST : Host memuat karakter yang tidak sah.
```

Memberi tahu penyerang mengapa tebakannya gagal mempermudah tebakan berikutnya.

### `schemaName` tidak pernah keluar

Resolver menghitungnya, tetapi endpoint publik tidak mengembalikannya:

```text
["mode","host","canonicalHost","storeId","storeSlug","storeName"]
```

Pengunjung tidak pernah perlu tahu nama schema, dan mengirimkannya membuka jalan
untuk mencobanya pada permintaan lain.

## Verifikasi kepemilikan

Dua metode, karena keduanya gagal pada keadaan berbeda:

| Metode | Bekerja ketika |
| --- | --- |
| TXT record pada `_ebisnis-verify.<host>` | situs belum mengarah ke platform |
| Berkas `/.well-known/ebisnis-verification.txt` | pemilik tidak memegang kendali DNS |

Pengambilan berkas memakai `redirect: 'error'` — pengalihan dapat menunjuk ke
situs lain, sehingga mengikutinya berarti memverifikasi domain yang salah.
Bacaan dibatasi 1000 karakter dan waktunya dibatasi 5 detik.

Setiap percobaan dicatat, berhasil maupun gagal. Verifikasi yang gagal
berkali-kali adalah sinyal: entah pemilik salah memasang, atau seseorang mencoba
mengklaim domain orang lain. Setelah sepuluh kegagalan berturut-turut, domain
ditandai `FAILED`.

## Satu domain, satu toko

Batasan unik pada `host` mencegah dua tenant mengklaim domain yang sama.
Pemeriksaan di layanan memberi pesan yang dapat dijelaskan; batasan basis data
tetap menjadi penjaga terakhir bila dua permintaan datang bersamaan.

Bila domain sudah terdaftar pada toko lain, pesannya mengarahkan ke dukungan
untuk pemindahan — bukan menolak tanpa jalan keluar.

## Alamat kanonik

Domain non-primer tetap dilayani, tetapi kanoniknya menunjuk domain utama.
Tanpa ini, mesin pencari melihat katalog yang sama pada `tokojoni.com` dan
`www.tokojoni.com`, dan membagi peringkat keduanya.

Menjadikan satu domain sebagai utama otomatis melepas yang lain, karena dua
domain utama membuat alamat kanonik tidak dapat ditentukan.

## Kepemilikan domain diperiksa pada setiap aksi

Endpoint verifikasi, penetapan utama, dan pencabutan memeriksa bahwa domain
benar-benar milik toko tenant pemanggil. Tanpa itu, id domain yang ditebak
memungkinkan satu tenant mencabut domain tenant lain.

Pesan penolakannya sama dengan "tidak ditemukan", supaya keberadaan domain milik
tenant lain tidak dapat disimpulkan dari perbedaan jawaban.

## Slug toko

Divalidasi seketat host, dan **35 slug dicadangkan**. Sebagiannya menghindari
tabrakan dengan jalur platform (`api`, `checkout`, `keranjang`); sebagiannya
mencegah toko menyamar sebagai halaman resmi (`ebisnis`, `belanja`, `dukungan`).

## Bukti

[`evidence/v9-3-storefront.txt`](evidence/v9-3-storefront.txt) — dijalankan
lawan API yang benar-benar berjalan, dengan dua tenant nyata:

```text
Tenant A: DEMO (demo)                 -> domain terverifikasi
Tenant B: JONI_UTAMA_X2LVGD           -> domain BELUM terverifikasi

domain terverifikasi dilayani                      status 200
menghasilkan toko yang benar                       Uji Toko 0
nama schema TIDAK dikirim ke pengunjung
domain belum terverifikasi DITOLAK                 status 404
penolakan tidak menyebut alasan sebenarnya
domain tenant A tidak menghasilkan toko tenant B
bentuk host berbeda menghasilkan toko yang sama    200,200,200
toko dengan seller ditangguhkan ditolak            status 404
```

Objek uji dibersihkan setelah pemeriksaan.

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **296 lulus** (281 API + 15 web), naik dari 235 |
| `pnpm build` | bersih |
| `pnpm route:audit` | 0 route tanpa penanda |

## Catatan yang ditemukan saat menguji

**`fetch()` mengabaikan header `Host` yang diset manual** — ia forbidden header
pada spesifikasi fetch. Pengujian resolusi berbasis host harus memakai
`node:http` atau `curl`. Percobaan pertama saya memakai `fetch` dan melaporkan
empat kegagalan palsu.

**Prisma `@default(uuid())` dan `@updatedAt` bekerja di klien, bukan sebagai
default kolom.** Insert SQL mentah ke tabel platform harus menyediakan `id` dan
`updated_at` sendiri. Ini hanya menyentuh skrip pengujian; kode aplikasi memakai
Prisma.

## Keterbatasan yang diketahui

**UI belum ada.** Endpoint pembuatan toko dan pengelolaan domain berjalan, tetapi
halaman Pengaturan Toko Online belum dibuat. Menunya bertanda `comingSoon`.

**Verifikasi belum dijadwalkan ulang otomatis.** Pemilik harus menekan tombol
periksa setelah memasang TXT record. Penjadwalan berkala menunggu worker
projection pada V9-5.

**Halaman toko belum menampilkan katalog.** Resolver menentukan toko mana yang
dituju; menampilkan produknya menunggu listing pada V9-4 dan projection pada
V9-5.

**`online_store` di schema tenant belum dibuat.** Profil, tema, dan halaman toko
direncanakan tinggal di tenant
([03](03-marketplace-domain-model-map.md)); yang dibangun sekarang adalah sisi
platform — slug, verifikasi, domain, dan suspensi. Pemisahan itu belum lengkap
dan diselesaikan bersama listing.
