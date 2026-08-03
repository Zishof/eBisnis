-- Mengizinkan satu tenant memiliki lebih dari satu host publik untuk vertikal
-- yang sama. Dibutuhkan ePesantren: satu pondok tetap punya host utama, tetapi
-- setiap unit pendidikan dapat memiliki subdomain `*.santri.info` sendiri.

DROP INDEX IF EXISTS "platform"."vertical_site_domain_tenant_id_vertical_key";

CREATE INDEX IF NOT EXISTS "vertical_site_domain_tenant_id_vertical_idx"
  ON "platform"."vertical_site_domain" ("tenant_id", "vertical");
