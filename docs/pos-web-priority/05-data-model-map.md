# POS-0 · Peta Model Data

Apa yang sudah ada, apa yang perlu ditambahkan, dan mengapa.

Seluruh penambahan bersifat **aditif**: tabel baru dan kolom baru yang boleh
kosong. Tidak ada migrasi yang menghapus kolom, mengubah tipe, atau menyentuh
migrasi yang sudah diterapkan.

---

## Yang sudah ada dan tidak perlu diubah

```
pos_terminal (24) · pos_shift (14) · pos_sale (25) · pos_sale_line (13)
pos_payment (11)  · cash_drawer_movement (9)
product (35) · product_barcode (14) · uom · uom_conversion
tax_category (21) · tax_rate (25) · price_book (25) · price_book_item (16)
customer (30) · customer_group · payment_method (24)
stock_balance (16) · stock_reservation (13) · stock_movement (23) · stock_policy
outlet (29) · brand (22) · number_sequence (29) · idempotency_record
accounting_event (23) · accounting_posting_rule
```

Tiga hal yang layak disebut karena menghemat banyak pekerjaan:

- `pos_sale` sudah punya `offline_id` dan `sync_status` — mode luring sudah
  diantisipasi sejak awal.
- `pos_sale`, `pos_payment`, dan `stock_movement` sudah punya `idempotency_key`.
  Persyaratan idempotensi pada perintah §12 dan §13 tidak memerlukan migrasi.
- Seluruh tabel POS punya kolom `version` — penguncian optimistik siap dipakai.

---

## Kolom yang perlu ditambahkan (aditif, boleh kosong)

### `pos_shift`

| Kolom | Tipe | Alasan |
|---|---|---|
| `outlet_id` | UUID | Hari ini hanya lewat `terminal_id`. Kueri laporan per outlet harus menempuh dua join, dan cakupan data per outlet lebih sulit ditegakkan |
| `opened_by`, `closed_by` | UUID | `cashier_id` adalah pemilik shift; yang membuka dan menutup belum tentu orang yang sama |
| `variance_reason` | TEXT | Selisih kas tanpa alasan adalah selisih yang tidak dapat ditindaklanjuti |
| `approved_by`, `approved_at` | UUID, TIMESTAMPTZ | Penutupan shift yang selisihnya melampaui ambang |

### `pos_sale`

| Kolom | Tipe | Alasan |
|---|---|---|
| `brand_id` | UUID | Konteks transaksi pada perintah §6.1 menyebutkannya. Hari ini hanya lewat outlet |
| `active_role_id` | UUID | Peran aktif saat transaksi dibuat — sudah menjadi konvensi audit sejak V017 |
| `void_reason`, `voided_by`, `voided_at` | TEXT, UUID, TIMESTAMPTZ | — |
| `note` | TEXT | Catatan kasir pada transaksi |

### `pos_payment`

| Kolom | Tipe | Alasan |
|---|---|---|
| `sequence_no` | INTEGER | Urutan pembayaran pada transaksi majemuk |
| `reversed_at`, `reversed_by`, `reversal_reason` | TIMESTAMPTZ, UUID, TEXT | Pembalikan pembayaran perlu jejaknya sendiri |

### `pos_terminal`

| Kolom | Tipe | Alasan |
|---|---|---|
| `register_status` | VARCHAR(24) | `status` yang ada dipakai untuk siklus hidup master (aktif/nonaktif). Status operasional register — `READY`, `OPEN`, `SUSPENDED`, `MAINTENANCE`, `CLOSED` — adalah hal yang berbeda dan berubah setiap hari. Menumpangkan keduanya pada satu kolom akan membuat penonaktifan terminal dan penutupan register saling tertukar |
| `receipt_setting` | JSONB | Kepala/kaki struk, logo, pesan |

---

## Tabel baru

Tiga belas tabel, seluruhnya pada satu migrasi `V024__pos_web.sql`.

### Konteks dan register

```
pos_register_assignment
  id, terminal_id, user_subject_id, valid_from, valid_until,
  is_active, created_at, created_by, version
```
Tanpa ini, kasir mana pun dapat membuka shift pada register mana pun. Ini satu
dari dua celah yang paling menahan pekerjaan lain.

### Rincian penjualan

```
pos_sale_line_tax
  id, pos_sale_line_id, tax_rate_id, rate_snapshot, is_inclusive,
  taxable_base, tax_amount

pos_sale_line_discount
  id, pos_sale_line_id, source_type, source_id, label,
  discount_type, discount_value, discount_amount,
  approved_by, approval_reason

pos_sale_discount
  id, pos_sale_id, source_type, source_id, label,
  discount_type, discount_value, discount_amount,
  approved_by, approval_reason

pos_sale_status_history
  id, pos_sale_id, from_status, to_status, reason,
  actor_user_id, active_role_id, occurred_at
```

`pos_sale_line` hari ini menyimpan `tax_amount` dan `discount_amount` sebagai
satu angka. Angka itu cukup untuk mencetak struk, tetapi tidak cukup untuk
menjawab "tarif mana yang dipakai" saat pemeriksaan pajak, atau "siapa yang
menyetujui diskon ini" saat angka penjualan dipersoalkan. Keempat tabel ini
menyimpan asal-usulnya.

### Cuplikan

```
pos_sale_snapshot
  id, pos_sale_id, snapshot_type, payload (JSONB), captured_at
```
Satu tabel untuk cuplikan harga, pajak, promosi, dan pelanggan — dibedakan oleh
`snapshot_type`. Empat tabel terpisah dengan bentuk yang sama hanya akan
memperbanyak kode tanpa menambah apa pun.

### Struk

```
pos_sale_receipt
  id, pos_sale_id, receipt_number, issued_at, issued_by,
  print_count, last_printed_at, last_printed_by,
  delivery_channel, delivery_target, payload (JSONB), version
```
`pos_sale.receipt_number` tetap ada sebagai nomor resminya. Tabel ini menyimpan
riwayat penerbitan dan pencetakan ulang — dan cetak ulang yang tidak tercatat
adalah celah yang nyata pada sistem kasir.

### Shift dan kas

```
pos_cash_count
  id, shift_id, count_type, denomination, quantity, subtotal,
  counted_at, counted_by
```
Penghitungan kas berdenominasi. `pos_shift.closing_cash` hanya menyimpan
totalnya; ketika ada selisih, yang menolong adalah rinciannya.

### Retur dan refund

```
pos_return
  id, original_sale_id, return_number, outlet_id, terminal_id, shift_id,
  customer_id, return_type, reason_code, reason, status,
  subtotal, tax_total, grand_total,
  requested_by, approved_by, approved_at,
  idempotency_key, posting_key, version

pos_return_line
  id, pos_return_id, original_sale_line_id, product_id, uom_id,
  quantity, unit_price, tax_amount, line_total,
  disposition, restock_warehouse_id

pos_refund
  id, pos_return_id, payment_method_id, amount, reference,
  status, refunded_at, refunded_by, idempotency_key, version
```

`disposition` menentukan ke mana barang kembali: `RESTOCK` (kembali ke stok
jual), `DAMAGED` (ember rusak), atau `DISPOSED` (tidak kembali sama sekali).
Retur yang selalu mengembalikan barang ke stok jual adalah cara paling cepat
membuat stok tercatat berbeda dari stok sesungguhnya.

### Harga dan promosi

```
pos_price_book_assignment
  id, price_book_id, scope_type, scope_id, priority,
  valid_from, valid_until, is_active, version

pos_promotion
  id, code, name, promotion_type, condition_tree (JSONB),
  benefit_type, benefit_value, max_discount_amount,
  valid_from, valid_until, valid_days, valid_time_from, valid_time_to,
  minimum_purchase, usage_limit, usage_count,
  requires_approval, is_active, is_sample, sample_batch_id, version
```

`condition_tree` memakai bentuk yang sama dengan `DiscountEvaluatorService` yang
sudah ada — pohon kondisi terstruktur, dievaluasi oleh kode, **tanpa `eval`,
tanpa `Function`, tanpa SQL bebas**. Ini bukan pilihan gaya; ekspresi diskon
yang dapat mengeksekusi kode sembarang adalah lubang keamanan pada jalur uang.

---

## Yang sengaja **tidak** ditambahkan sekarang

| Tidak dibuat | Alasan |
|---|---|
| `product_variant` | Diperlukan untuk katalog lengkap, tidak untuk transaksi pertama. Produk tanpa varian tetap dapat dijual. Dikerjakan sesudah gerbang go-live POS terlampaui |
| `pos_register_device`, `pos_printer`, `pos_cash_drawer`, `pos_scanner` | `pos_terminal.printer_config` (JSONB) sudah menampung konfigurasi perangkat. Empat tabel untuk sesuatu yang belum pernah dipakai adalah beban tanpa manfaat |
| `pos_shift_assignment` | `pos_register_assignment` sudah menentukan siapa boleh memakai register mana. Penugasan shift adalah lapisan tambahan yang belum jelas kebutuhannya |
| `pos_payment_allocation` | Alokasi pembayaran ke baris tertentu belum diperlukan; pembayaran di kasir dialokasikan ke transaksi, bukan ke baris |
| Tabel antrean luring | `pos_sale.offline_id` dan `sync_status` sudah cukup untuk fase pertama. Antrean sisi peladen dipertimbangkan saat mode luring dikerjakan |

Setiap baris di tabel ini adalah keputusan yang dapat ditinjau ulang. Yang tidak
boleh terjadi adalah menambahnya diam-diam "karena mungkin nanti perlu" —
tabel kosong yang tidak pernah dipakai tetap harus dimigrasi, dicadangkan, dan
dijelaskan kepada orang berikutnya.
