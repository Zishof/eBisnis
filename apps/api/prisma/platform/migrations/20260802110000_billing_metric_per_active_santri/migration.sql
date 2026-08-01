-- Menambah nilai enum BillingMetric untuk ePesantren (§13.4).
--
-- ALTER TYPE ... ADD VALUE murni aditif: nilai lama tidak berubah, dan baris
-- yang sudah memakai nilai lama tetap sah. Tidak ada yang perlu dimigrasikan.
--
-- Ditaruh sebagai migrasi tersendiri, bukan digabung dengan seed berikutnya.
-- PostgreSQL tidak mengizinkan nilai enum yang baru ditambahkan dipakai pada
-- transaksi yang sama dengan pernyataan ALTER TYPE-nya; menggabungkannya
-- dengan INSERT/UPDATE pada migrasi yang sama akan gagal saat diterapkan.

ALTER TYPE "platform"."BillingMetric" ADD VALUE 'PER_ACTIVE_SANTRI';
