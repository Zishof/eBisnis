-- =========================================================================
-- H025 — MENU, HAK AKSES, DAN PERAN KEBIJAKAN JASA
-- =========================================================================
--
-- Fase H-9E. Aditif seluruhnya.
--
-- Tiga pemisahan menentukan bentuknya, dan yang ketiga paling sulit dilihat.
--
-- 1. Pembuat kebijakan tidak menyetujui versinya sendiri.
-- 2. Petugas kalkulasi tidak menyetujui settlement sendiri.
-- 3. **Penerima jasa tidak mengubah aturan yang membayar dirinya.**
--
-- Yang ketiga tidak dapat ditegakkan hanya dengan hak akses: dokter yang juga
-- administrator sistem memegang dua peran yang sah masing-masing. Karena itu ia
-- ditegakkan pada tingkat baris — penyetuju yang tertaut pada pemberi layanan
-- yang tersebut di dalam kebijakannya ditolak, sekalipun hak aksesnya lengkap.
-- Hak akses menjaga siapa yang boleh membuka pintu; pemeriksaan baris menjaga
-- siapa yang boleh melewatinya kali ini.

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
      ('HEALTH_FEE_POLICY',  'Kebijakan Jasa',    'menu.health.fee_policy',  '/app/emedik/kebijakan-jasa', 'percent',     '/HEALTH/HEALTH_FEE_POLICY',  102),
      ('HEALTH_FEE_CONTRIBUTOR', 'Kontributor Tindakan', 'menu.health.fee_contributor', '/app/emedik/kontributor', 'users-round', '/HEALTH/HEALTH_FEE_CONTRIBUTOR', 103)
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
      ('HEALTH_FEE_POLICY', 'READ'),
      ('HEALTH_FEE_POLICY', 'CREATE'),
      ('HEALTH_FEE_POLICY', 'UPDATE'),
      ('HEALTH_FEE_POLICY', 'APPROVE'),
      ('HEALTH_FEE_POLICY', 'ACTIVATE'),
      ('HEALTH_FEE_CONTRIBUTOR', 'READ'),
      ('HEALTH_FEE_CONTRIBUTOR', 'CREATE'),
      ('HEALTH_FEE_CONTRIBUTOR', 'UPDATE')
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
    ('HEALTH_FEE_ADMINISTRATOR', 'Petugas Kebijakan Jasa',
     'Menyusun kebijakan pembagian jasa dan mencatat kontributor. TIDAK menyetujui kebijakan.'),
    ('HEALTH_FEE_APPROVER', 'Penyetuju Kebijakan Jasa',
     'Menyetujui dan mengaktifkan kebijakan pembagian jasa. TIDAK menyusunnya, dan tidak boleh menjadi penerima pada kebijakan yang disetujuinya.')
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
      -- Menyusun; TIDAK menyetujui.
      ('HEALTH_FEE_ADMINISTRATOR', 'HEALTH',                  'READ'),
      ('HEALTH_FEE_ADMINISTRATOR', 'HEALTH_FEE_POLICY',       'READ'),
      ('HEALTH_FEE_ADMINISTRATOR', 'HEALTH_FEE_POLICY',       'CREATE'),
      ('HEALTH_FEE_ADMINISTRATOR', 'HEALTH_FEE_POLICY',       'UPDATE'),
      ('HEALTH_FEE_ADMINISTRATOR', 'HEALTH_FEE_CONTRIBUTOR',  'READ'),
      ('HEALTH_FEE_ADMINISTRATOR', 'HEALTH_FEE_CONTRIBUTOR',  'CREATE'),
      ('HEALTH_FEE_ADMINISTRATOR', 'HEALTH_FEE_CONTRIBUTOR',  'UPDATE'),
      ('HEALTH_FEE_ADMINISTRATOR', 'HEALTH_SERVICE_CATALOG',  'READ'),

      -- Menyetujui; TIDAK menyusun.
      ('HEALTH_FEE_APPROVER', 'HEALTH',            'READ'),
      ('HEALTH_FEE_APPROVER', 'HEALTH_FEE_POLICY', 'READ'),
      ('HEALTH_FEE_APPROVER', 'HEALTH_FEE_POLICY', 'APPROVE'),
      ('HEALTH_FEE_APPROVER', 'HEALTH_FEE_POLICY', 'ACTIVATE'),

      -- Petugas keuangan membaca; ia memetakan akunnya.
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_FEE_POLICY', 'READ'),

      -- Perawat instrumen dan penata anestesi mencatat siapa yang hadir di
      -- kamar operasi. Mereka yang melihatnya, bukan bagian keuangan.
      ('HEALTH_SCRUB_NURSE', 'HEALTH_FEE_CONTRIBUTOR', 'READ'),
      ('HEALTH_SCRUB_NURSE', 'HEALTH_FEE_CONTRIBUTOR', 'CREATE'),

      ('HEALTH_DIRECTOR', 'HEALTH_FEE_POLICY',      'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_FEE_CONTRIBUTOR', 'READ')
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
    ('HEALTH_SOD_FEE_POLICY_APPROVE', 'Penyusun kebijakan jasa tidak menyetujuinya',
    'Persentase pembagian jasa adalah kesepakatan antara rumah sakit dan tenaga medisnya. Disetujui satu pihak saja, ia bukan kesepakatan melainkan keputusan sepihak yang kelak menjadi pokok sengketa. Ditegakkan constraint fee_policy_approval_not_self pada basis data pula.',
    'HIGH'),
    ('HEALTH_SOD_FEE_RECIPIENT_APPROVE', 'Penerima jasa tidak menyetujui aturan yang membayar dirinya',
    'Paling sering dilanggar dan paling sulit dilihat: dokter yang juga administrator sistem dapat menaikkan persentasenya sendiri, dan tidak ada yang akan menyadarinya sampai ada yang membandingkan dua bulan berturut-turut. Tidak dapat ditegakkan hanya dengan hak akses — keduanya peran yang sah masing-masing — sehingga diperiksa pada tingkat baris: penyetuju yang tertaut pada pemberi layanan yang tersebut di dalam kebijakannya ditolak.',
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
      ('HEALTH_SOD_FEE_POLICY_APPROVE', 'HEALTH_FEE_ADMINISTRATOR', 'PREPARER'),
      ('HEALTH_SOD_FEE_POLICY_APPROVE', 'HEALTH_FEE_APPROVER',      'APPROVER'),
      ('HEALTH_SOD_FEE_RECIPIENT_APPROVE', 'HEALTH_FEE_APPROVER',   'APPROVER')
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
