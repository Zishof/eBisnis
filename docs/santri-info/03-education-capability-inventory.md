# EP-0.4 — Inventaris Kemampuan Pendidikan

## Ringkasan

**Status keseluruhan: `MISSING`.**

Tidak ada modul pendidikan pada `apps/api/src/modules`. Tidak ada model siswa,
santri, kelas, kurikulum, jadwal, presensi, nilai, atau rapor pada 25 berkas
Prisma platform maupun 37 migrasi tenant.

## Yang dicari dan tidak ditemukan

| Kemampuan | Status |
| --- | --- |
| Master siswa/santri | MISSING |
| Wali/orang tua | MISSING |
| PPDB/PSB | MISSING |
| Kelas dan rombel | MISSING |
| Kurikulum dan jadwal | MISSING |
| Presensi | MISSING |
| Nilai dan rapor | MISSING |
| Tagihan SPP | PARTIAL — ada mesin faktur umum, belum ada tagihan pendidikan |
| Portal wali | MISSING |
| Diniyah, tahfiz, halaqah | MISSING |
| Asrama dan kamar | MISSING |
| Perizinan santri | MISSING |
| eCampus | MISSING |

## Yang SUDAH ada dan dapat dipakai ulang

Bukan pendidikan, tetapi menjadi fondasinya:

| Kemampuan | Modul | Kesiapan |
| --- | --- | --- |
| Identitas dan sesi | `auth`, `identity.prisma` | DONE |
| Penyewa dan schema | `tenant`, `tenancy.prisma` | DONE |
| Provisioning schema | `infrastructure/provisioning` | DONE — terbukti membuat 2 schema pada uji lokal |
| Entitlement dan paket | `subscription.prisma` | DONE |
| Harga dan kontrak | `pricing`, `billing` | DONE |
| Faktur dan pembayaran | `billing`, `payment` | DONE |
| Akuntansi | `accounting` | DONE |
| POS dan stok | `pos`, `catalog` | DONE |
| Koperasi | `cooperative` | DONE |
| Persuratan | `surat` | DONE |
| Notifikasi | `notification` | DONE |
| Audit | `infrastructure/audit` | DONE |
| AI Gateway | `ai` | DONE |
| CMS | `cms` | PARTIAL — lihat dokumen 09 |

## Akibat

Perintah master menyebut pekerjaan ini "integrasi vertical pada source existing,
bukan membuat aplikasi baru dari nol". Untuk lapis bersama, itu benar. Untuk
pendidikannya sendiri, **memang dari nol** — dan rencana waktu harus mengakui
itu, bukan mengasumsikan ada yang tinggal disambung.
