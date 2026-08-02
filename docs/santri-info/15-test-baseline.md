# EP-0.16 — Garis Dasar Pengujian

Diambil sesudah seluruh pekerjaan santri.info pada sesi ini.

| Rangkaian | Jumlah | Berkas | Perintah |
| --- | --- | --- | --- |
| API (Jest) | 2.171 lulus | 83 | `npx jest` di `apps/api` |
| Web (Vitest) | 333 lulus | 20 | `npx vitest run` di `apps/web` |
| E2E (Playwright) | 73 lulus, 0 goyah | — | CI |
| Flutter | 147 lulus | — | CI |

## Pemeriksaan CI

Enam, seluruhnya lulus:

```text
Lint, test, build
E2E peramban
Klien kasir Flutter
Integritas migration
Secret scan
Dependency audit
```

## Uji yang ditambahkan sesi ini

| Berkas | Jumlah | Yang dijaga |
| --- | --- | --- |
| `santri-host.test.ts` | 13 | Apex portal versus subdomain pondok |
| `pesantren-registration.spec.ts` | 31 | Slug DNS versus nama schema, validasi lengkap |
| `pesantren-muat.spec.ts` | 3 | Modul dapat dimuat; cegah cacat TDZ |
| `password-change-allowlist.spec.ts` | 12 | Kebuntuan ganti kata sandi |
| `beranda-sesudah-masuk.test.ts` | 7 | Tujuan sesudah masuk |
| `pilihan-pesantren.test.ts` | 22 | Katalog cadangan dan perapian ketikan |
| `halangan-kirim.test.ts` | 36 | Setiap keadaan yang mematikan tombol dijelaskan |
| `konten-pesantren.test.ts` | 21 | Kelengkapan dan kejujuran dokumen komersial |
| `manfaat-peran.test.ts` | 15 | 26 bagian pondok, nada, dan rujukan |
| `salam-pembuka.test.ts` | 26 | Teks Arab berharakat dan bertanda arah |

## Yang belum ada garis dasarnya

- Uji integrasi yang menyentuh basis data sungguhan. Yang ada uji unit dan E2E;
  di antaranya kosong.
- Uji beban. Belum pernah dijalankan.
- Uji ketercapaian otomatis.
