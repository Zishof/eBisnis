-- =========================================================================
-- H036 — MENU, HAK AKSES, DAN PERAN PEMELIHARAAN DAN KEAMANAN ALAT
-- =========================================================================
--
-- Fase H-9J. Aditif seluruhnya.
--
-- Pemisahan yang menentukan bentuknya: **yang menilai risiko siber alat bukan
-- yang memutuskan risiko itu ditanggung.**
--
-- Bukan karena penilainya tidak dipercaya. Penilaian menjawab "seberapa besar
-- risikonya"; keputusan menjawab "apakah rumah sakit menanggung risiko sebesar
-- itu". Pertanyaan kedua menyangkut uang, jadwal pengadaan, dan pelayanan yang
-- akan terhenti bila alatnya dipensiunkan — dan tidak satu pun di antaranya
-- diketahui orang yang memindai jaringan.
--
-- Menyatukan keduanya menghasilkan salah satu dari dua hal, dan keduanya
-- buruk: penilai yang menurunkan skornya sendiri supaya tidak perlu berdebat,
-- atau penilai yang menaikkan skornya sendiri supaya anggarannya turun.

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
      ('HEALTH_DEVICE_MAINTENANCE', 'Pemeliharaan Alat', 'menu.health.device_maintenance', '/app/emedik/pemeliharaan-alat', 'wrench',       '/HEALTH/HEALTH_DEVICE_MAINTENANCE', 113),
      ('HEALTH_DEVICE_SECURITY',    'Keamanan Alat',     'menu.health.device_security',    '/app/emedik/keamanan-alat',     'shield-alert', '/HEALTH/HEALTH_DEVICE_SECURITY',    114)
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
      ('HEALTH_DEVICE_MAINTENANCE', 'READ'),
      ('HEALTH_DEVICE_MAINTENANCE', 'CREATE'),
      ('HEALTH_DEVICE_MAINTENANCE', 'UPDATE'),
      -- CLOSE menutup pekerjaan pemeliharaan dan mengembalikan alat melayani.
      ('HEALTH_DEVICE_MAINTENANCE', 'CLOSE'),
      ('HEALTH_DEVICE_SECURITY', 'READ'),
      -- CREATE menilai risiko dan melaporkan insiden siber.
      ('HEALTH_DEVICE_SECURITY', 'CREATE'),
      ('HEALTH_DEVICE_SECURITY', 'UPDATE'),
      -- APPROVE memutuskan risiko ditanggung, dikurangi, atau alatnya
      -- dipensiunkan. Sengaja TERPISAH dari CREATE.
      ('HEALTH_DEVICE_SECURITY', 'APPROVE')
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
    ('HEALTH_DEVICE_SECURITY_ANALYST', 'Analis Keamanan Alat Medis',
     'Menilai risiko siber alat medis dan melaporkan insidennya. TIDAK memutuskan penerimaan risiko, dan TIDAK dapat mematikan alat.')
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
      -- Teknisi biomedis: pekerjaan pemeliharaan, seluruhnya.
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_MAINTENANCE', 'READ'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_MAINTENANCE', 'CREATE'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_MAINTENANCE', 'UPDATE'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_MAINTENANCE', 'CLOSE'),
      -- Ia melihat penilaian risiko alatnya; ia tidak menilai dan tidak
      -- memutuskan. Yang memperbaiki alat perlu tahu apa yang dicemaskan
      -- orang tentangnya.
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_SECURITY',    'READ'),

      /*
       * Analis keamanan: MENILAI, tidak MEMUTUSKAN.
       *
       * Sengaja tanpa APPROVE, dan sengaja pula tanpa satu pun hak atas menu
       * alat itu sendiri: ia tidak dapat mengubah status alat, tidak dapat
       * mengirim perintah, dan tidak dapat menyalakan kendali jarak jauh.
       * Analis keamanan yang dapat mematikan alat adalah analis keamanan yang,
       * pada suatu malam yang buruk, akan mematikan alat.
       */
      ('HEALTH_DEVICE_SECURITY_ANALYST', 'HEALTH',                    'READ'),
      ('HEALTH_DEVICE_SECURITY_ANALYST', 'HEALTH_DEVICE',             'READ'),
      ('HEALTH_DEVICE_SECURITY_ANALYST', 'HEALTH_DEVICE_GATEWAY',     'READ'),
      ('HEALTH_DEVICE_SECURITY_ANALYST', 'HEALTH_DEVICE_SECURITY',    'READ'),
      ('HEALTH_DEVICE_SECURITY_ANALYST', 'HEALTH_DEVICE_SECURITY',    'CREATE'),
      ('HEALTH_DEVICE_SECURITY_ANALYST', 'HEALTH_DEVICE_SECURITY',    'UPDATE'),
      ('HEALTH_DEVICE_SECURITY_ANALYST', 'HEALTH_DEVICE_MAINTENANCE', 'READ'),

      -- Yang MEMUTUSKAN: manajemen. Keputusannya menyangkut uang, jadwal
      -- pengadaan, dan pelayanan yang terhenti bila alatnya dipensiunkan.
      ('HEALTH_ADMIN', 'HEALTH_DEVICE_SECURITY',    'READ'),
      ('HEALTH_ADMIN', 'HEALTH_DEVICE_SECURITY',    'APPROVE'),
      ('HEALTH_ADMIN', 'HEALTH_DEVICE_MAINTENANCE', 'READ'),

      ('HEALTH_DIRECTOR', 'HEALTH_DEVICE_MAINTENANCE', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_DEVICE_SECURITY',    'READ'),

      -- Petugas mutu melihat pekerjaan korektif yang bertaut insiden pasien.
      ('HEALTH_QUALITY_OFFICER', 'HEALTH_DEVICE_MAINTENANCE', 'READ')
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
    ('HEALTH_SOD_DEVICE_RISK_DECIDE', 'Yang menilai risiko alat tidak memutuskan penerimaannya',
    'Penilaian menjawab seberapa besar risikonya; keputusan menjawab apakah rumah sakit menanggung risiko sebesar itu. Pertanyaan kedua menyangkut uang, jadwal pengadaan, dan pelayanan yang terhenti bila alatnya dipensiunkan — tidak satu pun diketahui orang yang memindai jaringan. Menyatukan keduanya menghasilkan salah satu dari dua hal, dan keduanya buruk: penilai yang menurunkan skornya sendiri supaya tidak perlu berdebat, atau penilai yang menaikkannya supaya anggarannya turun. Ditegakkan constraint device_risk_decide_not_self pada basis data pula.',
    'HIGH'),
    ('HEALTH_SOD_DEVICE_SECURITY_CONTROL', 'Analis keamanan alat tidak mengendalikan alatnya',
    'Analis keamanan yang dapat mengubah status alat, mengirim perintah, atau menyalakan kendali jarak jauh adalah analis keamanan yang, pada suatu malam yang buruk, akan mematikan alat yang sedang menopang seseorang. Tugasnya menyatakan bahaya, bukan menghentikannya sendiri — dan pemisahan ini bukan ketidakpercayaan melainkan pengakuan bahwa yang tahu ada pasien di sebelah alat itu bukan dia.',
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
      ('HEALTH_SOD_DEVICE_RISK_DECIDE',      'HEALTH_DEVICE_SECURITY_ANALYST', 'PREPARER'),
      ('HEALTH_SOD_DEVICE_RISK_DECIDE',      'HEALTH_ADMIN',                   'APPROVER'),
      ('HEALTH_SOD_DEVICE_SECURITY_CONTROL', 'HEALTH_DEVICE_SECURITY_ANALYST', 'PREPARER'),
      ('HEALTH_SOD_DEVICE_SECURITY_CONTROL', 'HEALTH_BIOMEDICAL_ENGINEER',     'APPROVER')
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
