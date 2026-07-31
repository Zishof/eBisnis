# IR-005 · Resolusi tenant untuk situs publik vertikal

- **Diajukan oleh:** sesi eKoperasi (K-9)
- **Tanggal:** 2026-08-01
- **Kepada:** sesi Core
- **Status:** menunggu
- **Berkas Core yang tersentuh:** resolver tenant (bersama), `platform` schema (satu tabel proyeksi baru)

## Ringkasan

Situs koperasi harus dapat dibuka pengunjung yang **belum masuk** — calon
anggota, pengawas, wartawan, siapa saja yang menerima tautannya. Hari ini itu
tidak mungkin dilakukan dengan aman, dan K-9 menghentikan diri di situ alih-alih
mencari jalan pintas.

## Masalahnya

Pengunjung tanpa sesi tidak membawa konteks ruang kerja. Sesuatu harus
menentukan skema mana yang dibaca. Satu-satunya jalan yang tersedia di modul
koperasi adalah menerima nama skema dari alamat:

```
GET /api/v1/cooperative/public/:schema/:slug     ← TIDAK dikerjakan
```

Itu justru yang dilarang tegas oleh aturan keamanan yang berlaku:

> Nama schema tidak boleh datang dari request body, query, maupun header —
> hanya dari `platform.tenant_schema_registry`.

Alasannya nyata, bukan formalitas: alamat semacam itu dapat dicoba nama demi
nama oleh siapa pun di internet sampai menemukan skema yang ada. Dan begitu
ditemukan, pemanggilnya sudah berada di dalam skema penyewa lain.

Karena itu K-9 **tidak** membuat endpoint publik. Yang dibuat hanya jalur
bersesi: `GET /cooperative/website/preview/:slug` dan
`POST /cooperative/website/preview/:slug/applications`, keduanya berpenjaga
`COOPERATIVE_WEBSITE.*` dan mengambil skemanya dari sesi.

Akibat yang jujur disebutkan: **situs koperasi belum dapat dibuka pengunjung,
dan formulir pendaftaran calon anggota belum dapat diisi dari internet.**
Seluruh isinya sudah dapat disusun, disimpan, dan dilihat pratinjaunya oleh
pengurus.

## Yang sudah ada di Core dan mendekati

Marketplace memecahkan masalah yang sama dengan cara yang benar: ia tidak
membaca skema penyewa sama sekali. `listing-projection.service.ts` menyalin
data yang boleh publik ke tabel proyeksi di control plane, dan
`/public/catalog/*` membaca dari sana. Tidak ada nama skema yang pernah
menyentuh alamat.

## Usulan

Dua bentuk; keduanya dapat diterima oleh sesi koperasi.

### Bentuk A — pemetaan host → skema (lebih disukai)

Core menyediakan resolver yang menerjemahkan **host permintaan** menjadi nama
skema lewat `platform.tenant_schema_registry`, dan memasangnya pada rute
bertanda `@Public()`:

```ts
// disediakan Core
@Public()
@ResolveTenantFromHost()      // koperasimaju.ekoperasi.id → skema penyewa
@Get('...')
```

Sifat yang diperlukan:

1. Host **tidak pernah** dipercaya apa adanya — ia dicocokkan ke baris
   terdaftar; host yang tidak cocok menghasilkan 404, bukan pilihan cadangan.
2. Tidak ada jalur cadangan ke `public`.
3. Host yang cocok tetapi penyewanya tidak aktif juga menghasilkan 404.

Ini yang paling sesuai untuk koperasi, sebab tiap koperasi memang sudah
memiliki subdomainnya sendiri (`cooperative_domain`, K-1).

### Bentuk B — proyeksi situs ke control plane

Bila Bentuk A terlalu jauh, koperasi dapat mengikuti pola marketplace: satu
tabel `platform.cooperative_public_site` yang menyalin hanya isi yang memang
publik (nama, tagline, kontak, halaman terbit, pengumuman `PUBLIC`), disegarkan
saat pengurus menerbitkan situsnya.

Kekurangannya: penerimaan lamaran calon anggota adalah **tulisan**, bukan
bacaan, sehingga tetap memerlukan jalan kembali ke skema penyewa. Bentuk B
karena itu menyelesaikan separuh masalah saja.

## Yang TIDAK diminta

- Tidak meminta pelonggaran aturan nama skema. Aturannya benar.
- Tidak meminta endpoint publik tanpa pembatasan laju. Formulir yang terbuka
  bagi internet memerlukannya, dan sesi koperasi akan memakainya begitu
  tersedia.
- Tidak meminta Core mengetahui apa pun tentang koperasi. Bentuk A bersifat
  umum dan berguna untuk eMedik maupun Info Desa nanti.

## Sampai disetujui

| Kemampuan | Keadaan |
| --- | --- |
| Menyusun isi situs | berjalan |
| Menyimpan pengaturan situs | berjalan |
| Pratinjau situs oleh pengurus | berjalan |
| Situs dibuka pengunjung | **tertahan IR ini** |
| Lamaran dikirim dari internet | **tertahan IR ini** |
| Lamaran diperiksa dan disetujui pengurus | berjalan |
| Portal anggota | berjalan (anggota memang bersesi) |

Portal anggota tidak terpengaruh sama sekali: anggota selalu masuk lebih
dahulu, sehingga skemanya datang dari sesi.
