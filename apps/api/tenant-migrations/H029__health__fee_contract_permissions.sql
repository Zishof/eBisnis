-- =========================================================================
-- H029 — MENU, HAK AKSES, DAN PERAN KONTRAK FEE
-- =========================================================================
--
-- Fase H-9G. Aditif seluruhnya.
--
-- **Tiga peran, tiga orang, satu kontrak.** Penyusun kontrak, pemeriksa hukum,
-- dan penyetuju manajemen. Bukan dua — kontrak ini mengambil bagian dari
-- kumpulan yang sama dengan jasa tenaga medis, dan yang dirugikannya tidak
-- duduk di ruangan itu.
--
-- Satu hal lagi yang ditegakkan di sini: **peran investor tidak memperoleh satu
-- pun hak atas menu pasien.** Ia dibuat pada fase ini justru supaya batasnya
-- tercatat sejak sekarang — sebelum ada dasbor yang menggodanya. Yang
-- membedakan pembagian hasil dari pembukaan rekam medis bukan niat, melainkan
-- hak akses mana yang pernah diberikan.

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
      ('HEALTH_FEE_CONTRACT', 'Kontrak Fee', 'menu.health.fee_contract', '/app/emedik/kontrak-fee', 'file-signature', '/HEALTH/HEALTH_FEE_CONTRACT', 106)
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
      ('HEALTH_FEE_CONTRACT', 'READ'),
      ('HEALTH_FEE_CONTRACT', 'CREATE'),
      ('HEALTH_FEE_CONTRACT', 'UPDATE'),
      -- REVIEW menelaah hukum; APPROVE menyetujui manajemen; ACTIVATE
      -- mengaktifkan. Ketiganya sengaja terpisah.
      ('HEALTH_FEE_CONTRACT', 'REVIEW'),
      ('HEALTH_FEE_CONTRACT', 'APPROVE'),
      ('HEALTH_FEE_CONTRACT', 'ACTIVATE'),
      ('HEALTH_FEE_CONTRACT', 'CANCEL')
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
    ('HEALTH_CONTRACT_DRAFTER', 'Penyusun Kontrak Fee',
     'Menyusun kontrak fee sistem dan fee investor. TIDAK menelaah hukum, TIDAK menyetujui, dan TIDAK mengaktifkan.'),
    ('HEALTH_CONTRACT_APPROVER', 'Penyetuju Kontrak Fee',
     'Menyetujui kontrak fee atas nama manajemen dan mengaktifkannya. TIDAK menyusun dan TIDAK menelaah hukum.'),
    ('HEALTH_INVESTOR_VIEWER', 'Pemegang Kontrak Investor',
     'Melihat ringkasan hasil usaha menurut kontraknya. TIDAK memperoleh satu pun hak atas data pasien.')
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
      -- Menyusun; tidak menelaah, tidak menyetujui, tidak mengaktifkan.
      ('HEALTH_CONTRACT_DRAFTER', 'HEALTH',              'READ'),
      ('HEALTH_CONTRACT_DRAFTER', 'HEALTH_FEE_CONTRACT', 'READ'),
      ('HEALTH_CONTRACT_DRAFTER', 'HEALTH_FEE_CONTRACT', 'CREATE'),
      ('HEALTH_CONTRACT_DRAFTER', 'HEALTH_FEE_CONTRACT', 'UPDATE'),
      ('HEALTH_CONTRACT_DRAFTER', 'HEALTH_SERVICE_CATALOG', 'READ'),

      -- Menelaah hukum. Petugas hukum rumah sakit sudah ada sejak H-9; ia
      -- memang orang yang menelaah kontrak.
      ('HEALTH_LEGAL_OFFICER', 'HEALTH_FEE_CONTRACT', 'READ'),
      ('HEALTH_LEGAL_OFFICER', 'HEALTH_FEE_CONTRACT', 'REVIEW'),

      -- Menyetujui dan mengaktifkan; tidak menyusun, tidak menelaah.
      ('HEALTH_CONTRACT_APPROVER', 'HEALTH',              'READ'),
      ('HEALTH_CONTRACT_APPROVER', 'HEALTH_FEE_CONTRACT', 'READ'),
      ('HEALTH_CONTRACT_APPROVER', 'HEALTH_FEE_CONTRACT', 'APPROVE'),
      ('HEALTH_CONTRACT_APPROVER', 'HEALTH_FEE_CONTRACT', 'ACTIVATE'),
      ('HEALTH_CONTRACT_APPROVER', 'HEALTH_FEE_CONTRACT', 'CANCEL'),

      /*
       * PEMEGANG KONTRAK INVESTOR.
       *
       * Sengaja hanya READ atas menu kontraknya sendiri. Ia TIDAK diberi
       * HEALTH_PATIENT apa pun, tidak HEALTH_SAFETY, tidak HEALTH_HIM_CODING —
       * dan pemeriksaan itu ditegakkan pengujian katalog, bukan hanya oleh
       * kehati-hatian orang yang kelak menyunting berkas ini.
       */
      ('HEALTH_INVESTOR_VIEWER', 'HEALTH',              'READ'),
      ('HEALTH_INVESTOR_VIEWER', 'HEALTH_FEE_CONTRACT', 'READ'),

      ('HEALTH_FINANCE_OFFICER', 'HEALTH_FEE_CONTRACT', 'READ'),
      ('HEALTH_DIRECTOR',        'HEALTH_FEE_CONTRACT', 'READ')
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
    ('HEALTH_SOD_CONTRACT_DRAFT_REVIEW', 'Penyusun kontrak fee tidak menelaah hukumnya',
    'Telaah hukum yang dilakukan penyusunnya sendiri hanya membaca ulang kalimat yang baru saja ditulisnya. Kontrak fee mengambil bagian dari kumpulan yang sama dengan jasa tenaga medis, dan yang dirugikannya tidak duduk di ruangan itu — satu-satunya pengganti kehadirannya adalah jumlah mata yang melihat. Ditegakkan constraint fee_contract_prepare_review_differ pada basis data pula.',
    'HIGH'),
    ('HEALTH_SOD_CONTRACT_REVIEW_APPROVE', 'Pemeriksa hukum tidak menyetujui kontraknya',
    'Telaah hukum menyatakan kontraknya sah; persetujuan manajemen menyatakan kontraknya dikehendaki. Dua pertanyaan yang berbeda, dan menyatukan penjawabnya membuat pertanyaan kedua tidak pernah benar-benar ditanyakan. Ditegakkan constraint fee_contract_review_approve_differ pula.',
    'HIGH'),
    ('HEALTH_SOD_INVESTOR_PATIENT', 'Pemegang kontrak investor tidak membaca data pasien',
    'Kontrak investor mengatur pembagian hasil, bukan pembukaan rekam medis. Yang membedakan keduanya bukan niat melainkan hak akses mana yang pernah diberikan — dan hak yang pernah diberikan jarang ditarik kembali, sebab menariknya menuntut seseorang menyadari bahwa ia pernah diberikan.',
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
      ('HEALTH_SOD_CONTRACT_DRAFT_REVIEW',   'HEALTH_CONTRACT_DRAFTER',  'PREPARER'),
      ('HEALTH_SOD_CONTRACT_DRAFT_REVIEW',   'HEALTH_LEGAL_OFFICER',     'APPROVER'),
      ('HEALTH_SOD_CONTRACT_REVIEW_APPROVE', 'HEALTH_LEGAL_OFFICER',     'PREPARER'),
      ('HEALTH_SOD_CONTRACT_REVIEW_APPROVE', 'HEALTH_CONTRACT_APPROVER', 'APPROVER'),
      ('HEALTH_SOD_INVESTOR_PATIENT',        'HEALTH_INVESTOR_VIEWER',   'CUSTODIAN')
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
