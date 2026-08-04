-- =========================================================================
-- H013 — MENU, HAK AKSES, DAN PERAN GAWAT DARURAT, BEDAH, DAN INTENSIF
-- =========================================================================
--
-- Fase H-7. Aditif seluruhnya.
--
-- Dua pemisahan yang menentukan:
--
--   menriase → menetapkan disposisi
--   mencentang daftar periksa → memulai sayatan
--
-- Yang menriase adalah perawat di depan pintu; yang memutuskan pasien boleh
-- pulang adalah dokter. Dan tidak seorang pun boleh mencentang daftar periksa
-- lalu langsung menyayat — jeda sebelum sayatan diucapkan oleh tim, bukan
-- diklik oleh satu orang.

-- ---------------------------------------------------------------------------
-- Aksi yang belum ada
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".permission_action
  (code, name, name_key, action_type, requires_step_up, is_system, sort_order)
SELECT v.code, v.name, v.name_key, v.action_type, v.requires_step_up, TRUE, v.sort_order
  FROM (VALUES
    ('TRIAGE',    'Menriase',                    'action.triage',    'WRITE', FALSE, 111),
    ('CHECKLIST', 'Mengisi Daftar Periksa Bedah','action.checklist', 'WRITE', FALSE, 112),
    -- Memulai sayatan menuntut step-up. Ia titik yang tidak dapat dibatalkan,
    -- dan tindakan yang tidak dapat dibatalkan harus terasa berat.
    ('INCISE',    'Memulai Sayatan',             'action.incise',    'WRITE', TRUE,  113)
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
      ('HEALTH_SURGERY', 'Kamar Operasi',    'menu.health.surgery', '/app/emedik/operasi',  'scissors',   '/HEALTH/HEALTH_SURGERY', 61),
      ('HEALTH_ICU',     'Perawatan Intensif','menu.health.icu',    '/app/emedik/intensif', 'activity',   '/HEALTH/HEALTH_ICU',     62)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );

  -- HEALTH_EMERGENCY sudah ada sejak H005 bertanda sedang dibangun. Kini ia
  -- berjalan.
  UPDATE "{{TENANT_SCHEMA}}".menu
     SET is_coming_soon = FALSE, route = '/app/emedik/igd', updated_at = now()
   WHERE code = 'HEALTH_EMERGENCY' AND deleted_at IS NULL;
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
      ('HEALTH_EMERGENCY', 'READ'),
      ('HEALTH_EMERGENCY', 'TRIAGE'),
      ('HEALTH_EMERGENCY', 'UPDATE'),
      -- Disposisi memakai DISCHARGE, bukan UPDATE: memutuskan pasien boleh
      -- pulang dari IGD adalah keputusan klinis yang sama beratnya dengan
      -- memulangkan pasien rawat inap.
      ('HEALTH_EMERGENCY', 'DISCHARGE'),
      ('HEALTH_SURGERY',   'READ'),
      ('HEALTH_SURGERY',   'CREATE'),
      ('HEALTH_SURGERY',   'UPDATE'),
      ('HEALTH_SURGERY',   'CHECKLIST'),
      ('HEALTH_SURGERY',   'INCISE'),
      ('HEALTH_SURGERY',   'CANCEL'),
      ('HEALTH_ICU',       'READ'),
      ('HEALTH_ICU',       'CREATE'),
      ('HEALTH_ICU',       'UPDATE')
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
    ('HEALTH_TRIAGE_NURSE',   'Perawat Triase',
     'Menriase pasien gawat darurat. TIDAK menetapkan disposisi.'),
    ('HEALTH_SURGEON',        'Dokter Bedah',
     'Menjadwalkan dan mengerjakan operasi.'),
    ('HEALTH_SCRUB_NURSE',    'Perawat Instrumen',
     'Mengisi daftar periksa bedah dan menghitung kasa. TIDAK memulai sayatan.'),
    ('HEALTH_INTENSIVIST',    'Dokter Intensif',
     'Mengelola perawatan intensif.')
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
      -- Perawat triase: menriase, tidak menetapkan disposisi.
      ('HEALTH_TRIAGE_NURSE', 'HEALTH',           'READ'),
      ('HEALTH_TRIAGE_NURSE', 'HEALTH_PATIENT',   'READ'),
      ('HEALTH_TRIAGE_NURSE', 'HEALTH_EMERGENCY', 'READ'),
      ('HEALTH_TRIAGE_NURSE', 'HEALTH_EMERGENCY', 'TRIAGE'),

      -- Dokter: melihat, menetapkan disposisi, dan menriase ulang bila perlu.
      ('HEALTH_DOCTOR', 'HEALTH_EMERGENCY', 'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_EMERGENCY', 'TRIAGE'),
      ('HEALTH_DOCTOR', 'HEALTH_EMERGENCY', 'UPDATE'),
      ('HEALTH_DOCTOR', 'HEALTH_EMERGENCY', 'DISCHARGE'),
      ('HEALTH_DOCTOR', 'HEALTH_SURGERY',   'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_ICU',       'READ'),

      -- Dokter bedah: menjadwalkan, menandai sisi, memulai sayatan.
      -- TIDAK mengisi daftar periksa: yang mengisinya perawat instrumen, dan
      -- pemisahan itulah yang membuat jeda sebelum sayatan menjadi percakapan
      -- alih-alih centang.
      ('HEALTH_SURGEON', 'HEALTH',           'READ'),
      ('HEALTH_SURGEON', 'HEALTH_PATIENT',   'READ'),
      ('HEALTH_SURGEON', 'HEALTH_SURGERY',   'READ'),
      ('HEALTH_SURGEON', 'HEALTH_SURGERY',   'CREATE'),
      ('HEALTH_SURGEON', 'HEALTH_SURGERY',   'UPDATE'),
      ('HEALTH_SURGEON', 'HEALTH_SURGERY',   'INCISE'),
      ('HEALTH_SURGEON', 'HEALTH_SURGERY',   'CANCEL'),

      -- Perawat instrumen: daftar periksa dan hitungan kasa. TIDAK menyayat.
      ('HEALTH_SCRUB_NURSE', 'HEALTH',         'READ'),
      ('HEALTH_SCRUB_NURSE', 'HEALTH_PATIENT', 'READ'),
      ('HEALTH_SCRUB_NURSE', 'HEALTH_SURGERY', 'READ'),
      ('HEALTH_SCRUB_NURSE', 'HEALTH_SURGERY', 'CHECKLIST'),
      ('HEALTH_SCRUB_NURSE', 'HEALTH_SURGERY', 'UPDATE'),

      ('HEALTH_INTENSIVIST', 'HEALTH',         'READ'),
      ('HEALTH_INTENSIVIST', 'HEALTH_PATIENT', 'READ'),
      ('HEALTH_INTENSIVIST', 'HEALTH_ICU',     'READ'),
      ('HEALTH_INTENSIVIST', 'HEALTH_ICU',     'CREATE'),
      ('HEALTH_INTENSIVIST', 'HEALTH_ICU',     'UPDATE'),
      ('HEALTH_INTENSIVIST', 'HEALTH_ADMISSION', 'READ'),

      ('HEALTH_NURSE', 'HEALTH_EMERGENCY', 'READ'),
      ('HEALTH_NURSE', 'HEALTH_ICU',       'READ'),
      ('HEALTH_NURSE', 'HEALTH_ICU',       'CREATE'),

      ('HEALTH_DIRECTOR', 'HEALTH_EMERGENCY', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_SURGERY',   'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_ICU',       'READ')
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
    ('HEALTH_SOD_CHECKLIST_INCISE', 'Pengisi daftar periksa bukan yang menyayat',
    'Jeda sebelum sayatan adalah percakapan tim, bukan centang satu orang. Bila yang mengisi daftar periksa juga yang memulai sayatan, seluruh gunanya hilang: ia hanya mengonfirmasi kepada dirinya sendiri apa yang sudah diyakininya. Basis data menegakkan sisi lain dari aturan yang sama lewat ot_case_timeout_before_incision — daftar periksa tidak dapat dicentang setelah pisau menyentuh kulit.',
    'CRITICAL'),
    ('HEALTH_SOD_TRIAGE_DISPOSITION', 'Penriase bukan yang menetapkan disposisi',
    'Yang menriase adalah perawat di depan pintu; yang memutuskan pasien boleh pulang adalah dokter. Menyatukannya membuat tekanan antrean berpindah langsung menjadi keputusan memulangkan.',
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
      ('HEALTH_SOD_CHECKLIST_INCISE',   'HEALTH_SCRUB_NURSE',  'PREPARER'),
      ('HEALTH_SOD_CHECKLIST_INCISE',   'HEALTH_SURGEON',      'EXECUTOR'),
      ('HEALTH_SOD_TRIAGE_DISPOSITION', 'HEALTH_TRIAGE_NURSE', 'PREPARER'),
      ('HEALTH_SOD_TRIAGE_DISPOSITION', 'HEALTH_DOCTOR',       'APPROVER')
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
