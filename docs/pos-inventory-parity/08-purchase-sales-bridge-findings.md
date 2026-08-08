# 08. Purchase→AP and Sales Order→AR Bridge — Verification Findings

**Metode audit awal:** pembacaan kode langsung sebelum database lokal tersedia, mengikuti
pertanyaan wajib POS-7.1/POS-7.2 dokumen perintah: buktikan satu transaksi menghasilkan seluruh
rangkaian efek yang dituntut, bukan hanya "route-nya ada".

> **Status koreksi 2026-08-08:** temuan keterputusan di bawah adalah baseline historis yang telah
> memicu implementasi bridge. Kondisi aktual berbeda: validasi GR menulis AP/riwayat harga/event;
> invoice sales menulis stok/AR/riwayat harga/event; worker mem-posting event ke jurnal seimbang.
> Layar 39-40 juga sudah terbukti membaca AR live tersebut; `V062` memberi timeline custody
> append-only yang immutable untuk seluruh transisi. PostgreSQL smoke, POS E2E, dan
> pengujian transaksional rollback tersedia di `00-repository-baseline.md`. Bagian historis tetap
> dipertahankan agar alasan perubahan dapat diaudit, bukan sebagai klaim keadaan source terkini.

## Temuan inti: pola yang sama berulang di DUA domain

Ada **satu CLI import sekali-jalan** (`apps/api/src/cli/onboard-cmn-inventory.cli.ts`) yang mengisi
tabel-tabel berbentuk "legacy" (`legacy_payable_ledger`, `legacy_receivable_ledger`,
`legacy_price_history`, `supplier_invoice`) dari data migrasi DBF/legacy. Layar-layar pelaporan
(11-19, 20-29, 30-42) dibangun untuk MEMBACA dari tabel-tabel berbentuk legacy ini. Tetapi alur
transaksi BARU yang sebenarnya dipakai pengguna hari ini — `purchase_order`/`goods_receipt` untuk
pembelian, `sales_order` untuk penjualan — menulis ke tabel MODERN yang **terpisah**, dan tidak
pernah disambungkan untuk ikut mengisi tabel legacy yang dibaca layar pelaporan.

Akibatnya: katalog self-report `sales-inventory-parity.catalog.ts` menandai `OPERATIONAL` karena
**data ada untuk ditampilkan** (diisi CLI import sekali-jalan), bukan karena **transaksi live
benar-benar menghasilkan data itu**. Ini persis peringatan dokumen perintah — dan persis pola yang
sudah ditemukan pada offline sync POS Flutter (backend matang, jalur nyata tidak tersambung) —
tetapi di sini dampaknya jauh lebih besar: bukan satu klien yang tidak tersambung, melainkan
**seluruh mesin akuntansi AP/AR/jurnal untuk transaksi baru tidak ada**.

## Purchase → AP (layar 20-29)

File: `apps/api/src/modules/tenant/erp-purchasing.service.ts` (1.774 baris).

| # | Rantai | Status | Bukti |
|---|---|---|---|
| 1 | PO header+baris | **CONFIRMED** | `:528-623`, audit `PURCHASE_ORDER_CREATED` |
| 2 | Goods receipt terpisah dari PO, retur sebagian didukung | **CONFIRMED** | `:713-894`, `:811`, `:1160-1174` |
| 3 | Batch/expiry tersambung nyata ke stock | **CONFIRMED** | `:828-845` → `lot_id` mengalir ke `stock_movement` `:1069-1088` |
| 4 | Stock movement immutable, bukan overwrite saldo | **CONFIRMED** | `:1004-1194`, `applyBalanceDelta` pakai `ON CONFLICT DO UPDATE` increment, reversal via counter-movement bukan delete |
| 5 | Riwayat harga beli supplier | **GAP** | `product_supplier.last_price` hanya dibaca, tidak pernah ditulis PO baru; `legacy_price_history` hanya diisi CLI import |
| 6 | **Dokumen AP + jatuh tempo** | **GAP — temuan penentu** | `supplier_invoice` (skema lengkap, `due_date`, `match_status` — `V005:453-470`) **tidak pernah di-INSERT kode live manapun**. Satu-satunya INSERT: CLI import `:1339-1348`. `settlementConfig('AP')` mengarah ke `legacy_payable_ledger`, juga hanya diisi CLI import `:1413` |
| 7 | Saldo supplier | **PARTIAL** | Mekanisme hitung+kurangi saat bayar BEKERJA (`:1650-1711`), tapi hanya untuk baris hasil import — PO/GR baru tidak pernah membuat baris untuk mekanisme ini |
| 8 | Jurnal akuntansi | **GAP** | Nol referensi jurnal di `erp-purchasing.service.ts`. `journal_entry` hanya bisa diisi manual lewat form umum `POST /inventory/journals` |
| 9 | Cetak faktur pembelian | **CONFIRMED** | Snapshot beku `inventory_report_snapshot`, sama seperti mekanisme yang sudah diverifikasi untuk POS |
| 10 | Audit | **CONFIRMED** | `this.audit.record(...)` nyata (Prisma insert) di setiap transisi PO/GR |

**Kesimpulan:** separuh pertama alur (PO → GR → stok) benar-benar bekerja dan solid. Tapi
menyelesaikan pembelian lewat layar 20-21 hari ini **tidak menghasilkan dokumen AP, tidak ada
jatuh tempo, tidak ada riwayat harga, tidak ada jurnal** — persis yang dilarang dokumen perintah:
"PO yang hanya menyimpan order belum memenuhi parity layar 20," hanya di sini masalahnya lebih
dalam lagi: bahkan GR yang sudah memotong stok pun tidak berlanjut ke AP.

## Sales Order → AR (layar 30-42)

File: `apps/api/src/modules/tenant/tenant.module.ts` (endpoint `POST /inventory/mobile-orders`,
`:1720-1839`).

| # | Rantai | Status | Bukti |
|---|---|---|---|
| 1 | Sales order header+baris, idempoten | **CONFIRMED** | `:1797-1818`, dedup `source_event_id` |
| 2 | Alokasi/potong stok saat "jadi invoice" | **GAP** | Tidak ada `stock_movement` yang pernah terkait `sales_order`. `sales_order.status` **tidak pernah di-UPDATE di manapun** — dibuat `CONFIRMED` lalu diam selamanya. Tidak ada operasi "convert to invoice" sama sekali |
| 3 | Snapshot batch/expiry | **GAP** | Tidak ada tabel lot/batch untuk sales sama sekali — konsekuensi wajar dari #2 |
| 4 | Riwayat harga jual customer | **PARTIAL/GAP** | `legacy_price_history` hanya diisi CLI import; order live menulis `unit_price` per baris tapi tidak pernah menambah riwayat |
| 5 | Snapshot penugasan sales | **GAP** | `sales_order` **tidak punya kolom `salesperson_id`** sama sekali (skema `V006:137-155`); atribusi hanya berasal dari `created_by` — device yang login, bukan sales yang ditugaskan |
| 6 | **Dokumen AR + jatuh tempo** | **GAP — temuan penentu** | Sama seperti AP: tidak ada kode live yang mengisi `legacy_receivable_ledger`. Satu-satunya INSERT: CLI import. Order mobile tidak pernah menghasilkan piutang |
| 7 | Snapshot HPP laba kotor | **PARTIAL, satu titik terang** | `legacy_unit_cost` DIBEKUKAN saat order dibuat (`:1817`, dari `product.standard_cost`) dan dipakai laporan GP — tidak drift bila cost produk berubah kemudian. Tapi sumbernya cost standar produk, bukan cost lot/batch aktual (konsekuensi #3) |
| 8 | Jurnal akuntansi | **GAP** | Sama seperti purchasing — tidak ada auto-posting dari order/AR |
| 9 | Pembayaran/pelunasan piutang | **CONFIRMED (mekanisme), untuk ledger yang terputus** | Idempoten nyata (`Idempotency-Key`, indeks unik `ux_inventory_ar_receipt_idempotency`), row lock `FOR UPDATE`, hitung ulang `is_settled` — tapi hanya beroperasi atas baris hasil import |
| 10 | Nota sales (layar 39-40) | **PARTIAL, lebih datar dari spesifikasi** | State machine 2 tingkat (header `DRAFT→HANDED_OVER→RETURNED→CLOSED`, baris `CARRIED→RETURNED/COLLECTED/LOST`) — TIDAK punya `AVAILABLE`/`ASSIGNED` sebelum handover, tidak ada `PARTIALLY_COLLECTED`, tidak ada `RECONCILED` terpisah dari `CLOSED`. Sumber barisnya juga dari `legacy_receivable_ledger`, mewarisi keterputusan yang sama |
| 11 | Cetak/audit | **PARTIAL** | Snapshot laporan beku bekerja; tidak ada snapshot cetak untuk dokumen invoice/AR itu sendiri (karena dokumennya sendiri tidak pernah tercipta). `createMobileInventoryOrder` juga TIDAK mengirim audit envelope (`auditOf`) seperti operasi AR/handover lain — hanya baris `inventory_sync_event` |

**Kesimpulan:** `sales_order` dan seluruh mesin AR/piutang/jurnal adalah **dua pulau yang
terputus**, disambungkan hanya oleh script CLI import/demo, bukan oleh kode aplikasi yang benar-benar
dipicu pengguna nyata.

## Dampak terhadap requirement ledger

Klaim `OPERATIONAL` pada `sales-inventory-parity.catalog.ts` untuk domain `PURCHASE_AP` (layar
20-29) dan `SALES_AR` (layar 30-42) **tidak dapat dipertahankan**. Status yang benar:

- Layar 20 (proses pembelian): **PARTIAL** — PO/GR/stok solid, AP/jurnal/riwayat harga tidak ada.
- Layar 21-27 (hutang dagang/pembayaran/analisis): **BROKEN untuk transaksi baru** — mekanismenya
  benar tapi tidak pernah menerima data dari pembelian baru, hanya dari import.
- Layar 30 (menu penjualan): **PARTIAL** — order tercipta, tapi tidak pernah "jadi invoice".
- Layar 31-38, 41-42 (piutang/analisis piutang): **BROKEN untuk transaksi baru**, sama seperti AP.
- Layar 39-40 (nota sales): **PARTIAL** — state machine lebih sederhana dari spesifikasi DAN
  sumber datanya terputus dari order live.

Ini **bukan** kesalahan implementasi yang salah — kode yang ADA (PO/GR, sales_order, mekanisme
settlement AP/AR) semuanya berkualitas baik dan diverifikasi bekerja untuk lingkupnya
masing-masing. Yang hilang adalah **jembatan** di antara keduanya: PO/GR yang selesai divalidasi
tidak pernah memicu pembuatan `supplier_invoice`, dan `sales_order` tidak pernah memicu potong
stok + pembuatan piutang + jurnal.

## Rekomendasi (perlu keputusan manusia sebelum implementasi)

Dokumen perintah secara eksplisit meminta dokumen keputusan terpisah untuk ini
(`docs/pos-inventory-parity/decisions/purchase-legacy-to-modern.md` dan
`sales-order-to-invoice.md`) sebelum mengimplementasikan jembatannya — bukan tanpa alasan.
Menyambungkan PO/GR ke AP dan `sales_order` ke AR berarti merancang:

1. Kapan tepatnya AP/AR tercipta (saat GR divalidasi? saat invoice diterima terpisah dari GR?
   saat order "dikonversi"? — pertanyaan bisnis, bukan teknis).
2. Bagaimana jurnal diposting otomatis tanpa duplikasi bila GR sebagian/dibalik, atau order
   dibatalkan setelah sebagian dikirim.
3. Bagaimana ini berinteraksi dengan data yang SUDAH ada dari CLI import (apakah keduanya hidup
   berdampingan per tanggal cutover, atau salah satu digantikan).

Ini adalah pekerjaan desain+implementasi bertingkat minggu, bukan tambalan cepat seperti perbaikan
gate approval sebelumnya — dan kesalahan di sini (jurnal salah posting, AP/AR dobel-hitung)
berdampak langsung ke laporan keuangan nyata. **Sengaja tidak diimplementasikan tergesa-gesa pada
sesi ini** tanpa arahan lebih lanjut mengenai prioritas dan urutan (mulai dari sisi Purchase/AP
dulu, atau Sales/AR dulu, atau merancang keduanya sekaligus sebelum menyentuh kode).
