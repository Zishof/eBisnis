-- =========================================================================
-- V017 — KAPASITAS PELAKU PADA JEJAK AUDIT
--
-- `audit_event` sudah mencatat SIAPA yang berbuat sejak skema pertama. Yang
-- belum dijawabnya: **dalam kapasitas apa**.
--
-- Sejak V10-4 seseorang yang memegang beberapa peran dapat memilih satu peran
-- untuk dipakai. Tanpa kolom ini, menjawab "apakah persetujuan ini dibuat
-- sebagai Bendahara atau sebagai Buyer" menuntut penelusuran silang ke
-- `platform_role_switch_log` — mencari pergantian terakhir sebelum waktu
-- kejadian, untuk setiap baris audit, satu per satu. Jawaban yang menuntut
-- kerja seperti itu tidak akan pernah benar-benar dicari.
--
-- Kolomnya boleh kosong, dan kosong punya arti sendiri: pelakunya belum
-- memilih peran, sehingga bertindak dengan gabungan seluruh perannya.
--
-- Additive dan nullable. Baris audit lama tidak diubah — memang tidak boleh:
-- skema audit bersifat append-only, dan mengisi mundur kolom ini berarti
-- mengarang kapasitas yang tidak pernah tercatat.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}__audit".audit_event
  ADD COLUMN IF NOT EXISTS active_role_code VARCHAR(64);

COMMENT ON COLUMN "{{TENANT_SCHEMA}}__audit".audit_event.active_role_code IS
  'Peran yang sedang dipakai pelaku saat peristiwa terjadi. NULL berarti pelaku '
  'belum memilih peran dan bertindak dengan gabungan seluruh perannya. Kosong '
  'pada baris yang ditulis sebelum V017 — tidak diisi mundur karena kapasitas '
  'yang tidak tercatat tidak boleh dikarang.';

-- Menjawab "siapa saja yang bertindak sebagai peran ini".
CREATE INDEX IF NOT EXISTS idx_audit_event_active_role
  ON "{{TENANT_SCHEMA}}__audit".audit_event (active_role_code, occurred_at DESC)
  WHERE active_role_code IS NOT NULL;
