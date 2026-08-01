# ECO-0 — Inventaris identitas dan SSO

## Yang ada

| Hal | Keadaan |
| --- | --- |
| `PlatformUser`, `PlatformUserProfile`, `PlatformUserRole` | ada |
| `PlatformSession`, `PlatformRefreshToken` | ada, **dengan rotasi dan deteksi pemakaian ulang** |
| `PlatformRole`, `PlatformPermission`, `PlatformRolePermission` | ada |
| `PlatformStepUpChallenge` | ada |
| `PlatformSupportSession`, `PlatformRoleSwitchLog`, `PlatformLoginAttempt` | ada |
| `TenantMembership` | ada |

Rotasi refresh token bekerja: token yang dipakai ulang mencabut seluruh keluarga
token sesi itu. Cacat klien yang mengirim dua penyegaran serentak — dan karenanya
memicu pencabutan itu tanpa sebab — baru diperbaiki pada #61.

## Yang tidak ada

Tidak ada satu pun jejak `oidc`, `openid`, `authorization_code`, atau `pkce` di
seluruh `apps/api/src`.

| Kebutuhan §9 | Status |
| --- | --- |
| Satu authoritative issuer | MISSING |
| Authorization Code + PKCE | MISSING |
| Client registration per portal | MISSING |
| BFF per portal dengan cookie sendiri | MISSING |
| `PlatformPerson` terpisah dari `PlatformUser` | MISSING |
| `PlatformIdentity`, `PlatformLoginMethod` | MISSING |
| `PlatformOrganization` | MISSING |
| `VerticalProfileLink` | MISSING |
| Active context §9.4 | **PARTIAL** — sesi membawa tenant dan peran; `activeVerticalCode`, `activeProductCode`, `activeDataScope`, `purposeOfUse` belum |

## Penilaian

Yang berjalan sekarang adalah login JWT langsung ke API untuk **satu** domain.
Itu benar untuk satu domain, dan tidak dapat dipakai untuk lima registrable
domain tanpa melanggar §5 (*shared cookie lintas registrable domain*).

ECO-2 karena itu bukan penyesuaian melainkan penambahan lapisan: identity
provider di depan model identitas yang sudah ada. **Model penggunanya tidak
perlu dibuang** — yang ditambahkan adalah issuer, client registration, dan BFF
per portal.

Satu hal yang perlu diputuskan lebih dahulu: §9.3 memisahkan `PlatformPerson`
(orang) dari `PlatformUser` (akun). Hari ini keduanya satu. Pemisahan itu
menyentuh setiap tempat yang menautkan orang ke peran, dan §278 melarang
menggabungkan identitas orang dengan hak akses datanya — jadi pemisahannya bukan
opsional, tetapi urutannya perlu direncanakan.
