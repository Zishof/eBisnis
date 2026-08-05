# Wave 4 Test Evidence - Sales and Receivables

Tanggal: 2026-08-06

## Hasil

- API parity catalog Jest: 1 suite, 4 tes lulus.
- React host/route Vitest: 2 suite, 6 tes lulus.
- TypeScript API dan Web: `tsc --noEmit` lulus.
- Flutter analyzer: tidak ada temuan pada workspace penjualan dan piutang.
- Flutter parser: customer, sales, status lunas, aging, serta penerimaan piutang
  dipertahankan dari respons API tenant.
- Flutter widget/offline: order idempoten, cache katalog, outbox, dan cursor
  sinkronisasi lulus.
- Flutter visual golden: workspace piutang lulus pada viewport desktop
  1280 x 820 tanpa overflow atau error pane.
- PDF: penerimaan, aging customer, aging sales, outstanding AR, dan nota sales
  dikompilasi oleh analyzer.

## Cakupan

Layar 30-42 mencakup order sales, piutang terbuka/lunas, penerimaan, riwayat,
aging per customer dan sales, nota dibawa sales, serta laporan piutang. Order
Flutter tetap dapat dibuat tanpa jaringan dan dikirim ulang memakai device event
id yang sama sehingga tidak menggandakan transaksi.
