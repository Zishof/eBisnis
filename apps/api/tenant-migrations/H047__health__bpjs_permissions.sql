-- =========================================================================
-- H047 — MENU, HAK AKSES, DAN PERAN BPJS/JKN
-- =========================================================================
--
-- Fase H-9B. Aditif seluruhnya.
--
-- Menu BPJS sengaja TERPISAH dari menu SATUSEHAT, dan pemisahannya bukan
-- kerapian tampilan. Keduanya konteks terbatas yang berbeda: kredensialnya
-- berbeda, siklus hidupnya berbeda, dan kegagalannya berbeda. Petugas yang
-- mengurus klaim tidak perlu — dan tidak boleh — memegang kredensial pertukaran
-- data klinis.

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
      ('HEALTH_BPJS',          'BPJS/JKN',        'menu.health.bpjs',          '/app/emedik/bpjs',          'shield-check', '/HEALTH/HEALTH_BPJS',          122),
      ('HEALTH_BPJS_ELIGIBILITY', 'Kepesertaan JKN', 'menu.health.bpjs_eligibility', '/app/emedik/kepesertaan', 'id-card',   '/HEALTH/HEALTH_BPJS_ELIGIBILITY', 123),
      ('HEALTH_BPJS_SEP',      'SEP',             'menu.health.bpjs_sep',      '/app/emedik/sep',           'file-badge',   '/HEALTH/HEALTH_BPJS_SEP',      124)
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
      ('HEALTH_BPJS', 'READ'),
      ('HEALTH_BPJS', 'CREATE'),
      ('HEALTH_BPJS', 'UPDATE'),
      ('HEALTH_BPJS', 'ACTIVATE'),
      ('HEALTH_BPJS', 'MANAGE_CREDENTIAL'),
      ('HEALTH_BPJS', 'VERIFY'),
      ('HEALTH_BPJS_ELIGIBILITY', 'READ'),
      ('HEALTH_BPJS_ELIGIBILITY', 'CREATE'),
      ('HEALTH_BPJS_SEP', 'READ'),
      ('HEALTH_BPJS_SEP', 'CREATE'),
      ('HEALTH_BPJS_SEP', 'CANCEL')
    ) AS t(menu_code, action_code)
  LOOP
    SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu
      WHERE code = pasangan.menu_code AND deleted_at IS NULL;
    SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action
      WHERE code = pasangan.action_code;
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
      -- Administrator memasang kredensial BPJS dan mengaktifkan akunnya.
      ('HEALTH_ADMIN', 'HEALTH_BPJS', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_BPJS', 'CREATE'),
      ('HEALTH_ADMIN', 'HEALTH_BPJS', 'UPDATE'),
      ('HEALTH_ADMIN', 'HEALTH_BPJS', 'ACTIVATE'),
      ('HEALTH_ADMIN', 'HEALTH_BPJS', 'MANAGE_CREDENTIAL'),

      /*
       * Petugas interoperabilitas memverifikasi adapternya — peran yang sama
       * dengan H-9A, sebab pekerjaannya memang sama: menjalankan panggilan
       * terhadap sandbox lalu menyatakan ia bekerja.
       *
       * Ia TIDAK memasang kredensial, di sini maupun di sana.
       */
      ('HEALTH_INTEROP_OFFICER', 'HEALTH_BPJS', 'READ'),
      ('HEALTH_INTEROP_OFFICER', 'HEALTH_BPJS', 'VERIFY'),

      /*
       * Petugas pendaftaran memeriksa kepesertaan dan mencatat SEP — inilah
       * pekerjaan sehari-harinya, dan ia tidak menuntut kredensial siapa pun
       * selama adapternya belum ada.
       */
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_BPJS_ELIGIBILITY', 'READ'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_BPJS_ELIGIBILITY', 'CREATE'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_BPJS_SEP',         'READ'),
      ('HEALTH_REGISTRATION_CLERK', 'HEALTH_BPJS_SEP',         'CREATE'),

      -- Petugas klaim membaca kepesertaan dan SEP; ia tidak mencatat SEP baru.
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_BPJS',             'READ'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_BPJS_ELIGIBILITY', 'READ'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_BPJS_SEP',         'READ'),
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH_BPJS_SEP',        'READ'),
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH_BPJS_ELIGIBILITY','READ'),

      ('HEALTH_DIRECTOR', 'HEALTH_BPJS', 'READ')
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
    ('HEALTH_SOD_BPJS_VERIFY', 'Yang mengaktifkan akun BPJS tidak memverifikasi adapternya',
    'Sama seperti SATUSEHAT: memverifikasi adapter berarti menyatakan panggilannya sudah dicoba dan bekerja, dan pernyataan itu membuka jalur yang mengirimkan klaim atas nama fasilitas. Administrator yang memasang kredensial adalah orang yang paling ingin jalurnya terbuka. Ditegakkan constraint bpjs_cap_verified_complete pada basis data pula.',
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
      ('HEALTH_SOD_BPJS_VERIFY', 'HEALTH_ADMIN',           'PREPARER'),
      ('HEALTH_SOD_BPJS_VERIFY', 'HEALTH_INTEROP_OFFICER', 'APPROVER')
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
