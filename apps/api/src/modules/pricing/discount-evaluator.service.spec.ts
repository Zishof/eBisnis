import Decimal from 'decimal.js';
import {
  DiscountEvaluatorService,
  type ConditionNode,
  type DiscountEvaluationInput,
} from './discount-evaluator.service';

const BASE_INPUT: DiscountEvaluationInput = {
  selectedDeviceCount: 11,
  activeDeviceCount: 12,
  billingInterval: 'MONTH',
  billingIntervalCount: 1,
  tenantId: '00000000-0000-4000-8000-000000000001',
  tenantAgeDays: 30,
  planCode: 'POS_BUSINESS',
  currencyCode: 'IDR',
  registrationSource: 'SELF_SERVICE',
  firstSubscription: true,
  renewal: false,
  paymentMode: 'CONSOLIDATED_ALL_DEVICES',
  quoteSubtotal: new Decimal('4400000'),
  promotionCode: 'HEMAT10',
  currentDate: new Date('2026-07-30T00:00:00.000Z'),
};

function node(partial: Partial<ConditionNode>): ConditionNode {
  return { operator: 'AND', conditions: [], groups: [], ...partial };
}

describe('DiscountEvaluatorService', () => {
  const service = new DiscountEvaluatorService();

  describe('whitelist field dan operator', () => {
    it('menolak field di luar whitelist', () => {
      expect(() =>
        service.evaluate(
          node({
            conditions: [
              // Field bebas tidak pernah boleh dievaluasi.
              { field: 'DROP TABLE tenant' as never, operator: 'EQ', value: 1 },
            ],
          }),
          BASE_INPUT,
        ),
      ).toThrow(/tidak dikenali/);
    });

    it('menolak operator di luar whitelist', () => {
      expect(() =>
        service.evaluate(
          node({
            conditions: [
              { field: 'SELECTED_DEVICE_COUNT', operator: 'LIKE' as never, value: '%' },
            ],
          }),
          BASE_INPUT,
        ),
      ).toThrow(/tidak dikenali/);
    });
  });

  describe('operator perbandingan', () => {
    it.each([
      ['GTE', 11, true],
      ['GTE', 12, false],
      ['GT', 10, true],
      ['GT', 11, false],
      ['LT', 12, true],
      ['LT', 11, false],
      ['LTE', 11, true],
      ['LTE', 10, false],
      ['EQ', 11, true],
      ['NE', 11, false],
    ] as const)('%s terhadap %s menghasilkan %s', (operator, value, expected) => {
      const result = service.evaluate(
        node({ conditions: [{ field: 'SELECTED_DEVICE_COUNT', operator, value }] }),
        BASE_INPUT,
      );
      expect(result.matched).toBe(expected);
    });

    it('IN dan NOT_IN memakai daftar nilai', () => {
      expect(
        service.evaluate(
          node({
            conditions: [{ field: 'PLAN_CODE', operator: 'IN', value: ['POS_BUSINESS', 'POS_PRO'] }],
          }),
          BASE_INPUT,
        ).matched,
      ).toBe(true);

      expect(
        service.evaluate(
          node({ conditions: [{ field: 'PLAN_CODE', operator: 'NOT_IN', value: ['POS_BASIC'] }] }),
          BASE_INPUT,
        ).matched,
      ).toBe(true);
    });

    it('BETWEEN inklusif pada kedua batas', () => {
      const between = (value: unknown) =>
        service.evaluate(
          node({ conditions: [{ field: 'SELECTED_DEVICE_COUNT', operator: 'BETWEEN', value }] }),
          BASE_INPUT,
        ).matched;

      expect(between([11, 20])).toBe(true);
      expect(between([1, 11])).toBe(true);
      expect(between([12, 20])).toBe(false);
      // Batas yang tidak berpasangan tidak boleh memberi diskon.
      expect(between([5])).toBe(false);
    });

    it('IS_TRUE dan IS_FALSE hanya cocok pada boolean sesungguhnya', () => {
      expect(
        service.evaluate(
          node({ conditions: [{ field: 'FIRST_SUBSCRIPTION', operator: 'IS_TRUE', value: null }] }),
          BASE_INPUT,
        ).matched,
      ).toBe(true);

      expect(
        service.evaluate(
          node({ conditions: [{ field: 'RENEWAL', operator: 'IS_FALSE', value: null }] }),
          BASE_INPUT,
        ).matched,
      ).toBe(true);

      // Angka bukan boolean, jadi tidak cocok.
      expect(
        service.evaluate(
          node({
            conditions: [{ field: 'SELECTED_DEVICE_COUNT', operator: 'IS_TRUE', value: null }],
          }),
          BASE_INPUT,
        ).matched,
      ).toBe(false);
    });

    it('membandingkan Decimal tanpa kehilangan presisi', () => {
      const result = service.evaluate(
        node({
          conditions: [{ field: 'QUOTE_SUBTOTAL', operator: 'GTE', value: '4400000.0000' }],
        }),
        BASE_INPUT,
      );
      expect(result.matched).toBe(true);
    });

    it('membaca nilai terbungkus objek {value}', () => {
      const result = service.evaluate(
        node({
          conditions: [{ field: 'SELECTED_DEVICE_COUNT', operator: 'GTE', value: { value: 11 } }],
        }),
        BASE_INPUT,
      );
      expect(result.matched).toBe(true);
    });
  });

  describe('logika grup', () => {
    it('AND memerlukan seluruh kondisi cocok', () => {
      const result = service.evaluate(
        node({
          operator: 'AND',
          conditions: [
            { field: 'SELECTED_DEVICE_COUNT', operator: 'GTE', value: 11 },
            { field: 'PLAN_CODE', operator: 'EQ', value: 'POS_BASIC' },
          ],
        }),
        BASE_INPUT,
      );
      expect(result.matched).toBe(false);
    });

    it('OR cukup satu kondisi cocok', () => {
      const result = service.evaluate(
        node({
          operator: 'OR',
          conditions: [
            { field: 'SELECTED_DEVICE_COUNT', operator: 'GTE', value: 11 },
            { field: 'PLAN_CODE', operator: 'EQ', value: 'POS_BASIC' },
          ],
        }),
        BASE_INPUT,
      );
      expect(result.matched).toBe(true);
    });

    it('grup bersarang dievaluasi rekursif', () => {
      const result = service.evaluate(
        node({
          operator: 'AND',
          conditions: [{ field: 'CURRENCY_CODE', operator: 'EQ', value: 'IDR' }],
          groups: [
            node({
              operator: 'OR',
              conditions: [
                { field: 'PROMOTION_CODE', operator: 'EQ', value: 'TIDAK_ADA' },
                { field: 'PROMOTION_CODE', operator: 'EQ', value: 'HEMAT10' },
              ],
            }),
          ],
        }),
        BASE_INPUT,
      );
      expect(result.matched).toBe(true);
      expect(result.trace.groups).toHaveLength(1);
    });

    it('rule tanpa kondisi tidak pernah memberi diskon diam-diam', () => {
      expect(service.evaluate(node({}), BASE_INPUT).matched).toBe(false);
    });
  });

  describe('trace', () => {
    it('mencatat nilai aktual dan yang diharapkan untuk setiap kondisi', () => {
      const result = service.evaluate(
        node({
          conditions: [
            { field: 'SELECTED_DEVICE_COUNT', operator: 'GTE', value: 11 },
            { field: 'PLAN_CODE', operator: 'EQ', value: 'POS_BASIC' },
          ],
        }),
        BASE_INPUT,
      );

      expect(result.trace.conditions).toHaveLength(2);
      expect(result.trace.conditions[0]).toMatchObject({
        field: 'SELECTED_DEVICE_COUNT',
        operator: 'GTE',
        expected: 11,
        actual: 11,
        matched: true,
      });
      expect(result.trace.conditions[1].matched).toBe(false);
    });

    it('menserialisasi Decimal dan Date pada trace agar dapat disimpan sebagai JSON', () => {
      const result = service.evaluate(
        node({
          conditions: [
            { field: 'QUOTE_SUBTOTAL', operator: 'GTE', value: 0 },
            { field: 'CURRENT_DATE', operator: 'GTE', value: '2020-01-01T00:00:00.000Z' },
          ],
        }),
        BASE_INPUT,
      );
      expect(typeof result.trace.conditions[0].actual).toBe('string');
      expect(result.trace.conditions[1].actual).toBe('2026-07-30T00:00:00.000Z');
      expect(() => JSON.stringify(result.trace)).not.toThrow();
    });
  });

  describe('batas diskon perangkat', () => {
    // Aturan bisnis: diskon volume berlaku mulai perangkat ke-11.
    it('10 perangkat belum memenuhi, 11 perangkat memenuhi', () => {
      const rule = node({
        conditions: [{ field: 'SELECTED_DEVICE_COUNT', operator: 'GTE', value: 11 }],
      });

      expect(service.evaluate(rule, { ...BASE_INPUT, selectedDeviceCount: 10 }).matched).toBe(false);
      expect(service.evaluate(rule, { ...BASE_INPUT, selectedDeviceCount: 11 }).matched).toBe(true);
    });
  });
});
