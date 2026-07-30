# Aturan Resolusi Aktor SOP Legacy

> Fase V6-0. Dikarakterisasi dari `SopUtil.java` (717 baris), terutama
> `resolveAktor(...)` (baris 93-98) dan `hitungAktor(...)` (baris 124-258),
> serta entity `AktorSop`.

## Sumber penetapan aktor pada legacy

Aktor sebuah step dapat berasal dari **tiga tempat sekaligus**, dengan presedensi
yang tidak dinyatakan eksplisit:

| Sumber | Field | Tipe |
| --- | --- | --- |
| Aktor terdefinisi | `AlurSop.aktorSop` → `AktorSop` | FK |
| Aktor ad-hoc pada step | `AlurSop.aktor` (string), `AlurSop.khususUsername` | String comma-separated |
| Aktor default per jenis | `JenisSop.aktorSop` | FK |

**Temuan:** presedensi antar ketiganya hanya tersirat dari urutan kode, tidak
terdokumentasi, dan tidak dapat diaudit. V6 menjadikannya baris data eksplisit
pada `WorkflowActorRule` dengan kolom `sequence` sehingga presedensi terlihat.

## Sebelas aturan aktor sebagai kolom boolean

`AktorSop` menyimpan tipe aturan sebagai kolom boolean terpisah:

| Kolom boolean | Arti | Padanan V6 (`WorkflowActorRule.ruleType`) |
| --- | --- | --- |
| `semuaPegawai` | seluruh pegawai | `ALL_EMPLOYEE` |
| `semuaGuru` | seluruh guru | domain akademik — tidak dibawa |
| `semuaDosen` | seluruh dosen | domain akademik — tidak dibawa |
| `semuaMahasiswa` | seluruh mahasiswa | domain akademik — tidak dibawa |
| `semuaSiswa` | seluruh siswa | domain akademik — tidak dibawa |
| `kaprodiPengajuMahasiswa` | ketua prodi dari pengaju | `MANAGER_OF_REQUESTER` (hierarki) |
| `dekanPengajuMahasiswa` | dekan dari pengaju | `MANAGER_OF_REQUESTER` tingkat 2 |
| `dosenPaPengajuMahasiswa` | pembimbing akademik pengaju | `OWNER_OF_ENTITY` |
| `kaprodiPengajuDosen` | ketua prodi dari pengaju dosen | `MANAGER_OF_REQUESTER` |
| `dekanPengajuDosen` | dekan dari pengaju dosen | `MANAGER_OF_REQUESTER` tingkat 2 |
| `semuaAtasanPejabat` | seluruh atasan pejabat | `ALL_MANAGERS` |
| `semuaAtasanLangsungPegawai` | atasan langsung pegawai | `DIRECT_MANAGER` |

**Masalah struktural:** menambah satu tipe aktor baru memerlukan
`ALTER TABLE` + perubahan kode. Ini bertentangan dengan BRD V6 WF-008 yang
mensyaratkan resolver mendukung "role, user, manager, owner, requester, dynamic
expression" secara konfigurasi.

## Perilaku `hitungAktor(...)` yang wajib dipertahankan

Dari `SopUtil.java:124-258`:

1. **Resolusi berbasis role, comma-separated.** `jenisPengguna` dipecah dengan
   koma; setiap role dicocokkan terhadap daftar role pengguna dengan pembungkus
   koma (`","+role+","`) agar tidak terjadi pencocokan sebagian
   (baris 136 pada blok: `userRoles.indexOf("," + role.toLowerCase() + ",") >= 0`).
   Perilaku "cocok utuh, bukan substring" ini **wajib dipertahankan** — tanpa itu
   role `admin` akan cocok dengan `superadmin`.
2. **Resolusi berbasis username eksplisit.** `khususUser` dipecah dengan koma
   dan dicocokkan per username.
3. **Case-insensitive.** Perbandingan role memakai `toLowerCase()`.
4. **Filter pengguna aktif.** `isAktif(tbmuser)` menyaring pengguna nonaktif
   (baris 505). Task tidak boleh ditugaskan ke akun nonaktif.
5. **Identitas pengguna yang sama.** `isSameUser(current, target)` (baris 436)
   menentukan apakah pengguna saat ini adalah aktor yang dituju.
6. **Deduplikasi aktor.** `putAktor(...)` + `createUserKey(...)` (baris 392-399)
   mencegah satu pengguna muncul dua kali sebagai kandidat.

## Pencampuran layer yang tidak dibawa

`SopUtil.renderAktor(LinkedHashMap<String, Tbmuser>, Component hbox)` (baris 322)
menerima komponen ZK dan melakukan rendering **di dalam util resolusi aktor**.
V6 memisahkan:

```text
WorkflowActorResolver  -> mengembalikan daftar kandidat (tanpa UI)
WorkflowTaskCandidate  -> menyimpan kandidat sebagai baris data
UI React               -> merender dari API
```

Manfaatnya bukan kerapian saja: resolver tanpa dependensi UI dapat diuji unit dan
dijalankan pada background job (eskalasi, reminder) yang tidak punya konteks UI.

## Rancangan `WorkflowActorRule` untuk V6

```text
WorkflowActorRule
  id
  workflowStepId          FK
  sequence                urutan presedensi, eksplisit
  ruleType                ROLE | USER | REQUESTER | DIRECT_MANAGER
                          | MANAGER_LEVEL | ALL_MANAGERS | ALL_EMPLOYEE
                          | DEPARTMENT_MEMBER | OUTLET_MEMBER
                          | ENTITY_OWNER | AMOUNT_APPROVER
  roleCode                nullable
  userSubjectId           nullable
  departmentId            nullable
  outletId                nullable
  managerLevel            nullable (1 = atasan langsung)
  amountThreshold         nullable Decimal
  isMandatory             boolean
  isActive / deletedAt / version
```

Aturan V6 yang tidak ada pada legacy tetapi disyaratkan BRD:

- `AMOUNT_APPROVER` — approver ditentukan nilai transaksi (WF-003: policy berbeda
  per company/outlet/amount);
- `OUTLET_MEMBER` / `DEPARTMENT_MEMBER` — scope organisasi eBisnis;
- `ENTITY_OWNER` — pemilik data (mis. pemilik outlet untuk PR outlet tersebut).

## Uji karakterisasi yang wajib ada

Test berikut mengunci perilaku legacy yang dipertahankan, sehingga redesign
terbukti tidak menurunkan fungsi:

| Test | Perilaku yang dikunci |
| --- | --- |
| role `admin` tidak cocok dengan `superadmin` | pencocokan role utuh, bukan substring |
| role dibandingkan case-insensitive | `Admin` = `admin` |
| pengguna nonaktif tidak menjadi kandidat | filter `isAktif` |
| satu pengguna dengan dua role yang cocok muncul sekali | deduplikasi kandidat |
| `REQUESTER` selalu resolve ke pengaju instance | `kembaliKePengaju` |
| `DIRECT_MANAGER` resolve ke atasan langsung pengaju | `semuaAtasanLangsungPegawai` |
| step tanpa aktor yang resolve menghasilkan error, bukan task tanpa pemilik | mencegah task menggantung |
