# 16 — Aktivasi eSmartlink dan Credential (V9-2)

Menutup B5–B10 pada [matriks gap](02-v8-to-v9-gap-matrix.md), dan membuka
`PENDING_PHASE` pertama pada pemeriksaan kesiapan.

## Yang dibangun

| Objek | Isi |
| --- | ---: |
| Tabel baru | 9 |
| Enum baru | 6 |
| Endpoint baru | 7 |
| Test baru | 48 |

Ticketing dibangun sebagai bagian fase ini, bukan dipakai ulang: audit V9-0
menunjukkan modul ticketing Versi 7 tidak pernah ada.

## Enkripsi credential

Sampai Versi 8, satu-satunya rahasia yang dipakai sistem adalah milik platform
dan disimpan sebagai **nama env var** (`PaymentProvider.secretReference`). Pola
itu baik dan tetap dipakai untuk akun platform.

Marketplace tidak dapat memakainya: satu credential per seller berarti menambah
env var setiap kali tenant mendaftar, dan itu menuntut akses ke sistem operasi
server pada setiap pendaftaran.

Maka credential tenant disimpan terenkripsi. Yang tetap dipegang:

```text
kunci berasal dari environment, tidak pernah dari basis data
satu kunci per environment, ber-id agar dapat dirotasi
nilai tidak pernah dikembalikan utuh setelah disimpan
setiap pembukaan tercatat
```

**AES-256-GCM**, bukan CBC. GCM sekaligus membuktikan ciphertext tidak diubah —
tanpa itu, penyerang dengan akses tulis ke basis data dapat mengganti credential
seller lain tanpa terdeteksi sampai pembayaran gagal. Diuji: mengubah satu bit
pada ciphertext maupun pada tag menghasilkan penolakan.

**Kunci diturunkan lewat HKDF** dengan id kunci sebagai salt, sehingga dua kunci
yang bahannya tidak sengaja sama tetap menghasilkan kunci berbeda. Diuji.

**Petunjuk empat karakter** untuk nilai sepanjang delapan karakter atau lebih.
Nilai yang lebih pendek tidak diberi petunjuk sama sekali — menampilkan tiga dari
empat karakter rahasia bukan penyamaran, melainkan kebocoran.

### Rotasi

Kunci lama tetap dipasang setelah kunci aktif berganti, sehingga data yang dibuat
dengannya masih dapat dibuka. `needsRotation()` menandai versi yang masih memakai
kunci lama.

Kunci yang hilang menghasilkan pesan yang **menyebut id kunci**, supaya operator
dapat mengembalikannya alih-alih menebak. Kegagalan tag dan kunci salah
**tidak** dibedakan — membedakannya memberi tahu penyerang mana yang ia tebak
benar.

## Credential berversi

Rotasi menambah versi dan menonaktifkan versi sebelumnya; ia tidak menimpa.

Alasannya: rotasi harus dapat dibatalkan. Bila credential baru ternyata salah,
akun harus dapat kembali ke versi sebelumnya tanpa meminta ulang ke provider.
Rotasi yang menimpa membuat kesalahan tidak dapat dibatalkan, dan credential yang
salah hanya ketahuan saat pembayaran pertama gagal.

## Satu pintu pembukaan

`CredentialResolverService` adalah satu-satunya jalan membuka rahasia. Bila
setiap adapter membuka sendiri, pertanyaan "berapa kali credential seller ini
dibaca hari ini" tidak dapat dijawab.

Yang ditegakkan di sana:

| Aturan | Alasan |
| --- | --- |
| Hanya akun `ACTIVE` atau `TESTING` | akun yang belum siap tidak boleh dipakai |
| Hanya versi aktif, tertinggi per field | versi lama ada untuk dikembalikan, bukan dipakai |
| Setiap pembukaan tercatat, termasuk yang gagal | lonjakan pembacaan adalah sinyal paling awal |
| Nilai tidak pernah kembali ke lapisan HTTP | tipe kembaliannya tidak pernah menyentuh controller |

Akun yang belum aktif ditolak dengan pesan yang **menyebut statusnya**. "Tidak
ditemukan" untuk akun yang sebenarnya belum diaktifkan membuat operator mencari
di tempat yang salah.

**Tidak ada fallback ke credential platform.** Dokumen Versi 9 menyebut
precedence tiga tingkat — toko, tenant, lalu platform. Dua tingkat pertama
dibuat; yang ketiga sengaja tidak. Memakai credential platform untuk pesanan
seller berarti uang pembeli masuk ke rekening yang salah.

## Log akses terpisah

`PaymentCredentialAccessLog` terpisah dari audit umum karena pertanyaannya
berbeda: bukan "siapa mengubah apa", melainkan "berapa kali rahasia ini dibuka,
oleh proses apa, dan apakah jumlahnya wajar".

## Ticketing

Yang dibangun hanya yang dibutuhkan aktivasi: tiket, balasan, riwayat status, dan
lampiran. Bukan sistem dukungan lengkap — SLA, antrean, eskalasi, dan basis
pengetahuan menunggu fasenya sendiri. Membangunnya sekarang berarti menunda
aktivasi demi fitur yang belum ada penggunanya.

### Aturan yang paling penting

**Tiket tidak pernah memuat credential.** Balasan tiket dibaca banyak orang,
terindeks pencarian, dan tersimpan selamanya. Isi tiket aktivasi menyatakannya
secara eksplisit kepada pembacanya:

> PENTING: jangan mengirim credential melalui balasan tiket ini. Credential
> dimasukkan melalui formulir aman pada Pusat Aktivasi Marketplace.

Credential masuk lewat satu DTO pada satu endpoint yang menuntut step-up, dan
tiket hanya mencatat **bahwa** credential sudah diisi.

## Interface onboarding

Dokumen Versi 9 meminta antarmuka onboarding dibuat **tetapi melarang mengarang
endpoint provider**. Keduanya dipenuhi: antarmukanya lengkap dengan tujuh metode,
dan satu-satunya implementasi menyatakan dirinya `MANUAL_TICKET` lalu **menolak**
setiap metode yang menuntut panggilan API.

Menolak lebih baik daripada mengembalikan nilai palsu. Metode yang mengembalikan
"berhasil" tanpa memanggil provider membuat akun ditandai aktif padahal tidak,
dan kegagalannya baru terlihat saat pembeli pertama membayar.

Penolakannya menyebut nama metode, mode yang berlaku, dan ke mana harus pergi —
bukan sekadar "tidak didukung". Diuji pada keenam metode.

## Kapabilitas dicatat sebagai data

`PaymentProviderCapability` diisi saat akun dibuat:

| Kapabilitas | Didukung | Bukti |
| --- | --- | --- |
| `CREATE_ORDER` | ya | terbukti pada integrasi Versi 5 |
| `INQUIRY_ORDER` | ya | terbukti pada integrasi Versi 5 |
| `CALLBACK` | ya | terbukti pada integrasi Versi 5 |
| `REFUND` | **tidak** | tidak ada API terdokumentasi |
| `SPLIT_SETTLEMENT` | **tidak** | tidak ada bukti dukungan |

Dicatat sebagai data supaya sistem tidak pernah memanggil endpoint yang tidak
ada, dan supaya jawabannya dapat berubah tanpa rilis ketika provider menyediakan
dokumentasi resmi.

## Alur

```text
tenant menekan "Buat Tiket Aktivasi"
  └─ akun provider dibuat (AWAITING_CREDENTIAL)
       └─ tiket PLATFORM_SUPPORT dibuka dan ditautkan
            └─ admin memasukkan credential lewat formulir + step-up
                 └─ akun menjadi CREDENTIAL_SET
                      └─ uji kesehatan dijalankan
                           └─ akun menjadi TESTING lalu lulus
                                └─ admin mengaktifkan
                                     └─ akun ACTIVE, tiket RESOLVED
```

Setiap langkah menyelaraskan status pendaftaran marketplace. Penyelarasan yang
gagal **tidak** membatalkan langkahnya — transisi yang tidak sah hanya berarti
berkas pendaftaran sedang berada di tahap lain, dan itu bukan alasan menggagalkan
penyimpanan credential.

## Idempotensi

Dua tingkat:

1. Batasan unik `(tenantId, providerId, environment)` mencegah akun kedua.
2. Tiket yang masih terbuka dikembalikan alih-alih dibuat ulang.

Tanpa yang kedua, tenant yang menekan tombol dua kali membuat antrean dukungan
terisi tiket kembar.

## Aktivasi menuntut uji yang lulus

`activate()` menolak akun yang belum pernah lulus uji. Mengaktifkan tanpa uji
berarti kegagalan pertama ditanggung pembeli, bukan penguji.

Uji sendiri tidak mengarang panggilan: bila `baseUrl` provider belum diset, uji
melaporkan bahwa credential lengkap dan dapat dibuka **tetapi panggilan ke
provider tidak dijalankan** — bukan melaporkan lulus seolah provider sudah
dihubungi.

## Endpoint

```text
GET  /seller/marketplace/esmartlink/capability          ESMARTLINK_ACCOUNT.READ
GET  /seller/marketplace/esmartlink/account             ESMARTLINK_ACCOUNT.READ
POST /seller/marketplace/esmartlink/activation-ticket   ESMARTLINK_ACCOUNT.CREATE
GET  /platform/marketplace/esmartlink/accounts/:id                PLATFORM.MARKETPLACE.READ
POST /platform/marketplace/esmartlink/accounts/:id/credentials    PLATFORM.ESMARTLINK.MANAGE + step-up
POST /platform/marketplace/esmartlink/accounts/:id/health-check   PLATFORM.ESMARTLINK.MANAGE
POST /platform/marketplace/esmartlink/accounts/:id/activate       PLATFORM.MARKETPLACE.APPROVE
```

`loadAccount()` memilih kolom secara eksplisit dan **tidak memilih**
`ciphertext`, sehingga nilai rahasia tidak mungkin ikut terserialisasi ke respons
karena kelalaian.

## Konfigurasi

```ini
CREDENTIAL_ENCRYPTION_KEYS=id1:bahan1,id2:bahan2
CREDENTIAL_ENCRYPTION_ACTIVE_KEY=id2
```

Bahan minimal 32 karakter. Hasilkan dengan `openssl rand -base64 48`.

Server tanpa kunci **tetap menyala** — sebagian besar environment pengembangan
tidak memakai credential tenant. Yang gagal adalah memakainya tanpa kunci, dengan
pesan yang menyebut variabel mana yang harus diset.

## Bukti

[`evidence/v9-2-activation.txt`](evidence/v9-2-activation.txt).

```text
9 tabel V9-2 tersedia
step-up CREDENTIAL_MANAGE terdaftar
satu akun per tenant per provider per environment
satu versi credential per field
satu tautan tiket per akun
nomor tiket unik
satu-satunya kolom bernuansa rahasia adalah key_id
nilai rahasia hanya pada kolom ciphertext
```

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **235 lulus** (220 API + 15 web), naik dari 187 |
| `pnpm build` | bersih |
| `pnpm route:audit` | 0 route tanpa penanda |

## Keterbatasan yang diketahui

**Uji kesehatan belum memanggil provider.** Ia membuktikan credential lengkap dan
dapat dibuka, tetapi tidak membuat order sungguhan. Panggilan nyata menunggu
V9-7, ketika orkestrasi pembayaran marketplace dibangun. Yang dilaporkan uji
menyatakan hal ini apa adanya.

**UI credential belum ada.** Endpoint-nya berjalan dan menuntut step-up;
formulirnya menunggu halaman admin platform.

**Balasan tiket belum punya endpoint.** Model `SupportTicketMessage` ada dan
dipakai saat memuat tiket, tetapi menambah balasan belum tersedia lewat API.

**Refund tetap manual.** `supportsRefund` bernilai `false` dan akan tetap begitu
sampai provider menyediakan API resmi. Alurnya dirancang pada
[05-payment-and-settlement-constraints.md](05-payment-and-settlement-constraints.md).
