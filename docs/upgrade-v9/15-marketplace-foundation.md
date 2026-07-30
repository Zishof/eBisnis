# 15 — Fondasi Marketplace (V9-1 Bagian B)

Menutup A1–A5 dan L1–L5, L7 pada
[matriks gap](02-v8-to-v9-gap-matrix.md).

## Hasil

| Objek | Sebelum | Sesudah |
| --- | ---: | ---: |
| Node menu / root | 73 / 21 | **124 / 36** |
| Aksi permission | 26 | **40** |
| Role katalog | 135 | **169** |
| Role disemai ke tenant | 124 | **146** |
| Baris izin turunan | 4.014 | **5.491** |
| Aturan SoD | 13 | **17** |
| Profil hak | 13 | **22** |
| Model platform marketplace | 0 | **6** |
| Endpoint marketplace | 0 | **8** |

Diukur pada schema `demo`: 152 role tersemai, 5.372 baris izin baru.

## Menu

15 root baru. Root `SHIPPING` yang sudah ada **diperluas**, bukan digandakan —
menambah root kedua akan memecah hak setiap role logistik menjadi dua modul yang
harus dikelola terpisah. Diuji pada `role-expansion.spec.ts`.

Marketplace ditempatkan sebagai root, bukan cabang di bawah `SALES`. Katalog role
menunjuk modul, sehingga menempatkannya di bawah penjualan akan membuat setiap
role penjualan otomatis memperoleh hak marketplace.

## Profil M1–M9

Ditambahkan pada `role-profile.ts` yang sama, bukan berkas kedua, supaya mesin
penurunan izinnya tetap satu.

| Kode | Nama | Catatan |
| --- | --- | --- |
| M1 | Viewer Marketplace | baca, cetak, ekspor |
| M2 | Operator Katalog/Pesanan | + tambah dan ubah |
| M3 | Operator Bulk | + hapus, pulihkan, impor |
| M4 | Operator Fulfillment | ambil, kemas, kirim — **tanpa ubah** |
| M5 | Layanan Pelanggan | **tanpa hapus, tanpa refund, tanpa credential** |
| M6 | Supervisor Marketplace | M3 + M4 + persetujuan retur |
| M7 | Manajer/Admin Seller | + terbitkan, moderasi — **tanpa credential** |
| M8 | Platform Marketplace | + rekonsiliasi, audit — **tanpa hapus permanen** |
| M9 | Pemegang Credential | M7 + kelola credential, menuntut step-up |

### Tiga batas yang ditegakkan profil, bukan aturan SoD

Blueprint menyebut tiga hal sebagai pemisahan tugas:

```text
Packer tidak mengubah harga atau quantity order.
Picker tidak membuat stock adjustment.
Customer Service tidak melihat credential atau full payment token.
```

Ketiganya **bukan** konflik antar-role, melainkan batas hak di dalam satu role.
Mencatatnya sebagai aturan SoD menghasilkan aturan yang tidak pernah berlaku
karena tidak ada dua role yang bertabrakan.

Maka M4 tidak memiliki `UPDATE` dan M5 tidak memiliki `DELETE`,
`REFUND_APPROVE`, maupun `MANAGE_CREDENTIAL`. Diuji langsung.

### Kontradiksi pada blueprint dan cara menyelesaikannya

Blueprint mendefinisikan M7 sebagai seluruh operasi seller *"kecuali credential
penuh dan platform moderation"*, tetapi mendaftarkan `ADMIN_ESMARTLINK_TENANT` —
yang seluruh alasan keberadaannya adalah mengelola credential — sebagai M7.
Keduanya tidak dapat benar bersamaan.

Yang dipertahankan adalah pengecualian pada M7, sebab ia melindungi role yang
jauh lebih banyak dipakai (`ADMIN_TOKO_ONLINE`). Hak credential dipisahkan ke
**M9**, dan hanya berlaku pada modul aktivasi.

Hasilnya terbukti pada bukti:

```text
ADMIN_ESMARTLINK_TENANT pada ESMARTLINK_ACCOUNT : ["READ","CREATE","MANAGE_CREDENTIAL"]
ADMIN_TOKO_ONLINE       pada ESMARTLINK_ACCOUNT : ["READ","CREATE"]
```

## Role

33 role marketplace: 12 platform, 21 tenant.

Beberapa role Versi 8 memperoleh modul marketplace karena perannya memang
menuntutnya: `ADMIN_ECOMMERCE` memperoleh toko dan katalog online,
`KEPALA_GUDANG` memperoleh fulfillment, `MANAJER_LOGISTIK` memperoleh menu
pengiriman baru tanpa satu baris katalog pun diubah.

Role yang tidak memerlukannya tidak memperolehnya — akuntan pajak, petugas
payroll, dan rekruter tidak melihat antrean picking. Diuji.

## Model platform

Enam tabel pada schema `platform`, sesuai
[peta model](03-marketplace-domain-model-map.md): pendaftaran seller adalah
urusan platform, sedangkan katalog dan pesanan tetap kanonik di tenant.

```text
marketplace_program                 satu program; batas seperti jumlah gambar
                                    minimum disimpan sebagai data
marketplace_seller                  satu tenant, satu seller per program
marketplace_seller_enrollment       satu berkas pendaftaran
marketplace_enrollment_transition   riwayat perpindahan status
marketplace_store                   slug, verifikasi, suspensi
marketplace_store_policy            kebijakan berversi
```

**Kebijakan toko berversi** karena pembeli berhak melihat kebijakan yang berlaku
saat ia memesan, bukan kebijakan terbaru.

**Transisi dicatat terpisah**, bukan sebagai kolom pada enrollment, karena
pertanyaan "berapa lama berkas ini menunggu provider" tidak dapat dijawab oleh
satu kolom status yang selalu ditimpa.

**Tidak ada credential di berkas ini.** Credential adalah pekerjaan V9-2 dan
memakai penyimpanan terenkripsi tersendiri.

## Mesin status

Empat belas status blueprint ditulis sebagai tabel transisi, bukan rangkaian
`if`. Yang membuatnya benar bukan panjangnya, melainkan jalur mundurnya:

| Dari | Ke | Kapan |
| --- | --- | --- |
| `PAYMENT_TESTING` | `CREDENTIAL_CONFIGURED` | uji pembayaran gagal |
| `CREDENTIAL_CONFIGURED` | `CREDENTIAL_RECEIVED` | credential salah |
| `UNDER_REVIEW` | `PROFILE_INCOMPLETE` | tinjauan menemukan yang kurang |
| `WAITING_PROVIDER` | `ACTIVATION_TICKET_OPENED` | provider menolak |

Yang **dilarang**, dan alasannya:

- `ACTIVE` tidak dapat kembali ke tahap persiapan. Toko yang sudah menerima
  pesanan tidak boleh tiba-tiba dianggap belum siap.
- `REJECTED` tidak dapat dibatalkan. Tenant mengajukan berkas baru, sehingga
  riwayat penolakan tetap utuh.
- Perpindahan ke status yang sama ditolak, agar catatan transisi tidak terisi
  baris yang tidak menyatakan apa pun.

Penolakan menyebut status apa saja yang mungkin, bukan sekadar "tidak
diizinkan". Diuji: 22 test, termasuk pembuktian bahwa seluruh 14 status dapat
dicapai dari `DRAFT`.

## Pemeriksaan kesiapan

Enam pemeriksaan berjalan sekarang; dua dinyatakan `PENDING_PHASE` beserta fase
yang menyediakannya.

| Kode | Status | Catatan |
| --- | --- | --- |
| `SELLER_CONTACT` | aktif | email atau telepon dukungan |
| `STORE_PROFILE` | aktif | toko sudah dibuat |
| `SHIPPING_ORIGIN` | aktif | alamat asal pengiriman |
| `RETURN_POLICY` | aktif | kebijakan retur diterbitkan |
| `TENANT_SCHEMA` | aktif | tenant selesai diprovision |
| `ACTIVE_PRODUCT` | aktif | ada produk aktif |
| `PAYMENT_ACCOUNT` | **PENDING_PHASE** | menunggu V9-2 |
| `LISTING_IMAGES` | **PENDING_PHASE** | menunggu V9-4 |

Melaporkan yang belum ada sebagai lulus akan membuat tenant mengira dirinya siap
padahal kapabilitasnya belum dibangun. Melaporkannya gagal akan menyalahkan
tenant atas sesuatu yang bukan urusannya. `PENDING_PHASE` menyatakan keduanya
apa adanya.

Setiap pemeriksaan membawa alasan yang dapat ditindaklanjuti — "Terbitkan
kebijakan retur; pembeli berhak mengetahuinya sebelum memesan" — bukan pesan
umum.

## Endpoint

```text
GET  /seller/marketplace/enrollment          MARKETPLACE_ENROLLMENT.READ
POST /seller/marketplace/enrollment          MARKETPLACE_ENROLLMENT.CREATE
GET  /seller/marketplace/readiness           MARKETPLACE_READINESS.READ
POST /seller/marketplace/readiness/refresh   + MARKETPLACE_ENROLLMENT.UPDATE
POST /seller/marketplace/enrollment/submit   MARKETPLACE_ENROLLMENT.SUBMIT
GET  /platform/marketplace/sellers/:id            PLATFORM.MARKETPLACE.READ
GET  /platform/marketplace/sellers/:id/readiness  PLATFORM.MARKETPLACE.READ
POST /platform/marketplace/sellers/:id/transition PLATFORM.MARKETPLACE.APPROVE
```

Pendaftaran **idempoten**: batasan unik `(programId, tenantId)` menjamin satu
tenant hanya menjadi satu seller, sehingga menekan tombol dua kali tidak
menghasilkan dua berkas.

Pengajuan **memeriksa ulang kesiapan lebih dulu**, supaya tidak lolos hanya
karena hasil pemeriksaan lama masih tersimpan.

Empat permission platform baru ditambahkan beserta dua role yang memakainya.
`PLATFORM_MARKETPLACE_REVIEWER` sengaja tidak memperoleh `APPROVE`: peninjau
listing tidak sekaligus menentukan siapa yang boleh berjualan.

## Migration

| Berkas | Isi |
| --- | --- |
| `20260730202315_add_marketplace_foundation` | 6 tabel dan 4 enum pada schema platform |
| `V012__marketplace_profiles.sql` | memperluas `ck_role_module_profile_code` untuk M1–M9 |

V012 lahir dari kegagalan yang benar: constraint V010 menolak profil `M1`–`M9`
saat penyemaian, karena hanya mengenal `P0`–`P12`. Basis data menolak nilai yang
tidak dikenal alih-alih menerimanya diam-diam — yang perlu dilakukan adalah
memperluas daftar yang sah, bukan melonggarkan pemeriksaannya.

## Bukti

[`evidence/v9-1-marketplace-foundation.txt`](evidence/v9-1-marketplace-foundation.txt).

| Gate | Hasil |
| --- | --- |
| `tsc --noEmit` api dan web | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | **187 lulus** (172 API + 15 web), naik dari 155 |
| `pnpm build` | bersih |
| `pnpm seed:verify` | LULUS, 0 gagal |
| `verify-migrations.mjs` | 12 migration lulus |
| `pnpm route:audit` | 0 route tanpa penanda |

Diterapkan pada 14 schema pengembangan; dijalankan ulang menghasilkan 0 izin baru.

## Keterbatasan yang diketahui

**UI Pusat Aktivasi sudah ada** pada `/app/marketplace/aktivasi`, dimuat lazy
sebagai bundle terpisah (9,6 kB). Halaman lain menyusul bersama fasenya.

Yang membedakannya dari daftar centang biasa: `PENDING_PHASE` disajikan dengan
ikon dan warna berbeda dari `FAIL`. Menyamakan keduanya membuat tenant mengira
dirinya bersalah atas kapabilitas yang memang belum dibangun.

Bukti asap lawan API yang berjalan:
[`evidence/v9-1c-ui-smoke.txt`](evidence/v9-1c-ui-smoke.txt) — 7 path, 8 operasi,
seluruhnya menuntut autentikasi, dan keempat permission platform tersemai.

**Kebanyakan menu marketplace bertanda `comingSoon`.** Menu aktivasi tidak,
karena endpointnya memang sudah ada. Sisanya menunggu fase yang membangunnya.
Menandainya siap akan menghasilkan menu yang menuju halaman kosong.

**`MarketplaceStore` belum punya endpoint.** Modelnya ada dan dipakai pemeriksaan
kesiapan, tetapi pembuatan toko adalah pekerjaan V9-3 bersama domain dan
storefront resolver.

**Pemeriksaan kesiapan belum menyentuh eSmartlink.** Dinyatakan `PENDING_PHASE`,
bukan diklaim lulus.
