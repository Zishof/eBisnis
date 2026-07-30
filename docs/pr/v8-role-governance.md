## Ringkasan

Dua perubahan: audit Versi 8 (V8-0) dan tata kelola role default Indonesia (V8-R1).

Yang berubah untuk pengguna: **tenant baru langsung memperoleh 124 role siap pakai** — Kasir POS,
Kepala Gudang, Akuntan Buku Besar, Penyetuju Payroll, Auditor Internal, dan seterusnya — lengkap
dengan hak per menu, batas data, dan aturan pemisahan tugas. Sebelumnya hanya 6 role dan sisanya
harus disusun manual sebelum sistem dapat dipakai.

## Requirement

Blueprint Versi 8 Revisi 1 bagian C meminta ~140 role default Indonesia beserta profil hak P0–P12,
data scope, dan segregation of duty.

## Migration

`V010__role_governance.sql` — **additive**, tidak mengubah tabel atau kolom lama.

| Objek | Jenis |
| --- | --- |
| `role_module_profile` | tabel baru |
| `role_data_scope` | tabel baru |
| `segregation_of_duty_rule` | tabel baru |
| `segregation_of_duty_role` | tabel baru |
| `segregation_of_duty_exception` | tabel baru |
| `segregation_of_duty_violation` | tabel baru |
| `role.profile_code`, `role_family`, `is_core`, `is_legacy`, `successor_code` | kolom baru |

`role_menu_permission` dipertahankan apa adanya sebagai hasil turunan, sehingga mesin permission
yang sudah berjalan tidak perlu disentuh.

Tenant yang sudah ada disusulkan lewat `pnpm migrate:tenants` (tersedia `--dry-run`).

## Keputusan desain

Role menunjuk **profil per modul**, bukan daftar menu. Blueprint mengusulkan lapisan
Duty/Privilege sebagai tabel terpisah; yang dipakai adalah satu tabel `role_module_profile`.

Alasannya bukan sekadar lebih ringkas: menu baru pada modul yang sudah dikenal **otomatis
terwarisi seluruh role** tanpa satu baris katalog pun diubah. Ini yang membuat perluasan menu ke
33 root pada fase berikutnya tidak menuntut penulisan ulang 140 role.

Pemisahan tugas dinyatakan sebagai **kelompok bersisi**, bukan pasangan penyiap-penyetuju. Bentuk
pasangan tidak dapat menyatakan `PO_RECEIPT_PAY` yang berkaki tiga: pemesan barang, penerima
barang, dan pembayar tagihan harus tiga pihak berbeda.

## Menu, role, permission

| Objek | Sebelum | Sesudah |
| --- | ---: | ---: |
| Role | 6 | 129 |
| Aksi permission | 22 | 26 |
| Baris role-menu-permission | 2.990 | 7.139 |
| Profil modul | 0 | 455 |
| Batas data | 0 | 124 |
| Aturan SoD | 0 | 13 |

Aksi baru: `RETURN`, `DELEGATE`, `REVERSE` (step-up), `AUDIT_READ`.

Enam role lama (`OWNER`, `MANAGER`, `CASHIER`, `PURCHASING_STAFF`, `WAREHOUSE_STAFF`,
`DEMO_USER`) **tidak dihapus** — ditandai `is_legacy` dan dipetakan ke padanan barunya, sehingga
penugasan pengguna yang ada tidak putus.

## Keamanan

- `ADMIN_TENANT` sengaja **tidak** memperoleh `HARD_DELETE`; penghapusan permanen tetap menuntut
  permission tersendiri dan step-up.
- SoD ditegakkan saat penetapan role oleh `SegregationOfDutyService.enforce()`. Pelanggaran yang
  **diloloskan** pengecualian ikut dicatat, bukan hanya yang ditolak — sebab yang diloloskan itulah
  yang benar-benar berjalan di produksi.
- Pengecualian SoD wajib beralasan minimal 10 karakter, ada penyetujunya, dan ada tanggal
  berakhirnya. Tidak dapat dimatikan diam-diam.

## Bukti pengujian

| Gate | Hasil |
| --- | --- |
| `pnpm lint` | bersih |
| `pnpm test` | 119 lulus (104 API + 15 web), naik dari 83 |
| `pnpm build` | bersih |
| `pnpm seed:verify` | LULUS, 0 gagal |
| `verify-migrations.mjs` | 10 migration lulus |

Diterapkan pada **14 schema pengembangan**. Dijalankan ulang menghasilkan 0 izin baru dan 0 baris
audit baru — idempotensi terbukti, bukan diasumsikan.

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| 129 role membingungkan tenant kecil | 13 role ditandai inti; sisanya tersedia tetapi tidak menonjol |
| SoD memblokir tenant beranggota sedikit | pengecualian tertulis beralasan, berbatas waktu, dan diaudit |
| Batas data belum ditegakkan pada query | **diketahui dan dicatat** — lihat Keterbatasan |

## Keterbatasan yang diketahui

`role_data_scope` menyimpan tingkat batas data dengan benar, tetapi **penegakannya pada query
belum ada**. Sampai itu dikerjakan, batas data adalah data yang benar tanpa penjaga — sama seperti
menu tersembunyi tanpa `PermissionGuard`. Prasyaratnya perbaikan V6-0-F03.

Menu masih 21 root / 73 node; blueprint menuntut 33 root. Karena role menunjuk modul, perluasan
menu tidak menuntut perubahan katalog role.

## Rollback

Migration additive. Untuk mengembalikan perilaku lama tanpa menyentuh skema: hapus baris role
bertanda `is_system = TRUE AND is_legacy = FALSE` beserta `role_menu_permission`-nya. Role lama dan
penugasan penggunanya tidak terpengaruh.

## Changelog

`CHANGELOG.md` bagian `[Unreleased]` sudah diperbarui.
