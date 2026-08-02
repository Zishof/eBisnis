-- Registry portal brand ekosistem.
--
-- Lima merek publik (ebisnis.id, enterprise-education.id, emedik.id,
-- ekoperasi.id, info-desa.id) dilayani SATU aplikasi. Yang membedakan jawaban
-- untuk masing-masing adalah baris di tabel ini, bukan lima penyebaran
-- terpisah.
--
-- Berbeda dari `vertical_site_domain` yang memetakan host ke PENYEWA, tabel ini
-- memetakan host ke MEREK. Keduanya diperlukan dan tidak saling menggantikan:
-- `emedik.id` adalah portal, sedangkan `mitrasehat.emedik.id` adalah situs
-- penyewa. Menyatukannya berarti satu baris harus berarti dua hal sekaligus,
-- dan pembacanya harus menebak yang mana.

CREATE TABLE "platform"."platform_portal" (
  "id"              UUID           NOT NULL DEFAULT gen_random_uuid(),
  "code"            VARCHAR(32)    NOT NULL,
  "name"            VARCHAR(120)   NOT NULL,
  "tagline"         VARCHAR(240),
  -- Vertikal utama portal ini. Portal TIDAK membatasi modul yang dapat dibeli
  -- penyewa (§1272); ia hanya menentukan merek, konten, dan onboarding bawaan.
  "vertical_code"   VARCHAR(32)    NOT NULL,
  "brand_primary"   VARCHAR(9)     NOT NULL DEFAULT '#0F172A',
  "brand_accent"    VARCHAR(9)     NOT NULL DEFAULT '#2563EB',
  "logo_path"       VARCHAR(240),
  "default_locale"  VARCHAR(12)    NOT NULL DEFAULT 'id',
  "status"          VARCHAR(24)    NOT NULL DEFAULT 'DRAFT',
  "sort_order"      INTEGER        NOT NULL DEFAULT 0,
  "metadata"        JSONB,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ(6) NOT NULL,
  "version"         INTEGER        NOT NULL DEFAULT 1,
  CONSTRAINT "platform_portal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_portal_code_key"
  ON "platform"."platform_portal" ("code");

ALTER TABLE "platform"."platform_portal"
  ADD CONSTRAINT "ck_platform_portal_status"
  CHECK ("status" IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED'));

-- Kode portal dipakai sebagai kunci di kode, konfigurasi penyebaran, dan
-- atribusi pendaftaran. Yang bercampur huruf besar-kecil akan gagal dicocokkan
-- di salah satu dari ketiganya, dan yang gagal cuma satu di antaranya adalah
-- yang paling lama tidak ketahuan.
ALTER TABLE "platform"."platform_portal"
  ADD CONSTRAINT "ck_platform_portal_code_upper"
  CHECK ("code" = upper("code") AND "code" ~ '^[A-Z][A-Z0-9_]*$');

-- ---------------------------------------------------------------------------
-- Host yang dilayani sebuah portal
-- ---------------------------------------------------------------------------
--
-- Satu portal punya beberapa host dengan peran berbeda: apex publik
-- (ebisnis.id), pintu aplikasi (app.ebisnis.id), dan penerbit identitas
-- (auth.ebisnis.id). Peran itu menentukan APA yang dijawab, sehingga ia data,
-- bukan tebakan dari bentuk namanya.

CREATE TABLE "platform"."platform_portal_domain" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "portal_id"    UUID           NOT NULL,
  "host"         VARCHAR(253)   NOT NULL,
  "kind"         VARCHAR(16)    NOT NULL DEFAULT 'PUBLIC',
  -- Host kanonik dipakai membangun tautan lintas portal dan `<link rel=canonical>`.
  -- Tanpa penanda ini, lima portal yang saling menaut akan menghasilkan konten
  -- ganda di mata mesin pencari (§1683).
  "is_canonical" BOOLEAN        NOT NULL DEFAULT FALSE,
  "status"       VARCHAR(24)    NOT NULL DEFAULT 'PENDING',
  "verified_at"  TIMESTAMPTZ(6),
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL,
  "version"      INTEGER        NOT NULL DEFAULT 1,
  CONSTRAINT "platform_portal_domain_pkey" PRIMARY KEY ("id")
);

-- Satu host melayani satu portal. Dua baris yang mengklaim host sama membuat
-- jawaban bergantung pada urutan baca — ketidakpastian yang tidak boleh ada
-- pada pemetaan yang menentukan merek dan konten apa yang tampil.
CREATE UNIQUE INDEX "platform_portal_domain_host_key"
  ON "platform"."platform_portal_domain" ("host");

-- Satu portal punya paling banyak satu host kanonik per peran.
CREATE UNIQUE INDEX "platform_portal_domain_canonical_key"
  ON "platform"."platform_portal_domain" ("portal_id", "kind")
  WHERE "is_canonical" = TRUE;

CREATE INDEX "platform_portal_domain_portal_idx"
  ON "platform"."platform_portal_domain" ("portal_id", "status");

ALTER TABLE "platform"."platform_portal_domain"
  ADD CONSTRAINT "platform_portal_domain_portal_id_fkey"
  FOREIGN KEY ("portal_id") REFERENCES "platform"."platform_portal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Aturan penormalan yang sama persis dengan `vertical_site_domain`. Dua tabel
-- host dengan aturan berbeda akan menghasilkan host yang cocok di satu tempat
-- dan tidak di tempat lain.
ALTER TABLE "platform"."platform_portal_domain"
  ADD CONSTRAINT "ck_platform_portal_domain_host_normalized"
  CHECK ("host" = lower("host") AND "host" !~ '[:/ ]' AND "host" NOT LIKE '%.');

ALTER TABLE "platform"."platform_portal_domain"
  ADD CONSTRAINT "ck_platform_portal_domain_kind"
  CHECK ("kind" IN ('PUBLIC', 'APP', 'AUTH'));

ALTER TABLE "platform"."platform_portal_domain"
  ADD CONSTRAINT "ck_platform_portal_domain_status"
  CHECK ("status" IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'));

-- ---------------------------------------------------------------------------
-- Tautan silang antar portal
-- ---------------------------------------------------------------------------
--
-- §118 menuntut setiap portal menautkan portal lainnya dua arah. Disimpan
-- sebagai data, bukan daftar tetap di kode: portal yang ditambahkan kelak harus
-- muncul pada footer keempat portal lama tanpa menyentuh kode mereka.

CREATE TABLE "platform"."platform_portal_cross_link" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "portal_id"   UUID           NOT NULL,
  "target_id"   UUID           NOT NULL,
  "label"       VARCHAR(120)   NOT NULL,
  "description" VARCHAR(240),
  "sort_order"  INTEGER        NOT NULL DEFAULT 0,
  "is_active"   BOOLEAN        NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "platform_portal_cross_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_portal_cross_link_pair_key"
  ON "platform"."platform_portal_cross_link" ("portal_id", "target_id");

ALTER TABLE "platform"."platform_portal_cross_link"
  ADD CONSTRAINT "platform_portal_cross_link_portal_id_fkey"
  FOREIGN KEY ("portal_id") REFERENCES "platform"."platform_portal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."platform_portal_cross_link"
  ADD CONSTRAINT "platform_portal_cross_link_target_id_fkey"
  FOREIGN KEY ("target_id") REFERENCES "platform"."platform_portal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Portal tidak menautkan dirinya sendiri.
ALTER TABLE "platform"."platform_portal_cross_link"
  ADD CONSTRAINT "ck_platform_portal_cross_link_not_self"
  CHECK ("portal_id" <> "target_id");
