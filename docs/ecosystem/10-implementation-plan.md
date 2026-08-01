# ECO-0 — Rencana implementasi

Disusun dari temuan audit, bukan dari urutan §46 apa adanya. Dua penyesuaian
urutan diusulkan, dan alasannya disebut.

## Dua penyesuaian yang diusulkan terhadap §46

**1. ECO-9 (port lintas vertical) sebagian didahulukan.**
Pola port sudah ada di dalam modul koperasi. Memindahkannya ke tempat bersama
adalah perpindahan berkas dan impor — tanpa perubahan perilaku. Melakukannya
**sebelum** eMedik dan info-desa digabung mencegah dua salinan lahir, dan
melanggar §1394 adalah hal yang tidak dapat diperbaiki murah setelah terjadi.

**2. Metering mendahului seed harga.**
§46 menaruh ECO-7 (pricing/billing) sebelum hal lain yang menyentuhnya. Tetapi
tiga dari lima harga default berdiri di atas metric yang belum ada sama sekali.
Menyeed harga tanpa metering menghasilkan angka yang tidak pernah dikalikan apa
pun — dan angka seperti itu terlihat seperti fitur yang sudah jadi.

Kedua penyesuaian ini **usul**, bukan keputusan sepihak. Bila pemilik menghendaki
urutan §46 apa adanya, keduanya dapat dijalankan sesuai nomor.

## Urutan yang diusulkan

| Tahap | Isi | Bergantung pada |
| --- | --- | --- |
| **ECO-0** | Audit ini | — |
| **ECO-9a** | Pindahkan kontrak port ke tempat bersama; tanpa perubahan perilaku | — |
| **ECO-1** | Registry portal + lima situs publik dengan cross-link | ECO-0 |
| **ECO-3** | Katalog produk/modul berversi + manifest; pindahkan katalog menu dari TypeScript ke data | ECO-0 |
| **ECO-2** | Identity provider OIDC + BFF per portal | ECO-1 |
| **ECO-6a** | `TenantModuleSchema` aditif; penyelesai schema berlapis | ECO-3 |
| **ECO-5** | Entitlement + module marketplace | ECO-3, ECO-6a |
| **ECO-7a** | `PricingMetricDefinition` + `UsageMeter`/`UsageEvent` | ECO-3 |
| **ECO-7b** | Seed harga default lima portal | ECO-7a |
| **ECO-4** | Onboarding terpadu + organisasi | ECO-2, ECO-5 |
| **ECO-6b** | Provisioning orchestrator dengan state machine §37 | ECO-6a, ECO-5 |
| **ECO-8** | App shell, vertical/role switcher | ECO-5 |
| **ECO-9b** | Port yang belum ada + event namespace + data sharing agreement | ECO-9a |
| **ECO-10** | Platform control center | ECO-3, ECO-5, ECO-7 |
| **ECO-11** | CMS lima situs, SEO, analitik lintas portal | ECO-1 |
| **ECO-12** | Notification, AI, Help, sample multi-vertical | seluruhnya |
| **ECO-13** | Threat model, privasi, audit, observability | seluruhnya |
| **ECO-14** | Regresi gabungan, UAT, rilis | seluruhnya |

## Yang menghalangi mulainya ECO-1

Dua hal, dan keduanya keputusan pemilik — bukan pekerjaan:

1. **Empat belas dokumen rujukan tidak tersedia.** §3 menetapkan BRD tiap
   vertical sebagai sumber kebenaran rancangan. Tanpa itu, rancangan portal
   Enterprise Education, eMedik, eKoperasi, dan info-desa dibuat tanpa dasar
   yang perintah master sendiri tunjuk.
2. **Penomoran migrasi** perlu diputuskan sebelum tahap mana pun menambah
   migrasi — lihat [09-high-conflict-file-map.md](09-high-conflict-file-map.md).

Keduanya bukan kondisi berhenti §65. Pekerjaan yang tidak bergantung padanya —
ECO-9a khususnya — dapat dimulai lebih dahulu.

## Yang setiap tahap wajib bawa

Sesuai §2349, tiap perubahan logis: migrasi aditif, API/OpenAPI, Orval, UI,
permission, audit, Help, tests, docs, changelog modular, commit, push, dan CI.

Audit ini mencatat bahwa **Help dan Excel/PDF framework belum ada** (rencana
V8-1/V8-2/V8-5/V8-6 masih tertunda). Tuntutan "Help" pada tiap perubahan karena
itu belum dapat dipenuhi sampai kerangkanya dibangun; ini disebut sekarang agar
tidak tampak diabaikan diam-diam di kemudian hari.
