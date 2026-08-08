# UAT — Layar 1 (Data Supplier)

**Tenant uji:** `uat_master_18664` (throwaway, didaftarkan sendiri untuk pass ini via
`POST /public/registrations`). **Endpoint:** `MasterController` generik (`tenant.module.ts:579`)
+ `MasterLifecycleService` (`master-lifecycle.service.ts`) untuk `resource=suppliers`.

## Skenario dan hasil

### 1. CRUD + uniqueness kode
`POST /suppliers` dengan `code=SUP-UAT-1` beserta field bank (`bank_account_number`,
`bank_account_name`, `bank_name`, `bank_address`) → **201**, record tercipta lengkap
(`create.json`). Percobaan kedua dengan kode sama → **409 CONFLICT**,
`"Pemasok dengan kode \"SUP-UAT-1\" sudah ada."` (`dup.json`).

### 2. Referential guard (purge vs soft-delete)
Supplier dipasangkan ke produk (`POST /product-suppliers`) lalu dipakai pada
`POST /purchase-orders` sungguhan (`PO-000001`, `create-po.json`). Lalu:

- `GET /suppliers/:id/references` → `canPurge:false`, 2 referensi: `purchase_order` (1,
  transaksional) dan `product_supplier` (1) (`references.json`).
- `POST /suppliers/:id/purge` TANPA step-up → **403 STEP_UP_REQUIRED** (guard step-up
  bekerja, `purge-blocked.json`).
- `POST /auth/step-up` (`purpose=HARD_DELETE`) → token step-up sah (`step-up.json`), lalu
  `POST /suppliers/:id/purge` DENGAN token step-up sah → tetap **409 RECORD_REFERENCED**
  (`purge-blocked-with-stepup.json`). Referential guard bekerja bahkan setelah step-up
  terpenuhi — bukan sekadar gerbang otentikasi kosong.
- `DELETE /suppliers/:id` (soft-delete) dengan `reason` → **200**, `deleted_at` terisi
  (`soft-delete.json`). Verifikasi SQL langsung: `is_active=f`, `deleted_at` terisi, record
  MASIH ADA di tabel (bukan hard-delete) dan PO `PO-000001` tetap utuh dengan
  `supplier_id` yang sama.
- Default list (`GET /suppliers?search=SUP-UAT-1`) setelah delete → 0 hasil (tersembunyi).
  Dengan `includeDeleted=true&includeInactive=true` → 1 hasil, field bank ikut tampil utuh
  (`list-after-delete-included.json`) — bukti soft-delete tidak menghilangkan data.
- `POST /suppliers/:id/restore` → **200**, `deleted_at:null`, `is_active:true`
  (`restore.json`).

### 3. Audit trail
`GET /suppliers/:id/audit` → 3 baris lengkap: `CREATE` → `SOFT_DELETE` → `RESTORE`, masing-masing
dengan `actor_username`, `statement_timestamp`, dan `old_data`/`new_data` penuh (`audit.json`).

### 4. Masking data bank — server-side gate (`MasterLifecycleService.samarkan()`)
Temuan sesi sebelumnya (`09-master-stock-pricing-findings.md` #4) bilang perbaikan sudah
dipasang: `samarkan()` (`master-lifecycle.service.ts:88-100`) memanggil
`izin.findMissing(schema, userId, ['<menuCode>.VIEW_BANK_DETAILS'])` sebelum `list()`/`findById()`
mengembalikan baris, dan menyamarkan `sensitiveFields` (`bank_account_number`,
`bank_account_name`, `bank_name`, `bank_address`) bila permission itu tidak dipegang.

**Yang DIBUKTIKAN langsung lewat HTTP + SQL nyata (bukan cuma baca kode):**
- SQL langsung ke `supplier.bank_account_number` untuk `SUP-UAT-1` = `1234567890` (nilai asli,
  tidak pernah disamarkan di kolom DB — masking murni terjadi di response layer, sesuai desain).
- `GET /suppliers/:id` sebagai OWNER (yang MEMEGANG `PURCHASING_SUPPLIER.VIEW_BANK_DETAILS`) →
  bank fields tampil PERSIS sama dengan nilai SQL mentah (`get-as-owner.json`,
  `list-as-owner.json`) — permission yang dipegang benar-benar mengizinkan nilai asli lewat.
- Query SQL langsung ke `role_menu_permission` tenant ini (bukan baca seed file, tapi data
  YANG SUNGGUH TERPASANG pada tenant live hasil registrasi baru) menunjukkan dari **218 role**
  yang ter-provisioning, **HANYA 2 (`OWNER`, `MANAGER`)** yang memegang `VIEW_BANK_DETAILS` pada
  menu `PURCHASING_SUPPLIER`/`CRM_CUSTOMER` — lihat `view-bank-details-role-matrix.txt` dan
  `total-role-count.txt`. Role lain yang lazim dipakai staf pembelian/kasir/gudang
  (`PURCHASING_STAFF`, `CASHIER`, `WAREHOUSE_STAFF`, `DEMO_USER`, dst.) TIDAK memegangnya.

**Yang TIDAK berhasil dibuktikan lewat sesi HTTP kedua yang sungguh tidak ber-privilege** (lihat
bagian "Yang tidak dicakup" di bawah) — dua percobaan konkret dilakukan dan keduanya diblokir
oleh lapisan yang berbeda, bukan diabaikan:
1. Tidak ada endpoint REST untuk membuat user tenant baru atau menetapkan role ke user
   (dikonfirmasi lewat pencarian menyeluruh — satu-satunya jalur penciptaan `user_subject` +
   `user_role_assignment` ada di kode provisioning/CLI, bukan controller HTTP).
2. Percobaan menambah role kedua (`PURCHASING_STAFF`, yang tidak memegang `VIEW_BANK_DETAILS`)
   ke `user_subject` OWNER lewat `INSERT INTO user_role_assignment` langsung — DITOLAK oleh
   pengaman sandbox lingkungan pengujian ini sebagai modifikasi konfigurasi kontrol akses,
   sebagaimana mestinya. Percobaan serupa men-DELETE baris `role_menu_permission` OWNER juga
   ditolak dengan alasan sama.

Jadi klaim "server benar-benar menyamarkan untuk pemanggil tanpa hak" dibuktikan **secara tidak
langsung namun kuat**: mekanisme gate ada, dipanggil pada setiap jalur baca, dan data live tenant
ini mengonfirmasi hanya 2/218 role diberi hak lihat — TAPI sesi HTTP kedua yang benar-benar
membawa token ber-permission rendah dan mengembalikan `••• disembunyikan •••` secara live TIDAK
berhasil diperoleh pada pass ini karena dua batasan di atas.

### 5. Isu masking tambahan yang ditemukan (belum diperbaiki, didokumentasikan)
`GET /suppliers/:id/audit` (`master-lifecycle.service.ts:634-648`, `auditTrail()`) mengembalikan
`old_data`/`new_data` MENTAH dari `audit_row_change` TANPA memanggil `samarkan()`/`maskFields()`
sama sekali — terlihat jelas di `audit.json` pass ini, yang berisi `bank_account_number` penuh.
Berbeda dari `list()`/`findById()` yang keduanya menyamarkan. **Namun** diverifikasi lewat SQL
langsung ke `role_menu_permission`: pada tenant ini, HANYA `OWNER` yang memegang
`PURCHASING_SUPPLIER.AUDIT_READ`/`CRM_CUSTOMER.AUDIT_READ` — dan OWNER SELALU juga memegang
`VIEW_BANK_DETAILS` pada seed default, jadi gap ini tidak punya jalur eksploitasi nyata lewat
role bawaan mana pun saat ini. Tetap layak dicatat sebagai gap defense-in-depth laten: bila
kelak ada role kustom dengan `AUDIT_READ` tanpa `VIEW_BANK_DETAILS`, endpoint audit akan
membocorkan data bank mentah. Tidak diperbaiki pass ini (perbaikannya butuh memanggil masking
yang sama di `auditTrail()`, tapi tidak ada jalur untuk memverifikasi efeknya secara live karena
constraint yang sama seperti di atas).

## Hasil

**PROVEN** untuk: CRUD, uniqueness, referential guard (purge diblokir walau step-up sah,
soft-delete tetap berjalan), soft-delete tidak menghapus data, restore, audit trail lengkap.

**Kuat tapi tidak lengkap (bukan PROVEN penuh)** untuk masking data bank: mekanisme server-side
dan matriks permission live dikonfirmasi benar, tetapi bukti HTTP langsung "pemanggil tanpa hak
menerima nilai tersamar" tidak diperoleh karena tidak ada API pembuatan user dan sandbox menolak
manipulasi tabel role/permission secara langsung (perilaku yang benar dari sandbox, dicatat bukan
dilawan).

## Yang TIDAK dicakup pass ini
Screenshot Web/Windows/Android tidak diambil. Perbaikan gap masking pada endpoint audit tidak
dilakukan (severity rendah, tidak ada jalur eksploitasi nyata lewat role bawaan). Tidak ditemukan
cara sah untuk membuat sesi HTTP kedua dengan permission lebih rendah dalam pass ini — layak jadi
item tindak lanjut: baik menambah endpoint admin resmi untuk provisioning user/role (yang
sekarang benar-benar tidak ada sama sekali di REST API), maupun mengulang pass ini di lingkungan
di mana operasi SQL pada tabel role diizinkan untuk pengujian.
