# 17 · Peta Sumber Master Data Kesehatan

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026

---

## Empat golongan sumber, dan mengapa dipisahkan

```text
OFFICIAL_REFERENCE   rujukan resmi (KFA, ICD, LOINC, tarif)
FACILITY_IMPORT      data milik fasilitas sendiri
SYNTHETIC_DEMO       data contoh buatan
LOCAL_MAPPING        pemetaan lokal ke kode resmi
```

Pemisahan ini bukan tata kelola belaka. Ia menahan satu kekeliruan yang mahal:
**harga sintetis yang tampak resmi**.

Data contoh dibuat supaya penyewa baru dapat melihat sistemnya bekerja tanpa
mengetik dua ribu baris. Bila harga contoh itu tidak dibedakan dari harga resmi,
seseorang akan memakainya menagih pasien — dan ketika ketahuan, tidak ada cara
membedakan mana yang contoh dan mana yang sungguhan.

Karena itu:

> Harga sintetis **tidak boleh** diklaim sebagai harga resmi BPJS, KFA, BPOM,
> atau LKPP. Ia bertanda sumbernya, dan penandanya tidak dapat dilepas.

---

## KFA

KFA adalah rujukan resmi produk farmasi dan alat kesehatan, menghimpun rujukan
dari sumber seperti BPOM dan LKPP, dan menyediakan kode unik produk.

| Yang dibutuhkan | Status |
|---|---|
| Struktur `KfaProductMapping`, `KfaIngredientMapping`, `KfaMedicalDeviceMapping` | **Dapat dibangun sekarang** |
| Pengimpor beserta penyimpanan berkas sumber | **Dapat dibangun sekarang** |
| Isi KFA | **TERHALANG** — menunggu akses resmi |

Obat yang belum terpetakan ke KFA tetap dapat dipakai di dalam rumah sakit; ia
hanya tidak dapat dikirim ke SATUSEHAT. Menahan seluruh farmasi sampai
pemetaannya selesai akan menghentikan pelayanan demi kerapian data.

---

## Terminologi

| Terminologi | Dipakai untuk | Status |
|---|---|---|
| ICD-10 | Diagnosis | **TERHALANG** — butuh terbitan berlisensi |
| ICD-9-CM | Tindakan | **TERHALANG** |
| LOINC | Pemeriksaan laboratorium | **TERHALANG** |
| SNOMED CT | Istilah klinis | **TERHALANG** |
| KFA | Obat dan alkes | **TERHALANG** |
| WHO Growth Standards | Pertumbuhan anak | **Struktur ada** (H-8); isinya menunggu |

Seluruhnya diperlakukan sama: strukturnya dibangun sekarang, isinya menunggu,
dan tanpa isinya sistem berkata "belum dapat dinilai" alih-alih menebak.

Model penampungnya:

```text
TerminologySnapshot      versi terminologi
TerminologyImportBatch   satu kali impor beserta berkasnya
TerminologyValidation    hasil pemeriksaan
TerminologyDeprecation   kode yang tidak lagi berlaku
LocalCodeMapping         kode lokal ke kode resmi
```

`TerminologyDeprecation` penting: kode diagnosis yang dicabut tetap harus dapat
dibaca pada rekam medis lama, tetapi tidak boleh dipilih pada rekam medis baru.

---

## Volume data contoh

Menurut blueprint, profil `STANDARD`:

| Master data | Jumlah |
|---|---:|
| Obat generik/bermerek | 1.000 |
| Kekuatan dan kemasan obat | 1.500 |
| Bahan medis habis pakai | 1.000 |
| Alat kesehatan | 500 |
| Tindakan klinis | 1.500 |
| Pemeriksaan laboratorium | 500 |
| Pemeriksaan radiologi | 300 |
| Operasi/anestesi | 300 |
| Kebidanan | 200 |
| Keperawatan | 250 |
| UGD | 200 |
| Rehabilitasi | 200 |
| Gigi | 250 |
| Gizi | 150 |
| Dialisis/onkologi/khusus | 200 |
| Bed/kamar/bangsal | 150 |
| Tarif sintetis | 3.000 |
| Pemetaan layanan | 2.000 |
| COA | 200 |
| Pemetaan akuntansi | 1.500 |

Profil `LARGE_HOSPITAL` melampauinya beberapa kali lipat.

**Pembangkitannya harus deterministik**: benih yang sama menghasilkan data yang
sama. Tanpa itu, dua penyewa demo akan melihat katalog yang berbeda dan
menyimpulkan salah satunya rusak.

---

## Penghapusan data contoh

```text
Hapus hanya soft-delete pada sample batch.
Data nyata tidak pernah tersentuh.
Yang dirujuk data nyata tidak dapat dihapus.
```

Yang terakhir yang paling penting. Bila obat contoh sudah terlanjur diresepkan
kepada pasien sungguhan, menghapusnya akan meninggalkan resep yang menunjuk
kekosongan. Penghapusan harus menolak, menyebutkan apa yang merujuknya, dan
menyerahkan keputusannya kepada manusia.
