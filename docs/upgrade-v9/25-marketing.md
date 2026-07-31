# 25 — Promosi, Ulasan, dan Percakapan (V9-11)

Menutup D24–D26 pada [matriks gap](02-v8-to-v9-gap-matrix.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel platform baru | 5 |
| Test baru | 59 |

## Mengapa voucher bukan `DiscountProgram`

`DiscountProgram` yang sudah ada melayani diskon langganan.

| | `DiscountProgram` | `MarketplaceVoucher` |
| --- | --- | --- |
| Pendana | platform | penjual atau platform |
| Penukar | tenant | pembeli |
| Batas | `maxPerTenant` | `maxPerBuyer` |
| Anggaran | tidak ada | dipotong dari kantong penjual |

Ketiganya berbeda. Memaksakan satu tabel berarti `maxPerTenant` yang tidak
berarti apa-apa bagi voucher, dan kolom anggaran penjual yang tidak berarti
apa-apa bagi langganan — dan setiap pembaca harus tahu mana yang berlaku kapan.

**Yang dipakai ulang adalah konsepnya**: ambang, batas penukaran, masa berlaku,
kebijakan penumpukan. Bukan tabelnya.

## Kode salah dan kode kedaluwarsa dijawab sama

```text
kode tidak ada        ->  "Kode voucher tidak berlaku."
kode sudah habis      ->  "Kode voucher tidak berlaku."
```

Membedakan jawabannya memungkinkan seseorang menebak kode yang berlaku dengan
mencoba satu per satu dan memperhatikan bedanya.

## Batas potongan persen

Diskon 50% tanpa batas pada pesanan sepuluh juta memotong lima juta dari kantong
penjual. `maxDiscountAmount` menahan itu.

Potongan juga tidak pernah melebihi subtotal — pembeli tidak menerima uang dari
voucher.

## Sisa anggaran yang tidak cukup: ditolak, bukan dipotong sebagian

Memotong sebagian akan memberi pembeli diskon yang tidak dijanjikan. Menolaknya
lebih jujur.

## Voucher penjual hanya untuk penjual itu

Tanpa pemeriksaan `SELLER_MISMATCH`, voucher yang didanai satu penjual memotong
pendapatan penjual lain.

## Ulasan hanya dari pembelian yang sungguh terjadi

Tanpa syarat itu, penjual dapat membeli ulasan bagus dan pesaing dapat
menjatuhkan tanpa pernah membeli.

Syaratnya bukan "pernah memesan", melainkan **"pesanannya sudah sampai"** —
barang yang belum diterima belum dapat dinilai.

Kepemilikan pesanan diperiksa lebih dulu: tanpa itu, id pesanan yang ditebak
memungkinkan siapa pun menulis ulasan atas pembelian orang lain.

### Ulasan tanpa isi diterima

Nilai bintang saja sudah bermakna. Yang ditolak adalah isi yang **terlalu
pendek untuk dipahami tetapi bukan kosong** — "ok" tidak memberi tahu apa pun.

### Hanya ulasan terbit yang dihitung

Ulasan yang menunggu moderasi belum boleh memengaruhi angka yang dilihat
pembeli.

Rata-rata dibulatkan satu angka di belakang koma; ketelitian lebih dari itu
menyiratkan kepastian yang tidak dimiliki rata-rata dari sedikit ulasan.

## Percakapan per pasangan, bukan per pesanan

Pembeli yang bertanya sebelum membeli belum punya pesanan. Memaksanya membuat
pesanan lebih dulu menghalangi pertanyaan yang justru mendahului pembelian.

Pesan bersifat **append-only** — pesan yang dapat disunting setelah terkirim
membuat percakapan tidak dapat dipakai sebagai bukti saat terjadi sengketa.

### Pesan mencurigakan ditandai, bukan diblokir

Nomor rekening juga muncul saat penjual menjawab pertanyaan pengembalian dana
yang memang harus manual. Memblokir otomatis akan menghalangi percakapan yang
sah; yang ditandai ditinjau manusia.

Alasan penandaan ikut disimpan agar peninjau tahu apa yang dicurigai.

## Keterbatasan yang diketahui

**Endpoint belum dipasang.** Aturan dan tabelnya lengkap dan diuji; jalur HTTP
menyusul bersama UI. Sama seperti V9-10 — membangun endpoint tanpa UI
menghasilkan jalur yang tidak pernah dipanggil.

**Voucher belum tersambung ke checkout.** `discountTotal` pada checkout masih
selalu nol. Penyambungannya menuntut perubahan pada `CheckoutService` yang
lebih baik dikerjakan bersama UI keranjang.

**Flash sale, bundel, dan program afiliasi belum ada.** Voucher adalah bentuk
promosi paling mendasar dan paling sering dipakai; sisanya menyusul.

**Penyaring pesan memakai pola sederhana.** Empat pola regex, bukan model
klasifikasi. Cukup untuk menandai kasus yang jelas, tidak cukup untuk yang
sengaja disamarkan.
