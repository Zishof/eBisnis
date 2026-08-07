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
| 01-07 | Master supplier/customer/sales | MASTER | OPERATIONAL/OPERATIONAL | UNKNOWN | CHANGELOG Wave 0-1 mengklaim CRUD, audit, PDF/Excel, offline queue — belum diverifikasi mendalam |
| 08-19 | Stok/opname/harga | STOCK_PRICE | OPERATIONAL/OPERATIONAL | UNKNOWN | CHANGELOG Wave 2 mengklaim siklus opname penuh + ekspor — belum diverifikasi mendalam |
| 20 | Proses pembelian | PURCHASE_AP | OPERATIONAL/OPERATIONAL | **FIXED (source-only, 2026-08-08)** | PO→GR→stok+batch tetap CONFIRMED. `validateGoodsReceipt` sekarang juga menghasilkan baris `legacy_payable_ledger` (AP+jatuh tempo), `legacy_price_history` (riwayat harga beli), dan peristiwa akuntansi `PURCHASE_GOODS_RECEIPT_VALUED`. Lint/build/test lulus; BELUM diuji terhadap PostgreSQL sungguhan. Lihat `decisions/purchase-legacy-to-modern.md` |
| 21-27 | Hutang dagang/pembayaran/analisis | PURCHASE_AP | OPERATIONAL/OPERATIONAL | **PARTIAL, membaik** | Mekanisme settlement AP (`/ap/payments`, aging) sudah CONFIRMED bekerja; sekarang punya baris hidup untuk diproses (bukan cuma hasil impor) berkat perbaikan layar 20. Belum diverifikasi end-to-end dengan DB sungguhan bahwa `/ap/payments` benar-benar dapat melunasi baris baru ini |
| 28-29 | Cetak faktur/laporan pembelian | PURCHASE_AP | OPERATIONAL/OPERATIONAL | **PARTIAL, membaik** | Snapshot cetak (CONFIRMED) sekarang punya data AP hidup untuk ditampilkan, bukan hanya data impor |
| 30 | Menu penjualan | SALES_AR | OPERATIONAL/OPERATIONAL | **PARTIAL** | Terverifikasi 2026-08-08: sales_order tercipta idempoten (CONFIRMED), tapi TIDAK PERNAH "jadi invoice" — status tidak pernah berubah dari CONFIRMED, tidak ada potong stok |
| 31-38, 41-42 | Piutang/analisis piutang | SALES_AR | OPERATIONAL/OPERATIONAL | **BROKEN untuk transaksi baru** | Sama seperti AP: mekanisme settlement bekerja tapi hanya untuk baris hasil import legacy |
| 39-40 | Nota sales | SALES_AR | OPERATIONAL/OPERATIONAL | **PARTIAL** | State machine ada tapi lebih datar dari spesifikasi (tidak ada AVAILABLE/ASSIGNED/PARTIALLY_COLLECTED/RECONCILED terpisah), dan sumber datanya terputus dari sales_order live |
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
