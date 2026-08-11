# Implementasi Paritas Inventory / Sales 48 Layar

Direktori ini adalah ledger implementasi yang dapat diaudit untuk transisi aplikasi
Inventory Control legacy ke eBisnis Web dan Flutter Windows/Android. Status layar
tidak boleh dinaikkan menjadi `OPERATIONAL` sebelum model, aturan bisnis, API,
permission, audit, UI, laporan/ekspor, pengujian, dan bukti UAT tersedia.

## Aturan Status

- `CONTRACT_ONLY`: kontrak dan rute sudah dipetakan, tetapi belum ada alur nyata.
- `READ_ONLY`: data nyata dapat ditinjau, dicari, difilter, atau diekspor.
- `OPERATIONAL`: seluruh command utama layar berjalan dengan validasi, audit,
  idempotensi yang relevan, pengujian, dan bukti.
- `UAT_REQUIRED`: perilaku legacy belum pasti; implementasi memakai pilihan aman,
  reversibel, dan belum boleh dianggap final tanpa keputusan pemilik proses.

## Dokumen

- `source-manifest.md`: sumber kebenaran dan checksum.
- `repository-map.md`: pemetaan source aktual.
- `gap-analysis.md`: baseline jujur dan urutan penutupan gap.
- `gap-analysis-video-48-2026-08-11.md`: perbandingan code existing commit
  `e5c3399` dengan kontrak analisis video dan 48 frame dari Google Drive.
- `requirement-ledger.csv`: satu baris per layar.
- `route-map.md`, `api-map.md`, `permission-map.md`: kontrak lintas permukaan.
- `offline-sync-contract.md`: aturan cache, outbox, cursor, retry, dan konflik.
- `report-catalog.md`: keluaran PDF/Excel dan bukti cetak.
- `test-matrix.md`: identitas pengujian minimum setiap layar.
- `uat-decision-log.md`: keputusan bisnis yang belum boleh dikarang.

Evidence disimpan di `evidence/screens`, `evidence/reports`, dan
`evidence/test-results` dengan nama yang mengandung nomor layar serta platform.

## Hasil Akhir

- Seluruh 48 layar berstatus `OPERATIONAL` pada Web dan Flutter Windows/Android.
- Bukti build produksi dan checksum paket tersedia di
  `evidence/uat/release-build-0.1.6.md`.
