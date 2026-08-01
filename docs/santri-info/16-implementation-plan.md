# EP-0.17 — Rencana Pelaksanaan

Disusun dari kesenjangan yang benar-benar ditemukan, bukan dari urutan EP pada
perintah master. Alasannya ada pada dokumen 03: vertikal pendidikan belum ada
sama sekali, sehingga urutan yang menganggapnya ada akan tersendat pada langkah
pertama.

## Prasyarat mutlak

**EP-A — Fondasi pendidikan.** Model orang, santri, wali, unit, tahun ajaran,
dan pendaftaran santri. Tanpa ini seluruh EP lain tidak punya pijakan. Ini
pekerjaan terbesar dan harus didahulukan.

## Yang dapat dikerjakan segera, tanpa menunggu EP-A

Ketiganya bersandar pada mesin yang sudah matang:

**EP-B — Katalog produk dan paket.** Seed `EPESANTREN`, `ESCHOOL`, `ECAMPUS`,
dan paket `EPESANTREN_SCHOOL_FIRST` Rp 2.000 per santri aktif per bulan ke
katalog harga berversi. Memindahkan angka dari halaman pemasaran ke tempat
seharusnya, memenuhi §13.1.

**EP-C — Kepemilikan penyewa pada CMS.** Kolom `tenant_id` yang boleh null pada
`platform.website`, pencarian situs dari host, dan penjaga kepemilikan. Membuka
janji "berita disunting pondok sendiri" yang sudah tertulis.

**EP-D — Label terpesan lengkap.** Enam label kurang, dua sisi, beserta ujinya.
Kecil, dan menutup risiko R5.

## Sesudah EP-A

```text
EP-E   Presensi
EP-F   Tagihan pendidikan di atas mesin faktur
EP-G   Asrama dan penempatan kamar
EP-H   Diniyah, halaqah, kitab
EP-I   Tahfiz
EP-J   Perizinan dan gerbang
EP-K   Portal wali beserta cakupan DEPENDENT_CHILD
EP-L   Dompet santri dan batas belanja
EP-M   Anjungan dan kartu RFID
EP-N   Adapter POS, koperasi, klinik
EP-O   Nilai dan rapor
EP-P   Pelaporan
EP-Q   UAT bersama pondok pertama
EP-R   Rilis
```

## Aturan untuk setiap EP

Tidak ada EP dinyatakan selesai tanpa: migrasi aditif, API, OpenAPI, UI,
permission sisi peladen, audit, Help, uji, dokumentasi, commit, push, dan CI
hijau. §6 melarang berhenti pada skeleton, TODO, atau menu kosong.

Satu tambahan dari pengalaman sesi ini: **setiap EP diuji dengan menjalankannya
terhadap basis data lokal**, bukan hanya lewat uji unit. Cacat kebuntuan ganti
kata sandi lolos dari 2.100 uji dan baru ketahuan saat pendaftaran sungguhan
dijalankan.
