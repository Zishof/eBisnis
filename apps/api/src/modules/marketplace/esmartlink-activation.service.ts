import { Injectable, Logger } from '@nestjs/common';
import {
  MarketplaceEnrollmentStatus,
  Prisma,
  ProviderEnvironment,
  SupportTicketStatus,
  SupportTicketType,
  TenantPaymentAccountStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { SecretBoxService } from '../../infrastructure/crypto/secret-box.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { CredentialResolverService } from './credential-resolver.service';
import {
  EsmartlinkMerchantOnboardingProvider,
  type PaymentMerchantOnboardingProvider,
} from './payment-onboarding.provider';
import { MarketplaceEnrollmentService, type EnrollmentActor } from './marketplace-enrollment.service';

/** Field credential yang diminta eSmartlink. Bukan nilainya — hanya namanya. */
export const ESMARTLINK_CREDENTIAL_FIELDS = ['MERCHANT_KEY', 'SECRET_KEY'] as const;
export type EsmartlinkCredentialField = (typeof ESMARTLINK_CREDENTIAL_FIELDS)[number];

/** Kapabilitas yang dicatat saat akun dibuat. */
const DEFAULT_CAPABILITIES: Array<{ code: string; supported: boolean; note: string }> = [
  { code: 'CREATE_ORDER', supported: true, note: 'Terbukti pada integrasi Versi 5.' },
  { code: 'INQUIRY_ORDER', supported: true, note: 'Terbukti pada integrasi Versi 5.' },
  { code: 'CALLBACK', supported: true, note: 'Terbukti pada integrasi Versi 5.' },
  {
    code: 'REFUND',
    supported: false,
    note: 'Tidak ada API refund terdokumentasi. Refund berjalan manual dengan bukti dan rekonsiliasi.',
  },
  {
    code: 'SPLIT_SETTLEMENT',
    supported: false,
    note: 'Tidak ada bukti dukungan split settlement. Checkout multi-seller membuat satu payment order per seller.',
  },
];

@Injectable()
export class EsmartlinkActivationService {
  private readonly logger = new Logger(EsmartlinkActivationService.name);
  private readonly onboarding: PaymentMerchantOnboardingProvider =
    new EsmartlinkMerchantOnboardingProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly secretBox: SecretBoxService,
    private readonly credentials: CredentialResolverService,
    private readonly enrollment: MarketplaceEnrollmentService,
    private readonly audit: AuditService,
  ) {}

  /** Mode onboarding yang berlaku, untuk ditampilkan pada UI. */
  capability() {
    return this.onboarding.checkCapability();
  }

  /**
   * Membuat akun provider beserta tiket aktivasinya.
   *
   * Idempoten pada dua tingkat: batasan unik `(tenantId, providerId, environment)`
   * mencegah akun kedua, dan tiket terbuka yang sudah ada dikembalikan alih-alih
   * dibuat ulang. Tanpa yang kedua, tenant yang menekan tombol dua kali membuat
   * antrean dukungan terisi tiket kembar.
   */
  async requestActivation(
    tenantId: string,
    input: { environment?: ProviderEnvironment; label?: string; note?: string },
    actor: EnrollmentActor,
  ) {
    const environment = input.environment ?? ProviderEnvironment.SANDBOX;
    const provider = await this.prisma.paymentProvider.findFirst({
      where: { code: 'ESMARTLINK', deletedAt: null },
    });
    if (!provider) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Provider eSmartlink belum terdaftar pada platform.',
      );
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const account = await this.prisma.tenantPaymentProviderAccount.upsert({
      where: {
        tenantId_providerId_environment: { tenantId, providerId: provider.id, environment },
      },
      update: {},
      create: {
        tenantId,
        providerId: provider.id,
        environment,
        accountCode: `PAY-${tenant.code.toUpperCase()}-${environment}`.slice(0, 60),
        label: input.label ?? `eSmartlink ${environment} — ${tenant.name}`,
        status: TenantPaymentAccountStatus.AWAITING_CREDENTIAL,
        createdBy: actor.userId,
        updatedBy: actor.userId,
        capabilities: {
          create: DEFAULT_CAPABILITIES.map((c) => ({
            capabilityCode: c.code,
            isSupported: c.supported,
            evidence: c.supported ? 'TESTED' : 'PROVIDER_DOC',
            note: c.note,
          })),
        },
      },
    });

    // Tiket yang masih terbuka dipakai ulang.
    const openTicket = await this.prisma.supportTicket.findFirst({
      where: {
        tenantId,
        ticketType: SupportTicketType.ESMARTLINK_ACCOUNT_ACTIVATION,
        status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.CANCELLED] },
        deletedAt: null,
        accountLinks: { some: { accountId: account.id } },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (openTicket) {
      return { account: await this.loadAccount(account.id), ticket: openTicket, reused: true };
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          ticketNumber: await this.nextTicketNumber(tx),
          tenantId,
          ticketType: SupportTicketType.ESMARTLINK_ACCOUNT_ACTIVATION,
          status: SupportTicketStatus.OPEN,
          subject: `Aktivasi akun eSmartlink ${environment} — ${tenant.name}`,
          // Isi tiket sengaja tidak meminta credential dikirim sebagai balasan.
          body:
            `Permintaan aktivasi akun pembayaran eSmartlink untuk tenant "${tenant.name}".\n\n` +
            `Environment: ${environment}\n` +
            `Kode akun: ${account.accountCode}\n\n` +
            (input.note ? `Catatan tenant:\n${input.note}\n\n` : '') +
            'PENTING: jangan mengirim credential melalui balasan tiket ini. ' +
            'Credential dimasukkan melalui formulir aman pada Pusat Aktivasi Marketplace.',
          requestedBy: actor.userId,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      });
      await tx.supportTicketTransition.create({
        data: {
          ticketId: created.id,
          fromStatus: null,
          toStatus: SupportTicketStatus.OPEN,
          reason: 'Tiket aktivasi dibuat.',
          actorId: actor.userId,
          requestId: actor.requestId ?? null,
        },
      });
      await tx.paymentProviderActivationTicketLink.create({
        data: { ticketId: created.id, accountId: account.id, createdBy: actor.userId },
      });
      return created;
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'ESMARTLINK_ACTIVATION_REQUESTED',
      entityType: 'tenant_payment_provider_account',
      entityId: account.id,
      documentNumber: ticket.ticketNumber,
      tenantId,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
    });

    // Pendaftaran marketplace mengikuti: tiket sudah terbuka.
    await this.syncEnrollment(tenantId, MarketplaceEnrollmentStatus.ACTIVATION_TICKET_OPENED, actor);

    return { account: await this.loadAccount(account.id), ticket, reused: false };
  }

  /**
   * Menyimpan credential.
   *
   * Nilai lama tidak ditimpa: versi baru dibuat dan versi sebelumnya
   * dinonaktifkan. Rotasi yang menimpa membuat kesalahan tidak dapat dibatalkan,
   * dan credential yang salah hanya ketahuan saat pembayaran pertama gagal.
   *
   * Yang dikembalikan hanyalah petunjuk empat karakter — tidak pernah nilainya.
   */
  async setCredentials(
    accountId: string,
    values: Partial<Record<EsmartlinkCredentialField, string>>,
    actor: EnrollmentActor,
  ) {
    if (!this.secretBox.isConfigured) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Enkripsi credential belum dikonfigurasi pada server ini.',
      );
    }

    const account = await this.prisma.tenantPaymentProviderAccount.findUnique({
      where: { id: accountId },
    });
    if (!account || account.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Akun provider tidak ditemukan.');
    }

    const entries = Object.entries(values).filter(([, v]) => typeof v === 'string' && v.length > 0);
    if (entries.length === 0) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Tidak ada credential yang diisi.');
    }

    const stored: Array<{ fieldCode: string; version: number; hint: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const [fieldCode, plaintext] of entries) {
        const sealed = this.secretBox.seal(plaintext as string);
        const latest = await tx.paymentProviderCredentialVersion.findFirst({
          where: { accountId, fieldCode },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const nextVersion = (latest?.version ?? 0) + 1;

        await tx.paymentProviderCredentialVersion.updateMany({
          where: { accountId, fieldCode, isActive: true },
          data: { isActive: false, retiredAt: new Date(), retiredBy: actor.userId, retireReason: 'Digantikan versi baru.' },
        });
        await tx.paymentProviderCredentialVersion.create({
          data: {
            accountId,
            fieldCode,
            version: nextVersion,
            ciphertext: sealed.ciphertext,
            keyId: sealed.keyId,
            hint: sealed.hint,
            createdBy: actor.userId,
          },
        });
        stored.push({ fieldCode, version: nextVersion, hint: sealed.hint });
      }

      await tx.tenantPaymentProviderAccount.update({
        where: { id: accountId },
        data: {
          status:
            account.status === TenantPaymentAccountStatus.ACTIVE
              ? TenantPaymentAccountStatus.ACTIVE
              : TenantPaymentAccountStatus.CREDENTIAL_SET,
          updatedBy: actor.userId,
        },
      });
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'ESMARTLINK_CREDENTIAL_SET',
      entityType: 'tenant_payment_provider_account',
      entityId: accountId,
      tenantId: account.tenantId,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
      // Hanya nama field dan versinya. Nilai tidak pernah masuk audit.
      metadata: { fields: stored.map((s) => ({ fieldCode: s.fieldCode, version: s.version })) },
    });

    await this.syncEnrollment(
      account.tenantId,
      MarketplaceEnrollmentStatus.CREDENTIAL_CONFIGURED,
      actor,
    );

    this.logger.log(`Credential akun ${accountId} diperbarui: ${stored.map((s) => s.fieldCode).join(', ')}`);
    return { accountId, stored };
  }

  /**
   * Menjalankan uji kesehatan.
   *
   * Uji dicatat sebelum dijalankan sehingga percobaan yang menggantung pun
   * terlihat. Yang dicatat pada ringkasan hanya nama field yang dipakai, bukan
   * nilainya — uji pun tidak boleh menyimpan rahasia dalam bentuk terbaca.
   */
  async runHealthCheck(accountId: string, checkType: string, actor: EnrollmentActor) {
    const account = await this.prisma.tenantPaymentProviderAccount.findUnique({
      where: { id: accountId },
      include: { provider: { select: { code: true, baseUrl: true } } },
    });
    if (!account || account.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Akun provider tidak ditemukan.');
    }

    const check = await this.prisma.paymentProviderHealthCheck.create({
      data: {
        accountId,
        checkType,
        status: 'PENDING',
        actorId: actor.userId,
        requestId: actor.requestId ?? null,
      },
    });

    const startedAt = Date.now();
    let status: 'PASSED' | 'FAILED' = 'FAILED';
    let message: string;
    let fieldsPresent: string[] = [];

    try {
      // Akun berstatus CREDENTIAL_SET dinaikkan ke TESTING supaya resolver
      // mengizinkan pembukaan tanpa harus mengaktifkannya lebih dulu.
      if (account.status === TenantPaymentAccountStatus.CREDENTIAL_SET) {
        await this.prisma.tenantPaymentProviderAccount.update({
          where: { id: accountId },
          data: { status: TenantPaymentAccountStatus.TESTING, updatedBy: actor.userId },
        });
      }

      const resolved = await this.credentials.resolveForAccount(accountId, {
        purpose: 'HEALTH_CHECK',
        actorId: actor.userId,
        requestId: actor.requestId,
      });
      fieldsPresent = Object.keys(resolved.secrets);

      const missing = ESMARTLINK_CREDENTIAL_FIELDS.filter((f) => !fieldsPresent.includes(f));
      if (missing.length > 0) {
        message = `Credential belum lengkap. Belum diisi: ${missing.join(', ')}.`;
      } else if (!account.provider.baseUrl) {
        // Tidak mengarang panggilan ke URL yang tidak ada.
        message =
          'Credential lengkap dan dapat dibuka, tetapi baseUrl provider belum diset ' +
          'sehingga panggilan ke provider tidak dijalankan.';
      } else {
        status = 'PASSED';
        message = `Credential lengkap dan dapat dibuka (${fieldsPresent.join(', ')}).`;
      }
    } catch (error) {
      message = error instanceof Error ? error.message : 'Uji gagal tanpa keterangan.';
    }

    const finished = await this.prisma.paymentProviderHealthCheck.update({
      where: { id: check.id },
      data: {
        status,
        message,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
        requestSummary: { checkType, fieldsUsed: fieldsPresent },
        responseSummary: { status, message },
      },
    });

    await this.prisma.tenantPaymentProviderAccount.update({
      where: { id: accountId },
      data: { lastHealthCheckAt: new Date(), lastHealthCheckStatus: status },
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: `ESMARTLINK_HEALTH_${status}`,
      entityType: 'tenant_payment_provider_account',
      entityId: accountId,
      tenantId: account.tenantId,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
      metadata: { checkType, status },
    });

    if (status === 'PASSED') {
      await this.syncEnrollment(account.tenantId, MarketplaceEnrollmentStatus.PAYMENT_TESTING, actor);
    }

    return finished;
  }

  /**
   * Mengaktifkan akun.
   *
   * Menuntut uji yang lulus lebih dulu. Mengaktifkan tanpa uji berarti kegagalan
   * pertama ditanggung pembeli, bukan penguji.
   */
  async activate(accountId: string, actor: EnrollmentActor) {
    const account = await this.prisma.tenantPaymentProviderAccount.findUnique({
      where: { id: accountId },
      include: {
        healthChecks: { where: { status: 'PASSED' }, orderBy: { startedAt: 'desc' }, take: 1 },
      },
    });
    if (!account || account.deletedAt) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Akun provider tidak ditemukan.');
    }
    if (account.healthChecks.length === 0) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Akun belum pernah lulus uji kesehatan. Jalankan uji terlebih dahulu.',
        { accountId },
      );
    }

    await this.prisma.tenantPaymentProviderAccount.update({
      where: { id: accountId },
      data: {
        status: TenantPaymentAccountStatus.ACTIVE,
        activatedAt: new Date(),
        activatedBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    // Tiket aktivasi yang masih terbuka ditutup.
    await this.prisma.supportTicket.updateMany({
      where: {
        accountLinks: { some: { accountId } },
        status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.CANCELLED] },
      },
      data: {
        status: SupportTicketStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'ESMARTLINK_ACCOUNT_ACTIVATED',
      entityType: 'tenant_payment_provider_account',
      entityId: accountId,
      tenantId: account.tenantId,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
    });

    return this.loadAccount(accountId);
  }

  /** Akun beserta metadata yang aman ditampilkan. Tidak memuat nilai rahasia. */
  async loadAccount(accountId: string) {
    const account = await this.prisma.tenantPaymentProviderAccount.findUniqueOrThrow({
      where: { id: accountId },
      include: {
        provider: { select: { code: true, name: true, environment: true } },
        capabilities: { orderBy: { capabilityCode: 'asc' } },
        healthChecks: { orderBy: { startedAt: 'desc' }, take: 5 },
        credentialVersions: {
          where: { isActive: true },
          orderBy: { fieldCode: 'asc' },
          // Hanya kolom yang aman. `ciphertext` sengaja tidak dipilih supaya
          // tidak mungkin ikut terserialisasi ke respons.
          select: { fieldCode: true, version: true, hint: true, keyId: true, activatedAt: true },
        },
        ticketLinks: {
          include: {
            ticket: {
              select: {
                id: true,
                ticketNumber: true,
                status: true,
                subject: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    return account;
  }

  async findAccountForTenant(tenantId: string, environment?: ProviderEnvironment) {
    const account = await this.prisma.tenantPaymentProviderAccount.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        ...(environment ? { environment } : {}),
        provider: { code: 'ESMARTLINK' },
      },
      orderBy: { createdAt: 'desc' },
    });
    return account ? this.loadAccount(account.id) : null;
  }

  /**
   * Menyelaraskan status pendaftaran marketplace.
   *
   * Kegagalan penyelarasan tidak membatalkan aktivasi — transisi yang tidak sah
   * hanya berarti berkas pendaftaran sedang berada di tahap lain, dan itu bukan
   * alasan menggagalkan penyimpanan credential.
   */
  private async syncEnrollment(
    tenantId: string,
    target: MarketplaceEnrollmentStatus,
    actor: EnrollmentActor,
  ): Promise<void> {
    try {
      const seller = await this.enrollment.findByTenant(tenantId);
      if (!seller) return;
      await this.enrollment.transition(seller.id, target, 'Diselaraskan dari aktivasi eSmartlink.', actor);
    } catch (error) {
      this.logger.warn(
        `Status pendaftaran tidak diselaraskan ke ${target}: ` +
          (error instanceof Error ? error.message : 'sebab tidak diketahui'),
      );
    }
  }

  /** Nomor tiket yang berurutan per hari. */
  private async nextTicketNumber(tx: Prisma.TransactionClient): Promise<string> {
    const today = new Date();
    const prefix = `TKT-${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`;
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const count = await tx.supportTicket.count({ where: { createdAt: { gte: startOfDay } } });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
}
