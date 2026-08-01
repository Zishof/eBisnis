# E13-0 · Schema dan Module Registry

Dokumen paling menentukan pada audit ini. V13 §185 menuntut bentuk yang **tidak dapat
ditampung** struktur sekarang, dan perubahannya menyentuh kunci tabel yang sudah
dipakai setiap tenant yang berjalan.

---

## 1. Yang diminta V13

```text
{tenantUsername}_core
{tenantUsername}_ecampus
{tenantUsername}_eschool
{tenantUsername}_epesantren
```

Satu tenant, banyak schema. Tenant dapat mengaktifkan satu, dua, atau tiga vertical.

## 2. Yang ada sekarang

`apps/api/prisma/platform/tenancy.prisma:148`

```prisma
model TenantSchemaRegistry {
  id              String  @id @default(uuid()) @db.Uuid
  tenantId        String  @unique @map("tenant_id") @db.Uuid   // ← satu baris per tenant
  username        String  @db.VarChar(64)
  schemaName      String  @map("schema_name") @db.VarChar(64)
  auditSchemaName String  @map("audit_schema_name") @db.VarChar(72)
  schemaVersion   String  @default("V000") @map("schema_version")
  status          TenantSchemaStatus @default(RESERVED)
  ...
  @@unique([schemaName])
  @@unique([auditSchemaName])
  @@unique([username])
}
```

Tiga kendala sekaligus:

1. `tenantId @unique` — satu tenant hanya boleh satu schema.
2. `username @unique` pada tabel yang sama — username terikat ke baris schema, bukan
   ke tenant.
3. `schemaVersion` tunggal — versi migration tercatat per tenant, bukan per modul.

Migration per modul **sudah** ada (`migration-catalog.ts`, folder `cooperative/`),
tetapi seluruhnya diterapkan ke **satu** schema tenant. Yang belum ada adalah schema
terpisah per modul.

---

## 3. Pilihan yang tersedia

### Pilihan A — Satu schema per tenant, modul sebagai prefix tabel

Tidak mengubah registry. Tabel pendidikan diberi awalan (`ecampus_student`, …).

- **Untung:** tanpa migrasi struktural; paling cepat.
- **Rugi:** melanggar V13 §185 secara langsung. Isolasi antarvertical hanya konvensi
  penamaan — satu query yang lupa memfilter dapat membaca lintas vertical. BRD §226
  menyebut "cross-vertical data bocor" sebagai risiko yang dimitigasi lewat **schema
  isolation**; pilihan ini menghapus mitigasinya.
- **Putusan:** ditolak.

### Pilihan B — Baris registry per (tenant, modul)  ← **disarankan**

`TenantSchemaRegistry` berubah kuncinya:

```text
@@unique([tenantId, moduleCode])     menggantikan   tenantId @unique
```

dan `username` dipindah ke `Tenant`, tempat semestinya — username adalah milik tenant,
bukan milik schema.

Ditambah `TenantVerticalModule` sebagaimana BRD §214:

```text
TenantVerticalModule(tenant_id, module_code, status, schema_name, version)
TenantModuleMigration(tenant_module_id, migration_id, checksum, applied_at)
```

- **Untung:** sesuai V13; isolasi ditegakkan PostgreSQL, bukan konvensi; versi migration
  per modul menjadi wajar.
- **Rugi:** mengubah kunci tabel yang sudah terpakai; perlu migration data untuk tenant
  yang ada; resolver schema harus tahu modul mana yang dituju.
- **Migrasi tenant lama:** setiap baris yang ada menjadi `module_code = 'core'`.
  Additive dan reversibel — tidak ada data yang hilang.

### Pilihan C — Satu database per vertical

- **Rugi:** menghapus kemungkinan join lintas domain yang sah, menggandakan biaya
  operasi, dan tidak diminta BRD.
- **Putusan:** ditolak.

---

## 4. Batas panjang nama

`apps/api/src/infrastructure/database/schema-name.util.ts:7`

```ts
export const SCHEMA_NAME_REGEX = /^[a-z][a-z0-9_]{2,47}$/;   // 3–48 karakter
```

`quoteIdentifier` (baris 171) menerima sampai 72 karakter. Kolom: `schemaName`
VarChar(64), `auditSchemaName` VarChar(72).

Perhitungan terburuk V13:

```text
username (maks?)  +  "_epesantren" (11)  +  "__audit" (7)
```

Batas PostgreSQL untuk identifier adalah **63 byte**. Supaya nama audit vertical
terpanjang tetap muat:

```text
username_maks = 63 - 11 - 7 = 45
```

V13 §185.2 menetapkan username 3–30 karakter — jauh di bawah batas itu, dan itu aman.

**Yang belum ada:** batas 30 karakter untuk username. Yang ada sekarang hanya batas 48
untuk nama schema akhir. Username 40 karakter lolos hari ini, lalu gagal ketika
vertical ketiga diprovision — kegagalan yang muncul berbulan-bulan sesudah username
dikunci, dan username **tidak dapat diubah**.

Tindakan E13-1: batasi username pada titik pembuatannya, bukan pada titik pemakaiannya.

---

## 5. Kode modul canonical

BRD menekankan ejaan, dan alasannya nyata: nama schema salah ketik menjadi permanen.

| Canonical | Ditolak |
| --- | --- |
| `ecampus` | `ekampus`, `e_campus` |
| `eschool` | `escholl`, `eschol`, `e_school` |
| `epesantren` | `epeantren`, `epesantrean`, `e_pesantren` |

Normalisasi tidak boleh "memperbaiki" ejaan salah diam-diam menjadi canonical —
`escholl` harus **ditolak**, bukan diubah menjadi `eschool`. Perbaikan diam-diam
menyembunyikan salah ketik pada dokumen kontrak.

Daftar reserved (`RESERVED_SCHEMA_NAMES`) perlu ditambah tiga kode modul, supaya tidak
ada tenant yang boleh bernama `ecampus` — sebab `ecampus_ecampus` boleh, tetapi tenant
bernama `ecampus` membuat schema `ecampus` bertabrakan dengan konvensi.

---

## 6. Resolver schema

Aturan yang sudah berlaku dan **tidak berubah**: nama schema tidak pernah berasal dari
request publik; ia selalu dibaca dari `platform.tenant_schema_registry`.

V13 menambah satu dimensi: resolver kini memerlukan **(tenant, modul)**. Modul berasal
dari rute (`/api/v1/education/campus/**` → `ecampus`), bukan dari header atau body.

`public` tidak pernah menjadi fallback `search_path`. Aturan itu berlaku penuh untuk
schema pendidikan.

---

## 7. Urutan provisioning

State machine V13 §186.2 (14 keadaan) lebih rinci daripada yang ada sekarang. Yang
penting bagi audit ini hanyalah urutannya:

```text
core  →  education_common  →  vertical yang dipilih  →  seed  →  validasi
```

`education_common` tidak dijual terpisah (BRD §185.3) tetapi wajib ada sebelum vertical
mana pun. Menonaktifkan vertical **tidak** boleh menghapus schema-nya — data peserta
didik tetap milik institusi (Rangkuman §11).

---

## 8. Ringkasan tindakan E13-1

| Tindakan | Sifat |
| --- | --- |
| Tambah `moduleCode` pada `TenantSchemaRegistry`, ganti kunci unik | Migration additive + backfill `core` |
| Pindahkan `username` ke `Tenant` | Additive; kolom lama dibiarkan sampai tidak terpakai |
| Tambah `TenantVerticalModule`, `TenantModuleMigration` | Baru |
| Batasi username 3–30 karakter saat dibuat | Validasi baru |
| Tambah `ecampus`/`eschool`/`epesantren` ke reserved | Satu baris |
| Tolak varian salah ketik, jangan diperbaiki diam-diam | Validasi baru |
| Resolver schema menerima (tenant, modul) | Perubahan tanda tangan |

Tidak ada satu pun yang boleh mengubah migration yang sudah diterapkan.
