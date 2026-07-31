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

### H-7 · IGD, operasi, ICU, layanan khusus — **SELESAI**

Triase, disposisi; permintaan dan jadwal operasi, daftar periksa bedah, catatan
operasi, anestesi, pemulihan; perawatan intensif; dialisis, onkologi,
rehabilitasi, gigi, kesehatan jiwa; kebidanan dan neonatal.

Uji ≥ 35 → **60 tercapai**, ditambah naskah bukti 55 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H012__health__acute_care.sql`, `H013__health__acute_permissions.sql` |
| Aturan murni | `health-acute.ts` + 60 pengujian |
| Layanan | `health-acute.service.ts` |
| Endpoint | `health-acute.controller.ts` — 13 jalan di `/api/v1/health/acute/**` |
| Layar | `apps/web/src/verticals/health/EmergencyPage.tsx` |
| Bukti | `scripts/prove-health-acute.mjs` → [bukti-h7-akut.txt](bukti-h7-akut.txt) |

**Invarian yang ditegakkan basis data**

- **Jeda sebelum sayatan tidak dapat dicentang belakangan** — constraint
  `ot_case_timeout_before_incision` menuntut waktu penyelesaiannya mendahului
  waktu sayatan. Daftar periksa yang diisi setelah operasinya selesai tidak
  menahan apa pun; ia hanya membuat berkasnya tampak rapi.
- **Satu kamar operasi, satu operasi pada satu waktu** — constraint pengecualian
  `EXCLUDE USING gist` atas rentang waktu terjadwal. Naskah bukti menembusnya
  lewat `INSERT` langsung; ditolak.
- **Tingkat triase akhir tidak pernah lebih ringan daripada yang diusulkan** —
  constraint `ed_visit_level_not_softened`.
- **"Pergi tanpa dilihat" hanya untuk pasien yang belum pernah dilihat dokter** —
  constraint `ed_visit_lwbs_never_seen`.

**Keputusan yang menentukan bentuknya**

- **Tanda bahaya MENAIKKAN tingkat triase, tidak pernah menurunkannya.** Petugas
  boleh menilai lebih gawat daripada tanda vitalnya — ia melihat pasiennya,
  sistem tidak — tetapi tidak boleh menilai lebih ringan. Triase yang terlalu
  rendah lebih berbahaya daripada yang terlalu tinggi: yang pertama membuat
  pasien menunggu berjam-jam sementara penyakitnya berjalan; yang kedua hanya
  membuang waktu petugas.

- **Tingkat yang diusulkan DAN tingkat akhir disimpan keduanya.** Selisihnya
  adalah data mutu IGD yang paling berharga: seberapa sering penilaian manusia
  lebih ringan daripada tanda vitalnya. Ditampilkan pula di layar, karena
  petugas yang melihat penilaiannya dinaikkan akan menilai lebih cermat lain
  kali; yang tidak pernah melihatnya tidak akan.

- **Menurunkan tingkat menuntut alasan; menaikkan tidak.** Penurunan tingkatlah
  yang membuat pasien menunggu lebih lama, dan di sanalah tekanan antrean paling
  mudah menyusup. Setiap perubahan meninggalkan barisnya sendiri, dan barisnya
  tidak dapat diubah.

- **Yang mengisi daftar periksa bukan yang menyayat.** Jeda sebelum sayatan
  adalah percakapan tim, bukan centang satu orang. Dokter bedah memperoleh
  `INCISE` tetapi tidak `CHECKLIST`; perawat instrumen sebaliknya.

- **Sisi yang ditandai dibandingkan dengan persetujuan tindakan sebelum
  sayatan.** Bila berbeda, jawabannya bukan peringatan melainkan penolakan
  dengan kata "HENTIKAN" — tidak ada seorang pun di kamar operasi yang dapat
  memastikan mana yang benar tanpa bertanya kepada pasien, yang sudah terbius.

- **Hitungan kasa yang tidak cocok menahan, tetapi ada jalan keluarnya.**
  Menahannya tanpa jalan keluar sama sekali akan membuat orang mematikan
  sistemnya, dan sistem yang dimatikan tidak menahan apa pun. Yang dituntut
  adalah pencariannya tercatat.

- **Dukungan organ ganda selalu dinyatakan kritis apa pun skornya.** Pasien
  dengan ventilator dan vasopresor sekaligus adalah pasien yang tanda vitalnya
  tampak baik justru karena mesin yang menahannya, dan skor yang membaca tanda
  vital saja akan menyimpulkan ia sedang membaik.

**Yang belum:** rekam anestesi berkelanjutan, ruang pemulihan beserta skor
Aldrete, dialisis, onkologi, rehabilitasi, gigi, kesehatan jiwa, serta kebidanan
dan neonatal. Kelima yang terakhir menuntut model datanya sendiri dan lebih
tepat menjadi fase tersendiri daripada disisipkan di sini.

### H-8 · Puskesmas dan Posyandu — **SELESAI**

UKP, UKM, wilayah kerja, folder keluarga, sasaran program, penyakit menular dan
tidak menular, KIA, imunisasi, gizi, kesehatan lingkungan dan sekolah, kunjungan
rumah; jadwal Posyandu, kader, meja layanan, pengukuran pertumbuhan, KMS
digital, risiko stunting.

Uji ≥ 30 → **54 tercapai**, ditambah naskah bukti 45 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H014__health__community.sql`, `H015__health__community_permissions.sql` |
| Aturan murni | `health-community.ts` + 54 pengujian |
| Layanan | `health-community.service.ts` |
| Endpoint | `health-community.controller.ts` — 9 jalan di `/api/v1/health/community/**` |
| Bukti | `scripts/prove-health-community.mjs` → [bukti-h8-puskesmas.txt](bukti-h8-puskesmas.txt) |

**Keputusan yang menentukan bentuknya**

- **Tabel rujukan pertumbuhan WHO adalah DATA, bukan kode.** Disimpan sebagai
  LMS pada `growth_reference` dan dimuat layanan saat menghitung. Menanam angka
  hasil taksiran di dalam kode akan menghasilkan klasifikasi stunting yang
  tampak resmi dan sebenarnya karangan — dan klasifikasi itu dipakai menentukan
  siapa menerima bantuan pangan. Tanpa baris yang berlaku, jawabannya "belum
  dapat dinilai", bukan "normal".

- **Stunting menahun, wasting akut**, dan pesannya menyebutkan perbedaan itu.
  Anak pendek karena kurang gizi bertahun-tahun menuntut perbaikan pangan
  keluarga; anak kurus karena sakit pekan lalu menuntut pengobatan sekarang.
  Menukar keduanya berarti mengirim bantuan yang keliru kepada anak yang keliru.

- **Cara pengukuran tinggi wajib disebutkan, dan dibetulkan bila tidak sesuai
  umur.** Berbaring dan berdiri berselisih sekitar 0,7 cm — cukup untuk
  memindahkan anak melintasi ambang −2 simpangan baku. Pembetulannya dilaporkan,
  dan nilai aslinya tetap disimpan.

- **Vaksin yang terlalu cepat DITOLAK, bukan diperingatkan**, dan penolakannya
  menyebut tanggal paling awalnya. Vaksin sebelum umur minimum tidak membentuk
  kekebalan yang cukup — dan yang lebih berbahaya, ia akan tercatat sebagai
  diberikan; anak itu lalu tampak lengkap di laporan cakupan dan tidak akan
  dikejar siapa pun.

- **Kader bukan petugas Puskesmas.** Peran `HEALTH_CADRE` sengaja TIDAK diberi
  `HEALTH_PATIENT.READ` dan tidak diberi `IMMUNIZE`. Ia melihat anak-anak lewat
  folder keluarganya, bukan lewat pencarian pasien seluruh fasilitas —
  perbedaannya menentukan: yang pertama menampilkan empat puluh anak di desanya,
  yang kedua menampilkan seluruh rekam medis kabupaten.

- **"Berat tidak naik dua kali berturut-turut" dipertahankan** di samping
  z-score. Ia penanda yang dipakai Posyandu jauh sebelum z-score mana pun, dan
  masih yang paling berguna: tidak menuntut tabel rujukan, tidak menuntut umur
  yang tepat, dan dapat dilihat kader dari buku KMS di tangannya.

- **Penyebut cakupan adalah SASARAN, bukan yang datang.** Menghitung "berapa
  persen yang datang sudah diimunisasi" akan selalu mendekati seratus persen dan
  tidak memberi tahu apa pun.

- **Jadwal imunisasi nasional disemai sebagai baris tabel**, supaya penyesuaian
  kelak menjadi perubahan data — bukan penerbitan versi aplikasi.

**Yang belum:** layar web Posyandu (yang menuntut rancangan luring tersendiri —
lihat catatan di bawah), penyakit menular dan tidak menular, KIA, kesehatan
lingkungan dan sekolah, jadwal Posyandu beserta meja layanannya, dan **tabel
rujukan WHO yang lengkap** — strukturnya sudah ada, isinya menunggu penyemaian
resmi. Sampai itu terjadi, anak di luar umur yang tersemai akan dinyatakan
"belum dapat dinilai", dan itu memang jawaban yang benar.

**Catatan yang perlu diingat saat merancang antarmukanya:** Posyandu dijalankan
kader — bukan tenaga medis — sering tanpa internet, dan sasarannya populasi,
bukan pasien yang datang. Antarmukanya tidak boleh sekadar versi kecil dari
layar rumah sakit. Karena itu layar webnya sengaja belum dibuat pada fase ini:
membuatnya sebagai salinan layar rumah sakit akan lebih buruk daripada belum
membuatnya sama sekali.

### H-9 · Rekam medis, koding, mutu, keselamatan — **SELESAI**

Kelengkapan rekam medis, terminologi berversi, pengkodean dan verifikasinya,
penahanan hukum, pelepasan informasi, insiden keselamatan pasien, dan indikator
mutu.

Klaim, casemix, rekonsiliasi, tagihan pasien, dan deposit **dipindahkan ke
H-9C** oleh Revisi 2. Retensi, PPI, serta kredensial dan kewenangan klinis belum
dijadwalkan.

Uji ≥ 30 → **67 tercapai**, ditambah naskah bukti 74 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H016__health__him_quality.sql`, `H017__health__him_permissions.sql` |
| Aturan murni | `health-him.ts` + 67 pengujian |
| Layanan | `health-him.service.ts` |
| Endpoint | `health-him.controller.ts` — 13 jalan di `/api/v1/health/him/**` |
| Katalog | `health-catalog.ts` — 6 menu, 4 peran, 1 aturan SoD, 9 aksi hak akses |
| Bukti | `scripts/prove-health-him.mjs` → [bukti-h9-rekam-medis.txt](bukti-h9-rekam-medis.txt) |

**Keputusan yang menentukan bentuknya**

- **Kekurangan berkas disimpan sebagai BARIS, bukan sebagai angka.** Satu baris
  per kekurangan, bernama, beserta peran yang dapat memperbaikinya. Angka
  "kelengkapan 82%" berguna bagi manajemen yang membandingkan bulan; ia tidak
  berguna sama sekali bagi dokter yang harus memperbaiki berkasnya sore ini.
  Dokter yang membaca "resume medis belum ditandatangani" akan
  menandatanganinya; dokter yang membaca "82%" akan menutup layarnya. Skornya
  tetap dihitung — oleh fungsi yang berbeda, untuk pembaca yang berbeda.

- **Kekurangan yang sudah diperbaiki DITUTUP dengan waktunya, bukan dihapus.**
  Laporan mutu yang tidak dapat menghitung berapa lama sebuah kekurangan
  menggantung tidak dapat memperbaiki sebabnya. Dan daftar yang masih memuat
  hal-hal yang sudah dikerjakan akan diabaikan seluruhnya — termasuk yang belum.

- **"Diagnosis belum berkode" TIDAK menahan pengkodean.** Menahannya mengunci
  berkas selamanya: pengkodean ditolak karena belum berkode, dan ia tidak akan
  pernah berkode karena pengkodeannya ditolak. Ia tetap kekurangan yang nyata,
  tetapi ia pekerjaan koder — yang ditahannya adalah pengajuan klaim.

- **Kode terminologi yang dicabut tetap TERBACA, tetapi tidak dapat dipilih**,
  dan dibandingkan dengan **tanggal layanan**, bukan tanggal pengkodean. Berkas
  Maret yang dikode Juni tetap memakai terminologi Maret; memaksanya memakai
  terminologi Juni akan mengubah arti diagnosis yang sudah ditegakkan. Versi
  terminologinya **disalin ke tiap baris kode** — tanpa salinan itu, kode lama
  tidak dapat ditafsirkan setelah terminologinya berganti dua kali.

- **Tepat satu diagnosis utama, ditegakkan indeks unik parsial.** Pengelompokan
  casemix memilih satu; bila ada dua, yang dipilih ditentukan urutan baris — dan
  urutan baris bukan keputusan klinis.

- **Penahanan hukum menahan PERUBAHAN, bukan pembacaan.** Ditegakkan trigger
  pada `clinical_note` dan `encounter_diagnosis`, bukan hanya oleh layanan.
  Menahan pembacaan akan menghentikan perawatan pasien yang rekamnya kebetulan
  diperkarakan, dan pasien itu tetap sakit. Yang memasang penahanan tidak
  mencabutnya sendiri — ditegakkan constraint `him_hold_release_not_self` pula.

- **Yang menentukan pelepasan informasi adalah DASAR HUKUMNYA, bukan
  pemintanya.** Kepolisian yang meminta tanpa nomor surat berkedudukan sama
  dengan orang asing yang meminta — permintaan lisan tidak dapat dibedakan dari
  permintaan yang dikarang, dan yang melepas rekamnya yang akan menanggungnya.
  Pemberi kerja yang meminta dengan persetujuan pasien pun tetap menerima yang
  tersamarkan. Yang **memutuskan** pelepasan bukan yang **menyerahkan**
  berkasnya: petugas hukum memutuskan, petugas rekam medis menyerahkan.

- **Yang dilepas dicatat terpisah dari yang diminta.** Keduanya sering berbeda,
  dan yang penting bagi audit adalah yang kedua. Permintaan mencatat niat;
  pelepasan mencatat perbuatan. Catatannya tidak dapat dihapus — ia satu-satunya
  bukti bahwa rekam medis seseorang pernah keluar dari rumah sakit ini.

- **Pelaporan insiden sengaja LONGGAR; penutupannya sengaja KETAT.** Enam belas
  peran klinis memperoleh `HEALTH_SAFETY.CREATE`, termasuk petugas bangsal dan
  kader; hanya dua peran dapat menutup, dan direktur bukan salah satunya. Yang
  paling sering melihat kejadian bukan petugas mutu, melainkan perawat malam,
  apoteker yang menerima resep aneh, dan analis yang menerima spesimen tanpa
  label. **Pelapor boleh anonim** — sebagian orang tidak akan melapor bila
  namanya tercatat, terutama ketika yang keliru adalah atasannya; bila anonim,
  `reported_by` benar-benar kosong, bukan sekadar disembunyikan di layar.

- **Nyaris cedera TETAP ditelaah.** Ia justru data yang paling berharga: ia
  menunjukkan celah sebelum ada yang terluka, dan jauh lebih sering terjadi
  daripada cedera sehingga polanya lebih cepat terlihat. Yang membedakan
  tenggatnya bukan keberhargaannya, melainkan kemendesakannya.

- **Insiden tidak dapat ditutup tanpa tindakan perbaikan**, dan **pelapor tidak
  menutup laporannya sendiri** pada kejadian kuning dan merah. Insiden yang
  ditutup tanpa tindakan perbaikan akan terjadi lagi — itulah satu-satunya hal
  yang dapat dikatakan dengan pasti tentangnya. Telaah oleh pihak yang terlibat
  bukan telaah. Keduanya ditegakkan constraint pula.

- **Papan insiden mengutamakan yang LEWAT TENGGAT**, bukan yang paling berat.
  Kejadian berat yang sedang dikerjakan bukan pekerjaan yang menumpuk; kejadian
  ringan yang terlupa dua pekan adalah.

- **Penyebut nol tidak menghasilkan nol**, melainkan "belum ada datanya". Nol
  akan terbaca sebagai mutu terburuk. Pembilang yang melebihi penyebut ditolak
  constraint: indikator yang melebihi seratus persen akan dilaporkan sebagai
  prestasi.

**Tiga cacat yang ditemukan naskah bukti, bukan pengujian satuan**

| Cacat | Akibatnya di produksi |
|---|---|
| `ON CONFLICT (encounter_id)` pada indeks unik **parsial** tanpa menyebut predikatnya | Pemeriksaan kelengkapan — langkah pertama seluruh H-9 — gagal 500 pada setiap panggilan |
| `$1` dan `$2` dipakai dua kali dengan tipe yang disimpulkan berbeda | Kekurangan berkas tidak pernah tersimpan |
| Nomor insiden dihitung per fasilitas tetapi unik per tenant | Fasilitas kedua yang melapor pada hari yang sama gagal melapor sama sekali |

Ditambah kunci mati "diagnosis belum berkode" di atas, yang juga hanya terlihat
ketika alurnya dijalankan sungguhan.

Cacat kelima ada pada naskah buktinya sendiri: uji penahanan hukum semula
memakai catatan klinis yang **sudah ditandatangani**, yang sudah dikunci trigger
H-3 dan berjalan lebih dahulu menurut urutan abjad. Naskah itu lulus tanpa
penahanan hukum pernah diuji sama sekali. Kini setiap uji penahan memeriksa
**bunyi penolakannya** — nama constraint atau kalimat triggernya — bukan sekadar
bahwa pernyataannya gagal.

**Yang belum:** retensi dan pemusnahan berkas, PPI, kredensial dan kewenangan
klinis, layar web, dan penyemaian terminologi ICD-10/ICD-9-CM resmi —
strukturnya sudah ada, isinya menunggu berkas sumber yang dapat ditelusuri.

### H-9L · Master data dan pemetaan unit — **SELESAI**

Katalog layanan, pemetaan empat belas slot ke unit, penggolongan sumber master
data, pemetaan kode lokal ke kode resmi, dan pembangkitan data contoh
deterministik.

Uji ≥ 25 → **53 tercapai**, ditambah naskah bukti 61 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H018__health__master_data.sql`, `H019__health__master_data_permissions.sql` |
| Aturan murni | `health-master-data.ts` + 53 pengujian |
| Layanan | `health-master-data.service.ts` |
| Endpoint | `health-master-data.controller.ts` — 12 jalan di `/api/v1/health/master-data/**` |
| Katalog | `health-catalog.ts` — 3 menu, 1 peran, 1 aturan SoD, 1 aksi hak akses |
| Bukti | `scripts/prove-health-master-data.mjs` → [bukti-h9l-master-data.txt](bukti-h9l-master-data.txt) |

**Keputusan yang menentukan bentuknya**

- **Layanan tidak dapat diaktifkan sebelum pemetaannya lengkap**, ditegakkan
  trigger `forbid_activation_without_mapping` — bukan hanya oleh layanan.
  Katalog layanan adalah tabel yang paling sering disunting lewat jalan lain:
  impor massal, perbaikan data, naskah penyemaian. Aturan yang hanya ada di
  layanan berhenti berlaku pada setiap jalan itu.

- **"Bila berlaku" ditentukan sifat layanannya, bukan pilihan pengguna.**
  Pemeriksaan laboratorium selalu menuntut spesimen, peran verifikator, dan
  peralatan; menandainya "tidak berlaku" adalah jalan memutar yang akan selalu
  diambil ketika tenggat mendesak, dan akibatnya baru terasa berbulan-bulan
  kemudian. Ditetapkan satu fungsi, `sifatLayanan()`, supaya tidak ada tempat
  kedua yang memutuskannya — aturan yang disalin ke dua tempat akan berselisih,
  dan yang berselisih selalu diselesaikan dengan memilih yang lebih longgar.

- **Kekurangan pemetaan disimpan sebagai baris, dan menyebut fase yang
  menunggunya.** Enam dari empat belas slot menunjuk tabel yang memang belum
  dibangun — tarif (H-9D), cakupan pembayar (H-9D), aturan jasa (H-9E),
  peralatan (H-9H), akun pendapatan dan akun HPP (H-9N). Menyamarkannya sebagai
  kekurangan biasa akan membuat penggunanya mencari kolom yang tidak ada, lalu
  menyimpulkan sistemnya rusak.

- **Layanan yang hanya memetakan pendapatannya akan menampilkan margin seratus
  persen**, dan margin seratus persen tidak pernah dipertanyakan siapa pun
  sampai kasnya tidak cocok. Karena itu layanan yang memakai persediaan wajib
  memetakan akun harga pokoknya pula.

- **Papan kekurangan dikelompokkan menurut SLOT, bukan menurut layanan.** Yang
  berguna bukan daftar tiga ratus layanan yang belum lengkap, melainkan
  kenyataan bahwa dua ratus delapan puluh di antaranya kurang hal yang sama —
  satu penyebab biasanya menjelaskan puluhan layanan sekaligus.

- **Harga sintetis tidak dapat menyamar sebagai harga resmi.** Hanya baris
  bersumber `OFFICIAL_REFERENCE` yang boleh menyebut penerbit, dan penerbit itu
  wajib disertai nomor atau tanggal terbitannya — rujukan yang tidak dapat
  ditelusuri tidak dapat dibedakan dari karangan. Ditegakkan constraint
  `health_service_issuer_only_official`; penandanya melekat pada barisnya dan
  tidak dapat dilepas, sebab yang melepasnya kelak bukan orang yang membuatnya.

- **Pembangkitan data contoh deterministik, dan benihnya disimpan.** Benih yang
  sama menghasilkan katalog yang sama persis. Tanpa itu, dua penyewa demo akan
  melihat isi yang berbeda dan salah satunya akan melaporkan kerusakan yang
  tidak dapat ditirukan siapa pun.

- **Penghapusan data contoh menolak bila ada data nyata yang merujuknya**,
  menyebutkan apa yang merujuknya, dan menyerahkan keputusannya kepada manusia.
  Obat contoh yang terlanjur diresepkan kepada pasien sungguhan tidak dapat
  dihapus tanpa meninggalkan resep yang menunjuk kekosongan. Dan yang disebut
  penghapusan pun hanya penyembunyian.

- **Satu kode lokal tidak menunjuk dua kode resmi pada sistem yang sama**,
  ditegakkan indeks unik parsial atas pemetaan yang belum dipensiunkan.
  Pemetaan **dipensiunkan, bukan dihapus**: rekam lama yang sudah dikirim
  memakai pemetaan lama harus tetap dapat dijelaskan.

- **Yang memetakan bukan yang mengaktifkan.** Pemetaan adalah pekerjaan harian;
  aktivasi adalah keputusan yang membuat layanan dapat ditagihkan. Yang pertama
  menyadari penyatuannya adalah pasien yang menerima tagihan atas layanan yang
  tarifnya salah ketik.

**Dua cacat yang ditemukan naskah bukti**

| Cacat | Akibatnya di produksi |
|---|---|
| Kode kumpulan data contoh dihitung dari benih saja, sedangkan uniknya per tenant | Fasilitas kedua yang disemai dengan benih yang sama gagal seluruhnya — persis kebalikan dari maksud "deterministik" |
| Penyemaian ulang berkata "berhasil" sambil membuat nol baris | Sebabnya akan dicari berjam-jam; kini ia ditolak dengan alasannya |

Yang pertama sekelas dengan cacat nomor insiden pada H-9: pengenal yang
dihitung per lingkup sempit, di bawah batasan unik yang lebih luas. Dua kali
dalam satu hari cukup untuk menjadikannya hal yang diperiksa lebih dahulu.

**Yang belum:** isi KFA, ICD-10, ICD-9-CM, LOINC, dan SNOMED — seluruhnya
terhalang akses resmi; volume data contoh penuh menurut profil `STANDARD`
(1.000 obat, 1.500 tindakan, dan seterusnya) yang menunggu katalog per
domainnya; serta layar web.

### H-9N · COA dan pemetaan akuntansi — **SELESAI (strukturnya)**

Templat bagan akun kesehatan, penautan peran akun ke bagan akun bersama,
pemetaan tiga belas peristiwa kesehatan ke sisi debit dan kredit, laporan
kesiapan, dan perhitungan selisih klaim.

**Penjurnalannya tetap terhalang** — kode peristiwa `HEALTH_*` menunggu
keputusan Core. Itu memang keadaannya, dan laporan kesiapannya mengatakannya
terus terang alih-alih menyamarkannya.

Uji ≥ 20 → **45 tercapai**, ditambah naskah bukti 56 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H020__health__accounting_map.sql`, `H021__health__accounting_permissions.sql` |
| Aturan murni | `health-accounting.ts` + 45 pengujian |
| Layanan | `health-accounting.service.ts` |
| Endpoint | `health-accounting.controller.ts` — 10 jalan di `/api/v1/health/accounting/**` |
| Katalog | `health-catalog.ts` — 1 menu, 1 peran |
| Bukti | `scripts/prove-health-accounting.mjs` → [bukti-h9n-akuntansi.txt](bukti-h9n-akuntansi.txt) |

**Keputusan yang menentukan bentuknya**

- **Aturan pertama: jangan membuat buku besar kedua.** Tidak ada tabel jurnal,
  tidak ada tabel saldo, tidak ada tabel neraca. Membangun buku besar kesehatan
  tersendiri akan menghasilkan dua neraca yang tidak pernah cocok — dan yang
  lebih buruk, dua-duanya akan tampak benar. Naskah bukti memeriksanya secara
  harfiah: ia menghitung tabel bernama `health*journal*`, `health*ledger*`, dan
  `health*balance*` pada skema tenant, dan menuntut hasilnya nol; lalu memakai
  seluruh modul dari ujung ke ujung dan menuntut jumlah baris `journal_entry`
  serta `accounting_event` tidak bertambah satu pun.

- **Peran akun, bukan nomor akun.** `REVENUE_LAB` ditautkan ke akun sungguhan
  per fasilitas. Rumah sakit yang memakai bagan akun berbeda mengubah
  tautannya, bukan kodenya.

- **Saldo normal akun harus cocok dengan golongan perannya**, ditegakkan
  trigger. Menautkan `REVENUE_LAB` ke akun bersaldo normal debit akan
  menghasilkan pendapatan bernilai negatif pada setiap laporan — dan yang
  membacanya akan menyimpulkan laboratoriumnya merugi. Akun induk pun ditolak:
  jurnal pada akun induk membuat rincian per unit hilang seluruhnya.

- **Medan nilai adalah NAMA MEDAN, bukan rumus.** Ditegakkan constraint
  `health_rule_amount_key_plain`. Rumus bebas pada data adalah pintu masuk
  eksekusi kode yang tidak diinginkan; larangan `eval` berlaku di sini pula.

- **Klaim yang disetujui kurang dari yang diajukan menghasilkan BEBAN.**
  Selisihnya bukan pendapatan yang hilang begitu saja. Ia harus terlihat, sebab
  ia ukuran mutu pengkodean dan kelengkapan berkas — dan yang tidak terlihat
  tidak pernah diperbaiki. Disetujui **lebih besar** daripada yang diajukan
  bukan keuntungan melainkan tanda pengajuannya keliru: dilaporkan untuk
  ditelaah, tidak dijurnal diam-diam.

- **Laporan kesiapan memisahkan yang belum KAMI kerjakan dari yang menunggu
  Core.** Laporan yang menyatukan keduanya akan membuat orang menghabiskan
  pekan mencoba mengerjakan hal yang memang tidak dapat dikerjakannya.

- **Peristiwa yang tidak dipakai tidak menuntut penautan akun.** Menuntutnya
  bagi fee sistem yang bawaannya `NONE` akan membuat seluruh daftar kekurangan
  diabaikan.

- **Petugas keuangan tidak membaca rekam medis.** Ia perlu tahu bahwa
  pendapatan laboratorium masuk ke akun 4160; ia tidak perlu tahu siapa yang
  diperiksa. Menggabungkan keduanya adalah cara paling sunyi untuk membocorkan
  seluruh riwayat pasien: jejaknya akan tenggelam di antara ribuan pembacaan
  yang sah.

**Yang belum:** penjurnalannya sendiri. Kode peristiwa `HEALTH_*` sudah
diajukan lewat [integration request 001](../integration-requests/health/) sejak
H-4 dan belum terjawab. Sampai ia ada, penyerahan obat belum memicu pencatatan
harga pokok, pendapatan layanan belum masuk jurnal, dan pembagian jasa belum
menghasilkan utang. Ini penghalang yang **tidak dapat diselesaikan sesi eMedik
sendiri**, dan menyelesaikannya dengan membuat buku besar kedua akan melanggar
aturan pertama fase ini.

### H-9D · Tarif berversi dan cakupan penjamin — **SELESAI (strukturnya)**

Inventaris peraturan, versi tarif beserta impor dan persetujuannya, pemilihan
tarif menurut kunci enam bagian, dan cakupan penjamin beserta perhitungan
tanggungannya.

**Isinya menunggu terbitan resmi.** Sampai itu ada, sistem berkata "tarif untuk
kunci ini belum tersedia" dan menolak menghitung. Itu jawaban yang benar.

Uji ≥ 25 → **46 tercapai**, ditambah naskah bukti 43 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H022__health__tariff.sql`, `H023__health__tariff_permissions.sql` |
| Aturan murni | `health-tariff.ts` + 46 pengujian |
| Layanan | `health-tariff.service.ts` |
| Endpoint | `health-tariff.controller.ts` — 10 jalan di `/api/v1/health/tariff/**` |
| Katalog | `health-catalog.ts` — 2 menu, 1 peran |
| Bukti | `scripts/prove-health-tariff.mjs` → [bukti-h9d-tarif.txt](bukti-h9d-tarif.txt) |

**Keputusan yang menentukan bentuknya**

- **Tarif dipilih menurut TANGGAL LAYANAN, bukan tanggal klaim.** Pasien yang
  dirawat pada Maret dan klaimnya diajukan pada Mei tetap memakai tarif Maret.
  Memakai tanggal klaim berarti menunda pengajuan menjadi cara menaikkan
  tagihan.

- **Tarif tidak pernah ditimpa.** Impor membuat versi baru; baris pada versi
  yang sudah aktif tidak dapat diubah maupun dihapus, ditegakkan trigger
  `forbid_active_tariff_mutation`. Klaim yang sudah dihitung memakai baris itu
  harus tetap dapat dijelaskan.

- **Tumpang tindih tanggal ditolak** oleh `EXCLUDE USING gist` atas kunci enam
  bagian beserta rentang berlakunya. `COALESCE` dipakai pada bagian yang boleh
  kosong — tanpa itu, dua tarif **umum** yang bertumpang tindih akan lolos,
  sebab NULL tidak pernah sama dengan NULL pada operator kesamaan. Naskah bukti
  mengujinya secara khusus.

- **Tarif yang belum ada TIDAK ditaksir.** Jawabannya "belum tersedia" dan
  perhitungannya berhenti. Menaksirnya akan menghasilkan angka yang tampak resmi
  lalu dipakai menagih orang.

- **Dua tarif yang sama-sama berlaku dan sama khususnya menghentikan
  perhitungan**, bukan memilih salah satunya. Memilih yang pertama berarti
  membiarkan urutan baris menentukan tagihan pasien.

- **Aktivasi menuntut dasar peraturan, berkas sumber, sidik jarinya, dan isi
  yang tidak kosong.** Tarif tanpa sumber tidak dapat dibedakan dari tarif yang
  diketik dari ingatan; versi kosong yang diaktifkan akan menghentikan seluruh
  perhitungan tanpa ada yang tahu sebabnya.

- **Yang mengimpor tidak menyetujui.** Impor adalah pekerjaan teknis;
  persetujuan mengubah seluruh tagihan rumah sakit sejak tanggal berlakunya.

- **Impor menolak SELURUHNYA bila satu baris bertumpang tindih.** Impor separuh
  menghasilkan versi yang tampak lengkap dan sebenarnya bolong — dan yang bolong
  baru ketahuan ketika satu pasien kebetulan jatuh pada baris yang hilang.

- **Pembulatan tanggungan MEMIHAK PASIEN.** Sisa satu rupiah menjadi tanggungan
  penjamin. Selisih itu tidak berarti bagi penjamin; bagi loket pendaftaran ia
  berarti uang kembalian yang tidak ada.

- **Rujukan yang belum ada menahan tanggungan SEMENTARA, bukan selamanya**, dan
  pesannya mengatakan begitu. Perbedaannya menentukan: yang pertama dapat
  diperbaiki dengan melengkapi berkas, yang kedua sudah terbaca sebagai
  keputusan akhir.

**Cacat yang ditemukan naskah bukti**

| Cacat | Akibatnya di produksi |
|---|---|
| `effectiveTo` disimpan sebagai batas atas `daterange` yang **terbuka** | Hari terakhir setiap masa berlaku tidak tertutupi tarif mana pun |

Pengujian satuannya lulus — aturan murninya memang memakai batas tertutup dan
menjawab benar. Yang salah adalah penerjemahannya ke `daterange`, dan itu hanya
terlihat ketika angkanya benar-benar melewati basis data. Hari terakhir justru
hari yang paling sering dipersoalkan: ia hari terakhir sebelum tarif baru
berlaku, dan pasien yang pulang hari itu akan menerima tagihan yang tidak dapat
dijelaskan siapa pun.

**Yang belum:** isi tarif resmi (terhalang terbitan resmi), grouper INA-CBG
(terhalang perangkat lunak berlisensi), inventaris peraturan yang sungguhan —
strukturnya ada, dan **inventaris yang kosong lebih baik daripada inventaris
yang berisi nomor peraturan hasil ingatan**.

### H-9E · Kebijakan pembagian jasa dan kontributor — **SELESAI**

Kebijakan berversi, baris pembagian, kontributor per tindakan beserta bukti
kehadirannya, perhitungan pembagian, dan gerbang kontrak bagi fee sistem dan
fee investor.

Uji >= 25 -> **56 tercapai**, ditambah naskah bukti 50 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H024__health__fee_policy.sql`, `H025__health__fee_permissions.sql` |
| Aturan murni | `health-fee.ts` + 56 pengujian |
| Layanan | `health-fee.service.ts` |
| Endpoint | `health-fee.controller.ts` — 7 jalan di `/api/v1/health/fee/**` |
| Katalog | `health-catalog.ts` — 2 menu, 2 peran, 1 aturan SoD |
| Bukti | `scripts/prove-health-fee.mjs` -> [bukti-h9e-jasa.txt](bukti-h9e-jasa.txt) |

**Keputusan yang menentukan bentuknya**

- **TIDAK ADA SATU PUN PERSENTASE DI DALAM KODE MAUPUN MIGRASI.** Persentase
  pembagian jasa adalah kesepakatan antara rumah sakit dan tenaga medisnya:
  berbeda antar fasilitas, berubah, dan kadang menjadi pokok sengketa.
  Menanamnya berarti perhitungan jasa bulan lalu tidak dapat diulang, sebab
  kodenya sudah berubah. Naskah bukti memeriksanya secara harfiah: ia menghitung
  kebijakan yang lahir tanpa pembuat — yaitu yang datang dari migrasi — dan
  menuntut hasilnya nol.

- **Jasa BPJS dihitung dari klaim yang DIBAYAR, bukan yang diajukan.** Diajukan
  sepuluh juta, disetujui tujuh, dibayar tujuh. Membagi dari sepuluh berarti
  rumah sakit sudah membayarkan uang yang tidak pernah diterimanya — dan
  menariknya kembali dari dokter jauh lebih sulit daripada tidak membayarkannya
  sejak awal. Taksiran boleh untuk akrual dan **simulasi**, tidak pernah untuk
  yang dibayarkan.

- **Jasa dibayarkan kepada yang benar-benar HADIR**, dan buktinya menunjuk ke
  sumbernya dari H-7 — `ot_checklist.completed_by`, `ot_count.counted_out_by`,
  `ot_case.surgeon_id` — bukan berupa kotak centang, sebab kotak centang dapat
  dicentang siapa saja. Yang tersaring **dikembalikan, bukan dihapus
  diam-diam**: menghapus diam-diam menghasilkan pertanyaan "mengapa jasa saya
  tidak ada" yang tidak dapat dijawab siapa pun.

- **Penerima jasa tidak menyetujui aturan yang membayar dirinya.** Pemisahan
  yang paling sering dilanggar dan paling sulit dilihat: dokter yang juga
  administrator dapat menaikkan persentasenya sendiri, dan tidak ada yang akan
  menyadarinya sampai ada yang membandingkan dua bulan berturut-turut. Ia
  **tidak dapat ditegakkan hak akses saja** — keduanya peran yang sah
  masing-masing — sehingga diperiksa pada tingkat baris: penyetuju yang tertaut
  pada pemberi layanan yang tersebut di dalam kebijakannya ditolak, sekalipun
  hak aksesnya lengkap.

- **Fee sistem dan fee investor bawaannya NONE**, dan aktivasinya menuntut
  keenam syaratnya — kontrak, telaah hukum, persetujuan manajemen, perlakuan
  pajak, tanggal berlaku, batas maksimum. Yang kurang disebutkan satu per satu:
  daftar syarat yang hanya berkata "belum lengkap" akan diisi seadanya sampai
  tombolnya menyala.

- **Templat contoh bukan standar nasional dan bukan saran hukum.** Bertanda
  `is_sample_data`, `active=false`, `production_approved=false`, dan constraint
  menahan templat contoh yang aktif tanpa persetujuan produksi.

- **Kebijakan yang sudah aktif tidak dapat diubah barisnya.** Perhitungan jasa
  yang sudah dilakukan memakainya harus tetap dapat dijelaskan; versi kebijakan
  disalin ke setiap hasil perhitungan.

- **Sisa pembulatan diberikan kepada kontributor dengan bobot TERBESAR**, bukan
  kepada yang pertama pada daftar. Urutan daftar tidak berarti apa-apa; bobot
  berarti sesuatu.

- **Jumlah persentase melebihi seratus ditolak; kurang dari seratus sah.**
  Sisanya menjadi bagian fasilitas, dan banyak kesepakatan memang berbentuk
  begitu.

**Yang belum:** settlement beserta simulasi, penguncian, pembayaran, dan
pembalikannya — itu H-9F. Gerbang kontrak fee sistem dan investor baru berupa
penolakan; pencatatan kontraknya sendiri H-9G.

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

## Revisi 2 — fase tambahan H-9A sampai H-9N

Paket **eMedik V12 Revisi 2** (1 Agustus 2026) menggantikan spesifikasi
sebelumnya bila berkonflik, dan menambahkan empat belas subfase pada H-9.

Audit H-0 R2 tersimpan pada dokumen [09](09-satusehat-capability-matrix.md)
sampai [20](20-legal-and-contract-review-checklist.md).

| Fase | Cakupan | Dapat dibangun tanpa kredensial? |
|---|---|---|
| H-9 | HIM, koding, mutu, keselamatan | **Ya, seluruhnya** |
| H-9A | Fondasi SATUSEHAT | Kerangka + gerbang kemampuan saja |
| H-9B | BPJS kepesertaan/rujukan/SEP/antrean | Catatan lokalnya saja |
| H-9C | Klaim/casemix/rekonsiliasi | **Ya, sembilan dari lima belas tahap** |
| H-9D | Tarif JKN/kelas/coverage | Struktur berversi; isinya menunggu |
| H-9E | Kebijakan jasa/kontributor | **Ya, seluruhnya** |
| H-9F | Simulasi/settlement/reversal | **Ya, seluruhnya** |
| H-9G | Gerbang kontrak fee sistem/investor | **Ya, seluruhnya** |
| H-9H | Registri alat/gateway | **Ya** kecuali protokol tertentu |
| H-9I | DICOM/PACS/LIS/bedside | HL7/ASTM ya; DICOM terhalang PACS |
| H-9J | Pemeliharaan/keamanan biomedis | **Ya, seluruhnya** |
| H-9K | Dasbor investor/waterfall | **Ya**, menunggu port investor |
| H-9L | Master data/pemetaan unit | **Ya, seluruhnya** |
| H-9M | Impor KFA/katalog contoh | Struktur ya; isi KFA menunggu |
| H-9N | COA kesehatan/pemetaan akuntansi | Struktur ya; **jurnalnya menunggu port** |

### Urutan yang dipilih, dan alasannya

Bukan urutan abjad. Yang didahulukan adalah yang **dapat berjalan penuh tanpa
menunggu pihak lain**, sebab fase yang selesai setengah karena menunggu
kredensial tidak dapat ditunjukkan kepada siapa pun.

```text
1.  H-9    HIM, koding, mutu — seluruhnya milik kami          [SELESAI]
2.  H-9L   Master data dan pemetaan unit — pondasi bagi tarif  [SELESAI]
3.  H-9N   COA dan pemetaan akuntansi — strukturnya          [SELESAI]
4.  H-9D   Struktur tarif berversi — isinya menunggu           [SELESAI]
5.  H-9E   Kebijakan jasa dan kontributor                    [SELESAI]
6.  H-9F   Simulasi, settlement, reversal
7.  H-9G   Gerbang kontrak fee sistem dan investor
8.  H-9C   Siklus klaim internal — koding sampai rekonsiliasi
9.  H-9H   Registri alat dan gateway
10. H-9J   Pemeliharaan, kalibrasi, keamanan siber
11. H-9K   Dasbor investor agregat
12. H-9I   Adapter HL7/ASTM; DICOM menunggu PACS
13. H-9A   Kerangka SATUSEHAT beserta gerbang kemampuan
14. H-9B   Kerangka BPJS beserta gerbang kemampuan
15. H-9M   Kerangka impor KFA
```

Tiga yang terakhir sengaja diletakkan paling belakang: keluarannya adalah
kerangka yang **menolak berjalan** sampai kredensialnya ada, dan kerangka yang
menolak berjalan tidak dapat diperagakan.

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
