# Deskripsi Pekerjaan POS/Inventory 48 Layar

Tanggal: **11 Agustus 2026 (Asia/Jakarta)**

Repository: <https://github.com/Zishof/eBisnis.git>

Branch: `main`

## Tujuan Pekerjaan

Pekerjaan ini melanjutkan implementasi paritas 48 layar Sales/Inventory legacy
ke aplikasi eBisnis baru. Target permukaan adalah React Web serta satu codebase
Flutter untuk Windows dan Android. Audit tidak diulang dari nol; pekerjaan
dimulai dari baseline yang sudah ada, dokumen analisis video 48 layar, registry
paritas, source aktif, migration, test, CI, dan release aktual.

## Source Requirement dan Audit

Dokumen analisis perbandingan yang dibuat selama sesi tersedia di:

- [`docs/implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md`](../implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md)
- [`docs/implementation/inventory-sales-48/parity-48.json`](../implementation/inventory-sales-48/parity-48.json)
- [`docs/implementation/inventory-sales-48/README.md`](../implementation/inventory-sales-48/README.md)

Audit membandingkan kontrak 48 layar dengan API, database tenant, Web, Flutter
Windows/Android, local database, offline sync, laporan, print/export, test, CI,
dan release. Registry dibuat jujur per `screen + surface + capability`; membuka
route tidak dianggap sama dengan membuktikan transaksi, offline, cetak,
rekonsiliasi, atau hardware UAT.

## Implementasi yang Diselesaikan

Implementasi utama berada pada commit `e20b9131` dan mencakup hal berikut.

### API, database, dan migration

- Filter laporan diterapkan pada query data, bukan sekadar menerima parameter.
- Layar 41 dipisahkan menjadi `Rekap Penjualan Barang`, `Outstanding Piutang`,
  dan `Register Event Piutang`.
- Snapshot laporan dilengkapi hash payload, versi, approval, jumlah halaman,
  watermark, print log, dan alasan reprint.
- Lifecycle Sales Membawa Nota dilengkapi dari `READY` sampai `CLOSED`, termasuk
  partial collection, return, reconciliation, serta exception `LOST`/`DISPUTED`.
- Sales Order menggunakan pemilihan harga server-authoritative, snapshot harga,
  HPP, salesperson, credit guard, dan alokasi stok FEFO.
- Pembelian mendukung harga supplier, dua diskon berurutan, harga neto, hubungan
  supplier invoice dengan goods receipt dan payable.
- Pipeline purchase-to-pay tersedia: PO, approve, goods receipt, inspection,
  stock posting, dan accounts payable.
- AP/AR mendukung pembayaran parsial, metode pembayaran, bank/referensi,
  metadata giro, catatan, histori, dan reversal.
- Conflict registry dan resolusi aman `SERVER_WINS` tersedia. Kebijakan
  `CLIENT_WINS/MERGED` belum diaktifkan otomatis karena membutuhkan merger yang
  aman per entity.
- Reversal goods receipt menjaga moving-average cost dan menolak pembalikan yang
  tidak aman.
- Migration aditif baru:
  - `V064__inventory_report_governance.sql`
  - `V065__sales_note_full_custody_lifecycle.sql`
  - `V066__sales_order_pricing_cost_attribution.sql`
  - `V067__purchase_supplier_pricing_two_discounts.sql`
  - `V068__supplier_invoice_goods_receipt_link.sql`
- Manifest migration diperbarui. Migration V064–V068 berhasil diuji pada 16
  schema tenant lokal tanpa reset/drop database atau mengubah migration lama.

### React Web

- Workspace pembelian diperluas menjadi alur purchase-to-pay terpadu.
- Form pembelian memuat faktur supplier, tanggal/jatuh tempo, dua diskon, harga
  neto, dan transisi status pembelian.
- Customer pricing dapat dimuat ulang dan digunakan pada transaksi penjualan.
- Panel konflik sinkronisasi menyediakan penyelesaian `SERVER_WINS` yang aman.
- Layar transaksi dan kontrol inventory diperbarui untuk kontrak baru API.

### Flutter Windows dan Android

- Satu codebase Flutter tetap menjadi implementasi resmi Windows dan Android.
- Workspace pembelian, penerimaan barang, AP/AR, nota, dan transaksi terkait
  diperluas sesuai kontrak API.
- Riwayat Sales Order dan pembatalan order tersedia dengan guard server.
- Tombol dan state transaksi yang sebelumnya hanya berupa skeleton dihubungkan
  ke aksi nyata pada vertical slice yang dikerjakan.
- UI resolusi konflik aman ditambahkan.
- Golden test Linux diselaraskan agar hasil CI deterministik.
- Versi aplikasi dinaikkan menjadi `0.1.35+35`.

### CI dan release

- Workflow release diperbaiki agar Android tetap wajib release-signed.
- Bila sertifikat Authenticode Windows belum tersedia, installer Windows diberi
  nama `unsigned-uat` dan hanya dipublikasikan sebagai **prerelease**.
- Auto-updater produksi mengabaikan prerelease sehingga installer unsigned tidak
  tersebar otomatis sebagai pembaruan produksi.
- Tag kandidat UAT: `inventory-v0.1.35`.
- Workflow sukses: <https://github.com/Zishof/eBisnis/actions/runs/31479114540>
- Release: <https://github.com/Zishof/eBisnis/releases/tag/inventory-v0.1.35>

### Perkembangan setelah baseline handover

Sesudah handover awal `00118111` masuk ke `main`, dua gap integritas berikut
ditutup oleh pekerjaan paralel dan sudah menjadi bagian `origin/main`:

- `6489e569` — retur dan pembatalan kasir mengembalikan nilai persediaan memakai
  `cost_snapshot` saat penjualan. Kuantitas yang kembali ke stok jual ikut
  memperbarui moving-average cost; biaya nol/tidak diketahui tidak dipaksakan
  masuk rata-rata, dan barang rusak/dimusnahkan tidak menambah nilai stok jual.
  Ditambahkan 20 test; 353 test POS lulus.
- `5091f997` — pembatalan goods receipt yang jurnalnya sudah `POSTED` sekarang
  membuat jurnal pembalik baru dari baris jurnal asli, ditautkan melalui
  `reversal_of_id`, memakai kunci idempotensi deterministik, dan wajib masuk
  periode akuntansi terbuka. Ditambahkan 40 test serta smoke test pemuatan
  `TenantModule`; 4.112 test lulus. Satu suite
  `rich-text-sanitizer.spec.ts` gagal dimuat dan sudah merupakan masalah
  sebelum perubahan ini.

Rincian keputusan serta bukti lanjutan tercatat di
[`docs/pos-web-priority/20-serah-terima-remote-pos-inventory.md`](../pos-web-priority/20-serah-terima-remote-pos-inventory.md).

## Hasil Verifikasi

| Area | Hasil |
| --- | --- |
| API | Build lulus dan seluruh Jest test lulus |
| Web | Production build dan lint lulus; 46 file / 511 test lulus |
| Flutter | `flutter analyze` bersih; 203 test lulus |
| Database | V064–V068 diterapkan pada 16 schema tenant lokal |
| Windows CI | Build installer dan automated navigation UAT lulus |
| Android CI | Release signing, verifikasi signing, dan emulator API 33 UAT lulus |
| Git | Source dan dokumentasi dipush ke `origin/main` |

Angka API pada tabel adalah baseline release `0.1.35`. Untuk dua commit
integritas sesudah baseline, gunakan hasil test pada bagian perkembangan di
atas dan jalankan ulang suite penuh pada clone komputer baru.

Bukti lengkap dan checksum:
[`docs/implementation/inventory-sales-48/evidence/uat/2026-08-11-inventory-0.1.35-release.md`](../implementation/inventory-sales-48/evidence/uat/2026-08-11-inventory-0.1.35-release.md).

## Artefak Kandidat UAT

- Android APK:
  <https://github.com/Zishof/eBisnis/releases/download/inventory-v0.1.35/ebisnis-inventory-sales-0.1.35.apk>
- Windows unsigned UAT:
  <https://github.com/Zishof/eBisnis/releases/download/inventory-v0.1.35/ebisnis-inventory-sales-0.1.35-windows-unsigned-uat.exe>

APK sudah release-signed. Installer Windows belum production-signed dan tidak
boleh dipromosikan menjadi stable sebelum secret Authenticode tersedia.

## Yang Sengaja Tidak Dilakukan

- Tidak melakukan rewrite repository.
- Tidak melakukan force-push atau hard reset.
- Tidak reset/drop database.
- Tidak mengedit migration yang sudah applied.
- Tidak menimpa atau memasukkan `.env`, password, keystore, token, atau
  credential lain ke Git.
- Tidak menyatakan 48 layar paritas 100% hanya berdasarkan route atau test otomatis.

## Status Akhir

Semua pekerjaan source-code yang aman dan dapat dilakukan pada sesi ini sudah
masuk `main`. Aplikasi adalah **kandidat UAT**, bukan bukti final paritas 100%.
Status final tetap menunggu UAT perangkat fisik, printer/scanner, jaringan
lapangan, rekonsiliasi berdampingan dengan legacy, persetujuan pemilik proses,
dan Authenticode Windows.
