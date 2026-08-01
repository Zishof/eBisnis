# EP-0.2 — Keadaan Saat Ini

Disusun dari inspeksi langsung terhadap `apps/api`, `apps/web`, migrasi Prisma,
dan basis data pengembangan `ebisnis` porta 5433.

## Stack yang benar-benar berjalan

| Lapis | Kenyataan |
| --- | --- |
| API | NestJS 10, TypeScript, Prisma 6.19.3 (multiSchema) |
| Basis data | PostgreSQL 17 pada pengembangan; 22 migrasi platform diterapkan |
| Web | React 18, Vite 6, TanStack Query, react-i18next |
| Uji | Jest 2.171 lulus / 83 berkas; Vitest 333 lulus / 20 berkas; Playwright E2E |
| CI | 6 pemeriksaan, seluruhnya hijau |

## Modul API yang ada

```text
accounting  activity   ai          auth        billing      catalog
checkout    cms        cooperative fulfillment governance   health
listing     marketing  marketplace master-seed notification observability
order       payment    platform-admin pos      pricing      public
return      seed-admin storefront  surat       tenant
```

## Infrastruktur bersama

```text
ai  audit  authorization  crypto  database  idempotency
observability  portal  provisioning  sequence  tenant
```

## Basis data platform

25 berkas Prisma, sekitar 210 model. Yang terbesar:

| Berkas | Model | Isi |
| --- | --- | --- |
| `cms.prisma` | 35 | Website, halaman, berita, media, workflow publikasi |
| `subscription.prisma` | 20 | Katalog modul, paket, harga, kontrak, entitlement |
| `tenancy.prisma` | 19 | Pendaftaran, penyewa, registry schema, provisioning |
| `billing.prisma` | 15 | Faktur, langganan, penggunaan |
| `payment.prisma` | 15 | Kanal dan transaksi pembayaran |
| `identity.prisma` | 13 | Pengguna, sesi, token, peran |

## Basis data penyewa

37 migrasi `V001`-`V037`, ditambah migrasi modul koperasi. Pada basis data
pengembangan terdapat **14 schema penyewa**, versi tenant `V037`.

## Yang sudah ada untuk santri.info

Dikerjakan sesi ini dan terbukti berjalan terhadap basis data lokal:

- Portal `SANTRI_INFO` pada katalog, ikut diseed dan ikut tautan silang.
- Pengenalan host apex versus subdomain pondok di peramban.
- Halaman portal beserta salam Arab, muqaddimah, dan narasi 26 bagian pondok.
- Pendaftaran pesantren terpisah beserta identitas lengkapnya.
- Beranda penyewa `/pesantren`, terpisah dari `/app`.
- Empat dokumen komersial khusus pesantren.

## Yang TIDAK ada

**Tidak ada satu pun modul pendidikan.** Pencarian
`santri|siswa|student|akademik|kurikulum|rapor` pada `apps/api/src/modules`
hanya menemukan berkas pendaftaran pesantren yang dibuat sesi ini.

Ini temuan terpenting audit. Perintah master menempatkan pekerjaan ini sebagai
"integrasi pada source existing", padahal **vertikal pendidikannya sendiri belum
ada**. Yang existing adalah lapis bersamanya — identity, tenancy, billing, CMS,
POS, akuntansi — bukan pendidikannya.
