/**
 * Pesanan marketplace.
 *
 * Pesanan dibuat dari checkout yang sudah dikonfirmasi, satu pesanan per
 * penjual. Stok ditahan pada saat yang sama — bukan setelahnya, karena jeda di
 * antaranya adalah jendela tempat dua pembeli mendapat barang terakhir yang
 * sama.
 *
 * Seluruh perpindahan status melewati `order-state.ts`. Menyebar aturannya ke
 * beberapa layanan akan membuat pertanyaan "apakah pesanan batal bisa kembali
 * dibayar" hanya dapat dijawab dengan membaca semuanya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { StockReservationService } from './stock-reservation.service';
import { canTransition, type ActorType, type OrderStatus } from './order-state';

export interface OrderActor {
  type: ActorType;
  id?: string | null;
  requestId?: string;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  status: string;
  storeName: string;
  storeSlug: string;
  lines: {
    title: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
  subtotal: string;
  shippingCost: string;
  total: string;
  currencyCode: string;
  placedAt: Date;
  paidAt: Date | null;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StockReservationService,
  ) {}

  /**
   * Membuat pesanan dari checkout yang sudah dikonfirmasi.
   *
   * Idempoten lewat `checkoutId` yang unik pada grup: memanggilnya dua kali
   * mengembalikan grup yang sama, bukan membuat pesanan kedua.
   */
  async createFromCheckout(buyerId: string, checkoutId: string): Promise<{ groupId: string; orderIds: string[] }> {
    const existing = await this.prisma.marketplaceOrderGroup.findUnique({
      where: { checkoutId },
      select: { id: true, orders: { select: { id: true } } },
    });
    if (existing) {
      return { groupId: existing.id, orderIds: existing.orders.map((o) => o.id) };
    }

    const checkout = await this.prisma.marketplaceCheckout.findFirst({
      where: { id: checkoutId, buyerId, status: 'CONFIRMED' },
      include: {
        groups: {
          include: {
            lines: true,
            store: { select: { storeName: true, storeSlug: true } },
          },
        },
      },
    });
    if (!checkout) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Checkout tidak ditemukan atau belum dikonfirmasi.',
      );
    }
    if (checkout.groups.length === 0) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, 'Checkout tidak berisi apa pun.');
    }

    const groupNumber = await this.nextNumber('BLJ');

    const group = await this.prisma.marketplaceOrderGroup.create({
      data: {
        buyerId,
        checkoutId,
        groupNumber,
        subtotal: checkout.subtotal,
        shippingTotal: checkout.shippingTotal,
        discountTotal: checkout.discountTotal,
        grandTotal: checkout.grandTotal,
        currencyCode: checkout.currencyCode,
        addressSnapshot: checkout.addressSnapshot ?? {},
        status: 'AWAITING_PAYMENT',
      },
    });

    const orderIds: string[] = [];

    for (const checkoutGroup of checkout.groups) {
      const first = checkoutGroup.lines[0];
      if (!first) continue;

      const orderNumber = await this.nextNumber('PSN');
      const order = await this.prisma.marketplaceOrder.create({
        data: {
          groupId: group.id,
          sellerId: checkoutGroup.sellerId,
          storeId: checkoutGroup.storeId,
          buyerId,
          orderNumber,
          tenantId: first.tenantId,
          tenantSchema: '',
          status: 'AWAITING_PAYMENT',
          subtotal: checkoutGroup.subtotal,
          shippingCost: checkoutGroup.shippingCost,
          discountTotal: checkoutGroup.discountTotal,
          total: checkoutGroup.total,
          currencyCode: checkout.currencyCode,
          shippingMethodCode: checkoutGroup.shippingMethodCode,
          shippingEtaText: checkoutGroup.shippingEtaText,
          addressSnapshot: checkout.addressSnapshot ?? {},
          buyerNote: checkoutGroup.buyerNote,
        },
      });
      orderIds.push(order.id);

      // Nama schema diambil dari registry, tidak pernah dari data checkout.
      const registry = await this.prisma.tenantSchemaRegistry.findFirst({
        where: { tenantId: first.tenantId },
        select: { schemaName: true },
      });
      const schemaName = registry?.schemaName ?? '';
      if (schemaName) {
        await this.prisma.marketplaceOrder.update({
          where: { id: order.id },
          data: { tenantSchema: schemaName },
        });
      }

      for (const line of checkoutGroup.lines) {
        await this.prisma.marketplaceOrderLine.create({
          data: {
            orderId: order.id,
            tenantListingId: line.tenantListingId,
            variantRef: line.variantRef,
            titleSnapshot: line.titleSnapshot,
            skuSnapshot: line.skuSnapshot,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            weightGram: line.weightGram,
          },
        });

        // Stok ditahan bersamaan dengan pembuatan pesanan. Menahannya belakangan
        // membuka jendela tempat dua pembeli mendapat barang terakhir yang sama.
        if (schemaName) {
          await this.reservations.hold({
            orderId: order.id,
            tenantId: line.tenantId,
            tenantSchema: schemaName,
            tenantListingId: line.tenantListingId,
            variantRef: line.variantRef,
            quantity: line.quantity,
          });
        }
      }

      await this.recordHistory(order.id, null, 'AWAITING_PAYMENT', {
        type: 'SYSTEM',
      }, 'Pesanan dibuat dari checkout.');
    }

    this.logger.log(`Grup ${groupNumber}: ${orderIds.length} pesanan dibuat.`);
    return { groupId: group.id, orderIds };
  }

  /**
   * Memindahkan status pesanan.
   *
   * Efek samping yang menyertai perpindahan dijalankan di sini agar tidak
   * tersebar: stok dikomit saat lunas, dan dilepas saat batal.
   */
  async transition(
    orderId: string,
    to: OrderStatus,
    actor: OrderActor,
    reason?: string,
  ): Promise<void> {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, orderNumber: true },
    });
    if (!order) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesanan tidak ditemukan.');
    }

    const from = order.status as OrderStatus;
    const check = canTransition(from, to, actor.type);
    if (!check.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, check.reason ?? 'Perpindahan status ditolak.');
    }

    await this.prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: {
        status: to,
        paidAt: to === 'PAID' ? new Date() : undefined,
        cancelledAt: to === 'CANCELLED' || to === 'EXPIRED' ? new Date() : undefined,
        cancelReason: to === 'CANCELLED' || to === 'EXPIRED' ? (reason ?? null) : undefined,
        completedAt: to === 'COMPLETED' ? new Date() : undefined,
      },
    });

    await this.recordHistory(orderId, from, to, actor, reason);

    if (to === 'PAID') {
      await this.reservations.commit(orderId, 'Pembayaran diterima.');
    } else if (to === 'CANCELLED' || to === 'EXPIRED' || to === 'REFUNDED') {
      await this.reservations.release(orderId, reason ?? `Pesanan ${to}.`);
    }

    this.logger.log(`Pesanan ${order.orderNumber}: ${from} -> ${to} oleh ${actor.type}.`);
  }

  /** Pesanan milik satu pembeli. */
  async listForBuyer(buyerId: string, limit = 20, offset = 0): Promise<OrderView[]> {
    const orders = await this.prisma.marketplaceOrder.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      skip: offset,
      include: { lines: true, store: { select: { storeName: true, storeSlug: true } } },
    });
    return orders.map((o) => this.toView(o));
  }

  /** Pesanan yang masuk ke satu penjual. */
  async listForSeller(
    tenantId: string,
    status?: string,
    limit = 20,
    offset = 0,
  ): Promise<OrderView[]> {
    const seller = await this.prisma.marketplaceSeller.findFirst({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!seller) return [];

    const orders = await this.prisma.marketplaceOrder.findMany({
      // Disaring menurut `sellerId`, bukan menurut apa pun yang dikirim
      // pemanggil. Penjual tidak boleh dapat membaca pesanan penjual lain
      // dengan mengirim id yang berbeda.
      where: { sellerId: seller.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      skip: offset,
      include: { lines: true, store: { select: { storeName: true, storeSlug: true } } },
    });
    return orders.map((o) => this.toView(o));
  }

  /** Detail satu pesanan, dibatasi pada pemiliknya. */
  async findForBuyer(buyerId: string, orderId: string): Promise<OrderView> {
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { id: orderId, buyerId },
      include: { lines: true, store: { select: { storeName: true, storeSlug: true } } },
    });
    if (!order) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesanan tidak ditemukan.');
    }
    return this.toView(order);
  }

  private toView(order: {
    id: string;
    orderNumber: string;
    status: string;
    subtotal: unknown;
    shippingCost: unknown;
    total: unknown;
    currencyCode: string;
    createdAt: Date;
    paidAt: Date | null;
    lines: { titleSnapshot: string; quantity: number; unitPrice: unknown; lineTotal: unknown }[];
    store: { storeName: string; storeSlug: string };
  }): OrderView {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      storeName: order.store.storeName,
      storeSlug: order.store.storeSlug,
      lines: order.lines.map((l) => ({
        title: l.titleSnapshot,
        quantity: l.quantity,
        unitPrice: String(l.unitPrice),
        lineTotal: String(l.lineTotal),
      })),
      subtotal: String(order.subtotal),
      shippingCost: String(order.shippingCost),
      total: String(order.total),
      currencyCode: order.currencyCode,
      placedAt: order.createdAt,
      paidAt: order.paidAt,
    };
  }

  private async recordHistory(
    orderId: string,
    from: string | null,
    to: string,
    actor: OrderActor,
    reason?: string,
  ): Promise<void> {
    await this.prisma.marketplaceOrderStatusHistory.create({
      data: {
        orderId,
        fromStatus: from,
        toStatus: to,
        reason: reason ?? null,
        actorType: actor.type,
        actorId: actor.id ?? null,
        requestId: actor.requestId ?? null,
      },
    });
  }

  /**
   * Nomor pesanan yang dapat disebutkan lewat telepon.
   *
   * Bentuknya `PSN-260731-0042`. Urutan dihitung per hari, dan tabrakan
   * ditangani dengan mencoba nomor berikutnya — bukan dengan mengunci tabel,
   * yang akan membuat seluruh pemesanan menunggu satu sama lain.
   */
  private async nextNumber(prefix: string): Promise<string> {
    const now = new Date();
    const stamp =
      String(now.getFullYear()).slice(2) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const count =
      prefix === 'BLJ'
        ? await this.prisma.marketplaceOrderGroup.count({ where: { createdAt: { gte: startOfDay } } })
        : await this.prisma.marketplaceOrder.count({ where: { createdAt: { gte: startOfDay } } });

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = `${prefix}-${stamp}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const taken =
        prefix === 'BLJ'
          ? await this.prisma.marketplaceOrderGroup.findUnique({
              where: { groupNumber: candidate },
              select: { id: true },
            })
          : await this.prisma.marketplaceOrder.findUnique({
              where: { orderNumber: candidate },
              select: { id: true },
            });
      if (!taken) return candidate;
    }

    // Setelah lima puluh percobaan, waktu dipakai agar pemesanan tetap dapat
    // berjalan. Nomornya jelek tetapi pasti unik.
    return `${prefix}-${stamp}-${now.getTime().toString(36).toUpperCase()}`;
  }
}
