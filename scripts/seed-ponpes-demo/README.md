# Seed data demo besar — ponpes_demo

Lima skrip Node.js berurutan yang mengisi tenant demo `ponpes_demo` dengan
data contoh berskala besar untuk keperluan demonstrasi: ~1000 santri, 100
guru, 50+ mata pelajaran dan kurikulum, rombongan belajar pada tahun ajaran
berjalan, asrama dan penempatan, tagihan dan pembayaran, dompet santri,
nilai dan rapor, presensi, izin dan lintasan gerbang, pelanggaran dan
hukuman, ekstrakurikuler, prestasi dan penghargaan, dapur dan katering,
absensi guru dan piket, diniyah (kitab/halaqah) dan tahfiz, serta PSB/PPDB
(gelombang, 300+ calon santri, jadwal ujian).

Setiap baris ditandai `is_sample = true` dan (mayoritas tabel) menyimpan
`sample_batch_id` per tahap — dapat dihapus lewat baris itu bila suatu saat
diperlukan.

## Prasyarat

- Tenant `ponpes_demo` sudah ter-provisioning (schema ada, migrasi tenant
  sudah diterapkan, minimal satu akun `EPESANTREN_ADMIN` sudah ada — skrip
  memakainya sebagai `created_by`).
- Tahun ajaran berstatus `ACTIVE` sudah ada pada tenant tersebut.
- `pesantren_unit_pendidikan` dan `pesantren_mata_pelajaran` boleh sudah
  berisi baris (skrip idempoten pada bagian yang punya kode unik), tetapi
  paling bersih dijalankan pada tenant yang belum banyak diisi manual.

## Cara menjalankan

Skrip menyalakan koneksi dari `DATABASE_ADMIN_URL` (atau `DATABASE_URL`),
dan menyasar schema `SEED_SCHEMA` (bawaan `ponpes_demo`). Jalankan dari
`apps/api/` supaya modul `pg` ter-resolusi lewat `node_modules` proyek:

```bash
cd apps/api
cp ../../scripts/seed-ponpes-demo/*.js .

DATABASE_ADMIN_URL="postgres://<user>:<sandi>@127.0.0.1:<porta>/<basisdata>" \
  node 01-fondasi.js

DATABASE_ADMIN_URL="postgres://<user>:<sandi>@127.0.0.1:<porta>/<basisdata>" \
  node 02-asrama-rombongan.js

DATABASE_ADMIN_URL="postgres://<user>:<sandi>@127.0.0.1:<porta>/<basisdata>" \
  node 03-keuangan-akademik.js

DATABASE_ADMIN_URL="postgres://<user>:<sandi>@127.0.0.1:<porta>/<basisdata>" \
  node 04-kesiswaan-katering.js

DATABASE_ADMIN_URL="postgres://<user>:<sandi>@127.0.0.1:<porta>/<basisdata>" \
  node 05-kepegawaian-psb.js

rm 0*.js   # bersihkan salinan sementara setelah selesai
```

**Urutan wajib** — tahap kemudian membaca hasil tahap sebelumnya (santri,
guru, rombongan, mata pelajaran, asrama):

1. `01-fondasi.js` — unit pendidikan, mata pelajaran + komponen nilai +
   skala huruf, kurikulum, rombongan belajar, guru, penugasan mengajar,
   santri.
2. `02-asrama-rombongan.js` — keanggotaan rombongan, asrama, kamar,
   penempatan.
3. `03-keuangan-akademik.js` — tagihan + item, dompet + transaksi, kartu,
   nilai, presensi, izin + lintasan gerbang.
4. `04-kesiswaan-katering.js` — jenis pelanggaran + pelanggaran + hukuman,
   ekstrakurikuler + anggota, prestasi + penghargaan, menu makan +
   konsumsi, bahan dapur + transaksi stok.
5. `05-kepegawaian-psb.js` — absensi guru + piket, kitab + halaqah +
   halaqah santri, setoran tahfiz, gelombang PSB + calon santri + jadwal
   ujian.

## Catatan penting

- **Tidak idempoten secara penuh.** Menjalankan ulang satu tahap akan
  menambah baris baru (bukan menimpa), KECUALI bagian yang punya kode unik
  (unit pendidikan, mata pelajaran, ekstrakurikuler, jenis pelanggaran,
  bahan dapur, kitab, gelombang PSB) yang memakai `ON CONFLICT DO NOTHING`.
  Jangan jalankan dua kali tanpa membersihkan hasil sebelumnya bila ingin
  jumlah yang presisi.
- **Bukan bagian dari deploy rutin.** Ini bukan migrasi -- jangan
  dimasukkan ke `deploy/update.sh`. Jalankan manual, sekali, saat tenant
  demo memang perlu diisi ulang.
- **Jumlah rombongan belajar bisa kurang dari target** bila kombinasi
  tingkat+huruf kelas pada dua unit pendidikan (MTs, MA) habis sebelum
  mencapai 50 -- ini keterbatasan pool nama kelas pada skrip contoh, bukan
  batas sistem. Tambahkan manual lewat API bila perlu genap 50.
- **PSB "siap cetak":** data pendaftar dan tagihan gelombang (`biaya_pendaftaran`)
  sudah lengkap dan benar, tetapi TIDAK ADA fitur cetak/PDF sungguhan pada
  sistem ini (lihat catatan "Yang tidak dikerjakan" pada EP-P,
  `docs/santri-info/16-implementation-plan.md`) -- presentasi demo perlu
  memakai tampilan layar/API, bukan berkas PDF.
