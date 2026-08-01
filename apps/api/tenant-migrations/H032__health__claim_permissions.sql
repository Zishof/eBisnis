-- =========================================================================
-- H032 — MENU, HAK AKSES, DAN PERAN KLAIM
-- =========================================================================
--
-- Fase H-9C. Aditif seluruhnya.
--
-- Menu `HEALTH_CLAIM` sengaja ditutup H017 ketika klaim belum dibangun. Ia
-- dibuka kembali di sini — dengan aksinya yang sesungguhnya, bukan sekadar
-- READ.
--
-- Dua pemisahan menentukan bentuknya.
--
-- 1. **Yang mengode tidak memverifikasi klaimnya sendiri.** Verifikasi internal
--    menemukan kekurangan sebelum penjamin menemukannya; verifikasi oleh yang
--    mengodenya hanya membaca ulang pilihannya sendiri.
--
-- 2. **Yang menelaah penanda bukan yang mengajukan.** Penanda anti-fraud
--    memasukkan klaim ke antrean telaah, dan telaah oleh orang yang sedang
--    dikejar tenggat pengajuan akan selalu berkesimpulan "tidak ada masalah".

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

  -- Membuka kembali menu klaim yang ditutup H017, beserta rutenya.
  UPDATE "{{TENANT_SCHEMA}}".menu
     SET deleted_at = NULL,
         route = '/app/emedik/klaim',
         icon = 'file-check',
         is_coming_soon = FALSE,
         path = '/HEALTH/HEALTH_CLAIM',
         sort_order = 107
   WHERE code = 'HEALTH_CLAIM';

  INSERT INTO "{{TENANT_SCHEMA}}".menu
    (code, parent_id, name, translation_key, route, icon, module_code,
     platform_target, path, level, is_coming_soon, is_system, sort_order)
  SELECT v.code, akar_id, v.name, v.translation_key, v.route, v.icon, 'HEALTH',
         'WEB', v.path, 1, FALSE, TRUE, v.sort_order
    FROM (VALUES
      ('HEALTH_CLAIM',        'Klaim',              'menu.health.claim',        '/app/emedik/klaim',        'file-check',  '/HEALTH/HEALTH_CLAIM',        107),
      ('HEALTH_CLAIM_REVIEW', 'Telaah Klaim',       'menu.health.claim_review', '/app/emedik/telaah-klaim', 'search-check','/HEALTH/HEALTH_CLAIM_REVIEW', 108),
      ('HEALTH_CLAIM_RECON',  'Rekonsiliasi Klaim', 'menu.health.claim_recon',  '/app/emedik/rekonsiliasi', 'scale',       '/HEALTH/HEALTH_CLAIM_RECON',  109)
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
      ('HEALTH_CLAIM', 'READ'),
      ('HEALTH_CLAIM', 'CREATE'),
      ('HEALTH_CLAIM', 'UPDATE'),
      -- VERIFY memeriksa berkas; SUBMIT mengajukan. Keduanya terpisah.
      ('HEALTH_CLAIM', 'VERIFY'),
      ('HEALTH_CLAIM', 'SUBMIT'),
      ('HEALTH_CLAIM', 'CANCEL'),
      ('HEALTH_CLAIM_REVIEW', 'READ'),
      ('HEALTH_CLAIM_REVIEW', 'REVIEW'),
      ('HEALTH_CLAIM_RECON',  'READ'),
      ('HEALTH_CLAIM_RECON',  'CREATE'),
      ('HEALTH_CLAIM_RECON',  'CLOSE_PERIOD')
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
    ('HEALTH_CLAIM_OFFICER', 'Petugas Klaim',
     'Menyusun dan mengajukan klaim, serta mencatat keputusan penjamin. TIDAK memverifikasi berkas dan TIDAK menelaah penanda.'),
    ('HEALTH_CLAIM_VERIFIER', 'Verifikator Klaim Internal',
     'Memverifikasi kelengkapan berkas klaim sebelum diajukan, dan menelaah penanda. TIDAK mengode dan TIDAK mengajukan.')
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
      -- Menyusun dan mengajukan; tidak memverifikasi, tidak menelaah.
      ('HEALTH_CLAIM_OFFICER', 'HEALTH',              'READ'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_PATIENT',      'READ'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_CLAIM',        'READ'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_CLAIM',        'CREATE'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_CLAIM',        'UPDATE'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_CLAIM',        'SUBMIT'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_CLAIM',        'CANCEL'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_CLAIM_RECON',  'READ'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_HIM_CODING',   'READ'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_TARIFF',       'READ'),
      ('HEALTH_CLAIM_OFFICER', 'HEALTH_PAYER',        'READ'),

      -- Memverifikasi dan menelaah; tidak mengode, tidak mengajukan.
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH',              'READ'),
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH_PATIENT',      'READ'),
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH_CLAIM',        'READ'),
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH_CLAIM',        'VERIFY'),
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH_CLAIM_REVIEW', 'READ'),
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH_CLAIM_REVIEW', 'REVIEW'),
      ('HEALTH_CLAIM_VERIFIER', 'HEALTH_HIM_CODING',   'READ'),

      -- Koder membaca klaim yang memakai pengkodeannya; ia tidak
      -- memverifikasinya.
      ('HEALTH_CODER', 'HEALTH_CLAIM', 'READ'),

      -- Petugas keuangan merekonsiliasi.
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_CLAIM',       'READ'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_CLAIM_RECON', 'READ'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_CLAIM_RECON', 'CREATE'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_CLAIM_RECON', 'CLOSE_PERIOD'),

      ('HEALTH_DIRECTOR', 'HEALTH_CLAIM',        'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_CLAIM_REVIEW', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_CLAIM_RECON',  'READ'),

      ('HEALTH_QUALITY_MANAGER', 'HEALTH_CLAIM_REVIEW', 'READ')
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
    ('HEALTH_SOD_CLAIM_CODE_VERIFY', 'Pengode tidak memverifikasi klaimnya sendiri',
    'Verifikasi internal menemukan kekurangan sebelum penjamin menemukannya, dan itulah seluruh gunanya. Verifikasi oleh orang yang mengodenya hanya membaca ulang pilihannya sendiri — ia akan menemukan salah ketik, tetapi tidak akan menemukan pilihan kode yang keliru, sebab pilihan itu masih tampak benar baginya. Ditegakkan constraint health_claim_verify_not_self pada basis data pula.',
    'HIGH'),
    ('HEALTH_SOD_CLAIM_SUBMIT_REVIEW', 'Pengaju klaim tidak menelaah penandanya',
    'Penanda anti-fraud memasukkan klaim ke antrean telaah, dan telaah oleh orang yang sedang dikejar tenggat pengajuan akan selalu berkesimpulan tidak ada masalah. Bukan karena ia tidak jujur, melainkan karena ia satu-satunya orang yang biayanya ditanggung sendiri bila telaahnya memperlambat.',
    'MEDIUM')
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
      ('HEALTH_SOD_CLAIM_CODE_VERIFY',   'HEALTH_CODER',           'PREPARER'),
      ('HEALTH_SOD_CLAIM_CODE_VERIFY',   'HEALTH_CLAIM_VERIFIER',  'APPROVER'),
      ('HEALTH_SOD_CLAIM_SUBMIT_REVIEW', 'HEALTH_CLAIM_OFFICER',   'PREPARER'),
      ('HEALTH_SOD_CLAIM_SUBMIT_REVIEW', 'HEALTH_CLAIM_VERIFIER',  'APPROVER')
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
