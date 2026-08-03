# 12 · Siklus Hidup Klaim dan Casemix

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026

---

## Tahapan, dan siapa pemiliknya

| # | Tahap | Milik | Dapat dibangun sekarang |
|---|---|---|---|
| 1 | Kepesertaan | BPJS | Tidak — menunggu kredensial |
| 2 | Rujukan / surat kontrol | BPJS | Tidak |
| 3 | SEP | BPJS | Catatan lokalnya, ya |
| 4 | Pelayanan | Kami | **Sudah ada** (H-3…H-8) |
| 5 | Koding | Kami | **Ya** |
| 6 | Grouping | Grouper berlisensi | Tidak |
| 7 | Kelengkapan berkas | Kami | **Ya** |
| 8 | Verifikasi internal | Kami | **Ya** |
| 9 | Pengajuan | BPJS | Tidak |
| 10 | Pending / dispute | Keduanya | Catatannya, ya |
| 11 | Persetujuan | BPJS | Catatannya, ya |
| 12 | Pembayaran | BPJS | Catatannya, ya |
| 13 | Rekonsiliasi | Kami | **Ya** |
| 14 | Alokasi jasa | Kami | **Ya** — lihat [13](13-fee-distribution-policy-map.md) |
| 15 | Akuntansi | Kami | **Ya** — lihat [19](19-health-coa-map.md) |

Sembilan dari lima belas tahap dapat dibangun tanpa kredensial siapa pun — dan
sembilan itulah yang paling banyak menghabiskan waktu petugas rumah sakit.
Penghalang kredensial menahan ujung-ujungnya, bukan tengahnya.

---

## Tiga angka yang tidak boleh disamakan

```text
diajukan   →  yang kami kirim
disetujui  →  yang diakui BPJS
dibayar    →  yang benar-benar masuk rekening
```

Ketiganya berbeda dan disimpan terpisah. Menyamakan yang pertama dengan yang
ketiga adalah cara paling langsung membuat rumah sakit mengira dirinya punya
uang yang tidak ada — lalu membagikannya sebagai jasa medis.

Itulah sebabnya dasar pembagian jasa BPJS bawaannya `PAID_CLAIM`.

---

## Verifikasi internal

Menemukan kekurangan **sebelum** BPJS menemukannya. Bagian yang paling sepele
secara teknis dan paling berharga secara nyata: klaim yang dikembalikan karena
berkasnya kurang menghabiskan waktu berminggu-minggu, sedangkan seluruh
kekurangannya dapat diperiksa mesin dalam hitungan detik.

Yang diperiksa sekurang-kurangnya:

```text
diagnosis utama ada dan tunggal
kode diagnosis sah pada versi terminologi yang berlaku
tindakan berkode
resume medis ditandatangani
hasil penunjang yang dirujuk resume benar-benar ada
SEP sesuai dengan kunjungannya
tanggal masuk dan pulang masuk akal
kelas yang ditagih sesuai hak peserta
tanda tangan dokter penanggung jawab
```

Setiap kekurangan dilaporkan **namanya**, bukan "berkas tidak lengkap". Petugas
yang membaca "berkas tidak lengkap" akan memeriksa seluruhnya satu per satu.

---

## Dispute dan rekonsiliasi

Selisih antara diajukan dan disetujui selalu punya sebab, dan sebabnya dicatat
sebagai **kode tertutup** — bukan teks bebas. Laporan yang tidak dapat
menghitung sebab penolakan tidak dapat memperbaikinya.

```text
CODING_ERROR              DOCUMENTATION_INCOMPLETE
MEDICAL_NECESSITY         DUPLICATE_CLAIM
ELIGIBILITY_ISSUE         TARIFF_MISMATCH
SERVICE_NOT_COVERED       ADMINISTRATIVE
OTHER
```

Rekonsiliasi membandingkan **tiga sisi**: catatan kami, catatan BPJS, dan mutasi
rekening. Selisih yang tidak terjelaskan tidak boleh ditutup diam-diam.

---

## Anti-fraud

Bukan tuduhan; ia penanda untuk ditelaah manusia. Yang ditandai:

```text
klaim ganda pada kepesertaan dan tanggal yang sama
lama rawat jauh di luar kebiasaan diagnosisnya
tindakan yang tidak lazim bagi diagnosisnya
pola pengkodean satu koder yang menyimpang jauh dari koder lain
pemulangan dan pemasukan ulang dalam waktu singkat
```

**Penanda tidak pernah menghentikan pengajuan secara otomatis.** Ia membuat
klaimnya masuk antrean telaah. Penghentian otomatis pada penanda statistik akan
menahan klaim yang sah dari pasien yang memang sakit berat — dan rumah sakit
yang klaimnya tertahan akan berhenti memakai penandanya.
