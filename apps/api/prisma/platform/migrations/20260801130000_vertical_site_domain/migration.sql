-- Pemetaan host situs publik vertikal ke penyewa (IR-005).
--
-- Menggantikan satu-satunya jalan lain yang tersedia — menerima nama skema
-- dari alamat — yang dilarang karena dapat dicoba nama demi nama oleh siapa
-- pun di internet sampai menemukan skema yang ada.

CREATE TABLE "platform"."vertical_site_domain" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID         NOT NULL,
  "host"         VARCHAR(253) NOT NULL,
  "vertical"     VARCHAR(32)  NOT NULL,
  "status"       VARCHAR(24)  NOT NULL DEFAULT 'PENDING',
  "verified_at"  TIMESTAMPTZ(6),
  "verify_token" VARCHAR(128),
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL,
  "version"      INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT "vertical_site_domain_pkey" PRIMARY KEY ("id")
);

-- Satu host melayani satu penyewa. Tanpa ini, dua baris dapat mengklaim host
-- yang sama dan yang terbaca menjadi bergantung pada urutan — persis jenis
-- ketidakpastian yang tidak boleh ada pada pemetaan keamanan.
CREATE UNIQUE INDEX "vertical_site_domain_host_key"
  ON "platform"."vertical_site_domain" ("host");

-- Satu penyewa punya satu situs per vertikal.
CREATE UNIQUE INDEX "vertical_site_domain_tenant_id_vertical_key"
  ON "platform"."vertical_site_domain" ("tenant_id", "vertical");

CREATE INDEX "vertical_site_domain_status_idx"
  ON "platform"."vertical_site_domain" ("status");

ALTER TABLE "platform"."vertical_site_domain"
  ADD CONSTRAINT "vertical_site_domain_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Host wajib sudah dinormalkan saat disimpan: huruf kecil, tanpa porta, tanpa
-- titik akar. Penyimpanan dan pembacaan yang memakai penormal berbeda
-- menghasilkan baris yang tersimpan tetapi tidak pernah ditemukan — dan
-- gejalanya hanyalah situs yang "tidak bekerja", tanpa galat apa pun.
ALTER TABLE "platform"."vertical_site_domain"
  ADD CONSTRAINT "ck_vertical_site_domain_host_normalized"
  CHECK ("host" = lower("host") AND "host" !~ '[:/ ]' AND "host" NOT LIKE '%.');

-- Host yang belum terbukti dimiliki penyewanya tidak boleh berstatus aktif.
ALTER TABLE "platform"."vertical_site_domain"
  ADD CONSTRAINT "ck_vertical_site_domain_active_needs_verification"
  CHECK ("status" <> 'ACTIVE' OR "verified_at" IS NOT NULL);

ALTER TABLE "platform"."vertical_site_domain"
  ADD CONSTRAINT "ck_vertical_site_domain_status"
  CHECK ("status" IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'));
