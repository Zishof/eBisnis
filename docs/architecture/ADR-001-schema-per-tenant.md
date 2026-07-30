# ADR-001 — Isolasi data: satu schema PostgreSQL per pendaftar

- Status: Diterima
- Tanggal: 2026-07-30

## Konteks

eBisnis.id adalah SaaS multi-tenant. Setiap pendaftar adalah badan usaha berbeda
yang datanya tidak boleh pernah bercampur. Pilihan yang dipertimbangkan:

1. **Satu schema bersama + kolom `tenant_id`.** Termurah secara operasional,
   tetapi satu klausa `WHERE` yang terlewat langsung membocorkan data lintas
   tenant, dan kebocoran seperti itu sulit dibuktikan tidak terjadi.
2. **Satu database per tenant.** Isolasi terkuat, tetapi biaya koneksi dan
   migration per tenant menjadi mahal pada ribuan tenant.
3. **Satu schema per tenant dalam satu database.** Isolasi pada level namespace
   PostgreSQL, jumlah koneksi tetap dapat di-pool, dan migration dapat
   diterapkan per schema.

## Keputusan

Memakai **schema-per-tenant** dengan dua bidang terpisah:

- **Control plane** — schema `platform` dan `platform__audit`. Berisi akun
  platform, tenant, registry schema, katalog paket, diskon, billing, pembayaran,
  CMS, dan i18n. Dikelola Prisma dengan `multiSchema`.
- **Data plane** — schema `<tenant>` dan `<tenant>__audit` per pendaftar. Berisi
  seluruh data operasional ERP. Dikelola katalog migration SQL kanonik
  (`apps/api/tenant-migrations/`) yang diterapkan berurutan per schema.

Nama schema **hanya** berasal dari `platform.tenant_schema_registry`. Nama schema
tidak pernah dibaca dari request body, query string, header, atau klaim token.

## Konsekuensi

- `search_path` setiap koneksi tenant disetel eksplisit ke
  `<schema>,pg_catalog`. `public` **tidak pernah** menjadi fallback, sehingga
  tabel yang belum ada gagal keras alih-alih diam-diam menunjuk objek lain.
- Setiap identifier schema divalidasi terhadap
  `/^[a-z][a-z0-9_]{2,47}$/` sebelum dirangkai ke SQL, dan dikutip melalui
  `quoteIdentifier()`. Identifier tidak valid melempar error, bukan di-escape.
- Migration tenant harus idempotent dan berurutan; katalog memiliki checksum
  yang dicatat pada `platform.tenant_schema_migration_history`.
- Verifikasi schema setelah provisioning membandingkan daftar tabel dan jumlah
  trigger audit terhadap katalog; provisioning gagal bila tidak lengkap.

## Rujukan

- [Kamus data lengkap](../database/full-data-dictionary.md)
- [Ikhtisar ERD](../database/entity-relationship-overview.md)
- [ADR-002 — Audit append-only](ADR-002-append-only-audit.md)
