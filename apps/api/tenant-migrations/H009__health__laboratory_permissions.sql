-- =========================================================================
-- H009 — MENU, HAK AKSES, DAN PERAN LABORATORIUM
-- =========================================================================
--
-- Fase H-5. Aditif seluruhnya.
--
-- Lima menu, dan pemisahan yang paling menentukan ada di antara tiga di
-- antaranya:
--
--   memasukkan hasil → memverifikasi → menerima nilai kritis
--
-- Analis yang mengetik angkanya juga menyatakan angkanya benar bukanlah
-- verifikasi. Dan analis yang menelepon dokter lalu mencatat sendiri bahwa
-- dokternya sudah menerima hanya membuktikan bahwa ia menekan dua tombol.

-- ---------------------------------------------------------------------------
-- Aksi yang belum ada
-- ---------------------------------------------------------------------------
-- VERIFY_RESULT dan ACKNOWLEDGE_CRITICAL sudah disemai H005. Yang kurang dua.
INSERT INTO "{{TENANT_SCHEMA}}".permission_action
  (code, name, name_key, action_type, requires_step_up, is_system, sort_order)
SELECT v.code, v.name, v.name_key, v.action_type, v.requires_step_up, TRUE, v.sort_order
  FROM (VALUES
    ('RECEIVE', 'Menerima Spesimen', 'action.receive', 'WRITE', FALSE, 109),
    -- Amandemen menuntut step-up: hasil yang sudah dilepas mungkin sudah
    -- dipakai mengambil keputusan, dan mengubahnya harus terasa berat.
    ('AMEND',   'Mengamandemen Hasil', 'action.amend',  'WRITE', TRUE,  110)
  ) AS v(code, name, name_key, action_type, requires_step_up, sort_order)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".permission_action p WHERE p.code = v.code
 );

-- ---------------------------------------------------------------------------
-- Menu laboratorium
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
      ('HEALTH_LAB_ORDER',    'Pesanan Pemeriksaan', 'menu.health.lab_order',    '/app/emedik/lab/pesanan',  'flask-conical', '/HEALTH/HEALTH_LAB_ORDER',    40),
      ('HEALTH_LAB_SPECIMEN', 'Spesimen',            'menu.health.lab_specimen', '/app/emedik/lab/spesimen', 'test-tube',     '/HEALTH/HEALTH_LAB_SPECIMEN', 41),
      ('HEALTH_LAB_RESULT',   'Hasil Pemeriksaan',   'menu.health.lab_result',   '/app/emedik/lab/hasil',    'file-check',    '/HEALTH/HEALTH_LAB_RESULT',   42),
      ('HEALTH_LAB_CRITICAL', 'Nilai Kritis',        'menu.health.lab_critical', '/app/emedik/lab/kritis',   'alert-octagon', '/HEALTH/HEALTH_LAB_CRITICAL', 43),
      ('HEALTH_LAB_CATALOG',  'Katalog Pemeriksaan', 'menu.health.lab_catalog',  '/app/emedik/lab/katalog',  'list-checks',   '/HEALTH/HEALTH_LAB_CATALOG',  44)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );

  -- Penampung lama ditutup; keduanya digantikan lima menu di atas dan tidak
  -- satu pun peran pernah diberi hak atasnya.
  UPDATE "{{TENANT_SCHEMA}}".menu
     SET deleted_at = now()
   WHERE code IN ('HEALTH_LABORATORY', 'HEALTH_RADIOLOGY') AND deleted_at IS NULL;
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
      ('HEALTH_LAB_ORDER',    'READ'),
      ('HEALTH_LAB_ORDER',    'CREATE'),
      ('HEALTH_LAB_ORDER',    'CANCEL'),
      ('HEALTH_LAB_SPECIMEN', 'READ'),
      ('HEALTH_LAB_SPECIMEN', 'CREATE'),
      ('HEALTH_LAB_SPECIMEN', 'RECEIVE'),
      ('HEALTH_LAB_RESULT',   'READ'),
      ('HEALTH_LAB_RESULT',   'CREATE'),
      ('HEALTH_LAB_RESULT',   'VERIFY_RESULT'),
      ('HEALTH_LAB_RESULT',   'AMEND'),
      ('HEALTH_LAB_CRITICAL', 'READ'),
      ('HEALTH_LAB_CRITICAL', 'CREATE'),
      ('HEALTH_LAB_CRITICAL', 'ACKNOWLEDGE_CRITICAL'),
      ('HEALTH_LAB_CATALOG',  'READ'),
      ('HEALTH_LAB_CATALOG',  'CREATE'),
      ('HEALTH_LAB_CATALOG',  'UPDATE')
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
-- Peran laboratorium
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".role (code, name, description, is_system, is_core)
SELECT v.code, v.name, v.description, TRUE, FALSE
  FROM (VALUES
    ('HEALTH_LAB_ANALYST',    'Analis Laboratorium',
     'Menerima spesimen dan memasukkan hasil pemeriksaan. TIDAK memverifikasi hasilnya sendiri.'),
    ('HEALTH_LAB_SUPERVISOR', 'Penanggung Jawab Laboratorium',
     'Memverifikasi dan melepas hasil, mengelola katalog dan rentang rujukan.'),
    ('HEALTH_RADIOGRAPHER',   'Radiografer',
     'Mengerjakan pemeriksaan radiologi dan mengunggah rujukan citra.')
  ) AS v(code, name, description)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".role r WHERE r.code = v.code
 );

-- ---------------------------------------------------------------------------
-- Hak akses tiap peran
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pasangan RECORD;
  r_id UUID;
  m_id UUID;
  a_id UUID;
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      -- Analis: menerima spesimen, memasukkan hasil, MENYAMPAIKAN nilai kritis.
      -- Tidak memverifikasi, dan tidak menerima nilai kritis.
      ('HEALTH_LAB_ANALYST', 'HEALTH',              'READ'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_PATIENT',      'READ'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_LAB_ORDER',    'READ'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_LAB_SPECIMEN', 'READ'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_LAB_SPECIMEN', 'RECEIVE'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_LAB_RESULT',   'READ'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_LAB_RESULT',   'CREATE'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_LAB_CRITICAL', 'READ'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_LAB_CRITICAL', 'CREATE'),
      ('HEALTH_LAB_ANALYST', 'HEALTH_LAB_CATALOG',  'READ'),

      -- Penanggung jawab: memverifikasi, melepas, mengamandemen, mengelola
      -- katalog. Tidak memasukkan hasil.
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH',              'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_PATIENT',      'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_ORDER',    'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_SPECIMEN', 'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_RESULT',   'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_RESULT',   'VERIFY_RESULT'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_RESULT',   'AMEND'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_CRITICAL', 'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_CRITICAL', 'CREATE'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_CATALOG',  'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_CATALOG',  'CREATE'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_LAB_CATALOG',  'UPDATE'),

      ('HEALTH_RADIOGRAPHER', 'HEALTH',            'READ'),
      ('HEALTH_RADIOGRAPHER', 'HEALTH_PATIENT',    'READ'),
      ('HEALTH_RADIOGRAPHER', 'HEALTH_LAB_ORDER',  'READ'),
      ('HEALTH_RADIOGRAPHER', 'HEALTH_LAB_RESULT', 'READ'),
      ('HEALTH_RADIOGRAPHER', 'HEALTH_LAB_RESULT', 'CREATE'),
      ('HEALTH_RADIOGRAPHER', 'HEALTH_LAB_CATALOG','READ'),

      -- Dokter memesan pemeriksaan dan MENERIMA nilai kritis. Penerimaan itu
      -- memang tugasnya: ia yang akan bertindak atas angkanya.
      ('HEALTH_DOCTOR', 'HEALTH_LAB_ORDER',    'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_LAB_ORDER',    'CREATE'),
      ('HEALTH_DOCTOR', 'HEALTH_LAB_RESULT',   'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_LAB_CRITICAL', 'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_LAB_CRITICAL', 'ACKNOWLEDGE_CRITICAL'),
      ('HEALTH_DOCTOR', 'HEALTH_LAB_CATALOG',  'READ'),

      ('HEALTH_NURSE', 'HEALTH_LAB_ORDER',    'READ'),
      ('HEALTH_NURSE', 'HEALTH_LAB_SPECIMEN', 'READ'),
      ('HEALTH_NURSE', 'HEALTH_LAB_SPECIMEN', 'CREATE'),
      ('HEALTH_NURSE', 'HEALTH_LAB_RESULT',   'READ'),
      ('HEALTH_NURSE', 'HEALTH_LAB_CRITICAL', 'READ')
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
-- Aturan pemisahan wewenang laboratorium
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".segregation_of_duty_rule
  (code, name, description, severity, is_active, is_system)
SELECT v.code, v.name, v.description, v.severity, TRUE, TRUE
  FROM (VALUES
    ('HEALTH_SOD_RESULT_VERIFY', 'Pemasuk hasil tidak memverifikasi hasilnya sendiri',
    'Alasan yang sama seperti telaah apoteker: orang yang mengetik angkanya adalah orang yang paling sulit melihat kekeliruannya. Basis data menegakkannya pula lewat constraint lab_result_verify_not_self, dengan pengecualian verifikasi otomatis — di sana yang memasukkan hasilnya adalah alat, bukan orang.',
    'CRITICAL'),
    ('HEALTH_SOD_CRITICAL_ACK', 'Penyampai nilai kritis tidak menerimanya sendiri',
    'Penerimaan nilai kritis membuktikan bahwa dokter yang merawat benar-benar mendengar angkanya. Bila analis yang menyampaikan juga yang mencatat penerimaannya, catatan itu hanya membuktikan bahwa ia menekan dua tombol.',
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
      ('HEALTH_SOD_RESULT_VERIFY', 'HEALTH_LAB_ANALYST',    'PREPARER'),
      ('HEALTH_SOD_RESULT_VERIFY', 'HEALTH_LAB_SUPERVISOR', 'APPROVER'),
      ('HEALTH_SOD_CRITICAL_ACK',  'HEALTH_LAB_ANALYST',    'PREPARER'),
      ('HEALTH_SOD_CRITICAL_ACK',  'HEALTH_DOCTOR',         'APPROVER')
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
