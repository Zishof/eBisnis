# 16 — Implementation Plan / MI-0 Status (2026-08-06)

## Koreksi atas temuan MI-0 (ditemukan saat memulai MI-1)

MI-0 (`02-portal-domain-username-inventory.md`, `17-high-conflict-file-map.md`)
menyimpulkan **tidak ada** konsep "Portal Registry" formal di kodebase, hanya
`VerticalSiteDomain` (host -> penyewa). Kesimpulan itu SALAH -- pencariannya
memakai pola `grep "model Portal\b"`, yang tidak menangkap nama model
sesungguhnya, `PlatformPortal` (`\b` tidak berlaku di antara "m" dan "P" pada
"PlatformPortal"). Portal Registry NYATA ada dan matang:

```text
apps/api/prisma/platform/portal.prisma      -- PlatformPortal, PlatformPortalDomain,
                                                 PlatformPortalCrossLink
apps/api/src/infrastructure/portal/portal.catalog.ts  -- KATALOG_PORTAL, satu-satunya
                                                 sumber kebenaran (data, bukan kode)
apps/api/src/infrastructure/portal/portal-host.ts     -- aturan host murni (dapat diuji
                                                 tanpa basis data)
apps/api/src/modules/master-seed/platform-seed.service.ts -- seedPortals(): upsert
                                                 idempoten dari KATALOG_PORTAL, TERMASUK
                                                 tautan silang penuh (mesh) antar seluruh
                                                 portal
apps/web/src/verticals/pesantren/santri-host.ts + SantriLayout.tsx -- pola sisi web
                                                 yang diikuti persis oleh MitraInap
```

Ini mengubah bentuk MI-1 sepenuhnya: bukan merancang Portal Registry dari nol,
melainkan MENAMBAH SATU BARIS ke `KATALOG_PORTAL` (infrastruktur sudah
menangani seed, cross-link mesh, dan endpoint publik `GET /public/portals`
secara otomatis untuk portal baru mana pun). Lihat commit MI-1 untuk detail
implementasi dan `19-requirement-ledger.csv` baris `MI-1-001`.

Efek samping temuan ini: verifikasi `GET /public/portals` lewat API sungguhan
(bukan cuma baca kode) menemukan bug pre-existing pada endpoint itu sendiri
(`linksTo` vs `linksFrom` tertukar, memengaruhi SELURUH portal, bukan cuma
MitraInap) -- diperbaiki dalam commit yang sama, dicatat di `MI-1-002`.

## Status jujur MI-0 pada titik ini

Dari 19 dokumen audit + 1 ledger yang diminta perintah master (§7.3),
**yang sudah dibuat dengan bukti nyata**:

```text
00-source-availability.md              SELESAI
01-current-state.md                     SELESAI (baseline command nyata)
02-portal-domain-username-inventory.md SELESAI
03-hospitality-capability-inventory.md SELESAI
17-high-conflict-file-map.md            SELESAI
19-requirement-ledger.csv               DIMULAI (4 baris awal, akan tumbuh tiap fase)
16-implementation-plan.md               berkas ini
```

**Belum dibuat, sengaja tidak dikarang isinya** (butuh audit lanjutan
yang masing-masing perlu waktu tersendiri, tidak dipaksakan selesai
sekaligus supaya tiap dokumen berisi bukti nyata, bukan template kosong):

```text
04-reuse-extend-adapter-create-matrix.md  -- butuh audit modul accounting/POS/inventory/
                                              workflow/notification/AI yang belum disentuh
05-data-model-gap.md                      -- baru bisa disusun setelah BRD bagian 12
                                              (Data Model Minimum) dibaca detail
06-api-route-map.md                       -- baru relevan begitu MI-1..MI-4 mulai
07-ui-route-map.md                        -- sama
08-product-entitlement-schema-map.md      -- butuh audit modul product/billing/entitlement
09-pricing-billing-analysis.md            -- status harga sudah jelas dari BRD:
                                              PRICE_CONFIGURATION_REQUIRED, tidak ada
                                              angka yang perlu dikarang; analisis
                                              mekanisme price catalog menyusul MI-4
10-role-permission-data-scope-analysis.md -- butuh STRUKTUR_MENU_ROLE_PERMISSION_MITRAINAP_V14.md
                                              dibaca detail (belum, lihat 00-source-availability.md)
11-shared-port-adapter-map.md             -- OTA/GDS/payment adapter -- BRD bagian
                                              distribution/channel belum dibaca detail
12-security-privacy-payment-threat-model.md-- menyusul MI-15 (folio/cashiering/payment)
13-demo-sample-plan.md                    -- menyusul setelah model data properti/kamar ada
14-migration-import-plan.md               -- menyusul MI-5/MI-6
15-test-baseline.md                       -- baseline test SUDAH direkam di 01-current-state.md;
                                              rencana test hospitality spesifik menyusul MI-1
18-risk-register.md                       -- akan disusun bersamaan 12 (threat model)
```

## Kerangka fase (dari perintah master §11, MI-1..MI-24)

Perintah master SUDAH mendefinisikan 24 fase lengkap dengan cakupan
masing-masing (Portal Registry, Homepage, Tenant Website, Product/
Entitlement, Property Foundation, Room Inventory, Guest CRM, Reservation/
CRS, Booking Engine, Rate/Revenue, Channel Manager, Front Office,
Housekeeping, Maintenance, Folio/Cashiering, Night Audit, Hotel POS,
Group/MICE, Guest Service, Long Stay, Guest Portal/Mobile/Kiosk, ERP
Integration, Reporting/AI, Security/UAT/Release). Isi detail tiap fase
TIDAK diduplikasi di sini -- rujuk langsung ke
`docs/mitrainap/PERINTAH_MASTER_CLAUDE_CODE_CODEX_EKSEKUSI_MITRAINAP_ID_HOSPITALITY_V14.md`
bagian 11, supaya tidak ada dua sumber kebenaran yang bisa berbeda.

## Rekomendasi urutan kerja nyata (bukan cuma mengikuti nomor MI secara buta)

Bagian ini TAMBAHAN dari worktree MitraInap, berdasarkan pola yang
terbukti berhasil di vertikal pesantren sesi sebelumnya:

1. **MI-1 (Portal Registry)** sebelum apa pun lain -- tanpa vertical code
   `HOSPITALITY` terdaftar dan bisa di-resolve dari host, seluruh fase
   berikutnya tidak punya tempat berpijak untuk diuji lewat browser
   sungguhan.
2. **MI-5 (Property Foundation)** sebelum MI-6 (Room Inventory) --
   properti/hotel adalah unit organisasi paling dasar, room inventory
   selalu anak dari properti, persis pola `pesantren_unit_pendidikan`
   sebagai induk `pesantren_psb_gelombang` di vertikal pesantren.
3. Setiap fase MI-N diakhiri dengan: migrasi (bila ada) terdaftar di
   manifest tenant-migrations/hospitality/, test lulus nyata, verifikasi
   lewat API/browser sungguhan terhadap basis data lokal (BUKAN cuma
   `tsc`/`eslint`), commit dengan pesan yang menjelaskan ALASAN bukan
   cuma APA, push ke `feature/v14-mitrainap-hospitality`.
4. **Ujian online/CBT-setara di hospitality** (kalau ada konsep serupa,
   mis. sistem loyalty/CRM kompleks atau channel manager penuh dengan
   OTA sungguhan) -- JANGAN dibangun penuh di fase awal tanpa
   kesepakatan eksplisit, ikuti pola "PSB ujian online sengaja ditunda"
   dari vertikal pesantren: tanya dulu ke pengguna sebelum
   mengasumsikan cakupan penuh diperlukan sekaligus.

## Blocker yang genuinely butuh keputusan manusia (bukan bisa diselesaikan sendiri)

```text
Harga MitraInap        -- BRD sudah eksplisit PRICE_CONFIGURATION_REQUIRED,
                          TIDAK akan dikarang angkanya
Kredensial OTA/GDS/     -- integrasi channel manager sungguhan butuh
payment provider           kontrak/API key provider yang tidak dimiliki
                          sesi ini; MI-11 akan dibangun sebagai adapter
                          port/interface dulu, bukan koneksi live
Akses server produksi   -- deploy MitraInap ke domain sungguhan
                          (mitrainap.id) perlu DNS/TLS/deploy script,
                          sama seperti santri.info: dikerjakan lewat PR,
                          dijalankan pengguna sendiri di server
Prioritas MI-N mana     -- 24 fase adalah pekerjaan multi-minggu/bulan.
yang dikerjakan dulu       Sesi ini akan mulai dari MI-1 sesuai urutan
                          logis di atas, TAPI kalau pengguna punya
                          prioritas berbeda (mis. langsung ke booking
                          engine publik dulu untuk demo), perlu
                          dikonfirmasi sebelum banyak waktu terpakai ke
                          arah yang salah.
```
