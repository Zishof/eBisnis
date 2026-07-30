## Ringkasan

V9-2: aktivasi eSmartlink lewat tiket dukungan dan penyimpanan credential
terenkripsi. Membuka `PENDING_PHASE` pertama pada pemeriksaan kesiapan seller.

## Migration

`20260730212407_add_provider_account_and_ticketing` dan
`20260730212723_add_credential_manage_stepup` pada schema platform. Additive.

9 tabel baru, 6 enum baru.

## Keamanan

**Credential terenkripsi AES-256-GCM.** GCM dipilih karena sekaligus
membuktikan ciphertext tidak diubah — tanpa itu, penyerang dengan akses tulis
ke basis data dapat mengganti credential seller lain tanpa terdeteksi sampai
pembayaran gagal.

Kunci berasal dari environment, diturunkan lewat HKDF dengan id kunci sebagai
salt. Kunci lama tetap dipasang setelah rotasi.

**Credential tidak pernah melewati catatan tiket.** Isi tiket menyatakannya
eksplisit. Credential masuk lewat satu DTO pada satu endpoint ber-step-up.

**Satu pintu pembukaan.** `CredentialResolverService` mencatat setiap
pembukaan, termasuk yang gagal. Fallback ke credential platform sengaja tidak
dibuat: memakai credential platform untuk pesanan seller berarti uang pembeli
masuk ke rekening yang salah.

**`loadAccount()` tidak memilih kolom `ciphertext`**, sehingga nilai rahasia
tidak mungkin ikut terserialisasi ke respons karena kelalaian.

## Yang sengaja menolak

Interface onboarding lengkap tujuh metode, tetapi implementasi eSmartlink
menyatakan `MANUAL_TICKET` dan menolak setiap metode yang menuntut panggilan
API. Dokumen Versi 9 melarang mengarang endpoint provider; menolak lebih baik
daripada mengembalikan nilai palsu.

Uji kesehatan tidak mengarang panggilan: bila `baseUrl` belum diset, ia
melaporkan credential lengkap dan dapat dibuka **tetapi panggilan tidak
dijalankan**.

## Bukti pengujian

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **235 lulus** (220 API + 15 web), naik dari 187 |
| `pnpm build` | bersih |
| `pnpm route:audit` | 0 route tanpa penanda |
| Verifikasi skema database | seluruh pemeriksaan lulus |

## Deployment

`CREDENTIAL_ENCRYPTION_KEYS` dan `CREDENTIAL_ENCRYPTION_ACTIVE_KEY` wajib diisi
sebelum fitur marketplace dipakai. `install.sh` memperingatkan bila kosong dan
menolak bila masih memakai nilai contoh.

Server tanpa kunci tetap menyala — yang gagal adalah memakainya tanpa kunci.

## Keterbatasan yang diketahui

- Uji kesehatan belum memanggil provider; panggilan nyata menunggu V9-7.
- UI credential belum ada; endpoint-nya berjalan dan menuntut step-up.
- Balasan tiket belum punya endpoint.
- Refund tetap manual sampai provider menyediakan API resmi.

## Rollback

Migration additive. Menonaktifkan fitur cukup dengan mengosongkan
`CREDENTIAL_ENCRYPTION_KEYS`; endpoint akan menolak dengan pesan yang jelas.
