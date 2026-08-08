# UAT — Layar 45 (Menu Laba/Rugi — Preview)

**Tenant uji:** `uat_finance_15643` (didaftarkan lewat `POST /public/registrations` khusus untuk pass UAT ini — bukan tenant produksi/demo siapa pun).
**Prasyarat:** ≥1 `sales_order` berstatus `INVOICED` pada periode uji, dengan event akuntansinya sudah diposting.

## Skenario

1. Buat sales order (`POST /inventory/mobile-orders`): customer CUST-007, produk FRIED-CHICKEN 10x @18000 (standard_cost 12000/unit). → order `MOB-20260808-tfinanceorder001`, grandTotal 180000.
2. Invoice order (`POST /sales/orders/:id/invoice`). → status INVOICED, `receivableLedgerId` terbentuk.

   **Gap ditemukan lewat langkah ini, DIPERBAIKI dalam sesi yang sama:** endpoint menegakkan `@Permissions('SALES_ORDER.INVOICE')`, tetapi aksi `INVOICE` tidak pernah tersemai ke katalog permission tenant manapun — tidak ada peran, termasuk Pemilik Usaha (`allModules`), yang bisa diberi izin ini. Endpoint ADA dan BEKERJA, tetapi tidak ada jalan sah memanggilnya. Ditutup dengan menambah aksi `INVOICE` ke `tenant-menu.seed.ts` (menu `SALES_ORDER`) dan menjalankan ulang `migrate:tenants` untuk menyemainya ke tenant yang sudah ada.
3. Proses event akuntansi (`POST /accounting-events/process-pending`, permission `FINANCE_JOURNAL.POST`). → 2 event (`SALES_ORDER_INVOICED`, `SALES_ORDER_COGS`) sama-sama `POSTED` ke `journal_entry` baru.
4. `POST /reports/gross-profit/preview` `{"asOfDate":"2026-08-09"}` → 1 baris, `revenue=180000`, `cogs=120000`, `gross_profit=60000`.
5. `POST /reports/profit-loss/preview` `{"asOfDate":"2026-08-09"}` → REVENUE `180000.0000`, EXPENSE (HPP) `120000.0000`, akun beban lain `0`.
6. Rekonsiliasi independen (SQL langsung ke `sales_order_line`/`product` untuk laba kotor; ke `journal_entry_line`/`chart_of_account`/`account_type` untuk laba rugi) — lihat `reconciliation.sql` dan `reconciliation.json`. **Selisih: 0** pada kedua laporan.

## Hasil

**PASS.** Angka preview API sama persis dengan hitungan independen dari sumber (sales_order_line dan journal_entry_line), dengan selisih nol pada kedua laporan. Ini adalah bukti end-to-end PERTAMA bahwa alur peristiwa-ke-jurnal (`AccountingPostingService`, ditambahkan dalam sesi kerja yang sama) benar-benar menghasilkan jurnal yang benar dari transaksi hidup — sebelumnya `buildJournalLines()` adalah fungsi murni tanpa pemanggil di seluruh codebase.

## Yang TIDAK dicakup pass ini

- Screenshot Web/Windows/Android tidak diambil (di luar cakupan waktu pass ini; API+SQL adalah bukti primer, tampilan adalah presentasi ulang angka yang sama).
- Skenario pajak, diskon, retur, dan multi-produk tidak diuji di pass ini — hanya satu baris sederhana untuk membuktikan pipa end-to-end bekerja.
