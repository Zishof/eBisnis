# D-0 · Daftar Integration Request

Indeks permintaan perubahan lintas batas yang diajukan sesi info-desa.

Perintah §3 menetapkan jalurnya: perubahan pada file bersama tidak dilakukan
langsung dari cabang vertikal, melainkan diajukan sebagai dokumen agar sesi
Core meninjaunya.

---

## Diajukan

| No | Judul | Sifat | Untuk | Keadaan |
|---|---|---|---|---|
| [001](../integration-requests/village/001-workflow-port.md) | `WorkflowPort` | Bukan pemblokir | Core | Diajukan |
| [002](../integration-requests/village/002-health-namespace-collision.md) | Tabrakan namespace `modules/health/` | Peringatan dini | Core, eMedik | Diajukan |
| [003](../integration-requests/village/003-village-scope-types.md) | Jenis cakupan wilayah desa pada `user_scope_assignment` | Bukan pemblokir | Core | Diajukan |

---

## 001 — `WorkflowPort`

**Ringkas:** Perintah §7 dan spesifikasi §7 mengharuskan village memakai mesin
workflow bersama lewat adapter. Mesin itu belum ada — yang ada hanya empat tabel
`workflow_*` dari V007, tanpa satu baris kode pun yang menjalankannya.

**Yang diminta:** kontrak `WorkflowPort` beserta implementasinya di Core, bila
dan ketika Core memutuskan membangunnya.

**Yang dikerjakan village sementara:** implementasi sendiri di dalam
`modules/village/`, di balik antarmuka `WorkflowPort` milik village, mengikuti
pola `surat` yang sudah terbukti. Penggantiannya kelak hanya menyentuh satu
adapter.

**Mengapa bukan pemblokir:** D-4 dapat berjalan penuh tanpa Core berubah.

---

## 002 — Tabrakan namespace `modules/health/`

**Ringkas:** Panduan koordinasi §4 menugaskan `apps/api/src/modules/health/**`
kepada sesi eMedik. Direktori itu sudah ada dan berisi pemeriksa kesehatan
aplikasi (`GET /health`) yang dipakai pemantauan produksi.

**Yang diminta:** keputusan sesi Core atas tiga pilihan; village menyarankan
memberi eMedik namespace `modules/emedik/` karena pilihan lain menyentuh jalur
pemantauan produksi demi keuntungan penamaan.

**Bukan wilayah village.** Dilaporkan karena tabrakan yang diketahui saat audit
jauh lebih murah daripada yang diketahui saat merge.

---

## Yang diperkirakan menyusul

Belum diajukan; dicatat agar terlihat lebih awal.

| Perkiraan | Tahap | Alasan |
|---|---|---|
| Registrasi katalog menu vertikal | D-3 | Registri menu global dikelola Core. Village menyediakan katalog modular; Core perlu kontrak plugin yang mengimpornya |
| ~~Jenis cakupan pada `ck_user_scope_type`~~ | ~~D-3~~ | **Sudah diajukan sebagai 003.** Perkiraan ini terbukti tepat, dan constraint yang tertabrak persis jenisnya |
| Profil peran vertikal pada constraint | D-3 | `ck_role_module_profile_code` membatasi kode profil (`P0-P12`, `M1-M9`). Peran village memerlukan kode profilnya sendiri — persis pola V012 yang dahulu memperluasnya untuk marketplace |
| Agregasi OpenAPI | D-12 | `openapi-village.json` perlu digabung Core |
| Cetak PDF | D-4 | Bila HTML siap cetak tidak mencukupi untuk surat resmi. Lihat catatan risiko pada [07](07-implementation-plan.md) |
| Dependency baru | bila ada | Dicatat pada `dependencies.md`, tidak mengubah lockfile dari cabang ini |

Perkiraan kedua patut diperhatikan: `ck_role_module_profile_code` adalah
constraint basis data pada tabel bersama. Village tidak dapat menambah kode
profilnya tanpa mengubahnya, dan itu tepat jenis perubahan yang perintah §3
larang dilakukan langsung. Pola penyelesaiannya sudah ada — V012 melakukannya
untuk marketplace — sehingga permintaannya kelak dapat menunjuk contoh yang
sudah pernah dikerjakan.

---

## Cara village bekerja sementara menunggu

Prinsip yang dipegang, dan alasan masing-masing:

1. **Definisikan antarmuka di sisi village.** Village tidak menunggu Core
   menyediakan port; ia mendefinisikan apa yang dibutuhkannya dan menulis
   adapter tipis ke layanan yang ada.

2. **Adapter yang belum ada mitranya mengembalikan "belum tersedia" dengan
   jujur.** Tidak pernah data karangan. Data karangan pada kontrak yang belum
   ada adalah cara tercepat membuat fitur tampak jadi padahal belum, dan
   kekeliruannya baru ketahuan saat penyewa sungguhan memakainya.

3. **Katalog modular, bukan tambahan pada berkas global.** Menu, peran, dan hak
   akses village tinggal di berkasnya sendiri.

4. **Tidak ada akses tabel lintas vertikal.** Dijaga uji ketergantungan pada
   D-12, bukan hanya oleh aturan tertulis — aturan yang hanya tertulis akan
   dilanggar suatu hari oleh orang yang belum membacanya.

5. **`docs/changelog/village.md`, bukan `CHANGELOG.md`.** Sesuai panduan
   koordinasi §11.
