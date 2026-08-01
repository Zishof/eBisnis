# ADR-012 — Klien kasir kedua (Flutter) dan kontrak aturan bersama

- Status: Diusulkan
- Tanggal: 2026-08-01

## Konteks

Layar kasir sudah tersedia sebagai aplikasi web yang dapat dipasang (PWA): ia
berjalan luring, menyimpan katalog dan buku transaksi di mesin kasir, dan sejak
#53 dapat menyelesaikan penjualan tanpa peladen.

Permintaan berikutnya adalah klien kasir **Flutter** sebagai alternatifnya.
Alasan yang wajar untuk itu memang ada: akses perangkat keras yang lebih
langsung (laci kas, pencetak struk termal, pemindai terintegrasi), pemasangan
lewat toko aplikasi, dan mesin kasir lama yang perambannya terlalu tua untuk
service worker.

Permintaan ini bersinggungan dengan dua aturan tetap proyek:

> Jangan membuat project baru. Jangan membuat project POS terpisah.

## Keputusan

**Klien Flutter dibangun sebagai klien kedua dari sistem yang sama, bukan
sebagai POS berdiri sendiri.**

Perbedaan itu bukan soal peristilahan. Yang membedakannya dapat diperiksa:

| Boleh dimiliki klien Flutter | Tidak boleh, selamanya |
| --- | --- |
| Antarmuka, navigasi, tata letak | Basis data sendiri sebagai sumber kebenaran |
| Penyimpanan lokal untuk katalog dan antrean luring | Kebijakan harga, promosi, atau buku harga |
| Akses perangkat keras (laci, pencetak, pemindai) | Penerbitan nomor struk di luar jatah yang dipesan peladen |
| Aritmetika baris dan total dari harga yang **sudah dibekukan peladen** | Penentuan hak akses; ia mengikuti yang dikirim `/me/menus` dan penjaga API |

Ia memakai **peladen yang sama**, **basis data yang sama**, **migrasi yang
sama**, dan **jalur penerimaan transaksi luring yang sama** (`POST
/pos/offline/sales`). Tidak ada satu pun tabel, migrasi, atau aturan bisnis yang
menjadi miliknya sendiri.

Letaknya di dalam repositori yang sama (`apps/pos-flutter/`), bukan repositori
terpisah — supaya perubahan kontrak API dan perubahan kliennya terlihat pada
permintaan tarik yang sama.

## Yang membuat keputusan ini mahal, dan bagaimana ditangani

Kasir luring menyimpan **1.159 baris aturan murni** di `apps/web/src/pos-offline/`:

| Berkas | Baris | Yang ditentukannya |
| --- | --- | --- |
| `ledger.ts` | 461 | Rantai hash buku transaksi lokal, rekonsiliasi |
| `harga-luring.ts` | 226 | Aritmetika uang dalam satuan terkecil |
| `katalog.ts` | 202 | Batas umur salinan; kapan harga tidak boleh dipakai |
| `blok-struk.ts` | 141 | Jatah nomor struk |
| `koneksi.ts` | 129 | Kapan peladen dianggap tidak menjawab |

Klien Flutter memerlukan **seluruhnya**, dalam Dart. Ini duplikasi aturan uang
dalam dua bahasa — persis yang dihindari sepanjang pengerjaan kasir luring,
dengan alasan yang tidak berubah: dua implementasi aturan uang tidak pernah tetap
sama, dan yang pertama menyadarinya adalah pembeli yang ditagih berbeda.

Di sini duplikasinya tidak terhindarkan. Yang dapat dihindari adalah
**menyimpangnya diam-diam.**

### Kontraknya: vektor konformansi bersama

Spesifikasi TypeScript yang sudah ada diekspor menjadi **vektor uji berformat
JSON** di `packages/pos-rules-vectors/`. Keduanya — TypeScript dan Dart — wajib
menjalankan vektor yang sama dan menghasilkan angka yang sama.

Akibatnya, penyimpangan tidak lagi berupa perbedaan yang baru ketahuan di kasir,
melainkan **uji yang merah pada CI**. Aturan yang berubah di satu sisi tanpa
sisi lain tidak dapat digabungkan.

Vektor dibangkitkan dari sumber yang sama dengan uji TypeScript-nya, bukan
disalin dengan tangan — daftar yang disalin dengan tangan akan tertinggal pada
perubahan pertama yang terburu-buru.

## Konsekuensi

**Yang menjadi lebih baik**

- Mesin kasir dengan peramban tua, dan perangkat keras yang menuntut akses
  langsung, dapat dilayani.
- Pemasangan lewat toko aplikasi, tanpa bergantung pada dukungan PWA peramban.

**Yang menjadi lebih mahal, dan harus diterima secara sadar**

- Setiap perubahan aturan luring dikerjakan **dua kali**, dan CI menolak bila
  hanya satu yang dikerjakan. Itu memang tujuannya, tetapi ia memperlambat
  perubahan pada bagian yang paling sering perlu diperbaiki.
- Dua klien berarti dua permukaan galat, dua alur rilis, dan dua tempat yang
  harus diperiksa ketika kasir melaporkan sesuatu.

**Yang TIDAK berubah**

- Peladen tetap satu-satunya yang menentukan harga, stok, nomor struk final, dan
  hak akses.
- Transaksi luring dari klien mana pun masuk lewat `POST /pos/offline/sales`,
  diputar ulang lewat jalur penjualan yang sama, dan ditahan di karantina bila
  angkanya tidak cocok.

## Alternatif yang dipertimbangkan

**Membungkus PWA dalam WebView.** Jauh lebih murah — tidak ada duplikasi aturan
sama sekali. Ditolak untuk sebagian keperluan: WebView tidak menyelesaikan
masalah peramban tua (ia justru memakai mesin peramban perangkatnya), dan akses
perangkat keras tetap menuntut jembatan asli. Untuk keperluan **pemasangan lewat
toko aplikasi saja**, pembungkus WebView tetap pilihan yang lebih baik daripada
klien penuh, dan sebaiknya dipilih bila itu satu-satunya alasannya.

**Menunggu sampai kebutuhannya terbukti.** Layak dipertimbangkan bila belum ada
mesin kasir sungguhan yang gagal memakai PWA-nya. Klien kedua yang dibangun
sebelum ada yang memerlukannya membayar seluruh ongkos pemeliharaannya tanpa
memperoleh apa pun.
