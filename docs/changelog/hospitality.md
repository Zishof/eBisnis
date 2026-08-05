# Changelog — Hospitality (MitraInap.id)

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
