# IR-001 · Katalog migrasi modular per vertikal

**Dari:** sesi eKoperasi (`feature/v12-ekoperasi`)
**Kepada:** sesi Core / Integrator
**Tanggal:** 31 Juli 2026
**Sifat:** **Pemblokir** bagi tiga vertikal sekaligus
**Berkas bersama:** `apps/api/tenant-migrations/manifest.json`,
`apps/api/src/infrastructure/provisioning/tenant-migration.service.ts`

---

## Kebutuhan

Panduan koordinasi §7 menghendaki:

```
<timestamp>__cooperative__<description>
register migration pada TenantModuleMigrationCatalog
jangan memakai nomor urut global manual yang mudah bentrok
```

**`TenantModuleMigrationCatalog` belum ada**, dan pemuat migrasi hanya mengenal
satu manifest bernomor urut.

## Keadaan sekarang

`tenant-migration.service.ts` membaca satu berkas:

```ts
const manifestPath = join(this.migrationsDir, 'manifest.json');
this.manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
```

`manifest.json` berisi 23 entri `V001`–`V023`, masing-masing dengan `sequence`
berupa bilangan bulat berurutan.

## Mengapa ini berbahaya, bukan sekadar merepotkan

Bila tiga vertikal sama-sama menambahkan ke berkas itu:

1. **Konflik pada setiap penggabungan.** Merepotkan, tetapi terlihat.
2. **Dua migrasi berbeda memakai nomor sama.** Inilah yang berbahaya.
   `schema_migration` mencatat versi yang sudah diterapkan. Penyewa yang sudah
   menerapkan `V024` versi eMedik akan **melewati** `V024` versi koperasi —
   pemuatnya menganggapnya sudah dijalankan. Tabelnya tidak pernah dibuat, dan
   tidak ada satu pun galat yang muncul. Cacatnya baru terlihat berbulan-bulan
   kemudian sebagai "tabel tidak ditemukan" pada penyewa tertentu saja.
3. **Checksum berubah tanpa sebab yang jelas.** Sesi Core sudah pernah
   menemuinya saat V018 ditolak pada 14 skema karena akhiran baris berubah.
   Menambah tiga penulis pada satu berkas memperbanyak peluang itu.

## Kontrak yang diusulkan

Manifest per modul, digabungkan saat pemuatan:

```
apps/api/tenant-migrations/
├── manifest.json                      ← inti, tetap milik Core
├── cooperative/
│   ├── manifest.json
│   └── 20260731T120000__cooperative__profile_and_legality.sql
├── health/
│   └── manifest.json
└── village/
    └── manifest.json
```

Bentuk manifest modul:

```jsonc
{
  "module": "cooperative",
  "schemaVersion": 2,
  "dependsOn": ["core"],          // urutan penerapan antar modul
  "migrations": [
    {
      "id": "20260731T120000__cooperative__profile_and_legality",
      "file": "20260731T120000__cooperative__profile_and_legality.sql",
      "name": "Profil dan legalitas koperasi",
      "description": "..."
    }
  ]
}
```

Perubahan pada pemuat:

```ts
getManifest(): Manifest {
  const core = this.readManifest(join(this.migrationsDir, 'manifest.json'));
  const modules = this.discoverModuleManifests();   // baru
  return mergeManifests(core, modules);             // baru — inti selalu dahulu
}
```

Aturan penggabungan:

- Migrasi inti selalu diterapkan lebih dahulu, seluruhnya, sebelum modul mana pun.
- Antar modul diurutkan menurut `dependsOn`, lalu menurut `id` (yang bertimestamp,
  sehingga urutannya deterministik).
- `id` menggantikan `version` sebagai kunci pada `schema_migration`. Karena
  bertimestamp dan berkode modul, tabrakan praktis mustahil.

## Temuan tambahan dari K-1: `schema_migration.version` bertipe `VARCHAR(16)`

Ditemukan saat menerapkan migrasi koperasi pertama, dan **wajib menjadi bagian
dari perubahan ini**:

```
version character varying(16)
```

Id migrasi modular yang diminta panduan §7 —
`20260731T160000__cooperative__profile_and_legality` — panjangnya **49 aksara**.
Kolom itu secara struktural tidak dapat menampungnya:

```
error: value too long for type character varying(16)
```

Artinya katalog modular tidak dapat berjalan tanpa pelebaran kolom ini, sebaik
apa pun rancangan penggabungan manifestnya. Usulan: `VARCHAR(128)`, cukup untuk
timestamp + kode modul + keterangan yang berarti.

Pelebaran `VARCHAR` tidak pernah membatalkan baris yang ada, sehingga aman
diterapkan pada 17 skema yang sudah berisi data.

Sementara menunggu, naskah lokal koperasi mencatat penerapannya pada tabel
modulnya sendiri (`cooperative_schema_migration`, `VARCHAR(128)`) yang dibuat
naskah itu sendiri — bukan menambah migrasi yang kelak perlu dicabut. Saat IR
ini disetujui, isinya dipindahkan sekali dan tabelnya dibuang.

## Kompatibilitas mundur

Ada, dan penting: 23 migrasi yang sudah diterapkan pada 17 skema tidak boleh
dijalankan ulang maupun ditolak.

Usulannya: pertahankan `version` sebagai `id` bagi migrasi inti. `V001` tetap
`V001`. Yang berubah hanya bahwa `id` kini bertipe teks bebas, bukan wajib
berpola `V0NN` — sehingga migrasi modul dapat memakai timestamp tanpa mengganggu
yang sudah ada.

Checksum dihitung dengan cara yang sama, termasuk normalisasi akhiran baris yang
sudah diterapkan sesi Core.

## Migrasi data

Tidak ada. Baris `schema_migration` yang sudah ada tetap cocok karena `id` inti
tidak berubah.

## Pengujian yang diusulkan

```
manifest inti tanpa modul menghasilkan urutan yang sama persis dengan sekarang
migrasi inti selalu mendahului migrasi modul
dua modul dengan id sama ditolak saat pemuatan, bukan saat penerapan
modul dengan dependsOn yang tidak ada ditolak
checksum migrasi inti tidak berubah setelah perubahan ini
id sepanjang 49 aksara dapat disimpan dan dibaca kembali
skema yang sudah berisi V001-V023 tidak menjalankan apa pun saat migrasi diulang
```

Yang ketiga penting: tabrakan `id` harus ditolak **saat pemuatan** dengan pesan
yang menyebut kedua modulnya, bukan diam-diam memenangkan salah satunya.

## Sementara menunggu

Migrasi koperasi ditulis di `apps/api/tenant-migrations/cooperative/` dengan nama
bertimestamp, beserta `manifest.json` modulnya, **tetapi belum didaftarkan** pada
manifest global. Untuk pengembangan lokal, skrip
`apps/api/scripts/apply-cooperative-migrations.mjs` menerapkannya langsung ke
skema uji.

Artinya penyewa sungguhan belum memperoleh tabel koperasi sampai IR ini
disetujui — dan itu memang benar. Menerapkan migrasi vertikal ke penyewa
sebelum mekanismenya disepakati adalah persis kesalahan yang IR ini cegah.

## Contoh patch

Tersedia sebagai cabang terpisah bila diminta; perubahannya terpusat pada
`getManifest()` dan satu fungsi `mergeManifests()` baru beserta pengujiannya.
