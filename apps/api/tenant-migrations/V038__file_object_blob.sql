-- =========================================================================
-- V038 — Penyimpanan BLOB pada file_object
-- =========================================================================
--
-- `file_object` (V001) sejauh ini hanya menyimpan RUJUKAN eksternal
-- (`storage_key`: path/URL ke folder server atau storage awan) -- pola
-- "Metode 1" pada dua pendekatan umum penyimpanan gambar. Kolom `oid` di
-- sini menambahkan "Metode 2": berkas disimpan SEBAGAI DATA, di dalam
-- basis data skema penyewa sendiri, lewat PostgreSQL Large Object.
--
-- Diminta langsung oleh pengguna (pola `LampiranLain` pada sistem lama):
-- berkas dan datanya tidak pernah terpisah, dan tidak berisiko terhapus
-- dari folder tanpa tercatat di basis data. Trade off-nya (basis data
-- membengkak, replikasi/backup lebih berat) diterima sadar.
--
-- Baris yang sama TIDAK memakai KEDUANYA sekaligus: `storage_key` untuk
-- baris berbasis BLOB diisi rujukan tampilan (`blob:<id>`) BUKAN alamat
-- fisik -- rujukan aslinya ada pada `oid`. Kolom `storage_key` tetap wajib
-- diisi (bukan dibuat nullable) supaya kode yang sudah ada (mis.
-- listing-projection.service.ts) yang membaca `storage_key` tanpa
-- pemeriksaan NULL tidak mendadak menerima NULL dari baris lama.
--
-- Large Object DIBACA/DITULIS lewat `lo_from_bytea`/`lo_get`, KEDUANYA
-- WAJIB di dalam transaksi (aturan PostgreSQL, bukan pilihan kita) --
-- lihat `TenantFileBlobService`. Tidak ada FK ke Large Object; penghapusan
-- objeknya (`lo_unlink`) karena itu WAJIB eksplisit di service, tidak
-- dapat diserahkan ke ON DELETE CASCADE basis data.

ALTER TABLE "{{TENANT_SCHEMA}}".file_object
  ADD COLUMN IF NOT EXISTS oid OID;
