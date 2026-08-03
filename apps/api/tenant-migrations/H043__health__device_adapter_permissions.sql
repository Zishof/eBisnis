-- =========================================================================
-- H043 — MENU, HAK AKSES, DAN PERAN ADAPTER PROTOKOL ALAT
-- =========================================================================
--
-- Fase H-9I. Aditif seluruhnya.
--
-- Satu pemisahan menentukan bentuknya, dan ia tidak lazim: **yang memetakan
-- kode alat bukan yang menerima pesannya.**
--
-- Pemetaan kode menentukan angka mana yang tersimpan pada baris mana. Kode
-- "K" yang dipetakan ke kalium alih-alih ke kreatinin akan menghasilkan hasil
-- laboratorium yang tampak sempurna dan salah seluruhnya — dan kekeliruannya
-- tidak akan terlihat oleh siapa pun sampai seseorang diberi obat berdasarkan
-- angka itu.
--
-- Karena itu pemetaan dipegang analis laboratorium yang mengenal
-- pemeriksaannya, bukan petugas yang mengurus lalu lintas pesan.

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
      ('HEALTH_DEVICE_MESSAGE',  'Pesan Alat',       'menu.health.device_message',  '/app/emedik/pesan-alat',   'message-square-code', '/HEALTH/HEALTH_DEVICE_MESSAGE',  118),
      ('HEALTH_DEVICE_CODE_MAP', 'Pemetaan Kode Alat','menu.health.device_code_map', '/app/emedik/pemetaan-kode','shuffle',             '/HEALTH/HEALTH_DEVICE_CODE_MAP', 119)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );
END $$;

DO $$
DECLARE
  pasangan RECORD;
  m_id UUID;
  a_id UUID;
  hilang TEXT := '';
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      ('HEALTH_DEVICE_MESSAGE', 'READ'),
      -- CREATE menerima pesan dari gateway.
      ('HEALTH_DEVICE_MESSAGE', 'CREATE'),
      ('HEALTH_DEVICE_CODE_MAP', 'READ'),
      ('HEALTH_DEVICE_CODE_MAP', 'CREATE'),
      ('HEALTH_DEVICE_CODE_MAP', 'UPDATE')
    ) AS t(menu_code, action_code)
  LOOP
    SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu
      WHERE code = pasangan.menu_code AND deleted_at IS NULL;
    SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action
      WHERE code = pasangan.action_code;
    -- Menggagalkan diri bila aksinya tidak dikenal — pelajaran H037.
    IF a_id IS NULL THEN
      hilang := hilang || pasangan.menu_code || '.' || pasangan.action_code || ' ';
    ELSIF m_id IS NOT NULL THEN
      INSERT INTO "{{TENANT_SCHEMA}}".menu_action (menu_id, permission_action_id)
      VALUES (m_id, a_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  IF hilang <> '' THEN
    RAISE EXCEPTION 'Aksi berikut tidak ada pada kosakata hak akses tenant: %', hilang;
  END IF;
END $$;

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
       * Teknisi menerima pesan dan melihat yang gagal diurai — pekerjaannya
       * memang menjaga lalu lintasnya. Ia TIDAK memetakan kode.
       */
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_MESSAGE',  'READ'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_MESSAGE',  'CREATE'),
      ('HEALTH_BIOMEDICAL_ENGINEER', 'HEALTH_DEVICE_CODE_MAP', 'READ'),

      /*
       * YANG MEMETAKAN: analis dan penanggung jawab laboratorium.
       *
       * Kode "K" yang dipetakan ke kalium alih-alih kreatinin menghasilkan
       * hasil yang tampak sempurna dan salah seluruhnya. Yang dapat
       * membedakannya adalah orang yang mengenal pemeriksaannya, bukan orang
       * yang mengurus jaringannya.
       */
      ('HEALTH_LAB_ANALYST',    'HEALTH_DEVICE_MESSAGE',  'READ'),
      ('HEALTH_LAB_ANALYST',    'HEALTH_DEVICE_CODE_MAP', 'READ'),
      ('HEALTH_LAB_ANALYST',    'HEALTH_DEVICE_CODE_MAP', 'CREATE'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_DEVICE_MESSAGE',  'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_DEVICE_CODE_MAP', 'READ'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_DEVICE_CODE_MAP', 'CREATE'),
      ('HEALTH_LAB_SUPERVISOR', 'HEALTH_DEVICE_CODE_MAP', 'UPDATE'),

      ('HEALTH_ADMIN', 'HEALTH_DEVICE_MESSAGE', 'READ')
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

INSERT INTO "{{TENANT_SCHEMA}}".segregation_of_duty_rule
  (code, name, description, severity, is_active, is_system)
SELECT v.code, v.name, v.description, v.severity, TRUE, TRUE
  FROM (VALUES
    ('HEALTH_SOD_DEVICE_CODE_MAP', 'Yang menerima pesan alat tidak memetakan kodenya',
    'Pemetaan kode menentukan angka mana yang tersimpan pada baris mana. Kode "K" yang dipetakan ke kalium alih-alih kreatinin menghasilkan hasil laboratorium yang tampak sempurna dan salah seluruhnya, dan kekeliruannya tidak akan terlihat siapa pun sampai seseorang diberi obat berdasarkan angka itu. Yang dapat membedakannya adalah orang yang mengenal pemeriksaannya — analis laboratorium — bukan teknisi yang mengurus lalu lintas pesannya. Ini bukan soal kepercayaan melainkan soal siapa yang sanggup melihat kekeliruannya.',
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
      ('HEALTH_SOD_DEVICE_CODE_MAP', 'HEALTH_BIOMEDICAL_ENGINEER', 'PREPARER'),
      ('HEALTH_SOD_DEVICE_CODE_MAP', 'HEALTH_LAB_SUPERVISOR',      'APPROVER')
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
