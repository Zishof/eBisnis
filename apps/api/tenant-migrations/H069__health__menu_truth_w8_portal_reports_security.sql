-- =========================================================================
-- H069 - MENU BERLAYAR W-8 PORTAL, LAPORAN, KEAMANAN
-- =========================================================================
--
-- W-8 membuka sisa menu operasional yang sudah punya API atau penghalang yang
-- harus dinyatakan di layar. Layar tidak membuat ekspor/laporan palsu:
-- akuntansi tetap menyebut tunggu peristiwa HEALTH_* Core, laporan tetap
-- menyebut ekspor ditolak sampai pipeline dokumen tersedia, dan investor tidak
-- membuka data pasien.

DO $$
DECLARE
  berlayar TEXT[] := ARRAY[
    '/app/emedik/akun-portal',
    '/app/emedik/pelepasan-hasil',
    '/app/emedik/website',
    '/app/emedik/data-contoh',
    '/app/emedik/laporan',
    '/app/emedik/akuntansi',
    '/app/emedik/rekonsiliasi',
    '/app/emedik/dasbor-investor',
    '/app/emedik/waterfall',
    '/app/emedik/zona-data',
    '/app/emedik/penjaga-ai'
  ];
  n_baru INTEGER;
  tak_dikenal TEXT := '';
  u TEXT;
BEGIN
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
      'H069: utas berikut tidak cocok dengan menu mana pun: %.', tak_dikenal
      USING ERRCODE = 'raise_exception';
  END IF;

  UPDATE "{{TENANT_SCHEMA}}".menu
     SET is_coming_soon = FALSE,
         updated_at = now()
   WHERE module_code = 'HEALTH'
     AND deleted_at IS NULL
     AND route = ANY (berlayar);

  GET DIAGNOSTICS n_baru = ROW_COUNT;
  RAISE NOTICE 'H069: % menu portal/laporan/keamanan eMedik dibuka.', n_baru;
END $$;
