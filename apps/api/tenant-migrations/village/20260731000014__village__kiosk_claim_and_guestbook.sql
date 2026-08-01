-- =========================================================================
-- VILLAGE D-13 — ANJUNGAN MANDIRI DESA
-- =========================================================================
--
-- ## Anjungan tidak pernah mencari warga
--
-- Anjungan adalah layar sentuh di ruang tunggu kantor desa. Siapa pun dapat
-- berdiri di depannya, dan tidak ada seorang pun yang menjaganya sepanjang
-- hari.
--
-- Karena itu ia hanya dapat membuka **satu** berkas, dan hanya bila pengunjung
-- memegang **kode ambil** yang diberikan saat berkasnya diajukan. Tidak ada
-- pencarian nama, tidak ada pencarian NIK.
--
-- Anjungan yang dapat dicari berdasarkan nama bukan anjungan layanan; ia
-- terminal kependudukan yang diletakkan di ruang publik.
--
-- ## Kode ambil dibatasi percobaannya
--
-- Terminal di ruang publik akan ditekan-tekan orang yang menunggu. Tanpa batas
-- percobaan, kode delapan huruf dapat ditebak oleh orang yang cukup sabar — dan
-- orang yang menunggu di kantor desa punya banyak waktu. Penguncian ditegakkan
-- kolom, bukan ingatan layanan.
--
-- ## Buku tamu tidak meminta NIK
--
-- Yang diwajibkan hanya nama dan keperluan. Meminta NIK pada layar terbuka di
-- ruang tunggu berarti mengumpulkan nomor induk warga di tempat yang paling
-- mudah dilihat orang lain, untuk keperluan yang tidak memerlukannya. Kolomnya
-- tidak disediakan.

-- ---------------------------------------------------------------------------
-- Kode ambil
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_kiosk_claim (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  -- Delapan huruf dari abjad tanpa 0, O, 1, I, L — pasangan yang paling sering
  -- tertukar pada cetakan kecil yang dibaca sambil berdiri.
  claim_code      CHAR(8) NOT NULL,

  subject_type    VARCHAR(24) NOT NULL,
  service_request_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_service_request (id) ON DELETE CASCADE,
  complaint_id    UUID REFERENCES "{{TENANT_SCHEMA}}".village_complaint (id) ON DELETE CASCADE,

  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,

  -- Penguncian ditegakkan kolom, bukan ingatan layanan: proses yang di-restart
  -- akan melupakan penghitung yang disimpan di memori.
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  kiosk_print_count INTEGER NOT NULL DEFAULT 0,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_kiosk_claim_subject_valid
    CHECK (subject_type IN ('PERMOHONAN', 'PENGADUAN')),
  -- Kode hanya memakai abjad yang disepakati. Kode yang memuat huruf lain
  -- berarti ia dibuat jalur lain yang tidak mengikuti aturannya.
  CONSTRAINT village_kiosk_claim_alphabet
    CHECK (claim_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),
  -- Satu kode menunjuk tepat satu berkas.
  CONSTRAINT village_kiosk_claim_exactly_one_subject
    CHECK (
      (subject_type = 'PERMOHONAN' AND service_request_id IS NOT NULL AND complaint_id IS NULL)
      OR (subject_type = 'PENGADUAN' AND complaint_id IS NOT NULL AND service_request_id IS NULL)
    ),
  CONSTRAINT village_kiosk_claim_attempts_not_negative CHECK (failed_attempts >= 0),
  CONSTRAINT village_kiosk_claim_print_not_negative CHECK (kiosk_print_count >= 0),
  -- Cetak mandiri dibatasi. Surat keterangan yang beredar dalam sepuluh salinan
  -- asli tidak lagi dapat dipakai membuktikan apa pun, sebab tidak ada yang
  -- tahu berapa yang masih berlaku.
  CONSTRAINT village_kiosk_claim_print_capped CHECK (kiosk_print_count <= 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_kiosk_claim_code_unique
  ON "{{TENANT_SCHEMA}}".village_kiosk_claim (village_unit_id, claim_code)
  WHERE revoked_at IS NULL;

-- Satu berkas, satu kode yang berlaku. Dua kode atas berkas yang sama berarti
-- warga yang kehilangan kertasnya memperoleh kode kedua sementara yang pertama
-- masih dapat dipakai orang yang menemukannya.
CREATE UNIQUE INDEX IF NOT EXISTS village_kiosk_claim_request_unique
  ON "{{TENANT_SCHEMA}}".village_kiosk_claim (service_request_id)
  WHERE service_request_id IS NOT NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS village_kiosk_claim_complaint_unique
  ON "{{TENANT_SCHEMA}}".village_kiosk_claim (complaint_id)
  WHERE complaint_id IS NOT NULL AND revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Buku tamu
-- ---------------------------------------------------------------------------
-- Perhatikan apa yang TIDAK ada: tidak ada kolom NIK, tidak ada alamat, tidak
-- ada rujukan ke village_resident. Buku tamu adalah catatan siapa yang datang
-- hari ini, bukan pendaftaran kependudukan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_guest_book (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  guest_name      VARCHAR(120) NOT NULL,
  purpose         VARCHAR(24) NOT NULL,
  phone           VARCHAR(24),
  institution     VARCHAR(160),
  note            TEXT,

  visited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Anjungan mana yang dipakai. Berguna saat memeriksa anjungan yang rusak.
  kiosk_code      VARCHAR(48),
  -- Diisi petugas bila tamunya dilayani, untuk rekap kunjungan.
  served_by       UUID,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_guest_book_purpose_valid
    CHECK (purpose IN ('LAYANAN_SURAT','PENGADUAN','KONSULTASI','PEMBAYARAN','BERTAMU','LAINNYA')),
  CONSTRAINT village_guest_book_name_present CHECK (length(btrim(guest_name)) >= 2)
);

CREATE INDEX IF NOT EXISTS village_guest_book_date_idx
  ON "{{TENANT_SCHEMA}}".village_guest_book (village_unit_id, visited_at DESC);

-- ---------------------------------------------------------------------------
-- Absensi ronda
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_patrol_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  patrol_schedule_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_patrol_schedule (id) ON DELETE SET NULL,
  linmas_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_linmas_member (id) ON DELETE SET NULL,

  member_name     VARCHAR(200) NOT NULL,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at  TIMESTAMPTZ,
  channel         VARCHAR(16) NOT NULL DEFAULT 'ANJUNGAN',
  kiosk_code      VARCHAR(48),
  note            TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_patrol_attendance_channel_valid
    CHECK (channel IN ('ANJUNGAN','MOBILE','MANUAL')),
  CONSTRAINT village_patrol_attendance_period
    CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
);

-- Satu anggota satu kehadiran per jadwal.
CREATE UNIQUE INDEX IF NOT EXISTS village_patrol_attendance_once
  ON "{{TENANT_SCHEMA}}".village_patrol_attendance (patrol_schedule_id, member_name)
  WHERE patrol_schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS village_patrol_attendance_date_idx
  ON "{{TENANT_SCHEMA}}".village_patrol_attendance (village_unit_id, checked_in_at DESC);

-- ---------------------------------------------------------------------------
-- Pemicu audit
-- ---------------------------------------------------------------------------
-- `village_kiosk_claim` ikut diaudit: ia menyimpan jejak percobaan dan
-- pencetakan, dan pertanyaan "siapa mencetak surat ini tiga kali" harus dapat
-- dijawab. Berbeda dari `village_kiosk_session` pada D-10, yang justru berisi
-- jejak layar yang wajib dihapus.
DO $install$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi audit tidak ada; pemicu audit anjungan dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}' AND c.relkind = 'r'
       AND c.relname IN (
         'village_kiosk_claim', 'village_guest_book', 'village_patrol_attendance'
       )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I',
      r.table_name, '{{TENANT_SCHEMA}}'
    );
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      r.table_name, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END
$install$;
