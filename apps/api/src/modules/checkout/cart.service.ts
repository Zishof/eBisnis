/**
 * Keranjang belanja marketplace.
 *
 * Keranjang membaca `marketplace_listing_projection`, bukan schema tenant. Itu
 * berarti barang yang tidak terlihat publik tidak dapat dimasukkan sama sekali
 * — bukan dimasukkan lalu disaring saat checkout.
 *
 * Keranjang tamu dikenali lewat token acak, bukan lewat sesi. Pengunjung harus
 * dapat memilih barang sebelum memutuskan mendaftar; menuntut pendaftaran lebih
 * dahulu adalah cara paling murah kehilangan pembeli.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MAX_QUANTITY_PER_LINE } from './checkout-validation';

export interface CartIdentity {
  buyerId?: string | null;
  guestToken?: string | null;
}

export interface CartLineView {
  id: string;
  listingSlug: string;
  title: string;
  storeName: string;
  storeSlug: string;
  quantity: number;
  /** Harga saat dimasukkan; dipakai membandingkan, bukan menagih. */
  priceAtAdd: string;
  currentPrice: string;
  lineTotal: string;
  availability: string;
  priceChanged: boolean;
  stillAvailable: boolean;
}

export interface CartView {
  id: string;
  guestToken: string | null;
  lines: CartLineView[];
  itemCount: number;
  subtotal: string;
  currencyCode: string;
  /** Jumlah baris yang perlu perhatian sebelum checkout. */
  issueCount: number;
}

/** Berapa lama keranjang yang tidak disentuh disimpan. */
const CART_TTL_DAYS = 30;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menemukan keranjang aktif, membuatnya bila belum ada.
   *
   * Pembeli yang masuk setelah berbelanja sebagai tamu membawa serta isinya —
   * tanpa itu, mendaftar berarti kehilangan keranjang, dan pembeli akan
   * menyalahkan situsnya.
   */
  async resolve(identity: CartIdentity): Promise<{ id: string; guestToken: string | null }> {
    if (identity.buyerId) {
      const existing = await this.prisma.marketplaceCart.findFirst({
        where: { buyerId: identity.buyerId, status: 'ACTIVE' },
        select: { id: true, guestToken: true },
      });
      if (existing) {
        // Keranjang tamu yang dibawa masuk digabungkan.
        if (identity.guestToken) await this.mergeGuestCart(identity.guestToken, existing.id);
        return existing;
      }

      // Keranjang tamu diadopsi apa adanya bila pembeli belum punya keranjang.
      if (identity.guestToken) {
        const guest = await this.prisma.marketplaceCart.findFirst({
          where: { guestToken: identity.guestToken, status: 'ACTIVE' },
          select: { id: true },
        });
        if (guest) {
          const adopted = await this.prisma.marketplaceCart.update({
            where: { id: guest.id },
            data: { buyerId: identity.buyerId, guestToken: null, expiresAt: null },
            select: { id: true, guestToken: true },
          });
          return adopted;
        }
      }

      const created = await this.prisma.marketplaceCart.create({
        data: { buyerId: identity.buyerId, status: 'ACTIVE' },
        select: { id: true, guestToken: true },
      });
      return created;
    }

    if (identity.guestToken) {
      const guest = await this.prisma.marketplaceCart.findFirst({
        where: { guestToken: identity.guestToken, status: 'ACTIVE' },
        select: { id: true, guestToken: true },
      });
      if (guest) return guest;
    }

    const token = randomBytes(24).toString('base64url');
    const created = await this.prisma.marketplaceCart.create({
      data: {
        guestToken: token,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true, guestToken: true },
    });
    return created;
  }

  /** Menambahkan barang. Barang yang sama menambah jumlah, bukan baris. */
  async addItem(
    identity: CartIdentity,
    listingSlug: string,
    quantity = 1,
    variantRef?: string,
  ): Promise<CartView> {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Jumlah tidak sah.');
    }

    // Hanya barang yang terlihat publik. Projection adalah satu-satunya sumber;
    // membaca listing tenant di sini akan membuka jalan memesan barang yang
    // belum terbit dengan menebak idnya.
    const listing = await this.prisma.marketplaceListingProjection.findUnique({
      where: { slug: listingSlug },
      select: { id: true, minPrice: true, availability: true, title: true },
    });
    if (!listing) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Produk tidak ditemukan.');
    }
    if (listing.availability === 'OUT_OF_STOCK') {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `"${listing.title}" sedang kehabisan stok.`,
      );
    }

    const cart = await this.resolve(identity);

    const existing = await this.prisma.marketplaceCartItem.findFirst({
      where: { cartId: cart.id, listingProjectionId: listing.id, variantRef: variantRef ?? null },
      select: { id: true, quantity: true },
    });

    if (existing) {
      const next = Math.min(existing.quantity + quantity, MAX_QUANTITY_PER_LINE);
      await this.prisma.marketplaceCartItem.update({
        where: { id: existing.id },
        data: { quantity: next },
      });
    } else {
      await this.prisma.marketplaceCartItem.create({
        data: {
          cartId: cart.id,
          listingProjectionId: listing.id,
          variantRef: variantRef ?? null,
          quantity,
          priceAtAdd: listing.minPrice,
        },
      });
    }

    await this.touch(cart.id);
    return this.view(identity);
  }

  /** Mengubah jumlah satu baris. Jumlah nol menghapusnya. */
  async setQuantity(identity: CartIdentity, itemId: string, quantity: number): Promise<CartView> {
    const cart = await this.resolve(identity);

    // Memastikan baris memang milik keranjang pemanggil. Tanpa ini, id baris
    // yang ditebak memungkinkan seseorang mengubah keranjang orang lain.
    const item = await this.prisma.marketplaceCartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      select: { id: true },
    });
    if (!item) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Barang tidak ada di keranjang ini.');
    }

    if (quantity <= 0) {
      await this.prisma.marketplaceCartItem.delete({ where: { id: itemId } });
    } else {
      if (!Number.isInteger(quantity) || quantity > MAX_QUANTITY_PER_LINE) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Jumlah tidak sah.');
      }
      await this.prisma.marketplaceCartItem.update({ where: { id: itemId }, data: { quantity } });
    }

    await this.touch(cart.id);
    return this.view(identity);
  }

  async removeItem(identity: CartIdentity, itemId: string): Promise<CartView> {
    return this.setQuantity(identity, itemId, 0);
  }

  async clear(identity: CartIdentity): Promise<CartView> {
    const cart = await this.resolve(identity);
    await this.prisma.marketplaceCartItem.deleteMany({ where: { cartId: cart.id } });
    return this.view(identity);
  }

  /**
   * Isi keranjang beserta perbandingan harga.
   *
   * Perbedaan harga ditampilkan di keranjang, bukan disembunyikan sampai
   * checkout. Pembeli yang baru tahu harganya naik pada layar pembayaran akan
   * merasa dikelabui.
   */
  async view(identity: CartIdentity): Promise<CartView> {
    const cart = await this.resolve(identity);

    const items = await this.prisma.marketplaceCartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        quantity: true,
        priceAtAdd: true,
        listing: {
          select: {
            slug: true,
            title: true,
            minPrice: true,
            availability: true,
            storeName: true,
            storeSlug: true,
            currencyCode: true,
          },
        },
      },
    });

    let subtotal = 0;
    let issueCount = 0;
    const lines: CartLineView[] = items.map((item) => {
      const currentPrice = Number(item.listing.minPrice);
      const priceAtAdd = Number(item.priceAtAdd);
      const lineTotal = Math.round(currentPrice) * item.quantity;
      subtotal += lineTotal;

      const priceChanged = currentPrice !== priceAtAdd;
      const stillAvailable = item.listing.availability !== 'OUT_OF_STOCK';
      if (priceChanged || !stillAvailable) issueCount += 1;

      return {
        id: item.id,
        listingSlug: item.listing.slug,
        title: item.listing.title,
        storeName: item.listing.storeName,
        storeSlug: item.listing.storeSlug,
        quantity: item.quantity,
        priceAtAdd: String(Math.round(priceAtAdd)),
        currentPrice: String(Math.round(currentPrice)),
        lineTotal: String(lineTotal),
        availability: item.listing.availability,
        priceChanged,
        stillAvailable,
      };
    });

    return {
      id: cart.id,
      guestToken: cart.guestToken,
      lines,
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: String(subtotal),
      currencyCode: items[0]?.listing.currencyCode ?? 'IDR',
      issueCount,
    };
  }

  /** Menggabungkan keranjang tamu ke keranjang pembeli yang sudah ada. */
  private async mergeGuestCart(guestToken: string, targetCartId: string): Promise<void> {
    const guest = await this.prisma.marketplaceCart.findFirst({
      where: { guestToken, status: 'ACTIVE' },
      select: { id: true, items: { select: { listingProjectionId: true, variantRef: true, quantity: true, priceAtAdd: true } } },
    });
    if (!guest || guest.id === targetCartId) return;

    for (const item of guest.items) {
      const existing = await this.prisma.marketplaceCartItem.findFirst({
        where: {
          cartId: targetCartId,
          listingProjectionId: item.listingProjectionId,
          variantRef: item.variantRef,
        },
        select: { id: true, quantity: true },
      });

      if (existing) {
        // Jumlah dijumlahkan, bukan ditimpa: keduanya adalah niat pembeli.
        await this.prisma.marketplaceCartItem.update({
          where: { id: existing.id },
          data: { quantity: Math.min(existing.quantity + item.quantity, MAX_QUANTITY_PER_LINE) },
        });
      } else {
        await this.prisma.marketplaceCartItem.create({
          data: {
            cartId: targetCartId,
            listingProjectionId: item.listingProjectionId,
            variantRef: item.variantRef,
            quantity: item.quantity,
            priceAtAdd: item.priceAtAdd,
          },
        });
      }
    }

    await this.prisma.marketplaceCart.update({
      where: { id: guest.id },
      data: { status: 'MERGED' },
    });
    this.logger.log(`Keranjang tamu digabungkan ke ${targetCartId}.`);
  }

  private async touch(cartId: string): Promise<void> {
    await this.prisma.marketplaceCart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });
  }
}
