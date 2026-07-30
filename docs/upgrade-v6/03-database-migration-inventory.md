# 03 — Inventaris Database dan Migration

> Fase V6-0, **read-only**. Tidak ada `prisma migrate reset`, `db push`,
> `DROP SCHEMA`, atau `TRUNCATE` yang dijalankan. Seluruh angka berasal dari
> introspeksi database yang sedang berjalan.
>
> Evidence: `evidence/database-inventory.txt`, `evidence/migration-inventory.txt`.

## Server dan database

| Atribut | Nilai |
| --- | --- |
| Server | PostgreSQL 17.2 on x86_64-windows |
| Database | `ebisnis` |
| Port | **5433** (bukan 5432; lihat [ADR-005](../architecture/ADR-005-postgresql-port.md)) |
| User aplikasi | `root` |
| `psql`/`pg_dump` pada PATH | **9.3.5** — tidak kompatibel dengan server 17.2 |
| `pg_dump` yang dipakai | `C:\Program Files\PostgreSQL\17\bin\pg_dump.exe` |

### Backup sebelum V6

| Atribut | Nilai |
| --- | --- |
| Berkas | `C:\opt\eBisnis-backup\ebisnis-before-v6-20260730-193212.dump` |
| Format | custom, gzip |
| Ukuran | 9.668.390 byte |
| TOC entries | 10.786 (10.782 objek terverifikasi via `pg_restore --list`) |
| Lokasi | **di luar working copy**, tidak akan masuk SVN |

Percobaan awal memakai `pg_dump` 9.3.5 dari PATH gagal dengan
`authentication method 10 not supported`; backup baru berhasil setelah memakai
binary PostgreSQL 17. Ini dicatat karena runbook V6 harus menyebut path binary
yang benar, bukan mengandalkan PATH.

## Schema pada database

Total **23 schema**, **1.357 tabel**.

| Kelompok | Jumlah schema | Tabel per schema |
| --- | --- | --- |
| Control plane (`platform`) | 1 | 131 |
| Audit control plane (`platform__audit`) | 1 | 6 |
| Tenant data | 10 | 115 |
| Tenant audit | 10 | 7 |
| `public` | 1 | 0 (kosong, bukan fallback) |

`public` sengaja kosong: `search_path` setiap koneksi tenant disetel
`<schema>,pg_catalog` tanpa `public` sebagai fallback.

## Registry tenant

| Schema | Versi registry | Status | Provisioned |
| --- | --- | --- | --- |
| `demo` | V009 | READY | 2026-07-30T06:19:59 |
| `joni_utama_2v20v8` | V009 | READY | 2026-07-30T10:01:34 |
| `joni_utama_s941u8` | V009 | READY | 2026-07-30T10:47:21 |
| `joni_utama_ur87v1` | V009 | READY | 2026-07-30T11:03:44 |
| `cek_seed_6222` | V008 | READY | 2026-07-30T07:42:04 |
| `joni_utama_0bbi1e` | V008 | READY | 2026-07-30T07:48:28 |
| `joni_utama_4i087s` | V008 | READY | 2026-07-30T07:33:54 |
| `joni_utama_ndi47r` | V008 | READY | 2026-07-30T07:41:26 |
| `joni_utama_vemvqq` | **V000** | **FAILED** | — |
| `joni_utama_x2lvgd` | **V000** | **FAILED** | — |

Kecuali `demo`, seluruh schema di atas adalah **artefak uji** dari `smoke-test.mjs`
yang membuat tenant baru pada setiap eksekusi.

### Temuan V6-0-F01 — registry tidak konsisten dengan migration yang benar-benar diterapkan

| Schema | `registry.schema_version` | Versi tertinggi SUCCEEDED pada history | Jumlah tabel fisik |
| --- | --- | --- | --- |
| `joni_utama_vemvqq` | V000 | **V008** | 115 |
| `joni_utama_x2lvgd` | V000 | **V008** | 115 |

Penyebab: provisioning gagal pada tahap **setelah** migration selesai:

| Waktu | Tahap gagal | Pesan |
| --- | --- | --- |
| 2026-07-30T06:13:11 | `SEEDING` | `column "code" does not exist` |
| 2026-07-30T07:25:02 | `CREATING_OWNER` | `could not determine data type of parameter $1` |
| 2026-07-30T07:29:03 | `CREATING_OWNER` | `could not determine data type of parameter $1` |

Kedua bug penyebabnya **sudah diperbaiki** (kolom `product_supplier.code`
ditambahkan pada V003; insert `role_scope` diperbaiki). Yang tertinggal adalah
baris registry dan schema fisiknya.

**Risiko untuk V6:** orkestrator migration tenant V6 yang membaca
`registry.schema_version` akan menyimpulkan kedua schema perlu V001–V009,
padahal V001–V008 sudah diterapkan. Menjalankan ulang V001 pada schema tersebut
berpotensi gagal (objek sudah ada) dan menghentikan batch.

**Tindakan yang direkomendasikan (fase V6-0.x, bukan sekarang):** orkestrator
harus menghitung versi efektif sebagai
`MAX(migration_version WHERE status='SUCCEEDED')` dari
`tenant_schema_migration_history`, bukan mempercayai `registry.schema_version`;
dan menyediakan perintah rekonsiliasi registry. Keputusan menghapus kedua schema
uji **diserahkan kepada pemilik**, karena penghapusan schema tidak dapat dibatalkan.

## Riwayat migration tenant

| Metrik | Nilai |
| --- | --- |
| Baris `tenant_schema_migration_history` | 84 |
| Berstatus `SUCCEEDED` | **84** |
| Berstatus lain | **0** |
| Katalog `schema_migration_catalog` | 9 (V001–V009), semuanya `is_active=true` |

Katalog migration tenant beserta checksum:

| Versi | Berkas | Peran |
| --- | --- | --- |
| V001 | `V001__tenant_core.sql` | bookkeeping lokal, app_setting, number_sequence, file_object, idempotency |
| V002 | `V002__organization_access.sql` | organisasi, user_subject, role, menu, permission, party |
| V003 | `V003__catalog_crm.sql` | uom, pajak, produk, supplier, customer, price book |
| V004 | `V004__inventory.sql` | gudang, lot, stock_movement (ledger), stock_balance (proyeksi) |
| V005 | `V005__purchasing_transfer.sql` | request_order, PO, penerimaan, backorder, transfer |
| V006 | `V006__sales_pos_finance_hr.sql` | POS, sales, COA, jurnal, employee, BOM |
| V007 | `V007__workflow_reporting.sql` | **workflow baseline**, notifikasi, sync, job |
| V008 | `V008__audit_triggers.sql` | schema audit + trigger DML + immutability guard |
| V009 | `V009__reference_check_indexes.sql` | 23 index penopang reference check sebelum purge |

### Aturan immutability yang berlaku untuk V6

Kesembilan berkas di atas **sudah diterapkan** pada 10 schema. Karena itu:

- tidak boleh diedit;
- tidak boleh diganti nama;
- tidak boleh dihapus;
- migration V6 dimulai dari **V010**.

## Provisioning job

| Status | Jumlah |
| --- | --- |
| SUCCEEDED | 8 |
| FAILED | 3 |

## Model Prisma (control plane)

Total **136 model** dan **60 enum** pada 11 berkas schema multi-file.

| Berkas | Model | Enum | Domain |
| --- | --- | --- | --- |
| `enums.prisma` | 0 | 60 | seluruh enum |
| `cms.prisma` | 35 | 0 | website platform, halaman, berita, FAQ, media, SEO |
| `subscription.prisma` | 20 | 0 | produk, paket, versi, harga, tier, add-on, override |
| `tenancy.prisma` | 17 | 0 | tenant, registry schema, registrasi, provisioning, demo |
| `billing.prisma` | 15 | 0 | quote, perangkat POS, subscription, invoice, entitlement |
| `payment.prisma` | 15 | 0 | payment order, callback, channel, rekonsiliasi, H2H |
| `identity.prisma` | 12 | 0 | platform user, role, permission, sesi, refresh token |
| `discount.prisma` | 10 | 0 | program, rule, kondisi, benefit, promo code |
| `audit.prisma` | 6 | 0 | audit event, row change, security event |
| `i18n.prisma` | 6 | 0 | locale, namespace, key, value |
| `schema.prisma` | 0 | 0 | generator + datasource |

Distribusi `@@schema`: 188 pada `platform`, 8 pada `platform__audit`.

Catatan: jumlah tabel fisik pada `platform` adalah 131 sementara model Prisma 136;
selisihnya karena beberapa model memakai `@@schema("platform__audit")` dan satu
tabel `_prisma_migrations` tidak dimodelkan.

## Index dan foreign key

| Metrik | Nilai | Sumber |
| --- | --- | --- |
| Total index | 888 | `docs/database/index-catalog.md` |
| Total foreign key | 367 | idem |
| FK tanpa index penopang | 143 | idem, bagian "Foreign key tanpa index pendukung" |
| FK reference-check yang sudah diindeks | 23 dari 23 | migration V009 |

143 FK sisanya bukan kolom yang di-query oleh reference check, sehingga
sengaja tidak diindeks massal. Dicatat sebagai temuan terbuka, bukan diabaikan.

## Kolom lifecycle

Kontrak kolom master V5 (`is_active`, `is_system`, `is_sample`, `sample_batch_id`,
`deactivated_at/by`, `deleted_at/by`, `delete_reason`, `version`) terpasang dan
terdokumentasi pada `docs/database/table-lifecycle-policy.md` untuk seluruh 258
tabel yang diaudit generator dokumentasi.

Master V6 wajib mengikuti kontrak yang sama (Master Prompt V6 bagian 17).

## Trigger

| Jenis | Jumlah | Keterangan |
| --- | --- | --- |
| Trigger audit DML | terpasang pada seluruh tabel data tenant | menulis ke `<tenant>__audit.audit_row_change` |
| `forbid_ledger_mutation` | `stock_movement` | menolak UPDATE/DELETE |
| `forbid_posted_journal_mutation` | `journal_entry` status POSTED | menolak perubahan |

Ketiganya wajib tetap berlaku untuk tabel V6 yang bersifat ledger
(`referral_commission_ledger`, `capital_account_ledger`, `journal_line`).

## Kebutuhan migration V6 (rencana, belum dibuat)

| Fase | Migration platform | Migration tenant | Catatan |
| --- | --- | --- | --- |
| V6-1 Referral | ya (23 model baru) | tidak | referral hidup di control plane |
| V6-2 Investor | mungkin (vehicle/dokumen) | ya (V010) | ownership ada di schema tenant |
| V6-3 Website/domain | ya (registry domain global) | ya (V011) | mapping domain global, konten per tenant |
| V6-4 Workflow + PR | tidak | ya (V012) | perluas `workflow_*`, tambah `purchase_requisition` |
| V6-5 Accounting | tidak | ya (V013) | books/ledger/event/rule |
| V6-6 Advanced finance | tidak | ya (V014+) | per submodul, satu vertical slice sekali |

Nomor versi di atas adalah rencana; nomor final ditetapkan saat fase berjalan agar
tidak menabrak migration yang sudah diterapkan.
