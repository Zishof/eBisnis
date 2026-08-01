# D-0 · Rencana Pelaksanaan

Tiga belas tahap, D-0 sampai D-12. Dokumen ini menetapkan isinya, urutannya,
dan apa yang menahan apa.

---

## Urutan dan ketergantungan

```
D-0  Audit                              ← selesai
      │
D-1  Wilayah, profil, portal, domain    ← fondasi; semua bergantung padanya
      │
      ├── D-2 Penduduk & keluarga
      │      │
      │      ├── D-3 Aparatur & register  (pejabat adalah penduduk)
      │      │      │
      │      │      └── D-4 Layanan warga & surat   ← inti sistem
      │      │             │
      │      │             ├── D-5 Pengaduan & Musrenbang
      │      │             │      │
      │      │             │      └── D-6 Perencanaan & APBDes
      │      │             │             │
      │      │             │             └── D-7 Aset & bantuan
      │      │             │
      │      │             └── D-10 Situs & portal warga
      │      │
      │      └── D-8 BUMDes & UMKM        (dapat paralel)
      │
      └── D-9 Keamanan, bencana, lingkungan, tanah   (dapat paralel)

D-11 PPID, transparansi, laporan        ← membaca seluruhnya
D-12 Data contoh, Help, AI, E2E, UAT    ← menutup
```

**D-4 adalah inti.** Bila hanya satu tahap yang boleh selesai, itu D-4: layanan
warga dan surat adalah alasan sebuah desa memakai sistem seperti ini. Segala
yang lain menambah nilai; D-4 adalah nilainya.

---

## Isi tiap tahap

### D-1 — Wilayah, profil, portal, domain

| | |
|---|---|
| Migrasi | `local_government_unit`, `government_unit_type`, `village_profile`, `urban_village_profile`, `administrative_code`, `hamlet`, `neighborhood_rt`, `neighborhood_rw`, `boundary`, `geospatial_area`, `village_potential`, `village_indicator`, `village_domain` |
| Kunci | **`profile_type`** (`DESA` \| `KELURAHAN`) pada `local_government_unit`. Seluruh penegakan kelayakan bertumpu padanya |
| API | `GET/POST /village/units`, `/village/profile`, `/village/regions`, `/village/domains` |
| UI | Portal `info-desa.id`, wisaya pendaftaran, pengaturan wilayah |
| Uji | Kebocoran profil tingkat dasar: penyewa `KELURAHAN` tidak memperoleh `hamlet` |

### D-2 — Penduduk, keluarga, mutasi

| | |
|---|---|
| Migrasi | `resident`, `family`, `family_card`, `resident_status`, `birth`, `death`, `move_in`, `move_out`, `temporary_resident`, `vulnerable_resident`, `resident_document`, `resident_history`, `resident_duplicate` |
| Kunci | NIK **unik per penyewa**, bukan global. Deteksi ganda menandai, tidak menolak — NIK kembar bisa berarti kesalahan ketik, bisa berarti pemalsuan, dan sistem tidak boleh memutuskan yang mana |
| Kunci | Setiap perubahan data penduduk menghasilkan baris `resident_history`. Pertanyaan "kapan alamatnya berubah, dan siapa yang mengubahnya" adalah pertanyaan yang pasti muncul |
| API | `/village/residents`, `/village/families`, `/village/demographics/*` |
| Uji | Cakupan RT: Ketua RT hanya melihat warganya. **Diuji pada endpoint, bukan pada tampilan** |

### D-3 — Aparatur, register, peran

| | |
|---|---|
| Migrasi | `village_officer`, `appointment`, `term`, `bpd_member`, `committee`, `organization_structure`, `delegation`, sepuluh tabel register |
| Katalog | `village-role.catalog.ts` — 29 peran, masing-masing dengan kelayakannya |
| Kunci | `BPD` bertanda `DESA_ONLY`; tidak pernah disemai pada penyewa kelurahan |
| Kunci | Masa jabatan berakhir → hak akses ikut berakhir. Pejabat yang purnatugas tetapi aksesnya menyala adalah temuan audit yang menunggu |
| Uji | Kebocoran peran; berakhirnya masa jabatan mencabut akses |

### D-4 — Layanan warga, surat, antrean

| | |
|---|---|
| Migrasi | `citizen_service_catalog`, `citizen_service_request`, `service_requirement`, `request_document`, `service_verification`, `service_approval`, `letter_draft`, `letter_issuance`, `qr_verification`, `service_sla`, `queue`, `counter` |
| Kunci | Nomor surat memakai `SuratNumberService` yang sudah terbukti anti-kembar |
| Kunci | Cuplikan definisi alur disimpan pada permohonan — aturan tidak berubah di tengah jalan |
| Kunci | QR verifikasi: pihak ketiga dapat memeriksa keaslian surat tanpa masuk sistem, dan **tanpa melihat data pribadi di dalamnya** — halaman verifikasi hanya menyatakan sah/tidak sah beserta nomor dan tanggalnya |
| API | `/village/services/*`, `/village/requests/*`, `/village/queue/*` |
| Uji | Pemohon tidak dapat memproses permohonannya sendiri; SLA dihitung sejak berkas lengkap |

### D-5 — Pengaduan, aspirasi, Musrenbang

| | |
|---|---|
| Migrasi | `citizen_complaint`, `complaint_category`, `complaint_assignment`, `complaint_followup`, `aspiration`, `musrenbang`, `musrenbang_proposal`, `public_consultation`, `survey` |
| Kunci | Pengaduan **anonim** harus mungkin. Warga yang mengadukan perangkat desa tidak akan mengadu bila namanya terlihat |
| Kunci | Usulan Musrenbang yang diterima menjadi masukan RKPDes pada D-6 — tautan eksplisit, bukan penyalinan manual |
| Uji | Pengaduan anonim benar-benar tidak menyimpan identitas pelapor |

### D-6 — Perencanaan dan APBDes

| | |
|---|---|
| Migrasi | `rpjmdes`, `rkpdes`, `program`, `activity`, `sub_activity`, `apbdes`, `budget_version`, `budget_approval`, `budget_realization`, `cash_book`, `bank_book`, `tax_book`, `advance`, `lpj` |
| Kelayakan | Seluruhnya `DESA_ONLY`. Kelurahan memperoleh `kelurahan_activity_plan` yang lebih sederhana |
| Kunci | **Belanja melampaui pagu ditolak**, ditegakkan constraint basis data |
| Kunci | `COMMITTED` dan `REALIZED` dibedakan — pagu terpakai sejak diikat |
| Uji | Kebocoran profil: penyewa kelurahan tidak dapat memanggil endpoint APBDes sekalipun URL-nya ditebak |

### D-7 — Aset, pengadaan, bantuan

| | |
|---|---|
| Migrasi | `village_asset`, `asset_category`, `asset_borrowing`, `asset_maintenance`, `asset_disposal`, `procurement_plan`, `aid_program`, `eligibility_rule`, `candidate_beneficiary`, `beneficiary`, `aid_distribution` |
| Kunci | **AI hanya mengusulkan calon penerima.** Penetapan oleh manusia, tercatat siapa dan atas dasar apa |
| Kunci | Pemeriksaan ganda lintas program: satu warga tidak menerima bantuan sejenis dari dua jalur |
| Kunci | `eligibility_rule` sebagai pohon kondisi terstruktur — **tidak pernah** `eval`, `Function`, atau SQL bebas |
| Uji | Pengusul ≠ penyetuju; AI tidak dapat menetapkan penerima |

### D-8 — BUMDes, UMKM, wisata

Kontrak integrasi pada [04](04-health-cooperative-pos-contracts.md).
`BUMDes` `DESA_ONLY`; `UMKM` dan wisata `BOTH`.

### D-9 — Keamanan, bencana, lingkungan, pertanahan

Kunci: surat keterangan tanah wajib memuat pernyataan bahwa ia **bukan bukti
kepemilikan** dan tidak menggantikan sertifikat — di dalam suratnya sendiri,
bukan hanya di dokumentasi.

### D-10 — Situs, portal warga, kiosk, siaran

| | |
|---|---|
| Kunci | Situs publik **hanya membaca**. Tidak ada jalur tulis dari halaman tanpa autentikasi |
| Kunci | Portal warga: hanya diri dan keluarga; tidak ada pencarian warga lain |
| Kunci | Kiosk: sesi berakhir otomatis dan **menghapus jejak layar** — kiosk di balai desa dipakai bergantian |
| Kunci | Siaran WhatsApp/surel `BLOCKED` sampai ada kredensial |

### D-11 — PPID, transparansi, laporan

Kunci: agregat tidak dapat dibongkar menjadi perorangan. Ambang minimum
penyajian ditetapkan di sini dan berlaku bagi seluruh laporan publik.

### D-12 — Data contoh, Help, AI, E2E, UAT

| | |
|---|---|
| Data contoh | Sesuai spesifikasi §23; profil `DESA` dan `KELURAHAN` menghasilkan isi berbeda |
| Help | **`BLOCKED`** — V8-1/V8-2 tidak pernah dibangun |
| AI | Delapan keperluan spesifikasi §24 |
| E2E | Alur warga mengajukan surat sampai terbit; kebocoran profil |
| Uji ketergantungan | Memindai `modules/village/` untuk impor lintas vertikal |

---

## Yang terhalang, dan akibatnya

Tiga penghalang, seluruhnya warisan V8 yang tidak pernah dibangun. Disebutkan
sekarang supaya tidak terlihat seperti kelalaian kemudian:

| Penghalang | Akibat bagi village | Apakah menghentikan? |
|---|---|---|
| **Pusat Bantuan (V8-1/V8-2)** | D-12 tidak dapat menyediakan Help dalam aplikasi | Tidak. Sistem tetap dipakai |
| **Ekspor Excel (V8-5/6)** | Laporan hanya tampil di layar | Tidak, tetapi mengganggu — laporan desa sering diminta dalam bentuk berkas |
| **Cetak PDF (V8-7)** | **Surat tidak dapat diunduh sebagai PDF** | **Ini yang paling menyakitkan** |

Penghalang ketiga perlu ditegaskan: surat keterangan yang tidak dapat dicetak
adalah surat yang tidak berguna. Warga datang ke kantor desa untuk memperoleh
kertas.

Rencana sementara: surat dirender sebagai HTML siap cetak yang dapat dicetak
peramban — pendekatan yang sudah dipakai halaman Proposal/PKS/Penawaran pada
Core dan bekerja baik. Bukan pengganti PDF bertanda tangan digital, tetapi
cukup untuk dipakai. Integration request akan diajukan bila D-4 memerlukan
lebih.

---

## Yang dijaga di setiap tahap

Sesuai perintah §5, setiap tahap wajib membawa: migrasi modular, model, layanan,
API, UI, hak akses, audit, Help, uji, dokumen, changelog modular, commit, push.

Ditambah tiga hal khusus vertikal ini:

1. **Setiap fitur menyatakan kelayakan profilnya.** Tidak ada yang lolos tanpa
   `DESA_ONLY` / `KELURAHAN_ONLY` / `BOTH` / `CONFIGURABLE`.
2. **Uji kebocoran profil pada endpoint**, bukan pada menu.
3. **Tidak ada akses tabel lintas vertikal.** Dijaga uji ketergantungan.
