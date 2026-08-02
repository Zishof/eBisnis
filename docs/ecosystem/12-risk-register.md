# ECO-0 — Daftar risiko

| # | Risiko | Dampak | Kemungkinan | Penanganan |
| --- | --- | --- | --- | --- |
| R1 | 14 dari 17 dokumen rujukan §2 tidak tersedia | Rancangan ECO-1+ dibuat tanpa BRD yang §3 tetapkan sebagai sumber kebenaran | **sudah terjadi** | Audit dikerjakan dari source; keputusan rancangan vertical menunggu dokumen atau keputusan tertulis pemilik |
| R2 | Schema registry satu-per-tenant vs §11 satu-per-modul | Menyentuh jalur terpanas: koneksi, `search_path`, migrasi, audit | tinggi | Perpindahan aditif berdampingan; modul lama tidak dipindah (lihat 07) |
| R3 | Penomoran migrasi tenant berurut global | Dua cabang memakai nomor sama **tanpa konflik Git** | **tinggi** | Pindah ke penomoran bercap waktu §38, atau jatah rentang per vertical — keputusan pemilik |
| R4 | `tenant-menu.seed.ts` sebagai katalog tunggal | Konflik berulang antar seluruh vertical | tinggi | ECO-3 memindahkannya ke manifest berversi |
| R5 | Tidak ada OIDC | SSO lintas lima domain tidak dapat dibangun tanpa melanggar §5 | pasti | ECO-2 menambah IdP di depan model identitas yang ada; model pengguna tidak dibuang |
| R6 | Tidak ada usage metering | Harga §15–§17 tidak dapat ditagihkan | pasti | Metering mendahului seed harga; urutan §46 disesuaikan (lihat 10) |
| R7 | Tidak ada `DataSharingAgreement` | Kolaborasi §30 tidak boleh dijalankan; §2321 melarang rilis | pasti | ECO-9b sebelum kolaborasi lintas vertical mana pun |
| R8 | eMedik (40 commit) dan info-desa (24 commit) belum tergabung | Integrator merancang di atas keadaan yang akan berubah | tinggi | Peta port dibuat dari kontrak, bukan dari tabel; koordinasi lewat integration request |
| R9 | Tidak ada PostgreSQL terjangkau saat audit | Klaim keadaan basis data tidak terverifikasi | **sudah terjadi** | Seluruh klaim dinyatakan berasal dari source; verifikasi basis data ditandai belum dilakukan |
| R10 | Port lintas vertical hidup di dalam modul koperasi | Vertical berikutnya menyalinnya, melanggar §1394 | sedang | ECO-9a memindahkannya lebih dahulu, sebelum penggabungan |
| R11 | Help dan Excel/PDF framework belum ada | §2349 menuntut "Help" pada tiap perubahan logis | **sudah terjadi** | Disebut terbuka; tuntutan itu belum dapat dipenuhi sampai kerangkanya dibangun |
| R12 | Lima portal menuntut lima CMS site, tema, SEO, konten | Pekerjaan konten besar di luar kode | sedang | ECO-1 menyiapkan registry dan kerangka; pengisian konten pekerjaan terpisah |

## Kondisi berhenti §65 yang dipantau

Tidak satu pun sedang terpenuhi:

- tidak ada secret terdeteksi;
- tidak ada migrasi destruktif yang diperlukan;
- autentikasi GitHub bekerja;
- belum ada konflik kontrak antar cabang vertical;
- tidak ada risiko kehilangan data;
- tidak ada pelanggaran privasi lintas vertical.

R1 dan R3 **bukan** kondisi berhenti, tetapi keduanya keputusan pemilik yang
menghalangi tahap tertentu. Keduanya disebut di
[10-implementation-plan.md](10-implementation-plan.md).
