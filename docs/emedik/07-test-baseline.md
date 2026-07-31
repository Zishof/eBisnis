# H-0 · Garis Dasar Pengujian

Dijalankan pada worktree `C:\opt\eBisnisGithub-emedik`, branch
`feature/v12-emedik`, sebelum satu baris kode kesehatan ditulis.

**Tanggal:** 31 Juli 2026 · **Titik tolak:** `main` @ `4f7ab88`

---

## Hasil

| Perintah | Hasil |
|---|---|
| `pnpm install --frozen-lockfile` | **berhasil** — `pnpm-lock.yaml` tidak berubah |
| `prisma generate` | **berhasil** |
| `tsc --noEmit` (API) | **bersih** |
| `tsc --noEmit` (web) | **bersih** |
| `eslint src --max-warnings=0` (API) | **bersih** |
| `eslint src --max-warnings=0` (web) | **bersih** |
| `jest` (API) | **45 suite, 1048 tes lulus** |
| `vitest` (web) | **4 berkas, 35 tes lulus** |

Tidak ada tes yang dilewati atau ditandai `.skip`.

## Catatan tentang angkanya

Angka ini **lebih rendah** daripada yang berjalan di worktree Core hari ini
(50 suite / 1209 tes). Bedanya bukan kemunduran: worktree eMedik bercabang dari
`main` @ `4f7ab88`, sedangkan Core sedang mengerjakan POS Web pada
`feature/pos-web-priority` yang belum masuk `main` dan sudah menambah 161 tes.

Dicatat di sini supaya sesudah `rebase` ke `main` kelak, kenaikan mendadak dari
1048 ke 1209 dikenali sebagai pekerjaan Core yang masuk — bukan sebagai tes
kesehatan yang tiba-tiba muncul.

## Cakupan pengujian kesehatan saat ini

**Nol**, dan memang seharusnya: tidak ada kode kesehatan di repositori ini.

## Sasaran per fase

Angka minimum yang diharapkan bertambah pada tiap fase. Disebutkan di muka agar
"fase selesai" tidak dapat berarti "kodenya ditulis".

| Fase | Tambahan tes minimum | Yang wajib diuji |
|---|---|---|
| H-1 | 20 | jenis fasilitas; hierarki unit layanan; profil tenant kesehatan; jenjang tarif pendaftaran; definisi `BillablePatientRegistration` beserta seluruh pengecualiannya |
| H-2 | 40 | penomoran rekam medis per fasilitas; identitas perusahaan lintas fasilitas; deteksi ganda; penggabungan terkendali; pembatalan penggabungan; riwayat nama; persetujuan; akses wali |
| H-3 | 30 | kunjungan rawat jalan; catatan bertanda tangan tidak dapat diubah; amandemen; peringatan alergi; status pesanan klinis |
| H-4 | 35 | resep; telaah apoteker; penyerahan; obat terkendali; peringatan interaksi; adapter persediaan; enam benar pada eMAR |
| H-5 | 30 | pesanan laboratorium; spesimen; hasil; rentang rujukan; **hasil kritis wajib diterima manusia**; verifikasi; amandemen |
| H-6 | 30 | masuk/pindah/pulang; **satu tempat tidur satu pasien**; rencana asuhan; serah terima |
| H-7 | 35 | triase; jadwal operasi; daftar periksa bedah; rekam anestesi; skor perawatan intensif |
| H-8 | 30 | folder keluarga; sasaran program; pengukuran pertumbuhan; KMS digital; risiko stunting; imunisasi |
| H-9 | 30 | tangkap tagihan; klaim; kodifikasi; kelengkapan rekam medis; penahanan hukum |
| H-10 | 25 | portal pasien; **pasien hanya melihat datanya sendiri**; akses wali; hasil yang boleh dibuka |
| H-11 | 25 | 29 peran; data contoh; penghapusan data contoh tidak melumpuhkan |
| H-12 | 40 | zona data kesehatan; tujuan penggunaan; break-glass; penyamaran medan; isolasi antar-tenant; isolasi antar-vertical |

Jumlah minimum H-1 sampai H-12: **370 pengujian baru**.

## Yang sudah tercapai

| Fase | Sasaran | Tercapai | Berkas |
|---|---|---|---|
| H-1 | 20 | 56 | `health-catalog.spec.ts` (23), `health-billing.spec.ts` (33) |
| H-2 | 40 | 42 | `health-patient-identity.spec.ts` |
| H-3 | 30 | 37 | `health-front-office.spec.ts` |
| H-4 | 35 | **60** | `health-medication.spec.ts` |

API keseluruhan: **1243** pengujian pada 50 berkas. Web: **54** pada 5 berkas,
19 di antaranya pada `health-api.spec.ts`.

### Naskah bukti

Pengujian unit tidak dapat membuktikan bahwa hak akses, migrasi, dan penjaga
basis data benar-benar terpasang — semuanya tetap lulus sekalipun tabelnya
kosong. Karena itu tiap fase ditutup naskah bukti lewat HTTP, memakai hak akses
sungguhan, pada basis data sungguhan:

| Fase | Naskah | Hasil |
|---|---|---|
| H-2/H-3 | `prove-health-flow-e2e.mjs` | [bukti-h2-h3-alur.txt](bukti-h2-h3-alur.txt) |
| H-3 | `prove-health-clinical.mjs` | [bukti-h3-klinis.txt](bukti-h3-klinis.txt) |
| H-4 | `prove-health-pharmacy.mjs` | 44 pemeriksaan, seluruhnya lulus — [bukti-h4-farmasi.txt](bukti-h4-farmasi.txt) |

Naskah H-4 menemukan dua cacat yang tidak tertangkap satu pun pengujian unit,
dan keduanya menyangkut keselamatan pasien:

1. **Pemilihan lot memakai FEFO polos.** Lot yang *sudah* kedaluwarsa berada di
   urutan paling depan, sehingga penyerahan yang sah pun ditolak dengan alasan
   kedaluwarsa — dan pada jalur yang tidak menyebut lot, obat kedaluwarsalah
   yang akan terpilih lebih dahulu. Aturan yang benar untuk barang dagangan
   ternyata berbahaya untuk obat.
2. **Catatan nyaris cedera ikut terhapus saat penolakan.** Pencatatannya berada
   di dalam transaksi yang kemudian dibatalkan oleh galat penolakannya sendiri.
   Kejadiannya terjadi, ditolak dengan benar di layar perawat, tetapi tidak
   meninggalkan jejak sama sekali — padahal justru catatan itulah yang paling
   berharga dalam keselamatan obat: ia menunjukkan celah sebelum ada yang
   terluka.

Naskah bukti H-4 dijalankan dengan **tiga pengguna berbeda** — dokter, apoteker,
perawat — masing-masing dengan hak akses sendiri. Dijalankan satu pengguna saja,
seluruh pemeriksaan pemisahan wewenangnya akan lulus tanpa membuktikan apa pun.

## Yang belum dapat diukur

- **Uji E2E.** `pnpm test:e2e` belum dijalankan pada garis dasar ini karena
  memerlukan API dan basis data hidup, dan belum ada alur kesehatan untuk diuji.
  Dimulai pada H-2 begitu pendaftaran pasien pertama berjalan.
- **Uji beban.** Tidak ada endpoint kesehatan untuk diukur.
- **Verifikasi migrasi.** Tidak ada migrasi kesehatan. Perlu diperhatikan bahwa
  basis data pengembangan **dipakai bersama** worktree Core; migrasi eMedik akan
  diterapkan ke skema tenant yang sama. Rincian dan risikonya pada
  [04 — kontrak integrasi](04-integration-contracts.md).
