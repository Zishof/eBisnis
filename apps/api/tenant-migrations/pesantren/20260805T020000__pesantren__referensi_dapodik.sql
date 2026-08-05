-- =========================================================================
-- ePesantren -- Referensi Dapodik/AIS untuk biodata santri
-- =========================================================================
--
-- AIS lama memecah pilihan biodata keluarga ke banyak action master:
-- PekerjaanOrtuSiswaAction, PendidikanOrangTuaSiswaAction,
-- PenghasilanOrangTuaSiswaAction, AlatTransportasiSiswaAction,
-- JenisTinggalSiswaAction, dan KebutuhanKhususSiswaAction.
--
-- Kolom Dapodik pada pesantren_santri sengaja tetap teks bebas agar impor file
-- produksi tidak tertahan variasi kode dari sekolah. Tabel ini menjadi kamus
-- admin-editable untuk template, combobox, dan pertukaran data, bukan FK keras
-- yang bisa mematahkan data lama.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_referensi_dapodik (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori        VARCHAR(32) NOT NULL,
  code            VARCHAR(64) NOT NULL,
  nama            VARCHAR(160) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_referensi_dapodik
  ADD CONSTRAINT ck_pesantren_referensi_dapodik_kategori
  CHECK (kategori IN ('PEKERJAAN', 'PENDIDIKAN', 'PENGHASILAN', 'TRANSPORTASI', 'JENIS_TINGGAL', 'KEBUTUHAN_KHUSUS'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_referensi_dapodik_kategori_code
  ON "{{TENANT_SCHEMA}}".pesantren_referensi_dapodik (kategori, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_referensi_dapodik_kategori_active
  ON "{{TENANT_SCHEMA}}".pesantren_referensi_dapodik (kategori, is_active, deleted_at);

INSERT INTO "{{TENANT_SCHEMA}}".pesantren_referensi_dapodik (kategori, code, nama, sort_order)
VALUES
  ('PENDIDIKAN', 'TIDAK_SEKOLAH', 'Tidak sekolah', 1),
  ('PENDIDIKAN', 'SD', 'SD/sederajat', 2),
  ('PENDIDIKAN', 'SMP', 'SMP/sederajat', 3),
  ('PENDIDIKAN', 'SMA', 'SMA/sederajat', 4),
  ('PENDIDIKAN', 'D1_D2', 'D1/D2', 5),
  ('PENDIDIKAN', 'D3', 'D3', 6),
  ('PENDIDIKAN', 'S1', 'S1/D4', 7),
  ('PENDIDIKAN', 'S2', 'S2', 8),
  ('PENDIDIKAN', 'S3', 'S3', 9),
  ('PEKERJAAN', 'TIDAK_BEKERJA', 'Tidak bekerja', 1),
  ('PEKERJAAN', 'PETANI', 'Petani/pekebun', 2),
  ('PEKERJAAN', 'NELAYAN', 'Nelayan', 3),
  ('PEKERJAAN', 'PEDAGANG', 'Pedagang', 4),
  ('PEKERJAAN', 'WIRASWASTA', 'Wiraswasta', 5),
  ('PEKERJAAN', 'BURUH', 'Buruh', 6),
  ('PEKERJAAN', 'PNS_TNI_POLRI', 'PNS/TNI/Polri', 7),
  ('PEKERJAAN', 'KARYAWAN_SWASTA', 'Karyawan swasta', 8),
  ('PEKERJAAN', 'GURU_DOSEN', 'Guru/dosen', 9),
  ('PENGHASILAN', 'TIDAK_BERPENGHASILAN', 'Tidak berpenghasilan', 1),
  ('PENGHASILAN', 'KURANG_500', 'Kurang dari Rp500.000', 2),
  ('PENGHASILAN', '500_999', 'Rp500.000 - Rp999.999', 3),
  ('PENGHASILAN', '1JT_1999', 'Rp1.000.000 - Rp1.999.999', 4),
  ('PENGHASILAN', '2JT_4999', 'Rp2.000.000 - Rp4.999.999', 5),
  ('PENGHASILAN', '5JT_LEBIH', 'Rp5.000.000 atau lebih', 6),
  ('TRANSPORTASI', 'JALAN_KAKI', 'Jalan kaki', 1),
  ('TRANSPORTASI', 'SEPEDA', 'Sepeda', 2),
  ('TRANSPORTASI', 'SEPEDA_MOTOR', 'Sepeda motor', 3),
  ('TRANSPORTASI', 'MOBIL_PRIBADI', 'Mobil pribadi', 4),
  ('TRANSPORTASI', 'ANGKUTAN_UMUM', 'Angkutan umum', 5),
  ('TRANSPORTASI', 'ANTAR_JEMPUT', 'Antar jemput sekolah', 6),
  ('JENIS_TINGGAL', 'BERSAMA_ORANG_TUA', 'Bersama orang tua', 1),
  ('JENIS_TINGGAL', 'WALI', 'Wali', 2),
  ('JENIS_TINGGAL', 'ASRAMA', 'Asrama/pondok', 3),
  ('JENIS_TINGGAL', 'KOST', 'Kos', 4),
  ('KEBUTUHAN_KHUSUS', 'TIDAK_ADA', 'Tidak ada', 1),
  ('KEBUTUHAN_KHUSUS', 'NETRA', 'Tunanetra', 2),
  ('KEBUTUHAN_KHUSUS', 'RUNGU', 'Tunarungu', 3),
  ('KEBUTUHAN_KHUSUS', 'GRAHITA', 'Tunagrahita', 4),
  ('KEBUTUHAN_KHUSUS', 'DAKSA', 'Tunadaksa', 5),
  ('KEBUTUHAN_KHUSUS', 'LARAS', 'Tunalaras', 6),
  ('KEBUTUHAN_KHUSUS', 'CERDAS_ISTIMEWA', 'Cerdas istimewa', 7)
ON CONFLICT DO NOTHING;
