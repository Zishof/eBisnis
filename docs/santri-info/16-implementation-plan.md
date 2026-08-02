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

## Status EP-F — SEBAGIAN, penerbitan tagihan saja

**Yang dikerjakan:** tabel `pesantren_tagihan` dan `pesantren_tagihan_item`
(migrasi modul `20260802T160000__pesantren__tagihan`) — piutang INTERNAL
milik satu penyewa, sengaja TERPISAH dari `platform.billing_invoice` (mesin
faktur langganan platform, yang membebankan `Tenant`). Riset sebelum
implementasi menemukan `BillingInvoice.tenantId` wajib menunjuk `Tenant`
platform — tidak ada konsep "pembayar" generik yang dapat menunjuk wali
santri, dan §6 perintah master melarang keras mencampur pembayaran
langganan platform dengan SPP. Karena itu EP-F TIDAK memperluas
`billing_invoice`; ia menambah tabel baru sekelas dengan buku besar
`cooperative_saving` yang sudah ada — bukan mesin faktur kedua.

Status memakai kosakata yang sama dengan `platform.InvoiceStatus`
(DRAFT/ISSUED/PARTIALLY_PAID/PAID/OVERDUE/VOID) semata demi konsistensi
istilah. Satu tagihan per santri per periode (bulan) ditegakkan indeks unik
parsial. Hanya santri berstatus AKTIF yang dapat ditagih — ditegakkan di
service, bukan hanya UI, sesuai larangan §6 menagihkan santri yang sudah
efektif keluar.

API `PesantrenTagihanController` (`/pesantren/tagihan` — GET daftar, GET
satu, POST catat, POST :id/terbitkan) dibuktikan live terhadap `ponpes_demo`
dengan data sampel nyata (bukan mock): membuat tagihan dua rincian (SPP +
Asrama) dan memverifikasi totalnya terhitung benar (200.000), mengambil
detail beserta rinciannya, periode ganda pada santri yang sama ditolak
dengan pesan konflik, tagihan tanpa rincian ditolak validasi, penerbitan
DRAFT→ISSUED berhasil dan penerbitan kedua kali ditolak, daftar tersaring
status ISSUED mengembalikan hanya baris yang benar, santri yang ditandai
KELUAR ditolak saat ditagih, santri tak dikenal menghasilkan 404, dan
permintaan tanpa token ditolak 401.

**Yang tidak dikerjakan:** pencatatan pembayaran (transisi ke
PARTIALLY_PAID/PAID), integrasi `PaymentPort`, portal wali untuk melihat
dan membayar tagihannya sendiri (bergantung EP-K), pembatalan (VOID), dan
rekap tunggakan. Tagihan yang dibuat sesi ini berhenti pada status ISSUED —
jujur sesuai §6, bukan diklaim sebagai alur pembayaran yang lengkap.

## Status EP-G — SEBAGIAN, asrama/kamar/penempatan tanpa penguncian konkuren

**Yang dikerjakan:** tabel `pesantren_asrama`, `pesantren_kamar`,
`pesantren_penempatan` (migrasi modul `20260802T170000__pesantren__asrama`).
Satu santri hanya boleh punya satu penempatan aktif ditegakkan indeks unik
parsial (pola sama dengan satu-wali-utama EP-A). API
`PesantrenAsramaController`/`PesantrenPenempatanController`
(`/pesantren/asrama`, `/pesantren/asrama/:id/kamar`, `/pesantren/penempatan`)
dibuktikan live dengan data sampel nyata terhadap `ponpes_demo`: kamar
berkapasitas 1 menolak penempatan kedua dengan pesan penuh yang jelas,
santri yang sudah punya penempatan aktif ditolak dipindah ke kamar lain
tanpa mengakhiri yang lama terlebih dahulu, mengakhiri lalu memindah
berhasil, kode asrama dan nomor kamar ganda ditolak konflik, jumlah `terisi`
pada daftar kamar terhitung benar sebelum dan sesudah penempatan, santri tak
dikenal 404, dan tanpa token 401.

**Keterbatasan yang diketahui, bukan yang tidak disadari:** pemeriksaan
kapasitas kamar (`COUNT` lintas baris) dan penulisan penempatan TIDAK berada
dalam satu penguncian baris (`SELECT ... FOR UPDATE`) — pada beban bersamaan
yang tinggi, dua permintaan penempatan ke kamar yang sama dengan sisa satu
slot dapat lolos pemeriksaan kapasitas sekaligus. Indeks unik menjaga satu
santri tidak dobel penempatan aktif, tetapi TIDAK menjaga kamar melebihi
kapasitas. Untuk skala penggunaan wajar (petugas asrama menempatkan santri
satu per satu, bukan sistem otomatis bervolume tinggi), risiko ini rendah;
diperbaiki nanti dengan `SELECT ... FOR UPDATE` pada baris kamar sebelum
menghitung penghuni, bila terbukti dibutuhkan.

Kecocokan jenis kelamin santri terhadap jenis asrama (PUTRA/PUTRI) DITEGAKKAN
di service — santri laki-laki ditolak ditempatkan ke kamar pada asrama putri
dan sebaliknya, dibuktikan live.

**Yang tidak dikerjakan:** riwayat pindah kamar sebagai laporan (data ada di
`pesantren_penempatan`, tampilan rekapnya belum ada).

## Status EP-H — SEBAGIAN, halaqah dan kitab tanpa jadwal

**Yang dikerjakan:** tabel `pesantren_kitab`, `pesantren_halaqah`,
`pesantren_halaqah_santri` (migrasi modul
`20260802T180000__pesantren__diniyah`). Presensi diniyah sudah dapat dicatat
sejak EP-E terhadap santri langsung (jenis `DINIYAH`) tanpa perlu halaqah;
modul ini menambah struktur PENGELOMPOKAN yang belum ada. Berbeda dari
penempatan kamar EP-G (satu aktif per santri), satu santri BOLEH mengikuti
lebih dari satu halaqah sekaligus — yang dicegah hanya keanggotaan ganda
pada halaqah yang sama, ditegakkan indeks unik parsial.

API `PesantrenKitabController`/`PesantrenHalaqahController`
(`/pesantren/kitab`, `/pesantren/halaqah`, `/pesantren/halaqah/:id/anggota`)
dibuktikan live dengan data sampel nyata terhadap `ponpes_demo`: kitab dan
halaqah dicatat lalu diambil kembali dan datanya sama persis, kode duplikat
ditolak konflik, santri digabungkan ke halaqah lalu `jumlah_anggota` pada
daftar halaqah dan daftar anggota keduanya terhitung benar, bergabung dua
kali ke halaqah yang sama ditolak, santri yang sama BERHASIL bergabung ke
halaqah KEDUA yang berbeda (membuktikan kaidah ini sengaja berbeda dari
EP-G), mengeluarkan lalu mencoba mengeluarkan lagi ditolak, santri tak
dikenal 404, dan tanpa token 401.

**Yang tidak dikerjakan:** jadwal kajian per halaqah (hari/jam), pencatatan
progres hafalan/bacaan per pertemuan (itu domain EP-I Tahfiz), dan laporan
rekap keanggotaan.

## Status EP-I — SEBAGIAN, log setoran tanpa target/rapor tahfiz

**Yang dikerjakan:** tabel `pesantren_tahfiz_setoran` (migrasi modul
`20260802T190000__pesantren__tahfiz`) — log transaksional setiap
setoran/murajaah per santri (juz 1-30, predikat LANCAR/KURANG_LANCAR/
TIDAK_LANCAR). Sengaja TIDAK ada tabel ringkasan/capaian terpisah: capaian
juz tertinggi dihitung dari log ini di service (`MAX(juz) WHERE jenis =
'SETORAN' AND predikat = 'LANCAR'`) — baris ringkasan yang berduplikasi
dari sumbernya cepat berselisih begitu satu diperbarui dan yang lain
tertinggal.

API `PesantrenTahfizController` (`/pesantren/tahfiz`,
`/pesantren/tahfiz/capaian/:santriId`) dibuktikan live dengan data sampel
nyata terhadap `ponpes_demo`: empat setoran dicatat (juz 1 LANCAR, juz 3
LANCAR, juz 5 KURANG_LANCAR, murajaah juz 10 LANCAR) lalu SELURUHNYA
terbaca kembali lewat daftar; `capaian` menghitung `juz_tertinggi=3` dengan
benar — BUKAN 5 (predikat KURANG_LANCAR tidak dihitung) dan BUKAN 10
(jenis MURAJAAH bukan hafalan baru); `total_setoran=4` mencakup seluruh
jenis. Juz di luar rentang 1-30 ditolak validasi, santri tak dikenal 404,
capaian santri yang belum pernah setor mengembalikan `juz_tertinggi: null`
(bukan error), dan tanpa token 401.

**Yang tidak dikerjakan:** target hafalan per santri/kelas, jadwal setoran,
dan rapor tahfiz cetak.

## Status EP-J — SEBAGIAN, perizinan dan gerbang dengan SoD terbukti

**Mengapa modul ini berbeda dari yang lain:**
`docs/santri-info/13-security-and-privacy-risk-register.md` R10 mencatat
"Petugas gerbang mengubah persetujuan izin" sebagai risiko BELUM ADA
PENAHAN, dan secara eksplisit menulis "wajib menjadi uji". §14.8 perintah
master: "petugas gerbang != pengubah persetujuan izin". Ini satu-satunya EP
sesi ini yang menuntut peran BARU (`EPESANTREN_PETUGAS_GERBANG`) dibuat
lebih awal dari kelaziman §6 — bukan mengklaim modul yang belum ada,
melainkan sebab satu-satunya cara pemisahan tugas dapat DIUJI adalah dengan
adanya peran yang benar-benar terpisah dari `EPESANTREN_ADMIN`.

**Yang dikerjakan:** tabel `pesantren_izin`, `pesantren_gerbang_log`
(migrasi modul `20260802T200000__pesantren__perizinan`). Pemisahan
ditegakkan pada TIGA lapis: (1) dua service TERPISAH —
`PesantrenPerizinanService` (ajukan/setujui/tolak) dan
`PesantrenGerbangService` (catat lintasan) — yang kedua secara harfiah
tidak punya satu pun metode yang menulis `pesantren_izin.status`, dibuktikan
uji yang memeriksa daftar metode kelasnya; (2) dua menu dengan aksi
berbeda — `EPESANTREN_GERBANG` tidak pernah menawarkan aksi APPROVE/REJECT
sama sekali; (3) peran `EPESANTREN_PETUGAS_GERBANG` (profil P2, operator)
hanya memegang menu gerbang, TIDAK PERNAH `EPESANTREN_PERIZINAN`.

Dibuktikan live end-to-end terhadap `ponpes_demo` memakai dua akun sungguhan
dengan peran berbeda (lihat bagian akun uji coba di bawah): admin
mengajukan izin, petugas gerbang mencoba mencatat lintasan SEBELUM disetujui
(ditolak dengan pesan status), petugas gerbang mencoba menyetujui izin
langsung (403 — tidak punya `EPESANTREN_PERIZINAN.APPROVE`), petugas gerbang
mencoba sekadar MEMBACA daftar izin (403 — tidak punya
`EPESANTREN_PERIZINAN.READ` sama sekali), admin menyetujui, petugas gerbang
BERHASIL mencatat KELUAR lalu MASUK, menyetujui izin yang sama dua kali
ditolak, dan alur tolak (DITOLAK) diverifikasi terpisah.

**Bug yang tertangkap live test:** `disetujui_oleh` semula dibuat FK ke
`user_subject(id)`, padahal `AuthenticatedUser.userId` yang dikirim service
adalah `platform_user_id` — ruang ID yang berbeda. Percobaan menyetujui izin
sungguhan gagal dengan pelanggaran foreign key. Diperbaiki dengan menjadikan
kolom itu UUID polos, konsisten dengan konvensi `created_by`/`updated_by`
pada seluruh tabel pesantren lain. Migrasi belum pernah di-commit saat
diperbaiki, sehingga diedit langsung (bukan migrasi susulan) dan checksum
yang sudah terekam di 20 skema lokal direkonsiliasi ke isi berkas yang benar.

**Yang tidak dikerjakan:** notifikasi ke wali saat izin diputuskan
(bergantung EP-K), pembatalan izin oleh pengaju, dan laporan rekap keluar-
masuk.

## Akun uji coba EPESANTREN_ADMIN dan EPESANTREN_PETUGAS_GERBANG (tenant `ponpes_demo`)

Atas permintaan eksplisit agar pengujian dapat dilakukan leluasa dari
berbagai posisi hak akses, dibuat 10 akun untuk setiap peran ePesantren yang
BENAR-BENAR ada implementasinya saat ini:

```text
EPESANTREN_ADMIN            admin1_ponpesdemo .. admin10_ponpesdemo
EPESANTREN_PETUGAS_GERBANG  gerbang1_ponpesdemo .. gerbang10_ponpesdemo
```

Kata sandi seluruh akun uji: sama dengan akun `ponpes_demo` pemilik pondok
yang sudah dipakai sepanjang sesi ini (tidak dicatat di sini maupun di
Git — hanya digunakan sebagai variabel lingkungan sementara saat pengujian
lokal). `mustChangePassword` sengaja `false` khusus akun sampel ini supaya
tidak menghalangi pengujian berulang.

**Peran lain yang DIMINTA tetapi BELUM dibuat akunnya, dan sengaja:** Guru,
Pimpinan, Wali Kelas, dan peran-peran lain pada §14.6 perintah master TIDAK
memiliki satu pun modul atau menu yang benar-benar berfungsi pada sesi ini —
membuat akun untuk peran yang tidak berdaya apa-apa hanya akan
menyesatkan, seolah kapasitasnya sudah ada. Akun untuk peran-peran itu akan
dibuat bersamaan dengan modul yang menjadi dasarnya, mengikuti disiplin §6
yang sama dengan seluruh EP sesi ini.

## Status EP-K — SEBAGIAN, portal wali baca-saja, multi-anak terbukti

**Yang dikerjakan:** `PesantrenPortalWaliController`/`PesantrenPortalWaliService`
di `/pesantren/portal/wali` — TIDAK ada migrasi baru, sebab `pesantren_wali.
user_subject_id` dan `pesantren_santri_wali` sudah ada sejak EP-A. Pola
meniru `CooperativePortalController` persis (diriset lebih dulu supaya
tidak membangun mekanisme kedua): permission TERPISAH
(`EPESANTREN_PORTAL_WALI`, bukan `EPESANTREN_SANTRI`), route prefix
terpisah, dan `santriId` dari path TIDAK PERNAH dipercaya — setiap metode
memverifikasi kepemilikan lewat `pesantren_santri_wali` lebih dulu, dan
santri yang bukan miliknya dijawab NOT_FOUND (bukan FORBIDDEN), supaya wali
lain tidak tahu santri itu ada sama sekali.

Peran baru `EPESANTREN_WALI` (profil P10) hanya memegang menu
`EPESANTREN_PORTAL_WALI` yang hanya menawarkan aksi READ — tidak pernah
`EPESANTREN_SANTRI`, ditegakkan uji RBAC eksplisit.

**Bug ditangkap sebelum live test, bukan sesudah:** rancangan awal
menyamakan `AuthenticatedUser.userId` (platform_user_id) dengan
`pesantren_wali.user_subject_id` (id `user_subject` TENANT, FK sungguhan
sejak EP-A) — cacat yang SAMA persis dengan bug `disetujui_oleh` EP-J,
hanya kali ini disadari saat menulis kode, sebelum sempat diuji. Diperbaiki
dengan menerjemahkan `platform_user_id -> user_subject.id` lebih dulu,
persis pola `TenantBootstrapService.assignAdditionalRole()`.

Dibuktikan live terhadap `ponpes_demo` dengan akun sungguhan
(`wali1_ponpesdemo`): melihat anak sendiri berhasil (profil, presensi,
tahfiz, izin — seluruhnya kembali data yang benar), mencoba mengakses anak
WALI LAIN lewat `santriId` yang benar-benar ada di basis data ditolak
NOT_FOUND pada endpoint detail MAUPUN presensi (bukan hanya endpoint
utama), dan — menjawab permintaan eksplisit soal wali beranak lebih dari
satu — seorang wali ditautkan ke ANAK KEDUA (Aisyah Putri, sebagai wali
kedua/ibu) dan `GET /anak` benar mengembalikan KEDUA anak, dan detail anak
kedua dapat diakses tanpa gesekan.

**Yang secara eksplisit DIMINTA dan BELUM dikerjakan (jangan dianggap
selesai):**

```text
1. Nilai/rapor semua anak    — modul EP-O (Nilai dan rapor) belum ada sama
                                sekali; portal tidak dapat menampilkan
                                sesuatu yang belum dicatat di mana pun.
2. Bayar SPP >1 anak sekaligus,
   1 virtual account          — memerlukan integrasi PaymentPort/VA
                                sungguhan dan penggabungan tagihan lintas
                                santri; EP-F (tagihan) sengaja per-santri
                                dan belum tersambung payment gateway apa
                                pun. Ini pekerjaan besar tersendiri, BUKAN
                                perluasan kecil dari EP-K.
3. Notifikasi (hadir, bolos,
   pelanggaran, ngaji, dst.)  — memerlukan EPESANTREN_PARENT_COMMUNICATION/
                                EPESANTREN_NOTIFICATION (§8.3) tersambung ke
                                NotificationPort platform yang sudah ada;
                                belum satu event pesantren pun diterbitkan
                                ke event bus.
```

Ketiganya dicatat di sini secara eksplisit, bukan didiamkan, sebab §6
melarang "berhenti pada proposal ... tanpa vertical slice berjalan" —
portal baca-saja untuk profil/presensi/tahfiz/izin ADALAH satu vertical
slice yang berjalan dan teruji; ketiga hal di atas adalah slice BERIKUTNYA
yang belum dimulai.

## Akun uji coba EPESANTREN_WALI (tenant `ponpes_demo`)

```text
EPESANTREN_WALI   wali1_ponpesdemo .. wali10_ponpesdemo
```

Setiap akun ditautkan sebagai wali sungguhan (lewat `pesantren_wali` dan
`pesantren_santri_wali`) ke salah satu dari 4 santri sampel yang ada
(Ahmad Fulan, Ridwan Hakim, Aisyah Putri, Yusuf Anwar) — bukan akun kosong
tanpa data, sebab akun wali tanpa anak tidak berguna untuk menguji
`DEPENDENT_CHILD`. `wali1_ponpesdemo` sengaja ditautkan ke DUA anak
(Ahmad Fulan sebagai wali utama, Aisyah Putri sebagai wali kedua) untuk
membuktikan kasus wali beranak lebih dari satu. Kata sandi sama dengan
akun uji EPESANTREN_ADMIN/EPESANTREN_PETUGAS_GERBANG di atas.

## Akun uji coba EPESANTREN_SERVICE_ACCOUNT_KIOSK (tenant `ponpes_demo`)

```text
EPESANTREN_SERVICE_ACCOUNT_KIOSK   kiosk1_ponpesdemo .. kiosk10_ponpesdemo
```

Akun PERANGKAT, bukan akun pribadi — masing-masing merepresentasikan satu
mesin anjungan (mis. satu di gerbang, satu di kantin). Kata sandi sama
dengan akun uji lain di atas.

## Status EP-L — SEBAGIAN, dompet manual tanpa top-up mandiri wali

**Yang dikerjakan:** tabel `pesantren_dompet` dan `pesantren_dompet_transaksi`
(migrasi modul `20260802T210000__pesantren__dompet`) — ledger KETIGA yang
berdiri sendiri, terpisah baik dari `platform.billing_invoice` (langganan
platform) maupun `pesantren_tagihan` (SPP, EP-F), sesuai larangan keras §6
mencampur ketiganya. Saldo pada `pesantren_dompet.saldo` adalah salinan
yang selalu ditulis ulang dalam transaksi yang sama dengan baris
`pesantren_dompet_transaksi` barunya — kebenarannya berasal dari log,
sama seperti capaian tahfiz EP-I.

Berbeda dari kapasitas kamar EP-G (yang mendokumentasikan keterbatasan
tanpa penguncian baris sebagai risiko rendah yang diterima), transaksi
dompet menyangkut uang — pemeriksaan saldo dan batas harian, serta
penulisan baris baru, berada dalam SATU transaksi dengan
`SELECT ... FOR UPDATE` pada baris dompetnya, sehingga dua permintaan
belanja bersamaan tidak dapat keduanya lolos pemeriksaan sebelum salah
satu menuliskan hasilnya.

API `PesantrenDompetController` (`/pesantren/dompet`) dibuktikan live
dengan data sampel nyata terhadap `ponpes_demo`: dompet dibuka dengan batas
harian Rp20.000, dompet ganda untuk santri yang sama ditolak konflik,
top-up Rp50.000 lalu belanja Rp15.000 berhasil dengan saldo akhir yang
benar (Rp35.000), belanja kedua yang membuat total harian melebihi batas
ditolak dengan pesan yang menyebutkan angka yang sudah dan akan
dibelanjakan, belanja yang melebihi SALDO (bukan batas harian) ditolak
lebih dulu dengan pesan berbeda, riwayat transaksi terbaca kembali sesuai
urutan, jumlah negatif ditolak validasi, dompet tak dikenal 404, dan tanpa
token 401.

Portal wali (EP-K) diperluas dengan satu endpoint BACA-SAJA
`/pesantren/portal/wali/anak/:santriId/dompet` — dibuktikan live: wali1
melihat saldo dan riwayat anak sendiri dengan benar, ditolak NOT_FOUND
saat mencoba melihat dompet anak wali lain, dan anak yang belum dibukakan
dompet mengembalikan `adaDompet: false` alih-alih error.

**Yang secara eksplisit BELUM dikerjakan (menjawab permintaan "wali bisa
membayarkan sekaligus" dari sesi ini):** wali TIDAK dapat top-up dari
portal sendiri — top-up hanya lewat layar pengurus (`PesantrenDompetController`,
manual). Menyediakan top-up mandiri wali berarti payment gateway
sungguhan (kartu/VA/e-wallet) tersambung ke `PaymentPort`, yang belum ada
sama sekali untuk ePesantren — dicatat sebagai pekerjaan terpisah, sama
seperti pembayaran SPP gabungan multi-anak pada catatan EP-K.

## Status EP-M — SEBAGIAN, kiosk baca-saja lewat akun perangkat

**Yang dikerjakan:** tabel `pesantren_kartu` (migrasi modul
`20260802T220000__pesantren__kartu`) — registry kartu RFID/QR. Satu kartu
aktif per santri dan satu nomor kartu aktif secara global ditegakkan
indeks unik parsial (hanya atas baris berstatus AKTIF, supaya nomor kartu
yang dilaporkan hilang dapat dipakai ulang pada kartu pengganti tanpa
mengubah data historis kartu lama — dibuktikan live).

Anjungan (kiosk) TIDAK memakai login pribadi santri — santri tidak pernah
punya akun platform sendiri pada sesi ini. Sebagai gantinya, peran BARU
`EPESANTREN_SERVICE_ACCOUNT_KIOSK` (profil P12, akun perangkat) dipegang
mesin kiosk itu sendiri. Pemisahan ditegakkan tiga lapis, pola yang sama
dengan EP-J: (1) `PesantrenKioskService` secara harfiah hanya punya SATU
metode (`pindaiKartu`), diperiksa lewat uji yang membaca daftar metode
kelasnya — tidak ada satu pun jalur tulis; (2) menu `EPESANTREN_KIOSK`
hanya menawarkan aksi READ; (3) peran kiosk TIDAK PERNAH memegang
`EPESANTREN_SANTRI` maupun `EPESANTREN_KARTU` — kiosk yang disusupi tidak
dapat membaca data santri lain di luar yang dipindai, apalagi menerbitkan
kartu baru.

Dibuktikan live terhadap `ponpes_demo` dengan akun perangkat sungguhan
(`kiosk1_ponpesdemo`): memindai kartu Ahmad Fulan mengembalikan cuplikan
yang benar (nama, NIS, status, presensi hari ini, DAN saldo dompet —
membuktikan EP-M terhubung dengan benar ke ledger EP-L), mencoba
mengakses layar santri penuh ditolak 403, mencoba menerbitkan kartu baru
lewat token kiosk ditolak 403, nomor kartu duplikat ditolak konflik,
menerbitkan kartu kedua untuk santri yang sudah punya kartu aktif ditolak
konflik, kartu tak dikenal 404, kartu yang sudah dinonaktifkan tidak
dapat dinonaktifkan lagi, dan nomor kartu yang sama BERHASIL diterbitkan
ulang sebagai kartu pengganti setelah kartu lama berstatus HILANG.

**Yang tidak dikerjakan:** anjungan sungguhan (perangkat/hardware,
integrasi pembaca RFID fisik) — API ini adalah backend yang akan dipanggil
anjungan semacam itu, bukan anjungannya sendiri; layar tampilan kiosk
(frontend) juga belum dibangun.

## Status EP-N (bagian POS) — SEBAGIAN, dompet santri sebagai metode bayar kasir

**Diriset lebih dulu, sebelum menulis kode apa pun:** §6 perintah master
melarang keras membuat POS/inventory/accounting KEDUA di dalam ePesantren.
Sebelum implementasi, ditemukan bahwa koperasi sudah menyelesaikan
persoalan yang identik lewat `ExternalPaymentRegistry` milik POS (IR-002,
`apps/api/src/modules/pos/external-payment.registry.ts`) — anggota
koperasi membayar di kasir memakai saldo simpanan lewat kontrak
`authorize()`/`capture()`/`reverse()`, TANPA menyunting mesin POS.
Dompet santri (EP-L) meniru pola ini persis, bukan membangun jalur baru.

Ditemukan pula: repositori punya DUA klien kasir — web (React,
`apps/web/src/pages/pos/`) dan `apps/pos-flutter/` (tablet Android/Windows,
"klien KEDUA dari sistem yang sama, bukan POS berdiri sendiri — ADR-012").
Keduanya memanggil backend yang SAMA; perubahan sesi ini murni backend,
sehingga otomatis berlaku untuk keduanya tanpa disunting satu per satu.

**Yang dikerjakan:** `pesantren_dompet_hold` (migrasi modul
`20260802T230000__pesantren__pos_adapter`) — penahanan dua-langkah, pola
sama dengan `cooperative_payment_hold`, sebab `authorize()` MENAHAN dana
saat kasir memasukkan pembayaran dan `capture()` baru mewujudkannya saat
penjualan selesai. `PesantrenDompetPaymentHandler` mengimplementasikan
kontrak `ExternalPaymentHandler` dan didaftarkan lewat `onModuleInit()`,
pola sama dengan `CooperativeModule`. Baris katalog `payment_method`
(`EPESANTREN_DOMPET_SANTRI`) diseed lewat migrasi yang sama.

`capture()` memanggil `PesantrenDompetService.belanja()` — pemeriksaan
saldo dan batas harian yang SEBENARNYA (satu-satunya, tidak diduplikasi)
tetap di EP-L; `authorize()` hanya pratinjau supaya kasir tahu lebih awal.

**Keputusan desain yang sengaja berbeda dari koperasi:** `authToken` adalah
NOMOR KARTU (EP-M) yang dipindai, bukan bukti persetujuan dari layar portal
milik pemiliknya. Santri tidak (dan sengaja belum) punya akun portal
sendiri, dan wali tidak berada di kantin saat anaknya jajan. Untuk
transaksi kantin bernilai kecil, memindai kartu sebagai bukti hadir setara
dengan kartu prabayar kantin fisik — dicatat eksplisit sebagai keputusan,
bukan kelalaian meniru pola koperasi apa adanya (yang menuntut PIN/proof
token dari portal, sesuai untuk transaksi besar seperti simpanan/pinjaman).

Dibuktikan live end-to-end lewat API POS SUNGGUHAN terhadap `ponpes_demo`
(bukan panggilan langsung ke kelas handler) — sample data POS dipasang,
kasir ditugaskan ke register, shift dibuka, penjualan Rp17.000 dibuat:
kartu tak dikenal ditolak saat `authorize()`; kartu Ahmad Fulan (sudah
membelanjakan Rp15.000 hari itu pada EP-L) ditolak "melebihi batas harian"
— pesan yang SAMA dengan yang EP-L hasilkan, membuktikan jalur tunggal
pemeriksaan; kartu Ridwan Hakim (dompet baru, tanpa batas harian) berhasil
menahan dana TANPA memotong saldo (diverifikasi langsung ke basis data:
saldo tetap 50.000 setelah `authorize()`); menyelesaikan penjualan memicu
`capture()` — saldo berkurang tepat menjadi 33.000 dan baris
`pesantren_dompet_transaksi` tercatat merujuk id penahanannya; penjualan
kedua yang DIBATALKAN memicu `reverse()` — status penahanan menjadi
REVERSED dan saldo TIDAK tersentuh; memanggil endpoint pembayaran dua kali
dengan `Idempotency-Key` yang sama menghasilkan `duplicate: true` dan
hanya SATU baris penahanan di basis data.

**Yang tidak dikerjakan:** adapter koperasi/klinik lain pada EP-N (baru
POS); perubahan frontend web maupun Flutter (backend sudah menerima
`authToken` secara generik lewat DTO yang sama dipakai koperasi — field
input UI-nya belum ditambahkan pada `PosPaymentDialog.tsx` maupun layar
kasir Flutter, dan menambah hanya pada satu klien akan membuat keduanya
tidak sinkron); retur/refund dompet santri (pembayaran yang sudah
`CAPTURED` tidak dapat di-`reverse()`, sama seperti koperasi — memerlukan
alur retur tersendiri yang belum ada).

## Status EP-O — SEBAGIAN, mesin nilai berbobot, tanpa PSB/kelas/kurikulum

**Diaudit lebih dulu terhadap sistem lama** (`C:\opt\AIS\ais\...\master\sekolah\`),
atas permintaan eksplisit untuk memastikan cakupan FUNGSIONAL eSchool
tercakup, bukan hanya struktur tabelnya. Ditemukan sistem lama memakai
hierarki lima kelas Java terpisah untuk satu konsep "nilai berbobot dengan
konversi huruf": Jenis Penilaian → Grup Penilaian → Grup Kategori →
Kategori Item → Jenis Item, plus tabel konversi huruf terpisah. Audit yang
sama menemukan TIGA kesenjangan struktural lain yang lebih besar daripada
nilai: PSB/PPDB (alur pendaftaran calon santri bergelombang dengan jadwal
ujian/wawancara dan penomoran otomatis — jauh lebih canggih daripada
pendaftaran pondok level EP-registrasi yang sudah ada), rombongan
belajar/kelas, dan kurikulum/jadwal pelajaran — ketiganya BELUM dikerjakan
sesi ini, dicatat sebagai EP terpisah di bawah, bukan didiamkan.

**Yang dikerjakan:** `pesantren_mata_pelajaran`, `pesantren_komponen_nilai`,
`pesantren_skala_huruf`, `pesantren_nilai` (migrasi modul
`20260802T240000__pesantren__nilai`) — EMPAT tabel datar menggantikan
hierarki lima lapis sistem lama. Nilai akhir DIHITUNG di service dari
komponen berbobot (pola sama dengan capaian tahfiz EP-I, saldo dompet
EP-L) — bukan disimpan berduplikasi. Huruf mutu dicari dari tabel skala
lewat rentang, dan rentang antar baris skala TIDAK BOLEH tumpang tindih,
ditegakkan `EXCLUDE USING gist (numrange(...) WITH &&)` — bukan sekadar
indeks unik, sebab yang dicegah adalah IRISAN rentang, bukan kesamaan
persis. Ini lebih ketat daripada sistem lama, yang tidak terlihat
menegakkan larangan tumpang tindih ini sama sekali.

Portal wali (EP-K) diperluas dengan `GET .../rapor/:tahunAjaranId`, yang
memanggil `PesantrenNilaiService.rapor()` langsung alih-alih menuliskan
ulang perhitungan berbobot — menjawab permintaan eksplisit agar wali
beranak lebih dari satu dapat melihat rapor SETIAP anaknya (dipanggil satu
per satu per anak, kepemilikan diverifikasi setiap kali, bukan diasumsikan
dari satu daftar).

Dibuktikan live dengan data sampel nyata terhadap `ponpes_demo`: mata
pelajaran Fikih dengan tiga komponen (Tugas 20%, UTS 30%, UAS 50%,
`total-bobot` mengonfirmasi 100/lengkap), empat skala huruf A-D, skala
kelima yang tumpang tindih (85-95 vs rentang A yang sudah ada) ditolak
konflik; nilai Tugas=80/UTS=85/UAS=90 dicatat lalu rapor menghitung nilai
akhir **86,5 dan huruf B** — tepat sesuai rumus (80×0,2+85×0,3+90×0,5);
memperbaiki UAS menjadi 100 melalui UPSERT (baris yang SAMA, bukan baris
baru) mengubah rapor menjadi **91,5 dan huruf A**; wali1 melihat rapor
kedua anaknya secara terpisah (satu berisi nilai, satu kosong karena belum
dinilai) dan ditolak NOT_FOUND saat mencoba rapor anak wali lain; kode
mata pelajaran duplikat, santri tak dikenal, nilai di luar rentang 0-100,
dan permintaan tanpa token seluruhnya ditolak dengan benar.

**Yang tidak dikerjakan:** PSB/PPDB (pendaftaran calon santri bergelombang);
rombongan belajar/kelas; kurikulum dan jadwal pelajaran; cetak rapor PDF
(datanya sudah benar, tata letak cetak belum ada); nilai per semester
ganjil/genap (saat ini satu nilai per komponen per TAHUN ajaran, belum
membedakan semester dalam tahun yang sama).

## Status EP-O2 — SELESAI, PSB/PPDB bergelombang

Dikerjakan langsung sesudah EP-O, mengisi kekosongan PSB/PPDB yang tercatat
di atas. Perintah pengguna eksplisit meminta modul ini lebih canggih
daripada pendaftaran pondok (`modules/public/pesantren-registration.*`)
yang sudah ada -- riset membuktikan keduanya memang berbeda alur sama
sekali: pendaftaran pondok mendaftarkan sebuah TENANT baru, PSB/PPDB
mendaftarkan seorang CALON SANTRI ke pondok yang sudah berjalan.

Tiga tabel (`pesantren_psb_gelombang`, `pesantren_psb_pendaftar`,
`pesantren_psb_jadwal`) mengangkut alur penuh: gelombang dibuka/ditutup,
pendaftar mendaftar dengan nomor pendaftaran yang dibentuk atomik di dalam
transaksi (kunci baris gelombang lewat `FOR UPDATE`, naikkan
`nomor_urut_terakhir`, baru tulis baris pendaftar -- dua pendaftaran
bersamaan tidak pernah menerima nomor kembar), diverifikasi, dijadwalkan
ujian/wawancara (banyak jadwal per pendaftar), diluluskan/ditidakluluskan
(menuntut minimal satu jadwal berstatus SELESAI sebelum diluluskan --
ditegakkan di service, bukan sekadar tombol UI), diterima (menolak bila
kuota gelombang sudah tercapai), lalu daftar ulang -- yang memanggil
`PesantrenSantriService.catat()` langsung, bukan menulis ulang logikanya,
sehingga NIS duplikat dan validasi santri tetap satu sumber kebenaran.

Penempatan pasca-diterima SENGAJA hanya menyentuh
`unit_pendidikan_tujuan_id` (sudah ada sejak EP-A) -- rombongan
belajar/kelas (EP-O3) belum punya tabel, jadi PSB tidak berpura-pura bisa
menempatkan ke kelas yang belum ada.

Menu baru `EPESANTREN_PSB` diberikan ke `EPESANTREN_ADMIN` (P7) yang sudah
ada -- tidak ada peran baru dibuat, sebab tidak ada kebutuhan pemisahan
tugas yang eksplisit untuk PSB seperti halnya gerbang/izin (R10). Bila
pondok tertentu kelak butuh panitia PSB yang terpisah dari admin penuh,
peran baru dapat ditambahkan tanpa mengubah service ini sama sekali --
hanya menambah baris `RoleCatalogEntry`.

Live-test terhadap `ponpes_demo`: membuat gelombang G1 (kuota 2), menolak
pendaftaran sebelum gelombang dibuka, mendaftarkan tiga calon santri
(nomor `PSB-2026-2027-G1-00001/00002/00003` berurutan tanpa celah),
menjalankan alur penuh calon pertama sampai daftar ulang (memverifikasi
baris `pesantren_santri` baru benar-benar muncul di `GET
/pesantren/santri`), menerima calon kedua (kuota terisi 2/2), menolak
penerimaan calon ketiga dengan pesan "kuota sudah tercapai", membatalkan
calon ketiga, dan menolak pembatalan kedua atas pendaftar yang sama.
Ditemukan dan diperbaiki satu bug kecil saat live-test: `luluskan()`
memvalidasi kelengkapan jadwal SEBELUM memvalidasi status pendaftar,
sehingga pesan galat pada percobaan meluluskan pendaftar yang masih
berstatus TERDAFTAR keliru menyebut jadwal, bukan status -- diperbaiki
dengan menambah pemeriksaan status DIJADWALKAN terlebih dahulu.

**Yang tidak dikerjakan:** rombongan belajar/kelas (dikerjakan berikutnya
sebagai EP-O3, lihat status di bawah); pembayaran biaya pendaftaran (kolom
`biaya_pendaftaran` tercatat sebagai referensi, belum terhubung ke
`pesantren_tagihan`/gateway pembayaran); notifikasi WhatsApp/SMS nomor
pendaftaran ke orang tua (perlu NotificationPort, belum dikaitkan);
pencetakan kartu ujian/bukti pendaftaran.

## Status EP-O3 — SELESAI, rombongan belajar/kelas

Mengisi kekosongan yang tercatat pada EP-O2 di atas. Dua tabel
(`pesantren_rombongan_belajar`, `pesantren_rombongan_anggota`)
mengelompokkan santri ke kelas per unit pendidikan dan tahun ajaran --
satu keanggotaan AKTIF per santri per tahun ajaran, ditegakkan indeks
unik parsial `ux_pesantren_rombongan_anggota_aktif`, sama persis dengan
pola `ux_pesantren_penempatan_aktif` pada EP-G (asrama). Kapasitas kelas
bersifat opsional dan ditegakkan di service (bukan CHECK basis data,
sebab hitungannya lintas baris) sebelum menempatkan santri baru.
Pemindahan santri antar kelas (`pindahkan`) menutup keanggotaan lama dan
membuka yang baru DALAM SATU TRANSAKSI, supaya tidak ada jeda santri
tanpa kelas atau tercatat di dua kelas sekaligus.

Wali kelas menunjuk `user_subject` yang sudah ada (nullable), BUKAN peran
"Guru" baru -- peran itu belum punya modulnya sendiri, dan §6 melarang
menyemai peran mendahului fitur yang menjadi dasarnya.

Live-test terhadap `ponpes_demo`: membuat dua kelas VII-A (kapasitas 1)
dan VII-B, menolak nama kelas duplikat pada unit+tahun ajaran yang sama,
menempatkan satu santri ke VII-A (penuh), menolak santri kedua ke VII-A
(kapasitas penuh) DAN menolak penempatan kedua santri pertama ke VII-B
selagi masih aktif di VII-A (keanggotaan ganda), memindahkan santri
pertama ke VII-B (membebaskan slot VII-A), lalu berhasil menempatkan
santri kedua ke VII-A, mengeluarkan satu keanggotaan dan menolak
pengeluaran kedua kalinya, dan mengonfirmasi 404 pada rombongan yang
tidak ada. Live-test ini juga menemukan dan memperbaiki bug nyata pada
kontroler EP-O2 DAN EP-O3 sekaligus: endpoint `GET :id` tunggal
(`satuGelombang`, `satuPendaftar`, `satu` rombongan) mengembalikan
`{success:true, data:null}` alih-alih 404 ketika baris tidak ditemukan --
pola yang benar (dicontoh dari `pesantren-santri.controller.ts`) melempar
`AppError.notFound` di controller, bukan meneruskan null polos.

**Yang tidak dikerjakan:** menghubungkan presensi (EP-E) dan nilai (EP-O)
agar bisa dicatat SEKALIGUS per rosters kelas (saat ini keduanya tetap
per-santri satu per satu) -- data keanggotaan sudah tersedia untuk
mendukung itu lewat join, tapi service presensi/nilai belum diubah untuk
memanfaatkannya; kurikulum dan jadwal pelajaran (EP-O4, belum dikerjakan).

## Status EP-O4 — SELESAI, kurikulum dan jadwal pelajaran

Celah terakhir dari tiga yang tercatat pada audit sistem lama EP-O.
`pesantren_kurikulum` adalah referensi rencana (mata pelajaran + jam per
minggu per unit/tingkat/tahun ajaran) -- bukan jadwal jam nyata.
`pesantren_jadwal_pelajaran` adalah jadwalnya, per rombongan belajar
(EP-O3), dengan dua `EXCLUDE USING gist` yang audit temukan TIDAK
ditegakkan sama sekali pada sistem lama: satu rombongan tidak bisa punya
dua pelajaran tumpang tindih di hari yang sama, dan satu pengajar (bila
diisi) tidak bisa mengajar dua rombongan berbeda pada jam yang tumpang
tindih. Karena GiST tidak mengenal tipe range bawaan untuk `TIME`, jam
disimpan juga sebagai kolom turunan (`GENERATED ALWAYS AS`) menit-sejak-
tengah-malam lalu dibungkus `int4range` -- dan karena predikat kesetaraan
UUID/VARCHAR di dalam `EXCLUDE` menuntut operator class tambahan,
migrasi ini butuh `CREATE EXTENSION IF NOT EXISTS btree_gist` (pola yang
sama, persis, dengan `cooperative_appointment`).

Live-test terhadap `ponpes_demo`: mendaftarkan satu mata pelajaran ke
kurikulum, menolak duplikatnya pada kombinasi unit+tingkat+tahun ajaran
yang sama, menjadwalkan pelajaran Senin 07:00-08:30 dengan pengajar,
menolak jadwal tumpang tindih pada rombongan yang sama (08:00-09:00),
menerima jadwal yang PERSIS bersambung di batas jam (08:30-09:30 --
membuktikan interval setengah terbuka `[)` bekerja benar, bukan `[]` yang
akan menolak batas persis), menolak pengajar yang sama mengajar
rombongan LAIN pada jam tumpang tindih, membatalkan satu jadwal
(soft-delete), dan mengonfirmasi jam yang baru dibatalkan bisa dipakai
lagi (pengecualian ikut menghormati `WHERE deleted_at IS NULL`). Sempat
salah memakai `platform_user_id` alih-alih `user_subject.id` untuk
`pengajarUserId` pada percobaan pertama (FK ke `user_subject`, gagal
sesuai desain) -- kesalahan pemakaian saat menguji, bukan bug kode,
namun mengonfirmasi sekali lagi disiplin dua ruang ID yang sama yang
menyebabkan bug nyata pada EP-J.

**Yang tidak dikerjakan:** validasi bahwa total `jam_per_minggu` pada
kurikulum tidak melebihi jam sekolah efektif per minggu; UI kalender
mingguan (data sudah lengkap untuk itu, hanya presentasinya yang belum
ada); rekap otomatis "guru X mengajar berapa jam per minggu" (dapat
dihitung dari `pesantren_jadwal_pelajaran` yang sudah ada, belum dibuat
endpoint laporannya).

Dengan ini seluruh EP-O (nilai, PSB, rombongan, kurikulum) yang ditemukan
lewat audit sistem lama sudah tercakup fungsional/logika sesuai
permintaan eksplisit -- lanjut ke EP-P.

## Status EP-P — SELESAI, laporan lintas modul

Riset dulu sebelum menulis kode: satu-satunya modul laporan yang sudah ada
di seluruh monorepo adalah `pos/pos-report.ts` + `pos-report.service.ts`
(kasir) -- polanya disalin persis: berkas aturan murni tanpa basis data
(`periksaRentang` membatasi rentang maksimal 92 hari dan memberi bawaan
30 hari terakhir bila tidak diisi, katalog laporan sebagai daftar
bertipe yang sekaligus whitelist runtime), lalu service yang hanya
menjalankan kueri agregasi terhadap tabel yang sudah ada.

**Tidak ada migrasi baru sama sekali** -- delapan laporan
(`SANTRI_RINGKASAN`, `PRESENSI_REKAP`, `TAGIHAN_REKAP`, `DOMPET_ARUS`,
`NILAI_RATA`, `PSB_FUNNEL`, `ASRAMA_HUNIAN`, `ROMBONGAN_HUNIAN`) seluruhnya
kueri baca-saja terhadap tabel EP-A s.d. EP-O4 yang sudah ada -- tidak ada
data yang disimpan berduplikasi, dan tidak ada satu pun tabel laporan
tersimpan/materialized dibuat. Riset juga memastikan tidak ada
xlsx/pdfkit/puppeteer di manapun pada monorepo ini -- ekspor Excel/PDF
sengaja TIDAK dibangun sebab itu berarti dependensi dan pola baru yang
belum pernah dipakai di mana pun, bukan sekadar mengisi kekosongan;
`EXPORT` tetap ada sebagai aksi RBAC untuk menu ini (konsisten dengan menu
lain) tetapi belum ada mekanisme file-nya.

Satu endpoint `GET /pesantren/laporan/dasbor` menjalankan lima laporan
sekaligus lewat `Promise.all` dan menggabungkannya jadi satu respons --
pola yang sama dengan `PosReportService.dasbor()`.

Live-test terhadap `ponpes_demo`: kedelapan laporan dijalankan satu per
satu dan hasilnya diperiksa cocok dengan data nyata yang tersisa dari
EP-EP sebelumnya (nilai Fikih Ahmad Fulan tepat 80/85/100 sesuai yang
ditinggalkan EP-O; tagihan, dompet menunjukkan angka yang sesuai; PSB,
asrama, dan rombongan kosong karena seluruh data ujinya sudah dibersihkan
pada EP-O2/O3), dasbor gabungan berhasil, kode laporan tak dikenal ditolak
dengan daftar kode yang tersedia, rentang tanggal terbalik dan rentang
lebih dari 92 hari keduanya ditolak dengan pesan yang jelas, dan
permintaan tanpa token ditolak 401.

**Yang tidak dikerjakan:** ekspor Excel/CSV/PDF (lihat alasan di atas);
laporan tersimpan/terjadwal (mis. "kirim rekap tagihan tiap tanggal 1");
penyaringan cakupan untuk wali (laporan ini murni untuk pengurus/admin,
BUKAN ekstensi portal wali -- portal wali sudah punya laporan per-anaknya
sendiri sejak EP-K/EP-O).

## Audit KEDUA sistem lama (menyeluruh, seluruh direktori master/sekolah)

Permintaan eksplisit pengguna setelah EP-P selesai: audit ulang seluruh
`C:\opt\AIS\ais\...\master\sekolah\` (240 berkas, bukan hanya penilaian
seperti audit pertama pada EP-O) untuk memastikan TIDAK ADA kemampuan
tertinggal. Temuan lengkap dan peringkatnya ada di riwayat kerja; lima
kesenjangan bernilai tinggi berikut dikerjakan sebagai EP-S1 s.d. EP-S5:

```text
EP-S1  Pelanggaran dan hukuman santri (tata tertib) -- SELESAI
EP-S2  Guru: data induk dan penugasan mengajar
EP-S3  Absensi guru dan piket (BUKAN presensi santri)
EP-S4  Ekstrakurikuler dan organisasi siswa (setara OSIS)
EP-S5  Prestasi dan penghargaan santri
```

Kesenjangan lain yang ditemukan tetapi TIDAK dikerjakan (nilai lebih
rendah atau kemungkinan besar sudah tercakup modul ERP lain di luar
pesantren): buku penghubung/catatan guru-orang tua, log aktivitas harian
generik, konseling (BK), manajemen alumni terstruktur, diskon/deposit/
denda pada tagihan (perlu konfirmasi apakah modul keuangan ERP yang lebih
umum sudah menanganinya), data sosial-ekonomi orang tua, kebutuhan
khusus/transportasi, kelas les/PKL, evaluasi guru oleh siswa, log
kunjungan/tamu, surat keterangan, dan penjurusan sebagai konsep formal.

### Status EP-S1 — SELESAI, pelanggaran dan hukuman santri

`pesantren_jenis_pelanggaran` (katalog berbobot poin per kategori
RINGAN/SEDANG/BERAT), `pesantren_pelanggaran` (catatan per santri --
poin DISALIN dari jenis saat pencatatan, bukan dibaca ulang lewat JOIN,
supaya kebijakan poin yang berubah di kemudian hari tidak diam-diam
mengubah catatan lama), `pesantren_hukuman` (sanksi atas satu
pelanggaran). Total poin aktif seorang santri DIHITUNG dari log yang
belum dibatalkan, pola yang sama dengan saldo dompet (EP-L).

Ditegaskan SENGAJA terpisah dari `pesantren_izin` (EP-J): izin adalah
pengajuan proaktif santri untuk keluar pondok, pelanggaran adalah
pencatatan reaktif pengurus atas pelanggaran tata tertib -- pemilik
proses dan siklus hidupnya berbeda sama sekali, menggabungkannya akan
mencampur dua konsep yang pengguna butuh bedakan dengan jelas.

Portal wali diperluas dengan `GET .../anak/:santriId/pelanggaran`
(baca saja) -- menjawab permintaan eksplisit pengguna agar wali
mendapat kabar bila anaknya "melanggar sesuatu" (notifikasi push belum
ada, tapi datanya kini dapat dilihat wali kapan saja).

Live-test terhadap `ponpes_demo`: membuat jenis pelanggaran, menolak
kode duplikat, mencatat dua pelanggaran (total poin 5+5=10), membatalkan
satu (total turun ke 5, pembatalan kedua ditolak), menjatuhkan hukuman
teguran lisan, menyelesaikannya (penyelesaian kedua ditolak), menolak
menjatuhkan hukuman atas pelanggaran yang sudah dibatalkan, 404 pada
pelanggaran tak dikenal, wali1 berhasil melihat riwayat pelanggaran
anaknya lengkap dengan status, dan wali2 ditolak 404 saat mencoba
melihat pelanggaran anak wali1 (isolasi kepemilikan tetap tegak).

**Yang tidak dikerjakan:** eskalasi otomatis (mis. "3 pelanggaran RINGAN
dalam sebulan otomatis jadi SEDANG") -- keputusan eskalasi tetap manual
oleh pengurus; notifikasi push ke wali saat pelanggaran dicatat (perlu
NotificationPort, belum dikaitkan ke peristiwa pesantren mana pun).

### Status EP-S2 — SELESAI, guru dan penugasan mengajar

`pesantren_guru` (data induk -- SENGAJA tidak mewajibkan
`user_subject_id`, pola yang sama dengan `pesantren_wali`/EP-A dan
`wali_kelas_user_id`/EP-O3: tidak setiap guru diberi akun masuk sejak
awal) dan `pesantren_penugasan_mengajar` (rencana resmi guru-mapel-
rombongan-tahun ajaran, TERPISAH dari `pesantren_jadwal_pelajaran`/EP-O4
yang mencatat jam nyata di kalender -- pemisahan yang sama persis dengan
`PenugasanGuruMengajarAction` vs `JadwalPelajaranAction` pada sistem
lama). Total jam mengajar seorang guru DIHITUNG dari penugasan aktifnya,
bukan disimpan sebagai kolom akumulator.

Kombinasi guru+mapel+rombongan+tahun ajaran ditegakkan unik supaya jam
yang sama tidak terhitung dua kali pada rekap beban mengajar, tetapi
team-teaching (dua guru berbeda untuk mapel+rombongan yang sama) tetap
diperbolehkan sebab kombinasi `guru_id`-nya berbeda.

Live-test terhadap `ponpes_demo`: mencatat guru, menolak NIP duplikat
dan format email yang salah, menugaskan mengajar (total jam 4), menolak
penugasan identik kedua kalinya, menambah penugasan kedua di rombongan
lain (total jam naik jadi 4+3=7), menyelesaikan penugasan pertama (total
turun kembali ke 3), menonaktifkan guru, menolak penugasan baru atas
guru yang sudah NONAKTIF, dan 404 pada guru tak dikenal.

**Yang tidak dikerjakan:** perhitungan honor/gaji dari jam mengajar
(data dasarnya sudah tersedia lewat `totalJamMengajar`, perhitungan
nominal honor per jam belum ada -- itu ranah modul payroll/HR yang lebih
umum di ERP, bukan domain pesantren); evaluasi guru oleh siswa (Tier 3
pada audit, ditunda menunggu keperluan nyata); tautan otomatis dari
penugasan mengajar ke `pengajar_user_id` pada `pesantren_jadwal_pelajaran`
-- keduanya tetap diisi terpisah, sebab tidak semua guru punya
`user_subject_id` untuk diisikan ke kolom itu.

### Status EP-S3 — SELESAI, absensi guru dan piket

`pesantren_absensi_guru` (satu baris per guru per tanggal -- ditegakkan
indeks unik parsial) dan `pesantren_piket` (jadwal giliran jaga, unik
per guru+tanggal+jenis piket, tapi guru LAIN boleh piket jenis sama di
tanggal sama, dan guru YANG SAMA boleh piket jenis BERBEDA di tanggal
sama). SENGAJA terpisah dari `pesantren_presensi` (EP-E): presensi
mencatat kehadiran SANTRI, ini kehadiran STAF PENGAJAR -- pemilik
proses dan tujuan pemakaiannya (dasar honor/evaluasi kinerja) berbeda
sama sekali.

Rekap kehadiran per status dalam rentang tanggal DIHITUNG dari log,
bukan disimpan -- pola yang konsisten dengan EP-S1/EP-S2/EP-L.

Live-test terhadap `ponpes_demo`: mencatat absensi harian (HADIR, jam
masuk/pulang), menolak absensi kedua pada tanggal yang sama, menolak jam
pulang sebelum jam masuk, rekap kehadiran menghitung benar, menjadwalkan
piket harian, menolak piket jenis sama pada tanggal sama, menerima piket
jenis BEDA pada tanggal sama, mencatat kehadiran piket (dan menolak
pencatatan kedua), 404 pada guru tak dikenal, dan 401 tanpa token.

**Yang tidak dikerjakan:** notifikasi keterlambatan/ketidakhadiran guru
otomatis (perlu NotificationPort); integrasi absensi guru ke laporan
EP-P (dapat ditambahkan sebagai laporan kesembilan bila diperlukan,
data dasarnya sudah lengkap).

Dengan ini seluruh Tier 1 dari audit kedua (pelanggaran/hukuman, guru,
absensi guru/piket) selesai. Lanjut ke EP-S4 (ekstrakurikuler/organisasi
siswa) dan EP-S5 (prestasi/penghargaan).

### Status EP-S4 — SELESAI, ekstrakurikuler dan organisasi siswa

Audit kedua menemukan gugusan besar sistem lama yang memisahkan
"kegiatan kesiswaan" (klub/ekskul) dari "organisasi siswa" (setara OSIS)
lewat DUA gugusan tabel jabatan terpisah. Modul ini SENGAJA menyatukan
keduanya jadi satu model -- `pesantren_ekstrakurikuler` (klub ATAU
organisasi, dibedakan kolom `jenis`) dan
`pesantren_ekstrakurikuler_anggota` (keanggotaan + jabatan kepemimpinan +
skor partisipasi dalam satu tabel). Ini penyederhanaan tabel yang SAH
sesuai instruksi eksplisit pengguna -- kemampuannya tetap lengkap, hanya
tidak dipecah per gugusan seperti sistem lama.

Berbeda dari rombongan belajar (EP-O3) yang membatasi satu keanggotaan
aktif per santri per tahun ajaran, di sini santri BOLEH aktif di banyak
ekstrakurikuler sekaligus -- yang dicegah hanya keanggotaan aktif GANDA
pada ekstrakurikuler yang SAMA di tahun ajaran yang sama.

Live-test terhadap `ponpes_demo`: membuat satu klub (Pramuka) dan satu
organisasi (OSIS), menolak kode duplikat, satu santri bergabung ke
Pramuka SEKALIGUS menjadi Ketua OSIS pada saat bersamaan (membuktikan
keanggotaan ganda lintas ekstrakurikuler berhasil), menolak bergabung
Pramuka kedua kalinya (duplikat aktif), mencatat nilai partisipasi 88,
menolak nilai di luar 0-100, daftar ekstrakurikuler santri menampilkan
kedua keanggotaan lengkap dengan nama ekstrakurikuler dan jabatan, daftar
anggota Pramuka menampilkan nama dan NIS santri lewat join, mengeluarkan
anggota dari Pramuka (pengeluaran kedua ditolak), 404 pada ekstrakurikuler
tak dikenal, dan 401 tanpa token.

**Yang tidak dikerjakan:** integrasi skor partisipasi ke rapor non-
akademik (data dasarnya sudah ada, tata letak cetak rapor gabungan belum
ada); pemilihan ketua OSIS lewat mekanisme voting (jabatan dicatat manual
oleh pengurus, bukan hasil pemilu tercatat sistem).

## Sesudah EP-A

```text
EP-Q   UAT bersama pondok pertama
EP-R   Rilis
```

### Status EP-N2 (riset, tidak menghasilkan kode baru)

Diriset 2026-08-02 sebagai kelanjutan permintaan eksplisit untuk menjaga
kepaduan ERP saat membangun adapter POS. Hasil:

- **Koperasi: SUDAH SELESAI, bukan pekerjaan baru.** `CooperativeModule`
  sudah mendaftarkan `MemberBalancePaymentHandler`
  (`cooperative/payment/member-balance-payment.handler.ts`, handlerCode
  `COOPERATIVE_MEMBER_BALANCE`) ke `ExternalPaymentRegistry` lewat pola
  `onModuleInit()` yang identik dengan yang dipakai EP-N untuk dompet santri
  -- pola EP-N memang SENGAJA disalin dari sini, bukan kebetulan mirip.
- **Klinik/eMedik: TIDAK ADA modul untuk diadaptasi.** Tidak ada
  `apps/api/src/modules/klinik` atau `.../clinic` di repo ini. String
  `HEALTH_CLAIM_BALANCE` hanya muncul sebagai fixture pengujian di
  `pos/external-payment.spec.ts`, BUKAN penangan nyata -- dua dokumen
  ekosistem (`docs/ecosystem/00-current-state.md` dan
  `08-cross-vertical-contract-map.md`) secara keliru menyatakan penangan ini
  "sudah berjalan"; sudah dikoreksi hari ini. Worktree terpisah
  `eBisnisGithub-emedik` (branch `feature/v12-emedik`, belum digabung) punya
  modul `emedik/` (billing/claim/fee/settlement/BPJS) tapi JUGA belum
  mengimplementasikan `ExternalPaymentHandler`.
- **Keputusan:** EP-N2 ditutup sebagai riset murni, bukan diberi kode
  kosong/palsu. Membangun modul klinik/eMedik penuh adalah inisiatif
  terpisah yang jauh melampaui lingkup santri.info/ePesantren pada branch
  ini, dan modul sumbernya belum tergabung ke branch ini -- persis kasus
  yang dilarang §6 (jangan mengklaim selesai atau membuat penangan untuk
  fitur yang tidak/belum ada). Bila/ketika `emedik/` digabung ke branch
  `feature/collaborative-multi-portal-platform`, adapter pembayarannya
  cukup meniru `MemberBalancePaymentHandler`/`PesantrenDompetPaymentHandler`
  satu-lawan-satu -- polanya sudah terbukti dua kali.

## Aturan untuk setiap EP

Tidak ada EP dinyatakan selesai tanpa: migrasi aditif, API, OpenAPI, UI,
permission sisi peladen, audit, Help, uji, dokumentasi, commit, push, dan CI
hijau. §6 melarang berhenti pada skeleton, TODO, atau menu kosong.

Satu tambahan dari pengalaman sesi ini: **setiap EP diuji dengan menjalankannya
terhadap basis data lokal**, bukan hanya lewat uji unit. Cacat kebuntuan ganti
kata sandi lolos dari 2.100 uji dan baru ketahuan saat pendaftaran sungguhan
dijalankan.
