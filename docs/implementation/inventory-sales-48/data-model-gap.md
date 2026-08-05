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

## Gelombang 1 Selesai

- `supplier` dan `customer` diperluas secara additive dengan termin legacy,
  alamat/wilayah, serta data rekening; customer juga memiliki diskon bawaan.
- `inventory_salesperson_profile` menjadi master sales lifecycle yang dapat
  ditautkan ke `user_subject`, tanpa mengganti tabel user atau map legacy.
- `V050` memproyeksikan `legacy_salesperson_map` secara idempoten dan bootstrap
  CMN memperbarui master lama tanpa menggandakan record.

Tidak ada tabel legacy yang dihapus. Perubahan schema harus additive, rerunnable,
dan teruji pada clone tenant sebelum produksi.
