-- =========================================================================
-- H057 — ZONA DATA, TELAAH BREAK-GLASS, DAN PENJAGA AI
-- =========================================================================
--
-- Fase H-12. Aditif seluruhnya.
--
-- ## Ke mana perginya H055 dan H056
--
-- Keduanya hangus, dan sebabnya perlu dicatat di sini sebab tidak ada tempat
-- lain yang akan menyimpannya.
--
-- H055 adalah berkas ini, dengan satu keliru: `access_log_id` ditulis UUID,
-- padahal `health_access_log.id` adalah BIGINT. Basis data menolaknya —
-- penolakan yang paling baik, sebab tidak mungkin lolos. Tetapi ketika
-- kelirunya diperbaiki dan migrasi dijalankan ulang, penjaga checksum
-- menolaknya pula: **percobaan yang GAGAL sudah menuliskan checksum-nya pada
-- riwayat, dan penjaga itu tidak membedakan GAGAL dari BERHASIL.**
--
-- Nomor yang pernah gagal karena itu tidak dapat dipakai ulang. H056 ikut
-- diganti sekadar supaya keduanya tetap berdampingan.
--
-- Cacat penjaganya ada pada Core bersama, dan diajukan lewat
-- `docs/integration-requests/health/005-riwayat-migrasi-gagal-mengunci-versi.md`
-- — tidak diperbaiki dari sini. Yang perlu diketahui pembaca migrasi ini
-- hanyalah bahwa H055 dan H056 tidak pernah ada isinya pada satu skema pun.
--
-- ## Apa yang TIDAK ditambahkan migrasi ini, dan mengapa
--
-- Ia tidak menambahkan pencatatan akses. `health_access_log` sudah ada sejak
-- H002, lengkap dengan `purpose_of_use`, `break_glass`, dan
-- `break_glass_reason`. Menambahkan tabel kedua yang mencatat hal yang sama
-- akan menghasilkan dua jawaban berbeda atas pertanyaan "siapa membuka rekam
-- medis ini", dan yang bertanya tidak akan tahu mana yang benar.
--
-- Yang ditambahkannya adalah **telaahnya** — bagian yang selama sebelas fase
-- tidak pernah dibangun, sekalipun setiap fase mencatat aksesnya dengan rajin.
--
-- ## Break-glass: dua sifat yang harus ada bersama
--
-- Break-glass **tidak pernah ditolak**, dan **selalu ditelaah**.
--
-- Yang pertama tanpa yang kedua adalah pintu belakang yang dipakai setiap hari
-- oleh orang yang merasa lebih cepat begitu. Yang kedua tanpa yang pertama
-- akan menghentikan dokter yang sedang menangani pasien tidak sadarkan diri —
-- dan perangkat lunak tidak berada pada posisi untuk menilai apakah keadaannya
-- sungguh darurat.
--
-- Karena itu tidak ada satu pun constraint di sini yang MENAHAN break-glass.
-- Seluruhnya menahan hal lain: menahan telaahnya dihapus, menahan telaahnya
-- diubah, dan menahan seseorang menelaah aksesnya sendiri.
--
-- ## Penggolongan medan sebagai baris, bukan sebagai tetapan pada kode
--
-- Sama alasannya dengan daftar izin pembersihan pada H052: penggolongan yang
-- ada di kode dapat diubah seseorang bersamaan dengan mengubah kueri yang
-- membacanya, dan keduanya akan lolos telaah sebagai satu perubahan yang
-- tampak wajar. Penggolongan yang ada di baris meninggalkan jejak audit.

-- ---------------------------------------------------------------------------
-- Zona data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_data_zone (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code            VARCHAR(32) NOT NULL,
  name            VARCHAR(128) NOT NULL,
  /*
   * BUKAN "tingkat kerahasiaan 1/2/3".
   *
   * Tingkat bernomor ditafsirkan sendiri oleh setiap orang yang membacanya.
   * Yang dicatat di sini adalah AKIBAT KEBOCORANNYA — satu-satunya pertanyaan
   * yang jawabannya benar-benar menentukan perlakuannya.
   */
  breach_impact   TEXT NOT NULL,

  allowed_to_ai   BOOLEAN NOT NULL,
  requires_purpose BOOLEAN NOT NULL,
  masked_on_export BOOLEAN NOT NULL,

  is_system       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT data_zone_code_valid CHECK (
    code IN ('PUBLIC', 'OPERATIONAL', 'IDENTIFYING', 'CLINICAL', 'SENSITIVE_CLINICAL')
  ),
  CONSTRAINT data_zone_impact_meaningful CHECK (length(trim(breach_impact)) >= 30),
  /*
   * Zona yang tidak boleh ke AI SELALU disamarkan pada ekspor.
   *
   * Kedua medan itu tampak terpisah dan sesungguhnya tidak: keduanya menjawab
   * "bolehkah ia keluar dari sini". Zona yang terlarang bagi AI tetapi bebas
   * pada ekspor adalah zona yang aman dari model bahasa dan terbuka bagi
   * berkas Excel — dan berkas Excel jauh lebih sering dikirimkan lewat surel.
   */
  CONSTRAINT data_zone_ai_implies_mask CHECK (
    allowed_to_ai = TRUE OR masked_on_export = TRUE
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_data_zone_code
  ON "{{TENANT_SCHEMA}}".health_data_zone (code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Penggolongan medan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_field_classification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  table_name      VARCHAR(128) NOT NULL,
  column_name     VARCHAR(128) NOT NULL,
  zone_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_data_zone (id) ON DELETE RESTRICT,

  note            TEXT,

  is_system       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT field_class_name_lower CHECK (
    table_name = lower(table_name) AND column_name = lower(column_name)
  )
);

/*
 * Satu medan, satu zona.
 *
 * Medan yang tergolong dua zona akan diperlakukan menurut zona yang kebetulan
 * terbaca lebih dahulu — dan urutan baca tidak dijamin siapa pun.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_field_class_table_column
  ON "{{TENANT_SCHEMA}}".health_field_classification (table_name, column_name)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Telaah break-glass
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_break_glass_review (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  /*
   * BIGINT, bukan UUID — dan ini bukan pilihan melainkan keharusan.
   *
   * `health_access_log.id` adalah BIGINT, satu-satunya di antara puluhan tabel
   * kesehatan yang bukan UUID. Alasannya masuk akal: ia bertambah beberapa
   * baris setiap kali seseorang membuka satu halaman, dan kunci berurutan pada
   * tabel sebesar itu jauh lebih murah untuk diindeks.
   *
   * Rancangan pertama menuliskannya UUID — mengikuti pola, bukan membaca
   * skema — dan basis datalah yang menolaknya. Itu jenis penolakan yang paling
   * baik: keliru yang tidak mungkin lolos.
   */
  access_log_id   BIGINT NOT NULL
                    REFERENCES "{{TENANT_SCHEMA}}".health_access_log (id) ON DELETE RESTRICT,

  reviewed_by     UUID NOT NULL,
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  verdict         VARCHAR(32) NOT NULL,
  /*
   * Catatan telaah WAJIB dan panjang.
   *
   * Telaah yang boleh berisi "ok" adalah telaah yang akan berisi "ok" — dan
   * seratus baris berisi "ok" tidak dapat dibedakan dari seratus baris yang
   * tidak pernah dibaca.
   */
  notes           TEXT NOT NULL,

  /*
   * Diisi hanya bila putusannya NOT_JUSTIFIED atau NEEDS_INVESTIGATION.
   * Telaah yang menemukan sesuatu tanpa menyebutkan langkah berikutnya
   * berhenti pada dirinya sendiri.
   */
  follow_up       TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bg_review_verdict_valid CHECK (
    verdict IN ('JUSTIFIED', 'NOT_JUSTIFIED', 'NEEDS_INVESTIGATION')
  ),
  CONSTRAINT bg_review_notes_meaningful CHECK (length(trim(notes)) >= 20),
  CONSTRAINT bg_review_followup_when_adverse CHECK (
    verdict = 'JUSTIFIED'
    OR (follow_up IS NOT NULL AND length(trim(follow_up)) >= 10)
  )
);

/*
 * Satu akses, satu telaah.
 *
 * Tanpa ini, akses yang putusannya tidak disukai dapat ditelaah ulang sampai
 * putusannya berubah — dan riwayatnya akan memperlihatkan dua baris yang
 * keduanya sah.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_bg_review_access
  ON "{{TENANT_SCHEMA}}".health_break_glass_review (access_log_id);

CREATE INDEX IF NOT EXISTS ix_bg_review_verdict
  ON "{{TENANT_SCHEMA}}".health_break_glass_review (verdict, reviewed_at DESC);

-- ---------------------------------------------------------------------------
-- Penjaga AI: yang DITOLAK, bukan yang dikirim
-- ---------------------------------------------------------------------------
--
-- AI Gateway bersama sudah mencatat permintaan yang DIKIRIM. Yang tidak
-- dicatatnya, dan tidak dapat dicatatnya, adalah permintaan yang tidak pernah
-- sampai kepadanya — sebab ia ditahan lebih dahulu.
--
-- Justru itu yang perlu dilihat orang: seorang petugas yang tiga puluh kali
-- mencoba mengirim rekam medis ke model bahasa tidak muncul sama sekali pada
-- log gateway, dan tampak sebagai pengguna yang tidak pernah memakai AI.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_ai_guard_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  actor_user_id   UUID,
  facility_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE SET NULL,

  zone_code       VARCHAR(32) NOT NULL,
  feature         VARCHAR(64) NOT NULL,

  outcome         VARCHAR(16) NOT NULL,
  reason          TEXT NOT NULL,

  /* Berapa pola yang disamarkan — bukan APA yang disamarkan. */
  redaction_count INTEGER NOT NULL DEFAULT 0,
  /*
   * TIDAK ADA KOLOM UNTUK TEKSNYA.
   *
   * Log yang menyimpan teks permintaan yang ditolak akan menyimpan persis
   * data yang penolakannya bermaksud melindungi — dan menyimpannya pada tabel
   * yang haknya lebih longgar daripada rekam medis.
   */
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ai_guard_outcome_valid CHECK (outcome IN ('ALLOWED', 'BLOCKED')),
  CONSTRAINT ai_guard_reason_meaningful CHECK (length(trim(reason)) >= 10),
  CONSTRAINT ai_guard_redaction_nonneg CHECK (redaction_count >= 0)
);

CREATE INDEX IF NOT EXISTS ix_ai_guard_outcome
  ON "{{TENANT_SCHEMA}}".health_ai_guard_log (outcome, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_ai_guard_actor
  ON "{{TENANT_SCHEMA}}".health_ai_guard_log (actor_user_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Telaah tidak dapat diubah, tidak dapat dihapus
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_review_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'REVIEW_APPEND_ONLY: telaah break-glass tidak dapat diubah atau dihapus. '
    'Telaah yang dapat diubah adalah telaah yang akan diubah ketika putusannya '
    'tidak disukai. Bila putusan sebelumnya keliru, catat temuan baru pada '
    'safety_incident — bukan dengan menyunting yang lama.'
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bg_review_append_only
  ON "{{TENANT_SCHEMA}}".health_break_glass_review;
CREATE TRIGGER trg_bg_review_append_only
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".health_break_glass_review
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_review_mutation();

-- ---------------------------------------------------------------------------
-- Tidak menelaah aksesnya sendiri, dan tidak menelaah yang bukan break-glass
-- ---------------------------------------------------------------------------
--
-- ## Mengapa ini trigger, dan BUKAN aturan pemisahan wewenang
--
-- Pola yang sama sudah muncul lima kali pada fase-fase sebelumnya (H-9E, H-9G,
-- H-9C, H-9H, H-9K), dan inilah kemunculan keenamnya:
--
-- > Sebagian pemisahan wewenang adalah hubungan antara SATU ORANG dan SATU
-- > BARIS, bukan antara dua hak akses.
--
-- Setiap penelaah break-glass memegang hak yang sama. Tidak ada dua hak yang
-- dapat dipertentangkan. Yang terlarang bukan "orang ini memegang dua hak",
-- melainkan "orang ini menelaah baris yang aktornya dirinya sendiri" — dan
-- tidak ada daftar hak akses yang dapat menyatakan itu.
--
-- Mendaftarkannya sebagai pasangan hak yang bertentangan justru akan
-- melumpuhkan telaahnya: satu-satunya cara memenuhinya adalah mencabut hak
-- telaah dari seluruh dokter, dan yang paling memahami apakah suatu akses
-- darurat wajar adalah dokter.
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".check_break_glass_review()
RETURNS TRIGGER AS $$
DECLARE
  log_break_glass BOOLEAN;
  log_actor UUID;
BEGIN
  SELECT a.break_glass, a.actor_user_id
    INTO log_break_glass, log_actor
    FROM "{{TENANT_SCHEMA}}".health_access_log a
   WHERE a.id = NEW.access_log_id;

  IF log_break_glass IS NULL THEN
    RAISE EXCEPTION 'REVIEW_LOG_NOT_FOUND: baris akses % tidak ada.', NEW.access_log_id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF log_break_glass = FALSE THEN
    RAISE EXCEPTION
      'REVIEW_NOT_BREAK_GLASS: baris akses ini bukan akses darurat. Menelaah '
      'akses biasa satu per satu akan menenggelamkan yang darurat di antara '
      'ribuan yang wajar — dan yang menelaahnya berhenti pada halaman kedua.'
      USING ERRCODE = 'raise_exception';
  END IF;

  IF log_actor IS NOT NULL AND log_actor = NEW.reviewed_by THEN
    RAISE EXCEPTION
      'REVIEW_SELF_FORBIDDEN: tidak seorang pun menelaah akses daruratnya '
      'sendiri. Telaah yang dilakukan pelakunya sendiri selalu berbunyi wajar.'
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bg_review_check
  ON "{{TENANT_SCHEMA}}".health_break_glass_review;
CREATE TRIGGER trg_bg_review_check
  BEFORE INSERT ON "{{TENANT_SCHEMA}}".health_break_glass_review
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".check_break_glass_review();

-- ---------------------------------------------------------------------------
-- Isi zona
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".health_data_zone
  (code, name, breach_impact, allowed_to_ai, requires_purpose, masked_on_export)
SELECT v.code, v.name, v.impact, v.ai, v.purpose, v.mask
  FROM (VALUES
    ('PUBLIC', 'Publik',
     'Tidak ada akibat: ia memang diterbitkan. Jam praktik, nama poliklinik, alamat.',
     TRUE, FALSE, FALSE),
    ('OPERATIONAL', 'Operasional',
     'Merugikan fasilitas, tidak merugikan pasien. Tarif, jadwal alat, jumlah tempat tidur.',
     TRUE, FALSE, FALSE),
    ('IDENTIFYING', 'Mengenali orang',
     'Menyingkap SIAPA. Nama, NIK, nomor rekam medis, alamat, nomor telepon. Ia belum menyebut penyakit apa pun — dan justru karena itu sering dianggap tidak berbahaya, padahal ia kunci yang membuka seluruh sisanya.',
     FALSE, TRUE, TRUE),
    ('CLINICAL', 'Klinis',
     'Menyingkap APA. Diagnosis, tindakan, resep, hasil laboratorium. Bergabung dengan zona yang mengenali orang, ia menjadi rekam medis yang utuh.',
     FALSE, TRUE, TRUE),
    ('SENSITIVE_CLINICAL', 'Klinis sangat sensitif',
     'Menyingkap apa yang membuat orang kehilangan pekerjaan, keluarga, atau nyawanya. HIV, kesehatan jiwa, kekerasan seksual, penyalahgunaan zat, kehamilan pada keadaan tertentu, genetika. Kebocorannya tidak dapat dipulihkan dengan permintaan maaf.',
     FALSE, TRUE, TRUE)
  ) AS v(code, name, impact, ai, purpose, mask)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".health_data_zone z WHERE z.code = v.code
 );

-- ---------------------------------------------------------------------------
-- Isi penggolongan medan
-- ---------------------------------------------------------------------------
--
-- ## Migrasi ini GAGAL bila satu saja kolomnya tidak ada
--
-- Rancangan pertamanya melewati kolom yang tidak ditemukan dan mencatatnya
-- sebagai NOTICE. Rancangan itu dibuang sesudah diuji ke skema sungguhan:
-- **dua belas dari dua puluh nama kolomnya keliru** — ditulis dari ingatan,
-- bukan dari skema — dan yang keliru justru yang terpenting, yaitu NIK, nomor
-- rekam medis, isi catatan klinis, dan kode diagnosis.
--
-- Yang dihasilkannya bukan daftar yang kurang lengkap, melainkan sesuatu yang
-- lebih buruk: **daftar yang tampak penuh.** Delapan baris terpasang, tidak
-- ada galat, dan siapa pun yang membuka layar penggolongan akan melihat
-- perlindungan yang berdiri — padahal medan yang paling perlu dilindungi tidak
-- ada di dalamnya sama sekali.
--
-- Pelajaran H037 berlaku persis di sini, dan lebih tajam: lewatan yang diam
-- lebih buruk daripada kegagalan yang berisik. Seluruh tenant menjalankan
-- rantai migrasi yang sama, jadi kolom yang ada pada satu skema ada pada
-- semuanya — tidak ada tenant sah yang akan tertahan oleh pemeriksaan ini.
DO $$
DECLARE
  baris RECORD;
  z_id UUID;
  ada BOOLEAN;
  hilang TEXT := '';
  dipasang INTEGER := 0;
BEGIN
  FOR baris IN
    SELECT * FROM (VALUES
      -- ---- Mengenali orang -------------------------------------------------
      ('patient', 'full_name', 'IDENTIFYING', NULL),
      ('patient', 'preferred_name', 'IDENTIFYING', NULL),
      ('patient', 'birth_date', 'IDENTIFYING',
       'Tanggal lahir digolongkan mengenali orang, bukan operasional. Bergabung dengan nama dan kode pos, ia mengenali seseorang secara tunggal pada sebagian besar populasi.'),
      ('patient', 'birth_place', 'IDENTIFYING', NULL),
      ('patient', 'phone', 'IDENTIFYING', NULL),
      ('patient', 'email', 'IDENTIFYING', NULL),
      ('patient', 'address_text', 'IDENTIFYING', NULL),
      ('patient_identifier', 'identifier_value', 'IDENTIFYING',
       'Satu kolom ini memuat NIK, nomor rekam medis, dan nomor kepesertaan sekaligus — ketiganya dibedakan oleh identifier_type, bukan oleh kolom yang berbeda.'),
      ('patient_proxy', 'proxy_name', 'IDENTIFYING', NULL),

      -- ---- Klinis ----------------------------------------------------------
      ('clinical_note', 'subjective', 'CLINICAL', NULL),
      ('clinical_note', 'objective', 'CLINICAL', NULL),
      ('clinical_note', 'assessment', 'CLINICAL', NULL),
      ('clinical_note', 'plan', 'CLINICAL', NULL),
      ('clinical_note', 'free_text', 'CLINICAL', NULL),
      ('clinical_note', 'sensitivity', 'CLINICAL',
       'KETERBATASAN YANG DINYATAKAN: kolom inilah yang menaikkan SATU BARIS catatan ke zona sangat sensitif (NORMAL/RESTRICTED/VERY_RESTRICTED). Daftar penggolongan ini bekerja per KOLOM dan tidak dapat menyatakan kepekaan per BARIS. Jadi kepekaan sesungguhnya sebuah catatan adalah yang tertinggi antara zona kolomnya dan nilai kolom ini.'),
      ('encounter_diagnosis', 'code', 'CLINICAL', NULL),
      ('encounter_diagnosis', 'description', 'CLINICAL', NULL),
      ('lab_result', 'value_numeric', 'CLINICAL', NULL),
      ('lab_result', 'value_text', 'CLINICAL', NULL),
      ('lab_result', 'impression', 'CLINICAL', NULL),
      ('rx_prescription_line', 'instruction', 'CLINICAL', NULL),
      ('patient_allergy', 'allergen_name', 'CLINICAL', NULL),
      ('patient_allergy', 'reaction', 'CLINICAL', NULL),

      -- ---- Klinis sangat sensitif -----------------------------------------
      ('patient', 'safety_alert', 'SENSITIVE_CLINICAL',
       'Penanda keselamatan memuat keterangan tentang kekerasan, ancaman, atau keadaan yang membuat pasien perlu dilindungi. Kebocorannya dapat mempertemukan seseorang dengan orang yang dihindarinya.'),
      ('patient', 'deceased_note', 'SENSITIVE_CLINICAL', NULL),

      -- ---- Operasional -----------------------------------------------------
      ('jkn_tariff', 'amount', 'OPERATIONAL', NULL),
      ('health_facility', 'license_number', 'OPERATIONAL', NULL),

      -- ---- Publik ----------------------------------------------------------
      ('health_facility', 'name', 'PUBLIC', NULL),
      ('health_facility', 'short_name', 'PUBLIC', NULL),
      ('facility_web_content', 'title', 'PUBLIC', NULL),
      ('facility_web_content', 'body', 'PUBLIC',
       'Isi halaman website memang diterbitkan — dan justru karena itu ia perlu ditelaah: halaman yang memuat nama pasien pada testimoni akan menerbitkan zona yang mengenali orang lewat pintu yang paling terbuka.')
    ) AS t(tabel, kolom, zona, catatan)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns c
       WHERE c.table_schema = '{{TENANT_SCHEMA}}'
         AND c.table_name = baris.tabel
         AND c.column_name = baris.kolom
    ) INTO ada;

    IF NOT ada THEN
      hilang := hilang || baris.tabel || '.' || baris.kolom || ' ';
      CONTINUE;
    END IF;

    SELECT id INTO z_id FROM "{{TENANT_SCHEMA}}".health_data_zone
      WHERE code = baris.zona AND deleted_at IS NULL;

    IF z_id IS NULL THEN
      RAISE EXCEPTION 'Zona % tidak ada sesudah pengisian zona.', baris.zona;
    END IF;

    INSERT INTO "{{TENANT_SCHEMA}}".health_field_classification
      (table_name, column_name, zone_id, note)
    VALUES (baris.tabel, baris.kolom, z_id, baris.catatan)
    ON CONFLICT DO NOTHING;
    dipasang := dipasang + 1;
  END LOOP;

  IF hilang <> '' THEN
    RAISE EXCEPTION
      'H057: kolom berikut tidak ada pada skema ini: %. Penggolongan yang menunjuk kolom yang '
      'tidak ada adalah pintu terkunci pada dinding kosong: ia terlihat sebagai perlindungan, '
      'dan tidak menjaga apa pun.', hilang
      USING ERRCODE = 'raise_exception';
  END IF;

  RAISE NOTICE 'H057: % medan digolongkan.', dipasang;
END $$;
