-- =========================================================================
-- H040 — MENU, HAK AKSES, DAN PERAN DASBOR INVESTOR
-- =========================================================================
--
-- Fase H-9K. Aditif seluruhnya.
--
-- Peran investor pada H-9G sengaja dibuat **lebih dahulu daripada dasbornya**,
-- dengan hanya dua hak akses, supaya batasnya tercatat sebelum ada layar yang
-- menggodanya. Migrasi ini menambahkan layarnya, dan menambahkan **tepat satu
-- hak** kepada investor: membaca proyeksi agregat.
--
-- Satu, bukan dua. Ia tidak dapat menghitung proyeksi, tidak dapat menyusun
-- waterfall, tidak dapat menghitung distribusinya sendiri, dan tidak dapat
-- menyetujui apa pun. Dasbor yang membiarkan pembacanya menekan tombol hitung
-- adalah dasbor yang angkanya ditentukan oleh orang yang paling berkepentingan
-- atas angkanya.
--
-- Dan yang tidak berubah: **investor tetap tanpa satu pun hak atas data
-- pasien.** Daftar itu bukan preferensi. Investor adalah pihak luar yang
-- memiliki kepentingan keuangan, bukan hubungan perawatan; memberinya data
-- pasien bukan pelanggaran kebijakan internal melainkan pelanggaran
-- kerahasiaan medis.

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
      ('HEALTH_INVESTOR_DASHBOARD', 'Dasbor Investor',   'menu.health.investor_dashboard', '/app/emedik/dasbor-investor', 'line-chart',  '/HEALTH/HEALTH_INVESTOR_DASHBOARD', 115),
      ('HEALTH_INVESTOR_WATERFALL', 'Waterfall Investor','menu.health.investor_waterfall', '/app/emedik/waterfall',       'layers',      '/HEALTH/HEALTH_INVESTOR_WATERFALL', 116),
      ('HEALTH_INVESTOR_DISTRIBUTION', 'Distribusi Investor', 'menu.health.investor_distribution', '/app/emedik/distribusi', 'hand-coins', '/HEALTH/HEALTH_INVESTOR_DISTRIBUTION', 117)
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
  hilang TEXT := '';
BEGIN
  FOR pasangan IN
    SELECT * FROM (VALUES
      -- READ membaca proyeksi yang sudah dihitung; CREATE menghitungnya.
      -- Investor hanya memperoleh yang pertama.
      ('HEALTH_INVESTOR_DASHBOARD', 'READ'),
      ('HEALTH_INVESTOR_DASHBOARD', 'CREATE'),
      ('HEALTH_INVESTOR_DASHBOARD', 'UPDATE'),
      ('HEALTH_INVESTOR_WATERFALL', 'READ'),
      ('HEALTH_INVESTOR_WATERFALL', 'CREATE'),
      ('HEALTH_INVESTOR_WATERFALL', 'UPDATE'),
      ('HEALTH_INVESTOR_WATERFALL', 'ACTIVATE'),
      ('HEALTH_INVESTOR_DISTRIBUTION', 'READ'),
      ('HEALTH_INVESTOR_DISTRIBUTION', 'CREATE'),
      ('HEALTH_INVESTOR_DISTRIBUTION', 'APPROVE'),
      ('HEALTH_INVESTOR_DISTRIBUTION', 'POST'),
      ('HEALTH_INVESTOR_DISTRIBUTION', 'CANCEL')
    ) AS t(menu_code, action_code)
  LOOP
    SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu
      WHERE code = pasangan.menu_code AND deleted_at IS NULL;
    SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action
      WHERE code = pasangan.action_code;

    /*
     * MENGUMPULKAN YANG HILANG, LALU MENGGAGALKAN.
     *
     * Pelajaran H037: penjaga `IF a_id IS NOT NULL` membuat migrasi tahan
     * terhadap urutan penerapan, dan justru karena itu ia diam ketika yang
     * dilewatinya bukan urutan melainkan salah ketik. Migrasi berhasil,
     * menunya ada, dan satu-satunya tanda ada yang salah adalah pengguna yang
     * tidak dapat bekerja.
     */
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
INSERT INTO "{{TENANT_SCHEMA}}".role (code, name, description, is_system, is_core)
SELECT v.code, v.name, v.description, TRUE, FALSE
  FROM (VALUES
    ('HEALTH_INVESTOR_ANALYST', 'Analis Investasi Rumah Sakit',
     'Menghitung proyeksi agregat, menyusun waterfall, dan menghitung distribusi. TIDAK menyetujui distribusi dan TIDAK membayarkannya.')
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
       * INVESTOR: TEPAT SATU HAK BARU.
       *
       * Membaca proyeksi agregat yang sudah dihitung. Ia tidak menghitungnya
       * sendiri — dasbor yang membiarkan pembacanya menekan tombol hitung
       * adalah dasbor yang angkanya ditentukan oleh orang yang paling
       * berkepentingan atas angkanya.
       *
       * Dan tetap tanpa satu pun hak atas data pasien.
       */
      ('HEALTH_INVESTOR_VIEWER', 'HEALTH_INVESTOR_DASHBOARD', 'READ'),

      -- Analis investasi: menghitung, tidak menyetujui.
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH',                       'READ'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_INVESTOR_DASHBOARD',    'READ'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_INVESTOR_DASHBOARD',    'CREATE'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_INVESTOR_DASHBOARD',    'UPDATE'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_INVESTOR_WATERFALL',    'READ'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_INVESTOR_WATERFALL',    'CREATE'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_INVESTOR_WATERFALL',    'UPDATE'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_INVESTOR_DISTRIBUTION', 'READ'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_INVESTOR_DISTRIBUTION', 'CREATE'),
      ('HEALTH_INVESTOR_ANALYST', 'HEALTH_FEE_CONTRACT',          'READ'),

      -- Manajemen menyetujui distribusi dan mengaktifkan waterfall; ia tidak
      -- menghitung.
      ('HEALTH_ADMIN', 'HEALTH_INVESTOR_DISTRIBUTION', 'READ'),
      ('HEALTH_ADMIN', 'HEALTH_INVESTOR_DISTRIBUTION', 'APPROVE'),
      ('HEALTH_ADMIN', 'HEALTH_INVESTOR_DISTRIBUTION', 'CANCEL'),
      ('HEALTH_ADMIN', 'HEALTH_INVESTOR_WATERFALL',    'READ'),
      ('HEALTH_ADMIN', 'HEALTH_INVESTOR_WATERFALL',    'ACTIVATE'),
      ('HEALTH_ADMIN', 'HEALTH_INVESTOR_DASHBOARD',    'UPDATE'),

      -- Petugas pembayaran jasa membayarkan distribusi pula; ia tidak
      -- menghitung dan tidak menyetujui.
      ('HEALTH_SETTLEMENT_PAYER', 'HEALTH_INVESTOR_DISTRIBUTION', 'READ'),
      ('HEALTH_SETTLEMENT_PAYER', 'HEALTH_INVESTOR_DISTRIBUTION', 'POST'),

      ('HEALTH_DIRECTOR', 'HEALTH_INVESTOR_DASHBOARD',    'READ'),
      ('HEALTH_DIRECTOR', 'HEALTH_INVESTOR_DISTRIBUTION', 'READ'),

      -- Petugas keuangan melihat distribusinya; ia sudah tanpa hak pasien
      -- sejak H-9N.
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_INVESTOR_DISTRIBUTION', 'READ'),
      ('HEALTH_FINANCE_OFFICER', 'HEALTH_INVESTOR_DASHBOARD',    'READ')
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
    ('HEALTH_SOD_DISTRIBUTION_APPROVE', 'Penghitung distribusi tidak menyetujuinya',
    'Persetujuan oleh penghitungnya hanya membaca ulang angkanya sendiri — dan angka yang keliru masih tampak benar baginya, sebab ia yang membuatnya. Uang yang berpindah kepada investor berdasarkan angka yang keliru sulit ditarik kembali, dan investor yang sudah menerimanya punya alasan untuk tidak mengembalikannya. Ditegakkan constraint investor_dist_approve_not_self pada basis data pula.',
    'CRITICAL'),
    ('HEALTH_SOD_DISTRIBUTION_PAY', 'Penyetuju distribusi tidak membayarkannya',
    'Persetujuan yang langsung menjadi transfer menghilangkan jeda terakhir sebelum uang berpindah. Jeda itu bukan birokrasi: ia satu-satunya kesempatan bagi orang ketiga untuk melihat angkanya sebelum ia tidak dapat ditarik kembali. Ditegakkan constraint investor_dist_pay_not_approver pula.',
    'HIGH'),
    ('HEALTH_SOD_INVESTOR_VIEW_COMPUTE', 'Pemegang kontrak investor tidak menghitung proyeksinya',
    'Dasbor yang membiarkan pembacanya menekan tombol hitung adalah dasbor yang angkanya ditentukan oleh orang yang paling berkepentingan atas angkanya. Investor memperoleh proyeksi agregat yang SUDAH dihitung — bukan akses ke tabel sumbernya dengan penyaring, dan bukan pula kemampuan menghitung ulang dengan ambang kohort yang lebih longgar.',
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
      ('HEALTH_SOD_DISTRIBUTION_APPROVE',   'HEALTH_INVESTOR_ANALYST',  'PREPARER'),
      ('HEALTH_SOD_DISTRIBUTION_APPROVE',   'HEALTH_ADMIN',             'APPROVER'),
      ('HEALTH_SOD_DISTRIBUTION_PAY',       'HEALTH_ADMIN',             'PREPARER'),
      ('HEALTH_SOD_DISTRIBUTION_PAY',       'HEALTH_SETTLEMENT_PAYER',  'APPROVER'),
      ('HEALTH_SOD_INVESTOR_VIEW_COMPUTE',  'HEALTH_INVESTOR_VIEWER',   'PREPARER'),
      ('HEALTH_SOD_INVESTOR_VIEW_COMPUTE',  'HEALTH_INVESTOR_ANALYST',  'APPROVER')
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

-- ---------------------------------------------------------------------------
-- Kebijakan penyamaran bawaan bagi setiap fasilitas
-- ---------------------------------------------------------------------------
-- Disemai supaya tidak ada fasilitas yang berjalan tanpa ambang. Fasilitas
-- tanpa baris kebijakan akan memakai ambang apa pun yang kebetulan dipilih
-- kode pemanggilnya, dan yang kebetulan dipilih selalu berakhir nol.
INSERT INTO "{{TENANT_SCHEMA}}".investor_disclosure_policy (facility_id, minimum_cohort)
SELECT f.id, 5
  FROM "{{TENANT_SCHEMA}}".health_facility f
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".investor_disclosure_policy p WHERE p.facility_id = f.id
 );
