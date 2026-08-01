# EP-0.10 — Analisis CMS dan Situs Penyewa

## Temuan terpenting audit ini

Mesin CMS **ada dan lengkap** — 35 model, mencakup hampir seluruh yang diminta
§11.2: halaman berversi, berita, kategori, tag, media, navigasi, footer, SEO,
redirect, dan `CmsPublicationWorkflow`.

Namun:

```text
model Website {
  id, code, name, primaryDomain, defaultLocaleCode, themeCode, ...
  // TIDAK ADA tenantId
}
```

**`Website` tidak dimiliki siapa pun.** Mesinnya multi-situs, bukan
multi-penyewa. Seluruh endpoint publik CMS (`GET /public/site`,
`/public/pages/:slug`, `/public/news`) menyajikan situs platform dan tidak
menerima host sebagai penentu penyewa.

Inilah penghalang tepat bagi janji "berita dapat disunting pondok sendiri" yang
sudah tertulis pada halaman pemasaran.

## Yang dibutuhkan, dan seberapa besar

Lebih kecil daripada kesannya:

1. Kolom `tenant_id` yang boleh null pada `platform.website` — **aditif**. Null
   berarti milik platform, sebagaimana seluruh baris yang sudah ada.
2. Pencarian situs dari host permintaan lewat `website_domain`, lalu memeriksa
   kepemilikan penyewanya.
3. Penjaga pada seluruh endpoint CMS penyewa: penyewa hanya menyunting situs
   miliknya. Ini bagian yang paling perlu diuji.
4. Seed satu situs saat pondok mendaftar, memakai slug yang sudah dipilih.

Tidak ada CMS engine kedua yang perlu dibuat; §6 memang melarangnya.

## Yang tetap belum tercakup

| Diminta §11 | Status |
| --- | --- |
| Tema per penyewa | MISSING — `themeCode` ada, katalog tema belum |
| Agenda | MISSING |
| Galeri | PARTIAL — ada `MediaAsset` |
| Formulir dan lead | PARTIAL — ada `ContactMessage` |
| Editor beserta preview dan riwayat | MISSING — model versinya ada, layarnya belum |
| Pemisahan penulis dan penerbit | PARTIAL — `CmsPublicationWorkflow` ada, peran belum |

## Risiko yang harus dijaga

§11.5 melarang JavaScript sembarang dari penyewa. Isi berita yang disunting
pondok akan digambar pada halaman yang dibuka publik; tanpa pembersihan ketat,
satu pondok dapat menjalankan skrip pada peramban pengunjung pondok lain.
`sanitize-html` sudah ada di repositori dan dipakai `contact.service.ts` — pola
itu yang harus diikuti.
