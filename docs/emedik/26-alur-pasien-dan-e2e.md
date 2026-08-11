# 26 · Alur Satu Pasien dan Uji Peramban

Dua hal yang [25 — UAT persona](25-uat-persona.md) sebut belum diperiksa:
apakah pekerjaannya **bersambung** dari ujung ke ujung, dan apakah **layarnya**
benar-benar terbuka.

```bash
cd C:/opt/eBisnisGithub-emedik/apps/api && node scripts/prove-health-journey.mjs
```

```bash
cd C:/opt/eBisnisGithub-emedik/apps/api && node scripts/e2e-health-fixture.mjs setup
cd C:/opt/eBisnisGithub-emedik/apps/web && npx playwright test emedik-layar
cd C:/opt/eBisnisGithub-emedik/apps/api && node scripts/e2e-health-fixture.mjs teardown
```

```
alur satu pasien   25 pemeriksaan, 0 gagal — klaim berakhir PAID
uji peramban       12 uji × 2 viewport = 24, 0 gagal
```

---

## Bagian 1 — Alur satu pasien

Satu pasien melewati **delapan tangan yang berbeda**, memakai peran yang
tersemai apa adanya, terhadap peladen yang hidup.

| # | Orang | Peran | Yang dikerjakannya |
|---|---|---|---|
| 0 | Hesti | `HEALTH_ADMIN` | mendaftarkan dr. Ardi sebagai pemberi layanan |
| 1 | Rina | `HEALTH_REGISTRATION_CLERK` | mendaftarkan pasien dan kunjungannya |
| 2 | dr. Ardi | `HEALTH_DOCTOR` | memeriksa, mendiagnosis, meresepkan, menyelesaikan |
| 3 | Dewi | `HEALTH_PHARMACIST` | menerima resepnya |
| 4 | Yanto | `HEALTH_CODER` | memeriksa kelengkapan berkas, lalu mengoding |
| 5 | Sri | `HEALTH_CODING_VERIFIER` | memverifikasi koding Yanto |
| 6 | Budi | `HEALTH_CLAIM_OFFICER` | menyusun, mengajukan, mencatat keputusan dan pembayaran |
| 7 | Tuti | `HEALTH_CLAIM_VERIFIER` | memverifikasi klaim Budi |

### Yang diperiksa pada tiap serah-terima

Bukan sekadar "langkahnya berhasil", melainkan tiga hal:

1. orang berikutnya **melihat** hasil orang sebelumnya pada daftar kerjanya,
2. yang dilihatnya menunjuk pasien dan kunjungan yang **sama**,
3. orang sebelumnya **tidak dapat** mengerjakan langkah berikutnya.

> Yang ketiga paling mudah terlewat. Alur yang mengalir mulus dari ujung ke
> ujung di tangan **satu** orang bukan alur yang benar — ia alur tanpa
> pemisahan wewenang sama sekali.

### Aturan yang terbukti berlaku

| Aturan | Akibat bila hilang |
|---|---|
| Dokter tanpa nomor izin praktik **ditolak** | fasilitas mempekerjakan orang yang tidak berhak memeriksa |
| Berkas tanpa dokter penanggung jawab **tidak dapat dikode** | tidak ada yang bertanggung jawab atas isi rekamnya |
| Yang mengoding **tidak** memverifikasi kodingnya sendiri | koding keliru lolos sampai ke penjamin |
| Yang menyusun klaim **tidak** memverifikasi klaimnya sendiri | verifikasi internal menjadi membaca ulang keyakinan sendiri |
| Selisih ajuan dan persetujuan **wajib bersebab**, kosakata tertutup | potongan berulang tanpa ada yang tahu sebabnya |

### Empat hal yang hanya terlihat dengan menjalankan alurnya

Keempatnya menghentikan percobaan pertama, dan tidak satu pun akan terlihat
dari uji yang memeriksa satu modul saja.

**1. Menyelesaikan kunjungan TIDAK menaruhnya pada daftar kerja koder.**

Berkas pengkodean baru terbit ketika seseorang menjalankan pemeriksaan
kelengkapan lewat `POST /health/him/records/check`. `periksaBerkas` tidak
dipanggil dari mana pun selain controller itu.

> Bila tak seorang pun menjalankannya, kunjungannya tidak pernah dikoding,
> tidak pernah menjadi klaim, dan **tidak ada satu pun galat yang muncul.**
> Uangnya diam-diam tidak ditagihkan.

Ini yang paling patut diputuskan dengan sadar: apakah pemeriksaan itu memang
langkah manusia — masuk akal, sebab koder memang memungut berkas — atau
seharusnya terbit sendiri saat kunjungan ditutup.

**2. Jawaban POST memakai `<benda>Id`, bukan `id`.**

`patientId`, `registrationId`, `encounterId`, `providerId`. Menebak `id`
menghentikan alur tiga kali berturut-turut.

**3. Kode diagnosis harus ada pada terminologi yang AKTIF.**

Snapshot ICD-10 pada tenant demo hanya memuat **tiga kode**: `A09.9`, `K29.7`,
`Z00.0`. Dan **ICD9CM tidak ada sama sekali** — sehingga tindakan tidak dapat
dikode, dan klaim tindakan tidak dapat disusun.

Itu keadaan data, bukan cacat kode. Tetapi fasilitas yang memasang sistem ini
tanpa mengimpor terminologi akan menemukan koding berhenti total pada hari
pertama, dan pesannya menyebutkan kodenya — bukan bahwa terminologinya kosong.

**4. `POST /health/claims/:id/verify` menjawab 200 sekalipun klaimnya tidak
lolos.**

Statusnya berpindah ke `INTERNALLY_VERIFIED` **hanya** bila `blockingCount === 0`;
bila masih ada yang menahan, ia tetap menjawab 200 beserta daftar temuannya.

Naskah yang hanya memeriksa kode HTTP akan melaporkan langkah ini lulus, lalu
membiarkan pengajuan gagal beberapa baris kemudian dengan sebab yang tampak
tidak berhubungan. Naskah ini memeriksa `blockingCount`, bukan angka HTTP-nya.

---

## Bagian 2 — Uji peramban

Sebelas layar kesehatan dibuka di peramban sungguhan terhadap peladen sungguhan.

### Yang diperiksa tiap layar

1. utasnya benar-benar berpindah ke sana,
2. **judul layar itu sendiri** terlihat,
3. tidak ada galat konsol,
4. tidak ada pesan penolakan hak akses.

Yang ketiga menutup celah yang sudah pernah menelan cacat sungguhan: pada W-1,
`CoveragePage` melempar `TypeError` dan kosong sama sekali sementara **enam uji
komponennya lulus**. Halaman yang melempar galat tidak dapat menyembunyikannya
di peramban.

### Kendali negatif, dan mengapa ia tetap ada

Percobaan pertama hanya menuntut "ada judul yang terlihat". **Kendali negatif
membuktikan tuntutan itu kosong: rute karangan pun lulus.**

Sebabnya: setiap rute `/app/emedik/*` yang tidak dikenal jatuh ke **Command
Center eMedik**, bukan ke halaman "tidak ditemukan" — dan Command Center punya
banyak judul.

Asersinya lalu diperketat menjadi judul layar itu sendiri, dan kendali
negatifnya **ditinggalkan sebagai uji permanen** supaya asersi itu tidak pernah
kembali melemah tanpa ketahuan.

> Uji yang tidak dapat gagal tidak membuktikan apa pun. Satu-satunya cara
> mengetahuinya adalah mencoba membuatnya gagal.

Perilaku jatuh-ke-Command-Center itu sendiri patut diketahui: orang yang
mengikuti penanda buku usang mendarat di beranda modul **tanpa diberitahu**
bahwa halaman yang dimintanya tidak ada.

### Dua judul yang berbeda dari nama menunya

| Utas | Nama menu | Judul layar |
|---|---|---|
| `/app/emedik/resep` | Resep | **Farmasi** |
| `/app/emedik/pemeliharaan-alat` | Pemeliharaan Alat | **Pemeliharaan dan Keamanan Alat** |

Bukan cacat, tetapi ditulis di sini sebab menuliskan nama menu pada uji akan
membuat dua uji gagal karena sebab yang tidak ada hubungannya dengan mutu
layarnya.

### Mengapa bukan sesi demo

Uji peramban lain memakai sandbox demo. Peran `DEMO_USER` tidak memegang satu
pun hak kesehatan, dan memberinya hak itu akan **membuka data pasien contoh bagi
siapa pun yang menekan "coba demo"** pada halaman masuk.

Sampel memang bukan orang sungguhan, tetapi layar yang sama kelak menampilkan
orang sungguhan, dan keputusan "biarkan saja, ini kan data contoh" adalah
keputusan yang tidak pernah ditinjau ulang. Karena itu fixture ini memakai
penggunanya sendiri, dan sandbox demo dibiarkan sebagaimana adanya.

Penggunanya memegang sembilan peran kesehatan sekaligus — pengecualian yang
disadari. Yang diuji di sini adalah **layarnya dapat dipakai**, bukan siapa yang
boleh membukanya; pertanyaan kedua sudah dijawab
[25 — UAT persona](25-uat-persona.md).

---

## Yang ditemukan di luar sasaran

**333 dari 404 akun platform (82%) adalah sisa naskah uji**, seluruhnya
berstatus `ACTIVE`, dan **299 dari 531 peran** pada tenant demo adalah peran
sintetis yang menggantung 2.753 hibah.

Naskah pendahulu membuat pengguna dan peran tetapi tidak membersihkannya.
Kata sandinya acak dan tidak tersimpan di mana pun, sehingga praktis tidak dapat
dipakai masuk — tetapi ia tetap akun aktif berhak kesehatan, dan setiap
peninjauan akses akan membacanya sebagai orang sungguhan.

Naskah pada sesi ini (`prove-health-uat-persona.mjs`,
`prove-health-journey.mjs`, `e2e-health-fixture.mjs`) **membersihkan dirinya
sendiri**. Yang sudah menumpuk belum disentuh: pembersihannya menghapus baris
pada tabel control-plane, dan itu keputusan pemilik sistem, bukan keputusan yang
diambil sebagai efek samping sebuah sesi uji.

---

## Yang masih harus dikerjakan orang

1. **Alur rawat inap** — alur ini rawat jalan. Rawat inap punya admisi, tempat
   tidur, pemberian obat harian, dan pemulangan.
2. **Alur yang GAGAL di tengah** — klaim ditolak penjamin, koding dikembalikan,
   pasien pulang paksa. Yang diuji di sini alur yang berhasil.
3. **Apakah layarnya dapat dipakai** untuk pekerjaan itu — uji peramban
   memeriksa layarnya terbuka, bukan bahwa pekerjaannya dapat diselesaikan di
   sana.
4. **Uji kinerja** — masih terbuka, sebagaimana dicatat
   [24](24-rencana-layar-sisa.md).
