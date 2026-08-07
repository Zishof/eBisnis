-- =========================================================================
-- V053 — JEMBATAN PEMBELIAN KE HUTANG DAGANG (AP)
-- =========================================================================
--
-- Menutup celah: penerimaan barang yang divalidasi (`validateGoodsReceipt`)
-- memotong stok tetapi tidak pernah menghasilkan dokumen hutang dagang,
-- riwayat harga beli, atau peristiwa akuntansi. Lihat
-- docs/pos-inventory-parity/08-purchase-sales-bridge-findings.md untuk bukti
-- lengkapnya.
--
-- `legacy_payable_ledger` dan `legacy_price_history` (V045) SENGAJA dipakai
-- ulang, bukan dibuatkan tabel baru: keduanya sudah menjadi sumber baris
-- yang benar-benar dibaca layar hutang dagang (21-27), riwayat harga beli
-- (11/18), dan mesin pelunasan `inventory_ap_payment` (V047) yang sudah
-- teruji lewat FK `payable_ledger_id`. Tabel modern kedua berarti
-- menduplikasi seluruh mesin pelunasan itu.
--
-- Baris hasil transaksi baru dibedakan dari hasil impor DBF lewat
-- `source_file = 'LIVE:PURCHASING'` (tidak mungkin bertabrakan dengan nama
-- berkas DBF sungguhan seperti `Tran_Hut.DBF`) dan `metadata->>'origin'`,
-- bukan lewat kolom baru — sehingga indeks unik yang sudah ada
-- (`ux_legacy_payable_ledger`, `ux_legacy_price_history`, keduanya atas
-- `(source_file, legacy_row_number)`) tetap menjaga keduanya tanpa
-- perubahan skema. Sequence di bawah menjamin `legacy_row_number` yang unik
-- untuk baris hidup ini tanpa mengganggu penomoran baris impor DBF, yang
-- diberi nomornya sendiri oleh `LegacyRow.rowNumber` pada CLI import.
-- =========================================================================

CREATE SEQUENCE IF NOT EXISTS "{{TENANT_SCHEMA}}".live_payable_ledger_seq;
CREATE SEQUENCE IF NOT EXISTS "{{TENANT_SCHEMA}}".live_price_history_seq;
