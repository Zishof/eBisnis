-- =========================================================================
-- H007 — MENU, HAK AKSES, DAN PERAN FARMASI
-- =========================================================================
--
-- Fase H-4. Aditif seluruhnya.
--
-- H005 menyemai `HEALTH_PHARMACY` sebagai satu menu bertanda "sedang dibangun".
-- Kini farmasinya ada, dan ia BUKAN satu menu melainkan empat — karena hak
-- aksesnya memang empat hal yang berbeda:
--
--   meresepkan → menelaah → menyerahkan → memberikan
--
-- Menyatukannya menjadi satu hak akses "Farmasi" akan menghapus seluruh
-- pemisahan wewenang pada hari pertama seseorang memberikan peran kepada
-- stafnya. Pemisahan yang hanya ada di dalam kode, tidak di dalam daftar hak
-- akses yang dilihat administrator, tidak menahan siapa pun.

-- ---------------------------------------------------------------------------
-- Aksi yang belum ada
-- ---------------------------------------------------------------------------
-- `REVIEW` sudah disemai H005 untuk telaah dugaan rekam medis ganda dan dipakai
-- ulang di sini. `ADMINISTER` belum ada: memberikan obat kepada pasien tidak
-- punya padanan di perdagangan.
INSERT INTO "{{TENANT_SCHEMA}}".permission_action
  (code, name, name_key, action_type, requires_step_up, is_system, sort_order)
SELECT v.code, v.name, v.name_key, v.action_type, v.requires_step_up, TRUE, v.sort_order
  FROM (VALUES
    ('ADMINISTER', 'Memberikan Obat', 'action.administer', 'WRITE', FALSE, 108)
  ) AS v(code, name, name_key, action_type, requires_step_up, sort_order)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".permission_action p WHERE p.code = v.code
 );

-- ---------------------------------------------------------------------------
-- Menu farmasi
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
      ('HEALTH_PRESCRIPTION',   'Resep',             'menu.health.prescription',   '/app/emedik/resep',        'pill',         '/HEALTH/HEALTH_PRESCRIPTION',   30),
      ('HEALTH_DISPENSING',     'Penyerahan Obat',   'menu.health.dispensing',     '/app/emedik/penyerahan',   'package-check','/HEALTH/HEALTH_DISPENSING',     31),
      ('HEALTH_ADMINISTRATION', 'Pemberian Obat',    'menu.health.administration', '/app/emedik/pemberian',    'syringe',      '/HEALTH/HEALTH_ADMINISTRATION', 32),
      ('HEALTH_DRUG_MASTER',    'Formularium',       'menu.health.drug_master',    '/app/emedik/formularium',  'book-marked',  '/HEALTH/HEALTH_DRUG_MASTER',    33)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );

  /*
   * Penampung lama ditutup, bukan dibiarkan berdampingan.
   *
   * Membiarkan "Farmasi (sedang dibangun)" tetap tampil di samping empat menu
   * farmasi yang sudah berfungsi akan membuat penyewa mengira ada bagian yang
   * belum jadi. Tidak ada peran yang pernah diberi hak atasnya — H005 tidak
   * mendaftarkan satu pun aksi padanya — sehingga penutupan ini tidak mencabut
   * wewenang siapa pun.
   */
  UPDATE "{{TENANT_SCHEMA}}".menu
     SET deleted_at = now()
   WHERE code = 'HEALTH_PHARMACY' AND deleted_at IS NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Aksi yang berlaku pada tiap menu farmasi
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pasangan RECORD;
  m_id UUID;
  a_id UUID;
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      ('HEALTH_PRESCRIPTION',   'READ'),
      ('HEALTH_PRESCRIPTION',   'CREATE'),
      -- Telaah apoteker sebagai hak akses tersendiri, terpisah dari CREATE.
      -- Inilah yang membuat aturan "peresep tidak menelaah resepnya sendiri"
      -- dapat ditegakkan mesin pemisahan wewenang.
      ('HEALTH_PRESCRIPTION',   'REVIEW'),
      ('HEALTH_DISPENSING',     'READ'),
      ('HEALTH_DISPENSING',     'CREATE'),
      ('HEALTH_ADMINISTRATION', 'READ'),
      ('HEALTH_ADMINISTRATION', 'CREATE'),
      ('HEALTH_ADMINISTRATION', 'ADMINISTER'),
      ('HEALTH_DRUG_MASTER',    'READ'),
      ('HEALTH_DRUG_MASTER',    'CREATE'),
      ('HEALTH_DRUG_MASTER',    'UPDATE')
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
-- Peran farmasi
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".role (code, name, description, is_system, is_core)
SELECT v.code, v.name, v.description, TRUE, FALSE
  FROM (VALUES
    ('HEALTH_PHARMACIST',           'Apoteker',
     'Menelaah resep, menyerahkan obat, dan mengelola formularium. TIDAK meresepkan.'),
    ('HEALTH_PHARMACY_TECHNICIAN',  'Tenaga Teknis Kefarmasian',
     'Menyerahkan obat yang sudah ditelaah apoteker. Tidak menelaah dan tidak meresepkan.')
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
      -- Dokter meresepkan. Tidak menelaah, tidak menyerahkan — keduanya justru
      -- yang menjadikan telaah dan penyerahan berguna.
      ('HEALTH_DOCTOR', 'HEALTH_PRESCRIPTION', 'READ'),
      ('HEALTH_DOCTOR', 'HEALTH_PRESCRIPTION', 'CREATE'),
      ('HEALTH_DOCTOR', 'HEALTH_DRUG_MASTER',  'READ'),

      -- Perawat memberikan obat kepada pasien. Berbeda dari menyerahkannya dari
      -- apotek: yang satu memindahkan obat dari rak ke tangan, yang lain
      -- memasukkannya ke tubuh — dan kekeliruannya berbeda pula.
      ('HEALTH_NURSE', 'HEALTH_PRESCRIPTION',   'READ'),
      ('HEALTH_NURSE', 'HEALTH_ADMINISTRATION', 'READ'),
      ('HEALTH_NURSE', 'HEALTH_ADMINISTRATION', 'CREATE'),
      ('HEALTH_NURSE', 'HEALTH_ADMINISTRATION', 'ADMINISTER'),
      ('HEALTH_NURSE', 'HEALTH_DRUG_MASTER',    'READ'),

      -- Apoteker menelaah dan menyerahkan. TIDAK meresepkan: itu yang membuat
      -- telaahnya bermakna.
      ('HEALTH_PHARMACIST', 'HEALTH',                'READ'),
      ('HEALTH_PHARMACIST', 'HEALTH_PATIENT',        'READ'),
      ('HEALTH_PHARMACIST', 'HEALTH_PRESCRIPTION',   'READ'),
      ('HEALTH_PHARMACIST', 'HEALTH_PRESCRIPTION',   'REVIEW'),
      ('HEALTH_PHARMACIST', 'HEALTH_DISPENSING',     'READ'),
      ('HEALTH_PHARMACIST', 'HEALTH_DISPENSING',     'CREATE'),
      ('HEALTH_PHARMACIST', 'HEALTH_DRUG_MASTER',    'READ'),
      ('HEALTH_PHARMACIST', 'HEALTH_DRUG_MASTER',    'CREATE'),
      ('HEALTH_PHARMACIST', 'HEALTH_DRUG_MASTER',    'UPDATE'),

      -- Tenaga teknis menyerahkan, tetapi tidak menelaah. Apotek kecil yang
      -- apotekernya sedang tidak di tempat tetap dapat melayani obat biasa;
      -- obat terkendali tetap tertahan karena penyerahannya menuntut telaah.
      ('HEALTH_PHARMACY_TECHNICIAN', 'HEALTH',              'READ'),
      ('HEALTH_PHARMACY_TECHNICIAN', 'HEALTH_PATIENT',      'READ'),
      ('HEALTH_PHARMACY_TECHNICIAN', 'HEALTH_PRESCRIPTION', 'READ'),
      ('HEALTH_PHARMACY_TECHNICIAN', 'HEALTH_DISPENSING',   'READ'),
      ('HEALTH_PHARMACY_TECHNICIAN', 'HEALTH_DISPENSING',   'CREATE'),
      ('HEALTH_PHARMACY_TECHNICIAN', 'HEALTH_DRUG_MASTER',  'READ')
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
-- Aturan pemisahan wewenang farmasi
-- ---------------------------------------------------------------------------
-- Didaftarkan pada mesin SoD yang sudah ada. Tidak ada mesin kedua.
INSERT INTO "{{TENANT_SCHEMA}}".segregation_of_duty_rule
  (code, name, description, severity, is_active, is_system)
SELECT v.code, v.name, v.description, v.severity, TRUE, TRUE
  FROM (VALUES
    ('HEALTH_SOD_PRESCRIBE_REVIEW', 'Peresep tidak menelaah resepnya sendiri',
    'Telaah apoteker adalah pemeriksaan oleh orang kedua, dan itulah satu-satunya penahan yang benar-benar bekerja ketika dosisnya salah ketik. Orang yang menulis angkanya adalah orang yang paling sulit melihat kekeliruannya. Basis data menegakkannya pula lewat constraint rx_prescription_review_not_self — aturan yang hanya ada di satu lapisan berhenti berlaku begitu ada jalan kedua menuju tabelnya.',
    'CRITICAL'),
    ('HEALTH_SOD_PRESCRIBE_DISPENSE', 'Peresep tidak menyerahkan obatnya sendiri',
    'Pemisahan yang paling tua dalam keselamatan obat. Yang menulis resep tidak mengambilkan obatnya dari rak: keliru memilih tempat obat pada rak tidak akan tertangkap oleh orang yang sejak awal sudah yakin obat apa yang dimaksudnya.',
    'HIGH')
  ) AS v(code, name, description, severity)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".segregation_of_duty_rule s WHERE s.code = v.code
 );

-- Sisi mana tiap peran berdiri dalam aturan-aturan itu.
--
-- Mesin SoD menolak penetapan peran yang menempatkan satu orang pada dua sisi
-- aturan yang sama. Tanpa pendaftaran sisi ini, aturannya ada tetapi tidak
-- menahan apa pun — dan aturan yang tercatat tetapi tidak menahan justru
-- berbahaya: ia membuat orang mengira pemisahannya sudah berjalan.
DO $$
DECLARE
  pasangan RECORD;
  s_id UUID;
  r_id UUID;
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      ('HEALTH_SOD_PRESCRIBE_REVIEW',   'HEALTH_DOCTOR',               'PREPARER'),
      ('HEALTH_SOD_PRESCRIBE_REVIEW',   'HEALTH_PHARMACIST',           'APPROVER'),
      ('HEALTH_SOD_PRESCRIBE_DISPENSE', 'HEALTH_DOCTOR',               'PREPARER'),
      ('HEALTH_SOD_PRESCRIBE_DISPENSE', 'HEALTH_PHARMACY_TECHNICIAN',  'EXECUTOR')
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
