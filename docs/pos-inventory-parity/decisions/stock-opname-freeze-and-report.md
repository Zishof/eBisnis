# Keputusan: Penegakan Freeze Stock Opname + Sumber Data Laporan Cetak

**Status:** Diimplementasikan 2026-08-08. **Diverifikasi:** lint, build, test (source-only — belum
diuji terhadap PostgreSQL sungguhan, lihat blocker lingkungan pada `00-repository-baseline.md`).

## Masalah

`05-requirement-ledger-48.md` baris 09-10 mencatat dua celah terpisah pada siklus stock opname:

1. **Freeze hanya label.** `POST /stock-opnames/:id/freeze` mengubah `status` menjadi `FROZEN`,
   tetapi tidak ada kode di modul lain (POS, penerimaan barang, transfer, faktur pesanan penjualan,
   penyerahan obat eMedik) yang pernah memeriksa status itu sebelum menulis `stock_movement` baru.
   Penjualan atau penerimaan yang berjalan bersamaan dengan penghitungan fisik tetap mengubah stok
   gudang yang sedang dihitung — membuat hasil hitung salah sejak sebelum sempat disetujui.
2. **Laporan cetak membaca tabel yang salah.** `reportSql('stock-opname', ...)` membaca dari
   `legacy_stock_opname` — tabel yang secara struktural adalah vault impor DBF satu kali
   (`onboard-cmn-inventory.cli.ts`), bukan hasil siklus freeze→count→approve→post yang sungguhan.
   Pola yang identik dengan AP/AR sebelum diperbaiki: opname yang benar-benar dijalankan tidak
   pernah muncul di laporan cetak.

## Keputusan

### 1. Jendela freeze yang ditegakkan: FROZEN dan COUNTED

`countStockOpname` sengaja mengizinkan penghitungan pada status `DRAFT` juga (fleksibilitas mulai
entri hitung sebelum freeze resmi) — jadi `DRAFT` TIDAK diblokir, hanya `FROZEN`/`COUNTED`. Setelah
`APPROVED`/`POSTED`, hasil sudah final dan stok boleh bergerak lagi. Ini adalah baca literal dari
nama endpoint `freeze`: sejak dibekukan sampai selesai disetujui/diposting, bukan sepanjang hidup
sesi opname.

Cakupan freeze adalah **satu gudang penuh** (`inventory_stock_opname_session.warehouse_id`), bukan
per-produk — skema tabel tidak membedakan opname penuh dari cycle count sebagian, dan memblokir
lebih luas daripada perlu (gudang, bukan hanya produk yang sedang dihitung) lebih aman daripada
kebocoran karena cakupan yang salah tebak.

### 2. Satu fungsi bersama, dipanggil dari 6 modul terpisah

`assertWarehouseNotFrozen(client, schemaLiteral, warehouseId)` ditambahkan di
`tenant-bootstrap.service.ts` (berdampingan dengan `applyBalanceDelta`, sudah dipakai lintas modul
yang sama). Modul-modul yang menyisipkan `stock_movement` TIDAK berbagi satu fungsi penyisipan
tunggal (arsitektur historis: POS punya `ubahSaldo` sendiri, ERP purchasing/inventory/sales order
memakai `applyBalanceDelta`) — jadi pemeriksaan dipanggil satu per satu, tepat sebelum tiap
`INSERT INTO stock_movement`, di dalam transaksi yang sama:

| Modul | Fungsi | Gudang yang diperiksa |
|---|---|---|
| POS penjualan | `pos-stock.service.ts` `keluarkan()` | gudang tiap baris jual |
| POS retur | `pos-return.service.ts` `kembalikanStok()` | gudang tujuan retur |
| Penerimaan barang | `erp-purchasing.service.ts` `validateGoodsReceipt` | gudang penerimaan |
| Pembatalan validasi penerimaan | `erp-purchasing.service.ts` `reverseGoodsReceiptValidation` | gudang penerimaan |
| Transfer kirim | `erp-inventory.service.ts` dispatch | gudang sumber |
| Transfer terima | `erp-inventory.service.ts` validasi penerimaan | gudang tujuan |
| Faktur pesanan penjualan | `tenant.module.ts` `invoiceSalesOrder` | gudang outlet |
| Penyerahan obat eMedik | `emedik/adapters/inventory.adapter.ts` `issue()` | gudang farmasi |

Posting opname itu sendiri (`POST /stock-opnames/:id/post`, yang menulis movement selisih)
**sengaja tidak diberi pemeriksaan ini** — pada titik itu status sudah `APPROVED`, bukan lagi
`FROZEN`/`COUNTED`, jadi tidak pernah memblokir dirinya sendiri secara struktural (bukan karena
dikecualikan eksplisit).

Retur POS disertakan meski `05-requirement-ledger-48.md` hanya menyebut "penjualan/penerimaan" —
retur tetap menulis `stock_movement` pada gudang yang sama, dan penegakan sebagian (blokir
penjualan tapi tidak retur) adalah kondisi yang membingungkan untuk didiamkan begitu saja.

Error baru: `ErrorCodes.WAREHOUSE_FROZEN`, dilempar sebagai `AppError.conflict` (409) — pola yang
sama dengan `INSUFFICIENT_STOCK`, bukan `Error` polos yang sebelumnya dipakai fungsi tetangganya
(`consumeAvailable`) yang lolos begitu saja sebagai 500 di seluruh titik panggilnya.

### 3. Indeks parsial (V056)

Pemeriksaan berjalan pada jalur penjualan kasir — paling sering dieksekusi di seluruh sistem.
`CREATE INDEX ... WHERE status IN ('FROZEN','COUNTED')` memastikan tidak jadi sequential scan
pada tabel yang isinya mayoritas sesi `DRAFT`/`APPROVED`/`POSTED` yang tidak relevan bagi
pemeriksaan ini. Migrasi aditif murni, tidak mengubah data.

### 4. Laporan: UNION, bukan penggantian

`reportSql('stock-opname', ...)` sekarang menggabungkan `inventory_stock_opname_session`/`_line`
(hanya status `APPROVED`/`POSTED` — di titik itu `physical_qty` dijamin terisi oleh state machine,
tidak perlu pemeriksaan NULL tambahan) dengan `legacy_stock_opname` lewat `UNION ALL`, disaring
`opname_date <= $1`. Riwayat impor lama tetap tampil bersisian dengan opname hidup, bukan
digantikan — laporan "sampai tanggal X" yang kehilangan data lama akan terlihat seperti kehilangan
data, bukan perbaikan.

## Yang SENGAJA tidak dikerjakan pada slice ini

- **Reservasi stok POS (`stock_reservation`, dibuat saat item masuk keranjang).** Pemeriksaan hanya
  pada titik `stock_movement` benar-benar ditulis (penyelesaian jual), bukan pada saat reservasi
  dibuat. Reservasi yang dibuat sebelum freeze lalu diselesaikan sesudahnya akan tertangkap oleh
  pemeriksaan di `keluarkan()` — tetapi tidak ada pencegahan dini di titik reservasi. Menutup celah
  ini butuh keputusan produk (haruskah kasir bisa menambah keranjang sama sekali saat gudangnya
  dibekukan?) di luar cakupan perbaikan penegakan freeze.
- **Endpoint pembatalan (`CANCELLED`) untuk stock opname.** Kolom status mengizinkan nilainya tetapi
  tidak ada endpoint yang menerbitkannya — di luar cakupan slice ini.
- **`tenant-bootstrap.service.ts` baris ~821 (saldo awal/opening balance saat provisioning tenant
  baru).** Bukan jalur transaksi hidup yang bisa bersamaan dengan opname yang sedang berjalan
  (terjadi sebelum tenant punya data operasional apa pun) — tidak diberi pemeriksaan.

## Verifikasi

```text
apps/api lint   → 0 error/warning
apps/api build  → lulus
apps/api test   → lihat commit terkait untuk jumlah lulus
```

Tidak diuji terhadap PostgreSQL sungguhan (tidak tersedia di lingkungan audit ini). Sebelum
dianggap selesai sungguhan: jalankan migration V056 pada database pengembangan, buat opname, bekukan
(`freeze`), lalu coba selesaikan penjualan/penerimaan/transfer/faktur pada gudang yang sama dari
sesi lain dan pastikan ditolak `409 WAREHOUSE_FROZEN`; setujui dan posting opname lalu pastikan
laporan `stock-opname` menampilkannya tanpa harus lewat impor CLI.
