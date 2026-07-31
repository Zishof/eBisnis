# K-0 · Garis Dasar Pengujian

Dijalankan pada worktree `C:\opt\eBisnisGithub-ekoperasi` sebelum satu baris
kode koperasi ditulis. Angka di bawah adalah titik acuan: setiap fase K-1 sampai
K-11 harus menambah, tidak pernah mengurangi.

**Tanggal:** 31 Juli 2026 · **Titik tolak:** `origin/main` @ `4f7ab88`

---

## Hasil

| Perintah | Hasil | Waktu |
|---|---|---|
| `pnpm install --frozen-lockfile` | **berhasil** | 8 m 19 s |
| `prisma generate` | **berhasil** | — |
| `tsc --noEmit` (API) | **bersih** | — |
| `jest` (API) | **45 suite, 1048 tes lulus** | 9,3 s |

Tidak ada tes yang dilewati maupun ditandai `.skip`.

Catatan: worktree baru tidak berbagi `node_modules` dengan worktree induk,
sehingga `pnpm install` wajib dijalankan sekali. Lockfile tidak berubah —
`--frozen-lockfile` berhasil, yang membuktikan tidak ada dependensi yang
tergeser.

---

## Cakupan pengujian koperasi saat ini

**Nol.** Tidak ada berkas pengujian yang menyentuh domain koperasi. Pencarian
`cooperative`, `member`, `saving`, `loan`, `shu` pada seluruh `*.spec.ts` tidak
menghasilkan apa pun yang berkaitan.

Yang terdekat, dan berguna sebagai contoh pola:

| Berkas | Yang diuji | Nilainya bagi koperasi |
|---|---|---|
| `modules/pos/pos-sale-state.spec.ts` | Mesin transisi 13 status | **Pola utama.** Aturan sebagai tabel, diuji tanpa basis data. Keanggotaan, pinjaman, dan RAT akan memakai bentuk yang sama |
| `modules/pos/pos-stock.spec.ts` | Aturan ketersediaan sebagai fungsi murni | Pola pemisahan aturan dari basis data |
| `modules/accounting/posting-engine.spec.ts` | Kelengkapan kode peristiwa | **Wajib ditiru.** Memaksa setiap kode punya aturan posting dan nilai wajib |
| `modules/return/return-rules.spec.ts` | Kelayakan dan perhitungan refund | Pola perhitungan uang yang diuji sampai ke pembulatannya |
| `master-seed/seed-kind.spec.ts` | Data acuan tidak ikut terhapus | Data contoh koperasi harus lulus uji sejenis |

---

## Sasaran per fase

Minimum yang wajib bertambah, supaya "selesai" tidak berarti sekadar "kodenya
ditulis":

| Fase | Uji baru | Yang wajib dibuktikan |
|---|---|---|
| K-1 | 15 | jenis koperasi sah; satu koperasi per tenant; masa berlaku izin; slug domain unik |
| K-2 | 30 | **calon anggota bukan anggota sebelum simpanan pokok lunas**; jabatan tidak tumpang tindih; nomor anggota tidak kembar di bawah permintaan bersamaan |
| K-3 | 28 | **pokok dan wajib tidak dapat ditarik**; saldo sama dengan jumlah mutasinya; setoran ganda tidak tercatat dua kali |
| K-4 | 55 | plafon; pinjaman ganda; calon anggota tidak dapat meminjam; **analis tidak menyetujui analisisnya sendiri**; jadwal beku saat pencairan; pokok dan jasa terpisah |
| K-5 | 25 | **satu anggota satu suara**; kuorum dari kehadiran tercatat; keputusan tanpa kuorum ditandai tidak sah; kuasa dibatasi |
| K-6 | 24 | **perhitungan dapat diulang**; jumlah komponen sama dengan surplus; SHU tanpa keputusan RAT ditolak |
| K-7 | 20 | patronage sama dengan penjualan anggota; adapter tidak menulis ke tabel POS |
| K-8 | 20 | **jumlah buku pembantu sama dengan saldo buku besar**; neraca seimbang |
| K-9 | 15 | anggota hanya melihat dirinya sendiri |
| K-10 | 20 | data contoh bergolongan EXAMPLE; pembersihan tidak menghapus produk simpanan dan bagan akun |
| K-11 | 25 | sebelas uji keamanan pada dokumen 05 |
| **Jumlah** | **± 277** | |

Sasaran akhir: **1048 + 277 = sekitar 1325 tes** saat K-11 selesai.

---

## Tiga invarian yang diuji berulang di banyak fase

Ketiganya cukup penting untuk diuji ulang setiap kali tersentuh, bukan sekali
saja:

### 1. Keanggotaan menuntut simpanan pokok lunas

Diuji pada K-2 (aturan), K-3 (pengaktifan), K-4 (calon anggota tidak dapat
meminjam), K-5 (calon anggota tidak punya hak suara), K-6 (calon anggota tidak
memperoleh SHU).

Satu aturan, lima tempat yang dapat melanggarnya.

### 2. Jumlah buku pembantu sama dengan saldo buku besar

Diuji pada K-3 (simpanan), K-4 (pinjaman), K-6 (SHU), K-8 (rekonsiliasi
menyeluruh). Bila selisih muncul, ia muncul di antara fase — bukan di dalamnya.

### 3. Perhitungan uang dapat diulang

SHU, angsuran, denda, dan patronage. Menjalankan ulang atas masukan yang sama
wajib menghasilkan angka yang sama, sampai ke pembulatannya.

---

## Yang belum dapat diukur

- **Uji E2E.** `pnpm test:e2e` menuntut API dan basis data hidup. Dijalankan
  pada K-2 begitu ada alur keanggotaan yang dapat ditempuh dari ujung ke ujung.
- **Uji beban.** Belum ada endpoint koperasi. Sasaran kinerja ditetapkan pada
  K-8 ketika laporan mulai menyentuh data banyak.
- **Uji lintas vertikal.** Menuntut eMedik dan info-desa berjalan. Milik sesi
  Core pada gerbang integrasi.
