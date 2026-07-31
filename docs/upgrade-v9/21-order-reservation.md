# 21 — Pesanan dan Penahanan Stok (V9-8)

Menutup D13–D15 pada [matriks gap](02-v8-to-v9-gap-matrix.md).

Dikerjakan **sebelum** V9-7 (pembayaran), berbeda dari urutan rencana.
Alasannya: perintah bayar menunjuk pesanan, sehingga pesanan harus ada lebih
dahulu. Mengerjakan pembayaran lebih dulu akan memaksa membuat penunjuk
sementara yang kemudian dibongkar.

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel platform baru | 5 |
| Endpoint baru | 7 |
| Test baru | 25 |

## Menahan, bukan memotong

| Pilihan | Akibatnya |
| --- | --- |
| Memotong saat pesan | barang hilang dari persediaan karena pembeli yang tidak jadi bayar |
| Menunggu sampai lunas | dua pembeli membeli barang terakhir yang sama |
| **Menahan lalu memotong saat lunas** | dipilih |

Penahanan terjadi **bersamaan** dengan pembuatan pesanan, bukan sesudahnya.
Jeda di antaranya adalah jendela tempat dua pembeli mendapat barang terakhir
yang sama.

## Idempoten karena peristiwa datang berulang

Penyedia mengirim ulang callback yang tidak dijawab, dan penjadwal mencoba lagi
pekerjaan yang gagal. Setiap operasi dikunci `idempotencyKey`, dan memanggilnya
dua kali menghasilkan keadaan yang sama dengan memanggilnya sekali.

Pembuatan pesanan idempoten lewat `checkoutId` yang unik pada grup: memanggilnya
dua kali mengembalikan grup yang sama, bukan membuat pesanan kedua.

## Stok dibaca dengan kunci baris

`SELECT ... FOR UPDATE` pada baris varian. Tanpanya, dua pesanan yang datang
bersamaan sama-sama membaca stok 1, sama-sama menyimpulkan cukup, dan keduanya
berhasil.

## Stok yang tidak terbaca bukan stok nol

`availableQuantity` mengembalikan `null`, bukan `0`, ketika stok gagal dibaca.
Nol berarti "habis" dan akan menolak pesanan; `null` berarti "tidak diketahui"
dan dibiarkan lewat.

Menolak berdasarkan kegagalan membaca akan menghentikan seluruh penjualan
setiap kali koneksi ke satu tenant terganggu.

## Tabel perpindahan status, bukan rangkaian `if`

Ditulis di satu berkas sebagai tabel. Bentuk ini membuat satu hal dapat
dipastikan dengan membacanya: **tidak ada jalan dari `CANCELLED` kembali ke
`PAID`.** Dengan rangkaian `if` tersebar di beberapa layanan, hal itu hanya
dapat dipastikan dengan membaca seluruhnya.

### Siapa boleh melakukan apa

| Perpindahan | Yang berhak | Mengapa |
| --- | --- | --- |
| `AWAITING_PAYMENT → PAID` | hanya `SYSTEM` | pembayaran masuk lewat callback penyedia, bukan lewat pernyataan siapa pun |
| `READY_TO_SHIP → SHIPPED` | penjual | pembeli tidak dapat menyatakan pesanannya sudah dikirim |
| `AWAITING_PAYMENT → CANCELLED` | pembeli, penjual, platform | belum ada uang yang berpindah |
| `PAID → CANCELLED` | penjual, platform — **bukan pembeli** | menuntut pengembalian dana |
| `DISPUTED → REFUNDED` | hanya platform | pihak ketiga yang memutuskan |

Tiga status akhir: `CANCELLED`, `EXPIRED`, `REFUNDED`. Tidak ada jalan keluar
dari ketiganya, dan itu diuji terhadap seluruh kombinasi aktor.

## Kegagalan memotong stok tidak membatalkan pembayaran

Pembayaran yang sudah diterima tetap sah meski pemotongan stok gagal. Penahanan
dibiarkan `HELD` agar dapat dicoba lagi, dan kegagalannya tercatat — bukan
hilang diam-diam.

Kekurangan stok yang muncul di antara pemeriksaan dan pemotongan menjadi
masalah pemenuhan, bukan masalah pembayaran.

## Nomor pesanan

Bentuknya `PSN-260731-0042` — dapat disebutkan lewat telepon tanpa membaca tiga
puluh enam karakter.

Tabrakan ditangani dengan mencoba nomor berikutnya, bukan dengan mengunci tabel
yang akan membuat seluruh pemesanan menunggu satu sama lain.

## Keterbatasan yang diketahui

**Pembayaran belum tersambung.** `AWAITING_PAYMENT → PAID` hanya dapat dipicu
`SYSTEM`, dan pemicunya dibangun pada V9-7. Sampai itu ada, pesanan tidak dapat
menjadi lunas lewat jalur normal.

**Penjadwal pelepasan belum berjalan sendiri.** `releaseExpired` tersedia
sebagai endpoint platform tetapi belum dipanggil otomatis.

**Pemenuhan belum ada.** `PROCESSING` sampai `DELIVERED` dapat disetel penjual,
tetapi picking, packing, dan pengiriman dibangun pada V9-9.

**Pemeriksaan kepemilikan penjual membaca 50 pesanan terakhir.** Untuk toko
dengan pesanan sangat banyak, pesanan lama tidak akan ditemukan. Perlu diganti
kueri langsung saat volume bertambah.
