# 19 · Peta COA Kesehatan dan Pemetaan Akuntansi

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026
**Perintah:** R2 §15

---

## Aturan pertama

```text
Jangan membuat buku besar kedua.
```

Rumah sakit memakai mesin akuntansi bersama lewat `HealthAccountingPort`.
Membangun buku besar kesehatan tersendiri akan menghasilkan dua neraca yang
tidak pernah cocok — dan yang lebih buruk, dua-duanya akan tampak benar.

Yang dibangun modul kesehatan adalah **pemetaannya**: peristiwa klinis apa
menjadi jurnal apa. Jurnalnya sendiri milik Core.

---

## Akun yang dibutuhkan

**Aset**

```text
Piutang Pasien            Piutang BPJS            Piutang Asuransi
Persediaan Obat           Persediaan BMHP         Persediaan Reagen
Persediaan Implan         Peralatan Medis         Akumulasi Penyusutan
```

**Liabilitas**

```text
Deposit Pasien            Utang Jasa Dokter       Utang Jasa Perawat/Bidan
Utang Fee Sistem          Utang Distribusi Investor
```

**Pendapatan**

```text
Rawat Jalan   Rawat Inap   UGD        Operasi     VK
Laboratorium  Radiologi    Farmasi    Alat        Bed
```

**Beban**

```text
HPP Obat              HPP BMHP              HPP Reagen        HPP Implan
Beban Jasa Dokter     Beban Jasa Nakes      Beban Maintenance Alat
Beban Penyusutan Alat Beban Platform eMedik Beban Penolakan Klaim
```

---

## Model pemetaan

```text
HealthAccountingProfile      profil per fasilitas
HealthAccountingRule         aturan: peristiwa → akun debit/kredit
HealthAccountingAssignment   penugasan aturan ke layanan
HealthAccountingEvent        peristiwa yang sudah terpetakan
HealthAccountingValidation   hasil pemeriksaan kelengkapan
```

Pemetaan tinggal di **data**, bukan di kode. Debit dan kredit tidak pernah
ditulis di dalam controller — pola yang sama seperti `accounting_event` dan
`accounting_posting_rule` milik Core sejak V015.

---

## Peristiwa yang wajib terpetakan

| Peristiwa | Debit | Kredit |
|---|---|---|
| Layanan diberikan (pasien tunai) | Piutang Pasien | Pendapatan menurut unit |
| Layanan diberikan (BPJS) | Piutang BPJS | Pendapatan menurut unit |
| Obat diserahkan | HPP Obat | Persediaan Obat |
| Reagen dipakai | HPP Reagen | Persediaan Reagen |
| Implan dipasang | HPP Implan | Persediaan Implan |
| Klaim disetujui kurang dari diajukan | Beban Penolakan Klaim | Piutang BPJS |
| Klaim dibayar | Kas | Piutang BPJS |
| Jasa dihitung | Beban Jasa Dokter | Utang Jasa Dokter |
| Jasa dibayarkan | Utang Jasa Dokter | Kas |
| Fee sistem terhitung | Beban Platform eMedik | Utang Fee Sistem |
| Distribusi investor disetujui | Ekuitas/Laba Ditahan | Utang Distribusi Investor |
| Deposit pasien diterima | Kas | Deposit Pasien |
| Deposit dipakai | Deposit Pasien | Piutang Pasien |

Baris **"klaim disetujui kurang dari diajukan"** yang paling sering terlupa.
Selisihnya bukan pendapatan yang hilang begitu saja; ia beban yang harus
terlihat, sebab ia ukuran mutu pengkodean dan kelengkapan berkas.

---

## Validasi

Layanan tidak dapat diaktifkan sebelum akunnya terpetakan:

```text
akun pendapatan         wajib
akun piutang            wajib
akun persediaan         bila memakai persediaan
akun HPP                bila memakai persediaan
beban jasa profesional  bila dibagi jasanya
utang jasa              bila dibagi jasanya
fee sistem              bila fee sistem aktif
utang investor          bila distribusi aktif
pajak                   bila dipotong
penyesuaian klaim       bila melayani BPJS
```

Sama seperti pemetaan unit: yang kurang **disebutkan namanya**.

---

## Integration request yang dibutuhkan

Kode peristiwa akuntansi `HEALTH_*` masih menunggu keputusan Core — sudah
diajukan sejak H-4 dan belum terjawab. Sampai ia ada:

- penyerahan obat belum memicu pencatatan harga pokok;
- pendapatan layanan belum masuk jurnal;
- dan pembagian jasa belum menghasilkan utang.

Ini penghalang yang **tidak dapat diselesaikan sesi eMedik sendiri**, dan
mencoba menyelesaikannya dengan membuat buku besar kedua akan melanggar aturan
pertama dokumen ini.
