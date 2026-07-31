# 13 · Peta Kebijakan Pembagian Jasa

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026
**Perintah:** R2 §6

---

## Aturan keras

```text
Jangan hard-code persentase produksi.
Jangan finalisasi jasa BPJS dari estimasi klaim.
Jangan campur tarif pasien dengan pembagian internal.
Jangan menghapus settlement final; pakai adjustment/reversal.
Fee sistem dan fee investor bawaannya NONE.
```

---

## Mengapa persentase tidak boleh ditanam di kode

Persentase pembagian jasa adalah **kesepakatan antara rumah sakit dan tenaga
medisnya**. Ia berbeda antar fasilitas, berubah, dan kadang menjadi pokok
sengketa. Menanamnya di dalam kode berarti:

- setiap fasilitas yang berbeda menuntut versi aplikasi yang berbeda;
- perubahan kesepakatan menuntut penerbitan versi;
- dan yang terburuk — perhitungan jasa bulan lalu tidak dapat diulang, sebab
  kodenya sudah berubah.

Karena itu persentase adalah **data berversi yang tidak dapat diubah**. Versi
baru dibuat; versi lama tetap ada. Setiap perhitungan menyimpan versi mana yang
dipakainya, supaya pertanyaan "mengapa jasa saya bulan lalu segini" dapat
dijawab dengan aturan bulan lalu.

---

## Dasar perhitungan

```text
GROSS_CHARGE      tagihan kotor
NET_CHARGE        setelah potongan
NET_COLLECTED     yang benar-benar tertagih
VERIFIED_CLAIM    klaim terverifikasi
PAID_CLAIM        klaim terbayar
FIXED_AMOUNT      nominal tetap
PERCENTAGE        persentase
POINT_BASED       berbasis poin
TIME_BASED        berbasis waktu
UNIT_BASED        berbasis satuan
WEIGHTED_SCORE    berbasis bobot
HYBRID            gabungan
```

**Bawaan untuk BPJS/JKN adalah `PAID_CLAIM`.** Estimasi klaim hanya boleh
dipakai untuk akrual dan simulasi, tidak pernah untuk settlement final.

Alasannya sederhana dan mahal. Klaim diajukan Rp10 juta, disetujui Rp7 juta,
dibayar Rp7 juta. Bila jasa dibagi dari Rp10 juta, rumah sakit sudah
membayarkan uang yang tidak pernah diterimanya — dan menariknya kembali dari
dokter jauh lebih sulit daripada tidak membayarkannya sejak awal.

---

## Penerima

```text
FACILITY_FEE              DOCTOR_FEE               MIDWIFE_FEE
NURSE_FEE                 PHARMACY_SERVICE_FEE     LAB_SERVICE_FEE
RADIOLOGY_SERVICE_FEE     ANESTHESIA_FEE           ASSISTANT_FEE
WARD_SERVICE_FEE          BED_FACILITY_FEE         EQUIPMENT_USAGE_FEE
MEDICAL_DEVICE_USAGE_FEE  DRUG_DISPENSING_FEE      TEAM_POOL_FEE
MANAGEMENT_POOL           SUPPORT_STAFF_POOL       SYSTEM_PLATFORM_FEE
INVESTOR_SHARE            RESERVE_FUND             QUALITY_FUND
TAX_WITHHOLDING           OTHER_FEE
```

---

## Kontributor per tindakan

Satu operasi dibagi kepada banyak orang dengan peran berbeda. Setiap kontributor
mencatat:

```text
providerId              contributorRole        percentage
point                   fixedAmount            duration
complexityWeight        attendanceEvidence     clinicalResponsibility
```

`attendanceEvidence` penting: jasa dibayarkan kepada yang **benar-benar hadir**.
Tanpa buktinya, daftar kontributor menjadi daftar keinginan — dan pada operasi
yang jasanya besar, daftar keinginan cenderung memanjang.

Sumber buktinya sudah ada dari H-7: `ot_checklist.completed_by`,
`ot_count.counted_out_by`, `ot_case.surgeon_id`, `anaesthetist_id`.

---

## Pemisahan wewenang

```text
Pembuat kebijakan tidak menyetujui versinya sendiri.
Petugas kalkulasi tidak menyetujui settlement sendiri.
Penerima jasa tidak mengubah aturan yang membayar dirinya.
Petugas fee sistem tidak menyetujui kontrak fee sistem sendiri.
Petugas distribusi investor tidak menyetujui payout sendiri.
```

Yang ketiga paling sering dilanggar dan paling sulit dilihat: dokter yang juga
administrator sistem dapat menaikkan persentasenya sendiri, dan tidak ada yang
akan menyadarinya sampai ada yang membandingkan dua bulan berturut-turut.

---

## Settlement

```text
dihitung → disimulasikan → disetujui → dikunci → dibayarkan → dinyatakan
```

Settlement yang sudah dikunci **tidak dapat dihapus**. Kekeliruan diperbaiki
lewat `adjustment` atau `reversal`, yang keduanya meninggalkan barisnya sendiri.
Menghapusnya akan membuat pernyataan yang sudah diterima dokter tidak lagi cocok
dengan catatan rumah sakit — dan yang dipegang dokter adalah kertas yang sudah
dicetak.

---

## Fee sistem dan investor

Bawaan **`NONE`**. Aktivasi menuntut seluruhnya:

```text
kontrak            telaah hukum        persetujuan manajemen
perlakuan pajak    tanggal berlaku     batas maksimum
pengecualian layanan                   maker-checker-approver
```

Templat contoh dari blueprint seluruhnya bertanda:

```text
isSampleData=true    active=false    productionApproved=false
```

Templat itu **bukan** standar nasional dan bukan saran hukum. Persentase
produksi ditentukan masing-masing fasilitas bersama tenaga medisnya.
