# UAT Wave 2 - Persediaan, Stock Opname, dan Harga

Status: siap UAT tenant setelah deploy.

## Acceptance

- [x] Stok dapat dicari menurut kode atau nama produk.
- [x] Daftar stok dapat disimpan sebagai Excel dan PDF di Web, Windows, dan Android.
- [x] Sesi opname mengikuti urutan DRAFT, FROZEN, COUNTED, APPROVED, POSTED.
- [x] Hitung fisik menampilkan produk, batch, kedaluwarsa, dan jumlah sistem.
- [x] Jumlah fisik negatif atau kosong seluruhnya ditolak.
- [x] Selisih dan nilai selisih berasal dari server tenant.
- [x] Riwayat harga dapat dicari menurut produk dan pihak.
- [x] Buku harga mendukung lingkup tenant, customer, dan supplier.
- [x] Buku harga baru diajukan untuk persetujuan, tidak langsung aktif.
- [x] Layout stok/harga lolos golden desktop tanpa overflow atau error pane.

## Pemeriksaan Produksi

Operator CMN memilih satu produk dengan batch aktif, membuat sesi opname, membekukan
sesi, mengisi jumlah fisik, menyetujui, lalu mem-posting. Saldo sebelum dan sesudah
dibandingkan dengan kartu stok. Untuk harga, operator membuat satu harga supplier
dan satu harga customer, lalu memastikan harga belum aktif sebelum persetujuan.

Output PDF dan XLSX dibuka dengan pembaca standar pada Windows dan Android. Nomor
halaman, kolom kode, nama, satuan, jumlah, harga, dan nilai rupiah harus terbaca.
