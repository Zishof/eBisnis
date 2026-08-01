# EP-0.11 — Analisis Peran, Hak Akses, dan Cakupan Data

## Mesin yang ada

- `infrastructure/authorization` — pemeriksaan hak akses sisi peladen.
- `PermissionGuard` dan `JwtAuthGuard` pada tiap endpoint.
- Endpoint tanpa penanda hak akses **ditolak**, bukan dibiarkan terbuka.
- Peran aktif ikut diperhitungkan saat menghitung izin.

Status mesin `DONE`.

## Cacat yang ditemukan dan diperbaiki selama audit

`PermissionGuard` menolak setiap pengguna ber-`mustChangePassword` **tanpa
pengecualian**, termasuk pada `/auth/change-password`. Akibatnya kebuntuan:
setiap penyewa baru tidak dapat menyelesaikan masuk pertama.

Diperbaiki pada commit `59622da`; daftar pengecualian kini dipakai bersama kedua
penjaga dan diikat uji yang membaca sumber keduanya.

Temuan ini menunjukkan mengapa audit dijalankan dengan **menjalankan** sistem,
bukan hanya membacanya. Cacat itu lolos dari 2.100 uji.

## Peran yang diminta

§14.5 menuntut 17 peran platform; §14.6 menuntut 41 peran tenant ePesantren.
Yang ada sekarang adalah peran umum eBisnis dan koperasi. Status `MISSING`.

## Cakupan data

§14.7 menuntut 15 tingkat cakupan (`SELF`, `DEPENDENT_CHILD`,
`ASSIGNED_DORMITORY`, dan seterusnya). Yang ada belum mengenal cakupan sehalus
itu. Status `MISSING`.

Dua yang paling mendesak dan tidak boleh ditawar:

- **`DEPENDENT_CHILD`** — wali hanya melihat anaknya sendiri. Halaman pemasaran
  sudah menjanjikannya.
- **Data kesehatan** — hanya petugas kesehatan, bukan seluruh pengurus.

Menjanjikan keduanya pada halaman lalu melanggarnya adalah pelanggaran
kepercayaan, bukan sekadar cacat.

## Pemisahan wewenang

§14.8 menuntut 12 pemisahan. Halaman pemasaran sudah menyebut dua di antaranya
kepada publik:

- pencatat, penyetuju, dan rekonsiliator keuangan adalah orang berbeda;
- petugas gerbang tidak dapat mengubah persetujuan izin.

Keduanya kini menjadi janji tertulis. Statusnya `MISSING` pada implementasi, dan
harus menjadi uji sebelum modulnya dinyatakan selesai.
