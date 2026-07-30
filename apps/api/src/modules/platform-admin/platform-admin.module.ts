import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { SchemaProvisionerService } from '../../infrastructure/provisioning/schema-provisioner.service';
import { TenantMigrationService } from '../../infrastructure/provisioning/tenant-migration.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { MasterLifecycleService } from '../tenant/master-lifecycle.service';
import { TenantModule } from '../tenant/tenant.module';
import { findMasterResource } from '../tenant/master-resource.registry';
import { BaseQueryDto } from '../../common/dto/base-query.dto';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  PlatformPermissions,
  RequestContext,
  RequestMeta,
  RequireStepUp,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

class SupportSessionDto {
  @ApiProperty({ description: 'Alasan akses wajib diisi dan tercatat pada audit ganda.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ enum: ['READ_ONLY', 'READ_WRITE'], default: 'READ_ONLY' })
  @IsOptional()
  @IsIn(['READ_ONLY', 'READ_WRITE'])
  accessMode?: 'READ_ONLY' | 'READ_WRITE';

  @ApiPropertyOptional({ description: 'Durasi sesi dalam menit (maks 120).' })
  @IsOptional()
  @IsString()
  durationMinutes?: string;
}

class TenantActionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

@ApiTags('platform')
@ApiBearerAuth('access-token')
@Controller('platform')
export class PlatformAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly provisioner: SchemaProvisionerService,
    private readonly migrations: TenantMigrationService,
    private readonly lifecycle: MasterLifecycleService,
    private readonly audit: AuditService,
  ) {}

  @PlatformPermissions('PLATFORM.TENANT.READ')
  @Get('dashboard')
  @ApiOperation({ summary: 'Ringkasan control plane' })
  async dashboard() {
    const [
      tenants,
      activeTenants,
      registrations,
      pendingProvisioning,
      devices,
      subscriptions,
      invoices,
      unpaidInvoices,
      paymentOrders,
      demoSessions,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.registration.count(),
      this.prisma.provisioningJob.count({ where: { status: { in: ['PENDING', 'RUNNING', 'RETRYING'] } } }),
      this.prisma.posDevice.count({ where: { deletedAt: null } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.billingInvoice.count(),
      this.prisma.billingInvoice.count({ where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } } }),
      this.prisma.paymentOrder.count({ where: { status: 'WAITING_PAYMENT' } }),
      this.prisma.demoSession.count({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
    ]);

    const failedProvisioning = await this.prisma.provisioningJob.count({ where: { status: 'FAILED' } });

    return {
      tenants: { total: tenants, active: activeTenants },
      registrations: { total: registrations, pendingProvisioning, failedProvisioning },
      devices: { total: devices },
      subscriptions: { active: subscriptions },
      invoices: { total: invoices, unpaid: unpaidInvoices },
      payments: { waiting: paymentOrders },
      demo: { activeSessions: demoSessions },
      schema: {
        tenantMigrationVersion: this.migrations.latestVersion(),
        clientCacheSize: this.tenantDb.cacheSize(),
      },
    };
  }

  // --- Registrasi ----------------------------------------------------------

  @PlatformPermissions('PLATFORM.REGISTRATION.READ')
  @Get('registrations')
  @ApiOperation({ summary: 'Daftar pendaftar' })
  listRegistrations(@Query() query: BaseQueryDto) {
    return this.prisma.registration.findMany({
      where: {
        deletedAt: null,
        ...(query.search
          ? {
              OR: [
                { businessName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { normalizedUsername: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.pageSize,
      include: { tenant: { include: { schemaRegistry: true } } },
    });
  }

  @PlatformPermissions('PLATFORM.REGISTRATION.READ')
  @Get('registrations/:id')
  @ApiOperation({ summary: 'Detail pendaftar' })
  async getRegistration(@Param('id') id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        tenant: { include: { schemaRegistry: true, memberships: true } },
        provisioningJobs: { include: { steps: { orderBy: { sequence: 'asc' } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!registration) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftaran tidak ditemukan.');
    return registration;
  }

  // --- Tenant dan schema ---------------------------------------------------

  @PlatformPermissions('PLATFORM.TENANT.READ')
  @Get('tenants')
  @ApiOperation({ summary: 'Daftar tenant beserta status schema' })
  listTenants(@Query() query: BaseQueryDto) {
    return this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
                { slug: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.pageSize,
      include: {
        schemaRegistry: true,
        _count: { select: { memberships: true, devices: true, subscriptions: true } },
      },
    });
  }

  @PlatformPermissions('PLATFORM.TENANT.READ')
  @Get('tenants/:id')
  @ApiOperation({ summary: 'Detail tenant' })
  async getTenant(@Param('id') id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        schemaRegistry: true,
        memberships: { include: { user: { select: { username: true, email: true, displayName: true } } } },
        migrationHistory: { orderBy: { appliedAt: 'desc' }, take: 20 },
        subscriptions: { include: { planVersion: { include: { plan: true } } } },
        devices: { where: { deletedAt: null } },
      },
    });
    if (!tenant) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tenant tidak ditemukan.');
    return tenant;
  }

  @PlatformPermissions('PLATFORM.TENANT.SCHEMA_STATUS')
  @Get('tenants/:id/schema-status')
  @ApiOperation({ summary: 'Status schema tenant, versi migration, dan verifikasi tabel' })
  async schemaStatus(@Param('id') id: string) {
    const registry = await this.prisma.tenantSchemaRegistry.findUnique({ where: { tenantId: id } });
    if (!registry) {
      throw AppError.notFound(ErrorCodes.SCHEMA_NOT_REGISTERED, 'Schema tenant tidak terdaftar.');
    }
    const verification = await this.migrations.verifySchema(
      registry.schemaName,
      registry.auditSchemaName,
    );
    const history = await this.prisma.tenantSchemaMigrationHistory.findMany({
      where: { schemaName: registry.schemaName },
      orderBy: { appliedAt: 'asc' },
    });
    return {
      registry,
      latestCatalogVersion: this.migrations.latestVersion(),
      upToDate: registry.schemaVersion === this.migrations.latestVersion(),
      verification,
      history,
    };
  }

  @PlatformPermissions('PLATFORM.TENANT.MIGRATE')
  @BlockDemo()
  @Post('tenants/:id/migrate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menerapkan migration terbaru ke schema tenant' })
  async migrateTenant(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const result = await this.provisioner.migrateTenant(id);
    await this.audit.record({
      moduleCode: 'PLATFORM',
      actionCode: 'TENANT_MIGRATED',
      entityType: 'Tenant',
      entityId: id,
      tenantId: id,
      tenantSchema: result.schemaName,
      actorUserId: user.userId,
      actorUsername: user.username,
      requestId: meta.requestId,
      metadata: { applied: result.applied },
    });
    return result;
  }

  @PlatformPermissions('PLATFORM.TENANT.ACTIVATE')
  @BlockDemo()
  @Post('tenants/:id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengaktifkan tenant' })
  async activateTenant(
    @Param('id') id: string,
    @Body() dto: TenantActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE', activatedAt: new Date(), suspendedAt: null, suspendReason: null },
    });
    await this.audit.record({
      moduleCode: 'PLATFORM',
      actionCode: 'TENANT_ACTIVATED',
      entityType: 'Tenant',
      entityId: id,
      tenantId: id,
      actorUserId: user.userId,
      actorUsername: user.username,
      reason: dto.reason,
      requestId: meta.requestId,
    });
    return tenant;
  }

  @PlatformPermissions('PLATFORM.TENANT.SUSPEND')
  @RequireStepUp('TENANT_SUSPEND')
  @BlockDemo()
  @Post('tenants/:id/suspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menangguhkan tenant (memerlukan step-up)' })
  async suspendTenant(
    @Param('id') id: string,
    @Body() dto: TenantActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED', suspendedAt: new Date(), suspendReason: dto.reason },
    });
    await this.audit.record({
      moduleCode: 'PLATFORM',
      actionCode: 'TENANT_SUSPENDED',
      entityType: 'Tenant',
      entityId: id,
      tenantId: id,
      actorUserId: user.userId,
      actorUsername: user.username,
      reason: dto.reason,
      requestId: meta.requestId,
    });
    return tenant;
  }

  // --- Provisioning --------------------------------------------------------

  @PlatformPermissions('PLATFORM.TENANT.READ')
  @Get('provisioning-jobs')
  @ApiOperation({ summary: 'Daftar provisioning job' })
  listProvisioningJobs(@Query('status') status?: string) {
    return this.prisma.provisioningJob.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { tenant: { select: { name: true, code: true } } },
    });
  }

  @PlatformPermissions('PLATFORM.TENANT.READ')
  @Get('provisioning-jobs/:id')
  @ApiOperation({ summary: 'Detail provisioning job beserta setiap step' })
  async getProvisioningJob(@Param('id') id: string) {
    const job = await this.prisma.provisioningJob.findUnique({
      where: { id },
      include: { steps: { orderBy: { sequence: 'asc' } }, tenant: true, registration: true },
    });
    if (!job) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Provisioning job tidak ditemukan.');
    return job;
  }

  @PlatformPermissions('PLATFORM.TENANT.MIGRATE')
  @BlockDemo()
  @Post('provisioning-jobs/:id/retry')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengulang provisioning yang gagal' })
  retryProvisioning(@Param('id') id: string) {
    return this.provisioner.retry(id);
  }

  // --- Support session (akses terkontrol ke schema tenant) ------------------

  @PlatformPermissions('PLATFORM.TENANT.SUPPORT_READ')
  @BlockDemo()
  @Post('tenants/:id/support-sessions')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Membuka tenant support context',
    description:
      'Akses berumur pendek, memerlukan alasan, dan tercatat pada platform__audit serta audit tenant.',
  })
  async createSupportSession(
    @Param('id') tenantId: string,
    @Body() dto: SupportSessionDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const registry = await this.prisma.tenantSchemaRegistry.findUnique({ where: { tenantId } });
    if (!registry || registry.status !== 'READY') {
      throw AppError.unprocessable(ErrorCodes.TENANT_NOT_READY, 'Schema tenant belum siap.');
    }

    // Mode tulis memerlukan permission terpisah.
    if (dto.accessMode === 'READ_WRITE' && !user.platformPermissions.includes('PLATFORM.TENANT.SUPPORT_WRITE')) {
      throw AppError.forbidden(
        ErrorCodes.PERMISSION_DENIED,
        'Akses tulis pada tenant memerlukan permission PLATFORM.TENANT.SUPPORT_WRITE.',
      );
    }

    const durationMinutes = Math.min(Number(dto.durationMinutes ?? 30) || 30, 120);
    const session = await this.prisma.platformSupportSession.create({
      data: {
        tenantId,
        schemaNameSnapshot: registry.schemaName,
        requestedById: user.userId,
        reason: dto.reason,
        accessMode: dto.accessMode ?? 'READ_ONLY',
        expiresAt: new Date(Date.now() + durationMinutes * 60_000),
      },
    });

    await this.audit.record({
      moduleCode: 'PLATFORM',
      actionCode: 'SUPPORT_SESSION_OPENED',
      entityType: 'PlatformSupportSession',
      entityId: session.id,
      tenantId,
      tenantSchema: registry.schemaName,
      actorUserId: user.userId,
      actorUsername: user.username,
      reason: dto.reason,
      supportSessionId: session.id,
      requestId: meta.requestId,
    });

    return {
      supportSessionId: session.id,
      tenantId,
      schemaName: registry.schemaName,
      accessMode: session.accessMode,
      expiresAt: session.expiresAt,
      reason: session.reason,
      banner:
        'ANDA SEDANG MENGAKSES DATA TENANT MELALUI SUPPORT CONTEXT. Setiap pembacaan dan perubahan dicatat pada audit ganda.',
    };
  }

  @PlatformPermissions('PLATFORM.TENANT.SUPPORT_READ')
  @Delete('support-sessions/:id')
  @ApiOperation({ summary: 'Menutup support context' })
  async closeSupportSession(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const session = await this.prisma.platformSupportSession.findUnique({ where: { id } });
    if (!session) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Support session tidak ditemukan.');
    await this.prisma.platformSupportSession.update({
      where: { id },
      data: { endedAt: new Date() },
    });
    await this.audit.record({
      moduleCode: 'PLATFORM',
      actionCode: 'SUPPORT_SESSION_CLOSED',
      entityType: 'PlatformSupportSession',
      entityId: id,
      tenantId: session.tenantId,
      actorUserId: user.userId,
      supportSessionId: id,
    });
    return { closed: true };
  }

  @PlatformPermissions('PLATFORM.TENANT.SUPPORT_READ')
  @Get('support-sessions/:id/master-data/:resource')
  @ApiOperation({
    summary: 'Membaca master data tenant melalui support context',
    description: 'Resource dibatasi whitelist. Nama schema TIDAK pernah diterima dari request.',
  })
  async readSupportMasterData(
    @Param('id') sessionId: string,
    @Param('resource') resource: string,
    @Query() query: BaseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const session = await this.requireActiveSupportSession(sessionId, user.userId);
    if (!findMasterResource(resource)) {
      throw AppError.notFound(
        ErrorCodes.RESOURCE_NOT_CONFIGURED,
        `Resource "${resource}" tidak ada pada whitelist support context.`,
      );
    }

    const result = await this.lifecycle.list(
      {
        schemaName: session.schemaNameSnapshot,
        tenantId: session.tenantId,
        userId: user.userId,
        username: user.username,
        audit: {
          requestId: meta.requestId,
          userId: user.userId,
          username: user.username,
          supportSessionId: session.id,
          ipAddress: meta.ipAddress,
          moduleCode: 'PLATFORM_SUPPORT',
          actionCode: 'SUPPORT_READ',
        },
      },
      resource,
      query,
    );

    await this.prisma.platformSupportSession.update({
      where: { id: sessionId },
      data: { readCount: { increment: 1 } },
    });
    await this.audit.record({
      moduleCode: 'PLATFORM_SUPPORT',
      actionCode: 'SUPPORT_MASTER_READ',
      entityType: resource,
      tenantId: session.tenantId,
      tenantSchema: session.schemaNameSnapshot,
      actorUserId: user.userId,
      actorUsername: user.username,
      supportSessionId: session.id,
      requestId: meta.requestId,
      metadata: { resource, rows: result.items.length },
    });

    return { supportSessionId: session.id, ...result };
  }

  @PlatformPermissions('PLATFORM.TENANT.SUPPORT_WRITE')
  @RequireStepUp('SUPPORT_WRITE')
  @BlockDemo()
  @Patch('support-sessions/:id/master-data/:resource/:recordId')
  @ApiOperation({
    summary: 'Mengubah master data tenant melalui support context',
    description:
      'Memerlukan permission khusus, step-up authentication, alasan, dan optimistic version. ' +
      'Perubahan dicatat pada platform__audit dan trigger tenant mencatat pada schema audit tenant.',
  })
  async writeSupportMasterData(
    @Param('id') sessionId: string,
    @Param('resource') resource: string,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown> & { reason?: string; version?: number },
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const session = await this.requireActiveSupportSession(sessionId, user.userId);
    if (session.accessMode !== 'READ_WRITE') {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Support session ini dibuka dalam mode baca-saja.',
      );
    }
    if (!body.reason) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Alasan perubahan wajib diisi.');
    }
    if (!findMasterResource(resource)) {
      throw AppError.notFound(
        ErrorCodes.RESOURCE_NOT_CONFIGURED,
        `Resource "${resource}" tidak ada pada whitelist support context.`,
      );
    }

    const { reason, version, ...payload } = body;
    const updated = await this.lifecycle.update(
      {
        schemaName: session.schemaNameSnapshot,
        tenantId: session.tenantId,
        userId: user.userId,
        username: user.username,
        audit: {
          requestId: meta.requestId,
          userId: user.userId,
          username: user.username,
          supportSessionId: session.id,
          ipAddress: meta.ipAddress,
          moduleCode: 'PLATFORM_SUPPORT',
          actionCode: 'SUPPORT_WRITE',
        },
      },
      resource,
      recordId,
      payload,
      version,
    );

    await this.prisma.platformSupportSession.update({
      where: { id: sessionId },
      data: { writeCount: { increment: 1 } },
    });
    await this.audit.record({
      moduleCode: 'PLATFORM_SUPPORT',
      actionCode: 'SUPPORT_MASTER_WRITE',
      entityType: resource,
      entityId: recordId,
      tenantId: session.tenantId,
      tenantSchema: session.schemaNameSnapshot,
      actorUserId: user.userId,
      actorUsername: user.username,
      supportSessionId: session.id,
      reason,
      requestId: meta.requestId,
      metadata: { changedFields: Object.keys(payload) },
    });

    return { supportSessionId: session.id, record: updated };
  }

  // --- Audit ---------------------------------------------------------------

  @PlatformPermissions('PLATFORM.AUDIT.READ')
  @Get('audit')
  @ApiOperation({ summary: 'Audit control plane' })
  listAudit(
    @Query('moduleCode') moduleCode?: string,
    @Query('actionCode') actionCode?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.auditEvent.findMany({
      where: {
        ...(moduleCode ? { moduleCode } : {}),
        ...(actionCode ? { actionCode } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Number(limit ?? 100) || 100, 500),
    });
  }

  @PlatformPermissions('PLATFORM.AUDIT.READ')
  @Get('security-events')
  @ApiOperation({ summary: 'Event keamanan' })
  listSecurityEvents(@Query('limit') limit?: string) {
    return this.prisma.auditSecurityEvent.findMany({
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Number(limit ?? 100) || 100, 500),
    });
  }

  // --- Locale dan terjemahan ----------------------------------------------

  @PlatformPermissions('PLATFORM.I18N.MANAGE')
  @Get('locales')
  @ApiOperation({ summary: 'Daftar locale' })
  listLocales() {
    return this.prisma.locale.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @PlatformPermissions('PLATFORM.I18N.MANAGE')
  @BlockDemo()
  @Patch('locales/:code')
  @ApiOperation({ summary: 'Mengaktifkan atau menonaktifkan locale' })
  async updateLocale(
    @Param('code') code: string,
    @Body() body: { enabled?: boolean; sortOrder?: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const locale = await this.prisma.locale.update({
      where: { code },
      data: {
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    await this.audit.record({
      moduleCode: 'PLATFORM',
      actionCode: 'LOCALE_UPDATED',
      entityType: 'Locale',
      entityId: locale.id,
      actorUserId: user.userId,
      metadata: { code, enabled: locale.enabled },
    });
    return locale;
  }

  @PlatformPermissions('PLATFORM.I18N.MANAGE')
  @Get('translations')
  @ApiOperation({ summary: 'Katalog terjemahan' })
  listTranslations(@Query('locale') locale?: string, @Query('namespace') namespace?: string) {
    return this.prisma.translationValue.findMany({
      where: {
        deletedAt: null,
        ...(locale ? { localeCode: locale } : {}),
        ...(namespace ? { key: { namespace: { code: namespace } } } : {}),
      },
      include: { key: { include: { namespace: true } } },
      take: 1000,
    });
  }

  @PlatformPermissions('PLATFORM.I18N.MANAGE')
  @Get('translations/export')
  @ApiOperation({ summary: 'Ekspor katalog terjemahan sebagai JSON' })
  async exportTranslations(@Query('locale') locale: string) {
    const values = await this.prisma.translationValue.findMany({
      where: { localeCode: locale, deletedAt: null },
      include: { key: { include: { namespace: true } } },
    });
    const catalog: Record<string, Record<string, string>> = {};
    for (const value of values) {
      const ns = value.key.namespace.code;
      catalog[ns] = catalog[ns] ?? {};
      catalog[ns][value.key.key] = value.value;
    }
    return { locale, exportedAt: new Date().toISOString(), catalog };
  }

  // --- Demo ----------------------------------------------------------------

  @PlatformPermissions('PLATFORM.TENANT.MIGRATE')
  @BlockDemo()
  @Post('demo/reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset sandbox demo',
    description: 'Menerapkan migration terbaru dan menjalankan seed ulang secara idempotent.',
  })
  async resetDemo(@CurrentUser() user: AuthenticatedUser, @RequestContext() meta: RequestMeta) {
    const registry = await this.prisma.tenantSchemaRegistry.findUnique({
      where: { schemaName: 'demo' },
    });
    if (!registry) {
      throw AppError.notFound(ErrorCodes.SCHEMA_NOT_REGISTERED, 'Schema demo belum diprovision.');
    }

    const lastRun = await this.prisma.demoResetRun.findFirst({ orderBy: { startedAt: 'desc' } });
    const run = await this.prisma.demoResetRun.create({
      data: {
        generation: (lastRun?.generation ?? 0) + 1,
        triggeredBy: 'PLATFORM_ADMIN',
        triggeredById: user.userId,
        status: 'RUNNING',
      },
    });

    try {
      await this.provisioner.migrateTenant(registry.tenantId);
      // Sesi demo lama dicabut agar tidak melihat data campuran.
      await this.prisma.demoSession.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'REVOKED', endedAt: new Date() },
      });
      await this.prisma.demoResetRun.update({
        where: { id: run.id },
        data: { status: 'SUCCEEDED', finishedAt: new Date() },
      });
      await this.audit.record({
        moduleCode: 'PLATFORM',
        actionCode: 'DEMO_RESET',
        entityType: 'DemoResetRun',
        entityId: run.id,
        actorUserId: user.userId,
        requestId: meta.requestId,
      });
      return { resetRunId: run.id, generation: run.generation, status: 'SUCCEEDED' };
    } catch (error) {
      await this.prisma.demoResetRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
        },
      });
      throw error;
    }
  }

  // -------------------------------------------------------------------------

  private async requireActiveSupportSession(sessionId: string, userId: string) {
    const session = await this.prisma.platformSupportSession.findUnique({ where: { id: sessionId } });
    if (!session) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Support session tidak ditemukan.');
    if (session.requestedById !== userId) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Support session milik pengguna lain.');
    }
    if (session.endedAt || session.expiresAt < new Date()) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Support session sudah berakhir. Buka sesi baru dengan alasan yang jelas.',
      );
    }
    return session;
  }
}

@Module({
  imports: [TenantModule],
  controllers: [PlatformAdminController],
})
export class PlatformAdminModule {}
