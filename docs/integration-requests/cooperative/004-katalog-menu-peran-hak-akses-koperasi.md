# IR-004 · Katalog menu, peran, dan aksi hak akses modular

**Dari:** sesi eKoperasi (`feature/v12-ekoperasi`)
**Kepada:** sesi Core / Integrator
**Tanggal:** 31 Juli 2026
**Sifat:** Pemblokir bagi antarmuka dan penegakan hak akses (K-1 dan seterusnya)
**Berkas bersama:** `apps/api/src/modules/master-seed/registry/platform-master-seeds.ts`,
`apps/api/src/modules/master-seed/platform-seed.service.ts`

---

## Kebutuhan

Koperasi memerlukan:

- **17 menu** `COOPERATIVE_*`
- **24 peran bawaan** (spesifikasi §17)
- **10 aksi hak akses baru** di luar 40 aksi baku

Rinciannya pada [05-security-and-sod.md](../../ekoperasi/05-security-and-sod.md).

## Keadaan sekarang

Ketiganya disemai dari konstanta di dalam berkas milik Core:

```ts
// platform-master-seeds.ts
export const PERMISSION_ACTIONS_SEED = [ /* 40 aksi */ ];
export const MENU_TREE_SEED = [ /* 133 simpul */ ];
export const ROLE_TEMPLATES_SEED = [ /* templat peran */ ];
```

Panduan koordinasi §9 sudah mengantisipasi persoalannya:

> *"Jangan menambahkan ratusan entry langsung ke satu file global dari tiga
> branch."*

Dan menghendaki katalog modular `cooperative-menu.catalog.ts`,
`cooperative-role.catalog.ts`, `cooperative-permission.catalog.ts` yang diimpor
registri global **lewat kontrak plugin yang dikelola Core**. Kontrak itu belum
ada.

## Kontrak yang diusulkan

Bentuknya sengaja dibuat sama dengan IR-003, supaya Core hanya perlu memahami
satu pola registri:

```ts
// apps/api/src/modules/master-seed/registry/vertical-catalog.registry.ts  (Core, baru)

export interface VerticalCatalog {
  /** Kode vertikal: 'cooperative', 'health', 'village'. */
  readonly code: string;
  /** Awalan menu dan hak akses; dipakai memeriksa tabrakan. */
  readonly prefix: string;
  readonly menus: readonly MenuNodeSeed[];
  readonly roles: readonly RoleTemplateSeed[];
  readonly permissionActions: readonly PermissionActionSeed[];
}

@Injectable()
export class VerticalCatalogRegistry {
  register(catalog: VerticalCatalog): void;
  allMenus(): readonly MenuNodeSeed[];
  allRoles(): readonly RoleTemplateSeed[];
  allPermissionActions(): readonly PermissionActionSeed[];
}
```

`platform-seed.service.ts` menyemai dari registri, bukan dari konstanta:

```ts
private async seedGlobalMenuTemplates(): Promise<number> {
  for (const node of this.catalogRegistry.allMenus()) { /* sama seperti sekarang */ }
}
```

Menu, peran, dan aksi inti menjadi satu katalog yang didaftarkan Core sendiri —
tanpa perlakuan istimewa, sama seperti usulan IR-003.

## Aturan yang harus ditegakkan registri

1. **Awalan tidak boleh bertabrakan.** Dua vertikal dengan `prefix` sama ditolak.
2. **Menu dan peran wajib berawalan katalognya.** Koperasi tidak boleh
   mendaftarkan menu `POS`.
3. **Aksi hak akses BOLEH dipakai bersama.** `APPROVE` milik semua. Yang
   diperiksa hanya bahwa dua katalog tidak mendefinisikan aksi bersama yang
   sama dengan arti berbeda.
4. **`parentCode` menu wajib ada pada katalog yang sama atau pada katalog inti.**
   Menu yatim menghasilkan menu yang tidak pernah muncul, dan itu jenis cacat
   yang butuh waktu lama untuk disadari.

## Sepuluh aksi hak akses baru

Tiga di antaranya berpeluang dipakai vertikal lain, jadi diusulkan masuk katalog
**inti**, bukan katalog koperasi:

| Aksi | Usulan pemilik | Alasan |
|---|---|---|
| `DISBURSE` | **inti** | Pencairan dana; eMedik akan memerlukannya untuk klaim |
| `ANALYZE` | **inti** | Analisis sebelum keputusan; pola umum |
| `WRITE_OFF` | **inti** | Penghapusbukuan; piutang usaha inti juga memerlukannya |
| `SURVEY` | koperasi | Survei kelayakan pinjaman |
| `RESTRUCTURE` | koperasi | Restrukturisasi pinjaman |
| `CALCULATE` | koperasi | Perhitungan SHU |
| `DISTRIBUTE` | koperasi | Pembagian SHU |
| `OPEN_MEETING` | koperasi | Membuka RAT |
| `CLOSE_MEETING` | koperasi | Menutup RAT |
| `VOTE` | koperasi | Pemungutan suara anggota |

Pembagian ini usulan, bukan tuntutan. Sesi Core lebih tahu apa yang akan
dibutuhkan eMedik dan info-desa; bila ketiganya lebih baik tinggal di katalog
koperasi, koperasi tidak keberatan.

## Kompatibilitas mundur

Penuh. Bila hanya katalog inti terdaftar, hasil penyemaian **sama persis**
dengan sekarang: 40 aksi, 133 menu, templat peran yang sama.

Uji yang membuktikannya diusulkan sebagai bagian dari IR ini — membandingkan
keluaran registri tanpa vertikal terhadap konstanta yang sekarang.

## Migrasi data

Tidak ada. Menu, peran, dan aksi disemai lewat `upsert` berdasarkan `code`;
menambah katalog hanya menambah baris.

Penyewa koperasi yang sudah ada akan memperoleh menu koperasi pada penyemaian
berikutnya — perilaku yang memang diinginkan.

## Pengujian yang diusulkan

```
registri tanpa vertikal menghasilkan 40 aksi, 133 menu — sama dengan sekarang
dua vertikal berawalan sama ditolak saat pendaftaran
menu yang tidak berawalan katalognya ditolak
menu dengan parentCode yang tidak ada ditolak saat pendaftaran
aksi bersama yang didefinisikan dua katalog dengan arti berbeda ditolak
katalog koperasi terdaftar -> 17 menu bertambah, tidak ada yang hilang
peran koperasi memperoleh hak akses hanya atas menu koperasi
```

Uji keempat menutup cacat yang pernah ditemui sesi Core: hak akses `CRM.CREATE`
dan `ONLINE_CATALOG.CREATE` didaftarkan pada menu akar yang hanya punya `READ`,
sehingga tidak pernah dapat diberikan kepada siapa pun. Memeriksanya saat
pendaftaran membuat cacat sejenis tertangkap sebelum berjalan.

## Sementara menunggu

Katalog koperasi ditulis penuh di
`modules/cooperative/catalog/` beserta pengujiannya. Untuk pengembangan lokal,
skrip `apps/api/scripts/seed-cooperative-catalog.mjs` menyemainya langsung ke
skema uji.

Konsekuensinya: menu koperasi belum muncul bagi penyewa sungguhan, dan penjaga
`@Permissions('COOPERATIVE_*.*')` akan menolak setiap permintaan karena hak
aksesnya belum ada di basis data. Endpoint koperasi karena itu **belum dapat
dipakai penyewa** sampai IR ini disetujui — dan itu memang keadaan yang benar,
bukan yang perlu diakali.
