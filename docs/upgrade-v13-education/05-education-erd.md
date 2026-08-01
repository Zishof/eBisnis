# E13-0 · ERD Pendidikan

ERD sasaran berasal dari BRD §190, §214–§217. Dokumen ini tidak mengulang tabelnya —
ia mencatat **keputusan desain** yang menentukan bentuknya, dan yang bila salah baru
ketahuan setelah data masuk.

---

## 1. Pembagian schema

| Schema | Isi |
| --- | --- |
| `{u}_core` | `Person` dan turunannya, organisasi, `party`, identitas, file |
| `{u}_education` | Kernel bersama: periode, program, kurikulum, learning unit, offering, registration, jadwal, sesi, asesmen, nilai, credential, outbox |
| `{u}_ecampus` | Yang khas kampus: PMB/RPL, KRS, KHS/IPK, OBE, MBKM, skripsi, BKD, Feeder, akreditasi |
| `{u}_eschool` | Yang khas sekolah: SPMB, rombel, rapor, projek, BK, portal ortu, Dapodik/EMIS |
| `{u}_epesantren` | Yang khas pesantren: asrama, diniyah, tahfiz, izin/gerbang, uang saku, EMIS |

Aturan yang mengikat: **tidak ada foreign key lintas schema vertical**. Vertical
merujuk kernel dan core; vertical tidak pernah merujuk vertical lain. Yayasan yang
punya sekolah dan pesantren menautkan keduanya lewat `Person` di `_core`, bukan lewat
FK `SantriProfile → PupilProfile`.

## 2. Supertype peserta didik

```text
Person (core)
  └── LearnerProfile (education)      satu per person × institution × learnerType
        ├── StudentProfile (ecampus)
        ├── PupilProfile   (eschool)
        └── SantriProfile  (epesantren)
```

`Enrollment` menggantung pada `LearnerProfile`, bukan pada profil vertical. Itulah yang
membuat billing (§187.3) dapat menghitung tanpa mengetahui vertical mana yang aktif.

## 3. Keputusan yang menentukan

### 3.1 Kurikulum tidak diubah di tempat

`CurriculumVersion` immutable sesudah `ACTIVE`. Mengubah kurikulum yang sudah dipakai
berarti mengubah transkrip mahasiswa yang sudah lulus. Perubahan menghasilkan versi
baru plus aturan transisi (`CourseEquivalence`).

### 3.2 Nilai versioned dan dipublikasikan

`GradeResult` punya versi; `GradePublication` mengunci hasil per offering. Sesudah
terbit, koreksi menghasilkan versi baru dengan alasan dan pelaku — bukan `UPDATE`.
Legacy memakai `RevisiAction`; V13 menjadikannya bagian model, bukan layar terpisah.

### 3.3 Status tidak ditimpa

`EnrollmentStatusHistory` dan `AcademicStatusHistory` append-only. Cuti, aktif, keluar,
lulus — masing-masing punya tanggal berlaku. Billing membaca riwayat ini, sehingga
menimpa status akan mengubah tagihan bulan yang sudah lewat.

### 3.4 Identifier punya riwayat

`LearnerIdentifierHistory` — NIM/NIS/NISN dapat berubah (pindah prodi, koreksi Dapodik).
Menyimpannya sebagai kolom tunggal menghapus jejak nomor lama yang masih tercetak pada
ijazah dan rapor.

### 3.5 Satu `LearningUnit` untuk tiga vertical

Mata kuliah, mata pelajaran, dan kitab adalah unit belajar dengan atribut berbeda.
Bentuknya satu tabel kernel + tabel atribut per vertical (`Course`, `SchoolSubject`,
`Kitab`), bukan tiga tabel sejajar yang tidak saling kenal. Jadwal, presensi, dan
asesmen lalu bekerja untuk ketiganya tanpa cabang.

### 3.6 Outbox, bukan tulis langsung

`EducationEventOutbox` per schema pendidikan. Perubahan lintas bounded context —
tagihan awal, penyediaan akun, pelaporan nasional — melalui event, bukan `INSERT`
lintas schema.

## 4. Yang belum diputuskan

| Pertanyaan | Mengapa ditunda | Diputuskan pada |
| --- | --- | --- |
| Rumus IPS/IPK yang tepat | Harus dibaca dari legacy, bukan ditebak | E13-5 |
| Aturan kenaikan kelas dan kelulusan | Berbeda per jenjang dan regulasi | E13-6 |
| Bentuk rapor Kurikulum Merdeka | Peraturan berubah (Permendikdasmen 13/2025) | E13-6 |
| Skala penilaian tahfiz | Tidak ada preseden legacy | E13-7 |
| Struktur `checksJson` kelulusan | Tergantung modul yang tersedia | E13-5 |

Menuliskan keputusan yang belum diambil sebagai "sudah diputuskan" adalah cara tercepat
membuat ERD yang salah tampak selesai.
