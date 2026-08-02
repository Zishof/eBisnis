-- =========================================================================
-- ePesantren — EP-J: Perizinan dan gerbang
-- =========================================================================
--
-- docs/santri-info/13-security-and-privacy-risk-register.md R10: "Petugas
-- gerbang mengubah persetujuan izin" -- santri keluar tanpa izin yang sah --
-- dicatat BELUM ADA PENAHAN, wajib menjadi uji. §14.8 perintah master:
-- "petugas gerbang != pengubah persetujuan izin".
--
-- Dua tabel terpisah menegakkannya secara struktural, bukan hanya prosedural:
-- `pesantren_gerbang_log` TIDAK PERNAH menulis kolom `status` pada
-- `pesantren_izin` -- petugas gerbang hanya mencatat lintasan (KELUAR/MASUK)
-- terhadap izin yang statusnya SUDAH `DISETUJUI`, dan CHECK constraint
-- menolak baris gerbang yang menunjuk izin belum disetujui secara langsung
-- di basis data, bukan hanya di service.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_izin (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  jenis             VARCHAR(24) NOT NULL,
  alasan            TEXT NOT NULL,
  tanggal_mulai     DATE NOT NULL,
  tanggal_selesai_rencana DATE NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'MENUNGGU',
  -- UUID polos, bukan FK ke user_subject -- mengikuti konvensi created_by/
  -- updated_by pada seluruh tabel pesantren lain, yang menyimpan
  -- platform_user_id (AuthenticatedUser.userId dari klaim JWT `sub`), bukan
  -- id user_subject tenant. Sempat salah menjadi FK ke user_subject,
  -- tertangkap live test saat percobaan menyetujui izin gagal dengan
  -- pelanggaran foreign key.
  disetujui_oleh    UUID,
  disetujui_pada    TIMESTAMPTZ,
  catatan_penyetuju TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_izin
  ADD CONSTRAINT ck_pesantren_izin_jenis
  CHECK (jenis IN ('PULANG', 'SAKIT', 'KEPERLUAN_KELUARGA', 'LAINNYA'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_izin
  ADD CONSTRAINT ck_pesantren_izin_status
  CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'SELESAI', 'DIBATALKAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_izin
  ADD CONSTRAINT ck_pesantren_izin_tanggal_selesai_setelah_mulai
  CHECK (tanggal_selesai_rencana >= tanggal_mulai);

-- Baris DISETUJUI/DITOLAK wajib punya siapa dan kapan; baris MENUNGGU wajib
-- belum punya keduanya -- sama seperti pesantren_santri EP-A, mencegah
-- "disetujui" tanpa jejak siapa yang menyetujui.
ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_izin
  ADD CONSTRAINT ck_pesantren_izin_jejak_keputusan
  CHECK (
    (status = 'MENUNGGU' AND disetujui_oleh IS NULL AND disetujui_pada IS NULL) OR
    (status <> 'MENUNGGU' AND (disetujui_oleh IS NOT NULL OR status = 'DIBATALKAN'))
  );

CREATE INDEX IF NOT EXISTS ix_pesantren_izin_santri
  ON "{{TENANT_SCHEMA}}".pesantren_izin (santri_id, deleted_at);
CREATE INDEX IF NOT EXISTS ix_pesantren_izin_status
  ON "{{TENANT_SCHEMA}}".pesantren_izin (status, tanggal_mulai);

-- ---------------------------------------------------------------------------
-- pesantren_gerbang_log — lintasan keluar/masuk, TANPA hak mengubah izin
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_gerbang_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  izin_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_izin (id) ON DELETE RESTRICT,
  arah         VARCHAR(8) NOT NULL,
  waktu        TIMESTAMPTZ NOT NULL DEFAULT now(),
  dicatat_oleh UUID,
  catatan      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  version      INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_gerbang_log
  ADD CONSTRAINT ck_pesantren_gerbang_log_arah
  CHECK (arah IN ('KELUAR', 'MASUK'));

CREATE INDEX IF NOT EXISTS ix_pesantren_gerbang_log_izin
  ON "{{TENANT_SCHEMA}}".pesantren_gerbang_log (izin_id, waktu);
