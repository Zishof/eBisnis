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
