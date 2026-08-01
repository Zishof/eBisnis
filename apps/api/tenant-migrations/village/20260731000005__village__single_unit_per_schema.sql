-- =========================================================================
-- VILLAGE — SATU DESA/KELURAHAN PER SCHEMA
-- =========================================================================
--
-- eBisnis memakai skema-per-penyewa: satu desa mendaftar, satu skema
-- PostgreSQL dibuat, dan pemisahan datanya berada di lapisan basis data —
-- bukan pada penyaringan kueri. Itu sudah berlaku sejak awal.
--
-- Yang BELUM dijaga: tidak ada yang mencegah dua unit pemerintahan masuk ke
-- satu skema yang sama. `village_unit` boleh berisi banyak baris, dan
-- `VillageUnitService.unit()` mengambil yang pertama menurut `created_at`.
--
-- Akibatnya bila itu terjadi, dan inilah sebabnya harus ditutup:
--
-- * Seluruh layanan village membaca "unit penyewa ini" dari baris pertama.
--   Desa kedua yang tersisip akan tidak terlihat sama sekali — penduduknya
--   masuk ke skema, tetapi tidak pernah muncul pada daftar mana pun.
-- * Bila urutannya berubah — misalnya baris pertama dinonaktifkan — seluruh
--   sistem tiba-tiba menunjuk desa yang berbeda. Penduduk desa A muncul pada
--   layar desa B, dan tidak ada galat yang menandainya.
-- * Kelayakan profil ditentukan `profile_type` unit itu. Dua unit berbeda
--   profil pada satu skema berarti APBDes desa A dapat dibuka petugas
--   kelurahan B.
--
-- Kegagalannya senyap seluruhnya. Karena itu dijaga basis data, bukan
-- diserahkan kepada disiplin pemasangan.
--
-- Indeks parsial dipilih alih-alih constraint biasa supaya baris yang sudah
-- dinonaktifkan atau dihapus tidak menghalangi — desa yang berubah menjadi
-- kelurahan menonaktifkan unit lamanya lalu membuat yang baru, dan itu sah.

CREATE UNIQUE INDEX IF NOT EXISTS village_unit_single_active
  ON "{{TENANT_SCHEMA}}".village_unit ((TRUE))
  WHERE is_active = TRUE AND deleted_at IS NULL;

COMMENT ON INDEX "{{TENANT_SCHEMA}}".village_unit_single_active IS
  'Satu desa/kelurahan aktif per schema. eBisnis memakai skema-per-penyewa, sehingga dua unit pada satu schema berarti data dua pemerintahan bercampur — dan kegagalannya senyap: layanan membaca baris pertama, unit kedua tidak pernah terlihat, dan bila urutannya berubah seluruh sistem menunjuk desa yang berbeda tanpa galat apa pun.';
