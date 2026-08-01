# D-0 · Keadaan Saat Ini

**Tanggal audit:** 31 Juli 2026
**Worktree:** `C:\opt\eBisnisGithub-info-desa`
**Branch:** `feature/v12-info-desa`
**Titik tolak:** `origin/main` @ `4f7ab88`

---

## Ringkasan

Tidak ada satu pun kode, tabel, menu, atau rute yang berkaitan dengan desa atau
kelurahan. Pencarian `village` dan `desa` di seluruh pohon sumber tidak
menghasilkan apa-apa. Vertikal ini dibangun dari nol.

Yang **ada** dan dapat menopangnya cukup banyak: 153 tabel tenant, skema per
penyewa, hak akses berjenjang dengan cakupan data dan pemisahan wewenang, jejak
audit hanya-bertambah, hub notifikasi, gerbang AI dengan bukti dan redaksi,
kerangka data contoh, CMS dan situs publik, serta tata kelola surat yang
penomorannya sudah terbukti tidak dapat kembar.

Yang **tidak ada**, dan ini yang mengubah rencana: **tiga dari sebelas
*shared port* yang disebut perintah §7 belum berwujud apa pun**, dan salah
satunya — `WorkflowPort` — adalah tumpuan D-4. Rinciannya di bawah.

---

## Tiga temuan yang mengubah rencana

### 1. `WorkflowPort` tidak ada — hanya tabelnya

Perintah §7 menyebut `WorkflowPort` sebagai port bersama yang harus dipakai, dan
spesifikasi §7 menyebut *"Gunakan workflow engine shared melalui adapter."*

Yang sesungguhnya ada hanyalah **tabel**: `workflow_definition`,
`workflow_step`, `workflow_instance`, `workflow_action_log` (V007). Pencarian
`workflow` pada seluruh `apps/api/src` hanya menemukan tiga berkas, dan
ketiganya menyebut kata itu sebagai nama tabel yang diseed — bukan sebagai mesin
yang berjalan:

```
src/cli/generate-docs.cli.ts
src/infrastructure/provisioning/tenant-bootstrap.service.ts
src/infrastructure/provisioning/tenant-menu.seed.ts
```

Tidak ada `WorkflowService`, tidak ada evaluator langkah, tidak ada mesin
transisi. **Tidak ada yang dapat diadaptasi.**

Ini bukan penghalang mutlak. Modul `surat` menyelesaikan persoalan yang sangat
mirip — persetujuan berjenjang atas dokumen — dengan alur persetujuannya
sendiri (`surat_approval_flow`, `surat_approval_flow_step`, `surat_approval`),
bukan dengan mesin generik. Pola itu terbukti bekerja.

**Keputusan:** D-4 membangun alur persetujuan layanan warga sendiri di dalam
`modules/village/`, mengikuti pola `surat`, di balik antarmuka `WorkflowPort`
yang didefinisikan village. Bila Core kelak membangun mesin generik, yang
berubah hanyalah adapter di belakang antarmuka itu. Integration request
[001](../integration-requests/village/001-workflow-port.md) mencatat kebutuhannya.

### 2. `modules/health/` sudah terpakai — dan bukan oleh kesehatan

Perintah koordinasi §4 menugaskan `apps/api/src/modules/health/**` kepada sesi
eMedik. Direktori itu **sudah ada**, dan isinya `health.module.ts` — pemeriksa
kesehatan aplikasi (`GET /health`, liveness/readiness, hitung tenant siap).

Bukan wilayah village, tetapi sesi eMedik akan menabraknya, dan tabrakan itu
lebih baik diketahui sekarang daripada saat merge. Dicatat pada integration
request [002](../integration-requests/village/002-health-namespace-collision.md)
agar sesi Core menyampaikannya.

Bagi village sendiri akibatnya kecil tetapi nyata: `HealthAggregatePort` yang
disebut §7 akan menunjuk ke vertikal eMedik, dan namanya harus disebut lengkap
supaya tidak tertukar dengan pemeriksa kesehatan aplikasi.

### 3. Tidak ada satu pun *port* formal

Perintah §7 menyebut sebelas port. Pencarian `interface *Port` pada seluruh
`apps/api/src` mengembalikan **nol hasil**. Tidak ada `AccountingEventPort`,
tidak ada `NotificationPort`, tidak ada `IdentityPort` — yang ada adalah
layanan konkret yang dipanggil langsung antar modul.

**Keputusan:** village mendefinisikan port sebagai antarmuka **milik village**
(`modules/village/ports/`), lalu menulis adapter tipis yang memanggil layanan
Core yang sudah ada. Ini memenuhi maksud aturannya — village tidak bergantung
pada bentuk dalam modul lain — tanpa menuntut Core berubah lebih dahulu.

---

## Yang sudah ada dan dapat dipakai

### Fondasi penyewa

| Kemampuan | Berkas / migrasi | Nilainya bagi village |
|---|---|---|
| Skema per penyewa | `tenant_schema_registry` + provisioner | Satu desa = satu skema. Pemisahan data antar desa berada di lapisan basis data |
| 23 migrasi tenant | `tenant-migrations/manifest.json` | Village menambah migrasi bernomor sendiri, terdaftar pada manifes yang sama |
| Pendaftaran mandiri | `modules/public/registration.service.ts` | Alur `info-desa.id → daftar → tenant siap` dapat memakai jalur yang sama |
| Pilihan data contoh saat mendaftar | Baru saja dibereskan pada Core | Desa baru dapat memilih ikut atau tidak menyertakan 100–500 penduduk contoh |

### Identitas dan wewenang

| Kemampuan | Nilainya bagi village |
|---|---|
| 133 menu, 40 aksi hak akses | Katalog menu village ditambahkan sebagai katalog modular tersendiri |
| Cakupan data per pengguna (`user_scope_assignment`) | Ketua RT hanya melihat warga RT-nya. Sudah ditegakkan pada kueri, bukan sekadar disimpan |
| Pemisahan wewenang (`segregation_of_duty_rule`) | Operator yang mengusulkan penerima bantuan tidak boleh menyetujuinya sendiri |
| Peran aktif tercatat pada audit (V017) | Menjawab "dalam kapasitas apa" — penting ketika satu orang menjabat lebih dari satu peran di desa kecil |
| Step-up authentication | Untuk tindakan sensitif seperti penetapan penerima bantuan |

### Surat dan penomoran

Modul `surat` (V018/V019, sepuluh tabel master + empat tabel transaksi)
menyediakan yang paling langsung terpakai:

- `SuratNumberService` — penomoran yang **dijamin tidak kembar bahkan di bawah
  permintaan bersamaan**, sudah dibuktikan pada V10-6. Surat desa memerlukan
  jaminan yang persis sama.
- `surat_approval_flow` + `surat_approval_flow_step` — pola persetujuan
  berjenjang yang dapat ditiru untuk layanan warga.
- `surat_classification`, `surat_retention_period`, `surat_locker` — klasifikasi
  dan retensi arsip; register desa memerlukan hal serupa.
- `surat-state.ts` — mesin transisi status dokumen.

Catatan penting: surat desa **bukan** surat kantor. `surat_outgoing` adalah
korespondensi resmi antar lembaga; surat keterangan domisili adalah **keluaran
layanan warga**, yang pemohonnya warga dan alurnya dimulai dari permohonan.
Keduanya tidak boleh dipaksa menjadi satu tabel. Yang dipakai ulang adalah
penomoran dan polanya, bukan tabelnya.

### Lainnya

| Kemampuan | Keadaan | Catatan |
|---|---|---|
| Hub notifikasi | Berjalan | Pengelompokan, SLA, preferensi. Kanal WhatsApp/surel belum berkredensial |
| Gerbang AI | Berjalan | 18 keperluan, bukti, redaksi, kuota, batas kewenangan. Village menambah keperluannya sendiri |
| Peristiwa akuntansi | Berjalan | `accounting_event` + aturan posting berbasis data. APBDes memakainya lewat adapter |
| CMS dan situs publik | Berjalan | Halaman, blok, berita, kategori. Situs desa memakai pola yang sama |
| Kerangka data contoh | Berjalan | Golongan `REFERENCE`/`EXAMPLE`, pembersihan yang tidak melumpuhkan |
| Observabilitas | Berjalan | Galat, kinerja, aktivitas antarmuka, riwayat masuk |
| Pusat Bantuan | **Tidak ada** | V8-1/V8-2 belum pernah dibangun. D-12 akan terhalang |
| Ekspor Excel | **Tidak ada** | V8-5/6 belum dibangun. Laporan village hanya dapat tampil di layar |
| Cetak PDF | **Tidak ada** | V8-7 belum dibangun. Surat desa memerlukan ini — lihat catatan risiko di [07](07-implementation-plan.md) |

---

## Yang tidak boleh disentuh

Sesuai perintah §3, village tidak mengubah:

```
shared identity/auth          global tenant resolver
shared workflow engine        shared accounting
shared inventory/POS          eMedik internals
eKoperasi internals           root package/lockfile
root Prisma loader            global menu/role registry
root OpenAPI/Orval            root CHANGELOG
CI
```

Perubahan yang diperlukan diajukan lewat
`docs/integration-requests/village/`.

Catatan tentang `CHANGELOG.md`: village memakai `docs/changelog/village.md`
sesuai perintah koordinasi §11.

---

## Berkas rujukan

- [01 — Peta profil desa dan kelurahan](01-desa-kelurahan-profile-map.md)
- [02 — Peta domain](02-domain-map.md)
- [03 — Matriks pakai-ulang / perluas / bangun-baru](03-reuse-extend-create-matrix.md)
- [04 — Kontrak kesehatan, koperasi, dan POS](04-health-cooperative-pos-contracts.md)
- [05 — Kontrak keuangan dan workflow](05-finance-workflow-contracts.md)
- [06 — Keamanan dan privasi](06-security-privacy.md)
- [07 — Rencana pelaksanaan](07-implementation-plan.md)
- [08 — Garis dasar pengujian](08-test-baseline.md)
- [09 — Daftar integration request](09-integration-requests.md)
