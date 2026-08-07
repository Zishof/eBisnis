# 00. Repository Baseline — POS/Inventory 48-Layar Parity

**Tanggal audit:** 2026-08-08
**Auditor:** Claude Code (sesi ini)
**Commit HEAD:** `6df6b850d93890975c54ccc3c51e19b0e8d5b0b4` (2026-08-06 19:48:03 +0700)

## Perbedaan lokasi workspace terhadap dokumen perintah

Dokumen perintah (`PERINTAH_MASTER_CODEX_CLAUDE_POS_INVENTORY_PARITAS_48_LAYAR.md`) mengasumsikan
workspace authoritative pada `C:\opt\eBisnisGithub\`. Path tersebut **tidak ada** pada mesin ini.
Repository nyata, terhubung ke `git@github.com:Zishof/eBisnis.git` origin, berada pada:

```text
C:\opt\eBisnis-Github\eBisnis
```

Seluruh audit dan perubahan pada dokumen ini memakai path nyata tersebut. `CONFLICTING` — perlu
konfirmasi apakah dokumen perlu diperbarui atau mesin target seharusnya memakai path lain.

## Identitas Git (POS-1.1)

```text
toplevel: C:/opt/eBisnis-Github/eBisnis
remote origin: https://github.com/Zishof/eBisnis.git (fetch+push)
branch: main
tracking: origin/main (up to date pada saat fetch terakhir sesi ini)
core.hooksPath: (tidak diset)
```

**Temuan:** `.githooks/pre-push` ada di repository tetapi `core.hooksPath` tidak diarahkan ke sana,
sehingga hook tersebut **tidak aktif** pada checkout ini. Dokumen perintah meminta menjalankan
`git config core.hooksPath .githooks` — **sengaja tidak dijalankan** pada audit ini karena mengubah
git config berada di luar wewenang otomatis sesi ini (aturan keselamatan operator). Human decision
diperlukan sebelum mengaktifkan hooksPath.

**Working tree TIDAK bersih** pada awal fase P0. Perubahan berikut adalah pekerjaan sesi
sebelumnya dalam percakapan yang sama (perbaikan stored XSS pesantren, sudah lulus lint/build/test
lengkap, belum di-commit atas permintaan eksplisit pengguna):

```text
 M apps/api/src/modules/cms/cms.module.ts
 M apps/api/src/modules/pesantren/pesantren-berita.service.ts
 M apps/api/src/modules/pesantren/pesantren-profil.service.ts
 M apps/web/src/verticals/pesantren/BeritaDetailPage.tsx
 M apps/web/src/verticals/pesantren/SitusPondokPage.tsx
 M package.json
 M pnpm-lock.yaml
?? apps/api/src/common/security/rich-text-sanitizer.spec.ts
?? apps/api/src/common/security/rich-text-sanitizer.ts
```

Tidak direset/checkout paksa sesuai larangan. Lihat `evidence/baseline/git-status.txt` dan
`evidence/baseline/git-log.txt` untuk snapshot lengkap.

**gh CLI:** terpasang (`gh version 2.97.0`) tetapi **tidak terautentikasi** (`gh auth status` gagal).
`gh repo view` tidak dapat dijalankan. BLOCKED — perlu `gh auth login` oleh pemilik akun bila audit
visibilitas repo GitHub diperlukan.

## Temuan paling signifikan: pekerjaan paritas 48 layar tampaknya SUDAH ADA

Sebelum audit lebih lanjut, `CHANGELOG.md` dan riwayat commit `main` menunjukkan bahwa inisiatif
yang persis sama dengan permintaan ini — "Inventory / Sales 48 Screen Parity" — **sudah dieksekusi
dalam 6 gelombang pada 2026-08-06** (dua hari sebelum tanggal audit ini), pada branch
`codex/inventory-sales-ui-parity-48` yang sudah di-merge ke `main` (PR #104 dan seterusnya):

```text
Wave 0-1: layar 01-07 (master supplier/customer/sales) — Web + Flutter Windows/Android
Wave 2:   layar 08-19 (stok/opname/harga)
Wave 3:   layar 20-29 (pembelian/hutang)
Wave 4:   layar 30-42 (penjualan/piutang/nota sales)
Wave 5:   layar 43-48 (kas/jurnal/laba-rugi) — "Menaikkan seluruh 48 layar legacy menjadi
          operasional pada React Web dan Flutter."
```

Source `apps/api/src/modules/tenant/sales-inventory-parity.catalog.ts` (kode produksi, bukan
dokumentasi) berisi tabel 48 baris yang **secara eksplisit mengklaim status `OPERATIONAL` untuk
Web dan Flutter pada seluruh 48 layar**, dengan komentar sumber sendiri: *"Status hanya boleh
dinaikkan bila permukaan tersebut memiliki alur nyata; daftar/teks fitur saja bukan bukti."*

Test pendamping (`sales-inventory-parity.catalog.spec.ts`,
`sales-inventory-command-parity.spec.ts`) hanya memverifikasi:
- kelengkapan struktural 48 baris berurutan dengan API path dan web route non-kosong;
- keberadaan tabel `inventory_period_close_run`, `inventory_sync_event`,
  `inventory_mobile_command` (dengan unique index dedup `ux_inventory_mobile_command_event` —
  indikasi kuat mekanisme idempotency sudah ada) pada migration `V048`;
- sebagian SQL laporan laba-rugi/laba-kotor mengacu jurnal `POSTED` dan `normal_balance`.

Test tersebut **tidak** memverifikasi acceptance penuh POS-14 (permission end-to-end, offline
retry/quarantine nyata, hardware/print evidence, build Windows/Android aktual, UAT lama-vs-baru,
reconciliation DBF). Artinya klaim `OPERATIONAL` pada catalog adalah **STRONG_INFERENCE**, bukan
`DONE` menurut kriteria dokumen perintah — perlu diverifikasi, bukan diterima begitu saja, dan
juga tidak boleh diabaikan sebagai starting point.

**Kesimpulan reframing tugas:** Ini kemungkinan besar bukan proyek "bangun 48 layar dari nol",
melainkan **audit + pengerasan (hardening) + penutupan gap nyata** atas implementasi yang sudah
ada dan sudah dirilis (tag `pos-v0.1.15`, `inventory-v0.1.14`, dst.). Rencana kerja P1-P6 pada
dokumen perintah perlu disesuaikan: prioritas pertama adalah memverifikasi klaim yang sudah ada,
bukan mengimplementasikan ulang.

## Environment/toolchain (POS-1.2)

| Tool | Versi | Status |
|---|---|---|
| Node.js | v20.12.0 | OK |
| pnpm | 9.15.4 (via `corepack pnpm`, bukan `pnpm` langsung di PATH shell ini) | OK |
| git | 2.44.0.windows.1 | OK |
| gh | 2.97.0 | Terpasang, **tidak terautentikasi** |
| flutter | — | **TIDAK TERPASANG** pada mesin ini (`flutter: command not found`) |
| dart | — | **TIDAK TERPASANG** (bundel dengan Flutter SDK) |
| psql | — | **TIDAK TERPASANG**, tidak ada PostgreSQL lokal berjalan |
| docker | — | **TIDAK TERPASANG** |

Lihat `evidence/baseline/flutter-version.txt`, `evidence/baseline/psql-version.txt`.

### Dampak terhadap cakupan audit P0

| Langkah dokumen perintah | Status pada sesi ini |
|---|---|
| POS-1.1 Git identity | **DONE** (di atas) |
| POS-1.2 Package/env | **DONE** (tabel di atas) |
| POS-1.3 `pnpm install/db:generate/lint/test/build` | **DONE** — lulus (lihat bagian di bawah) |
| POS-1.3 `pnpm db:validate` | **DONE** — `prisma validate` lulus (perlu `DATABASE_URL` dummy in-process untuk lolos config loader; tidak menyentuh `.env`) |
| POS-1.3 `seed:verify`, `smoke-test.mjs`, `test:e2e` (butuh DB/API live) | **BLOCKED** — tidak ada PostgreSQL lokal, tidak ada Docker untuk menjalankannya |
| POS-1.4 Flutter (`pub get/analyze/test/build windows/build apk`) | **BLOCKED** — Flutter SDK tidak terpasang di mesin ini |
| POS-1.6 Live DB introspection (`pg_tables`, `pg_indexes`, dst.) | **BLOCKED** — tidak ada instance PostgreSQL untuk connect; digantikan audit statis skema Prisma + migration SQL (lihat `01-source-inventory.md`) |
| POS-1.5 Source inventory & placeholder/risk register | **DONE (source-only)** — lihat `01-source-inventory.md`, `03-placeholder-and-risk-register.md` |

## Baseline build/lint/test (POS-1.3, bagian yang bisa dijalankan)

Dijalankan pada sesi ini (lihat riwayat sebelumnya pada percakapan untuk log lengkap):

```text
pnpm install (reinstall penuh, non-frozen — diperlukan untuk memperbaiki override sanitize-html/htmlparser2)
apps/api: pnpm db:generate    -> OK (Prisma Client v6.19.3 dari prisma/platform)
apps/api: pnpm db:validate    -> OK ("The schemas at prisma\platform are valid")
apps/api: pnpm lint           -> OK, 0 error/warning
apps/api: pnpm build          -> OK (nest build, tanpa error setelah db:generate benar)
apps/api: pnpm test           -> 151 suite, 3975/3975 test PASS
apps/web: pnpm lint           -> GAGAL, 3 warning react-hooks/exhaustive-deps (pre-existing,
                                  bukan regresi sesi ini; lihat riwayat sesi sebelumnya)
apps/web: pnpm test           -> 43 file, 504/504 test PASS
apps/web: pnpm build          -> belum dijalankan ulang pada sesi P0 ini (terverifikasi lulus pada
                                  audit sebelumnya di percakapan yang sama)
```

Catatan penting yang ditemukan dan diperbaiki selama baseline run (bukan bagian dari 48-layar,
tetapi memblokir seluruh test suite bila tidak diperbaiki): `sanitize-html@2.17.6` menarik
`htmlparser2@12.0.0` yang murni ESM (`"type": "module"`, tanpa kondisi `require`), menyebabkan
`require('sanitize-html')` gagal dengan `ERR_REQUIRE_ESM` di runtime CommonJS NestJS — bug nyata
di production, bukan hanya masalah test. Diperbaiki via `pnpm.overrides` di `package.json` root
(`"sanitize-html>htmlparser2": "10.1.0"`), sudah diuji lulus.

## CI/CD (POS-1.5, ditambahkan setelah baseline awal)

`.github/workflows/` berisi pipeline yang jauh lebih matang daripada yang bisa diverifikasi di
mesin audit ini secara lokal — penting dicatat karena ini mengubah penilaian risiko untuk
perubahan yang sudah di-commit pada sesi ini:

| Workflow | Trigger | Yang dilakukan |
|---|---|---|
| `ci.yml` | push/PR ke `main` | `pnpm install/db:validate/db:generate/lint/test/build`, PLUS memeriksa `packages/pos-rules-vectors/vectors.json` (vektor konformansi uang) tidak tertinggal dari `apps/web/src/pos-offline/`. Job **`flutter` terpisah, berjalan pada SETIAP PR tanpa penyaring jalur**: `flutter pub get/analyze/test` — termasuk `konformansi_test.dart` yang menuntut Dart menghasilkan angka SAMA PERSIS dengan TypeScript dari vektor bersama. |
| `e2e.yml` | push/PR ke `main` | Menjalankan PostgreSQL 13 sungguhan (`services: postgres`, sengaja versi produksi bukan versi dev 17, supaya SQL yang hanya jalan di versi baru tertangkap di CI) dan uji E2E peramban sungguhan. |
| `migration-check.yml` | PR/push yang menyentuh `tenant-migrations/**` atau `prisma/**` | Memvalidasi schema Prisma, penamaan migration, migration lama tidak diubah (immutability terhadap base branch pada PR), tidak ada SQL destruktif, dan tidak ada workflow yang menjalankan migration sungguhan terhadap database manapun. |
| `rilis-pos.yml` | tag `pos-v*` | Build+test Flutter dulu (`needs: uji`), lalu build installer Windows (Inno Setup, 3 varian: inventory-sales, POS Apotik, Inventory) dan APK Android (3 flavor, ditandatangani hanya bila secret keystore ada — APK berkunci debug SENGAJA tidak pernah dilampirkan ke rilis, karena Android mengunci kunci penandatanganan secara permanen dan mengganti kunci berarti mencopot aplikasi, yang menghapus buku transaksi luring yang belum terkirim). |
| `security.yml` | belum dibaca detail pada pass ini | — |

**Implikasi penting untuk perubahan yang sudah di-commit sesi ini:** commit perbaikan offline
checkout Flutter (`kasir_luring.dart`, `pos_api.dart`, `main.dart` — ditandai TIDAK TERVERIFIKASI
karena tidak ada Flutter SDK lokal) dan migration `V052` **akan benar-benar diperiksa otomatis
oleh CI** begitu di-push/dibuka sebagai PR — `flutter analyze`/`flutter test` sungguhan untuk kode
Dart, dan `migration-check.yml` untuk migration. Ini tidak menggantikan verifikasi manual, tapi
berarti kegagalan kompilasi/analisis akan tertangkap otomatis pada PR, bukan baru diketahui saat
build rilis.

## Rekomendasi langkah berikutnya (perlu keputusan manusia)

1. Konfirmasi path workspace: apakah `C:\opt\eBisnisGithub\` perlu dibuat sebagai symlink/copy,
   atau dokumen perintah cukup dianggap merujuk `C:\opt\eBisnis-Github\eBisnis`.
2. Sediakan PostgreSQL lokal (atau kredensial ke instance staging) dan Flutter SDK pada mesin ini
   agar POS-1.3 (DB-dependent), POS-1.4, dan POS-1.6 (live) dapat benar-benar dijalankan — tanpa
   ini, verifikasi `DONE` sejati untuk 48 layar (build Windows/Android, smoke test, e2e,
   reconciliation) tidak mungkin dilakukan dari sesi ini.
3. `gh auth login` bila audit visibilitas/metadata GitHub repository diperlukan.
4. Konfirmasi apakah XSS fix pesantren (working tree kotor saat ini) boleh di-commit sebagai
   checkpoint terpisah sebelum melanjutkan gelombang kerja POS/Inventory, agar working tree bersih
   per POS-4 aturan Git.
