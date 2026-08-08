import type { PoolClient } from 'pg';

export interface DefaultPostingRuleDefinition {
  code: string;
  eventCode: string;
  sortOrder: number;
  accountCode: string;
  side: 'DEBIT' | 'CREDIT';
  amountKey: string;
  descriptionTemplate: string;
}

/**
 * Pemetaan minimum yang membuat transaksi Inventory/Sales dapat langsung
 * masuk buku besar. Akun tetap diselesaikan dari bagan akun tenant; mesin
 * posting tidak pernah menanam UUID atau menulis debit/kredit di controller.
 */
export const INVENTORY_SALES_DEFAULT_POSTING_RULES: DefaultPostingRuleDefinition[] = [
  {
    code: 'SYS_PURCHASE_RECEIPT_INVENTORY_DR',
    eventCode: 'PURCHASE_GOODS_RECEIPT_VALUED',
    sortOrder: 10,
    accountCode: '1-1400',
    side: 'DEBIT',
    amountKey: 'inventoryValue',
    descriptionTemplate: 'Persediaan diterima {sourceNumber}',
  },
  {
    code: 'SYS_PURCHASE_RECEIPT_AP_CR',
    eventCode: 'PURCHASE_GOODS_RECEIPT_VALUED',
    sortOrder: 20,
    accountCode: '2-1100',
    side: 'CREDIT',
    amountKey: 'inventoryValue',
    descriptionTemplate: 'Utang penerimaan {sourceNumber}',
  },
  {
    code: 'SYS_SALES_INVOICE_AR_GROSS_DR',
    eventCode: 'SALES_ORDER_INVOICED',
    sortOrder: 10,
    accountCode: '1-1300',
    side: 'DEBIT',
    amountKey: 'gross',
    descriptionTemplate: 'Piutang penjualan {sourceNumber}',
  },
  {
    code: 'SYS_SALES_INVOICE_REVENUE_CR',
    eventCode: 'SALES_ORDER_INVOICED',
    sortOrder: 20,
    accountCode: '4-1100',
    side: 'CREDIT',
    amountKey: 'gross',
    descriptionTemplate: 'Pendapatan penjualan {sourceNumber}',
  },
  {
    code: 'SYS_SALES_INVOICE_AR_TAX_DR',
    eventCode: 'SALES_ORDER_INVOICED',
    sortOrder: 30,
    accountCode: '1-1300',
    side: 'DEBIT',
    amountKey: 'tax',
    descriptionTemplate: 'Piutang pajak penjualan {sourceNumber}',
  },
  {
    code: 'SYS_SALES_INVOICE_TAX_CR',
    eventCode: 'SALES_ORDER_INVOICED',
    sortOrder: 40,
    accountCode: '2-1200',
    side: 'CREDIT',
    amountKey: 'tax',
    descriptionTemplate: 'Pajak keluaran {sourceNumber}',
  },
  {
    code: 'SYS_SALES_DISCOUNT_REVENUE_DR',
    eventCode: 'SALES_ORDER_DISCOUNT',
    sortOrder: 10,
    accountCode: '4-1100',
    side: 'DEBIT',
    amountKey: 'discountAmount',
    descriptionTemplate: 'Potongan penjualan {sourceNumber}',
  },
  {
    code: 'SYS_SALES_DISCOUNT_AR_CR',
    eventCode: 'SALES_ORDER_DISCOUNT',
    sortOrder: 20,
    accountCode: '1-1300',
    side: 'CREDIT',
    amountKey: 'discountAmount',
    descriptionTemplate: 'Pengurang piutang {sourceNumber}',
  },
  {
    code: 'SYS_SALES_COGS_DR',
    eventCode: 'SALES_ORDER_COGS',
    sortOrder: 10,
    accountCode: '5-1100',
    side: 'DEBIT',
    amountKey: 'cost',
    descriptionTemplate: 'Harga pokok penjualan {sourceNumber}',
  },
  {
    code: 'SYS_SALES_COGS_INVENTORY_CR',
    eventCode: 'SALES_ORDER_COGS',
    sortOrder: 20,
    accountCode: '1-1400',
    side: 'CREDIT',
    amountKey: 'cost',
    descriptionTemplate: 'Persediaan keluar {sourceNumber}',
  },
  {
    code: 'SYS_POS_SALE_AR_GROSS_DR', eventCode: 'POS_SALE', sortOrder: 10,
    accountCode: '1-1300', side: 'DEBIT', amountKey: 'gross',
    descriptionTemplate: 'Piutang kasir {sourceNumber}',
  },
  {
    code: 'SYS_POS_SALE_REVENUE_CR', eventCode: 'POS_SALE', sortOrder: 20,
    accountCode: '4-1100', side: 'CREDIT', amountKey: 'gross',
    descriptionTemplate: 'Pendapatan kasir {sourceNumber}',
  },
  {
    code: 'SYS_POS_SALE_AR_TAX_DR', eventCode: 'POS_SALE', sortOrder: 30,
    accountCode: '1-1300', side: 'DEBIT', amountKey: 'tax',
    descriptionTemplate: 'Piutang pajak kasir {sourceNumber}',
  },
  {
    code: 'SYS_POS_SALE_TAX_CR', eventCode: 'POS_SALE', sortOrder: 40,
    accountCode: '2-1200', side: 'CREDIT', amountKey: 'tax',
    descriptionTemplate: 'Pajak keluaran kasir {sourceNumber}',
  },
  {
    code: 'SYS_POS_DISCOUNT_REVENUE_DR', eventCode: 'POS_DISCOUNT', sortOrder: 10,
    accountCode: '4-1100', side: 'DEBIT', amountKey: 'discountAmount',
    descriptionTemplate: 'Diskon kasir {sourceNumber}',
  },
  {
    code: 'SYS_POS_DISCOUNT_AR_CR', eventCode: 'POS_DISCOUNT', sortOrder: 20,
    accountCode: '1-1300', side: 'CREDIT', amountKey: 'discountAmount',
    descriptionTemplate: 'Pengurang piutang kasir {sourceNumber}',
  },
  {
    code: 'SYS_POS_CASH_RECEIPT_CASH_DR', eventCode: 'POS_CASH_RECEIPT', sortOrder: 10,
    accountCode: '1-1100', side: 'DEBIT', amountKey: 'amount',
    descriptionTemplate: 'Kas diterima {sourceNumber}',
  },
  {
    code: 'SYS_POS_CASH_RECEIPT_AR_CR', eventCode: 'POS_CASH_RECEIPT', sortOrder: 20,
    accountCode: '1-1300', side: 'CREDIT', amountKey: 'amount',
    descriptionTemplate: 'Pelunasan kasir tunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_NONCASH_RECEIPT_BANK_DR', eventCode: 'POS_NONCASH_RECEIPT', sortOrder: 10,
    accountCode: '1-1200', side: 'DEBIT', amountKey: 'amount',
    descriptionTemplate: 'Pembayaran nontunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_NONCASH_RECEIPT_AR_CR', eventCode: 'POS_NONCASH_RECEIPT', sortOrder: 20,
    accountCode: '1-1300', side: 'CREDIT', amountKey: 'amount',
    descriptionTemplate: 'Pelunasan kasir nontunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_COGS_DR', eventCode: 'POS_COGS', sortOrder: 10,
    accountCode: '5-1100', side: 'DEBIT', amountKey: 'cost',
    descriptionTemplate: 'Harga pokok kasir {sourceNumber}',
  },
  {
    code: 'SYS_POS_COGS_INVENTORY_CR', eventCode: 'POS_COGS', sortOrder: 20,
    accountCode: '1-1400', side: 'CREDIT', amountKey: 'cost',
    descriptionTemplate: 'Persediaan kasir keluar {sourceNumber}',
  },
  {
    code: 'SYS_POS_VOID_REVENUE_DR', eventCode: 'POS_SALE_VOID', sortOrder: 10,
    accountCode: '4-1100', side: 'DEBIT', amountKey: 'gross',
    descriptionTemplate: 'Pembalikan pendapatan {sourceNumber}',
  },
  {
    code: 'SYS_POS_VOID_AR_GROSS_CR', eventCode: 'POS_SALE_VOID', sortOrder: 20,
    accountCode: '1-1300', side: 'CREDIT', amountKey: 'gross',
    descriptionTemplate: 'Pembalikan piutang {sourceNumber}',
  },
  {
    code: 'SYS_POS_VOID_TAX_DR', eventCode: 'POS_SALE_VOID', sortOrder: 30,
    accountCode: '2-1200', side: 'DEBIT', amountKey: 'tax',
    descriptionTemplate: 'Pembalikan pajak {sourceNumber}',
  },
  {
    code: 'SYS_POS_VOID_AR_TAX_CR', eventCode: 'POS_SALE_VOID', sortOrder: 40,
    accountCode: '1-1300', side: 'CREDIT', amountKey: 'tax',
    descriptionTemplate: 'Pembalikan piutang pajak {sourceNumber}',
  },
  {
    code: 'SYS_POS_VOID_AR_DISCOUNT_DR', eventCode: 'POS_SALE_VOID', sortOrder: 50,
    accountCode: '1-1300', side: 'DEBIT', amountKey: 'discountAmount',
    descriptionTemplate: 'Pembalikan pengurang piutang {sourceNumber}',
  },
  {
    code: 'SYS_POS_VOID_DISCOUNT_CR', eventCode: 'POS_SALE_VOID', sortOrder: 60,
    accountCode: '4-1100', side: 'CREDIT', amountKey: 'discountAmount',
    descriptionTemplate: 'Pembalikan diskon {sourceNumber}',
  },
  {
    code: 'SYS_POS_CASH_VOID_AR_DR', eventCode: 'POS_CASH_RECEIPT_VOID', sortOrder: 10,
    accountCode: '1-1300', side: 'DEBIT', amountKey: 'amount',
    descriptionTemplate: 'Piutang pembatalan tunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_CASH_VOID_CASH_CR', eventCode: 'POS_CASH_RECEIPT_VOID', sortOrder: 20,
    accountCode: '1-1100', side: 'CREDIT', amountKey: 'amount',
    descriptionTemplate: 'Kas keluar pembatalan {sourceNumber}',
  },
  {
    code: 'SYS_POS_NONCASH_VOID_AR_DR', eventCode: 'POS_NONCASH_RECEIPT_VOID', sortOrder: 10,
    accountCode: '1-1300', side: 'DEBIT', amountKey: 'amount',
    descriptionTemplate: 'Piutang pembatalan nontunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_NONCASH_VOID_BANK_CR', eventCode: 'POS_NONCASH_RECEIPT_VOID', sortOrder: 20,
    accountCode: '1-1200', side: 'CREDIT', amountKey: 'amount',
    descriptionTemplate: 'Bank keluar pembatalan {sourceNumber}',
  },
  {
    code: 'SYS_POS_COGS_VOID_INVENTORY_DR', eventCode: 'POS_COGS_VOID', sortOrder: 10,
    accountCode: '1-1400', side: 'DEBIT', amountKey: 'cost',
    descriptionTemplate: 'Persediaan kembali dari void {sourceNumber}',
  },
  {
    code: 'SYS_POS_COGS_VOID_COGS_CR', eventCode: 'POS_COGS_VOID', sortOrder: 20,
    accountCode: '5-1100', side: 'CREDIT', amountKey: 'cost',
    descriptionTemplate: 'Pembalikan HPP {sourceNumber}',
  },
  {
    code: 'SYS_POS_RETURN_REVENUE_DR', eventCode: 'POS_RETURN', sortOrder: 10,
    accountCode: '4-1100', side: 'DEBIT', amountKey: 'net',
    descriptionTemplate: 'Retur pendapatan {sourceNumber}',
  },
  {
    code: 'SYS_POS_RETURN_TAX_DR', eventCode: 'POS_RETURN', sortOrder: 20,
    accountCode: '2-1200', side: 'DEBIT', amountKey: 'tax',
    descriptionTemplate: 'Retur pajak {sourceNumber}',
  },
  {
    code: 'SYS_POS_RETURN_AR_CR', eventCode: 'POS_RETURN', sortOrder: 30,
    accountCode: '1-1300', side: 'CREDIT', amountKey: 'returnValue',
    descriptionTemplate: 'Kewajiban refund {sourceNumber}',
  },
  {
    code: 'SYS_POS_RETURN_INVENTORY_DR', eventCode: 'POS_RETURN', sortOrder: 40,
    accountCode: '1-1400', side: 'DEBIT', amountKey: 'inventoryValue',
    descriptionTemplate: 'Persediaan retur {sourceNumber}',
  },
  {
    code: 'SYS_POS_RETURN_COGS_CR', eventCode: 'POS_RETURN', sortOrder: 50,
    accountCode: '5-1100', side: 'CREDIT', amountKey: 'inventoryValue',
    descriptionTemplate: 'Pembalikan HPP retur {sourceNumber}',
  },
  {
    code: 'SYS_POS_REFUND_CASH_AR_DR', eventCode: 'POS_REFUND', sortOrder: 10,
    accountCode: '1-1300', side: 'DEBIT', amountKey: 'cashAmount',
    descriptionTemplate: 'Pelunasan kewajiban refund tunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_REFUND_CASH_CR', eventCode: 'POS_REFUND', sortOrder: 20,
    accountCode: '1-1100', side: 'CREDIT', amountKey: 'cashAmount',
    descriptionTemplate: 'Refund tunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_REFUND_NONCASH_AR_DR', eventCode: 'POS_REFUND', sortOrder: 30,
    accountCode: '1-1300', side: 'DEBIT', amountKey: 'noncashAmount',
    descriptionTemplate: 'Pelunasan kewajiban refund nontunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_REFUND_BANK_CR', eventCode: 'POS_REFUND', sortOrder: 40,
    accountCode: '1-1200', side: 'CREDIT', amountKey: 'noncashAmount',
    descriptionTemplate: 'Refund nontunai {sourceNumber}',
  },
  {
    code: 'SYS_POS_CASH_IN_CASH_DR', eventCode: 'POS_CASH_IN', sortOrder: 10,
    accountCode: '1-1100', side: 'DEBIT', amountKey: 'amount',
    descriptionTemplate: 'Kas masuk manual {sourceNumber}',
  },
  {
    code: 'SYS_POS_CASH_IN_EQUITY_CR', eventCode: 'POS_CASH_IN', sortOrder: 20,
    accountCode: '3-1100', side: 'CREDIT', amountKey: 'amount',
    descriptionTemplate: 'Sumber kas masuk {sourceNumber}',
  },
  {
    code: 'SYS_POS_CASH_OUT_EXPENSE_DR', eventCode: 'POS_CASH_OUT', sortOrder: 10,
    accountCode: '6-1300', side: 'DEBIT', amountKey: 'amount',
    descriptionTemplate: 'Beban kas keluar {sourceNumber}',
  },
  {
    code: 'SYS_POS_CASH_OUT_CASH_CR', eventCode: 'POS_CASH_OUT', sortOrder: 20,
    accountCode: '1-1100', side: 'CREDIT', amountKey: 'amount',
    descriptionTemplate: 'Kas keluar manual {sourceNumber}',
  },
  {
    code: 'SYS_POS_VARIANCE_SHORTAGE_DR', eventCode: 'POS_CASH_VARIANCE', sortOrder: 10,
    accountCode: '6-1300', side: 'DEBIT', amountKey: 'shortage',
    descriptionTemplate: 'Kekurangan kas {sourceNumber}',
  },
  {
    code: 'SYS_POS_VARIANCE_SHORTAGE_CASH_CR', eventCode: 'POS_CASH_VARIANCE', sortOrder: 20,
    accountCode: '1-1100', side: 'CREDIT', amountKey: 'shortage',
    descriptionTemplate: 'Penyesuaian kekurangan kas {sourceNumber}',
  },
  {
    code: 'SYS_POS_VARIANCE_OVERAGE_CASH_DR', eventCode: 'POS_CASH_VARIANCE', sortOrder: 30,
    accountCode: '1-1100', side: 'DEBIT', amountKey: 'overage',
    descriptionTemplate: 'Penyesuaian kelebihan kas {sourceNumber}',
  },
  {
    code: 'SYS_POS_VARIANCE_OVERAGE_CR', eventCode: 'POS_CASH_VARIANCE', sortOrder: 40,
    accountCode: '6-1300', side: 'CREDIT', amountKey: 'overage',
    descriptionTemplate: 'Kelebihan kas {sourceNumber}',
  },
];

/** Menyemai aturan setelah bagan akun tersedia; aman dijalankan berulang. */
export async function ensureInventorySalesPostingRules(
  client: PoolClient,
  schemaName: string,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const rule of INVENTORY_SALES_DEFAULT_POSTING_RULES) {
    const result = await client.query<{ inserted: boolean }>(
      `INSERT INTO "${schemaName}".accounting_posting_rule
         (code, event_code, sort_order, account_id, side, amount_key,
          skip_when_zero, description_template, effective_from, is_active, is_system)
       SELECT $1, $2, $3, coa.id, $4, $5, TRUE, $6, DATE '2000-01-01', TRUE, TRUE
         FROM "${schemaName}".chart_of_account coa
        WHERE coa.code = $7 AND coa.deleted_at IS NULL AND coa.is_active
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
                     version = "${schemaName}".accounting_posting_rule.version + 1
       RETURNING (xmax = 0) AS inserted`,
      [
        rule.code,
        rule.eventCode,
        rule.sortOrder,
        rule.side,
        rule.amountKey,
        rule.descriptionTemplate,
        rule.accountCode,
      ],
    );
    if (!result.rowCount) continue;
    if (result.rows[0].inserted) inserted += 1;
    else updated += 1;
  }

  return { inserted, updated };
}
