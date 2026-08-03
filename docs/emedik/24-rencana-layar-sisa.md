# 24 · Rencana Layar Sisa

**28 menu** belum berlayar. Daftar di bawah **dibaca dari basis data**, bukan
dari rencana lama — dan pembacaan itu memperlihatkan bahwa rencana lama keliru
urutannya.

Diperiksa ulang kapan saja dengan:

```sql
SELECT route, code FROM demo.menu
 WHERE module_code = 'HEALTH' AND deleted_at IS NULL AND is_coming_soon
 ORDER BY route;
```

---

## Koreksi terhadap rencana lama

Rencana pada [06](06-implementation-plan.md) menaruh **master data** sebagai
W-6. Itu keliru.

Pemeriksaan terakhir memperlihatkan **lima layar klinis masih hilang**, dan
seluruh API-nya sudah ada sejak H-2 sampai H-7. Itu kerja harian dokter dan
perawat — jauh lebih mendesak daripada master data yang dibuka sebulan sekali.

Yang paling mencolok: **`EncounterPage` sudah ada tetapi tidak terjangkau dari
menu mana pun.** Ia hanya dapat dibuka lewat `kunjungan/:id`, yang berarti
dokter tidak dapat membuka daftar kunjungannya sendiri — ia harus lewat layar
pendaftaran setiap kali.

---

## W-6 · Klinis yang terlewat — **lakukan ini dulu**

| Utas | Kode menu | API sejak | Catatan |
|---|---|---|---|
| `/app/emedik/rawat-jalan` | `HEALTH_ENCOUNTER` | H-3 | `EncounterPage` **sudah ada**; yang belum ada daftar kunjungannya |
| `/app/emedik/operasi` | `HEALTH_SURGERY` | H-7 | jadwal operasi, daftar periksa bedah, penghitungan kasa |
| `/app/emedik/intensif` | `HEALTH_ICU` | H-7 | papan ICU, skor perawatan intensif |
| `/app/emedik/pemberian` | `HEALTH_ADMINISTRATION` | H-4 | eMAR — enam benar pemberian obat |
| `/app/emedik/pasien/ganda` | `HEALTH_PATIENT_DUPLICATE` | H-2 | telaah pasien ganda, penggabungan |

**Jalan yang sudah ada dan sudah dipakai klien web:**
`healthApi.edBoard`, `markSeen`, `surgerySchedule`, `icuBoard`,
`icuAssessment`, `surgicalChecklist`, `surgicalCount`, `incision`,
`leaveTheatre`, `markSite`, `administer`, `skipAdministration`, `notDuplicate`.

Sebagian besar tipenya **sudah ada** pada `health-api.ts` (`BarisJadwalOperasi`,
`BarisPapanIcu`) — tetapi **tetap selidiki bentuknya ke peladen**; tipe lama
belum tentu masih cocok, dan belum satu pun diperiksa naskah bukti kontrak.

**Yang perlu diperhatikan pada layar ini:**

- **Daftar periksa bedah bukan formulir.** Ia diisi pada tiga saat berbeda —
  `SIGN_IN`, `TIME_OUT`, `SIGN_OUT` — dan yang belum lengkap harus terlihat
  belum lengkap. Daftar periksa yang dapat diselesaikan sekaligus di akhir
  operasi bukan daftar periksa.
- **Penghitungan kasa** menyelamatkan nyawa. Selisih hitungan harus menahan
  penutupan, bukan sekadar diperingatkan.
- **eMAR menuntut enam benar.** Yang dilewati (`OMITTED`) menuntut alasan.
- **Penggabungan pasien tidak dapat ditarik kembali** dengan mudah. Layar
  harus menunjukkan apa yang akan digabungkan **sebelum** tombolnya ditekan,
  dan `notDuplicate` harus semudah menggabungkan — yang sulit dibatalkan
  membuat orang menggabungkan yang ragu-ragu.

---

## W-7 · Master data dan terminologi (12 menu)

| Utas | Kode menu |
|---|---|
| `/app/emedik/layanan` | `HEALTH_SERVICE_CATALOG` |
| `/app/emedik/unit` | `HEALTH_SERVICE_UNIT` |
| `/app/emedik/pemberi-layanan` | `HEALTH_PROVIDER` |
| `/app/emedik/formularium` | `HEALTH_DRUG_MASTER` |
| `/app/emedik/lab/katalog` | `HEALTH_LAB_CATALOG` |
| `/app/emedik/penjamin` | `HEALTH_PAYER` |
| `/app/emedik/master-data` | `HEALTH_MASTER_DATA` |
| `/app/emedik/terminologi` | `HEALTH_TERMINOLOGY` |
| `/app/emedik/kfa` | `HEALTH_KFA_MAPPING` |
| `/app/emedik/pemetaan` | `HEALTH_CODE_MAPPING` |
| `/app/emedik/satusehat` | `HEALTH_SATUSEHAT` |
| `/app/emedik/satusehat-kemampuan` | `HEALTH_SATUSEHAT_CAPABILITY` |

Controller: `health-master-data.controller.ts`, `health-kfa.controller.ts`,
`health-satusehat.controller.ts`.

> **Perhatikan:** tidak ada `health-terminology.controller.ts`. Jalan
> `/health/terminology` berada di dalam `health-kfa.controller.ts` — diperiksa,
> bukan diandaikan.

**Yang perlu diperhatikan:**

- **SATUSEHAT hampir seluruhnya terhalang kredensial**, sama seperti BPJS pada
  W-3. Tiru `BpjsPage`: sebutkan penghalangnya apa adanya, dan sebutkan pula
  apa yang **tetap dapat dikerjakan** tanpanya.
- **Impor KFA punya tahap validasi terpisah dari penerapan.** Yang memvalidasi
  bukan yang menerapkan — itu aturan pemisahan wewenang yang sudah ada.
- **Kode lokal yang belum terpeta** ke terminologi resmi menahan interoperasi.
  Urutkan menurut yang paling sering muncul, seperti antrean pemetaan alat.

---

## W-8 · Portal, laporan, dan sisanya (11 menu)

| Utas | Kode menu | Catatan |
|---|---|---|
| `/app/emedik/akun-portal` | `HEALTH_PORTAL_ACCOUNT` | verifikasi identitas pemohon |
| `/app/emedik/pelepasan-hasil` | `HEALTH_PORTAL_RELEASE` | **pemisahan wewenang**: yang memverifikasi akun bukan yang melepas hasil |
| `/app/emedik/website` | `HEALTH_WEB_CONTENT` | konten publik fasilitas |
| `/app/emedik/data-contoh` | `HEALTH_SAMPLE_DATA` | pembersihan **menyembunyikan**, tidak menghapus |
| `/app/emedik/laporan` | `HEALTH_REPORT` | seluruhnya agregat; ekspor **selalu menolak** |
| `/app/emedik/akuntansi` | `HEALTH_ACCOUNTING_MAP` | terhalang kode peristiwa `HEALTH_*` dari Core |
| `/app/emedik/rekonsiliasi` | `HEALTH_CLAIM_RECON` | sisa W-3 |
| `/app/emedik/dasbor-investor` | `HEALTH_INVESTOR_DASHBOARD` | **investor tidak pernah melihat data pasien** |
| `/app/emedik/waterfall` | `HEALTH_INVESTOR_WATERFALL` | |
| `/app/emedik/zona-data` | `HEALTH_DATA_ZONE` | penggolongan medan, penyamaran |
| `/app/emedik/penjaga-ai` | `HEALTH_AI_GUARD` | permintaan yang **tidak** sampai ke gateway |

**Yang perlu diperhatikan:**

- **Layar investor menampilkan `_filtered`** — berapa medan dibuang penyaring
  daftar putih. Sudah dikerjakan pada `FeeContractPage`; tiru polanya.
- **Ekspor laporan selalu menolak**, dan penolakannya menyebutkan sebab dan
  jalan keluarnya. Jangan membuatnya tampak seperti tombol yang bekerja.
- **Data contoh: yang menyemai bukan yang membersihkan.** Nama aksinya
  `HARD_DELETE` sekalipun yang dilakukannya menyembunyikan — nama yang
  menenangkan akan membuat orang menekannya tanpa membaca layar konfirmasi.
- **Zona data dan penjaga AI** paling jarang dibuka, tetapi layar penjaga AI
  memperlihatkan sesuatu yang tidak terlihat di mana pun: petugas yang berkali-
  kali mencoba mengirim rekam medis ke model bahasa **tidak muncul sama sekali**
  pada log AI Gateway.

---

## Yang tidak akan pernah berlayar tanpa Core

- `/app/emedik/akuntansi` — menunggu kode peristiwa `HEALTH_*`. Layar dapat
  dibuat, tetapi penjurnalannya belum dapat diposting. Buat layarnya dengan
  penghalang yang **dinyatakan**, jangan menunggu.
- Pusat Bantuan, ekspor Excel, cetak PDF — kerangkanya tidak pernah dibangun.

---

## Sesudah W-8

Yang tersisa dari spesifikasi H-12 dan belum dapat dikerjakan:

> **Uji E2E, uji kinerja, dan UAT.**

Ketiganya menuntut layar, dan sekarang layarnya hampir lengkap. Sesudah W-8,
ketiganya menjadi mungkin untuk pertama kalinya — dan itu langkah berikutnya
yang sesungguhnya, bukan menambah modul.

Perhatikan bahwa `apps/web/e2e/` sudah punya pola sesi demo tanpa kredensial
(`startDemoSession`), tetapi peran `DEMO_USER` **belum punya satu pun hak
kesehatan**. Memberinya hak itu keputusan yang mengubah sandbox demo — putuskan
dengan sadar, jangan sebagai efek samping.
