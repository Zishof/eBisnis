# 09 · Matriks Kemampuan SATUSEHAT

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026
**Perintah:** `PERINTAH_CLAUDE_CODE_EKSEKUSI_PARALEL_V12_R2_EMEDIK.md` §5

---

## Kesimpulan lebih dahulu

**Tidak satu pun kemampuan SATUSEHAT dapat diaktifkan hari ini.** Seluruhnya
terhalang pada satu hal yang sama: kami tidak memiliki kredensial, dokumentasi
versi yang terikat, maupun akses sandbox.

Perintah R2 §5 menyebutnya tegas: *"Jangan mengarang endpoint/payload."*
Dokumen ini ada supaya penghalang itu tercatat sebagai keputusan, bukan
tertinggal sebagai kelalaian — dan supaya tidak ada yang kelak menulis adapter
berdasarkan tebakan lalu menyangka ia berfungsi.

---

## Apa yang boleh dibangun tanpa kredensial

Yang boleh dibangun adalah **kerangka yang menolak berjalan sampai kemampuannya
diverifikasi**, bukan adapter yang berpura-pura bekerja.

| Boleh dibangun sekarang | Alasan |
|---|---|
| `SatusehatEnvironment` — pendaftaran lingkungan (sandbox/produksi) | Tidak menuntut endpoint; ia catatan konfigurasi |
| `SatusehatCredentialReference` — **rujukan** ke brankas, bukan rahasianya | Rahasia tidak pernah masuk basis data; lihat `HealthSecretVaultPort` |
| `SatusehatCapability` — daftar kemampuan beserta status verifikasinya | Inilah gerbangnya: adapter menolak berjalan bila kemampuannya belum `VERIFIED` |
| `SatusehatResourceMapping` — pemetaan entitas lokal ke jenis sumber daya FHIR | Pemetaannya milik kami; bentuk payload-nya bukan |
| `SatusehatTransaction`, `SatusehatAttempt`, `SatusehatError` | Jejak percobaan; berguna sejak percobaan pertama |
| `SatusehatReconciliation` | Pembandingan jumlah kirim vs jumlah diterima |

| **Tidak boleh dibangun sekarang** | Alasan |
|---|---|
| Payload FHIR yang sebenarnya | Bentuk dan profilnya harus dari dokumentasi resmi berversi, bukan ingatan |
| Alur OAuth dan pertukaran token | Bentuk permintaannya harus diverifikasi terhadap sandbox |
| Jalur pengiriman otomatis | Mengirim data pasien ke sistem nasional berdasarkan tebakan adalah kebocoran, bukan integrasi |

---

## Matriks kemampuan

Status memakai empat nilai. **`VERIFIED` hanya boleh diberikan manusia yang
sudah menjalankan panggilannya terhadap sandbox** — tidak boleh diberikan
program, dan tidak boleh diberikan berdasarkan dokumentasi saja.

| Sumber daya FHIR | Dipakai untuk | Status | Penghalang |
|---|---|---|---|
| `Organization` | Pendaftaran fasilitas | `BLOCKED` | Kredensial, ID organisasi resmi |
| `Location` | Unit layanan, bangsal | `BLOCKED` | Bergantung `Organization` |
| `Practitioner` | Pemberi layanan | `BLOCKED` | Kredensial; NIK tenaga kesehatan |
| `PractitionerRole` | Kewenangan klinis | `BLOCKED` | Bergantung `Practitioner` |
| `Patient` | Identitas pasien | `BLOCKED` | Kredensial; aturan pencocokan NIK |
| `Encounter` | Kunjungan | `BLOCKED` | Bergantung `Patient`, `Location` |
| `Condition` | Diagnosis | `BLOCKED` | Terminologi ICD-10 berversi |
| `Procedure` | Tindakan | `BLOCKED` | Terminologi ICD-9-CM berversi |
| `Observation` | Tanda vital, hasil lab | `BLOCKED` | Terminologi LOINC |
| `ServiceRequest` | Pesanan klinis | `BLOCKED` | Bergantung `Encounter` |
| `Specimen` | Spesimen | `BLOCKED` | Bergantung `ServiceRequest` |
| `DiagnosticReport` | Laporan lab/radiologi | `BLOCKED` | Bergantung `Observation` |
| `ImagingStudy` | Studi citra | `BLOCKED` | Bergantung PACS; lihat [14](14-device-integration-map.md) |
| `Medication` | Obat | `BLOCKED` | **KFA** — lihat [17](17-master-data-source-map.md) |
| `MedicationRequest` | Resep | `BLOCKED` | Bergantung `Medication` |
| `MedicationDispense` | Penyerahan | `BLOCKED` | Bergantung `Medication` |
| `MedicationAdministration` | Pemberian obat | `BLOCKED` | Bergantung `Medication` |
| `AllergyIntolerance` | Alergi | `BLOCKED` | Terminologi alergen |
| `CarePlan` | Rencana asuhan | `BLOCKED` | Belum ada model asuhan berencana |
| `Claim` | Klaim, bila diwajibkan | `BLOCKED` | Lihat [10](10-bpjs-jkn-capability-matrix.md) |

---

## Yang sudah ada di sisi kami

Yang menggembirakan: **sebagian besar data sumbernya sudah ada.** H-1 sampai
H-8 sudah membangun pasien, kunjungan, diagnosis, tindakan, tanda vital, resep,
penyerahan, pemberian obat, alergi, spesimen, dan hasil laboratorium.

Artinya penghalangnya benar-benar hanya pada lapisan pertukaran — bukan pada
ketiadaan data. Ketika kredensial tersedia, yang perlu dibangun adalah pemetaan
dan pengiriman, bukan pengumpulan datanya.

| Sumber daya FHIR | Tabel kami | Fase |
|---|---|---|
| `Patient` | `patient`, `patient_identifier` | H-2 |
| `Encounter` | `health_encounter` | H-3 |
| `Condition` | `health_diagnosis` | H-3 |
| `Observation` | `health_vital_sign`, `lab_result` | H-3, H-5 |
| `ServiceRequest` | `health_clinical_order`, `lab_order` | H-3, H-5 |
| `Specimen` | `lab_specimen` | H-5 |
| `DiagnosticReport` | `lab_result` | H-5 |
| `MedicationRequest` | `rx_prescription`, `rx_prescription_line` | H-4 |
| `MedicationDispense` | `rx_dispensing` | H-4 |
| `MedicationAdministration` | `rx_administration` | H-4 |
| `AllergyIntolerance` | `patient_allergy` | H-3 |
| `Location` | `health_service_unit`, `health_room`, `health_bed` | H-1, H-6 |
| `Practitioner` | `health_provider` | H-1 |

---

## Aturan yang tidak boleh dilanggar

1. **Rahasia tidak pernah masuk basis data tenant.** Yang disimpan adalah
   rujukan ke brankas (`HealthSecretVaultPort`). Administrator yang menyimpan
   kredensial tidak dapat membacanya kembali — lihat addendum §F.

2. **Adapter menolak berjalan bila kemampuannya belum `VERIFIED`.** Bukan
   memperingatkan; menolak. Adapter yang berjalan dengan tebakan akan
   mengirimkan data pasien ke tempat yang salah, dan pengiriman itu tidak dapat
   ditarik kembali.

3. **Pengiriman idempoten.** Percobaan ulang karena jaringan terputus tidak
   boleh menghasilkan dua sumber daya di sistem nasional. Kunci idempotensinya
   disimpan pada `SatusehatTransaction`.

4. **Rekonsiliasi wajib.** Yang terkirim dibandingkan dengan yang tercatat
   diterima. Tanpa itu, "sudah dikirim" hanya berarti "sudah kami coba".

---

## Yang dibutuhkan sebelum status berubah

```text
kredensial klien untuk lingkungan sandbox
dokumentasi profil FHIR berversi, bukan ringkasan
ID organisasi resmi fasilitas
peta terminologi (ICD-10, ICD-9-CM, LOINC, KFA)
akses sandbox yang benar-benar dapat dipanggil
catatan hasil UAT yang ditandatangani
```

Sampai keenamnya ada, status seluruh baris di atas tetap `BLOCKED`, dan itulah
jawaban yang benar.
