/**
 * Checkout marketplace.
 *
 * ## Satu kelompok per penjual, satu pembayaran per kelompok
 *
 * Keranjang berisi tiga penjual menghasilkan tiga kelompok, tiga pesanan, dan
 * tiga perintah bayar. Satu pembayaran untuk banyak penjual menuntut penyedia
 * membagi setelmen ke beberapa rekening; eSmartlink belum terbukti
 * mendukungnya. Membuat pembagian sendiri berarti platform menampung uang
 * penjual — kegiatan yang menuntut izin yang tidak dimiliki.
 *
 * ## Checkout menahan keadaan, bukan menghitung ulang
 *
 * Harga, ongkos, dan judul disalin ke baris checkout. Pembeli yang membuka
 * halaman pembayaran selama sepuluh menit tidak boleh menemukan totalnya
 * berubah saat menekan bayar.
 *
 * Yang **tidak** dibekukan adalah kelayakan: stok dan status penjual diperiksa
 * ulang saat konfirmasi. Membekukannya berarti menjual barang yang sudah habis.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { CartService } from './cart.service';
import {
  computeTotals,
  validateCheckout,
  type CheckoutLineInput,
  type CheckoutSellerInput,
  type CheckoutValidationResult,
} from './checkout-validation';

/** Berapa lama checkout ditahan sebelum dilepas. */
const CHECKOUT_TTL_MINUTES = 30;

/**
 * Ongkos kirim sementara.
 *
 * Tarif sungguhan datang dari penyedia ekspedisi pada V9-9. Sampai itu ada,
 * angka tetap dipakai supaya alur checkout dapat dijalankan dan diuji dari
 * awal sampai akhir — dan pembeli melihat angka yang jujur, bukan nol yang
 * menyesatkan.
 */
const FLAT_SHIPPING_PER_SELLER = 20000;

export interface CheckoutView {
  id: string;
  status: string;
  groups: {
    sellerId: string;
    storeName: string;
    storeSlug: string;
    lines: { title: string; quantity: number; unitPrice: string; lineTotal: string }[];
    subtotal: string;
    shippingCost: string;
    total: string;
  }[];
  subtotal: string;
  shippingTotal: string;
  discountTotal: string;
  grandTotal: string;
  currencyCode: string;
  validation: CheckoutValidationResult;
  expiresAt: Date | null;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly carts: CartService,
  ) {}

  /**
   * Membuat checkout dari isi keranjang.
   *
   * Checkout lama yang belum selesai dibatalkan lebih dulu. Dua checkout aktif
   * untuk satu pembeli berarti dua tahanan stok untuk barang yang sama.
   */
  async create(buyerId: string, addressId: string | null): Promise<CheckoutView> {
    const cart = await this.carts.view({ buyerId });
    if (cart.lines.length === 0) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, 'Keranjang kosong.');
    }

    await this.prisma.marketplaceCheckout.updateMany({
      where: { buyerId, status: 'DRAFT' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const items = await this.prisma.marketplaceCartItem.findMany({
      where: { cart: { buyerId, status: 'ACTIVE' } },
      select: {
        id: true,
        quantity: true,
        priceAtAdd: true,
        variantRef: true,
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            minPrice: true,
            currencyCode: true,
            availability: true,
            sellerId: true,
            storeId: true,
            storeName: true,
            storeSlug: true,
            tenantId: true,
            tenantSchema: true,
            tenantListingId: true,
          },
        },
      },
    });

    const address = addressId
      ? await this.prisma.marketplaceBuyerAddress.findFirst({
          where: { id: addressId, buyerId, deletedAt: null },
        })
      : await this.prisma.marketplaceBuyerAddress.findFirst({
          where: { buyerId, deletedAt: null, isDefault: true },
        });

    // Kelompokkan menurut penjual.
    const bySeller = new Map<string, typeof items>();
    for (const item of items) {
      const list = bySeller.get(item.listing.sellerId) ?? [];
      list.push(item);
      bySeller.set(item.listing.sellerId, list);
    }

    const checkout = await this.prisma.marketplaceCheckout.create({
      data: {
        buyerId,
        addressId: address?.id ?? null,
        status: 'DRAFT',
        currencyCode: items[0]?.listing.currencyCode ?? 'IDR',
        // Alamat disalin. Pembeli yang mengubah alamatnya setelah memesan
        // tidak boleh mengubah tujuan kiriman yang sedang berjalan.
        addressSnapshot: address
          ? {
              recipientName: address.recipientName,
              phone: address.phone,
              addressLine: address.addressLine,
              district: address.district,
              city: address.city,
              province: address.province,
              postalCode: address.postalCode,
              countryCode: address.countryCode,
              notes: address.notes,
            }
          : undefined,
        expiresAt: new Date(Date.now() + CHECKOUT_TTL_MINUTES * 60 * 1000),
      },
    });

    for (const [sellerId, sellerItems] of bySeller) {
      const first = sellerItems[0].listing;
      const weights = await this.loadWeights(sellerItems.map((i) => i.listing));

      const group = await this.prisma.marketplaceCheckoutGroup.create({
        data: {
          checkoutId: checkout.id,
          sellerId,
          storeId: first.storeId,
          shippingCost: FLAT_SHIPPING_PER_SELLER,
          shippingMethodCode: 'REGULER',
          shippingEtaText: '2-4 hari kerja',
        },
      });

      let groupSubtotal = 0;
      for (const item of sellerItems) {
        const unitPrice = Math.round(Number(item.listing.minPrice));
        const lineTotal = unitPrice * item.quantity;
        groupSubtotal += lineTotal;

        await this.prisma.marketplaceCheckoutLine.create({
          data: {
            groupId: group.id,
            listingProjectionId: item.listing.id,
            variantRef: item.variantRef,
            tenantId: item.listing.tenantId,
            tenantListingId: item.listing.tenantListingId,
            titleSnapshot: item.listing.title,
            quantity: item.quantity,
            unitPrice,
            lineTotal,
            weightGram: weights.get(item.listing.tenantListingId) ?? 0,
          },
        });
      }

      await this.prisma.marketplaceCheckoutGroup.update({
        where: { id: group.id },
        data: {
          subtotal: groupSubtotal,
          total: groupSubtotal + FLAT_SHIPPING_PER_SELLER,
        },
      });
    }

    const totals = computeTotals(
      items.map((i) => ({ currentPrice: Number(i.listing.minPrice), quantity: i.quantity })),
      Array.from(bySeller.keys()).map(() => FLAT_SHIPPING_PER_SELLER),
    );

    await this.prisma.marketplaceCheckout.update({
      where: { id: checkout.id },
      data: {
        subtotal: totals.subtotal,
        shippingTotal: totals.shippingTotal,
        discountTotal: totals.discountTotal,
        grandTotal: totals.grandTotal,
      },
    });

    this.logger.log(
      `Checkout ${checkout.id} dibuat: ${bySeller.size} penjual, total ${totals.grandTotal}.`,
    );
    return this.view(buyerId, checkout.id);
  }

  /**
   * Memeriksa ulang kelayakan checkout.
   *
   * Dijalankan setiap kali checkout dibaca, bukan hanya saat konfirmasi. Pembeli
   * harus melihat masalahnya selagi masih dapat diperbaiki.
   */
  async view(buyerId: string, checkoutId: string): Promise<CheckoutView> {
    const checkout = await this.prisma.marketplaceCheckout.findFirst({
      where: { id: checkoutId, buyerId },
      include: {
        groups: {
          include: {
            lines: { include: { listing: { select: { availability: true, minPrice: true } } } },
            seller: { select: { id: true, status: true } },
            store: { select: { storeName: true, storeSlug: true, status: true } },
          },
        },
      },
    });
    if (!checkout) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Checkout tidak ditemukan.');
    }

    const lineInputs: CheckoutLineInput[] = [];
    const sellerInputs: CheckoutSellerInput[] = [];

    for (const group of checkout.groups) {
      const paymentAccountActive = await this.hasActivePaymentAccount(group.sellerId);
      sellerInputs.push({
        sellerId: group.sellerId,
        sellerStatus: group.seller.status,
        storeStatus: group.store.status,
        paymentAccountActive,
        shippingMethodCode: group.shippingMethodCode,
      });

      for (const line of group.lines) {
        lineInputs.push({
          ref: line.id,
          sellerId: group.sellerId,
          title: line.titleSnapshot,
          // Harga yang dibekukan dibandingkan dengan harga katalog sekarang.
          priceAtAdd: Number(line.unitPrice),
          currentPrice: Math.round(Number(line.listing.minPrice)),
          quantity: line.quantity,
          availability: line.listing.availability,
          stockQty: null,
          weightGram: line.weightGram,
          listingVisible: true,
        });
      }
    }

    const snapshot = checkout.addressSnapshot as Record<string, string> | null;
    const validation = validateCheckout({
      lines: lineInputs,
      sellers: sellerInputs,
      address: snapshot
        ? {
            recipientName: snapshot.recipientName,
            phone: snapshot.phone,
            addressLine: snapshot.addressLine,
            city: snapshot.city,
            province: snapshot.province,
            postalCode: snapshot.postalCode,
          }
        : null,
    });

    await this.prisma.marketplaceCheckout.update({
      where: { id: checkout.id },
      data: {
        validationSnapshot: JSON.parse(JSON.stringify(validation)),
        validatedAt: new Date(),
      },
    });

    return {
      id: checkout.id,
      status: checkout.status,
      groups: checkout.groups.map((group) => ({
        sellerId: group.sellerId,
        storeName: group.store.storeName,
        storeSlug: group.store.storeSlug,
        lines: group.lines.map((line) => ({
          title: line.titleSnapshot,
          quantity: line.quantity,
          unitPrice: line.unitPrice.toString(),
          lineTotal: line.lineTotal.toString(),
        })),
        subtotal: group.subtotal.toString(),
        shippingCost: group.shippingCost.toString(),
        total: group.total.toString(),
      })),
      subtotal: checkout.subtotal.toString(),
      shippingTotal: checkout.shippingTotal.toString(),
      discountTotal: checkout.discountTotal.toString(),
      grandTotal: checkout.grandTotal.toString(),
      currencyCode: checkout.currencyCode,
      validation,
      expiresAt: checkout.expiresAt,
    };
  }

  /**
   * Mengunci checkout sebelum pembayaran.
   *
   * Pesanan dan perintah bayar dibuat pada V9-7 dan V9-8. Yang dilakukan di
   * sini hanya memastikan checkout masih layak dan menandainya terkunci,
   * sehingga isinya tidak berubah selagi pembayaran berjalan.
   */
  async confirm(buyerId: string, checkoutId: string): Promise<CheckoutView> {
    const view = await this.view(buyerId, checkoutId);

    if (view.status !== 'DRAFT') {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Checkout ini sudah diproses.');
    }
    if (view.expiresAt && view.expiresAt.getTime() < Date.now()) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Checkout sudah kedaluwarsa. Silakan ulangi dari keranjang.',
      );
    }
    if (!view.validation.canConfirm) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Checkout belum dapat dilanjutkan: ${view.validation.blocking.map((b) => b.detail).join('; ')}`,
        { blocking: view.validation.blocking },
      );
    }

    await this.prisma.marketplaceCheckout.update({
      where: { id: checkoutId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });

    this.logger.log(`Checkout ${checkoutId} dikonfirmasi.`);
    return this.view(buyerId, checkoutId);
  }

  /**
   * Membaca berat dari schema tenant.
   *
   * Berat tidak ada pada projection karena bukan hal yang ditampilkan kepada
   * pembeli. Ia dibutuhkan menghitung ongkos kirim, dan itu terjadi di sini.
   */
  private async loadWeights(
    listings: { tenantSchema: string; tenantListingId: string }[],
  ): Promise<Map<string, number>> {
    const weights = new Map<string, number>();
    const bySchema = new Map<string, string[]>();
    for (const listing of listings) {
      const list = bySchema.get(listing.tenantSchema) ?? [];
      list.push(listing.tenantListingId);
      bySchema.set(listing.tenantSchema, list);
    }

    for (const [schemaName, ids] of bySchema) {
      try {
        const rows = await this.tenantDb.query<{ listing_id: string; weight: number }>(
          schemaName,
          `SELECT listing_id::text, COALESCE(MAX(weight_gram), 0)::int AS weight
             FROM "${schemaName}".online_listing_variant
            WHERE listing_id = ANY($1::uuid[]) AND is_active AND deleted_at IS NULL
            GROUP BY listing_id`,
          [ids],
        );
        for (const row of rows) weights.set(row.listing_id, row.weight);
      } catch (error) {
        // Berat yang gagal dibaca menjadi nol, dan nol ditolak pemeriksaan
        // kelayakan. Lebih baik checkout tertahan daripada ongkos kirim salah.
        this.logger.warn(`Berat pada ${schemaName} gagal dibaca: ${(error as Error).message}`);
      }
    }
    return weights;
  }

  /** Apakah penjual sudah dapat menerima pembayaran. */
  private async hasActivePaymentAccount(sellerId: string): Promise<boolean> {
    const seller = await this.prisma.marketplaceSeller.findUnique({
      where: { id: sellerId },
      select: { tenantId: true },
    });
    if (!seller) return false;

    const account = await this.prisma.tenantPaymentProviderAccount.findFirst({
      where: { tenantId: seller.tenantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    return Boolean(account);
  }
}
