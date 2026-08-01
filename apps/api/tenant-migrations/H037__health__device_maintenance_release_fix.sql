-- =========================================================================
-- H037 — PERBAIKAN: AKSI PENUTUP PEKERJAAN PEMELIHARAAN
-- =========================================================================
--
-- Fase H-9J. Aditif seluruhnya.
--
-- H036 memberikan aksi `CLOSE` kepada menu HEALTH_DEVICE_MAINTENANCE. Aksi itu
-- **tidak ada** pada kosakata hak akses bersama — yang ada `CLOSE_PERIOD` dan
-- `CLOSE_SHIFT`, keduanya berarti hal yang lain.
--
-- Akibatnya tidak berupa galat. Penyisipan `menu_action` pada H036 dijaga
-- `IF a_id IS NOT NULL`, sehingga pasangan yang aksinya tidak dikenal
-- **dilewati diam-diam**: migrasinya berhasil, menunya ada, perannya ada, dan
-- satu-satunya tanda bahwa ada yang salah adalah teknisi yang tidak dapat
-- menutup pekerjaannya sama sekali.
--
-- Ini kelas kekeliruan yang layak dicatat: penjaga yang membuat migrasi
-- **tahan terhadap urutan penerapan** juga membuatnya diam ketika yang
-- dilewatinya bukan urutan, melainkan salah ketik. H036 tidak disunting —
-- checksum melindungi migrasi yang sudah diterapkan, dan pembetulan datang
-- sebagai migrasi baru.
--
-- Yang dipakai sebagai gantinya: `RELEASE`. Ia sudah ada pada kosakata
-- bersama, dan artinya persis: pekerjaannya dilepaskan, beserta alatnya.

-- ---------------------------------------------------------------------------
-- Aksi RELEASE pada menu pemeliharaan
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  m_id UUID;
  a_id UUID;
BEGIN
  SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu
    WHERE code = 'HEALTH_DEVICE_MAINTENANCE' AND deleted_at IS NULL;
  SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action WHERE code = 'RELEASE';

  IF m_id IS NULL THEN
    RAISE EXCEPTION 'Menu HEALTH_DEVICE_MAINTENANCE belum ada; H036 harus dijalankan lebih dahulu.';
  END IF;
  /*
   * Sengaja MENGGAGALKAN migrasi bila aksinya tidak ada, alih-alih melewatinya
   * diam-diam seperti H036. Kegagalan yang berisik lebih baik daripada
   * hak akses yang hilang tanpa ada yang tahu.
   */
  IF a_id IS NULL THEN
    RAISE EXCEPTION 'Aksi RELEASE tidak ada pada kosakata hak akses tenant ini.';
  END IF;

  INSERT INTO "{{TENANT_SCHEMA}}".menu_action (menu_id, permission_action_id)
  VALUES (m_id, a_id)
  ON CONFLICT DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- Teknisi biomedis menutup pekerjaannya
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r_id UUID;
  m_id UUID;
  a_id UUID;
BEGIN
  SELECT id INTO r_id FROM "{{TENANT_SCHEMA}}".role
    WHERE code = 'HEALTH_BIOMEDICAL_ENGINEER' AND deleted_at IS NULL;
  SELECT id INTO m_id FROM "{{TENANT_SCHEMA}}".menu
    WHERE code = 'HEALTH_DEVICE_MAINTENANCE' AND deleted_at IS NULL;
  SELECT id INTO a_id FROM "{{TENANT_SCHEMA}}".permission_action WHERE code = 'RELEASE';

  IF r_id IS NOT NULL AND m_id IS NOT NULL AND a_id IS NOT NULL THEN
    INSERT INTO "{{TENANT_SCHEMA}}".role_menu_permission
      (role_id, menu_id, permission_action_id, effect)
    VALUES (r_id, m_id, a_id, 'ALLOW')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
