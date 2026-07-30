## Ringkasan

V9-3: toko online, registry domain terverifikasi, dan storefront resolver
berbasis host.

Menutup empat risiko KRITIS pada register: **R12** host spoofing, **R13**
pendaftaran domain milik orang lain, **R14** kebocoran katalog antar-tenant,
dan **R15** domain ganda.

## Migration

`20260730...add_storefront_domain` pada schema platform. Additive.
2 tabel, 3 enum.

## Keamanan

**Host dinormalkan sebelum dicocokkan.** `Toko.com`, `toko.com.`,
`toko.com:443`, dan `HTTPS://TOKO.COM` menjadi satu entri. Yang ditolak:
kredensial pada host, jalur, alamat IP, header ganda, dan huruf yang menyerupai.

**Host tak dikenal ditolak, bukan diarahkan ke toko bawaan.** Mengarahkannya
berarti setiap kesalahan DNS menampilkan katalog milik orang lain.

**Nama schema selalu dari registry**, tidak pernah diturunkan dari host dan
tidak pernah dikirim ke pengunjung.

**Penolakan tidak menjelaskan diri.** Empat host berbeda menghasilkan jawaban
identik; log mencatat alasan berbeda untuk penyelidikan.

**Verifikasi kepemilikan wajib** sebelum domain dilayani. Dua metode: TXT record
dan berkas `.well-known`. Pengambilan berkas menolak pengalihan.

**Setiap aksi domain memeriksa kepemilikan**, dengan pesan yang sama seperti
"tidak ditemukan" agar keberadaan domain tenant lain tidak dapat disimpulkan.

## Bukti pengujian

Dijalankan lawan API yang benar-benar berjalan dengan dua tenant nyata:

```text
domain terverifikasi dilayani                      status 200
nama schema TIDAK dikirim ke pengunjung
domain belum terverifikasi DITOLAK                 status 404
domain tenant A tidak menghasilkan toko tenant B
bentuk host berbeda menghasilkan toko yang sama    200,200,200
toko dengan seller ditangguhkan ditolak            status 404
```

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **296 lulus** (281 API + 15 web), naik dari 235 |
| `pnpm build` | bersih |
| `pnpm route:audit` | 0 route tanpa penanda |

## Keterbatasan yang diketahui

- UI Pengaturan Toko Online belum ada; menunya bertanda `comingSoon`.
- Verifikasi belum dijadwalkan ulang otomatis; pemilik menekan tombol periksa.
- Halaman toko belum menampilkan katalog — menunggu listing V9-4 dan projection V9-5.
- `online_store` di schema tenant belum dibuat; yang dibangun sisi platform.

## Rollback

Migration additive. Menonaktifkan storefront cukup dengan mencabut seluruh
domain; resolver akan menolak setiap host.
