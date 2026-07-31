# Integration Request 002 — Katalog migrasi modular belum ada

**Vertical:** eMedik
**Diajukan:** 31 Juli 2026
**Branch:** `feature/v12-emedik`
**Status:** menunggu keputusan Core
**Menghalangi:** setiap migrasi dari setiap vertical, sejak H-1

---

## Kebutuhan

Panduan koordinasi §7 memerintahkan:

```
<timestamp>__health__<description>
register migration pada TenantModuleMigrationCatalog
jangan memakai nomor urut global manual yang mudah bentrok
```

`TenantModuleMigrationCatalog` **tidak ada di repositori ini.** Pencarian pada
seluruh `apps/api/src` mengembalikan nol berkas.

Yang ada:

```
apps/api/tenant-migrations/manifest.json      ← satu berkas, 23 entri
apps/api/tenant-migrations/V001__*.sql … V023__*.sql
```

dimuat oleh `TenantMigrationService`:

```ts
const manifestPath = join(this.migrationsDir, 'manifest.json');
this.manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
this.manifest.migrations.sort((a, b) => a.sequence - b.sequence);
```

Setiap entri memiliki `version` (`"V001"`) dan `sequence` (angka global yang
ditulis tangan).

## Mengapa ini menghalangi kerja paralel

Larangan pada §7 — *"jangan memakai nomor urut global manual yang mudah
bentrok"* — **tidak dapat dipatuhi dengan mekanisme yang tersedia.** Nomor urut
global manual adalah satu-satunya yang ada.

Akibatnya bila tiga vertical berjalan bersamaan:

1. **Setiap penambahan migrasi menyentuh berkas yang sama.** `manifest.json`
   akan konflik pada hampir setiap `rebase`, dari ketiga branch.

2. **Nomor bertabrakan tanpa terlihat sebagai konflik.** Bila eMedik menambah
   `V024` di baris 180 dan eKoperasi menambah `V024` di baris 181, Git dapat
   menggabungkan keduanya tanpa mengeluh. Yang gagal adalah pemuatnya, saat
   dijalankan, pada lingkungan bersama.

3. **Nomor yang tampak bebas ternyata tidak.** Sesi Core sedang memakai
   **V024–V029** untuk POS Web pada `feature/pos-web-priority`. Nomor itu belum
   ada di `main`, sehingga vertical yang melihat `main` akan mengira `V024`
   masih kosong. Ini bukan kemungkinan — ini keadaan hari ini.

## Usulan

### Bagian 1 — awalan per vertical (dapat dipakai segera, tanpa perubahan kode)

Nomor migrasi diberi awalan huruf menurut pemiliknya:

```
V###  Core         (V001 … V029 terpakai)
H###  eMedik
K###  eKoperasi
D###  info-desa
```

`TenantMigrationService` mengurutkan berdasarkan `sequence`, bukan `version`,
sehingga awalan huruf **tidak memerlukan perubahan kode sama sekali**. Yang
perlu disepakati hanyalah rentang `sequence`:

```
Core     1   – 999
eMedik   1000 – 1999
eKoperasi 2000 – 2999
info-desa 3000 – 3999
```

Dengan itu tabrakan nomor menjadi mustahil, dan urutan penerapannya tetap
deterministik: seluruh migrasi Core lebih dahulu, lalu vertical. Itu memang
urutan yang benar — vertical bergantung pada tabel inti, bukan sebaliknya.

**Konflik pada `manifest.json` tetap ada**, tetapi menjadi konflik tambah-tambah
pada blok yang berjauhan, yang mudah diselesaikan dan tidak menyembunyikan
kesalahan.

### Bagian 2 — manifest per modul (menghapus konflik sepenuhnya)

Bila Core bersedia mengubah pemuatnya:

```
apps/api/tenant-migrations/manifest.json              ← Core, tidak berubah
apps/api/tenant-migrations/modules/health.json        ← eMedik
apps/api/tenant-migrations/modules/cooperative.json   ← eKoperasi
apps/api/tenant-migrations/modules/village.json       ← info-desa
```

Perubahan pada `TenantMigrationService.getManifest()` kira-kira:

```ts
private getManifest(): Manifest {
  if (!this.manifest) {
    const inti = JSON.parse(readFileSync(join(this.migrationsDir, 'manifest.json'), 'utf8'));
    const modulDir = join(this.migrationsDir, 'modules');
    const modul = existsSync(modulDir)
      ? readdirSync(modulDir)
          .filter((f) => f.endsWith('.json'))
          .sort()                                    // urutan berkas deterministik
          .flatMap((f) => JSON.parse(readFileSync(join(modulDir, f), 'utf8')).migrations)
      : [];
    this.manifest = { ...inti, migrations: [...inti.migrations, ...modul] };
    this.manifest.migrations.sort((a, b) => a.sequence - b.sequence);
  }
  return this.manifest;
}
```

Dengan itu setiap vertical menyentuh berkasnya sendiri, dan `manifest.json`
milik Core tidak pernah disentuh vertical.

## Backward compatibility

**Bagian 1:** tidak ada perubahan kode; sepenuhnya kompatibel.

**Bagian 2:** kompatibel. Bila direktori `modules/` tidak ada, perilakunya persis
seperti sekarang. Migrasi yang sudah diterapkan tidak tersentuh — checksum-nya
dihitung dari isi berkas SQL, bukan dari manifestnya.

## Migrasi data

Tidak ada. Ini perubahan pada pemuat katalog, bukan pada skema.

## Pengujian

- Manifest tanpa direktori `modules/` memuat persis 23 migrasi seperti sekarang.
- Manifest dengan dua berkas modul memuat gabungannya, terurut menurut
  `sequence`.
- Dua migrasi dengan `sequence` sama **gagal keras saat dimuat**, bukan diam-diam
  diterapkan dengan urutan sembarang. Ini yang paling penting: kesalahan
  penomoran harus terdeteksi pada saat dimuat, bukan pada saat diterapkan ke
  basis data pelanggan.
- Migrasi yang sudah diterapkan tetap dikenali sesudah dipindahkan dari
  `manifest.json` ke `modules/health.json` — checksum-nya tidak berubah.

## Yang dikerjakan eMedik sementara menunggu

Memakai **Bagian 1**: awalan `H###` dengan `sequence` mulai 1000, dan menambahkan
entrinya ke `manifest.json` yang ada. Itu sudah cukup untuk mencegah tabrakan
nomor, dan tidak menuntut perubahan apa pun dari Core.

Bila Bagian 2 disetujui kelak, memindahkan entri eMedik dari `manifest.json` ke
`modules/health.json` adalah pemindahan teks tanpa akibat pada basis data.

## Yang diminta dari Core

1. **Segera:** konfirmasi rentang `sequence` per vertical, dan konfirmasi bahwa
   V024–V029 memang sudah dipesan POS Web.
2. **Kemudian:** keputusan atas Bagian 2.
