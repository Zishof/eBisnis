# H-0 · Rencana Implementasi

Dua belas fase pada perintah §5, dengan satu penyesuaian urutan yang beralasan,
dan penandaan jujur atas apa yang terhalang sejak sekarang.

---

## Penyesuaian urutan yang diusulkan

Perintah menempatkan identitas pasien di H-2, sesudah fasilitas di H-1. Urutan
itu benar untuk sebagian besar isinya, tetapi **tiga hal dari H-2 harus naik ke
H-1**:

```
Patient
MedicalRecordNumber
deteksi ganda
```

Alasannya: `Appointment` pada H-2 dan **setiap konteks sesudahnya** menunjuk
pasien. Membangun janji temu di atas identitas yang belum punya aturan
penggandaan berarti menumpuk janji temu, kunjungan, resep, dan hasil pada rekam
medis ganda. Membersihkannya kemudian menuntut penggabungan ribuan baris di
belasan tabel — dan setiap penggabungan yang salah adalah bahaya klinis.

Mencegahnya berbiaya beberapa hari. Memperbaikinya berbiaya berbulan-bulan, dan
sebagian tidak dapat diperbaiki.

Sisa H-2 (janji temu, pendaftaran, antrean) tetap di H-2.

---

## Fase

### H-1 · Fasilitas, portal, profil tenant, billing, **dan identitas pasien inti**

| Keluaran | Catatan |
|---|---|
| Migrasi `H001__health__facility.sql` | `health_tenant_profile`, `health_facility`, `health_facility_type`, unit layanan, poliklinik, bangsal, kamar, tempat tidur |
| Migrasi `H002__health__patient_identity.sql` | `patient`, `patient_identifier`, `medical_record_number`, `patient_name_history`, `patient_potential_duplicate` |
| Delapan port + adapter | `modules/emedik/ports/`, `modules/emedik/adapters/` |
| Katalog menu, peran, hak akses kesehatan | Berkas tersendiri; tidak menyentuh registri global |
| Jenjang tarif pendaftaran | Termasuk definisi tegas `BillablePatientRegistration` |
| Portal `emedik.id` | Pendaftaran fasilitas, pilih jenis, buat tenant |
| Uji | ≥ 20 |

**Yang harus benar sejak fase ini** (lihat [05](05-security-threat-model.md)):
pencatatan pembacaan, tujuan penggunaan, catatan tidak dapat diubah, penandaan
data sensitif tinggi. Keempatnya tidak dapat ditambahkan belakangan tanpa
membongkar.

### H-2 · Janji temu, pendaftaran, antrean

Sisa identitas pasien (`PatientConsent`, `PatientProxy`, `PatientMerge`,
`PatientFamilyLink`), lalu `Appointment`, `Schedule`, `ProviderAvailability`,
pendaftaran daring dan langsung, rujukan, antrean, dan pemantauan waktu tunggu.

Uji ≥ 40. Ini fase dengan uji terbanyak, dan memang seharusnya.

### H-3 · Rawat jalan, dokumentasi klinis, order

`OutpatientEncounter`, SOAP, tanda vital, masalah, diagnosis, tindakan, alergi,
peringatan klinis, `ClinicalOrder`, `OrderSet`, surat keterangan medis.

Uji ≥ 30. **Invarian:** catatan bertanda tangan tidak dapat diubah.

### H-4 · Farmasi, obat, adapter persediaan, billing — **SELESAI**

Resep, telaah apoteker, penyerahan, substitusi, obat terkendali, peringatan
interaksi dan alergi, eMAR dengan enam benar.

Uji ≥ 35 → **60 tercapai**, ditambah naskah bukti 44 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H006__health__pharmacy.sql`, `H007__health__pharmacy_permissions.sql` |
| Aturan murni | `health-medication.ts` + 60 pengujian |
| Layanan | `health-pharmacy.service.ts` |
| Adapter persediaan | `adapters/inventory.adapter.ts` |
| Endpoint | `health-pharmacy.controller.ts` — 8 jalan di `/api/v1/health/pharmacy/**` |
| Layar | `apps/web/src/verticals/health/PharmacyPage.tsx` |
| Bukti | `scripts/prove-health-pharmacy.mjs` → [bukti-h4-farmasi.txt](bukti-h4-farmasi.txt) |

**Keputusan yang menentukan bentuknya**

- **Aturan keselamatan obat dipisahkan sebagai fungsi murni.** Enam benar dan
  pemeriksaan alergi harus dapat diuji dalam hitungan milidetik dan dalam
  puluhan kombinasi. Aturan yang hanya dapat diuji lewat basis data akan diuji
  tiga kali, bukan enam puluh.

- **Adapter persediaan memakai ulang `applyBalanceDelta` milik Core, tetapi
  TIDAK memakai ulang `consumeAvailable`.** Yang terakhir mengurutkan lot dengan
  FEFO tanpa menyaring: lot yang sudah kedaluwarsa berada di urutan paling
  depan. Untuk barang dagangan itu benar; untuk obat itu berarti obat
  kedaluwarsa akan menjadi yang pertama diserahkan kepada pasien.

- **Peringatan pemblokir boleh dilewati dengan alasan tertulis.** Menolak
  seluruhnya akan memindahkan peresepan ke kertas — di luar sistem, tanpa jejak
  sama sekali. Yang dicapai bukan keselamatan, melainkan kebutaan. Alasannya
  tersimpan bersama peringatan yang dilewati pada `override_alerts`.

- **Hanya peringatan yang benar-benar berbahaya yang memblokir.** Alergi berat
  dan fatal, kontraindikasi, dan dosis dua kali lipat batas. Alergi ringan,
  interaksi mayor, dan penandaan obat memperingatkan tanpa menahan. Sistem yang
  memperingatkan segalanya sama tidak amannya dengan yang tidak memperingatkan
  apa pun — bedanya, yang pertama merasa aman.

- **Empat menu, bukan satu.** Meresepkan, menelaah, menyerahkan, memberikan.
  Pemisahan yang hanya ada di dalam kode, tidak di dalam daftar hak akses yang
  dilihat administrator, tidak menahan siapa pun.

**Yang belum:** substitusi otomatis menurut formularium, rekonsiliasi obat saat
masuk dan pulang (menunggu H-6), penarikan sediaan, dan pelaporan narkotika ke
SIPNAP. Kode peristiwa akuntansi `HEALTH_*` masih menunggu keputusan Core, jadi
penyerahan obat belum memicu pencatatan harga pokok.

### H-5 · Laboratorium, radiologi, hasil — **SELESAI**

Katalog, pesanan, spesimen, daftar kerja, hasil, rentang rujukan, hasil kritis
dengan penerimaan wajib, verifikasi, amandemen.

Uji ≥ 30 → **64 tercapai**, ditambah naskah bukti 44 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H008__health__laboratory.sql`, `H009__health__laboratory_permissions.sql` |
| Aturan murni | `health-lab.ts` + 64 pengujian |
| Layanan | `health-lab.service.ts` |
| Endpoint | `health-lab.controller.ts` — 12 jalan di `/api/v1/health/lab/**` |
| Layar | `apps/web/src/verticals/health/LabPage.tsx` |
| Bukti | `scripts/prove-health-lab.mjs` → [bukti-h5-laboratorium.txt](bukti-h5-laboratorium.txt) |

**Keputusan yang menentukan bentuknya**

- **Nilai kritis punya tabelnya sendiri**, bukan kolom pada hasil. Satu nilai
  kritis dapat disampaikan berkali-kali sebelum ada yang menerimanya, dan
  setiap percobaan itu berharga ketika kelak ditanya mengapa hasilnya terlambat
  sampai. Catatan penyampaiannya terbuka **sendiri** begitu hasilnya dinilai
  kritis — menunggu seseorang menekan tombol "sampaikan" berarti nilai kritis
  yang terlupa tidak meninggalkan jejak bahwa ia pernah ada.

- **Penerimaan menuntut bacaan ulang, dicocokkan di peladen.** "Sudah saya
  sampaikan" tanpa bacaan ulang hanya mencatat bahwa telepon berdering.

- **Rentang rujukan bergantung umur DAN jenis kelamin.** Hemoglobin 11 g/dL
  wajar pada anak dan menunjukkan anemia pada laki-laki dewasa. Rentang yang
  dipakai **disalin** ke baris hasilnya, bukan dirujuk: rentang berubah ketika
  alat diganti, dan hasil tahun lalu harus tetap dapat dijelaskan dengan
  rentang tahun lalu.

- **Hasil tanpa rentang yang berlaku dinyatakan `UNKNOWN`, bukan normal.**
  Menandainya normal adalah berbohong; menandainya tinggi juga.

- **Verifikasi otomatis tidak pernah untuk nilai kritis** dan tidak pernah
  ketika pemeriksaan delta mencurigakan. Nilai kritis yang lolos tanpa dilihat
  siapa pun akan masuk ke rekam medis tanpa ada seorang pun yang tahu ia pernah
  ada.

- **Spesimen tanpa label tidak pernah diterima.** Keyakinan yang salah tentang
  identitas spesimen menghasilkan hasil yang benar secara analitis, dilaporkan
  dengan percaya diri, dan tertempel pada orang yang keliru — dan ia akan
  dipercaya, karena laboratorium jarang salah.

- **Sebab penolakan spesimen dibatasi daftar tertutup.** Teks bebas membuat
  "hemolisis", "hemolysed", dan "darah pecah" menjadi tiga hal berbeda bagi
  laporan mutu, dan laporan yang tidak dapat menghitung sebab penolakan tidak
  dapat memperbaikinya.

- **Nilai kritis ditempatkan di atas daftar kerja pada layar, bukan di tab
  tersendiri.** Tab tersendiri berarti seseorang harus memilih untuk melihatnya,
  dan laboratorium yang sibuk tidak memilih — ia mengerjakan apa yang ada di
  depan mata.

**Yang belum:** laboratorium rujukan luar, antarmuka alat (HL7/ASTM), pemesanan
berpaket (order set), dan PACS/DICOM. Yang terakhir tetap **terhalang** — yang
disimpan baru rujukan citra; arsitektur penyimpanannya menunggu keputusan Core.

### H-6 · Rawat inap, ADT, tempat tidur, keperawatan — **SELESAI**

Masuk, pindah, pulang, permintaan dan penetapan tempat tidur, ronde, rencana
asuhan, ringkasan pulang, pulang paksa, kematian, pembersihan tempat tidur;
seluruh asesmen dan intervensi keperawatan.

Uji ≥ 30 → **53 tercapai**, ditambah naskah bukti 41 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H010__health__inpatient.sql`, `H011__health__inpatient_permissions.sql` |
| Aturan murni | `health-inpatient.ts` + 53 pengujian |
| Layanan | `health-inpatient.service.ts` |
| Endpoint | `health-inpatient.controller.ts` — 8 jalan di `/api/v1/health/inpatient/**` |
| Layar | `apps/web/src/verticals/health/WardPage.tsx` |
| Bukti | `scripts/prove-health-inpatient.mjs` → [bukti-h6-rawat-inap.txt](bukti-h6-rawat-inap.txt) |

**Invarian yang ditegakkan basis data**

- **Satu tempat tidur, satu pasien** — indeks unik parsial
  `ux_health_bed_one_patient` pada `health_bed_assignment (bed_id) WHERE
  released_at IS NULL`. Naskah bukti menembusnya dari dua arah: lewat API, dan
  lewat `INSERT` langsung. Keduanya ditolak.
- **Satu perawatan, satu tempat tidur** — indeks kedua ke arah sebaliknya.
- **Satu pasien, satu perawatan inap aktif** — pasien yang tercatat dirawat di
  dua tempat akan memperoleh dua jadwal obat, dua daftar pemeriksaan, dan dua
  tagihan tanpa ada bagian sistem yang dapat memutuskan mana yang benar.
- **Tempat tidur yang baru ditinggalkan bukan tempat tidur yang kosong** —
  perpindahan `OCCUPIED → AVAILABLE` sengaja tidak ada pada peta status; ia
  wajib melewati `CLEANING`.

**Keputusan lain yang menentukan bentuknya**

- **Nilai kritis yang belum diterima menahan pemulangan** — kecuali pada
  kematian, di mana menahannya tidak lagi menolong siapa pun dan hanya membuat
  keluarga menunggu. Inilah sambungan nyata pertama antara H-5 dan H-6.
- **Pulang paksa TIDAK ditolak.** Menolaknya berarti menahan orang di rumah
  sakit di luar kehendaknya, dan itu bukan wewenang sistem. Yang dituntut adalah
  alasannya tercatat, supaya kelak dapat dibedakan dari pasien yang pulang
  karena sudah sembuh.
- **Isolasi diperiksa sebelum jenis kelamin.** Bila keduanya bermasalah, yang
  disebut haruslah yang membahayakan pasien lain, bukan yang membuat tidak
  nyaman.
- **Pasien biasa mengisi kamar yang sudah berpenghuni; pasien isolasi justru
  diberi kamar kosong.** Menyebar pasien ke kamar-kamar kosong terdengar ramah,
  tetapi menghabiskan kamar yang esok hari dibutuhkan pasien isolasi — dan
  pasien isolasi yang tidak memperoleh kamar akan ditolak masuk.
- **Skor peringatan dini disimpan, bukan dihitung ulang saat dibaca.** Rumusnya
  kelak disesuaikan, dan pengamatan bulan lalu harus tetap dapat dijelaskan
  dengan rumus bulan lalu. Tanda vital yang tidak diukur dilaporkan sebagai
  tidak diukur — menganggapnya normal menghasilkan skor rendah pada pasien yang
  justru belum diperiksa.
- **`health_room` dan `health_bed` DIPERLUAS, bukan dibuat ulang.** H001 sudah
  membuat keduanya, dan komentarnya sendiri menyebut bahwa penetapan pasien
  menyusul pada H-6. Nama kolomnya diikuti apa adanya — `bed_status`, bukan
  `status` — karena mengganti nama kolom yang sudah applied berarti mengubah
  migrasi yang sudah berjalan.

**Yang belum:** permintaan tempat tidur berantre, ronde terjadwal, rencana
asuhan keperawatan berbasis diagnosis keperawatan, dan rekonsiliasi obat saat
masuk dan pulang.

### H-7 · IGD, operasi, ICU, layanan khusus

Triase, disposisi; permintaan dan jadwal operasi, daftar periksa bedah, catatan
operasi, anestesi, pemulihan; perawatan intensif; dialisis, onkologi,
rehabilitasi, gigi, kesehatan jiwa; kebidanan dan neonatal.

Uji ≥ 35.

### H-8 · Puskesmas dan Posyandu

UKP, UKM, wilayah kerja, folder keluarga, sasaran program, penyakit menular dan
tidak menular, KIA, imunisasi, gizi, kesehatan lingkungan dan sekolah, kunjungan
rumah; jadwal Posyandu, kader, meja layanan, pengukuran pertumbuhan, KMS
digital, risiko stunting.

Uji ≥ 30.

**Catatan yang perlu diingat saat merancang antarmukanya:** Posyandu dijalankan
kader — bukan tenaga medis — sering tanpa internet, dan sasarannya populasi,
bukan pasien yang datang. Antarmukanya tidak boleh sekadar versi kecil dari
layar rumah sakit.

### H-9 · Klaim, rekam medis, koding, mutu, keselamatan

Tangkap tagihan, tagihan pasien, deposit, penjamin, klaim, rekonsiliasi,
casemix, koding; kelengkapan rekam medis, pelepasan informasi, retensi,
penahanan hukum; indikator mutu, insiden keselamatan pasien, PPI, kredensial dan
kewenangan klinis.

Uji ≥ 30.

### H-10 · Portal pasien, website, integrasi

Website fasilitas, profil, dokter, jadwal, layanan; portal pasien dengan janji
temu, antrean, hasil yang boleh dibuka, resep, ringkasan kunjungan, akses wali.

Uji ≥ 25. **Invarian:** pasien hanya melihat datanya sendiri; identitas dari
token, tidak pernah dari parameter.

SATUSEHAT, BPJS, alat laboratorium, dan PACS dibangun sebagai antarmuka dengan
implementasi tiruan — kredensialnya belum ada, dan perintah §25 melarang
mengarangnya.

### H-11 · Peran, Help, data contoh, laporan

29 peran, data contoh 50–100 baris per jenis, laporan.

Uji ≥ 25. **Help terhalang** — kerangka Pusat Bantuan tidak pernah dibangun
(V8-1/V8-2). **Ekspor Excel dan cetak PDF terhalang** (V8-5/6, V8-7).

### H-12 · Keamanan, E2E, kinerja, UAT

Zona data kesehatan, tujuan penggunaan, break-glass, penyamaran medan, isolasi
antar-tenant dan antar-vertical, pola redaksi AI untuk data kesehatan.

Uji ≥ 40.

---

## Yang terhalang sejak sekarang

Disebutkan di muka, bukan ditemukan pada fasenya. Tidak satu pun menghentikan
eMedik; masing-masing menurunkan mutu pada bagiannya.

| Terhalang | Sebab | Akibat |
|---|---|---|
| Pusat Bantuan (H-11) | V8-1/V8-2 tidak pernah dibangun; tidak ada tabel bantuan | Panduan dalam aplikasi tidak ada |
| Ekspor Excel (H-11) | V8-5/6 tidak pernah dibangun | Laporan hanya di layar |
| Cetak PDF (H-9, H-11) | V8-7 tidak pernah dibangun | Ringkasan pulang dan hasil tidak dapat diunduh sebagai PDF |
| SATUSEHAT (H-10) | Kredensial dan kontrak belum ada | Antarmuka + tiruan |
| BPJS (H-9, H-10) | Sama | Klaim tidak dapat dikirim otomatis |
| PACS/DICOM (H-5) | Perlu arsitektur penyimpanan | Metadata saja |
| Alat laboratorium (H-5) | Protokol bergantung merek | Entri manual |

---

## Yang menunggu keputusan Core

| | Menghalangi | Jalan sementara |
|---|---|---|
| [IR 001](../integration-requests/health/001-health-namespace-collision.md) — nama `modules/health` | Tidak menghalangi | Memakai `modules/emedik/` |
| [IR 002](../integration-requests/health/002-modular-migration-catalog.md) — katalog migrasi modular | Tidak menghalangi | Awalan `H###`, `sequence` mulai 1000 |
| Kode peristiwa `HEALTH_*` (H-4) | Menghalangi posting akuntansi | Diajukan pada H-4 |

Keduanya yang pertama tidak menghentikan H-1. Menunggu jawaban sebelum mulai
akan menghentikan pekerjaan tanpa alasan teknis.
