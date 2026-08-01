# D-12 · Penutup, UAT, dan yang Belum Selesai

Dokumen penutup vertikal info-desa. Ia menyatakan tiga hal: apa yang selesai,
apa yang **tidak** selesai, dan apa yang harus diperiksa manusia sebelum satu
desa sungguhan memakainya.

---

## Yang selesai

| Tahap | Isi | Commit |
|---|---|---|
| D-0 | Audit sepuluh dokumen | `40a7ca5` |
| D-1 | Wilayah, profil, portal, domain | `394c156` |
| D-2 | Penduduk, keluarga, mutasi | `4e5bb5f` |
| D-3 | Aparatur, register, cakupan data | `b79f901` |
| D-4 | Layanan warga, surat, antrean | `0a8dec0` |
| D-5 | Pengaduan, aspirasi, Musrenbang | `3140c41` |
| D-6 | Perencanaan, APBDes, adapter keuangan | `d61ff10` |
| D-7 | Aset, pengadaan, bantuan | `997861e` |
| D-8 | BUMDes, UMKM, wisata, kontrak integrasi | `2bd1fe3` |
| D-9 | Keamanan, bencana, lingkungan, pertanahan | `7ffdd1b` |
| D-10 | Situs, portal warga, kiosk, siaran | `8842cd6` |
| D-11 | PPID, transparansi, laporan | `43690be` |

**101 tabel** pada tiga belas migrasi, seluruhnya berawalan `village_`.

---

## Batas vertikal: diuji, bukan disepakati

Dijanjikan pada D-0, dan sekarang ada: `village-boundary.spec.ts` memindai
`modules/village/` pada setiap kali pengujian dijalankan.

Hasil pemindaiannya hari ini:

| Yang diperiksa | Hasil |
|---|---|
| Impor dari modul vertikal lain | **nol** |
| Tabel di luar awalan `village_` | **lima**, seluruhnya Core dan beralasan |
| Tabel kesehatan atau simpan-pinjam yang disalin | **nol** |
| Nama skema dari badan permintaan | **nol** |
| Rute di luar awalan `village` | **nol** |
| Hak akses di luar awalan `VILLAGE_` | **nol** |
| Hak akses yang tidak ada pada katalog | **nol** |

Lima tabel Core yang disentuh, beserta alasannya:

| Tabel | Alasan |
|---|---|
| `accounting_event` | D-6. Memakai mesin peristiwa Core, bukan membangun buku besar kedua |
| `role`, `user_role_assignment`, `user_subject` | D-3. Satu pengguna punya satu daftar peran |
| `schema_migration` | Pembukuan migrasi penyewa |

Daftar itu dibatasi delapan. Bukan angka keramat — ia pagar yang memaksa
penambahan kesembilan menjadi keputusan yang disengaja, bukan satu baris lagi
pada daftar yang sudah panjang.

---

## Yang TIDAK selesai

Bagian ini sengaja ditulis sejelas bagian sebelumnya. Vertikal yang menyatakan
dirinya selesai padahal belum adalah vertikal yang cacatnya ditemukan penyewa
pertama.

### 1. Antarmuka administrasi (D-1 sampai D-9)

**Belum ada.** Yang ada baru situs desa publik pada `/desa/:slug` dari D-10.
Seluruh pengelolaan — penduduk, layanan, APBDes, aset, bantuan, pertanahan,
PPID — hanya dapat dilakukan lewat API.

Ini utang yang dicatat terbuka sejak D-7 dan tidak pernah dilunasi. Ia bukan
kelalaian teknis melainkan keputusan urutan: setiap tahap memilih menegakkan
aturannya lebih dahulu, dan aturan yang belum ditegakkan tidak dapat diperbaiki
belakangan tanpa memindahkan data yang sudah telanjur salah.

Perkiraan: sekitar tiga puluh halaman. Pondasi dari D-10 (`verticals/village/`,
klien pembacaan, pemisahan galat dari kosong) dapat dipakai kembali.

### 2. Pusat Bantuan (Help)

**`BLOCKED`**, diwarisi dari V8-1/V8-2 yang tidak pernah dibangun pada Core.
Tidak ada tempat untuk menaruh isinya.

Yang sudah dilakukan sebagai gantinya: setiap endpoint membawa `description`
pada OpenAPI yang menjelaskan **mengapa** aturannya begitu, bukan hanya apa yang
dilakukannya. Itu bukan pengganti Help, tetapi ia sampai kepada orang yang
membaca dokumentasi API.

### 3. Ekspor Excel dan cetak PDF

**`BLOCKED`**, diwarisi dari V8-5/6 dan V8-7. Surat keterangan warga tidak dapat
diunduh sebagai PDF — penghalang yang paling menyakitkan bagi vertikal ini,
sebab surat adalah alasan sebuah desa memakai sistem seperti ini.

Rencana sementara yang sudah dipilih: HTML siap cetak, pendekatan yang sudah
dipakai halaman Proposal/PKS/Penawaran pada Core.

### 4. Kontrak integrasi yang menunggu jawaban

Empat port pada `ports/external.ports.ts` beserta adapter yang menyatakan "belum
tersambung" dengan jujur. Tidak satu pun mengembalikan data karangan.

Menunggu: eMedik, eKoperasi, POS Core, dan kontrak penautan marketplace. Lihat
`docs/integration-requests/village/004-external-contracts.md` dan `005`.

### 5. AI

Yang ada baru **batasnya**, bukan pemakaiannya:

- Penyaringan calon penerima bantuan berhenti pada `village_aid_candidate`;
  penetapan menuntut `decided_session_id` yang tidak dapat diisi pemanggilan
  otomatis (D-7).
- Tidak ada jalur AI menuju pembayaran, penetapan, persetujuan, penghapusan,
  maupun hak akses.

Pemakaian AI yang sesungguhnya — ringkasan pengaduan, bantuan penyusunan surat —
belum dibangun. Batasnya lebih dahulu, dan itu urutan yang benar.

---

## Daftar periksa UAT

Diperiksa manusia pada penyewa sungguhan, sebelum satu desa memakainya. Yang
bertanda ⛔ **harus** lulus; yang bertanda ⚠ boleh ditunda dengan catatan.

### Profil dan kelayakan

- ⛔ Penyewa berprofil `KELURAHAN` **tidak** melihat menu APBDes, BPD, maupun
  BUMDes.
- ⛔ Memanggil `POST /village/budgets` pada penyewa kelurahan ditolak `403`,
  meskipun URL-nya ditebak. *(Menyembunyikan menu saja bukan pembatasan.)*
- ⛔ Data contoh pada kelurahan tidak memuat APBDes maupun BPD.

### Kependudukan dan cakupan data

- ⛔ Ketua RT hanya melihat warga RT-nya, diuji **pada endpoint**, bukan pada
  tampilan.
- ⛔ Pejabat yang masa jabatannya berakhir kehilangan aksesnya.
- ⛔ NIK kembar **ditandai**, bukan ditolak. *(Menolaknya memaksa petugas
  memalsukan data agar dapat melanjutkan.)*

### Layanan dan surat

- ⛔ Pemohon tidak dapat memproses permohonannya sendiri.
- ⛔ SLA dihitung sejak berkas lengkap, bukan sejak permohonan masuk.
- ⛔ Halaman verifikasi QR menyatakan sah/tidak sah **tanpa** menampilkan data
  pribadi di dalam suratnya.
- ⚠ Surat dapat dicetak dari peramban (PDF masih terhalang).

### Keuangan

- ⛔ Belanja melampaui pagu **ditolak**, bukan diperingatkan.
- ⛔ Realisasi tanpa ikatan ditolak.
- ⛔ APBDes yang tidak seimbang tidak dapat ditetapkan.
- ⛔ Dua SPP yang diproses bersamaan tidak dapat sama-sama lolos.

### Bantuan

- ⛔ Sistem tidak dapat menetapkan penerima; hanya manusia yang masuk.
- ⛔ Warga yang sudah menerima bantuan sejenis tahun ini ditolak pada program
  kedua.
- ⛔ Calon yang ditolak memperoleh alasan yang dapat dibacakan kepadanya.

### Pertanahan

- ⛔ Surat keterangan tanah yang tercetak **memuat** kalimat "bukan bukti
  kepemilikan" dan "tidak menggantikan sertifikat".
- ⛔ Tanah bersertifikat tidak memperoleh surat keterangan desa.
- ⛔ Surat tidak terbit sebelum seluruh tetangga menyatakan setuju batas.

### Situs, portal, kiosk

- ⛔ Tidak ada satu pun jalur tulis dari halaman tanpa autentikasi.
- ⛔ Portal warga tidak menampilkan warga di luar kartu keluarganya.
- ⛔ Kiosk yang ditinggalkan dua menit menutup sesinya **dan** mengosongkan
  layarnya; menekan "kembali" tidak memunculkan data sebelumnya.
- ⛔ Siaran WhatsApp berstatus `TERHALANG`, dan tidak ada tempat yang menyatakan
  pesannya terkirim.

### Transparansi

- ⛔ Laporan penerima bantuan per RT tidak dapat dibongkar dengan pengurangan
  dari totalnya.
- ⛔ Ambang penyajian tidak dapat diturunkan setelah laporan terbit.
- ⛔ Penolakan permohonan informasi menyebutkan cara mengajukan keberatan.

### Data contoh

- ⛔ Menyemai dua kali ditolak.
- ⛔ Pembersihan menghapus seluruh data contoh **dan tidak satu baris pun** data
  sungguhan.
- ⛔ Peran dan hak akses tetap ada setelah pembersihan.

---

## Gerbang mutu pada penutupan

```
jest    1781 lulus     tsc --noEmit   bersih (API dan web)
vitest    35 lulus     eslint         bersih, max-warnings=0
vite build berhasil    migrasi        101 tabel village
```

Enam berkas bukti pada `docs/info-desa/bukti-*.txt`, seluruhnya dijalankan
terhadap PostgreSQL sungguhan — bukan tiruan:

| Berkas | Pemeriksaan |
|---|---|
| `bukti-d1-profile-isolation.txt` | 16 |
| `bukti-d3-data-scope.txt` | 22 |
| `bukti-d4-layanan-warga.txt` | 25 |
| `bukti-d5-partisipasi.txt` | 28 |
| `bukti-d6-apbdes.txt` | 20 |
| `bukti-d7-aset-bantuan.txt` | 38 |
| `bukti-d8-usaha-desa.txt` | 34 |
| `bukti-d9-keamanan-tanah.txt` | 37 |
| `bukti-d10-situs-kiosk.txt` | 25 |
| `bukti-d11-transparansi.txt` | 28 |

---

## Satu catatan tentang cara kerja ini

Sepanjang dua belas tahap, aturan yang menyangkut uang, wewenang, dan data
pribadi ditegakkan **basis data**, bukan layanan. Alasannya sama setiap kali:
pemeriksaan layanan dapat dilewati jalan kode berikutnya, jalur impor,
penyuntingan langsung, atau dua permintaan yang berjalan bersamaan — dan yang
terakhir itu tidak pernah muncul pada pengujian yang menjalankan satu permintaan
pada satu waktu.

Yang tidak dapat dinyatakan constraint dinyatakan dengan **tidak menyediakan
jalannya**: tidak ada metode membaca rekam medis, tidak ada kolom nama pelaku,
tidak ada jalur tulis pada situs publik, tidak ada parameter penduduk pada
portal warga. Antarmuka yang tidak punya metode tidak dapat dipanggil, dan itu
jauh lebih kuat daripada metode yang ada tetapi diberi pemeriksaan izin.

Larangan yang hanya tertulis pada dokumen akan dilanggar suatu hari oleh orang
yang belum pernah membacanya. Karena itu yang tertulis di sini juga diuji.
