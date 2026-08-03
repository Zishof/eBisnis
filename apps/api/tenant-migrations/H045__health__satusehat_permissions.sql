-- =========================================================================
-- H045 — MENU, HAK AKSES, DAN PERAN SATUSEHAT
-- =========================================================================
--
-- Fase H-9A. Aditif seluruhnya.
--
-- Satu pemisahan menentukan bentuknya: **yang mengelola lingkungan bukan yang
-- memverifikasi kemampuannya.**
--
-- Memverifikasi kemampuan berarti menyatakan "saya sudah menjalankan panggilan
-- ini terhadap sandbox, dan ia bekerja". Pernyataan itu membuka gerbang yang
-- mengirimkan data pasien ke sistem nasional, dan pengiriman itu tidak dapat
-- ditarik kembali.
--
-- Administrator yang memasang kredensial adalah orang yang paling ingin
-- gerbangnya terbuka — sebab pekerjaannya belum selesai sampai ia terbuka. Yang
-- menyatakan ia bekerja harus orang lain.

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
      ('HEALTH_SATUSEHAT',            'SATUSEHAT',            'menu.health.satusehat',            '/app/emedik/satusehat',            'network',       '/HEALTH/HEALTH_SATUSEHAT',            120),
      ('HEALTH_SATUSEHAT_CAPABILITY', 'Kemampuan SATUSEHAT',  'menu.health.satusehat_capability', '/app/emedik/satusehat-kemampuan',  'list-checks',   '/HEALTH/HEALTH_SATUSEHAT_CAPABILITY', 121)
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
      ('HEALTH_SATUSEHAT', 'READ'),
      ('HEALTH_SATUSEHAT', 'CREATE'),
      ('HEALTH_SATUSEHAT', 'UPDATE'),
      -- ACTIVATE menyalakan lingkungan; MANAGE_CREDENTIAL memasang rujukannya.
      ('HEALTH_SATUSEHAT', 'ACTIVATE'),
      ('HEALTH_SATUSEHAT', 'MANAGE_CREDENTIAL'),
      ('HEALTH_SATUSEHAT_CAPABILITY', 'READ'),
      ('HEALTH_SATUSEHAT_CAPABILITY', 'UPDATE'),
      -- VERIFY menyatakan kemampuannya sudah dicoba terhadap sandbox.
      -- Sengaja TERPISAH dari ACTIVATE.
      ('HEALTH_SATUSEHAT_CAPABILITY', 'VERIFY')
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
    ('HEALTH_INTEROP_OFFICER', 'Petugas Interoperabilitas',
     'Memverifikasi kemampuan pertukaran data terhadap sandbox dan menelaah jejak pengirimannya. TIDAK memasang kredensial dan TIDAK mengaktifkan lingkungan.')
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
       * Administrator memasang kredensial dan mengaktifkan lingkungan.
       * Ia TIDAK memverifikasi kemampuan.
       */
      ('HEALTH_ADMIN', 'HEALTH_SATUSEHAT',            'READ'),
      ('HEALTH_ADMIN', 'HEALTH_SATUSEHAT',            'CREATE'),
      ('HEALTH_ADMIN', 'HEALTH_SATUSEHAT',            'UPDATE'),
      ('HEALTH_ADMIN', 'HEALTH_SATUSEHAT',            'ACTIVATE'),
      ('HEALTH_ADMIN', 'HEALTH_SATUSEHAT',            'MANAGE_CREDENTIAL'),
      ('HEALTH_ADMIN', 'HEALTH_SATUSEHAT_CAPABILITY', 'READ'),

      /*
       * Petugas interoperabilitas memverifikasi. Ia TIDAK memasang kredensial
       * dan TIDAK mengaktifkan lingkungan — administrator yang memasangnya
       * adalah orang yang paling ingin gerbangnya terbuka, sebab pekerjaannya
       * belum selesai sampai ia terbuka.
       */
      ('HEALTH_INTEROP_OFFICER', 'HEALTH',                       'READ'),
      ('HEALTH_INTEROP_OFFICER', 'HEALTH_SATUSEHAT',             'READ'),
      ('HEALTH_INTEROP_OFFICER', 'HEALTH_SATUSEHAT_CAPABILITY',  'READ'),
      ('HEALTH_INTEROP_OFFICER', 'HEALTH_SATUSEHAT_CAPABILITY',  'UPDATE'),
      ('HEALTH_INTEROP_OFFICER', 'HEALTH_SATUSEHAT_CAPABILITY',  'VERIFY'),

      ('HEALTH_DIRECTOR', 'HEALTH_SATUSEHAT',            'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_SATUSEHAT_CAPABILITY', 'READ')
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
    ('HEALTH_SOD_SATUSEHAT_VERIFY', 'Yang mengaktifkan lingkungan tidak memverifikasi kemampuannya',
    'Memverifikasi kemampuan berarti menyatakan "saya sudah menjalankan panggilan ini terhadap sandbox, dan ia bekerja". Pernyataan itu membuka gerbang yang mengirimkan data pasien ke sistem nasional, dan pengiriman itu tidak dapat ditarik kembali. Administrator yang memasang kredensial adalah orang yang paling ingin gerbangnya terbuka — sebab pekerjaannya belum selesai sampai ia terbuka — dan justru karena itu ia bukan orang yang tepat untuk menyatakan bahwa ia bekerja. Ditegakkan constraint satusehat_cap_verified_complete pada basis data pula: VERIFIED menuntut nama manusianya, keenam buktinya, dan keterangan sekurangnya dua puluh huruf.',
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
      ('HEALTH_SOD_SATUSEHAT_VERIFY', 'HEALTH_ADMIN',            'PREPARER'),
      ('HEALTH_SOD_SATUSEHAT_VERIFY', 'HEALTH_INTEROP_OFFICER',  'APPROVER')
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
