-- =========================================================================
-- VILLAGE — SATU PERSYARATAN, SATU CATATAN BERKAS
-- =========================================================================
--
-- `village_request_document` dibuat pada D-4 tanpa indeks unik. Selama tidak
-- ada satu pun jalur yang mengisinya, hal itu tidak berakibat apa-apa. Sekarang
-- layar loket mengisinya, dan ketiadaan indeks itu menjadi cacat:
--
--   Petugas menandai "KTP sudah diterima", lalu ragu, lalu menandainya lagi.
--   Tanpa indeks unik, tabelnya berisi dua baris untuk satu persyaratan.
--
-- Akibatnya bukan sekadar baris berlebih. Pemeriksaan kelengkapan pada D-4
-- membandingkan **daftar syarat** dengan **daftar berkas**, dan cacah yang
-- menggelembung membuat permohonan terlihat lengkap padahal ada syarat lain
-- yang belum terpenuhi sama sekali. Surat terbit atas berkas yang tidak pernah
-- diserahkan, dan tidak ada yang menyadarinya sampai surat itu dipersoalkan.
--
-- Indeks ini juga yang membuat `ON CONFLICT ... DO UPDATE` pada layanan bekerja:
-- menandai berkas yang sama dua kali memperbarui catatannya, bukan menambah
-- baris kedua.

-- Baris ganda yang mungkin sudah terlanjur ada dibersihkan lebih dahulu; yang
-- disisakan adalah catatan TERBARU untuk tiap persyaratan.
--
-- Menyisakan yang terbaru, bukan yang terlama: bila petugas menandai dua kali,
-- yang kedua adalah yang ia maksud.
DELETE FROM "{{TENANT_SCHEMA}}".village_request_document a
 USING "{{TENANT_SCHEMA}}".village_request_document b
 WHERE a.service_request_id = b.service_request_id
   AND a.requirement_code = b.requirement_code
   AND (a.created_at, a.id) < (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS village_request_document_unique
  ON "{{TENANT_SCHEMA}}".village_request_document (service_request_id, requirement_code);

COMMENT ON INDEX "{{TENANT_SCHEMA}}".village_request_document_unique IS
  'Satu persyaratan satu catatan. Dua baris untuk satu syarat membuat cacah '
  'kelengkapan menggelembung, dan permohonan terlihat lengkap padahal ada '
  'syarat lain yang belum terpenuhi.';
