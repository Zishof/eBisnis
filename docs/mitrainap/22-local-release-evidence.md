# Bukti kandidat rilis lokal MitraInap V14

Tanggal verifikasi: 9 Agustus 2026 (Asia/Jakarta).

## Recheck kandidat rilis — 10 Agustus 2026

- Verifikasi diulang dari checkout bersih pada commit `bf33e89230c963d3b16975d0b65fd89a33b9165d` dengan pnpm store terisolasi.
- Bootstrap bersih memerlukan urutan `pnpm install --frozen-lockfile` lalu `pnpm db:generate`; urutan ini sudah diterapkan oleh `deploy/update.sh` sebelum build.
- API kembali lulus 186 suite/4.176 test dan production build.
- Web kembali lulus 45 file/518 test dan production build/PWA.
- API typecheck, API/Web lint, release verifier, dan sintaks Bash `deploy/update.sh` lulus.
- Platform migration melaporkan `No pending migrations to apply`; H071 kembali melaporkan `sudah mutakhir` pada 16 dari 16 schema tenant.
- Worktree sumber bersih dan commit lokal sama dengan branch remote kandidat rilis sebelum catatan recheck ini dibuat.
- Instalasi `node_modules` lama pada worktree pengembangan terdeteksi termodifikasi dan file native Argon2 terkunci Windows. Kondisi lokal tersebut diisolasi dari bukti rilis dengan checkout serta dependency store baru; source, lockfile, database sumber, dan migration tidak diubah untuk mengatasinya.

## Hasil otomatis

- API: 186 suite, 4.176 test lulus; lint, typecheck, dan production build lulus.
- Web: 45 file, 518 test lulus; lint dan production build/PWA lulus.
- Release verifier: 20 migration hospitality additive dan bukti MI-2 sampai MI-23 lulus.
- Platform migration `20260809000000_hospitality_custom_domain_lifecycle` terpasang.
- Tenant migration H071 terpasang dan idempoten pada 16 dari 16 schema lokal.
- Route HTTP portal, solusi, harga, demo, blog, FAQ, bantuan, `robots.txt`, dan `sitemap.xml` mengembalikan HTTP 200.

## Backup dan restore rehearsal

- Dump: `C:\opt\Codex-Worspace\mitrainap-release-evidence\ebisnis-pre-go-live.dump`
- Ukuran: 81.839.134 byte.
- SHA-256: `4544C356EBD81EB5D4F7357B9BA7FB4BE346F34A4280B05A6E6D262BA99740CF`.
- Restore paralel terisolasi: database `ebisnis_mitrainap_restore_parallel_20260809`.
- Verifikasi restore: 16 tenant registry, platform migration baru tersedia, dan H071 berstatus sukses pada 16 schema.
- Database restore serial parsial `ebisnis_mitrainap_restore_20260809` sengaja tidak dihapus karena kebijakan non-destruktif.

## Gate yang tidak dapat diklaim dari lokal

- Visual regression, keyboard/screen-reader, dan perangkat nyata belum mendapat sign-off karena browser webview lokal gagal attach; route HTTP dan test otomatis tetap lulus.
- Staging load/SLO, cross-tenant penetration test, provider OTA/GDS/payment/digital-key/IoT, DNS/TLS publik, backup/restore server, observability soak, dan UAT persona membutuhkan lingkungan/credential serta persetujuan pemilik.
- Karena itu artefak ini adalah kandidat rilis lokal. Keputusan GO produksi tetap fail-closed sampai seluruh checklist `21-release-runbook.md` ditandatangani.
