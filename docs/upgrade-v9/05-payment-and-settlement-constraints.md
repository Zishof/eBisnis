# 05 — Kendala Pembayaran dan Settlement

Dokumen ini menetapkan apa yang **boleh** dijanjikan Versi 9 tentang uang, dan
apa yang tidak boleh — berdasarkan kapabilitas provider yang terbukti ada, bukan
yang diharapkan.

## Aturan dasar

```text
payment_url bukan bukti pembayaran
callback yang belum diverifikasi bukan bukti pembayaran
inquiry yang mengembalikan SUCCESS adalah bukti
callback yang lolos validasi jumlah dan akun adalah bukti
```

Larangan Versi 9 menyebut ini secara eksplisit, dan ia bukan formalitas: pesanan
yang ditandai lunas karena pembeli membuka halaman pembayaran adalah cara paling
langsung kehilangan barang tanpa uang.

## Kendala 1 — `PaymentOrder` menuntut `BillingInvoice`

### Keadaan sekarang

```prisma
model PaymentOrder {
  invoiceId String         @map("invoice_id") @db.Uuid   // WAJIB
  invoice   BillingInvoice @relation(..., onDelete: Restrict)
}
```

Setiap pembayaran harus menunjuk satu invoice langganan.

### Perubahan yang diambil

Menjadikan `invoiceId` opsional dan menambah tautan pesanan marketplace:

```prisma
invoiceId           String? @map("invoice_id") @db.Uuid            // opsional
marketplaceOrderId  String? @map("marketplace_order_id") @db.Uuid  // baru
tenantId            String? @map("tenant_id") @db.Uuid             // baru
providerAccountId   String? @map("provider_account_id") @db.Uuid   // baru
```

dengan batasan bahwa **tepat satu** tautan terisi:

```sql
CHECK (num_nonnulls(invoice_id, marketplace_order_id) = 1)
```

### Mengapa bukan model terpisah

Membuat `MarketplacePaymentOrder` sendiri tampak lebih bersih dan tidak menyentuh
tabel yang sudah dipakai produksi. Tetapi ia menuntut penulisan ulang:

```text
idempotensi transaction id
pemrosesan callback
inquiry dan batch check
rekonsiliasi
dead letter
rate limit provider
log H2H
```

Tujuh mekanisme yang sudah benar, ditulis dua kali. Saat callback ganda tiba pada
pukul tiga pagi, dua jalur berbeda harus sama-sama benar. Satu tabel dengan satu
kolom tambahan lebih aman daripada dua tabel dengan tujuh mekanisme kembar.

### Risiko perubahan ini

`invoiceId` yang menjadi opsional berarti kode billing yang mengasumsikannya
selalu ada dapat pecah. Mitigasi:

1. Migration hanya melonggarkan `NOT NULL`; **tidak ada baris lama yang berubah**.
2. `CHECK` memastikan tidak ada baris tanpa tautan sama sekali.
3. Query billing yang ada disaring `WHERE invoice_id IS NOT NULL`.
4. Diuji dengan regression billing sebelum digabung.

## Kendala 2 — Satu credential platform, bukan per seller

Diuraikan pada [04-esmartlink-capability-inventory.md](04-esmartlink-capability-inventory.md).

Ringkasnya: `secretReference` menunjuk env var. Marketplace membutuhkan credential
per seller, dan env var tidak dapat ditambah per pendaftaran tenant.

### Aturan penyimpanan credential

```text
terenkripsi saat disimpan, kunci dari environment
tidak pernah dikembalikan utuh setelah disimpan
UI hanya menerima, tidak menampilkan
berversi; rotasi menambah versi, tidak menimpa
setiap pembacaan tercatat pada audit
sandbox dan produksi terpisah
menuntut step-up untuk mengubah
```

### Aturan yang lebih penting daripada enkripsi

**Credential tidak boleh masuk catatan tiket.** Alur aktivasi Versi 9 memakai
tiket dukungan, dan godaan terbesarnya adalah menempelkan credential sebagai
balasan tiket. Catatan tiket dibaca banyak orang, terindeks pencarian, dan
tersimpan dalam riwayat.

Maka credential dimasukkan melalui formulir tersendiri oleh pengguna berwenang,
dan tiket hanya mencatat **bahwa** credential sudah diisi, bukan isinya.

## Kendala 3 — Tidak ada split settlement

Tidak ada bukti eSmartlink mendukungnya. Maka:

```text
Keranjang berisi seller A dan seller B
-> satu MarketplaceOrderGroup
-> order A ke seller A, order B ke seller B
-> payment order A memakai credential seller A
-> payment order B memakai credential seller B
-> pembeli membayar dua kali
```

Yang **dilarang**, dan alasannya:

| Dilarang | Alasan |
| --- | --- |
| Satu pembayaran untuk banyak seller | uang masuk ke satu akun; membaginya adalah escrow tanpa dasar hukum dan tanpa dukungan provider |
| Escrow platform | menahan uang seller memerlukan izin dan kontrak yang tidak dimiliki |
| Memotong fee dari aliran provider | provider tidak menyediakannya |

### Fee marketplace

Karena fee tidak dapat dipotong dari aliran pembayaran, ia **diakru**:

```text
pesanan lunas
-> MARKETPLACE_PLATFORM_FEE_ACCRUED
-> akumulasi per periode
-> tagihan platform ke seller (BillingInvoice yang sudah ada)
-> MARKETPLACE_PLATFORM_FEE_BILLED
```

Fee bawaan **nol**. Marketplace dapat berjalan tanpa fee, dan mengaktifkannya
adalah keputusan bisnis terpisah yang tidak menghalangi peluncuran.

## Kendala 4 — Refund manual

Tidak ada refund API. Maka alur refund:

```text
permintaan retur
-> keputusan seller
-> barang diterima dan diperiksa
-> refund disetujui
-> status REFUND_MANUAL_REQUIRED
-> transfer manual oleh seller
-> bukti transfer diunggah
-> petugas rekonsiliasi memverifikasi
-> REFUNDED
```

Yang membuat ini dapat dipertanggungjawabkan bukan otomatisasinya, melainkan
buktinya: setiap langkah punya pelaku, waktu, dan lampiran.

`PaymentProviderCapability.supportsRefund` bernilai `false`. Ketika provider
menyediakan refund API resmi, kapabilitas diubah menjadi `true` dan alur otomatis
mengambil alih tanpa mengubah model.

## Status pembayaran

Dipakai apa adanya dari enum yang sudah ada bila cocok, ditambah bila perlu:

```text
CREATED  PENDING  SUCCESS  FAILED  EXPIRED  CANCELLED
REFUND_PENDING  PARTIALLY_REFUNDED  REFUNDED  CHARGEBACK
```

## Validasi callback yang wajib

Urutan ini tidak boleh dipersingkat:

```text
1. catat payload mentah lebih dulu, sebelum diproses
2. cari payment order berdasarkan providerTransactionId
3. tolak bila order tidak ditemukan
4. tolak bila jumlah tidak sama persis
5. tolak bila akun provider bukan milik seller order tersebut
6. bila order sudah lunas, catat dan hentikan tanpa mutasi kedua
7. baru tandai lunas
8. commit reservasi stok
9. buat fulfillment order
```

Langkah 1 mendahului segalanya supaya callback yang ditolak pun tetap terlihat.
Langkah 6 adalah yang mencegah callback ganda menjadi pembayaran ganda pada
lapisan aplikasi, melengkapi batasan unik pada lapisan basis data.

Langkah 5 sering terlupa dan paling berbahaya pada marketplace: tanpa itu,
callback untuk seller A dapat melunasi order seller B bila penyerangnya dapat
menebak transaction id.
