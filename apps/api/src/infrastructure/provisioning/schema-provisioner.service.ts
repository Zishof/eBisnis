import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProvisioningStage, ProvisioningStepStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { TenantMigrationService } from './tenant-migration.service';
import { MasterSeedService } from '../../modules/master-seed/master-seed.service';
import { TenantBootstrapService } from './tenant-bootstrap.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { validateSchemaName } from '../database/schema-name.util';

export interface ProvisionTenantCommand {
  registrationId?: string | null;
  tenantId: string;
  desiredUsername: string;
  businessName: string;
  businessType?: string | null;
  contactPerson?: string | null;
  ownerPlatformUserId?: string | null;
  ownerUsername?: string | null;
  ownerEmail?: string | null;
  isDemo?: boolean;
  includeStarterTransactions?: boolean;
  /**
   * Sertakan data contoh (produk, pelanggan, pemasok, dan transaksi awal).
   *
   * Bawaannya `true` agar penyewa yang tidak menyatakan pilihan tetap
   * memperoleh contoh untuk dipelajari. Data acuan seperti satuan, bagan akun,
   * dan peran TIDAK terpengaruh pilihan ini — ia selalu ada.
   */
  includeSampleData?: boolean;
}

export interface ProvisionResult {
  jobId: string;
  tenantId: string;
  schemaName: string;
  auditSchemaName: string;
  schemaVersion: string;
  verification: {
    ok: boolean;
    tableCount: number;
    auditTableCount: number;
    triggerCount: number;
    missing: string[];
  };
}

const STAGE_SEQUENCE: ProvisioningStage[] = [
  'VALIDATING',
  'RESERVED',
  'CREATING_SCHEMAS',
  'APPLYING_MIGRATIONS',
  'INSTALLING_AUDIT',
  'SEEDING',
  'CREATING_OWNER',
  'VERIFYING',
];

@Injectable()
export class SchemaProvisionerService {
  private readonly logger = new Logger(SchemaProvisionerService.name);
  private readonly auditSuffix: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly migrations: TenantMigrationService,
    private readonly seeds: MasterSeedService,
    private readonly bootstrap: TenantBootstrapService,
    private readonly config: ConfigService,
  ) {
    this.auditSuffix = this.config.get<string>('schema.auditSuffix', '__audit');
  }

  /**
   * State machine provisioning. Setiap tahap memakai transaksi kecil sendiri
   * agar tidak menahan lock DDL terlalu lama.
   */
  async provision(command: ProvisionTenantCommand): Promise<ProvisionResult> {
    // Schema sistem `demo` diprovision internal dan boleh melewati daftar reserved.
    // Nama ini TIDAK PERNAH berasal dari input pengguna.
    const allowReserved = command.isDemo
      ? [this.config.get<string>('schema.demo', 'demo')]
      : [];
    const validation = validateSchemaName(command.desiredUsername, {
      auditSuffix: this.auditSuffix,
      allowReserved,
    });
    if (!validation.valid) {
      throw AppError.badRequest(
        validation.errorCode ?? ErrorCodes.INVALID_SCHEMA_NAME,
        validation.message ?? 'Nama schema tidak valid.',
        { suggestions: validation.suggestions ?? [] },
      );
    }
    const schemaName = validation.normalized;
    const auditSchemaName = validation.auditName;

    const job = await this.prisma.provisioningJob.create({
      data: {
        registrationId: command.registrationId ?? null,
        tenantId: command.tenantId,
        schemaName,
        status: 'RUNNING',
        currentStage: 'REQUESTED',
        startedAt: new Date(),
      },
    });

    let sequence = 0;
    const runStage = async <T>(stage: ProvisioningStage, handler: () => Promise<T>): Promise<T> => {
      sequence += 1;
      const step = await this.prisma.provisioningStep.create({
        data: { jobId: job.id, stage, sequence, status: 'RUNNING', startedAt: new Date() },
      });
      await this.prisma.provisioningJob.update({
        where: { id: job.id },
        data: { currentStage: stage },
      });
      const startedAt = Date.now();
      try {
        const result = await handler();
        await this.prisma.provisioningStep.update({
          where: { id: step.id },
          data: {
            status: ProvisioningStepStatus.SUCCEEDED,
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
            detail: safeDetail(result) as Prisma.InputJsonValue | undefined,
          },
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.provisioningStep.update({
          where: { id: step.id },
          data: {
            status: ProvisioningStepStatus.FAILED,
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
            errorMessage: message.slice(0, 4000),
          },
        });
        await this.prisma.provisioningJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            currentStage: 'FAILED',
            errorCode: error instanceof AppError ? error.errorCode : ErrorCodes.PROVISIONING_FAILED,
            errorMessage: message.slice(0, 4000),
            finishedAt: new Date(),
          },
        });
        await this.prisma.tenant
          .update({ where: { id: command.tenantId }, data: { status: 'FAILED' } })
          .catch(() => undefined);
        throw error;
      }
    };

    try {
      // 1. VALIDATING + 2. RESERVED — cek atomik nama schema.
      await runStage('VALIDATING', async () => {
        await this.assertNameAvailable(schemaName, auditSchemaName);
        return { schemaName, auditSchemaName };
      });

      await runStage('RESERVED', async () =>
        this.prisma.tenantSchemaRegistry.upsert({
          where: { tenantId: command.tenantId },
          create: {
            tenantId: command.tenantId,
            username: schemaName,
            schemaName,
            auditSchemaName,
            status: 'PROVISIONING',
            schemaVersion: 'V000',
          },
          update: { status: 'PROVISIONING' },
          select: { id: true, schemaName: true },
        }),
      );

      // 3. CREATING_SCHEMAS
      await runStage('CREATING_SCHEMAS', async () => {
        await this.tenantDb.createSchema(schemaName);
        await this.tenantDb.createSchema(auditSchemaName);
        return { created: [schemaName, auditSchemaName] };
      });

      // 4-5. APPLYING_MIGRATIONS + INSTALLING_AUDIT (V008 memasang trigger)
      const applied = await runStage('APPLYING_MIGRATIONS', async () =>
        this.migrations.applyAll(schemaName, auditSchemaName, { tenantId: command.tenantId }),
      );

      await runStage('INSTALLING_AUDIT', async () => {
        const verification = await this.migrations.verifySchema(schemaName, auditSchemaName);
        if (verification.triggerCount === 0) {
          throw AppError.internal(
            ErrorCodes.PROVISIONING_FAILED,
            'Trigger audit tidak terpasang pada schema tenant.',
          );
        }
        return { triggerCount: verification.triggerCount };
      });

      // 6. SEEDING — master data + struktur organisasi awal
      await runStage('SEEDING', async () => {
        const includeSampleData = command.includeSampleData ?? true;
        const seedSummary = await this.seeds.seedTenant(schemaName, { includeExamples: includeSampleData });
        const orgSummary = await this.bootstrap.seedOrganization(schemaName, {
          businessName: command.businessName,
          businessType: command.businessType ?? null,
          contactPerson: command.contactPerson ?? null,
          isDemo: command.isDemo ?? false,
        });
        // Stock policy + saldo awal contoh membutuhkan gudang yang sudah ada.
        // Transaksi awal hanya masuk akal bila produk contohnya ada.
        const opsSummary = await this.bootstrap.seedOperationalSamples(schemaName, {
          includeStarterTransactions:
            includeSampleData && (command.includeStarterTransactions ?? false),
        });
        return {
          masters: seedSummary.totalInserted,
          organization: orgSummary,
          operations: opsSummary,
        };
      });

      // 7. CREATING_OWNER
      await runStage('CREATING_OWNER', async () => {
        // Sandbox demo tidak punya pemilik nyata; ia memakai subject demo tetap
        // dengan role DEMO_USER agar resolusi permission dan menu tetap normal.
        if (command.isDemo) {
          return this.bootstrap.createDemoSubject(schemaName);
        }
        if (!command.ownerPlatformUserId) return { skipped: true };
        return this.bootstrap.createOwnerSubject(schemaName, {
          platformUserId: command.ownerPlatformUserId,
          username: command.ownerUsername ?? schemaName,
          email: command.ownerEmail ?? null,
          displayName: command.contactPerson ?? command.businessName,
        });
      });

      // 8. VERIFYING
      const verification = await runStage('VERIFYING', async () => {
        const result = await this.migrations.verifySchema(schemaName, auditSchemaName);
        if (!result.ok) {
          throw AppError.internal(
            ErrorCodes.PROVISIONING_FAILED,
            `Verifikasi schema gagal. Tabel hilang: ${result.missing.join(', ')}`,
          );
        }
        const seedReport = await this.seeds.verifyTenant(schemaName);
        if (!seedReport.passed) {
          const failing = seedReport.rows
            .filter((r) => r.status !== 'OK' && r.status !== 'EXEMPT')
            .map((r) => `${r.resourceCode} (${r.activeCount}/${r.requiredMinimum})`);
          throw AppError.internal(
            ErrorCodes.PROVISIONING_FAILED,
            `Verifikasi seed gagal: ${failing.join(', ')}`,
          );
        }
        return result;
      });

      const schemaVersion = this.migrations.latestVersion();

      await this.prisma.tenantSchemaRegistry.update({
        where: { tenantId: command.tenantId },
        data: {
          status: 'READY',
          schemaVersion,
          provisionedAt: new Date(),
          lastMigratedAt: new Date(),
          lastVerifiedAt: new Date(),
        },
      });

      await this.prisma.tenant.update({
        where: { id: command.tenantId },
        data: { status: 'ACTIVE', activatedAt: new Date() },
      });

      await this.prisma.provisioningJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', currentStage: 'READY', finishedAt: new Date() },
      });

      this.logger.log(
        `Tenant ${schemaName} siap. Migration diterapkan: ${applied.filter((m) => !m.skipped).length}.`,
      );

      return {
        jobId: job.id,
        tenantId: command.tenantId,
        schemaName,
        auditSchemaName,
        schemaVersion,
        verification,
      };
    } catch (error) {
      await this.prisma.tenantSchemaRegistry
        .update({ where: { tenantId: command.tenantId }, data: { status: 'FAILED' } })
        .catch(() => undefined);
      throw error;
    }
  }

  /** Retry provisioning yang gagal. Idempotent karena setiap tahap idempotent. */
  async retry(jobId: string): Promise<ProvisionResult> {
    const job = await this.prisma.provisioningJob.findUnique({
      where: { id: jobId },
      include: { tenant: true, registration: true },
    });
    if (!job) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Provisioning job tidak ditemukan.');
    if (job.status === 'SUCCEEDED') {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Provisioning job sudah berhasil.');
    }
    if (!job.tenantId) {
      throw AppError.badRequest(ErrorCodes.PROVISIONING_FAILED, 'Job tidak terkait tenant.');
    }

    await this.prisma.provisioningJob.update({
      where: { id: jobId },
      data: { attempt: { increment: 1 }, status: 'RETRYING', errorCode: null, errorMessage: null },
    });

    return this.provision({
      registrationId: job.registrationId,
      tenantId: job.tenantId,
      desiredUsername: job.schemaName,
      businessName: job.tenant?.name ?? job.registration?.businessName ?? job.schemaName,
      businessType: job.registration?.businessType ?? null,
      contactPerson: job.registration?.contactPerson ?? null,
      isDemo: job.tenant?.isDemo ?? false,
    });
  }

  /** Menerapkan migration terbaru ke schema tenant yang sudah ada. */
  async migrateTenant(tenantId: string): Promise<{ schemaName: string; applied: number }> {
    const registry = await this.prisma.tenantSchemaRegistry.findUnique({ where: { tenantId } });
    if (!registry) {
      throw AppError.notFound(ErrorCodes.SCHEMA_NOT_REGISTERED, 'Schema tenant tidak terdaftar.');
    }
    await this.prisma.tenantSchemaRegistry.update({
      where: { tenantId },
      data: { status: 'MIGRATING' },
    });
    try {
      const results = await this.migrations.applyAll(
        registry.schemaName,
        registry.auditSchemaName,
        { tenantId },
      );
      await this.prisma.tenantSchemaRegistry.update({
        where: { tenantId },
        data: {
          status: 'READY',
          schemaVersion: this.migrations.latestVersion(),
          lastMigratedAt: new Date(),
        },
      });
      return {
        schemaName: registry.schemaName,
        applied: results.filter((r) => !r.skipped).length,
      };
    } catch (error) {
      await this.prisma.tenantSchemaRegistry.update({
        where: { tenantId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  /**
   * Cek atomik ketersediaan nama pada tiga sumber:
   * platform.users.username, platform.tenant_schema_registry.schema_name, pg_namespace.
   */
  private async assertNameAvailable(schemaName: string, auditSchemaName: string): Promise<void> {
    const registry = await this.prisma.tenantSchemaRegistry.findFirst({
      where: {
        OR: [
          { schemaName },
          { auditSchemaName },
          { schemaName: auditSchemaName },
          { auditSchemaName: schemaName },
        ],
        status: { in: ['READY', 'PROVISIONING', 'MIGRATING', 'SUSPENDED'] },
      },
      select: { tenantId: true, schemaName: true },
    });
    if (registry) {
      throw AppError.conflict(
        ErrorCodes.USERNAME_OR_SCHEMA_ALREADY_EXISTS,
        `Schema ${schemaName} sudah terdaftar untuk tenant lain.`,
      );
    }

    for (const name of [schemaName, auditSchemaName]) {
      if (await this.tenantDb.schemaExists(name)) {
        // Schema fisik ada tetapi tidak terdaftar → sisa provisioning gagal.
        // Aman untuk dilanjutkan hanya bila kosong.
        const tables = await this.tenantDb.queryAdmin<{ count: string }>(
          `SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = $1`,
          [name],
        );
        if (Number(tables[0]?.count ?? '0') > 0) {
          throw AppError.conflict(
            ErrorCodes.USERNAME_OR_SCHEMA_ALREADY_EXISTS,
            `Schema PostgreSQL "${name}" sudah ada dan berisi tabel.`,
          );
        }
      }
    }
  }

  /** Cleanup terkontrol — hanya untuk schema yang provisioningnya gagal. */
  async cleanupFailed(tenantId: string, confirmSchemaName: string): Promise<void> {
    const registry = await this.prisma.tenantSchemaRegistry.findUnique({ where: { tenantId } });
    if (!registry) {
      throw AppError.notFound(ErrorCodes.SCHEMA_NOT_REGISTERED, 'Schema tenant tidak terdaftar.');
    }
    if (registry.status !== 'FAILED') {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Cleanup hanya diizinkan untuk schema berstatus FAILED.',
      );
    }
    if (registry.schemaName !== confirmSchemaName) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Konfirmasi nama schema tidak cocok.',
      );
    }
    await this.tenantDb.dropSchema(registry.auditSchemaName);
    await this.tenantDb.dropSchema(registry.schemaName);
    await this.prisma.tenantSchemaMigrationHistory.deleteMany({
      where: { schemaName: registry.schemaName },
    });
    await this.prisma.tenantSchemaRegistry.delete({ where: { tenantId } });
    this.logger.warn(`Schema ${registry.schemaName} dibersihkan setelah provisioning gagal.`);
  }

  stages(): ProvisioningStage[] {
    return STAGE_SEQUENCE;
  }
}

function safeDetail(value: unknown): Record<string, unknown> | undefined {
  try {
    const json = JSON.parse(JSON.stringify(value ?? null));
    if (json === null) return undefined;
    return Array.isArray(json) ? { items: json.length } : (json as Record<string, unknown>);
  } catch {
    return undefined;
  }
}
