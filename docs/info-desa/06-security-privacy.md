# D-0 · Keamanan dan Privasi

Vertikal ini menyimpan data yang paling sensitif di seluruh eBisnis: **NIK,
kartu keluarga, kondisi sosial, disabilitas, dan status kemiskinan seluruh
warga sebuah desa**. Dokumen ini menetapkan batasnya sebelum satu baris kode
ditulis.

---

## Mengapa ini berbeda dari vertikal lain

Data penyewa lain adalah data usahanya sendiri. Data di sini adalah data **orang
lain** — warga yang tidak menandatangani apa pun, tidak memilih memakai sistem
ini, dan sering tidak tahu datanya ada di dalamnya.

Tiga akibat yang mengubah cara kerja:

1. **Persetujuan tidak dapat diandaikan.** Warga tidak "setuju dengan syarat dan
   ketentuan". Dasar hukum pemrosesannya adalah kewajiban pemerintahan desa,
   bukan persetujuan — dan itu berarti cakupannya dibatasi kewajiban itu, tidak
   lebih.
2. **Penyalahgunaannya terjadi di dalam, bukan dari luar.** Ancaman paling nyata
   bukan peretas, melainkan perangkat desa yang membuka data tetangganya karena
   penasaran, atau menyalin daftar penerima bantuan menjelang pemilihan.
3. **Kerugiannya tidak dapat dipulihkan.** NIK yang bocor tidak dapat diganti
   seperti kata sandi.

---

## Data yang digolongkan sensitif

| Golongan | Isinya | Perlakuan |
|---|---|---|
| **Pengenal langsung** | NIK, nomor KK, nomor akta | Tidak pernah masuk log, tidak pernah masuk prompt AI, disamarkan pada audit |
| **Sangat sensitif** | Disabilitas, kondisi sosial, status kemiskinan, penerima bantuan | Hak akses tersendiri; tidak muncul pada daftar umum |
| **Sensitif** | Alamat lengkap, tanggal lahir, status kawin, pekerjaan | Hak akses berjenjang; cakupan data berlaku |
| **Umum** | Nama, RT/RW, jenis kelamin | Dapat dilihat perangkat desa sesuai cakupannya |
| **Publik** | Agregat: jumlah penduduk per dusun, piramida usia | Boleh tampil di situs |

Aturan yang mengikat seluruh golongan: **agregat tidak boleh dapat dibongkar
menjadi perorangan.** Jumlah penduduk penyandang disabilitas per RT yang
isinya satu orang bukan agregat — ia adalah penyebutan orang itu dengan cara
lain. Nilai minimum penyajian agregat ditetapkan pada D-11.

---

## Cakupan data

Cakupan menentukan siapa melihat berapa banyak. Memakai
`user_scope_assignment` yang sudah ada:

| Peran | Cakupan bawaan |
|---|---|
| Kepala Desa / Lurah, Sekretaris | Seluruh desa |
| Kasi / Kaur | Seluruh desa, terbatas pada urusannya |
| Operator Kependudukan | Seluruh desa |
| Kepala Dusun | Dusunnya |
| Ketua RW | RW-nya |
| **Ketua RT** | **RT-nya saja** |
| BPD | Agregat seluruh desa; **bukan** data perorangan |
| Kader Posyandu | Sasaran posyandunya, terbatas pada medan yang relevan |
| Linmas | Tidak ada akses data kependudukan |
| Warga (portal) | **Dirinya dan keluarganya sendiri** |

Dua yang perlu ditegaskan:

- **BPD mengawasi, tidak menyelidiki.** Fungsinya pengawasan anggaran dan
  kebijakan, bukan pemeriksaan warga per orang. Memberinya akses data
  perorangan tidak diperlukan tugasnya, dan akses yang tidak diperlukan adalah
  akses yang akan dipakai untuk hal lain.
- **Linmas tidak memerlukan data kependudukan.** Tugasnya ketertiban, bukan
  pendataan.

Cakupan ditegakkan **pada kueri**, mengikuti penegakan V8-R1b yang sudah
berjalan — bukan dengan menyaring hasil di antarmuka.

---

## Pemisahan wewenang

Aturan yang disemai pada `segregation_of_duty_rule`:

| Aturan | Alasan |
|---|---|
| Pengusul penerima bantuan ≠ penyetujunya | Ini titik korupsi paling umum pada bantuan sosial desa |
| Pemverifikasi berkas layanan ≠ penerbit suratnya | Verifikasi yang dilakukan penerbit bukan verifikasi |
| Penyusun APBDes ≠ penyetujunya | |
| Pencatat realisasi ≠ bendahara yang mengeluarkan uang | |
| Operator kependudukan tidak dapat menyetujui perubahan data dirinya sendiri | |
| Pemohon layanan tidak dapat memproses permohonannya sendiri | Berlaku ketika perangkat desa mengajukan surat untuk dirinya |

Butir terakhir kerap terlewat: di desa kecil, operator layanan juga warga yang
suatu saat mengajukan surat keterangan untuk dirinya sendiri.

---

## AI

Spesifikasi §24 sudah menetapkan larangannya. Yang ditambahkan di sini adalah
**apa yang boleh masuk ke prompt**:

| Boleh | Tidak boleh |
|---|---|
| Agregat demografi | NIK, nomor KK |
| Isi pengaduan tanpa identitas pelapor | Nama lengkap penduduk |
| Angka APBDes | Daftar penerima bantuan beserta namanya |
| Rangka surat tanpa data pribadi | Kondisi sosial dan disabilitas |

Gerbang AI yang ada sudah menyaring pola NIK-seperti (16 digit) lewat redaksi
yang sudah berjalan. Village menambahkan pola nomor KK dan memastikan
penyaringnya diuji terhadap **NIK sungguhan yang berformat benar**, bukan hanya
angka acak — penyaring yang lolos pada angka acak tetapi gagal pada format
sesungguhnya adalah penyaring yang tidak menyaring.

Larangan yang paling penting, diulang dari spesifikasi §12: **AI tidak
menetapkan penerima bantuan.** Ia boleh menandai calon yang memenuhi kriteria;
keputusan dan pertanggungjawabannya pada manusia, dan tercatat siapa.

---

## Jejak akses

Membaca data penduduk **dicatat**, bukan hanya menulisnya.

Ini menyimpang dari kebiasaan sistem lain di eBisnis, dan sengaja. Pada
kependudukan, penyalahgunaan berbentuk **pembacaan** — membuka data tetangga,
menyalin daftar penerima bantuan. Audit yang hanya mencatat perubahan tidak akan
pernah melihatnya.

Yang dicatat: siapa, kapan, dalam kapasitas apa, penduduk mana, dan dari layar
mana. Yang **tidak** dicatat: isi datanya — catatan akses tidak boleh menjadi
salinan kedua dari data yang dilindunginya.

Volume pembacaan yang janggal (misalnya satu operator membuka 200 penduduk
dalam sepuluh menit) memicu pemberitahuan ke Sekretaris Desa. Ini bukan tuduhan
— kadang memang ada pekerjaan pendataan — melainkan agar hal itu terlihat.

---

## Portal warga

Warga masuk untuk melihat datanya sendiri dan mengajukan layanan. Empat batas:

1. **Hanya dirinya dan anggota keluarganya**, ditentukan dari kartu keluarga.
2. **Tidak dapat mengubah data kependudukannya sendiri.** Ia dapat mengajukan
   perbaikan; perubahannya diverifikasi operator. Data kependudukan yang dapat
   disunting sendiri berhenti menjadi data kependudukan.
3. **Pendaftaran akun warga diverifikasi perangkat desa.** Bukan verifikasi
   surel semata — siapa pun dapat membuat surel dan mengaku sebagai orang lain.
4. **Tidak ada pencarian warga.** Portal tidak menyediakan cara mencari nama
   orang lain, sekalipun hanya menampilkan nama.

---

## Penyimpanan dan retensi

| Data | Retensi |
|---|---|
| Data penduduk aktif | Selama berpenduduk di desa itu |
| Penduduk pindah/meninggal | Disimpan sebagai riwayat; tidak dihapus — dokumen kependudukan kerap dibutuhkan bertahun-tahun kemudian |
| Berkas unggahan persyaratan | Sesuai masa retensi jenis suratnya |
| Catatan akses | Sekurang-kurangnya lima tahun |
| Data contoh | Dapat dihapus kapan saja |

Penghapusan permanen data penduduk **tidak disediakan** lewat antarmuka biasa.
Bila diperlukan atas dasar hukum, jalurnya melalui prosedur tersendiri dengan
persetujuan berjenjang dan jejak yang tidak dapat dihapus.

---

## Yang tidak diklaim

Sesuai spesifikasi §18: **sistem ini tidak menggantikan sistem pertanahan
nasional.** Data pertanahan yang disimpan bersifat administratif — catatan desa
tentang riwayat dan pernyataan batas — dan surat keterangan yang terbit darinya
harus menyatakan hal itu di dalam suratnya sendiri, bukan hanya di dokumentasi.

Hal yang sama berlaku bagi data kependudukan: sistem ini **bukan** sumber
kebenaran kependudukan nasional. Ia catatan desa, yang selaras dengan sumber
resmi lewat adapter, dan perbedaannya diselesaikan ke arah sumber resmi.
