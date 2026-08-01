# E13-0 · Inventaris Capability Sumber Legacy

Sumber legacy adalah **referensi capability**, bukan template tabel. Dokumen ini
mencatat apa yang benar-benar ada di sana, supaya keputusan pada
[02-reuse-extend-create-matrix.md](02-reuse-extend-create-matrix.md) berpijak pada
kenyataan.

---

## 1. Lokasi dan verifikasi

BRD §183 merujuk `src(1).zip`. Arsip itu tidak ada di mesin ini, tetapi pohon
sumbernya ada:

```text
C:\opt\AIS\ais\src\main\src\ais\action\master\
```

Terverifikasi: **6.475 berkas `.java`** di bawah `C:\opt\AIS\ais\src` (BRD menyebut
"sekitar 6.506 berkas" untuk seluruh arsip). Perbedaannya wajar — arsip memuat pula
berkas non-Java.

Jumlah class per modul dihitung ulang dan **cocok dengan tabel BRD §183.1**:

| Modul | BRD | Terhitung | Selisih |
| --- | ---: | ---: | ---: |
| pmb | 134 | 134 | 0 |
| psb | 10 | 10 | 0 |
| sekolah | 239 | 240 | +1 |
| obe | 21 | 21 | 0 |
| feeder | 62 | 62 | 0 |
| sister | 3 | 3 | 0 |
| akreditasi | 47 | 47 | 0 |
| bkd | 30 | 30 | 0 |
| spmi | 12 | 12 | 0 |
| spi | 12 | 12 | 0 |
| library | 141 | 141 | 0 |
| koperasi | 72 | 72 | 0 |
| inventory | 26 | 26 | 0 |
| akunting | 100 | 100 | 0 |
| payroll | 75 | 75 | 0 |
| surat | 46 | 46 | 0 |
| sop | 18 | 18 | 0 |

Angka BRD dapat dipercaya. Itu berarti inventaris capability-nya juga dapat dipakai
sebagai daftar kerja, bukan sekadar ilustrasi.

---

## 2. Modul yang ada di legacy tetapi tidak disebut BRD §183.1

Pemindaian direktori `master/` menemukan modul berikut yang **tidak** masuk tabel BRD:

```text
asset          kalender       recruitment    rab
apresiasi      kpi            sosial         ticket
chat           lkp            monitor        ux
dashboard      message        generic        helper
employ         sirkulasisurat epsbed         resources
```

Ditambah adapter bank/payment yang berdiri sendiri sebagai direktori:

```text
bni  bri  bsi  cimb  faspay  finpay  ipaymu  jatelindo  sapto
```

Dua di antaranya penting bagi E13 dan **tidak** ada di daftar BRD:

- **`asset`** — sarana/prasarana. Dapodik meminta data sarana; V13 §223 juga menyebut
  aset. Tidak ada modul asset di eBisnis saat ini (lihat dokumen 00 §2.4).
- **`kalender`** — kalender akademik. V13 §214 memerlukan `AcademicCalendar` dan
  `AcademicCalendarEvent`.

Adapter bank legacy menegaskan satu hal: integrasi pembayaran pendidikan **sudah pernah
dikerjakan** dengan host-to-host dan virtual account per bank. eBisnis Versi 9 sudah
punya jalur pembayaran sendiri (eSmartlink); legacy tidak perlu ditiru, tetapi
daftar bank yang pernah dipakai berguna untuk menakar cakupan.

---

## 3. Capability terbaca dari nama class

Nama class legacy cukup deskriptif untuk memetakan proses bisnis tanpa membaca isinya.
Contoh yang menentukan desain V13:

### 3.1 Penerimaan (pmb, psb)

```text
CalonMahasiswaAction, BiodataCalonMahasiswaAction, GelombangPendaftaranAction,
JenisSeleksiAction, UjianPMBAction, InterviewCalonMahasiswaAction,
VerifikasiKelengkapanCalonMahasiswaAction, DaftarUlangCalonMahasiswaAction,
GenerateNimCalonMahasiswaAkademikAction, AfiliasiCalonMahasiswaKeMahasiswaAction
```

Terbaca: gelombang, jalur/jenis seleksi, ujian, wawancara, verifikasi berkas, daftar
ulang, generator NIM, dan **konversi pendaftar menjadi mahasiswa**. Persis alur
`AdmissionPeriod → … → Conversion to Learner` pada V13 §195.

Catatan penting: ada **generator NIM per institusi** (`AakBorneoLestariNimGenerator`,
`AkfarsamNimGenerator`). Artinya format nomor induk berbeda per institusi dan
**harus configurable**, bukan hard-code.

### 3.2 Akademik

```text
KrsAction, KrsPaketAction, KrsNonPaketAction, KrsRemedialAction, NewKrsAction,
KurikulumAction, MatakuliahPrasyaratAction, MatakuliahEkivalenAction,
PembatasanNilaiIPKUntukPengambilanKRSAction, PembagianKuotaPerkuliahanBerdasarkantahunAngkatanAction,
NilaiMahasiswaAction, NilaiHurufAction, PembobotanNilaiAction, JudusiumAction, WisudaAction
```

Terbaca: KRS paket vs non-paket, remedial, prasyarat, ekuivalensi, **batas SKS
berdasarkan IPK**, kuota per angkatan, bobot nilai, yudisium, wisuda. Semuanya sudah
ada padanannya di V13 §191.2 dan §215 (`CreditLimitPolicy`, `CourseEquivalence`).

### 3.3 Pemeriksaan kelulusan berlapis

```text
PengecekanPendaftaranSidangKeuanganAction
PengecekanPendaftaranSidangProdiAction
PengecekanPendaftaranWisudaAdministrasiAction
PengecekanPendaftaranWisudaKeuanganAction
PengecekanPendaftaranWisudaPerpustakaanAction
```

Lima pemeriksa berbeda untuk satu keputusan. V13 §191.2 merangkumnya sebagai
`GraduationEligibility.checksJson` — dan §205 menegaskan bebas pustaka masuk lewat
**event**, bukan coupling langsung. Legacy membuktikan daftar pemeriksanya memang
banyak dan berbeda pemilik, sehingga bentuk daftar-yang-dapat-dikonfigurasi itu tepat.

### 3.4 Sekolah (240 class)

```text
AbsensiSiswaHelper, KelasSiswaPSBAction, MatapelajaranSekolahAction,
KonfigurasiSekolahAction, RencanaTahunAkademikSekolahAction, KuesionerSiswaAction,
KonfigurasiTampilanSiswaAction, KonfigurasiTampilanGuruAction, PostingDepositSiswaAction
```

Modul sekolah adalah yang **terbesar kedua** setelah SIRS. Ia bukan tempelan pada
modul kampus — ia domain tersendiri. Itu menguatkan keputusan V13 memisahkan eSchool
sebagai bounded context, bukan sebagai "mode" eCampus.

### 3.5 Pesantren

Tidak ada direktori `pesantren` di legacy. Yang ada hanya jejak tersebar:
`AsramaAction.java`, `JenisTinggalMahasiswaAction.java`, `KunjunganTamuAction.java`.

**Konsekuensi:** ePesantren adalah `NEW_BUILD` hampir seluruhnya — tahfiz, halaqah,
diniyah, marhalah, izin gerbang, uang saku, BMT tidak punya preseden legacy sama sekali.
Perkiraan usaha untuk E13-7 tidak boleh disamakan dengan E13-5 atau E13-6.

### 3.6 Integrasi nasional

```text
feeder/    62 class — AjarDosenIntegrator, AktifitasMahasiswaIntegrator, AkmIntegrator, ...
sister/     3 class — DasborSisterUiHelper, DasbordSinkronisasiSister, SisterAksiHelper
epsbed/     ImportFromEpsbedAction (pendahulu Feeder)
```

Rasio 62 : 3 itu memberi tahu banyak. Feeder/PDDikti adalah integrasi **berat dan
per-entitas**; SISTER jauh lebih tipis — pada legacy ia praktis hanya dasbor sinkronisasi.
E13-9 harus merencanakan usaha yang sangat berbeda untuk keduanya, dan tidak menjanjikan
kedalaman SISTER yang setara Feeder.

Terbaca pula `EksporFromFeederAction` dan `ImportFromFeederAction` — dua arah, sehingga
rekonsiliasi V13 §202.1 memang beralasan.

---

## 4. Temuan arsitektural yang menentukan larangan V13

| Temuan pada legacy | Dampak pada aturan V13 |
| --- | --- |
| `*Action.java` memuat query dan aturan bisnis sekaligus | Pisahkan controller / application service / domain service / repository |
| `KonfigurasiTampilan*Action` untuk biodata mahasiswa, siswa, dosen, pegawai secara terpisah | Satu `Person` + profil domain, bukan empat biodata |
| Generator NIM per institusi sebagai class Java | Nomor induk menjadi data/policy, bukan kode |
| `ParameterTambahan*` untuk hampir setiap entitas (18 varian) | Perlu mekanisme custom field yang **satu**, bukan per entitas |
| Adapter bank sebagai direktori terpisah per bank | Pakai payment core; jangan menambah adapter di domain pendidikan |
| `TemplateQueryAction` / `ExecuteTemplateQueryAction` | Legacy mengizinkan SQL bebas dari UI. Dilarang keras di V13 |

Baris terakhir perlu ditegaskan: `ExecuteTemplateQueryAction` berarti pengguna dapat
menjalankan query tersimpan. Aturan eBisnis melarang SQL bebas dan melarang nama schema
berasal dari request. Capability itu **tidak dimigrasikan**, dan pengganti yang sah
adalah laporan terdefinisi plus ekspor Excel/PDF.

---

## 5. Yang tidak dapat disimpulkan dari nama berkas

Audit ini membaca struktur dan nama, bukan isi 6.475 berkas. Karena itu hal berikut
**belum** diketahui dan harus diperiksa saat fase terkait, bukan diasumsikan:

- Aturan perhitungan IPK/IPS yang tepat (pembulatan, bobot, mata kuliah mengulang).
- Aturan kenaikan kelas dan kelulusan sekolah.
- Format dan aturan validasi Feeder yang berlaku sekarang.
- Struktur tagihan dan tunggakan, termasuk cicilan dan denda.
- Aturan honor mengajar pada payroll.

Kelima hal itu menyangkut uang atau status akademik. Menebaknya lebih mahal daripada
membacanya, dan keduanya lebih murah daripada memperbaikinya sesudah dipakai.
