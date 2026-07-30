# ADR-002 — Audit append-only dengan trigger database

- Status: Diterima
- Tanggal: 2026-07-30

## Konteks

Audit yang hanya ditulis dari kode aplikasi dapat dilewati: satu jalur kode baru
yang lupa memanggil `audit.record()` menghasilkan perubahan data tanpa jejak.
Untuk data keuangan dan persediaan, jejak yang tidak lengkap sama buruknya
dengan tidak ada jejak.

## Keputusan

Audit ditulis pada **dua tingkat**:

1. **Audit peristiwa bisnis** — ditulis aplikasi ke `platform__audit.audit_event`
   dengan `moduleCode`, `actionCode`, entitas, aktor, alasan, dan `requestId`.
2. **Audit perubahan baris** — ditulis **trigger PL/pgSQL generik** pada setiap
   tabel data tenant ke `<tenant>__audit.audit_row_change`. Trigger membaca
   konteks permintaan melalui `set_config('app.*', ..., true)` yang disetel
   aplikasi pada awal transaksi.

Schema audit bersifat **append-only**: role runtime tidak memiliki `UPDATE` atau
`DELETE` pada tabel audit apa pun. Tabel ledger juga dilindungi trigger:

- `stock_movement` — `forbid_ledger_mutation()` menolak UPDATE dan DELETE.
- `journal_entry` berstatus `POSTED` — `forbid_posted_journal_mutation()`.

## Konsekuensi

- Perubahan data melalui jalur apa pun (aplikasi, support context, atau psql)
  tetap menghasilkan baris audit, karena penegakannya ada di database.
- Payload sensitif dimask **sebelum** masuk audit: `password`, `token`,
  `secret`, `pin`, dan data kartu diganti penanda, bukan disimpan.
- Koreksi ledger dilakukan dengan mutasi pembalik, bukan dengan mengubah baris
  lama. Konsekuensinya, kartu stok selalu dapat direkonstruksi.
- Audit tidak memiliki foreign key ke tabel data, sehingga hapus permanen data
  master tidak pernah menghapus jejaknya.
- Kegagalan menulis audit dicatat pada log operasional dan tidak menggagalkan
  permintaan pengguna; namun trigger tingkat baris berada di dalam transaksi
  yang sama, sehingga kegagalannya membatalkan perubahan data.

## Rujukan

- `apps/api/tenant-migrations/V008__audit_triggers.sql`
- [Kebijakan lifecycle tabel](../database/table-lifecycle-policy.md)
