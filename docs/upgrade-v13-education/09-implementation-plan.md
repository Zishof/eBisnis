# E13-0 · Rencana Implementasi

---

## 1. Urutan fase

Urutan BRD §225 dipertahankan. Yang ditambahkan audit ini adalah **prasyarat** dan
**alasan urutannya tidak dapat ditukar**.

| Fase | Isi | Prasyarat keras |
| --- | --- | --- |
| E13-0 | Audit | — |
| E13-1 | Product catalog, subscription, schema registry, provisioning | — |
| E13-2 | Person, identitas, organisasi | E13-1 (schema harus ada dulu) |
| E13-3 | Admission kernel | E13-2 (`Person` untuk konversi pendaftar) |
| E13-4 | Common education kernel | E13-2 |
| E13-5 | eCampus | E13-3, E13-4 |
| E13-6 | eSchool | E13-3, E13-4 |
| E13-7 | ePesantren | E13-3, E13-4 |
| E13-8 | Finance pendidikan, usage metering, billing | E13-4 (Enrollment), **E13-2 (dedup Person)** |
| E13-9 | Adapter nasional | E13-5/6/7 sesuai vertical |
| E13-10 | Portal, wali, PWA, notifikasi | E13-5/6/7 |
| E13-11 | AI, Help, sample, migrasi, security | Semua vertical |
| E13-12 | Regresi penuh, UAT, pilot, rilis | Semua |

E13-8 bergantung pada E13-2 dan itu tidak jelas dari urutan nomornya: deduplikasi
lintas vertical (§187.4) memerlukan `Person` canonical. Tanpa itu, policy
`UNIQUE_PERSON_ACROSS_VERTICALS` tidak dapat dihitung.

## 2. E13-1 — keadaan sesudah dilaksanakan

Rencana semula membuka dengan mengubah kunci `TenantSchemaRegistry`. Itu
**tidak** dilakukan; alasannya ada pada
[dokumen 03](03-schema-and-module-registry.md) Pilihan D. Daftar berikut adalah
keadaan sebenarnya, bukan rencananya.

| # | Pekerjaan | Status |
| --- | --- | --- |
| 1 | Schema per modul lewat `TenantVerticalModule` + `TenantModuleMigration` | **SELESAI** — migrasi murni penambahan |
| 2 | Kunci `TenantSchemaRegistry` diubah | **TIDAK DIPERLUKAN** — diganti Pilihan D |
| 3 | `username` dipindah ke `Tenant` | **TIDAK DIPERLUKAN** — akibat Pilihan D |
| 4 | Batas username 3–30 saat dibuat; kode modul dicadangkan | **SELESAI** |
| 5 | Kode modul canonical; salah eja ditolak, bukan diperbaiki | **SELESAI** |
| 6 | Tujuh kombinasi paket (§186.1) sebagai konstanta teruji | **SELESAI** |
| 7 | State machine provisioning 14 keadaan (§186.2) | **SELESAI** |
| 8 | Katalog vertical eSchool: 7 modul, 9 peran | **SELESAI** |
| 9 | Manifest migration `education` dan `eschool`, berschema sendiri | **SELESAI** |
| 10 | Cakupan data pendidikan pada tipe **dan** constraint basis data | **SELESAI** |
| 11 | Resolver schema saat permintaan menerima (tenant, modul) | **BELUM** |
| 12 | Layanan provisioning yang benar-benar membuat schema modul | **BELUM** |
| 13 | Katalog produk dipersistensi dan tersambung ke subscription | **BELUM** |
| 14 | Katalog vertical eCampus dan ePesantren | **BELUM** — sengaja |

Empat yang belum bukan sisa yang terlupa.

Nomor 12 memerlukan `Person` (E13-2) supaya ada yang disemai ke schema yang baru
dibuat. Nomor 13 memerlukan model harga (E13-8). Nomor 14 menunggu eSchool
terbukti pada pilot — membangun tiga katalog sebelum satu pun dipakai berarti
mengulang kesalahan yang sama tiga kali.

Nomor 11 yang paling mendesak: schema modul sudah dapat terbentuk, tetapi belum
ada permintaan HTTP yang dapat mencapainya.

### Penjaga yang lahir dari kegagalan nyata

`DataScopeCode` punya kembaran di basis data. Menambah nilai pada tipe saja lolos
kompilasi, lolos 2.107 uji, lalu berhenti saat provisioning tenant di CI.
`education-data-scope.spec.ts` kini membandingkan keduanya sebelum commit.

Pelajaran yang berlaku untuk seluruh fase berikutnya: **setiap enumerasi yang
ditulis dua kali perlu uji yang membandingkannya**, sebab tidak satu pun
pemeriksaan yang berjalan tanpa basis data akan menangkap penyimpangannya.

## 3. Vertical slice pertama

Prompt master melarang berhenti pada skeleton. Slice tertipis yang benar-benar dapat
diuji, melintasi seluruh lapisan:

```text
Tenant memilih ESCHOOL_ONLY
  → schema {u}_core, {u}_education, {u}_eschool terprovision
  → menu, role, permission tersemai
  → satu Person dibuat
  → satu PupilProfile + Enrollment aktif
  → LearnerUsageDaily tercatat hari itu
  → tagihan SPP pertama terbit lewat Finance Core
```

Dipilih eSchool, bukan eCampus, karena tiga alasan: aturannya paling sederhana
(tanpa SKS, KRS, IPK), preseden legacy-nya besar (240 class), dan portal orang tua
menguji data scope `GUARDIAN_CHILD` sejak awal — permukaan risiko terluas diuji paling
dini, bukan paling akhir.

## 4. Keputusan yang diperlukan sebelum E13-5

BRD berulang kali menulis "gunakan HR/Payroll Core; jangan membuat engine kedua".
Audit menemukan **tidak ada engine pertama**: tidak ada modul `hr` maupun `payroll`
(dokumen 00 §2.4).

Yang bergantung padanya: `EducationStaffProfile`, `TeachingEligibility`,
`TeachingLoadPlan`, `TeachingLoadRealization`, `HonorRule`, `EducatorPerformance`,
BKD, dan honor mengajar.

Tiga pilihan:

| Pilihan | Untung | Rugi |
| --- | --- | --- |
| Bangun HR/Payroll Core dulu | Sesuai BRD; dipakai seluruh vertical | Menunda E13-5 cukup lama |
| Bangun profil staf pendidikan saja, payroll menyusul | E13-5 jalan | Beban mengajar tidak sampai ke gaji |
| Tunda BKD dan honor ke fase terpisah | Paling cepat | Kampus menganggap BKD wajib |

Ini keputusan pemilik, bukan keputusan teknis. Audit hanya menegaskan bahwa keputusan
itu **harus diambil sebelum E13-5**, bukan ditemukan di tengahnya.

## 5. Kewajiban tiap perubahan

Dari prompt §12, berlaku pada setiap logical change:

```text
migration additive · API/OpenAPI · Orval · UI · permission · audit
Help · tests · docs · changelog · commit · push · CI
```

Ditambah dari praktik repo ini:

- Tidak menyunting `MENU_TREE_SEED` atau `ROLE_CATALOG` — pakai `VerticalCatalog`.
- Job Flutter dan langkah kesegaran vektor konformansi tetap hijau.
- Uji tidak boleh turun dari garis dasar dokumen 10.

## 6. Risiko yang paling mungkin terjadi

| Risiko | Tanda awal | Mitigasi |
| --- | --- | --- |
| Perubahan kunci `TenantSchemaRegistry` merusak tenant berjalan | Uji provisioning merah | Backfill `core` + uji migrasi pada salinan |
| Tiga vertical berkembang menjadi monolit | Import lintas vertical muncul | Uji arsitektur yang melarang import lintas bounded context |
| Rumus IPK/rapor ditebak | Nilai berbeda dari sistem lama saat pilot | Baca legacy; bandingkan dengan data nyata sebelum go-live |
| Billing tidak dipercaya tenant | Sengketa tagihan pertama | Audit yang dapat direproduksi sejak E13-8, bukan sesudah |
| Adapter nasional dibangun untuk API yang salah | Pilot menolak | Konfirmasi 4 pertanyaan dokumen 07 §4 lebih dulu |
| ePesantren diperkirakan terlalu murah | Estimasi meleset jauh | Perlakukan sebagai `NEW_BUILD` penuh |

## 7. Yang tidak dijanjikan audit ini

Audit tidak memperkirakan durasi. Tiga hal yang paling menentukan durasi belum
diketahui: keputusan HR/payroll (§4), akses integrasi nasional (dokumen 07 §4), dan
aturan perhitungan yang masih harus dibaca dari legacy (dokumen 01 §5).

Angka yang diberikan sebelum ketiganya jelas akan menjadi angka yang dikutip, lalu
dijadikan komitmen.
