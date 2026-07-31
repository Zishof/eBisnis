# K-0 · Keadaan Saat Ini

**Worktree:** `C:\opt\eBisnisGithub-ekoperasi`
**Branch:** `feature/v12-ekoperasi`
**Titik tolak:** `origin/main` @ `4f7ab88`
**Tanggal audit:** 31 Juli 2026

---

## Ringkasan satu paragraf

**Tidak ada satu pun kode koperasi di dalam repositori.** Kata "koperasi" hanya
muncul pada naskah pemasaran — halaman proposal, draf PKS, dan seed CMS
menyebutnya sebagai pasar sasaran, bukan sebagai modul. Tidak ada
`modules/cooperative/`, tidak ada `verticals/cooperative/`, tidak ada tabel
`member`, `saving`, maupun `loan`.

Yang **sudah ada dan berharga** adalah fondasi bersamanya: 153 tabel tenant pada
23 migrasi, mesin peristiwa akuntansi, mesin alur persetujuan, hub notifikasi,
tata kelola peran dengan pemisahan wewenang, jejak audit hanya-bertambah, dan —
sejak sesi Core mengerjakannya — mesin POS.

Dua temuan struktural di bawah menentukan bentuk seluruh pekerjaan K-1 sampai
K-11, dan keduanya menuntut keputusan sesi Core sebelum kode koperasi pertama
ditulis.

---

## Temuan struktural

### 1. Katalog migrasi masih tunggal dan bernomor urut — tiga vertikal akan bertabrakan

`apps/api/src/infrastructure/provisioning/tenant-migration.service.ts` membaca
**satu** `manifest.json`:

```ts
const manifestPath = join(this.migrationsDir, 'manifest.json');
this.manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
```

Berkas itu berisi 23 entri bernomor `V001` sampai `V023`, masing-masing dengan
`sequence` berupa bilangan bulat berurutan.

Panduan koordinasi §7 menghendaki penamaan `<timestamp>__cooperative__<deskripsi>`
dan pendaftaran pada `TenantModuleMigrationCatalog`. **Keduanya belum ada.**

Akibatnya bila diabaikan: eMedik, eKoperasi, dan info-desa sama-sama menambahkan
`V024`, `V025`, `V026` pada berkas yang sama. Setiap penggabungan menghasilkan
konflik, dan yang lebih berbahaya — dua migrasi berbeda dapat memakai nomor yang
sama, sehingga penyewa yang sudah menerapkan `V024` versi eMedik akan melewati
`V024` versi koperasi tanpa ada yang menyadarinya.

→ **Integration request [001](../integration-requests/cooperative/001-katalog-migrasi-modular.md).**
Sampai diputuskan, migrasi koperasi ditulis di
`apps/api/tenant-migrations/cooperative/` dengan nama bertimestamp dan
**belum didaftarkan** pada manifest global.

### 2. Port bersama yang disebut perintah belum ada

Perintah eKoperasi §7 menyebut sembilan port: `PosPort`, `InventoryPort`,
`AccountingEventPort`, `PaymentPort`, `NotificationPort`, `IdentityPort`,
`FileStoragePort`, `AiGatewayPort`, `AuditPort`.

Pencarian `Port` pada `apps/api/src/common` dan `apps/api/src/infrastructure`
tidak menghasilkan apa pun. Tidak ada satu pun dari sembilan itu.

**Ini tidak menghalangi.** Port yang benar didefinisikan oleh **pemakainya**,
bukan oleh penyedianya — itulah yang membuatnya port dan bukan sekadar
antarmuka. Modul koperasi akan mendefinisikan sendiri antarmuka yang
dibutuhkannya di `modules/cooperative/ports/`, lalu menyediakan adapter tipis
yang memenuhinya dengan layanan Core yang sudah ada. Core tidak perlu diubah
sama sekali.

Bila kelak eMedik dan info-desa membutuhkan port yang sama, sesi Core dapat
mengangkatnya menjadi milik bersama. Mengangkat antarmuka yang sudah terbukti
dipakai dua vertikal jauh lebih aman daripada merancangnya di muka untuk
pemakai yang belum ada.

### 3. `modules/health/` sudah terpakai oleh pemeriksaan kesehatan platform

Panduan koordinasi §4 memberikan `apps/api/src/modules/health/**` kepada sesi
eMedik. Direktori itu **sudah ada** dan berisi `health.module.ts` — endpoint
`/health` untuk pemantauan ketersediaan layanan, bukan modul kesehatan.

Bukan urusan koperasi, tetapi dicatat di sini karena audit ini yang
menemukannya, dan sesi eMedik akan menabraknya pada langkah pertamanya.

→ Disampaikan pada [008-integration-requests.md](08-integration-requests.md).

---

## Yang sudah ada dan dapat dipakai koperasi

### Basis data — 153 tabel pada 23 migrasi

| Kelompok | Tabel yang relevan bagi koperasi |
|---|---|
| Organisasi | `legal_entity`, `business_group`, `brand`, `outlet`, `region`, `address`, `department`, `job_position` |
| Identitas | `user_subject`, `role`, `permission_action`, `menu`, `user_role_assignment`, `user_direct_permission` |
| **Pihak** | `party`, `owner_profile`, `investor_profile`, `ownership_interest` |
| Tata kelola | `role_data_scope`, `segregation_of_duty_rule`, `user_scope_assignment` |
| Katalog | `product`, `product_category`, `uom`, `tax_category`, `tax_rate`, `price_book`, `customer`, `customer_group` |
| Persediaan | `warehouse`, `stock_balance`, `stock_movement`, `stock_reservation` |
| Pengadaan | `request_order`, `purchase_order`, `goods_receipt`, `supplier` |
| **Akuntansi** | `account_type`, `chart_of_account`, `fiscal_period`, `journal_entry`, `journal_entry_line`, `accounting_event`, `accounting_posting_rule` |
| POS | `pos_terminal`, `pos_shift`, `pos_sale`, `pos_sale_line`, `pos_payment`, `cash_drawer_movement` |
| **Alur kerja** | `workflow_definition`, `workflow_step`, `workflow_instance`, `workflow_action_log` |
| Notifikasi | `notification_template`, `notification`, `notification_delivery`, `notification_preference` |
| Surat | sepuluh tabel `surat_*` termasuk penomoran anti-kembar |
| Peristiwa | `sync_outbox`, `sync_inbox` |
| SDM | `employee`, `leave_type` |

Yang dicetak tebal adalah yang paling menentukan bagi koperasi: `party`
memungkinkan anggota berbagi identitas dengan pemasok dan pelanggan tanpa
duplikasi; `accounting_event` memungkinkan simpanan dan pinjaman membentuk
jurnal tanpa menulis debit-kredit di controller; `workflow_*` memungkinkan
persetujuan pinjaman memakai mesin yang sama dengan persetujuan pengadaan.

### Modul API — 26 modul

```
accounting  activity   ai        auth       billing    catalog
checkout    cms        fulfillment governance health*   listing
marketing   marketplace master-seed notification observability order
payment     platform-admin pricing public   return     seed-admin
storefront  surat      tenant
```

`health*` adalah pemeriksaan kesehatan platform — lihat temuan 3.

### Kemampuan lintas modul yang dapat dipakai apa adanya

| Kemampuan | Letak | Dipakai koperasi untuk |
|---|---|---|
| Peristiwa akuntansi | `modules/accounting/posting-engine.ts` | Jurnal simpanan, pinjaman, SHU, unit usaha |
| Alur persetujuan | `workflow_*` | Persetujuan pinjaman, restrukturisasi, SHU |
| Hub notifikasi | `modules/notification/` | Tagihan angsuran, undangan RAT, pemberitahuan SHU |
| Tata kelola peran + SoD | `V010`, `V011` | Analis tidak menyetujui pinjamannya sendiri |
| Jejak audit | `V008` pemicu basis data | Setiap perubahan simpanan dan pinjaman |
| Penomoran anti-kembar | tata kelola surat V10-6 | Nomor anggota, nomor pinjaman, nomor RAT |
| Gerbang AI | `modules/ai/` | Ringkasan kesehatan koperasi, draf notulen RAT |
| Kerangka data contoh | `modules/master-seed/` | Data contoh koperasi, golongan `EXAMPLE` |
| Mesin POS | `modules/pos/` (sesi Core) | Unit toko koperasi lewat adapter |
| Langganan dan tagihan | `modules/billing/` | Rp 500.000 per bulan per koperasi |
| CMS dan etalase | `modules/cms/`, `modules/storefront/` | Situs koperasi `<slug>.ekoperasi.id` |

---

## Garis dasar pengujian

Dijalankan pada worktree ini sebelum satu baris kode koperasi ditulis:

| Perintah | Hasil |
|---|---|
| `pnpm install --frozen-lockfile` | berhasil, 8 menit 19 detik |
| `prisma generate` | berhasil |
| `tsc --noEmit` (API) | **bersih** |
| `jest` (API) | **45 suite, 1048 tes lulus** |

Rinciannya pada [07-test-baseline.md](07-test-baseline.md).

---

## Berkas audit K-0

- [01 — Peta domain](01-domain-map.md)
- [02 — Matriks pakai-ulang / perluas / bangun](02-reuse-extend-create-matrix.md)
- [03 — Kontrak integrasi POS](03-pos-integration-contract.md)
- [04 — Kontrak akuntansi](04-accounting-contract.md)
- [05 — Keamanan dan pemisahan wewenang](05-security-and-sod.md)
- [06 — Rencana implementasi](06-implementation-plan.md)
- [07 — Garis dasar pengujian](07-test-baseline.md)
- [08 — Permintaan integrasi](08-integration-requests.md)
