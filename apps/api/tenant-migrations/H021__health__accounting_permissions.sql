-- =========================================================================
-- H021 — MENU, HAK AKSES, DAN PERAN PEMETAAN AKUNTANSI KESEHATAN
-- =========================================================================
--
-- Fase H-9N. Aditif seluruhnya.
--
-- Satu pemisahan menentukan bentuknya: **yang memetakan akun bukan yang
-- membaca rekam medis.**
--
-- Petugas keuangan rumah sakit perlu tahu bahwa pendapatan laboratorium masuk
-- ke akun 4160; ia tidak perlu tahu siapa yang diperiksa. Memberi peran
-- keuangan hak membaca rekam medis adalah cara paling sunyi untuk membocorkan
-- seluruh riwayat pasien — tidak ada yang akan menyadarinya, sebab tidak ada
-- yang mengira bagian keuangan membacanya.

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
      ('HEALTH_ACCOUNTING_MAP', 'Pemetaan Akuntansi', 'menu.health.accounting_map', '/app/emedik/akuntansi', 'calculator', '/HEALTH/HEALTH_ACCOUNTING_MAP', 99)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );
END $$;

-- ---------------------------------------------------------------------------
-- Aksi yang berlaku pada menunya
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pasangan RECORD;
  m_id UUID;
  a_id UUID;
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      ('HEALTH_ACCOUNTING_MAP', 'READ'),
      ('HEALTH_ACCOUNTING_MAP', 'CREATE'),
      ('HEALTH_ACCOUNTING_MAP', 'UPDATE'),
      ('HEALTH_ACCOUNTING_MAP', 'ACTIVATE')
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
    ('HEALTH_FINANCE_OFFICER', 'Petugas Keuangan Rumah Sakit',
     'Memetakan peristiwa kesehatan ke akun. TIDAK membaca rekam medis pasien.')
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
       * Sengaja TANPA HEALTH_PATIENT.READ.
       *
       * Petugas keuangan perlu tahu bahwa pendapatan laboratorium masuk ke akun
       * 4160; ia tidak perlu tahu siapa yang diperiksa.
       */
      ('HEALTH_FINANCE_OFFICER', 'HEALTH',                 'READ'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_ACCOUNTING_MAP',  'READ'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_ACCOUNTING_MAP',  'CREATE'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_ACCOUNTING_MAP',  'UPDATE'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_SERVICE_CATALOG', 'READ'),

      -- Administrator meninjau dan mengaktifkan profilnya; ia tidak memetakan.
      ('HEALTH_ADMIN', 'HEALTH_ACCOUNTING_MAP', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_ACCOUNTING_MAP', 'ACTIVATE'),

      ('HEALTH_DIRECTOR', 'HEALTH_ACCOUNTING_MAP', 'READ')
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
    ('HEALTH_SOD_FINANCE_PATIENT', 'Petugas keuangan tidak membaca rekam medis',
    'Memetakan pendapatan laboratorium ke akun 4160 tidak menuntut pengetahuan tentang siapa yang diperiksa. Menggabungkan wewenang keuangan dengan pembacaan rekam medis adalah cara paling sunyi untuk membocorkan seluruh riwayat pasien: tidak ada yang akan menyadarinya, sebab tidak ada yang mengira bagian keuangan membacanya, dan jejaknya akan tenggelam di antara ribuan pembacaan yang sah.',
    'HIGH')
  ) AS v(code, name, description, severity)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".segregation_of_duty_rule s WHERE s.code = v.code
 );

DO $$
DECLARE
  s_id UUID;
  r_id UUID;
BEGIN
  SELECT id INTO s_id FROM "{{TENANT_SCHEMA}}".segregation_of_duty_rule
    WHERE code = 'HEALTH_SOD_FINANCE_PATIENT' AND deleted_at IS NULL;
  SELECT id INTO r_id FROM "{{TENANT_SCHEMA}}".role
    WHERE code = 'HEALTH_FINANCE_OFFICER' AND deleted_at IS NULL;
  IF s_id IS NOT NULL AND r_id IS NOT NULL THEN
    INSERT INTO "{{TENANT_SCHEMA}}".segregation_of_duty_role (rule_id, role_id, side)
    VALUES (s_id, r_id, 'PREPARER')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
