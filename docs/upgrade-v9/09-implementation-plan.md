# 09 — Rencana Implementasi Versi 9

## Ukuran pekerjaan, dinyatakan terus terang

Matriks gap mencatat **67 requirement**, 48 di antaranya belum ada sama sekali.
Dokumen Versi 9 menyebut sekitar **200 model baru** di seluruh fase.

Sebagai pembanding: seluruh sistem yang ada sekarang — Versi 5 sampai 8, hasil
pekerjaan berbulan-bulan — berisi 121 tabel tenant dan 136 model platform.
Versi 9 meminta menambah sekitar 60 persen dari itu lagi, ditambah marketplace
publik, storefront multi-domain, dan integrasi pembayaran per seller.

Ini bukan pekerjaan satu atau dua sesi. Rencana di bawah memecahnya menjadi
irisan vertikal yang masing-masing benar-benar berjalan, bukan kerangka.

Dua fase menyimpang dari urutan dokumen, dengan alasan yang dinyatakan.

## Penyimpangan dari urutan dokumen

### V9-1 didahului perbaikan otorisasi

Dokumen menempatkan menu, role, dan permission pada V9-13. Dua hal dinaikkan ke
V9-1:

**V6-0-F03 — `PermissionGuard` keluar lebih awal bila handler tidak punya
metadata permission.** Versi 9 menambah puluhan endpoint yang menyentuh uang dan
stok milik seller berbeda. Setiap endpoint yang ditambahkan sebelum guard
diperbaiki mewarisi lubang yang sama, dan memperbaikinya belakangan berarti
mengaudit ulang seluruh endpoint yang sudah dibuat.

**Penegakan batas data pada query.** `role_data_scope` sudah terisi sejak V010
tetapi tidak menyaring apa pun. Pada ERP satu tenant, akibatnya terbatas. Pada
marketplace, ia berarti seller dapat melihat pesanan seller lain.

Blueprint Versi 9 sendiri menyatakan prinsipnya: *"Permission server-side adalah
sumber kebenaran. Menyembunyikan menu/tombol hanya bagian UI."* Menunda penegakan
sampai V9-13 bertentangan dengan kalimat itu.

### Ticketing dan armada dibangun, bukan dipakai ulang

Dokumen Versi 9 mengasumsikan modul Versi 7 tersedia:

> "Jangan membuat fleet/GPS kedua. Reuse: ExpeditionOrder, ExpeditionTrip,
> TripStop, TrackingSession, LocationPing, ProofOfDelivery."

Tidak satu pun dari enam model itu ada. Ticketing juga tidak ada, padahal alur
aktivasi eSmartlink bergantung padanya.

Larangan "jangan membuat yang kedua" tetap dihormati dengan membangunnya
**sekali**, memakai nama yang diminta Versi 7, sehingga tidak ada yang perlu
digabungkan kelak.

Ticketing minimum masuk V9-2 karena aktivasi menuntutnya. Armada masuk V9-9.

## Urutan fase

| Fase | Isi | Hasil yang dapat dipakai |
| --- | --- | --- |
| **V9-0** | audit, gap matrix, baseline | dokumen dan bukti (**selesai**) |
| **V9-1** | perbaikan guard + penegakan batas data + root menu marketplace + fondasi seller/store | otorisasi tertutup; seller dapat mendaftar |
| **V9-2** | ticketing minimum + akun provider tenant + credential terenkripsi + health check | tenant dapat meminta aktivasi; admin dapat mengisi credential dengan aman |
| **V9-3** | toko online, registry domain terverifikasi, storefront resolver | toko tenant hidup di URL marketplace dan custom domain |
| **V9-4** | listing, pipeline media, gerbang 3 gambar, validasi YouTube | seller dapat menyiapkan produk online |
| **V9-5** | outbox projection, halaman publik, pencarian, SEO | belanja.ebisnis.id menampilkan produk |
| **V9-6** | pembeli, keranjang, checkout berkelompok seller | pembeli dapat memesan |
| **V9-7** | orkestrasi pembayaran, callback, inquiry, rekonsiliasi | pembeli dapat membayar |
| **V9-8** | order, reservasi, routing | pesanan lunas menjadi tugas gudang |
| **V9-9** | picking, packing, paket, pengiriman, pelacakan, armada internal | pesanan dapat dikirim |
| **V9-10** | retur, refund manual, penukaran, sengketa | pesanan dapat dikembalikan |
| **V9-11** | promosi, chat, ulasan | pembeli dan penjual dapat berinteraksi |
| **V9-12** | moderasi, kebijakan, risiko, fee | platform dapat mengawasi |
| **V9-13** | 33 role, 16 root menu, profil M1–M8, permission, sample user | hak akses lengkap |
| **V9-13B** | Help, Excel, PDF, CrudActionGroup pada halaman V9 | standar Versi 8 diterapkan |
| **V9-14** | event akuntansi, laporan, regression, rilis | pembukuan dan pelepasan |

## Prinsip yang berlaku di seluruh fase

**Additive.** Migration tenant dimulai dari V011. V001–V010 sudah diterapkan pada
14 schema pengembangan dan 1 produksi; tidak boleh disentuh.

Satu pengecualian yang tidak dapat dihindari: `PaymentOrder.invoiceId` harus
dilonggarkan dari `NOT NULL`. Ini melonggarkan, bukan menghapus; tidak ada baris
lama yang berubah nilainya. Diuraikan pada
[05-payment-and-settlement-constraints.md](05-payment-and-settlement-constraints.md)
beserta mitigasinya.

**PostgreSQL 13 sebagai batas bawah.** Produksi berjalan di 13.12.

**Reuse sebelum membuat.** Daftar lengkap pada
[03-marketplace-domain-model-map.md](03-marketplace-domain-model-map.md) dan
[11-table-reuse-and-ownership-map.md](11-table-reuse-and-ownership-map.md).

**Feature flag.** Setiap kapabilitas di balik flag, bawaan `false` di produksi:

```text
V9_MARKETPLACE_ENABLED        V9_STOREFRONT_CUSTOM_DOMAIN_ENABLED
V9_LISTING_ENABLED            V9_PUBLIC_CATALOG_ENABLED
V9_CHECKOUT_ENABLED           V9_MARKETPLACE_PAYMENT_ENABLED
V9_FULFILLMENT_ENABLED        V9_SHIPPING_ENABLED
V9_RETURN_ENABLED             V9_PROMOTION_ENABLED
```

Flag tidak pernah menggantikan permission.

**Regression setiap fase.** 119 unit test dan E2E dijalankan sebelum dan sesudah.
Kegagalan diklasifikasikan, tidak diberi label "tidak terkait".

**Gerbang keamanan.** Setiap risiko KRITIS pada
[08-security-risk-register.md](08-security-risk-register.md) wajib punya test yang
gagal bila penanganannya dicabut.

## Ketergantungan baru

| Paket | Untuk | Catatan |
| --- | --- | --- |
| `sharp` | turunan gambar, pemeriksaan dimensi | binary native; diperiksa pada glibc server |
| `file-type` | tipe berkas dari isi, bukan ekstensi | wajib untuk R17 |
| `exceljs` | Excel V9-13B | ditunda sampai fase itu |
| `pdfkit` | PDF V9-13B | ditunda |
| `google-auth-library` | login Google pembeli | V9-6 |

**Tidak memakai Redis.** Antrean tetap memakai `job_execution` dengan
`SELECT ... FOR UPDATE SKIP LOCKED`, seperti yang sudah diputuskan pada Versi 8.

**Tidak memakai Elasticsearch.** Pencarian memakai PostgreSQL full-text search dan
trigram lebih dulu. Menambah mesin pencari berarti menambah komponen operasional
pada satu server yang juga menjalankan aplikasi lain. Bila FTS terbukti tidak
memadai pada uji beban, keputusannya ditinjau ulang dengan data.

Kedua keputusan ini ditulis sebagai ADR pada fasenya.

## Definisi selesai per fase

Sebuah fase selesai hanya bila seluruhnya ada:

```text
migration additive        service dengan test
endpoint + OpenAPI        Orval diregenerasi
UI yang dapat dipakai     permission diverifikasi server
menu dan role             audit
test unit + integrasi     CHANGELOG.md
commit + push             CI hijau
worktree bersih
```

Fase yang baru punya sebagiannya dicatat `V9_PARTIAL`, bukan selesai.

## Yang dilaporkan setiap fase

```text
status sebelum dan sesudah      migration dan tabel
berkas dibuat dan diubah        API, OpenAPI, Orval
UI                              permission, i18n, seed, audit
test dan hasil sebenarnya       regresi
commit SHA, push, CI            cara menguji
risiko dan rollback             keterbatasan yang diketahui
```

## Catatan tentang kecepatan

Rencana ini tidak menjanjikan seluruh Versi 9 selesai dalam waktu dekat. Yang
dijanjikan adalah setiap fase menghasilkan sesuatu yang benar-benar berjalan dan
dapat diuji, dan bahwa fase yang menyentuh uang tidak dibangun di atas otorisasi
yang diketahui bocor.

Bila diminta memilih, urutan yang memberi nilai paling cepat kepada pengguna
adalah V9-1 sampai V9-5: seller mendaftar, menyiapkan toko dan produk, lalu
produk itu terlihat publik di belanja.ebisnis.id. Checkout dan pembayaran
menyusul setelah credential eSmartlink tersedia.
