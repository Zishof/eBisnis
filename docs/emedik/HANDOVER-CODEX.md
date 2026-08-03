# Serah-Terima — eMedik V12

**Untuk:** sesi lanjutan (Codex)
**Dari:** sesi Claude, 1 Agustus 2026
**Cabang:** `feature/v12-emedik` · **Worktree:** `C:\opt\eBisnisGithub-emedik`
**Commit terakhir:** `09d8c8b` — *feat(emedik): W-5 layar alat medis*

Worktree **bersih** dan seluruhnya sudah terdorong ke `origin`.

---

## 1. Baca dulu, berurutan

| Berkas | Isinya |
|---|---|
| **[22 — aturan tetap](22-aturan-tetap.md)** | Larangan yang tidak boleh dilanggar. **Baca ini sebelum menulis apa pun.** |
| **[23 — metode kerja layar](23-metode-kerja-layar.md)** | Urutan kerja tiap fase, dan cacat yang berulang. Tanpa ini, kekeliruan yang sama akan terulang. |
| **[24 — rencana layar sisa](24-rencana-layar-sisa.md)** | 28 menu yang belum berlayar, dikelompokkan menurut kemendesakan. |
| [06 — rencana implementasi](06-implementation-plan.md) | Riwayat lengkap H-1…H-12 dan W-1…W-5. |
| [07 — garis dasar pengujian](07-test-baseline.md) | Angka pengujian dan **pelajaran dari tiap cacat yang ditemukan**. |
| [08 — integration request](08-integration-requests.md) | Enam permintaan yang menunggu sesi Core. |

---

## 2. Keadaan sekarang

### Yang selesai

**API — seluruhnya.** H-1 sampai H-12, ditambah H-9A sampai H-9N. 2.506 uji
pada 72 berkas, seluruhnya lulus. Tiap fase punya naskah bukti sendiri yang
dijalankan lewat HTTP pada basis data sungguhan.

**Layar — lima fase.** W-1 Puskesmas, W-2 rekam medis, W-3 klaim/BPJS, W-4
tarif/jasa, W-5 alat medis. 151 uji web pada 10 berkas.

### Angka yang berlaku hari ini

```
menu kesehatan berlayar     45
menu masih "segera hadir"   28
uji API                     2.506  (72 berkas)
uji web                     151    (10 berkas, 116 di antaranya kesehatan)
bukti kontrak klien-peladen 40 pemeriksaan
migrasi tenant terakhir     H065
```

> **Catatan angka.** 45 menu berlayar tetapi daftar utas pada H065 berisi 44
> baris — dua menu berbagi utas `/app/emedik/tarif`. Bila angkanya tampak
> ganjil, itu sebabnya.

### Perintah untuk memastikan keadaan itu masih benar

```bash
cd C:/opt/eBisnisGithub-emedik/apps/api && npx jest
```

```bash
cd C:/opt/eBisnisGithub-emedik/apps/web && npx vitest run
```

```bash
cd C:/opt/eBisnisGithub-emedik/apps/api && node scripts/prove-web-contract.mjs
```

Naskah bukti kontrak **menuntut peladen hidup**. Bila mati:

```bash
cd C:/opt/eBisnisGithub-emedik/apps/api && npm run dev
```

---

## 3. Lingkungan

| Hal | Nilai |
|---|---|
| API pengembangan | `http://localhost:3200/api/v1` |
| Web pengembangan | `http://localhost:5173` (`npx vite` pada `apps/web`) |
| Basis data | PostgreSQL `localhost:5433`, skema tenant `demo` |
| **Port 3000** | **Milik proyek lain.** Jangan dipakai, jangan diarahkan ke sana. |
| CORS API | hanya `http://localhost:5173` — web harus di port itu |
| `apps/web/.env.local` | sudah menyetel `VITE_API_BASE_URL=http://localhost:3200/api/v1` |

Menerapkan migrasi tenant:

```bash
cd C:/opt/eBisnisGithub-emedik/apps/api && npm run migrate:tenants
```

Memeriksa tiap rute punya penanda hak akses (wajib sebelum commit):

```bash
cd C:/opt/eBisnisGithub-emedik/apps/api && npm run route:audit
```

---

## 4. Yang menunggu di luar jangkauan sesi ini

### Integration request yang belum dijawab Core

| No | Perkara | Dampak sekarang |
|---|---|---|
| [001](../integration-requests/health/001-health-namespace-collision.md) | `modules/health` sudah dipakai Core | Vertical memakai `modules/emedik/` |
| [002](../integration-requests/health/002-modular-migration-catalog.md) | Katalog migrasi modular | Memakai awalan `H###`, sequence 1000+ |
| [003](../integration-requests/health/003-enterprise-patient-index.md) | Indeks pasien lintas fasilitas | Disimpan pada skema tenant |
| [004](../integration-requests/health/004-r2-namespace-and-shared-ports.md) | Namespace R2 dan port bersama | Rute tetap `/health/**` |
| [005](../integration-requests/health/005-riwayat-migrasi-gagal-mengunci-versi.md) | **Migrasi GAGAL mengunci nomor versinya** | Nomor H055, H056, H064 hangus |
| [006](../integration-requests/health/006-pemulihan-sesi-melewati-dedupe-refresh.md) | Pemulihan sesi mencabut sesinya sendiri | Sesi web mati tiap muat ulang saat pengembangan |

**005 yang paling sering mengenai pekerjaan.** Migrasi yang gagal sekali tidak
dapat dipakai lagi nomornya — perbaikannya harus memakai nomor baru. Sudah
terjadi tiga kali (H055, H056, H064).

**006 mempersulit pemeriksaan di peramban.** Sesi tidak dapat dipulihkan pada
mode pengembangan, sehingga memeriksa layar dengan data sungguhan menuntut masuk
ulang tiap kali. Ini sebab utama naskah bukti kontrak dibangun.

### Yang tidak dapat dikerjakan tanpa Core

- **Kode peristiwa akuntansi `HEALTH_*`** — terbuka sejak H-4. Tanpa ini,
  penjurnalan otomatis dari transaksi kesehatan belum dapat diposting.
- **Pusat Bantuan (V8-1/V8-2), ekspor Excel (V8-5/V8-6), cetak PDF (V8-7)** —
  kerangkanya tidak pernah dibangun. `POST /health/sample/reports/:kode/export`
  sengaja **selalu menolak** dengan menyebutkan sebab dan jalan keluarnya.

### Yang masih dilaporkan "belum terbukti"

Naskah bukti kontrak melaporkan **2 jalan** yang tidak dapat diperiksa karena
tidak ada barisnya (`deficiencies`, `adapterMessages`). Angka itu **bukan
kelulusan** — ia daftar yang masih harus dilihat orang. Jangan hitung sebagai
lulus, dan jangan hapus laporannya.

---

## 5. Yang paling mudah salah bila tidak dibaca

Tiga hal ini menyebabkan sebagian besar cacat pada sesi ini. Rinciannya pada
[23 — metode kerja](23-metode-kerja-layar.md), tetapi ringkasnya:

1. **Jangan menebak nama medan.** Panggil peladennya, lihat jawabannya, baru
   tulis tipenya. Salah tebak di sini tidak menghasilkan galat kompilasi —
   ia menghasilkan halaman kosong.

2. **Uji komponen tidak membuktikan kontrak.** Perlengkapan yang ditulis penulis
   kodenya sendiri akan sepakat dengan kodenya yang keliru. Itu sudah terjadi:
   enam uji lulus atas halaman yang melempar TypeError di peramban.

3. **Uji yang membandingkan kode dengan dirinya sendiri membuktikan
   konsistensi, bukan kebenaran.** 73 uji katalog lulus sempurna sementara dua
   utas menunya berbeda dari basis data.

---

## 6. Langkah berikutnya yang disarankan

Buka [24 — rencana layar sisa](24-rencana-layar-sisa.md). Ringkasnya:

**W-6 sebaiknya BUKAN master data.** Rencana lama menaruh master data di W-6,
dan itu keliru — pemeriksaan terakhir memperlihatkan **lima layar klinis** masih
hilang, dan seluruh API-nya sudah ada sejak H-3 dan H-7:

```
/app/emedik/rawat-jalan   HEALTH_ENCOUNTER        API sejak H-3
/app/emedik/operasi       HEALTH_SURGERY          API sejak H-7
/app/emedik/intensif      HEALTH_ICU              API sejak H-7
/app/emedik/pemberian     HEALTH_ADMINISTRATION   API sejak H-4
/app/emedik/pasien/ganda  HEALTH_PATIENT_DUPLICATE API sejak H-2
```

`EncounterPage` sudah ada tetapi hanya terjangkau lewat `kunjungan/:id` — tidak
ada satu pun menu yang menuju ke sana. Dokter tidak dapat membuka daftar
kunjungannya sendiri.

Itu kerja harian, dan lebih mendesak daripada master data.
