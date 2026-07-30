## Ringkasan

V9-0 (audit) dan V9-1 (otorisasi + fondasi marketplace). Tiga commit.

Yang berubah untuk pengguna: **tenant dapat mendaftar sebagai penjual** lewat
Pusat Aktivasi Marketplace, melihat apa saja yang masih kurang beserta alasan
yang dapat ditindaklanjuti, dan mengajukan diri untuk ditinjau platform.

Dua lubang keamanan yang sudah tercatat sejak V6-0 juga ditutup di sini, sebelum
satu pun endpoint marketplace dibuat.

## Requirement

Dokumen Versi 9: `PERINTAH_MASTER...VERSI_9.md`, `PERINTAH_CLAUDE_CODE...V9_MARKETPLACE.md`,
`STRUKTUR_MENU_ROLE_PERMISSION_EBISNIS_V9_MARKETPLACE.md`, dan
`PROMPT_CODEX_CLAUDE_UPGRADE_INCREMENTAL_V8_R1_KE_V9...md`.

## Migration

**Tenant** — additive, tidak mengubah tabel maupun kolom lama:

| Berkas | Isi |
| --- | --- |
| `V011__user_scope_assignment.sql` | penugasan batas data per pengguna, perluasan tingkat scope |
| `V012__marketplace_profiles.sql` | memperluas `ck_role_module_profile_code` untuk M1–M9 |

**Platform** — `20260730202315_add_marketplace_foundation`: 6 tabel dan 4 enum.

Tenant yang sudah ada disusulkan lewat `pnpm migrate:tenants`.

## Keamanan

**PermissionGuard gagal-terbuka (V6-0-F03).** Guard mengembalikan `true` bila
handler tidak punya metadata permission. Catatan V6-0 menyebut 13 endpoint;
pemindaian ulang menemukan **32 dari 157**, termasuk sebelas endpoint CRUD master
yang melayani 23 sumber daya. Artinya siapa pun dengan sesi sah dapat menghapus
produk, pemasok, atau daftar akun tenant.

Guard kini menolak handler tanpa penanda. Tiga lapis memajukan penemuannya: test
CI, `pnpm route:audit`, dan pemeriksaan sebelum port dibuka — aplikasi tidak
menyala bila ada endpoint yang lupa.

**Batas data tidak ditegakkan.** `role_data_scope` terisi sejak V010 tetapi tidak
ada query yang membacanya. `DataScopeResolver` menerjemahkannya menjadi predikat
`WHERE`. Aturan terpenting: tingkat yang menuntut penugasan tetapi belum
ditugaskan berarti **nol baris**, bukan seluruhnya.

Dibuktikan pada schema `demo`: pemegang `KEPALA_GUDANG` tanpa penugasan melihat
0 dari 3 saldo stok; setelah ditugaskan satu gudang ia melihat 1 dari 3.

**Pemisahan credential.** `MANAGE_CREDENTIAL` dipisahkan dari administrator toko
ke profil M9 yang menuntut step-up. Layanan pelanggan tidak dapat melihat
credential maupun menyetujui refund; packer dan picker tidak dapat mengubah
pesanan.

## Menu, role, permission

| | Sebelum | Sesudah |
| --- | ---: | ---: |
| Node menu / root | 73 / 21 | 124 / 36 |
| Aksi permission | 26 | 40 |
| Role katalog | 135 | 169 |
| Baris izin | 4.014 | 5.491 |
| Aturan SoD | 13 | 17 |
| Profil hak | 13 | 22 |

Root `SHIPPING` yang sudah ada **diperluas**, bukan digandakan.

## API

8 operasi pada 7 path, seluruhnya menuntut autentikasi dan menyatakan
permission-nya. 4 permission platform baru beserta 2 role yang memakainya.

## UI

`/app/marketplace/aktivasi`, dimuat lazy sebagai bundle terpisah 9,6 kB.
Terjemahan lengkap untuk id, en, ar, dan zh-CN.

`PENDING_PHASE` disajikan berbeda dari `FAIL` — yang pertama berarti
kapabilitasnya belum dibangun, yang kedua berarti tenant harus bertindak.

## Bukti pengujian

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **187 lulus** (172 API + 15 web), naik dari 119 |
| `pnpm build` | bersih |
| `pnpm seed:verify` | LULUS, 0 gagal |
| `verify-migrations.mjs` | 12 migration lulus |
| `pnpm route:audit` | 0 route tanpa penanda |
| Smoke marketplace | seluruh pemeriksaan lulus |

Diterapkan pada 14 schema pengembangan; dijalankan ulang menghasilkan 0
perubahan.

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| Guard yang lebih ketat menolak endpoint yang sah | 157 route diperiksa; 0 tanpa penanda, diverifikasi pada aplikasi yang dijalankan |
| Batas data menolak terlalu banyak | sisi "boleh melihat" ikut dibuktikan, bukan hanya sisi menolak |
| Menu marketplace mengarah ke halaman kosong | seluruhnya bertanda `comingSoon` kecuali aktivasi yang halamannya sudah ada |

## Keterbatasan yang diketahui

- Baru `listBalances` yang menyisipkan predikat batas data. Query lain menyusul;
  endpoint marketplace memakainya sejak awal.
- `MarketplaceStore` belum punya endpoint — pekerjaan V9-3 bersama domain dan
  storefront resolver.
- Pemeriksaan kesiapan belum menyentuh eSmartlink; ditandai `PENDING_PHASE`,
  bukan diklaim lulus.

## Rollback

Migration additive. Menonaktifkan marketplace tidak menuntut penurunan schema:
hapus baris role bertanda `role_family = 'Marketplace'` beserta izinnya.

Perbaikan guard **tidak** boleh di-rollback — mengembalikannya berarti membuka
kembali 32 endpoint tanpa pemeriksaan hak.

## Changelog

`CHANGELOG.md` bagian `[Unreleased]` sudah diperbarui.
