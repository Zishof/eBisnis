-- =========================================================================
-- H041 — PERBAIKAN: KEBIJAKAN PENYAMARAN BAGI FASILITAS YANG LAHIR KEMUDIAN
-- =========================================================================
--
-- Fase H-9K. Aditif seluruhnya; H040 tidak disunting.
--
-- ## Cacat yang diperbaiki
--
-- H040 menyemai `investor_disclosure_policy` bagi setiap fasilitas yang ada
-- **pada saat migrasinya dijalankan**. Komentarnya sendiri menyebutkan
-- alasannya:
--
-- > "Fasilitas tanpa baris kebijakan akan memakai ambang apa pun yang kebetulan
-- > dipilih kode pemanggilnya, dan yang kebetulan dipilih selalu berakhir nol."
--
-- Dan justru itulah yang terjadi pada fasilitas yang **dibuat sesudahnya** —
-- yakni setiap rumah sakit yang bergabung mulai besok. Ia tidak punya baris
-- kebijakan, layanan membacanya sebagai "tidak ada", lalu memakai nilai bawaan
-- yang tertulis pada kodenya.
--
-- Nilai bawaan itu kebetulan benar hari ini. Ia tidak dijaga apa pun: tidak ada
-- constraint yang memeriksanya, tidak ada uji yang menangkap perubahannya, dan
-- orang yang mengubahnya kelak tidak akan tahu bahwa ia sedang mengubah ambang
-- penyamaran seluruh fasilitas yang belum berkebijakan.
--
-- Lebih buruk lagi, cacat ini **membuat penjaga basis datanya diam**:
-- constraint `investor_policy_cohort_not_zero` menjaga baris yang ada, dan
-- fasilitas yang tidak punya baris tidak dijaganya sama sekali.
--
-- ## Perbaikannya
--
-- Bukan memperbaiki nilai bawaannya, melainkan **meniadakan keadaan "tanpa
-- baris"**. Trigger menyemai kebijakan pada saat fasilitas dibuat, sehingga
-- pertanyaan "ambang mana yang berlaku bila belum ada kebijakan" tidak pernah
-- perlu dijawab siapa pun.
--
-- Nilai bawaan pada kode tetap ada sebagai jaring pengaman, tetapi ia kini
-- jaring yang tidak pernah tersentuh.

-- ---------------------------------------------------------------------------
-- Menyusul yang sudah terlanjur
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".investor_disclosure_policy (facility_id, minimum_cohort)
SELECT f.id, 5
  FROM "{{TENANT_SCHEMA}}".health_facility f
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".investor_disclosure_policy p WHERE p.facility_id = f.id
 );

-- ---------------------------------------------------------------------------
-- Meniadakan keadaan "tanpa baris"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".seed_investor_disclosure_policy()
RETURNS TRIGGER AS $$
BEGIN
  /*
   * Ambang lima, sama dengan bawaan pada kode.
   *
   * Yang penting bukan angkanya, melainkan bahwa ia ADA. Fasilitas tanpa baris
   * kebijakan tidak dijaga constraint mana pun — dan penjaga yang diam adalah
   * penjaga yang tidak ada.
   */
  INSERT INTO "{{TENANT_SCHEMA}}".investor_disclosure_policy (facility_id, minimum_cohort)
  VALUES (NEW.id, 5)
  ON CONFLICT (facility_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_investor_policy ON "{{TENANT_SCHEMA}}".health_facility;
CREATE TRIGGER trg_seed_investor_policy
  AFTER INSERT ON "{{TENANT_SCHEMA}}".health_facility
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".seed_investor_disclosure_policy();
