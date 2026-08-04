# Gap Analysis ePesantren dan eSchool — 2026-08-04

Dokumen ini memperbarui matriks lama `03`, `04`, dan `05` berdasarkan source aktual
pada `main`, bukan berdasarkan rencana awal. Status mengikuti perintah master:
`DONE`, `PARTIAL`, `MISSING`, `BROKEN`, `CONFLICTING`, `BLOCKED`, `NOT_APPLICABLE`.

## Ringkasan

| Area | Status | Bukti source | Sisa kerja |
|---|---|---|---|
| Portal `santri.info` | DONE | `SantriLayout`, `SantriInfoHomePage`, dokumen proposal/penawaran/presentasi/PKS | Gambar portal umum masih slot statis, belum CMS platform |
| Situs publik pondok | DONE | `SitusPondokPage`, `SitusUnitPage`, `PesantrenPublicController` | Galeri/agenda khusus pondok belum menjadi modul mandiri |
| Admin gambar situs pondok | DONE | `PesantrenProfilPage`, `PesantrenProfilController.gambar()` | Manajemen galeri multi-foto belum ada |
| Unit pendidikan/sekolah | DONE | `PesantrenUnitPendidikanPage`, `pesantren-unit-pendidikan.controller.ts` | Integrasi Dapodik/EMIS resmi belum ada |
| Santri, wali, dan data Dapodik dasar | DONE | `PesantrenSantriPage`, `pesantren-santri.controller.ts` | Akun login santri pribadi belum dibuat |
| Asrama, kamar, penempatan | DONE | `PesantrenAsramaPage`, `pesantren-asrama.controller.ts` | Peta visual kamar/bed belum ada |
| Diniyah, kitab, halaqah | DONE | `PesantrenDakwahPage`, `pesantren-diniyah.controller.ts` | Materi digital/kitab digital belum ada |
| Tahfiz | DONE | `PesantrenDakwahPage`, `pesantren-tahfiz.controller.ts` | Target hafalan otomatis dan analitik tajwid belum ada |
| Rombongan, kurikulum, jadwal | DONE | `PesantrenKelasKurikulumPage`, `PesantrenJadwalPage`, `pesantren-kurikulum.controller.ts` | Kalender akademik lintas kurikulum belum penuh |
| Presensi santri | DONE | `PesantrenPresensiPage`, `pesantren-presensi.controller.ts` | Integrasi alat biometrik belum ada |
| Guru, absensi guru, piket | DONE | `PesantrenGuruPage`, `PesantrenAbsensiGuruPage`, controller terkait | Payroll guru spesifik pesantren memakai core payroll, belum layar khusus |
| Nilai, rapor, skala huruf | DONE | `PesantrenNilaiPage`, `PesantrenSkalaHurufPage`, `pesantren-nilai.controller.ts` | Cetak rapor final per template sekolah belum penuh |
| PSB/PPDB dan portal pendaftar | DONE | `PesantrenPsbPage`, `PsbGelombangPage`, `PsbPendaftaranPage`, `PsbDashboardPage` | Payment gateway biaya pendaftaran belum penuh |
| Perizinan dan gerbang | DONE | `PesantrenPerizinanPage`, `PesantrenGerbangPage`, controller terkait | Integrasi perangkat gerbang/RFID fisik belum ada |
| Pelanggaran, pembinaan, prestasi | DONE | `PesantrenPembinaanPage`, controller pelanggaran/prestasi/ekskul | Bimbingan konseling mendalam belum modul tersendiri |
| Kartu santri dan kiosk | DONE | `PesantrenKartuPage`, `PesantrenKioskPage`, controller terkait | Mode kiosk perangkat keras terkunci belum ada |
| Dompet santri | DONE | `PesantrenDompetPage`, `pesantren-dompet.service.ts` | Refund/retur POS ke dompet masih dicatat sebagai batasan |
| Tagihan SPP | DONE | `PesantrenTagihanPage`, `pesantren-tagihan.controller.ts` | Integrasi VA/QRIS eksternal belum penuh |
| Dapur dan katering | DONE | `PesantrenKateringPage`, `pesantren-katering.controller.ts` | Perencanaan gizi otomatis belum ada |
| Portal wali | DONE | `PesantrenPortalWaliPage`, `pesantren-portal-wali.controller.ts` | Notifikasi WhatsApp/push tergantung kredensial kanal |
| Laporan pesantren | DONE | `PesantrenDashboardPage`, `PesantrenLaporanPage`, `pesantren-laporan.controller.ts` | Designer laporan mandiri belum ada |

## Gap Yang Masih Belum Selesai

| Prioritas | Gap | Status | Alasan |
|---|---|---|---|
| P1 | eSchool umum di luar pesantren | PARTIAL | Pesantren sudah punya sekolah/unit pendidikan, tetapi produk `enterprise-education.id` / eSchool umum belum menjadi portal penuh dengan landing, onboarding, katalog, dan dokumen sendiri |
| P1 | CMS gambar portal umum `santri.info` | PARTIAL | Situs pondok bisa upload logo/hero/berita, tetapi gambar portal umum masih dikelola di source |
| P1 | Template rapor/cetak final sekolah | PARTIAL | Nilai dan skala huruf ada; layout rapor final per jenjang/kop sekolah belum lengkap |
| P2 | Integrasi pembayaran eksternal PSB/SPP | PARTIAL | Tagihan dan bayar tercatat; VA/QRIS/payment gateway khusus pendidikan belum penuh |
| P2 | Buku tamu, paket santri, antar-jemput | MISSING | Belum ada controller/UI khusus |
| P2 | Perpustakaan manual dan digital | MISSING | Dicantumkan sebagai pilar, belum ada modul source |
| P2 | Klinik pesantren terhubung eMedik | PARTIAL | eMedik ada sebagai vertikal terpisah; adapter pesantren-ke-eMedik belum selesai |
| P3 | AI use case pesantren | MISSING | AI Gateway ada; prompt/workflow khusus pembinaan, ringkasan wali, dan perangkat ajar belum ada |
| P3 | Integrasi alat RFID/biometrik nyata | PARTIAL | Kartu, kiosk, presensi, dan gerbang ada; adapter perangkat fisik belum ada |

## Koreksi Dokumen Komersial

`KESIAPAN_SEKARANG` di `konten-pesantren.ts` sudah diperbarui agar tidak lagi
menempatkan `tahfiz`, `asrama`, atau `anjungan` sebagai pekerjaan bertahap.
Ketiganya sekarang punya API dan UI.

## Prinsip UI/UX Yang Dipakai Untuk Perbaikan Lanjutan

1. Navigasi dan IA harus mudah dipindai; modul banyak dikelompokkan sebagai aksi
   harian, bukan daftar panjang tanpa prioritas.
2. Mobile-first: tombol dan kartu operasional dibuat cukup besar untuk sentuhan.
3. Gambar harus membantu orientasi domain; gambar publik memiliki alt/fallback,
   sedangkan gambar pondok dapat diganti lewat admin profil/berita.
4. Dasbor setelah login harus membuka pekerjaan utama: santri, diniyah/tahfiz,
   perizinan, dan tagihan.
