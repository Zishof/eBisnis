# Gap Analysis Baseline

Baseline source pada commit `e513b0d`:

- Web: 20 operasional, 28 baca-saja, 0 kontrak-saja.
- Flutter Windows/Android: 5 operasional, 8 baca-saja, 35 kontrak-saja.
- API sudah memiliki workflow nyata untuk opname, buku harga, AP/AR, nota sales,
  jurnal/periode, snapshot laporan, device, cursor, dan konflik.

## Gap Utama

1. Route 48 layar belum eksplisit; seluruh fungsi masih berhimpun pada satu route.
2. Master supplier/customer/sales belum memiliki navigator record, mode detail/list,
   unsaved guard, dan CRUD penuh yang konsisten di Flutter.
3. Renderer/download PDF dan Excel berbasis snapshot belum menjadi kontrak server
   untuk seluruh laporan; watermark salinan dan print log belum konsisten.
4. Flutter belum memiliki workflow penuh pembelian, opname, buku harga, jurnal,
   periode, dan resolusi konflik.
5. Evidence E2E, visual desktop/mobile, chaos offline, rekonsiliasi 28 DBF,
   security review, dan UAT owner belum lengkap.

## Urutan Penutupan

Fondasi bersama -> master -> stok/harga -> pembelian/AP -> penjualan/AR ->
keuangan -> hardening. Status hanya dinaikkan pada commit gelombang yang membawa
tes dan evidence terkait.
