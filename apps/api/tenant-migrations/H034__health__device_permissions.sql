-- =========================================================================
-- H034 — MENU, HAK AKSES, DAN PERAN ALAT KESEHATAN
-- =========================================================================
--
-- Fase H-9H. Aditif seluruhnya.
--
-- Satu pemisahan menentukan bentuknya, dan ia tidak lazim: **yang mengelola
-- alat bukan yang menyalakan kendali jarak jauhnya.**
--
-- Teknisi biomedis mengenal alatnya, memasangnya, mengalibrasinya, dan
-- memeliharanya. Justru karena itu ia orang yang paling mudah membujuk dirinya
-- sendiri bahwa kendali jarak jauh akan mempermudah pekerjaannya — dan ia
-- benar. Yang tidak dilihatnya adalah pompa infus yang dosisnya dapat dinaikkan
-- oleh siapa pun yang menembus jaringannya.
--
-- Karena itu MANAGE_DEVICE dipisahkan dari ACTIVATE, dan ACTIVATE dipegang
-- manajemen.

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
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
      ('HEALTH_DEVICE',         'Alat Kesehatan',  'menu.health.device',         '/app/emedik/alat',          'activity-square', '/HEALTH/HEALTH_DEVICE',         110),
      ('HEALTH_DEVICE_GATEWAY', 'Gateway Alat',    'menu.health.device_gateway', '/app/emedik/gateway',       'router',          '/HEALTH/HEALTH_DEVICE_GATEWAY', 111),
      ('HEALTH_DEVICE_INBOX',   'Hasil Alat',      'menu.health.device_inbox',   '/app/emedik/hasil-alat',    'inbox',           '/HEALTH/HEALTH_DEVICE_INBOX',   112)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
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
      ('HEALTH_DEVICE', 'READ'),
      ('HEALTH_DEVICE', 'CREATE'),
      ('HEALTH_DEVICE', 'UPDATE'),
      -- MANAGE_DEVICE mengelola alat: kalibrasi, pemeliharaan, status.
      ('HEALTH_DEVICE', 'MANAGE_DEVICE'),
      -- ACTIVATE menyalakan kendali jarak jauh. Sengaja TERPISAH.
      ('HEALTH_DEVICE', 'ACTIVATE'),
      ('HEALTH_DEVICE_GATEWAY', 'READ'),
      ('HEALTH_DEVICE_GATEWAY', 'CREATE'),
      ('HEALTH_DEVICE_GATEWAY', 'UPDATE'),
      ('HEALTH_DEVICE_GATEWAY', 'MANAGE_CREDENTIAL'),
      ('HEALTH_DEVICE_INBOX', 'READ'),
      ('HEALTH_DEVICE_INBOX', 'CREATE'),
      -- ASSIGN mengaitkan hasil kepada pasien.
      ('HEALTH_DEVICE_INBOX', 'ASSIGN'),
      ('HEALTH_DEVICE_INBOX', 'REVIEW')
    ) AS t(menu_code, action_code)
  LOOP
    SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu
      WHERE code = pasangan.menu_code AND deleted_at IS NULL;
    SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action
      WHERE code = pasangan.action_code;
    IF m_id IS NOT NULL AND a_id IS NOT NULL THEN
      INSERT INTO "{{TENANT_SCHEMA}}".menu_action (menu_id, permission_action_id)
      VALUES (m_id, a_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Peran
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".role (code, name, description, is_system, is_core)
SELECT v.code, v.name, v.description, TRUE, FALSE
  FROM (VALUES
    ('HEALTH_BIOMEDICAL_ENGINEER', 'Teknisi Biomedis',
     'Mendaftarkan alat, mengelola kalibrasi dan pemeliharaan, serta mengelola kredensial gateway. TIDAK menyalakan kendali jarak jauh.'),
    ('HEALTH_DEVICE_INBOX_CLERK', 'Petugas Hasil Alat',
     'Mengaitkan hasil alat kepada pasien dan menelaahnya. TIDAK mengelola alat.')
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
      -- Mengelola alat; TIDAK menyalakan kendali jarak jauh.
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH',                 'READ'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE',          'READ'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE',          'CREATE'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE',          'UPDATE'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE',          'MANAGE_DEVICE'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_GATEWAY',  'READ'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_GATEWAY',  'CREATE'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_GATEWAY',  'UPDATE'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_GATEWAY',  'MANAGE_CREDENTIAL'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_INBOX',    'READ'),

      /*
       * MENYALAKAN KENDALI JARAK JAUH — administrator, bukan teknisi.
       *
       * Teknisi mengenal alatnya dan justru karena itu ia orang yang paling
       * mudah membujuk dirinya sendiri bahwa kendali jarak jauh akan
       * mempermudah pekerjaannya. Ia benar; yang tidak dilihatnya adalah pompa
       * infus yang dosisnya dapat dinaikkan oleh siapa pun yang menembus
       * jaringannya.
       */
      ('HEALTH_ADMIN', 'HEALTH_DEVICE',         'READ'),
      ('HEALTH_ADMIN', 'HEALTH_DEVICE',         'ACTIVATE'),
      ('HEALTH_ADMIN', 'HEALTH_DEVICE_GATEWAY', 'READ'),

      -- Mengaitkan hasil kepada pasien; TIDAK mengelola alat.
      ('HEALTH_DEVICE_INBOX_CLERK', 'HEALTH',              'READ'),
      ('HEALTH_DEVICE_INBOX_CLERK', 'HEALTH_PATIENT',      'READ'),
      ('HEALTH_DEVICE_INBOX_CLERK', 'HEALTH_DEVICE_INBOX', 'READ'),
      ('HEALTH_DEVICE_INBOX_CLERK', 'HEALTH_DEVICE_INBOX', 'ASSIGN'),
      ('HEALTH_DEVICE_INBOX_CLERK', 'HEALTH_DEVICE',       'READ'),

      -- Analis dan penanggung jawab laboratorium menelaah hasil alatnya.
      ('HEALTH_LAB_ANALYST',    'HEALTH_DEVICE_INBOX', 'READ'),
      ('HEALTH_LAB_ANALYST',    'HEALTH_DEVICE_INBOX', 'ASSIGN'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_DEVICE_INBOX', 'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_DEVICE_INBOX', 'REVIEW'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_DEVICE',       'READ'),

      ('HEALTH_DIRECTOR', 'HEALTH_DEVICE',         'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_DEVICE_GATEWAY', 'READ')
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

-- ---------------------------------------------------------------------------
-- Aturan pemisahan wewenang
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".segregation_of_duty_rule
  (code, name, description, severity, is_active, is_system)
SELECT v.code, v.name, v.description, v.severity, TRUE, TRUE
  FROM (VALUES
    ('HEALTH_SOD_DEVICE_REMOTE', 'Pengelola alat tidak menyalakan kendali jarak jauhnya',
    'Teknisi biomedis mengenal alatnya, memasangnya, mengalibrasinya, dan memeliharanya. Justru karena itu ia orang yang paling mudah membujuk dirinya sendiri bahwa kendali jarak jauh akan mempermudah pekerjaannya — dan ia benar. Yang tidak dilihatnya adalah pompa infus yang dosisnya dapat dinaikkan oleh siapa pun yang menembus jaringannya. Manfaatnya nyata tetapi kecil; akibat kegagalannya tidak dapat diperbaiki, dan yang menanggungnya bukan teknisinya.',
    'CRITICAL'),
    ('HEALTH_SOD_DEVICE_LINK_REVIEW', 'Yang mengaitkan hasil alat tidak menelaahnya sendiri',
    'Pengaitan hasil kepada pasien adalah tempat kekeliruan yang paling sulit ditemukan sesudahnya: hasilnya benar secara analitis, dilaporkan dengan percaya diri, dan tertempel pada orang yang keliru. Telaah oleh orang yang mengaitkannya hanya membaca ulang keyakinannya sendiri.',
    'HIGH')
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
      ('HEALTH_SOD_DEVICE_REMOTE',      'HEALTH_BIOMEDICAL_ENGINEER', 'PREPARER'),
      ('HEALTH_SOD_DEVICE_REMOTE',      'HEALTH_ADMIN',               'APPROVER'),
      ('HEALTH_SOD_DEVICE_LINK_REVIEW', 'HEALTH_DEVICE_INBOX_CLERK',  'PREPARER'),
      ('HEALTH_SOD_DEVICE_LINK_REVIEW', 'HEALTH_LAB_SUPERVISOR',      'APPROVER')
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
