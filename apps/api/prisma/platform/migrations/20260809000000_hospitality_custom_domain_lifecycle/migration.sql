-- Additive lifecycle metadata for verified custom hospitality domains.
ALTER TABLE "platform"."vertical_site_domain"
  ADD COLUMN IF NOT EXISTS "domain_kind" VARCHAR(16) NOT NULL DEFAULT 'MANAGED',
  ADD COLUMN IF NOT EXISTS "verification_method" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "verification_token_hash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "verification_record" VARCHAR(320),
  ADD COLUMN IF NOT EXISTS "verification_checked_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "tls_status" VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "tls_provider_reference" VARCHAR(240),
  ADD COLUMN IF NOT EXISTS "certificate_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "last_error" TEXT;

ALTER TABLE "platform"."vertical_site_domain"
  ADD CONSTRAINT "ck_vertical_site_domain_kind"
  CHECK ("domain_kind" IN ('MANAGED','CUSTOM'));

ALTER TABLE "platform"."vertical_site_domain"
  ADD CONSTRAINT "ck_vertical_site_domain_verification_method"
  CHECK ("verification_method" IS NULL OR "verification_method" IN ('DNS_TXT'));

ALTER TABLE "platform"."vertical_site_domain"
  ADD CONSTRAINT "ck_vertical_site_domain_tls_status"
  CHECK ("tls_status" IN ('NOT_REQUIRED','PENDING_VERIFICATION','PENDING_CERTIFICATE','ACTIVE','RENEWAL_DUE','FAILED','REVOKED'));

CREATE INDEX IF NOT EXISTS "vertical_site_domain_tls_status_idx"
  ON "platform"."vertical_site_domain" ("tls_status", "certificate_expires_at");
