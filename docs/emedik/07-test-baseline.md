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

API keseluruhan: **1649** pengujian pada 57 berkas. Web: **69** pada 5 berkas,
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
