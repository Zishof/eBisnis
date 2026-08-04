-- =========================================================================
-- H011 — MENU, HAK AKSES, DAN PERAN RAWAT INAP
-- =========================================================================
--
-- Fase H-6. Aditif seluruhnya.
--
-- `ADMIT` dan `DISCHARGE` sudah disemai H005 sebagai aksi tersendiri, dan
-- keduanya memang bukan CREATE dan UPDATE biasa: memutuskan pasien dirawat inap
-- dan memutuskan pasien boleh pulang adalah keputusan klinis, bukan penutupan
-- berkas. Yang menutup berkas tidak selalu yang boleh memutuskan.

-- ---------------------------------------------------------------------------
-- Menu rawat inap
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
      ('HEALTH_ADMISSION', 'Rawat Inap',        'menu.health.admission', '/app/emedik/rawat-inap',   'bed-double',  '/HEALTH/HEALTH_ADMISSION', 50),
      ('HEALTH_NURSING',   'Asuhan Keperawatan','menu.health.nursing',   '/app/emedik/keperawatan',  'heart-pulse', '/HEALTH/HEALTH_NURSING',   51)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );

  -- Penampung lama ditutup; digantikan dua menu di atas.
  UPDATE "{{TENANT_SCHEMA}}".menu
     SET deleted_at = now()
   WHERE code = 'HEALTH_INPATIENT' AND deleted_at IS NULL;

  -- Menu tempat tidur sudah ada sejak H005 tetapi belum berjalan. Kini ia
  -- punya layar dan aksi UPDATE untuk menyatakan tempat tidur sudah bersih.
  UPDATE "{{TENANT_SCHEMA}}".menu
     SET is_coming_soon = FALSE, route = '/app/emedik/tempat-tidur', updated_at = now()
   WHERE code = 'HEALTH_BED' AND deleted_at IS NULL;
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
      ('HEALTH_ADMISSION', 'READ'),
      -- ADMIT dan DISCHARGE terpisah dari CREATE dan UPDATE. Petugas
      -- pendaftaran boleh menyiapkan berkasnya; memutuskan pasien dirawat dan
      -- memutuskan pasien boleh pulang adalah wewenang lain.
      ('HEALTH_ADMISSION', 'ADMIT'),
      ('HEALTH_ADMISSION', 'DISCHARGE'),
      ('HEALTH_ADMISSION', 'UPDATE'),
      ('HEALTH_NURSING',   'READ'),
      ('HEALTH_NURSING',   'CREATE'),
      ('HEALTH_BED',       'UPDATE')
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
    ('HEALTH_WARD_CLERK', 'Petugas Bangsal',
     'Mengelola tempat tidur dan pembersihannya. TIDAK memutuskan penerimaan maupun pemulangan.')
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
      -- Dokter memutuskan penerimaan dan pemulangan.
      ('HEALTH_DOCTOR', 'HEALTH_ADMISSION', 'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_ADMISSION', 'ADMIT'),
      ('HEALTH_DOCTOR', 'HEALTH_ADMISSION', 'DISCHARGE'),
      ('HEALTH_DOCTOR', 'HEALTH_ADMISSION', 'UPDATE'),
      ('HEALTH_DOCTOR', 'HEALTH_NURSING',   'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_BED',       'READ'),

      -- Perawat mencatat pengamatan dan memindahkan tempat tidur, tetapi tidak
      -- memutuskan penerimaan maupun pemulangan.
      ('HEALTH_NURSE', 'HEALTH_ADMISSION', 'READ'),
      ('HEALTH_NURSE', 'HEALTH_ADMISSION', 'UPDATE'),
      ('HEALTH_NURSE', 'HEALTH_NURSING',   'READ'),
      ('HEALTH_NURSE', 'HEALTH_NURSING',   'CREATE'),
      ('HEALTH_NURSE', 'HEALTH_BED',       'READ'),
      ('HEALTH_NURSE', 'HEALTH_BED',       'UPDATE'),

      -- Petugas bangsal: tempat tidur dan pembersihannya saja.
      ('HEALTH_WARD_CLERK', 'HEALTH',           'READ'),
      ('HEALTH_WARD_CLERK', 'HEALTH_BED',       'READ'),
      ('HEALTH_WARD_CLERK', 'HEALTH_BED',       'UPDATE'),
      ('HEALTH_WARD_CLERK', 'HEALTH_ADMISSION', 'READ'),

      ('HEALTH_DIRECTOR', 'HEALTH_ADMISSION', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_NURSING',   'READ')
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
