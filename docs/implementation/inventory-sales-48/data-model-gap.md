# Data Model Gap

## Sudah Tersedia

- Master ERP: supplier, customer, user/salesperson, product, UOM, lot, warehouse.
- Ledger stok immutable dan saldo proyeksi.
- Sales/purchase order, goods receipt, AR/AP legacy bridge, jurnal, COA, periode.
- Envelope operasional: pembayaran, receipt, note custody, opname, report snapshot,
  print log, sync device/event/command/conflict, period close run.

## Additive Gap

- Lifecycle cancel pada opname dengan reason/actor/timestamp.
- Item multi-baris dan versioning eksplisit pada draft buku harga.
- Metadata report lengkap: canonical sort/columns, approval, snapshot hash,
  watermark/reprint, renderer version, dan page count.
- Audit metadata perangkat/correlation pada seluruh command inventory.
- Queue attachment checksum untuk foto/berkas offline.

Tidak ada tabel legacy yang dihapus. Perubahan schema harus additive, rerunnable,
dan teruji pada clone tenant sebelum produksi.
