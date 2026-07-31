# 20 — Keranjang dan Checkout (V9-6)

Menutup D10–D12 pada [matriks gap](02-v8-to-v9-gap-matrix.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel platform baru | 6 |
| Endpoint baru | 8 |
| Test baru | 36 |

## Pembeli tinggal di platform, bukan tenant

Seorang pembeli berbelanja dari banyak penjual dalam satu keranjang.
Menempatkannya pada schema tenant berarti keranjangnya terpecah menurut penjual
sejak awal, dan tidak ada satu pun tempat yang tahu isinya secara utuh.

Konsekuensinya harus dijaga: penjual hanya melihat pembeli yang memesan
kepadanya, dan hanya lewat pesanan — bukan lewat tabel pembeli.

`MarketplaceBuyer` terpisah dari `PlatformUser` maupun `user_subject`. Ketiganya
masuk lewat pintu berbeda; menyatukannya akan membuat satu kesalahan otorisasi
berakibat pada ketiganya sekaligus.

## Satu kelompok per penjual

Keranjang berisi tiga penjual menghasilkan tiga kelompok, tiga pesanan, dan
tiga perintah bayar.

Satu pembayaran untuk banyak penjual menuntut penyedia membagi setelmen ke
beberapa rekening. eSmartlink belum terbukti mendukungnya, dan membuat
pembagian sendiri berarti platform menampung uang penjual — kegiatan yang
menuntut izin yang tidak dimiliki.

## Harga: dibandingkan, bukan dipercaya

Keranjang menyimpan harga saat barang dimasukkan. Nilai itu **pembanding,
bukan tagihan**.

| Pilihan | Akibatnya |
| --- | --- |
| Menagih harga lama | penjual menanggung selisih setiap kenaikan |
| Menolak checkout | keranjang terbuang karena selisih seratus rupiah |
| **Memberi tahu dan meminta persetujuan** | dipilih |

Perubahan harga terlihat di keranjang, bukan disembunyikan sampai checkout.
Pembeli yang baru tahu harganya naik pada layar pembayaran akan merasa
dikelabui.

## Yang dibekukan dan yang tidak

Checkout menyalin harga, judul, dan alamat. Pembeli yang membuka halaman
pembayaran selama sepuluh menit tidak boleh menemukan totalnya berubah saat
menekan bayar.

Yang **tidak** dibekukan adalah kelayakan: stok, status penjual, dan rekening
pembayaran diperiksa ulang saat konfirmasi. Membekukannya berarti menjual
barang yang sudah habis.

Alamat disalin, bukan dirujuk. Pembeli yang mengubah alamatnya setelah memesan
tidak boleh mengubah tujuan kiriman yang sedang berjalan.

## Empat belas pemeriksaan

```text
LISTING_UNAVAILABLE   SELLER_INACTIVE          STORE_INACTIVE
OUT_OF_STOCK          PRICE_CHANGED            QUANTITY_INVALID
QUANTITY_EXCEEDS_STOCK PAYMENT_ACCOUNT_INACTIVE ADDRESS_MISSING
ADDRESS_INCOMPLETE    SHIPPING_METHOD_MISSING  WEIGHT_MISSING
CART_EMPTY            TOTAL_INVALID
```

Beberapa keputusan yang perlu dijelaskan:

**Stok tidak diperiksa ketika jumlahnya tidak diketahui.** Katalog menyimpan
ketersediaan, bukan jumlah pasti. Menolak berdasarkan angka yang tidak diketahui
akan menolak pesanan yang sebenarnya sah.

**Stok nol diterima bila pre-order diizinkan.** Menolaknya membuat pre-order
tidak berarti apa-apa.

**Barang yang sudah tidak dijual tidak diperiksa lebih jauh.** Satu alasan sudah
cukup untuk menghapusnya dari keranjang; mengeluhkan harga dan stoknya sekaligus
hanya menambah kebisingan.

**Berat nol menghalangi.** Tanpa berat, ongkos kirim tidak dapat dihitung, dan
pembeli akan mengetahuinya setelah membayar.

## Keranjang tamu

Dikenali lewat token acak, bukan lewat sesi. Pengunjung harus dapat memilih
barang sebelum memutuskan mendaftar; menuntut pendaftaran lebih dahulu adalah
cara paling murah kehilangan pembeli.

Keranjang tamu yang dibawa masuk **digabungkan**, bukan dibuang. Jumlah barang
yang sama dijumlahkan karena keduanya adalah niat pembeli yang sama.

## Keterbatasan yang diketahui

**Ongkos kirim masih tetap Rp 20.000 per penjual.** Tarif sungguhan datang dari
penyedia ekspedisi pada V9-9. Angka tetap dipakai supaya alur dapat dijalankan
dari awal sampai akhir — dan pembeli melihat angka yang jujur, bukan nol yang
menyesatkan.

**Identitas pembeli dari header `X-Buyer-Id`.** Login pembeli dibangun bersama
akun marketplace. Header ini memungkinkan alur diuji tanpa membuat mekanisme
otentikasi kedua yang kelak harus dibongkar.

**Stok belum ditahan.** Reservasi dibangun pada V9-8. Sampai itu ada, dua
pembeli dapat men-checkout barang terakhir yang sama.

**Pesanan dan pembayaran belum dibuat.** `confirm` hanya mengunci checkout;
pesanan dibuat V9-8 dan perintah bayar V9-7.
