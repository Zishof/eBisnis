# POS-0 · Peta Posting Akuntansi

---

## Yang sudah ada

| Komponen | Status |
|---|---|
| `accounting_event` (23 kolom, dengan `idempotency_key`) | `DONE` |
| `accounting_posting_rule` | `DONE` |
| `journal_entry`, `journal_entry_line` | `DONE` |
| `chart_of_account`, `account_type`, `fiscal_period` | `DONE` |
| Mesin posting `modules/accounting/posting-engine.ts` | `DONE` |
| Kode peristiwa | **hanya 12 kode `MARKETPLACE_*`** |

Mesinnya sudah matang dan memiliki satu sifat yang sangat berguna:
`posting-engine.spec.ts` **memaksa setiap kode peristiwa punya aturan posting
dan daftar `REQUIRED_AMOUNTS`**. Kode peristiwa yang ditambahkan tanpa aturannya
akan menggagalkan pengujian, bukan diam-diam menghasilkan jurnal kosong.

Kedua belas kode `POS_*` di bawah akan tunduk pada pengujian yang sama.

## Dua belas kode peristiwa POS

| Kode | Kapan terbentuk | Nilai wajib |
|---|---|---|
| `POS_SALE` | Penjualan diselesaikan | `gross`, `net`, `discount`, `tax` |
| `POS_CASH_RECEIPT` | Pembayaran tunai diterima | `amount`, `change` |
| `POS_NONCASH_RECEIPT` | Kartu / transfer / QR diterima | `amount`, `methodType` |
| `POS_TAX_OUTPUT` | Bersamaan dengan `POS_SALE` bila ada pajak | `taxBase`, `taxAmount` |
| `POS_COGS` | Bersamaan dengan commit persediaan | `cost` |
| `POS_INVENTORY_RELEASE` | Stok keluar | `quantity`, `cost` |
| `POS_DISCOUNT` | Ada diskon pada transaksi | `amount`, `sourceType` |
| `POS_RETURN` | Retur diterima | `gross`, `tax`, `cost` |
| `POS_REFUND` | Refund dibayarkan | `amount`, `methodType` |
| `POS_CASH_VARIANCE` | Shift ditutup dengan selisih | `expected`, `counted`, `variance` |
| `POS_CASH_IN` | Kas masuk di luar penjualan | `amount`, `reason` |
| `POS_CASH_OUT` | Kas keluar di luar refund | `amount`, `reason` |

## Prinsip yang dipegang

**Tidak ada jurnal tanpa asal-usul.** Setiap `accounting_event` menyimpan
`source_type`, `source_id`, dan `source_number` — sehingga setiap baris jurnal
dapat ditelusuri balik ke struk yang menyebabkannya. Ini yang membedakan
pembukuan yang dapat diaudit dari pembukuan yang hanya seimbang.

**Kode akun tidak dikunci di dalam program.** `accounting_posting_rule`
memetakan kode peristiwa ke akun, dan pemetaannya milik tenant. Outlet, brand,
atau badan hukum yang berbeda dapat memakai akun yang berbeda untuk peristiwa
yang sama.

**Peristiwa bersifat idempoten.** `accounting_event.idempotency_key` mencegah
penyelesaian yang terulang membentuk jurnal kedua.

**Peristiwa dibentuk di dalam transaksi penyelesaian, tetapi postingnya boleh
menyusul.** `accounting_event.status` membedakan yang sudah diposting dari yang
menunggu. Kasir tidak boleh menunggu buku besar; tetapi peristiwanya harus
sudah tercatat sebelum transaksi dinyatakan selesai — bila tidak, penjualan yang
peristiwanya gagal dibentuk akan hilang dari pembukuan tanpa jejak.

**Pembalikan adalah peristiwa baru, bukan penghapusan.** Retur membentuk
`POS_RETURN` dan `POS_REFUND`; jurnal aslinya tidak disentuh. Buku besar yang
barisnya dapat dihapus bukan buku besar.

**Periode yang sudah ditutup menolak peristiwa baru.** `fiscal_period` sudah
ada; jalur POS harus memeriksanya. Penjualan bertanggal usaha pada periode
tertutup ditolak dengan pesan yang jelas, bukan diposting ke periode berjalan
secara diam-diam.

## Contoh: satu penjualan tunai

Penjualan Rp 53.900 (barang Rp 51.000, diskon Rp 2.000, pajak Rp 4.900),
harga pokok Rp 30.000, dibayar tunai Rp 60.000, kembalian Rp 6.100.

| Peristiwa | Nilai |
|---|---|
| `POS_SALE` | gross 53.900 · net 49.000 · discount 2.000 · tax 4.900 |
| `POS_DISCOUNT` | amount 2.000 |
| `POS_TAX_OUTPUT` | taxBase 49.000 · taxAmount 4.900 |
| `POS_CASH_RECEIPT` | amount 53.900 · change 6.100 |
| `POS_COGS` | cost 30.000 |
| `POS_INVENTORY_RELEASE` | quantity 3 · cost 30.000 |

Jurnal yang terbentuk dari aturan posting bawaan:

```
Kas                          53.900
    Penjualan                            49.000
    PPN Keluaran                          4.900

Harga Pokok Penjualan        30.000
    Persediaan                           30.000
```

Diskon Rp 2.000 sudah tercermin pada `net`; tenant yang ingin menyajikannya
sebagai akun kontra-pendapatan tersendiri cukup mengubah aturan postingnya —
tanpa mengubah kode.

## Pengujian wajib

| Keadaan | Yang diharapkan |
|---|---|
| Setiap kode `POS_*` punya aturan posting | Uji kelengkapan, mengikuti pola yang sudah ada |
| Setiap kode punya `REQUIRED_AMOUNTS` | Sama |
| Jurnal seimbang | Total debit == total kredit untuk setiap peristiwa |
| Peristiwa terulang | Jurnal tetap satu |
| Periode tertutup | Ditolak dengan pesan yang jelas |
| Retur membentuk pembalikan | Jurnal asli tidak disentuh |
| Selisih kas | `POS_CASH_VARIANCE` terbentuk saat shift ditutup dengan selisih |
| Akun tidak dipetakan | Peristiwa berstatus gagal dengan alasan yang dapat dibaca, bukan jurnal kosong |
