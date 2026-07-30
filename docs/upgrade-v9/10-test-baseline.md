# 10 — Baseline Pengujian Versi 9

Commit `7399fb8`. Bukti mentah: [`evidence/baseline-v9-0.txt`](evidence/baseline-v9-0.txt).

## Hasil

| Perintah | Hasil | Catatan |
| --- | --- | --- |
| `pnpm db:validate` | **lulus** | schema platform valid |
| `pnpm db:generate` | **lulus** | Prisma client dihasilkan |
| `tsc --noEmit` (api) | **lulus** | exit 0 |
| `tsc --noEmit` (web) | **lulus** | exit 0 |
| `pnpm lint` | **lulus** | 0 peringatan, `--max-warnings 0` |
| `pnpm test` | **lulus** | 119 test |
| `pnpm build` | **lulus** | api dan web |
| `pnpm test:e2e` | **belum diukur** | menuntut server berjalan dan browser Playwright |
| `node scripts/ci/verify-migrations.mjs` | **lulus** | 10 migration |
| `pnpm seed:verify` | **lulus** | 22 resource, 0 gagal |

## Koreksi terhadap dokumen Versi 9

Dokumen Versi 9 mencantumkan `pnpm typecheck`. **Script itu tidak ada.**

Yang ada:

```bash
pnpm lint      # eslint per aplikasi
pnpm test      # jest (api) + vitest (web)
pnpm build     # nest build + vite build
pnpm check     # lint + test + build
pnpm test:e2e  # playwright
```

Typecheck berjalan sebagai bagian `build`. Untuk memeriksa tipe tanpa membangun,
gunakan `npx tsc --noEmit -p tsconfig.json` di dalam `apps/api` atau `apps/web`.

Baseline di atas memakai perintah yang benar-benar ada, bukan yang disebut
dokumen. Menjalankan perintah yang tidak ada lalu melaporkannya lulus akan
menyesatkan.

## Sebaran 119 test

| Berkas | Test | Cakupan |
| --- | ---: | --- |
| `role-expansion.spec.ts` | 27 | katalog role, penurunan profil, syarat unggah, SoD |
| `segregation-of-duty.service.spec.ts` | 9 | penegakan SoD, pengecualian, pencatatan |
| `discount-evaluator.service.spec.ts` | ~40 | evaluator diskon whitelist-only |
| `schema-name.util.spec.ts` | ~20 | validasi nama schema |
| `esmartlink-channel.parser.spec.ts` | ~8 | parser kanal pembayaran |
| `formatters.test.ts` (web) | 8 | format angka dan tanggal |
| `i18n.test.ts` (web) | 7 | kelengkapan terjemahan |

## Yang tidak dicakup baseline

Ini yang paling penting dari dokumen ini: **cakupan test sekarang sempit**, dan
Versi 9 akan menambah kode yang jauh lebih berisiko daripada yang sudah ada.

| Area | Cakupan | Risiko untuk V9 |
| --- | --- | --- |
| Endpoint API | **tidak ada test integrasi** | endpoint marketplace menyentuh uang dan stok |
| Otorisasi | **tidak ada test** | V6-0-F03 tidak akan tertangkap test |
| Isolasi tenant | **tidak ada test** | marketplace membuat kebocoran lintas tenant mungkin terjadi |
| Provisioning tenant | diuji lewat CLI manual | — |
| Pembayaran | hanya parser kanal | callback ganda, jumlah salah, akun salah |
| Reservasi stok | **tidak ada test** | oversell |
| E2E | 3 spec, tidak dijalankan pada CI | — |

## Test yang wajib ada sebelum fase yang bersangkutan

Bukan daftar keinginan; ini prasyarat yang membuat fase dianggap selesai.

### V9-1 — otorisasi

```text
handler tanpa metadata permission DITOLAK, bukan diloloskan
pengguna tanpa permission menerima 403 pada setiap endpoint baru
batas data WAREHOUSE tanpa penugasan mengembalikan nol baris
batas data STORE menyaring pesanan milik toko lain
```

Test pertama adalah yang menutup V6-0-F03. Ia harus **gagal** pada kode sekarang;
bila lulus sebelum perbaikan, testnya salah.

### V9-2 — credential

```text
credential tidak pernah dikembalikan utuh setelah disimpan
pembacaan credential tercatat pada audit
mengubah credential tanpa step-up ditolak
credential tenant lain tidak dapat dibaca
tiket aktivasi ganda untuk akun yang sama ditolak
```

### V9-3 — storefront

```text
host tidak dikenal ditolak, bukan diarahkan ke tenant bawaan
host yang belum terverifikasi ditolak
custom domain tenant A tidak menampilkan produk tenant B
domain yang sudah dipakai tenant lain tidak dapat didaftarkan
```

### V9-4 — listing dan media

```text
listing dengan 0, 1, dan 2 gambar TIDAK dapat dipublikasikan
listing dengan 3 gambar valid dapat dipublikasikan
berkas dengan tipe nyata bukan gambar ditolak walau ekstensinya .jpg
gambar melebihi batas dimensi ditolak sebelum decode penuh
URL YouTube di luar host resmi ditolak
```

### V9-6 dan V9-7 — checkout dan pembayaran

```text
callback ganda dengan transaction id sama tidak menambah pembayaran
callback dengan jumlah berbeda ditolak
callback untuk akun seller lain ditolak
checkout ditolak bila seller tidak ACTIVE
checkout ditolak bila akun pembayaran seller tidak aktif
checkout ditolak bila harga berubah sejak masuk keranjang
keranjang dua seller menghasilkan dua payment order
```

### V9-8 — stok

```text
dua checkout bersamaan atas stok terakhir: satu berhasil, satu ditolak
reservasi kedaluwarsa melepas stok
pelepasan ganda tidak menambah stok
pembayaran gagal melepas reservasi
```

## Aturan test untuk risiko keamanan

Setiap risiko **KRITIS** pada
[08-security-risk-register.md](08-security-risk-register.md) wajib punya test
yang **gagal bila penanganannya dicabut**.

Test yang hanya membuktikan jalur normal tidak menutup risiko apa pun. Test
"pembayaran berhasil menandai pesanan lunas" tidak membuktikan callback ganda
ditolak.

## Target cakupan

Tidak ditetapkan sebagai persentase. Persentase mendorong test yang mudah ditulis,
bukan test yang menangkap kesalahan.

Yang ditetapkan: **setiap jalur yang menolak sesuatu wajib punya test.** Jalur
penolakan adalah tempat kesalahan bersembunyi, karena jalur normal selalu dicoba
manual sedangkan jalur penolakan hampir tidak pernah.

## E2E

Tiga spec Playwright ada tetapi tidak dijalankan pada CI karena menuntut server
dan basis data. Versi 9 menambah alur yang hanya dapat dibuktikan E2E:

```text
seller mendaftar -> tiket aktivasi -> credential -> uji pembayaran -> ACTIVE
listing 3 gambar -> terbit -> muncul di marketplace
pembeli mencari -> keranjang -> checkout -> bayar -> pesanan
seller picking -> packing -> kirim -> lacak -> terkirim
pembeli retur -> seller setujui -> barang diterima -> refund
```

Menjalankan E2E pada CI menuntut PostgreSQL dan server aplikasi di runner.
Keputusan apakah menambahkannya ke CI atau menjalankannya terjadwal ditulis
sebagai ADR pada V9-5, setelah alur pertama yang layak diuji E2E tersedia.
