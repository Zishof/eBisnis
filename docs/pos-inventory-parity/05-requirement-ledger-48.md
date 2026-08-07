# 05. Requirement Ledger — 48 Layar (seed awal, P0)

Status pada tabel ini adalah **status verifikasi P0**, bukan status implementasi. Kolom
"Self-report repo" dikutip langsung dari `sales-inventory-parity.catalog.ts` (kode produksi).
Kolom "Status verifikasi" memakai taksonomi wajib dokumen perintah
(`DONE/PARTIAL/MISSING/BROKEN/CONFLICTING/DEPRECATED/UNKNOWN/BLOCKED`) dan **tidak boleh disamakan**
dengan self-report sampai bukti POS-14 (test, build, smoke, print, reconciliation, UAT) diperiksa
per layar. Pada P0, seluruh 48 baris diberi `UNKNOWN` (belum diverifikasi individual) kecuali
dicatat lain di bawah — ini bukan penilaian negatif, melainkan pengakuan jujur bahwa verifikasi
mendalam per layar belum dilakukan pada pass ini.

| No | Layar legacy | Domain | Self-report repo (Web/Flutter) | Status verifikasi P0 | Catatan |
|---:|---|---|---|---|---|
| 01-06 | Master supplier/customer | MASTER | OPERATIONAL/OPERATIONAL | **PARTIAL, mayoritas CONFIRMED (2026-08-08)** | CRUD/audit/export/antrean luring semuanya CONFIRMED bekerja benar. **Masking data bank — FIXED (2026-08-08, source-only)**: penyamaran sungguhan sisi server ditambahkan (`MasterLifecycleService.samarkan()`, permission baru `VIEW_BANK_DETAILS`), bukan lagi kosmetik sisi klien. Filter saldo open/settled masih hanya bucketing sisi klien — belum dikerjakan. Lihat `09-master-stock-pricing-findings.md` |
| 07 | Data Sales/Penjual Keliling | MASTER | OPERATIONAL/OPERATIONAL | **PARTIAL** | CRUD sama seperti 01-06, TAPI tidak ada penegakan active/inactive untuk salesperson di alur transaksi manapun (berbeda dari supplier/customer yang sudah ditegakkan) |
| 08 | Data Stok Barang | STOCK_PRICE | OPERATIONAL/OPERATIONAL | **PARTIAL** | Endpoint `/stock/balances` yang diklaim katalog tidak ada; path nyata `/inventory/balances` tidak pernah dipanggil Web/Flutter. Layar Stok Web tidak menampilkan kuantitas live sama sekali |
| 09 | Laporan Opname | STOCK_PRICE | OPERATIONAL/OPERATIONAL | **PARTIAL** | Siklus freeze→count→approve→post CONFIRMED nyata dengan stock_movement immutable. TAPI freeze hanya label — tidak ada modul lain yang memeriksanya, penjualan/penerimaan bersamaan tidak terhambat |
| 10 | Mencetak Laporan Opname | STOCK_PRICE | OPERATIONAL/OPERATIONAL | **BROKEN untuk opname baru** | Mekanisme snapshot cetak benar, TAPI membaca dari `legacy_stock_opname` (hanya diisi CLI import) — pola sama persis dengan AP/AR sebelum diperbaiki: opname yang benar-benar dijalankan siklus barunya TIDAK PERNAH muncul di laporan cetak |
| 11-19 | Harga | STOCK_PRICE | OPERATIONAL/OPERATIONAL | **PARTIAL** | `price_book` (dipakai POS, approval real tapi TANPA blok self-approval — satu-satunya alur persetujuan di codebase ini yang begitu) dan `legacy_price_history` (baca/cari CONFIRMED, sekarang terisi transaksi live berkat perbaikan sesi ini) adalah DUA SISTEM TERPISAH tanpa rekonsiliasi. `legacy_price_history` tidak pernah dikonsultasikan untuk memberi harga transaksi apa pun — murni tulis-dan-laporkan. Ekspor Excel/cetak layar 13-16 mengandalkan endpoint snapshot yang TIDAK PERNAH dipanggil frontend manapun |
| 20 | Proses pembelian | PURCHASE_AP | OPERATIONAL/OPERATIONAL | **FIXED (source-only, 2026-08-08)** | PO→GR→stok+batch tetap CONFIRMED. `validateGoodsReceipt` sekarang juga menghasilkan baris `legacy_payable_ledger` (AP+jatuh tempo), `legacy_price_history` (riwayat harga beli), dan peristiwa akuntansi `PURCHASE_GOODS_RECEIPT_VALUED`. Lint/build/test lulus; BELUM diuji terhadap PostgreSQL sungguhan. Lihat `decisions/purchase-legacy-to-modern.md` |
| 21-27 | Hutang dagang/pembayaran/analisis | PURCHASE_AP | OPERATIONAL/OPERATIONAL | **PARTIAL, membaik** | Mekanisme settlement AP (`/ap/payments`, aging) sudah CONFIRMED bekerja; sekarang punya baris hidup untuk diproses (bukan cuma hasil impor) berkat perbaikan layar 20. Belum diverifikasi end-to-end dengan DB sungguhan bahwa `/ap/payments` benar-benar dapat melunasi baris baru ini |
| 28-29 | Cetak faktur/laporan pembelian | PURCHASE_AP | OPERATIONAL/OPERATIONAL | **PARTIAL, membaik** | Snapshot cetak (CONFIRMED) sekarang punya data AP hidup untuk ditampilkan, bukan hanya data impor |
| 30 | Menu penjualan | SALES_AR | OPERATIONAL/OPERATIONAL | **FIXED (source-only, 2026-08-08)** | Order tercipta tetap CONFIRMED. Ditambahkan `POST /sales/orders/:id/invoice`: memotong stok sisa, mengisi `delivered_qty`, mencatat riwayat harga jual, piutang+jatuh tempo, dan peristiwa akuntansi. Lint/build/test lulus; BELUM diuji terhadap PostgreSQL sungguhan. Lihat `decisions/sales-order-to-invoice.md` |
| 31-38, 41-42 | Piutang/analisis piutang | SALES_AR | OPERATIONAL/OPERATIONAL | **PARTIAL, membaik** | Mekanisme settlement AR (CONFIRMED) sekarang punya baris hidup untuk diproses berkat layar 30. Atribusi sales (37-38) dari `sales_order.created_by`, BUKAN snapshot penugasan sejati — `sales_order` tetap tidak punya kolom `salesperson_id` |
| 39-40 | Nota sales | SALES_AR | OPERATIONAL/OPERATIONAL | **PARTIAL, belum disentuh** | State machine tetap lebih datar dari spesifikasi. Belum diverifikasi apakah handover sekarang membaca baris AR hidup hasil layar 30 atau masih hanya baris import — perlu pass tersendiri |
| 43-48 | Kas/jurnal/laba-rugi | FINANCE | OPERATIONAL/OPERATIONAL | UNKNOWN, tapi ada sinyal kuat GAP | Belum diverifikasi langsung, tapi #20 dan #30 sama-sama membuktikan TIDAK ADA auto-posting jurnal dari pembelian/penjualan — jurnal hanya bisa dibuat manual. Laporan laba-rugi/kas kemungkinan hanya benar untuk data hasil import, bukan transaksi baru |

Rincian 48 baris individual (nama, API path, web route persis) — lihat
`apps/api/src/modules/tenant/sales-inventory-parity.catalog.ts` langsung; tidak diduplikasi di
sini agar tidak drift dari source saat catalog berubah.

## Blocker struktural terhadap verifikasi POS-14 penuh (berlaku ke SEMUA 48 baris)

Kriteria DONE POS-14 mensyaratkan build/smoke/e2e lulus dan perilaku Web+Windows+Android
teruji. Pada mesin audit ini:

- Web behavior: **bisa diverifikasi** via `pnpm test`/`pnpm build` (source-level) — sudah lulus,
  lihat `00-repository-baseline.md`. Verifikasi visual/E2E browser belum dilakukan pada pass ini.
- Windows/Android behavior: **BLOCKED** — Flutter SDK tidak terpasang, tidak bisa `flutter
  analyze/test/build windows/build apk`.
- Reconciliation/DB-dependent (`seed:verify`, `smoke-test.mjs`, `test:e2e`): **BLOCKED** — tidak
  ada PostgreSQL/Docker lokal.
- Print/hardware evidence: **BLOCKED** — tidak ada printer/perangkat fisik atau emulator terhubung
  pada sesi ini.
- UAT lama-vs-baru: **BLOCKED** — memerlukan keputusan bisnis dan akses pengguna operasional CMN,
  bukan sesuatu yang bisa dibuktikan dari source semata.

Setiap baris ledger yang menunggu langkah-langkah ini secara eksplisit ditandai `UNKNOWN` (bukan
`DONE` dan bukan `MISSING`) sampai bukti tersedia — sesuai instruksi eksplisit dokumen perintah
untuk tidak menebak.

## Rencana verifikasi berikutnya (butuh keputusan manusia sebelum lanjut penuh)

1. Sediakan PostgreSQL lokal + Flutter SDK pada mesin ini, ATAU
2. Lanjutkan audit source-only (baca detail `sales-inventory-operations.controller.ts` 2.139
   baris, plus widget/test Flutter yang ADA tanpa menjalankan build) untuk menaikkan status dari
   `UNKNOWN` ke `PARTIAL`/`STRONG_INFERENCE DONE` berdasarkan code review saja — masih belum
   `DONE` sejati tanpa build/run nyata, tapi jauh lebih informatif daripada `UNKNOWN`, ATAU
3. Fokuskan sesi berikutnya pada satu domain dulu (mis. hanya POS core P1 sesuai roadmap dokumen
   perintah sendiri: "Do not complete all frontend screens first and defer services") untuk
   verifikasi mendalam bertahap, bukan seluruh 48 layar sekaligus.
