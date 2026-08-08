# UAT — Layar 5 (Membuka Daftar Customer)

**Tenant uji:** `uat_master_18664`. Sama seperti layar 2 tapi untuk `/customers` +
`/inventory/party-master-balances/customers`.

## Skenario dan hasil

1. **Tidak ada endpoint terbuang**: `MasterController` generik yang sama melayani
   `GET /customers` untuk layar 4/5/6 — tidak ada route `/customers/open` terpisah.
2. **`GET /customers` default** = daftar "terbuka" (`is_active=TRUE AND deleted_at IS NULL`).
   Dibuktikan di layar 4: setelah soft-delete, `CUST-UAT-1` tidak lagi muncul di query default.
3. **`GET /inventory/party-master-balances/customers`**: dipanggil live, mengembalikan
   `balance`/`document_count` per customer dari `legacy_receivable_ledger` (analog dengan supplier
   di layar 2, kode SQL sama-sama di `partyMasterBalanceSql()`,
   `sales-inventory-operations.controller.ts:2025-2033`).
4. **Filter open/settled**: mekanisme SQL identik dengan layar 2 (endpoint generik `:kind`) —
   tidak menerima parameter filter apa pun; bucketing terjadi di `InventoryPartyMasterPage.tsx`
   sisi klien untuk `kind=customers` sama seperti `kind=suppliers`. Bukti byte-identik yang sudah
   didapat di layar 2 berlaku untuk mekanisme yang sama ini (kode SQL generator satu fungsi untuk
   ketiga `kind`).

## Hasil

**PROVEN**: tidak ada endpoint terbuang. **PARTIAL** untuk saldo: data real, filter open/settled
client-side saja — konsisten dengan temuan layar 2 (mekanisme identik, hanya `kind` berbeda).

## Yang TIDAK dicakup pass ini
Panggilan langsung ke `/inventory/party-master-balances/customers` dengan parameter filter palsu
tidak diulang terpisah (mekanisme SQL-nya generik dan sudah dibuktikan byte-identik untuk
`kind=suppliers` di layar 2 — fungsi yang sama, `sales-inventory-operations.controller.ts:2015`,
dipakai untuk ketiga `kind` tanpa percabangan parameter). Screenshot Web/Windows/Android tidak
diambil.
