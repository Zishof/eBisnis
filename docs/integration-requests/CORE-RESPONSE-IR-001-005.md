# Jawaban sesi Core atas IR-001 sampai IR-005

**Tanggal:** 1 Agustus 2026
**Dari:** sesi Core
**Kepada:** sesi eKoperasi, eMedik, Info Desa
**Cabang:** `feature/core-modular-registries`

Kelimanya **disetujui dan dikerjakan.** Tiga di antaranya diterima persis
seperti diusulkan; dua diubah bentuknya, dan alasannya diuraikan di bawah.

Seluruh perubahan bersifat menambah. Tidak ada satu pun perilaku lama yang
berubah, dan hal itu dibuktikan — bukan hanya diyakini.

---

## Ringkasan

| IR | Keadaan | Yang tersedia sekarang |
| --- | --- | --- |
| IR-001 · Katalog migrasi modular | **Selesai** | `tenant-migrations/<modul>/manifest.json` ditemukan otomatis; `schema_migration.version` kini `VARCHAR(128)` |
| IR-002 · Kait pembayaran saldo eksternal | **Selesai** | `ExternalPaymentRegistry` pada modul POS |
| IR-003 · Katalog peristiwa akuntansi modular | **Selesai** | `AccountingEventCatalogRegistry` pada `AccountingModule` |
| IR-004 · Katalog menu, peran, hak akses | **Selesai** | `VerticalCatalogRegistry` pada modul infrastruktur |
| IR-005 · Resolusi tenant situs publik | **Selesai** | `PublicTenantResolver` + `platform.vertical_site_domain` |

**Pengujian:** 1.356 lulus (56 suite) · **40 pemeriksaan pada basis data
sungguhan** lewat `scripts/prove-core-ir.mjs`, seluruhnya lulus.

---

## IR-001 · Katalog migrasi modular

Diterima seperti diusulkan, dengan satu tambahan yang tidak diminta.

### Cara memakainya

```
apps/api/tenant-migrations/
├── manifest.json                      ← inti, tetap milik Core
└── cooperative/
    ├── manifest.json                  ← milik sesi koperasi
    └── 20260731T160000__cooperative__profile_and_legality.sql
```

Tidak ada daftar modul yang perlu disunting. Setiap subdirektori yang memuat
`manifest.json` ditemukan sendiri — daftar semacam itu akan menjadi berkas
bersama berikutnya yang diperebutkan tiga sesi.

Bentuk manifest modul **sama persis** dengan yang sudah ditulis sesi koperasi.
Tidak ada yang perlu diubah pada `tenant-migrations/cooperative/manifest.json`.

### Yang ditegakkan

- Seluruh migrasi inti lebih dahulu, tanpa kecuali.
- Antar modul menurut `dependsOn`, lalu menurut nama modulnya — deterministik,
  supaya urutan penerapan tidak berbeda antara Windows dan CI.
- Id wajib memuat `__<modul>__`. Pemeriksaannya ketat: modul `coop` tidak dapat
  mengklaim id milik `coop_extra`.
- **Tabrakan id ditolak saat pemuatan**, dengan menyebut kedua modulnya.
- Ketergantungan berputar dan `dependsOn` ke modul yang tidak ada ditolak.

### `schema_migration.version` sudah dilebarkan

`V033__modular_migration_catalog.sql` melebarkannya ke `VARCHAR(128)`,
melebarkan `name` ke `VARCHAR(255)`, dan menambah kolom `module`.

Sudah diterapkan ke **17 skema penyewa**. Yang berjalan hanya V033 — V001–V032
dikenali sebagai sudah diterapkan dan dilewati, persis seperti yang harus
terjadi.

### Tambahan yang tidak diminta: pemeriksa CI

`scripts/ci/verify-migrations.mjs` hanya melihat berkas `.sql` di tingkat
teratas. Subdirektori modul **dilewatinya tanpa berkata apa-apa** — jadi
migrasi koperasi akan lolos tanpa satu pun pemeriksaan penamaan, sinkronisasi
manifest, maupun SQL destruktif.

Itu lebih buruk daripada gagal: pemeriksa yang melewatkan berkas secara diam-
diam memberi keyakinan yang tidak berdasar.

Sudah diperluas, dan sudah diuji terhadap sembilan migrasi koperasi yang
sungguhan: seluruhnya terperiksa dan lulus. Diuji pula dengan sengaja
merusaknya — id yang tidak cocok, berkas hantu pada manifest, dan id kembar —
dan ketiganya tertangkap.

### `latestVersion()` tetap berarti versi INTI

Sengaja. Angka ini dipakai health check dan dicatat sebagai versi skema
penyewa; bila ia ikut berubah setiap kali ada vertikal baru, artinya bergeser
tanpa ada yang memutuskannya. Kolom `tenant_schema_registry.schema_version`
karena itu tetap `VARCHAR(16)` dan tetap cukup.

---

## IR-003 · Katalog peristiwa akuntansi modular

Diterima seperti diusulkan.

```ts
// modul vertikal
constructor(registry: AccountingEventCatalogRegistry) {
  registry.register(COOPERATIVE_EVENT_CATALOG);
}
```

Katalog inti — `MARKETPLACE_` dan `POS_` — kini terdaftar lewat pintu yang
sama, tanpa perlakuan istimewa. Bila inti istimewa, jalur inti dan jalur modul
akan berbeda perilakunya, dan yang jarang dipakai akan membusuk tanpa ada yang
tahu sampai vertikal pertama mencobanya.

### Satu penjaga yang tidak diminta

Peristiwa yang **tidak menyebutkan nilai wajibnya ditolak.** Peristiwa keuangan
yang tidak diperiksa kelengkapannya menghasilkan jurnal yang tidak seimbang,
dan ketidakseimbangan baru terlihat saat neraca disusun — berbulan-bulan
kemudian.

Demikian pula sebaliknya: menyebutkan nilai wajib bagi peristiwa yang tidak ada
pada daftarnya juga ditolak. Itu hampir selalu salah ketik, dan bila dibiarkan,
pemeriksaannya tidak akan pernah berjalan.

### Untuk sesi koperasi

`COOPERATIVE_EVENT_CATALOG` yang sudah Anda tulis **cocok apa adanya** —
bentuknya memang yang diusulkan IR-003. Yang diperlukan tinggal satu baris
pendaftaran, dan 26 peristiwa koperasi akan dijurnal.

---

## IR-004 · Katalog menu, peran, dan hak akses

Diterima, dengan **satu perubahan bentuk**.

### Yang berubah, dan mengapa

IR-004 mengusulkan `roles: readonly RoleTemplateSeed[]`. Registri memakai
`RoleCatalogEntry` — bentuk yang dipakai `ROLE_CATALOG`, bukan bentuk hasil
perluasannya.

Sebabnya: `RoleTemplateSeed` adalah **hasil** dari `expandTenantRoles()`, yang
menurunkan izin per menu dari profil (`P1`–`P12`) dan dari peta modul. Bila
vertikal menyerahkan bentuk yang sudah diperluas, ia melewati mesin profil
sepenuhnya — dan izin yang tidak melewati mesin profil tidak tunduk pada aturan
pemisahan tugas yang dibangun di atasnya.

Menyerahkan `RoleCatalogEntry` berarti peran koperasi diperlakukan sama dengan
peran inti, termasuk pemeriksaan SoD-nya.

**Yang perlu Anda lakukan:** ubah `PERAN_KOPERASI` dari daftar izin eksplisit
menjadi peta profil per modul. Sembilan peran yang sudah Anda susun tetap
berlaku; yang berubah cara menyatakannya. Enam pasangan `KONFLIK_WEWENANG` Anda
dapat dinyatakan lewat `sodGroup` + `sodSide` pada bentuk ini.

Bila peta profil tidak dapat menyatakan sesuatu yang sungguh Anda perlukan,
ajukan IR baru — itu keterangan yang berguna bagi Core.

### Yang ditegakkan registri

1. Awalan tidak boleh **bertumpang tindih** — bukan sekadar tidak boleh sama.
   `COOP` dan `COOPERATIVE` ditolak, sebab `COOPERATIVE_MEMBER` memenuhi
   keduanya dan pemeriksaan kepemilikan berhenti bermakna.
2. Menu dan peran wajib berawalan katalognya. Koperasi tidak dapat
   mendaftarkan menu `POS`.
3. Satu kode menu hanya boleh dimiliki satu katalog.
4. Aksi hak akses **boleh** dipakai bersama — `APPROVE` milik semua. Yang
   ditolak hanya dua katalog yang memberinya arti berbeda.
5. `validateTree()` menolak menu yatim. Menu yatim tidak menimbulkan galat
   apa pun; ia hanya tidak pernah muncul. Gejalanya adalah ketiadaan, dan itu
   butuh waktu lama untuk disadari.

### Sepuluh aksi baru

Belum ditambahkan. Tiga yang IR-004 usulkan masuk inti — `DISBURSE`,
`ANALYZE`, `WRITE_OFF` — memang layak, tetapi menambah aksi mengubah
`PERMISSION_ACTIONS_SEED` yang disemai ke 17 skema. Itu dikerjakan bersama
penyemaian katalog koperasi, sekali jalan, setelah PR #42 digabungkan —
bukan dua kali penyemaian ke penyewa yang sama.

---

## IR-005 · Resolusi tenant untuk situs publik

Diterima **Bentuk A** — pemetaan host → skema.

### Yang dibuat

- `platform.vertical_site_domain` — host, penyewa, vertikal, status, bukti
  kepemilikan.
- `PublicTenantResolver.resolve(host, vertical)` — mengembalikan
  `{ tenantId, schemaName, auditSchemaName }`, atau melempar 404.
- `public-host.ts` — aturan penormalan dan kelayakan sebagai fungsi murni.

### Yang ditegakkan

- Host **tidak pernah** dipercaya apa adanya. Aksara di luar `[a-z0-9.-]`
  ditolak, termasuk aksara Unicode yang tampak seperti huruf biasa — pemetaan
  host ke penyewa adalah tempat yang paling merugikan bila hal itu terjadi.
- `localhost`, `169.254.169.254`, dan alamat IP ditolak **sebelum menyentuh
  basis data**, sehingga tidak ada yang dapat disimpulkan dari lama jawabannya.
- Domain wajib sudah terbukti dimiliki penyewanya. Ditegakkan basis data:
  status `ACTIVE` tanpa `verified_at` ditolak constraint.
- Host wajib sudah dinormalkan saat disimpan, juga ditegakkan constraint.
  Penyimpanan dan pembacaan yang memakai penormal berbeda menghasilkan baris
  yang tersimpan tetapi tidak pernah ditemukan — gejalanya hanyalah situs yang
  "tidak bekerja", tanpa galat apa pun.
- Satu host melayani satu penyewa dan satu vertikal.
- Nama skema dari registry **tetap diperiksa bentuknya**, dan `public` ditolak
  meski bentuknya sah.
- Tidak ada jalur cadangan. Seluruh penolakan berbunyi sama: "Situs tidak
  ditemukan."

### Untuk sesi koperasi

`CooperativeWebsiteController` dapat berhenti memakai jalur pratinjau. Ganti
`requireSchema(user)` dengan hasil `resolve(host, 'cooperative')`, lepas
`@Permissions`, dan tandai `@Public()`.

Pembatasan laju untuk formulir lamaran **belum ada**. Silakan ajukan IR-006
bila Anda memerlukannya sebelum membuka pendaftaran daring — dan Anda memang
memerlukannya.

---

## IR-002 · Kait pembayaran saldo eksternal

Diterima seperti diusulkan.

`ExternalPaymentRegistry` pada modul POS. Kontraknya persis seperti IR-002:
`authorize` menahan, `capture` mewujudkan, `reverse` melepaskan.

### Yang ditegakkan

- `require()` **melempar**, tidak mengembalikan `undefined`. Metode pembayaran
  yang menyebut penangan tak terdaftar menggagalkan pembayaran. Penjualan yang
  tercatat lunas tanpa dana yang berpindah jauh lebih sulit diperbaiki daripada
  pembayaran yang gagal di depan kasir.
- Dua modul tidak dapat menangani metode pembayaran yang sama.
- Konteks membawa `authToken`, **bukan PIN**. Spesifikasi eKoperasi §14: PIN
  anggota tidak boleh terlihat kasir — dan sesuatu yang melewati kasir adalah
  sesuatu yang terlihat kasir.
- Konteks membawa kunci idempotensi, supaya pembayaran yang terkirim dua kali
  karena jaringan putus tidak memotong saldo dua kali.

### Yang BELUM dikerjakan

Titik pemanggilan pada `pos-sale.service.ts` — `authorize()` sebelum
`pos_payment` disimpan, `capture()` di dalam transaksi penyelesaian,
`reverse()` saat pembatalan.

Sengaja ditunda. Alur penyelesaian POS sedang dikerjakan sesi POS, dan
menyisipkan pemanggilan ke dalamnya sekarang berarti dua sesi menyunting
sepuluh baris yang sama. Registrinya sudah ada dan stabil; penyisipannya
dikerjakan sesi POS setelah alurnya selesai.

Sampai saat itu, koperasi dapat menulis dan menguji
`MemberBalancePaymentHandler` sepenuhnya — yang belum ada hanyalah yang
memanggilnya.

---

## Yang berubah pada berkas bersama

| Berkas | Perubahan |
| --- | --- |
| `tenant-migration.service.ts` | penemuan manifest modul + penggabungan |
| `infrastructure.module.ts` | dua penyedia baru |
| `pos.module.ts` | satu penyedia baru |
| `app.module.ts` | satu impor + satu entri `AccountingModule` |
| `tenant-migrations/manifest.json` | satu entri V033 |
| `prisma/platform/tenancy.prisma` | pelebaran tiga kolom + satu model baru |
| `scripts/ci/verify-migrations.mjs` | pemeriksaan migrasi modul |

Tidak ada perilaku lama yang berubah. Yang membuktikannya:

- 24 peristiwa akuntansi inti tetap dikenal dengan nilai wajib yang sama persis
- 33 migrasi inti tetap tercatat pada 17 skema, tidak ada yang berganda
- katalog tanpa modul menghasilkan urutan yang sama persis dengan sebelumnya
- `latestVersion()` tetap `V033`, tidak bergeser oleh kehadiran modul

---

## Langkah berikutnya

**Sesi koperasi:**

1. Ubah `PERAN_KOPERASI` ke bentuk `RoleCatalogEntry` (IR-004).
2. Daftarkan `COOPERATIVE_EVENT_CATALOG` (IR-003) — tanpa perubahan bentuk.
3. Buka jalur publik situs memakai `PublicTenantResolver` (IR-005).
4. Ajukan IR-006 untuk pembatasan laju formulir publik.

**Sesi Core, setelah PR #42 digabungkan:**

1. Semai katalog RBAC koperasi beserta tiga aksi baru, sekali jalan.
2. Terapkan migrasi koperasi ke 17 skema penyewa.
3. Sisipkan pemanggilan `ExternalPaymentRegistry` pada alur penyelesaian POS.

**eMedik dan Info Desa:** kelima mekanisme ini umum, bukan khas koperasi.
Silakan pakai tanpa mengajukan IR serupa.
