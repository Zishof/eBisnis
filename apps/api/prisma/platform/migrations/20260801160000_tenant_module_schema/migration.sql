-- Satu tenant, banyak schema modul (V13 E13-1).
--
-- Enterprise Education menuntut `{username}_education`, `{username}_eschool`,
-- dan seterusnya untuk tenant yang SAMA — sedangkan `tenant_schema_registry`
-- menyimpan satu baris per tenant.
--
-- `tenant_schema_registry` sengaja TIDAK diubah. Menambahkan `module_code` ke
-- sana dan memindahkan keunikan ke (tenant_id, module_code) memaksa relasi
-- Prisma `Tenant.schemaRegistry` menjadi daftar, dan empat belas pemanggil —
-- termasuk pemilihan schema saat login — harus berubah untuk menyaring baris
-- inti. Jalur login adalah tempat terakhir yang pantas disentuh oleh migrasi
-- penamaan schema.
--
-- Schema per modul karena itu hidup di tabelnya sendiri. Hasilnya sama; yang
-- dihindari adalah perubahan pada jalur yang sudah teruji.
--
-- Migrasi ini murni penambahan: tidak ada kolom yang berubah, tidak ada indeks
-- yang dilepas, tidak ada data yang berpindah, dan tidak ada schema yang
-- berganti nama.

-- --------------------------------------------------------------------------
-- 1. tenant_vertical_module: modul non-inti beserta schema-nya (BRD §214)
-- --------------------------------------------------------------------------
--
-- Modul `core` tidak dicatat di sini. Schema intinya sudah ada di
-- `tenant_schema_registry`, dan mencatatnya dua kali membuat dua sumber
-- kebenaran untuk satu nama — keduanya dapat berbeda, dan yang terbaca
-- bergantung pada siapa yang bertanya.

CREATE TABLE "platform"."tenant_vertical_module" (
  "id"                UUID           NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID           NOT NULL,
  "module_code"       VARCHAR(32)    NOT NULL,
  "status"            VARCHAR(24)    NOT NULL DEFAULT 'DRAFT',
  "schema_name"       VARCHAR(64)    NOT NULL,
  "audit_schema_name" VARCHAR(72)    NOT NULL,
  "schema_version"    VARCHAR(16)    NOT NULL DEFAULT 'V000',
  "package_code"      VARCHAR(48),
  "activated_at"      TIMESTAMPTZ(6),
  "deactivated_at"    TIMESTAMPTZ(6),
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL,
  "version"           INTEGER        NOT NULL DEFAULT 1,
  CONSTRAINT "tenant_vertical_module_pkey" PRIMARY KEY ("id")
);

-- Satu modul sekali per tenant.
CREATE UNIQUE INDEX "tenant_vertical_module_tenant_id_module_code_key"
  ON "platform"."tenant_vertical_module" ("tenant_id", "module_code");

-- Nama schema unik LINTAS tenant, sebagaimana pada registry inti. Dua tenant
-- yang berakhir pada nama schema yang sama akan saling menulis, dan tidak ada
-- galat yang muncul sampai datanya bercampur.
CREATE UNIQUE INDEX "tenant_vertical_module_schema_name_key"
  ON "platform"."tenant_vertical_module" ("schema_name");

CREATE UNIQUE INDEX "tenant_vertical_module_audit_schema_name_key"
  ON "platform"."tenant_vertical_module" ("audit_schema_name");

CREATE INDEX "tenant_vertical_module_status_idx"
  ON "platform"."tenant_vertical_module" ("status");

ALTER TABLE "platform"."tenant_vertical_module"
  ADD CONSTRAINT "tenant_vertical_module_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenant" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- 2. tenant_module_migration: riwayat penerapan per modul (BRD §214)
-- --------------------------------------------------------------------------
--
-- `tenant_schema_registry.schema_version` mencatat satu versi, dan itu cukup
-- selama satu tenant hanya punya satu schema. Dengan banyak modul, riwayatnya
-- perlu tempat sendiri supaya kegagalan pada satu modul tidak menyamarkan
-- keadaan modul lain.
--
-- `checksum` membuat berkas migration yang sudah diterapkan tidak dapat diubah
-- diam-diam: isi yang berubah menghasilkan checksum berbeda dan penerapan
-- berikutnya berhenti, alih-alih menjalankan sesuatu yang berbeda dari yang
-- pernah dijalankan.

CREATE TABLE "platform"."tenant_module_migration" (
  "id"                UUID           NOT NULL DEFAULT gen_random_uuid(),
  "tenant_module_id"  UUID           NOT NULL,
  "migration_id"      VARCHAR(128)   NOT NULL,
  "checksum"          VARCHAR(64)    NOT NULL,
  "status"            VARCHAR(24)    NOT NULL DEFAULT 'PENDING',
  "error_message"     TEXT,
  "applied_at"        TIMESTAMPTZ(6),
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tenant_module_migration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_module_migration_tenant_module_id_migration_id_key"
  ON "platform"."tenant_module_migration" ("tenant_module_id", "migration_id");

CREATE INDEX "tenant_module_migration_status_idx"
  ON "platform"."tenant_module_migration" ("status");

ALTER TABLE "platform"."tenant_module_migration"
  ADD CONSTRAINT "tenant_module_migration_tenant_module_id_fkey"
  FOREIGN KEY ("tenant_module_id") REFERENCES "platform"."tenant_vertical_module" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
