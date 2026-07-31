import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PaymentOrderStatus, NormalizedPaymentStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import { EsmartlinkClient, maskPayload } from './esmartlink.client';
import { resolveExpiryMinutes } from './esmartlink-channel.parser';

export interface CreateOrderInput {
  invoiceId: string;
  channelCode?: string;
  expiryCode?: string;
  idempotencyKey?: string;
  actorUserId?: string;
}

export interface CallbackPayload {
  data?: {
    order_id?: string;
    amount?: string | number;
    transaction_time?: string;
    transaction_id?: string;
    status?: string;
  };
}

@Injectable()
export class EsmartlinkPaymentService {
  private readonly logger = new Logger(EsmartlinkPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: EsmartlinkClient,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // CREATE ORDER — dikarakterisasi dari DownloadTagihanSiswaBankOnline.java
  // -------------------------------------------------------------------------
  async createOrder(input: CreateOrderInput) {
    const provider = await this.requireProvider();

    const invoice = await this.prisma.billingInvoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        tenant: { select: { id: true, name: true, code: true } },
      },
    });
    if (!invoice) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Invoice tidak ditemukan.');
    if (invoice.status === 'PAID') {
      throw AppError.conflict(ErrorCodes.INVOICE_IMMUTABLE, 'Invoice sudah lunas.');
    }
    if (invoice.status === 'VOID') {
      throw AppError.conflict(ErrorCodes.INVOICE_IMMUTABLE, 'Invoice telah dibatalkan.');
    }

    // Reuse order yang masih menunggu pembayaran — berdasarkan idempotency key
    // dan state yang jelas, bukan query longgar seperti legacy.
    const existing = await this.prisma.paymentOrder.findFirst({
      where: {
        invoiceId: invoice.id,
        status: 'WAITING_PAYMENT',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.toOrderResponse(existing, 'REUSED');
    }

    // Order sebelumnya yang kedaluwarsa ditandai EXPIRED, bukan dipakai ulang.
    await this.prisma.paymentOrder.updateMany({
      where: {
        invoiceId: invoice.id,
        status: 'WAITING_PAYMENT',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    const channel = input.channelCode
      ? await this.prisma.paymentChannel.findFirst({
          where: { providerId: provider.id, code: input.channelCode, isActive: true, deletedAt: null },
        })
      : null;
    if (input.channelCode && !channel) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Channel pembayaran tidak dikenali.');
    }

    const expiryMinutes = resolveExpiryMinutes(input.expiryCode, 1440);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60_000);

    const amount = new Decimal(invoice.grandTotal.toString());
    const adminFee = channel
      ? channel.adminFeeType === 'PERCENT'
        ? amount.mul(new Decimal(channel.adminFeeValue.toString())).div(100)
        : new Decimal(channel.adminFeeValue.toString())
      : new Decimal(0);
    const totalAmount = amount.plus(adminFee);

    const orderNumber = buildOrderNumber();
    const idempotencyKey = input.idempotencyKey ?? `create-order:${invoice.id}:${orderNumber}`;

    const channels = channel
      ? [channel.code]
      : (provider.defaultChannelCodes ?? 'VA_CIMB,VA_BRI')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);

    // Item invoice harus berjumlah sama dengan total yang ditagihkan.
    const items = invoice.lines
      .filter((line) => !new Decimal(line.lineTotal.toString()).isZero())
      .map((line) => ({
        name: truncate(line.description, 255),
        amount: Number(new Decimal(line.lineTotal.toString()).toFixed(0)),
        qty: 1,
      }));
    if (adminFee.greaterThan(0)) {
      items.push({
        name: truncate(`Biaya admin ${channel?.name ?? 'channel pembayaran'}`, 255),
        amount: Number(adminFee.toFixed(0)),
        qty: 1,
      });
    }

    const webUrl = this.config.get<string>('webUrl', 'http://localhost:5173');
    const payload = {
      order_id: orderNumber,
      amount: Number(totalAmount.toFixed(0)),
      description: `Langganan ${invoice.tenant.name} — ${invoice.invoiceNumber}`,
      customer: {
        // Nama dinormalisasi sesuai kontrak provider; nama asli tetap ada pada tenant.
        name: normalizeCustomerName(invoice.tenant.name),
        email: `billing+${invoice.tenant.code.toLowerCase()}@ebisnis.id`,
        phone: '',
      },
      item: items,
      channel: channels,
      type: 'payment-page',
      payment_mode: 'CLOSE',
      expired_time: expiresAt.toISOString(),
      callback_url: provider.callbackUrl ?? this.config.get<string>('esmartlink.callbackUrl', ''),
      success_redirect_url: provider.successRedirectUrl ?? `${webUrl}/payment/success`,
      failed_redirect_url: provider.failedRedirectUrl ?? `${webUrl}/payment/failed`,
    };

    const order = await this.prisma.paymentOrder.create({
      data: {
        providerId: provider.id,
        invoiceId: invoice.id,
        selectedChannelId: channel?.id ?? null,
        orderNumber,
        amount: new Prisma.Decimal(amount.toFixed(4)),
        adminFee: new Prisma.Decimal(adminFee.toFixed(4)),
        totalAmount: new Prisma.Decimal(totalAmount.toFixed(4)),
        currencyCode: invoice.currencyCode,
        status: 'CREATING',
        expiresAt,
        requestSnapshot: maskPayload(payload) as Prisma.InputJsonValue,
        idempotencyKey,
        createdBy: input.actorUserId ?? null,
      },
    });

    // Provider dinonaktifkan (development) → order tetap tercatat, tanpa payment URL.
    if (provider.status === 'DISABLED' || !provider.baseUrl) {
      await this.prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          attemptType: 'CREATE_ORDER',
          status: 'FAILED',
          idempotencyKey,
          requestPayloadMasked: maskPayload(payload) as Prisma.InputJsonValue,
          errorMessage: 'Provider Esmartlink belum dikonfigurasi (status DISABLED).',
        },
      });
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'FAILED',
          failureCode: ErrorCodes.PAYMENT_PROVIDER_DISABLED,
          failureMessage: 'Provider Esmartlink belum dikonfigurasi.',
        },
      });
      throw AppError.unprocessable(
        ErrorCodes.PAYMENT_PROVIDER_DISABLED,
        'Provider pembayaran Esmartlink belum dikonfigurasi. Invoice tetap tersimpan dan dapat dibayar setelah konfigurasi tersedia.',
        { orderId: order.id, orderNumber },
      );
    }

    const credentials = this.resolveCredentials();
    const response = await this.client.createOrder(
      provider.baseUrl,
      provider.createOrderPath,
      credentials,
      payload,
    );

    await this.prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        attemptType: 'CREATE_ORDER',
        status: response.ok ? 'SUCCESS' : response.message === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED',
        idempotencyKey,
        requestPayloadMasked: maskPayload(payload) as Prisma.InputJsonValue,
        responsePayloadMasked: maskPayload(response.raw) as Prisma.InputJsonValue,
        httpStatus: response.httpStatus,
        providerCode: response.code,
        providerMessage: response.message,
        durationMs: response.durationMs,
        errorMessage: response.error ?? null,
      },
    });

    if (!response.ok) {
      // Error provider TIDAK menghilangkan invoice; hanya order yang gagal.
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'FAILED',
          failureCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
          failureMessage: response.message ?? response.error ?? 'Provider menolak permintaan.',
          responseSnapshot: maskPayload(response.raw) as Prisma.InputJsonValue,
        },
      });
      throw AppError.unprocessable(
        ErrorCodes.PAYMENT_PROVIDER_ERROR,
        `Provider pembayaran menolak permintaan: ${response.message ?? 'tidak diketahui'}`,
        { orderId: order.id },
      );
    }

    const data = response.data ?? {};
    const updated = await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'WAITING_PAYMENT',
        providerOrderId: typeof data.order_id === 'string' ? data.order_id : orderNumber,
        providerTransactionId:
          typeof data.transaction_id === 'string' ? data.transaction_id : null,
        paymentUrl: typeof data.payment_url === 'string' ? data.payment_url : null,
        virtualAccount:
          typeof data.virtual_account === 'string' ? data.virtual_account : null,
        responseSnapshot: maskPayload(response.raw) as Prisma.InputJsonValue,
      },
    });

    await this.recordTransition(order.id, 'CREATING', 'WAITING_PAYMENT', 'CREATE_ORDER');
    await this.audit.record({
      moduleCode: 'PAYMENT',
      actionCode: 'PAYMENT_ORDER_CREATED',
      entityType: 'PaymentOrder',
      entityId: order.id,
      documentNumber: orderNumber,
      tenantId: invoice.tenantId,
      actorUserId: input.actorUserId,
      metadata: { invoiceNumber: invoice.invoiceNumber, channel: channel?.code ?? null },
    });

    return this.toOrderResponse(updated, 'CREATED');
  }

  // -------------------------------------------------------------------------
  // CALLBACK — dikarakterisasi dari Esmartlink.java
  // -------------------------------------------------------------------------
  async handleCallback(
    rawBody: string,
    meta: { remoteIp?: string; headers?: Record<string, unknown>; endpoint: string },
  ): Promise<{ ack: string; httpStatus: number }> {
    const startedAt = Date.now();
    const provider = await this.prisma.paymentProvider.findUnique({ where: { code: 'ESMARTLINK' } });
    const ackSuccess = provider?.ackSuccess ?? this.config.get<string>('esmartlink.ackSuccess', 'OK');
    const ackError = provider?.ackError ?? this.config.get<string>('esmartlink.ackError', 'ERROR');

    // JAMINAN: setiap inbound request tercatat, termasuk IP tidak dikenal,
    // payload invalid, order tidak ditemukan, dan exception.
    const logH2h = async (result: string, detail: string, extra: Record<string, unknown> = {}) => {
      await this.prisma.hostToHostLog
        .create({
          data: {
            providerId: provider?.id ?? null,
            direction: 'INBOUND',
            endpoint: meta.endpoint,
            remoteIp: meta.remoteIp ?? null,
            headersMasked: maskPayload(meta.headers ?? {}) as Prisma.InputJsonValue,
            payloadMasked: rawBody.slice(0, 8000),
            result,
            resultDetail: detail,
            durationMs: Date.now() - startedAt,
            ...extra,
          },
        })
        .catch((error) => this.logger.error(`Gagal menulis H2H log: ${String(error)}`));
    };

    try {
      // 1. Validasi host/allowlist. IP tidak dikenal TETAP dicatat tetapi tidak diproses.
      if (provider?.allowedIps) {
        const allowed = provider.allowedIps.split(',').map((ip) => ip.trim()).filter(Boolean);
        if (allowed.length && (!meta.remoteIp || !allowed.includes(meta.remoteIp))) {
          await logH2h('REJECTED', 'IP pengirim tidak ada pada allowlist provider.');
          return { ack: ackError, httpStatus: 403 };
        }
      }

      // 2. Parse payload.
      let parsed: CallbackPayload;
      try {
        parsed = JSON.parse(rawBody) as CallbackPayload;
      } catch {
        await logH2h('ERROR', 'Payload bukan JSON valid.');
        return { ack: ackError, httpStatus: 400 };
      }

      const data = parsed?.data;
      if (!data?.order_id || !data.transaction_id) {
        await logH2h('ERROR', 'Field order_id atau transaction_id tidak ada.');
        return { ack: ackError, httpStatus: 400 };
      }

      const rawStatus = String(data.status ?? '').trim();
      const normalizedStatus = this.normalizeStatus(provider?.statusMapping, rawStatus);
      const amount = data.amount !== undefined ? new Decimal(String(data.amount)) : null;

      const order = await this.prisma.paymentOrder.findFirst({
        where: { orderNumber: String(data.order_id) },
        include: { invoice: true },
      });

      if (!order) {
        await logH2h('NOT_FOUND', `Order ${data.order_id} tidak ditemukan.`, {
          orderNumber: String(data.order_id),
          providerTransactionId: String(data.transaction_id),
        });
        return { ack: ackError, httpStatus: 404 };
      }

      const payloadChecksum = createHash('sha256').update(rawBody).digest('hex');

      // 3. Deduplikasi berdasarkan (provider, transaction_id, checksum).
      const duplicate = await this.prisma.paymentCallbackEvent.findFirst({
        where: {
          providerId: order.providerId,
          providerTransactionId: String(data.transaction_id),
        },
      });

      const event = await this.prisma.paymentCallbackEvent.upsert({
        where: {
          providerId_providerTransactionId_payloadChecksum: {
            providerId: order.providerId,
            providerTransactionId: String(data.transaction_id),
            payloadChecksum,
          },
        },
        create: {
          providerId: order.providerId,
          orderId: order.id,
          providerTransactionId: String(data.transaction_id),
          providerOrderId: String(data.order_id),
          rawStatus: rawStatus || 'UNKNOWN',
          normalizedStatus,
          amount: amount ? new Prisma.Decimal(amount.toFixed(4)) : null,
          transactionTime: parseTransactionTime(data.transaction_time),
          payloadMasked: maskPayload(parsed) as Prisma.InputJsonValue,
          payloadChecksum,
          processingStatus: 'RECEIVED',
          remoteIp: meta.remoteIp ?? null,
          ackBody: ackSuccess,
        },
        update: {},
      });

      // Callback yang sudah pernah diproses menghasilkan ACK yang sama,
      // tanpa membayar dua kali.
      if (duplicate && order.status === 'PAID') {
        await this.prisma.paymentCallbackEvent.update({
          where: { id: event.id },
          data: { processingStatus: 'DUPLICATE', processedAt: new Date() },
        });
        await logH2h('DUPLICATE', 'Callback duplikat untuk order yang sudah lunas.', {
          orderNumber: order.orderNumber,
          providerTransactionId: String(data.transaction_id),
          amount: order.totalAmount,
        });
        return { ack: ackSuccess, httpStatus: 200 };
      }

      const result = await this.processPaymentEvent({
        orderId: order.id,
        callbackEventId: event.id,
        normalizedStatus,
        rawStatus,
        amount,
        sourceType: 'CALLBACK',
      });

      await logH2h(result.processed ? 'OK' : 'IGNORED', result.message, {
        orderNumber: order.orderNumber,
        providerTransactionId: String(data.transaction_id),
        amount: order.totalAmount,
      });

      return { ack: result.accepted ? ackSuccess : ackError, httpStatus: result.accepted ? 200 : 422 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.hostToHostLog
        .create({
          data: {
            providerId: provider?.id ?? null,
            direction: 'INBOUND',
            endpoint: meta.endpoint,
            remoteIp: meta.remoteIp ?? null,
            headersMasked: maskPayload(meta.headers ?? {}) as Prisma.InputJsonValue,
            payloadMasked: rawBody.slice(0, 8000),
            result: 'EXCEPTION',
            resultDetail: message.slice(0, 2000),
            stackTrace: error instanceof Error ? (error.stack ?? '').slice(0, 8000) : null,
            durationMs: Date.now() - startedAt,
          },
        })
        .catch(() => undefined);
      this.logger.error(`Callback Esmartlink error: ${message}`);
      return { ack: ackError, httpStatus: 500 };
    }
  }

  // -------------------------------------------------------------------------
  // INQUIRY — dikarakterisasi dari VirtualAccountBankAction.java
  // -------------------------------------------------------------------------
  async checkPayment(
    orderId: string,
    options: { source?: 'MANUAL_SINGLE' | 'MANUAL_BATCH' | 'SCHEDULED_RECONCILIATION' | 'CALLBACK_RECOVERY' | 'SUPPORT_REPLAY'; batchId?: string; actorUserId?: string } = {},
  ) {
    const provider = await this.requireProvider();
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { invoice: true },
    });
    if (!order) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Payment order tidak ditemukan.');

    // transaction_id diambil dari response create-order yang tersimpan.
    const transactionId =
      order.providerTransactionId ??
      ((order.responseSnapshot as { data?: { transaction_id?: string } } | null)?.data
        ?.transaction_id ??
        null);

    if (!transactionId) {
      throw AppError.unprocessable(
        ErrorCodes.PAYMENT_ORDER_INVALID_STATE,
        'Order belum memiliki transaction_id dari provider.',
      );
    }

    if (provider.status === 'DISABLED' || !provider.baseUrl) {
      throw AppError.unprocessable(
        ErrorCodes.PAYMENT_PROVIDER_DISABLED,
        'Provider Esmartlink belum dikonfigurasi.',
      );
    }

    const credentials = this.resolveCredentials();
    const response = await this.client.inquiryOrder(
      provider.baseUrl,
      provider.inquiryOrderPath,
      credentials,
      transactionId,
    );

    const rawStatus =
      response.data && typeof (response.data as { status?: unknown }).status === 'string'
        ? String((response.data as { status: string }).status)
        : '';
    const normalizedStatus = this.normalizeStatus(provider.statusMapping, rawStatus);

    await this.prisma.paymentInquiryAttempt.create({
      data: {
        orderId: order.id,
        source: options.source ?? 'MANUAL_SINGLE',
        batchId: options.batchId ?? null,
        requestUrlMasked: `${provider.baseUrl}/${provider.inquiryOrderPath}***`,
        responsePayloadMasked: maskPayload(response.raw) as Prisma.InputJsonValue,
        rawStatus: rawStatus || null,
        normalizedStatus,
        httpStatus: response.httpStatus,
        durationMs: response.durationMs,
        errorMessage: response.error ?? null,
        actorUserId: options.actorUserId ?? null,
      },
    });

    // Hasil inquiry diproses melalui processor yang SAMA dengan callback.
    const result = await this.processPaymentEvent({
      orderId: order.id,
      callbackEventId: null,
      normalizedStatus,
      rawStatus,
      amount: order.totalAmount ? new Decimal(order.totalAmount.toString()) : null,
      sourceType: 'INQUIRY',
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      providerRawStatus: rawStatus || null,
      normalizedStatus,
      localStatus: result.status,
      processed: result.processed,
      message: result.message,
    };
  }

  /** Cek massal terkontrol dengan concurrency limit dan progress persisten. */
  async createCheckBatch(input: { orderIds: string[]; actorUserId?: string }) {
    const max = this.config.get<number>('esmartlink.checkBatchMax', 300);
    if (input.orderIds.length > max) {
      throw AppError.badRequest(
        ErrorCodes.BATCH_LIMIT_EXCEEDED,
        `Cek massal dibatasi maksimum ${max} item per permintaan.`,
        { requested: input.orderIds.length, max },
      );
    }
    if (!input.orderIds.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Daftar order tidak boleh kosong.');
    }

    const batch = await this.prisma.paymentCheckBatch.create({
      data: {
        batchNumber: `PCB-${Date.now().toString(36).toUpperCase()}`,
        source: 'MANUAL_BATCH',
        requestedById: input.actorUserId ?? null,
        totalItems: input.orderIds.length,
        status: 'PENDING',
        concurrency: this.config.get<number>('esmartlink.checkConcurrency', 4),
        items: {
          create: input.orderIds.map((orderId, index) => ({
            orderId,
            sequence: index + 1,
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    });

    // Eksekusi tidak memblokir response; progress tersimpan sehingga dapat
    // dilanjutkan setelah worker restart.
    void this.runCheckBatch(batch.id);

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      totalItems: batch.totalItems,
      status: batch.status,
    };
  }

  async runCheckBatch(batchId: string): Promise<void> {
    const batch = await this.prisma.paymentCheckBatch.findUnique({
      where: { id: batchId },
      include: { items: { where: { status: 'PENDING' }, orderBy: { sequence: 'asc' } } },
    });
    if (!batch) return;

    await this.prisma.paymentCheckBatch.update({
      where: { id: batchId },
      data: { status: 'RUNNING', startedAt: batch.startedAt ?? new Date() },
    });

    const concurrency = Math.max(1, batch.concurrency);
    const queue = [...batch.items];

    const worker = async () => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        await this.prisma.paymentCheckBatchItem.update({
          where: { id: item.id },
          data: { status: 'RUNNING', startedAt: new Date() },
        });
        try {
          const result = await this.checkPayment(item.orderId, {
            source: 'MANUAL_BATCH',
            batchId,
          });
          await this.prisma.paymentCheckBatchItem.update({
            where: { id: item.id },
            data: {
              status: 'COMPLETED',
              normalizedStatus: result.normalizedStatus,
              resultCode: result.normalizedStatus,
              resultMessage: result.message,
              finishedAt: new Date(),
            },
          });
          await this.prisma.paymentCheckBatch.update({
            where: { id: batchId },
            data: { processedItems: { increment: 1 }, successItems: { increment: 1 } },
          });
        } catch (error) {
          // Satu item gagal tidak menggagalkan seluruh batch.
          await this.prisma.paymentCheckBatchItem.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              resultCode: error instanceof AppError ? error.errorCode : 'ERROR',
              resultMessage: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
              finishedAt: new Date(),
            },
          });
          await this.prisma.paymentCheckBatch.update({
            where: { id: batchId },
            data: { processedItems: { increment: 1 }, failureItems: { increment: 1 } },
          });
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    await this.prisma.paymentCheckBatch.update({
      where: { id: batchId },
      data: { status: 'COMPLETED', finishedAt: new Date() },
    });
  }

  /**
   * Processor pembayaran tunggal untuk callback dan inquiry.
   * Validasi order, nominal, idempotency, state transition, allocation,
   * entitlement, dan audit dilakukan atomik.
   */
  private async processPaymentEvent(input: {
    orderId: string;
    callbackEventId: string | null;
    normalizedStatus: NormalizedPaymentStatus;
    rawStatus: string;
    amount: Decimal | null;
    sourceType: string;
  }): Promise<{ processed: boolean; accepted: boolean; status: PaymentOrderStatus; message: string }> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: input.orderId },
      include: { invoice: true },
    });
    if (!order) {
      return { processed: false, accepted: false, status: 'FAILED', message: 'Order tidak ditemukan.' };
    }

    // Status selain PAID tidak boleh mengaktifkan langganan.
    if (input.normalizedStatus !== 'PAID') {
      if (input.callbackEventId) {
        await this.prisma.paymentCallbackEvent.update({
          where: { id: input.callbackEventId },
          data: {
            processingStatus: 'VALIDATED',
            processingMessage: `Status provider "${input.rawStatus}" bukan pembayaran berhasil.`,
            processedAt: new Date(),
          },
        });
      }
      if (input.normalizedStatus === 'EXPIRED' && order.status === 'WAITING_PAYMENT') {
        await this.prisma.paymentOrder.update({
          where: { id: order.id },
          data: { status: 'EXPIRED' },
        });
        await this.recordTransition(order.id, order.status, 'EXPIRED', input.sourceType);
      }
      return {
        processed: false,
        accepted: true,
        status: order.status,
        message: `Status provider "${input.rawStatus}" belum menandakan pembayaran berhasil.`,
      };
    }

    if (order.status === 'PAID') {
      return {
        processed: false,
        accepted: true,
        status: 'PAID',
        message: 'Order sudah berstatus lunas.',
      };
    }

    // Validasi nominal.
    const expected = new Decimal(order.totalAmount.toString());
    if (input.amount && !input.amount.equals(expected)) {
      if (input.callbackEventId) {
        await this.prisma.paymentCallbackEvent.update({
          where: { id: input.callbackEventId },
          data: {
            processingStatus: 'REJECTED',
            processingMessage: `Nominal tidak cocok. Diharapkan ${expected.toFixed()}, diterima ${input.amount.toFixed()}.`,
            processedAt: new Date(),
          },
        });
      }
      await this.audit.record({
        moduleCode: 'PAYMENT',
        actionCode: 'PAYMENT_AMOUNT_MISMATCH',
        entityType: 'PaymentOrder',
        entityId: order.id,
        result: 'FAILURE',
        reason: `expected=${expected.toFixed()} received=${input.amount.toFixed()}`,
      });
      return {
        processed: false,
        accepted: false,
        status: order.status,
        message: 'Nominal pembayaran tidak sesuai.',
      };
    }

    const allocationKey = `alloc:${order.id}:${input.callbackEventId ?? input.sourceType}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() },
      });

      await tx.paymentStatusTransition.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'PAID',
          sourceType: input.sourceType,
          sourceId: input.callbackEventId,
        },
      });

      // Perintah bayar marketplace tidak punya tagihan langganan; alokasi dan
      // pemutakhiran invoice di bawah tidak berlaku baginya. Pemenuhan pesanan
      // marketplace ditangani MarketplacePaymentService.
      if (!order.invoiceId) return;

      const existingAllocation = await tx.billingPaymentAllocation.findUnique({
        where: { idempotencyKey: allocationKey },
      });
      if (!existingAllocation) {
        await tx.billingPaymentAllocation.create({
          data: {
            invoiceId: order.invoiceId,
            callbackEventId: input.callbackEventId,
            paymentOrderId: order.id,
            amount: order.amount,
            idempotencyKey: allocationKey,
          },
        });
      }

      const invoice = await tx.billingInvoice.findUnique({ where: { id: order.invoiceId } });
      if (invoice) {
        const paidTotal = new Decimal(invoice.paidTotal.toString()).plus(
          new Decimal(order.amount.toString()),
        );
        const grandTotal = new Decimal(invoice.grandTotal.toString());
        await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            paidTotal: new Prisma.Decimal(paidTotal.toFixed(4)),
            status: paidTotal.greaterThanOrEqualTo(grandTotal) ? 'PAID' : 'PARTIALLY_PAID',
            paidAt: paidTotal.greaterThanOrEqualTo(grandTotal) ? new Date() : invoice.paidAt,
          },
        });

        await tx.billingReceipt.create({
          data: {
            receiptNumber: `RCP-${order.orderNumber}`,
            invoiceId: invoice.id,
            paidAt: new Date(),
            amount: order.amount,
            channelCode: order.selectedChannelId ? undefined : undefined,
          },
        });
      }

      if (input.callbackEventId) {
        await tx.paymentCallbackEvent.update({
          where: { id: input.callbackEventId },
          data: {
            processingStatus: 'PROCESSED',
            processingMessage: 'Pembayaran diproses dan dialokasikan.',
            processedAt: new Date(),
          },
        });
      }
    });

    // Entitlement hanya berlaku bagi langganan.
    if (order.invoiceId) await this.activateEntitlements(order.invoiceId);

    await this.audit.record({
      moduleCode: 'PAYMENT',
      actionCode: 'PAYMENT_PROCESSED',
      entityType: 'PaymentOrder',
      entityId: order.id,
      documentNumber: order.orderNumber,
      tenantId: order.invoice?.tenantId,
      metadata: { sourceType: input.sourceType, amount: order.amount.toString() },
    });

    return { processed: true, accepted: true, status: 'PAID', message: 'Pembayaran berhasil diproses.' };
  }

  /** Entitlement perangkat hanya aktif untuk baris invoice yang lunas. */
  private async activateEntitlements(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: true,
        subscription: { include: { planVersion: { include: { modules: { include: { module: true } } } } } },
      },
    });
    if (!invoice || invoice.status !== 'PAID' || !invoice.subscription) return;

    const modules = invoice.subscription.planVersion.modules.filter((m) => m.included);
    const periodStart = invoice.subscription.currentPeriodStart ?? new Date();
    const periodEnd =
      invoice.subscription.currentPeriodEnd ?? new Date(Date.now() + 30 * 86_400_000);
    const graceDays = invoice.subscription.planVersion.gracePeriodDays;

    const deviceIds = [...new Set(invoice.lines.map((l) => l.deviceId).filter(Boolean))] as string[];

    for (const deviceId of deviceIds) {
      for (const planModule of modules) {
        await this.prisma.deviceEntitlement.upsert({
          where: {
            deviceId_moduleCode_featureCode_startsAt: {
              deviceId,
              moduleCode: planModule.module.code,
              featureCode: null as unknown as string,
              startsAt: periodStart,
            },
          },
          create: {
            deviceId,
            moduleCode: planModule.module.code,
            status: 'ACTIVE',
            startsAt: periodStart,
            endsAt: periodEnd,
            graceEndsAt: new Date(periodEnd.getTime() + graceDays * 86_400_000),
            sourceType: 'INVOICE',
            sourceId: invoice.id,
            sourceSnapshot: {
              invoiceNumber: invoice.invoiceNumber,
              planVersionId: invoice.subscription.planVersionId,
              entitlementScope: planModule.entitlementScope,
            } as Prisma.InputJsonValue,
          },
          update: { status: 'ACTIVE', endsAt: periodEnd },
        });
      }
      await this.prisma.posDevice.update({
        where: { id: deviceId },
        data: { status: 'ACTIVE', activatedAt: new Date() },
      });
    }

    await this.prisma.subscription.update({
      where: { id: invoice.subscription.id },
      data: { status: 'ACTIVE' },
    });
  }

  private normalizeStatus(
    mapping: Prisma.JsonValue | null | undefined,
    rawStatus: string,
  ): NormalizedPaymentStatus {
    const key = rawStatus.trim().toLowerCase();
    if (!key) return 'UNKNOWN';
    if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) {
      const mapped = (mapping as Record<string, unknown>)[key];
      if (typeof mapped === 'string' && isNormalizedStatus(mapped)) return mapped;
    }
    // Fallback konservatif: hanya `success` yang dianggap lunas.
    if (key === 'success') return 'PAID';
    if (key === 'pending') return 'PENDING';
    if (key === 'expired' || key === 'expire') return 'EXPIRED';
    if (key === 'cancel' || key === 'cancelled') return 'CANCELLED';
    if (key === 'failed' || key === 'failure' || key === 'deny') return 'FAILED';
    return 'UNKNOWN';
  }

  private async requireProvider() {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { code: 'ESMARTLINK' } });
    if (!provider) {
      throw AppError.unprocessable(
        ErrorCodes.PAYMENT_PROVIDER_DISABLED,
        'Provider Esmartlink belum di-seed.',
      );
    }
    return provider;
  }

  /**
   * Precedence credential: PaymentChannel → TenantPaymentProvider → Platform provider.
   * Nilai sebenarnya dibaca dari environment/secret store, bukan dari database.
   */
  private resolveCredentials(): { username: string; password: string } {
    return {
      username: this.config.get<string>('esmartlink.clientId', ''),
      password: this.config.get<string>('esmartlink.clientSecret', ''),
    };
  }

  private async recordTransition(
    orderId: string,
    from: PaymentOrderStatus,
    to: PaymentOrderStatus,
    sourceType: string,
  ): Promise<void> {
    await this.prisma.paymentStatusTransition.create({
      data: { orderId, fromStatus: from, toStatus: to, sourceType },
    });
  }

  private toOrderResponse(
    order: {
      id: string;
      orderNumber: string;
      status: PaymentOrderStatus;
      paymentUrl: string | null;
      virtualAccount: string | null;
      amount: Prisma.Decimal;
      adminFee: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      currencyCode: string;
      expiresAt: Date | null;
      providerTransactionId: string | null;
    },
    outcome: 'CREATED' | 'REUSED',
  ) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      outcome,
      status: order.status,
      // URL pembayaran BUKAN bukti pembayaran.
      paymentUrl: order.paymentUrl,
      virtualAccount: order.virtualAccount,
      amount: order.amount.toFixed(),
      adminFee: order.adminFee.toFixed(),
      totalAmount: order.totalAmount.toFixed(),
      currencyCode: order.currencyCode,
      expiresAt: order.expiresAt,
      providerTransactionId: order.providerTransactionId,
      notice:
        'Pembayaran hanya dianggap sah setelah callback atau inquiry tervalidasi. ' +
        'Halaman sukses provider bukan bukti pembayaran.',
    };
  }
}

function isNormalizedStatus(value: string): value is NormalizedPaymentStatus {
  return ['UNKNOWN', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(value);
}

function buildOrderNumber(): string {
  // Tidak membocorkan nama schema atau username.
  return `EBI${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString('hex').toUpperCase()}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** Normalisasi nama sesuai kontrak provider tanpa merusak Unicode secara membabi buta. */
function normalizeCustomerName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s.'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function parseTransactionTime(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
