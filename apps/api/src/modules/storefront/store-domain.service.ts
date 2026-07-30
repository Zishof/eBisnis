import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';
import {
  MarketplaceDomainStatus,
  MarketplaceDomainType,
  MarketplaceDomainVerificationMethod,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { normalizeHost } from './host.util';

/**
 * Pendaftaran dan verifikasi domain toko.
 *
 * Verifikasi bukan formalitas. Tanpanya, tenant A dapat mendaftarkan
 * `tokojoni.com` milik tenant B dan menerima lalu lintasnya — termasuk pesanan
 * dan pembayaran yang ditujukan kepada B.
 *
 * Dua metode disediakan karena keduanya gagal pada keadaan berbeda: DNS TXT
 * bekerja sebelum situs mengarah ke platform, sedangkan berkas HTTP bekerja
 * ketika pemilik tidak memegang kendali DNS.
 */

/** Awalan subdomain tempat TXT record dipasang. */
const DNS_PREFIX = '_ebisnis-verify';
/** Jalur berkas verifikasi. */
const HTTP_PATH = '/.well-known/ebisnis-verification.txt';
/** Awalan token agar isinya jelas asal-usulnya bagi pemilik domain. */
const TOKEN_PREFIX = 'ebisnis-verify';
/** Batas percobaan gagal berturut-turut sebelum domain ditandai FAILED. */
const MAX_FAILED_ATTEMPTS = 10;
/** Batas waktu pengambilan berkas verifikasi. */
const HTTP_TIMEOUT_MS = 5000;

export interface DomainActor {
  userId: string;
  username: string;
  requestId?: string;
}

export interface VerificationInstruction {
  method: MarketplaceDomainVerificationMethod;
  /** Nama record atau jalur yang harus dibuat pemilik. */
  target: string;
  /** Nilai yang harus dipasang. */
  value: string;
  hint: string;
}

@Injectable()
export class StoreDomainService {
  private readonly logger = new Logger(StoreDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Mendaftarkan domain untuk satu toko.
   *
   * Host dinormalkan lebih dulu, sehingga "Toko.com." dan "toko.com:443" tidak
   * menjadi dua pendaftaran berbeda yang keduanya lolos batasan unik.
   */
  async register(
    storeId: string,
    rawHost: string,
    options: { method?: MarketplaceDomainVerificationMethod; isPrimary?: boolean },
    actor: DomainActor,
  ) {
    const normalized = normalizeHost(rawHost);
    if (!normalized.ok) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Domain tidak valid: ${normalized.reason}`,
      );
    }
    const host = normalized.host!;

    const store = await this.prisma.marketplaceStore.findUnique({
      where: { id: storeId },
      include: { seller: { select: { tenantId: true } } },
    });
    if (!store || store.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Toko tidak ditemukan.');
    }

    // Satu host hanya boleh dimiliki satu toko. Diperiksa di sini agar pesannya
    // dapat dijelaskan; batasan unik pada basis data tetap menjadi penjaga
    // terakhir bila dua permintaan datang bersamaan.
    const existing = await this.prisma.marketplaceStoreDomain.findFirst({
      where: { host, deletedAt: null },
    });
    if (existing) {
      if (existing.storeId === storeId) {
        return this.load(existing.id);
      }
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Domain "${host}" sudah terdaftar pada toko lain. ` +
          'Bila Anda pemiliknya, hubungi dukungan untuk pemindahan.',
      );
    }

    const domain = await this.prisma.marketplaceStoreDomain.create({
      data: {
        storeId,
        host,
        domainType: MarketplaceDomainType.CUSTOM,
        status: MarketplaceDomainStatus.PENDING_VERIFICATION,
        verificationToken: `${TOKEN_PREFIX}-${randomBytes(24).toString('hex')}`,
        verificationMethod: options.method ?? MarketplaceDomainVerificationMethod.DNS_TXT,
        isPrimary: options.isPrimary ?? false,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'STORE_DOMAIN_REGISTERED',
      entityType: 'marketplace_store_domain',
      entityId: domain.id,
      tenantId: store.seller.tenantId,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
      metadata: { host },
    });

    return this.load(domain.id);
  }

  /** Petunjuk yang ditampilkan kepada pemilik domain. */
  instructionFor(domain: {
    host: string;
    verificationToken: string;
    verificationMethod: MarketplaceDomainVerificationMethod;
  }): VerificationInstruction {
    if (domain.verificationMethod === MarketplaceDomainVerificationMethod.HTTP_FILE) {
      return {
        method: MarketplaceDomainVerificationMethod.HTTP_FILE,
        target: `https://${domain.host}${HTTP_PATH}`,
        value: domain.verificationToken,
        hint:
          'Buat berkas teks pada alamat tersebut yang isinya hanya token di atas, ' +
          'tanpa tanda kutip dan tanpa baris tambahan.',
      };
    }
    return {
      method: MarketplaceDomainVerificationMethod.DNS_TXT,
      target: `${DNS_PREFIX}.${domain.host}`,
      value: domain.verificationToken,
      hint:
        'Tambahkan TXT record pada nama tersebut dengan nilai token di atas. ' +
        'Perubahan DNS dapat memerlukan waktu hingga beberapa jam untuk menyebar.',
    };
  }

  /**
   * Memeriksa kepemilikan.
   *
   * Setiap percobaan dicatat, berhasil maupun gagal: verifikasi yang gagal
   * berkali-kali adalah sinyal — entah pemilik salah memasang, atau seseorang
   * mencoba mengklaim domain orang lain.
   */
  async verify(domainId: string, actor: DomainActor) {
    const domain = await this.prisma.marketplaceStoreDomain.findUnique({
      where: { id: domainId },
      include: { store: { include: { seller: { select: { tenantId: true } } } } },
    });
    if (!domain || domain.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Domain tidak ditemukan.');
    }
    if (domain.revokedAt) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Domain sudah dicabut dan tidak dapat diverifikasi.',
      );
    }

    const check =
      domain.verificationMethod === MarketplaceDomainVerificationMethod.HTTP_FILE
        ? await this.checkHttpFile(domain.host, domain.verificationToken)
        : await this.checkDnsTxt(domain.host, domain.verificationToken);

    await this.prisma.marketplaceDomainVerificationAttempt.create({
      data: {
        domainId,
        method: domain.verificationMethod,
        succeeded: check.succeeded,
        foundValue: check.found ?? null,
        message: check.message,
        actorId: actor.userId,
        requestId: actor.requestId ?? null,
      },
    });

    const failedAttempts = check.succeeded ? 0 : domain.failedAttempts + 1;
    const status = check.succeeded
      ? MarketplaceDomainStatus.VERIFIED
      : failedAttempts >= MAX_FAILED_ATTEMPTS
        ? MarketplaceDomainStatus.FAILED
        : MarketplaceDomainStatus.PENDING_VERIFICATION;

    await this.prisma.marketplaceStoreDomain.update({
      where: { id: domainId },
      data: {
        status,
        failedAttempts,
        lastCheckedAt: new Date(),
        lastCheckError: check.succeeded ? null : check.message,
        ...(check.succeeded ? { verifiedAt: new Date(), verifiedBy: actor.userId } : {}),
        updatedBy: actor.userId,
      },
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: check.succeeded ? 'STORE_DOMAIN_VERIFIED' : 'STORE_DOMAIN_VERIFY_FAILED',
      entityType: 'marketplace_store_domain',
      entityId: domainId,
      tenantId: domain.store.seller.tenantId,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
      metadata: { host: domain.host, method: domain.verificationMethod },
    });

    if (!check.succeeded) {
      this.logger.warn(
        `Verifikasi domain ${domain.host} gagal (${failedAttempts}/${MAX_FAILED_ATTEMPTS}): ${check.message}`,
      );
    }

    return this.load(domainId);
  }

  /**
   * Menjadikan satu domain sebagai domain utama.
   *
   * Domain lain pada toko yang sama otomatis bukan utama lagi, karena dua
   * domain utama membuat alamat kanonik tidak dapat ditentukan.
   */
  async setPrimary(domainId: string, actor: DomainActor) {
    const domain = await this.prisma.marketplaceStoreDomain.findUnique({ where: { id: domainId } });
    if (!domain || domain.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Domain tidak ditemukan.');
    }
    if (!domain.verifiedAt) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Hanya domain yang sudah terverifikasi dapat dijadikan domain utama.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.marketplaceStoreDomain.updateMany({
        where: { storeId: domain.storeId, isPrimary: true },
        data: { isPrimary: false, updatedBy: actor.userId },
      }),
      this.prisma.marketplaceStoreDomain.update({
        where: { id: domainId },
        data: { isPrimary: true, status: MarketplaceDomainStatus.ACTIVE, updatedBy: actor.userId },
      }),
    ]);

    return this.load(domainId);
  }

  /** Mencabut domain. Pencabutan tidak menghapus riwayat verifikasinya. */
  async revoke(domainId: string, reason: string, actor: DomainActor) {
    const domain = await this.prisma.marketplaceStoreDomain.findUnique({
      where: { id: domainId },
      include: { store: { include: { seller: { select: { tenantId: true } } } } },
    });
    if (!domain || domain.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Domain tidak ditemukan.');
    }

    await this.prisma.marketplaceStoreDomain.update({
      where: { id: domainId },
      data: {
        status: MarketplaceDomainStatus.REVOKED,
        revokedAt: new Date(),
        revokedBy: actor.userId,
        revokeReason: reason,
        isPrimary: false,
        updatedBy: actor.userId,
      },
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'STORE_DOMAIN_REVOKED',
      entityType: 'marketplace_store_domain',
      entityId: domainId,
      tenantId: domain.store.seller.tenantId,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
      metadata: { host: domain.host, reason },
    });

    return this.load(domainId);
  }

  async listForStore(storeId: string) {
    return this.prisma.marketplaceStoreDomain.findMany({
      where: { storeId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      include: { attempts: { orderBy: { occurredAt: 'desc' }, take: 5 } },
    });
  }

  async load(domainId: string) {
    const domain = await this.prisma.marketplaceStoreDomain.findUniqueOrThrow({
      where: { id: domainId },
      include: { attempts: { orderBy: { occurredAt: 'desc' }, take: 5 } },
    });
    return { ...domain, instruction: this.instructionFor(domain) };
  }

  // -------------------------------------------------------------------------
  // Pemeriksaan
  // -------------------------------------------------------------------------

  /** Mencari token pada TXT record. */
  private async checkDnsTxt(
    host: string,
    token: string,
  ): Promise<{ succeeded: boolean; found?: string; message: string }> {
    const name = `${DNS_PREFIX}.${host}`;
    try {
      const records = await dns.resolveTxt(name);
      // Satu TXT record dapat terpecah menjadi beberapa potongan; keduanya
      // digabung sebelum dibandingkan.
      const values = records.map((chunks) => chunks.join('').trim());
      const match = values.find((v) => v === token);
      if (match) {
        return { succeeded: true, found: match, message: 'TXT record cocok.' };
      }
      return {
        succeeded: false,
        found: values.join(' | ').slice(0, 500),
        message:
          values.length === 0
            ? `Tidak ada TXT record pada ${name}.`
            : `TXT record ditemukan tetapi nilainya tidak cocok.`,
      };
    } catch (error) {
      const code = (error as { code?: string }).code;
      return {
        succeeded: false,
        message:
          code === 'ENOTFOUND' || code === 'ENODATA'
            ? `Tidak ada TXT record pada ${name}. Perubahan DNS dapat memerlukan beberapa jam.`
            : `Pemeriksaan DNS gagal: ${code ?? (error as Error).message}`,
      };
    }
  }

  /** Mencari token pada berkas `.well-known`. */
  private async checkHttpFile(
    host: string,
    token: string,
  ): Promise<{ succeeded: boolean; found?: string; message: string }> {
    const url = `https://${host}${HTTP_PATH}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'error', // Pengalihan dapat menunjuk ke situs lain.
        headers: { Accept: 'text/plain' },
      });
      if (!response.ok) {
        return { succeeded: false, message: `Berkas verifikasi menjawab ${response.status}.` };
      }
      // Batasi bacaan: berkas verifikasi hanya berisi satu token.
      const text = (await response.text()).slice(0, 1000).trim();
      if (text === token) {
        return { succeeded: true, found: text, message: 'Berkas verifikasi cocok.' };
      }
      return {
        succeeded: false,
        found: text.slice(0, 200),
        message: 'Berkas verifikasi ditemukan tetapi isinya tidak cocok.',
      };
    } catch (error) {
      return {
        succeeded: false,
        message: `Berkas verifikasi tidak dapat diambil: ${(error as Error).message}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
