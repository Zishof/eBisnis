-- =========================================================================
-- H005 — MENU, AKSI HAK AKSES, DAN PERAN KESEHATAN
-- =========================================================================
--
-- Ditemukan saat menjalankan naskah bukti alur H-2/H-3: seluruh endpoint
-- menjawab 403, dan sebabnya bukan pada penjaga hak akses melainkan pada
-- ketiadaan menunya. Katalog menu kesehatan ada sebagai berkas TypeScript,
-- tetapi tidak ada apa pun yang menyemainya ke tabel `menu` milik penyewa —
-- sehingga tidak ada satu pun hak akses kesehatan yang dapat diberikan kepada
-- peran mana pun.
--
-- Cacat ini tidak akan pernah tertangkap pengujian unit: katalognya benar,
-- layanannya benar, penjaganya benar. Yang tidak ada adalah barisnya.
--
-- Memakai penjaga NOT EXISTS, bukan ON CONFLICT. Indeks unik pada `menu.code`,
-- `permission_action.code`, dan `role.code` bersifat PARSIAL
-- (`WHERE deleted_at IS NULL`), dan indeks parsial tidak dapat dipakai Postgres
-- untuk menyimpulkan sasaran ON CONFLICT. Ketahuan saat migrasi ini gagal pada
-- seluruh tujuh belas skema sekaligus.
--
-- Disemai lewat migrasi, bukan lewat layanan penyemaian, supaya setiap penyewa
-- memperolehnya tanpa langkah tambahan — termasuk penyewa yang sudah ada.

-- ---------------------------------------------------------------------------
-- Aksi hak akses klinis
-- ---------------------------------------------------------------------------
-- Delapan aksi yang tidak punya padanan di perdagangan. Menyamakannya dengan
-- aksi umum akan menghilangkan artinya: "menyetujui" resep berbeda dari
-- "menyetujui" pesanan pembelian.
INSERT INTO "{{TENANT_SCHEMA}}".permission_action
  (code, name, name_key, action_type, requires_step_up, is_system, sort_order)
SELECT v.code, v.name, v.name_key, v.action_type, v.requires_step_up, TRUE, v.sort_order
  FROM (VALUES
    ('PRESCRIBE',            'Meresepkan',               'action.prescribe',            'WRITE',   FALSE, 100),
    ('DISPENSE',             'Menyerahkan Obat',         'action.dispense',             'WRITE',   FALSE, 101),
    ('VERIFY_RESULT',        'Memverifikasi Hasil',      'action.verify_result',        'APPROVE', FALSE, 102),
    ('ACKNOWLEDGE_CRITICAL', 'Menerima Hasil Kritis',    'action.acknowledge_critical', 'WRITE',   FALSE, 103),
    ('ADMIT',                'Menerima Rawat Inap',      'action.admit',                'WRITE',   FALSE, 104),
    ('DISCHARGE',            'Memulangkan',              'action.discharge',            'WRITE',   FALSE, 105),
    -- Akses darurat menuntut step-up: membuka rekam medis di luar hubungan
    -- perawatan adalah tindakan yang harus terasa berat, bukan satu klik.
    ('BREAK_GLASS',          'Akses Darurat',            'action.break_glass',          'READ',    TRUE,  106),
    ('MERGE_PATIENT',        'Menggabungkan Rekam Medis','action.merge_patient',        'WRITE',   TRUE,  107)
  ) AS v(code, name, name_key, action_type, requires_step_up, sort_order)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".permission_action p WHERE p.code = v.code
 );

-- ---------------------------------------------------------------------------
-- Menu kesehatan
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  akar_id UUID;
BEGIN
  INSERT INTO "{{TENANT_SCHEMA}}".menu
    (code, name, translation_key, route, icon, module_code, platform_target,
     path, level, is_coming_soon, is_system, sort_order)
  SELECT 'HEALTH', 'eMedik', 'menu.health', NULL, 'stethoscope', 'HEALTH', 'WEB',
         '/HEALTH', 0, FALSE, TRUE, 60
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = 'HEALTH'
   );

  SELECT id INTO akar_id FROM "{{TENANT_SCHEMA}}".menu WHERE code = 'HEALTH';

  INSERT INTO "{{TENANT_SCHEMA}}".menu
    (code, parent_id, name, translation_key, route, icon, module_code,
     platform_target, path, level, is_coming_soon, is_system, sort_order)
  SELECT v.code, akar_id, v.name, v.translation_key, v.route, v.icon, 'HEALTH',
         'WEB', v.path, 1, v.is_coming_soon, TRUE, v.sort_order
    FROM (VALUES
      ('HEALTH_FACILITY',          'Fasilitas',                   'menu.health.facility',     '/app/emedik/fasilitas',       'hospital',       '/HEALTH/HEALTH_FACILITY',          FALSE, 1),
      ('HEALTH_SERVICE_UNIT',      'Unit Layanan',                'menu.health.unit',         '/app/emedik/unit',            'layout-grid',    '/HEALTH/HEALTH_SERVICE_UNIT',      FALSE, 2),
      ('HEALTH_BED',               'Kamar dan Tempat Tidur',      'menu.health.bed',          '/app/emedik/tempat-tidur',    'bed',            '/HEALTH/HEALTH_BED',               FALSE, 3),
      ('HEALTH_PROVIDER',          'Pemberi Layanan',             'menu.health.provider',     '/app/emedik/pemberi-layanan', 'user-round',     '/HEALTH/HEALTH_PROVIDER',          FALSE, 4),
      ('HEALTH_PATIENT',           'Pasien',                      'menu.health.patient',      '/app/emedik/pasien',          'users',          '/HEALTH/HEALTH_PATIENT',           FALSE, 5),
      ('HEALTH_PATIENT_DUPLICATE', 'Dugaan Rekam Medis Ganda',    'menu.health.duplicate',    '/app/emedik/pasien/ganda',    'copy',           '/HEALTH/HEALTH_PATIENT_DUPLICATE', FALSE, 6),
      ('HEALTH_ACCESS_LOG',        'Jejak Pembacaan Rekam Medis', 'menu.health.access_log',   '/app/emedik/jejak-akses',     'eye',            '/HEALTH/HEALTH_ACCESS_LOG',        FALSE, 7),
      ('HEALTH_BILLING_TIER',      'Jenjang Tarif Pendaftaran',   'menu.health.billing',      '/app/emedik/tarif',           'receipt',        '/HEALTH/HEALTH_BILLING_TIER',      FALSE, 8),
      ('HEALTH_REGISTRATION',      'Pendaftaran dan Antrean',     'menu.health.registration', '/app/emedik/pendaftaran',     'clipboard-list', '/HEALTH/HEALTH_REGISTRATION',      FALSE, 9),
      ('HEALTH_ENCOUNTER',         'Rawat Jalan',                 'menu.health.encounter',    '/app/emedik/rawat-jalan',     'activity',       '/HEALTH/HEALTH_ENCOUNTER',         FALSE, 10),
      -- Ditandai sedang dibangun, BUKAN disembunyikan. Menu yang diklik lalu
      -- tidak menampilkan apa pun terasa seperti kerusakan; menu yang berkata
      -- "sedang dibangun" memberi tahu penyewa apa yang sedang dikerjakan.
      ('HEALTH_PHARMACY',          'Farmasi',                     'menu.health.pharmacy',     NULL, 'pill',          '/HEALTH/HEALTH_PHARMACY',   TRUE, 30),
      ('HEALTH_LABORATORY',        'Laboratorium',                'menu.health.lab',          NULL, 'flask-conical', '/HEALTH/HEALTH_LABORATORY', TRUE, 40),
      ('HEALTH_RADIOLOGY',         'Radiologi',                   'menu.health.radiology',    NULL, 'scan',          '/HEALTH/HEALTH_RADIOLOGY',  TRUE, 41),
      ('HEALTH_INPATIENT',         'Rawat Inap',                  'menu.health.inpatient',    NULL, 'bed-double',    '/HEALTH/HEALTH_INPATIENT',  TRUE, 50),
      ('HEALTH_EMERGENCY',         'IGD',                         'menu.health.emergency',    NULL, 'siren',         '/HEALTH/HEALTH_EMERGENCY',  TRUE, 60),
      ('HEALTH_PUSKESMAS',         'Puskesmas',                   'menu.health.puskesmas',    NULL, 'building-2',    '/HEALTH/HEALTH_PUSKESMAS',  TRUE, 70),
      ('HEALTH_POSYANDU',          'Posyandu',                    'menu.health.posyandu',     NULL, 'baby',          '/HEALTH/HEALTH_POSYANDU',   TRUE, 71),
      ('HEALTH_CLAIM',             'Klaim',                       'menu.health.claim',        NULL, 'file-text',     '/HEALTH/HEALTH_CLAIM',      TRUE, 80)
    ) AS v(code, name, translation_key, route, icon, path, is_coming_soon, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );
END $$;

-- ---------------------------------------------------------------------------
-- Aksi yang berlaku pada tiap menu
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pasangan RECORD;
  m_id UUID;
  a_id UUID;
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      ('HEALTH',                   'READ'),
      ('HEALTH_FACILITY',          'READ'), ('HEALTH_FACILITY', 'CREATE'),
      ('HEALTH_FACILITY',          'UPDATE'), ('HEALTH_FACILITY', 'DELETE'),
      ('HEALTH_SERVICE_UNIT',      'READ'), ('HEALTH_SERVICE_UNIT', 'CREATE'),
      ('HEALTH_SERVICE_UNIT',      'UPDATE'), ('HEALTH_SERVICE_UNIT', 'DELETE'),
      ('HEALTH_BED',               'READ'), ('HEALTH_BED', 'CREATE'),
      ('HEALTH_BED',               'UPDATE'), ('HEALTH_BED', 'DELETE'),
      ('HEALTH_PROVIDER',          'READ'), ('HEALTH_PROVIDER', 'CREATE'),
      ('HEALTH_PROVIDER',          'UPDATE'), ('HEALTH_PROVIDER', 'DELETE'),
      ('HEALTH_PROVIDER',          'ASSIGN'),
      ('HEALTH_PATIENT',           'READ'), ('HEALTH_PATIENT', 'CREATE'),
      ('HEALTH_PATIENT',           'UPDATE'), ('HEALTH_PATIENT', 'EXPORT'),
      ('HEALTH_PATIENT',           'MERGE_PATIENT'), ('HEALTH_PATIENT', 'BREAK_GLASS'),
      ('HEALTH_PATIENT_DUPLICATE', 'READ'), ('HEALTH_PATIENT_DUPLICATE', 'REVIEW'),
      ('HEALTH_PATIENT_DUPLICATE', 'MERGE_PATIENT'),
      -- Jejak pembacaan HANYA dapat dibaca dan diekspor. Jejak yang dapat
      -- disunting pihak yang diaudit tidak membuktikan apa pun.
      ('HEALTH_ACCESS_LOG',        'READ'), ('HEALTH_ACCESS_LOG', 'EXPORT'),
      ('HEALTH_BILLING_TIER',      'READ'), ('HEALTH_BILLING_TIER', 'UPDATE'),
      ('HEALTH_REGISTRATION',      'READ'), ('HEALTH_REGISTRATION', 'CREATE'),
      ('HEALTH_REGISTRATION',      'UPDATE'), ('HEALTH_REGISTRATION', 'CANCEL'),
      ('HEALTH_ENCOUNTER',         'READ'), ('HEALTH_ENCOUNTER', 'CREATE'),
      ('HEALTH_ENCOUNTER',         'UPDATE'), ('HEALTH_ENCOUNTER', 'PRESCRIBE')
    ) AS t(menu_code, action_code)
  LOOP
    SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu WHERE code = pasangan.menu_code;
    SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action WHERE code = pasangan.action_code;
    IF m_id IS NOT NULL AND a_id IS NOT NULL THEN
      INSERT INTO "{{TENANT_SCHEMA}}".menu_action (menu_id, permission_action_id)
      VALUES (m_id, a_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Peran bawaan kesehatan
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".role (code, name, description, is_system, is_core)
SELECT v.code, v.name, v.description, TRUE, FALSE
  FROM (VALUES
    ('HEALTH_ADMIN',                  'Administrator eMedik',
    'Mengelola fasilitas, unit layanan, pemberi layanan, dan konfigurasi tarif. TIDAK dapat membaca rekam medis pasien.'),
    ('HEALTH_DIRECTOR',               'Direktur / Kepala Fasilitas',
    'Memantau fasilitas dan menelaah akses darurat.'),
    ('HEALTH_REGISTRATION_CLERK',     'Petugas Pendaftaran',
    'Mendaftarkan pasien dan kunjungan. Tidak dapat menggabungkan rekam medis.'),
    ('HEALTH_MEDICAL_RECORD_OFFICER', 'Petugas Rekam Medis',
    'Menjaga mutu identitas pasien dan menggabungkan rekam medis ganda.'),
    ('HEALTH_DOCTOR',                 'Dokter',
    'Memberi layanan klinis kepada pasien yang dirawatnya.'),
    ('HEALTH_NURSE',                  'Perawat',
    'Memberi asuhan keperawatan kepada pasien yang dirawatnya.'),
    ('HEALTH_QUALITY_MANAGER',        'Manajer Mutu',
    'Menelaah akses darurat dan indikator mutu.')
  ) AS v(code, name, description)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".role r WHERE r.code = v.code
 );

-- ---------------------------------------------------------------------------
-- Hak akses tiap peran
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pasangan RECORD;
  r_id UUID;
  m_id UUID;
  a_id UUID;
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      -- Administrator: mengelola sistem, TANPA membaca rekam medis. Mengelola
      -- sistem tidak menuntut membaca diagnosis siapa pun, dan hak yang tidak
      -- dibutuhkan adalah hak yang akan disalahgunakan.
      ('HEALTH_ADMIN', 'HEALTH', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_FACILITY', 'READ'), ('HEALTH_ADMIN', 'HEALTH_FACILITY', 'CREATE'),
      ('HEALTH_ADMIN', 'HEALTH_FACILITY', 'UPDATE'), ('HEALTH_ADMIN', 'HEALTH_FACILITY', 'DELETE'),
      ('HEALTH_ADMIN', 'HEALTH_SERVICE_UNIT', 'READ'), ('HEALTH_ADMIN', 'HEALTH_SERVICE_UNIT', 'CREATE'),
      ('HEALTH_ADMIN', 'HEALTH_SERVICE_UNIT', 'UPDATE'), ('HEALTH_ADMIN', 'HEALTH_SERVICE_UNIT', 'DELETE'),
      ('HEALTH_ADMIN', 'HEALTH_BED', 'READ'), ('HEALTH_ADMIN', 'HEALTH_BED', 'CREATE'),
      ('HEALTH_ADMIN', 'HEALTH_BED', 'UPDATE'), ('HEALTH_ADMIN', 'HEALTH_BED', 'DELETE'),
      ('HEALTH_ADMIN', 'HEALTH_PROVIDER', 'READ'), ('HEALTH_ADMIN', 'HEALTH_PROVIDER', 'CREATE'),
      ('HEALTH_ADMIN', 'HEALTH_PROVIDER', 'UPDATE'), ('HEALTH_ADMIN', 'HEALTH_PROVIDER', 'ASSIGN'),
      ('HEALTH_ADMIN', 'HEALTH_BILLING_TIER', 'READ'), ('HEALTH_ADMIN', 'HEALTH_BILLING_TIER', 'UPDATE'),

      ('HEALTH_DIRECTOR', 'HEALTH', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_FACILITY', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_SERVICE_UNIT', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_BED', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_PROVIDER', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_ACCESS_LOG', 'READ'), ('HEALTH_DIRECTOR', 'HEALTH_ACCESS_LOG', 'EXPORT'),
      ('HEALTH_DIRECTOR', 'HEALTH_BILLING_TIER', 'READ'),

      -- Petugas pendaftaran: mendaftarkan, MENANDAI dugaan ganda, tetapi tidak
      -- menggabungkan. Menandai dan menggabungkan adalah dua wewenang berbeda.
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH', 'READ'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PATIENT', 'READ'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PATIENT', 'CREATE'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PATIENT', 'UPDATE'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PATIENT_DUPLICATE', 'READ'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PATIENT_DUPLICATE', 'REVIEW'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_REGISTRATION', 'READ'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_REGISTRATION', 'CREATE'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_REGISTRATION', 'UPDATE'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_BILLING_TIER', 'READ'),

      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH', 'READ'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_PATIENT', 'READ'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_PATIENT', 'UPDATE'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_PATIENT', 'EXPORT'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_PATIENT', 'MERGE_PATIENT'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_PATIENT_DUPLICATE', 'READ'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_PATIENT_DUPLICATE', 'REVIEW'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_PATIENT_DUPLICATE', 'MERGE_PATIENT'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_ACCESS_LOG', 'READ'),

      ('HEALTH_DOCTOR', 'HEALTH', 'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_PATIENT', 'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_PATIENT', 'UPDATE'),
      ('HEALTH_DOCTOR', 'HEALTH_PATIENT', 'BREAK_GLASS'),
      ('HEALTH_DOCTOR', 'HEALTH_REGISTRATION', 'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_ENCOUNTER', 'READ'), ('HEALTH_DOCTOR', 'HEALTH_ENCOUNTER', 'CREATE'),
      ('HEALTH_DOCTOR', 'HEALTH_ENCOUNTER', 'UPDATE'), ('HEALTH_DOCTOR', 'HEALTH_ENCOUNTER', 'PRESCRIBE'),

      ('HEALTH_NURSE', 'HEALTH', 'READ'),
      ('HEALTH_NURSE', 'HEALTH_PATIENT', 'READ'),
      ('HEALTH_NURSE', 'HEALTH_PATIENT', 'UPDATE'),
      ('HEALTH_NURSE', 'HEALTH_REGISTRATION', 'READ'),
      ('HEALTH_NURSE', 'HEALTH_ENCOUNTER', 'READ'), ('HEALTH_NURSE', 'HEALTH_ENCOUNTER', 'UPDATE'),

      ('HEALTH_QUALITY_MANAGER', 'HEALTH', 'READ'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_ACCESS_LOG', 'READ'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_ACCESS_LOG', 'EXPORT'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_PATIENT_DUPLICATE', 'READ')
    ) AS t(role_code, menu_code, action_code)
  LOOP
    SELECT id INTO r_id FROM "{{TENANT_SCHEMA}}".role WHERE code = pasangan.role_code;
    SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu WHERE code = pasangan.menu_code;
    SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action WHERE code = pasangan.action_code;
    IF r_id IS NOT NULL AND m_id IS NOT NULL AND a_id IS NOT NULL THEN
      INSERT INTO "{{TENANT_SCHEMA}}".role_menu_permission
        (role_id, menu_id, permission_action_id, effect)
      VALUES (r_id, m_id, a_id, 'ALLOW')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Aturan pemisahan wewenang
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".segregation_of_duty_rule
  (code, name, description, severity, is_active, is_system)
SELECT v.code, v.name, v.description, v.severity, TRUE, TRUE
  FROM (VALUES
    ('HEALTH_SOD_REGISTER_MERGE', 'Pendaftar tidak menggabungkan rekam medis',
    'Petugas yang membuat rekam medis tidak menggabungkannya sendiri. Penggabungan yang salah menempelkan riwayat orang lain — alergi dan golongan darah yang bukan miliknya — dan orang yang membuat kekeliruannya adalah orang yang paling sulit melihatnya.',
    'HIGH'),
    ('HEALTH_SOD_BREAKGLASS_REVIEW', 'Pemakai akses darurat tidak menelaah akses darurat',
    'Yang menelaah break-glass tidak boleh sama dengan yang memakainya. Telaah oleh pelakunya sendiri bukan telaah.',
    'HIGH')
  ) AS v(code, name, description, severity)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".segregation_of_duty_rule s WHERE s.code = v.code
 );
