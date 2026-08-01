# E13-0 · Kapabilitas Integrasi Nasional

Aturan utama dari prompt V13 §6 E13-9: **jangan mengarang endpoint**.

Audit ini karena itu memisahkan tiga hal yang berbeda: apa yang kita ketahui, apa yang
belum kita ketahui, dan apa yang tetap dapat dibangun sekarang tanpa mengetahui keduanya.

---

## 1. Yang diketahui

| Sistem | Pemilik | Status akses kita |
| --- | --- | --- |
| PDDikti / Neo Feeder | Kemdiktisaintek | Belum ada kredensial maupun dokumen kontrak di repo |
| SISTER | Kemdiktisaintek | Belum ada |
| Dapodik | Kemendikdasmen | Belum ada |
| EMIS | Kemenag | Belum ada |
| BAN-PT / LAM | Badan akreditasi | Instrumen berubah antarversi |

Tidak satu pun kredensial atau spesifikasi API resmi tersedia di repo ini, dan memang
tidak boleh ada — kredensial integrasi termasuk data sensitif (§222.1).

Preseden legacy (dokumen 01 §3.6): Feeder 62 class, SISTER 3 class. Rasio itu
memberi tahu bahwa Feeder adalah integrasi per-entitas yang berat, sedangkan SISTER
pada legacy hanya dasbor sinkronisasi. Perencanaan E13-9 tidak boleh menjanjikan
kedalaman yang setara untuk keduanya.

## 2. Yang dapat dibangun tanpa endpoint

Seluruh mesin di sekeliling integrasi tidak bergantung pada bentuk API-nya:

```text
EntityMapping        pemetaan id lokal ↔ id eksternal
StagingRecord        salinan yang akan dikirim, sebelum dikirim
ValidationIssue      hasil validasi lokal
SubmissionBatch      satuan pengiriman
SubmissionAttempt    percobaan, dengan request/response hash
ExternalReference    id yang dikembalikan pihak luar
Reconciliation       diff antara keadaan lokal dan keadaan mereka
CorrectionRequest    alur perbaikan
CapabilityMatrix     apa yang didukung adapter versi ini
```

Sembilan hal itu adalah pekerjaan sebenarnya. Panggilan HTTP-nya adalah bagian terkecil,
dan yang paling mudah diganti ketika kontrak resmi tersedia.

**Karena itu E13-9 dapat dimulai** tanpa menunggu akses: bangun mesinnya, sediakan
adapter tiruan yang dapat diuji, dan biarkan adapter sungguhan menyusul di balik
antarmuka yang sama.

## 3. Aturan yang tidak boleh dilanggar

### 3.1 Terkirim bukan berarti tercatat

> Data internal tidak langsung ditandai berhasil hanya karena request terkirim. (§202.1)

Status lokal berubah menjadi "tercatat di PDDikti" hanya setelah **rekonsiliasi**
membuktikannya — bukan setelah HTTP 200. Pelaporan nasional yang mengaku berhasil
padahal ditolak diam-diam adalah kegagalan yang baru ketahuan saat akreditasi.

### 3.2 Instrumen akreditasi versioned

BAN-PT dan LAM mengubah instrumen. `AccreditationInstrumentVersion` dan
`EvidenceRequirement` membuat bukti tidak terkunci pada satu format. Legacy memuat
47 class akreditasi dengan nama yang mengunci versi
(`LaporanAkreditasiLKPS_S1`, `LaporanDkps_2_1_1_KerjasamaPendidikan`) — bentuk yang
persis harus dihindari.

### 3.3 Regulasi berubah, schema tidak ikut ditulis ulang

SPMB diatur Permendikdasmen 3/2025; kurikulum sekolah Permendikbudristek 12/2024 jo.
Permendikdasmen 13/2025; standar proses Permendikdasmen 1/2026; mutu pendidikan tinggi
Permendiktisaintek 39/2025. Empat aturan, empat tanggal berbeda, dan semuanya baru.

Konsekuensi desain: jalur, kuota, afirmasi, dan aturan daerah menjadi **policy
versioned**, bukan kolom. Yang berubah tahun depan adalah isinya, bukan tabelnya.

### 3.4 Kredensial tidak pernah di Git

Vault, bukan `.env` yang ikut ter-commit. Aturan ini sudah berlaku di repo dan
berlaku penuh di sini.

## 4. Yang harus dikonfirmasi sebelum E13-9

| Pertanyaan | Kepada siapa |
| --- | --- |
| Apakah institusi pilot sudah punya akun Feeder/Dapodik/EMIS | Tenant pilot |
| Versi Neo Feeder yang dipakai institusi itu | Tenant pilot |
| Apakah integrasi berjalan lewat aplikasi desktop Feeder atau API langsung | Tenant pilot |
| Instrumen LAM mana yang berlaku bagi prodi mereka | Tenant pilot |

Empat pertanyaan itu menentukan bentuk adapter. Menjawabnya dengan asumsi berarti
membangun adapter untuk sistem yang tidak dipakai siapa pun.

## 5. Status

| Komponen | Status |
| --- | --- |
| Mesin staging/validation/submission/reconciliation | `MISSING` — dapat dibangun sekarang |
| Adapter PDDikti | `BLOCKED` — menunggu kontrak dan akses |
| Adapter SISTER | `BLOCKED` |
| Adapter Dapodik | `BLOCKED` |
| Adapter EMIS | `BLOCKED` |
| Instrumen akreditasi versioned | `MISSING` — dapat dibangun sekarang |
| Katalog regulasi | `MISSING` — dapat dibangun sekarang |

`BLOCKED` di sini berarti menunggu pihak luar, bukan menunggu pekerjaan kita.
