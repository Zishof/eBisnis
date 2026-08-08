# Analisis Sesi — eBisnis Modul Inventory-Sales (Paritas 48 Layar)

**Tanggal:** 2026-08-08
**Workspace:** `C:\opt\eBisnis-Github\eBisnis`
**Sumber input:** PDF *Mapping 48 Layar Legacy ke UI Baru v3.0* + Paket Perintah POS Inventory (Paritas 48 Layar)
**Sifat dokumen:** catatan audit awal berbasis bukti source (bukan klaim DONE). Baseline `pnpm`/`flutter` belum dijalankan pada sesi ini.

---

## 1. Ringkasan eksekutif

Codebase eBisnis **jauh lebih matang** daripada hipotesis konservatif di paket perintah. Paket ditulis tanpa berhasil meng-clone repo penuh, sehingga menandai semua baris `AUDIT_REQUIRED`. Audit source aktual menunjukkan modul Inventory-Sales sudah terbangun end-to-end pada lapisan API, Web, dan Flutter, dengan katalog paritas 48 layar yang tertanam langsung di kode.

Temuan inti: bukan lagi "apakah dibangun" (mayoritas sudah), melainkan **"seberapa jujur status `OPERATIONAL` itu terbukti"**. Ditemukan bukti kuat bahwa lapisan API riil, Web & Flutter benar-benar memanggil endpoint yang sama, namun sebagian layar transaksi Flutter masih *contract-only* (ada fallback eksplisit "Kontrak ada, layar transaksi belum tersedia").

---

## 2. Arsitektur nyata (terverifikasi dari source)

Monorepo pnpm, satu domain core untuk tiga permukaan:

| Lapisan | Lokasi | Teknologi | Status audit |
|---|---|---|---|
| API | `apps/api/src/modules` | NestJS + Prisma + PostgreSQL, multi-tenant per-schema | Riil, ~190 query SQL di modul Inventory-Sales, nol placeholder |
| Web | `apps/web/src/pages/app` | React + Vite | `InventoryControlPage.tsx` (69 KB), 49 pemanggilan API |
| Windows + Android | `apps/pos-flutter/lib` | Flutter (satu basis), DB lokal Drift | `inventory/inventory_app.dart` (265 KB), offline read model |

Modul API relevan Inventory-Sales: `tenant/` (erp-inventory, erp-purchasing, sales-inventory-operations.controller, sales-inventory-parity.catalog, master-lifecycle, sales-events/purchasing-events catalog), `pos/`, `order/`, `checkout/`, `pricing/`, `accounting/`, `return/`, `catalog/`, `payment/`, `inventory-public/`, `fulfillment/`.

Prinsip yang WAJIB dipertahankan (dari rekomendasi + terkonfirmasi pola kode): schema tenant dari server (bukan request klien); harga/diskon/pajak/total dihitung server; `stock_movement` immutable, koreksi via reversal/adjustment; audit append-only; transaksi posted tidak dihapus; migration additive/reversible.

---

## 3. Ledger paritas 48 layar (berbasis bukti source)

Sumber kebenaran di kode: `apps/api/src/modules/tenant/sales-inventory-parity.catalog.ts`. Katalog itu meng-klaim `OPERATIONAL` untuk Web & Flutter pada 48/48 layar. Kolom **Bukti audit** di bawah adalah hasil verifikasi sesi ini terhadap wiring nyata (endpoint dipanggil oleh UI), BUKAN penerimaan klaim mentah.

| Fase | Layar | Domain | Endpoint API inti | Web wired | Flutter wired |
|---|---|---|---|---|---|
| P2 | 1–7 Master Supplier/Customer/Sales | MASTER | `/suppliers` `/customers` `/salespeople` `/inventory/party-master-balances/:kind` | Ya | Ya |
| P2 | 8 Stok Barang | STOCK | `/inventory/balances` `/inventory/mobile-catalog` | Ya | Ya |
| P2 | 9–10 Opname + cetak | STOCK | `/stock-opnames` (freeze/approve/post) `/reports/stock-opname/snapshot` | Ya | Ya |
| P2 | 11–19 Harga beli/jual, master harga, ekspor | STOCK_PRICE | `/inventory/price-books` `/inventory/legacy/price-history` `/reports/*/snapshot` | Ya | Ya |
| P3 | 20 Pembelian | PURCHASE_AP | `/purchase-orders` `/goods-receipts` | Ya | Ya |
| P3 | 21–27 Hutang + pembayaran + analisis | PURCHASE_AP | `/inventory/legacy/payables` `/ap/payments` (post/reverse) `/reports/ap-aging/snapshot` | Ya | Ya |
| P3 | 28–29 Cetak faktur/laporan pembelian | PURCHASE_AP | `/reports/purchase-invoice/snapshot` `/reports/purchase-register/snapshot` | Ya | Ya |
| P4 | 30 Penjualan | SALES_AR | `/inventory/mobile-orders` `/sales/orders` | Ya | Ya |
| P4 | 31–38 Piutang + penerimaan + analisis | SALES_AR | `/inventory/legacy/receivables` `/ar/receipts` (post/reverse) `/reports/ar-aging-*/snapshot` | Ya | Ya |
| P4 | 39–40 Nota sales + serah-terima | SALES_AR | `/sales-note-handovers` (handover/return/close/cancel) | Ya | Sebagian* |
| P4 | 41–42 Laporan piutang | SALES_AR | `/reports/ar-outstanding/snapshot` `/report-snapshots/:id` | Ya | Ya |
| P5 | 43–44 Kas/Jurnal + COA | FINANCE | `/inventory/finance-workspace` `/inventory/journals` (post/reverse) `/inventory/chart-accounts` | Ya | Ya |
| P5 | 45–48 Laba-Rugi (kotor + akuntansi) | FINANCE | `/reports/gross-profit/*` `/reports/profit-loss/*` `/report-snapshots/:id/print-log` | Ya | Ya |

\* **Temuan jujur:** `inventory_app.dart` memuat fallback `'Kontrak ada, layar transaksi belum tersedia.'` — sejumlah layar transaksi Flutter menampilkan status jujur ini alih-alih tombol semu. Perlu inventarisasi persis layar mana yang masih *contract-only* di Flutter.

---

## 4. Temuan kunci & risiko

1. **Klaim `OPERATIONAL` vs bukti DONE.** Katalog menandai 48/48 OPERATIONAL untuk kedua permukaan, tetapi DONE (menurut kontrak paket) mensyaratkan test+build+smoke+print/export+reconciliation+UAT. Belum ada bukti UAT tersimpan; baseline belum dijalankan sesi ini. Status jujur saat ini: **WIRED, belum PROVEN**.
2. **Flutter contract-only pada sebagian layar transaksi.** Perlu daftar tepatnya (grep semua kemunculan fallback + peta ke nomor layar).
3. **Documentation drift.** README Flutter (indikasi dari rekomendasi) masih menyebut kapabilitas "belum ada" padahal source-nya sudah ada. Dokumentasi harus direkonsiliasi dengan test nyata.
4. **File Flutter raksasa.** `inventory_app.dart` 265 KB dalam satu file → risiko maintainability. Rekomendasi paket: pecah feature-by-feature via facade + golden test, bukan big-bang refactor.
5. **Baseline belum terverifikasi.** Belum ada bukti `pnpm lint/test/build` dan `flutter analyze/test` hijau pada workspace ini.

---

## 5. Rekomendasi langkah (urutan aman)

**Langkah 0 — Baseline (belum bisa dari cloud, jalankan lokal):**
```
pnpm install --frozen-lockfile
pnpm db:validate && pnpm db:generate
pnpm lint && pnpm test && pnpm build
cd apps/pos-flutter && flutter pub get && flutter analyze && flutter test
```
Simpan output + exit code sebagai evidence baseline.

**Langkah 1 — Requirement ledger berbukti:** untuk tiap 48 layar, kutip file/fungsi/endpoint/test + commit SHA. Naikkan status hanya bila alur nyata (bukan daftar fitur).

**Langkah 2 — Tutup gap Flutter contract-only:** inventarisasi layar fallback, garap end-to-end (draft/attachment/posting + offline), golden test sebelum & sesudah.

**Langkah 3 — Rekonsiliasi dokumentasi:** update README Flutter berbasis test nyata.

**Langkah 4 — Vertical slice prioritas:** pilih satu alur (mis. Sales Order → invoice → stok → AR → jurnal) dan buktikan atomik + idempotent + print snapshot + reconciliation.

---

## 6. Batas audit sesi ini

Yang **sudah** diverifikasi: struktur monorepo; daftar modul API; isi `sales-inventory-parity.catalog.ts`; ~50 endpoint di `sales-inventory-operations.controller.ts`; wiring endpoint di `InventoryControlPage.tsx` (Web) dan `inventory_app.dart` (Flutter); tidak ada placeholder di modul `tenant/`.

Yang **belum** diverifikasi: baseline build/test/lint; migration & schema DB; per-layar UAT/print/reconciliation; peta persis layar contract-only Flutter; seluruh 105 halaman PDF & 4.715 baris master contract (baru dibaca Bagian I/POS-0..POS-5 + matriks + rekomendasi Bag. 1–4).
