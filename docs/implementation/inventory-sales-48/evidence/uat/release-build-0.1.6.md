# Bukti Build Produksi Inventory / Sales 0.1.6

Tanggal verifikasi: 6 Agustus 2026.

## Cakupan

- API NestJS dan Web React dibangun melalui `pnpm build`.
- Flutter Windows dibangun sebagai produk `inventory`, lalu dibungkus dengan
  pemasang Inno Setup agar seluruh DLL dan data runtime ikut terpasang.
- Flutter Android dibangun dengan flavor `penjualan`, produk `inventory`, JDK
  17, serta version code 106.
- Kedua klien diarahkan ke API
  `https://cmnmedika-inventory.ebisnis.id/api/v1/` dengan tenant
  `CMNMEDIKA`.

## Artefak

| Platform | Nama rilis | Ukuran | SHA-256 |
| --- | --- | ---: | --- |
| Windows 64-bit | `ebisnis-inventory-sales-0.1.6-windows.exe` | 11.549.825 byte | `8F554B45C3D44569E5D5DB507AFA853C52F1E9A6E0355B4871CEE841161FE8ED` |
| Android | `ebisnis-inventory-sales-0.1.6.apk` | 27.037.713 byte | `D14CBBA8D9D9C65FAA42D6365459F8DF9F57D6EE106D3621F611B8200752DBDE` |

Artefak binary tidak disimpan dalam riwayat Git. Berkas diterbitkan sebagai
asset GitHub Release `inventory-v0.1.6`; deployment server dapat menyalinnya ke
alias stabil `ebisnis-inventory-sales.exe` dan
`ebisnis-inventory-sales.apk` melalui alur pembaruan yang sudah ada.

## Verifikasi Fungsional

- Ledger tepat 48 layar dan seluruhnya operasional pada Web serta Flutter.
- Lima pengujian kontrak paritas API lulus.
- Dua pengujian route-context Web lulus.
- Dua puluh pengujian Flutter Inventory/Sales lulus.
- `flutter analyze lib/inventory/inventory_app.dart` lulus tanpa temuan.
- Golden desktop untuk gelombang master, stok/harga, pembelian/hutang,
  penjualan/piutang, dan keuangan/laporan telah diperiksa dan tidak kosong.
