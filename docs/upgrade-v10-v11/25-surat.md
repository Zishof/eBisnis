# V10-6 — Tata Kelola Surat

Status: **SELESAI** (backend)
Sumber legacy: `C:\opt\AIS\ais\src\main\src\ais\...\surat\` — 26 berkas action,
28 berkas model.

---

## 1. Pemetaan dari sistem lama

| Sistem lama | Di sini | Perubahan |
|---|---|---|
| `KelompokNomorSurat` | `surat_number_group` | — |
| `NomorSurat` | `surat_number_scheme` | `contohFormat` → **pola yang ditegakkan** |
| `SifatSurat` | `surat_nature` | ditambah `urgency_rank` |
| `LokerSurat` | `surat_locker` | — |
| `MasaBerlakuSurat` | `surat_retention_period` | ditambah `is_permanent` |
| `KopSurat` | `surat_letterhead` | — |
| `KlasifikasiSuratMasuk` + `KlasifikasiSuratKeluar` | `surat_classification` | **satu tabel, dua arah** |
| `AlurPersetujuanSuratMasuk/Keluar` | `surat_approval_flow` + `_step` | **pohon → daftar berurut** |
| `SuratMasuk` | `surat_incoming` | — |
| `SuratKeluar` | `surat_keluar` → `surat_outgoing` | nomor menyusul setelah disetujui |
| — | `surat_disposition` | disposisi berantai |
| — | `surat_approval` | satu baris per langkah yang dilalui |
| — | `surat_number_counter` | **baru** — lihat bagian 3 |

Kolom `Jurusan`/`Fakultas`/`Yayasan`/`Sekolah`/`SatuanKerja` pada sistem lama
tidak dibawa: itu penjenjangan organisasi kampus. Padanannya di sini adalah data
scope yang sudah ada sejak V8-R1b, dan menduplikasinya sebagai kolom akan
membuat dua mekanisme pembatasan yang dapat saling bertentangan.

---

## 2. Tiga keputusan yang sengaja berbeda dari sistem lama

### 2.1 Pola yang ditegakkan, bukan contoh

Sistem lama menyimpan `contohFormat` — sebuah **contoh**. Contoh tidak dapat
dieksekusi: dua orang yang membaca contoh yang sama tetap dapat menuliskan nomor
yang berbeda, dan mesin tidak dapat memeriksanya sama sekali.

Di sini polanya nyata, dengan penanda tertutup:

| Penanda | Isi |
|---|---|
| `{NOMOR}` | Nomor urut, dipadkan |
| `{TAHUN}` / `{TAHUN2}` | Tahun empat / dua angka |
| `{BULAN}` / `{BULAN_ROMAWI}` | Bulan angka / Romawi |
| `{KODE_KLASIFIKASI}` | Kode klasifikasi |
| `{KODE_UNIT}` | Kode unit organisasi |

Penanda di luar daftar **ditolak**, bukan dibiarkan menjadi teks apa adanya:
penanda salah ketik yang lolos akan menghasilkan nomor surat resmi yang memuat
`{TAHNU}` — dan nomor itu sudah terlanjur keluar sebelum ada yang menyadarinya.
Pesan penolakan menyebutkan seluruh penanda yang salah sekaligus beserta daftar
yang tersedia.

Pemeriksaan dijalankan **saat skema disimpan**, bukan saat surat diterbitkan.
Menolak pola yang salah pada saat penerbitan berarti menghentikan pekerjaan
orang yang sedang menunggu nomornya.

Penanda tanpa nilai menjadi **kosong**, bukan `"undefined"`.

### 2.2 Penghitung sebagai baris, bukan `MAX(nomor) + 1`

Sistem lama punya `SinkronNomorSuratHelper` — sebuah penolong untuk
**menyelaraskan** nomor. Penolong seperti itu hanya dibutuhkan bila nomornya
pernah tidak selaras, dan nomor surat resmi yang kembar adalah cacat yang
terbawa ke luar organisasi: dua surat berbeda dengan nomor sama tidak dapat
dibedakan lagi oleh penerimanya, dan kesalahannya tidak dapat diperbaiki setelah
suratnya dikirim.

`MAX(nomor) + 1` tidak dapat mencegahnya. Dua permintaan bersamaan membaca `MAX`
yang sama lalu menuliskan nomor yang sama, dan tidak ada cara menutup celah itu
tanpa mengunci seluruh tabel surat.

Di sini penghitungnya baris tersendiri berkunci unik `(scheme_id, period_key)`.
Kenaikannya satu pernyataan `UPDATE ... RETURNING`, yang mengunci hanya satu
baris. Dua permintaan bersamaan karena itu menerima dua angka berbeda.

**Dibuktikan**: 20 surat diterbitkan serentak lewat `Promise.all` menghasilkan
20 nomor berbeda, berurut tanpa lubang.

### 2.3 Alur berurut, bukan pohon

Sistem lama menyimpan alur sebagai pohon (`parent`, `deep`). Bentuk itu
ditinggalkan karena persetujuan surat berjalan **berurutan**, bukan bercabang.
Pohon membolehkan bentuk yang tidak punya arti — dua anak pada kedalaman sama
berarti dua penyetuju sejajar, dan sistem lama tidak punya cara menyatakan
apakah keduanya harus setuju atau cukup salah satu. Bentuk yang membolehkan
keadaan tanpa arti akan menghasilkan keadaan tanpa arti.

Percabangan yang benar-benar dibutuhkan dinyatakan lewat `approver_mode` pada
satu langkah: `ANY` cukup satu dari beberapa jabatan, `ALL` seluruhnya.

Langkah menunjuk **peran**, bukan orang: orang berganti jabatan, dan alur yang
menunjuk orang akan berhenti bekerja pada hari orang itu pindah.

---

## 3. Nomor keluar setelah persetujuan, bukan saat konsep

Konsep surat **tidak bernomor**. Nomor resmi baru diambil pada
`POST /surat/keluar/:id/terbitkan`, setelah seluruh langkah alur disetujui.

Alasannya: nomor yang sudah keluar tidak dapat ditarik kembali. Konsep yang
batal akan meninggalkan lubang pada penomoran yang tidak dapat dijelaskan saat
diaudit — dan lubang pada nomor surat resmi menimbulkan pertanyaan yang tidak
punya jawaban baik.

Karena itu pula **pratinjau dibedakan tegas dari pengambilan**. Pratinjau yang
diam-diam mengambil nomor akan meninggalkan lubang setiap kali seseorang membuka
formulir lalu membatalkannya. Jawabannya ditandai `isPreview: true`.

### 3.1 Idempotensi mendahului pemeriksaan status

Menerbitkan surat yang sudah bernomor mengembalikan **nomor yang sama**, bukan
mengambil nomor kedua.

Urutannya penting dan sempat salah saat dikerjakan: surat yang sudah terbit
berstatus `DITERBITKAN`, dan `DITERBITKAN -> DITERBITKAN` bukan perpindahan yang
sah. Diperiksa dengan urutan terbalik, permintaan ulang ditolak alih-alih
menjawab nomor yang sudah ada — dan pemanggil yang koneksinya terputus tepat
sebelum menerima jawaban tidak punya cara mengetahui nomor suratnya sendiri.
Ditemukan oleh skrip bukti.

---

## 4. Batasan yang ditegakkan basis data

Aturan penting tidak hanya diperiksa aplikasi, tetapi juga menjadi batasan
skema — sehingga keadaan salah **tidak dapat tersimpan**, bukan sekadar tidak
seharusnya terjadi:

| Batasan | Menjamin |
|---|---|
| `ck_surat_scheme_has_number` | Pola wajib memuat `{NOMOR}` |
| `ck_surat_outgoing_issued_has_number` | Surat `DITERBITKAN` wajib bernomor |
| `uq_surat_outgoing_number` (parsial) | Nomor resmi tidak kembar |
| `ck_surat_approval_reason` | Penolakan/pengembalian wajib beralasan ≥ 5 huruf |
| `ck_surat_disposition_target` | Disposisi wajib punya tujuan |
| `uq_surat_approval_pending` | Satu langkah, satu keputusan menunggu |
| `ck_surat_classification_out_needs_scheme` | Klasifikasi keluar wajib punya skema nomor |
| `ck_surat_retention_permanent` | Arsip permanen tidak punya masa simpan |

---

## 5. Mesin status

Tabel perpindahan pada `surat-state.ts` — bukan rangkaian `if` yang tersebar di
controller, yang akan berbeda antar tempat begitu satu status baru ditambahkan.

Yang sengaja **tidak** ada:

- **`DITERBITKAN -> KONSEP`.** Surat yang sudah bernomor dan keluar tidak dapat
  kembali menjadi konsep. Yang benar adalah membuat surat baru yang
  menggantikannya (`supersedes_outgoing_id`), sehingga keduanya tetap tercatat.
  Menyunting surat yang sudah keluar berarti riwayatnya berbohong.
- **`DIBATALKAN -> apa pun`** dan **`DIARSIPKAN -> apa pun`** — keduanya akhir.

Diuji: satu-satunya jalan menuju `DITERBITKAN` adalah lewat `DISETUJUI`, dan
setiap status yang belum akhir punya jalan keluar (status buntu berarti surat
yang tidak dapat diapa-apakan lagi).

### 5.1 Penyelesaian lebih awal harus dinyatakan

`enforce_all_steps: false` saja tidak cukup untuk melewatkan langkah. Penyetuju
harus menyatakan `finalize: true`.

Niat menyelesaikan lebih awal harus dinyatakan terpisah dari keputusan
menyetujui: seorang direktur yang menyetujui langkah kedua dari lima belum tentu
bermaksud melewatkan tiga langkah sisanya, dan menebakkan maksud itu dari
keputusan "setuju" akan melewatkan penyetuju yang seharusnya ikut membaca.

---

## 6. Menu dan izin

Root menu tersendiri (`SURAT`, sortOrder 26), bukan cabang di bawah `ADMIN`.
Katalog role menunjuk **modul** (kode menu root); menempatkan surat di bawah
`ADMIN` akan membuat setiap administrator sistem otomatis berhak menyetujui
surat resmi — dan menyetujui surat adalah wewenang jabatan, bukan wewenang
teknis.

Delapan submenu: Surat Masuk, Surat Keluar, Disposisi Saya, Arsip Surat,
Klasifikasi, Skema Penomoran, Alur Persetujuan, Loker Arsip. Katalog menu naik
dari 124 menjadi 133.

---

## 7. Endpoint

| Method | Jalur | Izin |
|---|---|---|
| POST | `/surat/masuk` | `SURAT_MASUK.CREATE` |
| POST | `/surat/masuk/:id/disposisi` | `SURAT_MASUK.UPDATE` |
| POST | `/surat/keluar` | `SURAT_KELUAR.CREATE` |
| GET | `/surat/keluar/:id` | `SURAT_KELUAR.READ` |
| POST | `/surat/keluar/:id/ajukan` | `SURAT_KELUAR.UPDATE` |
| POST | `/surat/keluar/:id/putuskan` | `SURAT_KELUAR.APPROVE` |
| POST | `/surat/keluar/:id/terbitkan` | `SURAT_KELUAR.APPROVE` |
| GET | `/surat/keluar/antrian/persetujuan` | `SURAT_KELUAR.APPROVE` |
| POST | `/surat/penomoran/periksa-pola` | `SURAT_PENOMORAN.UPDATE` |
| GET | `/surat/penomoran/:schemeId/pratinjau` | `SURAT_PENOMORAN.READ` |

---

## 8. Bukti

Skrip: `apps/api/scripts/prove-v10-6-surat.mjs`
Keluaran: `docs/upgrade-v10-v11/bukti-v10-6-surat.txt`

Delapan bagian, seluruhnya lulus. Yang terpenting:

- **Bagian 4** — 20 surat diterbitkan **serentak**; 20 nomor berbeda, berurut
  tanpa lubang, dan basis data tidak memuat satu pun nomor kembar.
- **Bagian 3** — konsep tidak dapat langsung diterbitkan; alur wajib tidak dapat
  dipotong di tengah; penolakan tanpa alasan ditolak; penerbitan ulang
  mengembalikan nomor yang sama.
- **Bagian 5** — dua pratinjau berturut-turut menghasilkan angka yang sama dan
  penghitungnya tidak bergerak.
- **Bagian 6** — dua surat masuk dengan nomor pengirim **sama persis** keduanya
  diterima, dengan nomor agenda internal yang berbeda.

Uji unit: `number-pattern.spec.ts` (20 uji), `surat-state.spec.ts` (23 uji).

---

## 9. Yang belum dikerjakan

- **UI belum ada.** Seluruh endpoint lengkap dan teruji; halaman surat masuk,
  surat keluar, disposisi, dan master dikerjakan pada V10-8.
- **CRUD master surat lewat API belum ada.** Klasifikasi, skema penomoran, alur,
  loker, dan sifat surat saat ini hanya dapat diisi lewat basis data atau seed.
  Endpoint CRUD-nya mengikuti pola `MasterController` yang sudah ada dan
  dikerjakan bersama UI-nya.
- **Template surat belum dirender.** Kolom `template_body` tersimpan dan
  disalin ke konsep, tetapi penggantian variabel (`VariableSuratKeluar` pada
  sistem lama) belum dikerjakan. Ini menuntut mesin templat tersendiri dan
  keputusan tentang variabel apa saja yang boleh dirujuk — daftar yang terbuka
  akan menjadi jalan membaca data yang tidak seharusnya terbaca.
- **Pratinjau nomor belum menerima kode klasifikasi**, sehingga
  `{KODE_KLASIFIKASI}` tampil kosong pada pratinjau. Nomor sebenarnya tetap
  benar karena penerbitan mengambil kodenya dari klasifikasi surat.
- **Eskalasi SLA belum berjalan.** `due_at` dihitung dan tersimpan, tetapi belum
  ada pekerjaan terjadwal yang menaikkan eskalasi saat terlampaui. Dikerjakan
  bersama V10-7 (Notification Hub), karena eskalasi tanpa pemberitahuan tidak
  sampai kepada siapa pun.
- **Delegasi belum ada.** Penyetuju yang sedang cuti belum dapat melimpahkan
  wewenangnya.
