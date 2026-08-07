# 03. Placeholder & Risk Register — POS/Inventory 48-Layar

**Metode:** `grep -rnE "TODO|FIXME|NotImplemented|belum tersedia|showWorkspaceNotice|placeholder|mock|hardcoded" apps packages`,
disaring manual. Semua baris berlabel `FACT` (dikutip langsung dari source) kecuali disebut lain.

## Sinyal generik (TODO/FIXME/placeholder/mock/hardcoded, di luar file test)

78 file cocok dengan pola gabungan tersebut. Ini adalah angka kasar, mencakup verbatim string
"mock" dalam nama variabel legiti (mis. util test-fixture) dan komentar yang justru menjelaskan
*mengapa* sesuatu **tidak** memakai mock/hardcode (pola umum di codebase ini — lihat contoh
`pos-flutter/pubspec.yaml`: "Sengaja TANPA paket pencetak pihak ketiga"). **Tidak boleh dianggap
78 bug** — perlu triase satu per satu saat masuk fase implementasi per layar. Dicatat di sini
sebagai baseline count, bukan kesimpulan.

## Sinyal spesifik risiko tinggi: `showWorkspaceNotice` / "belum tersedia" / `NotImplemented`

27 file cocok. Kategorisasi:

### Langsung relevan dengan 48-layar POS/Inventory (perlu audit lanjutan prioritas)

| File | Catatan |
|---|---|
| `apps/pos-flutter/lib/layar/layar_kasir.dart` | Dispatcher shortcut keyboard kasir. Enam aksi (`bantuan`, `bukaLaci`, `bayar`, `batalTransaksi`, `hapusBaris`, `tutupDialog`) punya handler nyata; sisanya jatuh ke pesan `"... belum tersedia pada klien ini."` — **disengaja dan jujur** (komentar source: "Dikatakan apa adanya, bukan didiamkan"), bukan tombol aktif yang diam. Bukan anti-pattern yang dilarang dokumen perintah secara harfiah, tapi tetap perlu didaftar: aksi mana saja yang jatuh ke default, dan apakah itu gap fungsional sah (scope platform lain) atau MISSING nyata. |
| `apps/pos-flutter/lib/inventory/inventory_transaction_workspaces.dart` | Belum dibaca detail. |
| `apps/pos-flutter/lib/inventory/inventory_app.dart` | Belum dibaca detail. File ini juga mengandung pola `idempotencyKey`/`commandId` (lihat `01-source-inventory.md`) — kemungkinan berisi keduanya: command dispatch idempoten DAN sisa notice untuk aksi belum lengkap. |
| `apps/web/src/pages/pos/PharmacyOperationsPage.tsx` | POS apotik Web — perlu audit apakah "belum tersedia" muncul sebagai disabled-reason yang sah atau gap. |
| `apps/api/src/modules/pricing/pricing.module.ts`, `pricing-engine.service.ts` | Domain harga inti untuk layar 11-19. |
| `apps/api/src/modules/public/pos-update.controller.ts` | Mekanisme update klien Windows/Android (POS-9 poin 7 terkait). |
| `apps/web/src/pages/inventory/inventory-manual-content.json`, `inventory-illustrated-manual-content.json` | Kemungkinan besar teks user manual/help, bukan kode — perlu verifikasi bahwa "belum tersedia" di sini adalah konten dokumentasi yang sah, bukan menyembunyikan fitur kosong. |

### Di luar cakupan 48-layar inventory (vertikal lain, dicatat untuk konteks saja)

`SitusUnitPage.tsx` dan modul CMS pesantren (vertikal pesantren, bukan POS/inventory),
`HealthOperationalModulePage.tsx`/`DeviceAdapterPage.tsx`/`health-tariff*`/`health-sample*`/
`health-bpjs.service.ts` (vertikal kesehatan/emedik — mungkin bertetangga dengan POS apotik tapi
bukan bagian dari kontrak 48-layar legacy inventory/sales), `marketplace-readiness.service.ts`/
`marketplace-enrollment.service.ts` (vertikal marketplace), `pos-rbac.spec.ts` dan
`public-host.spec.ts` (file test — bukan kode produksi), `prove-health-tariff.mjs` (script bukti
health tariff, bukan inventory), `tenant-migrations/manifest.json` dan `H022__health__tariff.sql`
(migration health, bukan V048 inventory).

## Idempotency / offline command pattern

`FACT`: `idempotencyKey`, `commandId`, dan/atau `correlationId` ditemukan pada
`apps/pos-flutter/lib/inventory/inventory_app.dart` dan `apps/pos-flutter/lib/api/pos_api.dart`.
`STRONG_INFERENCE`: mekanisme dasar POS-5.1 (persisted command identity) sudah ada pada klien.
Belum diverifikasi: apakah key dibuat SEKALI saat command dibuat (bukan per HTTP attempt saat
retry) — ini larangan eksplisit dokumen perintah dan penyebab duplikasi transaksi paling umum
pada sistem offline-first. Perlu dibaca baris-per-baris pada fase implementasi.

## Larangan destruktif — pemindaian aman

`grep -rn "db push|migrate reset|DROP SCHEMA|DROP TABLE|CASCADE" .` **tidak dijalankan penuh
repo-wide pada pass ini** (berisiko noise besar dari migration SQL yang sah memakai `CASCADE` pada
foreign key/index sebagai bagian desain, bukan sebagai operasi destruktif berbahaya). Perlu
dijalankan dengan filter lebih presisi (mis. hanya pada script CLI/`package.json`/CI workflow,
bukan migration SQL definisi constraint) pada fase berikut sebelum menyimpulkan aman/tidak.

## Kesimpulan risiko P0

Tidak ditemukan bukti tombol aktif yang murni palsu (`active button, no action, no reason`) pada
sampel yang dibaca. Pola yang ada (`layar_kasir.dart`) condong ke arah "jujur tentang keterbatasan"
sesuai semangat dokumen perintah, tapi cakupannya (aksi mana saja yang benar-benar belum ada
handler) belum dipetakan lengkap. Rekomendasi: jadikan pemetaan lengkap `AksiKasir` × handler
sebagai item pertama pada fase verifikasi P1 (POS core hardening), karena ini di jalur kritis
kasir yang paling sering dipakai.
