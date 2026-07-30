# 19 — Katalog Marketplace Publik (V9-5)

Menutup D7–D9 pada [matriks gap](02-v8-to-v9-gap-matrix.md), serta R15 dan R26
pada [register risiko](08-security-risk-register.md).

Membuka blokade yang dicatat pada [18](18-listing-media.md): tanpa kategori
marketplace, syarat `CATEGORY` pada gerbang publikasi tidak dapat dipenuhi
tenant mana pun, sehingga tidak ada listing yang dapat terbit.

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel platform baru | 3 |
| Kategori tertanam | 59 |
| Endpoint baru | 6 |
| Test baru | 33 |

## Kategori dibangun sekarang, bukan V9-12

Rencana menempatkan kategori marketplace pada V9-12. Itu tidak dapat
dipertahankan: gerbang publikasi mensyaratkan kategori, dan tanpa listing yang
terbit tidak ada yang dapat diproyeksikan maupun dicari. Seluruh fase ini tidak
dapat dibuktikan berjalan tanpanya.

Yang dibangun adalah kerangka yang cukup untuk berjualan — sebelas akar, 48
kategori daun — bukan taksonomi lengkap. Kategori tambahan menyusul lewat
antarmuka platform.

### Hanya daun yang boleh dipilih

Kategori induk ada untuk menavigasi. Produk yang ditaruh pada "Fashion" tidak
akan ditemukan pembeli yang menelusuri "Fashion › Fashion Pria › Kemeja".

Status daun **dihitung dari data**, bukan ditulis tangan: satu baris anak baru
otomatis mengubah induknya menjadi bukan-daun tanpa ada yang perlu diingat.

### Jalur materialized

```text
/FASHION
/FASHION/FASHION_PRIA
/FASHION/FASHION_SEPATU
```

Sifat "jalur anak selalu berawalan jalur induk" membuat pencarian seluruh
keturunan menjadi satu perbandingan awalan alih-alih kueri rekursif. Terbukti
pada bukti HTTP: kategori induk `fashion` mengembalikan 4 produk, daun
`fashion-pria` mengembalikan 2.

### Kategori terbatas

Tiga kategori ditandai terbatas: suplemen, alat kesehatan, dan susu bayi.
Penandaan ini belum menghalangi apa pun — ia menyiapkan tempat bagi moderasi
V9-12 agar kategorinya tidak perlu diubah kemudian.

## Projection: disalin, bukan dibaca langsung

Marketplace publik yang membaca schema tenant pada setiap permintaan harus
membuka koneksi ke ratusan schema dari permintaan anonim. Selain lambat, satu
kesalahan penyaringan di jalur itu membocorkan data penjual lain.

Projection membalik risikonya: **yang dibaca publik hanya berisi apa yang
memang boleh dilihat publik.**

### Empat aturan yang menentukan isinya

| Aturan | Mengapa |
| --- | --- |
| Hanya listing `PUBLISHED` | data yang belum terbit tidak pernah sampai ke tabel yang dibaca publik |
| Hanya penjual `ACTIVE` dan toko `PUBLISHED` | penangguhan berarti hilang dari katalog, bukan sekadar kehilangan hak menerbitkan baru |
| Penarikan **menghapus** baris | baris yang ada berarti "boleh dilihat siapa pun"; penanda visibilitas hanya menambah satu tempat lagi yang bisa lupa disaring |
| Nama schema hanya dari `tenant_schema_registry` | tidak pernah dari payload peristiwa, tidak pernah dari permintaan |

Aturan kedua penting bentuknya: syarat diperiksa **saat menulis**, dan yang
tidak memenuhi **dihapus** alih-alih ditulis dengan penanda. Menuliskannya
dengan penanda "jangan tampilkan" berarti data yang belum layak tampil tetap
berada di tabel yang dibaca publik, terpisah hanya oleh satu klausa `WHERE`
yang bisa lupa ditulis.

### Toko `VERIFIED` belum cukup

Hanya `PUBLISHED`. Toko yang baru terverifikasi sudah terbukti kepemilikannya
tetapi belum dinyatakan siap berjualan oleh pemiliknya sendiri, dan menampilkan
produknya berarti memutuskan hal itu untuknya.

## `sync_outbox` akhirnya dipakai

Tabel ini ada sejak V007 tetapi **tidak dipakai satu pun layanan** — audit V9-0
mencatatnya sebagai tabel tanpa pemakai. Katalog menjadi pemakai pertamanya;
tidak ada tabel antrean kedua yang dibuat.

### Peristiwa dititipkan dalam transaksi yang sama

```typescript
await client.query(`UPDATE ... SET status = 'PUBLISHED' ...`);
await client.query(`INSERT INTO online_listing_publication ...`);
await enqueueListingEvent(client, schemaName, 'PUBLISH', { listingId });
```

Bila penerbitan berhasil tetapi peristiwanya gagal ditulis, katalog publik akan
diam-diam tertinggal tanpa ada yang tahu. Satu transaksi membuat keduanya
berhasil bersama atau gagal bersama.

### Tanpa Redis

`SELECT ... FOR UPDATE SKIP LOCKED` sudah memberi antrean yang aman dijalankan
beberapa proses sekaligus. Menambah Redis berarti menambah satu layanan yang
harus dipasang, dipantau, dan dipulihkan pada server produksi — untuk
keuntungan yang belum terbukti dibutuhkan pada volume saat ini.

### Peristiwa terbengkalai diambil kembali

Cacat yang ditemukan saat pembuktian, bukan saat perancangan: proses yang mati
setelah mengklaim peristiwa tetapi sebelum menyelesaikannya meninggalkannya
berstatus `PROCESSING` **selamanya**. Listing yang sudah terbit tidak akan
pernah muncul di katalog, dan tidak ada yang memberi tahu.

Enam peristiwa benar-benar tersangkut seperti itu selama pengembangan.
Pemulihannya: peristiwa `PROCESSING` yang lebih tua dari lima menit ikut
diambil pada putaran berikutnya. Terbukti — keenam peristiwa yang tersangkut
terproses habis pada putaran berikutnya (`dibaca 6, diterapkan 6, gagal 0`).

## Pencarian

Dokumen pencarian dibentuk **trigger basis data**, bukan aplikasi. Menaruhnya
di aplikasi berarti satu jalur penulisan yang lupa memanggilnya menghasilkan
baris yang tidak pernah muncul pada pencarian.

Dibuktikan dengan menulis baris langsung lewat SQL, melewati seluruh kode
aplikasi: dokumen tetap terbentuk, dan mengubah judul lewat SQL mengubah
indeksnya juga.

### Konfigurasi `simple`, bukan bahasa

PostgreSQL 13 tidak punya konfigurasi bahasa Indonesia bawaan. `simple` memecah
kata tanpa stemming, dan untuk katalog produk itu justru lebih dapat
diramalkan: "sepatu" tidak berubah menjadi "sepat", dan nama merek tetap utuh.

### `websearch_to_tsquery`, bukan `to_tsquery`

Ia menerima apa yang benar-benar diketik orang — termasuk tanda kutip dan kata
sambung — tanpa melempar kesalahan sintaks. `to_tsquery` gagal pada masukan
sesederhana `kaos & `.

### Bobot

| Bagian | Bobot |
| --- | --- |
| Judul | A |
| Nama toko | B |
| Deskripsi | C |

## Batas terhadap pengambilan katalog massal (R26)

Katalog memang untuk dilihat siapa pun, tetapi menyalin seluruhnya adalah hal
lain. Tiga batas bekerja bersama:

| Batas | Perilaku | Alasan bentuknya |
| --- | --- | --- |
| Ukuran halaman | di atas 48 **dipangkas** | pengunjung yang salah menulis angka tetap mendapat hasil |
| Kedalaman | offset melewati 2.000 **ditolak** | pembeli sungguhan tidak membuka halaman ke-200 |
| Penyaring wajib | halaman > 5 tanpa penyaring **ditolak** | menutup pengambilan berurut dari halaman 1 sampai habis |

Terbukti: `jumlah=100000` dilayani dengan `limit` 48; `halaman=500` ditolak;
`halaman=20` tanpa penyaring ditolak; `q=kaos&halaman=3` dilayani.

## Nama schema tidak pernah dikembalikan

`tenantId`, `tenantSchema`, dan `tenantListingId` tersimpan pada projection
untuk penelusuran balik, tetapi **tidak satu pun ikut pada respons publik**.
Pengunjung tidak pernah membutuhkannya, dan mengirimkannya memberi tahu nama
schema yang dapat dicoba dipakai pada permintaan lain.

Diperiksa langsung terhadap teks mentah respons, bukan terhadap bentuk yang
diharapkan.

## Alamat produk

```text
toko-demo/kaos-polos-katun-combed-30s
```

Slug toko disertakan karena judul yang sama dari dua toko berbeda sangat lazim
("Kaos Polos Hitam"). Keduanya dapat hidup berdampingan tanpa satu pun diberi
akhiran angka yang tidak berarti bagi pembeli.

**Alamat yang sudah pernah dibagikan tidak berubah** meski judulnya berubah;
tautan yang pernah disebar harus tetap sampai.

## Halaman marketplace

Route `/belanja`, terpisah dari website perusahaan. Keduanya melayani orang
yang berbeda: website menjelaskan produk ERP kepada calon pelanggan,
marketplace melayani pembeli yang mencari barang.

Seluruh keadaan pencarian tinggal di alamat URL, sehingga hasil dapat
dibagikan, ditandai, dan tombol kembali bekerja.

**Tombol beli sengaja tidak ada.** Keranjang dan checkout dibangun pada V9-6.
Menampilkan tombol yang tidak berfungsi lebih buruk daripada tidak
menampilkannya — pembeli yang menekannya dan tidak terjadi apa-apa akan
menyimpulkan situsnya rusak.

**Deskripsi disajikan sebagai teks, bukan HTML.** Penjual dapat menulis apa
saja, dan menyajikannya sebagai HTML berarti setiap penjual dapat menjalankan
skrip di halaman marketplace.

## Data contoh

`pnpm --filter @ebisnis/api seed:marketplace-demo` menyiapkan penjual, toko,
kebijakan retur, dan enam listing pada tenant `demo`.

**Gerbang publikasi tidak dilewati.** Data disiapkan sampai memenuhi seluruh
syaratnya, lalu `publish()` yang asli dipanggil. Menerbitkan lewat `UPDATE`
langsung akan membuktikan tidak ada apa-apa — justru gerbanglah yang perlu
dibuktikan bekerja.

## Bukti

[`evidence/v9-5-catalog.txt`](evidence/v9-5-catalog.txt) dan
[`evidence/v9-5-http.txt`](evidence/v9-5-http.txt).

```text
59 kategori: 11 akar, 48 daun, 3 terbatas
jalur anak berawalan jalur induk        LULUS
dokumen pencarian dibentuk basis data   LULUS
judul lama tidak lagi ditemukan         LULUS

tenant demo: 6 terbit, 0 belum terbit
katalog publik: 6 produk
tidak ada baris katalog tanpa listing terbit   LULUS
ketersediaan sesuai stok dan izin pre-order    LULUS

tidak ada pengenal tenant pada respons         LULUS
jumlah=100000 dilayani dengan limit 48         LULUS
halaman jauh tanpa penyaring ditolak           LULUS
kategori induk mencakup subkategorinya         LULUS
```

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **431 lulus** (416 API + 15 web), naik dari 398 |
| `pnpm build` | bersih |
| `pnpm route:audit` | 0 route tanpa penanda |
| `verify-migrations.mjs` | 13 migration lulus |

## Keterbatasan yang diketahui

**Worker belum berjalan sendiri.** Projection dijalankan lewat endpoint
platform atau CLI. Penjadwalannya menyusul bersama worker terjadwal; sampai
itu ada, katalog menyegar saat dipicu, bukan otomatis.

**Gambar belum tampil.** Kartu produk menampilkan bingkai berisi jumlah foto,
bukan gambarnya. Endpoint penyajian berkas menyusul bersama keputusan
penyimpanan objek yang ditunda pada V9-4. Bingkai yang disengaja terbaca
sebagai "belum ada foto"; gambar rusak akan terbaca sebagai "situs ini rusak".

**Halaman toko belum ada.** Menekan nama toko menyaring pencarian menurut toko
itu, belum membuka halaman profil toko.

**Pemesanan belum ada.** Keranjang, checkout, dan pembayaran dibangun pada
V9-6 dan V9-7.

**Ketersediaan bukan jumlah pasti.** Projection menyimpan `IN_STOCK`,
`PREORDER`, atau `OUT_OF_STOCK` — bukan angka stok. Jumlah pasti berubah setiap
detik, dan menyalinnya ke katalog berarti berjanji lebih dari yang dapat
ditepati. Stok sesungguhnya diperiksa saat reservasi pada V9-8.

**Moderasi media masih menerima `PENDING`.** Diwarisi dari V9-4 dan belum
berubah: gambar berstatus `PENDING` tetap lolos, hanya `REJECTED` yang menahan.
Harus ditinjau ulang saat moderasi diaktifkan pada V9-12.
