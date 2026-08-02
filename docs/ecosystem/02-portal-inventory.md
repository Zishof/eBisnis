# ECO-0 — Inventaris portal

## Yang diminta

Lima portal brand dengan registry `PlatformPortal*` (§6.1), lima apex domain,
lima app entry `app.*`, cross-link dua arah, dan CMS site terpisah per portal.

## Yang ada

| Hal | Status | Bukti |
| --- | --- | --- |
| Model `PlatformPortal*` | **MISSING** | Tidak ada satu pun model berawalan `PlatformPortal` di antara 197 model Prisma |
| Kode portal (`EBISNIS`, `EMEDIK`, …) | **MISSING** | Tidak ada enum atau registry kode portal |
| Domain terverifikasi | **PARTIAL** | `VerticalSiteDomain`: host, `vertical`, status, `verifiedAt`, `verifyToken` |
| Penyelesai host → konteks | **PARTIAL** | `PublicTenantResolver` memetakan host ke penyewa untuk satu vertikal, tanpa jalur cadangan |
| CMS multi-situs | **PARTIAL** | `CmsPage.websiteId` ada — mesinnya sudah multi-situs |
| Situs publik | **PARTIAL** | Situs publik eBisnis ada; situs koperasi per-host baru mendarat (#57, #60) |
| Cross-link antar portal | **MISSING** | Tidak ada `EcosystemTopBar` / `CrossPortalFooter` |
| Tema per brand | **MISSING** | Satu design system; belum ada token per brand |

## Yang sudah benar arahnya

`VerticalSiteDomain` menegakkan dua aturan yang §7.5 tuntut, dan komentarnya
menyebut alasannya:

- host disimpan **ternormalkan** (huruf kecil, tanpa porta, tanpa titik akar),
  dibaca dengan penormal yang sama;
- host tanpa bukti kepemilikan **tidak melayani apa pun** — tanpa itu siapa pun
  dapat mendaftarkan host milik orang lain dan menerima permintaan ke sana.

`PublicTenantResolver` juga menolak membedakan "host tidak terdaftar" dari "host
terdaftar tetapi penyewanya nonaktif", supaya penebak tidak memperoleh
keterangan.

Fondasi resolusi domainnya **sudah benar**. Yang kurang adalah lapisan *portal
brand* di atasnya: hari ini `vertical` adalah kolom teks bebas (`cooperative`,
`health`, `village`), bukan rujukan ke registry berversi.

## Selisih untuk ECO-1

1. Registry portal: `PlatformPortal`, `PlatformPortalDomain`, brand, tema,
   cross-link.
2. Menaikkan `VerticalSiteDomain.vertical` dari teks bebas menjadi rujukan
   registry — **aditif**, tanpa menyentuh migrasi yang sudah applied.
3. Komponen cross-link bersama: satu implementasi, lima konfigurasi. Bukan lima
   komponen (§1662).
