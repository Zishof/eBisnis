import { Body, Controller, Get, HttpCode, Module, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MasterSeedService } from '../master-seed/master-seed.service';
import { PlatformSeedService } from '../master-seed/platform-seed.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  PlatformPermissions,
  Permissions,
  RequireStepUp,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TENANT_SEED_EXCEPTIONS } from '../master-seed/registry/tenant-master-seeds';

class CleanupDto {
  @ApiPropertyOptional({ description: 'Hard purge, bukan soft delete. Memerlukan step-up.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hard?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@ApiTags('seed')
@Controller()
export class SeedAdminController {
  constructor(
    private readonly masterSeed: MasterSeedService,
    private readonly platformSeed: PlatformSeedService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Tenant --------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('MASTER_SEED_TOOLS.READ')
  @Get('sample-data/verify')
  @ApiOperation({
    summary: 'Verifikasi data contoh tenant',
    description:
      'Melaporkan resourceCode, requiredMinimum, activeCount, sampleCount, status, dan missingCodes.',
  })
  verifyTenant(@CurrentUser() user: AuthenticatedUser) {
    requireSchema(user);
    return this.masterSeed.verifyTenant(user.schemaName!);
  }

  @ApiBearerAuth('access-token')
  @Permissions('MASTER_SEED_TOOLS.CREATE')
  @BlockDemo()
  @Post('sample-data/repair')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tambahkan data contoh yang kurang' })
  async repairTenant(@CurrentUser() user: AuthenticatedUser) {
    requireSchema(user);
    const summary = await this.masterSeed.repairTenant(user.schemaName!);
    await this.audit.record({
      moduleCode: 'MASTER_SEED',
      actionCode: 'SEED_REPAIRED',
      tenantId: user.tenantId,
      tenantSchema: user.schemaName,
      actorUserId: user.userId,
      metadata: { inserted: summary.totalInserted, updated: summary.totalUpdated },
    });
    return summary;
  }

  @ApiBearerAuth('access-token')
  @Permissions('MASTER_SEED_TOOLS.DELETE')
  @BlockDemo()
  @Post('sample-data/cleanup')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Hapus data contoh',
    description:
      'Data contoh yang telah direferensikan transaksi nyata tidak dihapus dan dilaporkan sebagai terblokir.',
  })
  async cleanupTenant(@Body() dto: CleanupDto, @CurrentUser() user: AuthenticatedUser) {
    requireSchema(user);
    if (dto.hard) {
      throw AppError.forbidden(
        ErrorCodes.PURGE_NOT_ALLOWED,
        'Hard purge data contoh memerlukan endpoint terpisah dengan step-up authentication.',
      );
    }
    const summary = await this.masterSeed.cleanupSampleData(user.schemaName!, {
      hard: false,
      deletedBy: user.userId,
      reason: dto.reason ?? 'Hapus data contoh',
    });
    await this.audit.record({
      moduleCode: 'MASTER_SEED',
      actionCode: 'SAMPLE_DATA_CLEANED',
      tenantId: user.tenantId,
      tenantSchema: user.schemaName,
      actorUserId: user.userId,
      reason: dto.reason,
      metadata: { removed: summary.totalRemoved, blocked: summary.blocked.length },
    });
    return summary;
  }

  @ApiBearerAuth('access-token')
  @Permissions('MASTER_SEED_TOOLS.DELETE')
  @RequireStepUp('SEED_CLEANUP')
  @BlockDemo()
  @Post('sample-data/purge')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Hapus permanen data contoh (purge)',
    description: 'Memerlukan step-up authentication. Record yang direferensikan tetap ditolak.',
  })
  async purgeTenant(@Body() dto: CleanupDto, @CurrentUser() user: AuthenticatedUser) {
    requireSchema(user);
    const summary = await this.masterSeed.cleanupSampleData(user.schemaName!, {
      hard: true,
      deletedBy: user.userId,
      reason: dto.reason ?? 'Purge data contoh',
    });
    await this.audit.record({
      moduleCode: 'MASTER_SEED',
      actionCode: 'SAMPLE_DATA_PURGED',
      tenantId: user.tenantId,
      tenantSchema: user.schemaName,
      actorUserId: user.userId,
      reason: dto.reason,
      metadata: { removed: summary.totalRemoved, blocked: summary.blocked.length },
    });
    return summary;
  }

  @ApiBearerAuth('access-token')
  @Permissions('MASTER_SEED_TOOLS.RESTORE')
  @BlockDemo()
  @Post('sample-data/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pulihkan data contoh yang telah di-soft-delete' })
  async restoreTenant(@CurrentUser() user: AuthenticatedUser) {
    requireSchema(user);
    const result = await this.masterSeed.restoreSampleData(user.schemaName!);
    await this.audit.record({
      moduleCode: 'MASTER_SEED',
      actionCode: 'SAMPLE_DATA_RESTORED',
      tenantId: user.tenantId,
      tenantSchema: user.schemaName,
      actorUserId: user.userId,
      metadata: result,
    });
    return result;
  }

  @ApiBearerAuth('access-token')
  @Permissions('MASTER_SEED_TOOLS.READ')
  @Get('sample-data/exceptions')
  @ApiOperation({ summary: 'Master yang dikecualikan dari aturan minimum 10 record' })
  listExceptions() {
    return TENANT_SEED_EXCEPTIONS;
  }

  // --- Platform ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.SEED.MANAGE')
  @Get('platform/seed/verify')
  @ApiOperation({ summary: 'Verifikasi seed control plane dan seluruh tenant READY' })
  async verifyPlatform(@Query('includeTenants') includeTenants?: string) {
    const reports = [await this.platformSeed.verify()];
    if (includeTenants === 'true') {
      const registries = await this.prisma.tenantSchemaRegistry.findMany({
        where: { status: 'READY' },
        select: { schemaName: true },
      });
      for (const registry of registries) {
        reports.push(await this.masterSeed.verifyTenant(registry.schemaName));
      }
    }
    return { passed: reports.every((r) => r.passed), reports };
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.SEED.MANAGE')
  @BlockDemo()
  @Post('platform/seed/run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menjalankan ulang seed control plane (idempotent)' })
  async runPlatformSeed(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.platformSeed.seedAll();
    await this.audit.record({
      moduleCode: 'MASTER_SEED',
      actionCode: 'PLATFORM_SEED_RUN',
      actorUserId: user.userId,
      metadata: result.summary,
    });
    return result;
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.SEED.MANAGE')
  @BlockDemo()
  @Post('platform/seed/tenants/:schemaName/repair')
  @HttpCode(200)
  @ApiOperation({ summary: 'Perbaikan seed pada satu schema tenant' })
  async repairTenantSchema(
    @Query('schemaName') schemaNameQuery: string,
    @Body() body: { schemaName?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schemaName = body?.schemaName ?? schemaNameQuery;
    const registry = await this.prisma.tenantSchemaRegistry.findUnique({ where: { schemaName } });
    if (!registry) {
      throw AppError.notFound(ErrorCodes.SCHEMA_NOT_REGISTERED, 'Schema tidak terdaftar.');
    }
    const summary = await this.masterSeed.repairTenant(registry.schemaName);
    await this.audit.record({
      moduleCode: 'MASTER_SEED',
      actionCode: 'TENANT_SEED_REPAIRED',
      tenantId: registry.tenantId,
      tenantSchema: registry.schemaName,
      actorUserId: user.userId,
      metadata: { inserted: summary.totalInserted },
    });
    return summary;
  }
}

function requireSchema(user: AuthenticatedUser): void {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terhubung ke tenant mana pun.');
  }
}

@Module({
  controllers: [SeedAdminController],
})
export class SeedAdminModule {}
