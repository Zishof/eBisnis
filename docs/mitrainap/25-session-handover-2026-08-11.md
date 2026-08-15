# Handover current state — 11 Agustus 2026

Dokumen ini adalah titik masuk terbaru untuk melanjutkan pekerjaan dari komputer atau sesi lain. Handover teknis lengkap ada pada `23-session-handover-2026-08-10.md`; kronologi per tanggal ada pada `24-worklog-per-tanggal.md`.

## Repository yang harus digunakan

- Remote: `https://github.com/Zishof/eBisnis.git`
- Branch kandidat terbaru: `feature/v14-mitrainap-hospitality-current`
- Commit kode/UAT remote sebelum dokumen 11 Agustus dibuat: `94c49cb`.
- Jangan memulai dari remote branch lama `feature/v14-mitrainap-hospitality` karena branch tersebut tertinggal.

```powershell
git clone --branch feature/v14-mitrainap-hospitality-current --single-branch https://github.com/Zishof/eBisnis.git eBisnis-mitrainap
Set-Location eBisnis-mitrainap
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm db:generate
git status -sb
```

## Dokumen wajib dibaca berurutan

1. `docs/mitrainap/25-session-handover-2026-08-11.md` — current state.
2. `docs/mitrainap/24-worklog-per-tanggal.md` — pekerjaan berdasarkan tanggal.
3. `docs/mitrainap/24-uat-persona-execution-2026-08-10.md` — hasil HTTP persona nyata, bug yang ditemukan, dan verifikasi perbaikannya.
4. `docs/mitrainap/23-session-handover-2026-08-10.md` — detail teknis lengkap, database, deployment, dan risiko.
5. `docs/mitrainap/16-implementation-plan.md` — status MI-0..MI-24.
6. `docs/mitrainap/19-requirement-ledger.csv` — traceability requirement.
7. `docs/mitrainap/20-uat-persona-matrix.md` — UAT yang harus ditandatangani manusia.
8. `docs/mitrainap/21-release-runbook.md` — prosedur go/no-go dan rollback.
9. `docs/mitrainap/22-local-release-evidence.md` — bukti test/build/migration/backup lokal.

Untuk pekerjaan POS/Inventory 48 layar, mulai dari `docs/pos-inventory-parity/00-INDEX.md` dan `05-requirement-ledger-48.md`.

## Status teknis

- MI-0..MI-23 mempunyai implementasi fungsional.
- MI-24 berstatus `LOCAL_GATE_PASS`, bukan production GO.
- API terakhir: 186/186 suite dan 4.176/4.176 test lulus.
- Web terakhir: 45/45 file dan 518/518 test lulus.
- API/Web lint, typecheck, production build/PWA, release verifier, dan Bash syntax lulus.
- Platform: tidak ada pending migration saat recheck.
- Hospitality: 20 migration; H071 idempoten pada 16/16 schema lokal.
- HTTP persona nyata menemukan dan memperbaiki bug query/state transition pada Front Desk, Housekeeping, Maintenance, Guest Service, MICE, ERP, Channel, dan POS Kitchen.
- Guest Portal/Kiosk sekarang memakai resolusi tenant berdasarkan host dan telah dibuktikan menolak token lintas tenant serta mengabaikan `propertyId` palsu dari body publik.
- Owner contract create/list tersedia; owner statement telah dibuktikan end-to-end dengan unique constraint periode dan kontrak.
- Commit dan push terakhir sebelum handover ini bersih.
- Belum ada production deploy atau merge default branch.

## Perintah smoke gate setelah clone

```powershell
node scripts/ci/verify-mitrainap-release.mjs
corepack pnpm lint
corepack pnpm --filter @ebisnis/api test -- --runInBand
corepack pnpm --filter @ebisnis/web exec vitest run --maxWorkers=1
corepack pnpm build
```

Untuk database lokal/staging, tiga URL Prisma harus diberikan secara privat dan semuanya wajib memuat `schema=platform`. Jangan commit `.env` atau credential. Setelah backup dan hanya pada lingkungan yang disetujui:

```powershell
corepack pnpm db:deploy
corepack pnpm migrate:tenants
```

## Artefak yang tidak tersedia melalui Git

- Paket dokumen/BRD/UI MitraInap V14 dan sepuluh mockup asli berada pada komputer lama; salin privat dan cocokkan manifest SHA-256 bila audit ulang diperlukan.
- Dump database rehearsal berada pada komputer lama di `C:\opt\Codex-Worspace\mitrainap-release-evidence\ebisnis-pre-go-live.dump` dengan SHA-256 `4544C356EBD81EB5D4F7357B9BA7FB4BE346F34A4280B05A6E6D262BA99740CF`.
- Jangan commit paket attachment, dump, credential, atau `.env`.

## Pekerjaan berikutnya

1. Ulang smoke gate dari clone bersih.
2. Deploy commit eksplisit ke staging melalui `deploy/update.sh`.
3. Selesaikan UAT persona, visual/a11y/perangkat nyata, load/SLO, cross-tenant security, DNS/TLS, dan provider sandbox.
4. Lakukan backup/restore server, health/synthetic, alert delivery, rollback drill, dan observability soak.
5. Hanya setelah seluruh bukti ditandatangani, minta approval production cutover.

## Larangan tetap

- Jangan force-push.
- Jangan reset/drop database.
- Jangan mengedit migration yang sudah applied.
- Jangan menimpa `.env`.
- Jangan mengaktifkan provider tanpa credential/contract/health proof.
- Jangan menyatakan GO produksi hanya berdasarkan `LOCAL_GATE_PASS`.

GitHub CLI pada komputer lama belum login, sehingga draft PR belum dibuat. Git push ke branch kandidat berhasil melalui remote HTTPS. Di komputer baru jalankan `gh auth login` bila draft PR dibutuhkan.
