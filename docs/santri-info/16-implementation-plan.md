# EP-0.17 — Rencana Pelaksanaan

Disusun dari kesenjangan yang benar-benar ditemukan, bukan dari urutan EP pada
perintah master. Alasannya ada pada dokumen 03: vertikal pendidikan belum ada
sama sekali, sehingga urutan yang menganggapnya ada akan tersendat pada langkah
pertama.

## Prasyarat mutlak

**EP-A — Fondasi pendidikan.** Model orang, santri, wali, unit, tahun ajaran,
dan pendaftaran santri. Tanpa ini seluruh EP lain tidak punya pijakan. Ini
pekerjaan terbesar dan harus didahulukan.

## Status EP-A — SEBAGIAN, irisan santri saja

**Yang dikerjakan:** migrasi modul tenant `pesantren` (IR-001) menambahkan lima
tabel — `pesantren_tahun_ajaran`, `pesantren_unit_pendidikan`, `pesantren_wali`,
`pesantren_santri`, `pesantren_santri_wali` — dengan CHECK yang menegakkan
konsistensi status/tanggal keluar dan indeks unik parsial (satu tahun ajaran
aktif, satu wali utama per santri, NIS unik). Katalog vertikal `pesantren`
(IR-004) menambahkan satu menu (`EPESANTREN_SANTRI`) dan satu peran
(`EPESANTREN_ADMIN`, profil P7) — bukan seluruh 41 peran dari §14.6 perintah
master, sebab menu selain data santri belum ada (larangan §6). `OWNER` saja
tidak cukup untuk mencatat santri (profil P11 tanpa CREATE/UPDATE), sehingga
`PesantrenRegistrationService` memberi peran `EPESANTREN_ADMIN` sebagai peran
KEDUA kepada pemilik pondok saat pendaftaran — izin dari kedua peran digabung,
bukan saling mengganti.

API `PesantrenSantriController` (`/pesantren/santri` — GET daftar, GET satu,
POST catat) dibuktikan lewat live test terhadap tenant `ponpes_demo`: daftar
kosong pada tenant baru, pencatatan santri berhasil, NIS ganda ditolak dengan
pesan ramah, validasi melaporkan seluruh galat sekaligus, dan permintaan tanpa
token ditolak 401. `pnpm migrate:tenants` dijalankan dan seluruh 20 skema
tenant lokal mutakhir.

**Yang tidak dikerjakan:** CRUD untuk wali, unit pendidikan, dan tahun ajaran —
tabelnya ada, API-nya belum. Formulir pendaftaran santri di sisi peramban juga
belum dibangun; hanya API yang sudah teruji. Ini bukan kelalaian, melainkan
irisan terkecil yang membuktikan fondasi (IR-001 + IR-004) bekerja sebelum
memperluas ke seluruh domain santri.

## Status EP-B, EP-C, EP-D — dikerjakan pada sesi ini

**EP-B — DONE.** Produk `EPESANTREN`/`ESCHOOL`/`ECAMPUS` dan paket
`EPESANTREN_SCHOOL_FIRST` (Rp 2.000, metrik `PER_ACTIVE_SANTRI`) tersimpan di
katalog harga berversi. `getConfig()` pada pendaftaran pesantren kini membaca
harga dari sana, bukan konstanta. Dibuktikan dengan mengubah harga langsung di
basis data ke Rp 2.500 dan melihat endpoint publik ikut berubah, lalu
dikembalikan ke Rp 2.000. Paket hanya menyertakan dua modul yang audit ini
catat `DONE` (`EPESANTREN_FOUNDATION`, `EPESANTREN_ONBOARDING`) — bukan seluruh
39 modul, sesuai larangan §6 mengklaim modul yang belum ada.

**EP-C — SEBAGIAN, sengaja dihentikan di sini.** Kolom `tenant_id` pada
`platform.website` sudah ada (aditif), dan `getSite()` sudah disaring eksplisit
`tenantId: null`. Dibuktikan dengan menyisipkan baris `Website` bertenant
`sortOrder: -999` langsung ke basis data — tanpa perbaikan, baris itu akan
memenangkan pengurutan dan tampil sebagai beranda eBisnis.id; dengan perbaikan,
beranda tetap benar.

Yang **tidak** dikerjakan, dan sengaja: membuat situs CMS per pondok.
Investigasi menemukan `CmsPage.slug` hanya unik per situs sementara `getPage()`
tidak menyaring situs sama sekali, dan `NewsArticle`/`NewsCategory` tidak punya
kolom situs sama sekali — bukan ambigu, tidak bersekat sama sekali. Lihat
eskalasi pada `09-cms-and-tenant-website-analysis.md`. Membangun di atas
fondasi yang bocor lebih berbahaya daripada menunda.

**EP-D — DONE.** Enam label terpesan yang kurang (`static`, `media`, `login`,
`register`, `demo`, `sandbox`) ditambahkan di kedua sisi — API dan peramban —
dan diikat uji yang membaca satu sama lain. Dibuktikan lewat pendaftaran
sungguhan: `login`, `demo`, `sandbox` kini ditolak sebagai alamat situs pondok.

## Status EP-C2 — DONE

Menutup dua celah yang dicatat eskalasi pada `09-cms-and-tenant-website-analysis.md`:

1. `CmsPage.slug` sudah punya kolom `websiteId` sejak awal, tetapi
   `PublicSiteService.getPage()` mengabaikannya dan mencari `slug` lintas
   SELURUH situs. Diperbaiki dengan menambah `idSitusPlatform()` (pola yang
   sama dengan penyaring `tenantId: null` pada `getSite()`) dan menyaring
   `getPage()` dengannya.
2. `NewsCategory` dan `NewsArticle` tidak punya kolom situs sama sekali —
   `slug` unik secara global. Migrasi aditif `20260802130000_news_site_scoping`
   menambah `website_id` (NOT NULL, mengisi seluruh baris lama ke situs
   platform sendiri), lalu mengubah keunikan `slug` dari global menjadi
   `(website_id, slug)`. `listNews()` dan `getNewsArticle()` ikut disaring.

Dibuktikan lewat live test: situs uji `ponpes_demo` diberi kategori dan
artikel dengan slug PERSIS SAMA dengan milik eBisnis.id (`produk` dan
`eBisnis-id-resmi-meluncurkan-platform-pos-erp`). Tanpa perbaikan, baris mana
pun yang dikembalikan Postgres lebih dulu akan tampil di beranda publik
eBisnis.id. Dengan perbaikan, `/public/news/:slug` dan
`/public/news?category=produk` tetap mengembalikan artikel dan kategori milik
eBisnis.id, bukan milik pondok uji.

**Yang tidak dikerjakan, tetap sengaja:** endpoint publik dan admin CMS untuk
mengelola situs SATU PONDOK (mis. `/pesantren/public/site`, editor berita
tenant). Perbaikan ini hanya menutup risiko kebocoran data sebagai prasyarat
— situs pondok itu sendiri belum dibangun.

## Status EP-E — SEBAGIAN, presensi ibadah/kegiatan saja

**Yang dikerjakan:** tabel `pesantren_presensi` (migrasi modul
`20260802T150000__pesantren__presensi`) — satu baris per santri per tanggal
per jenis kegiatan (`SEKOLAH`, `DINIYAH`, `IBADAH`, `KEGIATAN`), status
`HADIR/IZIN/SAKIT/ALPA`, ditegakkan indeks unik parsial. Menu
`EPESANTREN_PRESENSI` dan hak `EPESANTREN_ADMIN` ditambahkan ke katalog yang
sama dengan EP-A. API `PesantrenPresensiController`
(`/pesantren/presensi` — GET daftar, POST catat) dibuktikan live terhadap
`ponpes_demo`: pencatatan berhasil, jenis berbeda pada tanggal sama
diperbolehkan, tanggal+jenis yang sama pada santri yang sama ditolak dengan
pesan konflik yang jelas, santri tak dikenal ditolak 404, dan permintaan
tanpa token ditolak 401.

Dipilih **presensi ibadah/kegiatan** (`EPESANTREN_IBADAH_ATTENDANCE` pada
§8.3 perintah master), BUKAN presensi kelas formal (`ESCHOOL_ATTENDANCE`),
sebab presensi kelas menuntut struktur rombongan belajar yang dicatat
MISSING pada `05-eschool-gap-matrix.md` — membangun di atasnya sekarang
berarti mengarang struktur kelas yang belum diaudit.

**Yang tidak dikerjakan:** rombongan belajar/kelas dan presensi sekolah
formal; rekap/laporan presensi (harian, mingguan, per santri); notifikasi ke
wali saat status bukan HADIR (bergantung EP-K, portal wali, yang belum ada).

## Sesudah EP-A

```text
EP-F   Tagihan pendidikan di atas mesin faktur
EP-G   Asrama dan penempatan kamar
EP-H   Diniyah, halaqah, kitab
EP-I   Tahfiz
EP-J   Perizinan dan gerbang
EP-K   Portal wali beserta cakupan DEPENDENT_CHILD
EP-L   Dompet santri dan batas belanja
EP-M   Anjungan dan kartu RFID
EP-N   Adapter POS, koperasi, klinik
EP-O   Nilai dan rapor
EP-P   Pelaporan
EP-Q   UAT bersama pondok pertama
EP-R   Rilis
```

## Aturan untuk setiap EP

Tidak ada EP dinyatakan selesai tanpa: migrasi aditif, API, OpenAPI, UI,
permission sisi peladen, audit, Help, uji, dokumentasi, commit, push, dan CI
hijau. §6 melarang berhenti pada skeleton, TODO, atau menu kosong.

Satu tambahan dari pengalaman sesi ini: **setiap EP diuji dengan menjalankannya
terhadap basis data lokal**, bukan hanya lewat uji unit. Cacat kebuntuan ganti
kata sandi lolos dari 2.100 uji dan baru ketahuan saat pendaftaran sungguhan
dijalankan.
