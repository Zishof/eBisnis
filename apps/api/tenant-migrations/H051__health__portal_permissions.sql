-- =========================================================================
-- H051 — MENU, HAK AKSES, DAN PERAN PORTAL PASIEN
-- =========================================================================
--
-- Fase H-10. Aditif seluruhnya.
--
-- ## Perbedaan yang menentukan
--
-- Menu di sini adalah menu **PETUGAS** yang mengelola portal — bukan menu yang
-- dilihat pasien. Pasien tidak punya peran pada tenant ini sama sekali; ia
-- masuk lewat jalur portal yang identitasnya dicocokkan dengan
-- `patient_portal_account`, dan jalur itu **tidak memakai mesin hak akses
-- menu**.
--
-- Perbedaan itu disengaja dan penting. Memberi pasien satu peran pada mesin hak
-- akses yang sama dengan petugas berarti satu kekeliruan konfigurasi memberinya
-- hak yang dimiliki petugas — dan kekeliruan konfigurasi peran adalah hal yang
-- terjadi setiap bulan pada rumah sakit mana pun.
--
-- ## Pemisahan kedua
--
-- **Yang memverifikasi identitas pemohon akun bukan yang melepas hasil
-- kritis.** Keduanya kebetulan sering orang yang sama di rumah sakit kecil, dan
-- justru karena itu pemisahannya perlu tertulis: yang pertama pekerjaan
-- pendaftaran, yang kedua keputusan klinis.

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
      ('HEALTH_PORTAL_ACCOUNT', 'Akun Portal Pasien', 'menu.health.portal_account', '/app/emedik/akun-portal',  'user-check',   '/HEALTH/HEALTH_PORTAL_ACCOUNT', 127),
      ('HEALTH_PORTAL_RELEASE', 'Pelepasan Hasil',    'menu.health.portal_release', '/app/emedik/pelepasan-hasil','send',       '/HEALTH/HEALTH_PORTAL_RELEASE', 128),
      ('HEALTH_WEB_CONTENT',    'Konten Website',     'menu.health.web_content',    '/app/emedik/website',      'globe',        '/HEALTH/HEALTH_WEB_CONTENT',    129)
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
      ('HEALTH_PORTAL_ACCOUNT', 'READ'),
      ('HEALTH_PORTAL_ACCOUNT', 'CREATE'),
      -- VERIFY memverifikasi identitas pemohon tatap muka.
      ('HEALTH_PORTAL_ACCOUNT', 'VERIFY'),
      ('HEALTH_PORTAL_ACCOUNT', 'ACTIVATE'),
      ('HEALTH_PORTAL_ACCOUNT', 'HOLD'),
      ('HEALTH_PORTAL_RELEASE', 'READ'),
      -- RELEASE melepas hasil ke portal. Sengaja TERPISAH dari VERIFY.
      ('HEALTH_PORTAL_RELEASE', 'RELEASE'),
      ('HEALTH_WEB_CONTENT', 'READ'),
      ('HEALTH_WEB_CONTENT', 'CREATE'),
      ('HEALTH_WEB_CONTENT', 'UPDATE'),
      ('HEALTH_WEB_CONTENT', 'PUBLISH'),
      ('HEALTH_WEB_CONTENT', 'UNPUBLISH')
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

INSERT INTO "{{TENANT_SCHEMA}}".role (code, name, description, is_system, is_core)
SELECT v.code, v.name, v.description, TRUE, FALSE
  FROM (VALUES
    ('HEALTH_WEB_EDITOR', 'Pengelola Website Fasilitas',
     'Menyusun dan menerbitkan konten website fasilitas. TIDAK memperoleh satu pun hak atas data pasien.')
  ) AS v(code, name, description)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".role r WHERE r.code = v.code
 );

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
       * Petugas pendaftaran memverifikasi identitas pemohon akun — ia yang
       * berhadapan dengan orangnya dan memegang kartu identitasnya.
       * Ia TIDAK melepas hasil.
       */
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PORTAL_ACCOUNT', 'READ'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PORTAL_ACCOUNT', 'CREATE'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PORTAL_ACCOUNT', 'VERIFY'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PORTAL_ACCOUNT', 'ACTIVATE'),

      /*
       * Yang MELEPAS hasil adalah klinisi. Melepas hasil kritis berarti
       * memutuskan bahwa pasiennya siap membacanya — dan itu keputusan
       * klinis, bukan administratif.
       */
      ('HEALTH_DOCTOR',          'HEALTH_PORTAL_RELEASE', 'READ'),
      ('HEALTH_DOCTOR',          'HEALTH_PORTAL_RELEASE', 'RELEASE'),
      ('HEALTH_LAB_SUPERVISOR',  'HEALTH_PORTAL_RELEASE', 'READ'),
      ('HEALTH_LAB_SUPERVISOR',  'HEALTH_PORTAL_RELEASE', 'RELEASE'),

      /*
       * Pengelola website TIDAK memperoleh satu pun hak atas data pasien.
       * Ia menyusun halaman "Poliklinik Anak", bukan membaca rekam medis.
       */
      ('HEALTH_WEB_EDITOR', 'HEALTH',             'READ'),
      ('HEALTH_WEB_EDITOR', 'HEALTH_WEB_CONTENT', 'READ'),
      ('HEALTH_WEB_EDITOR', 'HEALTH_WEB_CONTENT', 'CREATE'),
      ('HEALTH_WEB_EDITOR', 'HEALTH_WEB_CONTENT', 'UPDATE'),
      ('HEALTH_WEB_EDITOR', 'HEALTH_WEB_CONTENT', 'PUBLISH'),
      ('HEALTH_WEB_EDITOR', 'HEALTH_WEB_CONTENT', 'UNPUBLISH'),

      ('HEALTH_ADMIN', 'HEALTH_PORTAL_ACCOUNT', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_PORTAL_ACCOUNT', 'HOLD'),
      ('HEALTH_ADMIN', 'HEALTH_WEB_CONTENT',    'READ'),

      ('HEALTH_DIRECTOR', 'HEALTH_PORTAL_ACCOUNT', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_WEB_CONTENT',    'READ')
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
    ('HEALTH_SOD_PORTAL_VERIFY_RELEASE', 'Yang memverifikasi akun portal tidak melepas hasilnya',
    'Memverifikasi identitas pemohon akun adalah pekerjaan pendaftaran: berhadapan dengan orangnya, memegang kartu identitasnya. Melepas hasil kritis ke portal adalah keputusan klinis: memutuskan bahwa pasiennya siap membacanya. Keduanya kebetulan sering orang yang sama di rumah sakit kecil, dan justru karena itu pemisahannya perlu tertulis — sebab yang menggabungkannya tidak akan menyadari bahwa ia sedang menggabungkan dua hal yang berbeda.',
    'MEDIUM')
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
      ('HEALTH_SOD_PORTAL_VERIFY_RELEASE', 'HEALTH_REGISTRATION_CLERK', 'PREPARER'),
      ('HEALTH_SOD_PORTAL_VERIFY_RELEASE', 'HEALTH_DOCTOR',             'APPROVER')
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
