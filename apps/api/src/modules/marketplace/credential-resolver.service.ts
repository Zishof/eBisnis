import { Injectable, Logger } from '@nestjs/common';
import { ProviderEnvironment, TenantPaymentAccountStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecretBoxService } from '../../infrastructure/crypto/secret-box.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/**
 * Satu-satunya jalan membuka credential provider.
 *
 * Dibuat sebagai layanan tersendiri agar seluruh pembukaan rahasia melewati satu
 * pintu yang mencatat. Bila setiap adapter membuka sendiri, pertanyaan "berapa
 * kali credential seller ini dibaca hari ini" tidak dapat dijawab.
 *
 * Aturan yang ditegakkan di sini:
 *
 *   hanya akun berstatus ACTIVE atau TESTING yang credential-nya dapat dibuka
 *   hanya versi yang masih aktif
 *   setiap pembukaan tercatat, termasuk yang gagal
 *   nilai tidak pernah dikembalikan ke lapisan HTTP
 */

/** Alasan pembukaan credential. Dicatat apa adanya pada log akses. */
export type CredentialPurpose =
  | 'CREATE_ORDER'
  | 'INQUIRY'
  | 'HEALTH_CHECK'
  | 'ROTATION'
  | 'RECONCILIATION';

export interface ResolvedCredentials {
  accountId: string;
  environment: ProviderEnvironment;
  merchantId: string | null;
  /** Nilai rahasia per kode field. Tidak boleh diteruskan ke respons HTTP. */
  secrets: Record<string, string>;
}

export interface ResolveContext {
  purpose: CredentialPurpose;
  actorId?: string | null;
  requestId?: string | null;
}

/** Status akun yang credential-nya boleh dibuka. */
const USABLE_STATUSES: readonly TenantPaymentAccountStatus[] = [
  TenantPaymentAccountStatus.ACTIVE,
  TenantPaymentAccountStatus.TESTING,
];

@Injectable()
export class CredentialResolverService {
  private readonly logger = new Logger(CredentialResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly secretBox: SecretBoxService,
  ) {}

  /**
   * Membuka seluruh credential aktif milik satu akun.
   *
   * Akun yang belum aktif ditolak dengan alasan yang menyebut statusnya, sebab
   * "credential tidak ditemukan" untuk akun yang sebenarnya belum diaktifkan
   * membuat operator mencari di tempat yang salah.
   */
  async resolveForAccount(accountId: string, ctx: ResolveContext): Promise<ResolvedCredentials> {
    const account = await this.prisma.tenantPaymentProviderAccount.findUnique({
      where: { id: accountId },
      include: {
        credentialVersions: { where: { isActive: true }, orderBy: { version: 'desc' } },
      },
    });

    if (!account || account.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Akun provider pembayaran tidak ditemukan.');
    }
    if (!USABLE_STATUSES.includes(account.status)) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Akun provider berstatus ${account.status} sehingga credential-nya tidak dapat dipakai.`,
        { accountId, status: account.status },
      );
    }
    if (account.credentialVersions.length === 0) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Akun provider belum memiliki credential aktif.',
        { accountId },
      );
    }

    const secrets: Record<string, string> = {};
    const seen = new Set<string>();

    for (const version of account.credentialVersions) {
      // Versi diurutkan menurun, sehingga yang pertama ditemui adalah yang
      // terbaru untuk setiap field.
      if (seen.has(version.fieldCode)) continue;
      seen.add(version.fieldCode);

      let opened: string;
      try {
        opened = this.secretBox.open(version.ciphertext);
      } catch (error) {
        await this.recordAccess(version.id, ctx, false);
        this.logger.error(
          `Gagal membuka credential ${version.fieldCode} pada akun ${accountId}: ` +
            (error instanceof Error ? error.message : 'sebab tidak diketahui'),
        );
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          `Credential "${version.fieldCode}" tidak dapat dibuka. Masukkan ulang credential akun ini.`,
          { accountId, fieldCode: version.fieldCode },
        );
      }

      await this.recordAccess(version.id, ctx, true);
      secrets[version.fieldCode] = opened;
    }

    return {
      accountId: account.id,
      environment: account.environment,
      merchantId: account.merchantId,
      secrets,
    };
  }

  /**
   * Akun yang berlaku untuk satu tenant pada satu environment.
   *
   * Precedence yang dijanjikan dokumen Versi 9 — konfigurasi toko, lalu akun
   * tenant, lalu fallback platform — baru memiliki dua tingkat pertama. Fallback
   * platform **tidak** dibuat: memakai credential platform untuk pesanan seller
   * berarti uang pembeli masuk ke rekening yang salah.
   */
  async resolveForTenant(
    tenantId: string,
    providerCode: string,
    environment: ProviderEnvironment,
    ctx: ResolveContext,
  ): Promise<ResolvedCredentials> {
    const account = await this.prisma.tenantPaymentProviderAccount.findFirst({
      where: {
        tenantId,
        environment,
        deletedAt: null,
        provider: { code: providerCode },
      },
    });

    if (!account) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Tenant ini belum memiliki akun ${providerCode} pada environment ${environment}.`,
        { tenantId, providerCode, environment },
      );
    }

    return this.resolveForAccount(account.id, ctx);
  }

  /** Versi credential yang masih memakai kunci enkripsi lama. */
  async findVersionsNeedingRotation(): Promise<
    Array<{ accountId: string; fieldCode: string; keyId: string }>
  > {
    if (!this.secretBox.isConfigured) return [];
    const versions = await this.prisma.paymentProviderCredentialVersion.findMany({
      where: { isActive: true },
      select: { accountId: true, fieldCode: true, keyId: true, ciphertext: true },
    });
    return versions
      .filter((v) => this.secretBox.needsRotation(v.ciphertext))
      .map(({ accountId, fieldCode, keyId }) => ({ accountId, fieldCode, keyId }));
  }

  /**
   * Mencatat pembukaan credential.
   *
   * Kegagalan pencatatan tidak menghentikan operasi, tetapi dicatat sebagai
   * error — kehilangan satu baris log lebih baik daripada menggagalkan
   * pembayaran, dan keduanya harus terlihat.
   */
  private async recordAccess(
    credentialVersionId: string,
    ctx: ResolveContext,
    succeeded: boolean,
  ): Promise<void> {
    try {
      await this.prisma.paymentCredentialAccessLog.create({
        data: {
          credentialVersionId,
          purpose: ctx.purpose,
          actorId: ctx.actorId ?? null,
          requestId: ctx.requestId ?? null,
          succeeded,
        },
      });
    } catch (error) {
      this.logger.error(
        `Gagal mencatat akses credential: ${error instanceof Error ? error.message : 'tidak diketahui'}`,
      );
    }
  }
}
