# E13-0 · Matriks Pakai Ulang, Perluas, dan Bangun Baru

Status memakai kosakata yang diminta prompt V13:

| Kode | Arti |
| --- | --- |
| `LEGACY_REUSE` | Capability sudah ada di eBisnis; pendidikan memakainya apa adanya |
| `LEGACY_MIGRATE` | Ada di legacy Java; datanya dimigrasikan, desainnya dibangun ulang |
| `LEGACY_ARCHIVE` | Ada di legacy; **tidak** dibawa |
| `NEW_BUILD` | Tidak ada di mana pun; dibangun baru |
| `NOT_APPLICABLE` | Di luar cakupan V13 |

Kolom "eBisnis hari ini" merujuk berkas nyata di repo ini.

---

## 1. Fondasi bersama

| Capability | eBisnis hari ini | Status | Keputusan |
| --- | --- | --- | --- |
| Identity, RBAC, data scope, SoD | `modules/auth`, `modules/governance` | `LEGACY_REUSE` | Pakai apa adanya; tambah scope pendidikan (§8 prompt) |
| Katalog vertical (menu/role/permission) | `vertical-catalog.registry.ts` | `LEGACY_REUSE` | Tambah 3 katalog; jangan sunting `MENU_TREE_SEED` |
| Migration per modul | `migration-catalog.ts` | `LEGACY_REUSE` | Tambah manifest `ecampus`, `eschool`, `epesantren`, `education` |
| Schema registry per tenant | `TenantSchemaRegistry` | **`NEW_BUILD`** | Kunci `tenantId` unik; lihat dokumen 03 |
| Accounting / GL / event catalog | `modules/accounting` | `LEGACY_REUSE` | Tambah 11 accounting event `EDU_*` (§200.3) |
| Payment | `modules/payment` | `LEGACY_REUSE` | Jangan menambah adapter bank di domain pendidikan |
| Billing / subscription | `prisma/platform/subscription.prisma` | `NEW_BUILD` (berdampingan) | Lihat dokumen 06 |
| POS, wallet | `modules/pos` | `LEGACY_REUSE` | Kantin, uang saku, koperasi memakai POS Core |
| Koperasi / BMT | `modules/cooperative` | `LEGACY_REUSE` | ePesantren memakai kontrak, bukan koperasi kedua |
| Surat, disposisi, arsip | `modules/surat` | `LEGACY_REUSE` | — |
| Notification Hub | `modules/notification` | `LEGACY_REUSE` | Portal wali memakai kanal yang sama |
| AI Gateway | `modules/ai` | `LEGACY_REUSE` | Use case pendidikan sebagai policy, bukan gateway kedua |
| Observability, audit | `modules/observability` | `LEGACY_REUSE` | — |
| Sample data factory | `modules/master-seed` | `LEGACY_REUSE` | Tambah 5 profil pendidikan (§221) |
| Inventory / purchasing | Tabel `V004`, `V005`; modul API belum | `NEW_BUILD` (modul) | Tabelnya jangan diduplikasi |
| Workflow | Tabel `V007`; modul API belum | `NEW_BUILD` (modul) | Semua pengajuan pendidikan memakainya |
| **HR / kepegawaian** | tidak ada | **`NEW_BUILD`** | Prasyarat E13-5/6/7; lihat dokumen 09 §4 |
| **Payroll** | tidak ada | **`NEW_BUILD`** | `HonorRule` tidak punya muara tanpa ini |
| **Asset** | tidak ada; ada di legacy | `LEGACY_MIGRATE` | Dapodik meminta sarana |
| **DMS** | `file_object`, `entity_attachment` | `NEW_BUILD` (perluasan) | Klasifikasi, retensi, legal hold, tanda tangan |

---

## 2. Kernel pendidikan bersama

Seluruhnya `NEW_BUILD` — tidak ada padanan di eBisnis, dan legacy tidak memisahkan
kernel dari vertical.

| Entitas | Sumber acuan legacy | Catatan |
| --- | --- | --- |
| `AcademicYear`, `AcademicPeriod` | `RencanaTahunAkademikAction`, `kalender/` | Bukan fiscal year |
| `EducationProgram` | `JurusanAction`, `ProgramAction` | Prodi/jenjang/marhalah |
| `LearnerProfile`, `Enrollment` | `MahasiswaAction`, `sekolah/` | Sumber billing |
| `Curriculum`, `CurriculumVersion` | `KurikulumAction`, `AngkatanKurikulumAction` | Immutable sesudah aktif |
| `LearningUnit`, prasyarat | `MatakuliahAction`, `MatakuliahPrasyaratAction` | MK/mapel/kitab |
| `LearningOffering`, `ClassGroup` | `PerkuliahanAction`, `KelasAction` | Kapasitas dan kuota |
| `LearningRegistration` | `KrsAction` dan 5 varian | Paket/non-paket/remedial |
| `LearningSchedule`, clash engine | `PerkuliahanJadwalAction`, `CariRuangKosongAction` | Anti-bentrok |
| `AssessmentDefinition`, `GradeResult` | `NilaiMahasiswaAction`, `PembobotanNilaiAction` | Aturan bobot perlu dibaca |
| `Credential` | `SertifikatAction`, `WisudaAction` | Ijazah/rapor/sertifikat |

---

## 3. eCampus

| Capability | Status | Catatan penentu |
| --- | --- | --- |
| PMB, gelombang, jalur, seleksi, CBT, daftar ulang | `LEGACY_MIGRATE` | 134 class; alur lengkap sudah terbukti |
| Generator nomor induk | `LEGACY_MIGRATE` → **policy** | Legacy memakai class per institusi; V13 menjadikannya data |
| RPL | `NEW_BUILD` | Tidak ditemukan di legacy |
| Kurikulum, MK, SKS, prasyarat, ekuivalensi | `LEGACY_MIGRATE` | — |
| KRS + persetujuan PA + batas SKS per IPK | `LEGACY_MIGRATE` | `PembatasanNilaiIPKUntukPengambilanKRS` |
| KHS, IPS, IPK, transkrip | `LEGACY_MIGRATE` | **Rumusnya harus dibaca, bukan ditebak** |
| OBE, CPL/CPMK/Sub-CPMK, RPS | `LEGACY_MIGRATE` | 21 class; V13 menambah attainment dan CQI |
| PIKOBE (skor 0–100, tier) | `NEW_BUILD` | Tidak ada di legacy |
| MBKM, PKL, KKN | `LEGACY_MIGRATE` | 5 + 5 class |
| Tugas akhir, seminar, sidang | `LEGACY_MIGRATE` | — |
| Yudisium, wisuda, pemeriksaan berlapis | `LEGACY_MIGRATE` | Menjadi `checksJson` + event |
| Alumni, tracer study | `LEGACY_MIGRATE` | 2 class saja; tracer praktis baru |
| BKD | `LEGACY_MIGRATE` | 30 class |
| SISTER | `NEW_BUILD` | Legacy hanya 3 class dasbor |
| PDDikti / Neo Feeder | `LEGACY_MIGRATE` | 62 class; kontrak resmi tetap acuan |
| SPMI, SPI, AMI | `LEGACY_MIGRATE` | 12 + 12 class |
| Akreditasi BAN-PT/LAM | `LEGACY_MIGRATE` | 47 class; instrumen wajib versioned |
| Perpustakaan | `LEGACY_MIGRATE` | 141 class — besar; pertimbangkan fase tersendiri |
| Repository, e-journal | `NEW_BUILD` | Legacy 4 class; DSpace/OJS hanya rujukan standar |
| `ExecuteTemplateQuery` | **`LEGACY_ARCHIVE`** | SQL bebas dari UI dilarang |

---

## 4. eSchool

| Capability | Status | Catatan |
| --- | --- | --- |
| SPMB/PPDB | `LEGACY_MIGRATE` | `psb` hanya 10 class; aturan 2025 baru → policy version |
| Rombel, wali kelas, penempatan | `LEGACY_MIGRATE` | Ada di 240 class `sekolah` |
| Mapel, muatan lokal, fase | `LEGACY_MIGRATE` | Kurikulum wajib versioned |
| Presensi siswa | `LEGACY_MIGRATE` | `AbsensiSiswaHelper` |
| Asesmen formatif/sumatif, rapor | `LEGACY_MIGRATE` | Aturan nilai harus dibaca |
| Projek, ekstrakurikuler | `LEGACY_MIGRATE` | `AbsensiEkstrakurikulerAction` |
| BK/konseling, inklusi | `NEW_BUILD` | Data sensitif; akses terbatas |
| Portal orang tua | `NEW_BUILD` | Scope `GUARDIAN_CHILD` |
| Kenaikan kelas, kelulusan, mutasi | `LEGACY_MIGRATE` | Aturan harus dibaca |
| Dapodik | `NEW_BUILD` | Tidak ditemukan di legacy |
| EMIS | `NEW_BUILD` | — |

---

## 5. ePesantren

Hampir seluruhnya `NEW_BUILD`. Legacy hanya menyediakan `AsramaAction`,
`JenisTinggalMahasiswaAction`, dan `KunjunganTamuAction`.

| Capability | Status |
| --- | --- |
| Santri, wali, otoritas wali | `NEW_BUILD` |
| Asrama, kamar, penempatan, mutasi | `LEGACY_MIGRATE` (tipis) |
| Diniyah, marhalah, halaqah, kitab | `NEW_BUILD` |
| Tahfiz, setoran, murajaah, tajwid | `NEW_BUILD` |
| Izin keluar-masuk, gerbang | `NEW_BUILD` |
| Buku tamu / besuk | `LEGACY_MIGRATE` (tipis) |
| Uang saku cashless, limit wali | `NEW_BUILD` di atas POS/wallet Core |
| BMT / koperasi syariah | `LEGACY_REUSE` lewat `modules/cooperative` |
| Marketplace | `LEGACY_REUSE` — marketplace Core V9 |
| Portal wali santri | `NEW_BUILD` |
| EMIS | `NEW_BUILD` |

**Akibat perencanaan:** E13-7 bukan fase termurah hanya karena disebut terakhir. Ia
fase dengan preseden paling sedikit, dan estimasinya harus mencerminkan itu.

---

## 6. Yang sengaja tidak dibawa

| Capability legacy | Alasan |
| --- | --- |
| `ExecuteTemplateQueryAction`, `TemplateQueryAction` | SQL bebas dari UI; melanggar aturan keamanan eBisnis |
| Adapter bank per bank (`bni`, `bri`, `bsi`, `cimb`, …) | Payment Core sudah menanganinya |
| `epsbed` | Digantikan Feeder/PDDikti |
| `sirs` (191 class) | Milik eMedik, bukan V13 — `NOT_APPLICABLE` |
| `sisdes` (1 class) | Milik info-desa — `NOT_APPLICABLE` |
| `KonfigurasiTampilan*` per entitas | Diganti satu mekanisme custom field |
| `chat`, `ux`, `resources`, `generic`, `helper` | Infrastruktur legacy, bukan capability bisnis |
