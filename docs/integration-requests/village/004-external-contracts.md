# Integration Request 004 — Kontrak konsumen village terhadap eMedik, eKoperasi, POS, dan marketplace

**Vertikal:** info-desa
**Cabang:** `feature/v12-info-desa`
**Diajukan:** 1 Agustus 2026
**Sifat:** Bukan pemblokir. Village sudah berjalan dengan adapter tiruan yang
menyatakan "belum tersambung" dengan jujur; permintaan ini untuk menyepakati
bentuk kontraknya sebelum masing-masing vertikal membangun sisinya.

---

## Keadaan

Perintah §3 menutup bagian anti-bentroknya dengan: *"Untuk Posyandu gunakan
public health contract. Untuk koperasi desa gunakan public cooperative contract.
Jangan menyalin modul tersebut ke village."*

Ketiga mitra itu belum ada:

| Mitra | Keadaan pada 1 Agustus 2026 |
|---|---|
| eMedik | Cabang `feature/v12-emedik` belum dibuat |
| eKoperasi | Cabang `feature/v12-ekoperasi` belum dibuat |
| POS Core | Pada `feature/pos-web-priority`, belum masuk `main` |
| Marketplace | Ada pada Core; kontrak penautannya belum |

Village karena itu mendefinisikan **sisi konsumennya** lebih dahulu, pada
`apps/api/src/modules/village/ports/external.ports.ts`, beserta adapter tiruan
pada `ports/unavailable.adapter.ts`.

## Yang diminta

Kesepakatan atas bentuk keempat antarmuka berikut, atau usulan penggantinya
dari pihak yang membangun sisi penyedianya. Yang **tidak** diminta adalah
implementasinya sekarang — village berjalan tanpanya.

### `HealthAggregatePort` — eMedik

```
jadwalPosyandu(villageUnitId, from, to)
indikatorAgregat(villageUnitId, period, breakdown?)   // SELALU agregat
cacahSasaran(villageUnitId, programCode)              // jumlah, bukan nama
kampanyeAktif(villageUnitId)
```

**Tidak ada metode** untuk rekam medis, diagnosis, riwayat kunjungan seseorang,
hasil pemeriksaan, resep, maupun daftar nama pasien. Larangan itu ditegakkan
dengan tidak menyediakan metodenya — antarmuka yang tidak punya metode tidak
dapat dipanggil, dan itu jauh lebih kuat daripada metode yang ada tetapi diberi
pemeriksaan izin.

`indikatorAgregat` mengembalikan `value: null` disertai `suppressed: true`
ketika cacahnya di bawah ambang minimum penyajian — bukan angka kecil yang
dapat dibongkar menjadi orang tertentu. Ambangnya ditetapkan D-11 dan berlaku
bagi seluruh laporan publik.

### `CooperativeIntegrationPort` — eKoperasi

```
koperasiDiDesa(villageUnitId)
ringkasanKeanggotaan(villageUnitId, period)          // jumlah, bukan nama
apakahAnggota(residentNationalId, cooperativeId, purpose)   // boolean
kinerjaPublik(cooperativeId)
```

Tidak ada saldo simpanan, riwayat pinjaman, maupun tunggakan. Desa tidak
berkepentingan mengetahuinya, dan kepentingan yang tidak ada tidak boleh diberi
jalan.

`apakahAnggota` menuntut `purpose: 'AID_DUPLICATE_CHECK'`. Nilainya masuk ke
jejak audit di kedua sisi. Pemeriksaan yang dilakukan tanpa keperluan yang
dinyatakan adalah pemeriksaan yang tidak dapat dipertanggungjawabkan kemudian.

**Satu permintaan khusus kepada eKoperasi:** hasil yang tidak tersedia jangan
dikembalikan sebagai `isMember: false` polos. Pemeriksaan bantuan ganda yang
membacanya begitu akan meloloskan penerima ganda justru ketika sistemnya sedang
tidak dapat memeriksa. Karena itu seluruh metode mengembalikan
`HasilLuar<T>` — `{ tersedia, keterangan?, data }` — dan pemanggil wajib
memeriksa `tersedia`.

### `PosIntegrationPort` — Core POS

```
ringkasanPenjualan(outletId, from, to)
produkTerlaris(outletId, period, limit)
tautkanUnitUsaha(bumdesUnitId, outletId)
```

Hanya membaca dan menautkan. Village tidak memanggil penjualan, tidak membuka
shift, dan tidak menyentuh stok — sehingga larangan §3 tentang mengubah
perilaku POS terpenuhi dengan sendirinya.

### `MarketplaceLinkPort` — Core

```
periksaListing(listingId, ownerUserId)    // mengembalikan listing HANYA bila memang miliknya
listingPelakuUsaha(ownerUserId)
```

**Tidak ada metode untuk membuat listing**, dan alasannya bukan teknis: produk
yang didaftarkan pemerintah desa atas nama warga menimbulkan pertanyaan siapa
yang bertanggung jawab bila produknya bermasalah — dan pertanyaan itu muncul
justru ketika keadaannya sedang buruk. Pelaku usaha mendaftarkan produknya
sendiri lewat jalur marketplace yang sudah ada; village hanya menautkannya.

`periksaListing` sengaja menggabungkan keberadaan dan kepemilikan menjadi satu
jawaban. Metode terpisah yang mengembalikan listing lalu membiarkan pemanggil
membandingkan pemiliknya akan dilewati oleh pemanggil yang lupa
membandingkannya.

## Rujukan lintas vertikal disimpan tanpa foreign key

`village_bumdes_unit.pos_outlet_id`,
`village_umkm_product.marketplace_listing_id`, dan
`village_cooperative_presence.external_cooperative_id` menunjuk entitas milik
sistem lain dan **tidak berelasi**. Foreign key yang melintasi batas vertikal
membuat migrasi satu vertikal dapat mematahkan vertikal lain, dan itu persis
yang dilarang §3. Keabsahannya diperiksa lewat port, bukan lewat basis data.

Bila kelak disepakati bahwa rujukan ini sebaiknya berelasi, itu keputusan
lintas vertikal yang perlu diambil bersama — bukan keputusan yang boleh diambil
cabang village.

## Yang perlu diputuskan pihak lain

1. **eMedik:** apakah bentuk `HealthAggregatePort` dapat diterima, dan berapa
   ambang minimum penyajian yang dipakai bersama D-11.
2. **eKoperasi:** apakah `HasilLuar<T>` dapat dipakai, atau eKoperasi lebih
   suka bentuk lain untuk membedakan "tidak ada" dari "tidak dapat dibaca".
3. **Core POS:** kapan `feature/pos-web-priority` masuk `main`, dan apakah
   `outletId` yang dipakai village adalah `outlet.id` atau pengenal lain.
4. **Core marketplace:** apakah `periksaListing` dapat disediakan sebagai satu
   pemanggilan, atau village harus menyusunnya dari dua.

## Bila tidak dijawab

Village tetap berjalan. Adapter tiruan mengembalikan `tersedia: false` beserta
keterangannya, halaman menampilkan "belum tersambung" alih-alih angka, dan
tidak satu pun data karangan tersimpan. Yang hilang hanyalah fiturnya — bukan
kebenaran datanya.
