# 01 — Status Regression Contract Versi 5

> Fase V6-0. Versi 5 adalah **regression contract**: tidak boleh diturunkan oleh
> perubahan V6 apa pun.
>
> Kriteria `DONE` (prompt upgrade bagian 2): model + migration + service/business
> rule + API + permission + tenant isolation + UI (bila perlu) + audit + test
> relevan lulus + dapat diuji di localhost. Adanya file atau class **tidak cukup**.

## Rekapitulasi

| Status | Jumlah area |
| --- | --- |
| DONE | 15 |
| PARTIAL | 9 |
| MISSING | 1 |
| BROKEN | 1 |
| **Total** | **26** |

## Matriks

| # | Area V5 | Status | Evidence | Risiko | Tindakan | Fase | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Monorepo dan build | DONE | `pnpm build` OK; `evidence/baseline-02-lint-test-build.txt` | — | pertahankan | — | `pnpm build` |
| 2 | Platform schema | DONE | 136 model, 131 tabel `platform`; migration `20260730053842_init_ebisnis_platform` | — | migration V6 additive | V6-1+ | `pnpm db:validate` |
| 3 | Tenant dynamic schema | DONE | 10 schema × 115 tabel; `tenant-connection.service.ts:120` pooled, `search_path` tanpa `public` | — | pertahankan | — | smoke §18 isolasi lintas tenant |
| 4 | Tenant schema migration | PARTIAL | 84 history `SUCCEEDED`; **2 schema registry V000 tetapi terapkan V008** | orkestrator V6 salah menyimpulkan versi | hitung versi dari history, sediakan rekonsiliasi | V6-0.x | test rekonsiliasi registry |
| 5 | Audit schema/trigger | DONE | `V008__audit_triggers.sql`; 4.140 baris `demo__audit.audit_row_change`; guard `forbid_ledger_mutation` | — | tabel ledger V6 wajib guard sama | V6-1+ | smoke §15 ledger immutable |
| 6 | Demo sandbox | DONE | schema `demo` V009; subject `DEMO` role `DEMO_USER` 438 permission; 21 menu root | — | pertahankan | — | e2e `auth-and-erp.spec.ts:59-97` |
| 7 | Registration/provisioning | DONE | state machine 9 tahap `schema-provisioner.service.ts`; 8 job SUCCEEDED | — | tambah `referralCode` pada payload | V6-1 | smoke §1-4 |
| 8 | Login/JWT/refresh | DONE | rotasi + deteksi reuse `auth.service.ts`; token strategy ADR-006 | — | pertahankan | — | smoke §5; e2e `auth-and-erp.spec.ts:35-57` |
| 9 | Super admin | PARTIAL | akun `admin` ada, forced password change **bekerja**; portal `/platform` belum pernah dibuka via UI | UI platform belum terbukti manual | ganti kata sandi admin lalu verifikasi 6 halaman | V6-0.x | smoke §19; belum ada e2e platform |
| 10 | Role/menu/permission | PARTIAL | 73 menu, 22 aksi, 6 role template; **34 endpoint tanpa dekorator permission** | lihat temuan V6-0-F03 | guard permission dinamis per resource | V6-0.x | test negatif per aksi |
| 11 | Master lifecycle | **BROKEN** | lifecycle 4 tingkat bekerja, tetapi **purge tidak memverifikasi permission HARD_DELETE** | eskalasi hak akses | lihat temuan V6-0-F03 | V6-0.x | test: user tanpa HARD_DELETE gagal purge |
| 12 | Minimal 10 sample data | DONE | `seed:verify` LULUS platform 25/25, demo 22/22; 22 resource tenant | — | master V6 ikut aturan | V6-1+ | `pnpm seed:verify` |
| 13 | Public CMS eBisnis | DONE | 35 model CMS; homepage dari `hero_slide`+`cms_block`; diverifikasi ubah DB → tampil tanpa rebuild | — | CMS tenant terpisah | V6-3 | e2e `public-website.spec.ts` |
| 14 | Tenant onboarding | PARTIAL | seed organisasi + menu + role otomatis saat provisioning; **wizard onboarding UI belum ada** | pemilik baru tidak dituntun | buat wizard | V6-0.x | belum ada |
| 15 | Package/module pricing | DONE | 4 paket, 20 modul, 20 fitur, tier; waterfall 15 langkah `pricing-engine.service.ts` | — | pertahankan | — | smoke §16; `discount-evaluator.service.spec.ts` |
| 16 | Discount/promo | DONE | whitelist field+operator; 2 program; stacking EXCLUSIVE/BEST_PRICE/STACKABLE | — | basis komisi referral memakai hasilnya | V6-1 | 68 unit test |
| 17 | Device subscription | DONE | perangkat POS, quote, invoice, entitlement; UI 3 tab | — | pertahankan | — | smoke §16 |
| 18 | Esmartlink order/callback/inquiry | PARTIAL | adapter + parser + 3 dok karakterisasi; **provider `ESMARTLINK_ENABLED=false`, belum pernah dites terhadap sandbox nyata** | perilaku nyata belum terbukti | uji sandbox bila kredensial tersedia | V6-0.x | smoke §16 (jalur gagal terkendali) |
| 19 | Catalog/product | DONE | 23 resource master via `MasterListPage`; produk, UOM, pajak, harga | — | pertahankan | — | e2e `auth-and-erp.spec.ts:124` |
| 20 | Purchasing/inventory | DONE | RO→PO→receipt→backorder→transfer→stock tree; 31 tabel punya service | — | PR ditambahkan terpisah | V6-4 | smoke §8-15 |
| 21 | Accounting core | PARTIAL | tabel ada (`chart_of_account`, `journal_entry`, `journal_entry_line`, `fiscal_period`, `account_type`) + guard immutability; **tidak ada service, API, atau UI** | fondasi V6-5 bertumpu pada ini | bangun accounting event engine | V6-5 | belum ada |
| 22 | HR/payroll | PARTIAL | tabel `employee`, `leave_type`, `department`, `job_position` ada + master CRUD; **tidak ada payroll run/service** | — | vertical slice terpisah | pasca V6-5 | belum ada |
| 23 | Investor basic | PARTIAL | tabel `owner_profile`, `investor_profile`, `ownership_interest`, `party` ada; **tidak ada service/API/UI** | fondasi V6-2 | perluas jadi multi-investor | V6-2 | belum ada |
| 24 | Workflow baseline | PARTIAL | tabel `workflow_definition`, `workflow_step`, `workflow_instance`, `workflow_action_log` ada (V007); **tidak ada service/API/UI** | fondasi V6-4 | perluas, jangan duplikasi | V6-4 | belum ada |
| 25 | OpenAPI/Orval | PARTIAL | OpenAPI **hidup** (157 operasi via `/docs-yaml`); `orval.config.ts` ada; **client belum pernah digenerate** (`src/api/generated` tidak ada, `docs/api/openapi.json` tidak ada) | kontrak API tidak terikat tipe di frontend | ekspor OpenAPI ke berkas lalu `pnpm api:generate` | V6-0.x | build web setelah generate |
| 26 | Unit/integration/E2E | PARTIAL | 83 unit + 56 e2e + 124 smoke lulus; **tidak ada integration test bertransaksi DB**, coverage backend hanya 3 spec dari 67 file | regresi tidak terdeteksi lint/unit | tambah integration test per fase | V6-1+ | — |

## Temuan yang memerlukan tindakan

### V6-0-F03 — Master CRUD dan purge tidak memverifikasi permission

**Severity: TINGGI (eskalasi hak akses). Status: CONFIRMED lewat kode.**

`PermissionGuard` keluar lebih awal ketika sebuah handler tidak memiliki metadata
`@Permissions`, `@PlatformPermissions`, maupun `@RequireStepUp`:

```text
apps/api/src/modules/auth/guards/permission.guard.ts:40-42
  if (!platformPermissions?.length && !tenantPermissions?.length && !stepUpPurpose) {
    return true;
  }
```

Seluruh 13 endpoint master pada `MasterController` tidak memiliki `@Permissions`:

| Endpoint | Baris | Dekorator yang ada |
| --- | --- | --- |
| `GET /:resource` | `tenant.module.ts:442` | — |
| `GET /:resource/:id` | `tenant.module.ts:453` | — |
| `POST /:resource` | `tenant.module.ts:464` | `@BlockDemo` |
| `PATCH /:resource/:id` | `tenant.module.ts:477` | `@BlockDemo` |
| `DELETE /:resource/:id` | `tenant.module.ts:518` | `@BlockDemo` |
| `POST /:resource/:id/deactivate` | `tenant.module.ts:491` | `@BlockDemo` |
| `POST /:resource/:id/activate` | `tenant.module.ts:505` | `@BlockDemo` |
| `POST /:resource/:id/restore` | `tenant.module.ts:531` | `@BlockDemo` |
| `POST /:resource/:id/purge` | `tenant.module.ts:555` | `@BlockDemo`, `@RequireStepUp('HARD_DELETE')` |

Untuk `purge`, `@RequireStepUp('HARD_DELETE')` hanya membuktikan pengguna
memasukkan ulang kata sandinya sendiri; itu **autentikasi**, bukan **otorisasi**.
Dokumentasi endpoint dan komentar service justru menyatakan sebaliknya:

```text
tenant.module.ts:561  'Memerlukan permission HARD_DELETE, step-up authentication, ...'
master-lifecycle.service.ts:516  'Guard permission HARD_DELETE dan step-up dilakukan pada layer controller.'
```

Padahal controller hanya melakukan step-up. Akibatnya setiap pengguna tenant yang
terautentikasi dapat membuat, mengubah, menonaktifkan, menghapus, memulihkan, dan
**menghapus permanen** record master pada 24 resource, tanpa memandang role.

Mengapa ini tidak tertangkap smoke test: pengguna uji adalah OWNER yang memang
memiliki seluruh permission, sehingga jalur positif lulus dan jalur negatif tidak
pernah diuji.

Mengapa `@Permissions('...')` statis tidak bisa dipakai: permission bergantung
pada `:resource` yang baru diketahui saat runtime
(`MASTER_RESOURCES[].menuCode` → `<MENU>.<ACTION>`). Perbaikannya adalah guard
yang membaca parameter route, memetakan resource ke `menuCode`, lalu memanggil
`TenantPermissionService.findMissing()` yang **sudah ada**.

Test yang wajib menyertai perbaikan:

```text
user role CASHIER  -> POST /products                    harus 403
user role CASHIER  -> POST /products/:id/purge          harus 403
user role OWNER    -> POST /products/:id/purge + step-up harus 200
user role OWNER tanpa step-up -> purge                  harus 401/403 (sudah bekerja)
```

Fase: **V6-0.x**, dikerjakan sebelum V6-1 karena ini pelanggaran regression
contract V5, bukan fitur baru.

### V6-0-F04 — Orval client belum pernah digenerate

**Severity: MENENGAH.** OpenAPI hidup dan lengkap (157 operasi), tetapi
`apps/web/src/api/generated` tidak ada. Frontend memakai `api.get/post` bertipe
manual, sehingga perubahan kontrak API tidak menghasilkan error kompilasi di web.
Untuk V6 yang menambah puluhan endpoint, ini menaikkan risiko ketidaksesuaian
tipe seperti yang sudah terjadi pada V5 (nama field quote/plan sempat salah).

Tindakan: ekspor `/docs-yaml` menjadi `docs/api/openapi.json`, jalankan
`pnpm api:generate`, lalu pakai client hasil generate untuk endpoint V6 baru.
Endpoint V5 dapat dimigrasikan bertahap agar tidak menjadi refactor massal.

### V6-0-F05 — Tidak ada integration test bertransaksi database

**Severity: MENENGAH.** 68 unit test backend semuanya murni (schema-name util,
discount evaluator, legacy parser). Perilaku yang paling berisiko — posting stok,
validasi penerimaan, alokasi FEFO, transaksi lintas tabel — hanya diuji lewat
smoke test HTTP yang membuat tenant baru setiap kali dijalankan.

Untuk V6 (ledger komisi, capital ledger, jurnal akuntansi) hal ini tidak memadai:
uang memerlukan test yang menegaskan saldo dan idempotensi pada level transaksi.

Tindakan: tambahkan integration test per fase memakai schema tenant sekali pakai,
dengan rollback di akhir; jangan menambah beban ke smoke test.
