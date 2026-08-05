# Wave 3 Test Evidence - Purchasing and Payables

Tanggal: 2026-08-06

## Hasil

- API parity catalog Jest: 1 suite, 4 tes lulus.
- React host/route Vitest: 2 suite, 6 tes lulus.
- TypeScript API dan Web: `tsc --noEmit` lulus.
- Flutter analyzer: tidak ada temuan pada workspace pembelian dan hutang.
- Flutter parser: status PO, aging AP, pembayaran, supplier, produk, satuan, dan
  gudang dipertahankan dari respons API tenant.
- Flutter visual golden: workspace pembelian lulus pada viewport desktop
  1280 x 820 tanpa overflow atau error pane.
- PDF: register pembayaran, aging hutang, faktur detail pembelian, dan register
  pembelian dikompilasi oleh analyzer.

## Cakupan

Layar 20-29 mencakup PO, penerimaan batch/ED, hutang supplier terbuka dan lunas,
pembayaran hutang, riwayat pembayaran, aging, faktur pembelian, dan laporan
pembelian. Flutter memakai endpoint tenant dan command idempoten yang sama dengan
React. Persetujuan PO dan pemeriksaan/pencatatan penerimaan tetap mengikuti
pemisahan tugas ERP.

## Catatan Lingkungan

Pengujian gabungan pertama melewati batas waktu karena ruang drive C sangat
terbatas. Proses Dart yang sudah selesai dihentikan dan hanya cache sementara
Flutter yang dapat dibentuk ulang yang dibersihkan. Analyzer dan tes kemudian
dijalankan terpisah sampai lulus.
