-- V057 — Aturan posting bawaan Inventory/Sales
--
-- Aditif dan idempoten. Tenant yang sudah memiliki bagan akun mendapat aturan
-- sekarang; tenant baru mendapat aturan yang sama dari MasterSeedService
-- setelah bagan akun disemai.

WITH rules(code, event_code, sort_order, account_code, side, amount_key, description_template) AS (
  VALUES
    ('SYS_PURCHASE_RECEIPT_INVENTORY_DR', 'PURCHASE_GOODS_RECEIPT_VALUED', 10, '1-1400', 'DEBIT',  'inventoryValue', 'Persediaan diterima {sourceNumber}'),
    ('SYS_PURCHASE_RECEIPT_AP_CR',        'PURCHASE_GOODS_RECEIPT_VALUED', 20, '2-1100', 'CREDIT', 'inventoryValue', 'Utang penerimaan {sourceNumber}'),
    ('SYS_SALES_INVOICE_AR_GROSS_DR',     'SALES_ORDER_INVOICED',          10, '1-1300', 'DEBIT',  'gross',          'Piutang penjualan {sourceNumber}'),
    ('SYS_SALES_INVOICE_REVENUE_CR',      'SALES_ORDER_INVOICED',          20, '4-1100', 'CREDIT', 'gross',          'Pendapatan penjualan {sourceNumber}'),
    ('SYS_SALES_INVOICE_AR_TAX_DR',       'SALES_ORDER_INVOICED',          30, '1-1300', 'DEBIT',  'tax',            'Piutang pajak penjualan {sourceNumber}'),
    ('SYS_SALES_INVOICE_TAX_CR',          'SALES_ORDER_INVOICED',          40, '2-1200', 'CREDIT', 'tax',            'Pajak keluaran {sourceNumber}'),
    ('SYS_SALES_DISCOUNT_REVENUE_DR',     'SALES_ORDER_DISCOUNT',          10, '4-1100', 'DEBIT',  'discountAmount', 'Potongan penjualan {sourceNumber}'),
    ('SYS_SALES_DISCOUNT_AR_CR',          'SALES_ORDER_DISCOUNT',          20, '1-1300', 'CREDIT', 'discountAmount', 'Pengurang piutang {sourceNumber}'),
    ('SYS_SALES_COGS_DR',                 'SALES_ORDER_COGS',              10, '5-1100', 'DEBIT',  'cost',           'Harga pokok penjualan {sourceNumber}'),
    ('SYS_SALES_COGS_INVENTORY_CR',       'SALES_ORDER_COGS',              20, '1-1400', 'CREDIT', 'cost',           'Persediaan keluar {sourceNumber}')
)
INSERT INTO "{{TENANT_SCHEMA}}".accounting_posting_rule
  (code, event_code, sort_order, account_id, side, amount_key,
   skip_when_zero, description_template, effective_from, is_active, is_system)
SELECT r.code, r.event_code, r.sort_order, coa.id, r.side, r.amount_key,
       TRUE, r.description_template, DATE '2000-01-01', TRUE, TRUE
  FROM rules r
  JOIN "{{TENANT_SCHEMA}}".chart_of_account coa
    ON coa.code = r.account_code AND coa.deleted_at IS NULL AND coa.is_active
ON CONFLICT (code) WHERE deleted_at IS NULL
DO UPDATE SET event_code = EXCLUDED.event_code,
              sort_order = EXCLUDED.sort_order,
              account_id = EXCLUDED.account_id,
              side = EXCLUDED.side,
              amount_key = EXCLUDED.amount_key,
              skip_when_zero = EXCLUDED.skip_when_zero,
              description_template = EXCLUDED.description_template,
              is_active = TRUE,
              is_system = TRUE,
              updated_at = now(),
              version = "{{TENANT_SCHEMA}}".accounting_posting_rule.version + 1;
