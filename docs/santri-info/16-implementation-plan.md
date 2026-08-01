# EP-0.17 — Rencana Pelaksanaan

Disusun dari kesenjangan yang benar-benar ditemukan, bukan dari urutan EP pada
perintah master. Alasannya ada pada dokumen 03: vertikal pendidikan belum ada
sama sekali, sehingga urutan yang menganggapnya ada akan tersendat pada langkah
pertama.

## Prasyarat mutlak

**EP-A — Fondasi pendidikan.** Model orang, santri, wali, unit, tahun ajaran,
dan pendaftaran santri. Tanpa ini seluruh EP lain tidak punya pijakan. Ini
pekerjaan terbesar dan harus didahulukan.

## Status EP-B, EP-C, EP-D — dikerjakan pada sesi ini

**EP-B — DONE.** Produk `EPESANTREN`/`ESCHOOL`/`ECAMPUS` dan paket
`EPESANTREN_SCHOOL_FIRST` (Rp 2.000, metrik `PER_ACTIVE_SANTRI`) tersimpan di
katalog harga berversi. `getConfig()` pada pendaftaran pesantren kini membaca
harga dari sana, bukan konstanta. Dibuktikan dengan mengubah harga langsung di
basis data ke Rp 2.500 dan melihat endpoint publik ikut berubah, lalu
dikembalikan ke Rp 2.000. Paket hanya menyertakan dua modul yang audit ini
catat `DONE` (`EPESANTREN_FOUNDATION`, `EPESANTREN_ONBOARDING`) — bukan seluruh
39 modul, sesuai larangan §6 mengklaim modul yang belum ada.

**EP-C — SEBAGIAN, sengaja dihentikan di sini.** Kolom `tenant_id` pada
`platform.website` sudah ada (aditif), dan `getSite()` sudah disaring eksplisit
`tenantId: null`. Dibuktikan dengan menyisipkan baris `Website` bertenant
`sortOrder: -999` langsung ke basis data — tanpa perbaikan, baris itu akan
memenangkan pengurutan dan tampil sebagai beranda eBisnis.id; dengan perbaikan,
beranda tetap benar.

Yang **tidak** dikerjakan, dan sengaja: membuat situs CMS per pondok.
Investigasi menemukan `CmsPage.slug` hanya unik per situs sementara `getPage()`
tidak menyaring situs sama sekali, dan `NewsArticle`/`NewsCategory` tidak punya
kolom situs sama sekali — bukan ambigu, tidak bersekat sama sekali. Lihat
eskalasi pada `09-cms-and-tenant-website-analysis.md`. Membangun di atas
fondasi yang bocor lebih berbahaya daripada menunda.

**EP-D — DONE.** Enam label terpesan yang kurang (`static`, `media`, `login`,
`register`, `demo`, `sandbox`) ditambahkan di kedua sisi — API dan peramban —
dan diikat uji yang membaca satu sama lain. Dibuktikan lewat pendaftaran
sungguhan: `login`, `demo`, `sandbox` kini ditolak sebagai alamat situs pondok.

## Sesudah EP-A

```text
EP-C2  Sekat situs per penyewa pada CmsPage dan NewsArticle (prasyarat sebelum
       situs pondok aktif — lihat eskalasi pada dokumen 09)
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
