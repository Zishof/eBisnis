# POS-0 · Matriks Celah

Status memakai kosakata yang diminta perintah prioritas:

| Status | Arti |
|---|---|
| `DONE` | Sudah ada, sudah diuji, dapat dipakai apa adanya |
| `PARTIAL` | Sebagian ada; perlu dilengkapi, bukan dibangun dari nol |
| `MISSING` | Belum ada sama sekali |
| `BROKEN` | Ada tetapi tidak berfungsi sebagaimana mestinya |
| `CONFLICTING` | Ada dua implementasi yang saling bertentangan |
| `BLOCKED` | Tidak dapat dikerjakan karena penghalang di luar kendali |
| `NOT_APPLICABLE` | Tidak relevan bagi eBisnis |

---

## Ringkasan

| Status | Jumlah | Bagian |
|---|---|---|
| `DONE` | 14 | 21% |
| `PARTIAL` | 21 | 32% |
| `MISSING` | 28 | 42% |
| `BLOCKED` | 3 | 5% |
| **Total** | **66** | |

Tidak ada temuan `BROKEN` maupun `CONFLICTING`. Itu kabar baik: pekerjaan POS
adalah **menambah**, bukan membetulkan atau menyatukan dua jalan yang berbeda.

---

## POS-1 · Konteks dan RBAC

| Kemampuan | Status | Catatan |
|---|---|---|
| Tenant, brand, outlet | `DONE` | Tabel `brand`, `outlet` lengkap dengan `legal_entity_id`, `region_id`, `timezone` |
| Peran, hak akses, cakupan data | `DONE` | 133 menu, 40 aksi, `user_scope_assignment` ditegakkan pada kueri |
| Pemisahan wewenang (SoD) | `DONE` | `segregation_of_duty_rule` beserta pelanggaran dan pengecualiannya |
| Pemilihan peran aktif saat masuk | `DONE` | V10-4; peran aktif tercatat pada audit (`V017`) |
| Register/terminal | `PARTIAL` | `pos_terminal` ada; **status** hanya `ACTIVE`, belum mengenal `READY`/`OPEN`/`SUSPENDED`/`MAINTENANCE`/`CLOSED` |
| Penugasan kasir ke register | `MISSING` | Tidak ada `pos_register_assignment`. Tanpa ini, kasir mana pun dapat memakai register mana pun |
| Perangkat register (printer, laci, pemindai) | `PARTIAL` | `pos_terminal.printer_config` (JSONB) dan `platform_device_id` ada; tidak ada tabel perangkat tersendiri |
| Hak akses khusus POS | `MISSING` | Tidak ada `POS.SELL`, `POS.HOLD`, `POS.DISCOUNT_LINE`, `POS.PRICE_OVERRIDE`, `POS.VOID_*`, `POS.OPEN_SHIFT`, `POS.CLOSE_SHIFT`, `POS.CASH_IN/OUT`, `POS.RECONCILE`, `POS.APPROVE_*`. Lihat [04](04-role-permission-matrix.md) |
| Peran bawaan Kasir POS / Supervisor Kasir | `PARTIAL` | Katalog peran V8-R1 ada; peran khusus POS belum disemai |
| `GET /pos/context` | `MISSING` | — |

## POS-2 · Katalog, barcode, harga, pajak

| Kemampuan | Status | Catatan |
|---|---|---|
| Produk, SKU, kategori, merek | `DONE` | `product` (35 kolom) termasuk `sku`, `barcode`, `gtin`, `tracking_type`, `is_sellable`, `allow_negative_stock` |
| Barcode alternatif | `DONE` | `product_barcode` dengan `is_primary`, `barcode_type`, `uom_id` |
| Satuan dan konversinya | `DONE` | `uom`, `uom_conversion` |
| Kategori dan tarif pajak | `DONE` | `tax_category`, `tax_rate` dengan `rate`, `is_inclusive`, `effective_from/until` |
| Buku harga | `PARTIAL` | `price_book` (`scope_type`/`scope_id`, `valid_from/until`) dan `price_book_item` (`minimum_qty`) ada. **Belum ada versi buku harga** dan **belum ada penugasan buku harga ke outlet** |
| Varian produk | `MISSING` | Tidak ada `product_variant`. Perintah menyebutnya wajib pada 6.5 |
| Mesin kuotasi harga POS | `MISSING` | **Perhatian:** `PricingEngineService` yang ada adalah mesin harga **langganan SaaS** (`planCode`, `billingInterval`), bukan harga produk. Harus dibangun baru |
| Evaluator diskon | `PARTIAL` | `DiscountEvaluatorService` sudah ada, berbasis pohon kondisi tanpa `eval` — dapat dipakai ulang untuk diskon POS |
| Promosi | `MISSING` | Tidak ada tabel promosi, kupon, ambang persetujuan diskon |
| Harga per pelanggan / per kanal | `MISSING` | `price_book.scope_type` mungkin dapat menampungnya; perlu ditelaah |
| `GET /pos/catalog/search`, `/products/by-barcode/:barcode`, `POST /pos/price/quote` | `MISSING` | — |

## POS-3 · Ketersediaan persediaan

| Kemampuan | Status | Catatan |
|---|---|---|
| Saldo stok (on-hand, reserved, available) | `DONE` | `stock_balance` dengan enam ember: on_hand, reserved, available, in_transit, quarantine, damaged |
| Reservasi stok | `PARTIAL` | Tabel `stock_reservation` ada. `StockReservationService` yang ada TIDAK dapat dipakai — ia bekerja pada `online_listing_variant`, bukan `stock_balance`. Lihat koreksi pada [02](02-existing-module-reuse-map.md) |
| Buku besar pergerakan stok | `DONE` | `stock_movement` dengan `posting_key` dan `idempotency_key` |
| Kebijakan stok negatif | `PARTIAL` | `product.allow_negative_stock` dan `stock_policy` ada; belum ada penegakannya di jalur POS |
| Batch / serial | `PARTIAL` | `inventory_lot` dan `product.tracking_type` ada; belum ada pemilihan lot di kasir |
| `POST /pos/stock/check|reserve|release` | `MISSING` | Layanannya ada, endpoint POS-nya belum |

## POS-4 · Register, shift, kas

| Kemampuan | Status | Catatan |
|---|---|---|
| Shift kasir | `PARTIAL` | `pos_shift` punya `opening_cash`, `closing_cash`, `expected_cash`, `variance`, `status`. **Belum ada** `outlet_id` langsung (hanya lewat `terminal_id`), `opened_by`/`closed_by`, dan catatan alasan selisih |
| Pergerakan kas | `PARTIAL` | `cash_drawer_movement` ada dengan `movement_type`, `reason`. Belum ada penghitungan kas berdenominasi (`pos_cash_count`) |
| Persetujuan penutupan shift | `MISSING` | Tidak ada `pos_shift_approval` maupun ambang selisih |
| Penugasan shift | `MISSING` | Tidak ada `pos_shift_assignment` |
| Tujuh endpoint `/pos/shifts/*` | `MISSING` | — |

## POS-5 · Keranjang dan mesin penjualan

| Kemampuan | Status | Catatan |
|---|---|---|
| Kepala dan baris penjualan | `DONE` | `pos_sale` (25 kolom) dan `pos_sale_line` (13 kolom) |
| Idempotensi | `DONE` | `pos_sale.idempotency_key`, `pos_payment.idempotency_key`, plus tabel `idempotency_record` |
| Penguncian optimistik | `DONE` | Kolom `version` pada seluruh tabel POS |
| Cuplikan harga pokok | `PARTIAL` | `pos_sale_line.cost_snapshot` ada. **Belum ada** cuplikan harga, pajak, promosi, dan pelanggan |
| Rincian pajak per baris | `MISSING` | `pos_sale_line.tax_amount` hanya menyimpan jumlahnya; tidak ada `pos_sale_line_tax` yang menyebutkan tarif mana yang dipakai |
| Rincian diskon per baris/keranjang | `MISSING` | Sama — hanya jumlahnya, bukan asal-usulnya |
| Riwayat status penjualan | `MISSING` | Tidak ada `pos_sale_status_history` |
| Tahan/lanjutkan keranjang (hold/resume) | `PARTIAL` | `pos_sale.status` dapat menampung `HELD`; alur dan endpointnya belum ada |
| Status penuh (13 status) | `MISSING` | Tidak ada mesin transisi status POS. Pola `order-state.ts` dapat ditiru |
| Sembilan endpoint `/pos/sales/*` | `MISSING` | — |
| Layar kasir `/pos` | `MISSING` | — |

## POS-6 · Pembayaran dan penyelesaian

| Kemampuan | Status | Catatan |
|---|---|---|
| Metode pembayaran | `DONE` | `payment_method` dengan `method_type`, `requires_reference`, `allows_change` |
| Pembayaran majemuk (mixed) | `PARTIAL` | `pos_payment` berelasi banyak-ke-satu terhadap `pos_sale`, jadi strukturnya mendukung. Alokasi dan riwayat statusnya belum ada |
| Kembalian | `DONE` | `pos_payment.tendered_amount`, `change_amount`; `pos_sale.change_total` |
| Penugasan metode pembayaran per outlet | `MISSING` | Tidak ada `payment_method_outlet_assignment` |
| Pembayaran daring/QRIS di kasir | `BLOCKED` | Bergantung pada kontrak penyedia. Sesuai perintah §29, POS tunai dan kartu-manual tetap diselesaikan lebih dahulu |
| Tiga endpoint pembayaran | `MISSING` | — |

## POS-7 · Struk

| Kemampuan | Status | Catatan |
|---|---|---|
| Nomor struk | `PARTIAL` | `pos_sale.receipt_number` ada, dan `number_sequence` menyediakan penomoran per lingkup. Belum tersambung |
| Penomoran anti-kembar di bawah permintaan bersamaan | `DONE` | Pola sudah terbukti pada tata kelola surat V10-6 dan dapat dipakai ulang |
| Tabel struk tersendiri | `MISSING` | Tidak ada `pos_sale_receipt`; cetak ulang tidak dapat diaudit tanpanya |
| Cetak PDF | `BLOCKED` | Prasyarat V8-7 (job cetak PDF) belum dibangun — lihat tugas tertunda #32 |
| Kirim struk lewat surel | `PARTIAL` | Hub notifikasi ada; kredensial kanal surel belum tersedia |
| Empat endpoint struk | `MISSING` | — |

## POS-8 · Void, retur, refund

| Kemampuan | Status | Catatan |
|---|---|---|
| Aturan retur dan perhitungan refund | `PARTIAL` | `modules/return/return-rules.ts` punya `computeRefundAmount`, `canCompleteRefund`, `resolveRefundMethod`. Jendela 7 hari adalah aturan marketplace — POS memerlukan kebijakannya sendiri |
| Tabel retur/refund POS | `MISSING` | Tidak ada `pos_return`, `pos_return_line`, `pos_refund` |
| Void sebelum pembayaran | `MISSING` | — |
| Void sesudah selesai, dengan persetujuan | `MISSING` | — |
| Larangan menyetujui sendiri | `PARTIAL` | Mesin SoD ada dan sudah menegakkan aturan sejenis; aturan khusus POS belum disemai |
| Lima endpoint void/retur/refund | `MISSING` | — |

## POS-9 · Dasbor dan laporan

| Kemampuan | Status | Catatan |
|---|---|---|
| Kerangka laporan | `PARTIAL` | `saved_view` ada; tidak ada laporan POS |
| Ekspor Excel | `BLOCKED` | Prasyarat V8-5/6 belum dibangun — tugas tertunda #29 |
| Kelompok aksi CRUD standar | `MISSING` | Prasyarat V8-4 — tugas tertunda #28 |
| Empat belas laporan POS | `MISSING` | — |
| Dasbor kasir/supervisor/kepala toko | `MISSING` | — |

## POS-10 · Data contoh

| Kemampuan | Status | Catatan |
|---|---|---|
| Kerangka data contoh | `DONE` | Baru diperbarui: golongan `REFERENCE`/`EXAMPLE`, pilihan saat mendaftar, pembersihan yang tidak melumpuhkan |
| Penanda `is_sample` + `sample_batch_id` | `DONE` | Ada pada seluruh tabel master, termasuk `pos_terminal` |
| Profil demo POS (3 merek, 10 outlet, 500 produk, 500 penjualan) | `MISSING` | Perlu pabrik data contoh POS tersendiri |
| Tombol "Hapus Seluruh Data Contoh POS" | `PARTIAL` | Halaman Data Contoh sudah ada; belum ada penyaringan khusus POS |

## POS-11 · Bantuan dan tur berpandu

| Kemampuan | Status | Catatan |
|---|---|---|
| Pusat Bantuan | `BLOCKED` | Prasyarat V8-1/V8-2 belum dibangun — tugas tertunda #26, #27. Tidak ada tabel bantuan sama sekali |
| Enam belas topik bantuan POS | `MISSING` | Bergantung pada yang di atas |

## POS-12 · AI non-pemblokir

| Kemampuan | Status | Catatan |
|---|---|---|
| Gerbang AI | `DONE` | V11 — 18 keperluan, bukti, redaksi, kuota, audit |
| Batas kewenangan AI | `DONE` | AI tidak dapat memposting, menyetujui, membayar, atau menghapus |
| Enam keperluan AI khusus POS | `MISSING` | Ditambahkan sesudah transaksi inti stabil, sesuai perintah §19 |

## Lintas bagian

| Kemampuan | Status | Catatan |
|---|---|---|
| Catatan galat dan kinerja | `DONE` | V10-2, V10-3 |
| Catatan aktivitas menu/tombol | `DONE` | V10-5 (`ui_activity_log`) |
| Audit hanya-bertambah | `DONE` | V008 pemicu basis data |
| Peran aktif pada audit | `DONE` | V017 |
| Hub notifikasi | `DONE` | V10-7, termasuk pengelompokan dan SLA |
| Peristiwa akuntansi | `PARTIAL` | `accounting_event` dan mesin postingnya ada; **dua belas kode peristiwa `POS_*` belum ada** — yang ada hanya 12 kode `MARKETPLACE_*` |
| Zona waktu tenant | `PARTIAL` | `outlet.timezone` ada; `pos_sale.business_date` ada. Penentuan tanggal usaha dari zona waktu outlet belum diterapkan |

---

## Tiga penghalang yang tidak dapat diselesaikan di jalur POS

Ketiganya berasal dari V8 yang belum pernah dibangun. Sesuai perintah §29,
POS **tetap berjalan** tanpa ketiganya — masing-masing menurunkan mutu, bukan
menghentikan kasir:

1. **Pusat Bantuan (V8-1/V8-2)** → POS-11 tidak dapat dikerjakan. Kasir tetap
   dapat berjualan; yang hilang adalah panduan dalam aplikasi.
2. **Ekspor Excel (V8-5/6)** → laporan POS hanya dapat ditampilkan di layar.
3. **Job cetak PDF (V8-7)** → struk dapat dicetak lewat pencetak termal dan
   ditampilkan di layar, tetapi tidak dapat diunduh sebagai PDF.

Ketiganya dicatat sebagai `BLOCKED`, bukan diam-diam dilewati. Bila hendak
dibuka, ketiganya adalah pekerjaan tersendiri di luar jalur kritis POS.
