-- =========================================================================
-- V022 — BASIS PENGETAHUAN UNTUK RAG
--
-- ## Mengapa tanpa kolom vektor
--
-- Rancangan awal V11-3 mengandaikan pencarian semantik memakai embedding.
-- Diuji langsung terhadap penyedia, dan jawabannya tegas:
--
--     {"error":"This server does not support embeddings.
--               Start it with `--embeddings`"}
--
-- Penghalangnya bukan model yang kurang melainkan **bendera pada server**.
-- Selama bendera itu mati, tidak ada satu pun model di sana yang dapat
-- menghasilkan embedding.
--
-- Ada tiga pilihan, dan yang dipilih adalah yang ketiga:
--
--   1. Menunda V11-3 sampai operator menyalakan `--embeddings`. Berarti tidak
--      ada pencarian sama sekali sampai entah kapan.
--   2. Memasang kolom vektor sekarang dan membiarkannya kosong. Berarti skema
--      yang berpura-pura punya kemampuan yang tidak ada.
--   3. Membangun pencarian LEKSIKAL yang bekerja hari ini, di balik antarmuka
--      yang dapat ditukar. PostgreSQL sudah punya pencarian teks penuh, dan
--      pencarian leksikal yang mengembalikan bukti nyata jauh lebih berguna
--      daripada pencarian semantik yang tidak ada.
--
-- Kolom vektor sengaja TIDAK dibuat sekarang. Menambahkannya kelak adalah
-- migration additive satu kolom; membuatnya sekarang berarti menyimpan skema
-- yang menjanjikan sesuatu yang tidak dapat dipenuhi.
--
-- Additive. Tidak ada tabel maupun kolom lama yang diubah.
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".knowledge_chunk (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dari mana potongan ini berasal.
  -- SURAT_MASUK, SURAT_KELUAR, HELP, SOP, atau CATATAN.
  source_type    VARCHAR(24) NOT NULL
                 CHECK (source_type IN ('SURAT_MASUK', 'SURAT_KELUAR', 'HELP', 'SOP', 'CATATAN')),
  source_id      UUID,
  -- Rujukan yang dapat dibaca manusia, mis. nomor surat. Ditampilkan bersama
  -- jawaban AI sebagai bukti — tanpa ini, jawaban tidak dapat ditelusuri.
  source_ref     VARCHAR(160),
  title          VARCHAR(500) NOT NULL,
  content        TEXT NOT NULL,

  -- Urutan potongan dalam satu dokumen, supaya konteksnya dapat disusun ulang.
  chunk_index    SMALLINT NOT NULL DEFAULT 0,

  -- ## Metadata izin
  --
  -- Potongan menyimpan SALINAN isi dokumen. Tanpa penanda izin, seseorang yang
  -- tidak berhak membaca surat rahasia tetap dapat memperoleh isinya lewat
  -- jawaban AI — dan pencarian menjadi jalan memintas seluruh hak akses.
  --
  -- Kode menu yang izinnya menentukan siapa boleh melihat potongan ini.
  required_menu_code VARCHAR(64) NOT NULL,
  -- Tingkat kerahasiaan, disalin dari dokumen asalnya.
  confidentiality VARCHAR(16) NOT NULL DEFAULT 'BIASA'
                 CHECK (confidentiality IN ('BIASA', 'TERBATAS', 'RAHASIA', 'SANGAT_RAHASIA')),

  -- Vektor pencarian teks penuh, dibangun otomatis.
  --
  -- `simple` dipakai, bukan `indonesian`: PostgreSQL tidak menyertakan kamus
  -- bahasa Indonesia secara bawaan, dan memakai `english` akan memotong kata
  -- Indonesia dengan aturan yang salah. `simple` tidak memotong apa pun —
  -- kurang cerdas, tetapi tidak pernah salah.
  search_vector  tsvector GENERATED ALWAYS AS (
                   to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
                 ) STORED,

  -- Sidik isi, untuk mengenali potongan yang tidak berubah saat disegarkan.
  content_hash   VARCHAR(64) NOT NULL,

  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  indexed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_knowledge_chunk UNIQUE (source_type, source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_search
  ON "{{TENANT_SCHEMA}}".knowledge_chunk USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_knowledge_source
  ON "{{TENANT_SCHEMA}}".knowledge_chunk (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_permission
  ON "{{TENANT_SCHEMA}}".knowledge_chunk (required_menu_code, confidentiality)
  WHERE is_active;

COMMENT ON TABLE "{{TENANT_SCHEMA}}".knowledge_chunk IS
  'Potongan dokumen untuk pencarian bukti AI. Menyimpan SALINAN isi dokumen, '
  'sehingga metadata izinnya wajib diperiksa pada setiap pencarian — tanpa itu, '
  'pencarian menjadi jalan memintas hak akses.';

-- Pencarian tidak diaudit dengan trigger baris karena tabelnya diisi mesin.
-- Yang perlu tercatat adalah PEMBACAANNYA, dan itu tercatat pada ai_invocation
-- beserta jumlah bukti yang dipakai.
