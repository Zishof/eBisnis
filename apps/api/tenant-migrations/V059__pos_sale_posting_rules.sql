-- V059 — Aturan posting penjualan POS normal
--
-- Memisahkan penerimaan tunai/nontunai berdasarkan metode pembayaran aktual.
-- Event pajak dan pelepasan persediaan lama tidak lagi diterbitkan terpisah,
-- karena pajak sudah berada pada POS_SALE dan kredit persediaan pada POS_COGS.

WITH rules(code, event_code, sort_order, account_code, side, amount_key, description_template) AS (
  VALUES
    ('SYS_POS_SALE_AR_GROSS_DR',          'POS_SALE',            10, '1-1300', 'DEBIT',  'gross',          'Piutang kasir {sourceNumber}'),
    ('SYS_POS_SALE_REVENUE_CR',           'POS_SALE',            20, '4-1100', 'CREDIT', 'gross',          'Pendapatan kasir {sourceNumber}'),
    ('SYS_POS_SALE_AR_TAX_DR',            'POS_SALE',            30, '1-1300', 'DEBIT',  'tax',            'Piutang pajak kasir {sourceNumber}'),
    ('SYS_POS_SALE_TAX_CR',               'POS_SALE',            40, '2-1200', 'CREDIT', 'tax',            'Pajak keluaran kasir {sourceNumber}'),
    ('SYS_POS_DISCOUNT_REVENUE_DR',       'POS_DISCOUNT',        10, '4-1100', 'DEBIT',  'discountAmount', 'Diskon kasir {sourceNumber}'),
    ('SYS_POS_DISCOUNT_AR_CR',            'POS_DISCOUNT',        20, '1-1300', 'CREDIT', 'discountAmount', 'Pengurang piutang kasir {sourceNumber}'),
    ('SYS_POS_CASH_RECEIPT_CASH_DR',      'POS_CASH_RECEIPT',    10, '1-1100', 'DEBIT',  'amount',         'Kas diterima {sourceNumber}'),
    ('SYS_POS_CASH_RECEIPT_AR_CR',        'POS_CASH_RECEIPT',    20, '1-1300', 'CREDIT', 'amount',         'Pelunasan kasir tunai {sourceNumber}'),
    ('SYS_POS_NONCASH_RECEIPT_BANK_DR',   'POS_NONCASH_RECEIPT', 10, '1-1200', 'DEBIT',  'amount',         'Pembayaran nontunai {sourceNumber}'),
    ('SYS_POS_NONCASH_RECEIPT_AR_CR',     'POS_NONCASH_RECEIPT', 20, '1-1300', 'CREDIT', 'amount',         'Pelunasan kasir nontunai {sourceNumber}'),
    ('SYS_POS_COGS_DR',                   'POS_COGS',             10, '5-1100', 'DEBIT',  'cost',           'Harga pokok kasir {sourceNumber}'),
    ('SYS_POS_COGS_INVENTORY_CR',         'POS_COGS',             20, '1-1400', 'CREDIT', 'cost',           'Persediaan kasir keluar {sourceNumber}')
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
DO UPDATE SET event_code = EXCLUDED.event_code, sort_order = EXCLUDED.sort_order,
              account_id = EXCLUDED.account_id, side = EXCLUDED.side,
              amount_key = EXCLUDED.amount_key, skip_when_zero = TRUE,
              description_template = EXCLUDED.description_template,
              is_active = TRUE, is_system = TRUE, updated_at = now(),
              version = "{{TENANT_SCHEMA}}".accounting_posting_rule.version + 1;
