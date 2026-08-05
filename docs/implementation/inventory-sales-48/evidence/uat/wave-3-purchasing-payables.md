# UAT Wave 3 - Pembelian dan Hutang Dagang

Status: siap UAT tenant setelah deploy.

## Acceptance

- [x] Operator dapat membuat PO dengan supplier, gudang, produk, jumlah, harga,
  dan tanggal yang diharapkan.
- [x] PO mengikuti urutan DRAFT, SUBMITTED, APPROVED, SENT.
- [x] PO SENT dapat dibuatkan penerimaan dengan nomor batch dan kedaluwarsa.
- [x] Pemeriksaan dan posting penerimaan tidak dilewati oleh aplikasi Flutter.
- [x] Hutang menampilkan supplier, faktur, aging bucket, dan nominal dari server.
- [x] Filter hutang lunas memuat ulang data dengan `includeSettled=true`.
- [x] Pembayaran hutang dibuat dan diposting dengan idempotency key.
- [x] Riwayat pembayaran menampilkan nomor, tanggal, metode, status, dan nominal.
- [x] Register pembayaran, aging, faktur detail, dan laporan pembelian dapat
  disimpan sebagai PDF.
- [x] Layout pembelian lolos golden desktop tanpa overflow atau error pane.

## Pemeriksaan Produksi

Admin CMN membuat satu PO kecil, lalu pengguna dengan kewenangan berbeda
mengajukan, menyetujui, dan mengirim. Petugas gudang membuat penerimaan dengan
batch dan kedaluwarsa; pemeriksa lalu memvalidasi dan mem-posting dari proses ERP.
Stok sebelum dan sesudah posting dibandingkan dengan kartu stok.

Untuk AP, operator membuka satu faktur, memeriksa aging, mem-posting pembayaran,
dan memastikan faktur berpindah ke tampilan lunas. Keempat PDF dibuka dengan
pembaca standar Windows dan Android; item, satuan, harga, diskon, pajak, total,
supplier, tanggal, dan nomor halaman harus terbaca.
