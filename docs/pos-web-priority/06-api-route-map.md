# POS-0 · Peta Rute API

**Keadaan hari ini: tidak ada satu pun rute `/pos/*`.** Dua puluh delapan
controller terdaftar, tidak satu pun menyentuh POS.

Seluruh rute di bawah berawalan `/api/v1`.

---

## POS-1 · Konteks

| Metode | Rute | Hak akses | Keluaran |
|---|---|---|---|
| `GET` | `/pos/context` | `POS_SALE.READ` | Brand, outlet, dan register yang boleh dipakai pengguna ini, beserta shift yang sedang terbuka |
| `GET` | `/pos/registers` | `POS_TERMINAL.READ` | Register pada outlet terpilih, dengan status operasionalnya |
| `POST` | `/pos/registers/:id/claim` | `POS_SHIFT.OPEN_SHIFT` | Menandai register dipakai pengguna ini |

`GET /pos/context` adalah endpoint pertama yang dipanggil layar kasir. Ia
menjawab satu pertanyaan: *apa yang boleh saya lakukan, di mana?* — dan
jawabannya berasal dari cakupan data dan penugasan register, bukan dari
parameter yang dikirim peramban.

## POS-2 · Katalog, harga, pajak

| Metode | Rute | Hak akses | Catatan |
|---|---|---|---|
| `GET` | `/pos/catalog/search` | `POS_SALE.READ` | Cari menurut nama, SKU, alias, kategori, favorit, terakhir terjual |
| `GET` | `/pos/products/by-barcode/:barcode` | `POS_SALE.READ` | Barcode utama maupun alternatif |
| `POST` | `/pos/price/quote` | `POS_SALE.READ` | **Otoritatif.** Masukan: outlet, pelanggan, produk, jumlah, waktu, mata uang, kanal=POS |
| `GET` | `/pos/promotions/eligible` | `POS_SALE.READ` | Promosi yang berlaku bagi keranjang saat ini |

Keluaran `POST /pos/price/quote`: harga dasar, diskon, pajak, neto, bruto,
promosi yang diterapkan, dan peringatan. **Harga, pajak, diskon, dan total
final selalu berasal dari peladen.** Peramban boleh menampilkannya; peramban
tidak boleh menentukannya.

## POS-3 · Persediaan

| Metode | Rute | Hak akses |
|---|---|---|
| `POST` | `/pos/stock/check` | `POS_SALE.READ` |
| `POST` | `/pos/stock/reserve` | `POS_SALE.SELL` |
| `POST` | `/pos/stock/release` | `POS_SALE.SELL` |

Ketiganya membungkus `StockReservationService` yang sudah ada. Tidak ada
pengurangan stok dari peramban, dalam keadaan apa pun.

## POS-4 · Shift dan kas

| Metode | Rute | Hak akses |
|---|---|---|
| `POST` | `/pos/shifts/open` | `POS_SHIFT.OPEN_SHIFT` |
| `GET` | `/pos/shifts/current` | `POS_SHIFT.READ` |
| `POST` | `/pos/shifts/:id/cash-in` | `POS_CASH.CASH_MOVE` |
| `POST` | `/pos/shifts/:id/cash-out` | `POS_CASH.CASH_MOVE` |
| `POST` | `/pos/shifts/:id/count` | `POS_SHIFT.CLOSE_SHIFT` |
| `POST` | `/pos/shifts/:id/close` | `POS_SHIFT.CLOSE_SHIFT` |
| `POST` | `/pos/shifts/:id/approve` | `POS_SHIFT.APPROVE` |

`cash-in` dan `cash-out` mewajibkan alasan. Kas yang berpindah tanpa alasan
tidak dapat direkonsiliasi kemudian.

## POS-5 · Keranjang dan penjualan

| Metode | Rute | Hak akses |
|---|---|---|
| `POST` | `/pos/sales` | `POS_SALE.SELL` |
| `GET` | `/pos/sales/:id` | `POS_SALE.READ` |
| `PATCH` | `/pos/sales/:id` | `POS_SALE.SELL` |
| `POST` | `/pos/sales/:id/items` | `POS_SALE.SELL` |
| `PATCH` | `/pos/sales/:id/items/:lineId` | `POS_SALE.SELL` |
| `DELETE` | `/pos/sales/:id/items/:lineId` | `POS_SALE.UPDATE` |
| `POST` | `/pos/sales/:id/hold` | `POS_SALE.HOLD` |
| `POST` | `/pos/sales/:id/resume` | `POS_SALE.RESUME` |
| `POST` | `/pos/sales/:id/recalculate` | `POS_SALE.SELL` |
| `POST` | `/pos/sales/:id/discount` | `POS_SALE.DISCOUNT_CART` |
| `POST` | `/pos/sales/:id/items/:lineId/discount` | `POS_SALE.DISCOUNT_LINE` |

Seluruhnya mewajibkan tajuk `Idempotency-Key` dan menghormati kolom `version`
untuk penguncian optimistik. Dua kasir yang menyunting keranjang yang sama akan
memperoleh penolakan yang jelas, bukan hasil yang saling menimpa diam-diam.

## POS-6 · Pembayaran

| Metode | Rute | Hak akses |
|---|---|---|
| `POST` | `/pos/sales/:id/payments` | `POS_SALE.SELL` |
| `POST` | `/pos/sales/:id/complete` | `POS_SALE.SELL` |
| `POST` | `/pos/sales/:id/payments/:paymentId/reverse` | `POS_SALE.APPROVE` |

Batas penyelesaian pada `complete` berjalan dalam satu transaksi basis data:
validasi penjualan → validasi shift → validasi stok → validasi total pembayaran
→ simpan pembayaran → commit persediaan → bentuk peristiwa akuntansi → terbitkan
struk → tandai selesai → terbitkan ke outbox. Bila salah satu gagal, seluruhnya
digulung balik.

## POS-7 · Struk

| Metode | Rute | Hak akses |
|---|---|---|
| `GET` | `/pos/sales/:id/receipt` | `POS_SALE.READ` |
| `POST` | `/pos/sales/:id/receipt/print` | `POS_SALE.PRINT` |
| `POST` | `/pos/sales/:id/receipt/email` | `POS_SALE.PRINT` |
| `POST` | `/pos/sales/:id/receipt/reprint` | `POS_SALE.PRINT` |

Cetak ulang menaikkan `print_count` dan tercatat pada audit dengan penanda
tersendiri.

## POS-8 · Void, retur, refund

| Metode | Rute | Hak akses |
|---|---|---|
| `POST` | `/pos/sales/:id/void-request` | `POS_SALE.CANCEL` |
| `POST` | `/pos/sales/:id/void-approve` | `POS_SALE.APPROVE` |
| `POST` | `/pos/sales/:id/returns` | `POS_RETURN.RETURN` |
| `POST` | `/pos/returns/:id/approve` | `POS_RETURN.RETURN_APPROVE` |
| `POST` | `/pos/returns/:id/refund` | `POS_RETURN.REFUND_APPROVE` |

Penyetuju tidak boleh sama dengan pemohon. Ditegakkan dua kali: pada hak akses,
dan pada aturan pemisahan wewenang.

## POS-9 · Dasbor dan laporan

| Metode | Rute | Hak akses |
|---|---|---|
| `GET` | `/pos/dashboard/cashier` | `POS_SALE.READ` |
| `GET` | `/pos/dashboard/supervisor` | `POS_REPORT.READ` |
| `GET` | `/pos/dashboard/store` | `POS_REPORT.READ` |
| `GET` | `/pos/reports/:reportCode` | `POS_REPORT.READ` |

Empat belas kode laporan pada satu endpoint berparameter, bukan empat belas
endpoint — bentuk keluarannya sama, yang berbeda hanya kueri dan kolomnya.

---

## Aturan yang berlaku bagi seluruh rute POS

1. **Skema tenant tidak pernah berasal dari permintaan.** Diambil dari token dan
   dicocokkan ke `platform.tenant_schema_registry`, seperti seluruh rute tenant
   lainnya.
2. **Konteks transaksi wajib lengkap.** Tanpa tenant, outlet, register, dan
   shift yang sah, permintaan ditolak — bukan diberi nilai bawaan.
3. **Idempotensi wajib pada seluruh metode yang mengubah keadaan.**
4. **Total tidak pernah dipercaya dari peramban.** Peladen menghitung ulang dan
   menolak bila berbeda.
5. **Setiap penolakan menyebutkan alasannya** dalam bentuk yang dapat dibaca
   kasir, bukan hanya kode HTTP.
6. **Tidak ada data kartu yang dicatat.** Tidak nomor lengkap, tidak CVV. Yang
   disimpan hanya `reference` yang diketik kasir.
