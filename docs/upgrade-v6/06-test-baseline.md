# 06 — Baseline Pengujian

> Fase V6-0. Angka di bawah adalah **garis dasar**: setiap fase V6 wajib
> mempertahankannya. Jika sebuah test gagal setelah perubahan V6, kegagalan itu
> adalah regresi — bukan "sudah gagal sebelumnya" — karena baseline ini seluruhnya
> hijau.

Dijalankan: 2026-07-30. Evidence: `evidence/baseline-01-*` … `baseline-05-*`.

## Ringkasan

| Lapis | Perintah | Jumlah | Hasil |
| --- | --- | --- | --- |
| Lint API | `eslint "src/**/*.ts" --max-warnings 0` | — | 0 error, 0 warning |
| Lint web | `eslint "src/**/*.{ts,tsx}" --max-warnings 0` | — | 0 error, 0 warning |
| Unit API (Jest) | `jest` | 68 test / 3 suite | 68 lulus |
| Unit web (Vitest) | `vitest run` | 15 test / 2 file | 15 lulus |
| Build API | `nest build` | — | sukses |
| Build web | `tsc -b && vite build` | — | sukses, tidak ada chunk > 500 kB |
| Seed verify platform | `seed-verify.cli.ts` | 25 resource | LULUS, 0 gagal |
| Seed verify tenant demo | idem | 22 resource | LULUS, 0 gagal |
| Smoke test HTTP | `node scripts/smoke-test.mjs` | 124 asersi / 20 bagian | 124 lulus |
| E2E Playwright | `playwright test` | 56 test (28 × 2 project) | 56 lulus |
| **Total test otomatis** | | **263** | **263 lulus** |

## Rincian unit test API (68)

| Suite | Test | Yang dikunci |
| --- | --- | --- |
| `schema-name.util.spec.ts` | 24 | normalisasi nama schema, penolakan nama reserved, `pg_` selalu ditolak, `quoteIdentifier` menolak injeksi |
| `discount-evaluator.service.spec.ts` | 30 | whitelist field/operator, 10 operator perbandingan, BETWEEN inklusif, grup AND/OR bersarang, rule kosong tidak memberi diskon, batas 10 vs 11 perangkat |
| `esmartlink-channel.parser.spec.ts` | 14 | format legacy `KODE:BIAYA:LABEL`, entri rusak dilewati bukan menggagalkan, 9 opsi kedaluwarsa monoton |

## Rincian unit test web (15)

| File | Test | Yang dikunci |
| --- | --- | --- |
| `formatters.test.ts` | 8 | format rupiah/angka/tanggal, nilai tidak valid jadi `-` |
| `i18n.test.ts` | 7 | keempat locale punya kunci identik, tidak ada kunci berlebih, Arab RTL, locale tak dikenal jatuh ke `id` |

## Rincian smoke test (124 asersi, 20 bagian)

| Bagian | Asersi | Cakupan |
| --- | --- | --- |
| 1–4 | 20 | health, pendaftaran, provisioning, cek username/schema |
| 5–7 | 14 | login, paksa ganti kata sandi, konteks, menu |
| 8 | 9 | lifecycle master termasuk purge diblokir tanpa step-up dan saat direferensikan |
| 9–10 | 12 | Request Order otomatis dari minimum stok, idempoten saat dijalankan ulang |
| 11 | 13 | PO, validasi pemasok, penerimaan 60/100, stok tidak berubah sebelum validasi, 58 diterima + 2 karantina |
| 12 | 6 | Backorder 40 dengan pengalihan pemasok, PO lanjutan |
| 13 | 8 | Internal transfer: available turun, in-transit naik, on-hand tujuan naik setelah validasi |
| 14–15 | 7 | stock tree, kartu stok, ledger immutable |
| 16 | 11 | pricing 10 vs 11 perangkat, quote, trace, invoice, Esmartlink disabled terkendali |
| 17–19 | 9 | isolasi demo, isolasi lintas tenant, super admin |
| 20 | 4 | hapus dan pulihkan data contoh, blokir yang sudah dipakai transaksi |

## Rincian E2E (28 test × 2 project)

Project: `chromium-desktop` (1280×720) dan `chromium-mobile` (Pixel 5).

| Berkas | Test | Cakupan |
| --- | --- | --- |
| `public-website.spec.ts` | 7 | route `/` menampilkan website bukan login, harga dari pricing engine, berita, halaman CMS, form kontak, ganti bahasa ke RTL, rute tak dikenal |
| `auth-and-erp.spec.ts` | 16 | kredensial salah, redirect tanpa sesi, kata sandi tersembunyi, sandbox demo, menu dari permission, muat ulang mengakhiri sesi demo, 8 halaman portal tenant |
| `accessibility-responsive.spec.ts` | 5 | tidak ada scroll horizontal pada 320px, menu mobile, skip-link, satu `h1` per halaman, mode gelap bertahan |

## Yang TIDAK dicakup baseline

Ini bukan daftar keluhan; ini daftar risiko yang harus ditutup fase V6 karena
uang dan otorisasi terlibat.

| Celah | Dampak | Fase penutup |
| --- | --- | --- |
| **Tidak ada test negatif permission** | temuan V6-0-F03 (purge tanpa otorisasi) tidak tertangkap | V6-0.x |
| **Tidak ada integration test bertransaksi DB** | perilaku transaksi/rollback hanya diuji lewat HTTP | V6-1+ |
| Coverage backend hanya 3 spec dari 67 file | perubahan service tidak tertangkap unit test | tiap fase |
| Portal platform belum ada E2E | 6 halaman platform belum pernah dibuka via browser | V6-0.x |
| Esmartlink belum diuji terhadap sandbox nyata | perilaku provider hanya diuji jalur gagal | V6-0.x bila kredensial ada |
| Tidak ada test performa | target p95 BRD V6 bab 12.2 belum terukur | V6-8 |
| Tidak ada test beban schema banyak | 10 schema saat ini; target ribuan | V6-8 |

## Aturan untuk fase berikutnya

1. Jalankan seluruh baseline **sebelum** menulis kode fase, dan **sesudahnya**.
2. Kegagalan setelah perubahan diklasifikasikan: regresi / environment /
   dependency / database / perubahan V6. Tidak boleh diberi label
   "tidak terkait" tanpa klasifikasi.
3. Setiap fase menambah test, bukan hanya menjaga yang ada. Target minimum per
   fase: unit untuk aturan bisnis, integration untuk transaksi, E2E untuk alur
   pengguna, dan satu test isolasi lintas tenant.
4. Smoke test tidak boleh dijadikan tempat menaruh semua verifikasi; ia membuat
   tenant baru setiap eksekusi (sudah menghasilkan 9 schema artefak).
