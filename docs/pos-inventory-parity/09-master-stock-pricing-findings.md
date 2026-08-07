# 09. Master Data (01-07), Stock/Opname (08-10), Pricing (11-19) — Verification Findings

**Metode:** tiga agent riset paralel membaca kode langsung, dengan sitasi file:line, mengikuti
metode skeptis yang sama dipakai pada audit POS core dan Purchase/Sales sebelumnya.

## Ringkasan keseluruhan

Berbeda dari Purchase→AP/Sales→AR (yang gap-nya sistemik — seluruh mekanisme hilir tidak pernah
tersambung), domain 01-19 **jauh lebih matang**. Layar 01-07 khususnya adalah kualitas terbaik
yang ditemukan sejauh ini di audit ini: CRUD, audit trail, export, DAN antrean luring Flutter
semuanya CONFIRMED bekerja dengan benar — termasuk pola idempotency-key-sekali-buat-simpan-lokal
yang SAMA yang baru saya perbaiki untuk checkout kasir. Tapi ada beberapa temuan tajam yang layak
perhatian serius, terutama satu isu keamanan nyata.

## Layar 01-07 — Master Supplier/Customer/Sales

| # | Klaim | Status | Ringkas |
|---|---|---|---|
| 1 | CRUD lifecycle | **CONFIRMED** | Mesin CRUD generik nyata (`master-lifecycle.service.ts`), bukan stub |
| 2 | Active/inactive | **CONFIRMED (supplier/customer), GAP (salesperson)** | Supplier tidak aktif ditolak PO, customer tidak aktif ditolak sales order — tapi TIDAK ada penegakan serupa untuk salesperson tidak aktif di manapun |
| 3 | Filter saldo open/settled | **PARTIAL** | Saldo real (dari legacy_payable/receivable_ledger), tapi filter open/settled hanya bucketing sisi klien — endpoint tidak menerima parameter filter sama sekali |
| 4 | **Masking data bank** | **GAP — isu keamanan nyata** | **Tidak ada masking sisi server sama sekali.** Nomor rekening penuh dikirim ke SETIAP pemanggil dengan permission READ dasar. "Masking" yang ada murni state komponen React lokal (`showBank` toggle, tanpa permission check) — nilai lengkap SUDAH ada di response JSON dan network tab terlepas dari toggle-nya. Satu halaman (`InventorySupplierWorkspacePage.tsx:263`) bahkan mencetak nomor rekening penuh tanpa penyamaran sama sekali |
| 5 | Audit history | **CONFIRMED** | Trail nyata, dapat di-query per record, gate permission terpisah (`AUDIT_READ`) |
| 6 | PDF/Excel export | **CONFIRMED** | Library nyata (`xlsx`, `jspdf`), bukan blob palsu |
| 7 | Antrean luring Flutter | **CONFIRMED** | Pola yang BENAR — idempotency key dibuat sekali, disimpan lokal SEBELUM percobaan jaringan, backoff eksponensial. Sama seperti pola benar yang sudah diverifikasi untuk order sales mobile |
| 8 | Migration V050 | **CONFIRMED** | Aditif murni, sesuai klaim |
| 9 | Test | **PARTIAL** | Golden visual Flutter desktop nyata; TAPI nol test web untuk `InventoryPartyMasterPage.tsx` (layar CRUD utamanya) |

## Layar 08-10 — Stok dan Opname

| # | Klaim | Status | Ringkas |
|---|---|---|---|
| 1 | Saldo stok akurat | **PARTIAL** | `/stock/balances` (path yang diklaim katalog) **tidak ada sama sekali** — path nyatanya `/inventory/balances`, dan **tidak pernah dipanggil Web maupun Flutter**. Layar Stok Web tidak menampilkan kuantitas live sama sekali, hanya status dari data opname legacy |
| 2 | Siklus opname penuh | **CONFIRMED** | State machine nyata: DRAFT→FROZEN→COUNTED→APPROVED→POSTED, setiap transisi endpoint nyata dengan row lock |
| 3 | Posting opname → penyesuaian stok | **CONFIRMED** | Movement immutable nyata (`ADJUSTMENT_IN`/`OUT`) untuk setiap varians, bukan update laporan saja |
| 4 | **Mekanisme freeze** | **GAP** | Hanya label status — **tidak ada satu pun modul lain (penjualan, penerimaan) yang memeriksa status freeze sebelum memposting stock_movement.** Penjualan/penerimaan bersamaan selama hitung fisik berjalan tanpa hambatan, diam-diam membatalkan validitas hitungan tanpa terdeteksi |
| 5 | Ekspor XLSX | **CONFIRMED mekanisme, PARTIAL cakupan** | Nyata untuk tab Harga; tab Stok hanya ekspor kode/nama/status, tanpa kuantitas (konsisten dengan gap #1) |
| 6 | Laporan PDF / cetak opname | **CONFIRMED mekanisme snapshot, GAP data** | Mekanisme frozen-snapshot benar, TAPI laporan `/reports/stock-opname/snapshot` (layar 10) membaca dari `legacy_stock_opname` — tabel yang **hanya diisi CLI import sekali-jalan**, BUKAN dari siklus freeze→count→approve→post yang nyata. Pola yang sama persis dengan temuan AP/AR: mekanisme benar, sumber data tidak pernah disambungkan ke transaksi live |
| 7 | Persetujuan buku harga | **PARTIAL** | Alur nyata, TAPI **tidak ada blok persetujuan-sendiri** — berbeda dari SETIAP pola persetujuan lain di codebase ini (void POS, refund POS, tutup shift semuanya blok self-approval). Siapa pun dengan permission UPDATE dapat mengajukan lalu langsung menyetujui perubahan harganya sendiri |
| 8 | Pola luring Flutter (opname) | **GAP, lebih buruk dari bug checkout POS** | **Tidak ada idempotency key, tidak ada penyimpanan lokal sama sekali** — bukan cuma regenerasi key seperti checkout POS, tapi benar-benar tanpa key/antrean. Kontras tajam dengan `createOrder` (order sales mobile) di FILE YANG SAMA yang memakai pola benar. Sambungan terputus saat freeze/hitung/setuju/posting di lapangan = hilang total tanpa jalan retry |

## Layar 11-19 — Harga

| # | Klaim | Status | Ringkas |
|---|---|---|---|
| 1 | Baca riwayat harga | **CONFIRMED** | Query nyata dengan pencarian; baris hidup dari perbaikan Purchase/Sales sesi ini **terbukti muncul dengan benar** di sini |
| 2 | `price_book` vs `legacy_price_history` | **CONFIRMED terpisah, tidak terhubung** | Dua sistem harga independen, tidak ada kode yang merekonsiliasi keduanya — bahkan UI Web menampilkannya sebagai dua daftar terpisah di tab yang sama |
| 3 | Pencarian layar 12 | **CONFIRMED** | Bukan hanya lookup ID |
| 4 | Ekspor Excel (layar 14) | **GAP relatif terhadap klaim katalog** | Kode XLSX nyata ADA, tapi mengekspor query harga LIVE, BUKAN payload snapshot beku yang disebut katalog. Endpoint `/reports/stock-list/snapshot` yang didokumentasikan **tidak pernah dipanggil satu pun kode frontend** (nol hit di seluruh Web dan Flutter) |
| 5 | Snapshot cetak (layar 13,15,16) | **CONFIRMED mekanisme, GAP integrasi** | Backend benar (beku, tidak dihitung ulang) — TAPI tidak terjangkau: tidak ada frontend yang pernah memanggilnya untuk kode laporan harga/stok. Hanya `gross-profit`/`profit-loss` yang pernah dipanggil |
| 6 | Persetujuan buku harga (17-19) | **CONFIRMED nyata, server-enforced** | (Detail self-approval gap ada di tabel 08-10 di atas — temuan yang sama, ditemukan dua agent independen) |
| 7 | **Harga historis dipakai memberi harga transaksi live?** | **GAP signifikan** | `legacy_price_history` murni tulis-dan-laporkan — **tidak pernah dikonsultasikan untuk menentukan harga transaksi apa pun.** POS memakai `price_book` (sistem terpisah) untuk kuotasi; sales order dan purchase order TIDAK memakai keduanya — hanya memakai apa pun yang diketik pengguna atau `product.default_sale_price` sebagai fallback |

## Pola yang berulang, layak dicatat eksplisit

Tiga domain terpisah, tiga agent independen, menemukan **pola yang sama persis dua kali**:
1. **"Mekanisme benar, sumber data legacy-only"**: laporan opname (layar 10) DAN — dari audit
   sebelumnya — AP/AR, sama-sama punya infrastruktur snapshot/pelunasan yang benar tapi menunjuk
   ke tabel yang hanya diisi CLI import, bukan transaksi live.
2. **"Tidak ada blok self-approval"**: persetujuan buku harga adalah SATU-SATUNYA alur persetujuan
   di seluruh codebase ini yang ditemukan TIDAK memblokir penyetuju yang sama dengan pengaju —
   setiap pola lain (void POS, refund, tutup shift, dan gate approval baris yang baru diperbaiki
   sesi ini) secara konsisten menegakkannya.
3. **Endpoint terdokumentasi yatim**: `/stock/balances` (path yang salah, tidak ada), dan
   `/reports/stock-list/snapshot`/`/reports/price-sale/snapshot` (path benar, tapi nol pemanggil
   frontend) — katalog parity mengklaim OPERATIONAL untuk endpoint yang secara harfiah tidak
   pernah dipanggil siapa pun.

## Dampak terhadap requirement ledger

Detail lengkap ada di `05-requirement-ledger-48.md`. Ringkasan: layar 01-07 dinaikkan ke
`CONFIRMED sebagian besar` (dengan catatan masking bank); layar 08-10 dan 11-19 tetap `PARTIAL`
dengan gap spesifik dicatat per layar, bukan blanket "PARTIAL" tanpa rincian.
