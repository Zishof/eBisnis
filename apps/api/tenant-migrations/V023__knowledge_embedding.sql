-- =========================================================================
-- V023 — PENYIMPANAN EMBEDDING UNTUK PENCARIAN SEMANTIK
--
-- ## Mengapa float8[], bukan pgvector
--
-- `pgvector` tidak tersedia pada server ini — diperiksa langsung:
--
--     SELECT name FROM pg_available_extensions WHERE name = 'vector';
--     -- kosong
--
-- Ia bukan sekadar belum dipasang, melainkan tidak ada pada daftar ekstensi
-- yang dapat dipasang. Memasangnya menuntut menambahkan paket pada sistem
-- operasi server basis data, dan itu bukan wewenang aplikasi.
--
-- `float8[]` bekerja hari ini tanpa ekstensi apa pun. Kesamaan kosinus dihitung
-- dengan fungsi SQL biasa. Yang hilang adalah indeks pendekatan (HNSW/IVFFlat),
-- sehingga pencarian memindai seluruh baris.
--
-- ## Kapan itu menjadi masalah
--
-- Pemindaian penuh atas beberapa ribu potongan berlangsung dalam puluhan
-- milidetik. Ia mulai terasa pada puluhan ribu potongan per tenant.
--
-- Angka itu ditulis di sini supaya keputusannya dapat ditinjau ulang dengan
-- ukuran, bukan dengan firasat: bila sebuah tenant melewati sekitar 20.000
-- potongan, pemasangan `pgvector` menjadi layak diusulkan kepada operator.
--
-- Bentuk kolomnya sengaja dibuat mudah dipindahkan: `float8[]` dapat diubah
-- menjadi `vector(n)` dengan satu `ALTER TABLE ... USING`.
--
-- Additive. Tidak ada kolom lama yang diubah.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".knowledge_chunk
  ADD COLUMN IF NOT EXISTS embedding FLOAT8[],
  -- Model yang menghasilkannya. WAJIB disimpan: vektor dari model berbeda
  -- tidak dapat dibandingkan satu sama lain, dan mencampurnya menghasilkan
  -- kemiripan yang tampak masuk akal namun tidak berarti apa-apa.
  ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(160),
  -- Jumlah dimensi. Disimpan supaya ketidakcocokan terdeteksi sebelum
  -- perhitungan, bukan sebagai hasil yang salah.
  ADD COLUMN IF NOT EXISTS embedding_dim INTEGER,
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- Potongan yang belum punya embedding, atau yang embeddingnya dari model lain.
CREATE INDEX IF NOT EXISTS idx_knowledge_needs_embedding
  ON "{{TENANT_SCHEMA}}".knowledge_chunk (embedding_model)
  WHERE is_active;

/*
 * Kesamaan kosinus antara dua vektor.
 *
 * IMMUTABLE dan PARALLEL SAFE supaya perencana kueri boleh memanggilnya pada
 * banyak baris sekaligus.
 *
 * Mengembalikan NULL — bukan nol — ketika vektornya tidak sebanding. Nol
 * berarti "tidak mirip sama sekali", dan itu pernyataan yang berbeda dari
 * "tidak dapat dibandingkan". Memakai nol akan membuat potongan yang
 * dimensinya salah tampak sebagai potongan yang benar-benar tidak relevan,
 * sehingga penyebabnya tidak pernah terlihat.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".cosine_similarity(a FLOAT8[], b FLOAT8[])
RETURNS FLOAT8
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  hasil_kali FLOAT8 := 0;
  norma_a    FLOAT8 := 0;
  norma_b    FLOAT8 := 0;
  i          INTEGER;
  n          INTEGER;
BEGIN
  IF a IS NULL OR b IS NULL THEN
    RETURN NULL;
  END IF;

  n := array_length(a, 1);
  IF n IS NULL OR n <> array_length(b, 1) THEN
    -- Dimensi berbeda berarti model berbeda. Tidak dapat dibandingkan.
    RETURN NULL;
  END IF;

  FOR i IN 1..n LOOP
    hasil_kali := hasil_kali + (a[i] * b[i]);
    norma_a := norma_a + (a[i] * a[i]);
    norma_b := norma_b + (b[i] * b[i]);
  END LOOP;

  -- Vektor nol tidak punya arah, sehingga sudut terhadapnya tidak terdefinisi.
  IF norma_a = 0 OR norma_b = 0 THEN
    RETURN NULL;
  END IF;

  RETURN hasil_kali / (sqrt(norma_a) * sqrt(norma_b));
END;
$$;

COMMENT ON FUNCTION "{{TENANT_SCHEMA}}".cosine_similarity(FLOAT8[], FLOAT8[]) IS
  'Kesamaan kosinus. NULL bila dimensinya berbeda atau salah satu vektornya nol '
  '— bukan 0, karena "tidak dapat dibandingkan" bukan hal yang sama dengan '
  '"tidak mirip".';

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".knowledge_chunk.embedding_model IS
  'Model penghasil vektor. Vektor dari model berbeda tidak dapat dibandingkan; '
  'mencampurnya menghasilkan kemiripan yang tampak masuk akal namun tidak berarti.';
