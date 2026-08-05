-- Binding tipis per tenant. BLOB sebenarnya berada satu kali di platform.
-- override_file_code menunjuk file_object BLOB tenant bila admin mengganti foto.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".product_media_binding (
  product_id UUID PRIMARY KEY REFERENCES "{{TENANT_SCHEMA}}".product(id) ON DELETE CASCADE,
  shared_media_identity_id UUID,
  override_file_code VARCHAR(96),
  alt_text VARCHAR(255),
  match_basis VARCHAR(24),
  is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  CONSTRAINT ck_product_media_binding_basis CHECK (
    match_basis IS NULL OR match_basis IN ('BARCODE', 'NAME', 'CODE')
  ),
  CONSTRAINT ck_product_media_binding_override CHECK (
    (is_manual_override = FALSE) OR (override_file_code IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ix_product_media_binding_shared
  ON "{{TENANT_SCHEMA}}".product_media_binding(shared_media_identity_id);
