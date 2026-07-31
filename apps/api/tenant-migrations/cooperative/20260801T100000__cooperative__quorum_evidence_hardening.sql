-- =============================================================================
-- K-11 · Memperketat bukti kuorum
-- =============================================================================
--
-- Migrasi ini memperbaiki cacat yang ditemukan bukti menyeluruh K-11, bukan
-- menambah kemampuan baru.
--
-- ## Cacatnya
--
-- `ck_coop_meeting_quorum_evidence` dari K-5 berbunyi:
--
--     CHECK (status <> 'QUORUM_REACHED'
--            OR (quorum_reached = TRUE AND counted_for_quorum IS NOT NULL ...))
--
-- Penjaganya dikaitkan pada **status**, padahal yang perlu dijaga adalah
-- **pernyataannya**. Akibatnya sebuah rapat dapat berstatus `CLOSED` dengan
-- `quorum_reached = TRUE` tanpa satu pun angka yang membuktikannya — dan
-- `CLOSED` justru keadaan akhir setiap RAT yang sudah selesai. `QUORUM_REACHED`
-- hanya keadaan sesaat di tengah rapat.
--
-- Jadi penjaganya menjaga keadaan yang lewat dalam hitungan jam, dan
-- membiarkan keadaan yang bertahan selamanya.
--
-- Ini bukan cacat teoretis. Keputusan RAT hanya sah bila kuorumnya tercapai;
-- keabsahan pembagian SHU bersandar padanya. Rapat yang menyatakan kuorum
-- tanpa angka membuat pernyataan itu tidak dapat diperiksa siapa pun kemudian
-- — termasuk oleh pengawas dan oleh anggota yang mempersoalkannya.
--
-- ## Perbaikannya
--
-- Penjaganya dikaitkan pada `quorum_reached = TRUE`, berapa pun statusnya.
-- Yang menyatakan kuorum wajib menyimpan angkanya, dan itu berlaku sejak rapat
-- dibuka sampai selamanya sesudahnya.
--
-- Ditulis sebagai migrasi baru, bukan dengan menyunting migrasi K-5 yang sudah
-- diterapkan. Migrasi yang sudah berjalan tidak disunting — perbaikannya
-- ditambahkan, supaya riwayatnya menunjukkan bahwa cacatnya pernah ada dan
-- kapan diperbaiki.
-- =============================================================================

SET LOCAL search_path TO "{{TENANT_SCHEMA}}";

-- Penjaga lama dilepas dan digantikan; keduanya menjaga hal yang sama, dan
-- yang baru lebih luas cakupannya.
ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_meeting
  DROP CONSTRAINT IF EXISTS ck_coop_meeting_quorum_evidence;

ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_meeting
  DROP CONSTRAINT IF EXISTS ck_coop_meeting_quorum_claim_needs_evidence;

/*
 * Setiap rapat yang MENYATAKAN kuorum wajib menyimpan angkanya:
 *   · berapa yang dihitung hadir,
 *   · berapa yang diperlukan,
 *   · berapa jumlah anggota aktif saat itu.
 *
 * Ketiganya diperlukan bersama. Tanpa jumlah anggota aktif, "9 hadir dari
 * syarat 6" tidak dapat diperiksa — sebab syarat 6 itu sendiri diturunkan dari
 * jumlah anggota.
 */
ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_meeting
  ADD CONSTRAINT ck_coop_meeting_quorum_claim_needs_evidence
  CHECK (
    quorum_reached IS DISTINCT FROM TRUE
    OR (
      counted_for_quorum IS NOT NULL
      AND required_count IS NOT NULL
      AND total_active_members IS NOT NULL
    )
  );

/*
 * Dan angkanya harus benar-benar mendukung pernyataannya.
 *
 * Rapat yang menyatakan kuorum tercapai padahal yang hadir kurang dari yang
 * disyaratkan adalah pernyataan yang bertentangan dengan angkanya sendiri.
 * Sebelum ini, angka itu boleh apa saja asalkan ada.
 */
ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_meeting
  DROP CONSTRAINT IF EXISTS ck_coop_meeting_quorum_arithmetic;

ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_meeting
  ADD CONSTRAINT ck_coop_meeting_quorum_arithmetic
  CHECK (
    quorum_reached IS DISTINCT FROM TRUE
    OR counted_for_quorum >= required_count
  );

/*
 * Sebaliknya pun dijaga: rapat yang menyatakan kuorum TIDAK tercapai padahal
 * yang hadir memenuhi syarat sama menyesatkannya — ia dapat dipakai
 * membatalkan keputusan yang sebenarnya sah.
 */
ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_meeting
  DROP CONSTRAINT IF EXISTS ck_coop_meeting_quorum_denial_arithmetic;

ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_meeting
  ADD CONSTRAINT ck_coop_meeting_quorum_denial_arithmetic
  CHECK (
    quorum_reached IS DISTINCT FROM FALSE
    OR counted_for_quorum IS NULL
    OR required_count IS NULL
    OR counted_for_quorum < required_count
  );

-- -----------------------------------------------------------------------------
-- Pengaduan benar-benar tidak dapat dihapus
-- -----------------------------------------------------------------------------
--
-- Cacat kedua yang ditemukan bukti menyeluruh K-11.
--
-- K-9 menyatakan "pengaduan tidak dapat dihapus, hanya berpindah status sampai
-- CLOSED", dan itu ditegakkan dengan cara yang lemah: tidak ada endpoint yang
-- menghapusnya. Basis datanya sendiri menerima `DELETE` tanpa keberatan.
--
-- Selisih antara keduanya penting. Alasan pengaduan tidak boleh dapat dihapus
-- adalah supaya ia tidak dapat dihilangkan oleh orang yang isinya menegur
-- dirinya — dan orang semacam itu justru yang paling mungkin punya akses
-- langsung ke basis data. Penjagaan yang hanya ada pada lapisan aplikasi tidak
-- menjaga dari orang itu.
--
-- Notulen rapat dijaga dengan alasan yang sama: ia catatan resmi keputusan
-- yang menjadi dasar keabsahan pembagian SHU.

CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Baris pada % tidak dapat dihapus. Yang tersedia hanyalah perubahan status.',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_coop_complaint_no_delete
  ON "{{TENANT_SCHEMA}}".cooperative_complaint;
CREATE TRIGGER trg_coop_complaint_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".cooperative_complaint
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan();

DROP TRIGGER IF EXISTS trg_coop_complaint_response_no_delete
  ON "{{TENANT_SCHEMA}}".cooperative_complaint_response;
CREATE TRIGGER trg_coop_complaint_response_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".cooperative_complaint_response
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan();

DROP TRIGGER IF EXISTS trg_coop_decision_no_delete
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_decision;
CREATE TRIGGER trg_coop_decision_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".cooperative_meeting_decision
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan();

DROP TRIGGER IF EXISTS trg_coop_vote_no_delete
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_vote;
CREATE TRIGGER trg_coop_vote_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".cooperative_meeting_vote
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan();

DROP TRIGGER IF EXISTS trg_coop_minutes_no_delete
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_minutes;
CREATE TRIGGER trg_coop_minutes_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".cooperative_meeting_minutes
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan();

DROP TRIGGER IF EXISTS trg_coop_portal_activity_no_delete
  ON "{{TENANT_SCHEMA}}".cooperative_portal_activity;
CREATE TRIGGER trg_coop_portal_activity_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".cooperative_portal_activity
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".coop_tolak_penghapusan();

/*
 * Catatan bagi yang membaca kelak: daftar ini sengaja PENDEK.
 *
 * Yang dijaga hanya catatan yang gunanya justru terletak pada
 * ketidakmungkinannya dihilangkan — pengaduan, suara, keputusan, notulen, dan
 * jejak portal. Memasang penjaga yang sama pada seluruh tabel koperasi akan
 * membuat pembersihan data contoh mustahil, dan penjaga yang menghalangi
 * pekerjaan wajar akan dicabut seseorang pada suatu hari, bersama seluruh
 * gunanya.
 */

