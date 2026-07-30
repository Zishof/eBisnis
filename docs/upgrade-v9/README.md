# Audit Versi 9 — Marketplace dan Toko Online

Fase **V9-0** sampai **V9-4** selesai: audit, penegakan otorisasi, fondasi
marketplace, aktivasi eSmartlink, storefront berbasis domain terverifikasi, dan
listing dengan gerbang publikasi.
Branch `feature/v9-marketplace`.

## Kesimpulan singkat

Dari 67 requirement Versi 9, **48 belum ada sama sekali**, 9 sebagian, 6 sudah
ada, 1 rusak, 1 bertentangan, dan 2 terhalang kapabilitas provider.

Tiga hal yang paling mengubah rencana dibanding asumsi dokumen Versi 9:

1. **Modul Versi 7 yang diminta dipakai ulang ternyata tidak ada.** Ticketing dan
   ekspedisi/GPS harus dibangun, bukan dipakai ulang.
2. **`PaymentOrder` terikat ke `BillingInvoice`.** Pesanan marketplace tidak dapat
   memakainya tanpa melonggarkan relasi itu.
3. **Lapisan pembayaran jauh lebih matang daripada dugaan.** Idempotensi
   transaction id, log H2H, rekonsiliasi, dan dead letter sudah ada dan benar.

Ditambah dua utang otorisasi yang dinaikkan prioritasnya: guard permission yang
bocor dan batas data yang tersimpan tetapi tidak ditegakkan. Keduanya dikerjakan
pada V9-1, sebelum endpoint marketplace pertama dibuat.

## Daftar dokumen

| Berkas | Isi |
| --- | --- |
| [00-current-state.md](00-current-state.md) | ukuran source, baseline, yang ada dan yang tidak |
| [01-v8-r1-status.md](01-v8-r1-status.md) | 16 kapabilitas Versi 8, mana prasyarat mana bukan |
| [02-v8-to-v9-gap-matrix.md](02-v8-to-v9-gap-matrix.md) | 67 requirement dengan bukti, reuse, risiko, fase |
| [03-marketplace-domain-model-map.md](03-marketplace-domain-model-map.md) | penempatan model platform dan tenant |
| [04-esmartlink-capability-inventory.md](04-esmartlink-capability-inventory.md) | kapabilitas pembayaran yang ada dan yang tidak |
| [05-payment-and-settlement-constraints.md](05-payment-and-settlement-constraints.md) | apa yang boleh dan tidak boleh dijanjikan tentang uang |
| [06-order-fulfillment-shipping-map.md](06-order-fulfillment-shipping-map.md) | rantai pesanan sampai terkirim |
| [07-menu-role-permission-delta.md](07-menu-role-permission-delta.md) | 15 root menu, 33 role, 8 profil, 14 aksi baru |
| [08-security-risk-register.md](08-security-risk-register.md) | 30 risiko dengan skenario dan penanganan |
| [09-implementation-plan.md](09-implementation-plan.md) | 16 fase, penyimpangan dari urutan dokumen |
| [10-test-baseline.md](10-test-baseline.md) | hasil baseline dan test wajib per fase |
| [11-table-reuse-and-ownership-map.md](11-table-reuse-and-ownership-map.md) | tabel mana yang dipakai ulang, mana yang dilarang dibuat |
| [12-api-route-inventory.md](12-api-route-inventory.md) | 157 endpoint yang ada, 33 yang diminta |
| [13-ui-route-inventory.md](13-ui-route-inventory.md) | 55 route yang ada, storefront yang harus dibangun |
| [14-authorization-enforcement.md](14-authorization-enforcement.md) | **V9-1 bagian A** — guard gagal-tertutup dan penegakan batas data |
| [15-marketplace-foundation.md](15-marketplace-foundation.md) | **V9-1 bagian B** — menu, profil M1–M9, role, dan pendaftaran seller |
| [16-esmartlink-activation.md](16-esmartlink-activation.md) | **V9-2** — tiket aktivasi, credential terenkripsi, dan uji kesehatan |
| [17-storefront-domain.md](17-storefront-domain.md) | **V9-3** — toko, domain terverifikasi, dan storefront resolver |
| [18-listing-media.md](18-listing-media.md) | **V9-4** — listing, validasi media, dan gerbang publikasi |
| [evidence/baseline-v9-0.txt](evidence/baseline-v9-0.txt) | keluaran perintah mentah |

## Urutan membaca

Bagi yang ingin gambaran cepat: [00](00-current-state.md) lalu
[09](09-implementation-plan.md).

Bagi yang akan menulis kode: tambahkan
[11](11-table-reuse-and-ownership-map.md) — ia yang mencegah membuat model kedua
untuk hal yang sama.

Bagi yang meninjau keamanan: [08](08-security-risk-register.md) dan
[05](05-payment-and-settlement-constraints.md).

## Yang tidak dijanjikan

Rencana ini tidak menjanjikan seluruh Versi 9 selesai dalam waktu dekat. Dokumen
Versi 9 meminta sekitar 200 model baru; seluruh sistem yang ada sekarang berisi
121 tabel tenant dan 136 model platform sebagai hasil pekerjaan berbulan-bulan.

Yang dijanjikan: setiap fase menghasilkan sesuatu yang benar-benar berjalan dan
dapat diuji, dan fase yang menyentuh uang tidak dibangun di atas otorisasi yang
sudah diketahui bocor.
