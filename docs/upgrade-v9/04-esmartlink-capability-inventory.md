# 04 — Inventaris Kapabilitas eSmartlink

Versi 9 menjadikan eSmartlink gerbang checkout: tenant tidak dapat menerima
pesanan sebelum akunnya aktif. Dokumen ini memeriksa apa yang benar-benar sudah
terpasang.

Sumber: `apps/api/src/modules/payment/esmartlink/`,
`apps/api/prisma/platform/payment.prisma`.

## Yang sudah ada dan bekerja

Lapisan pembayaran ternyata jauh lebih matang daripada dugaan awal. Ini bukan
kerangka; ia dipakai untuk menagih langganan dan sudah berjalan di produksi.

### Model

| Model | Isi penting |
| --- | --- |
| `PaymentProvider` | baseUrl, createOrderPath, inquiryOrderPath, callbackUrl, `secretReference`, allowedIps, statusMapping, ackSuccess/ackError |
| `PaymentChannel` | kanal pembayaran per provider |
| `PaymentOrder` | orderNumber, providerOrderId, providerTransactionId, paymentUrl, virtualAccount, amount, adminFee, status, expiresAt, requestSnapshot, responseSnapshot, idempotencyKey |
| `PaymentAttempt` | percobaan create/inquiry beserta payload tersamar, httpStatus, durationMs |
| `PaymentCallbackEvent` | rawStatus, normalizedStatus, payloadMasked, **payloadChecksum**, processingStatus, remoteIp, ackBody |
| `PaymentInquiryAttempt` | percobaan inquiry |
| `PaymentStatusTransition` | riwayat transisi status |
| `PaymentCheckBatch` / `Item` | pengecekan massal |
| `PaymentReconciliationRun` / `Item` | rekonsiliasi |
| `PaymentDeadLetter` | pesan gagal |
| `HostToHostLog` | log H2H mentah |
| `ProviderRateLimitState` | pembatasan laju ke provider |

### Idempotensi yang sudah benar

```prisma
@@unique([orderNumber])
@@unique([idempotencyKey])
@@unique([providerId, providerTransactionId])
@@unique([providerId, providerOrderId])
```

Baris ketiga adalah yang paling penting: **callback ganda dengan transaction id
yang sama tidak dapat menjadi pembayaran kedua** karena basis data menolaknya.
Ini persis yang dituntut Versi 9, dan sudah ada.

`PaymentCallbackEvent.payloadChecksum` melengkapinya — callback identik dapat
dikenali walaupun provider tidak mengirim transaction id.

### Layanan

`EsmartlinkPaymentService` memiliki:

```text
createOrder()        membuat order dan menyimpan request/response snapshot
handleCallback()     memproses callback
checkPayment()       inquiry manual
createCheckBatch()   pengecekan massal
runCheckBatch()      eksekusi batch
```

`EsmartlinkClient` memiliki `createOrder()` dan `inquiryOrder()`.

## Yang tidak ada

| Kebutuhan V9 | Status | Catatan |
| --- | --- | --- |
| Akun provider **per tenant** | **MISSING** | `PaymentProvider` satu baris global |
| Credential per seller | **MISSING** | hanya `secretReference` global |
| Versi credential + rotasi | **MISSING** | tidak ada model versi |
| Health check tercatat | **MISSING** | tidak ada `PaymentProviderHealthCheck` |
| Katalog capability provider | **MISSING** | tidak ada `PaymentProviderCapability` |
| Endpoint webhook per tenant | **MISSING** | callback URL tunggal |
| Tiket aktivasi | **MISSING** | modul ticketing belum ada sama sekali |
| **Refund** | **MISSING** | tidak ada metode refund pada client maupun service |
| Split settlement | **TIDAK TERSEDIA** | lihat bagian berikut |

## Dua kendala yang mengubah rancangan

### 1. `PaymentOrder` terikat ke `BillingInvoice`

```prisma
invoiceId String         @map("invoice_id") @db.Uuid
invoice   BillingInvoice @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
```

Relasi ini **wajib**, bukan opsional. Artinya setiap `PaymentOrder` harus
menunjuk satu invoice langganan. Pesanan marketplace bukan invoice langganan.

Tiga jalan keluar, dengan pilihan dan alasannya:

| Opsi | Nilai | Masalah |
| --- | --- | --- |
| Membuat `BillingInvoice` palsu untuk tiap order marketplace | tanpa migration | mencemari pembukuan langganan dan laporan billing |
| Membuat `MarketplacePaymentOrder` terpisah | bersih | **melanggar larangan "jangan membuat implementasi kedua"**; idempotensi, rekonsiliasi, dan dead letter harus ditulis ulang |
| Menjadikan `invoiceId` opsional dan menambah tautan polimorfik | additive, satu sumber | perlu migration platform dan pemeriksaan bahwa tepat satu tautan terisi |

**Dipilih opsi ketiga.** Ia mempertahankan satu mesin pembayaran, satu jalur
idempotensi, dan satu rekonsiliasi. Dua model pembayaran paralel berarti dua
tempat yang harus benar saat callback ganda tiba, dan itu justru risiko yang
paling ingin dihindari.

Rinciannya pada [05-payment-and-settlement-constraints.md](05-payment-and-settlement-constraints.md).

### 2. `secretReference` tidak dapat menampung banyak seller

Rancangan sekarang menyimpan **nama env var**, bukan nilai rahasia:

```prisma
// Hanya referensi ke secret store / nama env var. Bukan nilai secret.
secretReference String? @map("secret_reference") @db.VarChar(160)
```

Ini keputusan yang baik untuk satu provider platform — rahasia tidak pernah masuk
basis data. Tetapi marketplace berarti **satu credential per seller**, dan
menambah env var setiap kali tenant mendaftar tidak dapat dilakukan tanpa
menyentuh sistem operasi server pada setiap pendaftaran.

Maka Versi 9 memerlukan penyimpanan terenkripsi. Prinsip yang tetap dipegang:

```text
kunci enkripsi berasal dari environment, tidak pernah dari basis data
nilai rahasia tidak pernah dikembalikan utuh setelah disimpan
UI hanya menerima input, tidak pernah menampilkan
setiap pembacaan tercatat pada audit
penyimpanan berversi agar rotasi tidak menghapus jejak
sandbox dan produksi terpisah
```

`secretReference` **tidak dihapus**; ia tetap dipakai untuk akun platform.
Akun tenant memakai kolom terenkripsi baru. Keduanya diselesaikan satu resolver.

## Refund

Tidak ada metode refund pada `EsmartlinkClient` maupun `EsmartlinkPaymentService`.
Source referensi eSmartlink yang tersedia di `docs/input` juga tidak memuat
endpoint refund.

Dokumen Versi 9 sudah mengantisipasi ini:

> "Jika refund API eSmartlink tidak terdokumentasi: `REFUND_MANUAL_REQUIRED`"

**Maka refund Versi 9 dimulai sebagai proses manual**, dengan alur kerja, bukti,
audit, dan rekonsiliasi — bukan panggilan API yang dikarang. Kapabilitas refund
otomatis dicatat pada `PaymentProviderCapability` dan bernilai `false` sampai
provider menyediakannya secara resmi.

## Split settlement

Tidak ada bukti apa pun bahwa eSmartlink mendukung split settlement atau
connected account. Tidak ada pada model, tidak ada pada client, tidak ada pada
source referensi.

Konsekuensinya untuk checkout multi-seller, sesuai perintah Versi 9:

```text
satu keranjang boleh berisi banyak seller
-> checkout dikelompokkan per seller
-> satu order per seller
-> satu payment order per seller
-> pembeli menyelesaikan beberapa pembayaran
```

Ini bukan pilihan rancangan yang disukai; ini konsekuensi dari kapabilitas
provider yang ada. UI wajib menjelaskannya kepada pembeli, bukan menyembunyikannya.

## Kesimpulan

Kapabilitas eSmartlink yang ada menutup bagian tersulit — idempotensi, log mentah,
rekonsiliasi, dan dead letter. Yang harus ditambahkan adalah **kepemilikan**:
akun per tenant, credential per seller, dan tautan ke order marketplace.

Ini pekerjaan yang jauh lebih kecil daripada membangun lapisan pembayaran baru,
asalkan tidak tergoda membuat yang kedua.
