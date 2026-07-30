import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SubscriptionPaymentMode, BillingInterval } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  ConditionNode,
  DiscountEvaluationInput,
  DiscountEvaluatorService,
  EvaluationTrace,
} from './discount-evaluator.service';

// Uang selalu Decimal, dibulatkan satu kali pada akhir waterfall.
Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export interface QuoteRequest {
  tenantId: string;
  planCode: string;
  paymentMode: SubscriptionPaymentMode;
  deviceIds?: string[];
  quantity?: number;
  billingInterval?: BillingInterval;
  billingIntervalCount?: number;
  promoCode?: string;
  channelCode?: string;
  currencyCode?: string;
  serviceDate?: Date;
}

export interface QuoteLineResult {
  deviceId: string | null;
  deviceCode: string | null;
  description: string;
  quantity: number;
  basePrice: string;
  effectiveUnitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: string;
}

export interface QuoteAdjustment {
  sourceType: string;
  sourceId: string | null;
  label: string;
  labelKey: string | null;
  amount: string;
  snapshot: Record<string, unknown>;
}

export interface QuoteCalculation {
  planCode: string;
  planName: string;
  planVersionId: string;
  planVersionNumber: number;
  currencyCode: string;
  billingInterval: BillingInterval;
  billingIntervalCount: number;
  paymentMode: SubscriptionPaymentMode;
  quantity: number;
  lines: QuoteLineResult[];
  adjustments: QuoteAdjustment[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  adminFeeTotal: string;
  grandTotal: string;
  modules: Array<{ code: string; name: string; entitlementScope: string }>;
  /** Jejak kalkulasi lengkap — disimpan pada quote dan tidak berubah setelah accepted. */
  trace: CalculationTrace;
}

export interface CalculationTraceStep {
  step: number;
  name: string;
  detail: Record<string, unknown>;
  runningSubtotal: string;
}

export interface CalculationTrace {
  steps: CalculationTraceStep[];
  input: Record<string, unknown>;
  discountEvaluations: Array<{
    programCode: string;
    ruleCode: string;
    matched: boolean;
    stackPolicy: string;
    priority: number;
    benefitApplied: string | null;
    amount: string;
    conditions: EvaluationTrace;
  }>;
  roundingMode: string;
  calculatedAt: string;
}

@Injectable()
export class PricingEngineService {
  private readonly logger = new Logger(PricingEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: DiscountEvaluatorService,
  ) {}

  /**
   * Price waterfall deterministik (bagian C0.4 master prompt):
   *  1  resolve package assignment
   *  2  resolve package version berdasarkan tanggal layanan
   *  3  resolve billing metric dan quantity
   *  4  base package price
   *  5  volume tier
   *  6  tenant contract / price override
   *  7  add-on
   *  8  promotion/discount rule
   *  9  coupon/promo code
   * 10  price floor / maximum discount
   * 11  subtotal
   * 12  pajak
   * 13  biaya admin channel
   * 14  grand total
   * 15  simpan calculation trace dan snapshot
   */
  async calculate(request: QuoteRequest): Promise<QuoteCalculation> {
    const serviceDate = request.serviceDate ?? new Date();
    const currencyCode = request.currencyCode ?? 'IDR';
    const billingInterval = request.billingInterval ?? 'MONTH';
    const billingIntervalCount = request.billingIntervalCount ?? 1;
    const steps: CalculationTraceStep[] = [];
    let stepNo = 0;

    const addStep = (name: string, detail: Record<string, unknown>, running: Decimal) => {
      stepNo += 1;
      steps.push({ step: stepNo, name, detail, runningSubtotal: running.toFixed(4) });
    };

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: { id: true, code: true, createdAt: true, status: true },
    });
    if (!tenant) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tenant tidak ditemukan.');

    // --- 1-2. Package assignment + versi berlaku -----------------------------
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: request.planCode },
      select: { id: true, code: true, name: true, status: true, deletedAt: true },
    });
    if (!plan || plan.deletedAt || plan.status !== 'PUBLISHED') {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        `Paket "${request.planCode}" tidak tersedia untuk dipesan.`,
      );
    }

    const planVersion = await this.prisma.subscriptionPlanVersion.findFirst({
      where: {
        planId: plan.id,
        status: 'PUBLISHED',
        deletedAt: null,
        effectiveFrom: { lte: serviceDate },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: serviceDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        prices: { where: { isActive: true, deletedAt: null }, include: { tiers: { orderBy: { minQuantity: 'asc' } } } },
        modules: { include: { module: true } },
        constraints: true,
      },
    });
    if (!planVersion) {
      throw AppError.unprocessable(
        ErrorCodes.PLAN_PRICE_REQUIRED,
        `Paket "${plan.code}" tidak memiliki versi yang berlaku pada ${serviceDate.toISOString().slice(0, 10)}.`,
      );
    }
    addStep('RESOLVE_PLAN_VERSION', {
      planCode: plan.code,
      planVersionId: planVersion.id,
      versionNumber: planVersion.versionNumber,
      effectiveFrom: planVersion.effectiveFrom.toISOString(),
    }, new Decimal(0));

    // --- 3. Billing metric dan quantity --------------------------------------
    const price = planVersion.prices.find(
      (p) =>
        p.currencyCode === currencyCode &&
        p.billingInterval === billingInterval &&
        p.intervalCount === billingIntervalCount &&
        p.effectiveFrom <= serviceDate &&
        (!p.effectiveUntil || p.effectiveUntil >= serviceDate),
    );
    if (!price) {
      throw AppError.unprocessable(
        ErrorCodes.PLAN_PRICE_REQUIRED,
        `Harga untuk ${plan.code} (${currencyCode}, ${billingInterval} x${billingIntervalCount}) belum tersedia.`,
      );
    }

    const devices = await this.resolveDevices(request);
    const quantity = Math.max(
      devices.length > 0 ? devices.length : (request.quantity ?? 1),
      price.minimumQty,
    );

    const minDevices = planVersion.constraints.find((c) => c.constraintType === 'MIN_DEVICES');
    const maxDevices = planVersion.constraints.find((c) => c.constraintType === 'MAX_DEVICES');
    if (minDevices?.numericValue && quantity < minDevices.numericValue) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Paket ini memerlukan minimum ${minDevices.numericValue} perangkat.`,
      );
    }
    if (maxDevices?.numericValue && quantity > maxDevices.numericValue) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Paket ini dibatasi maksimum ${maxDevices.numericValue} perangkat.`,
      );
    }
    addStep('RESOLVE_QUANTITY', {
      billingMetric: price.billingMetric,
      quantity,
      deviceCount: devices.length,
      minimumQty: price.minimumQty,
    }, new Decimal(0));

    // --- 4. Base price -------------------------------------------------------
    const basePrice = new Decimal(price.unitPrice.toString());
    addStep('BASE_PRICE', { unitPrice: basePrice.toFixed(4) }, basePrice.mul(quantity));

    // --- 5. Volume tier ------------------------------------------------------
    let effectiveUnitPrice = basePrice;
    const tier = price.tiers.find(
      (t) => quantity >= t.minQuantity && (t.maxQuantity === null || quantity <= t.maxQuantity),
    );
    if (tier?.unitPrice) {
      effectiveUnitPrice = new Decimal(tier.unitPrice.toString());
      addStep('VOLUME_TIER', {
        tierMin: tier.minQuantity,
        tierMax: tier.maxQuantity,
        unitPrice: effectiveUnitPrice.toFixed(4),
      }, effectiveUnitPrice.mul(quantity));
    } else {
      addStep('VOLUME_TIER', { applied: false }, effectiveUnitPrice.mul(quantity));
    }

    // --- 6. Tenant contract / price override ---------------------------------
    const adjustments: QuoteAdjustment[] = [];
    const override = await this.prisma.tenantPriceOverride.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true,
        deletedAt: null,
        effectiveFrom: { lte: serviceDate },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: serviceDate } }],
        AND: [{ OR: [{ planVersionId: planVersion.id }, { planVersionId: null }] }],
      },
      orderBy: [{ priority: 'asc' }, { effectiveFrom: 'desc' }],
    });

    let fixedPackageTotal: Decimal | null = null;
    if (override) {
      const before = effectiveUnitPrice;
      switch (override.overrideType) {
        case 'REPLACE_BASE_PRICE':
          effectiveUnitPrice = new Decimal((override.amount ?? 0).toString());
          break;
        case 'DISCOUNT_FROM_BASE': {
          const percent = new Decimal((override.percent ?? 0).toString());
          effectiveUnitPrice = effectiveUnitPrice.mul(new Decimal(100).minus(percent)).div(100);
          break;
        }
        case 'FIXED_PACKAGE_TOTAL':
          fixedPackageTotal = new Decimal((override.amount ?? 0).toString());
          break;
        case 'CUSTOM_FORMULA_STRUCTURED':
          effectiveUnitPrice = this.applyStructuredFormula(
            effectiveUnitPrice,
            quantity,
            override.structuredFormula,
          );
          break;
      }
      adjustments.push({
        sourceType: 'TENANT_PRICE_OVERRIDE',
        sourceId: override.id,
        label: `Harga khusus tenant (${override.overrideType})`,
        labelKey: 'pricing.tenantOverride',
        amount: fixedPackageTotal
          ? fixedPackageTotal.minus(before.mul(quantity)).toFixed(4)
          : effectiveUnitPrice.minus(before).mul(quantity).toFixed(4),
        snapshot: {
          overrideId: override.id,
          overrideType: override.overrideType,
          amount: override.amount?.toString() ?? null,
          percent: override.percent?.toString() ?? null,
          reason: override.reason,
          priceBefore: before.toFixed(4),
          priceAfter: effectiveUnitPrice.toFixed(4),
        },
      });
      addStep('TENANT_PRICE_OVERRIDE', {
        overrideType: override.overrideType,
        priceBefore: before.toFixed(4),
        priceAfter: effectiveUnitPrice.toFixed(4),
      }, fixedPackageTotal ?? effectiveUnitPrice.mul(quantity));
    } else {
      addStep('TENANT_PRICE_OVERRIDE', { applied: false }, effectiveUnitPrice.mul(quantity));
    }

    // --- 7. Line + add-on ----------------------------------------------------
    const packageSubtotal = fixedPackageTotal ?? effectiveUnitPrice.mul(quantity);
    const lines: QuoteLineResult[] = [];

    if (devices.length > 0) {
      const perDevice = fixedPackageTotal
        ? fixedPackageTotal.div(devices.length)
        : effectiveUnitPrice;
      for (const device of devices) {
        lines.push({
          deviceId: device.id,
          deviceCode: device.code,
          description: `${plan.name} — ${device.label}`,
          quantity: 1,
          basePrice: basePrice.toFixed(4),
          effectiveUnitPrice: perDevice.toFixed(4),
          discountAmount: '0.0000',
          taxAmount: '0.0000',
          lineTotal: perDevice.toFixed(4),
        });
      }
    } else {
      lines.push({
        deviceId: null,
        deviceCode: null,
        description: `${plan.name} — ${quantity} perangkat POS`,
        quantity,
        basePrice: basePrice.toFixed(4),
        effectiveUnitPrice: effectiveUnitPrice.toFixed(4),
        discountAmount: '0.0000',
        taxAmount: '0.0000',
        lineTotal: packageSubtotal.toFixed(4),
      });
    }
    addStep('BUILD_LINES', { lineCount: lines.length }, packageSubtotal);

    // --- 8-9. Discount + promo code -----------------------------------------
    const activeDeviceCount = await this.prisma.posDevice.count({
      where: { tenantId: tenant.id, status: 'ACTIVE', isBillable: true, deletedAt: null },
    });
    const firstSubscription =
      (await this.prisma.subscription.count({ where: { tenantId: tenant.id } })) === 0;

    const evaluationInput: DiscountEvaluationInput = {
      selectedDeviceCount: quantity,
      activeDeviceCount,
      billingInterval,
      billingIntervalCount,
      tenantId: tenant.id,
      tenantAgeDays: Math.floor((serviceDate.getTime() - tenant.createdAt.getTime()) / 86_400_000),
      planCode: plan.code,
      currencyCode,
      registrationSource: 'PUBLIC_WEB',
      firstSubscription,
      renewal: !firstSubscription,
      paymentMode: request.paymentMode,
      quoteSubtotal: packageSubtotal,
      promotionCode: request.promoCode,
      currentDate: serviceDate,
    };

    const discountResult = await this.applyDiscounts(
      plan.id,
      tenant.id,
      packageSubtotal,
      evaluationInput,
      request.promoCode,
      serviceDate,
    );
    adjustments.push(...discountResult.adjustments);
    const discountTotal = discountResult.totalDiscount;
    addStep('DISCOUNT', {
      programsEvaluated: discountResult.evaluations.length,
      applied: discountResult.adjustments.length,
      discountTotal: discountTotal.toFixed(4),
    }, packageSubtotal.minus(discountTotal));

    // --- 10. Price floor -----------------------------------------------------
    let subtotalAfterDiscount = packageSubtotal.minus(discountTotal);
    if (subtotalAfterDiscount.isNegative()) {
      subtotalAfterDiscount = new Decimal(0);
      addStep('PRICE_FLOOR', { floored: true, floor: '0.0000' }, subtotalAfterDiscount);
    } else {
      addStep('PRICE_FLOOR', { floored: false }, subtotalAfterDiscount);
    }

    // --- 11. Subtotal --------------------------------------------------------
    const subtotal = packageSubtotal;
    addStep('SUBTOTAL', { subtotal: subtotal.toFixed(4) }, subtotalAfterDiscount);

    // --- 12. Pajak -----------------------------------------------------------
    const taxSetting = await this.prisma.platformSetting.findUnique({
      where: { key: 'TAX_RATE_DEFAULT_PERCENT' },
    });
    const taxPercent = new Decimal(
      Number((taxSetting?.value as { value?: number } | null)?.value ?? 11),
    );
    const taxTotal = subtotalAfterDiscount.mul(taxPercent).div(100);
    addStep('TAX', { percent: taxPercent.toFixed(2), taxTotal: taxTotal.toFixed(4) },
      subtotalAfterDiscount.plus(taxTotal));

    // --- 13. Biaya admin channel --------------------------------------------
    let adminFeeTotal = new Decimal(0);
    if (request.channelCode) {
      const channel = await this.prisma.paymentChannel.findFirst({
        where: { code: request.channelCode, isActive: true, deletedAt: null },
      });
      if (channel) {
        adminFeeTotal =
          channel.adminFeeType === 'PERCENT'
            ? subtotalAfterDiscount.mul(new Decimal(channel.adminFeeValue.toString())).div(100)
            : new Decimal(channel.adminFeeValue.toString());
        const waived = adjustments.some(
          (a) => (a.snapshot as { benefitType?: string }).benefitType === 'WAIVE_ADMIN_FEE',
        );
        if (waived) adminFeeTotal = new Decimal(0);
        adjustments.push({
          sourceType: 'PAYMENT_CHANNEL_FEE',
          sourceId: channel.id,
          label: `Biaya admin ${channel.name}`,
          labelKey: channel.labelKey,
          amount: adminFeeTotal.toFixed(4),
          snapshot: {
            channelCode: channel.code,
            adminFeeType: channel.adminFeeType,
            adminFeeValue: channel.adminFeeValue.toString(),
            waived,
          },
        });
      }
    }
    addStep('ADMIN_FEE', { adminFeeTotal: adminFeeTotal.toFixed(4) },
      subtotalAfterDiscount.plus(taxTotal).plus(adminFeeTotal));

    // --- 14. Grand total (pembulatan sekali) --------------------------------
    const grandTotal = roundCurrency(subtotalAfterDiscount.plus(taxTotal).plus(adminFeeTotal), currencyCode);
    addStep('GRAND_TOTAL', { grandTotal: grandTotal.toFixed(4) }, grandTotal);

    // Distribusikan diskon dan pajak ke baris agar snapshot invoice konsisten.
    if (lines.length && discountTotal.greaterThan(0)) {
      const perLine = discountTotal.div(lines.length);
      for (const line of lines) {
        line.discountAmount = perLine.toFixed(4);
        line.lineTotal = new Decimal(line.lineTotal).minus(perLine).toFixed(4);
      }
    }
    if (lines.length && taxTotal.greaterThan(0)) {
      const perLine = taxTotal.div(lines.length);
      for (const line of lines) line.taxAmount = perLine.toFixed(4);
    }

    return {
      planCode: plan.code,
      planName: plan.name,
      planVersionId: planVersion.id,
      planVersionNumber: planVersion.versionNumber,
      currencyCode,
      billingInterval,
      billingIntervalCount,
      paymentMode: request.paymentMode,
      quantity,
      lines,
      adjustments,
      subtotal: subtotal.toFixed(4),
      discountTotal: discountTotal.toFixed(4),
      taxTotal: taxTotal.toFixed(4),
      adminFeeTotal: adminFeeTotal.toFixed(4),
      grandTotal: grandTotal.toFixed(4),
      modules: planVersion.modules
        .filter((m) => m.included)
        .map((m) => ({
          code: m.module.code,
          name: m.module.name,
          entitlementScope: m.entitlementScope,
        })),
      trace: {
        steps,
        input: {
          planCode: plan.code,
          paymentMode: request.paymentMode,
          quantity,
          deviceIds: devices.map((d) => d.id),
          billingInterval,
          billingIntervalCount,
          promoCode: request.promoCode ?? null,
          channelCode: request.channelCode ?? null,
          currencyCode,
          serviceDate: serviceDate.toISOString(),
        },
        discountEvaluations: discountResult.evaluations,
        roundingMode: 'ROUND_HALF_UP',
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  private async resolveDevices(
    request: QuoteRequest,
  ): Promise<Array<{ id: string; code: string; label: string }>> {
    if (request.paymentMode === 'CONSOLIDATED_ALL_DEVICES') {
      return this.prisma.posDevice.findMany({
        where: {
          tenantId: request.tenantId,
          isBillable: true,
          deletedAt: null,
          status: { in: ['REGISTERED', 'ACTIVE'] },
        },
        select: { id: true, code: true, label: true },
        orderBy: { code: 'asc' },
      });
    }

    if (!request.deviceIds?.length) {
      if (request.paymentMode === 'PER_DEVICE' || request.paymentMode === 'SELECTED_DEVICES') {
        // Tanpa perangkat terdaftar, kuantitas dipakai untuk simulasi harga.
        return [];
      }
      return [];
    }

    const devices = await this.prisma.posDevice.findMany({
      where: { id: { in: request.deviceIds }, tenantId: request.tenantId, deletedAt: null },
      select: { id: true, code: true, label: true },
      orderBy: { code: 'asc' },
    });
    if (devices.length !== request.deviceIds.length) {
      // Cross-tenant ID tidak boleh membocorkan keberadaan data.
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Sebagian perangkat tidak ditemukan.');
    }
    if (request.paymentMode === 'PER_DEVICE' && devices.length !== 1) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Mode PER_DEVICE hanya menerima satu perangkat.',
      );
    }
    return devices;
  }

  private async applyDiscounts(
    planId: string,
    tenantId: string,
    subtotal: Decimal,
    input: DiscountEvaluationInput,
    promoCode: string | undefined,
    serviceDate: Date,
  ): Promise<{
    adjustments: QuoteAdjustment[];
    totalDiscount: Decimal;
    evaluations: CalculationTrace['discountEvaluations'];
  }> {
    const programs = await this.prisma.discountProgram.findMany({
      where: {
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
        validFrom: { lte: serviceDate },
        OR: [{ validUntil: null }, { validUntil: { gte: serviceDate } }],
      },
      orderBy: [{ priority: 'asc' }, { code: 'asc' }],
      include: {
        rules: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sequence: 'asc' },
          include: {
            benefits: { orderBy: { sequence: 'asc' } },
            conditionGroups: { include: { conditions: { orderBy: { sequence: 'asc' } } } },
          },
        },
        tenantEligibility: true,
        planEligibility: true,
        promoCodes: { where: { isActive: true, deletedAt: null } },
      },
    });

    const evaluations: CalculationTrace['discountEvaluations'] = [];
    const candidates: Array<{
      programId: string;
      programCode: string;
      programName: string;
      priority: number;
      stackPolicy: string;
      amount: Decimal;
      benefitType: string;
      snapshot: Record<string, unknown>;
      labelKey: string | null;
    }> = [];

    for (const program of programs) {
      // Eligibility tenant: bila ada daftar include, tenant harus ada di dalamnya.
      const includedTenants = program.tenantEligibility.filter((e) => e.included);
      const excludedTenants = program.tenantEligibility.filter((e) => !e.included);
      if (excludedTenants.some((e) => e.tenantId === tenantId)) continue;
      if (includedTenants.length && !includedTenants.some((e) => e.tenantId === tenantId)) continue;

      const includedPlans = program.planEligibility.filter((e) => e.included);
      const excludedPlans = program.planEligibility.filter((e) => !e.included);
      if (excludedPlans.some((e) => e.planId === planId)) continue;
      if (includedPlans.length && !includedPlans.some((e) => e.planId === planId)) continue;

      // Promo code wajib bila program menuntutnya.
      let matchedPromoCode: { id: string; code: string } | null = null;
      if (program.requiresPromoCode) {
        if (!promoCode) continue;
        const found = program.promoCodes.find(
          (pc) =>
            pc.code.toUpperCase() === promoCode.toUpperCase() &&
            pc.validFrom <= serviceDate &&
            (!pc.validUntil || pc.validUntil >= serviceDate) &&
            (pc.maxRedemptions === null || pc.usedCount < pc.maxRedemptions),
        );
        if (!found) continue;
        matchedPromoCode = { id: found.id, code: found.code };
      }

      // Batas pemakaian program.
      if (program.maxRedemptions !== null) {
        const used = await this.prisma.discountRedemption.count({ where: { programId: program.id } });
        if (used >= program.maxRedemptions) continue;
      }
      if (program.maxPerTenant !== null) {
        const usedByTenant = await this.prisma.discountRedemption.count({
          where: { programId: program.id, tenantId },
        });
        if (usedByTenant >= program.maxPerTenant) continue;
      }

      for (const rule of program.rules) {
        const node = buildConditionTree(rule.conditionGroups);
        const { matched, trace } = this.evaluator.evaluate(node, input);

        let amount = new Decimal(0);
        let benefitType = '';
        if (matched) {
          for (const benefit of rule.benefits) {
            const value = new Decimal(benefit.numericValue.toString());
            benefitType = benefit.benefitType;
            switch (benefit.benefitType) {
              case 'PERCENT_DISCOUNT':
                amount = amount.plus(subtotal.mul(value).div(100));
                break;
              case 'FIXED_DISCOUNT':
                amount = amount.plus(value);
                break;
              case 'UNIT_PRICE_OVERRIDE':
                amount = amount.plus(
                  subtotal.minus(value.mul(input.selectedDeviceCount)).greaterThan(0)
                    ? subtotal.minus(value.mul(input.selectedDeviceCount))
                    : new Decimal(0),
                );
                break;
              case 'FREE_DEVICE_COUNT': {
                const perDevice = subtotal.div(Math.max(1, input.selectedDeviceCount));
                amount = amount.plus(perDevice.mul(value));
                break;
              }
              case 'FREE_BILLING_PERIOD':
                amount = amount.plus(subtotal.div(Math.max(1, input.billingIntervalCount)).mul(value));
                break;
              case 'WAIVE_ADMIN_FEE':
                // Ditangani pada langkah biaya admin.
                break;
            }
            if (benefit.maxAmount && amount.greaterThan(new Decimal(benefit.maxAmount.toString()))) {
              amount = new Decimal(benefit.maxAmount.toString());
            }
          }
          if (
            program.maxDiscountAmount &&
            amount.greaterThan(new Decimal(program.maxDiscountAmount.toString()))
          ) {
            amount = new Decimal(program.maxDiscountAmount.toString());
          }
        }

        evaluations.push({
          programCode: program.code,
          ruleCode: rule.code,
          matched,
          stackPolicy: program.stackPolicy,
          priority: program.priority,
          benefitApplied: matched ? benefitType || null : null,
          amount: amount.toFixed(4),
          conditions: trace,
        });

        if (matched && (amount.greaterThan(0) || benefitType === 'WAIVE_ADMIN_FEE')) {
          candidates.push({
            programId: program.id,
            programCode: program.code,
            programName: program.name,
            priority: program.priority,
            stackPolicy: program.stackPolicy,
            amount,
            benefitType,
            labelKey: rule.benefits[0]?.labelKey ?? program.nameKey,
            snapshot: {
              programId: program.id,
              programCode: program.code,
              ruleCode: rule.code,
              benefitType,
              stackPolicy: program.stackPolicy,
              priority: program.priority,
              promoCode: matchedPromoCode?.code ?? null,
              conditionTrace: trace,
            },
          });
        }
      }
    }

    // Stacking policy: EXCLUSIVE menang tunggal; BEST_PRICE ambil terbaik; STACKABLE dijumlahkan.
    const exclusive = candidates.filter((c) => c.stackPolicy === 'EXCLUSIVE');
    const bestPrice = candidates.filter((c) => c.stackPolicy === 'BEST_PRICE');
    const stackable = candidates.filter((c) => c.stackPolicy === 'STACKABLE');

    const selected: typeof candidates = [];
    if (exclusive.length) {
      const winner = exclusive.reduce((a, b) =>
        b.amount.greaterThan(a.amount) || (b.amount.equals(a.amount) && b.priority < a.priority) ? b : a,
      );
      selected.push(winner);
    } else {
      if (bestPrice.length) {
        selected.push(
          bestPrice.reduce((a, b) =>
            b.amount.greaterThan(a.amount) || (b.amount.equals(a.amount) && b.priority < a.priority) ? b : a,
          ),
        );
      }
      selected.push(...stackable);
    }

    let totalDiscount = new Decimal(0);
    const adjustments: QuoteAdjustment[] = selected.map((candidate) => {
      totalDiscount = totalDiscount.plus(candidate.amount);
      return {
        sourceType: 'DISCOUNT_PROGRAM',
        sourceId: candidate.programId,
        label: candidate.programName,
        labelKey: candidate.labelKey,
        amount: candidate.amount.negated().toFixed(4),
        snapshot: candidate.snapshot,
      };
    });

    if (totalDiscount.greaterThan(subtotal)) totalDiscount = subtotal;

    return { adjustments, totalDiscount, evaluations };
  }

  /**
   * CUSTOM_FORMULA_STRUCTURED hanya memakai operator dan field whitelist.
   * Tidak ada eval, Function constructor, atau ekspresi bebas.
   */
  private applyStructuredFormula(
    unitPrice: Decimal,
    quantity: number,
    formula: Prisma.JsonValue | null,
  ): Decimal {
    if (!formula || typeof formula !== 'object' || Array.isArray(formula)) return unitPrice;
    const spec = formula as Record<string, unknown>;
    const operations = Array.isArray(spec.operations) ? spec.operations : [];
    let value = unitPrice;

    for (const raw of operations) {
      if (!raw || typeof raw !== 'object') continue;
      const op = raw as { operator?: string; operand?: number | string; field?: string };
      const operand = new Decimal(Number(op.operand ?? 0));
      switch (op.operator) {
        case 'ADD':
          value = value.plus(operand);
          break;
        case 'SUBTRACT':
          value = value.minus(operand);
          break;
        case 'MULTIPLY':
          value = value.mul(operand);
          break;
        case 'DIVIDE':
          if (!operand.isZero()) value = value.div(operand);
          break;
        case 'PERCENT_OF':
          value = value.mul(operand).div(100);
          break;
        case 'MIN':
          value = Decimal.min(value, operand);
          break;
        case 'MAX':
          value = Decimal.max(value, operand);
          break;
        case 'MULTIPLY_BY_QUANTITY':
          value = value.mul(quantity);
          break;
        default:
          // Operator tidak dikenal diabaikan, bukan dieksekusi.
          break;
      }
    }
    return value.isNegative() ? new Decimal(0) : value;
  }
}

export function buildConditionTree(
  groups: Array<{
    id: string;
    parentGroupId: string | null;
    operator: 'AND' | 'OR';
    sequence: number;
    conditions: Array<{ field: string; operator: string; valueJson: Prisma.JsonValue }>;
  }>,
): ConditionNode {
  const toNode = (group: (typeof groups)[number]): ConditionNode => ({
    operator: group.operator,
    conditions: group.conditions.map((c) => ({
      field: c.field as ConditionNode['conditions'][number]['field'],
      operator: c.operator as ConditionNode['conditions'][number]['operator'],
      value: c.valueJson,
    })),
    groups: groups.filter((g) => g.parentGroupId === group.id).sort((a, b) => a.sequence - b.sequence).map(toNode),
  });

  const roots = groups.filter((g) => !g.parentGroupId).sort((a, b) => a.sequence - b.sequence);
  if (roots.length === 1) return toNode(roots[0]);
  return { operator: 'AND', conditions: [], groups: roots.map(toNode) };
}

/** Pembulatan mata uang dilakukan satu kali di akhir waterfall. */
export function roundCurrency(value: Decimal, currencyCode: string): Decimal {
  // IDR secara praktik tidak memakai sen.
  const decimals = currencyCode === 'IDR' ? 0 : 2;
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}
