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

API keseluruhan: **2186** pengujian pada 66 berkas. Web: **69** pada 5 berkas,
34 di antaranya pada `health-api.spec.ts`.

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
