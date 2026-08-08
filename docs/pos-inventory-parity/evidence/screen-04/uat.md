# UAT — Layar 4 (Data Customer)

**Tenant uji:** `uat_master_18664`. Sama seperti layar 1, tapi `resource=customers`,
`menuCode=CRM_CUSTOMER`, referensi transaksional `pos_sale`/`sales_order`.

## Skenario dan hasil

### 1. CRUD + uniqueness kode
`POST /customers` dengan `code=CUST-UAT-1` beserta field bank → **201** (`create.json`).
Duplikat kode → **409 CONFLICT**, `"Pelanggan dengan kode \"CUST-UAT-1\" sudah ada."`
(`dup.json`).

### 2. Referential guard
`POST /inventory/mobile-orders` sungguhan memakai `customerId` ini → `sales_order` tercipta
(`create-order-for-ref.json`). Lalu:
- `GET /customers/:id/references` → `canPurge:false`, 1 referensi: `sales_order` (1,
  transaksional) (`references.json`).
- `POST /auth/step-up` (`HARD_DELETE`) → token sah (`step-up.json`), lalu
  `POST /customers/:id/purge` DENGAN token sah → tetap **409 RECORD_REFERENCED**
  (`purge-blocked.json`) — guard bekerja walau step-up terpenuhi.
- `DELETE /customers/:id` (soft-delete) → **200** (`soft-delete.json`). SQL langsung
  konfirmasi: record MASIH ADA (`is_active=f`, `deleted_at` terisi, bukan hilang).
- `POST /customers/:id/restore` → **200**, `deleted_at:null` (`restore.json`).

### 3. Audit trail
`GET /customers/:id/audit` → 3 baris: `CREATE` → `SOFT_DELETE` → `RESTORE`, masing-masing
`actor_username=uat_master_18664` + timestamp (`audit.json`).

### 4. Masking data bank
Sama seperti layar 1 (mekanisme sama, `menuCode=CRM_CUSTOMER`): SQL langsung mengonfirmasi hanya
`OWNER`/`MANAGER` dari 218 role tenant ini memegang `CRM_CUSTOMER.VIEW_BANK_DETAILS` (lihat
`../screen-01/view-bank-details-role-matrix.txt` — query mencakup kedua menu sekaligus). OWNER
(pemegang permission) menerima `bank_account_number`/`bank_account_name` penuh pada
`create.json`, cocok dengan yang ditulis. Sesi HTTP kedua ber-permission rendah tidak berhasil
diperoleh pada pass ini — lihat penjelasan lengkap constraint di `../screen-01/uat.md` bagian 4.

## Hasil

**PROVEN** untuk: CRUD, uniqueness, referential guard (purge diblokir walau step-up sah), soft-delete
tidak menghapus data, restore, audit trail lengkap. **Kuat tapi tidak lengkap** untuk masking bank
(sama seperti layar 1 — lihat detail di sana).

## Yang TIDAK dicakup pass ini
Screenshot Web/Windows/Android tidak diambil.
