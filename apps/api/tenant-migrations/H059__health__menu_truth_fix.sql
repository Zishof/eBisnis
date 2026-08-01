-- =========================================================================
-- H059 — UTAS MENU KUNJUNGAN RUMAH DAN MENU YANG BERKATA JUJUR
-- =========================================================================
--
-- Fase W-1 (layar Puskesmas). Aditif dan korektif; tidak menghapus apa pun.
--
-- ## 1. Menu "Kunjungan Rumah" menyorot dirinya pada layar yang bukan miliknya
--
-- H015 memberi `HEALTH_HOME_VISIT` utas `/app/emedik/kunjungan`. Kunjungan
-- klinis berada pada `/app/emedik/kunjungan/:id`, dan `NavLink` pada bilah
-- samping mencocokkan **awalan** — `end` hanya disetel untuk `/app`.
--
-- Akibatnya terlihat setiap hari sejak H-3: dokter yang membuka rekam medis
-- seorang pasien melihat menu **Posyandu** tersorot di bilah sampingnya. Ia
-- tidak menimbulkan galat, tidak tercatat di mana pun, dan setiap orang yang
-- melihatnya menganggap dirinya salah membaca.
--
-- Diperbaiki menjadi `/app/emedik/kunjungan-rumah`. Utas menu bukan bagian
-- dari kunci atau jejak audit mana pun — ia hanya alamat layar — jadi
-- mengubahnya aman. Yang TIDAK diubah: kode menunya, sebab kode itulah yang
-- dipakai hak akses.
--
-- ## 2. Menu yang belum punya layar kini berkata belum punya layar
--
-- Tujuh puluh satu menu kesehatan terdaftar dengan `is_coming_soon = FALSE`.
-- Sembilan belas di antaranya punya layar; lima puluh dua sisanya bermuara ke
-- `ComingSoonPage`.
--
-- Jadi menunya berkata "siap" dan layarnya berkata "segera hadir" — pengguna
-- baru mengetahuinya **sesudah** mengklik. Yang lebih buruk: ia mengklik
-- berulang kali, sebab tidak ada tanda apa pun yang membedakan menu yang
-- bekerja dari yang tidak.
--
-- Bilah sampingnya sudah dapat menampilkan penanda itu (`isComingSoon` dirender
-- sebagai label kecil di sebelah nama menu); yang tidak ada hanyalah datanya.
--
-- Daftar di bawah adalah **daftar utas yang PUNYA layar**, bukan daftar yang
-- tidak. Satu daftar, satu sumber kebenaran: setiap fase layar berikutnya
-- menambahkan migrasi kecil yang mengembalikan `FALSE` untuk utas yang baru
-- dibangunnya. Daftar "yang belum" tidak pernah perlu ditulis, dan karena itu
-- tidak pernah dapat menjadi usang tanpa ketahuan.

-- ---------------------------------------------------------------------------
-- 1. Utas kunjungan rumah
-- ---------------------------------------------------------------------------
UPDATE "{{TENANT_SCHEMA}}".menu
   SET route = '/app/emedik/kunjungan-rumah',
       updated_at = now()
 WHERE code = 'HEALTH_HOME_VISIT'
   AND route = '/app/emedik/kunjungan';

-- ---------------------------------------------------------------------------
-- 2. Kejujuran menu
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  berlayar TEXT[] := ARRAY[
    -- H-1 sampai H-7, sudah ada sejak sebelum fase ini.
    '/app/emedik/fasilitas',
    '/app/emedik/pasien',
    '/app/emedik/pendaftaran',
    '/app/emedik/resep',
    '/app/emedik/penyerahan',
    '/app/emedik/lab/pesanan',
    '/app/emedik/lab/spesimen',
    '/app/emedik/lab/hasil',
    '/app/emedik/lab/kritis',
    '/app/emedik/rawat-inap',
    '/app/emedik/keperawatan',
    '/app/emedik/tempat-tidur',
    '/app/emedik/igd',
    -- W-1: Puskesmas dan Posyandu.
    '/app/emedik/keluarga',
    '/app/emedik/pertumbuhan',
    '/app/emedik/imunisasi',
    '/app/emedik/kunjungan-rumah',
    '/app/emedik/cakupan'
  ];
  n_siap INTEGER;
  n_belum INTEGER;
  tak_dikenal TEXT := '';
  u TEXT;
BEGIN
  /*
   * Setiap utas pada daftar HARUS ada sebagai menu.
   *
   * Utas yang salah ketik akan diam-diam menjadikan menunya "segera hadir"
   * padahal layarnya ada — pengguna melihat penanda pada menu yang sebenarnya
   * bekerja, dan berhenti mengkliknya. Pelajaran H057: lewatan yang diam lebih
   * buruk daripada kegagalan yang berisik.
   */
  FOREACH u IN ARRAY berlayar LOOP
    IF NOT EXISTS (
      SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m
       WHERE m.route = u AND m.module_code = 'HEALTH' AND m.deleted_at IS NULL
    ) THEN
      tak_dikenal := tak_dikenal || u || ' ';
    END IF;
  END LOOP;

  IF tak_dikenal <> '' THEN
    RAISE EXCEPTION
      'H059: utas berikut tidak cocok dengan menu mana pun: %. Utas yang salah ketik akan '
      'menjadikan menu yang layarnya ADA tertandai "segera hadir", dan penggunanya berhenti '
      'mengkliknya.', tak_dikenal
      USING ERRCODE = 'raise_exception';
  END IF;

  UPDATE "{{TENANT_SCHEMA}}".menu
     SET is_coming_soon = (route <> ALL (berlayar)),
         updated_at = now()
   WHERE module_code = 'HEALTH'
     AND deleted_at IS NULL
     /* Menu akar HEALTH sendiri bukan layar; ia wadah. */
     AND code <> 'HEALTH';

  SELECT count(*) FILTER (WHERE NOT is_coming_soon),
         count(*) FILTER (WHERE is_coming_soon)
    INTO n_siap, n_belum
    FROM "{{TENANT_SCHEMA}}".menu
   WHERE module_code = 'HEALTH' AND deleted_at IS NULL AND code <> 'HEALTH';

  RAISE NOTICE 'H059: % menu berlayar, % menu masih segera hadir.', n_siap, n_belum;
END $$;
