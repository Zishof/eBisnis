# 16 · Kebijakan Akses Data Investor

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026
**Perintah:** R2 §8

---

## Aturan keras

```text
Agregat saja.
Tidak ada data tingkat pasien.
Kohort minimum dan penyamaran wajib.
Tidak ada perubahan data klinis.
Tidak ada pembayaran otomatis.
Kontrak, versi, dan persetujuan wajib.
```

---

## Yang boleh dilihat investor

```text
jumlah pendaftaran            jumlah kunjungan
bauran pembayar               pendapatan bruto
pendapatan bersih             klaim diajukan
klaim disetujui               klaim dibayar
piutang klaim                 hunian tempat tidur
lama rawat rata-rata          utilisasi layanan
utilisasi alat                margin per unit
arus kas                      belanja modal
titik impas                   distribusi
```

Seluruhnya **angka gabungan**. Tidak satu pun dapat ditelusuri ke seseorang.

---

## Yang tidak boleh dilihat investor

```text
nama pasien                   NIK
nomor rekam medis             diagnosis perorangan
catatan klinis                resep perorangan
hasil laboratorium perorangan citra radiologi
alamat atau kontak pasien
```

Daftar ini **bukan preferensi**. Investor adalah pihak luar yang memiliki
kepentingan keuangan, bukan hubungan perawatan. Memberinya data pasien bukan
pelanggaran kebijakan internal; ia pelanggaran kerahasiaan medis.

---

## Kohort minimum

Agregat yang penyebutnya terlalu kecil bukan lagi agregat.

> "Satu pasien HIV pada bulan Maret di Poliklinik Kulit" adalah kalimat agregat
> yang menyebut seseorang.

Karena itu setiap angka yang dipecah menurut layanan, unit, atau diagnosis
menuntut kohort minimum. Bila jumlahnya di bawah ambang, angkanya **tidak
ditampilkan** — dan yang ditampilkan adalah keterangan bahwa ia disembunyikan
karena terlalu kecil, bukan angka nol.

Menampilkan nol akan membuat investor menyimpulkan tidak ada pasiennya, dan itu
kebohongan yang berbeda.

Ambangnya berkonfigurasi, dengan bawaan yang tidak boleh nol.

---

## Cara penegakannya

Bukan dengan menyaring di layar. Investor memperoleh **proyeksi agregat yang
sudah dihitung** (`HealthInvestorDashboardProjection`) — bukan akses ke tabel
sumbernya dengan penyaring.

Perbedaannya menentukan: penyaring dapat dilewati siapa pun yang memanggil
jalur di bawahnya; proyeksi yang tidak memuat data pasien tidak dapat
mengungkapkannya, sekalipun jalurnya ditembus.

Data scope investor terbatas pada:

```text
INVESTMENT_SCOPE    VIEW_AGGREGATE
```

Tidak ada scope lain, dan tidak ada aksi lain.

---

## Distribusi

```text
kontrak → kontribusi modal → kebijakan waterfall → perhitungan
→ persetujuan → distribusi → pernyataan
```

**Tidak ada pembayaran otomatis.** Setiap distribusi menuntut persetujuan
manusia, dan yang menghitung tidak menyetujui.

Alasannya sama seperti pada pembagian jasa: uang yang berpindah berdasarkan
angka yang keliru sulit ditarik kembali, dan investor yang sudah menerimanya
punya alasan untuk tidak mengembalikannya.

---

## Akun contoh

Akun investor untuk demo hanya melihat data **sintetis agregat**. Ia tidak
pernah melihat data nyata, sekalipun agregat — sebab agregat dari data nyata
tetap dapat menyingkap sesuatu ketika penyebutnya kecil.
