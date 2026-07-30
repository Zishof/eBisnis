# 12 — Inventaris Role, Duty, dan Privilege

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
