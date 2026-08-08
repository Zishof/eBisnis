-- Rekonsiliasi Faktur Pembelian (layar 28) terhadap reportSql('purchase-invoice'):
-- SELECT ... FROM purchase_order po JOIN purchase_order_line pol ...
-- WHERE po.deleted_at IS NULL AND po.order_date <= asOfDate
-- Dijalankan SETELAH PO-000004 dibuat (4 PO total) -- cocok dengan api-purchase-invoice-preview.json saat ini.
SELECT po.purchase_order_number AS invoice_number, po.order_date, s.code AS supplier_code,
       p.code AS product_code, pol.ordered_qty, pol.unit_price, pol.line_total, po.status
FROM "uat_purchase_ap_19222".purchase_order po
JOIN "uat_purchase_ap_19222".supplier s ON s.id = po.supplier_id
JOIN "uat_purchase_ap_19222".purchase_order_line pol ON pol.purchase_order_id = po.id
JOIN "uat_purchase_ap_19222".product p ON p.id = pol.product_id
WHERE po.deleted_at IS NULL AND po.order_date <= '2026-08-09'::date
ORDER BY po.order_date DESC, po.purchase_order_number, pol.line_no;

SELECT sum(pol.line_total) AS total_manual
FROM "uat_purchase_ap_19222".purchase_order po
JOIN "uat_purchase_ap_19222".purchase_order_line pol ON pol.purchase_order_id = po.id
WHERE po.deleted_at IS NULL AND po.order_date <= '2026-08-09'::date;
