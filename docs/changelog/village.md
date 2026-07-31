# Changelog — info-desa (village)

Changelog modular sesuai panduan koordinasi paralel §11. Sesi Core/Integrator
menggabungkan entri terpilih ke `CHANGELOG.md` saat integrasi.

---

## D-0 — Audit dan profil Desa/Kelurahan

**Cabang:** `feature/v12-info-desa` · **Titik tolak:** `origin/main` @ `4f7ab88`

### Ditambahkan

- Sepuluh dokumen audit pada `docs/info-desa/`.
- Dua integration request pada `docs/integration-requests/village/`.
- Changelog modular ini.

Belum ada kode. D-0 adalah tahap audit.

### Temuan yang mengubah rencana

- **`WorkflowPort` tidak ada.** Perintah §7 dan spesifikasi §7 mengharuskan
  village memakai mesin workflow bersama lewat adapter. Yang ada hanya empat
  tabel `workflow_*` dari V007 — tanpa satu baris kode pun yang menjalankannya.
  Tidak ada yang dapat diadaptasi.

  D-4 membangun alur persetujuannya sendiri di balik antarmuka milik village,
  mengikuti pola `surat` yang sudah terbukti. Diajukan sebagai
  [integration request 001](../integration-requests/village/001-workflow-port.md).

- **`modules/health/` sudah terpakai, dan bukan oleh kesehatan.** Panduan
  koordinasi §4 menugaskan namespace itu kepada sesi eMedik; isinya pemeriksa
  kesehatan aplikasi (`GET /health`) yang dipakai pemantauan produksi. Bukan
  wilayah village, dilaporkan sebagai peringatan dini pada
  [integration request 002](../integration-requests/village/002-health-namespace-collision.md).

- **Tidak ada satu pun *port* formal.** Sebelas port disebut perintah §7;
  pencarian `interface *Port` mengembalikan nol hasil. Village mendefinisikan
  port sebagai antarmuka miliknya sendiri dan menulis adapter tipis ke layanan
  Core yang ada.

- **Lima dari sebelas port belum punya mitra.** `HealthAggregatePort`,
  `CooperativeIntegrationPort`, `PosIntegrationPort`, `PaymentPort`, dan
  `WorkflowPort`. Adapternya mengembalikan "belum tersedia" dengan jujur —
  tidak pernah data karangan.

### Keputusan yang dicatat

- **Kelayakan profil ditegakkan pada layanan, bukan hanya menu.** Menu yang
  disembunyikan tetapi endpoint-nya terbuka bukan pembatasan melainkan
  penyamaran. Uji kebocoran profil menyasar endpoint.
- **Membaca data penduduk ikut diaudit**, bukan hanya menulisnya. Pada
  kependudukan, penyalahgunaan berbentuk pembacaan.
- **APBDes bukan pembukuan komersial.** Yang dipakai dari Core adalah mesin
  peristiwa akuntansinya, bukan bagan akun komersialnya. Belanja melampaui pagu
  ditolak pada tingkat basis data.
- **Surat desa bukan surat kantor.** `surat_outgoing` adalah korespondensi antar
  lembaga; surat keterangan domisili adalah keluaran layanan warga. Yang dipakai
  ulang dari modul `surat` adalah penomorannya, bukan tabelnya.

### Penghalang yang diwarisi

Tiga, seluruhnya dari V8 yang tidak pernah dibangun:

| Penghalang | Akibat |
|---|---|
| Pusat Bantuan (V8-1/V8-2) | D-12 tidak dapat menyediakan Help dalam aplikasi |
| Ekspor Excel (V8-5/6) | Laporan hanya tampil di layar |
| Cetak PDF (V8-7) | **Surat tidak dapat diunduh sebagai PDF** — yang paling menyakitkan bagi vertikal ini |

Rencana sementara untuk yang ketiga: HTML siap cetak, pendekatan yang sudah
dipakai halaman Proposal/PKS/Penawaran pada Core.

### Garis dasar

Diverifikasi di dalam worktree village:

- `jest` — 45 suite, **1048 tes lulus**
- `vitest` — 4 berkas, **35 tes lulus**
- `tsc --noEmit` API dan web — bersih
- `eslint --max-warnings=0` — bersih

Sasaran D-1 sampai D-12: **sekurang-kurangnya 210 pengujian baru**.
