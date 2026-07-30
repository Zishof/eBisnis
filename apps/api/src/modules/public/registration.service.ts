import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { SchemaProvisionerService } from '../../infrastructure/provisioning/schema-provisioner.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  RESERVED_SCHEMA_NAMES,
  validateSchemaName,
} from '../../infrastructure/database/schema-name.util';
import { assertPasswordStrength, generateTemporaryPassword } from '../auth/auth.service';

export interface RegistrationInput {
  businessName: string;
  businessType?: string;
  country?: string;
  province?: string;
  cityRegency?: string;
  district?: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  businessPhone?: string;
  email: string;
  desiredUsername: string;
  generatePassword?: boolean;
  password?: string;
  passwordConfirmation?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  localeCode?: string;
}

export interface RegistrationResult {
  status: string;
  registrationId: string;
  tenantId: string;
  username: string;
  schemaName: string;
  auditSchemaName: string;
  loginUrl: string;
  /** Hanya dikembalikan bila dibuat server, dan HANYA pada response pertama. */
  temporaryPassword?: string;
  mustChangePassword: boolean;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly provisioner: SchemaProvisionerService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  getRegistrationConfig() {
    return {
      countries: ['Indonesia'],
      businessTypes: [
        'Toko / Retail',
        'Kafe',
        'Restoran',
        'Kios',
        'Kantin',
        'Distributor / Grosir',
        'Pabrik / Manufaktur',
        'Dapur Pusat',
        'Kantor / Jasa',
        'Lainnya',
      ],
      generatePasswordDefault: true,
      usernameRules: {
        pattern: '^[a-z][a-z0-9_]{2,47}$',
        minLength: 3,
        maxLength: this.config.get<number>('schema.baseMaxLength', 48),
        description:
          'Nama pengguna menjadi nama schema database Anda. Diawali huruf kecil, hanya boleh berisi ' +
          'huruf kecil, angka, dan garis bawah.',
      },
      passwordRules: {
        minLength: 10,
        requireUppercase: true,
        requireLowercase: true,
        requireDigit: true,
        requireSymbol: true,
      },
      requiredConsents: ['acceptTerms', 'acceptPrivacy'],
      locales: this.config.get<string[]>('i18n.supportedLocales', ['id', 'en', 'ar', 'zh-CN']),
    };
  }

  /** Cek ketersediaan nama pengguna/schema tanpa memesan. */
  async checkUsername(desiredUsername: string) {
    const auditSuffix = this.config.get<string>('schema.auditSuffix', '__audit');
    const validation = validateSchemaName(desiredUsername, auditSuffix);

    if (!validation.valid) {
      return {
        available: false,
        normalizedUsername: validation.normalized,
        schemaName: validation.normalized,
        auditSchemaName: validation.auditName,
        reason: validation.errorCode,
        message: validation.message,
        suggestions: validation.suggestions ?? [],
      };
    }

    const [existingUser, existingRegistry, existingReservation, schemaExists, auditExists] =
      await Promise.all([
        this.prisma.platformUser.findUnique({
          where: { normalizedUsername: validation.normalized },
          select: { id: true },
        }),
        this.prisma.tenantSchemaRegistry.findFirst({
          where: {
            OR: [{ schemaName: validation.normalized }, { auditSchemaName: validation.auditName }],
          },
          select: { id: true },
        }),
        this.prisma.schemaNameReservation.findFirst({
          where: {
            normalizedName: validation.normalized,
            consumedAt: null,
            releasedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        }),
        this.tenantDb.schemaExists(validation.normalized),
        this.tenantDb.schemaExists(validation.auditName),
      ]);

    const taken = Boolean(
      existingUser || existingRegistry || existingReservation || schemaExists || auditExists,
    );

    return {
      available: !taken,
      normalizedUsername: validation.normalized,
      schemaName: validation.normalized,
      auditSchemaName: validation.auditName,
      reason: taken ? ErrorCodes.USERNAME_OR_SCHEMA_ALREADY_EXISTS : null,
      message: taken
        ? 'Nama pengguna atau nama schema tersebut sudah dipakai. Silakan pilih nama lain.'
        : 'Nama pengguna tersedia.',
      suggestions: taken ? buildAlternatives(validation.normalized) : [],
    };
  }

  /**
   * Pendaftaran mandiri tanpa login.
   * Urutan: validasi → reserve → registry PROVISIONING → provisioning → credential.
   */
  async register(
    input: RegistrationInput,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<RegistrationResult> {
    if (!input.acceptTerms || !input.acceptPrivacy) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Persetujuan syarat penggunaan dan kebijakan privasi wajib diberikan.',
      );
    }

    const registrationOpen = await this.prisma.platformSetting.findUnique({
      where: { key: 'REGISTRATION_OPEN' },
    });
    if ((registrationOpen?.value as { value?: boolean } | null)?.value === false) {
      throw AppError.unprocessable(
        ErrorCodes.FORBIDDEN,
        'Pendaftaran publik sedang ditutup sementara.',
      );
    }

    const auditSuffix = this.config.get<string>('schema.auditSuffix', '__audit');
    const validation = validateSchemaName(input.desiredUsername, auditSuffix);
    if (!validation.valid) {
      throw AppError.badRequest(
        validation.errorCode ?? ErrorCodes.INVALID_SCHEMA_NAME,
        validation.message ?? 'Nama pengguna tidak valid.',
        { suggestions: validation.suggestions ?? [] },
      );
    }

    const generatePassword = input.generatePassword ?? true;
    let plainPassword: string;
    if (generatePassword) {
      plainPassword = generateTemporaryPassword();
    } else {
      if (!input.password) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Kata sandi wajib diisi.');
      }
      if (input.password !== input.passwordConfirmation) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Konfirmasi kata sandi tidak cocok.',
        );
      }
      assertPasswordStrength(input.password);
      plainPassword = input.password;
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const schemaName = validation.normalized;
    const auditSchemaName = validation.auditName;

    // Advisory lock: dua pendaftaran bersamaan tidak boleh membuat schema yang sama.
    return this.tenantDb.withAdvisoryLock(`registration:${schemaName}`, async () => {
      const availability = await this.checkUsername(input.desiredUsername);
      if (!availability.available) {
        throw AppError.conflict(
          ErrorCodes.USERNAME_OR_SCHEMA_ALREADY_EXISTS,
          'Nama pengguna atau nama schema tersebut sudah dipakai.',
          { suggestions: availability.suggestions },
        );
      }

      const emailTaken = await this.prisma.platformUser.findUnique({
        where: { normalizedEmail },
        select: { id: true },
      });
      if (emailTaken) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Surel tersebut sudah terdaftar. Silakan masuk atau gunakan surel lain.',
        );
      }

      const registrationCode = `REG-${Date.now().toString(36).toUpperCase()}`;

      const registration = await this.prisma.registration.create({
        data: {
          registrationCode,
          businessName: input.businessName.trim(),
          businessType: input.businessType?.trim() ?? null,
          country: input.country?.trim() || 'Indonesia',
          province: input.province?.trim() ?? null,
          cityRegency: input.cityRegency?.trim() ?? null,
          district: input.district?.trim() ?? null,
          address: input.address?.trim() ?? null,
          contactPerson: input.contactPerson?.trim() ?? null,
          contactPhone: input.contactPhone?.trim() ?? null,
          businessPhone: input.businessPhone?.trim() ?? null,
          email: normalizedEmail,
          desiredUsername: input.desiredUsername.trim(),
          normalizedUsername: schemaName,
          generatePassword,
          status: 'VALIDATING',
          localeCode: input.localeCode ?? 'id',
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });

      await this.prisma.schemaNameReservation.create({
        data: {
          normalizedName: schemaName,
          auditName: auditSchemaName,
          registrationId: registration.id,
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });
      await this.prisma.registration.update({
        where: { id: registration.id },
        data: { status: 'USERNAME_RESERVED' },
      });

      const tenant = await this.prisma.tenant.create({
        data: {
          registrationId: registration.id,
          code: schemaName.toUpperCase().slice(0, 64),
          name: input.businessName.trim(),
          slug: schemaName,
          status: 'PROVISIONING',
          localeCode: input.localeCode ?? 'id',
          trialEndsAt: new Date(
            Date.now() + this.config.get<number>('pricing.defaultPosTrialDays', 30) * 86_400_000,
          ),
        },
      });

      const passwordHash = await argon2.hash(plainPassword, { type: argon2.argon2id });
      const owner = await this.prisma.platformUser.create({
        data: {
          username: schemaName,
          normalizedUsername: schemaName,
          email: normalizedEmail,
          normalizedEmail,
          phone: input.contactPhone?.trim() ?? null,
          displayName: input.contactPerson?.trim() || input.businessName.trim(),
          passwordHash,
          status: 'ACTIVE',
          // Password yang dibuat server WAJIB diganti saat login pertama.
          mustChangePassword: generatePassword,
          preferredLocaleCode: input.localeCode ?? 'id',
          profile: {
            create: {
              fullName: input.contactPerson?.trim() || input.businessName.trim(),
              timezone: 'Asia/Jakarta',
            },
          },
        },
      });

      await this.prisma.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          platformUserId: owner.id,
          isOwner: true,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });

      await this.prisma.registration.update({
        where: { id: registration.id },
        data: { status: 'PROVISIONING' },
      });

      try {
        const provisioned = await this.provisioner.provision({
          registrationId: registration.id,
          tenantId: tenant.id,
          desiredUsername: schemaName,
          businessName: input.businessName.trim(),
          businessType: input.businessType ?? null,
          contactPerson: input.contactPerson ?? null,
          ownerPlatformUserId: owner.id,
          ownerUsername: schemaName,
          ownerEmail: normalizedEmail,
          includeStarterTransactions: false,
        });

        await this.prisma.schemaNameReservation.updateMany({
          where: { registrationId: registration.id },
          data: { consumedAt: new Date() },
        });
        await this.prisma.registration.update({
          where: { id: registration.id },
          data: { status: 'READY' },
        });

        // Bukti bahwa credential ditampilkan sekali — TANPA menyimpan password.
        if (generatePassword) {
          await this.prisma.registrationCredentialDelivery.create({
            data: {
              registrationId: registration.id,
              channel: 'API_RESPONSE',
              fingerprint: createHash('sha256')
                .update(`${owner.id}:${randomUUID()}`)
                .digest('hex')
                .slice(0, 64),
            },
          });
        }

        await this.audit.record({
          moduleCode: 'REGISTRATION',
          actionCode: 'REGISTRATION_COMPLETED',
          entityType: 'Registration',
          entityId: registration.id,
          tenantId: tenant.id,
          tenantSchema: provisioned.schemaName,
          actorUsername: schemaName,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
          metadata: {
            businessName: input.businessName,
            generatePassword,
            schemaVersion: provisioned.schemaVersion,
          },
        });

        return {
          status: 'READY',
          registrationId: registration.id,
          tenantId: tenant.id,
          username: schemaName,
          schemaName: provisioned.schemaName,
          auditSchemaName: provisioned.auditSchemaName,
          loginUrl: `${this.config.get<string>('webUrl', 'http://localhost:5173')}/masuk`,
          ...(generatePassword ? { temporaryPassword: plainPassword } : {}),
          mustChangePassword: generatePassword,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.registration.update({
          where: { id: registration.id },
          data: {
            status: 'FAILED',
            failureCode:
              error instanceof AppError ? error.errorCode : ErrorCodes.PROVISIONING_FAILED,
            failureMessage: message.slice(0, 2000),
          },
        });
        await this.prisma.schemaNameReservation.updateMany({
          where: { registrationId: registration.id },
          data: { releasedAt: new Date() },
        });
        await this.audit.record({
          moduleCode: 'REGISTRATION',
          actionCode: 'REGISTRATION_FAILED',
          entityType: 'Registration',
          entityId: registration.id,
          tenantId: tenant.id,
          result: 'FAILURE',
          reason: message.slice(0, 1000),
          requestId: meta.requestId,
        });
        this.logger.error(`Pendaftaran ${schemaName} gagal: ${message}`);
        // Credential aktif TIDAK dikembalikan saat provisioning gagal.
        throw AppError.internal(
          ErrorCodes.PROVISIONING_FAILED,
          'Penyiapan ruang kerja bisnis Anda gagal. Tim kami telah mencatat kejadian ini. ' +
            'Silakan coba lagi melalui status pendaftaran.',
          { registrationId: registration.id },
        );
      }
    });
  }

  async getStatus(registrationId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        tenant: { include: { schemaRegistry: true } },
        provisioningJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { steps: { orderBy: { sequence: 'asc' } } },
        },
      },
    });
    if (!registration) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftaran tidak ditemukan.');
    }

    const job = registration.provisioningJobs[0];
    return {
      registrationId: registration.id,
      registrationCode: registration.registrationCode,
      status: registration.status,
      businessName: registration.businessName,
      username: registration.normalizedUsername,
      // Detail schema hanya ditampilkan bila provisioning sudah selesai.
      schemaName: registration.tenant?.schemaRegistry?.schemaName ?? null,
      auditSchemaName: registration.tenant?.schemaRegistry?.auditSchemaName ?? null,
      schemaStatus: registration.tenant?.schemaRegistry?.status ?? null,
      tenantStatus: registration.tenant?.status ?? null,
      failureCode: registration.failureCode,
      // Pesan kegagalan aman untuk publik (tanpa stack trace).
      failureMessage: registration.failureMessage ? 'Provisioning gagal. Silakan coba lagi.' : null,
      progress: job
        ? {
            jobId: job.id,
            status: job.status,
            currentStage: job.currentStage,
            attempt: job.attempt,
            steps: job.steps.map((step) => ({
              stage: step.stage,
              status: step.status,
              durationMs: step.durationMs,
            })),
          }
        : null,
      createdAt: registration.createdAt,
    };
  }

  async retry(registrationId: string, meta: { requestId?: string }) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { provisioningJobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!registration) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftaran tidak ditemukan.');
    }
    if (registration.status !== 'FAILED') {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Ulangi hanya tersedia untuk pendaftaran berstatus FAILED.',
      );
    }
    const job = registration.provisioningJobs[0];
    if (!job) {
      throw AppError.unprocessable(
        ErrorCodes.PROVISIONING_FAILED,
        'Tidak ada provisioning job untuk diulang.',
      );
    }

    const result = await this.provisioner.retry(job.id);
    await this.prisma.registration.update({
      where: { id: registration.id },
      data: { status: 'READY', failureCode: null, failureMessage: null },
    });
    await this.audit.record({
      moduleCode: 'REGISTRATION',
      actionCode: 'REGISTRATION_RETRIED',
      entityType: 'Registration',
      entityId: registration.id,
      requestId: meta.requestId,
    });

    return {
      status: 'READY',
      registrationId: registration.id,
      schemaName: result.schemaName,
      auditSchemaName: result.auditSchemaName,
      schemaVersion: result.schemaVersion,
    };
  }
}

function buildAlternatives(base: string): string[] {
  const year = new Date().getFullYear();
  const candidates = [`${base}_id`, `${base}_group`, `${base}_${year}`, `${base}_pos`];
  return candidates
    .map((candidate) => candidate.slice(0, 48).replace(/_+$/, ''))
    .filter(
      (candidate) =>
        /^[a-z][a-z0-9_]{2,47}$/.test(candidate) && !RESERVED_SCHEMA_NAMES.has(candidate),
    );
}
