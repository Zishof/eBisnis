# 14 — Penegakan Otorisasi (V9-1 Bagian A)

Menutup dua utang yang tercatat sejak V6-0 dan menjadi prasyarat seluruh endpoint
marketplace: [R01 dan R02](08-security-risk-register.md).

## Yang rusak

### V6-0-F03 — guard meloloskan handler tanpa penanda

`PermissionGuard` mengembalikan `true` bila sebuah handler tidak memiliki
metadata permission:

```typescript
if (!platformPermissions?.length && !tenantPermissions?.length && !stepUpPurpose) {
  return true;   // <- gagal terbuka
}
```

Catatan V6-0 menyebut 13 endpoint master. Pemindaian ulang atas seluruh API
menemukan **32 dari 157** yang benar-benar tidak memiliki penanda:

| Kelompok | Jumlah | Akibat |
| --- | ---: | --- |
| CRUD master generik | 11 | tambah, ubah, hapus, dan pulihkan **23 sumber daya master** tanpa pemeriksaan hak |
| Billing dan langganan | 10 | invoice, quote, dan perangkat POS terbaca siapa pun yang sudah masuk |
| Pembayaran | 4 | membuat payment order dan memicu inquiry |
| Autentikasi | 7 | wajar — berbicara tentang pemanggilnya sendiri |

Sebelas yang pertama adalah yang paling merugikan: satu pengguna dengan sesi apa
pun dapat menghapus produk, pemasok, atau daftar akun tenant.

### Batas data tersimpan tetapi tidak menyaring

V010 mengisi `role_data_scope` dengan 124 baris dan menandai tingkat mana yang
menuntut penugasan. Tidak ada satu pun query yang membacanya.

Pada ERP satu tenant akibatnya terbatas. Pada marketplace, ia berarti seller
dapat melihat pesanan seller lain.

## Yang diperbaiki

### Gagal tertutup, bukan gagal terbuka

Handler yang tidak menyatakan satu pun penanda kini **ditolak**:

```text
@Public()              tanpa autentikasi
@AuthenticatedOnly()   perlu sesi, tanpa permission tertentu
@Permissions(...)      permission tenant
@PlatformPermissions() permission control plane
@ResourcePermission()  permission yang menunya ditentukan saat permintaan
@RequireStepUp()       menuntut step-up
(tidak satu pun)       DITOLAK
```

`@AuthenticatedOnly()` sengaja dibuat eksplisit. Tanpanya, satu-satunya cara
mengizinkan endpoint tanpa permission adalah membiarkannya kosong — dan itu tidak
dapat dibedakan dari lupa.

### `@ResourcePermission` untuk CRUD generik

Sebelas endpoint master melayani 23 sumber daya lewat satu handler, sehingga kode
menunya tidak dapat ditulis sebagai konstanta. Guard menurunkannya saat
permintaan:

```text
:resource = "products" -> registry -> menuCode CATALOG_PRODUCT -> CATALOG_PRODUCT.DELETE
```

Sumber daya yang tidak dikenal **ditolak**, bukan diloloskan. Meloloskannya
berarti parameter yang salah ketik menghapus pemeriksaan hak.

### Ditemukan lebih awal, bukan saat dipanggil

Menolak saat dipanggil masih berarti kesalahannya baru terlihat di depan
pengguna. Tiga lapis:

| Lapis | Kapan terlihat |
| --- | --- |
| `route-authorization.audit.spec.ts` | saat test dijalankan, pada CI |
| `pnpm route:audit` | kapan pun, tanpa membuka port |
| `assertEveryRouteIsMarked` di `main.ts` | sebelum port dibuka; aplikasi tidak menyala |

Aplikasi yang menyala dengan endpoint tidak terlindungi lebih buruk daripada
aplikasi yang tidak menyala: yang pertama diam, yang kedua terlihat.

### Batas data menjadi predikat SQL

`DataScopeResolver` menerjemahkan tingkat batas data menjadi fragmen `WHERE`.
Query pada sistem ini adalah SQL mentah dengan bentuk berbeda-beda, sehingga
resolver mengembalikan fragmen dan pemanggil menyisipkannya:

```typescript
const scope = await this.dataScope.buildPredicate(
  ctx.schemaName, ctx.userId,
  { WAREHOUSE: 'b.warehouse_id', LEGAL_ENTITY: 'w.legal_entity_id' },
  { startIndex: params.length + 1 },
);
conditions.push(scope.sql);
params.push(...scope.params);
```

Empat keputusan yang menentukan perilakunya:

**Tanpa role berarti tanpa akses.** Pengguna yang seluruh role-nya dicabut
memperoleh `FALSE`, bukan `TRUE`.

**Tingkat terluas yang berlaku** bila seseorang memegang beberapa role. Kepala
gudang yang juga direktur melihat sebagaimana direktur. Mengambil yang tersempit
membuat penambahan role justru mengurangi akses — perilaku yang membingungkan dan
mendorong orang membuat akun kedua.

**Menuntut penugasan tetapi belum ditugaskan berarti nol baris.** Ini yang paling
mudah salah dan paling merugikan bila salah. Role gudang yang baru dibuat dan
belum sempat ditugaskan tidak boleh berarti "seluruh gudang".

**Tingkat yang tidak dapat dipetakan ditolak.** Pemegang batas `ASSIGNED_TRIP`
yang membuka daftar produk tidak memperoleh apa pun, karena produk tidak punya
kolom perjalanan. Meloloskannya berarti batas data hilang begitu seseorang
membuka halaman yang tidak terduga.

### Penugasan per orang, bukan per role

`role_scope` yang ada bersifat per-role, sehingga dua kepala gudang dengan role
sama melihat gudang yang sama persis. Blueprint Versi 9 menuntut sebaliknya: satu
Picker per gudang, satu Operator Pesanan per toko.

Migration `V011__user_scope_assignment.sql` menambahkan penugasan per pengguna.
`role_scope` tetap berlaku sebagai batas bawaan role; keduanya digabung resolver.

## Bukti

Bukti mentah: [`evidence/v9-1-authorization.txt`](evidence/v9-1-authorization.txt).

```text
Route tanpa penanda otorisasi: 0        (aplikasi nyata dijalankan, 157 route)

Subjek uji pada schema demo, role KEPALA_GUDANG:
  tingkat                    : WAREHOUSE, menuntut penugasan
  saldo stok seluruhnya      : 3
  terlihat tanpa penugasan   : 0        <- benar
  setelah ditugaskan 1 gudang: 1 dari 3 <- benar
```

Sisi kedua sama pentingnya dengan yang pertama: batas data yang menolak
segalanya bukan penegakan, melainkan kerusakan.

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | 155 lulus (140 API + 15 web), naik dari 119 |
| `pnpm build` | bersih |
| `pnpm seed:verify` | LULUS, 0 gagal |
| `verify-migrations.mjs` | 11 migration lulus |
| `pnpm route:audit` | 0 route tanpa penanda |

V011 diterapkan pada 14 schema pengembangan.

## Keterbatasan yang diketahui

**Baru satu query yang menegakkan batas data.** `listBalances` dipakai sebagai
pembuktian bahwa resolver bekerja dari ujung ke ujung. Query lain — daftar
pesanan, transfer, penerimaan barang — belum menyisipkannya.

Ini disengaja dan dinyatakan, bukan diklaim selesai. Menerapkannya ke seluruh
query yang ada adalah pekerjaan mekanis yang lebih baik dilakukan bersama
pemiliknya masing-masing, dan endpoint marketplace akan memakainya sejak awal.

**`@AuthenticatedOnly` pada tujuh endpoint auth adalah keputusan, bukan
kelalaian.** Ketujuhnya berbicara tentang pemanggilnya sendiri: profil, keluar,
ganti kata sandi, daftar menu yang boleh ia lihat. Memberi permission pada
endpoint semacam itu menghasilkan permission yang dimiliki semua orang, dan
permission yang dimiliki semua orang tidak menyatakan apa pun.

**`master-resources` juga `@AuthenticatedOnly`.** Ia hanya mengembalikan daftar
nama sumber daya beserta kebijakan purge-nya — tidak ada data tenant di dalamnya.
