# POS-0 · Peta Kemampuan Pembayaran

---

## Yang sudah ada

`payment_method` (24 kolom) sudah menyimpan yang diperlukan:

| Kolom | Kegunaan bagi POS |
|---|---|
| `method_type` | `CASH`, `CARD`, `TRANSFER`, `QR`, `EWALLET` |
| `requires_reference` | Kartu dan transfer mewajibkan nomor rujukan; tunai tidak |
| `allows_change` | Hanya tunai yang memberi kembalian |

`pos_payment` sudah mendukung pembayaran majemuk (relasi banyak-ke-satu terhadap
`pos_sale`), menyimpan `tendered_amount` dan `change_amount`, dan sudah punya
`idempotency_key`.

Integrasi eSmartlink ada pada `modules/payment/esmartlink` untuk pembayaran
marketplace, tetapi itu alur checkout daring — bukan alur kasir.

## Yang dikerjakan pada P0

| Kemampuan | Status | Catatan |
|---|---|---|
| Tunai, pas | `MISSING` | — |
| Tunai, berkembalian | `MISSING` | Struktur data siap |
| Kartu debit, konfirmasi manual | `MISSING` | Kasir menggesek di mesin EDC terpisah, lalu mengetik nomor rujukan |
| Kartu kredit, konfirmasi manual | `MISSING` | Sama |
| Transfer bank, konfirmasi manual | `MISSING` | Sama |
| Pembayaran majemuk | `MISSING` | Tunai + kartu pada satu transaksi |
| Penugasan metode per outlet | `MISSING` | Tabel baru `payment_method_outlet_assignment` |

## Yang tertahan penyedia

| Kemampuan | Status | Penghalang |
|---|---|---|
| QRIS di kasir | `BLOCKED` | Perlu kontrak penyedia dan kemampuan QR statis/dinamis. Belum tersedia |
| Kartu terintegrasi (EDC menyatu) | `BLOCKED` | Perlu SDK penyedia dan sertifikasi perangkat |
| E-wallet | `BLOCKED` | Sama dengan QRIS |

Perintah §29 sudah menjawab keadaan ini: *"Jika payment online belum tersedia,
cash/card-manual POS P0 tetap harus diselesaikan."* Itulah yang dikerjakan.

## Yang tidak boleh terjadi

Enam aturan yang menentukan bentuk kodenya, bukan sekadar niat baik:

**Pembayaran ganda ditolak, bukan diterima dua kali.** Tajuk `Idempotency-Key`
wajib pada `POST /pos/sales/:id/payments`. Kasir yang mengklik dua kali karena
layar lambat tidak boleh menghasilkan dua pembayaran. Ini keadaan yang **pasti**
terjadi di lapangan, bukan kemungkinan.

**Penyelesaian ganda ditolak.** `POST /complete` pada penjualan yang sudah
`COMPLETED` mengembalikan hasil yang sama, bukan menambah pergerakan stok kedua.

**Lebih bayar tidak sah pada metode nontunai.** Tunai boleh — kembaliannya
dihitung. Kartu dan transfer tidak: kelebihan pada kartu berarti kesalahan
ketik, dan menerimanya diam-diam menghasilkan selisih yang baru ketahuan saat
rekonsiliasi bank.

**Total dihitung ulang di peladen sebelum pembayaran diterima.** Bila total yang
dikirim peramban berbeda, permintaan ditolak dan kasir diminta memuat ulang.
Harga dapat berubah antara keranjang dibuat dan pembayaran diterima.

**Nomor kartu dan CVV tidak pernah dicatat.** Tidak pada basis data, tidak pada
log, tidak pada audit. Yang disimpan hanya `reference` — biasanya enam digit
terakhir persetujuan EDC yang diketik kasir.

**Kegagalan menggulung balik seluruhnya.** Bila peristiwa akuntansi gagal
dibentuk sesudah stok berkurang, transaksinya dibatalkan seluruhnya. Stok yang
berkurang tanpa jurnal adalah selisih yang tidak dapat dijelaskan siapa pun
kemudian.

## Urutan pada batas penyelesaian

```
1.  validasi penjualan    status DRAFT/PAYMENT_PENDING, ada barisnya
2.  validasi shift        masih terbuka, milik kasir ini
3.  validasi stok         masih tersedia
4.  validasi total        jumlah pembayaran == total penjualan
5.  simpan pembayaran     idempoten
6.  commit persediaan     reservasi -> pergerakan stok
7.  peristiwa akuntansi   POS_SALE, POS_CASH_RECEIPT, POS_TAX_OUTPUT, POS_COGS
8.  terbitkan struk       nomor dari number_sequence, anti-kembar
9.  tandai selesai        COMPLETED
10. terbitkan ke outbox   sync_outbox, untuk pemroses hilir
```

Langkah 1–9 dalam **satu transaksi basis data**. Langkah 10 memakai pola outbox
sehingga penerbitan peristiwa tidak dapat gagal setengah jalan.

Urutannya tidak sembarangan: validasi stok (3) sesudah validasi shift (2) karena
shift yang sudah ditutup membuat pemeriksaan stok tidak ada gunanya; dan
peristiwa akuntansi (7) sesudah commit persediaan (6) karena HPP memerlukan
biaya yang baru diketahui saat stok benar-benar dikeluarkan.
