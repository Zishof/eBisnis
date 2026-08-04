# H-0 · Keadaan Saat Ini

**Tanggal audit:** 31 Juli 2026
**Worktree:** `C:\opt\eBisnisGithub-emedik`
**Branch:** `feature/v12-emedik`
**Titik tolak:** `main` @ `4f7ab88`

---

## Ringkasan satu paragraf

**Tidak ada satu baris pun kode kesehatan di repositori ini.** Yang ada adalah
fondasi bersama yang matang — 153 tabel tenant, 133 menu, 40 aksi hak akses,
jejak audit yang hanya dapat bertambah, hub notifikasi, gerbang AI, dan
observabilitas terpusat — yang seluruhnya dapat dipakai vertical kesehatan
melalui adapter. Pekerjaan eMedik karena itu adalah **membangun vertical baru di
atas fondasi yang sudah berjalan**, bukan memigrasikan atau menyatukan sistem
yang sudah ada.

Dua temuan menuntut keputusan sebelum H-1 dimulai, dan keduanya sudah menjadi
integration request:

1. **Nama `modules/health` sudah dipakai** oleh pemeriksa kesehatan aplikasi
   (liveness probe), bukan oleh vertical kesehatan.
2. **Mekanisme migrasi modular yang diandaikan panduan koordinasi belum ada.**
   Tidak ada `TenantModuleMigrationCatalog`; yang ada satu `manifest.json`
   dengan nomor urut global — persis bentuk yang paling mudah bentrok ketika
   tiga vertical bekerja paralel.

---

## Temuan 1 — `modules/health` sudah dipakai, tetapi bukan untuk kesehatan

Perintah eMedik §6 menetapkan namespace `apps/api/src/modules/health/**`.
Direktori itu **sudah ada**, berisi satu berkas:

```
apps/api/src/modules/health/health.module.ts
```

Isinya `HealthController` — pemeriksa kesehatan aplikasi dan basis data yang
dipakai pemantauan dan pemeriksa ketersediaan (`liveness`/`readiness`):

```ts
@Public()
@Get('health')
async health() {
  // SELECT 1, hitung tenant READY, laporkan status up/degraded
}
```

### Rutenya sendiri TIDAK bertabrakan

Ini perlu ditegaskan karena mudah disalahpahami. `main.ts` mengecualikan
`health` dari awalan global:

```ts
app.setGlobalPrefix(apiPrefix, {
  exclude: ['health', 'docs', 'api-json'],
});
```

Artinya pemeriksa kesehatan melayani `/health`, **bukan** `/api/v1/health`.
Rute vertical `/api/v1/health/**` karena itu bebas dipakai tanpa menabrak apa
pun.

### Yang bertabrakan adalah nama direktorinya

Menaruh belasan modul rumah sakit ke dalam direktori yang sudah berisi
pemeriksa ketersediaan menghasilkan tiga masalah yang tidak satu pun bersifat
teknis, dan justru karena itu berbahaya:

- Orang yang mencari "kenapa pemeriksa kesehatan gagal" akan membuka direktori
  berisi delapan puluh berkas rekam medis.
- Orang yang mencari modul rawat inap akan menemukan `SELECT 1`.
- CODEOWNERS pada panduan §14 menetapkan `/apps/api/src/modules/health/` milik
  `@health-team`. Menerapkannya apa adanya akan memberikan kepemilikan pemeriksa
  ketersediaan platform — yang jelas milik Core — kepada tim kesehatan.

Usulan dan alasannya ada pada
[integration request 001](../integration-requests/health/001-health-namespace-collision.md).
Sampai Core memutuskan, pekerjaan eMedik memakai `modules/emedik/` sebagai nama
sementara yang tidak menyandera keputusan itu.

---

## Temuan 2 — migrasi modular belum ada

Panduan koordinasi §7 memerintahkan:

```
<timestamp>__health__<description>
register migration pada TenantModuleMigrationCatalog
```

`TenantModuleMigrationCatalog` **tidak ada di repositori ini.** Pencarian
mengembalikan nol berkas.

Yang ada adalah satu berkas katalog tunggal:

```
apps/api/tenant-migrations/manifest.json   → 23 migrasi, V001 … V023
```

dimuat oleh `TenantMigrationService`:

```ts
const manifestPath = join(this.migrationsDir, 'manifest.json');
this.manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
this.manifest.migrations.sort((a, b) => a.sequence - b.sequence);
```

Setiap migrasi memiliki `version` (`V001`) dan `sequence` (angka global).

### Mengapa ini masalah nyata bagi kerja paralel

Tiga vertical yang bekerja bersamaan akan sama-sama menambahkan entri ke
**satu berkas JSON** dengan **nomor urut global**. Akibatnya:

- Setiap penambahan migrasi menyentuh berkas yang sama → konflik gabungan pada
  hampir setiap `rebase`.
- Nomor urut ditentukan manual → dua vertical akan memilih `V024` yang sama, dan
  konfliknya tidak terlihat sebagai konflik teks bila keduanya menambah di baris
  berbeda.
- Panduan §7 sendiri melarangnya: *"jangan memakai nomor urut global manual yang
  mudah bentrok"*. Larangan itu tidak dapat dipatuhi dengan mekanisme yang ada.

Catatan penting untuk perencanaan: **sesi Core sedang menambah V024–V029** untuk
POS Web pada `feature/pos-web-priority`. Nomor-nomor itu sudah terpakai meskipun
belum masuk `main`. eMedik tidak boleh memakainya.

Usulan mekanisme ada pada
[integration request 002](../integration-requests/health/002-modular-migration-catalog.md).
Sampai itu tersedia, eMedik memakai awalan `H` (`H001__health__…`) yang tidak
mungkin bertabrakan dengan `V###` milik Core maupun `K###`/`D###` milik vertical
lain.

---

## Yang sudah ada dan dapat dipakai

### Basis data — 153 tabel tenant pada 23 migrasi

Yang langsung relevan bagi kesehatan:

| Kemampuan | Tabel | Dipakai eMedik untuk |
|---|---|---|
| Organisasi | `legal_entity`, `brand`, `outlet`, `region`, `department`, `job_position` | Fasilitas kesehatan dapat memetakan diri ke struktur ini, atau memerlukan tabel sendiri — lihat [01](01-domain-map.md) |
| Identitas dan hak akses | `user_subject`, `role`, `menu`, `permission_action`, `role_menu_permission`, `user_role_assignment`, `user_scope_assignment` | Seluruh peran klinis; tidak perlu kerangka hak akses kedua |
| Pemisahan wewenang | `segregation_of_duty_rule` beserta pelanggaran dan pengecualiannya | Apoteker tidak menelaah resepnya sendiri; dokter tidak memverifikasi hasilnya sendiri |
| Mitra dagang | `customer`, `party`, `address` | **Tidak dipakai untuk pasien.** Pasien bukan pelanggan — lihat [01](01-domain-map.md) |
| Persediaan | `stock_balance`, `stock_reservation`, `stock_movement`, `inventory_lot`, `product`, `uom` | Stok obat lewat adapter; **bukan** dengan menulis langsung |
| Keuangan | `chart_of_account`, `journal_entry`, `accounting_event`, `accounting_posting_rule` | Tagihan pasien menjadi peristiwa akuntansi lewat adapter |
| Penomoran | `number_sequence` | Nomor rekam medis, nomor kunjungan, nomor resep |
| Dokumen | `file_object`, `entity_attachment` | Hasil laboratorium, gambar radiologi (metadata; berkasnya tidak di basis data) |
| Alur kerja | `workflow_definition`, `workflow_step`, `workflow_instance` | Persetujuan klaim, penelaahan resep |
| Notifikasi | `notification`, `notification_delivery`, `notification_preference`, `notification_template` | Pengingat janji temu, hasil kritis |
| Audit | `audit_event`, `audit_row_change` beserta pemicunya | Wajib bagi data kesehatan; sudah hanya-bertambah dan tidak dapat disunting |
| Surat | 14 tabel tata kelola surat | Surat keterangan sakit, rujukan, surat kematian |
| Pengetahuan AI | `knowledge_chunk` | Basis pengetahuan klinis; **bukan** untuk saran diagnosis |

### Layanan bersama yang akan diadaptasi

| Port yang diminta perintah §8 | Yang sudah ada | Berkas |
|---|---|---|
| `InventoryPort` | Layanan persediaan tenant | `modules/tenant/erp-inventory.service.ts` |
| `AccountingEventPort` | Mesin posting beserta uji kelengkapan kode peristiwa | `modules/accounting/posting-engine.ts` |
| `PaymentPort` | Pembayaran marketplace + eSmartlink | `modules/payment/` |
| `NotificationPort` | Hub notifikasi dengan pengelompokan dan SLA | `modules/notification/` |
| `IdentityPort` | Autentikasi, peran aktif, cakupan data | `modules/auth/` |
| `FileStoragePort` | `file_object`, `entity_attachment` | `V001__tenant_core.sql` |
| `AiGatewayPort` | Gerbang AI dengan kebijakan, bukti, redaksi, kuota | `modules/ai/ai-gateway.service.ts` |
| `AuditPort` | `AuditService` + pemicu basis data | `modules/*/audit`, `V008` |

Kedelapan port itu **belum ada sebagai antarmuka**. Yang ada adalah layanannya
langsung. Membuat port-nya adalah pekerjaan H-1, dan itu memang yang diminta
perintah §8: *"Jangan menyalin engine shared ke modul health."*

### Yang TIDAK ada

| Diandaikan | Kenyataan |
|---|---|
| Sumber SIRS/kesehatan yang sudah ada | Nihil. Tidak ada kode kesehatan apa pun untuk diaudit maupun dimigrasikan |
| `apps/web/src/verticals/` | Direktori tidak ada. Antarmuka web belum bervertikal |
| `packages/` | Direktori tidak ada. Repositori belum memakai paket terpisah meski `pnpm-workspace.yaml` ada |
| `TenantModuleMigrationCatalog` | Tidak ada — lihat Temuan 2 |
| Kerangka Pusat Bantuan | **Tidak ada.** Prasyarat V8-1/V8-2 tidak pernah dibangun; tidak ada tabel bantuan sama sekali |
| Ekspor Excel | **Tidak ada.** Prasyarat V8-5/6 tidak pernah dibangun |
| Job cetak PDF | **Tidak ada.** Prasyarat V8-7 tidak pernah dibangun |

Tiga yang terakhir menjadikan sebagian H-11 (Help, laporan) **terhalang** sejak
awal. Itu disebutkan di sini, bukan ditemukan pada H-11.

---

## Garis dasar

Dijalankan pada worktree ini sebelum satu baris kode kesehatan ditulis. Lihat
[07](07-test-baseline.md) untuk rinciannya.

---

## Berkas rujukan

- [01 — Peta domain dan bounded context](01-domain-map.md)
- [02 — Matriks pakai-ulang / perluas / bangun-baru](02-reuse-extend-create-matrix.md)
- [03 — Peta model data](03-data-model-map.md)
- [04 — Kontrak integrasi](04-integration-contracts.md)
- [05 — Model ancaman keamanan](05-security-threat-model.md)
- [06 — Rencana implementasi](06-implementation-plan.md)
- [07 — Garis dasar pengujian](07-test-baseline.md)
- [08 — Daftar integration request](08-integration-requests.md)
