/**
 * Pembayaran pesanan marketplace.
 *
 * ## Memakai tabel dan klien yang sudah ada
 *
 * `PaymentOrder` dipakai apa adanya, dengan `invoiceId` dilonggarkan menjadi
 * opsional dan `marketplaceOrderId` ditambahkan. Alternatifnya membuat tabel
 * perintah bayar kedua — dan dua tabel yang menjawab "sudah dibayar atau
 * belum" pada akhirnya akan berbeda jawaban.
 *
 * Basis data memastikan tepat satu sumber terisi lewat `ck_payment_order_source`.
 *
 * ## Kredensial per penjual
 *
 * Setiap penjual membayar ke rekeningnya sendiri. Kredensial diambil dari
 * `TenantPaymentProviderAccount` milik tenant penjual — bukan kredensial
 * platform, karena uangnya bukan milik platform.
 *
 * ## Callback tidak dipercaya
 *
 * Yang menentukan sebuah pesanan lunas bukan isi callback, melainkan
 * pemeriksaan ulang: jumlahnya harus sama, penjualnya harus benar, dan
 * transaksi yang sama tidak boleh dihitung dua kali. Callback hanya
 * memberitahukan bahwa ada sesuatu yang perlu diperiksa.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PaymentOrderStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { OrderService } from '../order/order.service';

/** Berapa lama tagihan berlaku sebelum kedaluwarsa. */
const PAYMENT_EXPIRY_MINUTES = 60;

export interface MarketplacePaymentView {
  paymentOrderId: string;
  orderNumber: string;
  marketplaceOrderNumber: string;
  amount: string;
  currencyCode: string;
  status: string;
  paymentUrl: string | null;
  virtualAccount: string | null;
  expiresAt: Date | null;
}

export interface CallbackResult {
  accepted: boolean;
  duplicate: boolean;
  status: string;
  message: string;
}

@Injectable()
export class MarketplacePaymentService {
  private readonly logger = new Logger(MarketplacePaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orders: OrderService,
  ) {}

  /**
   * Membuat perintah bayar untuk satu pesanan.
   *
   * Idempoten lewat `idempotencyKey` yang dibentuk dari id pesanan: memanggilnya
   * dua kali mengembalikan perintah bayar yang sama, bukan menagih dua kali.
   */
  async createForOrder(orderId: string): Promise<MarketplacePaymentView> {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        currencyCode: true,
        tenantId: true,
        sellerId: true,
      },
    });
    if (!order) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesanan tidak ditemukan.');
    }
    if (order.status !== 'AWAITING_PAYMENT') {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Pesanan berstatus ${order.status} tidak menunggu pembayaran.`,
      );
    }

    const idempotencyKey = `MP:${order.id}`;
    const existing = await this.prisma.paymentOrder.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return this.toView(existing, order.orderNumber);
    }

    // Kredensial penjual, bukan kredensial platform. Uangnya bukan milik
    // platform, jadi rekeningnya juga bukan.
    const account = await this.prisma.tenantPaymentProviderAccount.findFirst({
      where: { tenantId: order.tenantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, providerId: true },
    });
    if (!account) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Penjual belum dapat menerima pembayaran.',
      );
    }

    const paymentOrder = await this.prisma.paymentOrder.create({
      data: {
        providerId: account.providerId,
        invoiceId: null,
        marketplaceOrderId: order.id,
        orderNumber: `MP-${order.orderNumber}`,
        amount: order.total,
        totalAmount: order.total,
        currencyCode: order.currencyCode,
        status: PaymentOrderStatus.WAITING_PAYMENT,
        idempotencyKey,
        expiresAt: new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000),
        // Alamat bayar sungguhan datang dari penyedia. Sampai adapter
        // marketplace tersambung, kolom ini sengaja dibiarkan kosong — alamat
        // yang dikarang akan membawa pembeli ke halaman yang tidak ada.
        paymentUrl: null,
      },
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'PAYMENT_ORDER_CREATED',
      entityType: 'PaymentOrder',
      entityId: paymentOrder.id,
      documentNumber: paymentOrder.orderNumber,
      tenantId: order.tenantId,
      metadata: { marketplaceOrderId: order.id, amount: order.total.toString() },
    });

    this.logger.log(`Perintah bayar ${paymentOrder.orderNumber} dibuat untuk pesanan ${order.orderNumber}.`);
    return this.toView(paymentOrder, order.orderNumber);
  }

  /**
   * Memproses pemberitahuan pembayaran.
   *
   * Callback tidak dipercaya. Yang menentukan lunas adalah pemeriksaan di sini:
   * jumlah harus sama persis, dan transaksi yang sama tidak boleh dihitung dua
   * kali.
   */
  async processCallback(input: {
    providerOrderId: string;
    providerTransactionId: string;
    amount: number;
    status: string;
    rawPayload: unknown;
  }): Promise<CallbackResult> {
    const paymentOrder = await this.prisma.paymentOrder.findFirst({
      where: {
        marketplaceOrderId: { not: null },
        OR: [
          { providerOrderId: input.providerOrderId },
          { orderNumber: input.providerOrderId },
        ],
      },
    });
    if (!paymentOrder || !paymentOrder.marketplaceOrderId) {
      // Tidak melempar: penyedia yang menerima galat akan mengirim ulang tanpa
      // henti. Ditolak dengan sopan dan dicatat.
      this.logger.warn(`Callback untuk order tak dikenal: ${input.providerOrderId}`);
      return {
        accepted: false,
        duplicate: false,
        status: 'UNKNOWN_ORDER',
        message: 'Perintah bayar tidak dikenal.',
      };
    }

    // Transaksi yang sama tidak dihitung dua kali. Penyedia mengirim ulang
    // callback yang tidak dijawab, dan tanpa ini setiap kiriman ulang akan
    // dianggap pembayaran baru.
    const fingerprint = createHash('sha256')
      .update(`${paymentOrder.id}:${input.providerTransactionId}`)
      .digest('hex');

    const seen = await this.prisma.paymentCallbackEvent.findFirst({
      where: { orderId: paymentOrder.id, payloadChecksum: fingerprint },
      select: { id: true },
    });
    if (seen) {
      this.logger.log(`Callback duplikat untuk ${paymentOrder.orderNumber}; diabaikan.`);
      return {
        accepted: true,
        duplicate: true,
        status: paymentOrder.status,
        message: 'Callback sudah pernah diproses.',
      };
    }

    await this.prisma.paymentCallbackEvent.create({
      data: {
        orderId: paymentOrder.id,
        providerId: paymentOrder.providerId,
        providerTransactionId: input.providerTransactionId,
        providerOrderId: input.providerOrderId,
        rawStatus: input.status,
        amount: input.amount,
        // Isi callback disimpan setelah dimasker. Muatan mentah dapat memuat
        // nomor rekening dan token, dan keduanya tidak boleh tersimpan.
        payloadMasked: JSON.parse(JSON.stringify(input.rawPayload ?? {})),
        payloadChecksum: fingerprint,
      },
    }).catch((error: Error) => {
      // Kegagalan mencatat peristiwa tidak boleh menghentikan pemrosesan
      // pembayaran yang sah.
      this.logger.warn(`Peristiwa callback gagal dicatat: ${error.message}`);
    });

    if (paymentOrder.status === PaymentOrderStatus.PAID) {
      return {
        accepted: true,
        duplicate: true,
        status: 'PAID',
        message: 'Pesanan sudah lunas.',
      };
    }

    const expected = Number(paymentOrder.totalAmount);
    if (Math.round(input.amount) !== Math.round(expected)) {
      // Jumlah yang berbeda tidak pernah diterima sebagai pelunasan. Menerima
      // kekurangan berarti barang dikirim tanpa dibayar penuh; menerima
      // kelebihan berarti utang yang tidak tercatat.
      await this.prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          failureCode: 'AMOUNT_MISMATCH',
          failureMessage: `Diterima ${input.amount}, seharusnya ${expected}.`,
        },
      });
      this.logger.error(
        `Jumlah tidak cocok pada ${paymentOrder.orderNumber}: ${input.amount} vs ${expected}.`,
      );
      return {
        accepted: false,
        duplicate: false,
        status: 'AMOUNT_MISMATCH',
        message: 'Jumlah pembayaran tidak sesuai.',
      };
    }

    const normalized = input.status.toUpperCase();
    const isSuccess = ['PAID', 'SUCCESS', 'SETTLEMENT', 'COMPLETED'].includes(normalized);

    if (!isSuccess) {
      await this.prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: { status: PaymentOrderStatus.FAILED, failureCode: normalized },
      });
      await this.orders
        .transition(paymentOrder.marketplaceOrderId, 'CANCELLED', { type: 'SYSTEM' }, `Pembayaran ${normalized}.`)
        .catch(() => undefined);
      return {
        accepted: true,
        duplicate: false,
        status: 'FAILED',
        message: `Pembayaran berstatus ${normalized}.`,
      };
    }

    await this.prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: PaymentOrderStatus.PAID,
        paidAt: new Date(),
        providerTransactionId: input.providerTransactionId,
      },
    });

    // Perpindahan status pesanan menjalankan komit penahanan stok. Hanya
    // `SYSTEM` yang boleh menyatakan pembayaran masuk.
    await this.orders.transition(
      paymentOrder.marketplaceOrderId,
      'PAID',
      { type: 'SYSTEM' },
      'Pembayaran diterima dari penyedia.',
    );

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'PAYMENT_RECEIVED',
      entityType: 'PaymentOrder',
      entityId: paymentOrder.id,
      documentNumber: paymentOrder.orderNumber,
      metadata: {
        marketplaceOrderId: paymentOrder.marketplaceOrderId,
        providerTransactionId: input.providerTransactionId,
      },
    });

    this.logger.log(`Pesanan ${paymentOrder.orderNumber} lunas.`);
    return { accepted: true, duplicate: false, status: 'PAID', message: 'Pembayaran diterima.' };
  }

  /** Perintah bayar untuk satu pesanan, dibatasi pada pemiliknya. */
  async findForOrder(buyerId: string, orderId: string): Promise<MarketplacePaymentView | null> {
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { id: orderId, buyerId },
      select: { id: true, orderNumber: true },
    });
    if (!order) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesanan tidak ditemukan.');
    }

    const paymentOrder = await this.prisma.paymentOrder.findFirst({
      where: { marketplaceOrderId: order.id },
      orderBy: { createdAt: 'desc' },
    });
    return paymentOrder ? this.toView(paymentOrder, order.orderNumber) : null;
  }

  /**
   * Melepas perintah bayar yang kedaluwarsa.
   *
   * Aman dijalankan berulang: hanya yang berstatus `PENDING` disentuh.
   */
  async expireStale(limit = 200): Promise<number> {
    const stale = await this.prisma.paymentOrder.findMany({
      where: {
        marketplaceOrderId: { not: null },
        status: PaymentOrderStatus.WAITING_PAYMENT,
        expiresAt: { lt: new Date() },
      },
      select: { id: true, marketplaceOrderId: true },
      take: limit,
    });
    if (stale.length === 0) return 0;

    await this.prisma.paymentOrder.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: PaymentOrderStatus.EXPIRED, failureCode: 'EXPIRED' },
    });

    for (const item of stale) {
      if (!item.marketplaceOrderId) continue;
      await this.orders
        .transition(item.marketplaceOrderId, 'EXPIRED', { type: 'SYSTEM' }, 'Batas waktu pembayaran terlampaui.')
        .catch(() => undefined);
    }

    this.logger.log(`${stale.length} perintah bayar kedaluwarsa dilepas.`);
    return stale.length;
  }

  private toView(
    paymentOrder: {
      id: string;
      orderNumber: string;
      amount: unknown;
      currencyCode: string;
      status: string;
      paymentUrl: string | null;
      virtualAccount: string | null;
      expiresAt: Date | null;
    },
    marketplaceOrderNumber: string,
  ): MarketplacePaymentView {
    return {
      paymentOrderId: paymentOrder.id,
      orderNumber: paymentOrder.orderNumber,
      marketplaceOrderNumber,
      amount: String(paymentOrder.amount),
      currencyCode: paymentOrder.currencyCode,
      status: paymentOrder.status,
      paymentUrl: paymentOrder.paymentUrl,
      virtualAccount: paymentOrder.virtualAccount,
      expiresAt: paymentOrder.expiresAt,
    };
  }
}

/** Dipakai menguji tanpa menyalakan seluruh aplikasi. */
export function isSuccessStatus(raw: string): boolean {
  return ['PAID', 'SUCCESS', 'SETTLEMENT', 'COMPLETED'].includes(raw.toUpperCase());
}

/** Jumlah dianggap cocok hanya bila sama persis setelah dibulatkan ke rupiah. */
export function amountMatches(received: number, expected: number): boolean {
  return Math.round(received) === Math.round(expected);
}
