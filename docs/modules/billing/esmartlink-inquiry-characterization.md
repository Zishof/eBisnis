# Karakterisasi `inquiry` Esmartlink

Pemeriksaan status pembayaran, dikarakterisasi dari parameter `inquery` pada
`docs/input/Esmartlink.java:111-204`.

## Inquiry memakai pemroses pembayaran yang SAMA

Pada legacy, `doProcess(...)` menerima flag `inquery` dan meneruskannya ke
`VirtualAccountBank.bayarTopup(...)`, `bayarSiswa(...)`, dan
`isSudahTerbayarUntukPayment(...)`. Callback dan inquiry **tidak** memiliki jalur
pemrosesan terpisah.

**Implikasi yang dipertahankan.** Implementasi baru memakai satu
`processPaymentEvent()` untuk callback maupun inquiry. Alasannya bukan
penghematan kode, tetapi konsistensi: dua jalur terpisah akan menyimpang, dan
penyimpangan pada pemrosesan pembayaran berarti selisih uang.

Perbedaan hanya pada asal peristiwa (`source`), yang dicatat pada audit.

## Dedupe berlaku sama

`isSudahTerbayarUntukPayment(virtualAccountBankNtt, inquery, false, chek)`
memeriksa status terbayar sebelum memproses, apa pun asal peristiwanya. Inquiry
yang menemukan pembayaran yang sudah tercatat **tidak** menggandakan pembayaran.

## Batch check

`payment_check_batch` dan `payment_check_batch_item` memungkinkan pemeriksaan
banyak order sekaligus, dibatasi `ESMARTLINK_CHECK_BATCH_MAX` (default 300)
dengan konkurensi `ESMARTLINK_CHECK_CONCURRENCY` (default 4).

Batas ini disengaja: memeriksa ribuan order secara paralel akan memicu rate
limit provider dan menghabiskan pool koneksi database. `provider_rate_limit_state`
menyimpan status pembatasan agar batch berikutnya tidak menabrak dinding yang
sama.

## Transisi status

Setiap perubahan status order dicatat pada `payment_status_transition`, sehingga
urutan `WAITING_PAYMENT → PAID` (atau `EXPIRED`, `FAILED`) dapat direkonstruksi.
Transisi tidak sah ditolak, bukan diterapkan diam-diam.

## Dead letter

Peristiwa yang gagal diproses setelah percobaan ulang masuk ke
`payment_dead_letter` beserta payload yang sudah dimask dan alasan kegagalan.
Peristiwa tidak pernah dibuang tanpa jejak — kalau dibuang, pembayaran masuk
yang gagal diproses menjadi tidak terlihat.

## Rekonsiliasi

`payment_reconciliation_run` dan `payment_reconciliation_item` membandingkan
catatan internal dengan laporan provider. Selisih dilaporkan, bukan otomatis
disamakan: penyesuaian otomatis pada data pembayaran menyembunyikan masalah
alih-alih menyelesaikannya.

## Rujukan

- [Karakterisasi legacy](esmartlink-legacy-characterization.md)
- [Karakterisasi create-order](esmartlink-create-order-characterization.md)
- `apps/api/src/modules/payment/esmartlink/esmartlink-payment.service.ts`
