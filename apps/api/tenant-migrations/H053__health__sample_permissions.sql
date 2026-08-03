-- =========================================================================
-- H053 — MENU, HAK AKSES, DAN PERAN DATA CONTOH DAN LAPORAN
-- =========================================================================
--
-- Fase H-11. Aditif seluruhnya.
--
-- Pemisahan yang menentukan bentuknya: **yang menyemai data contoh bukan yang
-- membersihkannya.**
--
-- Terdengar berlebihan sampai orang mengingat apa yang sesungguhnya dilakukan
-- pembersihan: ia menjalankan perintah atas ratusan baris pada tabel yang sama
-- dengan tempat rekam medis sungguhan berada. Yang menyemai baru saja
-- membuatnya dan tahu persis mana yang miliknya — dan justru keyakinan itu yang
-- membuatnya menekan tombolnya tanpa membaca layar konfirmasi.
--
-- Pemisahan kedua, dan ia lebih lazim: **laporan agregat dapat dibuka
-- manajemen tanpa satu pun hak atas data pasien.** Laporan yang menuntut hak
-- pasien akan membuat direktur diberi hak pasien — dan hak yang diberikan
-- jarang ditarik kembali.

DO $$
DECLARE
  akar_id UUID;
BEGIN
  SELECT id INTO akar_id FROM "{{TENANT_SCHEMA}}".menu WHERE code = 'HEALTH';
  IF akar_id IS NULL THEN
    RAISE EXCEPTION 'Menu akar HEALTH belum ada; H005 harus dijalankan lebih dahulu.';
  END IF;

  INSERT INTO "{{TENANT_SCHEMA}}".menu
    (code, parent_id, name, translation_key, route, icon, module_code,
     platform_target, path, level, is_coming_soon, is_system, sort_order)
  SELECT v.code, akar_id, v.name, v.translation_key, v.route, v.icon, 'HEALTH',
         'WEB', v.path, 1, FALSE, TRUE, v.sort_order
    FROM (VALUES
      ('HEALTH_SAMPLE_DATA', 'Data Contoh', 'menu.health.sample_data', '/app/emedik/data-contoh', 'flask-conical', '/HEALTH/HEALTH_SAMPLE_DATA', 130),
      ('HEALTH_REPORT',      'Laporan',     'menu.health.report',      '/app/emedik/laporan',     'bar-chart-3',   '/HEALTH/HEALTH_REPORT',      131)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );
END $$;

DO $$
DECLARE
  pasangan RECORD;
  m_id UUID;
  a_id UUID;
  hilang TEXT := '';
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      ('HEALTH_SAMPLE_DATA', 'READ'),
      -- CREATE menyemai. HARD_DELETE membersihkan — dan namanya sengaja
      -- menakutkan, sekalipun yang dilakukannya menyembunyikan.
      ('HEALTH_SAMPLE_DATA', 'CREATE'),
      ('HEALTH_SAMPLE_DATA', 'HARD_DELETE'),
      ('HEALTH_REPORT', 'READ'),
      ('HEALTH_REPORT', 'EXPORT')
    ) AS t(menu_code, action_code)
  LOOP
    SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu
      WHERE code = pasangan.menu_code AND deleted_at IS NULL;
    SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action
      WHERE code = pasangan.action_code;
    IF a_id IS NULL THEN
      hilang := hilang || pasangan.menu_code || '.' || pasangan.action_code || ' ';
    ELSIF m_id IS NOT NULL THEN
      INSERT INTO "{{TENANT_SCHEMA}}".menu_action (menu_id, permission_action_id)
      VALUES (m_id, a_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  IF hilang <> '' THEN
    RAISE EXCEPTION 'Aksi berikut tidak ada pada kosakata hak akses tenant: %', hilang;
  END IF;
END $$;

DO $$
DECLARE
  pasangan RECORD;
  r_id UUID;
  m_id UUID;
  a_id UUID;
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      /*
       * Administrator menyemai data contoh. Ia TIDAK membersihkannya.
       *
       * Yang menyemai baru saja membuatnya dan tahu persis mana yang miliknya
       * — dan justru keyakinan itu yang membuatnya menekan tombolnya tanpa
       * membaca layar konfirmasi.
       */
      ('HEALTH_ADMIN', 'HEALTH_SAMPLE_DATA', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_SAMPLE_DATA', 'CREATE'),
      ('HEALTH_ADMIN', 'HEALTH_REPORT',      'READ'),

      /*
       * Yang MEMBERSIHKAN adalah direktur — jabatan yang paling jarang
       * menekan tombol, dan itulah gunanya.
       */
      ('HEALTH_DIRECTOR', 'HEALTH_SAMPLE_DATA', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_SAMPLE_DATA', 'HARD_DELETE'),

      /*
       * LAPORAN AGREGAT DAPAT DIBUKA TANPA SATU PUN HAK ATAS DATA PASIEN.
       *
       * Laporan yang menuntut hak pasien akan membuat direktur diberi hak
       * pasien — dan hak yang diberikan jarang ditarik kembali.
       */
      ('HEALTH_DIRECTOR',        'HEALTH_REPORT', 'READ'),
      ('HEALTH_DIRECTOR',        'HEALTH_REPORT', 'EXPORT'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_REPORT', 'READ'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_REPORT', 'READ'),
      ('HEALTH_CLAIM_OFFICER',   'HEALTH_REPORT', 'READ')
    ) AS t(role_code, menu_code, action_code)
  LOOP
    SELECT id INTO r_id FROM "{{TENANT_SCHEMA}}".role
      WHERE code = pasangan.role_code AND deleted_at IS NULL;
    SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu
      WHERE code = pasangan.menu_code AND deleted_at IS NULL;
    SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action
      WHERE code = pasangan.action_code;
    IF r_id IS NOT NULL AND m_id IS NOT NULL AND a_id IS NOT NULL THEN
      INSERT INTO "{{TENANT_SCHEMA}}".role_menu_permission
        (role_id, menu_id, permission_action_id, effect)
      VALUES (r_id, m_id, a_id, 'ALLOW')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

INSERT INTO "{{TENANT_SCHEMA}}".segregation_of_duty_rule
  (code, name, description, severity, is_active, is_system)
SELECT v.code, v.name, v.description, v.severity, TRUE, TRUE
  FROM (VALUES
    ('HEALTH_SOD_SAMPLE_SEED_CLEAN', 'Yang menyemai data contoh tidak membersihkannya',
    'Pembersihan menjalankan perintah atas ratusan baris pada tabel yang sama dengan tempat rekam medis sungguhan berada. Yang menyemai baru saja membuatnya dan tahu persis mana yang miliknya — dan justru keyakinan itu yang membuatnya menekan tombolnya tanpa membaca layar konfirmasi. Pembersihan yang salah sasaran menghapus rekam medis, tidak menimbulkan galat, dan ditemukan oleh perawat yang mencari catatan pasiennya. Ditegakkan constraint sample_count_real_unchanged pada basis data pula: jumlah baris sungguhan sebelum dan sesudah pembersihan harus sama persis.',
    'CRITICAL')
  ) AS v(code, name, description, severity)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".segregation_of_duty_rule s WHERE s.code = v.code
 );

DO $$
DECLARE
  pasangan RECORD;
  s_id UUID;
  r_id UUID;
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      ('HEALTH_SOD_SAMPLE_SEED_CLEAN', 'HEALTH_ADMIN',     'PREPARER'),
      ('HEALTH_SOD_SAMPLE_SEED_CLEAN', 'HEALTH_DIRECTOR',  'APPROVER')
    ) AS t(rule_code, role_code, side)
  LOOP
    SELECT id INTO s_id FROM "{{TENANT_SCHEMA}}".segregation_of_duty_rule
      WHERE code = pasangan.rule_code AND deleted_at IS NULL;
    SELECT id INTO r_id FROM "{{TENANT_SCHEMA}}".role
      WHERE code = pasangan.role_code AND deleted_at IS NULL;
    IF s_id IS NOT NULL AND r_id IS NOT NULL THEN
      INSERT INTO "{{TENANT_SCHEMA}}".segregation_of_duty_role (rule_id, role_id, side)
      VALUES (s_id, r_id, pasangan.side)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
