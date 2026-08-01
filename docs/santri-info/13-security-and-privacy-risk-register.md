# EP-0.14 — Daftar Risiko Keamanan dan Privasi

Diurutkan menurut akibatnya bila terjadi, bukan menurut kemungkinannya.

| # | Risiko | Akibat | Keadaan | Penahan |
| --- | --- | --- | --- | --- |
| R1 | Wali melihat data santri lain | Kebocoran data anak; janji tertulis dilanggar | BELUM ADA PENAHAN — cakupan `DEPENDENT_CHILD` belum ada | Wajib sebelum portal wali dibuka |
| R2 | Data kesehatan terbaca seluruh pengurus | Kebocoran data kesehatan anak | BELUM ADA PENAHAN | Wajib sebelum modul klinik |
| R3 | Isi berita penyewa menjalankan skrip | Satu pondok menyerang pengunjung pondok lain | BELUM ADA PENAHAN — CMS penyewa belum ada | `sanitize-html` sudah ada di repositori |
| R4 | Domain milik pondok diklaim tanpa verifikasi | Nama pihak lain dilayani infrastruktur kita, lengkap dengan sertifikat sah | TERTAHAN sebagian — `domainBolehMelayani` menolak yang belum terverifikasi | Alur verifikasi belum dibangun |
| R5 | Subdomain terpesan direbut penyewa | `app.santri.info` menerima permintaan yang ditujukan ke pintu aplikasi | TERTAHAN — 12 label, diikat uji dua sisi | Tambahkan 6 label kurang |
| R6 | Modul terprovision tanpa entitlement | Pondok ditagih untuk yang tidak dipesan | BELUM DIUJI | Wajib menjadi uji |
| R7 | Penagihan ganda eSchool dan ePesantren | Tagihan lebih besar dari kesepakatan | BELUM ADA PENAHAN | Uji dengan data tumpang tindih |
| R8 | Data anak atau kesehatan terkirim ke AI | Pelanggaran yang tidak dapat ditarik kembali | BELUM ADA PENAHAN khusus pesantren | AI Gateway ada; penyaringnya perlu ditambah |
| R9 | Kredensial pada berkas repositori | Kebocoran akses basis data | TERTAHAN — secret scan pada CI, `.env` tidak pernah di-commit | Kredensial yang pernah disebut di luar peladen tetap harus dirotasi |
| R10 | Petugas gerbang mengubah persetujuan izin | Santri keluar tanpa izin yang sah | BELUM ADA PENAHAN | Janji tertulis; wajib menjadi uji |
| R11 | Kebuntuan ganti kata sandi | Penyewa baru tidak dapat masuk sama sekali | **DIPERBAIKI** commit `59622da` | Diikat uji yang membaca sumber kedua penjaga |

## Catatan tentang R9

Kredensial basis data pengembangan pernah disebutkan pada percakapan. Sesuai
ketentuan yang ditetapkan sendiri, ia tidak pernah ditulis ke berkas mana pun di
repositori. Rotasinya tetap perlu dijadwalkan.
