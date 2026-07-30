# 17 — Rancangan Login Google

## Kondisi sekarang

Tidak ada. Pencarian `googleapis`, `google-auth-library`, `openid-client`, dan
`passport-google-oauth20` pada seluruh dependency menghasilkan nol.

Autentikasi yang ada: username + kata sandi Argon2, JWT akses 15 menit, refresh
token 30 hari dengan rotasi dan deteksi pemakaian ulang
([ADR-006](../architecture/ADR-006-token-strategy.md)).

## Prinsip yang tidak dapat ditawar

Blueprint menyatakannya, dan keduanya adalah pembatas keamanan yang nyata:

```text
1. ID token WAJIB diverifikasi di backend, bukan dipercaya dari frontend.
2. Login Google TIDAK PERNAH membuat user atau role secara otomatis.
```

Butir kedua adalah yang membedakan "masuk dengan Google" dari "daftar dengan
Google". Sistem ini multi-tenant dengan data keuangan; siapa pun yang memiliki
alamat Gmail tidak boleh memperoleh akun hanya dengan menekan tombol. Google
hanya membuktikan **siapa** penggunanya, bukan **apakah** ia berhak.

## Alur

```text
Browser
  └─ Google Identity Services menghasilkan ID token (JWT)
       │
       ▼
POST /api/v1/auth/google   { credential: <ID token> }
       │
       ▼  seluruhnya di backend
  1. Ambil dan cache JWKS Google
  2. Verifikasi tanda tangan
  3. Verifikasi iss = accounts.google.com atau https://accounts.google.com
  4. Verifikasi aud = GOOGLE_CLIENT_ID milik kita
  5. Verifikasi exp dan iat, toleransi selisih jam kecil
  6. Verifikasi nonce cocok dengan yang dikirim saat memulai
  7. WAJIB email_verified = true
  8. Cari user AKTIF yang emailnya cocok dalam tenant
       │
       ├─ tidak ditemukan  -> TOLAK. Jangan buat user. Catat percobaan.
       ├─ ditemukan nonaktif -> TOLAK dengan alasan berbeda
       └─ ditemukan aktif  -> terbitkan JWT eBisnis seperti login biasa
```

Setelah langkah 8 berhasil, alur berikutnya **sama persis** dengan login biasa:
sesi, refresh token dengan rotasi, dan audit. Google hanya menggantikan
pembuktian identitas, tidak menggantikan otorisasi.

## Yang dicocokkan

Pencocokan memakai **email terverifikasi**, dinormalisasi lebih dulu:

```text
huruf kecil seluruhnya
spasi di ujung dibuang
```

Yang **tidak** dilakukan: menghapus titik pada alamat Gmail, dan mengabaikan
bagian setelah `+`. Keduanya terlihat membantu tetapi membuat dua alamat berbeda
dianggap sama, dan itu jalan masuk untuk mengambil alih akun.

`google_sub` (klaim `sub`) disimpan pada percocokan pertama yang berhasil, lalu
dipakai sebagai kunci utama untuk masuk berikutnya. Alasannya: alamat email
dapat berpindah pemilik pada Google Workspace, sedangkan `sub` tidak pernah
dipakai ulang.

## Model

```text
GoogleIdentityLink
  id
  platformUserId        FK, unik
  googleSub             unik, kunci identitas Google yang stabil
  emailAtLink           email saat pertama ditautkan
  hostedDomain          klaim hd, untuk pembatasan domain Workspace
  linkedAt / linkedBy
  lastLoginAt
  isActive / deactivatedAt / deletedAt / version

GoogleLoginAttempt
  id
  emailAttempted        dinormalisasi
  googleSub             nullable bila token tidak sah
  outcome               SUCCESS | USER_NOT_FOUND | USER_INACTIVE |
                        EMAIL_NOT_VERIFIED | INVALID_TOKEN | DOMAIN_NOT_ALLOWED |
                        TENANT_MISMATCH | RATE_LIMITED
  ipAddress / userAgent / requestId / attemptedAt
```

`GoogleLoginAttempt` mencatat kegagalan, bukan hanya keberhasilan. Tanpa itu,
percobaan menebak alamat email tidak terlihat sama sekali.

## Konfigurasi

```ini
GOOGLE_LOGIN_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_ALLOWED_HOSTED_DOMAINS=
GOOGLE_JWKS_CACHE_TTL_SECONDS=3600
```

`GOOGLE_CLIENT_SECRET` **tidak diperlukan** — alur ID token dari Google Identity
Services tidak menukar authorization code, sehingga tidak ada rahasia klien yang
perlu disimpan. Ini sekaligus mengurangi satu rahasia yang harus dijaga.

Default `false`: fitur baru yang menyentuh autentikasi tidak boleh aktif
sebelum diuji pada environment nyata.

## Titik yang mudah salah

| Kesalahan | Akibat | Penanganan |
| --- | --- | --- |
| Percaya `email` tanpa `email_verified` | siapa pun dapat mendaftarkan email orang lain di Google dan masuk | tolak bila `email_verified` bukan `true` |
| Tidak memverifikasi `aud` | token untuk aplikasi lain diterima | cocokkan dengan `GOOGLE_CLIENT_ID` |
| Tidak memverifikasi `iss` | token dari penerbit lain diterima | daftar penerbit tetap |
| Memverifikasi di frontend | pemeriksaan dapat dilewati seluruhnya | verifikasi hanya di backend |
| Membuat user otomatis | siapa pun dengan Gmail memperoleh akses tenant | dilarang; tolak bila tidak ditemukan |
| Menormalkan titik Gmail | dua akun berbeda dianggap satu | jangan lakukan |
| Mencocokkan dengan email saja selamanya | email berpindah pemilik | simpan dan pakai `google_sub` |
| Tanpa nonce | token dapat diputar ulang | nonce sekali pakai, disimpan sampai kedaluwarsa |
| JWKS diambil setiap permintaan | tergantung ketersediaan Google, dan lambat | cache dengan TTL, ambil ulang saat `kid` tidak dikenal |

## Rate limit dan audit

Endpoint `/auth/google` memakai batas `THROTTLE_AUTH_LIMIT` yang sudah ada
(10 per menit per IP), sama seperti login biasa.

Setiap percobaan tercatat pada `GoogleLoginAttempt`, dan keberhasilan juga
tercatat pada audit platform sebagai `GOOGLE_LOGIN_SUCCESS` beserta
`platformUserId`. **ID token tidak pernah ditulis ke log maupun audit.**

## Penautan akun

Pengguna yang sudah masuk dapat menautkan akun Google-nya dari halaman profil.
Penautan memerlukan step-up authentication, karena ia menambah cara masuk ke
akun tersebut.

Pelepasan tautan ditolak bila akun itu tidak punya kata sandi — jika tidak,
pengguna akan terkunci di luar akunnya sendiri.

## Pengujian

| Kasus | Hasil yang diharapkan |
| --- | --- |
| Token sah, user aktif, email cocok | berhasil, JWT terbit |
| Token sah, user tidak ada | ditolak, **tidak ada user dibuat** |
| Token sah, user nonaktif | ditolak dengan alasan berbeda |
| `email_verified` bernilai false | ditolak |
| `aud` milik aplikasi lain | ditolak |
| `iss` bukan Google | ditolak |
| Token kedaluwarsa | ditolak |
| Tanda tangan diubah | ditolak |
| Token diputar ulang | ditolak lewat nonce |
| `hd` di luar daftar yang diizinkan | ditolak |
| Email cocok tetapi tenant berbeda | ditolak |
| `google_sub` berubah untuk email sama | ditolak, perlu penautan ulang |
| Melewati batas laju | ditolak |
| Fitur dimatikan | endpoint mengembalikan 404 |
