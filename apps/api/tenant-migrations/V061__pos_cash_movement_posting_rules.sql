-- V061 — Akun dan aturan pergerakan/selisih kas POS

INSERT INTO "{{TENANT_SCHEMA}}".chart_of_account
  (account_type_id,code,name,normal_balance,path,sort_order,is_active,is_system,is_sample)
SELECT at.id,'6-1300','Beban Kas dan Selisih','DEBIT','/6-1300',13,TRUE,TRUE,FALSE
  FROM "{{TENANT_SCHEMA}}".account_type at
 WHERE at.code='OPERATING_EXPENSE' AND at.deleted_at IS NULL
ON CONFLICT (code) WHERE deleted_at IS NULL DO NOTHING;

WITH rules(code,event_code,sort_order,account_code,side,amount_key,description_template) AS (
  VALUES
    ('SYS_POS_CASH_IN_CASH_DR','POS_CASH_IN',10,'1-1100','DEBIT','amount','Kas masuk manual {sourceNumber}'),
    ('SYS_POS_CASH_IN_EQUITY_CR','POS_CASH_IN',20,'3-1100','CREDIT','amount','Sumber kas masuk {sourceNumber}'),
    ('SYS_POS_CASH_OUT_EXPENSE_DR','POS_CASH_OUT',10,'6-1300','DEBIT','amount','Beban kas keluar {sourceNumber}'),
    ('SYS_POS_CASH_OUT_CASH_CR','POS_CASH_OUT',20,'1-1100','CREDIT','amount','Kas keluar manual {sourceNumber}'),
    ('SYS_POS_VARIANCE_SHORTAGE_DR','POS_CASH_VARIANCE',10,'6-1300','DEBIT','shortage','Kekurangan kas {sourceNumber}'),
    ('SYS_POS_VARIANCE_SHORTAGE_CASH_CR','POS_CASH_VARIANCE',20,'1-1100','CREDIT','shortage','Penyesuaian kekurangan kas {sourceNumber}'),
    ('SYS_POS_VARIANCE_OVERAGE_CASH_DR','POS_CASH_VARIANCE',30,'1-1100','DEBIT','overage','Penyesuaian kelebihan kas {sourceNumber}'),
    ('SYS_POS_VARIANCE_OVERAGE_CR','POS_CASH_VARIANCE',40,'6-1300','CREDIT','overage','Kelebihan kas {sourceNumber}')
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
