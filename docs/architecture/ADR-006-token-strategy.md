# ADR-006 — Strategi token: access token di memory, refresh token dirotasi

- Status: Diterima
- Tanggal: 2026-07-30

## Konteks

Menyimpan token di `localStorage` membuatnya dapat dibaca skrip apa pun yang
berhasil dieksekusi pada origin, sehingga satu celah XSS menjadi pengambilalihan
akun yang bertahan lama. Di sisi lain, memaksa login ulang pada setiap muat
halaman membuat aplikasi tidak nyaman dipakai.

## Keputusan

### Penyimpanan

| Token | Tempat | Alasan |
| --- | --- | --- |
| Access token | **memory** (variabel modul) | Hilang saat tab ditutup; tidak dapat dibaca dari storage |
| Refresh token | **`sessionStorage`** | Bertahan saat muat ulang tab, hilang saat tab ditutup. **Tidak pernah** `localStorage` |
| Sesi demo | memory saja, refresh token `null` | Sandbox bersama; sesi tidak perlu dan tidak boleh bertahan |

Aturan ini ditegakkan lint: `no-restricted-globals` melarang `localStorage` pada
kode aplikasi, dengan pengecualian eksplisit hanya untuk preferensi tema dan
bahasa (bukan kredensial).

### Rotasi dan deteksi pemakaian ulang

Setiap pemakaian refresh token menerbitkan token baru dan mencabut yang lama.
Bila token yang **sudah dicabut** dipakai kembali, seluruh *family* token pada
sesi tersebut dicabut dan peristiwa keamanan dicatat — indikasi token dicuri.

Refresh dijalankan **single-flight**: beberapa permintaan yang bersamaan
mendapat 401 hanya memicu satu panggilan refresh, karena rotasi menolak
pemakaian ganda.

### Step-up authentication

Aksi sensitif (hapus permanen, penangguhan tenant, tulis melalui support
context, pembersihan data contoh permanen) memerlukan verifikasi ulang kata
sandi. Token step-up terikat pada satu tujuan (`purpose`), berumur pendek, dan
dikirim melalui header `X-Step-Up-Token`.

### Ganti kata sandi wajib

Pemeriksaan `mustChangePassword` berada pada `JwtAuthGuard`, bukan pada
`PermissionGuard`. Alasannya: endpoint tanpa dekorator `@Permissions` tidak
melewati `PermissionGuard`, sehingga penempatan di sana akan menyisakan celah.
Hanya endpoint pada allowlist yang tetap dapat diakses: `/auth/change-password`,
`/auth/logout`, `/auth/me`, `/me/context`.

## Konsekuensi

- Muat ulang halaman pada sesi normal memulihkan sesi melalui refresh token di
  `sessionStorage`; pada sesi demo, muat ulang **mengakhiri** sesi dan pengguna
  kembali ke halaman masuk. Perilaku ini diuji eksplisit pada Playwright agar
  tidak disalahartikan sebagai bug.
- Kata sandi sementara hasil pendaftaran ditampilkan **tepat satu kali** dan
  tidak pernah disimpan sebagai teks biasa. Hash memakai Argon2.
- Tidak ada kata sandi produksi pada repositori; suite E2E memakai sandbox demo
  sehingga tidak memerlukan kredensial.

## Rujukan

- `apps/web/src/lib/api.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`
