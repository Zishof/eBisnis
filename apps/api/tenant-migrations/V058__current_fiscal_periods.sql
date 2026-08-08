-- V058 — Periode fiskal bulanan tahun berjalan
--
-- Jurnal manual dan event otomatis sama-sama menolak posting tanpa periode
-- terbuka. Migrasi ini mengisi kekosongan tenant lama secara aditif; seed
-- tenant menjamin hal yang sama untuk tenant baru dan pergantian tahun.

INSERT INTO "{{TENANT_SCHEMA}}".fiscal_period
  (code, name, fiscal_year, period_no, start_date, end_date,
   status, is_active, is_system, is_sample, sort_order)
SELECT to_char(month_start, 'YYYY-MM'),
       CASE EXTRACT(MONTH FROM month_start)::int
         WHEN 1 THEN 'Januari' WHEN 2 THEN 'Februari' WHEN 3 THEN 'Maret'
         WHEN 4 THEN 'April' WHEN 5 THEN 'Mei' WHEN 6 THEN 'Juni'
         WHEN 7 THEN 'Juli' WHEN 8 THEN 'Agustus' WHEN 9 THEN 'September'
         WHEN 10 THEN 'Oktober' WHEN 11 THEN 'November' ELSE 'Desember'
       END || ' ' || EXTRACT(YEAR FROM month_start)::int,
       EXTRACT(YEAR FROM month_start)::int,
       EXTRACT(MONTH FROM month_start)::int,
       month_start::date,
       (month_start + interval '1 month - 1 day')::date,
       'OPEN', TRUE, TRUE, FALSE, EXTRACT(MONTH FROM month_start)::int
  FROM generate_series(
         date_trunc('year', CURRENT_DATE),
         date_trunc('year', CURRENT_DATE) + interval '11 months',
         interval '1 month'
       ) AS month_start
ON CONFLICT (code) WHERE deleted_at IS NULL DO NOTHING;
