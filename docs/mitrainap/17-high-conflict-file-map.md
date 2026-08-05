# 17 — High-Conflict File Map (MI-0)

Daftar berkas yang TIDAK BOLEH diubah langsung dari worktree
`eBisnisGithub-mitrainap` tanpa koordinasi lewat
`docs/integration-requests/hospitality/<nomor>-<judul>.md` (sesuai §4.1
perintah master, disalin+dikonfirmasi relevan untuk repo ini):

```text
package.json (root)
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig/build config tingkat root
Prisma loader/index tingkat root (apps/api/prisma/platform/schema.prisma dan
  berkas yang di-import olehnya di luar model milik hospitality sendiri)
Katalog migrasi tenant global (apps/api/tenant-migrations/manifest.json --
  BEDA dari apps/api/tenant-migrations/hospitality/manifest.json yang akan
  dibuat sendiri, mengikuti pola apps/api/tenant-migrations/pesantren/manifest.json)
Resolver tenant/domain global
  (apps/api/src/infrastructure/tenant/public-tenant-resolver.service.ts)
Identity/auth global
  (apps/api/src/modules/auth/**, KECUALI menambah endpoint/guard BARU khusus
  hospitality dengan pola terpisah -- lihat psb-applicant-auth.guard.ts
  sebagai contoh "guard baru, tidak menyunting guard staf global")
Semantik akuntansi/POS/inventory bersama
  (apps/api/src/modules/accounting/**, apps/api/src/modules/pos/**,
  apps/api/src/modules/inventory/** -- BELUM diperiksa detail di MI-0 ini,
  akan diaudit ulang saat MI-22 ERP Integration)
Registry menu/role global
  (apps/api/src/infrastructure/provisioning/tenant-menu.seed.ts,
  apps/api/src/infrastructure/provisioning/tenant-role.seed.ts --
  TAMBAH entri baru di sini boleh lewat integration request, JANGAN
  menyunting entri vertikal lain yang sudah ada)
Root OpenAPI/Orval aggregate (BELUM ditemukan lokasinya di MI-0 ini,
  perlu dicari saat MI-1)
Root CHANGELOG.md
.github/workflows/**
CODEOWNERS (BELUM diperiksa keberadaannya)
```

## Berkas yang AMAN diubah bebas dari worktree ini

```text
apps/api/src/modules/hospitality/**                 (baru, milik sendiri)
apps/web/src/verticals/hospitality/**                (baru, milik sendiri)
apps/api/tenant-migrations/hospitality/**            (baru, milik sendiri, manifest.json sendiri)
packages/hospitality-domain/**                       (baru, bila dibutuhkan)
packages/hospitality-contracts/**                    (baru, bila dibutuhkan)
packages/hospitality-ui/**                            (baru, bila dibutuhkan)
packages/api-client-hospitality/**                    (baru, bila dibutuhkan)
docs/mitrainap/**                                     (dokumen ini sendiri)
docs/changelog/hospitality.md                         (baru)
docs/integration-requests/hospitality/**              (baru, tempat mengajukan shared change)
```

## Belum diverifikasi di MI-0 ini

Root OpenAPI/Orval aggregate, CODEOWNERS, dan detail penuh
`apps/api/src/modules/accounting|pos|inventory/**` belum dibaca. Akan
diperiksa saat fase yang benar-benar membutuhkannya (MI-1 untuk OpenAPI,
MI-22 untuk accounting/POS/inventory) supaya audit MI-0 tidak molor
menunggu pembacaan berkas yang belum relevan.
