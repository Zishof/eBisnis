-- Rekonsiliasi Register Pembayaran Hutang (layar 26) terhadap reportSql('ap-payment-register'):
-- SELECT ... FROM inventory_ap_payment p WHERE p.payment_date <= asOfDate (SEMUA status, bukan hanya POSTED)
SELECT sum(p.total_amount) AS total_manual_all_status, count(*) AS payment_count
FROM "uat_purchase_ap_19222".inventory_ap_payment p
WHERE p.payment_date <= '2026-08-09'::date;

-- Perbandingan: total HANYA yang berstatus POSTED (uang yang benar-benar sudah dibayar)
SELECT sum(p.total_amount) AS total_posted_only, count(*) AS posted_count
FROM "uat_purchase_ap_19222".inventory_ap_payment p
WHERE p.payment_date <= '2026-08-09'::date AND p.status = 'POSTED';
