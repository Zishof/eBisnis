-- =========================================================================
-- H017 — MENU, HAK AKSES, DAN PERAN REKAM MEDIS, MUTU, DAN KESELAMATAN
-- =========================================================================
--
-- Fase H-9. Aditif seluruhnya.
--
-- Dua keputusan hak akses yang berlawanan arah, dan keduanya disengaja.
--
-- 1. **Pelaporan insiden sengaja LONGGAR.** Seluruh peran klinis memperoleh
--    HEALTH_SAFETY.CREATE. Program keselamatan pasien bergantung pada orang yang
--    mau melapor; membatasinya kepada peran tertentu akan menghentikan laporan
--    dari orang yang justru paling sering melihat kejadiannya — perawat malam,
--    petugas kebersihan yang melihat pasien jatuh, tenaga teknis yang melihat
--    alat berperilaku aneh.
--
-- 2. **Penahanan hukum sengaja SEMPIT.** Ia menahan perubahan seluruh rekam
--    medis seorang pasien, dan wewenang sebesar itu tidak boleh melekat pada
--    peran yang dipegang puluhan orang.

-- ---------------------------------------------------------------------------
-- Aksi yang belum ada
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".permission_action
  (code, name, name_key, action_type, requires_step_up, is_system, sort_order)
SELECT v.code, v.name, v.name_key, v.action_type, v.requires_step_up, TRUE, v.sort_order
  FROM (VALUES
    ('VERIFY', 'Memverifikasi', 'action.verify', 'APPROVE', FALSE, 115)
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
      ('HEALTH_HIM_CODING',   'Pengkodean Rekam Medis', 'menu.health.coding',    '/app/emedik/koding',      'file-code',      '/HEALTH/HEALTH_HIM_CODING',   90),
      ('HEALTH_LEGAL_HOLD',   'Penahanan Hukum',        'menu.health.legal_hold','/app/emedik/penahanan',   'gavel',          '/HEALTH/HEALTH_LEGAL_HOLD',   91),
      ('HEALTH_INFO_RELEASE', 'Pelepasan Informasi',    'menu.health.release',   '/app/emedik/pelepasan',   'share-2',        '/HEALTH/HEALTH_INFO_RELEASE', 92),
      ('HEALTH_SAFETY',       'Keselamatan Pasien',     'menu.health.safety',    '/app/emedik/keselamatan', 'shield-alert',   '/HEALTH/HEALTH_SAFETY',       93),
      ('HEALTH_QUALITY',      'Indikator Mutu',         'menu.health.quality',   '/app/emedik/mutu',        'gauge',          '/HEALTH/HEALTH_QUALITY',      94),
      ('HEALTH_TERMINOLOGY',  'Terminologi',            'menu.health.terminology','/app/emedik/terminologi','book-open',      '/HEALTH/HEALTH_TERMINOLOGY',  95)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );

  UPDATE "{{TENANT_SCHEMA}}".menu
     SET deleted_at = now()
   WHERE code = 'HEALTH_CLAIM' AND deleted_at IS NULL;
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
      ('HEALTH_HIM_CODING',   'READ'),
      ('HEALTH_HIM_CODING',   'CREATE'),
      ('HEALTH_HIM_CODING',   'VERIFY'),
      ('HEALTH_LEGAL_HOLD',   'READ'),
      ('HEALTH_LEGAL_HOLD',   'CREATE'),
      ('HEALTH_LEGAL_HOLD',   'DELETE'),
      ('HEALTH_INFO_RELEASE', 'READ'),
      ('HEALTH_INFO_RELEASE', 'CREATE'),
      ('HEALTH_INFO_RELEASE', 'EXPORT'),
      ('HEALTH_SAFETY',       'READ'),
      ('HEALTH_SAFETY',       'CREATE'),
      ('HEALTH_SAFETY',       'UPDATE'),
      ('HEALTH_SAFETY',       'APPROVE'),
      ('HEALTH_QUALITY',      'READ'),
      ('HEALTH_QUALITY',      'CREATE'),
      ('HEALTH_QUALITY',      'UPDATE'),
      ('HEALTH_QUALITY',      'EXPORT'),
      ('HEALTH_TERMINOLOGY',  'READ'),
      ('HEALTH_TERMINOLOGY',  'IMPORT'),
      ('HEALTH_TERMINOLOGY',  'APPROVE')
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
    ('HEALTH_CODER', 'Koder Rekam Medis',
     'Mengode diagnosis dan tindakan. TIDAK memverifikasi pengkodeannya sendiri.'),
    ('HEALTH_CODING_VERIFIER', 'Verifikator Koding',
     'Memverifikasi pengkodean. TIDAK mengode.'),
    ('HEALTH_PATIENT_SAFETY_OFFICER', 'Petugas Keselamatan Pasien',
     'Menelaah dan menutup laporan insiden, serta mengelola indikator mutu.'),
    ('HEALTH_LEGAL_OFFICER', 'Petugas Hukum Rumah Sakit',
     'Memasang dan mencabut penahanan hukum, serta memutuskan pelepasan informasi.')
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
      -- Koder mengode; ia TIDAK memverifikasi.
      ('HEALTH_CODER', 'HEALTH',            'READ'),
      ('HEALTH_CODER', 'HEALTH_PATIENT',    'READ'),
      ('HEALTH_CODER', 'HEALTH_HIM_CODING', 'READ'),
      ('HEALTH_CODER', 'HEALTH_HIM_CODING', 'CREATE'),
      ('HEALTH_CODER', 'HEALTH_TERMINOLOGY','READ'),

      -- Verifikator memverifikasi; ia TIDAK mengode.
      ('HEALTH_CODING_VERIFIER', 'HEALTH',            'READ'),
      ('HEALTH_CODING_VERIFIER', 'HEALTH_PATIENT',    'READ'),
      ('HEALTH_CODING_VERIFIER', 'HEALTH_HIM_CODING', 'READ'),
      ('HEALTH_CODING_VERIFIER', 'HEALTH_HIM_CODING', 'VERIFY'),
      ('HEALTH_CODING_VERIFIER', 'HEALTH_TERMINOLOGY','READ'),

      -- Petugas rekam medis: kelengkapan, terminologi, pelepasan informasi.
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_HIM_CODING',  'READ'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_INFO_RELEASE','READ'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_INFO_RELEASE','EXPORT'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_TERMINOLOGY', 'READ'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_TERMINOLOGY', 'IMPORT'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_LEGAL_HOLD',  'READ'),

      -- Petugas hukum: penahanan dan keputusan pelepasan. Sempit dengan sengaja.
      ('HEALTH_LEGAL_OFFICER', 'HEALTH',             'READ'),
      ('HEALTH_LEGAL_OFFICER', 'HEALTH_PATIENT',     'READ'),
      ('HEALTH_LEGAL_OFFICER', 'HEALTH_LEGAL_HOLD',  'READ'),
      ('HEALTH_LEGAL_OFFICER', 'HEALTH_LEGAL_HOLD',  'CREATE'),
      ('HEALTH_LEGAL_OFFICER', 'HEALTH_LEGAL_HOLD',  'DELETE'),
      ('HEALTH_LEGAL_OFFICER', 'HEALTH_INFO_RELEASE','READ'),
      ('HEALTH_LEGAL_OFFICER', 'HEALTH_INFO_RELEASE','CREATE'),

      -- Petugas keselamatan pasien: menelaah dan menutup, serta mutu.
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH',          'READ'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_PATIENT',  'READ'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_SAFETY',   'READ'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_SAFETY',   'CREATE'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_SAFETY',   'UPDATE'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_SAFETY',   'APPROVE'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_QUALITY',  'READ'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_QUALITY',  'CREATE'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_QUALITY',  'UPDATE'),
      ('HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_HIM_CODING','READ'),

      /*
       * PELAPORAN INSIDEN SENGAJA LONGGAR.
       *
       * Seluruh peran klinis boleh melapor. Yang paling sering melihat kejadian
       * bukan petugas mutu — melainkan perawat malam, apoteker yang menerima
       * resep aneh, dan analis yang menerima spesimen tanpa label.
       */
      ('HEALTH_DOCTOR',              'HEALTH_SAFETY', 'READ'),
      ('HEALTH_DOCTOR',              'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_NURSE',               'HEALTH_SAFETY', 'READ'),
      ('HEALTH_NURSE',               'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_PHARMACIST',          'HEALTH_SAFETY', 'READ'),
      ('HEALTH_PHARMACIST',          'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_PHARMACY_TECHNICIAN', 'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_LAB_ANALYST',         'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_LAB_SUPERVISOR',      'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_RADIOGRAPHER',        'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_SCRUB_NURSE',         'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_SURGEON',             'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_TRIAGE_NURSE',        'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_INTENSIVIST',         'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_WARD_CLERK',          'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_CADRE',               'HEALTH_SAFETY', 'CREATE'),
      ('HEALTH_PHC_OFFICER',         'HEALTH_SAFETY', 'CREATE'),

      ('HEALTH_DIRECTOR', 'HEALTH_SAFETY',    'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_QUALITY',   'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_QUALITY',   'EXPORT'),
      ('HEALTH_DIRECTOR', 'HEALTH_HIM_CODING','READ'),

      ('HEALTH_QUALITY_MANAGER', 'HEALTH_SAFETY',     'READ'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_SAFETY',     'UPDATE'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_SAFETY',     'APPROVE'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_QUALITY',    'READ'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_QUALITY',    'CREATE'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_QUALITY',    'UPDATE'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_QUALITY',    'EXPORT'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_HIM_CODING', 'READ')
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
    ('HEALTH_SOD_CODE_VERIFY', 'Koder tidak memverifikasi pengkodeannya sendiri',
    'Pengkodean menentukan nilai klaim. Koder yang memverifikasi pengkodeannya sendiri tidak memeriksa apa pun — ia hanya menekan tombol kedua. Fasilitas dengan satu koder dapat mematikan pemisahan ini secara sah dan tercatat lewat kebijakan; yang dilarang adalah menyiasatinya.',
    'HIGH'),
    ('HEALTH_SOD_HOLD_RELEASE', 'Pemasang penahanan hukum tidak mencabutnya sendiri',
    'Penahanan yang dipasang dan dicabut orang yang sama dapat dipasang sekadar untuk menghalangi, lalu dicabut setelah keperluannya lewat — tanpa ada pihak kedua yang pernah melihatnya. Ditegakkan constraint basis data pula.',
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
      ('HEALTH_SOD_CODE_VERIFY', 'HEALTH_CODER',            'PREPARER'),
      ('HEALTH_SOD_CODE_VERIFY', 'HEALTH_CODING_VERIFIER',  'APPROVER'),
      ('HEALTH_SOD_HOLD_RELEASE','HEALTH_LEGAL_OFFICER',    'PREPARER')
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
