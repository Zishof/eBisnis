# Gap Analysis Code Existing vs Analisis Video 48 Layar

Tanggal audit: **2026-08-11 (Asia/Jakarta)**
Baseline repository: **`e5c339935ad0f90dd20b3b4c201c5aab8ae6e47c`**
Sumber requirement: **`ANALISIS_VIDEO_SISTEM_SALES_48_LAYAR.md`**, 48 frame dan `FRAME_MANIFEST.csv` dari paket Google Drive.

## 1. Kesimpulan eksekutif

Repository **sudah menjadi kandidat UAT fungsional**, tetapi belum dapat
dinyatakan mempunyai paritas terverifikasi 100% untuk 48 layar sebelum bukti
perangkat fisik, printer/scanner, rekonsiliasi berdampingan dengan legacy, dan
persetujuan pemilik proses selesai. Vertical slice utama bukan lagi skeleton:
pricing, purchase-to-pay, order-to-cash, custody, costing, laporan, konflik, dan
offline sales sudah mempunyai implementasi nyata.

Fakta baseline yang dapat dibuktikan:

- seluruh nomor layar 1–48 memiliki pemetaan route Web dan workspace Flutter;
- registry memiliki bukti capability `view` untuk API, Web, Windows, dan Android;
- API mempunyai workflow nyata untuk master pihak, stock opname, price book,
  pembelian/GR/AP, penjualan/AR, custody nota lengkap, jurnal, periode, dan snapshot laporan;
- Flutter mempunyai UI nyata untuk CRUD master, transaksi penjualan/pembelian,
  stock opname, harga, AP/AR, nota, jurnal, laporan, local database, dan sync;
- Web mempunyai CRUD master, purchase-to-pay terpadu, customer pricing, transaksi
  sales, stock opname, price book, AP/AR, konflik sinkronisasi, jurnal/periode,
  laporan, serta draft IndexedDB untuk layar 20/30.

Namun, menurut source of truth `parity-48.json` dan
`parity-evidence.registry.ts`:

| Ukuran | Kondisi aktual |
| --- | --- |
| Layar dengan bukti `view` API | 48/48 |
| Layar dengan bukti `view` Web | 48/48 |
| Layar dengan bukti `view` Windows | 48/48 |
| Layar dengan bukti `view` Android | 48/48 |
| Layar lengkap pada semua capability dan surface | **0/48** |
| Requirement capability registry | 606 |
| Requirement masih pending | **414** |
| Bukti rekonsiliasi API yang dimodelkan | **0/48** |
| Bukti device UAT/production verified | **0/48** |

Registry sekarang memodelkan 606 kombinasi `screen + surface + capability`:
`view`, mutasi yang relevan, `print`, `export`, `offline`, `reconciliation`, dan
`hardware`. Sebanyak 192 bukti `view` sudah proven; dua bukti Web layar 30 masih
`SOURCE_IMPLEMENTED` dan sengaja belum dihitung proven. Sisanya tetap pending
sampai ada test atau UAT yang membuktikan capability persis pada surface terkait.

**Keputusan audit:** semua layar berada pada status **PARTIAL / EVIDENCE GAP**;
tidak ada layar yang boleh diberi label paritas 100% sampai matriks capability
per-surface, test, rekonsiliasi, dan UAT-nya terpenuhi.

## 2. Ruang lingkup dan metode

Audit membandingkan requirement Drive dengan:

- katalog 48 layar dan evidence registry API;
- route dan halaman React Web;
- aplikasi Flutter yang dipakai bersama oleh Windows dan Android;
- local database Drift, outbox, retry, cursor, dan fallback cache;
- controller/service API, migration aditif, permission, idempotency, audit;
- report preview/snapshot/print log dan renderer lokal;
- unit/widget/integration/E2E/golden/UAT evidence yang tersimpan di repository;
- bukti build/release yang tercatat di dokumen implementasi.

Label yang dipakai:

- **ADA**: source dan bukti relevan tersedia untuk kemampuan yang disebutkan.
- **PARTIAL**: alur utama ada, tetapi field, state, surface, output, atau test belum lengkap.
- **GAP**: requirement penting belum ditemukan pada source aktif.
- **UAT**: perilaku harus diputuskan/dibuktikan bersama pemilik proses atau perangkat nyata.
- **EVIDENCE**: source mungkin ada, tetapi registry/test belum membuktikan klaimnya.

Audit ini tidak menyamakan satu route yang dapat dibuka dengan layar yang
operasional, dan tidak menyamakan PDF lokal dengan snapshot server yang
versioned, direkonsiliasi, dan mempunyai print log.

## 3. Gap lintas seluruh sistem

### 3.1 Katalog dan evidence registry

`sales-inventory-parity.catalog.ts` menyatakan Web, Windows, dan Android
`OPERATIONAL` untuk 48 layar. Klaim tersebut belum konsisten dengan registry:

- registry sudah per-surface/per-capability, tetapi bukti proven masih terutama `view`;
- bukti API lama dinormalisasi sebagai `view`, walaupun dokumen UAT di dalamnya
  kadang menguji command lain;
- 48 requirement `api/reconciliation` masih pending;
- `SOURCE_IMPLEMENTED` untuk Web layar 30 `create/offline` belum termasuk status proven;
- requirement per-screen untuk print/export/offline/hardware sudah ada; bukti transaksinya masih harus diisi;
- bukti Windows dan Android sama-sama terutama navigasi, bukan transaksi per surface.

**Tindakan wajib P0:** turunkan seluruh tombol dan acceptance test dari dokumen
Drive ke registry per `screen + surface + capability`; turunkan status katalog
yang tidak mempunyai bukti atau tampilkan status capability, bukan satu label
`OPERATIONAL` yang menggabungkan semuanya.

### 3.2 API dan model data

Fondasi API kuat. Pass implementasi 2026-08-11 sudah menutup pemilihan harga
server-authoritative, snapshot harga/HPP/salesperson, filter SQL laporan, tiga
laporan layar 41, governance snapshot, lifecycle nota lengkap, dua diskon
pembelian, supplier invoice yang terhubung ke goods receipt/payable, limit
kredit, alokasi stok FEFO, registrasi/resolusi aman konflik sinkronisasi, serta
reversal GR yang menjaga moving-average cost. Gap tersisa:

- transfer dan retur/void masih memerlukan pembuktian costing database serta
  rekonsiliasi dengan skenario legacy;
- semua report memakai permission `SALES.READ`, termasuk finance/P&L, sehingga
  permission per domain/output belum granular.
- conflict resolution aman saat ini menyediakan `SERVER_WINS`; penerapan otomatis
  `CLIENT_WINS/MERGED` belum boleh diklaim karena memerlukan merger per entity;
- seluruh capability baru masih memerlukan integration test database dan UAT
  Web/Windows/Android sebelum status registry dapat dinaikkan.

### 3.3 Web

Web mempunyai alur nyata, namun belum memenuhi kontrak setiap layar:

- banyak layar 8–48 dihimpun dalam `InventoryControlPage`; route berbeda hanya
  memilih tab/workspace, bukan selalu menyediakan kontrol layar legacy secara lengkap;
- transaksi pembelian sudah memuat nomor faktur supplier, tanggal/jatuh tempo,
  dua diskon berurutan, harga neto, dan pipeline PO→approve→GR→inspect→stock→AP;
  gap Web yang tersisa adalah outbox offline dan UI reversal terpadu;
- transaksi penjualan membuat mobile order, bukan seluruh alur draft → submit →
  invoice/posting → PDF/print → reversal pada satu workspace;
- draft IndexedDB tersedia dan Web dapat melihat/menyelesaikan konflik dengan
  kebijakan `SERVER_WINS`; outbox transaksi Web penuh belum tersedia;
- banyak tombol cetak/Excel/PDF memakai `window.print()` atau data tabel saat ini,
  bukan snapshot server yang immutable dan mempunyai print log;
- E2E membuktikan 15 route dapat dibuka dan layar 20/30 search-first, tetapi belum
  membuktikan delapan ID test minimum untuk masing-masing dari 48 layar.

### 3.4 Flutter Windows dan Android

Satu codebase Flutter adalah pilihan yang benar untuk Windows dan Android, tetapi
bukti kedua surface tetap harus terpisah.

Yang sudah ada:

- CRUD master, cache master, dan outbox save master;
- katalog offline dan outbox Sales Order idempoten;
- riwayat Sales Order dan pembatalan order yang memenuhi guard server;
- UI pembelian, transisi PO, goods receipt, AP/AR, nota, stock opname, price book,
  jurnal, periode, PDF/Excel, snapshot/print log khusus finance;
- local database Drift untuk cache, outbox, retry backoff, device, dan cursor.

Gap utama:

- outbox belum dipakai oleh pembelian, AP/AR, nota, opname, price book, jurnal,
  reversal, dan report command;
- UI resolusi aman `SERVER_WINS` tersedia; `CLIENT_WINS/MERGED` sengaja belum
  diaktifkan tanpa merger per entity agar tidak merusak data;
- cache belum mencakup seluruh master/ledger/workspace yang dibutuhkan 48 layar;
- PDF pembelian/AP/AR umumnya dirender dari data live lokal dan tidak membuat
  snapshot/print log server; Excel tidak tersedia konsisten pada semua laporan;
- pembayaran Flutter sudah mendukung nominal parsial, CASH/TRANSFER/GIRO/OTHER,
  bank/referensi/jatuh-tempo giro/catatan, histori dan reversal; multi-allocation
  dalam satu dokumen masih perlu UAT/penyempurnaan UI;
- lifecycle nota Flutter/API sudah memuat carried, partial collected, returned,
  reconciled, closed, lost/disputed dan resolusi exception; bukti serah-terima
  fisik/tanda tangan tetap memerlukan keputusan UAT;
- Android evidence hanya instrumentation/emulator navigasi; Windows evidence
  terutama widget/golden/build. Tidak ada UAT transaksi pada perangkat fisik,
  printer, barcode/scanner, jaringan putus, atau update-in-place terbaru;
- evidence release yang ada masih merujuk kandidat 0.1.26, sedangkan source
  Flutter saat audit sudah `0.1.32+32`.

### 3.5 Laporan, cetak, dan ekspor

API sudah mempunyai preview, immutable snapshot, fetch snapshot, dan print log.
Kesenjangannya:

- filter tanggal/dokumen/party/status utama sudah diterapkan pada query report;
  kombinasi edge-case tetap memerlukan rekonsiliasi UAT;
- Web/Flutter belum selalu mengambil snapshot sebelum output;
- PDF/Excel/cetak belum menggunakan satu renderer/kontrak yang memastikan judul,
  kolom, total, halaman, snapshot version, approval, watermark, dan traceability sama;
- snapshot sekarang mempunyai hash payload, versi, approval, page count,
  watermark, print log, serta alasan reprint;
- layar 41 sudah dipisahkan menjadi `Rekap Penjualan Barang`, `Outstanding
  Piutang`, dan `Register Event Piutang`; kesetaraan hasil masih harus
  direkonsiliasi terhadap data legacy.

### 3.6 Test, CI, release, dan UAT

Evidence 2026-08-10 mencatat CI/Web E2E/Flutter test hijau pada commit kandidat
lama. Evidence itu tidak membuktikan commit baseline audit ini.

Dependency lokal sudah dipulihkan secara reproducible. Regression pada working
tree ini berhasil: build API bersih; seluruh Jest lulus; Web **46 file / 511
test** lulus; Flutter analyze tanpa issue dan **203 test** lulus. Migration
aditif V064–V068 juga sudah diterapkan pada 16 schema tenant lokal. Hasil ini
belum menggantikan UAT Android/Windows fisik, peripheral, production DNS dari
seluruh jaringan operator, signing produksi, dan rekonsiliasi berdampingan
dengan aplikasi legacy.

## 4. Matriks gap per layar

### 4.1 Master pihak dan sales — layar 1–7

| No | Kontrak utama | Existing | Gap terhadap dokumen Drive | Status |
| --- | --- | --- | --- | --- |
| 01 | CRUD Supplier, navigator, detail/list, nonaktif, audit, print/export, offline | API CRUD/lifecycle/audit; Web dan Flutter form/list; Flutter save outbox | Navigator first/prev/next/last dan unsaved guard belum terbukti konsisten; print/export snapshot dan UAT offline per surface belum ada | PARTIAL + EVIDENCE |
| 02 | Buka daftar Supplier lengkap | Daftar/search dan supplier workspace tersedia | Kolom/filter legacy, PDF/Excel snapshot, keyboard/accessibility, dan UAT visual berdampingan belum terbukti | PARTIAL |
| 03 | Tutup daftar tanpa kehilangan state | Mode list/detail dapat berpindah | Restorasi fokus/record terpilih, warning perubahan belum disimpan, dan acceptance test khusus layar 03 belum ada | EVIDENCE |
| 04 | CRUD Customer, kredit/termin/bank, audit, offline | API/Web/Flutter CRUD, balance, masking sebagian | Navigator/unsaved guard, validasi kredit lintas order, snapshot print/export, dan device UAT belum lengkap | PARTIAL |
| 05 | Buka daftar Customer | Daftar/search dan saldo tersedia | Kesetaraan kolom/filter, output snapshot, dan bukti lintas surface belum lengkap | PARTIAL |
| 06 | Tutup daftar Customer | Panel dapat ditutup/kembali | State/focus/dirty-form guard dan test khusus belum dibuktikan | EVIDENCE |
| 07 | CRUD Sales dan relasi customer/territory | API profil sales, Web/Flutter master, guard sales nonaktif pada order | Mapping account/territory, navigator, print/export, offline lifecycle, serta keputusan akun sales legacy masih UAT | PARTIAL + UAT |

### 4.2 Stok, opname, harga — layar 8–19

| No | Kontrak utama | Existing | Gap terhadap dokumen Drive | Status |
| --- | --- | --- | --- | --- |
| 08 | Saldo per gudang/batch/expiry, ledger, nilai stok | API balance/catalog; Web/Flutter tabel stok; average cost dari GR | Costing transfer, reversal GR, retur/void belum lengkap; drill-down ledger/batch dan rekonsiliasi fisik belum terbukti | PARTIAL |
| 09 | Session opname, freeze, count, approval, post adjustment | API/Web/Flutter workflow nyata | Offline count/retry/conflict, attachment, role separation, chaos test, dan device UAT belum ada | PARTIAL |
| 10 | Cetak laporan opname | API snapshot dan PDF lokal tersedia | Output Web/Windows/Android belum konsisten memakai snapshot+print log; Excel, reprint marker, dan report golden belum lengkap | PARTIAL |
| 11 | Analisis harga beli/jual dan histori | Riwayat harga dan price book tampil | Harga historis belum menjadi sumber pemilihan harga transaksi; margin/exception dan effective selection belum end-to-end | GAP FUNGSIONAL |
| 12 | Cari kode/nama/party pada harga | Search tabel/workspace tersedia | Kombinasi filter party-produk-periode, leading-zero code, pagination, dan test per surface belum terbukti | PARTIAL |
| 13 | Cetak harga jual | Endpoint `price-sale` dan renderer lokal ada | Snapshot/print log belum diwajibkan UI; parameter/customer/effective date dan report golden belum lengkap | PARTIAL |
| 14 | Excel harga/stok | Web/Flutter dapat membuat file lokal | Ekspor belum selalu berasal dari immutable snapshot; metadata, hash, audit export, costing nol/edge-case belum ditutup | PARTIAL |
| 15 | Cetak daftar stok | API `stock-list`; Web/Flutter PDF/print | Snapshot/version/watermark/page-total dan konsistensi filter gudang/batch belum terbukti | PARTIAL |
| 16 | Preview/hasil cetak stok | Fetch snapshot API tersedia | Viewer pagination/zoom/reprint history lintas surface dan exact column/total golden belum lengkap | PARTIAL |
| 17 | Hub Master Harga | Price book create/submit/approve/reject/inactivate ada | Import, diff versi, overlap effective date, audit UI lengkap, offline, dan test approval dua pengguna belum lengkap | PARTIAL |
| 18 | Harga beli per Supplier | Harga supplier approved dipakai server pada PO dan disnapshot; dua diskon berurutan tersedia | Quantity break, import/export/version history dan UAT approval belum lengkap | PARTIAL + UAT |
| 19 | Harga jual per Customer | Harga customer approved dipakai server dan direfresh di Web/Flutter; limit kredit divalidasi | Price floor/exception, import/export/history dan UAT belum lengkap | PARTIAL + UAT |

### 4.3 Pembelian dan hutang — layar 20–29

| No | Kontrak utama | Existing | Gap terhadap dokumen Drive | Status |
| --- | --- | --- | --- | --- |
| 20 | Pembelian supplier lengkap: faktur, due date, batch/expiry, dua diskon, tax, draft/post/reverse | API/Web/Flutter menjalankan PO→approve→GR→inspect→stock→supplier invoice/AP dengan field lengkap | Reversal terpadu dan purchase offline outbox belum lengkap; device UAT masih wajib | PARTIAL + UAT |
| 21 | Deep-link Hutang dari Pembelian | Route AP dan ledger tersedia | Context PO/faktur terpilih tidak terbukti dipertahankan; tidak ada acceptance test deep-link tanpa duplikasi | PARTIAL |
| 22 | Ledger Hutang supplier | API/Web/Flutter daftar open item dan saldo | Detail event, drill-down source/reversal, pagination, offline cache, dan reconciliation proof per surface belum lengkap | PARTIAL |
| 23 | Tampilkan/Sembunyikan data lunas hanya sebagai filter | Web/Flutter `includeSettled` tersedia; histori tidak dihapus | Label dua arah, persistence filter, data parsial/reversal, dan acceptance test semua surface belum lengkap | PARTIAL |
| 24 | Bayar hutang parsial/multi-allocation, metode, ref bank/BG, post/reverse | API allocation/post/reverse; Web dan Flutter mendukung nominal parsial, metode, bank/ref/giro/catatan dan reversal | Multi-allocation UI dan offline retry belum lengkap | PARTIAL |
| 25 | Riwayat pembayaran hutang | API dan Web/Flutter list tersedia | Detail allocation, status reversed, filter/periode/search, reprint, pagination dan offline belum lengkap | PARTIAL |
| 26 | Cetak pembayaran hutang | API report snapshot; PDF Flutter | UI belum konsisten snapshot+print log; status draft/reversed, Excel, watermark/reprint reason dan golden belum lengkap | PARTIAL |
| 27 | Aging hutang | API net of posted allocation; Web/Flutter view/PDF | Bucket/parameter as-of dan party filters belum komprehensif; filters payload tidak diterapkan ke SQL; reconciliation evidence belum dimodelkan | PARTIAL |
| 28 | Cetak satu faktur pembelian | API report dan PDF detail Flutter | API report mengabaikan filter PO sehingga dapat memuat semua dokumen; Web belum single-document snapshot/reprint workflow | GAP FUNGSIONAL |
| 29 | Laporan pembelian per periode | API/Flutter register tersedia | Query hanya `order_date <= asOf`; tidak ada period start dan filter supplier/gudang/status; Excel/snapshot UI belum konsisten | GAP FUNGSIONAL |

### 4.4 Penjualan, piutang, dan nota — layar 30–42

| No | Kontrak utama | Existing | Gap terhadap dokumen Drive | Status |
| --- | --- | --- | --- | --- |
| 30 | Sales Order search-first, special price, credit, batch/FEFO, draft/post/reverse/print/offline | Web/Flutter memakai customer price; API credit/FEFO/HPP/salesperson; Flutter draft/history/cancel/outbox/post invoice | Web belum mempunyai outbox; print/reversal terpadu dan bukti device masih belum lengkap | PARTIAL + UAT |
| 31 | Buka Piutang dari order tanpa duplikasi | Route/ledger AR tersedia | Deep-link dengan order/customer terpilih, invariant no-duplicate dan UI acceptance test belum tersedia | PARTIAL |
| 32 | Ledger Piutang customer | API/Web/Flutter open item tersedia | Detail event/source invoice/reversal, offline cache, pagination dan reconciliation per surface belum lengkap | PARTIAL |
| 33 | Tampilkan/Sembunyikan piutang lunas sebagai filter | Web/Flutter `includeSettled` tersedia | Label dua arah, persistence, partial/reversal behavior dan test lintas surface belum lengkap | PARTIAL |
| 34 | Terima piutang parsial/multi-allocation, metode, post/reverse | API idempotent allocation/post/reverse; Web/Flutter parsial, metode, bank/ref/giro/catatan, history/reverse | Multi-allocation UI dan offline receipt belum lengkap | PARTIAL |
| 35 | Riwayat penerimaan piutang | API/Web/Flutter list tersedia | Detail allocation, reversed state, filter/periode, reprint, pagination dan offline belum lengkap | PARTIAL |
| 36 | Cetak penerimaan piutang | API snapshot; PDF Flutter | Output belum konsisten snapshot+print log, Excel, watermark/reprint reason, golden dan device print UAT | PARTIAL |
| 37 | Aging piutang per Customer | API net outstanding dan PDF Flutter | Filter/bucket/periode belum lengkap; filters payload belum diterapkan; drill-down dan reconciliation proof belum dimodelkan | PARTIAL |
| 38 | Aging piutang per Sales | Endpoint/report tersedia | Sumber atribusi sales pada sales order tidak utuh; hasil dapat menjadi “Tanpa sales”; perlu model, backfill, reconciliation, dan UAT | GAP DATA |
| 39 | Sales Membawa Nota dengan custody state machine lengkap | API/Flutter memuat READY→HANDED_OVER→CARRIED→PARTIAL_COLLECTED/RETURNED→RECONCILED→CLOSED serta LOST/DISPUTED | Signature/evidence fisik dan keputusan custody final masih UAT | PARTIAL + UAT |
| 40 | Paket Nota Sales, print, return/reconcile/close | Lifecycle, exception resolve, detail dan report snapshot tersedia | Signature, device print, dan rekonsiliasi berdampingan legacy belum terbukti | PARTIAL + UAT |
| 41 | Tiga laporan eksplisit: sales-by-product, outstanding AR, event register | Tiga report code dan kolom eksplisit tersedia di API/UI | Golden output dan rekonsiliasi nilai legacy masih harus dibuktikan | PARTIAL + UAT |
| 42 | Preview/cetak laporan terpilih | Snapshot/fetch/print-log API tersedia | Jenis report layar 41 belum lengkap; filter tidak diterapkan penuh; PDF/Excel/title/total/version/reprint history lintas surface belum terbukti | PARTIAL BESAR |

### 4.5 Kas, jurnal, dan laba/rugi — layar 43–48

| No | Kontrak utama | Existing | Gap terhadap dokumen Drive | Status |
| --- | --- | --- | --- | --- |
| 43 | Jurnal double-entry draft/post/reverse, period lock, voucher/print/ledger | API dan Web/Flutter create/post/reverse/period tersedia | Attachment/voucher, draft edit/delete, cari/navigator, general ledger, cetak bukti, offline, dan SoD/RBAC UAT belum lengkap | PARTIAL |
| 44 | Chart of Accounts hierarchy/effective/mapping, nonaktif, print/export | API dan Web generic/Flutter create account tersedia | Parent/hierarchy, mapping legacy, effective date, opening balance control, nonaktif guard, PDF/Excel/audit UI dan UAT belum lengkap | PARTIAL BESAR |
| 45 | Menu parameter gross profit vs accounting P&L, HPP tambah, reset cache aman | Preview dua laporan tersedia di Web/Flutter | Field/kebijakan `HPP Tambah`, validasi HPP, versioned parameter, reset cache aman, exception list, approval dan UAT belum ada | GAP FUNGSIONAL + UAT |
| 46 | Gross profit dari HPP snapshot, retur/reversal, exception, print/Excel/snapshot | API gross-profit + snapshot/print-log; Flutter/Web finance output | Return/reversal dan zero/negative margin exception belum terbukti; approval/watermark/Excel/trace invoice dan report golden belum lengkap | PARTIAL BESAR |
| 47 | Detail P&L/gross margin, filter sales/item/settlement, reconciliation ledger | API accounting P&L dan gross-profit terpisah | UI belum menyediakan semua filter/detail legacy dan drill-down; mapping akun, period status, reconciliation exception, histori jurnal legacy masih UAT | PARTIAL BESAR + UAT |
| 48 | Final authorized versioned P&L, PDF/Excel, watermark, traceability | Snapshot immutable/versioned dengan hash, approval, watermark, page count, print/reprint log tersedia | Full-page golden, Excel parity, traceability UI dan approval UAT belum lengkap | PARTIAL + UAT |

## 5. Gap requirement yang belum dimodelkan di registry

Registry harus menambahkan requirement minimum berikut, dengan `NOT_REQUIRED`
hanya bila ada alasan bisnis dan approval:

| Kelompok layar | Capability wajib |
| --- | --- |
| 01–07 | view, create, update, deactivate, audit, print, export, offline, reconciliation |
| 08–19 | view, update/count, approve, post, reverse, print, export, offline, reconciliation |
| 20–29 | view, create, update, post, reverse, print, export, offline, reconciliation |
| 30–42 | view, create, update, post, cancel/reverse, print, export, offline, reconciliation |
| 43–48 | view, create/update yang relevan, post, reverse, approve, print, export, reconciliation |
| Windows/Android terkait | hardware untuk scanner, printer, share/save file, dan network recovery |

Setiap requirement perlu bukti terpisah untuk API, Web, Windows, dan Android.
Capability API tidak membuktikan tombol Web; widget test Windows tidak membuktikan
Android; navigasi Android tidak membuktikan transaksi; file PDF yang terbentuk
tidak membuktikan rekonsiliasi angkanya.

## 6. Prioritas penutupan

### P0 — kebenaran baseline dan blocker kontrak

1. Perluas registry menjadi capability per-screen/per-surface dan turunkan klaim
   `OPERATIONAL` yang belum mempunyai bukti.
2. Pulihkan dependency reproducible dan jalankan baseline pada commit yang sama.
3. Terapkan filter report ke SQL, termasuk period start/end dan document ID.
4. Pisahkan tiga report layar 41 dan tambahkan report code/kolom yang benar.
5. Putuskan dan implementasikan state machine custody layar 39–40.
6. Hubungkan master harga supplier/customer ke pricing transaksi dengan snapshot.
7. Lengkapi attribution sales dan costing edge cases agar rekonsiliasi tidak palsu.

### P1 — vertical slice transaksi lengkap

1. Layar 20–29: nomor faktur supplier, due date, dua diskon/net price, posting,
   reversal, AP partial/multi-allocation, report snapshot, offline.
2. Layar 30–42: price/credit/batch/FEFO, invoice/post/reverse, AR partial,
   custody/reconciliation, tiga report, snapshot, offline.
3. Layar 08–19: costing, opname offline, price version/import/export, report snapshot.
4. Layar 43–48: journal/COA lengkap, HPP policy, report approval/version/watermark.

### P2 — pembuktian release

1. Tambahkan ID test `NORMAL`, `VALIDATION`, `RBAC`, `AUDIT`, `PRINT-EXPORT`,
   `OFFLINE-RETRY`, `RECONCILIATION`, dan `VISUAL` untuk tiap layar.
2. Jalankan E2E Web dan integration Flutter untuk command, bukan hanya route.
3. Uji Windows dan Android secara terpisah pada database/API yang sama.
4. Uji printer, scanner/barcode, file save/share, jaringan putus, retry, konflik,
   update-in-place, dan recovery outbox pada perangkat nyata.
5. Bangun APK/installer dari commit yang sama, catat checksum/signature, lalu
   lakukan UAT berdampingan dengan legacy sebelum produksi.

## 7. Keputusan UAT yang masih terbuka

- custody nota: state, bukti serah-terima, partial collection, lost/disputed,
  reconciliation, dan aturan satu sales aktif per invoice;
- mapping akun sales legacy dan sumber histori jurnal/P&L;
- perilaku retur, void, reversal, write-off, harga di bawah HPP, dan reopen period;
- kebijakan `HPP Tambah (%)` dan reset perhitungan;
- definisi final tiga laporan pada layar 41 serta judul/kolom/totalnya;
- printer lama, ukuran kertas/rangkap, scanner, cash drawer, dan jaringan lapangan.

## 8. Sumber bukti utama

- `apps/api/src/modules/tenant/sales-inventory-parity.catalog.ts`
- `apps/api/src/modules/tenant/parity-evidence.registry.ts`
- `apps/api/src/modules/tenant/sales-inventory-operations.controller.ts`
- `apps/api/tenant-migrations/V046__sales_inventory_parity.sql`
- `apps/api/tenant-migrations/V047__sales_inventory_operations.sql`
- `apps/api/tenant-migrations/V048__sales_inventory_command_parity.sql`
- `apps/web/src/pages/app/InventoryControlPage.tsx`
- `apps/web/src/pages/app/InventoryTransactionWorkspacePage.tsx`
- `apps/web/src/pages/app/InventoryPartyMasterPage.tsx`
- `apps/pos-flutter/lib/inventory/inventory_app.dart`
- `apps/pos-flutter/lib/inventory/inventory_transaction_workspaces.dart`
- `apps/pos-flutter/lib/inventory/inventory_local_database.dart`
- `docs/implementation/inventory-sales-48/parity-48.json`
- `docs/implementation/inventory-sales-48/evidence/uat/2026-08-10-surface-release-readiness.md`
- `docs/pos-inventory-parity/evidence/screen-01..48/uat.md`

Integritas sumber Drive:

- ZIP SHA-256: `A4A76DE956F3343ACB1404AF102E89FCBC31B07E889546E0004A428FC1E58969`
- Markdown SHA-256: `B5AE2E41ADDF8E1D07139FDDE2C8A795032046258F3D91096DD07BA435EA64B2`
- manifest memuat tepat 48 frame; frame 30/31 dan 45/46 sengaja berbagi gambar
  tetapi mempunyai requirement dan acceptance test terpisah.

## 9. Exit criteria paritas 100%

Sebuah layar hanya boleh dinyatakan selesai bila:

1. seluruh tombol dan field kontrak tersedia atau disabled dengan alasan sah;
2. handler nyata, validation, permission, idempotency, audit, dan atomic posting lulus;
3. efek database dan ledger direkonsiliasi independen;
4. Web, Windows, dan Android memakai kontrak yang sama dan mempunyai bukti terpisah;
5. offline/cache/outbox/retry/conflict lulus bila surface membutuhkannya;
6. PDF/Excel/print berasal dari snapshot yang benar dan dapat ditelusuri;
7. automated test, device UAT, dan UAT berdampingan dengan legacy lulus;
8. registry menunjukkan seluruh capability required proven, bukan hanya `view`.

Sampai delapan syarat tersebut terpenuhi untuk seluruh 48 layar, status release
yang jujur adalah **kandidat UAT dengan gap**, bukan **paritas fungsional 100%**.
