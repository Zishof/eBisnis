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
(join tidak langsung), bukan sekadar menambah satu baris konfigurasi.

### 5. GAP DIPERBAIKI (susulan): dukungan join tidak langsung ditambahkan ke mekanisme `references`
Mekanisme generik diperluas dengan field opsional `viaColumn` pada tiap entri
`MasterResourceDefinition.references` (`master-resource.registry.ts`) — bila diisi,
`MasterLifecycleService.references()` mencocokkan `reference.column` terhadap
`record[viaColumn]`, bukan terhadap `id` record itu sendiri (fungsi murni
`resolveReferenceMatchValue`, diuji lewat unit test tanpa basis data —
`master-lifecycle.spec.ts`, describe `resolveReferenceMatchValue`). `salespeople` kini
mendaftarkan tiga referensi tidak langsung lewat `user_subject_id`: `sales_order.created_by`,
`sales_note_handover.salesperson_id`, dan `legacy_receivable_ledger.salesperson_id` — ketiganya
`isTransactional:true`, sehingga `canPurge` otomatis `false` selama salah satu ada baris yang
cocok. `resolveReferenceMatchValue` juga menangani kasus `record[viaColumn]` kosong
(`null`/`undefined`, mis. salesperson yang belum ditautkan ke `user_subject`) dengan melewati
referensi tsb, mencegah query dengan parameter `NULL` yang tidak berarti.

Perbaikan ini bersifat mekanisme umum (`references`/`purge` generik), belum diverifikasi ulang
lewat siklus HTTP live yang sama seperti pembuktian gap di atas (profil uji `SALES-UAT-1` dari
langkah 3 sudah terlanjur terhapus permanen oleh gap tsb sebelum perbaikan ini ada, sehingga tidak
bisa dipakai ulang). Verifikasi tersisa: `POST /salespeople` baru + `POST
/inventory/mobile-orders` + `GET /salespeople/:id/references` (harus `canPurge:false`,
`references` berisi baris `sales_order`) + `POST /salespeople/:id/purge` (harus **409
RECORD_REFERENCED**, bukan lagi 200).

## Hasil

**PROVEN** untuk klaim inti layar 7: CRUD bekerja, DAN — berbeda dari temuan sesi sebelumnya yang
menyebut "TIDAK ada penegakan active/inactive salesperson di mana pun" — pass ini MEMBUKTIKAN
lewat HTTP nyata bahwa `POST /inventory/mobile-orders` MEMANG menegakkannya dengan benar (siklus
lengkap 5 langkah di atas). Klaim sesi sebelumnya perlu diperbarui: penegakan ADA untuk jalur
mobile order, sekalipun mungkin tidak ada di jalur transaksi lain yang belum diuji (lihat di
bawah).

**GAP DIPERBAIKI** (lihat §5): referential guard untuk purge salesperson kini memblokir purge
selama ada `sales_order`/`sales_note_handover`/`legacy_receivable_ledger` yang menunjuk
`user_subject_id` salesperson tsb — sebelumnya profil dengan riwayat transaksi nyata bisa
dihapus permanen tanpa peringatan. Verifikasi HTTP live end-to-end atas perbaikan ini belum
dilakukan (lihat catatan di §5).

## Yang TIDAK dicakup pass ini
Jalur transaksi LAIN yang mungkin memakai salesperson (mis. field sales order dari Web, bukan
mobile) tidak diuji — hanya `/inventory/mobile-orders` yang diverifikasi. Screenshot
Web/Windows/Android tidak diambil. Perbaikan gap referential guard purge (§5) belum diverifikasi
lewat siklus HTTP live baru (lihat catatan di §5).
