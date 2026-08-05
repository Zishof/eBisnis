# Changelog — Hospitality (MitraInap.id)

## 2026-08-06 — MI-1: Portal registry, brand, dan routing publik

- **Koreksi temuan MI-0**: Portal Registry NYATA sudah ada di kodebase
  (`PlatformPortal`/`PlatformPortalDomain`/`PlatformPortalCrossLink`,
  `KATALOG_PORTAL`) -- audit MI-0 salah menyimpulkan tidak ada, akibat pola
  grep yang tidak menangkap `PlatformPortal`. Lihat koreksi lengkap di
  `docs/mitrainap/16-implementation-plan.md`.
- `MITRAINAP` ditambahkan ke `KATALOG_PORTAL`
  (`apps/api/src/infrastructure/portal/portal.catalog.ts`): kode vertikal
  `HOSPITALITY`, host `mitrainap.id`/`www.mitrainap.id` (PUBLIC),
  `app.mitrainap.id` (APP). `demo.mitrainap.id` SENGAJA belum didaftarkan --
  menunggu fase demo/sample data yang sebenarnya (lihat komentar di
  `portal.catalog.ts`).
- SEO/OG metadata (`GET /public/link-preview`) menambahkan brand MitraInap.
- Sisi web: `apps/web/src/verticals/hospitality/` (`mitrainap-host.ts`,
  `MitrainapLayout.tsx`, `MitrainapHomePage.tsx`), dirutekan di `App.tsx`
  pada `/mitrainap`, mengikuti pola `santri-host.ts`/`SantriLayout.tsx`
  persis. `LoginPage` ditambah cabang merek MitraInap (unified login, portal
  chrome tetap MitraInap saat menekan "Masuk").
- **Bug pre-existing ditemukan dan diperbaiki**: `GET /public/portals`
  menaut setiap portal ke DIRINYA SENDIRI (relasi `linksTo`/`linksFrom`
  tertukar) -- memengaruhi seluruh portal (eBisnis.id, santri.info,
  eMedik.id, dst), ditemukan lewat pengujian API sungguhan saat memverifikasi
  footer MitraInap.
- Diverifikasi nyata: `pnpm test` (150 suite API/3963 test, 42 berkas
  web/510 test) LULUS penuh; `tsc --noEmit` api+web LULUS; `pnpm lint`
  bersih dari perubahan ini (satu warning pre-existing eschool tetap ada,
  di luar cakupan); `GET /public/portals` diverifikasi lewat curl lokal
  (portal MITRAINAP dan tautan silang 6 arah benar); halaman
  `/mitrainap` diverifikasi lewat peramban sungguhan (Vite dev + API lokal
  pada DB pengembangan lokal).
- Belum diverifikasi lewat peramban: cabang host-gated (`isMitrainapPortalHost`)
  pada `AkarMenurutHost`/`LoginPage`, sebab `localhost` bukan `mitrainap.id`
  -- diverifikasi lewat 10 uji unit di `mitrainap-host.test.ts` sebagai
  gantinya (keterbatasan yang sama berlaku untuk verifikasi santri.info).

## 2026-08-06 — MI-0: Audit dan baseline

- Worktree `C:\opt\eBisnisGithub-mitrainap` dibuat dari `origin/main`
  (`1ebc4a8`), branch `feature/v14-mitrainap-hospitality`.
- Paket dokumen MitraInap V14 (BRD, struktur menu/role/permission,
  spesifikasi UI/UX, perintah master) disalin ke `docs/mitrainap/`,
  integritas SHA-256 diverifikasi 6/6 cocok dengan manifest.
- Baseline dijalankan sungguhan: `pnpm install`, `db:validate`,
  `db:generate`, `tsc --noEmit` (api+web), `pnpm lint`, `pnpm test` --
  hasil lengkap di `docs/mitrainap/01-current-state.md`. Semua LULUS
  kecuali `pnpm lint` (1 warning pre-existing di vertikal `eschool`,
  di luar cakupan hospitality, dicatat bukan diperbaiki di sini).
- Capability sweep: dikonfirmasi TIDAK ADA kode hospitality/PMS apa pun
  di codebase saat ini (`docs/mitrainap/03-hospitality-capability-inventory.md`).
- Temuan: domain registry (`VerticalSiteDomain`) sudah mendukung banyak
  host per tenant per vertikal (constraint unik lama sudah dilonggarkan),
  tidak perlu migrasi skema baru untuk subdomain per properti nantinya.
- 5 dari 19 dokumen audit + ledger awal selesai; 14 dokumen sisanya
  sengaja ditunda ke fase yang membutuhkannya (lihat
  `docs/mitrainap/16-implementation-plan.md` untuk status jujur per
  dokumen dan alasannya).

Belum ada satu baris kode modul `hospitality` pun ditulis pada titik
ini -- sesuai larangan "jangan coding besar sebelum MI-0 selesai,
di-commit, dan dipush".
