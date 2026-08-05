# UAT Wave 5 - Kas, Jurnal, Akun, Laba Rugi, dan Periode

Status: siap UAT tenant setelah deploy.

## Acceptance

- [x] Workspace keuangan membaca bagan akun melalui relasi tipe akun yang benar.
- [x] Akun baru memerlukan kode, nama, kelompok, dan saldo normal yang valid.
- [x] Jurnal memerlukan periode terbuka, dua akun berbeda, dan debit sama dengan kredit.
- [x] Draft jurnal dapat diposting dan jurnal posted dapat dibalik pada periode terbuka.
- [x] Laba kotor memakai omzet dikurangi HPP snapshot baris penjualan.
- [x] Laba rugi akuntansi hanya memakai jurnal posted sampai tanggal posisi.
- [x] Saldo akun biaya memakai debit dikurangi kredit; pendapatan memakai kredit dikurangi debit.
- [x] PDF laba kotor dan laba rugi bersumber dari snapshot server yang immutable.
- [x] Setiap hasil cetak mencatat snapshot, format, nomor dokumen, pengguna, dan waktu.
- [x] Tutup periode memblokir jurnal/pembayaran/opname yang belum selesai dan tidak menghapus histori.
- [x] Buka kembali hanya diizinkan berurutan dari periode closed paling akhir.
- [x] Layout keuangan lolos golden desktop tanpa overflow atau error pane.

## Pemeriksaan Produksi

Admin membuat satu akun biaya uji, lalu pemilik membuat jurnal berimbang pada
periode terbuka. Jurnal diperiksa saat DRAFT, diposting, dan dibalik untuk
memastikan semua perubahan tampak di audit. Pemilik membuka laba kotor dan laba
rugi pada tanggal yang sama, mengunduh PDF, kemudian memeriksa bahwa snapshot dan
print log tercatat.

Sebelum periode ditutup, sisakan satu jurnal draft untuk membuktikan status
`BLOCKED`. Setelah transaksi tertunda diselesaikan, ulangi penutupan dan pastikan
snapshot saldo stok, piutang, hutang, serta jurnal tersimpan tanpa menghapus data
periode lama.
