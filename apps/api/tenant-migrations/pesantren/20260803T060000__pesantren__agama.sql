-- =========================================================================
-- ePesantren — Referensi agama
-- =========================================================================
--
-- `pesantren_santri.agama`/`pesantren_psb_pendaftar.agama` (migrasi
-- 20260802T340000) sejauh ini teks bebas -- benar untuk pencatatan oleh
-- pengurus lewat panel admin, tetapi salah untuk FORMULIR PUBLIK (PSB):
-- teks bebas berarti "Islam"/"islam"/"ISLAM"/"Moslem" semua tersimpan
-- berbeda, dan combobox pada formulir publik butuh daftar tetap untuk
-- dipilih, bukan kotak isian bebas.
--
-- Tabel referensi INI TIDAK diikat sebagai FK ke kolom `agama` yang sudah
-- ada -- keduanya tetap teks bebas, hanya kini disarankan lewat combobox
-- yang membaca daftar ini. Mengikat FK berarti mengubah kolom yang sudah
-- dipakai baris yang sudah ada (santri lama boleh jadi menuliskan
-- "Islam" dengan variasi kapitalisasi berbeda), risiko yang tidak
-- sepadan dengan manfaatnya -- combobox pada formulir sudah cukup
-- menyeragamkan nilai BARU tanpa menyentuh baris lama sama sekali.
--
-- Enam agama diakui pemerintah Indonesia (UU No. 1/PNPS/1965) plus
-- "Kepercayaan Terhadap Tuhan YME" sesuai putusan MK No. 97/PUU-XIV/2016
-- yang mewajibkannya dapat dicantumkan pada dokumen kependudukan.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_agama (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(20) NOT NULL,
  nama            VARCHAR(60) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_agama_code
  ON "{{TENANT_SCHEMA}}".pesantren_agama (code);

INSERT INTO "{{TENANT_SCHEMA}}".pesantren_agama (code, nama, sort_order)
VALUES
  ('ISLAM', 'Islam', 1),
  ('KRISTEN', 'Kristen/Protestan', 2),
  ('KATOLIK', 'Katolik', 3),
  ('HINDU', 'Hindu', 4),
  ('BUDDHA', 'Buddha', 5),
  ('KHONGHUCU', 'Khonghucu', 6),
  ('KEPERCAYAAN', 'Kepercayaan Terhadap Tuhan Yang Maha Esa', 7)
ON CONFLICT (code) DO NOTHING;
