# UAT — Layar 22 (Data Hutang Supplier — Permission Bug DIPERBAIKI + Rekonsiliasi Net Outstanding)

**Tenant uji:** `uat_purchase_ap_19222`. **Endpoint:** `GET /inventory/legacy/payables`. **Alur
data:** lihat `screen-20/uat.md` (4 PO/GR, 3 payable aktif + 1 payable "hantu" dari GR yang
di-reverse).

## Skenario & Temuan DIPERBAIKI: endpoint hutang supplier 403 untuk SEMUA role

**GAP nyata ditemukan DAN DIPERBAIKI dalam pass ini**, ditemukan sebelum data uji sempat dibuat:
panggilan pertama ke `GET /inventory/legacy/payables` pada tenant BARU (role `OWNER` bawaan,
wildcard `*` di semua kode menu nyata) mengembalikan **HTTP 403**:
```json
{"success":false,"error":{"code":"PERMISSION_DENIED","message":"Hak akses tidak mencukupi.",
 "params":{"missing":["PURCHASE_ORDER.READ"]}}}
```
Bukti: `api-legacy-payables-403-BEFORE-FIX.json`.

**Akar masalah**: decorator `@Permissions('PURCHASE_ORDER.READ')` pada
`tenant.module.ts:2363` (dan duplikatnya `sales-inventory-operations.controller.ts:1042` untuk
`GET /inventory/supplier-workspace`) memakai kode `PURCHASE_ORDER` yang **tidak pernah terdaftar**
di `MENU_TREE_SEED` (`infrastructure/provisioning/tenant-menu.seed.ts`) — kode menu yang benar
untuk submenu Purchase Order adalah `PURCHASING_PO`, dan kode level-domain (yang dipakai endpoint
kembarannya di sisi Sales/AR) adalah `PURCHASING`. Karena baris `role_menu_permission`/
`user_direct_permission` hanya pernah dibuat untuk kode yang ADA di `MENU_TREE_SEED`
(`role-expansion.ts`), dan bahkan role `OWNER` wildcard `'*'` hanya berlaku atas
`ALL_MENU_CODES = MENU_TREE_SEED.map(m => m.code)`, **kode `PURCHASE_ORDER.READ` tidak bisa
dipenuhi oleh role manapun, termasuk pemilik tenant sendiri.** Endpoint hutang supplier — salah
satu layar paling dasar di domain Purchase/AP (juga dipakai layar 21, 23) — 403 untuk semua orang
di produksi, sejak endpoint ini ditambahkan.

Bandingkan dengan endpoint kembarannya `GET /inventory/legacy/receivables`
(`tenant.module.ts:2313`) yang justru memakai `@Permissions('SALES.READ')` — kode level-domain
yang valid dan konsisten dengan pola permission role lain (mis. role `WAREHOUSE_STAFF`/
`PURCHASING_STAFF` di `tenant-menu.seed.ts:463,480` sama-sama diberi `PURCHASING: ['READ']` di
level domain, bukan submenu `PURCHASING_PO`). Ini murni bug copy-paste/salah kode, bukan
perbedaan desain yang disengaja.

**Perbaikan**: ubah `@Permissions('PURCHASE_ORDER.READ')` menjadi `@Permissions('PURCHASING.READ')`
di dua tempat:
- `apps/api/src/modules/tenant/tenant.module.ts:2363` (`GET /inventory/legacy/payables`)
- `apps/api/src/modules/tenant/sales-inventory-operations.controller.ts:1042`
  (`GET /inventory/supplier-workspace`)

Dipilih `PURCHASING.READ` (bukan `PURCHASING_PO.READ`) untuk konsisten persis dengan pola
`SALES.READ` pada endpoint kembarannya, dan karena role `PURCHASING_STAFF` (staf yang paling
butuh lihat hutang dari pembelian yang dia buat) sudah punya `PURCHASING: ['READ']` di level
domain tapi TIDAK punya `PURCHASING_PO.READ` secara eksplisit di templatenya.

**Verifikasi ulang setelah perbaikan** (hot-reload API, re-login token baru): `GET
/inventory/legacy/payables` → **HTTP 200**, `data: []` (belum ada data saat itu). Bukti:
`api-legacy-payables-200-AFTER-FIX.json`. `GET /inventory/supplier-workspace` juga diverifikasi
→ **HTTP 200**, payload lengkap (`suppliers`, `payables`, `payments`, `purchases`, `topProducts`,
`summary`). Bukti: `api-supplier-workspace-200-AFTER-FIX.json`.

**Verifikasi non-regresi**: `pnpm --filter @ebisnis/api lint` → bersih (0 warning/error).
`pnpm --filter @ebisnis/api test` → **157 test suite, 4015 test, semua PASS**, 0 gagal.

## Skenario data hutang & rekonsiliasi net outstanding

Setelah data PO/GR/payment dibuat (lihat `screen-20/uat.md`, `screen-25/uat.md`):

1. **Default (tanpa `includeSettled`)**: `GET /inventory/legacy/payables?pageSize=20` →
   3 baris terbuka: GR-000002 (net 300000, dicicil), GR-000003 (net 300000, jatuh tempo dimundurkan
   utk uji aging), GR-000004 (net 60000, **payable hantu dari GR yang di-reverse — lihat temuan di
   `screen-20/uat.md`**). GR-000001 (lunas) TIDAK muncul. Bukti: `api-payables-default-open-only.json`.

2. **Rekonsiliasi net outstanding & `is_settled`** (`reconciliation.sql`, terhadap query nyata
   endpoint — `GREATEST(abs(amount) - sum(allocated dari inventory_ap_payment POSTED), 0)`):

   | Invoice | Original | Allocated (POSTED) | Net manual | `is_settled` tersimpan | `is_settled` manual |
   |---|---|---|---|---|---|
   | GR-000001 | 600000 | 600000 | **0** | `true` | `true` |
   | GR-000002 | 500000 | 200000 | **300000** | `false` | `false` |
   | GR-000003 | 300000 | 0 | **300000** | `false` | `false` |
   | GR-000004 | 60000 | 0 | **60000** | `false` | `false` |

   **Cocok 100%** dengan respons API (`reconciliation-result.txt`) — formula `is_settled` dan
   `amount` (net) pada endpoint terbukti benar secara matematis untuk kasus lunas-penuh dan
   cicilan-sebagian.

## Hasil

**PASS** untuk fungsi inti (listing, filter default, net outstanding, `is_settled`) — SETELAH
perbaikan bug permission yang tadinya membuat endpoint ini 403 total. Rekonsiliasi SQL independen
cocok 100% dengan respons API. Payable hantu dari GR-000004 muncul di sini secara BENAR sesuai
kondisi data saat ini (baris itu sendiri adalah bug di layar 20, bukan bug pada query listing ini
— listing ini jujur menampilkan apa yang ada di `legacy_payable_ledger`).

## Yang TIDAK dicakup pass ini

Filter `search` (pencarian nomor invoice/nama supplier/bank) tidak diuji eksplisit. Screenshot
Web/Windows/Android tidak diambil.
