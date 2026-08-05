# 02 — Portal, Domain, Username Inventory (MI-0)

Bukti dari kode nyata, dibaca di `main` (`origin/main` commit `1ebc4a8`)
lewat worktree ini.

## Username tenant: global, immutable, case-insensitive

`apps/api/src/modules/auth/auth.service.ts` -- pencarian akun lewat
`normalizedUsername`/`normalizedEmail` (kolom ternormalisasi terpisah
dari kolom tampilan), dicocokkan lewat `OR` pada satu tabel `platform_user`
platform-wide. Ini SATU namespace global -- tidak ada tabel akun
per-vertikal terpisah. **Sesuai keputusan arsitektur MitraInap**: tenant
`hotel_jaya` akan hidup di namespace username yang SAMA dengan tenant
pesantren/emedik/koperasi manapun, bukan namespace baru.

Belum diperiksa di MI-0 ini: mekanisme immutability username SETELAH
provisioning (constraint DB / cek di service layer) -- perlu dikonfirmasi
sebelum MI-1 mengasumsikan ini sudah ditegakkan sistem, bukan cuma
konvensi.

## Domain registry: `VerticalSiteDomain` (`platform.vertical_site_domain`)

`apps/api/prisma/platform/tenancy.prisma:566-594`:

```prisma
model VerticalSiteDomain {
  id          String    @id @default(uuid()) @db.Uuid
  tenantId    String    @map("tenant_id") @db.Uuid
  host        String    @unique @db.VarChar(253)
  vertical    String    @db.VarChar(32)
  status      String    @default("PENDING") @db.VarChar(24)
  verifiedAt  DateTime? @map("verified_at") @db.Timestamptz(6)
  verifyToken String?   @map("verify_token") @db.VarChar(128)
  ...
  @@index([tenantId, vertical])
  @@index([status])
}
```

**Temuan penting**: komentar pada kolom `vertical` di skema SEKARANG
berbunyi *"Satu tenant boleh memiliki lebih dari satu host pada vertikal
yang sama, misalnya host pondok dan host unit pendidikan."* -- dan
TIDAK ADA lagi constraint `@@unique([tenantId, vertical])` (hanya index
biasa). Ini artinya kemampuan "satu tenant, banyak subdomain pada
vertikal yang sama" **SUDAH ADA di level skema saat ini**, kemungkinan
ditambahkan lewat kerja lanjutan vertikal pesantren (subdomain per unit
pendidikan) di antara sesi audit sebelumnya dan sekarang. Relevan
langsung untuk MitraInap: pola `hotel-jaya.mitrainap.id` untuk properti
tunggal, atau (bila suatu hari dibutuhkan) subdomain per-properti dalam
satu grup hotel, **tidak perlu migrasi skema baru** -- tinggal dipakai.

`host` dinormalkan (huruf kecil, tanpa port, tanpa titik akhir).
`verifiedAt`/`verifyToken` -- ada kolom untuk verifikasi kepemilikan
domain (relevan untuk skenario custom domain hotel sendiri di masa
depan), TAPI (dari audit vertikal pesantren sebelumnya, dicatat di
`docs/santri-info/18-session-handoff-2026-08-03.md`) belum ada endpoint/
UI yang memakai alur verifikasi ini secara nyata untuk vertikal apa pun
-- baru kolom yang siap dipakai, bukan fitur yang sudah jalan.

## Resolusi host -> tenant: `PublicTenantResolver`

Belum dibaca ulang detail implementasinya di worktree MitraInap ini
(sudah pernah diaudit di sesi pesantren sebelumnya:
`apps/api/src/infrastructure/tenant/public-tenant-resolver.service.ts`).
Prinsip yang WAJIB dipertahankan: **skema tenant tidak pernah diambil
langsung dari hostname/header/body klien** -- selalu lewat pencocokan ke
baris terdaftar di `vertical_site_domain`, baru skema aslinya dibaca dari
`tenant_schema_registry`. Larangan keras di perintah master
("menerima schema name dari client/host/header/body") sudah konsisten
dengan pola yang ada -- tidak perlu diciptakan ulang untuk MitraInap,
cukup didaftarkan sebagai vertikal baru (`vertical = 'HOSPITALITY'`) pada
mekanisme yang sudah ada.

## Vertical code yang sudah terdaftar (dari kode, bukan tebakan)

```text
PESANTREN   -- huruf besar, dari VERTIKAL_PESANTREN di beranda-sesudah-masuk.ts
cooperative -- disebut di komentar VerticalSiteDomain (huruf kecil)
health      -- disebut di komentar VerticalSiteDomain (huruf kecil, kemungkinan = emedik)
village     -- disebut di komentar VerticalSiteDomain (huruf kecil, kemungkinan = info-desa)
```

**Peringatan konkret untuk fase berikutnya** (pelajaran nyata dari sesi
pesantren, PR RBAC menu bawaan per vertikal): kode registrasi katalog
RBAC pesantren ditulis huruf kecil (`'pesantren'`) sedangkan
`Tenant.verticalCode` sesungguhnya huruf besar (`'PESANTREN'`) --
KEDUANYA identifier berbeda dari kata yang sama, dan penulisan pertama
kali salah pakai yang mana. Casing vertical code TIDAK KONSISTEN antara
`VerticalSiteDomain.vertical` (tampak huruf kecil dari komentar) dan
`Tenant.verticalCode` (huruf besar, dikonfirmasi dari kode nyata). MI-1
WAJIB memverifikasi nilai persis yang dipakai tiap tabel/kode secara
terpisah lewat query/log sungguhan sebelum menuliskan `'HOSPITALITY'` di
mana pun -- jangan asumsikan konsisten hanya karena terlihat masuk akal.
