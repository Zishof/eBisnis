-- =========================================================================
-- H065 — MENU BERLAYAR W-5
-- =========================================================================
--
-- Fase W-5 (layar alat medis). Aditif seluruhnya; pola sama dengan H059-H063.
--
-- ## Ke mana perginya H064
--
-- H064 adalah berkas ini dengan satu utas keliru: `/app/emedik/gateway-alat`,
-- padahal H034 menyemainya sebagai `/app/emedik/gateway`.
--
-- Yang menemukannya **penjaga migrasi ini sendiri** — bukan uji mana pun, dan
-- bukan pula manusia. Itu justru maksudnya: daftar utas yang salah ketik akan
-- menandai menu yang layarnya ADA sebagai "segera hadir", dan penggunanya
-- berhenti mengkliknya.
--
-- Sumber kekeliruannya `health-catalog.ts`, yang menuliskan `gateway-alat`.
-- Katalog itu hanya CERMINAN dari migrasi, bukan penyemainya — dan cerminan
-- yang berbeda dari aslinya lebih buruk daripada tidak ada cerminan, sebab ia
-- dipercaya. Katalognya kini dibetulkan dan dijaga naskah bukti kontrak.
--
-- Nomor H064 hangus sesuai cacat Core pada integration request 005: percobaan
-- yang GAGAL menuliskan checksum-nya, dan penjaga checksum tidak membedakan
-- GAGAL dari BERHASIL.
--
-- ## Tujuh utas untuk tiga layar
--
-- `gateway` menyatu dengan registri alat; `keamanan-alat` menyatu dengan
-- pemeliharaan; `pesan-alat`, `pemetaan-kode`, dan `hasil-alat` menyatu dengan
-- adapter.
--
-- Pada alat, alasan penyatuan itu lebih kuat daripada fase sebelumnya: teknisi
-- yang memeriksa ventilator menanyakan jadwal pemeliharaannya DAN risiko
-- keamanannya dalam satu kunjungan. Memisahkannya berarti ia mencari kode alat
-- yang sama dua kali, sambil berdiri di samping pasien.

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
    '/app/emedik/kontrak-fee',
    '/app/emedik/alat',
    '/app/emedik/gateway',
    '/app/emedik/pemeliharaan-alat',
    '/app/emedik/keamanan-alat',
    '/app/emedik/pesan-alat',
    '/app/emedik/pemetaan-kode',
    '/app/emedik/hasil-alat'
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
      'H065: utas berikut tidak cocok dengan menu mana pun: %. Utas yang salah ketik akan '
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

  RAISE NOTICE 'H065: % menu berlayar, % menu masih segera hadir.', n_siap, n_belum;
END $$;
