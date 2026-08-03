# 20 · Daftar Periksa Telaah Hukum dan Kontrak

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026

---

## Untuk apa dokumen ini

Beberapa kemampuan sistem ini **tidak boleh dinyalakan hanya dengan menekan
tombol**. Ia menuntut kesepakatan tertulis, telaah hukum, dan persetujuan orang
yang berwenang menandatangani.

Dokumen ini mendaftar mana saja, supaya tidak ada yang menyalakannya karena
mengira ia sekadar pengaturan.

---

## Yang menuntut kontrak sebelum aktivasi

| Kemampuan | Menuntut | Bawaan |
|---|---|---|
| Fee sistem (platform eMedik) | Kontrak, telaah hukum, pajak, persetujuan manajemen | `NONE` |
| Bagi hasil investor | Kontrak investasi, cakupan, waterfall, persetujuan | `NONE` |
| Integrasi SATUSEHAT produksi | Perjanjian, kredensial resmi, UAT | Nonaktif |
| Integrasi BPJS produksi | Perjanjian kerja sama, kredensial, UAT | Nonaktif |
| Kendali jarak jauh alat medis | Telaah risiko klinis, persetujuan tertulis | **Mati** |
| Pengiriman data ke pihak ketiga | Dasar hukum, persetujuan pasien | Nonaktif |
| Aktivasi tarif sintetis ke produksi | Persetujuan; tidak pernah otomatis | Nonaktif |

---

## Yang wajib ada pada tiap kontrak fee

```text
para pihak                        objek
dasar perhitungan                 persentase atau nominal
batas maksimum                    pengecualian layanan
tanggal berlaku                   tanggal berakhir
perlakuan pajak                   cara penyelesaian sengketa
siapa yang menyetujui perubahan
```

`batas maksimum` dan `pengecualian layanan` yang paling sering dilupakan.
Tanpa batas, persentase yang wajar pada layanan kecil menjadi nominal yang
tidak wajar pada layanan besar. Tanpa pengecualian, fee sistem akan ikut
terpotong dari layanan yang seharusnya tidak dipotong sama sekali — misalnya
obat program pemerintah.

---

## Persetujuan berjenjang

```text
pembuat → pemeriksa → penyetuju
```

Tiga orang berbeda. Ambang nilainya berkonfigurasi:

```text
perubahan persentase jasa       aktivasi fee sistem
aktivasi bagi hasil investor    nilai settlement
penghapusan klaim               penyesuaian klaim
aktivasi tarif                  aktivasi data contoh massal
perubahan pemetaan COA          aktivasi integrasi alat ke produksi
```

---

## Yang tidak boleh dilakukan sistem, apa pun kontraknya

```text
memotong jasa tenaga medis tanpa dasar tertulis
membayarkan distribusi investor secara otomatis
mengirim data pasien kepada investor
mengubah catatan klinis atas nama klaim
menghapus settlement yang sudah dinyatakan
mengaktifkan adapter yang kemampuannya belum diverifikasi
```

Keenamnya **tidak dapat dinyalakan dengan pengaturan mana pun**. Ia bukan
bawaan yang dapat diubah; ia batas.

---

## Inventaris regulasi

Implementasi harus memakai inventaris regulasi berversi — lihat
[11](11-jkn-tariff-regulation-inventory.md). Regulasi rumah sakit dan SIMRS
berubah, dan sebagian regulasi lama dicabut oleh yang baru.

Dokumen ini **tidak mencantumkan nomor peraturan**, dan itu disengaja: nomor
peraturan yang ditulis dari ingatan akan disalin ke dokumen klaim, dan dokumen
klaim yang menyebut peraturan yang salah akan dikembalikan. Inventarisnya diisi
sesi yang memiliki akses ke terbitan resminya, dengan berkas sumber dan sidik
jarinya.
