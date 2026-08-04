-- =========================================================================
-- H063 — MENU BERLAYAR W-4
-- =========================================================================
--
-- Fase W-4 (layar tarif, jasa, settlement, kontrak fee). Aditif seluruhnya;
-- pola sama dengan H059-H062.
--
-- Tujuh utas baru untuk empat layar: `kontributor` menunjuk layar kebijakan
-- jasa, dan `distribusi` serta `pernyataan` menunjuk layar settlement. Sama
-- alasannya dengan W-2 dan W-3: satu berkas, satu layar.

DO $$
DECLARE
  berlayar TEXT[] := ARRAY[
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
    '/app/emedik/keluarga',
    '/app/emedik/pertumbuhan',
    '/app/emedik/imunisasi',
    '/app/emedik/kunjungan-rumah',
    '/app/emedik/cakupan',
    '/app/emedik/koding',
    '/app/emedik/penahanan',
    '/app/emedik/jejak-akses',
    '/app/emedik/pelepasan',
    '/app/emedik/telaah-darurat',
    '/app/emedik/mutu',
    '/app/emedik/keselamatan',
    '/app/emedik/klaim',
    '/app/emedik/telaah-klaim',
    '/app/emedik/bpjs',
    '/app/emedik/sep',
    '/app/emedik/kepesertaan',
    '/app/emedik/tarif',
    '/app/emedik/kebijakan-jasa',
    '/app/emedik/kontributor',
    '/app/emedik/settlement',
    '/app/emedik/distribusi',
    '/app/emedik/pernyataan',
    '/app/emedik/kontrak-fee'
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
      'H063: utas berikut tidak cocok dengan menu mana pun: %. Utas yang salah ketik akan '
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

  RAISE NOTICE 'H063: % menu berlayar, % menu masih segera hadir.', n_siap, n_belum;
END $$;
