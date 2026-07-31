# Integration Request 005 — Penyelesaian penyewa untuk situs desa publik

**Vertikal:** info-desa
**Cabang:** `feature/v12-info-desa`
**Diajukan:** 1 Agustus 2026
**Sifat:** Bukan pemblokir. Village sudah berjalan dengan penyelesainya sendiri
lewat `/village/public/:slug`; permintaan ini untuk domain kustom per desa.

---

## Keadaan

Situs desa publik memerlukan pemetaan **host atau slug → skema penyewa** tanpa
sesi. Yang tersedia pada Core adalah `StorefrontResolverService`, dan ia
menyelesaikan toko marketplace lewat `marketplace_store_domain`. Desa bukan
toko: ia tidak punya `marketplace_store`, dan memaksakan satu baris toko palsu
per desa akan mengotori katalog marketplace dengan entitas yang tidak pernah
berjualan.

Perintah §3 melarang mengubah penyelesai penyewa global. Village karena itu
menyediakan `VillagePublicResolver` miliknya sendiri, yang **hanya membaca**
`tenant` dan `tenant_schema_registry`:

```
/api/v1/village/public/:slug/profile
/api/v1/village/public/:slug/news
...
```

`slug` adalah `tenant.slug`. Bentuknya disaring `^[a-z0-9]+(-[a-z0-9]+)*$`
sebelum dipakai, dan nilainya tidak pernah menjadi bagian nama skema secara
langsung — nama skema selalu diambil dari `tenant_schema_registry`.

## Yang sudah ditegakkan sekarang

- Slug tidak dikenal **ditolak**, tidak dialihkan ke desa mana pun. Mengarahkan
  slug asing ke desa bawaan berarti setiap salah ketik menampilkan halaman milik
  desa lain — dan pada situs pemerintahan, halaman yang salah lebih buruk
  daripada halaman yang tidak ada.
- Pesan untuk slug berbentuk salah dan slug tidak terdaftar **sama persis**.
  Membedakannya memberi tahu penebak bahwa slug yang ia coba berbentuk benar.
- Penyewa yang tidak `ACTIVE` ditolak. Desa yang berhenti berlangganan tidak
  boleh situsnya tetap tayang: isinya tidak lagi diperbarui siapa pun, dan
  pengumuman lama yang terus tampil adalah pengumuman yang menyesatkan.
- Skema yang statusnya bukan `READY` ditolak.

## Yang diminta

**Domain kustom per desa.** `village_domain` sudah ada sejak D-1 dengan
`hostname`, `verification_token`, dan `verification_status`, tetapi ia berada
**di dalam skema penyewa** — sehingga tidak dapat dicari dari luar tanpa
memindai seluruh skema.

Yang diperlukan adalah satu pemetaan tingkat platform dari host ke penyewa yang
dapat dipakai vertikal mana pun, bukan hanya marketplace. Dua bentuk yang
masuk akal:

1. **Generalisasi `marketplace_store_domain`** menjadi tabel domain penyewa yang
   tidak terikat toko, dengan `vertical` sebagai pembeda.
2. **Tabel baru `tenant_public_domain`** pada skema `platform`, dan
   `StorefrontResolverService` membacanya lebih dahulu.

Village tidak mengusulkan salah satunya secara sepihak: keduanya menyentuh milik
Core, dan pilihan di antaranya menyangkut marketplace maupun vertikal lain yang
kelak memerlukannya.

**Satu syarat yang village minta dipertahankan pada bentuk mana pun:** host yang
belum terbukti dimiliki tidak dilayani. Tanpa itu, siapa pun dapat mendaftarkan
domain desa lain lalu menerima lalu lintasnya — dan pada situs pemerintahan,
akibatnya bukan sekadar kehilangan pengunjung.

## Bila tidak dijawab

Situs desa tetap tayang di `/desa/:slug` pada domain utama. Yang hilang hanyalah
`desa-anu.id` menjadi alamat sendiri — nyaman, tetapi bukan syarat agar
informasinya sampai kepada warga.
