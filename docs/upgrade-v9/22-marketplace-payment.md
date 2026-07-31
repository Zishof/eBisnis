# 22 — Pembayaran Marketplace (V9-7)

Menutup D16–D17 pada [matriks gap](02-v8-to-v9-gap-matrix.md).

## Satu tabel perintah bayar, bukan dua

Audit V9-0 mencatat `PaymentOrder` terikat ke `BillingInvoice` — tagihan
langganan platform, bukan pesanan marketplace.

Dua pilihan tersedia:

| Pilihan | Akibatnya |
| --- | --- |
| Tabel perintah bayar kedua | dua tempat menjawab "sudah dibayar atau belum", dan pada akhirnya berbeda jawaban |
| **Melonggarkan `invoiceId` dan menambah `marketplaceOrderId`** | dipilih |

`invoice_id` dilonggarkan menjadi opsional. Yang menjaga agar tidak ada baris
tanpa sumber sama sekali adalah CHECK pada basis data:

```sql
CONSTRAINT ck_payment_order_source CHECK (
  (invoice_id IS NOT NULL AND marketplace_order_id IS NULL)
  OR (invoice_id IS NULL AND marketplace_order_id IS NOT NULL)
)
```

Ditulis sebagai CHECK, bukan pemeriksaan aplikasi, karena jalur penulisan dapat
bertambah dan yang baru bisa lupa memeriksanya.

### Kompiler menunjukkan tempat yang perlu diperbaiki

Melonggarkan kolom membuat TypeScript menandai **lima** tempat yang mengandaikan
tagihan selalu ada. Itu justru gunanya: alokasi pembayaran, pemutakhiran
invoice, dan pengaktifan entitlement memang hanya berlaku bagi langganan, dan
kini melewati perintah bayar marketplace dengan sengaja.

## Kredensial per penjual

Setiap penjual menerima ke rekeningnya sendiri. Kredensial diambil dari
`TenantPaymentProviderAccount` milik tenant penjual — bukan kredensial platform,
karena uangnya bukan milik platform.

## Callback tidak dipercaya

Yang menentukan sebuah pesanan lunas bukan isi callback, melainkan pemeriksaan
ulang di sisi kita. Callback hanya memberitahukan bahwa ada sesuatu yang perlu
diperiksa.

| Pemeriksaan | Bila gagal |
| --- | --- |
| Perintah bayar dikenal | ditolak sopan, dicatat; tidak melempar galat |
| Transaksi belum pernah diproses | dijawab "sudah diproses", tidak dihitung ulang |
| Jumlah sama persis | ditolak, `AMOUNT_MISMATCH` dicatat |
| Status termasuk yang berarti lunas | selain itu dianggap gagal |

### Jumlah harus sama persis

Kekurangan sekecil apa pun ditolak: menerimanya berarti barang dikirim tanpa
dibayar penuh. Kelebihan juga ditolak: menerimanya berarti utang kepada pembeli
yang tidak tercatat.

Pembulatan ke rupiah utuh dilakukan sebelum membandingkan, karena penyedia
dapat mengirim `258000.00`.

### Status yang tidak dikenal ditolak

`BERHASIL`, `SUCCESSFUL`, dan `PAID_PARTIAL` semuanya **ditolak**. Status baru
dari penyedia tidak boleh diterima sebagai lunas hanya karena bunyinya mirip;
yang tidak dikenal ditolak sampai dipetakan dengan sengaja.

### Galat tidak dilempar ke penyedia

Callback untuk pesanan yang tidak dikenal dijawab dengan sopan, bukan dengan
galat. Penyedia yang menerima galat akan mengirim ulang tanpa henti.

## Pembayaran berhasil menggerakkan pesanan

Perpindahan `AWAITING_PAYMENT → PAID` dijalankan lewat `OrderService`, yang
kemudian mengomit penahanan stok. Rangkaian itu tidak diulang di sini agar
tidak ada dua tempat yang memotong stok.

Hanya `SYSTEM` yang boleh menyatakan pembayaran masuk — aturan itu ditegakkan
tabel perpindahan V9-8, bukan oleh layanan ini.

## Bukti

```text
41 test pembayaran lulus
514 test keseluruhan (naik dari 495)
ck_payment_order_source terpasang pada basis data
```

## Keterbatasan yang diketahui

**Alamat bayar belum diisi.** `paymentUrl` sengaja dibiarkan kosong sampai
adapter marketplace tersambung ke `EsmartlinkClient`. Alamat yang dikarang akan
membawa pembeli ke halaman yang tidak ada.

**Endpoint callback publik belum dipasang.** `processCallback` berjalan dan
diuji, tetapi jalur HTTP-nya menuntut verifikasi tanda tangan penyedia yang
kontraknya belum tersedia. Menerima callback tanpa verifikasi berarti siapa pun
dapat menyatakan pesanannya lunas.

**Penjadwal kedaluwarsa belum berjalan sendiri.** `expireStale` tersedia tetapi
belum dipanggil otomatis.

**Pengembalian dana belum ada.** Dibangun pada V9-10.
