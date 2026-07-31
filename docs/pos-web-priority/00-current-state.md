# POS-0 · Keadaan Saat Ini

**Tanggal audit:** 31 Juli 2026
**Cabang:** `feature/pos-web-priority`
**Titik tolak:** `main` @ `4f7ab88`

---

## Ringkasan satu paragraf

Fondasi data POS **sudah ada dan cukup matang** — sembilan belas tabel pada
`V006__sales_pos_finance_hr.sql` termasuk `pos_terminal`, `pos_shift`, `pos_sale`,
`pos_sale_line`, `pos_payment`, dan `cash_drawer_movement`, lengkap dengan
`idempotency_key`, `posting_key`, dan `version` untuk penguncian optimistik.
Yang **belum ada sama sekali** adalah lapisan di atasnya: tidak ada satu pun
endpoint `/pos/*`, tidak ada halaman `/app/pos`, dan tidak ada hak akses khusus
POS. Menu `POS` sudah terdaftar dan menunjuk ke `/app/pos`, tetapi rute itu jatuh
ke `ComingSoonPage`.

Kesimpulan bagi perencanaan: **pekerjaan POS Web adalah membangun layanan, API,
dan antarmuka di atas skema yang sudah ada** — bukan merancang ulang basis data
dari nol. Sebagian besar migrasi yang dibutuhkan bersifat tambahan (kolom dan
tabel pelengkap), bukan perombakan.

---

## Yang sudah terpasang

### Basis data — 153 tabel tenant pada 23 migrasi

| Migrasi | Jumlah tabel | Relevansi POS |
|---|---|---|
| `V001__tenant_core` | 8 | `number_sequence`, `idempotency_record` — dipakai untuk nomor struk dan anti-duplikat |
| `V002__organization_access` | 24 | `brand`, `outlet`, `role`, `menu`, `permission_action`, `user_role_assignment` |
| `V003__catalog_crm` | 17 | `product`, `product_barcode`, `uom`, `tax_category`, `tax_rate`, `price_book`, `price_book_item`, `customer`, `payment_method` |
| `V004__inventory` | 14 | `stock_balance`, `stock_reservation`, `stock_movement`, `stock_policy` |
| `V005__purchasing_transfer` | 23 | tidak langsung dipakai POS |
| **`V006__sales_pos_finance_hr`** | **19** | **`pos_terminal`, `pos_shift`, `pos_sale`, `pos_sale_line`, `pos_payment`, `cash_drawer_movement`** |
| `V007__workflow_reporting` | 10 | `workflow_definition`, `notification`, `sync_outbox` |
| `V010__role_governance` | 6 | `role_data_scope`, `segregation_of_duty_rule` |
| `V011__user_scope_assignment` | 1 | `user_scope_assignment` — cakupan data per pengguna |
| `V015__accounting_events` | 2 | `accounting_event`, `accounting_posting_rule` |
| `V016`–`V023` | 19 | observabilitas, surat, notifikasi, basis pengetahuan AI |

### Tabel POS inti — kolom yang sudah ada

```
pos_terminal    id, outlet_id, code, name, platform_device_id, printer_config,
                status, + kolom siklus hidup standar (24 kolom)

pos_shift       id, terminal_id, cashier_id, shift_number, opened_at,
                opening_cash, closed_at, closing_cash, expected_cash,
                variance, status, version (14 kolom)

pos_sale        id, shift_id, outlet_id, terminal_id, customer_id, warehouse_id,
                receipt_number, business_date, sale_at, currency_code,
                subtotal, discount_total, tax_total, grand_total,
                paid_total, change_total, status,
                offline_id, sync_status, posting_key, idempotency_key,
                version (25 kolom)

pos_sale_line   id, pos_sale_id, product_id, uom_id, line_no, quantity,
                unit_price, discount_amount, tax_amount, line_total,
                cost_snapshot, version (13 kolom)

pos_payment     id, pos_sale_id, payment_method_id, amount, tendered_amount,
                change_amount, reference, status, idempotency_key,
                version (11 kolom)

cash_drawer_movement
                id, shift_id, movement_type, amount, reason,
                source_type, source_id, occurred_at, created_by (9 kolom)
```

Yang patut dicatat: `pos_sale` sudah memiliki `offline_id` dan `sync_status`,
artinya perancang skema sudah mengantisipasi mode luring sejak awal. Begitu pula
`idempotency_key` pada `pos_sale`, `pos_payment`, dan `stock_movement` —
persyaratan idempotensi pada perintah POS-6 dapat dipenuhi tanpa migrasi baru.

### Menu dan hak akses

- **133 menu** pada katalog tenant, termasuk `POS` (root, rute `/app/pos`),
  `POS_SHIFT` (`/app/pos/shifts`), dan `POS_TERMINAL` (`/app/pos/terminals`).
- **40 aksi hak akses**, termasuk yang relevan bagi POS: `CREATE`, `READ`,
  `UPDATE`, `DELETE`, `CANCEL`, `APPROVE`, `REJECT`, `POST`, `PRINT`,
  `RECONCILE`, `RESERVE`, `RELEASE`, `RETURN`, `RETURN_APPROVE`,
  `REFUND_APPROVE`, `REVERSE`, `VIEW_AMOUNT`, `VIEW_COST`, `VIEW_PROFIT`.
- Cakupan data per pengguna (`user_scope_assignment`) dan aturan pemisahan
  wewenang (`segregation_of_duty_rule`) sudah berjalan dan ditegakkan pada
  kueri, bukan sekadar disimpan.

### Layanan yang dapat dipakai ulang

| Layanan | Berkas | Dapat dipakai POS? |
|---|---|---|
| `StockReservationService` | `modules/order/stock-reservation.service.ts` | **Ya.** `hold()` / `commit()` / `release()` / `releaseExpired()` sudah sesuai alur POS-3 |
| Mesin transisi status pesanan | `modules/order/order-state.ts` | Sebagian — polanya dapat ditiru, statusnya berbeda |
| Aturan retur dan refund | `modules/return/return-rules.ts` | Sebagian — `computeRefundAmount`, `canCompleteRefund` dapat dipakai; jendela retur 7 hari adalah aturan marketplace, bukan POS |
| Mesin posting akuntansi | `modules/accounting/posting-engine.ts` | **Ya, polanya.** Namun kode peristiwanya khusus marketplace (12 kode `MARKETPLACE_*`); dua belas kode `POS_*` perlu ditambahkan |
| `AuditService`, konteks permintaan | `common/context/request-context.ts` | **Ya, langsung** |
| Hub notifikasi | `modules/notification/` | **Ya, langsung** |
| Gerbang AI | `modules/ai/` | **Ya** — untuk POS-12, non-pemblokir |

---

## Yang belum ada

### Tidak ada satu pun endpoint POS

Dua puluh delapan controller terdaftar. **Tidak ada** yang menangani `/pos/*`.
Daftar lengkap: `activity`, `ai`, `me`, `notifications`, `platform` (dan
turunannya), `public` (dan turunannya), `seller` (dan turunannya), `storefront`,
`surat/*`, `table-audit`.

### Tidak ada antarmuka POS

`apps/web/src/app/App.tsx` tidak memiliki rute `/app/pos`. Menu POS yang
diklik pengguna hari ini membawanya ke `ComingSoonPage`.

### Kekeliruan yang perlu dihindari: `PricingEngineService` **bukan** untuk POS

`modules/pricing/pricing-engine.service.ts` terdengar seperti yang dibutuhkan
POS-2, tetapi bukan. `QuoteRequest`-nya bermedan `planCode`, `paymentMode`,
`deviceIds`, `billingInterval` — ini mesin harga **langganan SaaS**, untuk
menagih penyewa, bukan untuk menghitung harga produk di kasir.

Menyimpulkan "modul harga sudah ada" dari nama berkasnya akan membuat POS-2
diperkirakan jauh lebih ringan daripada kenyataannya. **Mesin kuotasi harga POS
harus dibangun baru**, meskipun `DiscountEvaluatorService` (evaluator kondisi
diskon berbasis pohon, tanpa `eval`) dapat dipakai ulang untuk bagian
diskonnya.

---

## Berkas rujukan audit

- [01 — Peta dependensi kritis](01-pos-critical-dependency-map.md)
- [02 — Peta pemakaian ulang modul](02-existing-module-reuse-map.md)
- [03 — Matriks celah](03-pos-gap-matrix.md)
- [04 — Matriks peran dan hak akses](04-role-permission-matrix.md)
- [05 — Peta model data](05-data-model-map.md)
- [06 — Peta rute API](06-api-route-map.md)
- [07 — Peta rute UI](07-ui-route-map.md)
- [08 — Peta kemampuan pembayaran](08-payment-capability-map.md)
- [09 — Peta posting stok](09-stock-posting-map.md)
- [10 — Peta posting akuntansi](10-accounting-posting-map.md)
- [11 — Garis dasar pengujian](11-test-baseline.md)
- [12 — Rencana peluncuran](12-rollout-plan.md)
