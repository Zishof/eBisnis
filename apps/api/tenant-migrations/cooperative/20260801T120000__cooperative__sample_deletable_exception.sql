-- =============================================================================
-- Pengecualian penghapusan bagi data contoh
-- =============================================================================
--
-- ## Dua aturan yang benar, dan bertabrakan
--
-- K-5 dan K-9 melarang penghapusan pada empat tabel: suara, keputusan rapat,
-- pengaduan, dan tanggapannya. Alasannya kuat dan tetap berlaku — keputusan
-- RAT adalah dasar keabsahan pembagian SHU, dan pengaduan tidak boleh dapat
-- dihilangkan oleh orang yang isinya menegur dirinya.
--
-- Tetapi data contoh membentuk RAT lengkap beserta keputusannya, dan penyewa
-- harus dapat menghapusnya dengan satu tombol. Kedua aturan itu tidak dapat
-- berlaku sekaligus tanpa pengecualian.
--
-- ## Bentuk pengecualiannya, dan mengapa bukan `is_sample`
--
-- Yang dikecualikan adalah baris yang **rapatnya berkode `CONTOH-`** — bukan
-- baris bertanda `is_sample`.
--
-- Perbedaannya menentukan. `is_sample` adalah kolom biasa yang dapat tertulis
-- pada baris sungguhan karena kekeliruan penyemaian, penyalinan data, atau
-- pembaruan massal — dan sekali itu terjadi, keputusan RAT yang sungguhan
-- menjadi dapat dihapus tanpa ada yang menyadarinya. Nomor rapat berkode
-- `CONTOH-` hanya muncul bila seseorang benar-benar menamainya demikian, dan
-- penyemai data contoh adalah satu-satunya yang melakukannya.
--
-- Pengaduan dan tanggapannya TIDAK dikecualikan sama sekali. Data contoh tidak
-- membentuk pengaduan, jadi tidak ada alasan melonggarkannya — dan pelonggaran
-- yang tidak diperlukan hari ini akan tetap ada besok.
-- =============================================================================

SET LOCAL search_path TO "{{TENANT_SCHEMA}}";

/**
 * Menolak penghapusan, kecuali pada baris milik rapat contoh.
 *
 * Nama fungsinya baru, bukan menimpa `coop_tolak_penghapusan()` — fungsi lama
 * masih dipakai tabel pengaduan, dan pelonggaran yang dimaksudkan untuk rapat
 * tidak boleh merembes ke sana.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan_kecuali_contoh()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  nomor_rapat TEXT;
BEGIN
  SELECT m.meeting_number INTO nomor_rapat
    FROM "{{TENANT_SCHEMA}}".cooperative_meeting m
   WHERE m.id = OLD.meeting_id;

  -- Awalan huruf besar persis. `contoh-` huruf kecil BUKAN data contoh, dan
  -- penyaring yang mengabaikan besar-kecil huruf akan menghapus baris yang
  -- kebetulan dinamai serupa.
  IF nomor_rapat IS NOT NULL AND nomor_rapat LIKE 'CONTOH-%' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'Baris pada % tidak dapat dihapus. Yang tersedia hanyalah perubahan status.',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_coop_decision_no_delete
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_decision;
CREATE TRIGGER trg_coop_decision_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".cooperative_meeting_decision
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan_kecuali_contoh();

DROP TRIGGER IF EXISTS trg_coop_vote_no_delete
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_vote;
CREATE TRIGGER trg_coop_vote_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".cooperative_meeting_vote
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan_kecuali_contoh();
