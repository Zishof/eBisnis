# UAT Wave 4 - Penjualan, Piutang, dan Nota Sales

Status: siap UAT tenant setelah deploy.

## Acceptance

- [x] Sales dapat memilih customer dan produk lalu mengirim order.
- [x] Order tanpa jaringan masuk outbox dan dikirim kembali secara idempoten.
- [x] Piutang menampilkan customer, faktur, sales, aging bucket, dan saldo.
- [x] Filter lunas memuat ulang data dan baris lunas tidak dapat dibayar ulang.
- [x] Penerimaan piutang dibuat dan diposting ke faktur terpilih.
- [x] Riwayat penerimaan menampilkan nomor, tanggal, metode, status, dan nominal.
- [x] Aging tersedia per customer dan per sales.
- [x] Nota dapat diserahterimakan, dikembalikan, lalu ditutup dengan audit.
- [x] PDF penerimaan, aging, outstanding, dan nota sales dapat disimpan.
- [x] Layout piutang lolos golden desktop tanpa overflow atau error pane.

## Pemeriksaan Produksi

Sales CMN membuat order kecil saat online dan satu saat perangkat dibuat offline.
Setelah jaringan kembali, sinkronisasi harus menghasilkan tepat dua order tanpa
duplikasi. Admin membuka piutang customer, mem-posting penerimaan, lalu memastikan
saldo dan bucket berubah serta faktur tampil pada filter lunas.

Satu nota diserahterimakan ke sales, dikembalikan dengan hasil penagihan, dan
ditutup. Lima PDF dibuka dengan pembaca standar Windows dan Android; customer,
sales, faktur, tanggal, aging, nilai, status, dan nomor halaman harus terbaca.
