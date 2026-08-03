-- =========================================================================
-- H061 — MENU BERLAYAR: MUTU DAN KESELAMATAN
-- =========================================================================
--
-- Sisa W-2. Aditif seluruhnya; melanjutkan pola H059 dan H060.
--
-- Dua menu yang dilewati pada H060 dan disebut apa adanya sebagai belum selesai
-- alih-alih didiamkan: `mutu` dan `keselamatan`. Keduanya kini berlayar.

DO $$
DECLARE
  berlayar TEXT[] := ARRAY[
    -- H-1 sampai H-7.
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
    '/app/emedik/cakupan',
    -- W-2: rekam medis, telaah darurat, mutu, keselamatan.
    '/app/emedik/koding',
    '/app/emedik/penahanan',
    '/app/emedik/jejak-akses',
    '/app/emedik/pelepasan',
    '/app/emedik/telaah-darurat',
    '/app/emedik/mutu',
    '/app/emedik/keselamatan'
  ];
  n_siap INTEGER;
  n_belum INTEGER;
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
      'H061: utas berikut tidak cocok dengan menu mana pun: %. Utas yang salah ketik akan '
      'menjadikan menu yang layarnya ADA tertandai "segera hadir", dan penggunanya berhenti '
      'mengkliknya.', tak_dikenal
      USING ERRCODE = 'raise_exception';
  END IF;

  UPDATE "{{TENANT_SCHEMA}}".menu
     SET is_coming_soon = (route <> ALL (berlayar)),
         updated_at = now()
   WHERE module_code = 'HEALTH'
     AND deleted_at IS NULL
     AND code <> 'HEALTH';

  SELECT count(*) FILTER (WHERE NOT is_coming_soon),
         count(*) FILTER (WHERE is_coming_soon)
    INTO n_siap, n_belum
    FROM "{{TENANT_SCHEMA}}".menu
   WHERE module_code = 'HEALTH' AND deleted_at IS NULL AND code <> 'HEALTH';

  RAISE NOTICE 'H061: % menu berlayar, % menu masih segera hadir.', n_siap, n_belum;
END $$;
