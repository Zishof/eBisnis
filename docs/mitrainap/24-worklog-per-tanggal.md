# Worklog pekerjaan eBisnis POS/Inventory dan MitraInap

Dokumen ini merangkum pekerjaan berdasarkan tanggal commit Git. Tujuannya agar pengembang atau sesi Codex berikutnya dapat memahami urutan perubahan tanpa membaca seluruh percakapan. Status acceptance tetap mengacu pada requirement ledger dan bukti test, bukan hanya pesan commit.

## 6 Agustus 2026 — fondasi MitraInap MI-1 sampai MI-10

Pekerjaan hari ini membangun vertical hospitality dari portal sampai booking dan revenue awal:

- `83aa446` — registrasi portal, host, dan branding MitraInap.
- `9634b61` — portal publik berbasis CMS.
- `f8253ab` — fondasi property dan operational context.
- `a3951d7` — penyelarasan brand dengan mockup UI MitraInap.
- `efcf9f5` — inventory kamar dan availability.
- `5387115` — guest CRM, identity, consent, dan privacy control.
- `9e17052` — reservation/PMS/CRS lifecycle.
- `c92ef06` — direct booking engine.
- `bcd037a` — rate plan, calendar, dan revenue management.
- `456524f` — Apache `ServerAlias` untuk mengarahkan trafik `mitrainap.id` ke aplikasi.
- `ee3dd82` — provisioning subdomain MI-3.

Outcome: portal dan alur utama property → inventory → guest → reservation → direct booking terbentuk, tetapi enterprise operations dan release gate belum selesai pada tanggal ini.

## 8 Agustus 2026 — audit dan penguatan POS/Inventory 48 layar

Pekerjaan berfokus pada paritas legacy POS/Inventory, aturan bisnis, audit, dan offline Flutter:

- `531ab92` — baseline audit P0 POS/Inventory.
- `34172f2` — checkout Flutter memperoleh jalur offline yang idempoten.
- `9027098` — perbaikan stuck approval dan void-reject pada sale line.
- `b2ed82c` — permission `DISCOUNT_LINE` diwajibkan untuk diskon manual.
- `c4fb058` — dokumentasi kemampuan CI/CD.
- `19a1dac` — goods receipt tervalidasi dihubungkan ke AP, price history, dan accounting event.
- `7786a9d` — sales order dihubungkan ke invoice/AR, price history, dan accounting event.
- `09a919d` — pencatatan bukti layar 01–19 terhadap self-test operasional.
- `a443273` — masking server-side data bank supplier/customer.
- `6987509` — pencegahan self-approval price book.
- `562b666` — enforcement stock-opname freeze dan perbaikan sumber laporan cetak.
- `8093d9b` — offline checkout tetap bekerja saat `path_provider` gagal.

Outcome: gap kritis RBAC, accounting bridge, stock freeze, pricing approval, PII masking, dan ketahanan offline ditutup. Status tiap layar tidak boleh disimpulkan dari worklog ini; gunakan `docs/pos-inventory-parity/05-requirement-ledger-48.md` dan direktori evidence.

## 9 Agustus 2026 — penyelesaian POS parity dan MitraInap MI-0 sampai MI-24 lokal

### POS/Inventory

- `8cb9320` — self-test tidak lagi mengunci klaim 48/48 hanya berdasarkan status `OPERATIONAL`.
- `4ac7baa` — accounting event diposting otomatis ke journal entry.
- `0129d89` — seed permission `SALES_ORDER.INVOICE` dan bukti Finance 45–48.
- `357ae6d` — bukti Sales/AR layar 30 dan 34 serta Purchase/AP layar 24.
- `1fd497a` — stock sufficiency check saat invoice dan penambahan audit trigger yang tertinggal.
- `457db40` — bukti tambahan untuk kelompok Master, Stock/Harga, Purchase/AP, Sales/AR.
- `6dc3836` — requirement ledger diarahkan ke hasil UAT `PARITY_EVIDENCE` terbaru.

### Audit dan security MitraInap

- `62c93e2` — audit baseline, source availability, route/model gap, requirement ledger, risk register, dan rencana implementasi.
- `9da1000` — pengamanan tenant resolution pada public booking.
- `9f7c511` — channel distribution contract dan reconciliation.
- `28788d5` — product entitlement dan provisioning MI-4.

### MitraInap MI-12 sampai MI-23

- `2d925f3` — front office dan guest stay operations.
- `2b2406e` — housekeeping, room operations, dan mobile tasks.
- `6cfee5d` — engineering/maintenance dan room downtime.
- `d92b683` — folio, cashiering, dan payment lifecycle.
- `745f0ea` — night audit idempoten.
- `dfba05a` — POS hotel, outlet, dan room charge.
- `6226f15` — corporate/group/MICE/event operations.
- `948e249` — guest service journey dan ancillary operations.
- `cb19489` — long-stay/rental dan owner management.
- `a422489` — guest/staff self-service channel, offline queue, kiosk, dan provider ports.
- `16a31f9` — canonical ERP event, delivery, retry, dan reconciliation.
- `451b6e2` — report/export, evidence-bound AI, help, demo, dan observability.

### Release readiness lokal

- `ca18cde` — security/performance/end-to-end UAT otomatis.
- `bf33e89` — penyelesaian go-live vertical slice:
  - platform migration custom-domain/TLS;
  - tenant migration H071;
  - CMS publik dan host-scoped publication;
  - property/sellable space, stay-date ledger, loyalty, quote/waitlist;
  - payment intent/recovery provider-neutral;
  - forecast/recommendation review/publish;
  - channel worker dan delivery evidence;
  - UI resources dan dashboard go-live;
  - Apache wildcard/custom domain include;
  - penguatan `deploy/update.sh` dan release verifier.

Verifikasi 9 Agustus:

- API 186 suite/4.176 test lulus.
- Web 45 file/518 test lulus.
- API/Web build, lint, typecheck, release verifier, dan sintaks Bash lulus.
- Platform migration terpasang.
- H071 terpasang dan idempoten pada 16 schema tenant.
- Backup lokal dibuat dan restore paralel terisolasi divalidasi.

## 10 Agustus 2026 — clean-room recheck dan handover

- Dependency worktree lama ditemukan termodifikasi; `pnpm install --force` terhalang file native Argon2 yang dikunci Windows.
- Source tidak diubah untuk mengakali masalah tersebut. Verifikasi dipindahkan ke checkout bersih dengan pnpm store terisolasi.
- Pada checkout bersih, urutan bootstrap yang benar dikonfirmasi: install frozen → Prisma generate → test/build.
- API kembali lulus 186 suite/4.176 test.
- Web kembali lulus 45 file/518 test.
- API/Web production build, lint, typecheck, release verifier, platform migration, dan 16-schema tenant migration kembali lulus.
- `26c35d7` — hasil recheck dicatat pada `22-local-release-evidence.md`.
- `1fe9535` — handover lengkap lintas komputer dibuat pada `23-session-handover-2026-08-10.md`.
- `17d9432` — eksekusi HTTP persona nyata menemukan dan memperbaiki bug query yang tidak terlihat pada unit test:
  - nama kolom room/room type yang salah pada board Front Desk, Housekeeping, dan Maintenance;
  - parameter PostgreSQL tanpa cast konsisten pada berbagai state transition;
  - ambiguous column saat room move;
  - `approved_at` yang hilang saat OOO/OOS close-room;
  - pola serupa pada channel delivery, guest service, MICE/BEO, ERP, dan POS kitchen.
- Bukti eksekusi persona nyata dicatat pada `24-uat-persona-execution-2026-08-10.md`. Pada titik ini gap Guest/Kiosk public auth dan owner-contract endpoint sengaja dicatat, bukan ditambal secara tidak aman.

## 11 Agustus 2026 — handover bertanggal dan worklog

- `51868f5` — Guest Portal/Kiosk diperbaiki memakai host-scoped `PublicTenantResolver`; cross-tenant token isolation, kiosk property tampering guard, dan alur tanpa JWT staf dibuktikan melalui HTTP nyata.
- `94c49cb` — endpoint owner contract ditambahkan sehingga owner statement dapat dibuat end-to-end; unique guard periode statement dan kontrak pemilik dibuktikan pada database nyata.
- Menyusun worklog ini berdasarkan tanggal dan timestamp commit Git.
- Menyusun handover current-state 11 Agustus agar sesi baru mengetahui branch remote, commit awal, dokumen wajib baca, hasil validasi, dan gate produksi.
- Tidak melakukan deploy produksi atau perubahan database pada tahap dokumentasi handover.

## Ringkasan status akhir

- MI-0..MI-23: implementasi fungsional tersedia.
- MI-24: `LOCAL_GATE_PASS`.
- POS/Inventory: audit, perbaikan kritis, dan evidence paritas tersedia di `docs/pos-inventory-parity/`; lanjutkan dari ledger, bukan dari klaim pesan commit.
- Produksi: tetap fail-closed sampai UAT manusia/perangkat, a11y, load/SLO, penetration test, DNS/TLS, provider live, backup/restore server, observability/rollback drill, dan approval cutover selesai.
