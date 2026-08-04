-- =========================================================================
-- H050 — PORTAL PASIEN DAN WEBSITE FASILITAS
-- =========================================================================
--
-- Fase H-10. Aditif seluruhnya.
--
-- ## Invarian yang menentukan seluruh fase ini
--
-- > **Pasien hanya melihat datanya sendiri; identitas dari token, tidak pernah
-- > dari parameter.**
--
-- Basis data menegakkan separuhnya: **satu akun portal menaut tepat satu
-- pasien**, dan akun itu menunjuk `platform_user_id` — yang sama dengan yang
-- ada pada token. Separuh yang lain ditegakkan lapisan HTTP, dan naskah bukti
-- memeriksanya dengan mengirim id pasien lain dari akun yang sah.
--
-- Akun yang menaut dua pasien akan membuat jejak akses tidak dapat dibaca: yang
-- tercatat adalah "akun ini membuka rekam medis", dan pertanyaan yang
-- sesungguhnya — *siapa yang membukanya* — tidak terjawab. Wali diselesaikan
-- lewat `patient_proxy` yang sudah ada sejak H-3, bukan lewat akun ganda: orang
-- tua yang membuka rekam medis anaknya **tetap dirinya sendiri** pada jejak
-- akses.
--
-- ## Yang sengaja TIDAK ada
--
-- Tidak ada tabel yang menyalin data klinis untuk portal. Portal membaca tabel
-- yang sama dengan yang dibaca petugas, lewat penyaring yang sama. Salinan
-- untuk portal akan berbeda dari aslinya dalam waktu satu minggu — dan yang
-- dibaca pasien adalah salinannya.

-- ---------------------------------------------------------------------------
-- Akun portal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_portal_account (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,

  /*
   * PENGGUNA PLATFORM YANG MEMILIKI AKUN INI.
   *
   * Inilah yang dicocokkan dengan token. Tidak ada kolom lain yang boleh
   * dipakai menentukan pasien mana yang dibaca.
   */
  platform_user_id UUID NOT NULL,

  status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  /*
   * VERIFIKASI TATAP MUKA.
   *
   * Akun portal yang dibuat tanpa verifikasi adalah rekam medis yang
   * diserahkan kepada siapa pun yang mengetahui tanggal lahir seseorang.
   */
  identity_verified_by UUID,
  identity_verified_at TIMESTAMPTZ,
  verification_method VARCHAR(32),

  activated_at    TIMESTAMPTZ,
  suspended_at    TIMESTAMPTZ,
  suspend_reason  TEXT,
  last_login_at   TIMESTAMPTZ,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT portal_account_status_valid CHECK (
    status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED')
  ),
  CONSTRAINT portal_account_method_valid CHECK (
    verification_method IS NULL
    OR verification_method IN ('IN_PERSON_ID', 'VIDEO_CALL', 'REGISTERED_LETTER', 'OTHER')
  ),
  /*
   * AKUN AKTIF WAJIB TERVERIFIKASI TATAP MUKA.
   *
   * Bukan boleh; wajib. Yang membedakan portal pasien dari kebocoran adalah
   * satu langkah ini.
   */
  CONSTRAINT portal_account_active_verified CHECK (
    status <> 'ACTIVE'
    OR (identity_verified_by IS NOT NULL AND identity_verified_at IS NOT NULL
        AND verification_method IS NOT NULL AND activated_at IS NOT NULL)
  ),
  CONSTRAINT portal_account_suspend_reason CHECK (
    suspended_at IS NULL OR (suspend_reason IS NOT NULL AND length(trim(suspend_reason)) >= 10)
  )
);

/*
 * SATU AKUN, SATU PASIEN — DAN SEBALIKNYA.
 *
 * Dua indeks unik, bukan satu. Yang pertama menahan satu pengguna menaut dua
 * pasien; yang kedua menahan satu pasien punya dua akun. Keduanya berbeda, dan
 * hanya memasang salah satunya meninggalkan separuh pintunya terbuka.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_account_user
  ON "{{TENANT_SCHEMA}}".patient_portal_account (platform_user_id)
  WHERE status <> 'CLOSED';
CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_account_patient
  ON "{{TENANT_SCHEMA}}".patient_portal_account (patient_id)
  WHERE status <> 'CLOSED';

-- ---------------------------------------------------------------------------
-- Jejak akses portal
-- ---------------------------------------------------------------------------
-- Terpisah dari jejak akses petugas: yang ditanyakan berbeda. Pada petugas,
-- pertanyaannya "mengapa ia membuka rekam medis orang yang bukan pasiennya";
-- pada portal, pertanyaannya "apakah benar ia sendiri yang membukanya".
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_portal_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient_portal_account (id) ON DELETE RESTRICT,

  /*
   * PASIEN YANG DIBACA, DAN PERAN PEMBACANYA.
   *
   * Wali yang membuka rekam medis anaknya tercatat sebagai dirinya sendiri
   * (portal_account_id) yang membuka data anaknya (subject_patient_id) sebagai
   * PROXY. Ia tidak menjadi anaknya.
   */
  subject_patient_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  accessed_as     VARCHAR(8) NOT NULL,
  data_kind       VARCHAR(24) NOT NULL,
  outcome         VARCHAR(16) NOT NULL,
  deny_reason     TEXT,

  ip_hash         VARCHAR(128),
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT portal_log_as_valid CHECK (accessed_as IN ('SELF', 'PROXY')),
  CONSTRAINT portal_log_outcome_valid CHECK (outcome IN ('ALLOWED', 'DENIED')),
  CONSTRAINT portal_log_kind_valid CHECK (
    data_kind IN ('APPOINTMENT', 'QUEUE', 'VISIT_SUMMARY', 'LAB_RESULT',
                  'PRESCRIPTION', 'DIAGNOSIS', 'CLINICAL_NOTE')
  ),
  -- Yang ditolak wajib menyebutkan sebabnya. Penolakan tanpa sebab tidak
  -- dapat dibedakan dari kegagalan sistem, dan keduanya menuntut tindakan yang
  -- berbeda.
  CONSTRAINT portal_log_deny_reason CHECK (
    outcome <> 'DENIED' OR deny_reason IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_portal_log_account
  ON "{{TENANT_SCHEMA}}".patient_portal_access_log (portal_account_id, accessed_at DESC);
/*
 * PENOLAKAN DIINDEKS TERSENDIRI.
 *
 * Penolakan beruntun dari satu akun adalah tanda seseorang sedang mencoba
 * nomor pasien lain — dan yang mencarinya tidak boleh menyaring jutaan baris
 * yang berhasil untuk menemukan puluhan yang ditolak.
 */
CREATE INDEX IF NOT EXISTS ix_portal_log_denied
  ON "{{TENANT_SCHEMA}}".patient_portal_access_log (accessed_at DESC)
  WHERE outcome = 'DENIED';

DROP TRIGGER IF EXISTS trg_portal_log_no_delete ON "{{TENANT_SCHEMA}}".patient_portal_access_log;
CREATE TRIGGER trg_portal_log_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".patient_portal_access_log
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Pelepasan hasil ke portal
-- ---------------------------------------------------------------------------
-- Hasil kritis tidak tampil sampai dilepas dengan sengaja, dan pelepasan itu
-- dicatat: siapa, kapan, dan apakah pasiennya sudah dihubungi.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".portal_result_release (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_result_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_result (id) ON DELETE RESTRICT,

  released_by     UUID NOT NULL,
  released_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  was_critical    BOOLEAN NOT NULL DEFAULT FALSE,
  /*
   * APAKAH PASIENNYA SUDAH DIHUBUNGI.
   *
   * Wajib benar bila hasilnya kritis. Melepas hasil kritis ke portal tanpa
   * menghubungi pasiennya lebih dahulu adalah menyerahkan kabar buruk kepada
   * layar telepon — dan layar telepon tidak dapat menjawab pertanyaan.
   */
  patient_contacted BOOLEAN NOT NULL DEFAULT FALSE,
  contact_note    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT portal_release_critical_contacted CHECK (
    was_critical = FALSE
    OR (patient_contacted = TRUE AND contact_note IS NOT NULL AND length(trim(contact_note)) >= 10)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_release_result
  ON "{{TENANT_SCHEMA}}".portal_result_release (lab_result_id);

DROP TRIGGER IF EXISTS trg_portal_release_no_delete ON "{{TENANT_SCHEMA}}".portal_result_release;
CREATE TRIGGER trg_portal_release_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".portal_result_release
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Konten website fasilitas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".facility_web_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  content_kind    VARCHAR(24) NOT NULL,
  slug            VARCHAR(120) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  summary         TEXT,
  body            TEXT,
  image_reference VARCHAR(255),

  -- Untuk konten yang menunjuk entitas nyata: dokter, layanan, unit.
  provider_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  service_unit_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,

  status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  published_from  TIMESTAMPTZ,
  published_until TIMESTAMPTZ,
  published_by    UUID,
  unpublished_by  UUID,
  unpublish_reason TEXT,

  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT web_content_kind_valid CHECK (
    content_kind IN ('FACILITY_PROFILE', 'DOCTOR', 'SERVICE', 'SCHEDULE', 'ARTICLE', 'ANNOUNCEMENT')
  ),
  CONSTRAINT web_content_status_valid CHECK (status IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED')),
  CONSTRAINT web_content_published_named CHECK (
    status <> 'PUBLISHED' OR (published_by IS NOT NULL AND published_from IS NOT NULL)
  ),
  CONSTRAINT web_content_period_sane CHECK (
    published_until IS NULL OR published_from IS NULL OR published_until > published_from
  ),
  -- Penarikan wajib beralasan. Yang menariknya sedang tergesa, dan yang
  -- bertanya kemudian tidak akan menemukan siapa pun yang ingat.
  CONSTRAINT web_content_unpublish_reason CHECK (
    status <> 'UNPUBLISHED' OR (unpublished_by IS NOT NULL AND unpublish_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_web_content_slug
  ON "{{TENANT_SCHEMA}}".facility_web_content (facility_id, slug);
CREATE INDEX IF NOT EXISTS ix_web_content_public
  ON "{{TENANT_SCHEMA}}".facility_web_content (facility_id, content_kind, sort_order)
  WHERE status = 'PUBLISHED';

/*
 * TABEL KONTEN TIDAK PUNYA SATU PUN KOLOM PASIEN.
 *
 * Tidak ada patient_id, tidak ada kunci asing ke tabel klinis mana pun. Website
 * dibaca tanpa masuk sama sekali; satu nama pasien yang lolos adalah
 * pelanggaran kerahasiaan medis yang tidak dapat ditarik kembali — mesin
 * pencari sudah menyalinnya sebelum ada yang menyadarinya.
 *
 * Kolom body dan summary berupa teks bebas, dan teks bebas dapat memuat apa
 * saja. Karena itu penyaringnya ada pada lapisan layanan, dan naskah bukti
 * memeriksa keduanya: ketiadaan kolomnya, dan penolakan teksnya.
 */

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_portal_account', 'patient_portal_access_log',
                           'portal_result_release', 'facility_web_content'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
