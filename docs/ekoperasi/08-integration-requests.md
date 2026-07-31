# K-0 · Permintaan Integrasi

Perubahan pada berkas milik Core yang dibutuhkan koperasi, beserta apa yang
tetap dapat dikerjakan sambil menunggu.

Perintah eKoperasi §3 melarang menyunting berkas bersama secara langsung, dan
panduan §15 menyebut kapan sesi vertikal **harus berhenti**. Empat permintaan di
bawah adalah hasil penerapan aturan itu — bukan daftar keinginan.

---

## Ringkasan

| # | Judul | Sifat | Menahan |
|---|---|---|---|
| [001](../integration-requests/cooperative/001-katalog-migrasi-modular.md) | Katalog migrasi modular per vertikal | **Pemblokir tiga vertikal** | Penerapan migrasi koperasi ke penyewa |
| [002](../integration-requests/cooperative/002-kait-pembayaran-saldo-eksternal.md) | Kait pembayaran bersaldo eksternal pada POS | Tidak memblokir | K-7d saja |
| [003](../integration-requests/cooperative/003-katalog-peristiwa-akuntansi-modular.md) | Katalog peristiwa akuntansi modular | Pemblokir | Penjurnalan simpanan, pinjaman, SHU |
| [004](../integration-requests/cooperative/004-katalog-menu-peran-hak-akses-koperasi.md) | Katalog menu, peran, aksi modular | Pemblokir | Menu dan penegakan hak akses koperasi |

Tiga di antaranya (001, 003, 004) memiliki bentuk yang sama: **registri katalog
per modul**. Bukan kebetulan — ketiganya berasal dari satu sebab, yaitu bahwa
platform ini dirancang untuk satu produk dan kini melayani empat.

Bila sesi Core hendak mengerjakan satu pola untuk ketiganya, itu justru lebih
baik daripada tiga mekanisme berbeda.

---

## Yang tetap dapat dikerjakan sambil menunggu

Penting, karena tanpa ini K-0 akan tampak seperti alasan untuk berhenti.

| Fase | Dapat dikerjakan? | Keterangan |
|---|---|---|
| K-1 profil dan legalitas | **Ya** | Migrasi ditulis di folder modul; diterapkan ke skema uji lewat skrip lokal |
| K-2 organisasi dan anggota | **Ya** | Aturan keanggotaan sebagai fungsi murni dapat diuji penuh tanpa basis data |
| K-3 simpanan | **Sebagian** | Buku pembantu berjalan; jurnal buku besarnya menunggu 003 |
| K-4 pinjaman | **Sebagian** | Sama dengan K-3 |
| K-5 RAT | **Ya** | Tidak menyentuh akuntansi |
| K-6 SHU | **Sebagian** | Perhitungan penuh; distribusinya menunggu 003 |
| K-7 unit usaha | **Ya, kecuali 7d** | Pembacaan POS dan patronage tidak menuntut apa pun dari Core |
| K-8 laporan | **Sebagian** | Laporan dari buku pembantu berjalan; neraca menunggu 003 |
| K-9 portal anggota | **Ya** | — |
| K-10 katalog dan data contoh | **Sebagian** | Ditulis penuh; pendaftarannya menunggu 004 |
| K-11 keamanan dan E2E | **Sebagian** | Uji SoD berjalan; E2E lintas modul menunggu 001 dan 004 |

Tidak ada fase yang berhenti total. Yang tertunda selalu bagian akhirnya —
pendaftaran ke mesin Core — bukan perancangan maupun pengujiannya.

---

## Yang jujur harus disebutkan

Tiga hal yang, bila tidak ditulis di sini, akan mudah disalahpahami sebagai
"sudah selesai":

1. **Sampai 001 disetujui, penyewa sungguhan belum memperoleh tabel koperasi.**
   Migrasi ada dan teruji pada skema uji, tetapi tidak diterapkan ke penyewa.
   Menerapkannya sebelum mekanismenya disepakati adalah persis kesalahan yang
   001 cegah.

2. **Sampai 003 disetujui, peristiwa akuntansi koperasi tercatat tetapi belum
   dijurnal.** `isKnownEvent()` menolaknya. Simpanan dan pinjaman tetap tercatat
   pada buku pembantu anggota; yang belum terbentuk adalah jurnal buku besarnya.
   Laporan neraca koperasi karena itu belum lengkap.

3. **Sampai 004 disetujui, endpoint koperasi belum dapat dipakai penyewa.**
   Penjaga `@Permissions('COOPERATIVE_*.*')` menolak setiap permintaan karena
   hak aksesnya belum ada di basis data. Pengujian memakai hak akses yang
   disemai skrip lokal.

Ketiganya adalah keadaan yang benar, bukan yang perlu diakali. Mengakalinya —
misalnya dengan melonggarkan penjaga hak akses "sementara" — akan menghasilkan
kelonggaran yang tetap tinggal setelah IR disetujui.

---

## Temuan untuk sesi lain

Bukan permintaan koperasi, tetapi ditemukan audit ini dan akan menabrak sesi
lain pada langkah pertamanya:

### `apps/api/src/modules/health/` sudah terpakai

Panduan §4 memberikan direktori itu kepada sesi eMedik. Direktori itu **sudah
ada** dan berisi `health.module.ts` — endpoint `/health` untuk pemantauan
ketersediaan layanan, sama sekali bukan modul kesehatan.

Usulan: sesi eMedik memakai `modules/emedik/` atau `modules/medical/`, atau sesi
Core memindahkan pemeriksaan kesehatan ke `infrastructure/health/`. Keputusannya
milik Core; yang penting ia diambil sebelum eMedik menulis berkas pertamanya.

### Tidak ada satu pun `*Port` di `common/` maupun `infrastructure/`

Perintah ketiga vertikal menyebut sembilan port bersama. Tidak ada satu pun yang
ada.

Koperasi menanganinya dengan mendefinisikan portnya sendiri di
`modules/cooperative/ports/` — pendekatan yang memang benar, sebab port yang
baik didefinisikan pemakainya, bukan penyedianya.

Bila eMedik dan info-desa memerlukan port yang sama, sesi Core dapat
mengangkatnya menjadi milik bersama **setelah** terbukti dipakai dua vertikal.
Mengangkat antarmuka yang sudah terbukti jauh lebih aman daripada merancangnya
di muka untuk pemakai yang belum ada.

### Dependensi

Koperasi **tidak menambah satu pun dependensi** pada K-0. `pnpm-lock.yaml` tidak
disentuh, dan `pnpm install --frozen-lockfile` berhasil — yang membuktikannya.

Bila kelak diperlukan, dicatat pada
`docs/integration-requests/cooperative/dependencies.md` sesuai panduan §8, bukan
langsung dipasang.
