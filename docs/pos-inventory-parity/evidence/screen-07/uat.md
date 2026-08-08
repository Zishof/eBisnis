# UAT — Layar 7 (Data Sales atau Penjual Keliling)

**Tenant uji:** `uat_master_18664`. `resource=salespeople`, tabel
`inventory_salesperson_profile`, `menuCode=SALES`.

## Skenario dan hasil

### 1. CRUD
`POST /salespeople` dengan `code=SALES-UAT-1`, `user_subject_id` diisi ke `user_subject.id` milik
akun OWNER tenant ini (`3bd3258b-...`, satu-satunya `user_subject` yang ada karena tidak ada
endpoint REST untuk membuat user tenant baru — lihat catatan di layar 1) → **201**
(`create.json`).

### 2. Active/inactive BENAR-BENAR ditegakkan pada transaksi nyata — dibuktikan langsung,
    bukan dikutip dari kode
Temuan sesi sebelumnya menyebut cek ini ada di kode
(`tenant.module.ts:2052-2064`, `if (salesperson.rowCount && !salesperson.rows[0].is_active) throw FORBIDDEN`)
tapi meminta pembuktian nyata. Siklus penuh dijalankan lewat HTTP sungguhan:

1. **Salesperson AKTIF** → `POST /inventory/mobile-orders` (device event `uat-evt-active-001`)
   → **201 CREATED**, order `MOB-...` tercipta (`mobile-order-while-active.json`).
2. `POST /salespeople/:id/deactivate` dengan `reason` → **200**, `is_active:false`
   (`deactivate.json`).
3. **Salesperson NONAKTIF** → `POST /inventory/mobile-orders` (device event baru
   `uat-evt-inactive-002`, customer/produk sama) → **403 FORBIDDEN**,
   `"Profil sales tidak aktif; order baru tidak dapat dikirim."`
   (`mobile-order-while-inactive.json`). Verifikasi SQL: **0 baris** `sales_order` dengan
   `source_event_id='uat-evt-inactive-002'` — penolakan bersih, tanpa efek parsial (transaksi DB
   di-rollback total termasuk baris `inventory_mobile_command` yang diinsert sebelum pengecekan
   salesperson dalam urutan kode).
4. `POST /salespeople/:id/activate` → **200**, `is_active:true` (`reactivate.json`).
5. **Salesperson AKTIF lagi** → `POST /inventory/mobile-orders` (device event
   `uat-evt-reactivated-003`) → **201 CREATED** lagi (`mobile-order-after-reactivate.json`).

Siklus aktif→sukses→nonaktif→ditolak→aktif→sukses lagi lengkap dibuktikan lewat HTTP nyata,
bukan pembacaan kode.

### 3. Audit trail
`GET /salespeople/:id/audit` → 3 baris: `CREATE` → `DEACTIVATE` → `ACTIVATE`, masing-masing
`actor_username` + timestamp (`audit.json`).

### 4. GAP BARU ditemukan (didokumentasikan, tidak diperbaiki): referential guard TIDAK
    melindungi salesperson yang punya riwayat transaksi
Berbeda dari supplier/customer (`references` diisi di registry), `master-resource.registry.ts:202`
mendaftarkan `salespeople` dengan `references: []` — kosong. Dibuktikan dampaknya secara live:

1. 3 `sales_order` nyata dibuat lewat salesperson ini (langkah 1 dan 5 di atas, plus satu order
   customer-referential-guard di layar 4) — SQL konfirmasi `sales_order.created_by` untuk
   ketiganya = `3bd3258b-...`, PERSIS `user_subject_id` salesperson ini.
2. `GET /salespeople/:id/references` → `canPurge:true`, `references:[]` — sistem TIDAK
   mendeteksi ketiga order tersebut sebagai referensi, walau secara data mereka terhubung lewat
   `created_by` (`references.json`).
3. `POST /auth/step-up` (`HARD_DELETE`) → sah, lalu `POST /salespeople/:id/purge` → **200
   `{purged:true}`** (`purge-result.json`) — profil salesperson BENAR-BENAR HILANG PERMANEN
   (`SELECT ... WHERE code='SALES-UAT-1'` → 0 baris, `purge-gap-sql-evidence.txt`) walau
   mempunyai riwayat transaksi nyata. Ketiga `sales_order` sendiri TIDAK ikut terhapus (`created_by`
   menunjuk ke `user_subject`, bukan ke `inventory_salesperson_profile`, jadi tidak ada FK
   `ON DELETE CASCADE` yang terpicu) — tapi profil sales (kode, nama, wilayah, target) yang
   melekat pada riwayat order itu hilang tanpa jejak dan tanpa peringatan apa pun dari
   `references`/`purge`.

**Analisis akar masalah**: mekanisme `references` generik (`MasterLifecycleService.references()`,
`master-lifecycle.service.ts:514-569`) hanya mencocokkan `reference.column = recordId` secara
langsung. Untuk supplier/customer ini cocok (`purchase_order.supplier_id = supplier.id`), tapi
hubungan salesperson→order tidak langsung: `sales_order.created_by` menunjuk ke
`user_subject.id`, BUKAN ke `inventory_salesperson_profile.id` — perlu join tambahan lewat
`inventory_salesperson_profile.user_subject_id` yang mekanisme sekarang tidak mendukung. Ini
BUKAN cuma `references: []` yang lupa diisi; skema referensinya butuh perluasan kemampuan
(join tidak langsung), bukan sekadar menambah satu baris konfigurasi — karena itu tidak
diperbaiki pass ini sesuai kriteria "kecil dan jelas" (didokumentasikan, bukan gap kecil).

## Hasil

**PROVEN** untuk klaim inti layar 7: CRUD bekerja, DAN — berbeda dari temuan sesi sebelumnya yang
menyebut "TIDAK ada penegakan active/inactive salesperson di mana pun" — pass ini MEMBUKTIKAN
lewat HTTP nyata bahwa `POST /inventory/mobile-orders` MEMANG menegakkannya dengan benar (siklus
lengkap 5 langkah di atas). Klaim sesi sebelumnya perlu diperbarui: penegakan ADA untuk jalur
mobile order, sekalipun mungkin tidak ada di jalur transaksi lain yang belum diuji (lihat di
bawah).

**GAP BARU ditemukan dan didokumentasikan** (bukan diperbaiki): referential guard untuk purge
salesperson tidak berfungsi sama sekali — profil dengan riwayat transaksi nyata bisa dihapus
permanen tanpa peringatan.

## Yang TIDAK dicakup pass ini
Jalur transaksi LAIN yang mungkin memakai salesperson (mis. field sales order dari Web, bukan
mobile) tidak diuji — hanya `/inventory/mobile-orders` yang diverifikasi. Screenshot
Web/Windows/Android tidak diambil. Gap referential guard purge tidak diperbaiki (perlu perluasan
mekanisme `references` untuk mendukung join tidak langsung — di luar kriteria "kecil dan
jelas" pada sesi ini).
