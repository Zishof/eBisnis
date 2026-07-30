import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SubscriptionPaymentMode, BillingInterval } from '@prisma/client';
import Decimal from 'decimal.js';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PricingEngineService } from '../pricing/pricing-engine.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PricingEngineService,
    private readonly audit: AuditService,
  ) {}

  async registerDevice(
    tenantId: string,
    input: { code: string; label: string; outletCode?: string },
    actorUserId: string,
  ) {
    const existing = await this.prisma.posDevice.findUnique({
      where: { tenantId_code: { tenantId, code: input.code } },
    });
    if (existing && !existing.deletedAt) {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Kode perangkat sudah dipakai pada tenant ini.');
    }

    const trialDays = 30;
    const device = await this.prisma.posDevice.upsert({
      where: { tenantId_code: { tenantId, code: input.code } },
      create: {
        tenantId,
        code: input.code,
        label: input.label,
        outletCode: input.outletCode ?? null,
        status: 'REGISTERED',
        isBillable: true,
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + trialDays * 86_400_000),
        createdBy: actorUserId,
      },
      update: {
        label: input.label,
        outletCode: input.outletCode ?? null,
        deletedAt: null,
        isActive: true,
        status: 'REGISTERED',
      },
    });

    // Kode aktivasi sekali pakai untuk pairing perangkat.
    const activationCode = randomBytes(8).toString('hex').toUpperCase();
    await this.prisma.deviceActivation.create({
      data: {
        deviceId: device.id,
        activationCode,
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
      },
    });

    await this.audit.record({
      moduleCode: 'BILLING',
      actionCode: 'DEVICE_REGISTERED',
      entityType: 'PosDevice',
      entityId: device.id,
      tenantId,
      actorUserId,
      metadata: { code: device.code, label: device.label },
    });

    return {
      id: device.id,
      code: device.code,
      label: device.label,
      status: device.status,
      trialEndsAt: device.trialEndsAt,
      activationCode,
      activationExpiresAt: new Date(Date.now() + 24 * 3_600_000),
    };
  }

  async revokeDevice(tenantId: string, deviceId: string, reason: string | undefined, actorUserId: string) {
    const device = await this.prisma.posDevice.findUnique({ where: { id: deviceId } });
    if (!device || device.tenantId !== tenantId || device.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perangkat tidak ditemukan.');
    }

    await this.prisma.$transaction([
      this.prisma.posDevice.update({
        where: { id: deviceId },
        data: { status: 'REVOKED', revokedAt: new Date(), isBillable: false },
      }),
      this.prisma.deviceEntitlement.updateMany({
        where: { deviceId, status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] } },
        data: { status: 'REVOKED' },
      }),
      this.prisma.deviceActivation.updateMany({
        where: { deviceId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: reason ?? 'Perangkat dicabut' },
      }),
    ]);

    await this.audit.record({
      moduleCode: 'BILLING',
      actionCode: 'DEVICE_REVOKED',
      entityType: 'PosDevice',
      entityId: deviceId,
      tenantId,
      actorUserId,
      reason,
    });

    return { revoked: true, deviceId };
  }

  async createQuote(
    tenantId: string,
    input: {
      planCode: string;
      paymentMode: SubscriptionPaymentMode;
      deviceIds?: string[];
      quantity?: number;
      billingInterval?: BillingInterval;
      billingIntervalCount?: number;
      promoCode?: string;
      channelCode?: string;
    },
    options: { actorUserId: string; idempotencyKey?: string },
  ) {
    if (options.idempotencyKey) {
      const existing = await this.prisma.pricingQuote.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
        include: { lines: true, adjustments: true },
      });
      if (existing) return existing;
    }

    const calculation = await this.engine.calculate({
      tenantId,
      planCode: input.planCode,
      paymentMode: input.paymentMode,
      deviceIds: input.deviceIds,
      quantity: input.quantity,
      billingInterval: input.billingInterval,
      billingIntervalCount: input.billingIntervalCount,
      promoCode: input.promoCode,
      channelCode: input.channelCode,
    });

    const quote = await this.prisma.pricingQuote.create({
      data: {
        quoteNumber: `QT-${Date.now().toString(36).toUpperCase()}`,
        tenantId,
        planVersionId: calculation.planVersionId,
        paymentMode: calculation.paymentMode,
        currencyCode: calculation.currencyCode,
        billingInterval: calculation.billingInterval,
        intervalCount: calculation.billingIntervalCount,
        quantity: calculation.quantity,
        subtotal: new Prisma.Decimal(calculation.subtotal),
        discountTotal: new Prisma.Decimal(calculation.discountTotal),
        taxTotal: new Prisma.Decimal(calculation.taxTotal),
        adminFeeTotal: new Prisma.Decimal(calculation.adminFeeTotal),
        grandTotal: new Prisma.Decimal(calculation.grandTotal),
        promoCode: input.promoCode ?? null,
        status: 'CALCULATED',
        calculationTrace: calculation.trace as unknown as Prisma.InputJsonValue,
        inputSnapshot: calculation.trace.input as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
        idempotencyKey: options.idempotencyKey ?? null,
        createdBy: options.actorUserId,
        lines: {
          create: calculation.lines.map((line, index) => ({
            deviceId: line.deviceId,
            scopeType: line.deviceId ? 'DEVICE' : 'TENANT',
            description: line.description,
            quantity: line.quantity,
            basePrice: new Prisma.Decimal(line.basePrice),
            effectiveUnitPrice: new Prisma.Decimal(line.effectiveUnitPrice),
            discountAmount: new Prisma.Decimal(line.discountAmount),
            taxAmount: new Prisma.Decimal(line.taxAmount),
            lineTotal: new Prisma.Decimal(line.lineTotal),
            sortOrder: index + 1,
          })),
        },
        adjustments: {
          create: calculation.adjustments.map((adjustment, index) => ({
            sourceType: adjustment.sourceType,
            sourceId: adjustment.sourceId,
            label: adjustment.label,
            labelKey: adjustment.labelKey,
            amount: new Prisma.Decimal(adjustment.amount),
            ruleSnapshot: adjustment.snapshot as Prisma.InputJsonValue,
            sequence: index + 1,
          })),
        },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, adjustments: { orderBy: { sequence: 'asc' } } },
    });

    await this.audit.record({
      moduleCode: 'BILLING',
      actionCode: 'QUOTE_CREATED',
      entityType: 'PricingQuote',
      entityId: quote.id,
      documentNumber: quote.quoteNumber,
      tenantId,
      actorUserId: options.actorUserId,
      metadata: {
        planCode: calculation.planCode,
        quantity: calculation.quantity,
        grandTotal: calculation.grandTotal,
      },
    });

    return { ...quote, calculation };
  }

  /** Quote yang diterima menjadi subscription + invoice immutable. */
  async acceptQuote(tenantId: string, quoteId: string, actorUserId: string) {
    const quote = await this.prisma.pricingQuote.findUnique({
      where: { id: quoteId },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, planVersion: { include: { plan: true } } },
    });
    if (!quote || quote.tenantId !== tenantId) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Quote tidak ditemukan.');
    }
    if (quote.status === 'ACCEPTED') {
      throw AppError.conflict(ErrorCodes.QUOTE_ALREADY_ACCEPTED, 'Quote sudah diterima.');
    }
    if (quote.expiresAt < new Date()) {
      throw AppError.unprocessable(ErrorCodes.QUOTE_EXPIRED, 'Quote sudah kedaluwarsa.');
    }

    const now = new Date();
    const periodMonths =
      quote.billingInterval === 'YEAR' ? 12 * quote.intervalCount : quote.intervalCount;
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          subscriptionNumber: `SUB-${Date.now().toString(36).toUpperCase()}`,
          tenantId,
          planVersionId: quote.planVersionId,
          status: 'DRAFT',
          paymentMode: quote.paymentMode,
          billingInterval: quote.billingInterval,
          intervalCount: quote.intervalCount,
          currencyCode: quote.currencyCode,
          startsAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          createdBy: actorUserId,
          items: {
            create: quote.lines.map((line) => ({
              itemType: 'PACKAGE',
              deviceId: line.deviceId,
              quantity: line.quantity,
              unitPrice: line.effectiveUnitPrice,
              entitlementScope: line.deviceId ? 'DEVICE' : 'TENANT_WIDE',
              startsAt: now,
              endsAt: periodEnd,
              status: 'ACTIVE',
            })),
          },
        },
      });

      const invoice = await tx.billingInvoice.create({
        data: {
          invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
          tenantId,
          subscriptionId: subscription.id,
          quoteId: quote.id,
          status: 'ISSUED',
          currencyCode: quote.currencyCode,
          issueDate: now,
          dueDate: new Date(now.getTime() + 7 * 86_400_000),
          subtotal: quote.subtotal,
          discountTotal: quote.discountTotal,
          taxTotal: quote.taxTotal,
          adminFeeTotal: quote.adminFeeTotal,
          grandTotal: quote.grandTotal,
          issuedAt: now,
          localeSnapshot: 'id',
          createdBy: actorUserId,
          lines: {
            create: [
              ...quote.lines.map((line, index) => ({
                lineType: 'PACKAGE' as const,
                deviceId: line.deviceId,
                description: line.description,
                // Snapshot harga, paket, dan perangkat disimpan permanen.
                snapshot: {
                  planCode: quote.planVersion.plan.code,
                  planVersionNumber: quote.planVersion.versionNumber,
                  basePrice: line.basePrice.toFixed(),
                  effectiveUnitPrice: line.effectiveUnitPrice.toFixed(),
                  quoteNumber: quote.quoteNumber,
                } as Prisma.InputJsonValue,
                quantity: line.quantity,
                unitPrice: line.effectiveUnitPrice,
                discountAmount: line.discountAmount,
                taxAmount: line.taxAmount,
                lineTotal: line.lineTotal,
                sortOrder: index + 1,
              })),
              ...(new Decimal(quote.taxTotal.toString()).greaterThan(0)
                ? [
                    {
                      lineType: 'TAX' as const,
                      description: 'Pajak',
                      snapshot: { source: 'TAX_RATE_DEFAULT_PERCENT' } as Prisma.InputJsonValue,
                      quantity: 1,
                      unitPrice: quote.taxTotal,
                      lineTotal: quote.taxTotal,
                      sortOrder: 900,
                    },
                  ]
                : []),
              ...(new Decimal(quote.adminFeeTotal.toString()).greaterThan(0)
                ? [
                    {
                      lineType: 'ADMIN_FEE' as const,
                      description: 'Biaya administrasi channel pembayaran',
                      snapshot: { source: 'PAYMENT_CHANNEL' } as Prisma.InputJsonValue,
                      quantity: 1,
                      unitPrice: quote.adminFeeTotal,
                      lineTotal: quote.adminFeeTotal,
                      sortOrder: 910,
                    },
                  ]
                : []),
            ],
          },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });

      await tx.pricingQuote.update({
        where: { id: quote.id },
        data: { status: 'ACCEPTED', acceptedAt: now, acceptedBy: actorUserId },
      });

      return { subscription, invoice };
    });
  }

  async resolveDeviceEntitlements(deviceId: string) {
    const now = new Date();
    const entitlements = await this.prisma.deviceEntitlement.findMany({
      where: { deviceId },
      orderBy: { startsAt: 'desc' },
    });
    const device = await this.prisma.posDevice.findUnique({ where: { id: deviceId } });

    const effective = entitlements.filter((e) => {
      if (e.status === 'REVOKED') return false;
      if (e.startsAt > now) return false;
      const end = e.graceEndsAt ?? e.endsAt;
      return !end || end >= now;
    });

    // Trial berlaku bila belum ada entitlement berbayar dan masa uji coba aktif.
    const trialActive =
      device?.trialEndsAt !== null &&
      device?.trialEndsAt !== undefined &&
      device.trialEndsAt >= now &&
      effective.length === 0;

    return {
      deviceId,
      deviceStatus: device?.status ?? null,
      trial: {
        active: trialActive,
        startedAt: device?.trialStartedAt ?? null,
        endsAt: device?.trialEndsAt ?? null,
      },
      modules: [...new Set(effective.map((e) => e.moduleCode))].sort(),
      entitlements: effective.map((e) => ({
        moduleCode: e.moduleCode,
        featureCode: e.featureCode,
        status: e.status,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        graceEndsAt: e.graceEndsAt,
      })),
    };
  }
}
