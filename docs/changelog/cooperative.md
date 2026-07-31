# Changelog — Vertikal Koperasi (eKoperasi)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` induk.

---

## K-11 — Keamanan, bukti menyeluruh, dan uji terima

Fase terakhir, dan satu-satunya yang **menemukan cacat pada fase sebelumnya**.
Dua cacat, keduanya lolos dari 1.541 pengujian, keduanya tercatat dalam
changelog dengan kalimat yang percaya diri.

### Ditambahkan

- **`cooperative-security.spec.ts`** — 24 pemeriksaan yang membaca berkas modul
  sendiri, mencari pelanggaran yang tidak dapat diuji lewat perilaku.
- **`prove-cooperative-e2e.mjs`** — satu koperasi dari berdiri sampai
  membagikan SHU, **47 pemeriksaan** dalam sembilan babak, seluruhnya lulus.
- **Migrasi `20260801T100000`** — perbaikan kedua cacat di bawah.
- **`docs/ekoperasi/10-uat-skenario.md`** — skenario uji terima untuk pengurus
  koperasi sungguhan, disusun mengikuti perjalanan satu tahun buku.
- **`docs/ekoperasi/11-audit-keamanan.md`** — hasil audit terhadap seluruh
  aturan keamanan yang berlaku.

### Cacat 1 — Penjaga kuorum dikaitkan pada status yang salah

`ck_coop_meeting_quorum_evidence` dari K-5 dikaitkan pada
`status = 'QUORUM_REACHED'`. Tetapi RAT yang sudah selesai berstatus `CLOSED`;
`QUORUM_REACHED` hanya keadaan sesaat di tengah rapat.

Akibatnya rapat dapat berstatus `CLOSED` dengan `quorum_reached = TRUE` tanpa
satu pun angka pendukung, **selamanya**. Penjaganya menjaga keadaan yang lewat
dalam hitungan jam dan membiarkan keadaan yang bertahan.

Bukan cacat teoretis: keputusan RAT hanya sah bila kuorumnya tercapai, dan
keabsahan pembagian SHU bersandar pada keputusan itu.

Diperbaiki dengan mengaitkannya pada `quorum_reached = TRUE` berapa pun
statusnya, ditambah dua penjaga aritmetika — rapat yang menyatakan kuorum wajib
benar-benar dihadiri sekurang-kurangnya sebanyak syaratnya, dan rapat yang
**menyangkal** kuorum tidak boleh justru memenuhinya, sebab penyangkalan itu
dapat dipakai membatalkan keputusan yang sah.

### Cacat 2 — Larangan menghapus pengaduan hanya ada pada aplikasi

K-9 menyatakan "pengaduan tidak dapat dihapus". Itu benar tentang aplikasinya —
tidak ada endpoint yang menghapusnya. **Basis datanya menerima `DELETE` tanpa
keberatan.**

Selisih antara keduanya menentukan. Alasan pengaduan tidak boleh dapat dihapus
adalah supaya ia tidak dapat dihilangkan oleh orang yang isinya menegur
dirinya — dan orang semacam itu justru yang paling mungkin memiliki akses
langsung ke basis data. Penjagaan yang hanya ada pada lapisan aplikasi tidak
menjaga dari orang itu.

Diperbaiki dengan trigger `BEFORE DELETE` pada enam tabel yang gunanya justru
terletak pada ketidakmungkinannya dihilangkan: pengaduan, tanggapan pengaduan,
keputusan rapat, suara, notulen, dan jejak portal. Daftarnya sengaja pendek —
penjaga yang menghalangi pekerjaan wajar akan dicabut seseorang pada suatu
hari, bersama seluruh gunanya.

### Yang dipelajari

Kedua cacat menyangkut **jarak antara apa yang dinyatakan dan apa yang
ditegakkan.**

Yang menemukannya adalah pemeriksaan yang menjalankan urutan seperti koperasi
sungguhan menjalankannya — sampai rapatnya `CLOSED`, bukan berhenti pada
`QUORUM_REACHED` yang lebih mudah diuji. **Pengujian yang berhenti pada keadaan
yang paling nyaman diuji akan melewatkan keadaan yang paling lama bertahan.**

### Keputusan lain yang perlu dicatat

- **Penjaga pemeriksa teks berkas diuji dengan sengaja melanggarnya.**
  `@Query('memberId')` ditambahkan ke controller portal dan
  `DELETE FROM cooperative_member` ke layanannya; dua pengujian gagal dan
  menyebut keduanya, lalu keduanya dikembalikan. Penjaga yang tidak pernah
  dibuktikan menangkap apa pun tidak berbeda dari komentar.
- **Batas pemeriksaan teks disebutkan apa adanya** pada berkasnya: ia dapat
  dielakkan siapa pun yang berniat mengelakkannya. Yang dijaganya bukan
  penyerang melainkan kekeliruan — penambahan yang wajar, terburu, dan tampak
  tidak berbahaya.
- **Bukti menyeluruh memeriksa kecocokan angka, bukan hanya keberhasilan.**
  Jumlah komponen SHU sama persis dengan surplus; jumlah pembagian sama persis
  dengan jasa modal + jasa usaha; saldo di portal sama dengan saldo di buku;
  SHU yang dilihat anggota sama dengan yang dihitung untuknya, sampai
  rinciannya. Sistem yang setiap bagiannya benar tetapi angkanya tidak
  bersambung lebih berbahaya daripada sistem yang jelas rusak — tidak ada yang
  menyadarinya sampai seorang anggota menghitung sendiri.
- **UAT ditulis untuk pengurus koperasi, bukan untuk penguji perangkat lunak**,
  dan disusun mengikuti perjalanan satu tahun buku alih-alih susunan menu.
  Setiap skenario memuat bagian "Yang harus DITOLAK sistem", sebab perangkat
  lunak keuangan dinilai dari apa yang dicegahnya.
- **Tiga dari lima hal yang masih tertahan justru mengurangi permukaan serang**
  selama masa tunggu — hak akses yang belum disemai membuat setiap endpoint
  menolak, dan situs publik yang belum ada membuat permukaan paling terbuka
  belum terbuka. Bukan alasan menunda IR-nya, tetapi berarti keadaan sekarang
  tidak berbahaya, melainkan belum dapat dipakai.

### Hasil audit

Patuh pada seluruh aturan yang berlaku: isolasi antarpenyewa, cakupan data
portal, kata sandi dan PIN, larangan penghapusan, larangan perbuatan otomatis,
larangan penilaian ekspresi bebas, dan batas antarsesi. Rinciannya pada
[11-audit-keamanan.md](../ekoperasi/11-audit-keamanan.md).

Yang **belum** dapat dinyatakan: bahwa modul ini aman dalam pemakaian
sungguhan, sebab ia belum pernah dipakai penyewa sungguhan.

---

## K-10 — Peran, bantuan, data contoh, dan AI

### Ditambahkan

- **`rbac/cooperative-rbac.catalog.ts`** — 19 menu, **74 hak akses**, 9 peran,
  dan 6 pasangan pemisahan wewenang. Bentuknya mengikuti usulan IR-004.
  **29 pengujian.**
- **`cooperative-sample.ts`** — pemisahan data acuan dari data contoh beserta
  urutan penghapusannya. **20 pengujian.**
- **`ai/cooperative-ai.catalog.ts`** — 8 keperluan AI dalam bentuk `AiUseCase`
  milik Core, beserta **6 keperluan yang sengaja ditolak** dan alasannya.
  **29 pengujian.**
- **`apps/web/src/verticals/cooperative/bantuan.ts`** + `PanelBantuan.tsx` —
  bantuan untuk 11 layar koperasi. **16 pengujian.**
- **`prove-cooperative-k10.mjs`** — **33 pemeriksaan** pada basis data
  sungguhan, seluruhnya lulus.

### Keputusan yang perlu dicatat

- **Tidak ada izin `DELETE` di seluruh katalog.** Bukan kelalaian: tidak ada
  satu pun catatan koperasi yang boleh dihapus. Anggota berhenti, pinjaman
  dihapusbukukan, pengaduan ditutup, kebijakan diganti versinya — semuanya
  perubahan status yang menyisakan barisnya. Izin `DELETE` adalah izin
  menghilangkan jejak, dan koperasi tempat yang jejaknya paling perlu bertahan.
- **Pemisahan wewenang dinyatakan sebagai data, bukan sebagai kebiasaan.**
  Enam pasangan izin yang tidak boleh dipegang satu orang tercatat di
  `KONFLIK_WEWENANG` beserta alasannya, dan pengujian memeriksa bahwa tidak
  satu pun peran bawaan melanggarnya. Koperasi mengelola uang anggotanya
  sendiri dengan petugas yang sedikit dan saling mengenal — di sanalah
  pemisahan paling mudah luntur, dan "sementara saja, orangnya sedang cuti"
  adalah kalimat yang mendahului sebagian besar penyimpangan koperasi.
- **Peran anggota terpisah sama sekali dari peran petugas, dua arah.** Portal
  dibuka kepada ratusan orang; satu izin pengurus yang bocor ke sana bocor
  kepada mereka semua sekaligus. Sebaliknya, petugas yang memegang
  `COOPERATIVE_PORTAL.READ` akan lolos pemeriksaan portal — dan portal
  menganggap pemanggilnya adalah anggota.
- **Pengawas hanya `READ` dan `EXPORT`.** Pengawas yang dapat mengubah data
  tidak lagi dapat mengawasinya; ia menjadi pihak yang perlu diawasi.
- **Peran dan hak akses bertanda `REFERENCE`, tidak pernah ikut terhapus.**
  Menghapusnya mengunci pengurus keluar dari koperasinya sendiri, dan tidak
  ada yang tersisa untuk memulihkannya.
- **Pembersihan data contoh menyaring pada awalan kode, bukan pada tanggal
  maupun tanda `is_sample`.** Tanggal tidak membedakan apa pun bila penyewa
  mulai memakai sistemnya pada hari yang sama, dan `is_sample` dapat tertulis
  pada baris sungguhan karena kekeliruan — sekali itu terjadi, pembersihan
  berikutnya menghapus data sungguhan tanpa ada yang menyadarinya. Dibuktikan
  pada basis data dengan menyelipkan empat baris sungguhan berkode mirip
  (`TOKO-CONTOH-RASA`, `contoh-` huruf kecil) di antara enam baris contoh:
  keempatnya bertahan.
- **AI tidak pernah bertindak, dan itu ditegakkan bentuk.** `outputKind` hanya
  mengenal `DRAFT`, `ANALYSIS`, `RECOMMENDATION`; tidak ada nilai yang berarti
  "kerjakan". Seluruh keperluan beraksi `READ` dan tidak satu pun menyimpan
  isi promptnya.
- **Enam keperluan AI sengaja ditolak dan alasannya dicatat**, supaya tidak
  diusulkan lagi setiap beberapa bulan. Yang terpenting: **keputusan kelayakan
  pinjaman** — penolakan pinjaman menyangkut penghidupan seseorang, dan
  alasannya harus dapat dijelaskan pengurus kepada anggota yang menanyakannya;
  "menurut sistem" bukan penjelasan. Dan **penilaian karakter anggota** —
  menyimpulkan sifat seseorang dari riwayat pembayarannya adalah penilaian
  tentang orang, bukan tentang angka, sedangkan koperasi dibangun di atas
  kepercayaan antaranggota.
- **Ringkasan berkas pinjaman diuji agar TIDAK menyimpulkan kelayakan** —
  skema keluarannya diperiksa tidak memuat kata "layak", "disetujui",
  "ditolak", maupun "skor".
- **Bantuan menjawab tiga hal, dan yang ketiga paling sering dilewatkan:**
  layar ini untuk apa, bagaimana memakainya, dan **apa yang tidak dapat diubah
  setelah dikerjakan**. Bagian ketiga itu selalu terbuka di panelnya sementara
  langkahnya dapat dilipat — yang menyebabkan kerugian bukan orang yang tidak
  tahu caranya (ia akan bertanya) melainkan orang yang mengerjakan sesuatu
  tanpa tahu bahwa hal itu tidak dapat ditarik kembali.
- **Bantuan diuji agar tidak memakai istilah teknis perangkat lunak.**
  Pengurus koperasi berganti tiap periode kepengurusan, dan yang baru mewarisi
  sistem tanpa mewarisi orang yang tahu cara memakainya.

### Yang TIDAK dikerjakan, dan alasannya

- **Katalog RBAC belum disemai ke basis data** — menunggu IR-004. Sampai saat
  itu setiap endpoint `COOPERATIVE_*` menolak permintaan dari penyewa
  sungguhan. Itu keadaan yang benar; melonggarkan penjaganya "sementara" akan
  menghasilkan kelonggaran yang tetap tinggal setelah IR disetujui.
- **Keperluan AI belum terdaftar** pada `AI_USE_CASES` milik Core — berkas
  bersama yang dilarang disunting sesi ini (§3). Penggabungannya cukup satu
  sebaran `...COOPERATIVE_AI_USE_CASES`.
- **Data contoh belum benar-benar disemai.** Yang dibuat adalah definisi
  kelompok, sifat, urutan, dan penyaringnya — bagian yang salahnya paling
  mahal. Penyemaian barisnya menunggu IR-001 (migrasi diterapkan ke penyewa).

---

## K-9 — Situs koperasi dan portal anggota

Fase pertama yang menghasilkan layar, dan fase pertama yang permukaannya
dibuka kepada orang di luar kantor koperasi. K-1 sampai K-8 dipakai belasan
pengurus dan petugas yang dikenal namanya dan aksesnya diberikan satu per satu;
portal dibuka kepada **ratusan anggota** sekaligus.

### Ditambahkan

- **`cooperative-portal.ts`** — aturan cakupan data sebagai fungsi murni:
  `bolehMembaca`, `saring`, `bersihkan`, penyamaran nomor rekening dan
  identitas, pembatasan percobaan PIN, alur status pengaduan, dan gerbang
  pendaftaran calon anggota. **38 pengujian.**
- **`cooperative-portal.service.ts`** — pelaksana aturan itu di atas basis
  data, beserta pencatatan jejak portal.
- **Migrasi `20260801T090000`** — 8 tabel: pengaturan situs, halaman,
  pengumuman, lamaran publik, pengaduan, tanggapan pengaduan, pemberitahuan,
  dan jejak aktivitas portal.
- **14 endpoint `/cooperative/portal/*`** berpenjaga `COOPERATIVE_PORTAL.*`,
  dan 2 endpoint `/cooperative/website/*` berpenjaga `COOPERATIVE_WEBSITE.*`.
- **`apps/web/src/verticals/cooperative/`** — portal anggota: ringkasan,
  simpanan beserta mutasinya, pinjaman beserta jadwal angsurannya, SHU, rapat
  anggota, pengaduan, dan pemberitahuan. Dirancang untuk telepon genggam lebih
  dahulu. **17 pengujian** atas menu dan aturan tampilannya.
- **`prove-cooperative-k9.mjs`** — **54 pemeriksaan** pada basis data
  sungguhan, seluruhnya lulus, di dalam `BEGIN … ROLLBACK`.

### Keputusan yang perlu dicatat

- **`memberId` tidak pernah datang dari permintaan.** Tidak dari badan, query,
  parameter jalur, maupun header — selalu diturunkan dari sesi lewat satu
  fungsi, `memberDiriSendiri()`. Endpoint yang menerima `?memberId=` adalah
  endpoint yang dapat diubah angkanya oleh siapa pun yang sudah masuk.
  Menyaring setelahnya membantu; tidak menerima angkanya sama sekali jauh
  lebih sulit dilanggar tanpa sengaja. Berkas `portal-api.ts` di sisi peramban
  pun tidak memiliki satu pun parameter itu, sengaja, sebagai petunjuk bagi
  siapa pun yang kelak hendak menambahkannya.
- **Penolakan tidak membocorkan bahwa barisnya ada.** Setiap penolakan
  berbunyi "Data tidak ditemukan." "Anda tidak berhak membaca data anggota M2"
  sudah memberitahu bahwa M2 ada dan punya data — keterangan sebanyak itu
  tidak diperlukan siapa pun kecuali yang sedang mencari tahu.
- **Lintas koperasi diperiksa lebih dahulu daripada kepemilikan**, supaya
  kesamaan id anggota di dua koperasi tidak pernah menjadi celah.
- **Rapat anggota satu-satunya sumber daya bersama.** Setiap anggota berhak
  membaca agenda, kuorum, dan keputusannya — pengawasan koperasi ada pada
  anggotanya. Yang tetap perorangan adalah suaranya.
- **Kuorum yang TIDAK tercapai tetap ditampilkan kepada anggota.**
  Menyembunyikannya menghilangkan justru hal yang paling perlu diketahui.
- **Kiriman formulir dari internet berhenti pada tabel karantina.** Lamaran
  calon anggota tidak pernah langsung menjadi baris `cooperative_member`;
  tanpa itu siapa pun di internet dapat menumbuhkan daftar anggota koperasi
  orang lain dengan nama orang yang tidak pernah mendaftar. Lamaran yang
  DISETUJUI wajib menunjuk anggota yang diterbitkannya, yang DITOLAK wajib
  beralasan, dan tidak ada yang dapat disimpan tanpa persetujuan pengolahan
  data pribadi bertanggal.
- **Jumlah anggota dan besar aset bawaannya tidak ditampilkan di situs.**
  Keduanya angka yang meyakinkan calon anggota sekaligus angka yang dipakai
  orang lain menilai apakah koperasi ini layak didekati. Menampilkannya
  pilihan sadar pengurus, bukan bawaan yang baru disadari setelah terlanjur
  tampil.
- **Pengaduan tidak dapat dihapus, dan anggota tidak dapat menutupnya.**
  Pengaduan yang dapat dihapus adalah pengaduan yang dapat dihilangkan oleh
  orang yang isinya menegur dirinya; pengaduan yang dapat ditutup pelapornya
  mudah ditutup dengan meminta pelapornya menutupnya. Yang selesai dapat
  dibuka kembali cukup dengan menanggapinya.
- **Pengaduan anonim tetap menyimpan pemiliknya**, dan hal itu **disebutkan
  pada formulirnya**. Menjanjikan anonimitas penuh padahal sistemnya tetap
  menyimpan pemiliknya adalah janji yang tidak dapat ditepati.
- **Pemberitahuan ringkas dan tautannya wajib relatif.** Ia berjalan lewat
  kanal yang tidak dikendalikan koperasi dan sering terbaca pada layar
  terkunci; "Angsuran Anda jatuh tempo 5 Agustus" cukup. Tautan ke alamat luar
  ditolak basis data — melatih anggota menekan tautan yang mengatasnamakan
  koperasi adalah cara paling mudah membuat mereka menekan tautan berikutnya
  yang bukan dari koperasi.
- **Jejak portal mencatat kode penolakan, tetapi tidak menyalin isi bacaan.**
  Jejak yang hanya berkata "ditolak" tidak dapat membedakan salah ketik dari
  percobaan membaca data orang lain; jejak yang menyalin isinya menggandakan
  justru data yang hendak dilindunginya.
- **Bekas anggota kehilangan akses portal, bukan datanya.** Dibuktikan pada
  basis data: setelah `TERMINATED` ia tidak melihat apa pun, tetapi barisnya
  masih ada dan tidak dapat dihapus selama masih ada pengaduannya.
- **Calon anggota hanya melihat menu yang sudah ada isinya.** Menu yang
  seluruhnya kosong membuat portal terasa rusak, bukan terasa lengkap.
- **Anggota yang dibekukan tetap dapat mengadu.** Pembekuan justru saat ia
  paling mungkin ingin menyatakan keberatan; yang hilang hak suaranya, bukan
  haknya bersuara.

### Yang TIDAK dikerjakan, dan alasannya

- **Situs koperasi belum dapat dibuka pengunjung.** Pengunjung tanpa sesi
  tidak membawa konteks penyewa, dan satu-satunya jalan yang tersedia adalah
  menerima nama skema dari alamat — hal yang dilarang tegas, sebab alamat
  semacam itu dapat dicoba nama demi nama sampai menemukan skema yang ada.
  Diajukan sebagai **IR-005**. Endpoint yang dibuat memakai jalur pratinjau
  bersesi; pengurus dapat menyusun dan melihat situsnya sekarang.
- **Lamaran belum dapat dikirim dari internet** — tertahan IR-005 yang sama.
  Logikanya lengkap dan teruji lewat jalur bersesi.
- **PIN anggota belum dapat diatur dari portal.** Aturannya sudah ada dan
  diuji (`bolehVerifikasiPin`, `setelahPinSalah`, `bolehKasirMengaksesPin`),
  tetapi pembuatannya menyentuh alur autentikasi bersama — dan §3 melarang
  sesi ini menyunting shared auth. Menunggu koordinasi.
- **Pemberitahuan belum benar-benar dikirim** lewat surel atau pesan singkat.
  Tabelnya siap dan kanal tercatat; pengirimannya memakai layanan bersama.

### Catatan bagi sesi Core

- `App.tsx` disunting **dua baris**: satu impor `lazy` dan satu
  `<Route path="/ekoperasi/*">`. Seluruh rute vertikal terkumpul di
  `verticals/cooperative/routes.tsx`.
- `cooperative.module.ts` menambah dua controller; tidak ada berkas Core lain
  yang tersentuh.
- Hak akses baru yang perlu disemai IR-004: `COOPERATIVE_PORTAL.READ`,
  `COOPERATIVE_PORTAL.WRITE`, `COOPERATIVE_WEBSITE.READ`,
  `COOPERATIVE_WEBSITE.WRITE`. **`COOPERATIVE_PORTAL.*` harus terpisah dari
  hak akses pengurus** — memberi seseorang akses portal tidak boleh pernah
  berarti memberinya akses ke layar pengurus.

---

## K-8 — Akuntansi, pajak, dan laporan

### Ditambahkan

- **`accounting/cooperative-events.catalog.ts`** — **26 kode peristiwa
  akuntansi** `COOPERATIVE_*` beserta nilai wajib dan kode pemetaan akunnya.
  Ditulis penuh dalam bentuk yang diusulkan IR-003, sehingga saat disetujui
  yang diperlukan hanya satu baris `registry.register(...)`.
- **`cooperative-accounting.ts`** — aturan sebagai fungsi murni: rekonsiliasi
  buku pembantu terhadap buku besar, keseimbangan jurnal, neraca, laba rugi,
  modal sendiri, empat rasio kesehatan, pajak SHU, dan syarat penutupan
  periode. **43 pengujian** bersama katalognya.

### Keputusan yang perlu dicatat

- **Rekonsiliasi memperhatikan sifat normal akun.** Piutang pinjaman bersifat
  debit — setoran anggota menguranginya; simpanan bersifat kredit — setoran
  menambah. Menjumlahkan tanpa memperhatikan sifatnya akan berselisih pada
  setiap akun, dan laporan rekonsiliasi yang selalu berselisih akan segera
  diabaikan orang.
- **Akun yang hanya ada pada buku pembantu dilaporkan tersendiri.** Rincian
  atas akun yang tidak ada di buku besar berarti jurnalnya tidak pernah
  terbentuk — persis keadaan yang berlaku sampai IR-003 disetujui.
- **Simpanan pokok dan wajib dipetakan ke akun EKUITAS; sukarela ke KEWAJIBAN.**
  Diuji pada katalognya, bukan hanya disepakati. Rasio kesehatan dihitung atas
  modal sendiri, dan salah menggolongkannya membuat koperasi tampak bermodal
  kecil serta dinilai tidak sehat padahal tidak demikian.
- **Angsuran menuntut pokok dan jasa terpisah** pada katalognya. Keduanya masuk
  akun berbeda, dan membelah totalnya kemudian berarti menebak berapa
  pendapatan koperasi.
- **Tidak ada peristiwa syariah yang menuntut nilai bernama `interest`**,
  diperiksa pengujian. Murabahah memakai `margin`, mudharabah memakai `nisbah`.
- **`COOPERATIVE_WALLET_PAYMENT` tidak menjurnal penjualannya** — hanya
  perpindahan dari kewajiban dompet ke kas. Diuji secara tegas: pemetaannya
  tidak boleh menyentuh akun pendapatan, sebab penjualannya sudah dijurnal
  mesin POS.
- **Pembagian nol pada rasio menghasilkan nol, bukan Infinity maupun NaN.**
  Rasio bernilai Infinity pada laporan tampak seperti cacat sistem, dan
  pembacanya berhenti mempercayai seluruh laporannya.
- **Tarif pajak tidak dikunci di dalam program.** Perlakuan pajak koperasi
  berbeda dari perseroan dan berubah menurut peraturan yang berlaku; fungsi ini
  hanya menghitung, dan keterangannya ikut dikembalikan supaya laporan dapat
  menyebutkan dasarnya.
- **Penutupan periode memeriksa lima syarat sekaligus.** Menutup periode tidak
  dapat dibatalkan tanpa jejak: saldo dipindahkan, buku dikunci, dan angka
  itulah yang dibawa ke RAT.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 54 suite, **1425 tes lulus** (bertambah 43) |

### Belum dikerjakan pada K-8

- **Peristiwa koperasi masih belum dijurnal.** Katalognya lengkap dan teruji,
  tetapi `isKnownEvent()` milik Core menolaknya sampai **IR-003** disetujui.
  Buku pembantu anggota berjalan; buku besarnya belum, dan neraca koperasi
  karena itu belum lengkap. Pengujian rekonsiliasi justru sudah menyiapkan
  keadaan ini: akun yang hanya ada pada buku pembantu dilaporkan tersendiri.
- **Ekspor Excel dan cetak PDF** tetap `BLOCKED` — prasyarat V8-5/6 dan V8-7
  belum dibangun sesi Core. Laporan dapat ditampilkan di layar.
- **Dua puluh satu laporan** pada spesifikasi §18 belum dirakit menjadi
  endpoint; aturan penyusunnya sudah ada dan teruji.

## K-7 — Unit usaha dan integrasi POS

### Ditambahkan

- **Migrasi modul** `20260731T220000__cooperative__unit_business_and_pos_link.sql`:
  delapan tabel — unit usaha, penghubung POS, tautan harga anggota, anggaran,
  hasil usaha per periode, pembacaan patronage, baris patronage, dan aset unit.
- **`cooperative-unit.ts`** — aturan sebagai fungsi murni: jenis unit, tautan
  outlet, ringkasan patronage, laba rugi unit, alokasi beban umum, tautan
  harga anggota, dan **batas kewenangan adapter**. **27 pengujian.**
- **`adapters/pos.adapter.ts`** — satu-satunya berkas koperasi yang menyentuh
  tabel `pos_*`, dan **hanya membaca**.
- **`adapters/pos-adapter-readonly.spec.ts`** — **7 pengujian** yang memeriksa
  isi berkas modul, bukan perilakunya.

### Penjagaan batas yang tidak biasa, dan alasannya

Pengujian `pos-adapter-readonly.spec.ts` membaca **isi berkas modul koperasi
sendiri** dan menolak setiap `INSERT`, `UPDATE`, atau `DELETE` yang menyentuh
tabel `pos_*` maupun `stock_*`. Ia juga menolak penyebutan kode peristiwa
akuntansi POS di mana pun dalam modul, dan memastikan hanya adapter yang
menyebut `pos_sale` — membaca pun harus lewat satu pintu.

Cara ini dipilih karena pengujian perilaku hanya membuktikan jalur yang
kebetulan diuji, sedangkan pemeriksaan isi berkas menangkap setiap penulisan
yang kelak ditambahkan seseorang — termasuk pada jalur yang belum ada
pengujiannya.

**Penjagaannya diverifikasi dengan sengaja melanggarnya:** sebuah
`INSERT INTO pos_sale` disisipkan ke adapter, dan pengujian gagal dengan
menyebut berkas serta tabelnya. Penjagaan yang tidak pernah dibuktikan menangkap
apa pun adalah penjagaan yang belum tentu bekerja.

### Keputusan yang perlu dicatat

- **Unit usaha koperasi TIDAK memiliki POS sendiri.** Ia tertaut ke `outlet`
  Core lewat satu tabel penghubung; menghapus tabel itu harus cukup untuk
  membuat POS berjalan tanpa koperasi dan sebaliknya.
- **Satu outlet hanya dimiliki satu unit usaha**, ditegakkan indeks unik
  parsial. Dua pemilik akan menghitung patronage penjualan yang sama dua kali —
  dan SHU dibagikan atas angka itu.
- **Harga khusus anggota berjalan tanpa mengubah POS sama sekali**, lewat
  tautan kategori anggota ke `customer_group` Core. Kasir memindai kartu
  anggota, POS mengenali pelanggannya, dan buku harga berlingkup kelompok itu
  berlaku. Tautannya diletakkan pada tabel koperasi karena `customer_group`
  milik Core.
- **Patronage dibaca berkala, bukan ditulis saat transaksi.** Ia dihitung atas
  periode buku yang sudah ditutup; menuliskannya saat transaksi membuat angkanya
  ikut berubah setiap ada retur — sesudah SHU dihitung.
- **Penjualan yang tidak teratribusi dilaporkan, bukan dibuang.** Unit toko yang
  sebagian besar penjualannya tidak teratribusi berarti kartu anggotanya jarang
  dipakai — keadaan yang perlu diketahui pengurus sebelum SHU dihitung.
- **Penyaringan memakai `business_date`, bukan `created_at`.** Penjualan yang
  diselesaikan lewat tengah malam tetap milik hari usaha tempat ia terjadi.
- **Beban umum dialokasikan ke unit.** Tanpanya, unit tampak jauh lebih untung
  daripada sebenarnya, dan pengurus memutuskan membuka unit baru berdasarkan
  angka yang belum menanggung bagiannya atas gaji, listrik, dan sewa kantor.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 53 suite, **1382 tes lulus** (bertambah 34) |
| Penjagaan batas | diverifikasi dengan pelanggaran sengaja |

### Belum dikerjakan pada K-7

- **K-7d — pembayaran dengan saldo simpanan dan pembelian kredit anggota**
  menunggu **IR-002** (kait pembayaran bersaldo eksternal pada POS). Unit toko
  koperasi berjalan penuh dengan tunai dan nontunai biasa; K-7d tidak menahan
  K-8 sampai K-11.

## K-6 — SHU dan patronage

### Ditambahkan

- **Migrasi modul** `20260731T210000__cooperative__shu_and_patronage.sql`:
  enam tabel — komponen kebijakan, perhitungan, alokasi, patronage anggota,
  pembagian, dan rincian untuk anggota.
- **`cooperative-shu.ts`** — aturan sebagai fungsi murni: pemeriksaan
  kebijakan, alokasi surplus, pembagian metode sisa terbesar, keutuhan,
  sidik jari masukan, bagian masa keanggotaan, dan gerbang RAT.
  **53 pengujian.**
- **`scripts/prove-cooperative-k6.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k6-shu.txt` — **24 pemeriksaan, seluruhnya lulus.**

### Cacat yang ditemukan bukti K-6, dan perbaikannya

Bukti K-6 menjalankan perhitungan, menyimpannya, lalu **menghitung ulang dari
cuplikan yang tersimpan** dan membandingkannya baris demi baris. Pada jalannya
yang pertama:

```
LULUS  sidik jari perhitungan ulang SAMA dengan yang tersimpan
GAGAL  bagian 3 anggota SAMA PERSIS sampai ke rupiah terakhir  (8 berbeda)
```

Sebabnya: bagian masa keanggotaan dihitung pada presisi penuh tetapi disimpan
sebagai `NUMERIC(9,6)`. Perhitungan ulang dari data tersimpan memakai angka yang
sedikit berbeda, dan pada metode sisa terbesar selisih sekecil apa pun dapat
memindahkan satu rupiah dari seorang anggota ke anggota lain.

Yang membuatnya berbahaya bukan selisih satu rupiahnya, melainkan **sidik
jarinya**: ia membulatkan ke empat angka di belakang koma, sehingga menyatakan
"masukan sama" atas masukan yang sesungguhnya berbeda. Sidik jari yang memberi
keyakinan palsu lebih buruk daripada tidak ada sidik jari sama sekali.

Perbaikannya: presisi cuplikan dinyatakan sebagai tetapan `PRESISI_FRAKSI`, dan
**perhitungan memakai presisi yang sama dengan penyimpanannya** — pembulatan
terjadi saat menghitung, bukan saat menyimpan. Tiga pengujian regresi
ditambahkan, termasuk yang memastikan sidik jari peka sampai digit keenam.

### Keputusan lain yang perlu dicatat

- **Angka masukan DICUPLIK, bukan dibaca ulang.** Simpanan anggota hari ini
  berbeda dari simpanannya saat periode buku ditutup; membaca ulang berarti
  menghitung SHU tahun lalu memakai angka tahun ini.
- **Jumlah komponen kebijakan wajib tepat 100%.** Kurang berarti ada surplus
  yang tidak diketahui ke mana perginya; lebih berarti membagikan uang yang
  tidak ada. Dibandingkan dalam basis per sepuluh ribu supaya kebijakan yang
  benar tidak ditolak karena pecahan biner.
- **Selisih pembulatan alokasi dibebankan pada CADANGAN**, bukan disebar.
  Cadangan milik koperasi, bukan milik anggota perorangan, jadi selisih di sana
  tidak mengubah hak siapa pun.
- **Pembagian sisa memakai metode sisa terbesar dengan pemutus seri `memberId`**
  — bukan urutan baris dari basis data, yang dapat berbeda antar pemanggilan.
- **Dasar jasa modal hanya simpanan ekuitas.** Simpanan sukarela tidak ikut: ia
  kewajiban koperasi kepada anggota, bukan modal anggota pada koperasi, dan
  memperoleh bagi hasil tersendiri.
- **Bagian masa keanggotaan dihitung dari HARI, bukan bulan.** Anggota yang
  masuk 20 Januari memperoleh bagian berbeda dari yang masuk 1 Januari.
- **Perhitungan yang disetujui wajib menunjuk keputusan RAT dan wajib utuh**,
  ditegakkan constraint. Pembagian SHU tanpa keputusan RAT yang sah adalah
  pengurus membagikan uang anggota atas keputusannya sendiri.
- **Satu perhitungan hidup per tahun buku.** Dua perhitungan atas tahun yang
  sama berarti dua angka SHU, dan tidak ada yang tahu mana yang dibagikan.
- **Pemotongan tidak boleh melebihi hak anggota dan wajib beralasan.** SHU
  tidak dapat menjadi utang.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 51 suite, **1348 tes lulus** (bertambah 53) |
| Bukti K-6 | **24 pemeriksaan lulus** |

## K-5 — Rapat anggota, kuorum, voting, dan keputusan

### Ditambahkan

- **Migrasi modul** `20260731T200000__cooperative__meetings_and_voting.sql`:
  delapan tabel — rapat, mata acara, undangan, kehadiran, suara, keputusan,
  tindak lanjut, dan notulen.
- **`cooperative-meeting.ts`** — aturan sebagai fungsi murni: penyaringan
  kuasa, perhitungan kuorum, penghitungan suara empat aturan keputusan, hak
  memilih, keabsahan keputusan, dan ambang per jenis mata acara.
  **43 pengujian.**
- **`scripts/prove-cooperative-k5.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k5-rat.txt` — **32 pemeriksaan, seluruhnya lulus.**
- **`docs/ekoperasi/09-isolasi-data-antar-koperasi.md`** — keterangan tiga
  lapis pemisahan data antar koperasi, beserta cara memeriksanya sendiri.

### Keputusan yang perlu dicatat

- **Tabel suara TIDAK memiliki kolom bobot, dan tidak boleh memilikinya.** Satu
  anggota satu suara, berapa pun besar simpanannya — pembeda koperasi dari
  perseroan. Pengujian memeriksa ketiadaan kolom `weight`, `bobot`, `share`,
  `saving`, dan `capital` pada tabelnya, supaya penambahan pembobotan kelak
  tertangkap. Indeks unik menegakkannya: satu anggota satu suara per mata acara.
- **Keputusan tanpa kuorum DITANDAI tidak sah, bukan ditolak diam-diam.**
  Keputusan itu terjadi, tercatat pada notulen, dan mungkin sudah dilaksanakan.
  Menghilangkannya dari catatan membuat pelaksanaannya tidak dapat dijelaskan
  kemudian; menandainya tidak sah membuatnya terlihat dan dapat diperbaiki
  lewat rapat berikutnya.
- **Keputusan SAH wajib benar-benar memenuhi ambangnya**, ditegakkan
  constraint. Menutup jalan mencatat keputusan sebagai sah padahal angkanya
  menunjukkan sebaliknya.
- **Abstain tidak dihitung sebagai penolak.** Anggota yang abstain menyatakan
  dirinya tidak mengambil sikap; memperlakukannya sebagai penolak berarti
  memberinya sikap yang tidak dinyatakannya. Pengecualiannya keputusan bulat,
  yang menuntut seluruh yang hadir menyetujui.
- **Kuasa dibatasi jumlahnya per pemegang.** Tanpa batas, seseorang dapat
  mengumpulkan kuasa dari puluhan anggota dan memutuskan sendiri hal yang
  seharusnya diputuskan bersama.
- **Syarat kuorum dicuplik ke rapat saat dibuka**, tidak dibaca ulang dari
  AD/ART. Membacanya ulang membuat kuorum rapat tahun lalu ikut berubah bila
  AD/ART kelak diubah.
- **Notulen susunan AI ditandai jelas dan wajib melalui pemeriksaan manusia
  sebelum disahkan**, ditegakkan constraint. Konsep yang tidak diperiksa tidak
  boleh tampak seperti catatan resmi rapat.
- **Perubahan AD/ART menuntut dua per tiga; pembubaran dan penggabungan tiga
  per empat.** Pemberhentian pengurus dua per tiga — lebih tinggi daripada
  pemilihannya, sebab memberhentikan orang yang dipilih rapat sebelumnya
  menuntut kesepakatan yang lebih kuat.

### Pemisahan data antar koperasi — diperiksa, bukan diasumsikan

Bukti K-5 bagian A memeriksa enam hal terhadap basis data sungguhan:

```
17 penyewa terdaftar, masing-masing pada skema tersendiri
tidak ada dua penyewa berbagi satu skema
tidak ada dua skema menunjuk satu penyewa
setiap skema terdaftar benar-benar ada sebagai skema PostgreSQL
indeks penjaga satu koperasi per skema terpasang
tabel anggota tidak memakai kolom penyaring penyewa — pemisahannya di skema
```

Yang terakhir disengaja: pada model satu tabel bersama dengan kolom `tenant_id`,
**satu kueri yang lupa menyaring sudah cukup** untuk membocorkan data penyewa
lain — tanpa galat, tanpa catatan log, dan biasanya baru ketahuan ketika seorang
anggota melihat nama yang tidak dikenalnya pada laporannya sendiri.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 50 suite, **1295 tes lulus** (bertambah 43) |
| Bukti K-5 | **32 pemeriksaan lulus** |

## K-4 — Pinjaman, pembiayaan, angsuran, dan penagihan

### Ditambahkan

- **Migrasi modul** `20260731T190000__cooperative__loans_and_collection.sql`:
  dua belas tabel — produk, pengajuan, agunan, penjamin, analisis kredit,
  pinjaman, pencairan, jadwal angsuran, pembayaran, restrukturisasi, kasus
  penagihan, dan aktivitas penagihan.
- **`cooperative-loan.ts`** — aturan sebagai fungsi murni: kesesuaian metode
  dengan jenis koperasi, kelayakan mengajukan, pembentukan jadwal untuk tujuh
  metode (flat, efektif, anuitas, murabahah, mudharabah, ijarah, qardh),
  alokasi pembayaran, denda, golongan risiko, penyisihan, PAR, pelunasan
  dipercepat, transisi empat belas status, dan pemisahan wewenang.
  **68 pengujian.**
- **`scripts/prove-cooperative-k4.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k4-pinjaman.txt` — **38 pemeriksaan, seluruhnya lulus.**

### Keputusan yang perlu dicatat

- **Pemisahan wewenang ditegakkan basis data**, bukan hanya layanan.
  Penganalisis tidak boleh sama dengan penyurvei; penyetuju tidak boleh sama
  dengan penganalisis. Aturan yang hanya ada di satu lapisan berhenti berlaku
  begitu ada jalan kedua menuju tabelnya.
- **Penghapusbukuan menuntut DUA orang berbeda.** Perbuatan ini yang paling
  mudah dipakai menghapus jejak pinjaman bermasalah, dan satu tanda tangan
  tidak cukup untuknya.
- **Selisih pembulatan jadwal dibebankan pada angsuran TERAKHIR.**
  Membebankannya di awal membuat angsuran pertama berbeda dari yang disebutkan
  saat akad — dan itulah angka yang diingat anggota. Diuji atas 108 kombinasi
  metode × tenor × pokok; jumlah pokok selalu persis sama dengan pinjamannya.
- **Alokasi pembayaran: denda → jasa → pokok.** Mendahulukan pokok membuat
  denda dan jasa menumpuk tanpa pernah terbayar, dan tunggakan terus bertambah
  meskipun anggota membayar tiap bulan. Jumlah seluruh alokasi wajib sama
  dengan nilai yang diterima — selisih di sini berarti uang yang masuk tidak
  sampai ke mana pun.
- **Denda dibatasi kelipatan nilai tertunggak.** Tanpa batas, denda pada
  pinjaman yang lama menunggak dapat melampaui pokoknya sendiri, dan tagihan
  yang mustahil dibayar tidak menolong siapa pun.
- **PAR dihitung dari SELURUH sisa pinjaman yang menunggak**, bukan dari
  angsuran yang tertunggak saja. Anggota yang menunggak satu angsuran dari dua
  puluh tetap membawa risiko atas seluruh sisanya.
- **Murabahah: margin tetap terutang pada pelunasan dipercepat.** Ia bagian
  harga jual yang disepakati saat akad, bukan bunga berjalan. Potongan
  sukarela disebut *muqasah* dan tidak diperjanjikan di muka.
- **Qardh tidak boleh membawa imbalan apa pun**, ditegakkan constraint.
- **Janji bayar wajib menyebutkan tanggal DAN nilainya.** Janji tanpa angka
  tidak dapat dipantau kepatuhannya, dan janji yang tidak dapat dipantau sama
  saja dengan tidak ada janji.
- **Jadwal angsuran dibekukan saat pencairan.** Restrukturisasi membentuk
  pinjaman baru yang menunjuk yang lama, bukan menyunting jadwalnya — jadwal
  yang disunting membuat riwayat tunggakan tidak dapat dipertanggungjawabkan,
  dan riwayat itulah dasar penilaian kelayakan pinjaman berikutnya.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 49 suite, **1252 tes lulus** (bertambah 68) |
| Bukti K-4 | **38 pemeriksaan lulus** |

### Belum dikerjakan pada K-4

- **Peristiwa akuntansi pinjaman belum dijurnal** — menunggu IR-003, sama
  dengan simpanan pada K-3.
- **Penjadwal denda harian** belum dipasang; denda dihitung saat pembayaran.

## K-3 — Simpanan dan buku pembantu anggota

### Ditambahkan

- **Migrasi modul** `20260731T180000__cooperative__savings_and_subledger.sql`:
  lima tabel — produk simpanan, rekening, transaksi, buku pembantu anggota, dan
  rekening koran.
- **`cooperative-saving.ts`** — aturan sebagai fungsi murni: sifat empat jenis
  simpanan, saldo sebagai proyeksi mutasi, gerbang setor dan tarik, kemajuan
  simpanan pokok, tunggakan berkala, dormansi, penutupan, dan bagi hasil
  berbasis saldo rata-rata harian. **49 pengujian.**
- **`scripts/prove-cooperative-k3.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k3-simpanan.txt` — **24 pemeriksaan, seluruhnya lulus.**

### Keputusan yang perlu dicatat

- **Simpanan pokok dan wajib WAJIB bertanda ekuitas dan tidak dapat ditarik**,
  ditegakkan constraint. Tidak ada jalan membuat "simpanan wajib yang dapat
  ditarik" — yang secara hukum bukan simpanan wajib lagi.
- **Bunga dan nisbah tidak boleh diisi bersamaan.** Produk yang membawa
  keduanya tidak dapat dijelaskan kepada Dewan Pengawas Syariah maupun kepada
  pengawas konvensional.
- **Hanya satu produk simpanan pokok aktif per koperasi.** Dua berarti dua
  besaran modal keanggotaan, dan tidak ada yang tahu mana yang menentukan
  keabsahan keanggotaan.
- **Saldo simpanan tidak pernah negatif.** Simpanan bukan pinjaman.
- **Satu periode simpanan wajib dibayar sekali saja per rekening.** Tunggakan
  dihitung dari periode, bukan dari selisih nilai — menyetor dua kali lipat
  pada satu bulan tidak melunasi bulan yang terlewat, sebab SHU jasa modal
  dihitung per periode.
- **Buku pembantu memakai satu sisi saja per baris.** Baris bernilai nol pada
  debit dan kredit tidak berarti apa-apa tetapi ikut terhitung saat
  rekonsiliasi.
- **Bagi hasil memakai saldo rata-rata harian, bukan saldo akhir.** Saldo akhir
  memungkinkan seseorang menyetor besar pada hari terakhir dan memperoleh bagi
  hasil sebulan penuh atasnya.
- **`baruSajaLunas` dibedakan dari `lunas`** pada kemajuan simpanan pokok.
  Tanpa pembedaan itu, setiap setoran berikutnya memicu pengaktifan keanggotaan
  lagi — dan pengaktifan berulang menulis ulang tanggal aktif, yang menentukan
  masa keanggotaan pada perhitungan SHU.
- **Simpanan pokok dan wajib tidak pernah dormant.** Keduanya memang tidak
  bergerak menurut sifatnya; menandainya dormant akan menyatakan seluruh
  anggota tidak aktif.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 48 suite, **1184 tes lulus** (bertambah 49) |
| Bukti K-3 | **24 pemeriksaan lulus** |

### Belum dikerjakan pada K-3

- **Peristiwa akuntansi simpanan belum dijurnal.** Kode `COOPERATIVE_*` belum
  dikenal mesin Core sampai IR-003 disetujui. Buku pembantu anggota berjalan;
  yang belum terbentuk adalah jurnal buku besarnya. Kolom
  `accounting_event_id` sudah tersedia dan tinggal diisi.
- **Layanan dan endpoint** menyusul pada satu commit tersendiri bersama
  keanggotaan K-2, sebab pengaktifan anggota adalah akibat dari transaksi
  simpanan pokok.

## K-2 — Organisasi, kepengurusan, dan keanggotaan

### Ditambahkan

- **Migrasi modul** `20260731T170000__cooperative__organization_and_membership.sql`:
  sebelas tabel — periode kepengurusan, jabatan, penugasan, anggota, kategori
  anggota, dokumen, persetujuan data, ahli waris, hubungan keluarga, riwayat
  status, dan akun portal.
- **`cooperative-member.ts`** — aturan sebagai fungsi murni: transisi sembilan
  status, gerbang pengaktifan, kelayakan mendaftar, kepengurusan berperiode,
  larangan rangkap jabatan, penomoran anggota, dan perhitungan penyelesaian.
  **48 pengujian.**
- **`scripts/prove-cooperative-k2.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k2-keanggotaan.txt` — **33 pemeriksaan, seluruhnya
  lulus.** Bukti berjalan dalam satu transaksi yang selalu digulung balik,
  sehingga basis data pengembangan tidak berubah karena dijalankannya.

### Keputusan yang perlu dicatat

- **Calon anggota dan anggota berbagi satu tabel**, dibedakan `status`. Dua
  tabel terpisah memaksa pemindahan baris saat calon menjadi anggota, dan
  pemindahan baris memutus rujukan dokumen serta jejak auditnya.
- **Gerbang keanggotaan ditegakkan dari DUA arah.** Anggota `ACTIVE` wajib
  punya nomor dan tanggal aktif; **dan** calon anggota tidak boleh punya
  tanggal aktif. Arah kedua menutup jalan mengisi `activated_at` lebih dahulu
  lalu mengubah status kemudian — jalan yang akan terlewat bila hanya arah
  pertama yang dijaga.
- **Pengaktifan tidak menuntut hak akses tersendiri.** Ia bukan keputusan
  manusia melainkan akibat lunasnya simpanan pokok. Memberinya hak akses akan
  membuka jalan bagi petugas untuk mengaktifkan anggota yang belum membayar.
- **Satu jabatan hanya dipangku satu orang pada satu waktu**, ditegakkan
  *exclusion constraint* (`btree_gist`), bukan hanya layanan. Jabatan Ketua
  menentukan siapa yang sah menandatangani perjanjian pinjaman, dan dua ketua
  pada satu tanggal berarti dua tanda tangan yang sama-sama tampak sah.
- **Bekas anggota yang meninggalkan tunggakan tidak dapat mendaftar ulang.**
  Tanpa aturan ini, seseorang dapat menghapus tunggakannya dengan keluar lalu
  masuk kembali sebagai orang baru.
- **`cooperative_member_category` bukan `customer_group`.** Yang satu
  menentukan hak suara, hak pinjam, dan bagian SHU; yang lain menggolongkan
  pelanggan untuk harga. Menyamakannya berarti kategori anggota ikut berubah
  setiap kali seseorang menyunting daftar harga.
- **`cooperative_related_party`** mencatat hubungan keluarga antar anggota dan
  pengurus. Diperlukan aturan pemisahan wewenang nomor 6; tanpanya, benturan
  kepentingan hanya dapat ditangkap manusia yang kebetulan mengenali nama.
- **PIN anggota disimpan sebagai hash Argon2id**, tidak pernah plaintext, dan
  tidak pernah terlihat kasir.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 47 suite, **1135 tes lulus** (bertambah 48) |
| Bukti K-2 | **33 pemeriksaan lulus** |

### Belum dikerjakan pada K-2

- **Layanan dan endpoint keanggotaan** menyusul bersama K-3, sebab pengaktifan
  anggota adalah akibat dari transaksi simpanan pokok — memisahkannya berarti
  menulis dua kali jalur yang sama.

## K-1 — Profil koperasi, legalitas, dan kebijakan

**Cabang:** `feature/v12-ekoperasi`

### Ditambahkan

- **Migrasi modul** `20260731T160000__cooperative__profile_and_legality.sql`:
  delapan tabel — `cooperative_type`, `cooperative`,
  `cooperative_legal_document`, `cooperative_address`,
  `cooperative_service_area`, `cooperative_policy`, `cooperative_domain`,
  `cooperative_account_mapping`.
- **`cooperative-profile.ts`** — aturan sebagai fungsi murni: transisi status,
  daftar periksa kesiapan go-live, penyusunan dan pemeriksaan slug, masa
  berlaku berversi, dan kesesuaian jenis koperasi. **39 pengujian.**
- **`cooperative-profile.service.ts`** dan **`cooperative.module.ts`** —
  14 endpoint di bawah `/cooperative/*`.
- **`ports/index.ts`** — delapan port yang didefinisikan koperasi sendiri.
- **`scripts/apply-cooperative-migrations.mjs`** — penerap migrasi modul
  sementara, idempoten, mencatat pada tabel modulnya sendiri.
- **`scripts/prove-cooperative-k1.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k1-profil.txt` — **22 pemeriksaan, seluruhnya lulus.**

### Keputusan yang perlu dicatat

- **Satu ruang kerja hanya untuk satu koperasi**, ditegakkan indeks unik
  parsial. Dua koperasi pada satu tenant berarti dua bagan akun, dua RAT, dan
  dua SHU yang harus dipisahkan pada setiap kueri.
- **Koperasi berstatus ACTIVE wajib punya nomor badan hukum**, ditegakkan
  constraint. Itulah pembeda antara koperasi sah dan perkumpulan biasa, dan
  koperasi tidak sah tidak boleh menghimpun simpanan anggota.
- **Kebijakan aktif wajib menyebutkan persetujuannya.** Kebijakan yang berlaku
  tanpa persetujuan adalah kebijakan yang dibuat seseorang sendirian atas hak
  seluruh anggota.
- **AD/ART, aturan keanggotaan, dan kebijakan SHU sah hanya setelah diputuskan
  Rapat Anggota.** Ditegakkan layanan; tautan keputusannya diisi pada K-5.
- **Kebijakan baru selalu membentuk versi baru**, tidak pernah menyunting versi
  lama. SHU dihitung menurut kebijakan yang berlaku pada periode bukunya;
  kebijakan yang disunting di tempat membuat perhitungan tahun lalu tidak dapat
  diulang.
- **Kekurangan go-live dilaporkan seluruhnya sekaligus.** Pemilik koperasi yang
  diberi tahu satu kekurangan lalu satu lagi setelah memperbaikinya akan
  melalui banyak putaran untuk hal yang muat dalam satu layar.
- **Pembubaran bersifat akhir.** Menghidupkan kembali koperasi yang bubar
  berarti mendirikan koperasi baru dengan badan hukum baru, bukan mengubah
  status baris yang sama.

### Temuan baru untuk IR-001

`schema_migration.version` bertipe **`VARCHAR(16)`**, sedangkan id migrasi
modular yang diminta panduan §7 panjangnya 49 aksara. Kolom itu secara
struktural tidak dapat menampungnya — katalog modular tidak dapat berjalan
tanpa pelebaran kolom ini. Ditambahkan ke IR-001 sebagai bagian wajib dari
perubahan Core, beserta galat sungguhannya sebagai bukti.

### Berkas bersama yang disentuh

Satu: `apps/api/src/app.module.ts` — satu baris impor dan satu entri pada
`imports`. Sengaja sekecil mungkin, sebab berkas itu disentuh empat sesi
paralel. Tidak ada berkas bersama lain, tidak ada dependensi baru, lockfile
tidak berubah.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` (API dan web) | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 46 suite, **1087 tes lulus** (bertambah 39) |
| Bukti K-1 | **22 pemeriksaan lulus** |

### Belum dikerjakan pada K-1

- **Antarmuka `/ekoperasi/*`** ditunda ke K-9 bersama portal anggota, supaya
  seluruh layar koperasi dirancang sekaligus alih-alih sepotong per fase.
- **Langganan Rp 500.000/bulan** memerlukan paket pada control plane; menunggu
  keputusan sesi Core apakah paket vertikal masuk katalog paket yang sama.
- **Menu dan hak akses koperasi** belum disemai — menunggu IR-004. Endpoint
  sudah ada dan berpenjaga, tetapi penyewa sungguhan belum dapat memanggilnya.
  Itu keadaan yang benar, bukan yang perlu diakali.

## K-0 — Audit dan batas konteks

**Cabang:** `feature/v12-ekoperasi` · **Titik tolak:** `origin/main` @ `4f7ab88`

### Ditambahkan

- Sembilan dokumen audit di `docs/ekoperasi/`: keadaan saat ini, peta domain,
  matriks pakai-ulang, kontrak integrasi POS, kontrak akuntansi, keamanan dan
  pemisahan wewenang, rencana implementasi, garis dasar pengujian, dan daftar
  permintaan integrasi.
- Empat permintaan integrasi di `docs/integration-requests/cooperative/`.

### Temuan

- **Tidak ada satu pun kode koperasi di dalam repositori.** Kata "koperasi"
  hanya muncul pada naskah pemasaran. Delapan agregat koperasi seluruhnya
  dibangun baru, sekitar 80 tabel.
- **Katalog migrasi masih tunggal dan bernomor urut.** Tiga vertikal yang
  sama-sama menambahkan ke `manifest.json` bukan sekadar akan berkonflik saat
  penggabungan — dua migrasi berbeda dapat memakai nomor sama, dan penyewa yang
  sudah menerapkan salah satunya akan **melewati** yang lain tanpa satu pun galat
  muncul. → IR-001.
- **Sembilan port bersama yang disebut perintah belum ada.** Tidak menghalangi:
  port yang baik didefinisikan pemakainya. Koperasi mendefinisikan sendiri di
  `modules/cooperative/ports/`.
- **`modules/health/` sudah terpakai** oleh pemeriksaan kesehatan platform,
  padahal panduan memberikannya kepada sesi eMedik. Disampaikan sebagai temuan
  untuk sesi lain.

### Keputusan yang perlu dicatat

- **`investor_profile` dan `ownership_interest` TIDAK dipakai untuk
  keanggotaan.** Keduanya memodelkan penyertaan modal perseroan, dengan suara
  mengikuti kepemilikan. Koperasi bekerja terbalik — satu anggota satu suara,
  berapa pun simpanannya. Memakainya akan menanamkan pembobotan suara
  berdasarkan modal ke dalam fondasinya.
- **Simpanan pokok dan wajib diperlakukan sebagai ekuitas, bukan kewajiban.**
  Keduanya tidak dapat ditarik selama keanggotaan berjalan. Menyamakannya dengan
  simpanan sukarela akan membuat neraca menyatakan modal sendiri jauh lebih
  kecil daripada yang sebenarnya, dan rasio kesehatan yang dihitung di atasnya
  ikut salah.
- **Akad syariah memakai kode peristiwa akuntansi tersendiri**, bukan kode
  pinjaman dengan nama berbeda. Memakai `COOPERATIVE_LOAN_DISBURSED` untuk
  murabahah akan menyajikan jual-beli sebagai pinjaman berbunga.
- **Angsuran wajib memisahkan pokok dan jasa.** Keduanya masuk akun berbeda, dan
  membelah totalnya kemudian berarti menebak berapa pendapatan koperasi.
- **Unit usaha tidak memiliki POS sendiri.** Ia tertaut ke `outlet` dan
  `pos_terminal` Core lewat satu tabel penghubung. POS kedua akan membelah
  persediaan dan pembukuan menjadi dua kebenaran.
- **Patronage dibaca berkala, bukan ditulis saat transaksi.** Ia dihitung atas
  periode buku yang sudah ditutup; menuliskannya saat transaksi berarti angkanya
  ikut berubah setiap ada retur — sesudah SHU dihitung.
- **PIN anggota tidak pernah sampai ke kasir maupun ke POS.** Layar PIN milik
  koperasi; yang diserahkan ke POS hanya token sekali pakai berumur 60 detik.

### Garis dasar

| | |
|---|---|
| `pnpm install --frozen-lockfile` | berhasil — lockfile tidak berubah |
| `tsc --noEmit` (API) | bersih |
| `jest` (API) | 45 suite, **1048 tes lulus** |
| Cakupan pengujian koperasi | **nol** — sasaran K-11: sekitar 1325 |

### Belum dikerjakan

Tidak ada kode koperasi yang ditulis pada K-0. Audit ini sengaja berhenti pada
dokumen, sebab tiga dari empat permintaan integrasi menentukan bentuk kode yang
akan ditulis sesudahnya — dan menulis kode lebih dahulu lalu menyesuaikannya
berarti mengerjakan hal yang sama dua kali.
