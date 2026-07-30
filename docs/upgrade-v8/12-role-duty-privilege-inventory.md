# 12 — Inventaris Role, Duty, dan Privilege

> **Status: sebagian besar sudah diterapkan** (migration `V010__role_governance.sql`).
> Bagian "Kondisi sekarang" di bawah adalah keadaan **sebelum** V010, dipertahankan
> sebagai catatan audit. Keadaan setelahnya ada pada bagian
> [Hasil setelah V010](#hasil-setelah-v010) di akhir dokumen.

## Kondisi sekarang

| Objek | Jumlah | Sumber |
| --- | ---: | --- |
| Role | **6** | `tenant-menu.seed.ts` |
| Aksi permission | 22 | tabel `permission_action` |
| Baris role-menu-permission | 2.990 | tabel `role_menu_permission` |
| Role scope | 1 | tabel `role_scope` |
| Duty | **0** | belum ada modelnya |
| Privilege | **0** | belum ada modelnya |
| Data scope policy | **0** | belum ada modelnya |
| Aturan SoD | **0** | belum ada modelnya |

Enam role yang ada:

| Kode | Nama |
| --- | --- |
| `OWNER` | Pemilik |
| `MANAGER` | Manajer |
| `CASHIER` | Kasir |
| `PURCHASING_STAFF` | Staf Pembelian |
| `WAREHOUSE_STAFF` | Staf Gudang |
| `DEMO_USER` | Pengguna Demo |

Blueprint Versi 8 Revisi 1 meminta **±140 role default Indonesia**. Selisihnya
134 role baru.

## Model yang perlu ditambahkan

Struktur sekarang hanya `Role → RoleMenuPermission`. Blueprint meminta lapisan
antara agar hak dapat disusun ulang tanpa menulis ulang ribuan baris permission:

```text
Privilege     hak terkecil, mis. GOODS_RECEIPT.APPROVE
Duty          kumpulan privilege yang membentuk satu tugas kerja
Role          kumpulan duty
DataScope     batas data: legal entity, brand, outlet, gudang, tim, diri sendiri
SoD           pasangan duty yang tidak boleh dipegang satu orang
```

Tanpa lapisan Duty, 140 role × ~520 menu × 22 aksi menghasilkan ratusan ribu
baris yang harus dikelola satu per satu. Dengan Duty, role disusun dari beberapa
puluh duty yang dapat dipakai bersama.

Model yang ditambahkan:

```text
PrivilegeCatalog          RoleDutyAssignment
DutyCatalog               DataScopePolicy
DutyPrivilege             DataScopeAssignment
RoleCatalog               SegregationOfDutyRule
                          SegregationOfDutyViolation
```

`RoleMenuPermission` yang sudah ada dipertahankan sebagai hasil turunan yang
dihitung dari duty, bukan dihapus — agar mesin permission existing tetap
berjalan tanpa perubahan.

## Profil hak P0–P12

Blueprint mendefinisikan 13 profil. Profil ini menjadi cetakan duty, sehingga
role tinggal menunjuk profil pada modul tertentu.

| Profil | Isi | Contoh role |
| --- | --- | --- |
| P0 | tanpa akses | — |
| P1 | READ, PRINT terbatas | `PENGGUNA_BACA_SAJA`, `MONITOR_GPS`, `ANALIS_BISNIS` |
| P2 | READ, CREATE, UPDATE, PRINT, EXPORT | `KASIR_POS`, `SALES`, `PICKER` |
| P3 | P2 + DELETE + IMPORT | `ADMIN_IMPOR_DATA` |
| P4 | READ, REVIEW, APPROVE, REJECT, RETURN | `PENYETUJU_PR`, `PENYETUJU_JURNAL`, `PENYETUJU_PAYROLL` |
| P5 | + DELETE, RESTORE, IMPORT, SUBMIT | `ADMIN_GUDANG`, `AKUNTAN_BUKU_BESAR` |
| P6 | P5 + APPROVE, CANCEL, POST, REVERSE | `KEPALA_GUDANG`, `MANAJER_PENJUALAN` |
| P7 | P6 + konfigurasi modul dan audit | `ADMIN_MASTER_DATA`, `MANAJER_HRD` |
| P8 | seluruh hak tenant | `ADMIN_TENANT`, `SUPER_ADMIN_PLATFORM` |
| P9 | READ, EXPORT, PRINT, AUDIT_READ saja | `AUDITOR_INTERNAL`, `AUDITOR_STOK` |
| P10 | hanya data milik sendiri + SUBMIT | `KARYAWAN`, `SOPIR`, `PELAPOR_TIKET` |
| P11 | dashboard, report, approve tertentu | `PEMILIK_USAHA`, `DIREKTUR`, `INVESTOR` |
| P12 | API terbatas, tanpa UI | `SERVICE_ACCOUNT_API` |

Profil P3 memuat satu-satunya kombinasi yang memenuhi syarat tombol Upload
(UPDATE dan DELETE keduanya benar) selain P5 ke atas. Ini konsisten dengan
aturan pada blueprint bagian 15.

## Pemetaan 6 role lama ke role baru

Role lama **tidak dihapus** agar pengguna dan permission yang ada tidak putus.
Keduanya hidup berdampingan; role lama ditandai `isLegacy=true` dan dipetakan
sebagai padanan role baru.

| Role lama | Padanan Versi 8 | Tindakan |
| --- | --- | --- |
| `OWNER` | `PEMILIK_USAHA` | petakan, pertahankan kode lama |
| `MANAGER` | `MANAJER_OPERASIONAL` | petakan |
| `CASHIER` | `KASIR_POS` | petakan |
| `PURCHASING_STAFF` | `STAF_PURCHASING` | petakan |
| `WAREHOUSE_STAFF` | `ADMIN_GUDANG` | petakan |
| `DEMO_USER` | tetap | khusus sandbox demo |

## Segregation of Duty

Blueprint mencantumkan batasan SoD pada kolom terakhir tabel role. Yang paling
berulang, dan karena itu paling penting ditegakkan mesin:

| Aturan | Alasan |
| --- | --- |
| Tidak menyetujui pengajuan sendiri | berlaku pada PR, workflow, biaya, anggaran |
| Pembuat jurnal ≠ penyetuju jurnal | `AKUNTAN_BUKU_BESAR` vs `PENYETUJU_JURNAL` |
| Penerima barang ≠ pembayar invoice | `PETUGAS_PENERIMAAN` vs `STAF_HUTANG` |
| Penyiap payroll ≠ penyetuju payroll | `PETUGAS_PAYROLL` vs `PENYETUJU_PAYROLL` |
| Pembuat vendor ≠ penyetuju pembayaran | `MANAJER_VENDOR` vs `BENDAHARA` |
| Pembuat adjustment stok ≠ penyetujunya | `ADMIN_GUDANG` vs `KEPALA_GUDANG` |

Pelanggaran dicatat pada `SegregationOfDutyViolation`, dan penetapan role yang
melanggar ditolak kecuali diberi pengecualian tertulis beserta alasannya.

## Data scope

| Tingkat | Contoh role |
| --- | --- |
| Seluruh platform | `SUPER_ADMIN_PLATFORM` |
| Seluruh tenant | `ADMIN_TENANT`, `PEMILIK_USAHA` |
| Legal entity | `CONTROLLER_KEUANGAN`, `MANAJER_AKUNTANSI` |
| Brand | `MANAJER_PENJUALAN` |
| Outlet | `KEPALA_TOKO`, `SUPERVISOR_KASIR` |
| Outlet + terminal + shift | `KASIR_POS` |
| Gudang | `KEPALA_GUDANG`, `PICKER`, `PACKER` |
| Tim langsung | `ATASAN_LANGSUNG` |
| Diri sendiri | `KARYAWAN`, `SOPIR`, `PENGAJU_BIAYA` |
| Trip yang ditugaskan | `SOPIR`, `KENEK` |
| Kepemilikan sendiri | `INVESTOR` |

`role_scope` yang ada sekarang hanya punya satu baris dan satu tingkat
(`TENANT`). Ia diperluas, bukan diganti.

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| 140 role membingungkan tenant kecil | tandai role inti vs lanjutan; provisioning tenant baru hanya mengaktifkan role inti |
| Ledakan baris permission | susun lewat duty; `role_menu_permission` dihitung sebagai turunan |
| Role lama putus | dipertahankan dan dipetakan, tidak dihapus |
| SoD memblokir operasi tenant kecil yang orangnya sedikit | pengecualian tertulis beralasan, dicatat audit, dan ditinjau berkala |
| Menu tersembunyi dianggap otorisasi | perbaikan V6-0-F03 menjadi prasyarat |

## Hasil setelah V010

Diukur pada schema `tokosaya` setelah `pnpm migrate:tenants` dijalankan.

| Objek | Sebelum | Sesudah |
| --- | ---: | ---: |
| Role | 6 | **129** |
| Aksi permission | 22 | **26** |
| Baris role-menu-permission | 2.990 | **7.139** |
| Profil modul per role | 0 | **455** |
| Batas data per role | 0 | **124** |
| Aturan SoD | 0 | **13** |
| Sisi role pada aturan SoD | 0 | **30** |

129, bukan 130, karena `DEMO_USER` ada pada template lama sekaligus katalog baru
dan keduanya menunjuk baris yang sama.

### Yang berbeda dari rancangan di atas

**Duty dan Privilege tidak dibuat sebagai tabel.** Rancangan awal mengusulkan
`PrivilegeCatalog` dan `DutyCatalog` sebagai lapisan antara. Yang dipakai adalah
**profil per modul** (`role_module_profile`): role menyatakan profil P0–P12 pada
satu modul, dan seeder menurunkannya menjadi baris `role_menu_permission`.

Alasannya, lapisan Duty menyelesaikan masalah yang sama — mencegah ratusan ribu
baris ditulis satu per satu — dengan menambah dua tabel dan satu tabel relasi.
Profil menyelesaikannya dengan satu tabel, dan sekaligus memberi sifat yang
tidak dimiliki Duty: menu baru pada modul yang sudah dikenal **otomatis
terwarisi seluruh role** tanpa satu pun baris katalog diubah. Diuji pada
`role-expansion.spec.ts` bagian "mewarisi menu baru tanpa mengubah katalog role".

Jika kelak ada tenant yang menuntut hak yang tidak dapat dinyatakan sebagai
profil per modul, `PrivilegeCatalog` dapat ditambahkan secara additive di
atasnya tanpa membongkar yang sudah ada.

**Aturan SoD bersisi banyak, bukan berpasangan.** Rancangan menyebut "pasangan
duty". Yang diterapkan adalah kelompok bersisi: `PREPARER`, `APPROVER`,
`EXECUTOR`, dan `CUSTODIAN`. Dua role dalam satu kelompok dengan sisi berbeda
tidak boleh dipegang satu orang.

Bentuk pasangan tidak dapat menyatakan `PO_RECEIPT_PAY`, yang justru berkaki
tiga: pemesan barang, penerima barang, dan pembayar tagihan harus tiga pihak
berbeda. Hal yang sama berlaku pada `VENDOR_PAYMENT` — pembuat pemasok,
penyetuju tagihan, dan pengeksekusi pembayaran.

### Aturan SoD yang disemai

| Kode | Tingkat | Sisi |
| --- | --- | ---: |
| `PO_RECEIPT_PAY` | CRITICAL | 3 |
| `VENDOR_PAYMENT` | CRITICAL | 3 |
| `JOURNAL` | CRITICAL | 2 |
| `PAYROLL` | CRITICAL | 2 |
| `AR_CASH` | CRITICAL | 2 |
| `POS_VOID` | HIGH | 2 |
| `PR_APPROVAL` | HIGH | 2 |
| `STOCK_ADJUSTMENT` | HIGH | 2 |
| `WORKFLOW_APPROVAL` | HIGH | 2 |
| `BUDGET` | MEDIUM | 2 |
| `EXPENSE` | MEDIUM | 2 |
| `CONTENT_PUBLISH` | LOW | 2 |
| `HELP_PUBLISH` | LOW | 2 |

Penegakannya ada pada `SegregationOfDutyService.enforce()`, dipanggil saat role
ditetapkan. Pelanggaran yang **diloloskan** pengecualian juga dicatat, bukan
hanya yang ditolak — sebab yang diloloskan itulah yang benar-benar berjalan di
produksi.

### Batas data yang disemai

| Tingkat | Role |
| --- | ---: |
| `LEGAL_ENTITY` | 37 |
| `TENANT` | 34 |
| `WAREHOUSE` | 11 |
| `BRAND` | 10 |
| `SELF` | 8 |
| `DEPARTMENT` | 8 |
| `OUTLET` | 4 |
| `TEAM` | 3 |
| `ASSIGNED_QUEUE` | 3 |
| `ASSIGNED_TRIP` | 2 |
| `OWNERSHIP` | 2 |
| `API_SCOPE` | 1 |
| `OUTLET_TERMINAL` | 1 |

Tingkat selain `TENANT` dan `SELF` ditandai `requires_assignment = TRUE`:
pemegangnya melihat **nol baris** sampai gudang, outlet, atau departemen konkret
ditugaskan kepadanya. Ini disengaja — role bergudang tanpa gudang yang
ditugaskan tidak boleh berarti "seluruh gudang".

### Yang masih terbuka

`role_data_scope` menyatakan **tingkat** batas data dan sudah tersemai, tetapi
**penegakannya pada query** belum ada. Sampai itu dikerjakan, batas data adalah
data yang benar tanpa penjaga — sama seperti menu tersembunyi tanpa
`PermissionGuard`. Penegakan menunggu perbaikan V6-0-F03, yang menjadi
prasyaratnya.
