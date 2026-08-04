-- =========================================================================
-- H068 - MENU BERLAYAR W-7 MASTER DATA
-- =========================================================================
--
-- W-7 membuka menu master data/terminologi yang sudah punya API dan kini punya
-- permukaan web. Beberapa route memakai layar operasional yang sama karena
-- datanya memang berada di konteks yang sama:
--   unit dan pemberi layanan -> fasilitas
--   formularium -> farmasi
--   lab/katalog -> lab
--   penjamin -> tarif
--   pemetaan -> master data
--   satusehat dan satusehat-kemampuan -> kesiapan integrasi

DO $$
DECLARE
  berlayar TEXT[] := ARRAY[
    '/app/emedik/layanan',
    '/app/emedik/unit',
    '/app/emedik/pemberi-layanan',
    '/app/emedik/formularium',
    '/app/emedik/lab/katalog',
    '/app/emedik/penjamin',
    '/app/emedik/master-data',
    '/app/emedik/terminologi',
    '/app/emedik/kfa',
    '/app/emedik/pemetaan',
    '/app/emedik/satusehat',
    '/app/emedik/satusehat-kemampuan'
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
      'H068: utas berikut tidak cocok dengan menu mana pun: %.', tak_dikenal
      USING ERRCODE = 'raise_exception';
  END IF;

  UPDATE "{{TENANT_SCHEMA}}".menu
     SET is_coming_soon = FALSE,
         updated_at = now()
   WHERE module_code = 'HEALTH'
     AND deleted_at IS NULL
     AND route = ANY (berlayar);

  GET DIAGNOSTICS n_baru = ROW_COUNT;
  RAISE NOTICE 'H068: % menu master data/terminologi eMedik dibuka.', n_baru;
END $$;
