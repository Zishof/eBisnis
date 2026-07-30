import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';

/**
 * Pemeriksaan kesiapan seller sebelum boleh menerima pesanan.
 *
 * Blueprint Versi 9 bagian 5.1 menyebut sembilan syarat. Yang dapat diperiksa
 * sekarang diperiksa; yang menunggu fase berikutnya dinyatakan `PENDING_PHASE`
 * dengan fase yang menyediakannya — bukan dilaporkan lulus, dan bukan pula
 * dilaporkan gagal seolah tenant yang salah.
 */

export type CheckStatus = 'PASS' | 'FAIL' | 'PENDING_PHASE';

export interface ReadinessCheck {
  code: string;
  label: string;
  status: CheckStatus;
  /** Alasan yang dapat ditindaklanjuti tenant, bukan pesan umum. */
  detail: string;
  /** Fase yang akan menyediakan pemeriksaan ini, bila belum tersedia. */
  availableIn?: string;
  blocking: boolean;
}

export interface ReadinessReport {
  checkedAt: string;
  profileComplete: boolean;
  paymentAccountReady: boolean;
  activationTicketOpen: boolean;
  /** Benar hanya bila seluruh pemeriksaan yang memblokir sudah PASS. */
  readyForReview: boolean;
  checks: ReadinessCheck[];
}

@Injectable()
export class MarketplaceReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  async evaluate(sellerId: string): Promise<ReadinessReport> {
    const seller = await this.prisma.marketplaceSeller.findUniqueOrThrow({
      where: { id: sellerId },
      include: { program: true, stores: { where: { deletedAt: null } } },
    });

    const registry = await this.prisma.tenantSchemaRegistry.findFirst({
      where: { tenantId: seller.tenantId },
    });

    const checks: ReadinessCheck[] = [];

    // --- Profil seller ------------------------------------------------------
    const hasContact = Boolean(seller.supportEmail || seller.supportPhone);
    checks.push({
      code: 'SELLER_CONTACT',
      label: 'Kontak dukungan seller',
      status: hasContact ? 'PASS' : 'FAIL',
      detail: hasContact
        ? 'Kontak dukungan sudah diisi.'
        : 'Isi email atau nomor telepon dukungan agar pembeli dapat menghubungi toko.',
      blocking: true,
    });

    // --- Toko ---------------------------------------------------------------
    const store = seller.stores[0];
    checks.push({
      code: 'STORE_PROFILE',
      label: 'Profil toko',
      status: store ? 'PASS' : 'FAIL',
      detail: store
        ? `Toko "${store.storeName}" sudah dibuat.`
        : 'Buat profil toko beserta nama dan alamat URL-nya.',
      blocking: seller.program.requiresStoreProfile,
    });

    if (seller.program.requiresShippingOrigin) {
      const hasOrigin = Boolean(store?.shippingOriginRef);
      checks.push({
        code: 'SHIPPING_ORIGIN',
        label: 'Alamat asal pengiriman',
        status: hasOrigin ? 'PASS' : 'FAIL',
        detail: hasOrigin
          ? 'Alamat asal pengiriman sudah ditentukan.'
          : 'Tentukan alamat asal pengiriman agar ongkos kirim dapat dihitung.',
        blocking: true,
      });
    }

    if (seller.program.requiresReturnPolicy) {
      const returnPolicy = store
        ? await this.prisma.marketplaceStorePolicy.findFirst({
            where: { storeId: store.id, policyType: 'RETURN', publishedAt: { not: null }, deletedAt: null },
          })
        : null;
      checks.push({
        code: 'RETURN_POLICY',
        label: 'Kebijakan retur',
        status: returnPolicy ? 'PASS' : 'FAIL',
        detail: returnPolicy
          ? 'Kebijakan retur sudah diterbitkan.'
          : 'Terbitkan kebijakan retur; pembeli berhak mengetahuinya sebelum memesan.',
        blocking: true,
      });
    }

    // --- Tenant sudah diprovision ------------------------------------------
    checks.push({
      code: 'TENANT_SCHEMA',
      label: 'Data tenant siap',
      status: registry ? 'PASS' : 'FAIL',
      detail: registry
        ? 'Schema tenant sudah tersedia.'
        : 'Tenant belum selesai diprovision. Hubungi dukungan.',
      blocking: true,
    });

    // --- Produk layak publikasi --------------------------------------------
    // Diperiksa sekarang karena `product` sudah ada sejak Versi 5; jumlah gambar
    // baru dapat diperiksa pada V9-4 ketika media listing tersedia.
    let activeProducts = 0;
    if (registry) {
      const rows = await this.tenantDb.query<{ n: string }>(
        registry.schemaName,
        `SELECT count(*)::text AS n FROM product WHERE is_active AND deleted_at IS NULL`,
      );
      activeProducts = Number(rows[0]?.n ?? 0);
    }
    checks.push({
      code: 'ACTIVE_PRODUCT',
      label: 'Produk aktif',
      status: activeProducts > 0 ? 'PASS' : 'FAIL',
      detail:
        activeProducts > 0
          ? `${activeProducts} produk aktif tersedia untuk dijadikan listing.`
          : 'Belum ada produk aktif. Tambahkan produk sebelum membuat listing online.',
      blocking: true,
    });

    // --- Yang menunggu fase berikutnya -------------------------------------
    // Dinyatakan apa adanya. Melaporkannya PASS akan membuat tenant mengira
    // sudah siap padahal kapabilitasnya belum ada.
    checks.push({
      code: 'PAYMENT_ACCOUNT',
      label: 'Akun eSmartlink aktif',
      status: 'PENDING_PHASE',
      detail: 'Aktivasi akun pembayaran belum tersedia pada versi ini.',
      availableIn: 'V9-2',
      blocking: seller.program.requiresPaymentAccount,
    });
    checks.push({
      code: 'LISTING_IMAGES',
      label: `Produk dengan minimal ${seller.program.minimumListingImages} gambar`,
      status: 'PENDING_PHASE',
      detail: 'Listing dan media produk belum tersedia pada versi ini.',
      availableIn: 'V9-4',
      blocking: true,
    });

    const blocking = checks.filter((c) => c.blocking);
    const profileChecks = ['SELLER_CONTACT', 'STORE_PROFILE', 'SHIPPING_ORIGIN', 'RETURN_POLICY'];

    return {
      checkedAt: new Date().toISOString(),
      profileComplete: checks
        .filter((c) => profileChecks.includes(c.code) && c.blocking)
        .every((c) => c.status === 'PASS'),
      paymentAccountReady: false,
      activationTicketOpen: false,
      readyForReview: blocking.every((c) => c.status === 'PASS'),
      checks,
    };
  }
}
