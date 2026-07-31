# 11 · Inventaris Regulasi dan Tarif JKN

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026

---

## Mengapa regulasi diperlakukan sebagai data

Tarif JKN, kelas rawat, dan kriteria KRIS berubah. Menanamkannya di dalam kode
berarti setiap perubahan peraturan menuntut penerbitan versi aplikasi — dan
sementara menunggu penerbitan itu, sistem akan menagihkan tarif yang sudah tidak
berlaku.

Yang lebih berbahaya: **klaim tahun lalu harus tetap dapat dijelaskan dengan
tarif tahun lalu.** Bila tarifnya ditimpa, seluruh klaim lama menjadi tidak
dapat diaudit. Karena itu tarif berversi dan bertanggal berlaku, tidak pernah
ditimpa.

---

## Model

```text
JknTariffRegulation     peraturan yang menjadi dasar
JknTariffVersion        versi tarif, dengan tanggal berlaku dan berakhir
JknPaymentMethod        kapitasi, nonkapitasi, INA-CBG, non-INA-CBG
JknTariffRegion         wilayah tarif
JknFacilityClass        kelas fasilitas
JknServiceClass         kelas layanan
JknCasemixGroup         kelompok casemix
JknCasemixSeverity      tingkat keparahan
JknNonPackageTariff     tarif di luar paket
```

Kunci pemilihan tarif:

```text
(metode pembayaran, wilayah, kelas fasilitas, kelompok casemix,
 keparahan, TANGGAL LAYANAN)
```

**Tanggal layanan**, bukan tanggal klaim dibuat. Pasien yang dirawat pada Maret
dan klaimnya diajukan pada Mei tetap memakai tarif Maret.

---

## Aturan impor

1. **Tarif tidak diketik tangan.** Ia diimpor dari terbitan resmi, dan berkas
   sumbernya disimpan beserta sidik jarinya. Tarif yang tidak dapat ditelusuri
   ke berkas sumber tidak boleh diaktifkan.

2. **Impor tidak menimpa.** Ia membuat versi baru; versi lama ditutup dengan
   tanggal berakhir.

3. **Aktivasi menuntut persetujuan.** Mengimpor dan mengaktifkan adalah dua
   langkah, dan yang mengimpor tidak menyetujui.

4. **Tumpang tindih tanggal ditolak.** Dua versi yang berlaku pada tanggal yang
   sama untuk kunci yang sama membuat pemilihan tarif tidak dapat ditentukan —
   dan yang tidak dapat ditentukan akan ditentukan secara acak oleh urutan baris.

---

## Status hari ini

| Yang dibutuhkan | Status |
|---|---|
| Struktur tabel berversi | **Dapat dibangun sekarang** |
| Pengimpor beserta penyimpanan berkas sumber | **Dapat dibangun sekarang** |
| Penjaga tumpang tindih tanggal | **Dapat dibangun sekarang** |
| Isi tarif resmi | **TERHALANG** — menunggu terbitan resmi |
| Grouper INA-CBG | **TERHALANG** — perangkat lunak berlisensi |

Sampai isinya ada, sistem berkata "tarif untuk kunci ini belum tersedia" dan
menolak menghitung. Itu jawaban yang benar; menaksirnya akan menghasilkan angka
yang tampak resmi dan dipakai menagih orang.

---

## Inventaris regulasi

Diisi sesi yang memiliki akses ke terbitan resminya. Kolom yang wajib ada:

```text
nomor peraturan          tahun                   judul
tanggal berlaku          tanggal dicabut         peraturan yang dicabutnya
cakupan (FKTP/FKRTL)     berkas sumber           sidik jari berkas
diverifikasi oleh        diverifikasi pada
```

**Inventaris yang kosong lebih baik daripada inventaris yang berisi nomor
peraturan hasil ingatan.** Nomor peraturan yang keliru akan disalin ke dokumen
klaim, dan dokumen klaim yang menyebut peraturan yang tidak berlaku akan
dikembalikan.
