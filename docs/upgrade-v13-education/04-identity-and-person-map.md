# E13-0 · Peta Identitas dan Person

---

## 1. Yang ada sekarang

| Entitas | Lokasi | Perannya |
| --- | --- | --- |
| `PlatformUser` | `prisma/platform/identity.prisma` | Akun login lintas tenant |
| `TenantMembership` | `prisma/platform/tenancy.prisma:173` | Keanggotaan user pada tenant |
| `user_subject` | `V002__organization_access.sql` | Subjek di dalam schema tenant |
| `user_role_assignment`, `role_scope` | `V002` | Role dan data scope |
| `party` | `V002:539` | Pihak bisnis: pelanggan, pemasok, pemilik, investor |

Rantai autentikasi dan otorisasi sudah lengkap dan teruji (2.069 uji API hijau).
Yang belum ada adalah **manusia sebagai entitas tersendiri**.

## 2. Mengapa `party` bukan `Person`

```sql
party (id, party_type DEFAULT 'PERSON', code, name, description,
       tax_number, email, phone, address_id, is_active, is_system,
       is_sample, sample_batch_id, sort_order, metadata, ...)
```

`party` menjawab "dengan siapa kita bertransaksi". `Person` menjawab "siapa manusia ini".
Yang hilang untuk V13 §188:

| Dibutuhkan V13 | Ada di `party`? |
| --- | --- |
| `birthDate`, `sex` | tidak |
| `legalName` vs `preferredName` | tidak — hanya `name` |
| Identifier majemuk (NIK, NIM, NIS, NISN, no. santri) dengan masa berlaku | tidak — hanya `tax_number` |
| Relasi orang tua/wali yang effective-dated | tidak |
| Alamat versioned | tidak — satu `address_id` |
| Consent per tujuan dan kanal | tidak |
| Kandidat duplikasi dan riwayat merge | tidak |

Menambahkan tujuh hal itu ke `party` akan membuat satu tabel melayani dua pertanyaan
yang berbeda, dan `metadata JSONB` menjadi tempat pembuangan. Keduanya berakhir sebagai
data pribadi anak yang tersimpan tanpa aturan retensi.

**Putusan:** `Person` dibangun baru. `party` tetap untuk pihak bisnis, dan sebuah
`Person` dapat ditautkan ke `party` bila orang itu juga menjadi pemasok atau pelanggan.

## 3. Bentuk yang dituju

```text
Person ─┬─ PersonIdentifier   (NIK/NIM/NIS/NISN/no. santri, validFrom/To)
        ├─ PersonContact      (verifikasi + consent)
        ├─ PersonAddress      (versioned)
        ├─ PersonRelationship (wali, orang tua — effective-dated)
        ├─ ConsentRecord
        └─ profil domain:
             LearnerProfile ─┬─ StudentProfile   (eCampus)
                             ├─ PupilProfile     (eSchool)
                             └─ SantriProfile    (ePesantren)
             EmployeeProfile / LecturerTeacherProfile
             GuardianProfile / AlumniProfile / CooperativeMemberProfile

UserAccount ── UserTenantMembership ── UserRoleAssignment
```

`UserAccount` menunjuk `Person`. Satu manusia dapat menjadi santri **dan** siswa
tanpa dua biodata — kasus yang lumrah pada yayasan yang punya pesantren dan sekolah,
dan yang menentukan tagihan (lihat dokumen 06 §4).

## 4. Entity resolution

`IdentityMatchCandidate` dan `PersonMergeHistory` bukan hiasan. Pada penerimaan,
satu orang mendaftar lewat jalur berbeda pada tahun berbeda; NIK sering salah ketik;
nama ditulis berbeda.

Aturan yang harus dipegang:

- Merge **selalu** ditinjau manusia. Skor kemiripan hanya mengusulkan.
- Merge dapat dibatalkan (`unmerge`), karena merge yang salah menggabungkan dua anak
  yang berbeda menjadi satu — dan akibatnya menyentuh nilai, tagihan, dan rapor.
- Riwayat merge disimpan penuh: siapa, kapan, alasan, dan yang disetujui.
- Person hasil merge **tidak** dihitung dua kali pada billing (§187.3 "bukan
  duplicate/merged").

## 5. Wali dan portal

`GUARDIAN_CHILD` adalah data scope, bukan role belaka. Yang menentukan:

- Otoritas wali **versioned** — hak asuh dapat berubah, dan portal harus mengikuti
  keadaan yang berlaku pada saat diakses.
- Wali melihat anaknya sendiri. Tidak ada jalur yang membolehkan satu wali membaca
  data anak lain, termasuk lewat laporan atau ekspor.
- Catatan konseling dan kesehatan **tidak** otomatis terlihat wali; V13 §222 menandainya
  sensitif dan §193.2 menandai `CounselingCase` sebagai akses terbatas.

## 6. Multi-tenant dan lintas institusi

`Person` bersifat tenant-local. Yayasan dengan banyak institusi berada dalam satu
tenant, sehingga satu `Person` melayani seluruh unitnya — itulah yang membuat
deduplikasi lintas vertical mungkin.

Person lintas **tenant** tidak ditautkan otomatis. Menautkannya berarti satu tenant
dapat menyimpulkan keberadaan seseorang di tenant lain.

## 7. Tindakan E13-2

| Tindakan | Catatan |
| --- | --- |
| Tabel `Person` + 5 tabel pendukung | Schema `_core` atau `_education` sesuai registry |
| `LearnerProfile` sebagai supertype | Satu per (person, institution, learnerType) |
| Tautan `Person ↔ user_subject` | Tanpa mengubah rantai auth yang sudah teruji |
| Tautan opsional `Person ↔ party` | Untuk orang yang juga pemasok/pelanggan |
| Match candidate + merge/unmerge + audit | Merge wajib persetujuan manusia |
| Masking NIK dan identifier nasional | Sudah jadi aturan repo; ditegakkan di sini |
