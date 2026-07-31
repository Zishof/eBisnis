-- =========================================================================
-- V021 — PERBAIKAN PENGELOMPOKAN PEMBERITAHUAN
--
-- ## Cacat yang diperbaiki
--
-- Indeks unik pada V020 ditulis begini:
--
--     UNIQUE (group_key, recipient_subject_id, channel) WHERE ...
--
-- dan ia TIDAK BEKERJA untuk pemberitahuan yang ditujukan kepada PERAN.
--
-- Sebabnya: pemberitahuan berbasis peran punya `recipient_subject_id` bernilai
-- NULL, dan PostgreSQL memperlakukan NULL sebagai nilai yang selalu berbeda
-- dari NULL lain. Dua baris `('SLA:x', NULL, 'IN_APP')` karena itu tidak pernah
-- dianggap bertabrakan, dan pengelompokan yang seharusnya menahan pengulangan
-- justru melewatkan semuanya.
--
-- Akibatnya nyata dan langsung terlihat pada bukti: pemeriksaan SLA yang
-- berjalan tiap jam menerbitkan satu baris lonceng BARU setiap jam untuk surat
-- yang sama. Surat yang terlambat tiga hari menghasilkan tujuh puluh dua baris
-- — yang menenggelamkan segala hal lain dan membuat lonceng itu diabaikan,
-- sehingga eskalasi yang dibangun untuk menarik perhatian justru menghilangkan
-- perhatian.
--
-- ## Mengapa COALESCE, bukan NULLS NOT DISTINCT
--
-- PostgreSQL 15 memperkenalkan `UNIQUE NULLS NOT DISTINCT` yang menyelesaikan
-- ini dengan rapi. Basis data produksi menjalankan 13.12, dan memakainya akan
-- membuat migration ini berhasil pada pengembangan lalu gagal pada produksi —
-- kegagalan yang baru ketahuan pada saat rilis.
--
-- Indeks berbasis ekspresi bekerja pada kedua versi.
-- =========================================================================

DROP INDEX IF EXISTS "{{TENANT_SCHEMA}}".uq_notification_group_live;

-- UUID nol dipakai sebagai pengganti NULL. Ia tidak pernah menjadi id
-- sesungguhnya, sehingga tidak dapat bertabrakan dengan penerima nyata.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_group_live
  ON "{{TENANT_SCHEMA}}".notification (
    group_key,
    COALESCE(recipient_subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(recipient_role_code, ''),
    channel
  )
  WHERE group_key IS NOT NULL AND read_at IS NULL AND dismissed_at IS NULL;

COMMENT ON INDEX "{{TENANT_SCHEMA}}".uq_notification_group_live IS
  'Satu kelompok, satu baris hidup per penerima. COALESCE dipakai karena NULL '
  'pada indeks unik selalu dianggap berbeda dari NULL lain, sehingga penerima '
  'berupa peran tidak akan pernah terkelompok tanpa itu.';
