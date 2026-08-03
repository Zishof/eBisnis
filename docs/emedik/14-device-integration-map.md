# 14 · Peta Integrasi Alat Kesehatan (IoMT)

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026
**Perintah:** R2 §7

---

## Aturan keras

```text
Alat tidak mengakses basis data langsung.
Kendali jarak jauh mati secara bawaan.
Hasil wajib berpasangan dengan pasien dan kunjungan.
Provenance wajib.
Jaringan tersegmentasi.
Status kalibrasi dan pemeliharaan wajib.
```

---

## Alur

```text
Alat
→ Jaringan Perangkat Tersegmentasi
→ Gateway Perangkat/Vendor
→ Integration Engine
→ Adapter Protokol
→ Normalisasi
→ Pemetaan Terminologi
→ Pengaitan Pasien/Kunjungan
→ Validasi
→ Telaah Manusia
→ RME/LIS/RIS/PACS
```

Sepuluh langkah, dan tidak satu pun boleh dilewati. Yang paling sering
digoda untuk dilewati adalah **telaah manusia** — dan itulah yang paling penting.

---

## Mengapa alat tidak boleh menyentuh basis data

Bukan kerapian arsitektur. Tiga alasan yang seluruhnya pernah terjadi di
lapangan:

1. **Alat medis jarang diperbarui.** Mesin analisis yang dibeli tahun 2016
   menjalankan sistem operasi tahun 2012 yang sudah tidak menerima tambalan
   keamanan. Memberinya kredensial basis data berarti menaruh kunci rumah sakit
   di dalam kotak yang tidak dapat dikunci.

2. **Alat tidak mengenal penyewa.** Ia tidak tahu skema mana miliknya. Satu
   kekeliruan konfigurasi akan menuliskan hasil pasien satu fasilitas ke
   fasilitas lain.

3. **Alat tidak dapat menolak.** Bila datanya rusak, ia tetap mengirim. Yang
   dapat menolak adalah lapisan di antaranya.

---

## Protokol dan statusnya

| Protokol | Dipakai untuk | Status | Penghalang |
|---|---|---|---|
| DICOM | Citra radiologi | `BLOCKED` | Butuh PACS; lihat di bawah |
| DICOMweb (QIDO/WADO/STOW) | Akses citra lewat web | `BLOCKED` | Butuh PACS |
| Modality Worklist | Daftar kerja modalitas | `BLOCKED` | Butuh PACS/RIS |
| MPPS | Status pengerjaan modalitas | `BLOCKED` | Butuh PACS |
| HL7 v2 | Analyzer lab, monitor | **Dapat dibangun** | Tidak ada; ia protokol terbuka |
| FHIR | Perangkat modern | `BLOCKED` | Bergantung SATUSEHAT |
| IHE DEV/PCD | Perangkat titik perawatan | **Dapat dibangun** | Profilnya terbuka |
| IEEE 11073 / SDC | Perangkat titik perawatan | **Dapat dibangun** | Standarnya terbuka |
| ASTM | Analyzer lama | **Dapat dibangun** | Protokol terbuka |
| API vendor | Bergantung vendor | `BLOCKED` | Dokumentasi per vendor |
| TCP/serial | Analyzer lama | **Dapat dibangun** | — |
| SFTP | Berkas kelompok | **Dapat dibangun** | — |
| MQTT | Perangkat pakai | `BLOCKED` | Menunggu persetujuan keamanan |

**PACS adalah penghalang yang sama sejak H-5.** Menyimpan berkas DICOM utuh di
basis data relasional akan membengkakkan cadangan sampai tidak dapat dipulihkan
pada saat dibutuhkan. Yang disimpan hanya rujukan; arsitektur penyimpanannya
menunggu keputusan Core.

---

## Yang wajib disimpan pada setiap hasil

```text
deviceId          serialNumber      gatewayId
patientId         encounterId       orderId
operatorId        capturedAt        receivedAt
sourceProtocol    rawMessageHash    validationStatus
reviewStatus      provenance
```

`rawMessageHash` menjawab pertanyaan yang muncul ketika hasilnya
dipersengketakan: *apakah yang tersimpan sama dengan yang dikirim alat?*
Tanpanya, jawabannya hanya dugaan.

`capturedAt` dan `receivedAt` **berbeda dan keduanya disimpan**. Alat yang
jamnya melenceng, atau yang menyimpan hasil selama jaringan terputus, akan
mengirim hasil lama sebagai hasil baru — dan selisih keduanya yang
menampakkannya.

---

## Pengaitan pasien

Bagian yang paling sering keliru. Hasil yang tiba tanpa identitas pasien
**tidak boleh ditebak**. Ia masuk antrean yang menunggu manusia mengaitkannya.

Tiga cara pengaitan, berurutan:

1. **Modality Worklist / order ID** — yang paling dapat dipercaya, sebab alatnya
   sendiri membawa nomor pesanannya.
2. **Pemindaian gelang pasien di sisi alat** — dapat dipercaya bila alatnya
   mendukung.
3. **Pengaitan manual oleh manusia** — dengan pencatatan siapa dan kapan.

Yang **tidak boleh**: mencocokkan berdasarkan nama, atau berdasarkan "pasien
yang sedang di ruangan itu". Keduanya akan benar sembilan puluh sembilan kali
dan salah sekali, dan yang sekali itu adalah hasil laboratorium orang lain di
rekam medis seseorang.

---

## Kalibrasi dan pemeliharaan

Hasil dari alat yang **kalibrasinya kedaluwarsa** ditandai. Tidak ditolak —
menolaknya akan menghentikan pelayanan pada alat yang mungkin masih benar —
tetapi ditandai, dan penandanya ikut ke laporan hasil.

Alat yang sedang dalam status `DOWNTIME` tidak menerima pesanan baru.
