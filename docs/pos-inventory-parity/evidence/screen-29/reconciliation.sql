-- Rekonsiliasi Laporan Pembelian per Periode (layar 29) terhadap reportSql('purchase-register'):
-- SELECT ... FROM purchase_order po WHERE po.deleted_at IS NULL AND po.order_date <= asOfDate
SELECT sum(po.grand_total) AS total_manual, count(*) AS po_count
FROM "uat_purchase_ap_19222".purchase_order po
WHERE po.deleted_at IS NULL AND po.order_date <= '2026-08-09'::date;
