-- =========================================================================
-- H023 — MENU, HAK AKSES, DAN PERAN TARIF DAN PENJAMIN
-- =========================================================================
--
-- Fase H-9D. Aditif seluruhnya.
--
-- Satu pemisahan menentukan bentuknya: **yang mengimpor tarif tidak
-- menyetujuinya.**
--
-- Impor tarif adalah pekerjaan teknis — mengunggah berkas, memeriksa
-- barisnya, membetulkan format. Persetujuan adalah keputusan yang mengubah
-- seluruh tagihan rumah sakit sejak tanggal berlakunya. Menyatukan keduanya
-- berarti satu orang dapat menaikkan atau menurunkan seluruh tagihan tanpa ada
-- pihak kedua yang pernah melihatnya — dan yang pertama menyadarinya adalah
-- penjamin yang menolak seluruh klaim bulan itu.

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
      ('HEALTH_TARIFF', 'Tarif JKN',        'menu.health.tariff', '/app/emedik/tarif',    'receipt-text', '/HEALTH/HEALTH_TARIFF', 100),
      ('HEALTH_PAYER',  'Penjamin',         'menu.health.payer',  '/app/emedik/penjamin', 'handshake',    '/HEALTH/HEALTH_PAYER',  101)
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
      ('HEALTH_TARIFF', 'READ'),
      ('HEALTH_TARIFF', 'IMPORT'),
      ('HEALTH_TARIFF', 'APPROVE'),
      ('HEALTH_TARIFF', 'ACTIVATE'),
      ('HEALTH_PAYER',  'READ'),
      ('HEALTH_PAYER',  'CREATE'),
      ('HEALTH_PAYER',  'UPDATE')
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
    ('HEALTH_TARIFF_OFFICER', 'Petugas Tarif',
     'Mengimpor tarif dari terbitan resmi dan mengelola penjamin. TIDAK menyetujui tarif.')
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
      -- Mengimpor; TIDAK menyetujui.
      ('HEALTH_TARIFF_OFFICER', 'HEALTH',        'READ'),
      ('HEALTH_TARIFF_OFFICER', 'HEALTH_TARIFF', 'READ'),
      ('HEALTH_TARIFF_OFFICER', 'HEALTH_TARIFF', 'IMPORT'),
      ('HEALTH_TARIFF_OFFICER', 'HEALTH_PAYER',  'READ'),
      ('HEALTH_TARIFF_OFFICER', 'HEALTH_PAYER',  'CREATE'),
      ('HEALTH_TARIFF_OFFICER', 'HEALTH_PAYER',  'UPDATE'),
      ('HEALTH_TARIFF_OFFICER', 'HEALTH_SERVICE_CATALOG', 'READ'),

      -- Menyetujui dan mengaktifkan; TIDAK mengimpor.
      ('HEALTH_ADMIN', 'HEALTH_TARIFF', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_TARIFF', 'APPROVE'),
      ('HEALTH_ADMIN', 'HEALTH_TARIFF', 'ACTIVATE'),
      ('HEALTH_ADMIN', 'HEALTH_PAYER',  'READ'),

      -- Petugas keuangan membaca tarif; ia memetakan akunnya, tidak mengubah
      -- tarifnya.
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_TARIFF', 'READ'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_PAYER',  'READ'),

      -- Pendaftaran perlu tahu tanggungan penjamin saat pasien datang.
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_PAYER', 'READ'),

      ('HEALTH_DIRECTOR', 'HEALTH_TARIFF', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_PAYER',  'READ')
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
    ('HEALTH_SOD_TARIFF_IMPORT_APPROVE', 'Pengimpor tarif tidak menyetujuinya',
    'Impor tarif adalah pekerjaan teknis: mengunggah berkas, memeriksa barisnya, membetulkan format. Persetujuan adalah keputusan yang mengubah seluruh tagihan rumah sakit sejak tanggal berlakunya. Menyatukan keduanya berarti satu orang dapat menaikkan atau menurunkan seluruh tagihan tanpa ada pihak kedua yang pernah melihatnya, dan yang pertama menyadarinya adalah penjamin yang menolak seluruh klaim bulan itu. Ditegakkan constraint jkn_version_approval_not_self pada basis data pula.',
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
      ('HEALTH_SOD_TARIFF_IMPORT_APPROVE', 'HEALTH_TARIFF_OFFICER', 'PREPARER'),
      ('HEALTH_SOD_TARIFF_IMPORT_APPROVE', 'HEALTH_ADMIN',          'APPROVER')
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
