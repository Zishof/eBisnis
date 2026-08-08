-- V060 — Aturan posting void, retur, dan refund POS
-- Nilai pembalik selalu positif; arah pembalikan dinyatakan oleh sisi aturan.

WITH rules(code, event_code, sort_order, account_code, side, amount_key, description_template) AS (
  VALUES
    ('SYS_POS_VOID_REVENUE_DR','POS_SALE_VOID',10,'4-1100','DEBIT','gross','Pembalikan pendapatan {sourceNumber}'),
    ('SYS_POS_VOID_AR_GROSS_CR','POS_SALE_VOID',20,'1-1300','CREDIT','gross','Pembalikan piutang {sourceNumber}'),
    ('SYS_POS_VOID_TAX_DR','POS_SALE_VOID',30,'2-1200','DEBIT','tax','Pembalikan pajak {sourceNumber}'),
    ('SYS_POS_VOID_AR_TAX_CR','POS_SALE_VOID',40,'1-1300','CREDIT','tax','Pembalikan piutang pajak {sourceNumber}'),
    ('SYS_POS_VOID_AR_DISCOUNT_DR','POS_SALE_VOID',50,'1-1300','DEBIT','discountAmount','Pembalikan pengurang piutang {sourceNumber}'),
    ('SYS_POS_VOID_DISCOUNT_CR','POS_SALE_VOID',60,'4-1100','CREDIT','discountAmount','Pembalikan diskon {sourceNumber}'),
    ('SYS_POS_CASH_VOID_AR_DR','POS_CASH_RECEIPT_VOID',10,'1-1300','DEBIT','amount','Piutang pembatalan tunai {sourceNumber}'),
    ('SYS_POS_CASH_VOID_CASH_CR','POS_CASH_RECEIPT_VOID',20,'1-1100','CREDIT','amount','Kas keluar pembatalan {sourceNumber}'),
    ('SYS_POS_NONCASH_VOID_AR_DR','POS_NONCASH_RECEIPT_VOID',10,'1-1300','DEBIT','amount','Piutang pembatalan nontunai {sourceNumber}'),
    ('SYS_POS_NONCASH_VOID_BANK_CR','POS_NONCASH_RECEIPT_VOID',20,'1-1200','CREDIT','amount','Bank keluar pembatalan {sourceNumber}'),
    ('SYS_POS_COGS_VOID_INVENTORY_DR','POS_COGS_VOID',10,'1-1400','DEBIT','cost','Persediaan kembali dari void {sourceNumber}'),
    ('SYS_POS_COGS_VOID_COGS_CR','POS_COGS_VOID',20,'5-1100','CREDIT','cost','Pembalikan HPP {sourceNumber}'),
    ('SYS_POS_RETURN_REVENUE_DR','POS_RETURN',10,'4-1100','DEBIT','net','Retur pendapatan {sourceNumber}'),
    ('SYS_POS_RETURN_TAX_DR','POS_RETURN',20,'2-1200','DEBIT','tax','Retur pajak {sourceNumber}'),
    ('SYS_POS_RETURN_AR_CR','POS_RETURN',30,'1-1300','CREDIT','returnValue','Kewajiban refund {sourceNumber}'),
    ('SYS_POS_RETURN_INVENTORY_DR','POS_RETURN',40,'1-1400','DEBIT','inventoryValue','Persediaan retur {sourceNumber}'),
    ('SYS_POS_RETURN_COGS_CR','POS_RETURN',50,'5-1100','CREDIT','inventoryValue','Pembalikan HPP retur {sourceNumber}'),
    ('SYS_POS_REFUND_CASH_AR_DR','POS_REFUND',10,'1-1300','DEBIT','cashAmount','Pelunasan kewajiban refund tunai {sourceNumber}'),
    ('SYS_POS_REFUND_CASH_CR','POS_REFUND',20,'1-1100','CREDIT','cashAmount','Refund tunai {sourceNumber}'),
    ('SYS_POS_REFUND_NONCASH_AR_DR','POS_REFUND',30,'1-1300','DEBIT','noncashAmount','Pelunasan kewajiban refund nontunai {sourceNumber}'),
    ('SYS_POS_REFUND_BANK_CR','POS_REFUND',40,'1-1200','CREDIT','noncashAmount','Refund nontunai {sourceNumber}')
)
INSERT INTO "{{TENANT_SCHEMA}}".accounting_posting_rule
  (code,event_code,sort_order,account_id,side,amount_key,skip_when_zero,
   description_template,effective_from,is_active,is_system)
SELECT r.code,r.event_code,r.sort_order,coa.id,r.side,r.amount_key,TRUE,
       r.description_template,DATE '2000-01-01',TRUE,TRUE
  FROM rules r JOIN "{{TENANT_SCHEMA}}".chart_of_account coa
    ON coa.code=r.account_code AND coa.deleted_at IS NULL AND coa.is_active
ON CONFLICT (code) WHERE deleted_at IS NULL
DO UPDATE SET event_code=EXCLUDED.event_code,sort_order=EXCLUDED.sort_order,
 account_id=EXCLUDED.account_id,side=EXCLUDED.side,amount_key=EXCLUDED.amount_key,
 skip_when_zero=TRUE,description_template=EXCLUDED.description_template,
 is_active=TRUE,is_system=TRUE,updated_at=now(),
 version="{{TENANT_SCHEMA}}".accounting_posting_rule.version+1;
