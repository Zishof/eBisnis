-- Rekonsiliasi AP Aging (layar 27) terhadap formula template:
-- "total per pihak = sum(outstanding) dari ledger NOT is_settled AND amount>0"
-- "overdue_days = max(asOf - due_date, 0)"
-- Query INI SENGAJA meniru persis apa yang dipakai reportSql('ap-aging') di source
-- (agingReport() helper, sales-inventory-operations.controller.ts:2308-2315) --
-- BUKAN versi "net setelah cicilan" -- catatan soal gross-vs-net ADA sebagai temuan di uat.md.
-- Dijalankan SETELAH PO-000004/GR-000004 (termasuk yang di-reverse) -- cocok dengan
-- api-ap-aging-preview.json saat ini (3 baris, total 860000, termasuk GR-000004 = payable hantu).
SELECT
  COALESCE(s.name, 'Tanpa pihak') AS party_name,
  l.legacy_invoice_number,
  l.transaction_date,
  l.due_date,
  l.amount,
  GREATEST('2026-08-09'::date - COALESCE(l.due_date, l.transaction_date, '2026-08-09'::date), 0)::int AS overdue_days_manual
FROM "uat_purchase_ap_19222".legacy_payable_ledger l
LEFT JOIN "uat_purchase_ap_19222".supplier s ON s.id = l.supplier_id
WHERE NOT l.is_settled AND l.amount > 0
  AND COALESCE(l.transaction_date, '2026-08-09'::date) <= '2026-08-09'::date
ORDER BY s.name, overdue_days_manual DESC;

-- Total keseluruhan (harus sama dengan totals.amount pada respons API)
SELECT sum(l.amount) AS total_manual
FROM "uat_purchase_ap_19222".legacy_payable_ledger l
WHERE NOT l.is_settled AND l.amount > 0
  AND COALESCE(l.transaction_date, '2026-08-09'::date) <= '2026-08-09'::date;
