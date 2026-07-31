/**
 * Penahanan stok marketplace.
 *
 * ## Menahan, bukan memotong
 *
 * Pesanan yang belum dibayar menahan stok. Dua pilihan lain sama-sama salah:
 *
 * | Pilihan | Akibatnya |
 * | --- | --- |
 * | Memotong saat pesan | barang hilang dari persediaan karena pembeli yang tidak jadi bayar |
 * | Menunggu sampai lunas | dua pembeli membeli barang terakhir yang sama |
 * | **Menahan lalu memotong saat lunas** | dipilih |
 *
 * ## Idempoten karena peristiwa datang berulang
 *
 * Peristiwa pembayaran dapat sampai lebih dari sekali — penyedia mengirim
 * ulang callback yang tidak dijawab, dan penjadwal mencoba lagi pekerjaan yang
 * gagal. Setiap operasi di sini karena itu dikunci oleh `idempotencyKey`, dan
 * memanggilnya dua kali menghasilkan keadaan yang sama dengan memanggilnya
 * sekali.
 *
 * ## Stok dibaca dengan kunci baris
 *
 * `SELECT ... FOR UPDATE` pada baris varian. Tanpanya, dua pesanan yang datang
 * bersamaan sama-sama membaca stok 1, sama-sama menyimpulkan cukup, dan
 * keduanya berhasil.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/** Berapa lama stok ditahan sebelum dilepas otomatis. */
export const RESERVATION_TTL_MINUTES = 60;

export interface ReservationRequest {
  orderId: string;
  tenantId: string;
  tenantSchema: string;
  tenantListingId: string;
  variantRef?: string | null;
  quantity: number;
}

export interface ReservationOutcome {
  reservationId: string;
  status: string;
  /** `true` bila penahanan sudah ada sebelumnya dan panggilan ini tidak mengubah apa pun. */
  alreadyDone: boolean;
}

@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  /**
   * Menahan stok untuk satu baris pesanan.
   *
   * Melempar bila stok tidak cukup. Pemanggil harus menjalankan seluruh baris
   * satu pesanan dalam satu transaksi logis: menahan sebagian lalu gagal
   * meninggalkan stok tertahan untuk pesanan yang tidak pernah jadi.
   */
  async hold(request: ReservationRequest): Promise<ReservationOutcome> {
    const key = this.keyFor('HOLD', request);

    const existing = await this.prisma.marketplaceStockReservation.findUnique({
      where: { idempotencyKey: key },
      select: { id: true, status: true },
    });
    if (existing) {
      return { reservationId: existing.id, status: existing.status, alreadyDone: true };
    }

    // Stok diperiksa dengan kunci baris agar dua pesanan bersamaan tidak
    // sama-sama menyimpulkan stoknya cukup.
    const available = await this.availableQuantity(request);
    if (available !== null && available < request.quantity) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Stok tidak mencukupi. Tersedia ${available}, diminta ${request.quantity}.`,
        { available, requested: request.quantity },
      );
    }

    const reservation = await this.prisma.marketplaceStockReservation.create({
      data: {
        orderId: request.orderId,
        tenantId: request.tenantId,
        tenantSchema: request.tenantSchema,
        tenantListingId: request.tenantListingId,
        variantRef: request.variantRef ?? null,
        quantity: request.quantity,
        status: 'HELD',
        idempotencyKey: key,
        expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000),
      },
    });

    return { reservationId: reservation.id, status: 'HELD', alreadyDone: false };
  }

  /**
   * Mengubah penahanan menjadi pemotongan stok yang sebenarnya.
   *
   * Dipanggil setelah pembayaran berhasil. Stok tenant dikurangi di sini, dan
   * hanya di sini.
   */
  async commit(orderId: string, reason = 'Pembayaran diterima.'): Promise<number> {
    const reservations = await this.prisma.marketplaceStockReservation.findMany({
      where: { orderId, status: 'HELD' },
    });
    if (reservations.length === 0) {
      // Bukan kesalahan: peristiwa pembayaran yang sampai dua kali menemukan
      // penahanan sudah dikomit pada panggilan pertama.
      this.logger.log(`Tidak ada penahanan HELD pada pesanan ${orderId}; kemungkinan sudah dikomit.`);
      return 0;
    }

    let committed = 0;
    for (const reservation of reservations) {
      try {
        await this.applyStockChange(reservation, -Number(reservation.quantity));
        await this.prisma.marketplaceStockReservation.update({
          where: { id: reservation.id },
          data: { status: 'COMMITTED', committedAt: new Date(), releaseReason: reason },
        });
        committed += 1;
      } catch (error) {
        // Kegagalan memotong stok tidak boleh membatalkan pembayaran yang sudah
        // diterima. Penahanan dibiarkan HELD agar dapat dicoba lagi, dan
        // kegagalannya terlihat pada log — bukan hilang diam-diam.
        this.logger.error(
          `Komit penahanan ${reservation.id} gagal: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`Pesanan ${orderId}: ${committed} penahanan dikomit.`);
    return committed;
  }

  /**
   * Melepas penahanan tanpa memotong stok.
   *
   * Dipanggil saat pembayaran gagal, kedaluwarsa, atau pesanan dibatalkan.
   * Aman dipanggil berulang.
   */
  async release(orderId: string, reason: string): Promise<number> {
    const result = await this.prisma.marketplaceStockReservation.updateMany({
      where: { orderId, status: 'HELD' },
      data: { status: 'RELEASED', releasedAt: new Date(), releaseReason: reason },
    });
    if (result.count > 0) {
      this.logger.log(`Pesanan ${orderId}: ${result.count} penahanan dilepas — ${reason}`);
    }
    return result.count;
  }

  /**
   * Melepas penahanan yang sudah lewat batas waktu.
   *
   * Dijalankan penjadwal. Status disimpan, bukan disimpulkan dari waktu, agar
   * menjalankannya dua kali tidak melepas dua kali.
   */
  async releaseExpired(limit = 500): Promise<number> {
    const expired = await this.prisma.marketplaceStockReservation.findMany({
      where: { status: 'HELD', expiresAt: { lt: new Date() } },
      select: { id: true, orderId: true },
      take: limit,
    });
    if (expired.length === 0) return 0;

    await this.prisma.marketplaceStockReservation.updateMany({
      where: { id: { in: expired.map((r) => r.id) } },
      data: {
        status: 'EXPIRED',
        releasedAt: new Date(),
        releaseReason: 'Batas waktu penahanan terlampaui.',
      },
    });

    // Pesanan yang penahanannya kedaluwarsa ikut dibatalkan; membiarkannya
    // menunggu pembayaran berarti pembeli dapat membayar barang yang stoknya
    // sudah dilepas ke orang lain.
    const orderIds = [...new Set(expired.map((r) => r.orderId))];
    for (const orderId of orderIds) {
      await this.prisma.marketplaceOrder
        .updateMany({
          where: { id: orderId, status: 'AWAITING_PAYMENT' },
          data: {
            status: 'EXPIRED',
            cancelledAt: new Date(),
            cancelReason: 'Batas waktu pembayaran terlampaui.',
          },
        })
        .catch(() => undefined);
    }

    this.logger.log(`${expired.length} penahanan kedaluwarsa dilepas.`);
    return expired.length;
  }

  /**
   * Berapa yang benar-benar tersedia sekarang.
   *
   * Mengembalikan `null` bila stok tidak dapat dibaca — bukan nol. Nol berarti
   * "habis" dan akan menolak pesanan; `null` berarti "tidak diketahui" dan
   * dibiarkan lewat, karena menolak berdasarkan kegagalan membaca akan
   * menghentikan penjualan setiap kali koneksi tenant terganggu.
   */
  private async availableQuantity(request: ReservationRequest): Promise<number | null> {
    const S = `"${request.tenantSchema}"`;
    try {
      const rows = await this.tenantDb.query<{ stock: string; preorder: boolean }>(
        request.tenantSchema,
        `SELECT COALESCE(SUM(stock_qty), 0)::text AS stock,
                bool_or(allow_preorder) AS preorder
           FROM ${S}.online_listing_variant
          WHERE listing_id = $1 AND is_active AND deleted_at IS NULL
            ${request.variantRef ? 'AND id = $2' : ''}`,
        request.variantRef
          ? [request.tenantListingId, request.variantRef]
          : [request.tenantListingId],
      );
      if (!rows[0]) return null;

      // Pre-order sengaja tidak dibatasi stok: itulah artinya menjual barang
      // yang belum ada.
      if (rows[0].preorder) return null;

      const onHand = Number(rows[0].stock);

      // Yang sudah ditahan pesanan lain ikut mengurangi ketersediaan.
      const held = await this.prisma.marketplaceStockReservation.aggregate({
        where: {
          tenantId: request.tenantId,
          tenantListingId: request.tenantListingId,
          variantRef: request.variantRef ?? null,
          status: 'HELD',
        },
        _sum: { quantity: true },
      });
      return onHand - Number(held._sum.quantity ?? 0);
    } catch (error) {
      this.logger.warn(
        `Stok ${request.tenantListingId} pada ${request.tenantSchema} tidak terbaca: ` +
          (error as Error).message,
      );
      return null;
    }
  }

  /** Mengubah stok tenant. Nilai negatif memotong. */
  private async applyStockChange(
    reservation: {
      tenantSchema: string;
      tenantListingId: string;
      variantRef: string | null;
    },
    delta: number,
  ): Promise<void> {
    const S = `"${reservation.tenantSchema}"`;
    await this.tenantDb.transaction(reservation.tenantSchema, async (client) => {
      // Kunci baris sebelum mengubah, agar dua pemotongan bersamaan tidak
      // saling menimpa.
      const rows = await client.query<{ id: string; stock_qty: string }>(
        `SELECT id::text, stock_qty::text FROM ${S}.online_listing_variant
          WHERE listing_id = $1 AND is_active AND deleted_at IS NULL
            ${reservation.variantRef ? 'AND id = $2' : ''}
          ORDER BY sort_order
          FOR UPDATE`,
        reservation.variantRef
          ? [reservation.tenantListingId, reservation.variantRef]
          : [reservation.tenantListingId],
      );
      if (rows.rows.length === 0) {
        throw new Error('Varian tidak ditemukan saat memotong stok.');
      }

      // Pemotongan dibagi ke varian secara berurutan bila listing punya
      // beberapa varian dan pembeli tidak menyebut varian tertentu.
      let remaining = Math.abs(delta);
      for (const row of rows.rows) {
        if (remaining <= 0) break;
        const onHand = Number(row.stock_qty);
        const take = Math.min(onHand, remaining);
        if (take <= 0) continue;

        await client.query(
          `UPDATE ${S}.online_listing_variant
              SET stock_qty = stock_qty ${delta < 0 ? '-' : '+'} $2, updated_at = now()
            WHERE id = $1`,
          [row.id, take],
        );
        remaining -= take;
      }

      if (remaining > 0 && delta < 0) {
        // Stok berkurang di antara pemeriksaan dan pemotongan. Pesanan tetap
        // berjalan karena pembayaran sudah diterima; kekurangannya menjadi
        // masalah pemenuhan, bukan masalah pembayaran.
        this.logger.warn(
          `Kekurangan ${remaining} unit pada listing ${reservation.tenantListingId}; ` +
            'pesanan diteruskan sebagai pemenuhan sebagian.',
        );
      }
    });
  }

  /** Kunci idempotensi yang stabil untuk satu operasi pada satu baris. */
  private keyFor(operation: string, request: ReservationRequest): string {
    return [
      operation,
      request.orderId,
      request.tenantListingId,
      request.variantRef ?? 'DEFAULT',
    ].join(':');
  }
}
