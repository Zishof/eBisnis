# Kontrak Cakupan Sales / Inventory

Tanggal audit: 2026-08-05

## Sumber Kebenaran

- `MASTER_PROMPT_CLAUDE_CODEX_REDEVELOPMENT_SALES_INVENTORY.md`
  - SHA-256: `644B2E6498FD4B65F5299366C4FF207E7FF798364291667D33FB3555ED2EDBAE`
- `User_Manual_Sales_Inventory_Komprehensif.pdf`
  - SHA-256: `4CF1D72B591FF2EB0429140526F0311624E29BBD0B58B411B6D9E600FF7A12E7`
- `Matriks_Paritas_48_Layar.csv`: 48 baris, nomor 1 sampai 48.

Daftar layar di API berasal dari `sales-inventory-parity.catalog.ts`. Status
tersebut ditampilkan apa adanya di Web dan Flutter. Sebuah judul menu atau teks
fitur tidak boleh menaikkan status menjadi operasional.

Hasil kontrak saat audit ini:

- Web: 16 operasional, 32 baca-saja, 0 kontrak-saja.
- Flutter Windows/Android: 5 operasional, 8 baca-saja, 35 kontrak-saja.

Angka ini sengaja tidak dibulatkan menjadi 48/48. Endpoint atau tabel tanpa
alur pengguna, cetak nyata, pengujian, dan bukti UAT belum dianggap selesai.

## Status yang Dapat Dibuktikan

### Backend bersama

- Kontrak paritas 48 layar dan ringkasan per permukaan.
- Import legacy idempoten serta raw vault/reconciliation yang sudah ada.
- Pembayaran hutang dan penerimaan piutang dengan allocation, idempotency key
  saat pembuatan, validasi saldo terbuka saat posting, reversal, serta
  rekalkulasi status settled.
- Serah-terima nota sales dengan status draft, handed-over, returned, dan closed.
- Stock opname dengan snapshot stok, hitung fisik, freeze, approval, posting,
  dan immutable stock movement.
- Preview/snapshot laporan, hash payload, serta print/export log.
- Registrasi perangkat dan daftar konflik sinkronisasi.
- Laporan supplier, customer, stok, opname, harga jual/beli, pembelian, AP/AR,
  aging, nota sales, laba kotor, dan laba/rugi.

### Web

- Dasbor dan rekonsiliasi legacy.
- Daftar supplier, customer, sales, produk/stok, batch-expiry, harga historis,
  pembelian, penjualan, hutang, piutang, kas/jurnal, dan laba-rugi.
- Pencarian, filter, tabel responsif, dan ekspor pada workspace Inventory Control.
- Pembayaran penuh hutang, penerimaan penuh piutang, serta serah-terima nota.
- Cakupan 48 layar ditampilkan dengan status operasional/baca saja/kontrak.

### Flutter Windows dan Android

- Login tenant, dasbor pemilik/sales/admin, katalog, entry order sales, laporan,
  dan manual publik.
- Pembayaran penuh hutang untuk role non-sales.
- Penerimaan penuh piutang, membawa nota, pengembalian, dan penutupan nota.
- Kontrak 48 layar dibaca dari API; gap tidak ditutup dengan data demo palsu.
- Satu codebase dibuild untuk Windows dan Android.

## Gap yang Tetap Terbuka

Status berikut tidak boleh disebut selesai sebelum bukti implementasi dan UAT
tersedia:

- Flutter belum memakai Drift/SQLite untuk local database, outbox, inbox,
  bootstrap chunked, delta pull, background retry, dan conflict recovery.
- Flutter belum menyediakan CRUD penuh supplier/customer/product/sales, workflow
  pembelian, stock opname, harga khusus, jurnal, dan tutup periode.
- Web belum menyediakan seluruh command create/edit/deactivate, reversal/void,
  approval harga, jurnal posting/reversal, dan period close/reopen dari satu
  workspace Inventory Control.
- Snapshot laporan masih JSON yang immutable; renderer PDF/Excel, download,
  nomor dokumen, watermark reprint, dan antrean print lintas perangkat belum
  lengkap untuk seluruh report.
- Belum ada bukti E2E 48 layar untuk Web, Windows, dan Android, termasuk network
  chaos, app restart, disk full, clock drift, permission denied, dan konflik.
- Rekonsiliasi 28 DBF harus mencapai control total yang disetujui. Setiap orphan,
  deleted record, duplikat, encoding rusak, dan selisih nilai wajib memiliki
  exception/approval; jumlah tabel atau baris saja tidak cukup.
- Security review, field-level authorization, performance baseline, pilot,
  printer validation, UAT sign-off, dan rollback drill masih diperlukan.

## Gerbang Selesai

Setiap baris matriks baru boleh menjadi `OPERATIONAL` ketika domain rule,
constraint database, API, UI permukaan terkait, permission, audit, retry/offline
bila relevan, report/export, migration mapping, automated test, dan bukti UAT
telah tersedia. Jika salah satu belum ada, status tetap `READ_ONLY` atau
`CONTRACT_ONLY`.
