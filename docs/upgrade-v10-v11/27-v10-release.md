# V10-8 — RBAC, Seed, dan Laporan Penyelesaian Versi 10

Status: **SELESAI sebagian** — bagian yang dapat dikerjakan selesai; bagian yang
bergantung pada pekerjaan V8 yang belum ada dinyatakan terhalang, bukan
dilewatkan diam-diam.

---

## 1. Yang dikerjakan

### 1.1 Empat peran surat, bukan satu

Tata kelola surat memisahkan yang **menyusun** dari yang **menyetujui**. Satu
peran "Administrator Surat" yang dapat melakukan keduanya membuat seluruh alur
persetujuan menjadi hiasan.

| Peran | Profil | Cakupan data | Tugas |
|---|---|---|---|
| `SEKRETARIS` | P6 | Badan hukum | Mencatat surat masuk, menyusun konsep, meneruskan disposisi |
| `PENYETUJU_SURAT` | P4 | Badan hukum | Menyetujui, mengembalikan, menolak, menerbitkan nomor |
| `ARSIPARIS` | P5 | Tenant | Klasifikasi, loker, masa simpan, penataan berkas |
| `ADMIN_SURAT` | P7 | Tenant | Skema penomoran, alur, kop surat, templat |

`SEKRETARIS` dan `PENYETUJU_SURAT` berada pada kelompok pemisahan tugas
`SURAT_APPROVAL` sebagai `PREPARER` dan `APPROVER`. Seseorang tidak dapat
diberi keduanya — ditegakkan saat penugasan peran oleh
`SegregationOfDutyService`, bukan sekadar dianjurkan.

Alasannya ditulis pada definisi kelompoknya: surat resmi yang disusun dan
disetujui orang yang sama membuat seluruh alur persetujuan menjadi hiasan, dan
nomor resmi yang keluar dari organisasi tidak dapat ditarik kembali.

### 1.2 Enam templat pemberitahuan surat

`SURAT_MASUK_DIDISPOSISI`, `SURAT_MENUNGGU_PERSETUJUAN`, `SURAT_DISETUJUI`,
`SURAT_DIKEMBALIKAN`, `SURAT_DITERBITKAN`, `SURAT_SLA_TERLAMPAUI`.

Katalog templat naik dari 10 menjadi 16.

### 1.3 Katalog menu

Naik dari 124 menjadi 133 menu — sembilan menu surat sebagai root tersendiri.

---

## 2. Yang TERHALANG, dan mengapa

Spesifikasi V10-8 menyebut "terapkan Help/CRUD/Excel/PDF" pada slice Versi 10.
Ketiganya **tidak dapat dikerjakan**, dan sebabnya bukan kekurangan waktu:

| Yang diminta | Penghalang |
|---|---|
| Help pada halaman V10 | **Help Center belum ada.** V8-1 dan V8-2 belum dikerjakan; tidak ada tabel, layanan, maupun komponen bantuan di seluruh sistem. |
| Excel export/import V10 | **Mesin Excel belum ada.** V8-5 dan V8-6 belum dikerjakan. |
| PDF cetak V10 | **Mesin cetak PDF belum ada.** V8-7 sampai V8-9 belum dikerjakan. |
| `CrudActionGroup` standar | **Belum ada.** V8-4 belum dikerjakan. |

Diperiksa langsung pada basis data: tidak ada satu pun tabel yang namanya
memuat `help`, `excel`, `print`, `pdf`, atau `import` pada skema tenant mana pun.

Membangun mesin Help, Excel, dan PDF dari nol adalah lingkup V8 — empat langkah
tersendiri yang masing-masing sebesar satu slice V10. Mengerjakannya di sini
akan menyelundupkan pekerjaan V8 ke dalam V10 tanpa audit dan tanpa rencana yang
disepakati, dan hasilnya akan berbeda dari yang kelak dirancang V8.

**Yang sudah disiapkan supaya penerapannya kelak murah:** seluruh endpoint V10
sudah memakai `@Permissions('MENU.ACTION')` dengan kode menu yang sudah ada di
katalog, sehingga `CrudActionGroup`, tombol Excel, dan tombol cetak dapat
dipasang tanpa mengubah satu pun endpoint.

---

## 3. UI Versi 10 belum dibuat

Seluruh slice V10 menghasilkan **backend** yang lengkap dan terbukti. Yang belum
ada: halaman antarmukanya.

| Slice | Endpoint | UI |
|---|---|---|
| V10-1 Telemetri | — (infrastruktur) | — |
| V10-2 ErrorLog | 6 endpoint | Belum |
| V10-3 PerformanceLog | 4 endpoint | Belum |
| V10-4 Sesi & peran aktif | 6 endpoint | Belum |
| V10-5 Aktivitas & TableAudit | 6 endpoint | Belum |
| V10-6 Surat | 10 endpoint | Belum |
| V10-7 Notification Hub | 6 endpoint | Belum |

Ini disebutkan terang-terangan karena "Versi 10 selesai" tanpa keterangan akan
dibaca sebagai "pengguna sudah dapat memakainya", dan itu tidak benar. Yang
selesai adalah kemampuannya; yang belum adalah pintunya.

---

## 4. Regresi penuh

Dijalankan pada 31 Juli 2026 terhadap commit `feature/v10-rbac-release`.

| Gerbang | Hasil |
|---|---|
| `pnpm lint` (api + web) | Bersih |
| `tsc --noEmit` | Bersih |
| `jest` | **975 uji lulus**, 41 suite |
| `route:audit` | 0 route tanpa penanda otorisasi |
| `pnpm build` (api + web) | Berhasil |
| Migration tenant | V001–V021 diterapkan pada 14 skema |
| Seed tenant | 22 resource, 0 gagal |

Pertumbuhan uji sepanjang Versi 10: 855 → 863 → 888 → 914 → 957 → 975.

### 4.1 Seluruh skrip bukti dijalankan ulang

| Skrip | Hasil |
|---|---|
| `prove-v10-2-errorlog` | LULUS |
| `prove-v10-3-performance` | LULUS |
| `prove-v10-4-session` | LULUS |
| `prove-v10-5-activity` | LULUS |
| `prove-v10-6-surat` | LULUS |
| `prove-v10-7-notification` | LULUS |

### 4.2 Dua temuan dari pengulangan

**Pertama — cacat pada buktinya sendiri, bukan pada produknya.**
`prove-v10-5` menuntut jumlah pembatalan **tepat satu**, padahal ringkasan yang
dibacanya menghitung seluruh tenant. Bukti seperti itu hanya lulus pada basis
data yang benar-benar kosong — dan bukti yang hanya lulus pada keadaan sempurna
akan gagal saat dijalankan pada lingkungan nyata, lalu diabaikan sebagai "memang
begitu". Diubah menjadi "sedikitnya satu", yang memang itulah yang hendak
dibuktikan.

**Kedua — pembatas laju bekerja sebagaimana mestinya.**
Menjalankan keenam skrip dua kali berturut-turut membuat empat di antaranya
gagal masuk. Sebabnya bukan cacat: setiap skrip melakukan dua sampai tiga kali
login, dan enam skrip yang dijalankan dua kali melampaui batas sepuluh login per
menit pada endpoint autentikasi. Dijalankan dengan jeda, seluruhnya lulus.

Ini dicatat karena tampak seperti regresi dan bukan regresi — dan orang
berikutnya yang menjalankan keenamnya sekaligus akan melihat hal yang sama.

---

## 5. Ringkasan Versi 10

| Slice | Isi | Keadaan |
|---|---|---|
| V10-1 | Telemetri tersanitasi | SELESAI |
| V10-2 | ErrorLog terpusat dengan sidik jari | SELESAI |
| V10-3 | PerformanceLog + analisis kebocoran | SELESAI |
| V10-4 | Peran aktif per sesi, daftar sesi, perangkat | SELESAI |
| V10-5 | Jejak pemakaian, TableAudit, kapasitas pelaku | SELESAI |
| V10-6 | Tata kelola surat | SELESAI (backend) |
| V10-7 | Notification Hub + eskalasi SLA | SELESAI (backend) |
| V10-8 | RBAC + seed + regresi | SELESAI sebagian |

**21 migration tenant**, 14 skema, seluruhnya selaras.

### 5.1 Cacat yang ditemukan dan diperbaiki sepanjang V10

Dicatat karena masing-masing menandakan kelas kesalahan yang dapat terulang:

1. **Penghitung pegangan tidak menghitung timer** (V10-3) — `_getActiveHandles`
   melewatkan `setInterval`, bentuk kebocoran paling sering. Heuristiknya akan
   menyimpulkan NORMAL selamanya.
2. **Penyempitan peran dapat MENAMBAH izin** (V10-4) — bila larangan dari peran
   lain ikut hilang saat menyempit.
3. **Kolom yang bergantung pada ingatan penulis kode akan kosong** (V10-5) —
   `actor_role_codes` kosong pada seluruh 258 baris karena diisi dari 76 tempat.
4. **Idempotensi diperiksa setelah perpindahan status** (V10-6) — permintaan
   ulang ditolak alih-alih menjawab nomor yang sudah ada.
5. **NULL pada indeks unik tidak pernah bertabrakan** (V10-7) — pengelompokan
   tidak bekerja sama sekali untuk penerima berupa peran.
6. **Sidik migration berubah karena akhir baris** (V10-7) — Git menormalkan
   CRLF menjadi LF, dan seluruh penerapan berikutnya ditolak.

Lima dari enam ditemukan oleh **skrip bukti yang dijalankan terhadap sistem yang
benar-benar berjalan**, bukan oleh uji unit. Uji unit menguji apa yang
dibayangkan penulisnya; skrip bukti menguji apa yang benar-benar terjadi.

---

## 6. Sebelum Versi 11

Tiga keputusan menunggu pemilik sistem — ketiganya ditemukan pada audit V10/V11
dan belum terjawab:

1. **Model embedding untuk RAG.** Ollama pada `38.47.182.162:11434` **tidak
   memiliki satu pun model embedding**. Tanpa itu, V11-3 (RAG dan Knowledge
   Base) tidak dapat dikerjakan. Perlu keputusan: memasang model embedding,
   atau menunda V11-3.
2. **Zod atau JSON Schema** untuk keluaran terstruktur AI (V11-2).
3. **Registri data contoh terpusat** — `is_sample` sudah ada pada 812 kolom;
   registri terpusat akan menjadi sumber kebenaran kedua.

Versi 11 juga menuntut V11-0 (audit AI, sample, dan padanan finansial) sebelum
implementasi apa pun.
