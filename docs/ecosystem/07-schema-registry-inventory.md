# ECO-0 — Inventaris schema registry

## Yang ada

```
TenantSchemaRegistry
  tenantId         @unique
  username
  schemaName       @unique
  auditSchemaName  @unique
  schemaVersion
  status
  provisionedAt / lastMigratedAt / lastVerifiedAt

TenantSchemaMigrationHistory
```

Migrasi tenant berjalan dari `apps/api/tenant-migrations/` dengan
`manifest.json` sebagai daftar resmi — **bukan penemuan otomatis**. Migrasi
tertinggi pada `main`: **V037**.

## Selisih terhadap §11

§11 menuntut pola `{USERNAME_TENANT}_{NAMA_MODUL}` — **banyak schema per
tenant**, satu per modul (`joniutama_core`, `joniutama_pos`, `joniutama_emedik`).

Yang ada: **satu schema per tenant**, ditegakkan `tenantId @unique` dan
`schemaName @unique`.

| Model §11.1 | Status |
| --- | --- |
| `TenantSchemaRegistry` | ada, bentuk berbeda |
| `TenantModuleSchema` | MISSING |
| `TenantSchemaMigrationHistory` | ada |
| `TenantSchemaProvisioningJob` | MISSING |
| `TenantSchemaHealth` | MISSING |
| `TenantSchemaBackupPolicy`, `RetentionPolicy` | MISSING |
| Data zone §11.2 | MISSING |

## Mengapa ini risiko terbesar audit ini

Pemisahan schema per modul menyentuh:

- `TenantConnectionService` — pemilihan pool dan `search_path`;
- setiap layanan yang menulis SQL dengan `"${schemaName}".tabel` (POS saja
  puluhan tempat);
- pelari migrasi tenant;
- provisioner;
- audit, lewat `auditSchemaName`.

Itu jalur terpanas di seluruh sistem, dan aturan yang berlaku melarang menyunting
migrasi yang sudah applied.

## Bentuk perpindahan yang diusulkan

**Aditif, berdampingan, dan tidak memindahkan apa pun yang sudah ada:**

1. Tambah `TenantModuleSchema` (tenant × modul → schema), diisi untuk seluruh
   tenant yang ada dengan menunjuk schema tunggal mereka sekarang. Tidak ada data
   yang berpindah.
2. Penyelesai schema membaca `TenantModuleSchema` lebih dahulu, jatuh ke
   `TenantSchemaRegistry` bila tidak ada barisnya. Perilaku tenant lama tidak
   berubah sama sekali.
3. Modul **baru** saja yang memperoleh schema sendiri.
4. Pemindahan modul lama ke schema sendiri — bila memang dikehendaki — menjadi
   pekerjaan tersendiri dengan rencana data, bukan efek samping ECO-6.

Dengan begitu §11 terpenuhi untuk modul baru tanpa satu pun migrasi destruktif.
