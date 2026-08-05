# UAT Wave 1 - Master Pemasok, Pelanggan, dan Sales

Status: siap UAT tenant setelah deploy migrasi V050.

## Acceptance

- [x] Pencarian kode, nama, wilayah/rute.
- [x] Tambah, ubah, aktifkan, dan nonaktifkan record.
- [x] Termin, diskon, kredit, target, wilayah, kontak, dan rekening tersedia.
- [x] Saldo dan jumlah dokumen berasal dari tenant API, bukan angka UI.
- [x] Filter semua, aktif, ada saldo, dan lunas tersedia.
- [x] Data bank disamarkan dan perubahan memiliki audit trail.
- [x] Flutter menyimpan command offline dan menyinkronkan saat tersambung.
- [x] Layout desktop dua panel dan mobile fokus daftar/detail.

## Pemeriksaan Produksi

Setelah deploy, operator membandingkan jumlah supplier, customer, dan salesperson
CMN dengan raw vault DBF. Selisih harus nol atau memiliki keputusan rekonsiliasi
tertulis; bootstrap bersifat idempoten sehingga deploy ulang tidak menggandakan data.
