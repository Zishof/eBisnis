import { Injectable } from '@nestjs/common';
import { Prisma, DiscountConditionField, DiscountOperator } from '@prisma/client';
import Decimal from 'decimal.js';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/**
 * Evaluator kondisi diskon.
 *
 * TIDAK menggunakan `eval`, `Function`, template string, atau SQL dari pengguna.
 * Hanya field pada `DiscountConditionField` dan operator pada `DiscountOperator`.
 */

export interface DiscountEvaluationInput {
  selectedDeviceCount: number;
  activeDeviceCount: number;
  billingInterval: string;
  billingIntervalCount: number;
  tenantId: string;
  tenantAgeDays: number;
  planCode: string;
  currencyCode: string;
  registrationSource: string;
  firstSubscription: boolean;
  renewal: boolean;
  paymentMode: string;
  quoteSubtotal: Decimal;
  promotionCode?: string;
  currentDate: Date;
}

export interface ConditionNode {
  operator: 'AND' | 'OR';
  conditions: Array<{
    field: DiscountConditionField;
    operator: DiscountOperator;
    value: unknown;
  }>;
  groups: ConditionNode[];
}

export interface ConditionTrace {
  field: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  matched: boolean;
}

export interface EvaluationTrace {
  operator: 'AND' | 'OR';
  conditions: ConditionTrace[];
  groups: EvaluationTrace[];
  matched: boolean;
}

@Injectable()
export class DiscountEvaluatorService {
  evaluate(node: ConditionNode, input: DiscountEvaluationInput): { matched: boolean; trace: EvaluationTrace } {
    const conditionTraces: ConditionTrace[] = node.conditions.map((condition) => {
      const actual = this.readField(condition.field, input);
      const matched = this.compare(condition.operator, actual, condition.value);
      return {
        field: condition.field,
        operator: condition.operator,
        expected: condition.value,
        actual: serializeValue(actual),
        matched,
      };
    });

    const groupTraces = node.groups.map((group) => this.evaluate(group, input));

    const results = [...conditionTraces.map((t) => t.matched), ...groupTraces.map((g) => g.matched)];
    // Grup kosong dianggap tidak cocok agar rule tanpa kondisi tidak memberi diskon diam-diam.
    const matched =
      results.length === 0 ? false : node.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);

    return {
      matched,
      trace: {
        operator: node.operator,
        conditions: conditionTraces,
        groups: groupTraces.map((g) => g.trace),
        matched,
      },
    };
  }

  private readField(field: DiscountConditionField, input: DiscountEvaluationInput): unknown {
    switch (field) {
      case 'SELECTED_DEVICE_COUNT':
        return input.selectedDeviceCount;
      case 'ACTIVE_DEVICE_COUNT':
        return input.activeDeviceCount;
      case 'BILLING_INTERVAL':
        return input.billingInterval;
      case 'BILLING_INTERVAL_COUNT':
        return input.billingIntervalCount;
      case 'TENANT_ID':
        return input.tenantId;
      case 'TENANT_AGE_DAYS':
        return input.tenantAgeDays;
      case 'PLAN_CODE':
        return input.planCode;
      case 'CURRENCY_CODE':
        return input.currencyCode;
      case 'REGISTRATION_SOURCE':
        return input.registrationSource;
      case 'FIRST_SUBSCRIPTION':
        return input.firstSubscription;
      case 'RENEWAL':
        return input.renewal;
      case 'PAYMENT_MODE':
        return input.paymentMode;
      case 'QUOTE_SUBTOTAL':
        return input.quoteSubtotal;
      case 'PROMOTION_CODE':
        return input.promotionCode ?? null;
      case 'CURRENT_DATE':
        return input.currentDate;
      default:
        // Field di luar whitelist tidak boleh pernah dievaluasi.
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Field kondisi diskon tidak dikenali: ${field}`,
        );
    }
  }

  private compare(operator: DiscountOperator, actual: unknown, expected: unknown): boolean {
    const expectedValue = unwrapValue(expected);

    switch (operator) {
      case 'IS_TRUE':
        return actual === true;
      case 'IS_FALSE':
        return actual === false;
      case 'EQ':
        return this.equals(actual, expectedValue);
      case 'NE':
        return !this.equals(actual, expectedValue);
      case 'GT':
        return this.numeric(actual).greaterThan(this.numeric(expectedValue));
      case 'GTE':
        return this.numeric(actual).greaterThanOrEqualTo(this.numeric(expectedValue));
      case 'LT':
        return this.numeric(actual).lessThan(this.numeric(expectedValue));
      case 'LTE':
        return this.numeric(actual).lessThanOrEqualTo(this.numeric(expectedValue));
      case 'IN':
        return toArray(expectedValue).some((item) => this.equals(actual, item));
      case 'NOT_IN':
        return !toArray(expectedValue).some((item) => this.equals(actual, item));
      case 'BETWEEN': {
        const bounds = toArray(expectedValue);
        if (bounds.length !== 2) return false;
        const value = this.numeric(actual);
        return (
          value.greaterThanOrEqualTo(this.numeric(bounds[0])) &&
          value.lessThanOrEqualTo(this.numeric(bounds[1]))
        );
      }
      default:
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Operator kondisi diskon tidak dikenali: ${operator}`,
        );
    }
  }

  private equals(actual: unknown, expected: unknown): boolean {
    if (actual instanceof Date) {
      return new Date(String(expected)).getTime() === actual.getTime();
    }
    if (actual instanceof Decimal || Prisma.Decimal.isDecimal(actual)) {
      return this.numeric(actual).equals(this.numeric(expected));
    }
    if (typeof actual === 'number') return Number(expected) === actual;
    if (typeof actual === 'boolean') return Boolean(expected) === actual;
    if (actual === null || actual === undefined) return expected === null || expected === undefined;
    return String(expected) === String(actual);
  }

  private numeric(value: unknown): Decimal {
    if (value instanceof Decimal) return value;
    if (Prisma.Decimal.isDecimal(value)) return new Decimal(value.toString());
    if (value instanceof Date) return new Decimal(value.getTime());
    if (typeof value === 'boolean') return new Decimal(value ? 1 : 0);
    const parsed = new Decimal(Number(value ?? 0));
    return parsed.isNaN() ? new Decimal(0) : parsed;
  }
}

function unwrapValue(expected: unknown): unknown {
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && 'value' in expected) {
    return (expected as { value: unknown }).value;
  }
  return expected;
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Decimal) return value.toFixed();
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}
