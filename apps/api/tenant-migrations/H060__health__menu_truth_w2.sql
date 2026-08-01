-- =========================================================================
-- H060 — MENU BERLAYAR W-2
-- =========================================================================
--
-- Fase W-2 (layar rekam medis dan telaah darurat). Aditif seluruhnya.
--
-- Melanjutkan pola H059: setiap fase layar menambahkan migrasi kecil yang
-- mengembalikan `is_coming_soon = FALSE` untuk utas yang baru dibangunnya.
--
-- Daftarnya tetap **daftar yang PUNYA layar**, bukan yang tidak. Satu daftar,
-- satu sumber kebenaran — dan ia gagal berisik bila satu utas pun tidak cocok,
-- sebab utas yang salah ketik akan menandai menu yang layarnya ada sebagai
-- "segera hadir", lalu penggunanya berhenti mengkliknya.
--
-- ## Catatan tentang `jejak-akses` dan `penahanan`
--
-- Keduanya menunjuk layar yang **sama**, dan itu disengaja: petugas rekam medis
-- yang menerima surat pengadilan menanyakan "siapa yang tidak boleh mengubah
-- berkas ini" dan "siapa yang sudah membacanya" dalam satu napas. Dua menu
-- menuju satu layar jauh lebih baik daripada satu layar yang harus dicari dua
-- kali dengan nomor pasien yang sama.

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
    -- W-2: rekam medis dan telaah darurat.
    '/app/emedik/koding',
    '/app/emedik/penahanan',
    '/app/emedik/jejak-akses',
    '/app/emedik/pelepasan',
    '/app/emedik/telaah-darurat'
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
      'H060: utas berikut tidak cocok dengan menu mana pun: %. Utas yang salah ketik akan '
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

  RAISE NOTICE 'H060: % menu berlayar, % menu masih segera hadir.', n_siap, n_belum;
END $$;
