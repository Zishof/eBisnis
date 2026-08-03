-- =========================================================================
-- ePesantren -- Backfill alamat website unit pendidikan yang sudah ada
-- =========================================================================
--
-- Migrasi 20260803T080000 menambah kolom domain/slug, sedangkan service
-- sekarang mengisi default untuk unit baru. Baris lama tetap kosong kalau
-- seed tidak dijalankan ulang; akibatnya kartu "Unit Pendidikan" tampil tanpa
-- target klik. Migrasi ini mengisi slug/subdomain aman dari nama/kode unit dan
-- mendaftarkan host santri.info ke control plane.

WITH kandidat AS (
  SELECT
    id,
    CASE
      WHEN code ILIKE 'MI%' OR lower(name) LIKE '%ibtidaiyah%' THEN 'mi'
      WHEN code ILIKE 'MD%' OR lower(name) LIKE '%diniyah%' THEN 'md'
      WHEN code ILIKE 'BLK%' OR lower(name) LIKE '%balai latihan kerja%' OR lower(name) LIKE '%blk%' THEN 'blk'
      ELSE NULL
    END AS prefix,
    regexp_replace(
      regexp_replace(
        lower(name),
        '(madrasah|ibtidaiyah|diniyah|takmiliyah|balai latihan kerja|komunitas|blk)',
        ' ',
        'g'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    ) AS tail,
    row_number() OVER (ORDER BY sort_order ASC, name ASC, id ASC) AS urut_global
  FROM "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan
  WHERE deleted_at IS NULL
),
slug AS (
  SELECT
    id,
    left(
      trim(
        both '-' FROM
        CASE
          WHEN prefix IS NULL THEN tail
          ELSE prefix || '-' || tail
        END
      ),
      63
    ) AS slug_awal,
    urut_global
  FROM kandidat
),
unik AS (
  SELECT
    id,
    CASE
      WHEN slug_awal = '' THEN 'unit-' || urut_global::text
      WHEN count(*) OVER (PARTITION BY slug_awal) = 1 THEN slug_awal
      ELSE left(slug_awal, 58) || '-' || row_number() OVER (PARTITION BY slug_awal ORDER BY urut_global)::text
    END AS slug_final
  FROM slug
)
UPDATE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan u
   SET website_enabled = TRUE,
       public_slug = COALESCE(u.public_slug, unik.slug_final),
       santri_subdomain = COALESCE(u.santri_subdomain, unik.slug_final),
       domain_status = CASE
         WHEN COALESCE(u.santri_subdomain, unik.slug_final) IS NOT NULL THEN 'ACTIVE'
         WHEN u.custom_domain IS NOT NULL THEN 'PENDING'
         ELSE u.domain_status
       END,
       updated_at = now(),
       version = version + 1
  FROM unik
 WHERE u.id = unik.id
   AND u.deleted_at IS NULL
   AND (
     u.website_enabled IS DISTINCT FROM TRUE
     OR u.public_slug IS NULL
     OR u.santri_subdomain IS NULL
     OR u.domain_status = 'NONE'
   );

INSERT INTO "platform"."vertical_site_domain"
  (tenant_id, host, vertical, status, verified_at, updated_at)
SELECT
  r.tenant_id,
  lower(u.santri_subdomain) || '.santri.info' AS host,
  'pesantren' AS vertical,
  'ACTIVE' AS status,
  now() AS verified_at,
  now() AS updated_at
FROM "platform"."tenant_schema_registry" r
JOIN "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan u
  ON u.santri_subdomain IS NOT NULL
WHERE r.schema_name = '{{TENANT_SCHEMA}}'
  AND r.status = 'READY'
  AND u.is_active = TRUE
  AND u.deleted_at IS NULL
ON CONFLICT (host) DO UPDATE
   SET tenant_id = EXCLUDED.tenant_id,
       vertical = EXCLUDED.vertical,
       status = EXCLUDED.status,
       verified_at = EXCLUDED.verified_at,
       updated_at = now(),
       version = "platform"."vertical_site_domain".version + 1
 WHERE "platform"."vertical_site_domain".tenant_id = EXCLUDED.tenant_id;

INSERT INTO "platform"."vertical_site_domain"
  (tenant_id, host, vertical, status, verified_at, updated_at)
SELECT
  r.tenant_id,
  lower(u.custom_domain) AS host,
  'pesantren' AS vertical,
  'PENDING' AS status,
  NULL AS verified_at,
  now() AS updated_at
FROM "platform"."tenant_schema_registry" r
JOIN "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan u
  ON u.custom_domain IS NOT NULL
WHERE r.schema_name = '{{TENANT_SCHEMA}}'
  AND r.status = 'READY'
  AND u.is_active = TRUE
  AND u.deleted_at IS NULL
ON CONFLICT (host) DO UPDATE
   SET tenant_id = EXCLUDED.tenant_id,
       vertical = EXCLUDED.vertical,
       status = EXCLUDED.status,
       verified_at = EXCLUDED.verified_at,
       updated_at = now(),
       version = "platform"."vertical_site_domain".version + 1
 WHERE "platform"."vertical_site_domain".tenant_id = EXCLUDED.tenant_id;
