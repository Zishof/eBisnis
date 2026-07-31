# H-0 · Rencana Implementasi

Dua belas fase pada perintah §5, dengan satu penyesuaian urutan yang beralasan,
dan penandaan jujur atas apa yang terhalang sejak sekarang.

---

## Penyesuaian urutan yang diusulkan

Perintah menempatkan identitas pasien di H-2, sesudah fasilitas di H-1. Urutan
itu benar untuk sebagian besar isinya, tetapi **tiga hal dari H-2 harus naik ke
H-1**:

```
Patient
MedicalRecordNumber
deteksi ganda
```

Alasannya: `Appointment` pada H-2 dan **setiap konteks sesudahnya** menunjuk
pasien. Membangun janji temu di atas identitas yang belum punya aturan
penggandaan berarti menumpuk janji temu, kunjungan, resep, dan hasil pada rekam
medis ganda. Membersihkannya kemudian menuntut penggabungan ribuan baris di
belasan tabel — dan setiap penggabungan yang salah adalah bahaya klinis.

Mencegahnya berbiaya beberapa hari. Memperbaikinya berbiaya berbulan-bulan, dan
sebagian tidak dapat diperbaiki.

Sisa H-2 (janji temu, pendaftaran, antrean) tetap di H-2.

---

## Fase

### H-1 · Fasilitas, portal, profil tenant, billing, **dan identitas pasien inti**

| Keluaran | Catatan |
|---|---|
| Migrasi `H001__health__facility.sql` | `health_tenant_profile`, `health_facility`, `health_facility_type`, unit layanan, poliklinik, bangsal, kamar, tempat tidur |
| Migrasi `H002__health__patient_identity.sql` | `patient`, `patient_identifier`, `medical_record_number`, `patient_name_history`, `patient_potential_duplicate` |
| Delapan port + adapter | `modules/emedik/ports/`, `modules/emedik/adapters/` |
| Katalog menu, peran, hak akses kesehatan | Berkas tersendiri; tidak menyentuh registri global |
| Jenjang tarif pendaftaran | Termasuk definisi tegas `BillablePatientRegistration` |
| Portal `emedik.id` | Pendaftaran fasilitas, pilih jenis, buat tenant |
| Uji | ≥ 20 |

**Yang harus benar sejak fase ini** (lihat [05](05-security-threat-model.md)):
pencatatan pembacaan, tujuan penggunaan, catatan tidak dapat diubah, penandaan
data sensitif tinggi. Keempatnya tidak dapat ditambahkan belakangan tanpa
membongkar.

### H-2 · Janji temu, pendaftaran, antrean

Sisa identitas pasien (`PatientConsent`, `PatientProxy`, `PatientMerge`,
`PatientFamilyLink`), lalu `Appointment`, `Schedule`, `ProviderAvailability`,
pendaftaran daring dan langsung, rujukan, antrean, dan pemantauan waktu tunggu.

Uji ≥ 40. Ini fase dengan uji terbanyak, dan memang seharusnya.

### H-3 · Rawat jalan, dokumentasi klinis, order

`OutpatientEncounter`, SOAP, tanda vital, masalah, diagnosis, tindakan, alergi,
peringatan klinis, `ClinicalOrder`, `OrderSet`, surat keterangan medis.

Uji ≥ 30. **Invarian:** catatan bertanda tangan tidak dapat diubah.

### H-4 · Farmasi, obat, adapter persediaan, billing

Resep, telaah apoteker, penyerahan, substitusi, obat terkendali, peringatan
interaksi dan alergi, rekonsiliasi obat, eMAR dengan enam benar.

Uji ≥ 35. **Integration request** untuk kode peristiwa akuntansi `HEALTH_*`.

### H-5 · Laboratorium, radiologi, hasil

Katalog, pesanan, spesimen, daftar kerja, hasil, rentang rujukan, **hasil kritis
dengan penerimaan wajib**, verifikasi, amandemen, laboratorium luar.

Uji ≥ 30. PACS/DICOM **terhalang** — memerlukan arsitektur penyimpanan.

### H-6 · Rawat inap, ADT, tempat tidur, keperawatan

Masuk, pindah, pulang, permintaan dan penetapan tempat tidur, ronde, rencana
asuhan, ringkasan pulang, pulang paksa, kematian, pembersihan tempat tidur;
seluruh asesmen dan intervensi keperawatan.

Uji ≥ 30. **Invarian:** satu tempat tidur, satu pasien, ditegakkan basis data.

### H-7 · IGD, operasi, ICU, layanan khusus

Triase, disposisi; permintaan dan jadwal operasi, daftar periksa bedah, catatan
operasi, anestesi, pemulihan; perawatan intensif; dialisis, onkologi,
rehabilitasi, gigi, kesehatan jiwa; kebidanan dan neonatal.

Uji ≥ 35.

### H-8 · Puskesmas dan Posyandu

UKP, UKM, wilayah kerja, folder keluarga, sasaran program, penyakit menular dan
tidak menular, KIA, imunisasi, gizi, kesehatan lingkungan dan sekolah, kunjungan
rumah; jadwal Posyandu, kader, meja layanan, pengukuran pertumbuhan, KMS
digital, risiko stunting.

Uji ≥ 30.

**Catatan yang perlu diingat saat merancang antarmukanya:** Posyandu dijalankan
kader — bukan tenaga medis — sering tanpa internet, dan sasarannya populasi,
bukan pasien yang datang. Antarmukanya tidak boleh sekadar versi kecil dari
layar rumah sakit.

### H-9 · Klaim, rekam medis, koding, mutu, keselamatan

Tangkap tagihan, tagihan pasien, deposit, penjamin, klaim, rekonsiliasi,
casemix, koding; kelengkapan rekam medis, pelepasan informasi, retensi,
penahanan hukum; indikator mutu, insiden keselamatan pasien, PPI, kredensial dan
kewenangan klinis.

Uji ≥ 30.

### H-10 · Portal pasien, website, integrasi

Website fasilitas, profil, dokter, jadwal, layanan; portal pasien dengan janji
temu, antrean, hasil yang boleh dibuka, resep, ringkasan kunjungan, akses wali.

Uji ≥ 25. **Invarian:** pasien hanya melihat datanya sendiri; identitas dari
token, tidak pernah dari parameter.

SATUSEHAT, BPJS, alat laboratorium, dan PACS dibangun sebagai antarmuka dengan
implementasi tiruan — kredensialnya belum ada, dan perintah §25 melarang
mengarangnya.

### H-11 · Peran, Help, data contoh, laporan

29 peran, data contoh 50–100 baris per jenis, laporan.

Uji ≥ 25. **Help terhalang** — kerangka Pusat Bantuan tidak pernah dibangun
(V8-1/V8-2). **Ekspor Excel dan cetak PDF terhalang** (V8-5/6, V8-7).

### H-12 · Keamanan, E2E, kinerja, UAT

Zona data kesehatan, tujuan penggunaan, break-glass, penyamaran medan, isolasi
antar-tenant dan antar-vertical, pola redaksi AI untuk data kesehatan.

Uji ≥ 40.

---

## Yang terhalang sejak sekarang

Disebutkan di muka, bukan ditemukan pada fasenya. Tidak satu pun menghentikan
eMedik; masing-masing menurunkan mutu pada bagiannya.

| Terhalang | Sebab | Akibat |
|---|---|---|
| Pusat Bantuan (H-11) | V8-1/V8-2 tidak pernah dibangun; tidak ada tabel bantuan | Panduan dalam aplikasi tidak ada |
| Ekspor Excel (H-11) | V8-5/6 tidak pernah dibangun | Laporan hanya di layar |
| Cetak PDF (H-9, H-11) | V8-7 tidak pernah dibangun | Ringkasan pulang dan hasil tidak dapat diunduh sebagai PDF |
| SATUSEHAT (H-10) | Kredensial dan kontrak belum ada | Antarmuka + tiruan |
| BPJS (H-9, H-10) | Sama | Klaim tidak dapat dikirim otomatis |
| PACS/DICOM (H-5) | Perlu arsitektur penyimpanan | Metadata saja |
| Alat laboratorium (H-5) | Protokol bergantung merek | Entri manual |

---

## Yang menunggu keputusan Core

| | Menghalangi | Jalan sementara |
|---|---|---|
| [IR 001](../integration-requests/health/001-health-namespace-collision.md) — nama `modules/health` | Tidak menghalangi | Memakai `modules/emedik/` |
| [IR 002](../integration-requests/health/002-modular-migration-catalog.md) — katalog migrasi modular | Tidak menghalangi | Awalan `H###`, `sequence` mulai 1000 |
| Kode peristiwa `HEALTH_*` (H-4) | Menghalangi posting akuntansi | Diajukan pada H-4 |

Keduanya yang pertama tidak menghentikan H-1. Menunggu jawaban sebelum mulai
akan menghentikan pekerjaan tanpa alasan teknis.
