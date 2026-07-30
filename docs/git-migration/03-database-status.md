# 03 — Status Database Saat Cutover

Migrasi ke Git **tidak menyentuh database sama sekali**. Dokumen ini merekam
kondisinya agar terbukti tidak ada perubahan destruktif.

## Yang tidak dijalankan

```text
prisma migrate reset
prisma db push
DROP DATABASE
DROP SCHEMA ... CASCADE
TRUNCATE
penghapusan schema tenant
perubahan pada migration yang sudah applied
```

Satu-satunya perintah database yang dijalankan pada fase ini bersifat baca:
`prisma validate`, `prisma generate`, `prisma migrate status`, dan smoke test
melalui API.

## Kondisi

| Atribut | Nilai |
| --- | --- |
| Server | PostgreSQL 17.2, port 5433 |
| Database | `ebisnis` |
| Status migration platform | `Database schema is up to date!` (1 migration) |
| Versi katalog migration tenant | V009 |
| Jumlah schema tenant | 9 aktif + `demo` |
| Health check database | `up` |

## Migration yang tidak boleh diubah

Platform:

```text
20260730053842_init_ebisnis_platform
```

Tenant (V001–V009), seluruhnya sudah diterapkan pada 10 schema:

| Versi | Berkas |
| --- | --- |
| V001 | `V001__tenant_core.sql` |
| V002 | `V002__organization_access.sql` |
| V003 | `V003__catalog_crm.sql` |
| V004 | `V004__inventory.sql` |
| V005 | `V005__purchasing_transfer.sql` |
| V006 | `V006__sales_pos_finance_hr.sql` |
| V007 | `V007__workflow_reporting.sql` |
| V008 | `V008__audit_triggers.sql` |
| V009 | `V009__reference_check_indexes.sql` |

Kesepuluh berkas tersebut immutable: tidak boleh diedit, diganti nama, dihapus,
atau di-squash. Migration Versi 6 dan Versi 7 dimulai dari **V010**.

## Backup

`C:\opt\eBisnis-backup\ebisnis-before-v6-20260730-193212.dump`
(format custom, 10.782 objek terverifikasi). Berada di luar kedua workspace dan
tertutup `.gitignore` (`*.dump`), sehingga tidak mungkin ikut ter-commit.

Backup dibuat memakai `C:\Program Files\PostgreSQL\17\bin\pg_dump.exe`.
`pg_dump` pada PATH adalah versi 9.3.5 dan gagal dengan
`authentication method 10 not supported` — runbook wajib menyebut path binary
yang benar, bukan mengandalkan PATH.

## Temuan terbuka yang dibawa ke fase berikutnya

Dua schema artefak uji (`joni_utama_vemvqq`, `joni_utama_x2lvgd`) tercatat
`V000/FAILED` pada `tenant_schema_registry`, padahal keduanya benar-benar sudah
menerapkan V008 dan memiliki 115 tabel. Orkestrator migration berikutnya harus
menghitung versi efektif dari `MAX(migration_version WHERE status='SUCCEEDED')`
pada `tenant_schema_migration_history`, bukan mempercayai kolom registry.

Rincian: `docs/upgrade-v6/03-database-migration-inventory.md`.
