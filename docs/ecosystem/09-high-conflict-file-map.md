# ECO-0 — Peta berkas rawan konflik

Diukur dari berkas yang disentuh **lebih dari satu** cabang vertical terhadap
`main`.

| Berkas | Cabang penyentuh | Mengapa panas |
| --- | ---: | --- |
| `apps/api/src/app.module.ts` | **3** | Setiap vertical mendaftarkan modulnya di sini |
| `apps/web/src/app/App.tsx` | 2 | Setiap vertical menambah rute |
| `apps/api/tenant-migrations/manifest.json` | 2 | Setiap vertical menambah migrasi |

## Titik panas yang belum tampak pada diff, tetapi pasti datang

| Berkas | Sebabnya |
| --- | --- |
| `apps/api/src/infrastructure/provisioning/tenant-menu.seed.ts` | Katalog menu, peran, dan izin seluruh produk ada di satu berkas. Setiap vertical menambah entri; POS baru menambah `POS_PROMO` |
| `apps/api/tenant-migrations/V0xx__*.sql` | Penomoran berurut global |
| `apps/api/prisma/platform/*.prisma` | Model platform bersama |

## Penomoran migrasi: risiko yang paling mudah meledak

`main` berada di **V037**. `feat/v13-education-audit` sudah memakai **V038**.

Dua cabang yang sama-sama menambah `V038__` dengan nama berbeda **tidak
menghasilkan konflik Git** — keduanya menempel bersih, lalu dua migrasi berbeda
memakai nomor urut yang sama. `manifest.json` yang ikut konflik justru
menyelamatkan; yang berbahaya adalah bila keduanya menyunting baris berbeda dan
menempel tanpa keluhan.

§38 sebenarnya sudah meminta penomoran bercap waktu
(`<timestamp>__<vertical>__<deskripsi>`), dan `main` belum memakainya.

Usul untuk diputuskan pemilik:

1. pindah ke penomoran bercap waktu §38 untuk migrasi **baru**, atau
2. menjatah rentang nomor per vertical (mis. Education V038–V059, eMedik
   V060–V099, info-desa V100–V129).

Yang pertama lebih sesuai perintah master; yang kedua lebih murah dan tidak
menyentuh pelari migrasi.

## Aturan kerja integrator

1. Tidak menyunting `app.module.ts`, `App.tsx`, atau `tenant-menu.seed.ts` pada
   pekerjaan besar tanpa memberi tahu cabang vertical terkait.
2. Perubahan integrator diusahakan **aditif** dan pada berkas baru.
3. Migrasi platform integrator memakai awalan `__platform__` sesuai §38.
