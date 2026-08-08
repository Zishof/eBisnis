=== gross profit reconciliation ===
SELECT SUM(sol.line_total - sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost))::text AS gross_profit_total
  FROM "uat_finance_15643".sales_order so
  JOIN "uat_finance_15643".sales_order_line sol ON sol.sales_order_id = so.id
  JOIN "uat_finance_15643".product p ON p.id = sol.product_id
 WHERE so.status = 'INVOICED' AND so.order_date <= '2026-08-09';
