-- =========================================================================
-- V028 — NOMOR STRUK BOLEH KOSONG SELAMA TRANSAKSI BELUM SELESAI
-- =========================================================================
--
-- `pos_sale.receipt_number` semula NOT NULL. Itu benar bila setiap baris
-- `pos_sale` adalah transaksi yang sudah terjadi, tetapi jalur kasir menyimpan
-- keranjang sebagai baris `pos_sale` berstatus DRAFT jauh sebelum ada struk.
--
-- Dua jalan keluar, dan yang satu lebih buruk daripada kelihatannya:
--
-- 1. Menerbitkan nomor struk saat keranjang dibuka. Setiap keranjang yang
--    ditinggalkan — pembeli berubah pikiran, kasir salah pindai — akan memakan
--    satu nomor. Deret nomor struk pun berlubang, dan lubang pada deret nomor
--    struk adalah hal pertama yang ditanyakan pemeriksa pajak. Menjelaskan
--    "itu keranjang yang batal" untuk setiap lubang bukan percakapan yang
--    ingin dialami penyewa mana pun.
--
-- 2. Menerbitkan nomor hanya saat transaksi benar-benar selesai, dan
--    membiarkan kolomnya kosong sebelum itu. Dipilih.
--
-- Keunikannya tetap dijaga indeks unik parsial yang dipasang V024, yang
-- memang sudah mengecualikan nilai kosong.
--
-- Melonggarkan NOT NULL tidak pernah membatalkan baris yang sudah ada, jadi
-- migrasi ini aman dijalankan pada skema yang sudah berisi data.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale
  ALTER COLUMN receipt_number DROP NOT NULL;

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".pos_sale.receipt_number IS
  'Nomor struk. Kosong selama transaksi belum selesai; diterbitkan pada batas penyelesaian agar keranjang yang batal tidak memakan nomor dan deretnya tidak berlubang.';
