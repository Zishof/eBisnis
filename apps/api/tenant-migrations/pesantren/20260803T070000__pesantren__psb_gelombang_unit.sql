-- =========================================================================
-- ePesantren — EP-O2: gelombang PSB per unit pendidikan
-- =========================================================================
--
-- `pesantren_psb_gelombang` semula berlaku SELURUH pesantren -- satu daftar
-- gelombang dipakai bersama seluruh unit (MI, Madrasah Diniyah, BLK, dst.).
-- Diminta eksplisit: gelombang bisa berbeda antar unit sekolah (jadwal,
-- kuota, dan biaya pendaftaran MI tidak harus sama dengan Madrasah Diniyah
-- atau BLK). Kolom ini karena itu NULLABLE, BUKAN wajib -- gelombang lama
-- (dan gelombang baru yang sengaja berlaku lintas unit) tetap sah tanpa
-- unit tertentu.
--
-- `daftarkan()` (lihat pesantren-psb.service.ts) MENIMPA
-- `unit_pendidikan_tujuan_id` pendaftar dengan unit gelombangnya sendiri
-- bila gelombang punya `unit_pendidikan_id` -- pendaftar tidak bisa
-- mendaftar ke gelombang MI tapi tercatat sebagai tujuan BLK.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_gelombang
  ADD COLUMN unit_pendidikan_id UUID
  REFERENCES "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (id) ON DELETE SET NULL;

-- Indeks unik lama (`tahun_ajaran_id, kode`) diganti, bukan diedit di
-- tempat -- migrasi yang sudah diterapkan tidak boleh disunting.
--
-- `COALESCE(unit_pendidikan_id, '00000000-...')` sengaja dipakai alih-alih
-- membiarkan kolomnya NULL apa adanya di dalam indeks: PostgreSQL
-- memperlakukan setiap NULL sebagai berbeda satu sama lain pada indeks
-- unik, sehingga tanpa penyeragaman ini dua gelombang lintas-unit dengan
-- kode yang sama pada tahun ajaran yang sama tidak akan pernah ditolak --
-- persis proteksi yang tadinya ada, diam-diam hilang.
DROP INDEX IF EXISTS "{{TENANT_SCHEMA}}".ux_pesantren_psb_gelombang_kode;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_psb_gelombang_kode
  ON "{{TENANT_SCHEMA}}".pesantren_psb_gelombang (
    tahun_ajaran_id,
    COALESCE(unit_pendidikan_id, '00000000-0000-0000-0000-000000000000'::uuid),
    kode
  )
  WHERE deleted_at IS NULL;
