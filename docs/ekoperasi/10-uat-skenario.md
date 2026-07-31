# Skenario Uji Terima Pengguna — eKoperasi

Ditulis untuk **pengurus koperasi sungguhan**, bukan untuk penguji perangkat
lunak. Setiap skenario dapat dijalankan seseorang yang mengerti cara koperasi
bekerja tetapi tidak mengerti cara sistem ini dibangun.

Susunannya mengikuti perjalanan satu tahun buku, sebab itulah cara pengurus
memahami pekerjaannya — bukan mengikuti susunan menu.

## Cara memakai daftar ini

Tiap skenario memuat **Yang dilakukan**, **Yang harus terjadi**, dan — bagian
yang paling perlu diperhatikan — **Yang harus DITOLAK sistem**. Bagian terakhir
itu ada karena perangkat lunak keuangan dinilai bukan dari apa yang dapat
dikerjakannya, melainkan dari apa yang dicegahnya.

Bila sebuah langkah "Yang harus DITOLAK" ternyata **diterima**, hentikan
pengujian dan laporkan. Itu bukan ketidaknyamanan kecil.

---

## A. Koperasi berdiri

### A-1 · Membuat profil koperasi

**Yang dilakukan:** Buka Koperasi → Profil Koperasi. Isi nama, jenis, dan
lingkup keanggotaan. Simpan.

**Yang harus terjadi:** Profil tersimpan berstatus DRAFT.

**Yang harus DITOLAK sistem:**

- Mengubah status menjadi AKTIF sebelum nomor badan hukum diisi.
  *Mengapa:* koperasi yang belum sah tidak boleh menghimpun simpanan anggota.
- Membuat profil koperasi kedua pada ruang kerja yang sama.
  *Mengapa:* dua koperasi berarti dua bagan akun, dua RAT, dan dua SHU yang
  harus dipisahkan pada setiap layar — dan suatu hari tidak terpisah.

### A-2 · Menyusun AD/ART

**Yang dilakukan:** Kebijakan → susun AD/ART, tetapkan tanggal berlaku, sahkan
lewat keputusan RAT.

**Yang harus DITOLAK sistem:**

- Mengesahkan AD/ART tanpa menunjuk keputusan RAT.
- Menyunting kebijakan yang sudah dipakai menghitung SHU.
  *Mengapa:* perhitungan tahun lalu tidak akan dapat diulang, dan angka SHU
  yang tidak dapat diulang tidak dapat dipertanggungjawabkan kepada anggota
  yang mempersoalkannya.

---

## B. Anggota masuk

### B-1 · Menerima anggota baru

**Yang dilakukan:** Anggota → tambah calon anggota → setelah simpanan pokok
dibayar, ubah status menjadi AKTIF.

**Yang harus terjadi:** Nomor anggota dan tanggal aktif diminta saat status
diubah.

**Yang harus DITOLAK sistem:**

- Mengisi tanggal aktif pada calon anggota yang statusnya masih calon.
  *Mengapa:* itu jalan untuk mengisi tanggalnya lebih dahulu lalu mengubah
  statusnya belakangan, sehingga keanggotaan tampak lebih tua daripada
  sebenarnya — dan masa keanggotaan menentukan bagian SHU.
- Mengaktifkan anggota tanpa nomor anggota.
- Menghapus anggota. Yang tersedia hanya pemberhentian, dan pemberhentian
  menuntut tanggal serta alasannya.

### B-2 · Pendaftaran lewat situs koperasi

> **Belum dapat diuji.** Situs koperasi belum dapat dibuka pengunjung; lihat
> [IR-005](../integration-requests/cooperative/005-resolusi-tenant-situs-publik.md).
> Yang dapat diuji sekarang hanyalah pratinjaunya oleh pengurus.

**Yang harus DITOLAK sistem** (diuji lewat jalur pratinjau):

- Lamaran tanpa persetujuan pengolahan data pribadi.
- Menyetujui lamaran tanpa menerbitkan anggotanya.
- Menolak lamaran tanpa alasan.
  *Mengapa:* calon anggota berhak mengetahui mengapa ia ditolak.

---

## C. Simpanan berjalan

### C-1 · Menyiapkan produk simpanan

**Yang harus DITOLAK sistem:**

- Simpanan wajib yang ditandai **dapat ditarik**.
  *Mengapa:* simpanan wajib yang dapat ditarik secara hukum bukan simpanan
  wajib lagi, dan ia dihitung sebagai modal sendiri pada laporan keuangan.
- Simpanan pokok tanpa besarannya.
- Produk yang membawa **bunga dan nisbah sekaligus**.
  *Mengapa:* tidak dapat dijelaskan kepada pengawas mana pun — konvensional
  maupun syariah.
- Produk simpanan pokok kedua yang aktif.

### C-2 · Menerima setoran

**Yang dilakukan:** Catat setoran simpanan wajib seorang anggota.

**Yang harus terjadi:** Saldo bertambah; mutasi tercatat dengan saldo
sesudahnya.

**Yang harus DITOLAK sistem:**

- Saldo menjadi negatif. *Mengapa:* simpanan bukan pinjaman.
- Membayar simpanan wajib periode yang sama dua kali pada rekening yang sama.

---

## D. Pinjaman disalurkan

### D-1 · Permohonan sampai pencairan

**Yang dilakukan:** Terima permohonan → susun analisis kredit → ajukan
persetujuan → cairkan.

**Yang harus terjadi:** Jadwal angsuran terbentuk saat pencairan, dengan
pemisahan pokok dan jasa pada setiap barisnya.

**Yang harus DITOLAK sistem:**

- **Orang yang sama menyusun analisis dan menyetujui pinjaman.**
  *Mengapa:* analisis kehilangan seluruh gunanya bila penyusunnya sekaligus
  yang memutuskan. Ini pasangan yang paling sering dipakai menyalurkan
  pinjaman fiktif, dan pengujian ini yang paling penting di seluruh daftar.
- Menyunting jadwal angsuran setelah pencairan. Perubahan syarat berjalan lewat
  restrukturisasi, yang membentuk pinjaman baru menunjuk yang lama.
- Menghapusbukukan pinjaman dengan satu tanda tangan.
  *Mengapa:* penghapusbukuan adalah perbuatan yang paling mudah dipakai
  menghilangkan jejak pinjaman bermasalah.
- Akad murabahah yang membawa tarif bunga; qardh yang membawa imbalan.

### D-2 · Angsuran diterima

**Yang harus DITOLAK sistem:**

- Alokasi pembayaran yang jumlahnya tidak sama dengan nilai yang dibayarkan.
  *Mengapa:* selisih di sini berarti ada uang yang diterima koperasi tetapi
  tidak sampai ke mana pun.

---

## E. Rapat Anggota Tahunan

### E-1 · Menyelenggarakan RAT

**Yang dilakukan:** Buka rapat → catat kehadiran → lakukan pemungutan suara →
catat keputusan.

**Yang harus terjadi:** Kuorum dihitung sistem dan angkanya tersimpan.

**Yang harus DITOLAK sistem:**

- **Memberi bobot pada suara seorang anggota.** Tidak ada tempat untuk
  menyimpannya, dan itu disengaja.
  *Mengapa:* satu anggota satu suara adalah pembeda koperasi dari perseroan
  terbatas. Bila suatu hari layar ini menyediakan kolom bobot, laporkan.
- Satu anggota memberikan suara dua kali pada mata acara yang sama.
- Menyatakan kuorum tercapai tanpa angka yang mendukungnya.
- Menyatakan kuorum tercapai padahal yang hadir kurang dari syaratnya.
- Menyatakan kuorum **tidak** tercapai padahal yang hadir memenuhi syarat.
  *Mengapa:* pernyataan itu dapat dipakai membatalkan keputusan yang sah.
- Mencatat keputusan sebagai SAH padahal suaranya kurang dari ambang.
- Menghapus keputusan rapat maupun suara yang sudah diberikan.

### E-2 · Notulen

**Yang harus DITOLAK sistem:**

- Mengesahkan notulen yang disusun AI tanpa diperiksa manusia lebih dahulu.

---

## F. SHU dihitung dan dibagikan

### F-1 · Menghitung SHU

**Yang dilakukan:** Tutup tahun buku → jalankan perhitungan → ajukan ke RAT →
bagikan.

**Yang harus terjadi:**

- Jumlah seluruh komponen **sama persis** dengan surplus.
- Jumlah yang dibagikan kepada anggota **sama persis** dengan jasa modal
  ditambah jasa usaha.
- Menjalankan perhitungan dua kali atas masukan yang sama menghasilkan angka
  yang **sama, baris demi baris**.

> Periksa yang terakhir ini sungguh-sungguh. Jalankan perhitungan, catat angka
> tiga anggota, lalu jalankan sekali lagi dan bandingkan. Angka yang berubah
> tanpa sebab adalah kegagalan yang paling sulit dijelaskan pada RAT.

**Yang harus DITOLAK sistem:**

- Perhitungan kedua atas tahun buku yang sama.
- Menyetujui perhitungan yang alokasinya tidak cocok dengan surplusnya.
- Menyetujui perhitungan tanpa menunjuk keputusan RAT.
- Pemotongan yang melebihi hak anggota.
  *Mengapa:* SHU tidak dapat berubah menjadi utang anggota kepada koperasi.

### F-2 · Anggota memeriksa SHU-nya

**Yang dilakukan:** Masuk portal sebagai seorang anggota, buka SHU Saya.

**Yang harus terjadi:** Angka yang tampil sama dengan yang tercatat di buku,
terbelah menjadi jasa modal dan jasa usaha.

> Pastikan dua anggota bersimpanan hampir sama menerima SHU berbeda bila
> transaksinya berbeda. Bila keduanya selalu sama besar, jasa usaha tidak
> benar-benar dihitung.

---

## G. Portal anggota — pengujian yang paling penting

Bagian ini menguji satu hal: **anggota hanya melihat dirinya sendiri.**

Siapkan dua akun portal, milik dua anggota berbeda. Sebut Anggota A dan
Anggota B.

### G-1 · Cakupan data

| Langkah | Yang harus terjadi |
| --- | --- |
| A membuka Simpanan Saya | Hanya rekening A yang tampil |
| A membuka Pinjaman Saya | Hanya pinjaman A |
| A membuka SHU Saya | Hanya SHU A |
| A membuka Rapat Anggota | **Seluruh rapat tampil** — rapat milik bersama |
| A membuka Pengaduan | Hanya pengaduan A |

### G-2 · Mencoba menembusnya

**Yang dilakukan:** Salin alamat halaman rincian milik B, lalu bukalah sebagai
A. (Misalnya alamat mutasi sebuah rekening simpanan.)

**Yang harus terjadi:** Muncul **"Data tidak ditemukan."**

> Perhatikan bunyinya. Pesan yang berbunyi "Anda tidak berhak membaca data
> anggota B" sudah memberitahu bahwa B ada dan punya data. Bila Anda melihat
> pesan semacam itu, laporkan — meskipun datanya sendiri tidak tampil.

### G-3 · Yang tidak boleh pernah tampil

- Nomor identitas anggota secara utuh.
- Nomor rekening secara utuh (harus tersamar sebagian).
- Catatan internal pengurus pada pengaduan.
- Taksiran agunan dan skor analisis kredit.
- PIN, dalam bentuk apa pun, kepada siapa pun — **termasuk kepada kasir dan
  pengurus.**

### G-4 · Bekas anggota

**Yang dilakukan:** Berhentikan seorang anggota, lalu cobalah masuk portal
dengan akunnya.

**Yang harus terjadi:** Portal menolak dengan keterangan bahwa keanggotaannya
telah berakhir, **dan datanya masih ada** saat diperiksa pengurus.

---

## H. Pengaduan

### H-1 · Anggota mengadu

**Yang harus DITOLAK sistem:**

- Menghapus pengaduan — oleh siapa pun, termasuk pengurus.
- Menyatakan pengaduan selesai tanpa menuliskan penyelesaiannya.
- Menutup pengaduan tanpa menyebutkan siapa yang menutup.
- Anggota menutup pengaduannya sendiri.

**Yang harus terjadi:** Anggota dapat membuka kembali pengaduan yang sudah
dinyatakan selesai, cukup dengan menanggapinya.

### H-2 · Pengaduan tanpa nama

**Yang dilakukan:** Ajukan pengaduan dengan pilihan "tanpa nama saya".

**Yang harus terjadi:** Formulirnya **menjelaskan lebih dahulu** bahwa
kepemilikannya tetap tersimpan dalam sistem meskipun namanya tidak ditampilkan
kepada pengurus.

> Bila keterangan itu tidak ada, laporkan. Menjanjikan anonimitas penuh padahal
> sistemnya tetap menyimpan pemiliknya adalah janji yang tidak dapat ditepati.

---

## I. Peran dan hak akses

### I-1 · Menyusun peran

**Yang harus DITOLAK sistem:**

- Peran yang memegang **pengaju dan penyetuju pinjaman** sekaligus.
- Peran yang memegang **penganalisis kredit dan penyetuju pinjaman** sekaligus.
- Peran yang memegang **pencatat dan pengesah simpanan** sekaligus.
- Peran yang memegang **penghitung dan pengesah SHU** sekaligus.

> Cobalah menyusunnya sungguh-sungguh. Penolakannya harus menyebutkan
> **mengapa**, bukan sekadar "tidak diizinkan".

### I-2 · Pengawas

**Yang dilakukan:** Masuk sebagai Pengawas.

**Yang harus terjadi:** Seluruh layar dapat dibaca dan diekspor; tidak satu pun
tombol simpan, setujui, atau ubah tersedia.

### I-3 · Anggota bukan petugas

**Yang harus terjadi:** Memberi seseorang akses portal **tidak** memberinya
akses ke layar pengurus, dan sebaliknya. Keduanya peran yang terpisah.

---

## J. Data contoh

### J-1 · Membersihkan data contoh

**Yang dilakukan:** Masukkan beberapa data sungguhan berdampingan dengan data
contoh, lalu jalankan pembersihan data contoh.

**Yang harus terjadi:**

- Seluruh data contoh hilang.
- **Seluruh data sungguhan bertahan** — periksa satu per satu, jangan hanya
  melihat jumlahnya.
- **Peran dan hak akses tetap utuh.** Masuk kembali setelah pembersihan; bila
  Anda tidak dapat masuk, itu kegagalan terberat pada seluruh daftar ini.
- Jenis koperasi, komponen SHU, dan pemetaan akun tetap ada.

---

## K. Yang belum dapat diuji

Disebutkan supaya tidak dicari-cari:

| Hal | Sebabnya |
| --- | --- |
| Situs koperasi dibuka pengunjung | Menunggu IR-005 |
| Pendaftaran calon anggota dari internet | Menunggu IR-005 |
| Anggota mengatur PIN dari portal | Menyentuh alur autentikasi bersama |
| Pemberitahuan lewat surel/pesan singkat | Memakai layanan bersama |
| Jurnal akuntansi koperasi | Menunggu IR-003 |
| Penyewa sungguhan memakai modul ini | Menunggu IR-001 dan IR-004 |

Selama IR-004 belum disetujui, seluruh layar koperasi menolak setiap permintaan
dengan pesan hak akses. Itu keadaan yang benar, bukan kerusakan.
