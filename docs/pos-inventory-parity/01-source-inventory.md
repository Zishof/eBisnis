# 01. Source Inventory — POS/Inventory 48-Layar

**Metode:** audit statis (grep/glob/read), tanpa live DB dan tanpa Flutter build (lihat blocker
pada `00-repository-baseline.md`). Semua temuan berlabel `FACT` (terbaca langsung dari source)
kecuali ditandai lain.

## API — apps/api/src/modules

Tidak ada modul terpisah bernama `purchase`/`inventory` (non-public). Domain pembelian, stok,
harga, hutang/piutang, jurnal, dan 48-layar legacy terpusat di modul `tenant`
(`apps/api/src/modules/tenant/`, ~10 file tetapi sangat besar — konsisten dengan temuan audit
sebelumnya bahwa `tenant.module.ts` berukuran ~2.183 baris).

File kunci:

| File | Baris | Peran |
|---|---:|---|
| `tenant/sales-inventory-parity.catalog.ts` | 122 | Katalog 48 layar: nomor, nama legacy, domain, API paths, web route, status Web/Flutter (self-reported `OPERATIONAL` untuk semua) |
| `tenant/sales-inventory-operations.controller.ts` | 2.139 | Controller HTTP untuk operasi 48-layar (purchase, AP, sales, AR, journal, report snapshot, dll — termasuk fungsi `reportSql()` yang menyusun SQL laba-rugi/laba-kotor) |
| `tenant/sales-inventory-parity.catalog.spec.ts` | 54 | Test struktural katalog (lihat `00-repository-baseline.md`) |
| `tenant/sales-inventory-command-parity.spec.ts` | 31 | Verifikasi migration `V048` memuat tabel command/sync/close-run |
| `tenant/sales-inventory-party-master.spec.ts` | — | Test master supplier/customer/sales |
| `tenant.module.ts` | ~2.183 | Wiring modul tenant (mencakup `mobileCommand` — referensi ke `inventory_mobile_command`) |
| `pos/` (34 file) | — | POS kasir: shift, cart, payment, permission (`pos-rbac.spec.ts` ada) |
| `order/` (5 file), `pricing/` (4 file), `payment/` (7 file), `return/` (2 file), `accounting/` (6 file) | — | Domain pendukung POS |
| `emedik/health-tariff*`, `health-sample*`, `health-bpjs.service.ts` | — | Modul kesehatan/apotik (health-catalog.ts ~2.421 baris disebut pada audit sebelumnya, terpisah dari 48-layar inventory) |

Endpoint sinkronisasi generik (`/sync/devices/register`, `/sync/bootstrap`, `/sync/pull`,
`/sync/push`, `/sync/conflicts`) sesuai kontrak POS-5.3 **tidak ditemukan** dengan nama tersebut.
Dokumen perintah eksplisit mengizinkan endpoint feature-specific yang sudah ada, dan tabel
`inventory_mobile_command` + `inventory_sync_event` (migration `V048`) mengindikasikan mekanisme
sync tersendiri berbasis command/event, kemungkinan lewat route berbeda yang mengacu ke
`inventory_mobile_command` di `tenant.module.ts`. **UNKNOWN** — perlu pembacaan lebih dalam pada
`tenant.module.ts` dan `sales-inventory-operations.controller.ts` untuk memetakan endpoint sync
aktual, envelope command (`idempotencyKey`/`correlationId`/`deviceId`), dan protokol pull/push
nyata sebelum menilai kepatuhan terhadap POS-5.3.

## Web — apps/web/src

```text
apps/web/src/pages/pos/         — POS Web (termasuk PharmacyOperationsPage.tsx)
apps/web/src/pages/inventory/   — halaman 48-layar inventory (termasuk manual JSON:
                                   inventory-manual-content.json, inventory-illustrated-manual-content.json)
apps/web/src/pages/app/         — workspace tenant umum (InventoryPartyMasterPage.tsx,
                                   InventorySupplierWorkspacePage.tsx, dll — lihat lint warning
                                   pre-existing pada audit sebelumnya)
```

Web route untuk 48 layar mengikuti fungsi `webRouteForScreen()` pada catalog:
`/app/master/suppliers`, `/app/master/customers`, `/app/master/salespeople`,
`/app/inventory/stock`, `/app/inventory/stock-opnames`, `/app/inventory/pricing`,
`/app/purchasing/invoices`, `/app/purchasing/payables`, `/app/purchasing/reports`,
`/app/sales/invoices`, `/app/sales/receivables`, `/app/sales/note-custody`,
`/app/sales/receivable-reports`, `/app/finance/journals`, `/app/finance/profit-loss`.

## Flutter — apps/pos-flutter

```text
name: ebisnis_pos, version: 0.1.16+17
Target: Android + Windows (folder android/ dan windows/ keduanya ada)
Deskripsi source: "Klien KEDUA dari sistem yang sama, bukan POS berdiri sendiri — lihat ADR-012."
```

Struktur `lib/`: `api/`, `aturan/` (rules), `inventory/`, `layar/` (screens), `mesin/` (state
machine?), `pembaruan/` (update mechanism), `perangkat/` (hardware/devices), `produk/` (product).

Local database: **Drift/SQLite** (`drift: ^2.25.1`, `sqlite3_flutter_libs`) — sesuai kontrak
POS-5.2 (normalized local read models, bukan generic cache table). Cetak: `pdf: ^3.11.3`, Excel:
`excel: ^4.0.6`. ESC/POS **ditulis manual sebagai fungsi murni atas byte** di
`lib/perangkat/escpos.dart` (bukan paket printer pihak ketiga) — sesuai komentar source, alasan
eksplisit adalah agar dapat diuji tanpa printer fisik.

`idempotencyKey`/`commandId`/`correlationId` ditemukan di `lib/inventory/inventory_app.dart` dan
`lib/api/pos_api.dart` — `STRONG_INFERENCE` bahwa idempotency command sudah diimplementasikan pada
klien, sesuai kontrak POS-5.1. Perlu verifikasi lebih dalam apakah key dibuat sekali per command
(bukan per HTTP attempt) sesuai larangan eksplisit dokumen perintah.

`apps/pos-flutter/lib/layar/layar_kasir.dart`: dispatcher aksi keyboard shortcut kasir. Aksi yang
sudah ada handler nyata: `bantuan`, `bukaLaci`, `bayar`, `batalTransaksi`, `hapusBaris`,
`tutupDialog`. Aksi lain jatuh ke default case yang menampilkan pesan
`"${keteranganAksi[aksi]} belum tersedia pada klien ini."` — komentar source menyatakan ini
disengaja ("Dikatakan apa adanya, bukan didiamkan"), bukan tombol aktif yang diam. **Perlu audit
lanjutan**: daftar lengkap `AksiKasir` mana saja yang jatuh ke default ini, dan apakah itu memang
scope-appropriate (mis. aksi khusus platform lain) atau gap fungsional nyata.

CI/release: `.github/workflows/rilis-pos.yml` ada — indikasi pipeline rilis POS (Windows installer
+ Android APK) sudah dikonfigurasi. Belum dibaca detail isinya pada pass ini.

## CHANGELOG — riwayat gelombang paritas 48-layar (2026-08-06)

Enam entri berurutan (`Wave 0` s.d. `Wave 5`) mengklaim penyelesaian seluruh 48 layar, dengan
rincian per gelombang (master, stok/harga, pembelian/hutang, penjualan/piutang, kas/jurnal).
Lihat kutipan lengkap pada `00-repository-baseline.md`. Ini adalah `FACT` bahwa entri CHANGELOG
ada dan mengklaim ini; **bukan** `FACT` bahwa setiap klaim lulus kriteria DONE POS-14 — itu yang
perlu diverifikasi pada fase berikutnya.

## Placeholder/TODO/mock — ringkasan

Lihat `03-placeholder-and-risk-register.md` untuk daftar lengkap dan klasifikasi risiko.
