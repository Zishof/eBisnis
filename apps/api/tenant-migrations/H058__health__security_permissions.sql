-- =========================================================================
-- H058 — MENU, HAK AKSES, DAN PERAN KEAMANAN DATA KESEHATAN
-- =========================================================================
--
-- Fase H-12. Aditif seluruhnya.
--
-- ## Pemisahan yang menentukan bentuknya
--
-- **Yang menelaah break-glass bukan yang paling banyak memakainya.**
--
-- Dokter dan perawat adalah pemakai break-glass yang sah dan sering. Petugas
-- rekam medis nyaris tidak pernah memakainya — dan justru itu yang membuatnya
-- menjadi penelaah: ia tidak sedang menelaah tetangganya sendiri.
--
-- Perhatikan bahwa pemisahan ini TIDAK didaftarkan sebagai pasangan hak yang
-- bertentangan, dan itu disengaja. Alasannya ditulis lengkap pada H055 di atas
-- trigger check_break_glass_review: yang terlarang bukan "orang ini memegang
-- dua hak", melainkan "orang ini menelaah baris yang aktornya dirinya sendiri"
-- — hubungan antara satu orang dan satu baris, yang tidak dapat dinyatakan
-- daftar hak akses mana pun.
--
-- Yang DIDAFTARKAN sebagai pemisahan wewenang adalah yang lain: **yang
-- menggolongkan medan bukan yang menelaah aksesnya.** Penggolongan menentukan
-- medan mana yang disamarkan; telaah memeriksa siapa membacanya. Satu orang
-- yang memegang keduanya dapat menurunkan zona sebuah medan pada pagi hari dan
-- menyatakan aksesnya wajar pada sore hari, dan kedua tindakannya akan tampak
-- benar bila diperiksa sendiri-sendiri.

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
      ('HEALTH_DATA_ZONE',   'Zona Data',        'menu.health.data_zone',   '/app/emedik/zona-data',   'shield',      '/HEALTH/HEALTH_DATA_ZONE',   132),
      ('HEALTH_BREAK_GLASS', 'Telaah Darurat',   'menu.health.break_glass', '/app/emedik/telaah-darurat', 'siren',    '/HEALTH/HEALTH_BREAK_GLASS', 133),
      ('HEALTH_AI_GUARD',    'Penjaga AI',       'menu.health.ai_guard',    '/app/emedik/penjaga-ai',  'bot',         '/HEALTH/HEALTH_AI_GUARD',    134)
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
      ('HEALTH_DATA_ZONE', 'READ'),
      -- UPDATE menggolongkan ulang sebuah medan. Ia TIDAK dipegang penelaah.
      ('HEALTH_DATA_ZONE', 'UPDATE'),
      ('HEALTH_BREAK_GLASS', 'READ'),
      -- APPROVE di sini berarti MENELAAH, bukan menyetujui aksesnya: aksesnya
      -- sudah terjadi dan tidak pernah dapat ditarik kembali.
      ('HEALTH_BREAK_GLASS', 'APPROVE'),
      ('HEALTH_AI_GUARD', 'READ')
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
      /*
       * PETUGAS REKAM MEDIS MENELAAH BREAK-GLASS.
       *
       * Ia nyaris tidak pernah memakainya sendiri, dan itulah gunanya: ia
       * tidak sedang menelaah tetangganya sendiri.
       */
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_BREAK_GLASS', 'READ'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_BREAK_GLASS', 'APPROVE'),
      ('HEALTH_MEDICAL_RECORD_OFFICER', 'HEALTH_DATA_ZONE',   'READ'),

      /*
       * Manajer mutu menelaah pula — telaah yang hanya dipegang satu peran
       * akan berhenti ketika orangnya cuti, dan yang berhenti pada akhirnya
       * dianggap tidak perlu.
       */
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_BREAK_GLASS', 'READ'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_BREAK_GLASS', 'APPROVE'),
      ('HEALTH_QUALITY_MANAGER', 'HEALTH_AI_GUARD',    'READ'),

      /*
       * ADMINISTRATOR MENGGOLONGKAN MEDAN, DAN TIDAK MENELAAH.
       *
       * Satu orang yang memegang keduanya dapat menurunkan zona sebuah medan
       * pada pagi hari dan menyatakan aksesnya wajar pada sore hari.
       */
      ('HEALTH_ADMIN', 'HEALTH_DATA_ZONE', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_DATA_ZONE', 'UPDATE'),
      ('HEALTH_ADMIN', 'HEALTH_AI_GUARD',  'READ'),

      /*
       * Direktur melihat seluruhnya dan tidak mengubah apa pun di sini.
       * Yang melihat tanpa dapat mengubah adalah satu-satunya pembaca yang
       * kesaksiannya tidak dapat dipertanyakan.
       */
      ('HEALTH_DIRECTOR', 'HEALTH_DATA_ZONE',   'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_BREAK_GLASS', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_AI_GUARD',    'READ')
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
    ('HEALTH_SOD_ZONE_REVIEW', 'Yang menggolongkan medan tidak menelaah aksesnya',
    'Penggolongan menentukan medan mana yang disamarkan dan medan mana yang boleh sampai ke AI; telaah break-glass memeriksa siapa membacanya. Satu orang yang memegang keduanya dapat menurunkan zona sebuah medan pada pagi hari dan menyatakan aksesnya wajar pada sore hari — dan kedua tindakannya akan tampak benar bila diperiksa sendiri-sendiri. Perhatikan bahwa pemisahan INI dapat dinyatakan sebagai pasangan hak, sedangkan larangan menelaah akses sendiri TIDAK dapat: yang terakhir adalah hubungan antara satu orang dan satu baris, dan ditegakkan trigger check_break_glass_review pada basis data.',
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
      ('HEALTH_SOD_ZONE_REVIEW', 'HEALTH_ADMIN',        'PREPARER'),
      ('HEALTH_SOD_ZONE_REVIEW', 'HEALTH_MEDICAL_RECORD_OFFICER',  'APPROVER')
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
