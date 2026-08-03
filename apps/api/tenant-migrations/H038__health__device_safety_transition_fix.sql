-- =========================================================================
-- H038 — PERBAIKAN: KEADAAN vs PERALIHAN PADA UJI KESELAMATAN LISTRIK
-- =========================================================================
--
-- Fase H-9J. Aditif seluruhnya; H035 tidak disunting — checksum melindungi
-- migrasi yang sudah diterapkan.
--
-- ## Cacat yang diperbaiki
--
-- H035 memasang constraint `medical_device_failed_safety_not_active`:
--
-- ```sql
-- CHECK (safety_inspection_failed = FALSE OR status <> 'ACTIVE')
-- ```
--
-- Maksudnya benar: alat yang uji keselamatan listriknya gagal tidak boleh
-- melayani pasien. Yang ditulisnya keliru, dan kekeliruannya justru berbahaya.
--
-- Constraint itu memeriksa **keadaan**, padahal yang hendak dijaga adalah
-- **peralihan**. Akibatnya: teknisi yang menguji alat yang sedang ACTIVE — yakni
-- keadaan seluruh alat yang dipakai sehari-hari — dan menemukan arus bocornya
-- melampaui ambang, **tidak dapat mencatat temuannya sama sekali**. Barisnya
-- ditolak basis data. Alat yang berbahaya tetap ACTIVE, dan satu-satunya
-- catatan tentang bahayanya tidak pernah tersimpan.
--
-- Ini kelas cacat yang sudah muncul pada H-9: penjaga yang dipasang untuk
-- melindungi justru mengunci jalan yang menuju perlindungan itu. Di sana,
-- kekurangan "diagnosis belum berkode" menahan pengkodean, sehingga berkasnya
-- tidak akan pernah berkode. Di sini, penanda "uji keselamatan gagal" menahan
-- dirinya sendiri dicatat.
--
-- ## Perbaikannya
--
-- Yang dijaga adalah peralihan MASUK ke pelayanan, bukan keberadaan di
-- dalamnya:
--
-- ```text
-- ACTIVE  --uji gagal-->  ACTIVE + bertanda     BOLEH  (temuannya tercatat)
-- MAINTENANCE + bertanda  --> ACTIVE            TIDAK  (alat masuk kembali)
-- ```
--
-- Alat yang sudah menyala dan sedang dipakai pasien tidak dihentikan basis
-- data — sebagaimana seluruh H-9J: yang tahu apakah alat itu sedang menopang
-- seseorang bukan basis data, melainkan orang yang berdiri di sebelahnya.
-- Tanda bahayanya tercatat, tampak pada papan, dan menahan alat itu ketika
-- seseorang mencoba mengembalikannya ke pelayanan.

-- ---------------------------------------------------------------------------
-- Membuang constraint keadaan
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".medical_device
  DROP CONSTRAINT IF EXISTS medical_device_failed_safety_not_active;

-- ---------------------------------------------------------------------------
-- Menjaga peralihannya
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_unsafe_device_activation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.safety_inspection_failed = TRUE
     AND NEW.status = 'ACTIVE'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ACTIVE')
  THEN
    RAISE EXCEPTION
      'DEVICE_SAFETY_FAILED: alat dengan uji keselamatan listrik yang GAGAL tidak dapat '
      'dikembalikan ke pelayanan. Kalibrasi yang lewat berarti hasilnya mungkin menyimpang; '
      'uji listrik yang gagal berarti alatnya mungkin menyetrum orang yang menyentuhnya.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_unsafe_activation ON "{{TENANT_SCHEMA}}".medical_device;
CREATE TRIGGER trg_device_unsafe_activation
  BEFORE INSERT OR UPDATE ON "{{TENANT_SCHEMA}}".medical_device
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_unsafe_device_activation();
