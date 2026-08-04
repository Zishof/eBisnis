-- =========================================================================
-- H049 — MENU, HAK AKSES, DAN PERAN IMPOR KFA
-- =========================================================================
--
-- Fase H-9M. Aditif seluruhnya.
--
-- Pemisahan yang menentukan bentuknya: **yang memvalidasi impor tidak
-- menerapkannya.**
--
-- Katalog obat menentukan apa yang boleh diresepkan seluruh rumah sakit.
-- Penerapan oleh pemeriksanya sendiri hanya membaca ulang keyakinannya — dan
-- berkas dua ribu baris adalah tempat paling mudah bagi satu baris yang keliru
-- untuk lolos tanpa dilihat siapa pun.

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
      ('HEALTH_TERMINOLOGY', 'Terminologi Resmi', 'menu.health.terminology', '/app/emedik/terminologi', 'book-marked', '/HEALTH/HEALTH_TERMINOLOGY', 125),
      ('HEALTH_KFA_MAPPING', 'Pemetaan KFA',      'menu.health.kfa_mapping', '/app/emedik/kfa',        'pill',        '/HEALTH/HEALTH_KFA_MAPPING', 126)
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
      ('HEALTH_TERMINOLOGY', 'READ'),
      ('HEALTH_TERMINOLOGY', 'IMPORT'),
      -- VERIFY memvalidasi berkasnya; APPROVE menerapkannya. Sengaja TERPISAH.
      ('HEALTH_TERMINOLOGY', 'VERIFY'),
      ('HEALTH_TERMINOLOGY', 'APPROVE'),
      ('HEALTH_KFA_MAPPING', 'READ'),
      ('HEALTH_KFA_MAPPING', 'CREATE'),
      ('HEALTH_KFA_MAPPING', 'UPDATE')
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

-- ---------------------------------------------------------------------------
-- Peran
-- ---------------------------------------------------------------------------
-- Menerapkan impor terminologi mengubah apa yang boleh diresepkan SELURUH
-- rumah sakit. Itu keputusan pengelolaan farmasi, bukan pekerjaan apoteker yang
-- memeriksa berkasnya — dan bukan pula pekerjaan administrator sistem, yang
-- tidak mengenal obatnya.
INSERT INTO "{{TENANT_SCHEMA}}".role (code, name, description, is_system, is_core)
SELECT v.code, v.name, v.description, TRUE, FALSE
  FROM (VALUES
    ('HEALTH_PHARMACY_MANAGER', 'Penanggung Jawab Farmasi',
     'Menerapkan impor katalog obat dan menelaah pemetaan KFA. TIDAK memvalidasi berkas impornya sendiri — yang memeriksa dan yang menerapkan harus dua orang.')
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
      /*
       * Apoteker mengimpor dan memvalidasi; ia TIDAK menerapkan.
       *
       * Ia pula yang memetakan KFA — pemetaan obat menuntut orang yang
       * mengenal obatnya, sama seperti pemetaan kode alat menuntut orang yang
       * mengenal pemeriksaannya (H-9I).
       */
      ('HEALTH_PHARMACIST', 'HEALTH_TERMINOLOGY', 'READ'),
      ('HEALTH_PHARMACIST', 'HEALTH_TERMINOLOGY', 'IMPORT'),
      ('HEALTH_PHARMACIST', 'HEALTH_TERMINOLOGY', 'VERIFY'),
      ('HEALTH_PHARMACIST', 'HEALTH_KFA_MAPPING', 'READ'),
      ('HEALTH_PHARMACIST', 'HEALTH_KFA_MAPPING', 'CREATE'),

      -- Penanggung jawab farmasi menerapkan impornya. Ia TIDAK memvalidasi.
      ('HEALTH_PHARMACY_MANAGER', 'HEALTH_TERMINOLOGY', 'READ'),
      ('HEALTH_PHARMACY_MANAGER', 'HEALTH_TERMINOLOGY', 'APPROVE'),
      ('HEALTH_PHARMACY_MANAGER', 'HEALTH_KFA_MAPPING', 'READ'),
      ('HEALTH_PHARMACY_MANAGER', 'HEALTH_KFA_MAPPING', 'UPDATE'),

      -- Koder membaca terminologi diagnosis dan tindakan.
      ('HEALTH_CODER', 'HEALTH_TERMINOLOGY', 'READ'),
      ('HEALTH_CODING_VERIFIER', 'HEALTH_TERMINOLOGY', 'READ'),

      -- Petugas interoperabilitas melihat kesiapan katalognya: tanpa KFA,
      -- Medication tidak dapat dikirim ke SATUSEHAT.
      ('HEALTH_INTEROP_OFFICER', 'HEALTH_TERMINOLOGY', 'READ'),
      ('HEALTH_INTEROP_OFFICER', 'HEALTH_KFA_MAPPING', 'READ'),

      ('HEALTH_ADMIN', 'HEALTH_TERMINOLOGY', 'READ')
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
    ('HEALTH_SOD_TERMINOLOGY_APPLY', 'Yang memvalidasi impor terminologi tidak menerapkannya',
    'Katalog obat menentukan apa yang boleh diresepkan seluruh rumah sakit. Penerapan oleh pemeriksanya sendiri hanya membaca ulang keyakinannya — dan berkas dua ribu baris adalah tempat paling mudah bagi satu baris yang keliru untuk lolos tanpa dilihat siapa pun. Ditegakkan constraint terminology_import_apply_not_self pada basis data pula, beserta terminology_import_applied_clean yang menolak penerapan impor yang masih bergalat: impor sebagian menghasilkan katalog yang separuhnya baru dan separuhnya lama, dan tidak ada yang tahu baris mana yang mana.',
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
      ('HEALTH_SOD_TERMINOLOGY_APPLY', 'HEALTH_PHARMACIST',       'PREPARER'),
      ('HEALTH_SOD_TERMINOLOGY_APPLY', 'HEALTH_PHARMACY_MANAGER', 'APPROVER')
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
