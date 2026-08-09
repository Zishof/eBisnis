# Handover lengkap MitraInap V14 — 10 Agustus 2026

Dokumen ini dibuat agar pekerjaan dapat dilanjutkan dari komputer lain tanpa bergantung pada riwayat percakapan Codex. Baca dokumen ini bersama `16-implementation-plan.md`, `19-requirement-ledger.csv`, `20-uat-persona-matrix.md`, `21-release-runbook.md`, dan `22-local-release-evidence.md`.

## 1. Status saat handover

- Repository: `https://github.com/Zishof/eBisnis.git`.
- Branch remote kandidat rilis: `feature/v14-mitrainap-hospitality-current`.
- Branch lokal komputer lama: `feature/v14-mitrainap-hospitality` yang tracking branch remote di atas.
- Commit kode dan bukti recheck sebelum handover: `26c35d726071d71c2b88dfe7ded631915940744b`.
- Worktree bersih sebelum file handover ini dibuat.
- MI-0 sampai MI-23 memiliki implementasi fungsional. MI-24 berstatus `LOCAL_GATE_PASS`, bukan izin otomatis untuk produksi.
- Belum ada deploy produksi, merge ke default branch, force-push, reset/drop database, edit migration applied, atau penimpaan `.env`.
- Git push melalui remote HTTPS berhasil. GitHub CLI tersedia tetapi belum login, sehingga draft pull request belum dibuat.

Commit terakhir yang penting:

| Commit | Isi |
|---|---|
| `62c93e2` | audit awal MitraInap, baseline, ledger, dan risk register |
| `83aa446`–`28788d5` | portal, CMS, property, inventory, guest, reservation, booking, rate, channel, dan provisioning MI-1..MI-11 |
| `2d925f3`–`dfba05a` | front office, housekeeping, maintenance, folio, night audit, dan POS MI-12..MI-17 |
| `6226f15`–`451b6e2` | MICE, guest service, long stay, guest/staff channel, ERP, reporting, AI, help, dan observability MI-18..MI-23 |
| `ca18cde` | security, performance, dan UAT otomatis |
| `bf33e89` | penyelesaian vertical slice go-live, H071, custom domain/TLS, CMS publik, UI, dan release gate |
| `26c35d7` | bukti recheck kandidat rilis dari checkout bersih |

## 2. Dokumen input pemilik

Dokumen input asli berada di komputer lama dan tidak semuanya disalin ke Git karena merupakan materi sumber/attachment:

- `PAKET_MASTER_MITRAINAP_V14_GABUNGAN.md`
- `PERINTAH_MASTER_CLAUDE_CODE_CODEX_EKSEKUSI_MITRAINAP_ID_HOSPITALITY_V14.md`
- `BRD_eBisnis_ID_Versi_14_MitraInap_Hospitality_Lengkap.md`
- `SPESIFIKASI_UI_UX_RESPONSIVE_MITRAINAP_V14.md`
- `STRUKTUR_MENU_ROLE_PERMISSION_MITRAINAP_V14.md`
- `README_PAKET_MITRAINAP_V14.md`
- `MANIFEST_SHA256_MITRAINAP_V14.txt`
- sepuluh mockup `ChatGPT Image Aug 9, 2026, 06_51_22 AM (1).png` sampai `(10).png`.

Lokasi lama: `C:\Users\Admin1\Downloads\PAKET_DOKUMEN_MITRAINAP_V14`. Bila perlu audit ulang byte-for-byte, salin paket tersebut secara terpisah dan cocokkan dengan manifest SHA-256. Jangan memasukkan credential atau `.env` ke Git.

Konteks sebelum MitraInap juga mencakup audit POS/Inventory 48 layar. Bukti dan petunjuknya sudah ada di `docs/pos-inventory-parity/`, terutama:

- `00-INDEX.md`
- `05-requirement-ledger-48.md`
- `06-checklist-kesiapan-deploy.md`
- `09-langkah-testing.md`
- `RANGKUMAN-PERINTAH-POS-INVENTORY.md`

Jangan menganggap handover MitraInap ini sebagai pengganti audit 48 layar. Jika pekerjaan kembali ke POS/Inventory, baca ledger tersebut dan periksa branch target sebelum mengubah source.

## 3. Implementasi yang sudah selesai

### MI-1 sampai MI-4 — portal, CMS, domain, produk

- Portal `mitrainap.id`, branding, host routing, registration, lead, demo, FAQ, bantuan, harga, blog, sitemap, dan robots.
- CMS tenant dengan draft/publish dan pembacaan publik yang diisolasi berdasarkan host aktif.
- Managed subdomain serta custom-domain lifecycle: pendaftaran, DNS TXT hash verification, revoke, TLS pending, dan aktivasi TLS fail-closed oleh permission platform.
- Produk/paket/entitlement, dependency, assignment, usage contract, provisioning role/menu/support, dan health check.

### MI-5 sampai MI-11 — property, inventory, CRM, booking, revenue, channel

- Legal entity, portfolio, brand, property, building, floor, zone, serta sellable `ROOM`, `UNIT`, `BED`, dan `SPACE`.
- Active property context, accessibility/status, stay-date inventory ledger, allotment, block, overbooking guard, reconciliation transactional, dan concurrency protection.
- Guest profile/consent/privacy/merge/restricted guest, relationship, companion, loyalty, dan business account.
- Quote snapshot, waitlist, walk-in, multi-room/guest reservation, group rooming, direct/manage booking, payment intent provider-neutral, idempotency, dan recovery.
- Rate/restriction/calendar, pickup/pace forecast, recommendation evidence, review, approval-before-publish.
- Channel mapping, ARI/reservation queue, `SKIP LOCKED` worker, delivery attempt, retry/DLQ, parity snapshot, dan reconciliation.

### MI-12 sampai MI-17 — operasi hotel

- Front-office arrival/departure/in-house, pre-arrival, room assignment, check-in/out idempoten, key contract, room move/rekey, late checkout, exception, handover, RBAC, dan UI.
- Housekeeping room board, task/checklist, mobile offline idempotency, DND/refused/discrepancy, inspection/rework, linen/laundry, minibar outbox, lost-and-found custody.
- Maintenance work order/SLA/mobile event, supplier/inventory link, preventive plan, OOO/OOS availability block, verified release.
- Folio immutable berbasis Decimal, routing/transfer, cashier shift, tokenized payment reference, invoice, city ledger.
- Night audit resumable/idempoten, exception queue, snapshot, step-up final roll, dan income review.
- POS property/outlet, room charge, meal entitlement, kitchen status, stock/accounting trace.

### MI-18 sampai MI-23 — enterprise dan insight

- Corporate/travel account, negotiated rate, group allotment/pickup, rooming list, function calendar, event/BEO.
- Guest request SLA, concierge/ancillary, consent-bound communication, feedback, reputation adapter.
- Long-stay/rental contract, move inspection, recurring rent/deposit, utility, collection, owner commission/statement.
- Guest portal session, staff offline queue, kiosk, privacy purge, digital-key/IoT provider-neutral contracts.
- Canonical versioned events, ERP ports/delivery, accounting trace, retry/reconciliation.
- Report snapshot/export, evidence-bound AI draft, help/demo, notification outbox, dan observability.

### Penyelesaian go-live pada `bf33e89`

- Platform migration `20260809000000_hospitality_custom_domain_lifecycle`.
- Tenant migration H071: `20260809T000000__hospitality__go_live_completion.sql`.
- API baru: `hospitality-domain.*` dan `hospitality-go-live.*` beserta test.
- UI baru: `HospitalityGoLivePage.tsx`, `MitrainapResourcesPage.tsx`, pembacaan CMS publik, serta route portal tambahan.
- Apache wildcard `*.mitrainap.id` dan include custom domain.
- `deploy/update.sh` fail-fast bila `DATABASE_URL`, `DIRECT_DATABASE_URL`, atau `DATABASE_ADMIN_URL` tidak memuat `schema=platform`; nilainya tidak dicetak.
- `verify-mitrainap-release.mjs` memeriksa migration additive dan bukti MI-2..MI-23.

## 4. Database dan migration

- Database lokal yang digunakan: PostgreSQL, database `ebisnis`, port default. Credential diberikan pemilik secara privat; jangan ditulis dalam handover tracked atau `.env` baru yang di-commit.
- Semua URL Prisma wajib menunjuk `schema=platform`, termasuk URL admin pada pipeline release.
- Platform memiliki 30 migration dan saat recheck melaporkan `No pending migrations to apply`.
- Hospitality memiliki 20 tenant migration; H071 sudah diterapkan dan idempoten pada 16 dari 16 schema tenant lokal.
- Dilarang mengedit migration yang sudah diterapkan. Perubahan lanjutan harus migration additive baru dengan ID baru dan manifest/checksum baru.
- Dilarang reset/drop database. Untuk rehearsal gunakan database isolasi baru.

Backup lokal komputer lama yang tidak ikut Git:

- Path: `C:\opt\Codex-Worspace\mitrainap-release-evidence\ebisnis-pre-go-live.dump`
- Ukuran: `81.839.134` byte.
- SHA-256: `4544C356EBD81EB5D4F7357B9BA7FB4BE346F34A4280B05A6E6D262BA99740CF`.
- Restore paralel tervalidasi di `ebisnis_mitrainap_restore_parallel_20260809`: 16 tenant, platform migration baru, H071 pada 16 schema.
- Restore serial parsial `ebisnis_mitrainap_restore_20260809` sengaja tidak dihapus sesuai kebijakan non-destruktif.

Jika dump dibutuhkan di komputer baru, salin sebagai artefak privat dan verifikasi hash. Jangan commit dump ke repository.

## 5. Hasil verifikasi terakhir

Recheck 10 Agustus 2026 dilakukan dari checkout bersih commit `bf33e89` menggunakan pnpm store terisolasi, kemudian bukti dicatat pada commit `26c35d7`:

- release verifier: lulus, 20 migration hospitality additive;
- API typecheck: lulus;
- API lint dan Web lint: lulus;
- API test: 186/186 suite, 4.176/4.176 test lulus;
- Web test serial: 45/45 file, 518/518 test lulus;
- API production build: lulus;
- Web production build/PWA: lulus; warning chunk `index` sekitar 1,96 MB tetap non-blocking;
- Prisma platform deploy: tidak ada migration tertunda;
- tenant migration: 16/16 schema sudah mutakhir;
- sintaks Bash `deploy/update.sh`: lulus;
- HTTP portal/solusi/harga/demo/blog/FAQ/bantuan/robots/sitemap sebelumnya mengembalikan 200.

Catatan lingkungan Windows: `node_modules` lama pada worktree komputer lama terdeteksi termodifikasi dan file native Argon2 terkunci. `pnpm install --force` in-place gagal dengan `EPERM`. Source dan lockfile tidak bermasalah; checkout bersih dengan store terisolasi lulus. Pada komputer baru selalu mulai dari clone bersih, jalankan install frozen, lalu Prisma generate sebelum test/build.

## 6. Cara mulai di komputer baru

Gunakan Node.js minimal 20.11, Corepack, pnpm sesuai `packageManager` (`9.15.4`), PostgreSQL yang kompatibel, Git, dan Git Bash/WSL untuk memeriksa script Bash.

```powershell
git clone --branch feature/v14-mitrainap-hospitality-current --single-branch https://github.com/Zishof/eBisnis.git eBisnis-mitrainap
Set-Location eBisnis-mitrainap
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm db:generate
git status -sb
node scripts/ci/verify-mitrainap-release.mjs
corepack pnpm lint
corepack pnpm --filter @ebisnis/api test -- --runInBand
corepack pnpm --filter @ebisnis/web exec vitest run --maxWorkers=1
corepack pnpm build
```

Sebelum database command, isi tiga environment variable secara privat dan pastikan semuanya memuat query `schema=platform`:

```text
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>?schema=platform
DIRECT_DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>?schema=platform
DATABASE_ADMIN_URL=postgresql://<user>:<password>@<host>:<port>/<database>?schema=platform
```

Untuk database lokal/rehearsal saja:

```powershell
corepack pnpm db:deploy
corepack pnpm migrate:tenants
```

Expected result: platform tidak memiliki pending migration dan 16 schema lama melaporkan `sudah mutakhir`. Jumlah schema pada lingkungan baru dapat berbeda; pastikan semuanya sukses dan jangan menghapus schema yang gagal.

## 7. Deployment server

Jangan menjalankan deployment hanya berdasarkan status lokal. Setelah seluruh gate eksternal lulus dan release manager memberi approval, gunakan commit eksplisit:

```bash
cd /opt/ebisnis/app
git fetch origin
git rev-parse origin/feature/v14-mitrainap-hospitality-current
sudo bash /opt/ebisnis/app/deploy/update.sh <full-commit-sha>
```

`update.sh` melakukan backup, migration integrity check, MitraInap release gate, lint/test, Prisma generate, build, platform+tenant migration, restart, health check, dan rollback aplikasi. Rollback tidak otomatis memulihkan database karena migration harus additive. Jangan memakai `SKIP_RELEASE_TESTS=1` kecuali ada approval dan bukti pengganti formal.

## 8. Gate yang masih menghalangi GO produksi

Kode adalah kandidat rilis, tetapi keputusan produksi masih **NO-GO** sampai semua hal ini memiliki bukti:

1. UAT manusia untuk seluruh persona pada `20-uat-persona-matrix.md`.
2. Visual regression, keyboard, screen-reader, dan perangkat desktop/mobile nyata. Browser webview Codex pada komputer lama gagal attach, sehingga sign-off visual tidak boleh diklaim.
3. Load/SLO untuk search, booking, check-in, folio, dan night audit.
4. Cross-tenant/property penetration test.
5. DNS apex/wildcard/custom domain dan TLS publik dengan auto-renew.
6. Contract version, credential reference, allowlist, sandbox proof, health test, dan owner untuk OTA/GDS/payment/digital-key/IoT/reputation provider.
7. Backup/restore server, synthetic booking, observability/alert delivery, rollback drill, dan soak.
8. PIC cutover, rollback commander, maintenance window, komunikasi pengguna, serta hypercare.

Provider tanpa credential tetap harus berada pada mode aman `BLOCKED_PROVIDER_INPUT`; jangan mengganti status menjadi sukses palsu.

## 9. Git dan aturan keselamatan

- Remote branch yang paling mutakhir adalah `feature/v14-mitrainap-hospitality-current`, bukan remote branch lama `feature/v14-mitrainap-hospitality`.
- Setelah clone, buat branch kerja baru dari branch kandidat jika akan mengembangkan fitur tambahan; jangan force-push branch kandidat.
- Jangan memakai `git reset --hard`, mengedit applied migration, drop/reset database, menimpa `.env`, atau commit secret/dump.
- GitHub CLI pada komputer lama belum authenticated. Di komputer baru jalankan `gh auth login` bila ingin membuat draft PR, lalu targetkan default branch yang sudah diverifikasi pemilik.
- Sebelum commit selalu jalankan `git status -sb`, `git diff --check`, test relevan, dan release verifier.

## 10. Urutan kerja lanjutan yang direkomendasikan

1. Clone branch remote kandidat dan ulang smoke gate dari checkout bersih.
2. Salin paket dokumen sumber secara privat, validasi manifest, dan simpan di luar Git.
3. Siapkan staging dengan `.env`, DNS/TLS, dan provider sandbox yang nyata.
4. Jalankan `update.sh` pada staging menggunakan full commit SHA.
5. Isi serta tanda tangani UAT persona, a11y/perangkat, performance, security, backup/restore, observability, dan rollback evidence.
6. Perbaiki hanya defect yang terbukti; gunakan migration additive baru bila schema berubah.
7. Setelah seluruh checklist hijau, mintakan keputusan GO dan jadwalkan production cutover/hypercare.

Handover ini tidak memberikan otorisasi deploy produksi; ia hanya mentransfer konteks teknis dan bukti yang sudah tersedia.
