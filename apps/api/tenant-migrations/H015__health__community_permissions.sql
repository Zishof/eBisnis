-- =========================================================================
-- H015 — MENU, HAK AKSES, DAN PERAN PUSKESMAS DAN POSYANDU
-- =========================================================================
--
-- Fase H-8. Aditif seluruhnya.
--
-- Satu pemisahan menentukan bentuknya: **kader bukan petugas Puskesmas.**
--
-- Kader menimbang, mengukur, dan mencatat. Ia TIDAK membaca rekam medis
-- lengkap, tidak menetapkan diagnosis, dan tidak melihat riwayat penyakit
-- keluarga lain. Menyatukan keduanya akan memberi ratusan sukarelawan di desa
-- akses penuh ke seluruh rekam medis — dan tidak ada yang akan menyadarinya
-- sampai ada kebocoran.

-- ---------------------------------------------------------------------------
-- Aksi yang belum ada
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".permission_action
  (code, name, name_key, action_type, requires_step_up, is_system, sort_order)
SELECT v.code, v.name, v.name_key, v.action_type, v.requires_step_up, TRUE, v.sort_order
  FROM (VALUES
    ('IMMUNIZE', 'Memberikan Imunisasi', 'action.immunize', 'WRITE', FALSE, 114)
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
      ('HEALTH_FAMILY',       'Folder Keluarga',    'menu.health.family',       '/app/emedik/keluarga',    'house',       '/HEALTH/HEALTH_FAMILY',       70),
      ('HEALTH_GROWTH',       'Pertumbuhan Anak',   'menu.health.growth',       '/app/emedik/pertumbuhan', 'trending-up', '/HEALTH/HEALTH_GROWTH',       71),
      ('HEALTH_IMMUNIZATION', 'Imunisasi',          'menu.health.immunization', '/app/emedik/imunisasi',   'syringe',     '/HEALTH/HEALTH_IMMUNIZATION', 72),
      ('HEALTH_HOME_VISIT',   'Kunjungan Rumah',    'menu.health.home_visit',   '/app/emedik/kunjungan',   'map-pin',     '/HEALTH/HEALTH_HOME_VISIT',   73),
      ('HEALTH_PROGRAM',      'Cakupan Program',    'menu.health.program',      '/app/emedik/cakupan',     'target',      '/HEALTH/HEALTH_PROGRAM',      74)
    ) AS v(code, name, translation_key, route, icon, path, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".menu m WHERE m.code = v.code
   );

  -- Penampung lama ditutup; digantikan lima menu di atas.
  UPDATE "{{TENANT_SCHEMA}}".menu
     SET deleted_at = now()
   WHERE code IN ('HEALTH_PUSKESMAS', 'HEALTH_POSYANDU') AND deleted_at IS NULL;
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
      ('HEALTH_FAMILY',       'READ'),
      ('HEALTH_FAMILY',       'CREATE'),
      ('HEALTH_FAMILY',       'UPDATE'),
      ('HEALTH_GROWTH',       'READ'),
      ('HEALTH_GROWTH',       'CREATE'),
      ('HEALTH_IMMUNIZATION', 'READ'),
      ('HEALTH_IMMUNIZATION', 'CREATE'),
      ('HEALTH_IMMUNIZATION', 'IMMUNIZE'),
      ('HEALTH_HOME_VISIT',   'READ'),
      ('HEALTH_HOME_VISIT',   'CREATE'),
      ('HEALTH_PROGRAM',      'READ'),
      ('HEALTH_PROGRAM',      'UPDATE'),
      ('HEALTH_PROGRAM',      'EXPORT')
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
    ('HEALTH_CADRE', 'Kader Posyandu',
     'Menimbang, mengukur, dan mencatat pertumbuhan anak. TIDAK membaca rekam medis lengkap dan TIDAK memberikan imunisasi.'),
    ('HEALTH_PHC_OFFICER', 'Petugas Puskesmas',
     'Mengelola folder keluarga, imunisasi, kunjungan rumah, dan cakupan program.'),
    ('HEALTH_NUTRITIONIST', 'Tenaga Gizi',
     'Menilai status gizi dan menindaklanjuti anak berisiko.')
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
       * Kader: menimbang dan mencatat, itu saja.
       *
       * TIDAK diberi HEALTH_PATIENT.READ. Ia melihat anak-anak pada folder
       * keluarganya lewat menu HEALTH_FAMILY, bukan lewat pencarian pasien
       * seluruh fasilitas. Perbedaannya menentukan: yang pertama menampilkan
       * empat puluh anak di desanya, yang kedua menampilkan seluruh rekam medis
       * kabupaten.
       */
      ('HEALTH_CADRE', 'HEALTH',              'READ'),
      ('HEALTH_CADRE', 'HEALTH_FAMILY',       'READ'),
      ('HEALTH_CADRE', 'HEALTH_GROWTH',       'READ'),
      ('HEALTH_CADRE', 'HEALTH_GROWTH',       'CREATE'),
      ('HEALTH_CADRE', 'HEALTH_IMMUNIZATION', 'READ'),
      ('HEALTH_CADRE', 'HEALTH_HOME_VISIT',   'READ'),
      ('HEALTH_CADRE', 'HEALTH_HOME_VISIT',   'CREATE'),

      -- Petugas Puskesmas: seluruhnya, termasuk memberikan imunisasi.
      ('HEALTH_PHC_OFFICER', 'HEALTH',              'READ'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_PATIENT',      'READ'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_PATIENT',      'CREATE'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_FAMILY',       'READ'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_FAMILY',       'CREATE'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_FAMILY',       'UPDATE'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_GROWTH',       'READ'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_GROWTH',       'CREATE'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_IMMUNIZATION', 'READ'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_IMMUNIZATION', 'CREATE'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_IMMUNIZATION', 'IMMUNIZE'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_HOME_VISIT',   'READ'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_HOME_VISIT',   'CREATE'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_PROGRAM',      'READ'),
      ('HEALTH_PHC_OFFICER', 'HEALTH_PROGRAM',      'UPDATE'),

      ('HEALTH_NUTRITIONIST', 'HEALTH',            'READ'),
      ('HEALTH_NUTRITIONIST', 'HEALTH_PATIENT',    'READ'),
      ('HEALTH_NUTRITIONIST', 'HEALTH_FAMILY',     'READ'),
      ('HEALTH_NUTRITIONIST', 'HEALTH_GROWTH',     'READ'),
      ('HEALTH_NUTRITIONIST', 'HEALTH_GROWTH',     'CREATE'),
      ('HEALTH_NUTRITIONIST', 'HEALTH_HOME_VISIT', 'READ'),
      ('HEALTH_NUTRITIONIST', 'HEALTH_HOME_VISIT', 'CREATE'),
      ('HEALTH_NUTRITIONIST', 'HEALTH_PROGRAM',    'READ'),

      ('HEALTH_NURSE',    'HEALTH_IMMUNIZATION', 'READ'),
      ('HEALTH_NURSE',    'HEALTH_IMMUNIZATION', 'CREATE'),
      ('HEALTH_NURSE',    'HEALTH_IMMUNIZATION', 'IMMUNIZE'),
      ('HEALTH_NURSE',    'HEALTH_GROWTH',       'READ'),
      ('HEALTH_DOCTOR',   'HEALTH_GROWTH',       'READ'),
      ('HEALTH_DOCTOR',   'HEALTH_IMMUNIZATION', 'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_PROGRAM',      'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_PROGRAM',      'EXPORT')
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
-- Jadwal imunisasi nasional
-- ---------------------------------------------------------------------------
-- Disemai sebagai DATA, bukan ditanam di kode, supaya penyesuaian jadwal
-- nasional kelak menjadi perubahan baris — bukan penerbitan versi aplikasi.
--
-- Umur minimum adalah batas keamanan; umur anjuran adalah kapan anak seharusnya
-- SUDAH terlindungi. Keduanya berbeda dan keduanya dipakai: yang pertama
-- menahan pemberian terlalu cepat, yang kedua menghitung tunggakan.
INSERT INTO "{{TENANT_SCHEMA}}".immunization_schedule
  (vaccine_code, vaccine_name, dose_number, min_age_days, recommended_age_days,
   min_interval_days, route, is_mandatory, program_code)
SELECT v.code, v.name, v.dose, v.min_age, v.rec_age, v.interval, v.route, TRUE, 'IDAI_NASIONAL'
  FROM (VALUES
    ('HB0',          'Hepatitis B 0',              1, 0,   1,   NULL, 'IM'),
    ('BCG',          'BCG',                        1, 0,   30,  NULL, 'IC'),
    ('POLIO',        'Polio Tetes',                1, 0,   30,  NULL, 'ORAL'),
    ('DPT-HB-Hib',   'DPT-HB-Hib',                 1, 42,  60,  NULL, 'IM'),
    ('POLIO',        'Polio Tetes',                2, 60,  60,  28,   'ORAL'),
    ('DPT-HB-Hib',   'DPT-HB-Hib',                 2, 70,  90,  28,   'IM'),
    ('POLIO',        'Polio Tetes',                3, 90,  90,  28,   'ORAL'),
    ('DPT-HB-Hib',   'DPT-HB-Hib',                 3, 98,  120, 28,   'IM'),
    ('POLIO',        'Polio Tetes',                4, 120, 120, 28,   'ORAL'),
    ('IPV',          'Polio Suntik',               1, 120, 120, NULL, 'IM'),
    ('CAMPAK-RUBELA','Campak-Rubela',              1, 270, 270, NULL, 'SC'),
    ('CAMPAK-RUBELA','Campak-Rubela Lanjutan',     2, 540, 540, 180,  'SC'),
    ('DPT-HB-Hib',   'DPT-HB-Hib Lanjutan',        4, 540, 540, 180,  'IM')
  ) AS v(code, name, dose, min_age, rec_age, interval, route)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".immunization_schedule s
    WHERE s.vaccine_code = v.code AND s.dose_number = v.dose
 );
