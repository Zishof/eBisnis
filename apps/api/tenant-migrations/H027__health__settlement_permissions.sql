-- =========================================================================
-- H027 — MENU, HAK AKSES, DAN PERAN SETTLEMENT JASA
-- =========================================================================
--
-- Fase H-9F. Aditif seluruhnya.
--
-- Empat wewenang, empat pemegang berbeda, dan pemisahannya bukan kerapian
-- birokrasi:
--
-- ```
-- menghitung  ->  menyetujui  ->  mengunci dan membayar  ->  mengoreksi
-- ```
--
-- Yang menghitung tidak menyetujui: perhitungan yang diperiksa oleh yang
-- menghitungnya bukan pemeriksaan. Yang menyetujui tidak membayar: persetujuan
-- yang langsung menjadi transfer menghilangkan jeda terakhir sebelum uang
-- berpindah. Dan yang mengoreksi diperiksa orang keempat, sebab koreksi adalah
-- tempat paling mudah untuk memindahkan uang tanpa ada yang melihat — ia
-- terlihat seperti pembetulan.

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
      ('HEALTH_FEE_SETTLEMENT', 'Settlement Jasa',  'menu.health.settlement', '/app/emedik/settlement', 'wallet',    '/HEALTH/HEALTH_FEE_SETTLEMENT', 104),
      ('HEALTH_FEE_STATEMENT',  'Pernyataan Jasa',  'menu.health.statement',  '/app/emedik/pernyataan', 'file-text', '/HEALTH/HEALTH_FEE_STATEMENT',  105)
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
      ('HEALTH_FEE_SETTLEMENT', 'READ'),
      ('HEALTH_FEE_SETTLEMENT', 'CREATE'),
      ('HEALTH_FEE_SETTLEMENT', 'APPROVE'),
      -- Mengunci dan membayar. Dipisahkan dari APPROVE dengan sengaja.
      ('HEALTH_FEE_SETTLEMENT', 'POST'),
      -- Membuat penyesuaian dan pembalikan.
      ('HEALTH_FEE_SETTLEMENT', 'REVERSE'),
      ('HEALTH_FEE_STATEMENT',  'READ'),
      ('HEALTH_FEE_STATEMENT',  'CREATE'),
      ('HEALTH_FEE_STATEMENT',  'EXPORT')
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
    ('HEALTH_SETTLEMENT_CLERK', 'Petugas Kalkulasi Jasa',
     'Menghitung dan menyimulasikan settlement jasa. TIDAK menyetujui, TIDAK membayar, dan TIDAK mengoreksi.'),
    ('HEALTH_SETTLEMENT_PAYER', 'Petugas Pembayaran Jasa',
     'Mengunci settlement yang sudah disetujui, mencatat pembayarannya, dan menerbitkan pernyataan. TIDAK menghitung dan TIDAK menyetujui.')
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
      -- Menghitung; tidak menyetujui, tidak membayar, tidak mengoreksi.
      ('HEALTH_SETTLEMENT_CLERK', 'HEALTH',                 'READ'),
      ('HEALTH_SETTLEMENT_CLERK', 'HEALTH_FEE_SETTLEMENT',  'READ'),
      ('HEALTH_SETTLEMENT_CLERK', 'HEALTH_FEE_SETTLEMENT',  'CREATE'),
      ('HEALTH_SETTLEMENT_CLERK', 'HEALTH_FEE_POLICY',      'READ'),
      ('HEALTH_SETTLEMENT_CLERK', 'HEALTH_FEE_CONTRIBUTOR', 'READ'),

      -- Menyetujui; tidak menghitung, tidak membayar.
      ('HEALTH_FEE_APPROVER', 'HEALTH_FEE_SETTLEMENT', 'READ'),
      ('HEALTH_FEE_APPROVER', 'HEALTH_FEE_SETTLEMENT', 'APPROVE'),

      -- Mengunci, membayar, menerbitkan pernyataan; tidak menghitung, tidak
      -- menyetujui.
      ('HEALTH_SETTLEMENT_PAYER', 'HEALTH',                'READ'),
      ('HEALTH_SETTLEMENT_PAYER', 'HEALTH_FEE_SETTLEMENT', 'READ'),
      ('HEALTH_SETTLEMENT_PAYER', 'HEALTH_FEE_SETTLEMENT', 'POST'),
      ('HEALTH_SETTLEMENT_PAYER', 'HEALTH_FEE_STATEMENT',  'READ'),
      ('HEALTH_SETTLEMENT_PAYER', 'HEALTH_FEE_STATEMENT',  'CREATE'),
      ('HEALTH_SETTLEMENT_PAYER', 'HEALTH_FEE_STATEMENT',  'EXPORT'),

      -- Mengoreksi. Diberikan kepada petugas keuangan, yang tidak menghitung
      -- maupun membayar — sehingga koreksinya diperiksa orang keempat.
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_FEE_SETTLEMENT', 'READ'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_FEE_SETTLEMENT', 'REVERSE'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_FEE_STATEMENT',  'READ'),

      ('HEALTH_DIRECTOR', 'HEALTH_FEE_SETTLEMENT', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_FEE_STATEMENT',  'READ')
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
    ('HEALTH_SOD_SETTLEMENT_APPROVE', 'Petugas kalkulasi tidak menyetujui settlement sendiri',
    'Perhitungan yang diperiksa oleh yang menghitungnya bukan pemeriksaan. Settlement menentukan berapa uang yang berpindah dari kas rumah sakit ke rekening tenaga medisnya, dan angka yang keliru pada tahap ini akan ditemukan berbulan-bulan kemudian — bila ditemukan sama sekali. Ditegakkan constraint fee_settlement_approval_not_self pada basis data pula.',
    'HIGH'),
    ('HEALTH_SOD_SETTLEMENT_PAY', 'Penyetuju settlement tidak membayarkannya',
    'Persetujuan yang langsung menjadi transfer menghilangkan jeda terakhir sebelum uang berpindah. Jeda itu bukan birokrasi: ia satu-satunya kesempatan bagi orang ketiga untuk melihat angkanya sebelum ia tidak dapat ditarik kembali.',
    'MEDIUM'),
    ('HEALTH_SOD_SETTLEMENT_CORRECT', 'Pembuat koreksi tidak menyetujuinya',
    'Koreksi adalah tempat paling mudah untuk memindahkan uang tanpa ada yang melihat, sebab ia terlihat seperti pembetulan. Penyesuaian yang dibuat dan disetujui orang yang sama tidak dapat dibedakan dari pemindahan yang disengaja. Ditegakkan constraint fee_correction_approval_not_self pada basis data pula.',
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
      ('HEALTH_SOD_SETTLEMENT_APPROVE', 'HEALTH_SETTLEMENT_CLERK', 'PREPARER'),
      ('HEALTH_SOD_SETTLEMENT_APPROVE', 'HEALTH_FEE_APPROVER',     'APPROVER'),
      ('HEALTH_SOD_SETTLEMENT_PAY',     'HEALTH_FEE_APPROVER',     'APPROVER'),
      ('HEALTH_SOD_SETTLEMENT_PAY',     'HEALTH_SETTLEMENT_PAYER', 'EXECUTOR'),
      ('HEALTH_SOD_SETTLEMENT_CORRECT', 'HEALTH_FINANCE_OFFICER',  'PREPARER')
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
