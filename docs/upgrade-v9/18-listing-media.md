# 18 — Listing, Media, dan Gerbang Publikasi (V9-4)

Menutup D2–D6 pada [matriks gap](02-v8-to-v9-gap-matrix.md), dan lima risiko
pada [register](08-security-risk-register.md): R17, R18, R19, R21, sebagian R20.

Membuka `PENDING_PHASE` kedua pada pemeriksaan kesiapan seller.

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel tenant baru | 4 |
| Endpoint baru | 8 |
| Test baru | 102 |

## Tanpa dependensi native

Rencana pada [09](09-implementation-plan.md) menyebut `sharp` dan `file-type`.
Keduanya **tidak** dipakai, dan itu keputusan yang disengaja.

Pelajaran dari cutover Versi 7 masih berlaku: binary native `rollup` gagal pada
server Ubuntu 20.04 karena menuntut GLIBC 2.32, dan penyelesaiannya menuntut
mengganti seluruh pustaka. Menambah `sharp` — yang jauh lebih besar dan lebih
banyak menyentuh pustaka sistem — mengulang risiko yang sama.

Yang lebih penting: **bagian yang menentukan keamanan tidak memerlukannya.**

| Kontrol | Perlu pustaka gambar? |
| --- | --- |
| Menentukan tipe berkas dari isinya | tidak — magic byte |
| Membaca dimensi sebelum decode | tidak — header |
| Menolak bom dekompresi | tidak — batas piksel dari header |
| Menolak SVG dan HTML | tidak — tidak dikenali sebagai gambar |
| **Membuat turunan (thumbnail)** | **ya** |

Hanya baris terakhir yang menuntut `sharp`, dan ia kenyamanan penyajian, bukan
kontrol keamanan. Ditunda sampai terbukti berjalan pada server, dan dinyatakan
sebagai keterbatasan di bawah.

## Validasi media

Seluruh pemeriksaan dilakukan **tanpa mendekode gambar**. Itu bukan
penyederhanaan — bom dekompresi bekerja justru dengan membuat pendekode
mengembangkan berkas kecil menjadi gigabyte.

### Tipe dari isi, bukan dari nama

```text
<?php system($_GET["c"]); ?>   bernama "gambar.jpg"   ->  DITOLAK
<svg><script>alert(1)</script> bernama "gambar.png"   ->  DITOLAK
PNG yang sah                    bernama "gambar.jpg"   ->  DITOLAK
```

Yang ketiga menarik: berkasnya gambar sungguhan, tetapi ekstensinya bertentangan
dengan isinya. Itu menandakan pengunggah yang bingung atau sengaja mengelabui,
dan keduanya layak ditolak.

**SVG sengaja tidak diterima sama sekali.** Ia dokumen XML yang dapat memuat
skrip, dan menyanitasinya dengan benar jauh lebih sulit daripada menolaknya.

### Bom dekompresi

```text
PNG 24 byte yang menyatakan 60000 × 60000  ->  DITOLAK
PNG yang menyatakan 7000 × 7000            ->  DITOLAK (49 juta piksel)
```

Yang kedua penting: tiap sisinya di bawah batas 8000, tetapi totalnya melewati
batas 40 juta piksel. Memeriksa sisi saja tidak cukup.

Berkasnya hanya 24 byte. Dimensi dibaca dari header, dan berkas ditolak sebelum
satu piksel pun dibentuk.

### Batas lain

| Batas | Nilai | Alasan |
| --- | --- | --- |
| Ukuran berkas | 10 MB | — |
| Dimensi minimum | 500 × 500 | di bawah itu tidak layak ditampilkan |
| Dimensi maksimum | 8000 per sisi | — |
| Total piksel | 40 juta | pertahanan utama terhadap bom |
| Perbandingan sisi | 5:1 | bentuk seperti spanduk hampir selalu bukan foto barang |

Format yang diterima: JPEG, PNG, WebP, GIF. Pembacaan header ditulis sendiri
untuk keempatnya, termasuk tiga varian WebP dan penelusuran marker JPEG dengan
batas iterasi agar berkas yang dibuat-buat tidak membuat pemindaian berjalan
tanpa henti.

## YouTube

Bahaya yang ditutup: kolom `youtubeUrl` yang isinya diteruskan apa adanya ke
`src` sebuah iframe.

**Yang disimpan bukan URL, melainkan id video.** Alamat embed dibangun sistem
dari id itu, sehingga apa pun yang dikirim penjual tidak pernah menjadi bagian
dari HTML.

```text
masukan : http://m.youtube.com/watch?v=dQw4w9WgXcQ&x=<script>
tersimpan: dQw4w9WgXcQ
disajikan: https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ
```

Yang ditolak:

| Bentuk | Alasan |
| --- | --- |
| `javascript:`, `data:`, `file:`, `vbscript:` | hanya http dan https diterima |
| `https://youtube.com.evil.com/...` | host bukan YouTube resmi |
| `https://youtube.com@evil.com/...` | kredensial pada URL menyesatkan pembaca |
| daftar putar, halaman kanal | bukan video tunggal |
| id di luar 11 karakter base64url | bukan id YouTube |

### Penjaga terakhir di basis data

```sql
CONSTRAINT ck_online_listing_youtube CHECK (
  youtube_video_id IS NULL OR youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
)
```

Diuji langsung pada basis data: `<script>al` ditolak, begitu pula id yang
terlalu pendek, terlalu panjang, dan yang memuat spasi. Bila validasi aplikasi
kelak terlewat karena jalur baru, basis data tetap menolak.

## Gerbang publikasi

Blueprint bagian 8.1 mencantumkan enam belas syarat. Yang paling sering
disebut — tiga gambar — hanyalah satu di antaranya.

Ditulis sebagai fungsi murni tanpa akses basis data, sehingga seluruh
kombinasinya dapat diuji dan aturan yang sama dipakai UI untuk menampilkan apa
yang masih kurang **sebelum** penjual menekan terbit.

### Seluruh syarat diperiksa, bukan berhenti pada yang pertama

Penjual yang memperbaiki satu hal lalu ditolak karena hal berikutnya akan
menyerah. Daftar lengkap membuatnya dapat menyelesaikan semuanya sekaligus.

### Sembilan belas pemeriksaan

```text
SELLER_ACTIVE      PRODUCT_ACTIVE     TITLE            DESCRIPTION
CATEGORY           CONDITION          VARIANT          SKU
PRICE              STOCK_OR_PREORDER  WEIGHT           DIMENSION
SHIPPING_ORIGIN    TAX_POLICY         RETURN_POLICY    MINIMUM_IMAGES
PRIMARY_IMAGE      MEDIA_MODERATION   COMPLIANCE
```

Beberapa keputusan yang perlu dijelaskan:

**Harga nol ditolak, bukan hanya harga kosong.** Harga nol membuat pembeli dapat
memesan tanpa membayar.

**Stok nol diterima bila pre-order diizinkan.** Menolaknya akan memaksa penjual
menyembunyikan produk yang memang dijual secara pesan-dahulu.

**Kepatuhan yang belum diperiksa BUKAN berarti lolos.** Produk terlarang yang
belum sempat diperiksa tidak boleh tampil hanya karena antrean moderasi
menumpuk. Hanya `PASSED` yang meloloskan.

**Gambar tidak aktif tidak dihitung.** Empat gambar dengan dua di antaranya
nonaktif berarti dua yang berlaku.

**Tepat satu gambar utama.** Nol berarti sampul tidak dapat ditentukan; lebih
dari satu berarti hal yang sama.

### Batas gambar dari program, bukan konstanta

`MarketplaceProgram.minimumListingImages` menentukan angkanya, sehingga
kebijakan dapat berubah tanpa rilis.

## Listing menunjuk produk, tidak menggandakannya

Nama dan harga dasar tetap milik `product` dan `price_book_item`. Yang
ditambahkan hanya hal yang khusus penjualan online: judul versi toko, kategori
marketplace, media, dan status publikasi.

Menyalin nama dan harga produk ke listing akan menghasilkan dua sumber kebenaran
yang segera menyimpang.

**Satu produk, satu listing aktif.** Dua listing untuk produk yang sama berarti
dua harga dan dua stok untuk barang yang sama.

## `file_object` akhirnya dipakai

Tabel ini ada sejak V001 tetapi **tidak dipakai satu pun service** — audit V9-0
mencatatnya sebagai "tabel kosong tanpa layanan". Media listing menjadi pemakai
pertamanya; tidak ada tabel penyimpanan berkas kedua yang dibuat.

## Penerbitan menjalankan gerbang ulang

`publish()` tidak mengandalkan hasil tersimpan. Hasil lama dapat sudah usang:
gambar dihapus, stok habis, atau penjual ditangguhkan sejak pemeriksaan terakhir.

Setiap perpindahan status mencatat snapshot gerbang, sehingga penolakan dapat
ditelusuri kemudian.

## Bukti

[`evidence/v9-4-listing.txt`](evidence/v9-4-listing.txt).

```text
8 endpoint listing terdaftar pada OpenAPI
4 tabel V013 pada schema demo
batasan unik: ux_online_media_primary, ux_online_media_hash
8 CHECK constraint

Batasan basis data pada id video:
  id video sah        diterima
  skrip               ditolak
  terlalu pendek      ditolak
  terlalu panjang     ditolak
  spasi               ditolak
```

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **398 lulus** (383 API + 15 web), naik dari 296 |
| `pnpm build` | bersih |
| `pnpm route:audit` | 0 route tanpa penanda |
| `verify-migrations.mjs` | 13 migration lulus |

V013 diterapkan pada 14 schema pengembangan.

## Keterbatasan yang diketahui

**Turunan gambar belum dibuat.** Gambar disajikan pada ukuran aslinya. Membuat
thumbnail menuntut pustaka pengolah gambar yang belum diverifikasi pada server;
lihat bagian "Tanpa dependensi native" di atas. Ini memengaruhi kecepatan muat
halaman, bukan keamanan.

**EXIF belum dibuang** (R20 sebagian). Membuang metadata menuntut menulis ulang
berkas, yang juga menuntut pustaka pengolah gambar. Sampai itu ada, foto produk
dapat memuat koordinat tempat pengambilannya. Perlu diberitahukan kepada penjual
pada halaman unggah.

**Unggah berkas belum punya endpoint.** `addImage()` berjalan dan diuji, tetapi
jalur HTTP-nya menuntut penanganan multipart dan penyimpanan objek yang belum
diputuskan. Endpoint unggah menyusul bersama keputusan penyimpanan.

**Moderasi media belum berjalan.** Kolomnya ada dan gerbang membacanya, tetapi
tidak ada proses yang mengubah `PENDING` menjadi `APPROVED`. Sampai itu ada,
gambar berstatus `PENDING` tetap lolos gerbang — hanya `REJECTED` yang menahan.
Ini disengaja agar penjual tidak terhalang oleh antrean yang belum ada, dan
harus ditinjau ulang saat moderasi diaktifkan pada V9-12.

**Varian belum punya endpoint.** Tabelnya ada dan gerbang membacanya; pengelolaan
varian menyusul bersama UI katalog.

**Kategori marketplace belum ada.** `marketplace_category_ref` menunjuk tabel
yang dibangun pada V9-12, sehingga syarat `CATEGORY` belum dapat dipenuhi
tenant mana pun. Gerbang tetap memeriksanya — melaporkannya lolos akan membuat
listing terbit tanpa kategori.
