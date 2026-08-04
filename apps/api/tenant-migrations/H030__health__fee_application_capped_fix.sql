-- =========================================================================
-- H030 — PEMBETULAN CONSTRAINT PENANDA PEMBATASAN FEE
-- =========================================================================
--
-- Fase H-9G. Aditif; membetulkan satu constraint yang dipasang H028.
--
-- **Yang keliru.** `fee_application_capped_consistent` semula berbunyi:
--
-- ```sql
-- was_capped = (applied_percent < requested_percent)
-- ```
--
-- Ia menyamakan dua hal yang berbeda. "Persentase terpakai lebih kecil daripada
-- yang diminta" punya EMPAT sebab, dan hanya satu di antaranya pembatasan:
--
-- ```text
-- tidak ada kontraknya          -> terpakai 0, dan itu bukan pembatasan
-- kontrak belum/sudah lewat     -> terpakai 0, dan itu bukan pembatasan
-- layanannya dikecualikan       -> terpakai 0, dan itu bukan pembatasan
-- melampaui batas maksimum      -> terpakai = batas, DAN INI pembatasan
-- ```
--
-- Akibatnya setiap perhitungan tanpa kontrak — yaitu keadaan bawaan seluruh
-- fasilitas — ditolak basis data. Fee yang bawaannya NONE justru tidak dapat
-- dicatat sebagai nol.
--
-- **Pembetulannya.** Pembatasan MENGANDAIKAN pengurangan, tetapi pengurangan
-- tidak mengandaikan pembatasan. Constraint-nya menjadi satu arah saja.
--
-- H028 tidak disunting: ia sudah diterapkan, dan checksum-nya menjaga supaya
-- migrasi yang sudah berjalan tidak berubah diam-diam di belakang punggung
-- lingkungan lain.

ALTER TABLE "{{TENANT_SCHEMA}}".fee_contract_application
  DROP CONSTRAINT IF EXISTS fee_application_capped_consistent;

ALTER TABLE "{{TENANT_SCHEMA}}".fee_contract_application
  ADD CONSTRAINT fee_application_capped_implies_reduced
  CHECK (was_capped = FALSE OR applied_percent < requested_percent);
