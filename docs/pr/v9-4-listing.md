## Ringkasan

V9-4: listing produk, validasi media, dan gerbang publikasi. Membuka
`PENDING_PHASE` kedua pada pemeriksaan kesiapan seller.

Menutup lima risiko: **R17** berkas berisi kode, **R18** bom dekompresi,
**R19** SVG berisi skrip, **R21** URL YouTube sembarang, dan sebagian **R20**.

## Migration

`V013__online_listing.sql` — additive. 4 tabel tenant, 8 CHECK constraint,
3 batasan unik.

## Keputusan: tanpa dependensi native

Rencana menyebut `sharp` dan `file-type`; keduanya tidak dipakai.

Pelajaran cutover Versi 7 masih berlaku — binary native `rollup` gagal pada
Ubuntu 20.04 karena menuntut GLIBC 2.32. Yang lebih penting: **bagian yang
menentukan keamanan tidak memerlukannya.** Tipe dari magic byte, dimensi dari
header, batas piksel dari header. Hanya pembuatan thumbnail yang menuntut
pustaka gambar, dan itu kenyamanan penyajian.

## Keamanan

**Validasi tanpa mendekode gambar.** Bom dekompresi bekerja justru dengan
membuat pendekode mengembangkan berkas kecil menjadi gigabyte. PNG 24 byte yang
menyatakan 60000×60000 ditolak sebelum satu piksel pun dibentuk.

**Tipe dari isi, bukan nama.** Skrip PHP bernama `gambar.jpg` ditolak; PNG sah
berekstensi `.jpg` juga ditolak.

**SVG tidak diterima sama sekali** — dokumen XML yang dapat memuat skrip.

**YouTube: yang disimpan id, bukan URL.** Alamat embed dibangun sistem.
CHECK constraint basis data menjadi penjaga terakhir — diuji langsung.

## Gerbang publikasi

Sembilan belas syarat diperiksa **sekaligus**, bukan berhenti pada yang pertama
gagal. Fungsi murni tanpa akses basis data, sehingga seluruh kombinasinya dapat
diuji dan UI dapat memakai aturan yang sama.

Tiga keputusan: harga nol ditolak; stok nol diterima bila pre-order diizinkan;
kepatuhan yang **belum** diperiksa bukan berarti lolos.

## Bukti pengujian

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **398 lulus** (383 API + 15 web), naik dari 296 |
| `pnpm build` | bersih |
| `pnpm route:audit` | 0 route tanpa penanda |
| `verify-migrations.mjs` | 13 migration lulus |

V013 diterapkan pada 14 schema pengembangan.

## Keterbatasan yang diketahui

- Turunan gambar belum dibuat; menunggu pustaka gambar yang terverifikasi di server.
- EXIF belum dibuang (R20 sebagian) — alasan yang sama.
- Endpoint unggah berkas belum ada; menunggu keputusan penyimpanan objek.
- Moderasi media belum berjalan; `PENDING` lolos gerbang, hanya `REJECTED` menahan.
- Varian belum punya endpoint.
- Kategori marketplace dibangun pada V9-12, sehingga syarat `CATEGORY` belum
  dapat dipenuhi tenant mana pun. Gerbang tetap memeriksanya.

## Rollback

Migration additive. Menonaktifkan listing cukup dengan menarik seluruhnya dari
publikasi; tabelnya tidak perlu diturunkan.
