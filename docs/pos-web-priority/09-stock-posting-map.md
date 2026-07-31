# POS-0 · Peta Posting Stok

---

## Yang sudah ada — dan sudah cukup

| Komponen | Status | Catatan |
|---|---|---|
| `stock_balance` | `DONE` | Enam ember: `on_hand`, `reserved`, `available`, `in_transit`, `quarantine`, `damaged` |
| `stock_reservation` | `DONE` | Dengan `source_type`, `source_id`, `expires_at`, `status` |
| `stock_movement` | `DONE` | Dengan `posting_key`, `idempotency_key`, `bucket_from`, `bucket_to`, `reference_type`, `reference_id` |
| `StockReservationService` | `DONE` | `hold()`, `commit()`, `release()`, `releaseExpired()` |
| `stock_policy`, `product.allow_negative_stock` | `PARTIAL` | Ada; penegakannya di jalur POS belum |
| `inventory_lot`, `product.tracking_type` | `PARTIAL` | Ada; pemilihan lot di kasir belum |

Kolom `bucket_from` dan `bucket_to` pada `stock_movement` adalah yang membuat
seluruh alur POS dapat direkam tanpa tabel baru: perpindahan dari ember
`available` ke `reserved`, lalu dari `reserved` keluar, tercatat sebagai
pergerakan yang berbeda dan dapat ditelusuri.

## Alur stok pada satu transaksi kasir

```
Baris ditambahkan ke keranjang
   -> cek ketersediaan (tanpa mengubah apa pun)
   -> hold: available -> reserved

Jumlah baris diubah
   -> sesuaikan reservasi (naik atau turun)

Baris dihapus / keranjang dibatalkan / kedaluwarsa
   -> release: reserved -> available

Pembayaran berhasil
   -> commit: reserved -> keluar
   -> stock_movement bertipe POS_SALE
   -> peristiwa POS_COGS dan POS_INVENTORY_RELEASE

Retur diterima dan disetujui
   -> disposition RESTOCK  : masuk -> available
   -> disposition DAMAGED  : masuk -> damaged
   -> disposition DISPOSED : tidak ada pergerakan masuk
   -> stock_movement bertipe POS_RETURN
```

## Aturan

**Stok tidak pernah berkurang dari peramban.** Perintah §4 menyebutkannya, dan
seluruh endpoint stok POS hanya membungkus layanan yang sudah ada.

**Reservasi kedaluwarsa dilepaskan otomatis.** Keranjang yang ditinggalkan
kasir karena pembeli batal tidak boleh menahan stok selamanya.
`releaseExpired()` sudah ada dan tinggal dijadwalkan untuk sumber POS.

**Commit bersifat idempoten.** `stock_movement.idempotency_key` memastikan
penyelesaian yang terulang tidak mengurangi stok dua kali. Ini pasangan dari
aturan penyelesaian-ganda pada pembayaran; keduanya harus benar, karena
melindungi hal yang berbeda.

**Penjualan bersamaan atas SKU yang sama diselesaikan dengan penguncian baris.**
Dua kasir yang menjual barang terakhir yang sama: satu berhasil, satu memperoleh
penolakan yang menyebutkan jumlah yang masih tersedia. Bukan keduanya berhasil
lalu stok menjadi minus.

**Stok negatif adalah keputusan tenant, bukan bawaan.**
`POS_ALLOW_NEGATIVE_STOCK` pada `app_setting`, dengan bawaan `false`. Beberapa
jenis usaha memerlukannya — warung yang stoknya belum pernah diopname akan
berhenti total tanpa itu.

**Retur tidak selalu mengembalikan barang ke stok jual.** `disposition` pada
`pos_return_line` menentukan ke mana barang kembali. Mengembalikan barang rusak
ke stok jual adalah cara tercepat membuat catatan stok berbeda dari kenyataan.

## Pengujian wajib

| Keadaan | Yang diharapkan |
|---|---|
| Stok cukup | Reservasi berhasil |
| Stok kurang | Ditolak, menyebutkan jumlah tersedia |
| Stok negatif diizinkan | Berhasil, tercatat sebagai negatif |
| Stok negatif ditolak | Ditolak dengan pesan yang jelas |
| Dua kasir, SKU sama, bersamaan | Satu berhasil, satu ditolak; stok tidak minus |
| Commit terulang | Pergerakan stok tetap satu |
| Reservasi kedaluwarsa | Dilepaskan, stok kembali tersedia |
| Retur RESTOCK | `available` bertambah |
| Retur DAMAGED | `damaged` bertambah, `available` tidak |
| Pembatalan sesudah reservasi | Reservasi dilepas seluruhnya |
