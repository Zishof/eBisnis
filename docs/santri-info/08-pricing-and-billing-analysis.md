# EP-0.9 — Analisis Harga dan Penagihan

## Keadaan angka Rp 2.000 hari ini

Angka itu **belum** ada di katalog harga. Ia ada di dua tempat sebagai teks
pemasaran:

- `apps/web/src/verticals/pesantren/konten-pesantren.ts` — `HARGA_PER_SANTRI`
- `pesantren-registration.service.ts` — `hargaPerSantriPerBulan` pada konfigurasi
  formulir

Keduanya sudah diberi keterangan bahwa itu **penawaran bawaan, bukan sumber
kebenaran penagihan**. Tidak ada controller yang menagih dari angka itu, sehingga
larangan §6 "menghard-code harga pada controller" belum dilanggar.

Status `PARTIAL`. Menjadi `BROKEN` pada saat penagihan pertama berjalan bila
katalognya belum diisi.

## Metrik yang dibutuhkan

`ACTIVE_SANTRI_MONTH` (§13.4) belum ada. Definisinya menuntut hal yang belum
dapat dihitung karena model santri belum ada:

```text
santri punya enrollment aktif pada produk
aktif minimal satu hari dalam periode
bukan sample/test
tidak duplikat
belum efektif keluar
langganan aktif
```

Status `BLOCKED` oleh ketiadaan model santri.

## Larangan penagihan ganda

§13.2 melarang menagihkan eSchool Rp 2.000 dan ePesantren Rp 2.000 untuk santri
yang sama pada paket School-First. Kebijakan yang tersedia:

```text
BUNDLE_INCLUDED
BY_ACTIVE_ENROLLMENT
UNIQUE_PERSON_ACROSS_PRODUCTS
CONTRACT_DEFINED
```

Ini harus menjadi uji dengan data yang benar-benar tumpang tindih — bukan
catatan. Penagihan ganda adalah kesalahan yang ditemukan pondok, bukan oleh kita.

## Pemisahan uang

§13.6 menuntut lima aliran uang terpisah scope-nya:

```text
langganan platform != SPP santri != top-up uang saku
                   != pembayaran POS != simpanan BMT
```

Mesin pembayaran yang ada sudah memisahkan kanal. Yang belum ada adalah keempat
aliran selain yang pertama, sebab modulnya belum dibangun.
