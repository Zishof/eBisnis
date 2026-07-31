-- =========================================================================
-- H019 — MENU, HAK AKSES, DAN PERAN KATALOG LAYANAN DAN MASTER DATA
-- =========================================================================
--
-- Fase H-9L. Aditif seluruhnya.
--
-- Satu pemisahan menentukan bentuknya: **yang memetakan bukan yang
-- mengaktifkan.**
--
-- Pemetaan adalah pekerjaan harian — ratusan baris, sering keliru, sering
-- diperbaiki. Aktivasi adalah keputusan yang membuat layanan itu dapat dipesan,
-- ditagihkan, dan dibagi jasanya. Menyatukan keduanya berarti orang yang sedang
-- mengetik baris keseratus akan mengaktifkan layanan yang belum pernah dilihat
-- siapa pun.

-- ---------------------------------------------------------------------------
-- Aksi yang belum ada
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".permission_action
  (code, name, name_key, action_type, requires_step_up, is_system, sort_order)
SELECT v.code, v.name, v.name_key, v.action_type, v.requires_step_up, TRUE, v.sort_order
  FROM (VALUES
    ('ACTIVATE', 'Mengaktifkan', 'action.activate', 'APPROVE', FALSE, 116)
  ) AS v(code, name, name_key, action_type, requires_step_up, sort_order)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".permission_action p WHERE p.code = v.code
 );

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
      ('HEALTH_SERVICE_CATALOG', 'Katalog Layanan',  'menu.health.service_catalog', '/app/emedik/layanan',    'list-checks', '/HEALTH/HEALTH_SERVICE_CATALOG', 96),
      ('HEALTH_MASTER_DATA',     'Master Data',      'menu.health.master_data',     '/app/emedik/master-data','database',    '/HEALTH/HEALTH_MASTER_DATA',     97),
      ('HEALTH_CODE_MAPPING',    'Pemetaan Kode',    'menu.health.code_mapping',    '/app/emedik/pemetaan',   'git-compare', '/HEALTH/HEALTH_CODE_MAPPING',    98)
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
      ('HEALTH_SERVICE_CATALOG', 'READ'),
      ('HEALTH_SERVICE_CATALOG', 'CREATE'),
      ('HEALTH_SERVICE_CATALOG', 'UPDATE'),
      ('HEALTH_SERVICE_CATALOG', 'ACTIVATE'),
      ('HEALTH_MASTER_DATA',     'READ'),
      ('HEALTH_MASTER_DATA',     'IMPORT'),
      ('HEALTH_MASTER_DATA',     'CREATE'),
      ('HEALTH_MASTER_DATA',     'DELETE'),
      ('HEALTH_CODE_MAPPING',    'READ'),
      ('HEALTH_CODE_MAPPING',    'CREATE'),
      ('HEALTH_CODE_MAPPING',    'UPDATE')
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
    ('HEALTH_SERVICE_CATALOGUER', 'Petugas Katalog Layanan',
     'Menyusun katalog layanan dan pemetaannya ke unit. TIDAK mengaktifkan layanan.')
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
      -- Menyusun katalog; TIDAK mengaktifkan.
      ('HEALTH_SERVICE_CATALOGUER', 'HEALTH',                 'READ'),
      ('HEALTH_SERVICE_CATALOGUER', 'HEALTH_SERVICE_CATALOG', 'READ'),
      ('HEALTH_SERVICE_CATALOGUER', 'HEALTH_SERVICE_CATALOG', 'CREATE'),
      ('HEALTH_SERVICE_CATALOGUER', 'HEALTH_SERVICE_CATALOG', 'UPDATE'),
      ('HEALTH_SERVICE_CATALOGUER', 'HEALTH_CODE_MAPPING',    'READ'),
      ('HEALTH_SERVICE_CATALOGUER', 'HEALTH_CODE_MAPPING',    'CREATE'),
      ('HEALTH_SERVICE_CATALOGUER', 'HEALTH_CODE_MAPPING',    'UPDATE'),
      ('HEALTH_SERVICE_CATALOGUER', 'HEALTH_MASTER_DATA',     'READ'),

      -- Mengaktifkan dan mengelola master data; TIDAK menyusun katalognya.
      ('HEALTH_ADMIN', 'HEALTH_SERVICE_CATALOG', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_SERVICE_CATALOG', 'ACTIVATE'),
      ('HEALTH_ADMIN', 'HEALTH_MASTER_DATA',     'READ'),
      ('HEALTH_ADMIN', 'HEALTH_MASTER_DATA',     'CREATE'),
      ('HEALTH_ADMIN', 'HEALTH_MASTER_DATA',     'IMPORT'),
      ('HEALTH_ADMIN', 'HEALTH_MASTER_DATA',     'DELETE'),
      ('HEALTH_ADMIN', 'HEALTH_CODE_MAPPING',    'READ'),

      -- Petugas rekam medis memetakan kode; ia sudah memegang terminologi.
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_CODE_MAPPING', 'READ'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_CODE_MAPPING', 'CREATE'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_CODE_MAPPING', 'UPDATE'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_SERVICE_CATALOG', 'READ'),

      ('HEALTH_DIRECTOR', 'HEALTH_SERVICE_CATALOG', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_MASTER_DATA',     'READ')
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
    ('HEALTH_SOD_MAP_ACTIVATE', 'Yang memetakan layanan tidak mengaktifkannya',
    'Pemetaan adalah pekerjaan harian: ratusan baris, sering keliru, sering diperbaiki. Aktivasi adalah keputusan yang membuat layanan dapat dipesan, ditagihkan, dan dibagi jasanya. Menyatukan keduanya berarti orang yang sedang mengetik baris keseratus akan mengaktifkan layanan yang belum pernah dilihat siapa pun — dan yang pertama menyadarinya adalah pasien yang menerima tagihan atas layanan yang tarifnya salah ketik.',
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
      ('HEALTH_SOD_MAP_ACTIVATE', 'HEALTH_SERVICE_CATALOGUER', 'PREPARER'),
      ('HEALTH_SOD_MAP_ACTIVATE', 'HEALTH_ADMIN',              'APPROVER')
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
