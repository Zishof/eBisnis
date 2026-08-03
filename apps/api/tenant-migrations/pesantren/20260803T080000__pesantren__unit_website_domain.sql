-- =========================================================================
-- ePesantren -- Pengaturan website/domain per unit pendidikan
-- =========================================================================
--
-- Unit pendidikan (MI, Madin, BLK, dst.) dapat memiliki halaman publik sendiri
-- yang tetap menginduk pada situs pondok, serta disiapkan untuk subdomain
-- `*.santri.info` dan domain kustom sekolah. Semua kolom nullable/aditif
-- kecuali flag dengan default aman; belum ada perubahan resolver control-plane
-- multi-domain di migrasi tenant ini.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan
  ADD COLUMN website_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN public_slug VARCHAR(80),
  ADD COLUMN santri_subdomain VARCHAR(253),
  ADD COLUMN custom_domain VARCHAR(253),
  ADD COLUMN domain_status VARCHAR(24) NOT NULL DEFAULT 'NONE',
  ADD COLUMN welcome_title VARCHAR(180),
  ADD COLUMN welcome_body TEXT;

CREATE UNIQUE INDEX ux_pesantren_unit_pendidikan_public_slug
  ON "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (lower(public_slug))
  WHERE public_slug IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_pesantren_unit_pendidikan_santri_subdomain
  ON "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (lower(santri_subdomain))
  WHERE santri_subdomain IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_pesantren_unit_pendidikan_custom_domain
  ON "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (lower(custom_domain))
  WHERE custom_domain IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan
  ADD CONSTRAINT ck_pesantren_unit_pendidikan_public_slug
  CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$');

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan
  ADD CONSTRAINT ck_pesantren_unit_pendidikan_santri_subdomain
  CHECK (santri_subdomain IS NULL OR santri_subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan
  ADD CONSTRAINT ck_pesantren_unit_pendidikan_custom_domain
  CHECK (
    custom_domain IS NULL OR
    (
      custom_domain = lower(custom_domain) AND
      custom_domain NOT LIKE '%/%' AND
      custom_domain LIKE '%.%' AND
      length(custom_domain) <= 253
    )
  );

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan
  ADD CONSTRAINT ck_pesantren_unit_pendidikan_domain_status
  CHECK (domain_status IN ('NONE', 'PENDING', 'ACTIVE', 'FAILED'));
