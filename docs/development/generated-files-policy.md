# Kebijakan Berkas Hasil Generate

Menentukan berkas hasil generate mana yang masuk repository dan mana yang tidak.

## Prinsip

Berkas hasil generate di-commit hanya bila **konsumennya membutuhkan berkas itu
tanpa menjalankan generator**. Selain itu, jangan di-commit.

## Di-commit

| Berkas | Alasan |
| --- | --- |
| `docs/database/*.md` | kamus data, ERD, katalog index — dibaca manusia dan direview pada PR; perubahannya menunjukkan dampak migration |
| `docs/api/openapi.json` (rencana) | snapshot kontrak API; diff-nya membuat perubahan kontrak terlihat pada review |
| `apps/api/tenant-migrations/manifest.json` | katalog migration tenant beserta checksum; runtime membacanya |
| `pnpm-lock.yaml` | wajib untuk `--frozen-lockfile` dan build yang dapat direproduksi |
| Manifest rilis (rencana) | dipakai `ebisnisctl update` |

## Tidak di-commit

| Berkas | Alasan |
| --- | --- |
| `node_modules/` | dipulihkan `pnpm install` |
| `apps/*/dist/` | hasil build; artefak rilis dibuat CI |
| `apps/web/src/api/generated/` | client Orval, dihasilkan dari OpenAPI |
| Prisma Client | dihasilkan ke `node_modules` oleh `pnpm db:generate` |
| `coverage/`, `playwright-report/`, `test-results/` | artefak test lokal |
| `*.tsbuildinfo` | cache inkremental TypeScript |

## Client Orval

`apps/web/src/api/generated/` **tidak** di-commit. Alasannya: berkas itu
sepenuhnya turunan dari `docs/api/openapi.json`, dan bila keduanya di-commit,
keduanya dapat menyimpang tanpa terdeteksi.

Yang di-commit adalah snapshot OpenAPI-nya. Generate ulang:

```bash
pnpm build
pnpm dev:api
pnpm api:generate
```

Client hasil generate **tidak boleh diedit manual**. Bila hasilnya salah,
perbaiki dekorator pada controller NestJS, bukan berkas keluarannya.

Catatan kondisi saat ini: client Orval belum pernah digenerate
(`apps/web/src/api/generated/` belum ada) dan frontend masih memakai tipe manual.
Menyelesaikannya termasuk prasyarat V6-0.x pada
`docs/upgrade-v6/08-upgrade-plan.md`.

## Dokumentasi database

`pnpm docs:generate` mengintrospeksi database yang berjalan lalu menulis ulang
`docs/database/**`. Karena itu, jalankan hanya setelah migration diterapkan, dan
tinjau diff-nya: perubahan tak terduga pada kamus data adalah sinyal migration
melakukan sesuatu yang tidak diniatkan.

## Aturan pada quality gate

Sebelum commit, pastikan tidak ada berkas hasil generate yang wajib tetapi belum
di-commit. Bila migration mengubah struktur database, `docs/database/**` harus
ikut diperbarui pada commit yang sama.
