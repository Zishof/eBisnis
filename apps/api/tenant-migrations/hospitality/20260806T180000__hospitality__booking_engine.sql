-- =========================================================================
-- MitraInap (Hospitality) — MI-9: Direct Booking Engine
-- =========================================================================
--
-- Satu kolom: `published_rate_amount` pada `hospitality_room_type`.
--
-- MI-10 (Rate/Revenue Management) BELUM ada -- tidak ada rate plan, tidak
-- ada kalender harga, tidak ada BAR/derived rate. Booking engine publik
-- (pengunjung TANPA staf yang membantu) tetap butuh SATU angka untuk
-- ditampilkan sebelum pengunjung memesan -- tarif per malam yang
-- dipublikasikan staf secara manual, mirip `rate_amount` manual pada
-- MI-8, hanya di sini levelnya tipe kamar (berlaku bawaan), bukan per
-- reservasi.
--
-- NULL berarti tipe kamar itu TIDAK BOLEH muncul di hasil pencarian
-- publik -- staf belum menetapkan tarifnya. Ini bukan tabel rate plan;
-- begitu MI-10 membangun rate plan sungguhan (musiman, hari kerja/akhir
-- pekan, BAR, dst.), kolom inilah yang akan digantikan sumbernya, bukan
-- mekanisme "satu angka tarif berlaku" yang dibangun sekarang.
--
-- ## Mengapa booking engine publik BELUM bisa dijangkau lewat subdomain
-- properti
--
-- MI-3 (Tenant Website, Subdomain, Custom Domain) masih DIBLOKIR --
-- belum ada satu pun penyewa hospitality yang benar-benar di-provision,
-- jadi tidak ada `publicTenantSlug`/`vertical_site_domain` untuk
-- di-resolve dari host permintaan (pola `PublicTenantResolver` yang
-- dipakai `pesantren-public.service.ts`). Endpoint publik MI-9 karena
-- itu menerima `schemaName` secara eksplisit pada jalur URL --
-- mekanisme transaksi (pencarian, validasi, pemesanan, konfirmasi)
-- SUDAH nyata dan teruji; yang menyusul MI-3 hanyalah CARA pengunjung
-- tiba di URL yang benar (subdomain, bukan schemaName telanjang), bukan
-- transaksinya sendiri.

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_type
  ADD COLUMN published_rate_amount NUMERIC(14, 2);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_type
  ADD CONSTRAINT ck_hospitality_room_type_published_rate
  CHECK (published_rate_amount IS NULL OR published_rate_amount >= 0);
