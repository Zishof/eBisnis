-- Identitas pondok pesantren pada pendaftaran, dan penanda vertikal penyewa.
--
-- Dua hal, satu migrasi, karena keduanya lahir dari kebutuhan yang sama:
-- pendaftaran pesantren terpisah dari pendaftaran eBisnis, dan penyewa yang
-- lahir darinya harus dapat dikenali sebagai pesantren sesudahnya.
--
-- Seluruhnya aditif. Tidak ada kolom yang dibuang, tidak ada yang berubah tipe,
-- dan `tenant.vertical_code` boleh NULL supaya seluruh penyewa yang sudah ada
-- tetap sah tanpa disentuh.

-- ---------------------------------------------------------------------------
-- 1. Penanda vertikal pada penyewa
-- ---------------------------------------------------------------------------
--
-- Menjawab satu pertanyaan yang tidak dapat dijawab tabel lain: sesudah masuk,
-- penyewa ini melihat beranda yang mana?
--
-- Tidak diambil dari `vertical_site_domain` karena tabel itu menjawab
-- pertanyaan yang berbeda — host mana melayani siapa. Penyewa yang situsnya
-- belum dibuat tetap seorang pesantren, dan menyimpulkan jenisnya dari ada atau
-- tidaknya situs membuat berandanya berganti sendiri saat domain dicabut.
ALTER TABLE "platform"."tenant"
  ADD COLUMN "vertical_code" VARCHAR(32);

-- Sengaja dibatasi daftar tetap, bukan teks bebas. Salah ketik pada kolom ini
-- tidak menghasilkan galat: ia menghasilkan penyewa yang tidak pernah cocok
-- dengan vertikal mana pun, dan beranda yang jatuh ke bawaan tanpa ada yang
-- menyadarinya.
ALTER TABLE "platform"."tenant"
  ADD CONSTRAINT "ck_tenant_vertical_code"
  CHECK ("vertical_code" IS NULL OR "vertical_code" IN (
    'CORE_ERP', 'PESANTREN', 'SCHOOL', 'CAMPUS', 'HEALTH', 'COOPERATIVE', 'VILLAGE_GOVERNMENT'
  ));

CREATE INDEX "tenant_vertical_code_idx" ON "platform"."tenant" ("vertical_code");

-- ---------------------------------------------------------------------------
-- 2. Identitas pondok pesantren
-- ---------------------------------------------------------------------------
--
-- Tabel terpisah, bukan kolom tambahan pada `registration`.
--
-- `registration` dipakai seluruh jalur pendaftaran. Menambahkan belasan kolom
-- khas pesantren ke sana berarti setiap pendaftaran eBisnis membawa belasan
-- kolom kosong, dan vertikal berikutnya menambah belasan lagi. Yang umum tetap
-- di `registration` — nama, alamat, kontak, surel; yang khas pesantren ada di
-- sini.
CREATE TABLE "platform"."registration_pesantren" (
  "id"              UUID           NOT NULL DEFAULT gen_random_uuid(),
  "registration_id" UUID           NOT NULL,

  -- Identitas resmi
  "nomor_statistik"       VARCHAR(32),
  "nomor_izin_operasional" VARCHAR(64),
  "tanggal_izin"          DATE,
  "tahun_berdiri"         INTEGER,
  "nama_yayasan"          VARCHAR(255),
  "akta_yayasan"          VARCHAR(128),
  "nama_pengasuh"         VARCHAR(255),
  "afiliasi"              VARCHAR(64),

  -- Bentuk penyelenggaraan
  "tipe_pesantren"        VARCHAR(32)  NOT NULL,
  "santri_dilayani"       VARCHAR(16)  NOT NULL,
  -- Jenjang yang diselenggarakan. JSONB, bukan tabel anak: isinya dibaca
  -- seluruhnya atau tidak sama sekali, tidak pernah dicari satu per satu, dan
  -- tidak punya atribut sendiri.
  "jenjang"               JSONB        NOT NULL DEFAULT '[]'::jsonb,

  -- Ukuran, untuk penawaran harga. Bukan angka penagihan.
  "jumlah_santri_mukim"    INTEGER,
  "jumlah_santri_nonmukim" INTEGER,
  "jumlah_ustaz"           INTEGER,

  -- Alamat lanjutan; yang umum ada di `registration`.
  "desa_kelurahan"  VARCHAR(128),
  "kode_pos"        VARCHAR(16),

  -- Kanal
  "whatsapp"        VARCHAR(32),
  "situs_web"       VARCHAR(255),

  -- Alamat situs yang diminta: <slug>.santri.info
  --
  -- BUKAN nama pengguna. Nama pengguna menjadi nama schema dan boleh memakai
  -- garis bawah; label DNS tidak boleh. Menyamakan keduanya membuat pondok
  -- bernama `raudlatul_ulum` memperoleh host yang tidak sah dan situs yang
  -- tidak pernah dapat dibuka.
  "slug_situs"      VARCHAR(63)    NOT NULL,

  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ(6) NOT NULL,
  "version"         INTEGER        NOT NULL DEFAULT 1,

  CONSTRAINT "registration_pesantren_pkey" PRIMARY KEY ("id")
);

-- Satu pendaftaran, satu identitas pesantren.
CREATE UNIQUE INDEX "registration_pesantren_registration_id_key"
  ON "platform"."registration_pesantren" ("registration_id");

CREATE INDEX "registration_pesantren_slug_situs_idx"
  ON "platform"."registration_pesantren" ("slug_situs");

ALTER TABLE "platform"."registration_pesantren"
  ADD CONSTRAINT "registration_pesantren_registration_id_fkey"
  FOREIGN KEY ("registration_id") REFERENCES "platform"."registration"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Slug wajib berbentuk label DNS yang sah. Diperiksa di sini DAN di aplikasi:
-- yang lolos ke sini lewat jalur lain — pemulihan cadangan, penyuntingan
-- manual, skrip migrasi data — tetap tidak menghasilkan host yang tidak sah.
ALTER TABLE "platform"."registration_pesantren"
  ADD CONSTRAINT "ck_registration_pesantren_slug_dns"
  CHECK ("slug_situs" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');

ALTER TABLE "platform"."registration_pesantren"
  ADD CONSTRAINT "ck_registration_pesantren_tipe"
  CHECK ("tipe_pesantren" IN ('SALAFIYAH', 'KHALAFIYAH', 'KOMBINASI'));

ALTER TABLE "platform"."registration_pesantren"
  ADD CONSTRAINT "ck_registration_pesantren_santri"
  CHECK ("santri_dilayani" IN ('PUTRA', 'PUTRI', 'PUTRA_PUTRI'));

-- Jumlah tidak boleh negatif. Angka negatif di sini akan mengalir ke penawaran
-- harga, dan penawaran bernilai negatif adalah tagihan terbalik.
ALTER TABLE "platform"."registration_pesantren"
  ADD CONSTRAINT "ck_registration_pesantren_jumlah_wajar"
  CHECK (
    ("jumlah_santri_mukim"    IS NULL OR "jumlah_santri_mukim"    >= 0) AND
    ("jumlah_santri_nonmukim" IS NULL OR "jumlah_santri_nonmukim" >= 0) AND
    ("jumlah_ustaz"           IS NULL OR "jumlah_ustaz"           >= 0)
  );

-- Tahun berdiri yang masuk akal. Batas atas dibiarkan longgar (2100) supaya
-- migrasi ini tidak menjadi bom waktu; yang dicegah adalah salah ketik seperti
-- 202 atau 20255.
ALTER TABLE "platform"."registration_pesantren"
  ADD CONSTRAINT "ck_registration_pesantren_tahun_berdiri"
  CHECK ("tahun_berdiri" IS NULL OR ("tahun_berdiri" BETWEEN 1200 AND 2100));

-- `jenjang` wajib berupa larik JSON, bukan objek atau skalar. Tanpa ini,
-- pembacaan yang mengharapkan larik akan gagal pada baris yang bentuknya lain —
-- dan bentuk lain itu tidak pernah terlihat sampai baris itu dibaca.
ALTER TABLE "platform"."registration_pesantren"
  ADD CONSTRAINT "ck_registration_pesantren_jenjang_larik"
  CHECK (jsonb_typeof("jenjang") = 'array');
