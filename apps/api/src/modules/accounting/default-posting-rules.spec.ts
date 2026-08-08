import { buildJournalLines, type AccountingEvent, type PostingRule } from './posting-engine';
import { INVENTORY_SALES_DEFAULT_POSTING_RULES } from './default-posting-rules';

const ACCOUNTS: Record<string, string> = {
  '1-1300': 'ar',
  '1-1400': 'inventory',
  '2-1100': 'ap',
  '2-1200': 'tax',
  '4-1100': 'revenue',
  '5-1100': 'cogs',
};

function build(eventCode: string, amounts: Record<string, number>) {
  const event: AccountingEvent = {
    eventCode,
    sourceType: 'TEST',
    sourceId: 'source-id',
    sourceNumber: 'DOC-001',
    occurredAt: new Date('2026-08-08T00:00:00.000Z'),
    amounts,
    currencyCode: 'IDR',
  };
  const rules: PostingRule[] = INVENTORY_SALES_DEFAULT_POSTING_RULES
    .filter((rule) => rule.eventCode === eventCode)
    .map((rule) => ({
      code: rule.code,
      eventCode: rule.eventCode,
      sortOrder: rule.sortOrder,
      accountId: ACCOUNTS[rule.accountCode],
      side: rule.side,
      amountKey: rule.amountKey,
      skipWhenZero: true,
      descriptionTemplate: rule.descriptionTemplate,
      effectiveFrom: new Date('2000-01-01T00:00:00.000Z'),
      effectiveTo: null,
      isActive: true,
    }));
  return buildJournalLines(event, rules);
}

describe('aturan posting bawaan Inventory/Sales', () => {
  it.each([
    ['PURCHASE_GOODS_RECEIPT_VALUED', { inventoryValue: 870_000 }],
    ['SALES_ORDER_INVOICED', { gross: 1_000_000, net: 900_000, tax: 100_000 }],
    ['SALES_ORDER_DISCOUNT', { discountAmount: 50_000 }],
    ['SALES_ORDER_COGS', { cost: 600_000 }],
    ['POS_SALE', { gross: 1_000_000, net: 900_000, tax: 100_000 }],
    ['POS_DISCOUNT', { discountAmount: 50_000 }],
    ['POS_CASH_RECEIPT', { amount: 500_000 }],
    ['POS_NONCASH_RECEIPT', { amount: 500_000 }],
    ['POS_COGS', { cost: 600_000 }],
    ['POS_SALE_VOID', { gross: 1_000_000, tax: 100_000, discountAmount: 50_000 }],
    ['POS_CASH_RECEIPT_VOID', { amount: 500_000 }],
    ['POS_NONCASH_RECEIPT_VOID', { amount: 500_000 }],
    ['POS_COGS_VOID', { cost: 600_000 }],
    ['POS_RETURN', { returnValue: 110_000, net: 100_000, tax: 10_000, inventoryValue: 60_000 }],
    ['POS_REFUND', { refundAmount: 110_000, cashAmount: 110_000, noncashAmount: 0 }],
    ['POS_CASH_IN', { amount: 100_000 }],
    ['POS_CASH_OUT', { amount: 50_000 }],
    ['POS_CASH_VARIANCE', { expected: 100_000, counted: 90_000, variance: -10_000, shortage: 10_000, overage: 0 }],
  ])('%s selalu menghasilkan jurnal seimbang', (eventCode, amounts) => {
    const result = build(eventCode, amounts);
    expect(result.ok).toBe(true);
    expect(result.totalDebit).toBeGreaterThan(0);
    expect(result.totalDebit).toBe(result.totalCredit);
  });

  it('melewati pajak nol tanpa membuat baris nol', () => {
    const result = build('SALES_ORDER_INVOICED', { gross: 100_000, net: 100_000, tax: 0 });
    expect(result.ok).toBe(true);
    expect(result.lines).toHaveLength(2);
    expect(result.totalDebit).toBe(100_000);
  });
});
