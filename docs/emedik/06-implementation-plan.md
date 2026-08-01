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

### H-1 · Fasilitas, portal, profil tenant, billing, **dan identitas pasien inti** — **SELESAI**

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

### H-2 · Janji temu, pendaftaran, antrean — **SELESAI**

Sisa identitas pasien (`PatientConsent`, `PatientProxy`, `PatientMerge`,
`PatientFamilyLink`), lalu `Appointment`, `Schedule`, `ProviderAvailability`,
pendaftaran daring dan langsung, rujukan, antrean, dan pemantauan waktu tunggu.

Uji ≥ 40. Ini fase dengan uji terbanyak, dan memang seharusnya.

### H-3 · Rawat jalan, dokumentasi klinis, order — **SELESAI**

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

### H-9F · Simulasi, settlement, dan pembalikan — **SELESAI**

Perhitungan settlement dari kebijakan, simulasi, penguncian, pembayaran,
penyesuaian dan pembalikan, serta penerbitan pernyataan bagi tiap penerima.

Uji >= 25 -> **42 tercapai**, ditambah naskah bukti 56 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H026__health__fee_settlement.sql`, `H027__health__settlement_permissions.sql` |
| Aturan murni | `health-settlement.ts` + 42 pengujian |
| Layanan | `health-settlement.service.ts` |
| Endpoint | `health-settlement.controller.ts` — 9 jalan di `/api/v1/health/settlement/**` |
| Katalog | `health-catalog.ts` — 2 menu, 2 peran, 3 aturan SoD |
| Bukti | `scripts/prove-health-settlement.mjs` -> [bukti-h9f-settlement.txt](bukti-h9f-settlement.txt) |

**Keputusan yang menentukan bentuknya**

- **TIDAK ADA SATU PUN JALAN YANG MENGHAPUS.** Settlement, koreksi, dan
  pernyataan seluruhnya kekal; ketiganya berpenjaga `forbid_ledger_mutation`.
  Yang dipegang dokter adalah kertas yang sudah dicetak, dan menghapus
  catatannya membuat kertas itu tidak lagi cocok dengan apa pun.

- **Empat wewenang, empat pemegang berbeda:** menghitung, menyetujui, mengunci
  dan membayar, lalu mengoreksi. Yang menghitung tidak menyetujui — perhitungan
  yang diperiksa oleh yang menghitungnya bukan pemeriksaan. Yang menyetujui
  tidak membayar — persetujuan yang langsung menjadi transfer menghilangkan
  jeda terakhir sebelum uang berpindah, dan jeda itu satu-satunya kesempatan
  bagi orang ketiga untuk melihat angkanya sebelum ia tidak dapat ditarik
  kembali.

- **Simulasi tidak pernah menjadi utang**, dan tandanya **tidak dapat diubah** —
  ditegakkan trigger tersendiri. Simulasi yang berubah menjadi settlement
  sungguhan lewat satu `UPDATE` adalah pintu paling sunyi untuk membuat utang
  yang tidak pernah dihitung siapa pun. Nomornya pun berawalan berbeda
  (`SIM-` dan `STL-`): nomor yang tidak dapat dibedakan akan tertukar pada
  percakapan lisan, dan percakapan lisan adalah tempat sebagian besar
  kekeliruan pembayaran bermula.

- **Simulasi dan settlement sungguhan dihitung dengan jalan yang SAMA.**
  Menghitungnya dengan dua jalan berbeda akan membuat simulasi memberi angka
  yang tidak pernah benar-benar terjadi.

- **Pembalikan wajib sama besar dengan yang tersisa.** Pembalikan sebagian yang
  menyamar sebagai pembalikan penuh akan menyisakan selisih yang ditemukan
  setahun kemudian oleh orang yang tidak tahu apa-apa tentang kejadiannya.
  Penyesuaian boleh sebagian, tetapi tidak boleh membuat nilai akhirnya
  negatif — settlement yang berakhir negatif berarti rumah sakit menagih
  kembali kepada dokter, dan itu keputusan tersendiri.

- **Nilai bersih dihitung, bukan diketik.** Constraint menuntut bersih sama
  dengan kotor dikurangi pajak. Pajak hanya dipotong dari jasa perorangan;
  bagian fasilitas dan kumpulan bukan penghasilan seseorang.

- **Sisa pembagian menjadi baris bagian fasilitas, bukan dibuang.**
  Membuangnya berarti jumlah baris tidak sama dengan dasarnya, dan pemeriksaan
  berikutnya akan menolak seluruh settlement tanpa ada yang tahu ke mana
  sisanya pergi.

- **Pernyataan hanya memuat yang BENAR-BENAR dibayarkan.** Pernyataan yang
  memuat angka yang belum tentu dibayarkan akan dibaca sebagai janji — dan janji
  yang tercetak lebih sulit ditarik daripada janji yang diucapkan. Satu
  pernyataan asli per penerima per periode; bila angkanya berubah, terbitkan
  pernyataan koreksi yang menunjuk pernyataan lamanya. Yang dipegang penerimanya
  harus **dua kertas**, bukan satu kertas yang diam-diam berganti isi.

- **Pembayaran wajib menyebut rujukan transaksinya.** Pembayaran tanpa rujukan
  tidak dapat dicocokkan dengan rekening koran, dan yang tidak dapat dicocokkan
  akan dibayarkan dua kali.

**Catatan dari naskah buktinya**

Uji "membayar simulasi lewat basis data ditolak constraint" semula gagal — bukan
karena constraint-nya tidak ada, melainkan karena constraint **lain** menolaknya
lebih dahulu: simulasi itu belum disetujui siapa pun. Kini naskah itu memenuhi
seluruh syarat lain sekaligus, sehingga satu-satunya yang tersisa untuk
menolaknya adalah tanda simulasinya. Pelajaran yang sama seperti H-9: pada tabel
berpenjaga banyak, "gagal" saja tidak membuktikan penjaga yang mana yang bekerja.

**Yang belum:** penjurnalannya — settlement belum menghasilkan `accounting_event`
karena kode peristiwa `HEALTH_*` masih menunggu Core (lihat H-9N).

### H-9G · Gerbang kontrak fee sistem dan investor — **SELESAI**

Kontrak fee beserta daur hidupnya, rantai tiga orang, pengecualian layanan,
penerapan berbatas, dan jejaknya. Serta batas akses pemegang kontrak investor.

Uji >= 20 -> **42 tercapai**, ditambah naskah bukti 52 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H028__health__fee_contract.sql`, `H029__health__fee_contract_permissions.sql`, `H030__health__fee_application_capped_fix.sql` |
| Aturan murni | `health-fee-contract.ts` + 42 pengujian |
| Layanan | `health-fee-contract.service.ts` |
| Endpoint | `health-fee-contract.controller.ts` — 9 jalan di `/api/v1/health/fee-contract/**` |
| Katalog | `health-catalog.ts` — 1 menu, 3 peran, 2 aturan SoD |
| Bukti | `scripts/prove-health-fee-contract.mjs` -> [bukti-h9g-kontrak-fee.txt](bukti-h9g-kontrak-fee.txt) |

**Keputusan yang menentukan bentuknya**

- **BAWAANNYA NONE.** Tanpa kontrak yang aktif, fee sistem dan bagian investor
  bernilai **nol** — bukan nilai bawaan yang kecil, bukan taksiran, nol. Dan
  perhitungan bernilai nol itu tetap **dicatat**: pertanyaan "mengapa bulan ini
  tidak ada fee" harus dapat dijawab dengan barisnya sendiri, bukan dengan
  ketiadaan baris.

- **TIGA ORANG BERBEDA:** penyusun, pemeriksa hukum, penyetuju manajemen. Dua
  orang cukup untuk sebagian besar keputusan; kontrak yang mengambil bagian dari
  kumpulan jasa tenaga medis menuntut tiga, sebab yang dirugikannya tidak duduk
  di ruangan itu — dan satu-satunya pengganti kehadirannya adalah jumlah mata
  yang melihat. Ditegakkan tiga constraint berpasangan, dan naskah buktinya
  sengaja **memberi penyusun hak menelaah** supaya penolakannya datang dari
  pemeriksaan baris, bukan dari ketiadaan hak akses.

- **Telaah hukum dan persetujuan manajemen adalah dua pertanyaan berbeda.**
  Yang pertama menyatakan kontraknya sah; yang kedua menyatakan kontraknya
  dikehendaki. Menyatukan penjawabnya membuat pertanyaan kedua tidak pernah
  benar-benar ditanyakan.

- **Kontrak tidak berlaku surut melampaui telaah hukumnya.** Kontrak yang
  berlaku sejak sebelum diperiksa berarti pemeriksaannya tidak pernah menahan
  apa pun.

- **Batas maksimum ditegakkan saat MENGHITUNG**, bukan sekadar dicatat pada
  kontraknya. Batas yang hanya tertulis akan dilampaui oleh perhitungan yang
  tidak pernah membacanya. Yang melampaui **dibatasi dan dinyatakan**, bukan
  ditolak diam-diam.

- **Syarat kontrak yang sudah aktif tidak dapat diubah.** Menaikkan batas
  maksimum pada kontrak yang sedang berjalan adalah cara paling sunyi untuk
  mengambil lebih banyak: perubahannya tidak menimbulkan satu pun peristiwa yang
  terlihat, dan akibatnya baru muncul pada perhitungan bulan berikutnya.

- **Kontrak yang habis masa berlakunya menghentikan fee-nya sendiri.** Yang
  mengingat akhir masa kontrak adalah pihak yang menerima uangnya, dan ia tidak
  akan mengingatkan siapa pun.

- **Investor tidak pernah memperoleh akses data pasien**, dijaga dari dua arah:
  peran bawaannya hanya memegang dua hak — `HEALTH.READ` dan
  `HEALTH_FEE_CONTRACT.READ` — dan ringkasan yang dikirimkan kepadanya disaring
  lewat **daftar putih**, bukan daftar hitam. Daftar hitam melewatkan setiap
  medan yang ditambahkan kelak oleh orang yang tidak membaca aturannya.
  Perannya dibuat lebih awal daripada dasbornya justru supaya batasnya tercatat
  sebelum ada layar yang menggodanya.

**Cacat yang ditemukan naskah bukti**

| Cacat | Akibatnya di produksi |
|---|---|
| Constraint `fee_application_capped_consistent` menyamakan "terpakai lebih kecil" dengan "dibatasi" | Setiap perhitungan **tanpa kontrak** — keadaan bawaan seluruh fasilitas — ditolak basis data. Fee yang bawaannya NONE justru tidak dapat dicatat sebagai nol |

Persentase terpakai yang lebih kecil daripada yang diminta punya empat sebab —
tidak ada kontraknya, kontraknya belum atau sudah lewat, layanannya
dikecualikan, dan melampaui batas — dan hanya yang terakhir merupakan
pembatasan. Pembetulannya dibawa **migrasi baru** (`H030`), bukan dengan
menyunting `H028`: yang sudah diterapkan tidak diubah diam-diam di belakang
punggung lingkungan lain.

**Yang belum:** penjurnalan fee-nya menunggu kode peristiwa `HEALTH_*` dari Core
(lihat H-9N), dan dasbor investor beserta waterfall-nya adalah H-9K.

### H-9C · Siklus klaim internal — **SELESAI (sembilan dari lima belas tahap)**

Penyusunan klaim, verifikasi internal, pengajuan, pencatatan keputusan dan
pembayaran penjamin, penanda untuk telaah, rekonsiliasi tiga sisi, dan laporan
sebab penolakan.

Enam tahap sisanya — kepesertaan, rujukan, SEP, grouping, pengajuan daring, dan
keputusan langsung dari penjamin — menunggu kredensial dan grouper berlisensi.
**Penghalang kredensial menahan ujung-ujungnya, bukan tengahnya**, dan tengahnya
itulah yang paling banyak menghabiskan waktu petugas rumah sakit.

Uji >= 30 -> **58 tercapai**, ditambah naskah bukti 56 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H031__health__claim.sql`, `H032__health__claim_permissions.sql` |
| Aturan murni | `health-claim.ts` + 58 pengujian |
| Layanan | `health-claim.service.ts` |
| Endpoint | `health-claim.controller.ts` — 10 jalan di `/api/v1/health/claims/**` |
| Katalog | `health-catalog.ts` — 3 menu, 2 peran, 1 aturan SoD |
| Bukti | `scripts/prove-health-claim.mjs` -> [bukti-h9c-klaim.txt](bukti-h9c-klaim.txt) |

**Keputusan yang menentukan bentuknya**

- **TIGA ANGKA, TIGA KOLOM:** diajukan, disetujui, dibayar. Tidak ada satu pun
  kolom "nilai klaim" yang menyatukannya — kolom tunggal akan dipakai bergantian
  sebagai ketiganya, dan tidak ada yang akan tahu yang mana yang tersimpan pada
  baris mana. Menyamakan yang pertama dengan yang ketiga adalah cara paling
  langsung membuat rumah sakit mengira dirinya punya uang yang tidak ada — lalu
  membagikannya sebagai jasa medis. Naskah bukti memeriksa ketiadaan kolom
  penyatu itu secara harfiah pada `information_schema`.

- **Nilai yang sudah diajukan tidak dapat diubah.** Yang sudah dikirim ke
  penjamin adalah angka itu; mengubahnya kemudian akan membuat selisih pada
  rekonsiliasi tampak seperti kesalahan penjamin, padahal angkanya yang bergeser
  di sini.

- **Verifikasi internal menemukan kekurangan sebelum penjamin menemukannya.**
  Bagian yang paling sepele secara teknis dan paling berharga secara nyata:
  klaim yang dikembalikan karena berkasnya kurang menghabiskan waktu
  berminggu-minggu, sedangkan seluruh kekurangannya dapat diperiksa mesin dalam
  hitungan detik. Setiap temuan dilaporkan **namanya** beserta peran yang
  memperbaikinya.

- **Kelas yang melebihi hak peserta DILAPORKAN tetapi tidak menahan.** Naik
  kelas atas permintaan pasien sah; selisihnya ditagihkan kepada pasien, bukan
  kepada penjamin. Menahannya akan membuat verifikasi internal dimatikan oleh
  orang pertama yang klaimnya tertahan karena hal yang memang sah.

- **Sebab penolakan adalah KODE TERTUTUP**, sembilan macam, dan sebab `OTHER`
  wajib berketerangan — tanpa itu ia menjadi tempat pembuangan yang menampung
  separuh penolakan dan tidak menjelaskan satu pun. Laporan sebab penolakan
  adalah alasan keberadaan aturan ini: ia tidak dapat disusun dari teks bebas.

- **PENANDA ANTI-FRAUD TIDAK PERNAH MENGHENTIKAN PENGAJUAN.** Tabelnya tidak
  punya satu pun kolom penahan; yang ada hanya `needs_review`. Penghentian
  otomatis pada penanda statistik akan menahan klaim yang sah dari pasien yang
  memang sakit berat — dan rumah sakit yang klaimnya tertahan akan berhenti
  memakai penandanya. Kata "fraud" sengaja tidak muncul pada satu pun pesannya:
  penanda yang berbunyi seperti tuduhan akan dibantah alih-alih ditelaah.

- **Yang mengode tidak memverifikasi klaimnya sendiri.** Ia akan menemukan salah
  ketik, tetapi tidak akan menemukan pilihan kode yang keliru — sebab pilihan
  itu masih tampak benar baginya. Diperiksa pada tingkat baris, bukan sebagai
  pasangan hak akses: verifikator yang kebetulan juga koder tetap boleh
  memverifikasi klaim yang dikode orang lain, dan melarangnya akan menghentikan
  rumah sakit kecil yang koder dan verifikatornya memang bergantian.

- **Rekonsiliasi membandingkan TIGA sisi:** catatan kami, catatan penjamin, dan
  mutasi rekening. Selisih yang tidak terjelaskan tidak boleh ditutup —
  rekonsiliasi yang dapat ditutup dengan selisih akan selalu ditutup dengan
  selisih, dan selisih yang tertutup tidak pernah dicari lagi. Ia tetap boleh
  **dicatat** tanpa ditutup.

- **Satu klaim per kunjungan yang masih hidup.** Klaim ganda adalah salah satu
  sebab penolakan yang paling sering dan paling mudah dicegah. Yang dibatalkan
  tidak dihitung: kunjungan yang klaimnya batal memang boleh diklaimkan ulang.

- **Klaim yang sudah diajukan tidak dapat dihapus**, tetapi yang belum diajukan
  boleh — ia belum ada di mana pun selain di sini.

**Yang belum:** enam tahap milik BPJS, dan penjurnalan klaimnya yang menunggu
kode peristiwa `HEALTH_*` dari Core.

### H-9H · Registri alat kesehatan dan gateway — **SELESAI**

Pendaftaran alat dan gateway-nya, katalog protokol beserta penghalangnya,
kalibrasi, status alat, kendali jarak jauh yang **mati secara bawaan**, jejak
perintah, penerimaan hasil alat, dan antrean pengaitan hasil yang datang tanpa
identitas pasien.

Uji >= 25 -> **49 tercapai**, ditambah naskah bukti 60 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H033__health__device_registry.sql`, `H034__health__device_permissions.sql` |
| Aturan murni | `health-device.ts` + 49 pengujian |
| Layanan | `health-device.service.ts` |
| Endpoint | `health-device.controller.ts` — 13 jalan di `/api/v1/health/devices/**` |
| Katalog | `health-catalog.ts` — 3 menu, 2 peran, 1 aturan SoD |
| Bukti | `scripts/prove-health-device.mjs` -> [bukti-h9h-alat.txt](bukti-h9h-alat.txt) |

**Keputusan yang menentukan bentuknya**

- **ALAT TIDAK PERNAH PUNYA KREDENSIAL BASIS DATA.** Tabel alat tidak memiliki
  satu pun kolom yang menampung kata sandi, token, atau kunci — dan naskah bukti
  memeriksanya secara harfiah pada `information_schema`, bukan dengan membaca
  kodenya. Alat berbicara kepada gateway; gateway berbicara kepada integration
  engine. Perintah R2 melarang menghubungkan alat medis langsung ke basis data,
  dan larangan itu di sini berbentuk ketiadaan kolom, bukan berbentuk peringatan
  pada dokumentasi.

- **Kredensial gateway hanya berupa RUJUKAN BRANKAS**, ditegakkan constraint
  `device_gateway_secret_is_ref` dengan regex `^(vault|secret|kms)://`. Nilai
  mentah ditolak **sebelum** apa pun tersimpan, dan penolakannya menyebutkan
  alasannya: kredensial alat yang tersimpan sebagai nilai membuat setiap orang
  yang pernah membaca basis data menjadi orang yang harus dicurigai ketika ada
  kebocoran. Daftar gateway sengaja **tidak** mengembalikan rujukannya — yang
  dikembalikan hanya `has_credential`.

- **KENDALI JARAK JAUH MATI SECARA BAWAAN, UNTUK SELURUH ALAT.** Menyalakannya
  menuntut enam syarat sekaligus — persetujuan tertulis, telaah risiko, daftar
  perintah yang diizinkan, batas nilai, pencatatan perintah, dan tombol henti
  darurat — dan basis data menolak baris yang kurang satu pun lewat satu
  constraint tunggal `medical_device_remote_complete`. Satu constraint, bukan
  enam: enam constraint terpisah dapat dilewati satu per satu oleh migrasi yang
  ceroboh, sedangkan satu constraint gugur seluruhnya atau tidak sama sekali.
  Naskah bukti menghitung alat berkendali jauh **di seluruh tenant** dan menuntut
  seluruhnya lengkap — pengukuran yang tidak dapat dipalsukan oleh naskahnya
  sendiri.

- **`MANAGE_DEVICE` dan `ACTIVATE` dipisah, dan pemisahan itu yang paling
  penting di seluruh modul ini.** Teknisi elektromedis mendaftarkan alat,
  mengganti statusnya, dan mengirim perintah yang sudah diizinkan.
  Menyalakan kendali jarak jauh adalah wewenang lain sama sekali: ia memberi
  perangkat lunak izin mengubah dosis pada pasien yang sedang tidur. Orang yang
  paling memahami alatnya bukan orang yang tepat untuk memutuskannya — sebab
  keahliannyalah yang membuatnya yakin alat itu tidak akan salah. Severity
  CRITICAL, dan **tidak satu pun peran bawaan memegang `ACTIVATE`**; ia harus
  diberikan dengan sadar kepada orang yang ditunjuk namanya.

- **PERINTAH YANG DITOLAK JUSTRU YANG PALING BERHARGA DICATAT:** ia menunjukkan
  ada yang mencoba. Jejak perintah menyimpan yang diterima maupun yang ditolak
  beserta alasannya, dan tidak dapat dihapus (`forbid_ledger_mutation`).

- **HASIL TANPA IDENTITAS PASIEN TIDAK PERNAH DITEBAK.** Ia masuk antrean
  `PENDING_LINK` dan menunggu manusia. Menebak siapa pasiennya — dari waktu,
  dari ruangan, dari pemeriksaan yang kebetulan terbuka — akan benar berkali-kali
  dan salah sekali; dan yang sekali itu menempelkan hasil laboratorium orang lain
  pada rekam medis seseorang. Ditegakkan constraint
  `device_obs_patient_needs_method`: pasien tidak boleh muncul tanpa cara
  pengaitan yang tercatat.

- **Yang mengaitkan hasil tidak menelaahnya sendiri** — pola per baris yang
  keempat kalinya, sesudah H-9E, H-9G, dan H-9C. Sengaja **tidak** didaftarkan
  sebagai pasangan hak akses: petugas kotak masuk yang berpengalaman justru orang
  yang paling pantas menelaah pengaitan rekannya.

- **Dua waktu disimpan terpisah: `captured_at` dan `received_at`.** Selisihnya
  ditandai, tidak ditolak. Jam alat medis melenceng sepanjang waktu, dan menolak
  hasilnya karena jamnya salah akan membuang hasil yang sah — hasilnya benar,
  jamnya yang salah. Hal yang sama berlaku bagi kalibrasi yang kedaluwarsa:
  **ditandai, bukan ditolak**, sebab alat yang kalibrasinya lewat mungkin masih
  benar, sedangkan hasil yang dibuang pasti hilang.

- **Duplikat dikenali lewat SIDIK JARI pesan, bukan lewat waktu.** Indeks unik
  parsial `ux_device_obs_message` menolak pesan yang sama dari alat yang sama.
  Pengenalan berdasarkan jendela waktu akan membuang hasil kedua yang sah — dua
  pengukuran berturut-turut memang boleh berdekatan — dan meloloskan kiriman
  ulang yang datang terlambat.

**Yang belum:** DICOM, FHIR, dan MQTT tercatat pada katalog protokol beserta
**penghalangnya masing-masing**, dan alat yang memakainya ditolak dengan
menyebutkan penghalang itu — bukan dengan berkata "tidak didukung". H-9I
membangun adapter HL7/ASTM di atas registri ini.

### H-9J · Pemeliharaan biomedis, kalibrasi, keamanan siber — **SELESAI**

Pekerjaan pemeliharaan dan penutupannya, riwayat kalibrasi tersendiri, uji
keselamatan listrik, penilaian risiko siber beserta penahan penggantinya,
keputusan penerimaan risiko yang bertenggat, dan insiden keamanan siber alat.

Uji >= 25 -> **76 tercapai**, ditambah naskah bukti 81 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H035__health__device_maintenance.sql`, `H036__health__device_maintenance_permissions.sql`, `H037__health__device_maintenance_release_fix.sql`, `H038__health__device_safety_transition_fix.sql` |
| Aturan murni | `health-device-maintenance.ts` + 76 pengujian |
| Layanan | `health-device-maintenance.service.ts` |
| Endpoint | `health-device-maintenance.controller.ts` — 12 jalan di `/api/v1/health/device-maintenance/**` |
| Katalog | `health-catalog.ts` — 2 menu, 1 peran, 2 aturan SoD |
| Bukti | `scripts/prove-health-device-maintenance.mjs` -> [bukti-h9j-pemeliharaan-alat.txt](bukti-h9j-pemeliharaan-alat.txt) |

**Keputusan yang menentukan bentuknya**

- **TIDAK ADA SATU PUN JALAN YANG MEMATIKAN ALAT.** Bukan kelalaian: ketiganya
  dipertimbangkan dan ketiganya ditolak — trigger yang mengubah status menjadi
  DOWNTIME pada skor CRITICAL, pada pemeliharaan yang terlambat, dan pada
  insiden siber. Alat yang dimatikan sendiri oleh perangkat lunak adalah
  ventilator yang berhenti pada pasien yang sedang memakainya, dan yang tahu
  apakah alat itu sedang menopang seseorang bukan basis data melainkan orang
  yang berdiri di sebelahnya. Naskah bukti menjalankan seluruh modul dari ujung
  ke ujung — pemeliharaan terlambat dua tahun, risiko CRITICAL dengan enam
  faktor berat, insiden penyanderaan data — lalu **membaca status alatnya
  kembali dan menuntutnya tidak berubah.**

- **Satu-satunya penahan keras: uji keselamatan listrik yang GAGAL.** Sebabnya
  berbeda dari yang lain, dan perbedaannya ditulis pada kodenya: kalibrasi yang
  lewat berarti hasilnya *mungkin* menyimpang, sedangkan uji listrik yang gagal
  berarti alatnya *mungkin menyetrum orang yang menyentuhnya*. Yang pertama
  ditandai; yang kedua tidak menunggu keputusan siapa pun.

- **Penahan pengganti MENGURANGI risiko; ia tidak pernah menghilangkannya.**
  Risiko sisa tidak turun di bawah sepertiga risiko bawaannya, ditegakkan
  constraint `device_risk_residual_floor`. Skor nol berarti "tidak perlu
  ditinjau lagi", dan itu persis kebalikan dari yang benar bagi alat yang tidak
  dapat ditambal. Segmentasi yang sempurna pun tidak membuat alat ber-OS
  kedaluwarsa menjadi alat yang *aman* — ia membuatnya menjadi alat yang
  risikonya *dapat ditanggung*, dan kedua hal itu berbeda.

- **Penahan yang tidak berbukti tidak dihitung sama sekali.** Penahan yang
  diakui tanpa rujukan bukti adalah kotak yang dicentang, dan kotak yang
  dicentang adalah cara paling umum sebuah asesmen risiko menjadi tidak berarti.

- **PENERIMAAN RISIKO WAJIB BERTANGGAL TINJAU.** Penerimaan tanpa tanggal adalah
  penerimaan selamanya — dan selamanya adalah bagaimana alat tahun 2016 masih
  berjalan hari ini dengan catatan "risiko diterima" yang ditandatangani orang
  yang sudah pensiun. Menerimanya **tetap boleh**, termasuk pada tingkat
  CRITICAL: rumah sakit yang tidak dapat menerima risiko apa pun akan mematikan
  alat yang dibutuhkan pasiennya.

- **Yang menilai risiko tidak memutuskan penerimaannya sendiri.** Penilaian
  menjawab seberapa besar risikonya; keputusan menjawab apakah rumah sakit
  menanggung risiko sebesar itu — dan pertanyaan kedua menyangkut uang, jadwal
  pengadaan, dan pelayanan yang terhenti bila alatnya dipensiunkan. Ditegakkan
  constraint `device_risk_decide_not_self`.

- **Analis keamanan TIDAK dapat menyentuh alat.** Sengaja tanpa `MANAGE_DEVICE`,
  `ACTIVATE`, `UPDATE`, maupun `CREATE` pada menu alat. Analis keamanan yang
  dapat mematikan alat adalah analis keamanan yang, pada suatu malam yang buruk,
  akan mematikan alat yang sedang menopang seseorang. Severity CRITICAL.

- **Insiden siber yang mengenai perawatan pasien WAJIB tertaut ke laporan
  keselamatan pasien**, demikian pula pekerjaan korektif yang mengenai pasien.
  Dua daftar tentang satu kejadian yang sama adalah cara paling rapi untuk
  membuat kejadian itu tidak pernah dihitung: pompa infus yang berhenti karena
  penyanderaan data adalah kejadian teknologi informasi menurut satu daftar dan
  kejadian keselamatan pasien menurut daftar yang lain.

- **Riwayat kalibrasi terpisah dari kolom "terakhir dikalibrasi".** Ketika hasil
  laboratorium dipersengketakan, yang ditanyakan bukan kapan alat terakhir
  dikalibrasi, melainkan **apakah ia terkalibrasi pada hari pemeriksaan itu** —
  dan kolom tunggal tidak dapat menjawabnya.

- **Langkah penahanan dimulai dari isolasi jaringan, bukan mematikan daya**, dan
  alat yang terhubung pasien tidak pernah diputus perangkat lunak. Alat yang
  tersusupi tetapi masih menopang pasien lebih baik daripada alat yang mati.

**Dua migrasi pembetulan, dan keduanya menemukan cacat pada fase ini sendiri.**
`H037` membetulkan aksi `CLOSE` yang tidak ada pada kosakata bersama —
penyisipannya dilewati diam-diam, sehingga teknisi tidak dapat menutup
pekerjaannya sama sekali. `H038` membetulkan constraint yang memeriksa
**keadaan** padahal yang dijaga adalah **peralihan**: teknisi yang menemukan
arus bocor pada alat yang sedang menyala tidak dapat mencatat temuannya.
Keduanya diuraikan pada [07](07-test-baseline.md).

### H-9K · Dasbor investor agregat — **SELESAI**

Kebijakan penyamaran per fasilitas, proyeksi agregat berkohort minimum,
waterfall berlapis, distribusi bertiga orang, dan pernyataan penyamaran yang
disampaikan kepada pembacanya.

Uji >= 20 -> **56 tercapai**, ditambah naskah bukti 62 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H039__health__investor_dashboard.sql`, `H040__health__investor_permissions.sql`, `H041__health__investor_policy_autoseed.sql` |
| Aturan murni | `health-investor.ts` + 56 pengujian |
| Layanan | `health-investor.service.ts` |
| Endpoint | `health-investor.controller.ts` — 10 jalan di `/api/v1/health/investor/**` |
| Katalog | `health-catalog.ts` — 3 menu, 1 peran, 2 aturan SoD |
| Bukti | `scripts/prove-health-investor.mjs` -> [bukti-h9k-investor.txt](bukti-h9k-investor.txt) |

**Keputusan yang menentukan bentuknya**

- **PENEGAKANNYA BUKAN PENYARINGAN DI LAYAR.** Investor memperoleh proyeksi
  agregat yang **sudah dihitung**, bukan akses ke tabel sumbernya dengan
  penyaring. Perbedaannya menentukan: penyaring dapat dilewati siapa pun yang
  memanggil jalur di bawahnya; proyeksi yang tidak memuat data pasien tidak
  dapat mengungkapkannya sekalipun jalurnya ditembus. Karena itu
  `investor_projection_cell` **tidak punya satu pun kolom pasien** — bukan
  karena kuerinya tidak akan mengambilnya, melainkan karena tabelnya tidak punya
  tempat untuk menyimpannya. Naskah bukti memeriksanya pada `information_schema`
  beserta ketiadaan kunci asing ke tabel klinis mana pun.

- **Ambang kohort tidak boleh nol**, ditegakkan constraint
  `investor_policy_cohort_not_zero`. Ambang nol berarti tidak ada penyamaran
  sama sekali, dan konfigurasi yang mengizinkan nol akan disetel nol oleh orang
  pertama yang terganggu oleh sel yang tersembunyi.

- **YANG DISEMBUNYIKAN TIDAK MENJADI NOL**, dan nilainya **tidak tersimpan** —
  bukan tersimpan lalu disembunyikan saat ditampilkan. Nilai yang tersimpan akan
  terbaca oleh kueri berikutnya yang lupa menyaring, dan kueri berikutnya selalu
  ditulis orang yang tidak membaca migrasinya. Kohortnya ikut disembunyikan:
  menyembunyikan nilainya tetapi menampilkan "n = 2" tidak menyembunyikan apa
  pun yang penting, sebab yang berbahaya justru penyebutnya.

- **PENYAMARAN PELENGKAP.** Bila hanya satu sel yang tersamar sedangkan totalnya
  diketahui, sel itu dapat dihitung kembali dengan pengurangan — dan
  penyamarannya menjadi hiasan. Karena itu sel tampak terkecil ikut disamarkan.
  Ini bagian yang paling mudah dilupakan, dan ia yang membedakan penyamaran yang
  bekerja dari penyamaran yang hanya terlihat bekerja.

- **Dasbor mengatakan bahwa ia menyembunyikan.** Yang tersamar menyebut sebabnya
  kepada pembacanya. Dasbor yang menyembunyikan tanpa mengatakannya akan
  dipercaya sebagai gambaran lengkap, dan kesimpulan yang ditarik darinya keliru
  dengan cara yang tidak disadari siapa pun.

- **Investor memegang TEPAT SATU hak** pada seluruh modul: `DASHBOARD.READ`. Ia
  tidak dapat menghitung ulang, dan itu bukan pembatasan sewenang-wenang —
  menghitung ulang dengan ambang kohort yang lebih longgar adalah cara paling
  rapi untuk menembus penyamaran tanpa pernah melanggar satu pun aturan yang
  tertulis.

- **Urutan waterfall mengikat, dan dana yang kurang TIDAK dibagi rata.**
  Waterfall yang membagi rata ketika dananya kurang bukan waterfall. Persentase
  dihitung terhadap **sisa saat itu**, bukan nilai awal — menghitungnya terhadap
  nilai awal membuat jumlah seluruh lapisan melampaui dana yang ada, dan
  kelebihannya baru ketahuan ketika uangnya hendak dipindahkan.

- **Tanpa kontrak investor yang AKTIF, bagiannya NOL** — bukan galat dan bukan
  "belum dihitung". Sama seperti H-9G: keadaan bawaan seluruh fasilitas adalah
  tanpa kontrak, dan keadaan bawaan itu harus dapat dicatat sebagai angka.

- **TIDAK ADA PEMBAYARAN OTOMATIS.** Tiga orang berbeda: yang menghitung, yang
  menyetujui, yang membayarkan. Tidak ada trigger yang mengubah status menjadi
  APPROVED maupun PAID, tidak ada penjadwal, dan tidak ada ambang "bila nilainya
  di bawah sekian maka setujui sendiri". Sesudah dibayar, nilainya tidak dapat
  diubah: yang sudah berpindah adalah angka itu, dan mengubahnya kemudian
  membuat catatan di sini berbeda dari mutasi rekening.

**Satu migrasi pembetulan.** `H041` menemukan bahwa penyemaian kebijakan pada
`H040` hanya menjangkau fasilitas yang ada **pada saat migrasinya dijalankan** —
sehingga setiap rumah sakit yang bergabung kemudian berjalan tanpa baris
kebijakan, dan penjaga basis datanya diam. Diperbaiki dengan **meniadakan
keadaan itu**, bukan memperbaiki nilai bawaannya.

### H-9I · Adapter protokol alat HL7/ASTM — **SELESAI**

Pengurai HL7 v2 dan ASTM E1394, penerimaan pesan beserta penyimpanan aslinya,
balasan ACK, pemetaan istilah alat, dan antrean kode yang belum terpeta.

Uji >= 25 -> **88 tercapai**, ditambah naskah bukti 58 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H042__health__device_adapter.sql`, `H043__health__device_adapter_permissions.sql` |
| Aturan murni | `health-device-adapter.ts` + 88 pengujian |
| Layanan | `health-device-adapter.service.ts` |
| Endpoint | `health-device-adapter.controller.ts` — 8 jalan di `/api/v1/health/device-adapter/**` |
| Katalog | `health-catalog.ts` — 2 menu, 1 aturan SoD |
| Bukti | `scripts/prove-health-device-adapter.mjs` -> [bukti-h9i-adapter-alat.txt](bukti-h9i-adapter-alat.txt) |

**Keputusan yang menentukan bentuknya**

- **PENGURAI TIDAK PERNAH MELEMPAR GALAT.** Pesan yang rusak menghasilkan hasil
  urai yang *menyebutkan kerusakannya*, bukan pengecualian. Sebabnya bukan
  kerapian: pengurai yang melempar akan menjatuhkan seluruh jalur penerimaan
  ketika satu alat mengirim satu pesan cacat — dan alat yang mengirim pesan
  cacat biasanya mengirimnya beruntun. Satu analyzer yang firmware-nya baru
  diperbarui dapat menghentikan penerimaan hasil seluruh laboratorium. Diuji
  dengan dua belas bentuk pesan rusak, seluruhnya pada kedua pengurai.

- **PESAN DISIMPAN LEBIH DAHULU, DIURAI KEMUDIAN.** Menyimpan sesudah berhasil
  diurai berarti pesan yang gagal diurai tidak pernah ada — dan pesan yang gagal
  diurai justru satu-satunya petunjuk tentang alat yang firmware-nya baru
  diperbarui. Permintaannya tetap berhasil, dan pesan gagal wajib menyebutkan
  sebabnya (`device_msg_failure_explained`).

- **Pesan asli tidak dapat diubah maupun dihapus**, ditegakkan trigger
  `forbid_inbound_message_tamper` — dan yang dikunci bukan seluruh barisnya:
  penanda pemrosesannya masih boleh berubah, sebab pemrosesannya memang terjadi
  kemudian. Ketika hasil laboratorium dipersengketakan, yang ditanyakan adalah
  *apakah yang tersimpan sama dengan yang dikirim alat* — dan itu hanya dapat
  dijawab bila pesannya masih utuh.

- **Karakter pemisah HL7 dibaca dari MSH-1 dan MSH-2, tidak diasumsikan.**
  Standar mengizinkan pengirim memilih pemisahnya sendiri, dan sebagian alat
  memakainya. Pengurai yang mengasumsikan pemisah baku akan bekerja pada
  sembilan puluh sembilan alat dan menghasilkan omong kosong pada yang
  keseratus, tanpa galat apa pun.

- **ZONA WAKTU YANG TIDAK DISEBUTKAN TIDAK DIANGGAP UTC.** Alat medis hampir
  tidak pernah menyertakan zona waktu, dan menganggapnya UTC menggeser seluruh
  hasil tujuh jam di Indonesia — cukup untuk memindahkan hasil pagi ke hari
  sebelumnya. Ia ditandai, dan waktunya dibaca sebagai waktu lokal fasilitas.

- **PESAN CACAT DIBALAS `AE`, BUKAN `AR`.** Perbedaannya menentukan perilaku
  alat: `AR` membuat sebagian alat mengirim ulang pesan yang sama tanpa henti,
  sedangkan `AE` membuatnya melanjutkan. Pesan yang cacat karena isinya akan
  tetap cacat berapa kali pun dikirim ulang, dan alat yang mengirim ulang tanpa
  henti akan memenuhi antrean sampai hasil pasien lain tidak dapat masuk.

- **Jenis pesan adalah daftar TERTUTUP**, dan ADT maupun ORM sengaja tidak
  diterima: pendaftaran pasien dan pemesanan pemeriksaan datang dari eMedik,
  bukan dari alat.

- **KODE YANG BELUM TERPETA TIDAK DITEBAK.** Ia masuk antrean tersendiri —
  bukan disimpan sebagai pemetaan kosong pada tabel yang sama, yang akan terbaca
  sebagai pemetaan yang memetakan ke ketiadaan. Menebaknya dengan kemiripan nama
  akan benar hampir selalu dan salah sekali, dan yang sekali itu menaruh kadar
  kalium pada baris natrium. Antreannya terurut menurut yang paling sering
  muncul: kode yang muncul tiga ratus kali sehari menahan tiga ratus hasil.

- **Satuan yang berubah diam-diam ditandai.** Satuan yang berubah adalah cara
  alat yang baru diperbarui melipatgandakan seluruh hasilnya tanpa ada yang tahu.

- **Yang menerima pesan tidak memetakan kodenya.** Pemetaan dipegang analis
  laboratorium yang mengenal pemeriksaannya, bukan teknisi yang mengurus lalu
  lintasnya. Bukan soal kepercayaan melainkan soal siapa yang sanggup melihat
  kekeliruannya.

- **Pemetaan tidak ditimpa; ia dinonaktifkan lalu dibuat baru.** Pertanyaan
  "kode ini dulu dipetakan ke mana" muncul persis ketika ada hasil lama yang
  dipersengketakan.

**Yang belum:** DICOM, DICOMweb, Modality Worklist, MPPS, FHIR, API vendor, dan
MQTT tercatat pada katalog beserta **penghalangnya masing-masing**, dan pesan
yang memakainya ditolak dengan menyebutkan penghalang itu.

### H-9A · Kerangka SATUSEHAT — **SELESAI**

Pendaftaran lingkungan beserta rujukan kredensialnya, matriks kemampuan dua
puluh sumber daya FHIR, pemetaan entitas lokal, jejak percobaan pengiriman
berkunci idempotensi, dan rekonsiliasi.

Uji >= 20 -> **48 tercapai**, ditambah naskah bukti 56 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H044__health__satusehat_skeleton.sql`, `H045__health__satusehat_permissions.sql` |
| Aturan murni | `health-satusehat.ts` + 48 pengujian |
| Layanan | `health-satusehat.service.ts` |
| Endpoint | `health-satusehat.controller.ts` — 8 jalan di `/api/v1/health/satusehat/**` |
| Katalog | `health-catalog.ts` — 2 menu, 1 peran, 1 aturan SoD |
| Bukti | `scripts/prove-health-satusehat.mjs` -> [bukti-h9a-satusehat.txt](bukti-h9a-satusehat.txt) |

**Keputusan yang menentukan bentuknya**

- **INI KERANGKA YANG MENOLAK BERJALAN, DAN ITULAH MAKSUDNYA.** Perintah R2 §5:
  *"Jangan mengarang endpoint/payload."* Adapter yang berpura-pura bekerja akan
  tampak berhasil pada pengembangan lalu mengirimkan data pasien ke tempat yang
  salah pada hari pertama produksi. `POST /transmissions` menyiapkan, memeriksa
  gerbangnya, mencatat percobaannya, dan **menolak**.

- **Tidak ada satu pun kolom yang menampung payload FHIR maupun rahasia.**
  Diperiksa naskah bukti pada `information_schema`, termasuk ketiadaan kolom
  JSON pada tabel transaksi. Menyediakan tempat menyimpannya sebelum bentuknya
  diketahui akan mengundang orang pertama yang membutuhkannya untuk
  mengarangnya.

- **Seluruh dua puluh kemampuan `BLOCKED`**, dan itu bukan nilai bawaan yang
  menunggu diisi melainkan keadaan yang sesungguhnya. Naskah bukti membuktikan
  keduanya tetap `BLOCKED` **sesudah** lingkungannya didaftarkan dan
  diaktifkan: lingkungan aktif tidak membuka gerbang.

- **Matriksnya mencatat sumber datanya di sisi kami.** Delapan belas dari dua
  puluh sudah punya tabelnya sendiri sejak H-1 sampai H-8. Ini yang membedakan
  "belum dibangun" dari "belum dapat dibangun": penghalangnya benar-benar hanya
  pada lapisan pertukaran.

- **`VERIFIED` hanya boleh diberikan MANUSIA** yang sudah menjalankan
  panggilannya terhadap sandbox — bukan program, dan bukan berdasarkan
  dokumentasi saja. Ditegakkan constraint `satusehat_cap_verified_complete`:
  nama, keenam buktinya, dan keterangan sekurangnya dua puluh huruf.

- **Kenaikan status tidak boleh melompat**, ditegakkan trigger
  `forbid_capability_status_skip`. Tahap yang dilompati justru yang menemukan
  bahwa dokumentasinya berbeda dari sandbox-nya, dan perbedaan itu selalu ada.
  **Penurunan selalu diizinkan**: yang ternyata tidak bekerja harus dapat
  dikembalikan tanpa perdebatan, dan penurunan yang sulit adalah penurunan yang
  tidak akan dilakukan.

- **Yang mengaktifkan lingkungan tidak memverifikasi kemampuannya.**
  Administrator yang memasang kredensial adalah orang yang paling ingin
  gerbangnya terbuka — sebab pekerjaannya belum selesai sampai ia terbuka.
  Severity CRITICAL.

- **Kunci idempotensi deterministik dari isinya, bukan dari waktunya.** Kunci
  yang bergantung waktu membuat setiap percobaan ulang menjadi pengiriman baru,
  dan sumber daya ganda di sistem nasional tidak dapat dihapus dari sini. Yang
  sudah `SUCCESS` tidak diulang; yang `REJECTED` pun tidak — yang perlu
  diperbaiki adalah datanya, bukan percobaannya.

- **Percobaan yang tertahan gerbang tetap dicatat.** Ia menunjukkan bahwa
  seseorang mencoba, dan kapan.

- **Rekonsiliasi wajib.** Tanpa itu, "sudah dikirim" hanya berarti "sudah kami
  coba" — dan perbedaan antara keduanya baru terlihat ketika ada yang
  menanyakan data yang seharusnya ada di sana.

**Yang belum, dan sengaja:** payload FHIR, alur OAuth, dan jalur pengiriman
otomatis. `susunPayload()` ada sebagai fungsi yang **melempar** beserta
penjelasannya — supaya orang yang mencari "di mana payload-nya dibuat"
menemukan alasan alih-alih ketiadaan. Ketiadaan akan ditafsirkan sebagai
kelalaian, dan orang yang menafsirkannya begitu akan menuliskannya sendiri.

### H-9B · Kerangka BPJS/JKN — **SELESAI**

Akun penyedia beserta rujukan kredensialnya, gerbang tujuh adapter, kepesertaan
sebagai cache berkedaluwarsa, SEP sebagai catatan lokal, klaim paket, dan
kebijakan kelas/KRIS berversi.

Uji >= 20 -> **51 tercapai**, ditambah naskah bukti 62 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H046__health__bpjs_skeleton.sql`, `H047__health__bpjs_permissions.sql` |
| Aturan murni | `health-bpjs.ts` + 51 pengujian |
| Layanan | `health-bpjs.service.ts` |
| Endpoint | `health-bpjs.controller.ts` — 11 jalan di `/api/v1/health/bpjs/**` |
| Katalog | `health-catalog.ts` — 3 menu, 1 aturan SoD |
| Bukti | `scripts/prove-health-bpjs.mjs` -> [bukti-h9b-bpjs.txt](bukti-h9b-bpjs.txt) |

**Keputusan yang menentukan bentuknya**

- **ATURAN PAKET KASUS, DAN IA MENENTUKAN BENTUK BASIS DATA.** INA-CBG adalah
  pembayaran berbasis paket. Seorang pasien yang menerima obat senilai dua juta
  pada paket senilai lima juta **tidak** membuat BPJS mengganti dua juta untuk
  obat itu — yang diganti adalah paketnya. Karena itu `bpjs_claim_item`
  menyimpan biaya **aktual** dan tagihan **pasien**, dan **tidak punya satu pun
  kolom penggantian BPJS**. Kolom yang menyimpannya akan dijumlahkan laporan,
  dan jumlah itu akan dipakai menghitung jasa dokter.

- **Aturan itu ditegakkan pada tiga lapis**, dan naskah bukti memeriksa
  ketiganya: kolomnya tidak ada (`information_schema`), ValidationPipe global
  menolak permintaan HTTP yang membawanya, dan pemeriksaan pada layanan
  menjelaskan **alasannya** bagi pemanggil dari dalam proses — yang tidak
  melewati ValidationPipe sama sekali.

- **Casemix group tidak dapat diisi tanpa adapter**
  (`bpjs_claim_group_from_adapter`). Tarif yang diketik dari ingatan
  menghasilkan angka yang tampak masuk akal, dipakai menyusun anggaran, lalu
  dipakai membagi jasa medis — sampai klaim pertamanya kembali dengan angka yang
  berbeda.

- **BPJS dan SATUSEHAT tidak bertaut sama sekali.** Naskah bukti menghitung
  kunci asing di antara keduanya dan menuntut nol. Menyatukannya akan membuat
  kegagalan pengiriman FHIR menghentikan pengajuan klaim.

- **Penolakan adapter menyebutkan apa yang MASIH dapat dikerjakan.** Hampir
  seluruh siklus klaim di dalam rumah sakit tidak menuntut adapter mana pun;
  penolakan yang tidak menyebutkannya akan dibaca sebagai "seluruh klaim
  berhenti", dan itu keliru.

- **Kepesertaan adalah CACHE dengan kedaluwarsa wajib**, dan ia membedakan
  sumber `ADAPTER` dari `MANUAL`. Kolom yang tidak membedakannya membuat data
  ketikan tampak seperti jawaban resmi.

- **PASIEN SELALU BOLEH DILAYANI.** Yang diputuskan modul ini bukan
  pelayanannya melainkan siapa yang membayar. Menolak melayani karena
  kepesertaan tidak aktif adalah keputusan yang bukan milik perangkat lunak.

- **Nomor SEP datang dari BPJS.** Tabelnya tidak punya urutan yang dapat dipakai
  menghasilkannya, dan yang ditolak hanyalah nomor yang **jelas dibuat
  sendiri** — format resminya milik BPJS, dan menebaknya akan menolak nomor sah
  dari fasilitas yang kodenya berbeda, pada saat pasien sedang menunggu.

- **Naik kelas tidak menahan klaim**, dan selisihnya ditagihkan kepada pasien
  bila atas permintaannya — kepada fasilitas bila bukan. Pelajaran H-9C.

- **Kelas dan KRIS adalah kebijakan berversi**, wajib menunjuk peraturannya.
  Tata kelola JKN memang berubah, dan perubahannya harus dapat diikuti tanpa
  mengubah kode.

**Yang belum, dan sengaja:** panggilan HTTP ke BPJS, pengelompokan INA-CBG, dan
nilai tarif resmi. `kelompokkanInacbg()` ada sebagai fungsi yang **melempar**
beserta penjelasannya.

### H-9M · Kerangka impor KFA dan terminologi resmi — **SELESAI**

Katalog terminologi beserta penanda sumbernya, berkas impor bersidik jari,
alur terima–validasi–terapkan yang dipegang dua orang, dan pemetaan KFA.

Uji >= 20 -> **41 tercapai**, ditambah naskah bukti 52 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H048__health__kfa_import.sql`, `H049__health__kfa_permissions.sql` |
| Aturan murni | `health-kfa.ts` + 41 pengujian |
| Layanan | `health-kfa.service.ts` |
| Endpoint | `health-kfa.controller.ts` — 8 jalan di `/api/v1/health/terminology/**` |
| Katalog | `health-catalog.ts` — 1 menu baru, `VERIFY` pada menu H-9, 1 peran, 1 aturan SoD |
| Bukti | `scripts/prove-health-kfa.mjs` -> [bukti-h9m-kfa.txt](bukti-h9m-kfa.txt) |

**Keputusan yang menentukan bentuknya**

- **HARGA SINTETIS TIDAK DAPAT MENYEBUT DIRINYA RESMI.** Data contoh dibuat
  supaya penyewa baru dapat melihat sistemnya bekerja tanpa mengetik dua ribu
  baris. Bila harga contoh itu tidak dibedakan dari harga resmi, seseorang akan
  memakainya menagih pasien — dan ketika ketahuan, tidak ada cara membedakan
  mana yang contoh dan mana yang sungguhan. Setiap baris membawa `data_source`,
  dan constraint `terminology_official_has_edition` menuntut yang mengaku resmi
  menyebutkan terbitan beserta tanggalnya: rujukan "resmi" tanpa nama terbitan
  tidak dapat diperiksa siapa pun, dan **yang tidak dapat diperiksa akan
  dipercaya**.

- **OBAT YANG BELUM TERPETAKAN KE KFA TETAP DAPAT DIPAKAI**, dan itu berbentuk
  **ketiadaan**: tidak ada kolom `kfa_code NOT NULL` pada tabel produk, tidak
  ada constraint yang menahan resep tanpa pemetaan, dan tidak ada trigger yang
  menonaktifkan obat yang belum terpetakan. Naskah bukti memeriksa ketiganya.
  Yang tidak dapat dilakukan hanyalah mengirimkannya ke SATUSEHAT. Menahan
  seluruh farmasi sampai pemetaannya selesai akan menghentikan pelayanan demi
  kerapian data — dan pelayanan yang berhenti demi kerapian data akan
  dijalankan **di luar sistem**, tempat tidak ada yang mencatatnya sama sekali.

- **PEMETAAN BERDASARKAN KEMIRIPAN NAMA DITOLAK**, pada layanan maupun pada
  basis data — daftar cara pemetaannya tertutup dan tidak memuatnya sama sekali.
  "Amlodipine 5 mg" dan "Amlodipine 10 mg" berbeda satu karakter dan berbeda dua
  kali lipat dosisnya, dan yang salah petakan akan dikirim ke SATUSEHAT sebagai
  obat yang bukan diberikan.

- **Tanpa katalognya, sistem berkata "belum dapat dinilai"** — bukan "tidak ada
  masalah". "Tidak ada interaksi obat" pada sistem yang belum punya katalog
  interaksinya adalah kebohongan yang berbeda, dan yang membacanya bertindak
  berbeda pula.

- **Berkas impor disimpan beserta sidik jarinya**, dan duplikat dikenali dari
  isinya — berkas yang sama dengan nama berbeda tetap berkas yang sama.

- **Impor yang masih bergalat tidak diterapkan.** Impor sebagian menghasilkan
  katalog yang separuhnya baru dan separuhnya lama, dan tidak ada yang tahu
  baris mana yang mana.

- **Yang memvalidasi tidak menerapkannya sendiri.** Katalog obat menentukan apa
  yang boleh diresepkan seluruh rumah sakit, dan berkas dua ribu baris adalah
  tempat paling mudah bagi satu baris yang keliru untuk lolos tanpa dilihat
  siapa pun.

- **Yang memetakan KFA adalah apotekernya**, sama seperti yang memetakan kode
  alat pada H-9I adalah analis laboratoriumnya. Bukan soal kepercayaan melainkan
  soal siapa yang sanggup melihat kekeliruannya.

**Yang belum:** isi seluruh katalog. Strukturnya ada, dan penanda sumbernya
memastikan yang kosong tidak pernah menyamar sebagai yang terisi.

### H-10 · Portal pasien dan website fasilitas — **SELESAI**

Akun portal beserta verifikasi tatap muka, janji temu, antrean, hasil yang boleh
dibuka, resep, ringkasan kunjungan, akses wali berjenjang, dan website fasilitas.

Uji >= 25 -> **54 tercapai**, ditambah naskah bukti 63 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H050__health__patient_portal.sql`, `H051__health__portal_permissions.sql` |
| Aturan murni | `health-portal.ts` + 54 pengujian |
| Layanan | `health-portal.service.ts` |
| Endpoint | `health-portal.controller.ts` — 15 jalan pada tiga pengendali terpisah |
| Katalog | `health-catalog.ts` — 3 menu, 1 peran, 1 aturan SoD |
| Bukti | `scripts/prove-health-portal.mjs` -> [bukti-h10-portal.txt](bukti-h10-portal.txt) |

**Keputusan yang menentukan bentuknya**

- **IDENTITAS DARI TOKEN, TIDAK PERNAH DARI PARAMETER.** Tidak satu pun metode
  portal menerima `patientId`; yang diterimanya adalah `platformUserId` dari
  token, dan pasien mana yang dibaca ditentukan dengan membaca
  `patient_portal_account`. Naskah bukti menguji ini dengan cara paling
  langsung: **pasien A mengirimkan nomor pasien B pada setiap jalan portal**,
  dan seluruhnya harus 403 — bukan sebagian, sebab satu jalan yang lolos cukup
  untuk membocorkan seluruh rekam medis rumah sakit.

- **`subjectPatientId` bukan pengecualiannya.** Ia pilihan di antara yang sudah
  dimiliki tokennya, dicocokkan dengan daftar perwalian sebelum dipakai.
  Perbedaannya menentukan: parameter yang dipakai apa adanya adalah kebocoran;
  parameter yang dicocokkan dengan daftar milik tokennya adalah penyaring.

- **Tiga kelompok jalan yang sengaja terpisah**: `/health/portal/**` untuk
  pasien, `/health/portal-admin/**` untuk petugas, `/health/public/**` tanpa
  masuk sama sekali. Menyatukannya akan membuat satu kekeliruan pada penjaga
  rute memberi pasien jalan petugas.

- **Pasien tidak punya peran pada mesin hak akses menu.** Rute portal ditandai
  `@AuthenticatedOnly`, dan yang menjaganya adalah `patient_portal_account` —
  penjaga yang lebih sempit, sebab ia menentukan pasien MANA yang dibaca, bukan
  sekadar boleh atau tidak. Memberi pasien satu peran pada mesin yang sama
  dengan petugas berarti satu kekeliruan konfigurasi memberinya hak petugas.

- **Satu akun, satu pasien — dan sebaliknya.** Dua indeks unik, bukan satu:
  hanya memasang salah satunya meninggalkan separuh pintunya terbuka. Akun yang
  menaut dua pasien membuat jejak akses tidak dapat dibaca — yang tercatat
  adalah "akun ini membuka rekam medis", dan pertanyaan yang sesungguhnya tidak
  terjawab. Wali diselesaikan lewat `patient_proxy`: orang tua yang membuka
  rekam medis anaknya **tetap dirinya sendiri** pada jejak akses.

- **Akun aktif wajib terverifikasi tatap muka.** Akun portal yang dibuat tanpa
  verifikasi adalah rekam medis yang diserahkan kepada siapa pun yang mengetahui
  tanggal lahir seseorang.

- **HASIL KRITIS TIDAK MUNCUL DI PORTAL SAMPAI DILEPAS**, dan tidak dapat
  dilepas tanpa menghubungi pasiennya lebih dahulu. Pasien yang membaca "kalium
  6,8" tengah malam tanpa seorang pun yang menjelaskan akan panik atau
  mengabaikannya; keduanya lebih buruk daripada menunggu sampai dokternya
  menelepon. Naskah bukti memeriksa bahwa **angkanya tidak ada pada jawabannya
  sama sekali** — bukan disertakan lalu disembunyikan di layar.

- **Yang ditahan tetap muncul sebagai baris**, dengan pesannya sendiri.
  Menyembunyikan barisnya akan membuat pasien mengira pemeriksaannya belum
  dikerjakan, lalu datang menanyakannya — dan itulah yang justru hendak
  dihindari.

- **Catatan klinis tidak dibuka kepada siapa pun lewat portal**, termasuk
  kepada pasiennya sendiri. Ia memuat dugaan dan kemungkinan yang belum
  dipastikan: "curiga keganasan, singkirkan dulu" ditulis untuk dibaca dokter
  berikutnya, bukan untuk dibaca pasiennya pada pukul dua pagi.

- **Perwalian berjenjang, dan pencabutannya langsung berlaku.** Wali
  `SUMMARY_ONLY` melihat ringkasan kunjungan tetapi tidak hasil laboratorium.

- **Penolakan dicatat dan diindeks tersendiri.** Penolakan beruntun dari satu
  akun adalah tanda seseorang sedang mencoba nomor pasien lain, dan yang
  mencarinya tidak boleh menyaring jutaan baris berhasil untuk menemukan
  puluhan yang ditolak.

- **Website publik tidak dapat memuat data pasien**, dan diperiksa dua kali:
  tabelnya tidak punya kolom pasien maupun kunci asing ke tabel klinis, dan
  teksnya ditolak bila memuat NIK atau nomor rekam medis. Satu nomor yang lolos
  tidak dapat ditarik kembali — mesin pencari sudah menyalinnya.

**Yang belum:** SATUSEHAT, BPJS, alat laboratorium, dan PACS. Ketiganya sudah
dibangun sebagai kerangka bergerbang pada H-9A, H-9B, dan H-9I — bukan sebagai
implementasi tiruan yang berpura-pura bekerja.

### H-11 · Peran, data contoh, laporan — **SELESAI**

Kumpulan penyemaian berbenih deterministik, pembersihan yang menyembunyikan,
daftar izin tabel sebagai baris basis data, delapan laporan agregat, dan tiga
penghalang yang dicatat beserta jalan keluarnya.

Uji >= 25 -> **35 tercapai**, ditambah naskah bukti 55 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H052__health__sample_and_report.sql`, `H053__health__sample_permissions.sql`, `H054__health__sample_hideable_fix.sql` |
| Aturan murni | `health-sample.ts` + 35 pengujian |
| Layanan | `health-sample.service.ts` |
| Endpoint | `health-sample.controller.ts` — 8 jalan di `/api/v1/health/sample/**` |
| Katalog | `health-catalog.ts` — 2 menu, 1 aturan SoD |
| Bukti | `scripts/prove-health-sample.mjs` -> [bukti-h11-data-contoh.txt](bukti-h11-data-contoh.txt) |

**Keputusan yang menentukan bentuknya**

- **DUA LARANGAN YANG TERDENGAR MIRIP DAN BERBEDA SAMA SEKALI.** *Jangan
  hard-delete sample data* tentang **cara**: data contoh disembunyikan, bukan
  dihapus. *Jangan menghapus data real saat cleanup sample* tentang **sasaran**,
  dan ia jauh lebih berbahaya: pembersihan yang salah sasaran menghapus rekam
  medis, tidak menimbulkan galat, tidak terlihat pada pengujian mana pun yang
  memakai basis data kosong, dan ditemukan oleh perawat yang mencari catatan
  pasiennya.

- **Naskah bukti membuat baris SUNGGUHAN dan baris CONTOH pada tabel yang
  sama**, menjalankan pembersihan, lalu menghitung ulang. Baris sungguhannya
  harus sama persis — bukan "kurang lebih". Ditegakkan constraint
  `sample_count_real_unchanged` pula, dan seluruh transaksinya dibatalkan bila
  satu baris pun berubah.

- **Daftar izin tabel dipasang sebagai BARIS BASIS DATA, bukan tetapan pada
  kode.** Daftar yang ada di kode dapat diubah seseorang bersamaan dengan
  mengubah kueri pembersihnya, dan keduanya akan lolos telaah sebagai satu
  perubahan yang tampak wajar. Daftar yang ada di basis data menuntut migrasi
  tersendiri — dan migrasi tersendiri dibaca orang lain.

- **Setiap baris daftar menyebutkan kolom penandanya**, dibaca dari
  `information_schema`. Tabel-tabel ini tidak seragam: sebagian memakai
  `is_sample`, sebagian `is_sample_data`. Menebak yang mana akan menghasilkan
  kueri yang menyentuh seluruh barisnya.

- **Daftar izinnya hanya memuat tabel yang benar-benar dapat disembunyikan** —
  sepuluh dari tiga puluh empat. Sisanya dicatat sebagai **keterbatasan yang
  dinyatakan**, bukan kemampuan yang berpura-pura ada.

- **Nama aksinya `HARD_DELETE`, sekalipun yang dilakukannya menyembunyikan.**
  Nama yang menenangkan akan membuat orang menekannya tanpa membaca layar
  konfirmasi.

- **Yang menyemai bukan yang membersihkan.** Administrator menyemai; direktur
  membersihkan — jabatan yang paling jarang menekan tombol, dan itulah gunanya.
  Severity CRITICAL.

- **Benih penyemaian wajib dan deterministik.** Data contoh yang berbeda setiap
  kali disemai tidak dapat dipakai mendemonstrasikan apa pun dua kali — dan yang
  mendemonstrasikannya akan berkata "kemarin angkanya lain" di depan calon
  penggunanya.

- **Jumlah baris berbatas dua arah.** Terlalu sedikit membuat layar tampak
  rusak; terlalu banyak membuat demo lambat, dan demo yang lambat membuat orang
  menyimpulkan sistemnya lambat.

- **Seluruh laporan agregat**, dan itu diuji — bukan sekadar ditulis pada
  komentar. Laporan tingkat pasien yang ditambahkan kelak akan membuat ujinya
  gagal, dan kegagalannya memaksa orang yang menambahkannya memikirkan siapa
  yang boleh membukanya. Rentangnya wajib berbatas: laporan tanpa batas memindai
  seluruh riwayat rumah sakit pada jam sibuk.

**Yang terhalang, dan dicatat apa adanya:**

| Terhalang | Sebab | Jalan keluar yang ada |
|---|---|---|
| Pusat Bantuan | V8-1/V8-2 tidak pernah dibangun | Setiap penolakan eMedik menyebut **alasannya** — menjawab pertanyaan yang paling sering ditanyakan kepada Pusat Bantuan |
| Ekspor Excel | V8-5/V8-6 tidak pernah dibangun | Seluruh laporan tersedia sebagai JSON lewat API |
| Cetak PDF | V8-7 tidak pernah dibangun | Cetak dari peramban — **dan ia jujur bahwa itu bukan pengganti yang setara**: cetakan peramban tidak berkop dan tidak bernomor |

`POST /reports/:kode/export` **selalu menolak**, dan penolakannya menyebutkan
sebab dan jalan keluarnya. Sistem yang diam tentang apa yang tidak dapat
dilakukannya akan ditanyakan berulang kali oleh orang yang berbeda — dan salah
satu di antaranya akan membangunnya sendiri dengan cara yang tidak dapat
dipelihara siapa pun.

**Peran:** 43 peran kesehatan, melampaui 29 yang diminta. Delapan di antaranya
dinyatakan **tanpa satu pun hak atas data pasien**, dan naskah bukti memeriksa
kedelapannya menurut namanya — bukan menurut ambang persentase yang berubah
setiap kali satu peran ditambahkan.

### H-12 · Keamanan, E2E, kinerja, UAT — **SELESAI**

Lima zona data yang digolongkan menurut akibat kebocorannya, tiga puluh satu
medan yang tergolong sebagai baris basis data, telaah break-glass yang selama
sebelas fase tidak pernah dibangun, penyamaran yang menyisakan bentuknya, dan
penjaga AI yang mencatat apa yang **tidak** dikirimnya.

Uji >= 40 -> **75 tercapai**, ditambah naskah bukti 92 pemeriksaan.

**Yang dibangun**

| Bagian | Berkas |
|---|---|
| Migrasi | `H057__health__security_zone.sql`, `H058__health__security_permissions.sql` |
| Aturan murni | `health-security.ts` + 75 pengujian |
| Layanan | `health-security.service.ts` |
| Endpoint | `health-security.controller.ts` — 14 jalan di `/api/v1/health/security/**` |
| Katalog | `health-catalog.ts` — 3 menu, 1 aturan SoD |
| Bukti | `scripts/prove-health-security.mjs` -> [bukti-h12-keamanan.txt](bukti-h12-keamanan.txt) |

**Keputusan yang menentukan bentuknya**

- **FASE INI TIDAK MENAMBAH KEMAMPUAN; IA MEMERIKSA BAHWA PENJAGA SEBELAS FASE
  SEBELUMNYA BERDIRI.** Karena itu sebagian besar isinya berbentuk pemeriksaan,
  bukan tindakan — dan sebagian besar naskah buktinya berbentuk serangan, bukan
  penggunaan.

- **Zona digolongkan menurut AKIBAT KEBOCORANNYA, bukan menurut tingkat
  rendah/sedang/tinggi.** Tingkat bernomor ditafsirkan sendiri oleh setiap orang
  yang membacanya. Zona `IDENTIFYING` belum menyebut penyakit apa pun — dan
  justru karena itu sering dianggap tidak berbahaya, padahal ia kunci yang
  membuka seluruh sisanya.

- **Ia TIDAK menambahkan pencatatan akses.** `health_access_log` sudah ada sejak
  H002 lengkap dengan `purpose_of_use`, `break_glass`, dan `break_glass_reason`.
  Tabel kedua yang mencatat hal yang sama akan menghasilkan dua jawaban berbeda
  atas pertanyaan "siapa membuka rekam medis ini", dan yang bertanya tidak akan
  tahu mana yang benar. Yang ditambahkannya adalah **telaahnya**.

- **Break-glass tidak pernah ditolak atas dasar penilaian tentang keadaan
  daruratnya, dan selalu ditelaah.** Rancangan pertamanya menyingkatnya menjadi
  "tidak pernah ditolak", dan basis datalah yang membetulkannya: H002 menuntut
  alasan sekurang-kurangnya sepuluh huruf. Tuntutan itu dipertahankan, bukan
  dilonggarkan — break-glass tanpa satu pun kata tidak dapat ditelaah siapa pun,
  dan yang tidak dapat ditelaah sama saja dengan yang tidak dicatat.

- **Antrean telaah diurut menurut yang paling mencurigakan, BUKAN menurut
  waktu.** Antrean yang diurut waktu akan membuat yang paling mencurigakan
  tenggelam di bawah ratusan akses yang wajar, dan yang menelaahnya berhenti
  pada halaman kedua.

- **Penyamaran menyisakan bentuknya.** "Tono Suryo" menjadi "T*** S****", bukan
  "[DISAMARKAN]" — sebab petugas yang membandingkan dua daftar perlu tahu bahwa
  keduanya menunjuk orang yang berbeda, dan "[DISAMARKAN]" pada dua baris tampak
  seperti orang yang sama.

- **Kolom yang belum tergolong dikembalikan apa adanya DAN disebutkan.**
  Menyamarkannya diam-diam akan menyembunyikan bahwa daftar penggolongannya
  belum lengkap — dan daftar yang belum lengkap yang tidak diketahui siapa pun
  adalah keadaan yang paling berbahaya.

- **Permintaan AI yang menggabungkan dua tenant tidak pernah sah, sekalipun
  seluruhnya sudah disamarkan.** Yang bocor bukan hanya nilainya melainkan fakta
  bahwa keduanya dibandingkan.

- **Log penjaga AI mencatat yang DITOLAK, dan tidak menyimpan teksnya.** AI
  Gateway bersama sudah mencatat yang dikirim; yang tidak dapat dicatatnya
  adalah yang tidak pernah sampai kepadanya. Seorang petugas yang tiga puluh
  kali mencoba mengirim rekam medis ke model bahasa tidak muncul sama sekali
  pada log gateway. Teksnya tidak disimpan sebab log yang menyimpan teks yang
  ditolak akan menyimpan persis data yang penolakannya bermaksud melindungi.

- **KEMUNCULAN KEENAM POLA YANG SAMA:** larangan menelaah akses sendiri
  **tidak** didaftarkan sebagai pasangan hak yang bertentangan. Setiap penelaah
  memegang hak yang sama, jadi tidak ada dua hak yang dapat dipertentangkan;
  yang terlarang adalah hubungan antara **satu orang dan satu baris**.
  Mendaftarkannya justru akan melumpuhkan telaahnya — satu-satunya cara
  memenuhinya adalah mencabut hak telaah dari seluruh dokter, dan yang paling
  memahami apakah suatu akses darurat wajar adalah dokter. Ditegakkan trigger
  `check_break_glass_review`. Yang **didaftarkan** adalah yang lain: yang
  menggolongkan medan bukan yang menelaah aksesnya.

- **Uraian peran Manajer Mutu sudah berbunyi "menelaah akses darurat" sejak
  H-2**, sebelas fase sebelum telaahnya ada. Baru sekarang kalimat itu menjadi
  benar.

**Yang ditemukan naskah buktinya** — tiga cacat, dua di antaranya cacat yang
sama berulang: kosakata yang disusun dari ingatan alih-alih dibaca dari skema.
Rinciannya pada [07 — garis dasar pengujian](07-test-baseline.md).

**Cacat pada Core yang ditemukan sepanjang jalan:** penjaga checksum migrasi
tidak membedakan percobaan yang GAGAL dari yang BERHASIL, sehingga migrasi yang
gagal lalu dijalankan ulang tanpa diubah dilaporkan sebagai *sudah diterapkan*
padahal tabelnya tidak pernah dibuat. Diajukan lewat
[005](../integration-requests/health/005-riwayat-migrasi-gagal-mengunci-versi.md);
nomor H055 dan H056 dihanguskan.

**Yang TIDAK dikerjakan fase ini, dan sebabnya**

- **Uji E2E, uji kinerja, dan UAT.** Ketiganya menuntut layar. Tiga puluh satu
  modul API kini berdiri di belakang **empat** layar web, dan uji penerimaan
  pengguna atas API tanpa layar bukan uji penerimaan pengguna — ia uji API
  dengan nama yang lain. Dicatat sebagai penghalang, bukan sebagai pekerjaan
  yang terlewat.

---

## Fase layar (W)

Dua belas fase H membangun API. Fase W membangun layarnya, dengan urutan yang
berbeda dari urutan H: yang menentukan bukan urutan pembangunan API-nya,
melainkan **berapa banyak orang yang tidak dapat bekerja tanpa layarnya**.

### W-1 · Puskesmas dan Posyandu — **SELESAI**

Lima layar: folder keluarga, pertumbuhan, imunisasi, kunjungan rumah, cakupan.

Didahulukan sebab ia satu-satunya perkara di mana **satu kategori fasilitas
penuh tidak dapat memakai sistemnya sama sekali** untuk kerja hariannya. Rumah
sakit sudah punya delapan layar sejak H-7; Puskesmas punya nol, sekalipun
API-nya lengkap sejak H-8.

| Bagian | Berkas |
|---|---|
| Migrasi | `H059__health__menu_truth_fix.sql` |
| Layar | `FamilyPage`, `GrowthPage`, `ImmunizationPage`, `HomeVisitPage`, `CoveragePage` |
| Klien | `health-api.ts` — 7 jalan komunitas, 3 peta label |
| Uji | `puskesmas-pages.spec.tsx` 16; `health-api.spec.ts` 34 -> 40 |

**Keputusan yang menentukan bentuknya**

- **Urutan daftar kunjungan rumah tidak dapat diubah pengguna.** Setiap daftar
  lain boleh diurut sesuka penggunanya; yang ini tidak. Peladen sudah
  mengurutkannya menurut kemendesakan, dan kolom yang dapat diklik akan diklik —
  diurut menurut nama, anak bergizi buruk berpindah ke tengah daftar dan tidak
  dikunjungi hari itu, tanpa satu pun galat yang memberi tahu. Daftarnya `<ol>`
  bernomor, bukan tabel.
- **Yang belum boleh diimunisasi tidak diberi tombol** — tetapi tetap
  ditampilkan, beserta kalimat sebabnya dan **tanggal paling awalnya**. Ibu yang
  bertanya "kapan giliran anak saya" berhak dijawab dengan tanggal.
- **Penilaian gizi muncul sebelum kader beranjak**, bukan pada laporan bulan
  depan. Kader menimbang dua puluh anak dalam satu pagi; yang bergizi buruk pagi
  ini pulang tanpa ada yang tahu kalau penilaiannya menyusul.
- **Cakupan menonjolkan yang BELUM TERSENTUH**, bukan persentasenya. Ambang
  warnanya sengaja tidak simetris — hijau mulai 95%, sebab di bawah itu tidak
  ada kekebalan kelompok.
- **Tombol yang tidak dapat dipakai dimatikan beserta jalan keluarnya.** Anak
  tanpa folder keluarga tidak dapat dicatat kunjungannya; tombolnya mati dan
  sebabnya tertulis, bukan gagal dengan 400 di tangan kader yang sedang berdiri
  di depan rumah orang.

**Yang ditemukan** — satu cacat yang lolos dari seluruh uji komponennya, dan
satu cacat Core yang menyembunyikannya. Rinciannya pada
[07 — garis dasar pengujian](07-test-baseline.md) dan
[006](../integration-requests/health/006-pemulihan-sesi-melewati-dedupe-refresh.md).

### W-2 · Rekam medis dan telaah darurat — **SELESAI**

Empat layar untuk lima menu: pengkodean, penahanan hukum, jejak akses,
pelepasan informasi, telaah darurat. `penahanan` dan `jejak-akses` menunjuk
layar yang sama dengan sengaja.

| Bagian | Berkas |
|---|---|
| Migrasi | `H060__health__menu_truth_w2.sql` |
| Layar | `CodingPage`, `LegalHoldPage`, `InfoReleasePage`, `BreakGlassPage` |
| Klien | `health-api.ts` — 13 jalan, 9 antarmuka baru |
| Uji | `him-pages.spec.tsx` 14 |
| Bukti | `scripts/prove-web-contract.mjs` -> [bukti-kontrak-web.txt](bukti-kontrak-web.txt) |

**Keputusan yang menentukan bentuknya**

- **Angka "belum ditelaah" di atas antreannya sendiri.** Ia satu-satunya yang
  memberi tahu bahwa sifat kedua break-glass sudah berhenti berlaku; membaca
  antrean halaman per halaman tidak.
- **Alasan yang ditulis pelakunya dikutip apa adanya**, termasuk yang berbunyi
  "perlu cepat". Yang menuliskan sepatah kata sedang tergesa atau sedang tidak
  jujur, dan keduanya hilang bila kalimatnya diperhalus.
- **Langkah berikutnya wajib hanya ketika putusannya bukan wajar.** Telaah yang
  menemukan sesuatu tanpa menyebutkan langkah berikutnya berhenti pada dirinya
  sendiri.
- **Tidak ada tombol hapus pada jejak akses, dan tidak boleh pernah ada.** Ada
  uji yang menegaskan ketiadaannya.
- **Rujukan dasar pelepasan disimpan, bukan dicentang.** Kotak centang tanpa
  rujukan menghasilkan berkas yang dilepaskan dengan keterangan "ada
  persetujuan", dan enam bulan kemudian tidak seorang pun dapat menunjukkan
  kertasnya.

**Yang ditemukan** — satu cacat 500 yang terjangkau dari layar W-1, ditemukan
naskah bukti kontrak dan bukan oleh uji mana pun. Rinciannya pada
[changelog](../changelog/health.md).

### Yang belum berlayar

50 menu masih bertanda "segera hadir", dan kini menunya **berkata begitu
sebelum diklik**, bukan sesudah. Urutan berikutnya yang disarankan, menurut
ukuran yang sama — berapa orang tidak dapat bekerja tanpanya:

| Fase | Cakupan | Sebab didahulukan |
|---|---|---|
| W-3 | Klaim dan BPJS: kepesertaan, SEP, klaim, telaah, rekonsiliasi | Pendapatan rumah sakit; tertunda berarti kas tertunda |
| W-4 | Tarif dan jasa: tarif, kebijakan jasa, kontributor, settlement, kontrak fee | Penagihan tidak benar tanpa tarif |
| W-5 | Alat: registri, gateway, pemeliharaan, keamanan, pesan/hasil | Keselamatan pasien |
| W-6 | Master data, terminologi, KFA, pemetaan kode, SATUSEHAT | Prasyarat mutu data, bukan kerja harian |
| W-7 | Portal pasien, website fasilitas, data contoh, laporan | Menghadap keluar |
| W-8 | Investor, akuntansi, zona data, penjaga AI | Paling jarang dibuka |

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
| H-9H | Registri alat/gateway | **Ya, seluruhnya kecuali DICOM/FHIR/MQTT** |
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
6.  H-9F   Simulasi, settlement, reversal                    [SELESAI]
7.  H-9G   Gerbang kontrak fee sistem dan investor           [SELESAI]
8.  H-9C   Siklus klaim internal — koding sampai rekonsiliasi [SELESAI]
9.  H-9H   Registri alat dan gateway                        [SELESAI]
10. H-9J   Pemeliharaan, kalibrasi, keamanan siber          [SELESAI]
11. H-9K   Dasbor investor agregat                         [SELESAI]
12. H-9I   Adapter HL7/ASTM; DICOM menunggu PACS           [SELESAI]
13. H-9A   Kerangka SATUSEHAT beserta gerbang kemampuan    [SELESAI]
14. H-9B   Kerangka BPJS beserta gerbang kemampuan         [SELESAI]
15. H-9M   Kerangka impor KFA                              [SELESAI]
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
