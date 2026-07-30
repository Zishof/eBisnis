# 07 — Delta Menu, Role, dan Permission Versi 9

Blueprint: `STRUKTUR_MENU_ROLE_PERMISSION_EBISNIS_V9_MARKETPLACE.md`.

## Kondisi sekarang

| Objek | Jumlah | Sumber |
| --- | ---: | --- |
| Node menu / root | 73 / 21 | `tenant-menu.seed.ts` |
| Role tenant | 129 | `tenant-role.seed.ts` + template lama |
| Profil hak | 13 (P0–P12) | `role-profile.ts` |
| Aksi permission | 26 | `PERMISSION_ACTIONS_SEED` |
| Tingkat batas data | 14 | `DataScopeCode` |
| Aturan SoD | 13 | diturunkan dari katalog role |

## Delta yang diminta

| Objek | Tambahan | Menjadi |
| --- | ---: | ---: |
| Root menu | +16 | 37 |
| Role | +33 | 162 |
| Profil | +8 (M1–M8) | 21 |
| Aksi permission | +14 | 40 |
| Tingkat batas data | +3 | 17 |
| Aturan SoD | +10 | 23 |

## Yang membuat delta ini murah

Katalog role Versi 8 menunjuk **modul**, bukan daftar menu:

```typescript
r('KEPALA_GUDANG', 'Kepala Gudang', 'Warehouse', 'P6',
  { INVENTORY: 'P6', PURCHASING: 'P5', SHIPPING: 'P2' }, 'WAREHOUSE', '...')
```

Akibatnya, menambah node menu pada modul yang sudah dikenal otomatis terwarisi
seluruh role tanpa satu baris katalog pun diubah — sudah diuji pada
`role-expansion.spec.ts` bagian "mewarisi menu baru tanpa mengubah katalog role".

Untuk **root baru**, katalog role wajib diperbarui: modul yang tidak disebut
berarti tanpa akses. Ini disengaja, dan justru yang mencegah role sempit merembes
ke modul baru.

## Root menu baru

| Kode | Nama | Untuk |
| --- | --- | --- |
| `MARKETPLACE_HOME` | Beranda Marketplace | ringkasan seller |
| `MARKETPLACE_ACTIVATION` | Pusat Aktivasi Marketplace | enrollment, eSmartlink, go-live |
| `ONLINE_STORE` | Pengaturan Toko Online | profil, domain, halaman, kebijakan |
| `ONLINE_CATALOG` | Katalog Online | listing, media, harga, stok online |
| `ONLINE_SALES` | Penjualan Online | pesanan dan siklus hidupnya |
| `MARKETPLACE_PAYMENT` | Pembayaran Marketplace | payment order, callback, rekonsiliasi |
| `ALLOCATION` | Reservation dan Routing | ATP, reservasi, alokasi, backorder |
| `FULFILLMENT` | Fulfillment Online | wave, picking, packing, paket |
| `SHIPPING` | Shipping Marketplace | provider, quote, booking, tracking, armada |
| `RETURN_REFUND` | Retur dan Refund | retur, inspeksi, refund, sengketa |
| `MARKETPLACE_PROMO` | Promosi Marketplace | voucher, flash sale, kampanye |
| `MARKETPLACE_CUSTOMER` | Pelanggan Marketplace | chat, Q&A, ulasan, pengikut |
| `STORE_PERFORMANCE` | Performa Toko | GMV, konversi, SLA, rating |
| `MARKETPLACE_PLATFORM` | Operasi Marketplace Platform | moderasi, kebijakan, fee, risiko |
| `SUPPORT_TICKET` | Tiket Dukungan | tiket aktivasi dan dukungan |
| `MARKETPLACE_HELP` | Bantuan Marketplace | panduan Versi 9 |

Catatan: `SHIPPING` menggantikan peran modul `SHIPPING` yang sudah ada pada 21
root Versi 8. Pemeriksaan menunjukkan root `SHIPPING` **sudah ada** dan berisi
menu ekspedisi. Maka ia **diperluas**, bukan ditambah — mencegah dua root dengan
nama sama. Root baru yang benar-benar baru berjumlah **15**.

## Profil marketplace M1–M8

Ditambahkan pada `role-profile.ts` yang sama, bukan berkas kedua.

| Kode | Nama | Aksi |
| --- | --- | --- |
| M1 | Viewer marketplace | READ, PRINT, EXPORT |
| M2 | Operator katalog/order | M1 + CREATE, UPDATE |
| M3 | Operator bulk | M2 + DELETE, RESTORE, IMPORT |
| M4 | Operator fulfillment | READ, PICK, PACK, PRINT_LABEL, SHIP |
| M5 | Layanan pelanggan | READ, CHAT, NOTE, RETURN_REQUEST, PRINT |
| M6 | Supervisor marketplace | M3 + M4 + ASSIGN, REVIEW, CANCEL, RETURN_APPROVE |
| M7 | Manajer/admin seller | M6 + PUBLISH, UNPUBLISH, APPROVE, REJECT, MODERATE, EXPORT |
| M8 | Platform marketplace | M7 + SUSPEND, RECONCILE, VIEW_SENSITIVE, AUDIT_READ |

**M7 tidak memperoleh `MANAGE_CREDENTIAL`.** Blueprint menyatakan admin toko
memegang seluruh operasi *"kecuali credential penuh dan platform moderation"*.
Credential dipisahkan ke role tersendiri, `ADMIN_ESMARTLINK_TENANT`, dengan
step-up.

**M8 tidak memperoleh `HARD_DELETE`**, sejalan dengan keputusan P8 pada Versi 8.

## Aksi permission baru

| Kode | Nama | Jenis | Step-up |
| --- | --- | --- | --- |
| `PUBLISH` | Terbitkan | WORKFLOW | — |
| `UNPUBLISH` | Tarik dari Publikasi | WORKFLOW | — |
| `MODERATE` | Moderasi | WORKFLOW | — |
| `ASSIGN` | Tugaskan | WORKFLOW | — |
| `RESERVE` | Reservasi Stok | STANDARD | — |
| `RELEASE` | Lepas Reservasi | STANDARD | — |
| `PICK` | Ambil Barang | STANDARD | — |
| `PACK` | Kemas | STANDARD | — |
| `SHIP` | Kirim | STANDARD | — |
| `DELIVER` | Serahkan | STANDARD | — |
| `RETURN_APPROVE` | Setujui Retur | WORKFLOW | — |
| `REFUND_APPROVE` | Setujui Refund | SENSITIVE | **ya** |
| `RECONCILE` | Rekonsiliasi | SENSITIVE | — |
| `MANAGE_CREDENTIAL` | Kelola Credential | SENSITIVE | **ya** |

`VIEW_SENSITIVE` sudah tercakup `AUDIT_READ` dan `VIEW_AMOUNT` yang ada; tidak
ditambahkan agar tidak ada dua aksi bermakna sama.

`REFUND_APPROVE` dan `MANAGE_CREDENTIAL` menuntut step-up karena keduanya
memindahkan uang atau membuka akses ke uang.

## Tingkat batas data baru

| Kode | Untuk |
| --- | --- |
| `STORE` | toko online tertentu |
| `FULFILLMENT_LOCATION` | lokasi pemenuhan tertentu |
| `PAYMENT_PROVIDER_ACCOUNT` | akun provider tertentu |

Blueprint juga menyebut `CATEGORY`, `CAMPAIGN`, `SHIPPING_PROVIDER`,
`ORDER_QUEUE`, `RETURN_QUEUE`, `DISPUTE_QUEUE`, `ASSIGNED_TASK`, dan `OWN_DATA`.
Empat terakhir sudah tercakup `ASSIGNED_QUEUE` dan `SELF` yang ada; menambahkannya
menghasilkan tingkat bermakna sama dengan nama berbeda. `CATEGORY`, `CAMPAIGN`,
dan `SHIPPING_PROVIDER` ditunda sampai ada role yang benar-benar memerlukannya.

## Aturan SoD baru

Diturunkan dari katalog role seperti Versi 8, bukan ditulis terpisah.

| Kode | Aturan | Tingkat |
| --- | --- | --- |
| `LISTING_PUBLISH` | pembuat listing bukan penyetujunya | HIGH |
| `MARKETPLACE_REFUND` | pemohon refund bukan penyetujunya | CRITICAL |
| `PAYMENT_RECONCILE` | operator order bukan petugas rekonsiliasi | HIGH |
| `ESMARTLINK_CREDENTIAL` | petugas aktivasi bukan pembaca credential | CRITICAL |
| `PACK_ORDER_EDIT` | packer tidak mengubah harga atau kuantitas | HIGH |
| `PICK_STOCK_ADJUST` | picker tidak membuat penyesuaian stok | HIGH |
| `CS_CREDENTIAL` | layanan pelanggan tidak melihat credential | CRITICAL |
| `MODERATION_CONFLICT` | moderator tidak memoderasi tenant sendiri | HIGH |
| `DISPUTE_CONFLICT` | petugas sengketa tidak memutus case buatannya | HIGH |
| `FEE_APPROVAL` | pembuat aturan fee bukan penyetujunya | MEDIUM |

Tiga di antaranya — `PACK_ORDER_EDIT`, `PICK_STOCK_ADJUST`, `CS_CREDENTIAL` —
bukan konflik antar-role melainkan **batas hak di dalam satu role**. Keduanya
ditegakkan lewat profil (M4 tidak punya UPDATE harga; M5 tidak punya
MANAGE_CREDENTIAL), bukan lewat aturan SoD.

Mencatatnya sebagai SoD akan menghasilkan aturan yang tidak pernah berlaku karena
tidak ada dua role yang bertabrakan. Maka yang menjadi aturan SoD hanya tujuh;
tiga sisanya dicatat sebagai keputusan profil dan diuji pada test profil.

## Role baru

33 role dari blueprint bagian E, ditambahkan ke `ROLE_CATALOG` yang sama.

**12 role platform** (`platformOnly: true`): Administrator Marketplace Platform,
Manajer Operasional Marketplace, Petugas Aktivasi eSmartlink, Administrator
Pembayaran Marketplace, Petugas Rekonsiliasi Marketplace, Moderator Produk
Marketplace, Petugas Kepatuhan Marketplace, Analis Risiko Marketplace, Petugas
Sengketa Marketplace, Administrator Kategori Marketplace, Manajer Kampanye
Marketplace, Analis Marketplace Platform.

**21 role tenant**: Administrator Toko Online, Manajer Toko Online, Administrator
eSmartlink Tenant, Pengelola Katalog Online, Editor Konten Produk, Fotografer dan
Media Produk, Penyetuju Listing Online, Operator Pesanan Online, Koordinator
Fulfillment Online, Picker Pesanan Online, Packer Pesanan Online, Administrator
Pengiriman Online, Petugas Shipment Online, Petugas Retur Marketplace, Penyetuju
Refund Marketplace, Layanan Pelanggan Marketplace, Moderator Chat dan Review
Tenant, Manajer Promo Marketplace, Spesialis Live Commerce, Manajer Affiliate
Marketplace, Analis Toko Online.

Ditambah `AUDITOR_MARKETPLACE` dengan profil P9 yang sudah ada.

## Role Versi 8 tidak berubah

129 role Versi 8 tetap apa adanya. Tidak ada yang dihapus, diganti nama, atau
diubah profilnya. Tenant yang tidak mengikuti marketplace tidak terpengaruh sama
sekali.

Beberapa role Versi 8 memperoleh modul marketplace secara wajar:

| Role V8 | Tambahan | Alasan |
| --- | --- | --- |
| `ADMIN_TENANT` | seluruhnya | bertanda `allModules` |
| `PEMILIK_USAHA`, `DIREKTUR` | seluruhnya pada P11 | bertanda `allModules`, hanya baca dan setujui |
| `AUDITOR_INTERNAL` | seluruhnya pada P9 | bertanda `allModules`, hanya baca |
| `ADMIN_ECOMMERCE` | `ONLINE_CATALOG: M7`, `ONLINE_SALES: M6`, `ONLINE_STORE: M7` | perannya memang e-commerce |
| `KEPALA_GUDANG` | `FULFILLMENT: M6`, `ALLOCATION: M1` | gudang yang memenuhi pesanan |
| `MANAJER_LOGISTIK` | `SHIPPING: M7` | root `SHIPPING` diperluas |

Sisanya tidak memperoleh akses marketplace, dan itu benar: akuntan pajak tidak
perlu melihat antrean picking.

## Sample account

Kebijakan blueprint bagian H diterapkan pada V9-13:

```text
kata sandi acak kriptografis, hanya hash yang disimpan
plaintext tampil satu kali pada manifest, tidak pernah tersimpan
mustChangePassword = true
expiresAt terisi
isSampleAccount = true
sampleBatchId
MFA untuk role istimewa
hanya tenant development, demo, dan test
```

Larangan yang tetap berlaku: **jangan menyimpan kata sandi sample plaintext**, dan
**jangan membuat pengguna produksi otomatis**.
