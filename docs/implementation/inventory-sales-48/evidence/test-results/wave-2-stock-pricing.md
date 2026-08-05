# Wave 2 Test Evidence - Stock, Opname, and Pricing

Tanggal: 2026-08-06

## Hasil

- API parity catalog Jest: 1 suite, 4 tes lulus.
- React route Vitest: 1 suite, 2 tes lulus.
- TypeScript API dan Web: `tsc --noEmit` lulus.
- Flutter analyzer: tidak ada temuan pada modul dan tes stok/harga.
- Flutter parser: 2 tes lulus untuk katalog, pihak harga, sesi, batch, dan jumlah fisik.
- Flutter visual golden: 1 tes lulus pada viewport desktop 1280 x 820.
- PDF: pembentukan dokumen multipage stok, opname, dan harga dikompilasi oleh analyzer.
- Excel: pembentukan workbook XLSX stok dan harga dikompilasi oleh analyzer.

## Cakupan

Layar 08-19 meliputi pencarian stok, laporan dan siklus stock opname, harga beli/jual,
ekspor Excel, keluaran PDF, serta buku harga umum, customer, dan supplier. Flutter
memakai kontrak tenant yang sama dengan React untuk `freeze`, `count`, `approve`,
dan `post`; tidak ada angka stok atau selisih yang dihitung dari data contoh UI.

## Catatan Lingkungan

Satu eksekusi awal gagal karena drive C tidak memiliki ruang untuk `output.dill`.
Cache Flutter yang dapat dibuat ulang dibersihkan, lalu analyzer dan tes diulang
hingga lulus. Kegagalan lingkungan tersebut bukan hasil tes aplikasi.
