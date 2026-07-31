# Changelog — Vertikal Koperasi (eKoperasi)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` induk.

---

## K-0 — Audit dan batas konteks

**Cabang:** `feature/v12-ekoperasi` · **Titik tolak:** `origin/main` @ `4f7ab88`

### Ditambahkan

- Sembilan dokumen audit di `docs/ekoperasi/`: keadaan saat ini, peta domain,
  matriks pakai-ulang, kontrak integrasi POS, kontrak akuntansi, keamanan dan
  pemisahan wewenang, rencana implementasi, garis dasar pengujian, dan daftar
  permintaan integrasi.
- Empat permintaan integrasi di `docs/integration-requests/cooperative/`.

### Temuan

- **Tidak ada satu pun kode koperasi di dalam repositori.** Kata "koperasi"
  hanya muncul pada naskah pemasaran. Delapan agregat koperasi seluruhnya
  dibangun baru, sekitar 80 tabel.
- **Katalog migrasi masih tunggal dan bernomor urut.** Tiga vertikal yang
  sama-sama menambahkan ke `manifest.json` bukan sekadar akan berkonflik saat
  penggabungan — dua migrasi berbeda dapat memakai nomor sama, dan penyewa yang
  sudah menerapkan salah satunya akan **melewati** yang lain tanpa satu pun galat
  muncul. → IR-001.
- **Sembilan port bersama yang disebut perintah belum ada.** Tidak menghalangi:
  port yang baik didefinisikan pemakainya. Koperasi mendefinisikan sendiri di
  `modules/cooperative/ports/`.
- **`modules/health/` sudah terpakai** oleh pemeriksaan kesehatan platform,
  padahal panduan memberikannya kepada sesi eMedik. Disampaikan sebagai temuan
  untuk sesi lain.

### Keputusan yang perlu dicatat

- **`investor_profile` dan `ownership_interest` TIDAK dipakai untuk
  keanggotaan.** Keduanya memodelkan penyertaan modal perseroan, dengan suara
  mengikuti kepemilikan. Koperasi bekerja terbalik — satu anggota satu suara,
  berapa pun simpanannya. Memakainya akan menanamkan pembobotan suara
  berdasarkan modal ke dalam fondasinya.
- **Simpanan pokok dan wajib diperlakukan sebagai ekuitas, bukan kewajiban.**
  Keduanya tidak dapat ditarik selama keanggotaan berjalan. Menyamakannya dengan
  simpanan sukarela akan membuat neraca menyatakan modal sendiri jauh lebih
  kecil daripada yang sebenarnya, dan rasio kesehatan yang dihitung di atasnya
  ikut salah.
- **Akad syariah memakai kode peristiwa akuntansi tersendiri**, bukan kode
  pinjaman dengan nama berbeda. Memakai `COOPERATIVE_LOAN_DISBURSED` untuk
  murabahah akan menyajikan jual-beli sebagai pinjaman berbunga.
- **Angsuran wajib memisahkan pokok dan jasa.** Keduanya masuk akun berbeda, dan
  membelah totalnya kemudian berarti menebak berapa pendapatan koperasi.
- **Unit usaha tidak memiliki POS sendiri.** Ia tertaut ke `outlet` dan
  `pos_terminal` Core lewat satu tabel penghubung. POS kedua akan membelah
  persediaan dan pembukuan menjadi dua kebenaran.
- **Patronage dibaca berkala, bukan ditulis saat transaksi.** Ia dihitung atas
  periode buku yang sudah ditutup; menuliskannya saat transaksi berarti angkanya
  ikut berubah setiap ada retur — sesudah SHU dihitung.
- **PIN anggota tidak pernah sampai ke kasir maupun ke POS.** Layar PIN milik
  koperasi; yang diserahkan ke POS hanya token sekali pakai berumur 60 detik.

### Garis dasar

| | |
|---|---|
| `pnpm install --frozen-lockfile` | berhasil — lockfile tidak berubah |
| `tsc --noEmit` (API) | bersih |
| `jest` (API) | 45 suite, **1048 tes lulus** |
| Cakupan pengujian koperasi | **nol** — sasaran K-11: sekitar 1325 |

### Belum dikerjakan

Tidak ada kode koperasi yang ditulis pada K-0. Audit ini sengaja berhenti pada
dokumen, sebab tiga dari empat permintaan integrasi menentukan bentuk kode yang
akan ditulis sesudahnya — dan menulis kode lebih dahulu lalu menyesuaikannya
berarti mengerjakan hal yang sama dua kali.
