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

## Eskalasi — ditemukan saat EP-C mulai dikerjakan

Pemeriksaan lebih lanjut menemukan cacat yang lebih dalam daripada ketiadaan
`tenantId`, dan **mengubah urutan pengerjaan**:

```text
model CmsPage {
  ...
  @@unique([websiteId, slug])   // unik PER WEBSITE, bukan global
}
```

`getPage(slug)` pada `PublicSiteService` memanggil `cmsPage.findFirst({ where:
{ slug, ... } })` — **tanpa menyaring `websiteId`**, dan tanpa `orderBy`. Selama
hanya ada satu `Website`, ini tidak kentara. Begitu situs kedua dibuat, dua
pondok yang sama-sama membuat halaman berslug `tentang` akan saling menimpa
secara acak — pengunjung pondok A dapat melihat halaman pondok B, bergantung
urutan yang dikembalikan basis data.

Lebih parah lagi:

```text
model NewsCategory { ... }   // TIDAK ADA websiteId sama sekali
model NewsArticle  { ... }   // TIDAK ADA websiteId sama sekali
```

Berita bukan sekadar ambigu — ia **sama sekali tidak bersekat** per situs.
`listNews()` dan `getNewsArticle()` membaca seluruh tabel `NewsArticle` tanpa
mengenal situs mana pun. Memberi pondok kemampuan menulis berita hari ini
berarti tulisannya tercampur dengan berita eBisnis.id di satu tabel yang sama,
terlihat siapa pun yang memanggil endpoint publik.

### Akibatnya bagi EP-C

**Ditunda**, dan sengaja ditunda: membuat baris `Website` per pondok tanpa
menyekat `CmsPage` dan `NewsArticle` lebih dulu berarti *menampilkan* menu situs
yang tampak berfungsi, padahal kebocoran lintas-penyewa menunggu di baliknya —
persis pola yang §6 larang: "mengklaim fitur selesai hanya karena menu sudah
tampil".

Yang **dikerjakan** pada EP-C sesi ini, karena aman dan berdiri sendiri:

1. Kolom `tenant_id` pada `platform.website` — aditif, fondasi yang tetap
   dibutuhkan.
2. Perbaikan `getSite()`: `findFirst` disaring eksplisit `tenantId: null`. Ini
   bukan sekadar kerapian — tanpa penyaring itu, baris `Website` bertenant yang
   dibuat di masa depan dapat terpilih sebagai beranda eBisnis.id, tergantung
   `sortOrder`.

**EP-C2 — DONE (sesi berikutnya).**

`CmsPage` sudah mempunyai `websiteId` sejak awal — yang hilang hanyalah
penyaringnya pada `getPage()`, sudah ditambahkan. `NewsCategory` dan
`NewsArticle` benar-benar tidak punya kolom situs; migrasi aditif
`20260802130000_news_site_scoping` menambah `website_id NOT NULL` pada
keduanya (mengisi baris lama ke situs platform), mengubah keunikan `slug`
dari global menjadi `(website_id, slug)`, dan `listNews()`/`getNewsArticle()`
kini menyaring `websiteId`. Dibuktikan live: situs uji dengan slug kategori
dan artikel PERSIS SAMA dengan milik eBisnis.id tidak muncul pada
`/public/news` maupun `/public/news/:slug` eBisnis.id. Detail pada
`16-implementation-plan.md`.

`SitusPondokPage.tsx` (endpoint dan editor CMS untuk SATU situs pondok) tetap
belum dibangun — EP-C2 hanya menutup risiko kebocoran data sebagai prasyarat,
bukan membangun situs pondok itu sendiri.
