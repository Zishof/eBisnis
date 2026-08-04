-- =========================================================================
-- H062 — MENU BERLAYAR W-3
-- =========================================================================
--
-- Fase W-3 (layar klaim dan BPJS). Aditif seluruhnya; pola sama dengan
-- H059-H061.
--
-- ## Menu yang menunjuk layar yang sama
--
-- `telaah-klaim` menunjuk layar klaim, dan `sep` serta `kepesertaan` menunjuk
-- layar BPJS. Bukan kemalasan: penelaah membuka klaim yang sama dengan yang
-- dibuka petugas, hanya menekan tombol yang berbeda. Dua layar untuk satu
-- berkas berarti dua tempat yang harus tetap sepakat — dan pada saatnya salah
-- satunya akan tertinggal.

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
    -- W-3: klaim dan BPJS.
    '/app/emedik/klaim',
    '/app/emedik/telaah-klaim',
    '/app/emedik/bpjs',
    '/app/emedik/sep',
    '/app/emedik/kepesertaan'
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
      'H062: utas berikut tidak cocok dengan menu mana pun: %. Utas yang salah ketik akan '
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

  RAISE NOTICE 'H062: % menu berlayar, % menu masih segera hadir.', n_siap, n_belum;
END $$;
