# UAT — Layar 2 (Membuka Daftar Supplier)

**Tenant uji:** `uat_master_18664`. Katalog paritas (`sales-inventory-parity.catalog.ts:57`)
memetakan layar ini ke `/suppliers` + `/inventory/party-master-balances/suppliers` — BUKAN
endpoint terpisah. "Membuka daftar" pada legacy adalah mode presentasi UI (tab/daftar aktif),
bukan aksi transaksional tersendiri.

## Skenario dan hasil

### 1. Tidak ada endpoint terbuang/rusak untuk "buka daftar"
Dikonfirmasi lewat `MasterController` (`tenant.module.ts:598-608`): satu-satunya endpoint list
adalah `GET /suppliers` generik, dipakai bersama oleh layar 1/2/3. Tidak ada route
`/suppliers/open` atau semacamnya yang didaftarkan atau diharapkan — klaim dokumen mapping bahwa
ini murni mode presentasi client TERKONFIRMASI, bukan endpoint yatim.

### 2. `GET /suppliers` (daftar "terbuka" = aktif, tidak terhapus)
Default query (`includeDeleted=false`, `includeInactive=false` bawaan `BaseQueryDto`) hanya
menampilkan record `is_active=TRUE AND deleted_at IS NULL` — inilah "daftar terbuka". Dibuktikan
di layar 1: setelah soft-delete, `SUP-UAT-1` LANGSUNG hilang dari `GET /suppliers?search=...`
default (`list-after-delete-default.json` pada evidence layar 1).

### 3. `GET /inventory/party-master-balances/suppliers` — saldo per supplier
Endpoint terpisah (`sales-inventory-operations.controller.ts:443-459`,
`partyMasterBalanceSql()`) mengembalikan `balance` (jumlah `legacy_payable_ledger.amount` yang
BELUM `is_settled`) dan `document_count` per supplier. Dipanggil live: 11 baris untuk 11 supplier
tenant ini, semua `balance:"0"` (tenant baru, belum ada payable) — `balances-nofilter.json`.

### 4. Filter open/settled — dikonfirmasi HANYA bucketing client-side (temuan sesi sebelumnya
    diverifikasi ulang, MASIH BENAR)
Percobaan nyata: memanggil endpoint yang sama dengan parameter query palsu
(`?open=true&status=OPEN&filter=SETTLED`) yang meniru apa yang mungkin dikirim UI filter →
response **IDENTIK BYTE-PER-BYTE** (kecuali `requestId`) dengan panggilan tanpa parameter apa pun
(`balances-with-fake-filter.json` vs `balances-nofilter.json`, di-diff langsung). `partyMasterBalanceSql()`
(`sales-inventory-operations.controller.ts:2015-2045`) tidak menerima parameter apa pun selain
`:kind` di path — SQL-nya statis per jenis, tidak ada `WHERE` dinamis untuk status settled.
Ditelusuri ke `InventoryPartyMasterPage.tsx:159,176-179`: filter `OPEN`/`SETTLED`/`ALL` adalah
`useState` React murni yang menyaring `visibleRows` di memory dari HASIL YANG SAMA yang sudah
diambil penuh — bukan query ulang ke server dengan parameter berbeda.

## Hasil

**PROVEN**: tidak ada endpoint terbuang untuk "buka daftar" (mode presentasi UI murni, sesuai
klaim mapping). **PARTIAL** (dikonfirmasi ulang, konsisten dengan temuan sebelumnya) untuk saldo:
data saldo REAL dan live dari ledger, TAPI filter open/settled adalah bucketing sisi klien, bukan
kapabilitas server — dibuktikan lewat perbandingan response identik dengan/tanpa parameter filter,
bukan hanya membaca kode frontend.

## Yang TIDAK dicakup pass ini
Screenshot Web/Windows/Android tidak diambil. Tenant uji baru tidak punya data payable
substantif untuk menguji bucketing dengan saldo > 0 secara end-to-end visual; pembuktian di sini
berfokus pada perilaku server (parameter diabaikan), bukan tampilan hasil filter di UI.
