-- =========================================================================
-- V016 — JEJAK PEMAKAIAN ANTARMUKA
--
-- ## Mengapa tabel terpisah, bukan baris pada audit_event
--
-- Yang dicatat di sini **dilaporkan oleh peramban**, bukan disaksikan server.
-- Ketika peramban berkata "saya membuka menu Pembelian", server tidak punya
-- cara memastikannya: tidak ada permintaan yang wajib menyertainya, dan siapa
-- pun yang memegang token dapat mengirim laporan apa saja.
--
-- Karena itu ia TIDAK BOLEH bercampur dengan `audit_event`. Tabel itu memuat
-- peristiwa yang benar-benar terjadi pada server dan dipakai sebagai bukti;
-- mencampurkan laporan yang tidak dapat diverifikasi ke dalamnya akan merusak
-- nilai seluruh isinya. Satu baris yang dapat dikarang membuat seluruh tabel
-- tidak lagi dapat dijadikan bukti.
--
-- Guna tabel ini adalah **analitik pemakaian**, dan hanya itu:
--   * menu mana yang tidak pernah dibuka siapa pun,
--   * tombol mana yang ditekan lalu dibatalkan,
--   * halaman mana yang dibuka tetapi tidak menghasilkan tindakan.
--
-- Jangan sekali-kali memakainya untuk membuktikan bahwa seseorang melakukan
-- sesuatu. Untuk itu ada `audit_event`.
--
-- Additive. Tidak ada tabel maupun kolom lama yang diubah.
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".ui_activity_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- MENU_OPEN  : sebuah menu dibuka.
  -- PAGE_VIEW  : sebuah halaman ditampilkan.
  -- UI_ACTION  : sebuah kendali ditekan (tombol, tab, filter).
  -- Nilainya sengaja sedikit dan tertutup; jenis yang bebas akan terisi apa
  -- saja dan tidak dapat diringkas.
  activity_type     VARCHAR(16) NOT NULL
                    CHECK (activity_type IN ('MENU_OPEN', 'PAGE_VIEW', 'UI_ACTION')),

  -- Kode menu tempat kejadian, mis. PEMBELIAN. Boleh kosong untuk halaman yang
  -- tidak tergantung menu.
  menu_code         VARCHAR(64),

  -- Jalur antarmuka, mis. /erp/pembelian/po. Bukan URL lengkap: tanya jawab
  -- kueri tidak disimpan karena dapat memuat kata kunci pencarian yang
  -- menyingkap isi data.
  route_path        VARCHAR(255),

  -- Untuk UI_ACTION: kode kendali yang ditekan, mis. SIMPAN atau EKSPOR.
  action_code       VARCHAR(64),

  -- Untuk UI_ACTION: hasil yang dilaporkan peramban.
  -- Sekali lagi — dilaporkan, bukan disaksikan.
  outcome           VARCHAR(16)
                    CHECK (outcome IS NULL OR outcome IN ('SUCCESS', 'CANCELLED', 'FAILED')),

  -- Lama pengguna berada pada halaman, dalam milidetik. Boleh kosong.
  duration_ms       INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),

  -- Siapa. Diambil dari sesi di server, BUKAN dari badan permintaan — kalau
  -- tidak, seseorang dapat melaporkan aktivitas atas nama orang lain.
  user_subject_id   UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  platform_user_id  UUID NOT NULL,
  session_id        UUID,

  -- Peran yang sedang dipakai saat itu; menjawab "dalam kapasitas apa".
  active_role_code  VARCHAR(64),

  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Waktu yang dilaporkan peramban. Disimpan terpisah dari occurred_at supaya
  -- selisih keduanya terlihat: jam peramban dapat salah, dan laporan yang
  -- menumpuk lalu dikirim sekaligus akan tampak sebagai lonjakan palsu bila
  -- hanya ada satu kolom waktu.
  client_time       TIMESTAMPTZ,

  request_id        VARCHAR(64)
);

-- Pertanyaan yang paling sering: "menu apa yang dipakai bulan ini".
CREATE INDEX IF NOT EXISTS idx_ui_activity_menu_time
  ON "{{TENANT_SCHEMA}}".ui_activity_log (menu_code, occurred_at DESC);

-- "Apa yang dikerjakan orang ini".
CREATE INDEX IF NOT EXISTS idx_ui_activity_user_time
  ON "{{TENANT_SCHEMA}}".ui_activity_log (platform_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ui_activity_type_time
  ON "{{TENANT_SCHEMA}}".ui_activity_log (activity_type, occurred_at DESC);

COMMENT ON TABLE "{{TENANT_SCHEMA}}".ui_activity_log IS
  'Jejak pemakaian antarmuka yang DILAPORKAN PERAMBAN. Untuk analitik pemakaian, '
  'bukan untuk bukti. Isinya tidak dapat diverifikasi server; bukti perbuatan ada '
  'pada audit_event.';

-- Sengaja TIDAK ada trigger audit pada tabel ini.
--
-- Trigger audit menulis satu baris audit_row_change untuk setiap perubahan.
-- Tabel ini menerima ribuan baris sehari dari pemakaian biasa, dan
-- mengauditnya akan melipatgandakan volume tanpa menambah satu pun jawaban:
-- tabelnya append-only, tidak pernah diubah maupun dihapus, sehingga tidak ada
-- perubahan yang perlu diawasi.
