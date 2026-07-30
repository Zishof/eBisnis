import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MarketplaceDomainStatus,
  MarketplaceSellerStatus,
  MarketplaceStoreStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { normalizeHost, normalizeStoreSlug } from './host.util';

/**
 * Menentukan toko mana yang ditampilkan kepada pengunjung, berdasarkan host.
 *
 * Ini adalah satu-satunya tempat host diterjemahkan menjadi konteks tenant, dan
 * karena itu satu-satunya tempat yang dapat membocorkan katalog satu seller
 * kepada pengunjung seller lain.
 *
 * Empat aturan yang menjaganya:
 *
 *   1. Host dinormalkan lebih dulu; nilai mentah tidak pernah dicocokkan.
 *   2. Pencocokan hanya pada domain yang SUDAH TERVERIFIKASI.
 *   3. Host tak dikenal DITOLAK, bukan diarahkan ke tenant bawaan.
 *   4. Nama schema selalu diambil dari registry, tidak pernah dari host.
 *
 * Aturan ketiga yang paling mudah dilanggar tanpa disadari. Mengarahkan host
 * tak dikenal ke "toko bawaan" tampak ramah, tetapi ia berarti setiap kesalahan
 * DNS menampilkan katalog milik orang lain.
 */

export type StorefrontMode = 'MARKETPLACE' | 'SINGLE_STORE';

export interface StorefrontContext {
  mode: StorefrontMode;
  /** Terisi hanya pada mode SINGLE_STORE. */
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
  sellerId?: string;
  tenantId?: string;
  /** Nama schema; SELALU dari registry, tidak pernah diturunkan dari host. */
  schemaName?: string;
  /** Host yang dipakai; sudah dinormalkan. */
  host: string;
  /** Alamat kanonik untuk halaman ini, mencegah konten ganda pada mesin pencari. */
  canonicalHost: string;
}

export interface ResolveFailure {
  ok: false;
  /** Alasan untuk dicatat. Tidak ditampilkan kepada pengunjung. */
  reason: string;
  code: 'INVALID_HOST' | 'UNKNOWN_HOST' | 'NOT_VERIFIED' | 'STORE_UNAVAILABLE';
}

export type ResolveResult = ({ ok: true } & StorefrontContext) | ResolveFailure;

/** Status toko yang boleh dilayani kepada publik. */
const SERVEABLE_STORE: readonly MarketplaceStoreStatus[] = [
  MarketplaceStoreStatus.VERIFIED,
  MarketplaceStoreStatus.PUBLISHED,
];

/** Status seller yang tokonya boleh dilayani. */
const SERVEABLE_SELLER: readonly MarketplaceSellerStatus[] = [MarketplaceSellerStatus.ACTIVE];

/** Status domain yang boleh dilayani. */
const SERVEABLE_DOMAIN: readonly MarketplaceDomainStatus[] = [
  MarketplaceDomainStatus.VERIFIED,
  MarketplaceDomainStatus.ACTIVE,
];

@Injectable()
export class StorefrontResolverService {
  private readonly logger = new Logger(StorefrontResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Host marketplace publik, mis. `belanja.ebisnis.id`. */
  get marketplaceHost(): string {
    return (
      this.config.get<string>('marketplace.publicHost') ??
      process.env.MARKETPLACE_PUBLIC_HOST ??
      'belanja.ebisnis.id'
    );
  }

  /**
   * Menentukan konteks dari header host.
   *
   * `pathSlug` diisi ketika permintaan datang ke `belanja.ebisnis.id/toko/<slug>`.
   */
  async resolve(rawHost: string | string[] | undefined, pathSlug?: string): Promise<ResolveResult> {
    const normalized = normalizeHost(rawHost);
    if (!normalized.ok) {
      return { ok: false, code: 'INVALID_HOST', reason: normalized.reason ?? 'Host tidak valid.' };
    }
    const host = normalized.host!;

    // --- Mode marketplace --------------------------------------------------
    if (host === this.marketplaceHost) {
      if (!pathSlug) {
        return { ok: true, mode: 'MARKETPLACE', host, canonicalHost: host };
      }
      return this.resolveBySlug(host, pathSlug);
    }

    // --- Mode toko tunggal lewat custom domain -----------------------------
    return this.resolveByDomain(host);
  }

  /** Menyelesaikan `belanja.ebisnis.id/toko/<slug>`. */
  private async resolveBySlug(host: string, rawSlug: string): Promise<ResolveResult> {
    const slug = normalizeStoreSlug(rawSlug);
    if (!slug.ok) {
      return { ok: false, code: 'INVALID_HOST', reason: slug.reason ?? 'Slug tidak valid.' };
    }

    const store = await this.prisma.marketplaceStore.findFirst({
      where: { storeSlug: slug.host!, deletedAt: null },
      include: { seller: { select: { id: true, tenantId: true, status: true } } },
    });
    if (!store) {
      return { ok: false, code: 'UNKNOWN_HOST', reason: `Toko "${slug.host}" tidak ditemukan.` };
    }

    return this.buildContext(host, host, store, 'SINGLE_STORE');
  }

  /** Menyelesaikan custom domain tenant. */
  private async resolveByDomain(host: string): Promise<ResolveResult> {
    const domain = await this.prisma.marketplaceStoreDomain.findFirst({
      where: { host, deletedAt: null, revokedAt: null },
      include: {
        store: { include: { seller: { select: { id: true, tenantId: true, status: true } } } },
      },
    });

    if (!domain) {
      // Host tak dikenal ditolak. Mengarahkannya ke toko bawaan berarti setiap
      // kesalahan DNS menampilkan katalog milik orang lain.
      return { ok: false, code: 'UNKNOWN_HOST', reason: `Host "${host}" tidak terdaftar.` };
    }

    if (!SERVEABLE_DOMAIN.includes(domain.status) || !domain.verifiedAt) {
      // Domain yang belum terbukti dimiliki tidak dilayani, walau sudah
      // didaftarkan. Tanpa aturan ini, siapa pun dapat mendaftarkan domain
      // orang lain lalu menerima lalu lintasnya.
      return {
        ok: false,
        code: 'NOT_VERIFIED',
        reason: `Domain "${host}" berstatus ${domain.status} dan belum terverifikasi.`,
      };
    }

    // Domain non-primer dilayani, tetapi kanoniknya menunjuk domain utama.
    const canonicalHost = domain.isPrimary
      ? host
      : ((
          await this.prisma.marketplaceStoreDomain.findFirst({
            where: {
              storeId: domain.storeId,
              isPrimary: true,
              deletedAt: null,
              revokedAt: null,
              status: { in: [...SERVEABLE_DOMAIN] },
            },
            select: { host: true },
          })
        )?.host ?? host);

    return this.buildContext(host, canonicalHost, domain.store, 'SINGLE_STORE');
  }

  /**
   * Menyusun konteks setelah toko ditemukan.
   *
   * Pemeriksaan status toko dan seller dilakukan di sini, bukan pada query,
   * supaya alasan penolakannya dapat dibedakan pada log.
   */
  private async buildContext(
    host: string,
    canonicalHost: string,
    store: {
      id: string;
      storeSlug: string;
      storeName: string;
      status: MarketplaceStoreStatus;
      deletedAt: Date | null;
      seller: { id: string; tenantId: string; status: MarketplaceSellerStatus };
    },
    mode: StorefrontMode,
  ): Promise<ResolveResult> {
    if (store.deletedAt || !SERVEABLE_STORE.includes(store.status)) {
      return {
        ok: false,
        code: 'STORE_UNAVAILABLE',
        reason: `Toko "${store.storeSlug}" berstatus ${store.status}.`,
      };
    }
    if (!SERVEABLE_SELLER.includes(store.seller.status)) {
      return {
        ok: false,
        code: 'STORE_UNAVAILABLE',
        reason: `Seller toko "${store.storeSlug}" berstatus ${store.seller.status}.`,
      };
    }

    // Nama schema SELALU dari registry. Menurunkannya dari host adalah cara
    // paling langsung membocorkan data tenant lain.
    const registry = await this.prisma.tenantSchemaRegistry.findFirst({
      where: { tenantId: store.seller.tenantId },
      select: { schemaName: true },
    });
    if (!registry) {
      return {
        ok: false,
        code: 'STORE_UNAVAILABLE',
        reason: `Tenant toko "${store.storeSlug}" belum diprovision.`,
      };
    }

    return {
      ok: true,
      mode,
      host,
      canonicalHost,
      storeId: store.id,
      storeSlug: store.storeSlug,
      storeName: store.storeName,
      sellerId: store.seller.id,
      tenantId: store.seller.tenantId,
      schemaName: registry.schemaName,
    };
  }

  /**
   * Mencatat penolakan.
   *
   * Alasannya dicatat, tidak dikembalikan ke pengunjung: memberi tahu penyerang
   * mengapa tebakannya gagal mempermudah tebakan berikutnya.
   */
  logRejection(result: ResolveFailure, rawHost: unknown): void {
    this.logger.warn(
      `Storefront ditolak (${result.code}): ${result.reason} — host mentah: ${JSON.stringify(rawHost)}`,
    );
  }
}
