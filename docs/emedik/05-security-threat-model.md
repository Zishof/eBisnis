# H-0 · Model Ancaman Keamanan

Data kesehatan berbeda dari data perdagangan dalam satu hal yang menentukan
segalanya: **kebocorannya tidak dapat diperbaiki.** Kata sandi dapat diganti,
kartu dapat diblokir, harga dapat dikoreksi. Diagnosis HIV yang terbaca atasan,
riwayat kesehatan jiwa yang terbaca calon mertua, kehamilan yang terbaca
tetangga — tidak ada yang dapat menariknya kembali.

Model ancaman ini karena itu menimbang **kerugian yang tidak dapat dipulihkan**
lebih berat daripada kemudahan.

---

## Aset yang dilindungi

| Aset | Kerugian bila bocor | Kerugian bila salah |
|---|---|---|
| Identitas pasien | Sedang | **Fatal** — obat kepada orang yang salah |
| Diagnosis dan riwayat | **Tidak dapat dipulihkan** | Keputusan medis yang salah |
| Hasil laboratorium | **Tidak dapat dipulihkan** | Hasil kritis yang tidak dibaca |
| Resep dan pemberian obat | Tinggi | **Fatal** — dosis, rute, interaksi |
| Rekam medis jiwa, HIV, kekerasan seksual, kehamilan | **Tidak dapat dipulihkan, dan berlipat** | — |
| Tagihan dan klaim | Sedang | Kerugian keuangan |
| Data kader dan sasaran Posyandu | Sedang | Sasaran program terlewat |

Baris keempat dari bawah menuntut perlakuan tersendiri: **data berkategori
sensitif tinggi**. Hukum Indonesia dan praktik akreditasi memperlakukannya lebih
ketat, dan sistem harus dapat menandainya, bukan menyerahkannya pada kebijakan
tertulis semata.

---

## Ancaman, dan yang menahannya

### A1 — Tenaga kesehatan membaca rekam medis orang yang tidak dirawatnya

Ancaman paling sering terjadi, dan paling sering diabaikan. Perawat yang membuka
rekam medis tetangganya, staf yang mencari nama artis, mantan pasangan yang
kebetulan bekerja di rumah sakit yang sama.

Hak akses berbasis peran **tidak menahannya** — perawat memang berhak membaca
rekam medis; pertanyaannya rekam medis siapa.

**Yang menahan:**
- Hubungan perawatan (`care relationship`): akses biasa hanya kepada pasien yang
  sedang dalam kunjungan/rawatan pada unit tempat ia bertugas.
- Break-glass: akses darurat di luar hubungan itu **diizinkan** — menolaknya
  akan membunuh orang di IGD — tetapi wajib beralasan, tercatat, dan
  **diberitahukan** kepada petugas mutu untuk ditelaah.
- Setiap pembacaan dicatat, termasuk tujuannya.

Diuji pada H-12.

### A2 — Rekam medis ganda

Satu orang, dua nomor rekam medis. Alergi tercatat pada berkas A; obat
diresepkan dari berkas B.

**Yang menahan:** deteksi ganda saat pendaftaran, identitas perusahaan lintas
fasilitas, dan penggabungan terkendali yang dapat dibatalkan. Dikerjakan H-2,
sebelum apa pun yang menunjuk pasien dibangun.

### A3 — Catatan klinis disunting setelah terjadi peristiwa

Dokumentasi yang dapat diubah diam-diam tidak bernilai — baik sebagai bukti
hukum maupun sebagai dasar keputusan medis berikutnya.

**Yang menahan:** catatan bertanda tangan tidak dapat diubah. Perubahan menjadi
amandemen tersendiri bertanda tangan, dan yang asli tetap terbaca. Ditegakkan
basis data seperti penjaga `journal_entry` POSTED pada `V008`.

### A4 — Hasil kritis tidak dibaca siapa pun

Nilai kalium yang mengancam nyawa terkirim ke sistem, tampil di daftar, dan
tidak ada yang membukanya sampai besok pagi.

**Yang menahan:** hasil kritis wajib memiliki penerimaan oleh manusia berwenang,
dengan tenggat. Yang lewat tenggat naik ke atasan lewat hub notifikasi yang
sudah punya SLA. Kegagalan ini kegagalan sistem, bukan kegagalan orang — jadi
sistem yang harus menagihnya.

### A5 — Obat salah pasien, dosis, rute, atau waktu

**Yang menahan:** enam benar pada eMAR, pemeriksaan ganda untuk obat berisiko
tinggi, peringatan interaksi dan alergi yang **memblokir**, bukan sekadar
memberi tahu.

Catatan penting: peringatan yang terlalu sering muncul akan diabaikan. Ambangnya
harus dapat dikonfigurasi per fasilitas, dan jumlah peringatan yang dilewati
harus terpantau — bila hampir semuanya dilewati, peringatannya yang salah, bukan
penggunanya.

### A6 — Data satu fasilitas terbaca fasilitas lain

Satu tenant dapat memiliki beberapa fasilitas. Rumah sakit A tidak berhak
membaca rekam medis pasien yang hanya pernah berobat di klinik B milik grup yang
sama, kecuali pasiennya menyetujui.

**Yang menahan:** `user_scope_assignment` yang sudah ditegakkan pada kueri, plus
persetujuan pasien untuk berbagi lintas fasilitas.

### A7 — Vertical lain membaca rekam medis

info-desa ingin laporan kesehatan warga; koperasi ingin tahu tagihan anggotanya.

**Yang menahan:** panduan §6. Kesehatan menerbitkan **agregat**, tidak pernah
baris. Diuji pada H-12 sebagai isolasi antar-vertical.

### A8 — Pasien membaca rekam medis pasien lain lewat portal

**Yang menahan:** portal pasien mengambil identitas dari token, tidak pernah
dari parameter. Akses wali (orang tua atas anak, anak atas orang tua lanjut usia)
adalah hubungan yang tercatat dan dapat dicabut, bukan penyamaan identitas.

### A9 — Data contoh tercampur data nyata

Data contoh pasien yang tidak terhapus, lalu diperlakukan sebagai pasien nyata.
Atau sebaliknya: pembersihan data contoh menghapus pasien nyata.

**Yang menahan:** golongan `REFERENCE`/`EXAMPLE` yang baru dibereskan sesi Core,
plus `isSampleData` dan `sampleBatchId` pada setiap baris. Dan aturan yang sudah
terbukti pada inti: **pembersihan tidak pernah menghapus data acuan**.

Tambahan khusus kesehatan: pendaftaran pasien contoh **tidak boleh tertagih**.
Perintah §4 menyebutnya, dan itu juga soal keamanan — tagihan yang salah adalah
kerugian yang dapat dituntut.

### A10 — Berkas DICOM dan hasil pindai bocor lewat tautan

Gambar radiologi biasanya disimpan sebagai berkas, dan tautannya sering dibuat
dapat ditebak.

**Yang menahan:** tautan bertanda tangan berbatas waktu, bukan tautan tetap.
Perintah §15 juga melarang menyimpan seluruh biner DICOM di basis data
relasional tanpa arsitektur penyimpanan.

---

## Yang TIDAK boleh dicatat

Sejajar dengan larangan pada POS:

```
nomor kartu dan CVV
kata sandi dan token
isi rekam medis pada catatan galat
isi rekam medis pada prompt AI yang keluar dari server
nama pasien pada log kinerja
```

Baris keempat menuntut perhatian khusus: gerbang AI sudah punya redaksi, tetapi
polanya disetel untuk data perdagangan (surel, NPWP, nomor telepon). Pola untuk
data kesehatan — nomor rekam medis, NIK, nama pasien — harus ditambahkan pada
H-12, dan diuji.

---

## Yang diputuskan sekarang, bukan nanti

Empat hal yang bila diputuskan belakangan akan menuntut membongkar apa yang
sudah dibangun:

1. **Setiap pembacaan rekam medis dicatat.** Bukan hanya perubahan. Menambahkan
   pencatatan baca belakangan berarti menyisipkannya ke setiap kueri yang sudah
   ditulis.
2. **Setiap akses membawa tujuan (`purpose of use`).** Perawatan, penagihan,
   mutu, penelitian, permintaan pasien. Menambahkannya belakangan berarti
   seluruh jejak audit lama tidak punya tujuan, dan pertanyaan "untuk apa" tidak
   dapat dijawab surut.
3. **Catatan bertanda tangan tidak dapat diubah, sejak catatan pertama.**
4. **Data berkategori sensitif tinggi ditandai sejak awal.** Menandainya
   belakangan berarti seluruh data lama tidak tertandai, dan pemisahannya harus
   ditebak.

Keempatnya masuk H-1 dan H-2, bukan H-12. H-12 memverifikasinya; ia tidak
membangunnya.
