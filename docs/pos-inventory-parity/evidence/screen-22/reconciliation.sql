-- Rekonsiliasi Data Hutang Supplier (layar 22/23) terhadap query nyata
-- GET /inventory/legacy/payables (tenant.module.ts:2362-2407):
-- amount (net outstanding) = GREATEST(abs(lp.amount) - sum(allocated dari inventory_ap_payment POSTED), 0)
-- is_settled = net outstanding recompute setiap payment posted/reversed (sales-inventory-operations.controller.ts ~1812)
SELECT
  lp.legacy_invoice_number,
  lp.amount AS original_amount,
  COALESCE(settlement.allocated_amount, 0) AS allocated_from_posted_payments,
  GREATEST(abs(lp.amount) - COALESCE(settlement.allocated_amount, 0), 0) AS net_outstanding_manual,
  lp.is_settled AS is_settled_stored,
  (COALESCE(settlement.allocated_amount, 0) >= abs(lp.amount)) AS is_settled_manual
FROM "uat_purchase_ap_19222".legacy_payable_ledger lp
LEFT JOIN LATERAL (
  SELECT sum(a.allocated_amount) AS allocated_amount
    FROM "uat_purchase_ap_19222".inventory_ap_payment_allocation a
    JOIN "uat_purchase_ap_19222".inventory_ap_payment p ON p.id = a.payment_id
   WHERE a.payable_ledger_id = lp.id AND p.status = 'POSTED'
) settlement ON TRUE
ORDER BY lp.legacy_invoice_number;
