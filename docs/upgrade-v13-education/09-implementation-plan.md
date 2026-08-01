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

## 2. E13-1 secara rinci

Fase pertama menyentuh kunci tabel yang dipakai setiap tenant berjalan, sehingga
urutannya di dalam fase juga penting.

1. Migration additive: `moduleCode` pada `TenantSchemaRegistry`, backfill `'core'`.
2. Ganti kunci unik `tenantId` → `(tenantId, moduleCode)`.
3. Pindahkan `username` ke `Tenant` (kolom lama dibiarkan sampai tidak terpakai).
4. Tabel `TenantVerticalModule`, `TenantModuleMigration`.
5. Batas username 3–30 karakter **saat dibuat**; tambah 3 kode modul ke reserved.
6. Resolver schema menerima (tenant, modul); modul berasal dari rute.
7. Katalog produk pendidikan dan 7 kombinasi vertical (§186.1).
8. State machine provisioning (§186.2), termasuk rollback.
9. Tiga `VerticalCatalog` baru mengikuti pola `COOPERATIVE_VERTICAL_CATALOG`.
10. Manifest migration per modul.

Langkah 1–3 tidak boleh dipisah antar rilis: keadaan antara membuat sebagian tenant
punya `moduleCode` dan sebagian tidak.

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
