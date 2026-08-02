# EP-0.18 — Peta Berkas Rawan Konflik

Berkas yang disentuh banyak vertikal sekaligus.

| Berkas | Mengapa rawan | Cara aman |
| --- | --- | --- |
| `apps/web/src/app/App.tsx` | Setiap vertikal menambah rute | Kumpulkan rute vertikal di `routes.tsx` miliknya, sisakan satu impor dan satu baris — pola koperasi |
| `apps/api/src/app.module.ts` | Setiap modul mendaftar | Tambah di ujung, jangan menyusun ulang |
| `apps/api/prisma/platform/*.prisma` | Model bersama | Satu berkas per bounded context |
| `apps/api/prisma/platform/migrations/` | Penomoran waktu | Dua branch dapat membuat urutan berbeda tanpa konflik Git — periksa `migrate status` sebelum menggabung |
| `infrastructure/portal/portal.catalog.ts` | Seluruh portal | Uji menuntut urutan tetap; perbarui `sortOrder` |
| `infrastructure/portal/portal-host.ts` | Label terpesan | Ada salinan di sisi peramban; keduanya diikat uji |
| `deploy/apache/ebisnis.conf` | Seluruh domain | Tambah `ServerAlias`, jangan menyalin blok |
| `deploy/env.production.example` | CORS | Tambah, jangan susun ulang |
| `modules/public/public.controller.ts` | Seluruh endpoint publik | Vertikal baru memakai controller sendiri — pola pesantren |
| `pages/public/DokumenLayout.tsx` | Dipakai tujuh dokumen | Sudah menerima parameter merek dengan bawaan lama; jangan mengubah bawaannya |

## Catatan penomoran migrasi

Migrasi tenant memakai `V001`-`V037` berurutan. Dua branch yang sama-sama
menambah `V038` **tidak** menghasilkan konflik Git bila judulnya berbeda.
Periksa nomor tertinggi pada `main` sebelum membuat yang baru.

## Worktree

§5 meminta worktree `C:/opt/eBisnisGithub-santri-info` dengan branch
`feature/santri-info-epesantren`.

**Penyimpangan yang disengaja:** seluruh pekerjaan santri.info sesi ini berada
di worktree `C:/opt/eBisnisGithub-ecosystem` pada branch
`feature/collaborative-multi-portal-platform`, bersama portal registry yang
menjadi sandarannya. Branch terpisah akan membuat dokumen dan halaman pesantren
tidak melihat portalnya sendiri sampai PR ekosistem tergabung.

Sesudah PR itu tergabung ke `main`, worktree khusus dapat dibuat sebagaimana
diminta.
