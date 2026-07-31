# K-0 · Keamanan dan Pemisahan Wewenang

Koperasi mengelola uang anggota. Aturan di bawah bukan formalitas kepatuhan —
tiap satunya menutup jalan yang, bila terbuka, memungkinkan seseorang mengambil
uang yang bukan haknya tanpa terlihat.

---

## Hak akses

Awalan `COOPERATIVE.*`, memakai pola `MENU.ACTION` yang sudah berlaku.

### Menu koperasi yang diusulkan

```
COOPERATIVE                          (akar)
├── COOPERATIVE_PROFILE              profil dan legalitas
├── COOPERATIVE_ORGANIZATION         kepengurusan dan periode
├── COOPERATIVE_UNIT                 unit usaha
├── COOPERATIVE_PROSPECT             calon anggota
├── COOPERATIVE_MEMBER               anggota
├── COOPERATIVE_SAVING_PRODUCT       produk simpanan
├── COOPERATIVE_SAVING               rekening dan transaksi simpanan
├── COOPERATIVE_LOAN_PRODUCT         produk pinjaman/pembiayaan
├── COOPERATIVE_LOAN_APPLICATION     pengajuan
├── COOPERATIVE_LOAN                 pinjaman berjalan
├── COOPERATIVE_INSTALLMENT          angsuran
├── COOPERATIVE_COLLECTION           penagihan
├── COOPERATIVE_MEETING              RAT dan RALB
├── COOPERATIVE_SHU                  SHU
├── COOPERATIVE_WALLET               dompet anggota
├── COOPERATIVE_SHARIA               akad dan kepatuhan syariah
└── COOPERATIVE_REPORT               laporan koperasi
```

### Aksi yang dibutuhkan di luar aksi baku

Aksi baku (`CREATE`, `READ`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, `POST`,
`PRINT`, `EXPORT`, `CANCEL`, `REVERSE`) sudah tersedia. Yang perlu ditambahkan:

| Aksi | Untuk | Mengapa terpisah |
|---|---|---|
| `DISBURSE` | Pencairan pinjaman | Menyetujui dan mencairkan adalah dua perbuatan berbeda; yang menyetujui tidak boleh sekaligus mengeluarkan uangnya |
| `ANALYZE` | Analisis kredit | Analis membaca data keuangan anggota yang tidak boleh dilihat kasir |
| `SURVEY` | Survei lapangan | — |
| `RESTRUCTURE` | Restrukturisasi | Mengubah jadwal angsuran yang sudah berjalan |
| `WRITE_OFF` | Penghapusbukuan | Perbuatan paling berbahaya pada modul pinjaman |
| `CALCULATE` | Perhitungan SHU | Menghitung dan menyetujui SHU terpisah |
| `DISTRIBUTE` | Pembagian SHU | Membayarkan uang ke anggota |
| `OPEN_MEETING` / `CLOSE_MEETING` | RAT | — |
| `VOTE` | Pemungutan suara | Dipegang anggota, bukan pengurus |
| `VIEW_MEMBER_FINANCIAL` | Lihat data keuangan anggota | Simpanan dan pinjaman anggota lain bukan urusan setiap petugas |

→ Penambahan aksi menyentuh seed hak akses global.
**[Permintaan integrasi 004](../integration-requests/cooperative/004-katalog-menu-peran-hak-akses-koperasi.md)**

---

## Peran bawaan

Dua puluh empat peran pada spesifikasi §17, dipetakan ke hak akses:

| Peran | Inti kewenangannya | Yang **tidak** boleh |
|---|---|---|
| Administrator eKoperasi | Konfigurasi, master, pengguna | Menyetujui pinjaman, mencairkan, membagi SHU |
| Ketua Koperasi | Persetujuan tingkat akhir, RAT | Menginput transaksi harian |
| Sekretaris | Notulen, surat, keanggotaan | Menyentuh uang |
| Bendahara | Kas, jurnal, rekonsiliasi | Menyetujui pinjaman |
| Pengawas Koperasi | **Baca seluruhnya**, audit | **Menulis apa pun** |
| Manajer Koperasi | Operasional harian | Menyetujui di atas plafonnya |
| Petugas Keanggotaan | Calon anggota, anggota | Simpanan, pinjaman |
| Petugas Simpanan | Setoran, penarikan | Pinjaman |
| Petugas Pinjaman | Pengajuan, berkas | Menganalisis, menyetujui, mencairkan |
| Analis Pinjaman | Analisis kredit | Menyetujui yang dianalisisnya |
| Surveyor | Survei lapangan | Menganalisis, menyetujui |
| Penyetuju Pinjaman | Persetujuan | Mencairkan, menganalisis |
| Kasir Koperasi | Terima/bayar tunai | Menyetujui apa pun |
| Petugas Collection | Penagihan, janji bayar | Menghapusbukukan |
| Petugas SHU | Perhitungan SHU | Menyetujui, membagikan |
| Pengelola RAT | Undangan, kehadiran, notulen | Memberi suara mewakili anggota |
| Pengelola Unit Usaha | Operasional unit | Jurnal koperasi |
| Akuntan Koperasi | Jurnal, laporan | Menyetujui pinjaman, memegang kas |
| Auditor Koperasi | **Baca seluruhnya**, jejak audit | **Menulis apa pun** |
| Dewan Pengawas Syariah | Kepatuhan akad | Operasional |
| Anggota | Data dirinya sendiri | Data anggota lain |
| Calon Anggota | Status pengajuannya | Selebihnya |

Dua peran — Pengawas dan Auditor — **hanya membaca**. Peran pengawas yang dapat
menulis bukan pengawas.

---

## Sepuluh aturan pemisahan wewenang

Ditegakkan lewat `segregation_of_duty_rule` yang sudah ada, ditambah pemeriksaan
di layanan. Dua lapis, dengan sengaja: aturan yang hanya tersimpan sebagai data
berhenti berlaku begitu seseorang menonaktifkan barisnya.

| # | Aturan | Mengapa |
|---|---|---|
| 1 | Penganalisis tidak menyetujui pinjaman yang dianalisisnya | Analisis yang dibuat untuk membenarkan persetujuan yang sudah diputuskan bukan analisis |
| 2 | Penyetuju tidak mencairkan pinjaman yang disetujuinya | Memisahkan keputusan dari pengeluaran uang |
| 3 | Surveyor tidak menganalisis hasil surveinya sendiri | — |
| 4 | Kasir tidak menyetujui transaksi apa pun | — |
| 5 | Petugas simpanan tidak memproses simpanan atas nama dirinya sendiri | Jalan terpendek untuk menambah saldo sendiri |
| 6 | Petugas pinjaman tidak memproses pinjaman untuk dirinya, pasangannya, atau keluarga intinya | Benturan kepentingan; `cooperative_related_party` mencatat hubungannya |
| 7 | Penghitung SHU tidak menyetujui hasil perhitungannya | SHU menyangkut seluruh anggota |
| 8 | Penghapusbukuan menuntut dua penyetuju berbeda | Perbuatan paling mudah dipakai menghapus jejak pinjaman bermasalah |
| 9 | Pengurus yang meminjam tidak ikut memutus pinjamannya sendiri | Wajib dicatat pada notulen |
| 10 | Pengawas dan auditor tidak memegang hak tulis apa pun | — |

Aturan 6 memerlukan tabel `cooperative_related_party` — hubungan keluarga antar
anggota dan pengurus. Tanpanya, benturan kepentingan hanya dapat ditangkap
manusia yang kebetulan mengenali nama.

---

## Data yang perlu dijaga khusus

### PIN anggota

Spesifikasi §14 menyebut tegas: *"PIN anggota tidak boleh terlihat oleh kasir."*

Penerapannya:

```
PIN disimpan sebagai hash Argon2id, sama dengan kata sandi. Tidak pernah plaintext.
Layar PIN adalah milik koperasi, bukan POS. Kasir tidak pernah melihat kolomnya.
Yang diserahkan ke POS hanya pinToken sekali pakai berumur pendek (60 detik).
Kegagalan PIN dibatasi jumlahnya; PIN terkunci setelah lima kali salah.
PIN tidak pernah masuk log, audit payload, maupun pesan galat.
```

### Data keuangan anggota

Saldo simpanan, sisa pinjaman, dan riwayat tunggakan seorang anggota **bukan**
data yang dapat dibaca setiap petugas. Hak `VIEW_MEMBER_FINANCIAL` memisahkannya
dari `COOPERATIVE_MEMBER.READ`, yang hanya memberi data identitas.

Anggota sendiri selalu dapat membaca datanya sendiri lewat portal — dibatasi
cakupan data, bukan dengan hak akses terpisah.

### Data yang tidak boleh masuk log

```
PIN anggota dan tokennya
nomor rekening bank anggota (dimasker: **** 1234)
NIK lengkap (dimasker)
nilai agunan dan taksirannya
isi analisis kredit
nomor kartu pada pembayaran unit usaha
```

Pemasker yang sudah ada pada `V008__audit_triggers.sql` diperluas untuk kolom
koperasi. Bukan Core yang diubah — daftarnya dikonfigurasi per tabel.

### Persetujuan anggota atas pemakaian data

`cooperative_member_consent` mencatat persetujuan atas pemakaian data untuk:
penilaian kredit, penawaran produk, dan pembagian ke pihak ketiga. Persetujuan
yang tidak tercatat berarti tidak ada — bukan berarti boleh.

---

## Langkah berlapis (step-up)

Perbuatan yang menuntut pengesahan ulang, memakai `step_up_challenge` yang sudah
ada:

```
pencairan pinjaman di atas ambang
penghapusbukuan
pembagian SHU
penutupan periode buku
perubahan kebijakan SHU
ekspor daftar anggota beserta data keuangannya
```

---

## Batas kewenangan AI

Sesuai spesifikasi §20 dan kebijakan AI V11 yang sudah berlaku:

```
AI BOLEH  : meringkas kesehatan koperasi, menganalisis tunggakan,
            menyusun draf notulen RAT, menjelaskan perhitungan SHU,
            mengusulkan urutan penagihan, menganalisis kinerja unit usaha.

AI TIDAK  : menyetujui pinjaman, mencairkan, membayar SHU, memposting jurnal,
            mengubah plafon, menghapusbukukan, memberi suara pada RAT,
            mengubah hak akses.
```

Keluaran AI selalu berupa **konsep** atau **analisis**, dan selalu menyebutkan
bukti datanya. Analisis kredit yang dibuat AI tanpa bukti yang dapat diperiksa
lebih berbahaya daripada tidak ada analisis, sebab ia tampak seperti
pertimbangan padahal bukan.

---

## Yang diuji pada K-11

```
kasir tidak dapat menyetujui pinjaman
analis tidak dapat menyetujui pinjaman yang dianalisisnya
penyetuju tidak dapat mencairkan pinjaman yang disetujuinya
petugas simpanan tidak dapat memproses simpanan atas namanya sendiri
petugas pinjaman tidak dapat memproses pinjaman untuk keluarganya
penghapusbukuan dengan satu penyetuju ditolak
pengawas tidak dapat menulis apa pun
anggota tidak dapat membaca data anggota lain
PIN tidak pernah muncul pada log, audit, maupun respons API
kasir tidak dapat membaca PIN maupun mengaturnya
data lintas koperasi tidak dapat diakses
```
