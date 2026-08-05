# Panduan Inventory / Sales

Sumber isi panduan berada di:

- `apps/web/src/pages/inventory/inventory-manual-content.json`
- `apps/web/src/pages/inventory/InventoryManualPage.tsx`

Dokumen publik yang dihasilkan berada di:

- `apps/web/public/panduan/inventory-sales/Panduan-Pengguna-eBisnis-Inventory-Sales.docx`
- `apps/web/public/panduan/inventory-sales/Panduan-Pengguna-eBisnis-Inventory-Sales.pdf`

Jalankan generator dari root repository:

```powershell
python tools/manuals/generate_inventory_sales_manual.py
```

Halaman daring tersedia pada `/panduan/inventory-sales`. Setelah isi atau gambar
diubah, bangun ulang dokumen dan periksa seluruh halaman hasil render sebelum
menyalin PDF final ke folder publik.

## Panduan operasional bergambar

Volume 2 menyediakan delapan ilustrasi konseptual untuk Dashboard Pemilik,
Sales Android, Produk-Batch-Harga, Pelanggan-Order-Kredit,
Pembelian-Penerimaan-Hutang, Stok Opname, Piutang-Penagihan, serta Laporan dan
Tutup Periode. Setiap ilustrasi mempunyai sedikitnya 1.500 kata penjelasan
formal dengan bahasa nonteknis.

- Word: `apps/web/public/panduan/inventory-sales/Panduan-Operasional-Bergambar-eBisnis-Inventory-Sales.docx`
- PDF: `apps/web/public/panduan/inventory-sales/Panduan-Operasional-Bergambar-eBisnis-Inventory-Sales.pdf`
- Validasi jumlah kata: `docs/user-manual/inventory-illustrated-word-count.json`
- Sumber baca daring: `apps/web/src/pages/inventory/inventory-illustrated-manual-content.json`

Jalankan generator volume bergambar dari root repository:

```powershell
python tools/manuals/generate_inventory_illustrated_manual.py
```

## Panduan transisi 48 layar

Volume transisi memasangkan setiap tangkapan layar dari manual DBF lama dengan
ilustrasi padanan eBisnis yang baru. Setiap pasangan memuat status paritas Web
dan Flutter, perubahan istilah, langkah kerja, kontrol risiko, bukti
penyelesaian, serta sedikitnya 1.500 kata penjelasan untuk pengguna nonteknis.

- Word: `apps/web/public/panduan/inventory-sales/Panduan-Transisi-48-Layar-eBisnis-Inventory-Sales.docx`
- PDF: `apps/web/public/panduan/inventory-sales/Panduan-Transisi-48-Layar-eBisnis-Inventory-Sales.pdf`
- Indeks: `docs/user-manual/inventory-transition-index.json`
- Validasi jumlah kata: `docs/user-manual/inventory-transition-word-count.json`
- Ilustrasi baru: `apps/web/public/panduan/inventory-sales/images/transisi/baru/`

Generator membaca manual dan matriks legacy dari paket dokumentasi pada folder
Downloads. Lokasi sumber dapat diganti melalui `INVENTORY_LEGACY_PACKAGE`.

```powershell
python tools/manuals/generate_inventory_transition_manual.py
```
