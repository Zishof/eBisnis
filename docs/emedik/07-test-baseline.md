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
| H-5 | 30 | **64** | `health-lab.spec.ts` |
| H-6 | 30 | **53** | `health-inpatient.spec.ts` |
| H-7 | 35 | **60** | `health-acute.spec.ts` |
| H-8 | 30 | **54** | `health-community.spec.ts` |
| H-9 | 30 | **67** | `health-him.spec.ts` |
| H-9L | 25 | **53** | `health-master-data.spec.ts` |
| H-9N | 20 | **45** | `health-accounting.spec.ts` |
| H-9D | 25 | **46** | `health-tariff.spec.ts` |
| H-9E | 25 | **56** | `health-fee.spec.ts` |
| H-9F | 25 | **42** | `health-settlement.spec.ts` |
| H-9G | 20 | **42** | `health-fee-contract.spec.ts` |
| H-9C | 30 | **58** | `health-claim.spec.ts` |
| H-9H | 25 | **49** | `health-device.spec.ts` |
| H-9J | 25 | **76** | `health-device-maintenance.spec.ts` |
| H-9K | 20 | **56** | `health-investor.spec.ts` |
| H-9I | 25 | **88** | `health-device-adapter.spec.ts` |
| H-9A | 20 | **48** | `health-satusehat.spec.ts` |
| H-9B | 20 | **51** | `health-bpjs.spec.ts` |
| H-9M | 20 | **41** | `health-kfa.spec.ts` |
| H-10 | 25 | **54** | `health-portal.spec.ts` |
| H-11 | 25 | **35** | `health-sample.spec.ts` |
| H-12 | 40 | **75** | `health-security.spec.ts` |

API keseluruhan: **2506** pengujian pada 72 berkas. Web: **127** pada 8 berkas,
92 di antaranya kesehatan (`health-api.spec.ts` 40, `puskesmas-pages.spec.tsx` 16,
`him-pages.spec.tsx` 24, `claim-pages.spec.tsx` 12).

Seluruh dua belas fase melampaui sasaran minimumnya. Jumlah minimum yang
ditetapkan H-0 adalah 370 pengujian baru; yang terpasang jauh di atasnya.

Jumlah H-1 pada tabel di atas naik dari 56 menjadi 62: enam pengujian katalog
baru mengunci dua keputusan hak akses H-9 yang berlawanan arah — pelaporan
insiden yang sengaja luas, dan penahanan hukum yang sengaja sempit.

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
| H-5 | `prove-health-lab.mjs` | 44 pemeriksaan, seluruhnya lulus — [bukti-h5-laboratorium.txt](bukti-h5-laboratorium.txt) |
| H-6 | `prove-health-inpatient.mjs` | 41 pemeriksaan, seluruhnya lulus — [bukti-h6-rawat-inap.txt](bukti-h6-rawat-inap.txt) |
| H-7 | `prove-health-acute.mjs` | 55 pemeriksaan, seluruhnya lulus — [bukti-h7-akut.txt](bukti-h7-akut.txt) |
| H-8 | `prove-health-community.mjs` | 45 pemeriksaan, seluruhnya lulus — [bukti-h8-puskesmas.txt](bukti-h8-puskesmas.txt) |
| H-9 | `prove-health-him.mjs` | 74 pemeriksaan, seluruhnya lulus — [bukti-h9-rekam-medis.txt](bukti-h9-rekam-medis.txt) |
| H-9L | `prove-health-master-data.mjs` | 61 pemeriksaan, seluruhnya lulus — [bukti-h9l-master-data.txt](bukti-h9l-master-data.txt) |
| H-9N | `prove-health-accounting.mjs` | 56 pemeriksaan, seluruhnya lulus — [bukti-h9n-akuntansi.txt](bukti-h9n-akuntansi.txt) |
| H-9D | `prove-health-tariff.mjs` | 43 pemeriksaan, seluruhnya lulus — [bukti-h9d-tarif.txt](bukti-h9d-tarif.txt) |
| H-9E | `prove-health-fee.mjs` | 50 pemeriksaan, seluruhnya lulus — [bukti-h9e-jasa.txt](bukti-h9e-jasa.txt) |
| H-9F | `prove-health-settlement.mjs` | 56 pemeriksaan, seluruhnya lulus — [bukti-h9f-settlement.txt](bukti-h9f-settlement.txt) |
| H-9G | `prove-health-fee-contract.mjs` | 52 pemeriksaan, seluruhnya lulus — [bukti-h9g-kontrak-fee.txt](bukti-h9g-kontrak-fee.txt) |
| H-9C | `prove-health-claim.mjs` | 56 pemeriksaan, seluruhnya lulus — [bukti-h9c-klaim.txt](bukti-h9c-klaim.txt) |
| H-9H | `prove-health-device.mjs` | 60 pemeriksaan, seluruhnya lulus — [bukti-h9h-alat.txt](bukti-h9h-alat.txt) |
| H-9J | `prove-health-device-maintenance.mjs` | 81 pemeriksaan, seluruhnya lulus — [bukti-h9j-pemeliharaan-alat.txt](bukti-h9j-pemeliharaan-alat.txt) |
| H-9K | `prove-health-investor.mjs` | 62 pemeriksaan, seluruhnya lulus — [bukti-h9k-investor.txt](bukti-h9k-investor.txt) |
| H-9I | `prove-health-device-adapter.mjs` | 58 pemeriksaan, seluruhnya lulus — [bukti-h9i-adapter-alat.txt](bukti-h9i-adapter-alat.txt) |
| H-9A | `prove-health-satusehat.mjs` | 56 pemeriksaan, seluruhnya lulus — [bukti-h9a-satusehat.txt](bukti-h9a-satusehat.txt) |
| H-9B | `prove-health-bpjs.mjs` | 62 pemeriksaan, seluruhnya lulus — [bukti-h9b-bpjs.txt](bukti-h9b-bpjs.txt) |
| H-9M | `prove-health-kfa.mjs` | 52 pemeriksaan, seluruhnya lulus — [bukti-h9m-kfa.txt](bukti-h9m-kfa.txt) |
| H-10 | `prove-health-portal.mjs` | 63 pemeriksaan, seluruhnya lulus — [bukti-h10-portal.txt](bukti-h10-portal.txt) |
| H-11 | `prove-health-sample.mjs` | 55 pemeriksaan, seluruhnya lulus — [bukti-h11-data-contoh.txt](bukti-h11-data-contoh.txt) |
| H-12 | `prove-health-security.mjs` | 92 pemeriksaan, seluruhnya lulus — [bukti-h12-keamanan.txt](bukti-h12-keamanan.txt) |
| W-2/W-3 | `prove-web-contract.mjs` | 23 pemeriksaan, seluruhnya lulus — [bukti-kontrak-web.txt](bukti-kontrak-web.txt) |

### W-1 · Layar Puskesmas — dan batas uji komponen

Fase layar pertama menemukan cacat yang **lolos dari seluruh uji komponennya**,
dan cara ia lolos lebih berharga daripada cacatnya sendiri.

`CoveragePage` membaca `percentage` dan `shortfall`; peladen mengirim
`coverage`, `gap`, dan `message`. Halamannya melempar TypeError dan **kosong
sama sekali** — bukan menampilkan angka yang salah, melainkan tidak menampilkan
apa pun.

Enam uji komponen atas halaman itu lulus, sebab perlengkapan datanya ditulis
tangan **dengan andaian yang sama kelirunya**. Perlengkapan yang keliru dan kode
yang keliru saling menyetujui, dan keduanya tidak sesuai kenyataan.

> **Uji yang perlengkapannya ditulis penulis kodenya sendiri tidak dapat
> membuktikan kontrak dengan peladen.** Ia membuktikan bahwa komponennya
> berperilaku benar terhadap bentuk data yang diandaikan penulisnya — pernyataan
> yang jauh lebih lemah daripada yang tampak.

Yang menemukannya: membuka halamannya pada peladen sungguhan. Sesudah itu
seluruh bentuk jawaban H-8 diperiksa langsung ke peladen, dan menemukan
kekeliruan kedua — `verdict.reason` pada imunisasi berisi KODE (`TOO_YOUNG`),
bukan kalimat; kalimatnya pada `verdict.message`, dan `verdict.earliestDate`
yang menjawab "kapan giliran anak saya" tidak pernah dipakai.

Perlengkapan ujinya kini disalin dari jawaban peladen sungguhan, dan peringatan
tentang batas ini ditulis di kepala berkas ujinya — supaya yang menambah uji
berikutnya tahu apa yang sedang dan tidak sedang dibuktikannya.

**W-2 menutup celahnya secara permanen.** `prove-web-contract.mjs` memanggil
setiap jalan yang dipakai klien web pada peladen sungguhan, lalu membandingkan
medan jawabannya dengan medan wajib yang **dibaca dari `health-api.ts`** —
bukan disalin ke dalam naskahnya, sebab naskah yang membandingkan salinan
dengan salinan tidak membuktikan apa pun.

Dua sifat naskah itu yang menentukan:

1. **Ia membuat sendiri baris yang diperlukannya** lewat jalan API sungguhan.
   Bukti yang melewatkan jalan tanpa data akan berkata seluruh kontrak cocok
   sekalipun jalan paling rawan tidak pernah dilihat — dan pada W-1 jalan yang
   rusak justru `coverage`, yang pada mulanya kosong.
2. **Jalan yang tetap kosong dilaporkan sebagai belum terbukti**, bukan
   dihitung lulus. Angkanya dicetak sebagai "daftar yang masih harus dilihat
   orang".

Naskah itu segera menemukan cacat yang tidak ditemukan uji mana pun: menimbang
pasien dewasa menjawab **500 INTERNAL_ERROR** dari pelanggaran constraint umur,
dan itu terjangkau langsung dari layar Pertumbuhan W-1. Kini 422 beserta umurnya
dan jalan keluarnya.

Ini kemunculan **ketiga dan keempat** cacat yang sama sepanjang dua fase
terakhir: nama yang ditulis dari dugaan, bukan dibaca dari sumbernya.

**H-12 menemukan tiga cacat, dan dua di antaranya adalah cacat yang sama
berulang: kosakata yang disusun dari ingatan alih-alih dibaca dari skema.**

### 1. Kosakata tujuan penggunaan yang tidak pernah ada

Modul H-12 menyusun delapan tujuan penggunaan, memuat `PUBLIC_HEALTH` dan
menghilangkan `QUALITY`. Constraint `health_access_purpose_valid` pada H002
memuat `QUALITY` dan tidak pernah memuat `PUBLIC_HEALTH`.

Akibatnya bukan galat pada saat itu juga, melainkan sesuatu yang jauh lebih
sulit ditemukan: sebuah jalan yang **menerima** tajuk `X-Purpose-Of-Use:
PUBLIC_HEALTH`, membiarkan aksesnya berjalan, lalu gagal ketika mencatatnya.
**Aksesnya terjadi; catatannya tidak.** Rekam medis terbuka tanpa meninggalkan
jejak — kegagalan terburuk yang mungkin terjadi pada sistem jejak akses.

Ini kemunculan **kedua** cacat yang sama. Yang pertama H-9J: aksi `CLOSE`
disusun dari ingatan, tidak ada pada kosakata hak akses, dan teknisi tidak
dapat menutup perintah kerjanya.

Naskah buktinya kini membaca constraint itu langsung dari `pg_constraint` dan
membandingkannya dengan daftar yang dikembalikan API — lalu **menuliskan setiap
tujuan ke jejak akses** untuk memastikan yang diterima API benar-benar dapat
dicatat. Daftar yang cocok belum membuktikan apa pun bila tidak satu pun
barisnya pernah ditulis.

### 2. "Break-glass tidak pernah ditolak" ternyata tidak benar pada sistem ini

Rancangan H-12 menyatakan prinsip: break-glass tidak pernah ditolak, sebab
menolaknya akan menghentikan dokter yang menangani pasien tidak sadarkan diri.

Basis data membetulkannya. Constraint `health_access_breakglass_needs_reason`
dari H002 menuntut alasan sekurang-kurangnya **sepuluh huruf**, dan yang lebih
pendek ditolak — termasuk yang kosong dan yang berbunyi `cek`.

Tuntutan itu benar dan dipertahankan, bukan dilonggarkan: sepuluh huruf
kira-kira dua kata, bukan hambatan bagi orang yang sedang menolong, sedangkan
break-glass tanpa satu pun kata tidak dapat ditelaah siapa pun — dan yang tidak
dapat ditelaah sama saja dengan yang tidak dicatat.

Yang diperbaiki adalah modulnya, sehingga prinsipnya menjadi tepat: break-glass
tidak pernah ditolak **atas dasar penilaian tentang keadaan daruratnya**, dan
satu-satunya dasar penolakan adalah alasan yang terlalu pendek untuk ditelaah.
Modulnya kini menyalin angka sepuluh dari constraint itu, bukan memilih
angkanya sendiri: fungsi yang memakai angka berbeda akan meloloskan permintaan
yang kemudian ditolak basis data, dengan pesan galat yang tidak dapat dibaca
siapa pun.

### 3. Dua belas dari dua puluh nama kolom keliru — dan tidak ada yang gagal

Migrasi penggolongan medan menyebut dua puluh kolom. Diuji ke skema sungguhan,
hanya delapan yang ada. `patient.nik`, `patient.medical_record_number`,
`clinical_note.content`, `encounter_diagnosis.diagnosis_code`,
`rx_prescription_item.*` — tidak satu pun ada; nama sebenarnya berbeda, dan
sebagian datanya berada di tabel lain sama sekali.

Rancangan pertamanya melewati kolom yang tidak ditemukan dan mencatatnya
sebagai NOTICE. Yang dihasilkannya bukan daftar yang kurang lengkap melainkan
**daftar yang tampak penuh**: delapan baris terpasang, tidak ada galat, dan
siapa pun yang membuka layar penggolongan melihat perlindungan yang berdiri —
padahal NIK, nomor rekam medis, isi catatan klinis, dan kode diagnosis tidak
ada di dalamnya sama sekali.

Migrasinya kini **gagal** bila satu kolom pun tidak ada, dan naskah buktinya
memeriksa ke `information_schema` bahwa tidak ada penggolongan yang menunjuk
kolom yang tidak ada. Pelajaran H037 berlaku persis: lewatan yang diam lebih
buruk daripada kegagalan yang berisik.

### Cacat pada Core yang ditemukan sepanjang jalan

Ketika kekeliruan tipe kolom pada migrasi pertama diperbaiki dan dijalankan
ulang, penjaga checksum menolaknya: **percobaan yang GAGAL sudah menuliskan
checksum-nya pada riwayat, dan penjaga itu tidak membedakan GAGAL dari
BERHASIL.** Cabang yang lebih berbahaya bukan penolakan itu, melainkan
kebalikannya — migrasi yang gagal lalu dijalankan ulang **tanpa diubah**
dilaporkan sebagai *sudah diterapkan*, padahal tabelnya tidak pernah dibuat.

Diajukan lewat
[005 — riwayat migrasi gagal mengunci versi](../integration-requests/health/005-riwayat-migrasi-gagal-mengunci-versi.md).
Berkas Core tidak disentuh; nomor H055 dan H056 dihanguskan dan isinya
dipindahkan ke H057 dan H058, persis seperti yang diperintahkan pesan galatnya.

### Yang paling penting dibuktikan naskah H-12

Isolasi antar-tenant dibuktikan sebagaimana H-10 membuktikan isolasi portal:
bukan dengan memeriksa satu jalan lalu menyimpulkan sisanya, melainkan dengan
**mencoba seluruhnya**. Naskah ini membuat pengguna sungguhan pada tenant
kedua — dengan hak akses keamanan yang **penuh** pada tenantnya sendiri,
sehingga penolakannya datang dari isolasi dan bukan dari ketiadaan hak — lalu
memakainya menembak kesembilan jalan keamanan milik tenant pertama.

Yang diperiksa bukan status kodenya melainkan **isinya**: token tenant kedua
boleh saja menerima 200, sebab ia memang punya zona dan antrean sendiri. Yang
tidak boleh adalah barisnya berasal dari tenant pertama.

**H-11 menemukan cacat yang paling halus di antara seluruh fase, dan ia
ditemukan sebelum naskah buktinya dijalankan sama sekali.**

Migrasi `H052` mengisi daftar izin pembersihan dengan **setiap** tabel yang
punya kolom penanda contoh — tiga puluh empat tabel. Tetapi "membersihkan" pada
fase ini berarti **menyembunyikan**, dan menyembunyikan menuntut kolom
`deleted_at`. Hanya sepuluh dari ketiga puluh empat tabel itu memilikinya.

Akibatnya bukan galat. Pembersihan pada dua puluh empat tabel sisanya akan
berjalan, melaporkan keberhasilan, dan **tidak menyembunyikan apa pun** — jenis
kegagalan yang paling buruk, sebab ia menghasilkan laporan yang berkata
"selesai" dan keadaan yang tidak berubah. Orang yang membacanya akan menyerahkan
sistemnya kepada penggunanya dengan data contoh masih di dalamnya.

Perbaikannya bukan menambahkan `deleted_at` pada dua puluh empat tabel klinis:
perubahan sebesar itu menyentuh setiap modul sejak H-2 dan tidak boleh
diselipkan ke dalam fase data contoh. Yang dilakukan `H054` adalah
**mempersempit daftar izinnya** dan mencatat sisanya sebagai keterbatasan yang
dinyatakan. Ini pola yang berulang sepanjang eMedik: **ketika yang benar tidak
dapat dilakukan sepenuhnya, yang dilakukan adalah menyatakan batasnya — bukan
berpura-pura tidak ada batas.**

**Naskah buktinya menemukan cacat urutan.** Pembersihan menghitung baris
**sebelum** memeriksa daftar izin, sehingga nama tabel yang belum disahkan sudah
disisipkan ke dalam SQL — dan permintaan yang menyebut tabel di luar daftar
menghasilkan 500 alih-alih penolakan yang menjelaskan. Urutannya dibalik:
putuskan dahulu, hitung kemudian. Yang membedakan "belum disahkan" dari
"berbahaya" hanyalah keberuntungan tentang nama apa yang dikirimkan.

**Dan pengujian katalog menangkap satu kekeliruan penempatan.** Dua hak yang
seharusnya terpisah — menyemai dan membersihkan — keduanya masuk ke peran
administrator, sebab jangkar penyuntingannya cocok pada blok yang sama. Uji
"tidak ada peran bawaan yang melanggar aturannya sendiri" menolaknya seketika.
Ini kali kelima uji itu menangkap sesuatu, dan ia satu-satunya uji pada
keseluruhan proyek yang memeriksa **konsistensi antara aturan dan penerapannya**
alih-alih memeriksa perilaku.

**H-10 ditangkap oleh penjaga yang sudah ada sejak sebelum eMedik, dan itu
pelajaran tersendiri.**

Aplikasi **menolak menyala** ketika delapan rute portal ditambahkan tanpa
penanda hak akses. `route-authorization.audit.ts` menghitung setiap rute yang
terpasang dan melemparkan galat bila ada yang tidak menyatakan penandanya —
`@Permissions`, `@AuthenticatedOnly`, `@Public`, atau salah satu lainnya.

Yang membuatnya berharga bukan sekadar bahwa ia menangkap kelalaian. Rute portal
memang **tidak boleh** memakai `@Permissions`: pasien tidak punya peran pada
mesin hak akses menu, dan memberinya satu peran di sana berarti satu kekeliruan
konfigurasi memberinya hak yang dimiliki petugas. Penjaga itu memaksa keputusan
tersebut **dinyatakan**, bukan tersirat dari ketiadaan — dan pernyataan yang
tertulis dapat ditinjau, sedangkan ketiadaan tidak.

Ini kebalikan dari cacat H037: di sana penjaga yang lunak (`IF a_id IS NOT
NULL`) membuat migrasi diam ketika ada salah ketik. Di sini penjaga yang keras
menolak menyala. Yang kedua jauh lebih baik, dan alasannya sederhana: kegagalan
yang berisik ditemukan pada menit pertama; kelalaian yang diam ditemukan oleh
orang luar.

**Naskah bukti H-10 memakai bentuk yang belum pernah dipakai fase mana pun:
menjalankan SATU serangan pada SELURUH jalan.** Pasien A mengirimkan nomor
pasien B pada kelima jalan portal, dan naskahnya menuntut kelimanya menolak —
lalu menghitungnya, sebab "sebagian menolak" adalah kegagalan yang terlihat
seperti keberhasilan. Satu jalan yang lolos cukup untuk membocorkan seluruh
rekam medis rumah sakit, dan jalan yang lolos hampir selalu yang paling baru
ditambahkan.

Naskah ini pula yang memeriksa hal yang tidak dapat diperiksa dengan membaca
status: bahwa **angka hasil kritis tidak ada pada badan jawabannya sama
sekali**. Menyaringnya di layar akan lulus setiap uji yang memeriksa apa yang
tampak, dan gagal pada orang pertama yang membuka alat pengembang peramban.

**Naskah H-9M mengulang pelajaran H-9E dengan bentuk yang sedikit berbeda, dan
kali ini ia lulus pada jalan pertama lalu GAGAL pada jalan kedua.**

Uji "seluruh katalog kosong" benar pada jalan pertama. Pada jalan kedua ia
gagal — sebab jalan pertama sudah menerapkan impor KFA, dan katalog terminologi
bersifat tenant-wide: ICD-10 tidak berbeda antar fasilitas, sehingga penerapan
impor mengubah barisnya untuk seluruh tenant.

Pelajaran H-9E berbunyi *"naskah bukti yang mengukur keadaan seluruh basis data
harus mengukur sesuatu yang tidak dapat diubahnya sendiri"*. Di sana bentuknya
adalah menghitung baris yang lahir tanpa pembuat; di sini bentuknya adalah
**memilih katalog yang tidak pernah disentuh naskahnya** — naskah ini mengimpor
KFA dan LOINC, sehingga ICD-10, ICD-9-CM, SNOMED, dan WHO Growth adalah empat
saksi yang tidak dapat dipengaruhinya.

Uji "menembus klaim resmi lewat basis data" gagal dengan sebab yang sama dan
diperbaiki dengan cara yang sama: ia semula menguji KFA, yang sesudah jalan
pertama memang sudah berterbitan sehingga perubahannya menjadi sah. Kini ia
menguji ICD-10.

**Pengujian katalog menangkap satu hal lagi**: `HEALTH_TERMINOLOGY` sudah ada
sejak H-9, dan H-9M sempat menambahkannya sebagai menu kedua. Uji "kode menu
unik" menolaknya seketika. Migrasi `H049` sendiri sudah benar — penyisipan
menunya dijaga `WHERE NOT EXISTS`, sehingga basis data hanya menerima aksi
`VERIFY` yang baru — dan yang keliru hanyalah katalognya. Ini kebalikan dari
cacat H037: di sana penjaga `IF NOT EXISTS` membuat migrasi diam ketika ada
salah ketik; di sini penjaga yang sama membuat migrasi benar ketika kodenya
kebetulan sudah ada.

**Pengujian satuan H-9B menangkap sesuatu yang lebih halus daripada cacat
kode: ia menangkap saya sedang MENGARANG.**

`periksaNomorSep` semula memakai pola `^\d{4}[A-Z0-9]\d{12,14}$` — pola yang
disusun dari ingatan tentang bentuk nomor SEP. Ujinya gagal pada contoh yang
saya tulis sendiri, dan kegagalan itu menunjukkan hal yang benar: **saya tidak
memiliki spesifikasinya.** Pola yang ditebak dari beberapa contoh akan menolak
nomor sah dari fasilitas yang kodenya berbeda, dan penolakan itu datang pada
saat pasien sedang menunggu.

Fungsinya diganti: yang diperiksa hanyalah nomor yang **jelas dibuat sendiri**
— "SEP-001", "TEST", "dummy", nol semua — dan selebihnya diterima apa adanya,
sebab yang berwenang menyatakan ia sah adalah BPJS. Ini penerapan langsung
perintah R2 §5 pada tempat yang paling mudah dilanggar tanpa sadar: bukan
mengarang endpoint, melainkan mengarang *format*.

**Naskah buktinya juga menangkap uji yang berbunyi pada hal yang benar.**
Pemeriksaan "tidak ada kolom penggantian pada baris item" semula memakai pola
`%bpjs%`, yang cocok dengan `bpjs_claim_id` — kunci asing ke klaim induknya,
yang memang harus ada. Uji yang berbunyi pada kolom yang benar akan dimatikan
orang pertama yang membacanya, dan sesudah itu ia tidak menjaga apa pun.
Polanya dipersempit, dan **uji kendali** ditambahkan: kunci asing itu memang
ada.

Naskah H-9B pula yang memeriksa satu hal yang tidak diperiksa fase mana pun
sebelumnya: bahwa **tabelnya memang dapat diubah**. `ALTER TABLE ... ADD COLUMN`
dijalankan lalu dibatalkan, dan keberhasilannya membuktikan bahwa ketiadaan
kolom penggantian bermakna — bukan sekadar akibat izin basis data yang menolak
semua perubahan.

**Naskah H-9A membuktikan sesuatu yang bentuknya berbeda dari seluruh fase
sebelumnya: bahwa sebuah kerangka MENOLAK BERJALAN.**

Membuktikan penolakan lebih sulit daripada membuktikan keberhasilan, sebab
penolakan yang benar dan penolakan yang kebetulan tampak sama dari luar. Naskah
ini memakai tiga bentuk sekaligus:

1. **Ketiadaan pada `information_schema`** — tidak ada kolom bernama payload,
   badan permintaan, kata sandi, token, maupun kunci; dan tabel transaksinya
   tidak punya satu pun kolom JSON yang dapat menampungnya diam-diam.

2. **Keadaan yang tidak berubah** — seluruh dua puluh kemampuan tetap `BLOCKED`
   sesudah lingkungannya didaftarkan DAN diaktifkan. Inilah pemeriksaan yang
   paling penting: ia membuktikan bahwa lingkungan aktif bukan gerbangnya.

3. **Pengukuran seluruh tenant** — berapa kemampuan berstatus `VERIFIED` tanpa
   nama manusianya, dituntut nol.

Naskah ini juga menerapkan pelajaran H-9J dan H-9K **sejak awal**, bukan sesudah
lulus karena penjaga yang keliru: uji "yang mengaktifkan tidak memverifikasi"
disusun supaya penolakannya datang dari pemeriksaan hak akses yang memang
dimaksudkan, dan uji kendalinya membuktikan penurunan status lewat basis data
**diizinkan** sebelum membuktikan kenaikan yang melompat ditolak. Tanpa uji
kendali itu, trigger yang menolak SEMUA perubahan akan lulus dengan cara yang
sama.

**H-9I adalah fase pertama yang naskah buktinya LULUS PADA JALAN PERTAMA**, dan
sebabnya layak dicatat: pengujian satuannya menanggung hampir seluruh beban — 88
pengujian, terbanyak di antara seluruh fase — sebab yang diujinya memang murni.
Penguraian pesan tidak menyentuh basis data, tidak menyentuh jaringan, dan tidak
bergantung pada keadaan apa pun; ia fungsi dari teks ke struktur.

Dua di antara pengujian satuannya menemukan cacat pada kode fase itu sendiri
sebelum naskah bukti dijalankan sama sekali. Yang pertama:
`periksaChecksumAstm` hanya menerima checksum berbentuk heksadesimal, sehingga
bingkai yang checksumnya **rusak** dilaporkan sebagai "tidak ada checksum" —
padahal justru itu yang paling perlu dilaporkan beserta nilai yang diharapkan.
Kedua keadaan itu menuntut tindakan yang berbeda: yang pertama berarti
pengirimnya salah bentuk, yang kedua berarti kabelnya.

Yang kedua lebih halus: uji "setiap protokol yang belum siap menyebutkan
penghalangnya" menuntut penjelasannya lebih dari lima belas huruf, dan `MPPS`
hanya berkata "Menunggu PACS." Sebuah uji tentang **panjang kalimat** terdengar
sepele sampai orang mengingat mengapa penghalang ditulis sama sekali: daftar
yang hanya berkata "tidak didukung" akan ditanyakan ulang setiap tiga bulan oleh
orang yang berbeda, dan salah satu di antaranya akan menuliskannya sendiri.

Naskah buktinya tetap menemukan hal yang tidak dapat ditemukan pengujian
satuan — bahwa trigger `forbid_inbound_message_tamper` **membedakan kolom yang
dikunci dari yang tidak**: uji kendalinya menuntut `processed_at` masih boleh
berubah sesudah membuktikan `raw_message` tidak boleh. Penjaga yang mengunci
seluruh barisnya akan menghentikan pemrosesan pesan itu sendiri, dan itu jenis
kekeliruan yang hanya tampak ketika barisnya benar-benar diperbarui.

**Naskah H-9K menemukan cacat yang seluruh pengujian satuannya tidak dapat
menemukan, dan cacatnya berupa BARIS YANG TIDAK ADA.**

`H040` menyemai kebijakan penyamaran bagi setiap fasilitas — yang ada **pada
saat migrasinya dijalankan**. Fasilitas yang dibuat sesudahnya, yakni setiap
rumah sakit yang bergabung mulai besok, berjalan tanpa baris kebijakan. Layanan
membacanya sebagai "tidak ada" lalu memakai nilai bawaan pada kodenya, dan nilai
bawaan itu kebetulan benar hari ini.

Yang membuatnya berbahaya bukan nilainya melainkan **penjaganya yang diam**:
constraint `investor_policy_cohort_not_zero` menjaga baris yang ada, dan
fasilitas yang tidak punya baris tidak dijaganya sama sekali. Aturan paling
keras pada seluruh H-9K berlaku bagi setiap fasilitas kecuali yang baru.

Diperbaiki `H041` dengan **meniadakan keadaannya**, bukan memperbaiki nilai
bawaannya: trigger menyemai kebijakan pada saat fasilitas dibuat, sehingga
pertanyaan "ambang mana yang berlaku bila belum ada kebijakan" tidak pernah
perlu dijawab siapa pun. Naskah bukti menemukannya justru karena ia membuat
fasilitas baru — sesuatu yang dilakukan setiap naskah bukti sejak H-2, dan yang
tidak pernah dilakukan satu pun pengujian satuan.

**Uji ketiga yang lulus karena penjaga yang keliru, dan yang menangkapnya adalah
pemeriksaan bunyi penolakannya.** "Penghitung distribusi tidak menyetujuinya"
memakai analis yang tidak berhak `APPROVE`, sehingga yang menolak adalah penjaga
hak akses. Statusnya 403 — persis yang diharapkan — dan hanya pemeriksaan
kalimat penolakannya yang membedakan penolakan yang benar dari penolakan yang
kebetulan. Ini pembenaran paling jelas bagi kebiasaan yang berlaku sejak H-9:
**periksa bunyinya, bukan hanya statusnya.**

**Pengujian katalog menangkap kekeliruan pemodelan, dan itu yang kelima
kalinya.** `HEALTH_SOD_INVESTOR_VIEW_COMPUTE` sempat ditulis sebagai pasangan
hak akses `DASHBOARD.READ` × `DASHBOARD.CREATE` — dan uji "tidak ada peran
bawaan yang melanggar aturannya sendiri" langsung menolaknya, sebab analis
investasi memang memegang keduanya: ia menghitung proyeksinya, lalu membacanya
untuk memeriksa hasilnya.

Bentuknya sedikit berbeda dari empat yang terdahulu (H-9E, H-9G, H-9C, H-9H):
bukan hubungan antara satu orang dan satu **baris**, melainkan antara satu
**peran** dan satu wewenang. Yang ditegakkan sebagai gantinya adalah properti
peran investor itu sendiri, diperiksa pengujian katalog dan didaftarkan pada
mesin SoD tenant per peran.

**Naskah H-9J menemukan empat cacat, dan tiga di antaranya milik fase itu
sendiri.** Ini jalan bukti yang paling banyak menemukan sejauh ini, dan sebabnya
bukan kebetulan: ia satu-satunya yang menjalankan seluruh modul dari ujung ke
ujung sebelum memeriksa apa pun.

**Cacat pertama: penjaga yang mengunci jalan menuju perlindungannya sendiri.**
`H035` memasang constraint `medical_device_failed_safety_not_active` — alat yang
uji keselamatan listriknya gagal tidak boleh berstatus ACTIVE. Maksudnya benar;
yang ditulisnya memeriksa **keadaan**, padahal yang hendak dijaga adalah
**peralihan**. Akibatnya teknisi yang menguji alat yang sedang ACTIVE — yakni
keadaan seluruh alat yang dipakai sehari-hari — dan menemukan arus bocornya
melampaui ambang **tidak dapat mencatat temuannya sama sekali**. Barisnya
ditolak basis data; alat yang berbahaya tetap menyala, dan satu-satunya catatan
tentang bahayanya tidak pernah tersimpan.

Ini kelas yang sama dengan cacat H-9: kekurangan "diagnosis belum berkode" yang
menahan pengkodean, sehingga berkasnya tidak akan pernah berkode. Pola yang
kini punya nama sendiri: **penjaga yang dipasang untuk melindungi justru
mengunci jalan yang menuju perlindungan itu.** Pembetulannya `H038` — constraint
dibuang, digantikan trigger yang menjaga peralihan MASUK ke pelayanan.
Perbedaannya sekarang punya uji kendali tersendiri: alat yang sedang melayani
harus tetap dapat ditandai gagal, dan alat yang bertanda gagal tidak boleh
kembali.

**Cacat kedua: migrasi yang berhasil sambil melewatkan hak akses.** `H036`
memberikan aksi `CLOSE` kepada menu pemeliharaan, dan aksi itu tidak ada pada
kosakata bersama. Penyisipan `menu_action` dijaga `IF a_id IS NOT NULL` —
penjaga yang membuat migrasi tahan terhadap urutan penerapan, dan yang justru
membuatnya **diam ketika yang dilewatinya bukan urutan melainkan salah ketik**.
Migrasinya berhasil, menunya ada, perannya ada, dan satu-satunya tanda bahwa
ada yang salah adalah teknisi yang tidak dapat menutup pekerjaannya. Dibetulkan
`H037`, yang sengaja **menggagalkan dirinya** bila aksinya tidak ada.

**Cacat ketiga: DATE yang diterjemahkan JavaScript.** Driver `pg` mengembalikan
kolom DATE sebagai objek `Date` pada tengah malam waktu lokal.
`String(date).slice(0, 10)` menghasilkan `"Fri Feb 12"` — dan pembandingan
tanggal yang memakainya diam-diam selalu bernilai salah, sehingga papan
pemeliharaan gagal seluruhnya dan papan risiko mengurutkan terbalik.
`toISOString()` pun keliru, dengan cara yang lebih halus: ia menggeser
tanggalnya sehari mundur pada zona waktu Indonesia. Yang benar adalah **tidak
pernah membuatnya menjadi objek `Date` sama sekali** — pengecoran dilakukan
PostgreSQL lewat `::text`. Sekelas dengan cacat H-9D: aturan murninya benar,
terjemahannya ke tipe basis data yang salah.

**Cacat keempat ada pada naskah buktinya sendiri, dan dua kali.** Uji "penilai
tidak memutuskan penerimaannya sendiri" semula memakai analis yang memang tidak
berhak `APPROVE`, sehingga yang menolak adalah penjaga hak akses — bukan
pemeriksaan baris yang hendak diuji. Uji "alat yang gagal uji listrik tidak
kembali melayani" semula lulus karena pekerjaannya masih terbuka. Keduanya
lulus karena penjaga yang keliru, dan keduanya kini disusun sedemikian rupa
sehingga hanya satu penjaga yang mungkin berbunyi — pelajaran H-9 dan H-9F,
yang ternyata masih perlu diterapkan dengan sadar setiap kali.

Naskah H-9H membuktikan ketiadaan pada tempat yang paling penting: ia
menghitung kolom `medical_device` yang namanya mengandung `password`, `token`,
`api_key`, `secret`, atau `credential`, dan menuntut hasilnya **nol**. Larangan
menghubungkan alat medis langsung ke basis data hanya nyata bila alatnya memang
tidak punya tempat menyimpan kredensial; larangan yang berbentuk peringatan pada
dokumentasi akan dilanggar oleh orang pertama yang butuh "sekadar untuk
pengujian".

Ia juga mengukur seluruh tenant, bukan hanya barisnya sendiri: **berapa alat
yang kendali jarak jauhnya menyala tanpa salah satu dari enam syaratnya** —
dituntut nol. Pengukuran seluruh basis data yang tidak dapat dipalsukan oleh
naskahnya sendiri, sebagaimana pelajaran H-9E.

Satu pemeriksaan H-9H gagal pada jalannya yang pertama karena sebab yang layak
dicatat: penolakannya **benar**, bunyinya **benar**, tetapi ujinya mencari
"tidak ada jalan langsung" sedangkan kalimatnya dimulai dengan huruf besar. Uji
yang mencocokkan bunyi penolakan — kebiasaan yang berlaku sejak H-9 — menukar
satu kelemahan dengan kelemahan lain: ia menangkap penjaga yang keliru berbunyi,
tetapi menjadi rapuh terhadap perubahan kalimat. Yang dicocokkan sebaiknya
potongan yang menyebut **sebabnya**, bukan kalimat pembukanya.

Naskah H-9C memakai teknik H-9N sekali lagi — **membuktikan ketiadaan** — dan
dua kali di antaranya menyangkut nama kolom. Ia menuntut `health_claim` punya
tiga kolom nilai yang terpisah dan **tidak punya** kolom `amount`,
`claim_amount`, atau `total_amount` yang menyatukannya; dan ia menuntut
`health_claim_flag` tidak punya satu pun kolom bernama `blocked`,
`blocks_submission`, atau `is_blocking`.

Keduanya aturan yang mudah dilanggar tanpa sengaja oleh orang yang menambahkan
kolom "supaya lebih praktis" — dan pelanggarannya tidak menimbulkan galat, hanya
menimbulkan pembayaran jasa dari uang yang belum masuk, atau klaim sah yang
tertahan penanda statistik.

Naskah H-9G menemukan cacat pada **constraint yang ditulis fase itu sendiri**,
dan itulah nilainya. `fee_application_capped_consistent` menyamakan "persentase
terpakai lebih kecil daripada yang diminta" dengan "dibatasi", padahal yang
pertama punya empat sebab dan hanya satu di antaranya pembatasan. Akibatnya
setiap perhitungan tanpa kontrak — keadaan bawaan seluruh fasilitas — ditolak
basis data: fee yang bawaannya NONE justru tidak dapat dicatat sebagai nol.
Pengujian satuannya lulus seluruhnya; aturan murninya memang benar.

Naskah ini juga mengubah satu kebiasaan kecil: **tanggal dihitung relatif
terhadap hari berjalan, tidak ditulis tetap.** Uji "kontrak tidak berlaku surut
melampaui telaah hukumnya" semula memakai tanggal tetap yang kebetulan sudah
lewat, sehingga naskahnya gagal karena datanya sendiri melanggar aturan yang
hendak diujinya. Naskah bukti bertanggal tetap akan lulus hari ini dan gagal
bulan depan — dan yang gagal bulan depan akan disangka kerusakan kode.

Naskah H-9F mengulang pelajaran H-9 dengan bentuk yang berbeda. Uji "membayar
simulasi lewat basis data ditolak constraint" semula gagal — bukan karena
constraint-nya tidak ada, melainkan karena constraint **lain** menolaknya lebih
dahulu: simulasi itu belum disetujui siapa pun, sehingga yang berbunyi adalah
constraint kelengkapan persetujuan. Kini naskah itu memenuhi seluruh syarat
lain sekaligus, sehingga satu-satunya yang tersisa untuk menolaknya adalah tanda
simulasinya.

Pada H-9 pelajarannya adalah *periksa bunyi penolakannya*; di sini pelajarannya
satu langkah lebih jauh: **susun keadaannya sedemikian rupa sehingga hanya satu
penjaga yang mungkin berbunyi.** Pada tabel yang dijaga tujuh constraint, uji
yang tidak melakukannya hanya membuktikan bahwa salah satu dari ketujuhnya
bekerja.

Naskah H-9E membuktikan **ketiadaan** seperti H-9N, tetapi dengan satu
pelajaran tambahan. Pemeriksaan pertamanya menghitung seluruh baris kebijakan
pada skema dan menuntut nol — dan gagal pada jalannya yang kedua, sebab yang
dihitungnya termasuk kebijakan yang dibuat naskah itu sendiri pada jalannya
yang pertama. Kini ia menghitung kebijakan yang lahir **tanpa pembuat**, yaitu
yang datang dari migrasi. Naskah bukti yang mengukur keadaan seluruh basis data
harus mengukur sesuatu yang tidak dapat diubahnya sendiri.

Naskah H-9D menemukan cacat yang pengujian satuannya **tidak mungkin**
menemukan: `effectiveTo` disimpan sebagai batas atas `daterange` yang terbuka,
sehingga hari terakhir setiap masa berlaku tidak tertutupi tarif mana pun.
Aturan murninya memakai batas tertutup dan menjawab benar; yang salah adalah
penerjemahannya ke tipe basis data, dan itu hanya terlihat ketika angkanya
benar-benar melewati PostgreSQL. Pengujian satuan menguji aturan; naskah bukti
menguji terjemahannya.

Naskah H-9N membuktikan satu hal yang tidak lazim: **ketiadaan.** Ia menghitung
tabel bernama `health*journal*`, `health*ledger*`, dan `health*balance*` pada
skema tenant dan menuntut hasilnya nol; lalu memakai seluruh modul dari ujung ke
ujung — menyemai aturan, membaca kesiapan, membaca peta, menghitung selisih
klaim — dan menuntut jumlah baris `journal_entry` serta `accounting_event` tidak
bertambah satu pun. Aturan "jangan membuat buku besar kedua" adalah aturan yang
paling mudah dilanggar tanpa sengaja, dan pelanggarannya tidak pernah menimbulkan
galat: ia hanya menghasilkan neraca kedua yang tampak benar.

Naskah H-9L menemukan cacat yang **sekelas dengan cacat H-9 pada hari yang
sama**: pengenal yang dihitung per lingkup sempit di bawah batasan unik yang
lebih luas. Pada H-9 itu nomor insiden per fasilitas di bawah indeks unik per
tenant; pada H-9L itu kode kumpulan data contoh yang dihitung dari benihnya saja
— sehingga fasilitas kedua yang disemai dengan benih yang sama gagal seluruhnya,
persis kebalikan dari maksud "deterministik". Dua kali dalam satu hari cukup
untuk menjadikannya hal yang diperiksa lebih dahulu pada fase berikutnya.

Naskah H-9L pula yang menegaskan satu kebiasaan yang mulai berlaku sejak H-9:
sebelum menguji bahwa sesuatu ditolak, uji lebih dahulu bahwa ia **diterima**
dalam keadaan yang seharusnya. Uji urutan papan kekurangan semula gagal bukan
karena urutannya salah, melainkan karena pada saat itu tidak ada satu pun
kekurangan yang menahan — papan yang hanya memuat satu macam baris tidak
membuktikan urutan apa pun.

**Naskah H-9 semula lulus karena penjaga yang keliru.** Uji "penahanan hukum
menahan perubahan catatan klinis" memakai catatan yang sudah ditandatangani —
yang sudah dikunci trigger `forbid_signed_note_mutation` sejak H-3. Kedua
trigger duduk pada tabel yang sama, dan PostgreSQL menjalankannya menurut urutan
abjad nama triggernya: `trg_clinical_note_immutable` mendahului
`trg_legal_hold_clinical_note`. Perubahannya memang ditolak, tetapi bukan oleh
penahanan hukum. Naskah itu akan tetap lulus sekalipun seluruh mekanisme
penahanan hukum dicabut.

Sejak itu, setiap pemeriksaan yang menembus invarian lewat SQL langsung
memeriksa **bunyi penolakannya** — nama constraint atau kalimat triggernya —
dan uji penahanan hukum memakai catatan yang belum ditandatangani, didahului
satu uji kendali yang membuktikan catatan itu memang dapat diubah **sebelum**
penahanannya dipasang. Satu tabel dapat memiliki beberapa penjaga; "gagal" saja
tidak membuktikan penjaga yang mana yang bekerja.

Naskah H-9 juga menemukan tiga cacat yang tidak tertangkap satu pun pengujian
unit, seluruhnya pada jalur yang dipakai setiap hari: `ON CONFLICT` pada indeks
unik **parsial** tanpa menyebut predikatnya (pemeriksaan kelengkapan gagal 500
pada setiap panggilan), satu parameter dipakai dua kali dengan tipe yang
disimpulkan berbeda (kekurangan berkas tidak pernah tersimpan), dan nomor
insiden yang dihitung per fasilitas tetapi unik per tenant (fasilitas kedua yang
melapor pada hari yang sama gagal melapor sama sekali). Ditambah satu kunci mati
aturan: kekurangan "diagnosis belum berkode" menahan pengkodean, sehingga berkas
tidak akan pernah dapat dikode.

Naskah H-8 sempat gagal pada percobaan kedua meski lulus pada percobaan pertama:
langkah "tanpa tabel rujukan" menyemai barisnya sendiri, sehingga jalannya kedua
kali tidak lagi menemui keadaan yang hendak diujinya. Naskah bukti yang hanya
lulus sekali bukan naskah bukti — ia kebetulan. Kini langkah itu memakai anak
berumur 36 bulan pada tabel yang hanya memuat umur 24 bulan, yaitu keadaan yang
sesungguhnya terjadi di lapangan: tabelnya ada, tetapi barisnya tidak
menjangkau umur anak yang ditimbang.

Naskah H-7 menembus dua invarian dari jalur basis data langsung, dan keduanya
ditolak: penjadwalan kamar operasi yang bertumpang tindih (constraint
pengecualian `EXCLUDE USING gist`) dan pengisian jeda sebelum sayatan setelah
sayatan dimulai (constraint `ot_case_timeout_before_incision`). Ia lulus
seluruhnya pada percobaan pertama.

Naskah H-6 menembus invarian "satu tempat tidur satu pasien" dari **dua arah**:
lewat API, dan lewat `INSERT` langsung ke tabel penempatan. Keduanya ditolak —
yang kedua oleh indeks unik parsial. Itulah maksud menegakkannya di basis data:
aturan yang hanya ada di layanan berhenti berlaku begitu ada jalan kedua menuju
tabelnya, dan pada tabel penempatan selalu ada jalan kedua.

Ia juga menemukan satu cacat yang tidak dapat ditemukan pengujian unit: satu
parameter dipakai sebagai nilai kolom sekaligus pembanding di dalam `CASE`,
sehingga Postgres menolak dengan "inconsistent types deduced for parameter $2"
dan tempat tidur tidak pernah dapat dinyatakan bersih. Seluruh pengujian
unitnya lulus — aturannya memang benar; yang salah adalah SQL-nya.

Naskah H-5 menemukan satu cacat yang akan mengenai **setiap** penerimaan nilai
kritis di lapangan: basis data menyimpan hasil sebagai `NUMERIC(18,6)` dan
mengembalikannya sebagai `"7.200000"`, sedangkan dokter yang mengulang angkanya
di telepon mengetik `"7,2"`. Perbandingan teks menolak keduanya sebagai tidak
cocok. Pengujian unitnya lolos karena membandingkan `"6.2"` dengan `"6.2"` —
nilai yang tidak pernah melewati basis data. Penolakan yang selalu terjadi
adalah penolakan yang akan dicarikan jalan memutar, tepat pada langkah yang
paling tidak boleh dilewati. Perbandingannya kini dilakukan sebagai angka bila
keduanya angka, dan sebagai teks bila bukan.

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
