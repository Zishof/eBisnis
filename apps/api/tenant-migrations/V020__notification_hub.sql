-- =========================================================================
-- V020 — NOTIFICATION HUB
--
-- Tabel `notification` sudah ada sejak V004 dan berisi NOL baris: tidak ada
-- satu pun kode yang menulisinya, dan tidak ada satu pun endpoint yang
-- membacanya. Sepuluh templat sudah tersemai dan tidak pernah dipakai.
--
-- V020 melengkapi apa yang kurang supaya tabel itu benar-benar berguna:
-- tautan menuju halaman yang bersangkutan, penanda apakah pemberitahuan ini
-- MENUNTUT TINDAKAN atau sekadar mengabarkan, pengelompokan agar seratus
-- kejadian serupa tidak menjadi seratus baris pada lonceng, dan catatan
-- pengiriman per kanal.
--
-- Additive. Tidak ada kolom lama yang diubah maupun dihapus.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".notification
  -- Tautan menuju halaman yang bersangkutan.
  --
  -- Tanpa ini, pemberitahuan hanya memberi tahu bahwa sesuatu terjadi lalu
  -- membiarkan orangnya mencari sendiri di mana. Pemberitahuan yang tidak
  -- dapat ditindaklanjuti dengan satu ketukan pada akhirnya diabaikan.
  --
  -- Disimpan sebagai jalur relatif, bukan URL lengkap: URL lengkap memuat nama
  -- host, dan pemberitahuan yang dibuat di lingkungan pengembangan akan
  -- menautkan ke localhost selamanya.
  ADD COLUMN IF NOT EXISTS deep_link VARCHAR(255),

  -- Apakah pemberitahuan ini menuntut tindakan.
  --
  -- Dibedakan tegas dari sekadar kabar. Lonceng yang mencampur "surat Anda
  -- sudah disetujui" dengan "surat menunggu persetujuan Anda" memaksa orang
  -- membaca semuanya untuk menemukan yang perlu dikerjakan — dan pada
  -- akhirnya tidak membaca satu pun.
  ADD COLUMN IF NOT EXISTS action_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acted_at TIMESTAMPTZ,

  -- Ditutup pengguna tanpa menindaklanjutinya. Berbeda dari dibaca: dibaca
  -- berarti dilihat, ditutup berarti sengaja disingkirkan.
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,

  -- Kunci pengelompokan. Seratus stok yang menipis pada satu gudang sebaiknya
  -- menjadi satu baris berpenghitung, bukan seratus baris yang menenggelamkan
  -- segalanya.
  ADD COLUMN IF NOT EXISTS group_key VARCHAR(128),
  ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1
    CHECK (occurrence_count > 0),
  ADD COLUMN IF NOT EXISTS last_occurred_at TIMESTAMPTZ,

  -- Kedaluwarsa. Pemberitahuan tentang persetujuan yang batas waktunya sudah
  -- lewat tidak perlu terus muncul.
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,

  -- Penerima dapat berupa peran, bukan hanya orang. Disposisi yang ditujukan
  -- kepada jabatan harus sampai kepada siapa pun yang memegang jabatan itu.
  ADD COLUMN IF NOT EXISTS recipient_role_code VARCHAR(64),

  -- Peran yang dipakai pembuatnya saat memicu pemberitahuan ini.
  ADD COLUMN IF NOT EXISTS created_as_role_code VARCHAR(64);

-- Satu kelompok, satu baris hidup per penerima.
--
-- Indeks unik parsial: hanya berlaku pada pemberitahuan yang belum dibaca dan
-- belum ditutup. Yang sudah dibaca boleh muncul lagi sebagai kejadian baru —
-- kalau tidak, kejadian yang berulang setelah ditangani tidak akan pernah
-- memberi tahu siapa pun lagi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_group_live
  ON "{{TENANT_SCHEMA}}".notification (group_key, recipient_subject_id, channel)
  WHERE group_key IS NOT NULL AND read_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_bell
  ON "{{TENANT_SCHEMA}}".notification (recipient_subject_id, read_at, created_at DESC)
  WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_role
  ON "{{TENANT_SCHEMA}}".notification (recipient_role_code, read_at)
  WHERE recipient_role_code IS NOT NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_action
  ON "{{TENANT_SCHEMA}}".notification (recipient_subject_id, action_required, acted_at)
  WHERE action_required AND acted_at IS NULL AND dismissed_at IS NULL;

-- Catatan pengiriman per kanal ---------------------------------------------
--
-- ## Mengapa terpisah dari `notification`
--
-- Satu pemberitahuan dapat dikirim lewat beberapa kanal, dan setiap kanal
-- berhasil atau gagal sendiri-sendiri. Kolom `status` tunggal pada
-- `notification` tidak dapat menyatakan "sampai lewat aplikasi, gagal lewat
-- surel" — dan menyatakannya sebagai satu status akan menyembunyikan kegagalan
-- yang perlu ditangani.
--
-- ## Kanal yang belum dapat dikonfigurasi
--
-- Surel, web push, WhatsApp, dan pemberitahuan seluler menuntut kredensial
-- yang tidak dimiliki sistem ini. Adapter untuk kanal itu TIDAK mengarang
-- keberhasilan: ia menulis baris berstatus `UNCONFIGURED` beserta keterangan
-- apa yang kurang.
--
-- Itu jauh lebih baik daripada dua pilihan lainnya. Melaporkan berhasil padahal
-- tidak terkirim membuat orang mengira sudah diberi tahu. Menolak seluruh
-- pemberitahuan karena satu kanal belum siap membuat kanal yang bekerja ikut
-- mati.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".notification_delivery (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL
                  REFERENCES "{{TENANT_SCHEMA}}".notification(id) ON DELETE CASCADE,

  channel         VARCHAR(16) NOT NULL
                  CHECK (channel IN ('IN_APP', 'EMAIL', 'WEB_PUSH', 'WHATSAPP', 'MOBILE_PUSH')),

  status          VARCHAR(16) NOT NULL
                  CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'UNCONFIGURED', 'SKIPPED')),

  -- Keterangan yang dapat dibaca. Untuk UNCONFIGURED, ia menyebutkan apa yang
  -- kurang — bukan sekadar "tidak dikonfigurasi", yang memaksa operatornya
  -- menebak apa yang harus disiapkan.
  note            TEXT,

  attempt_count   INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_notification_delivery UNIQUE (notification_id, channel),
  CONSTRAINT ck_notification_delivery_sent
    CHECK (status <> 'SENT' OR sent_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_status
  ON "{{TENANT_SCHEMA}}".notification_delivery (status, created_at)
  WHERE status IN ('PENDING', 'FAILED');

-- Preferensi kanal per pengguna --------------------------------------------
--
-- Bawaannya menerima. Preferensi yang bawaannya menolak berarti tidak ada yang
-- menerima pemberitahuan sampai setiap orang menyetelnya sendiri — dan
-- pemberitahuan yang tidak sampai sama saja dengan tidak ada.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".notification_preference (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id UUID NOT NULL
                  REFERENCES "{{TENANT_SCHEMA}}".user_subject(id) ON DELETE CASCADE,
  channel         VARCHAR(16) NOT NULL
                  CHECK (channel IN ('IN_APP', 'EMAIL', 'WEB_PUSH', 'WHATSAPP', 'MOBILE_PUSH')),

  -- Kosong berarti berlaku untuk seluruh jenis.
  template_code   VARCHAR(64),

  enabled         BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_notification_preference
    UNIQUE (user_subject_id, channel, template_code)
);

-- Pemberitahuan yang MENUNTUT TINDAKAN tidak dapat dimatikan pada kanal
-- dalam aplikasi.
--
-- Seseorang yang mematikannya akan berhenti menerima permintaan persetujuan
-- tanpa menyadarinya, dan pekerjaan orang lain berhenti menunggunya tanpa ada
-- yang tahu sebabnya. Preferensi boleh mengurangi kebisingan, tidak boleh
-- memutus alur kerja.
--
-- Ditegakkan pada lapisan aplikasi karena batasannya bergantung pada isi
-- templat, bukan pada baris preferensi itu sendiri.

-- Audit --------------------------------------------------------------------
--
-- `notification` dan `notification_delivery` TIDAK diaudit dengan sengaja:
-- keduanya bervolume tinggi, append-only pada praktiknya, dan isinya sudah
-- merupakan catatan. Mengaudit catatan menghasilkan catatan tentang catatan.
--
-- `notification_preference` diaudit: mematikan pemberitahuan adalah perubahan
-- yang dapat menjelaskan mengapa seseorang tidak menanggapi sesuatu.
DO $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I',
                 'notification_preference', '{{TENANT_SCHEMA}}');
  EXECUTE format(
    'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
    || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
    'notification_preference', '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
  );
END $$;
