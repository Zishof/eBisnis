import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appConfig } from '../config/configuration';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PlatformSeedService } from '../modules/master-seed/platform-seed.service';
import { MasterSeedService } from '../modules/master-seed/master-seed.service';
import { SchemaProvisionerService } from '../infrastructure/provisioning/schema-provisioner.service';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../infrastructure/database/tenant-connection.service';
import { TenantBootstrapService } from '../infrastructure/provisioning/tenant-bootstrap.service';

/** Modul minimal untuk CLI: tanpa HTTP server. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig], cache: true }), InfrastructureModule],
})
class SeedCliModule {}

export async function createSeedContext() {
  const app = await NestFactory.createApplicationContext(SeedCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  return {
    app,
    config: app.get(ConfigService),
    prisma: app.get(PrismaService),
    tenantDb: app.get(TenantConnectionService),
    platformSeed: app.get(PlatformSeedService),
    masterSeed: app.get(MasterSeedService),
    provisioner: app.get(SchemaProvisionerService),
    bootstrap: app.get(TenantBootstrapService),
  };
}

export interface SeedResult {
  platform: Record<string, number>;
  demo?: { schemaName: string; schemaVersion: string; tenantId: string };
}

export async function runSeed(options: {
  platform?: boolean;
  demo?: boolean;
}): Promise<SeedResult> {
  const logger = new Logger('Seed');
  const ctx = await createSeedContext();
  const result: SeedResult = { platform: {} };

  try {
    if (options.platform !== false) {
      logger.log('Menjalankan seed control plane…');
      const { summary } = await ctx.platformSeed.seedAll();
      result.platform = summary;
    }

    if (options.demo) {
      logger.log('Menyiapkan sandbox demo…');
      result.demo = await provisionDemo(ctx);
    }

    return result;
  } finally {
    await ctx.app.close();
  }
}

/** Provision schema `demo` + `demo__audit` secara idempotent. */
export async function provisionDemo(
  ctx: Awaited<ReturnType<typeof createSeedContext>>,
): Promise<{ schemaName: string; schemaVersion: string; tenantId: string }> {
  const logger = new Logger('SeedDemo');
  const demoSchema = ctx.config.get<string>('schema.demo', 'demo');

  let tenant = await ctx.prisma.tenant.findUnique({ where: { code: 'DEMO' } });
  if (!tenant) {
    tenant = await ctx.prisma.tenant.create({
      data: {
        code: 'DEMO',
        name: 'PT Demo eBisnis Indonesia',
        slug: 'demo',
        status: 'PROVISIONING',
        isDemo: true,
        isSystem: true,
        localeCode: 'id',
      },
    });
  }

  const registry = await ctx.prisma.tenantSchemaRegistry.findUnique({
    where: { tenantId: tenant.id },
  });

  if (registry?.status === 'READY') {
    // Sudah ada — cukup terapkan migration terbaru dan seed ulang (idempotent).
    await ctx.provisioner.migrateTenant(tenant.id);
    await ctx.masterSeed.seedTenant(registry.schemaName);
    // Subject demo dipastikan ada juga pada schema yang diprovision sebelum
    // fitur ini dibuat, agar sesi demo memiliki permission dan menu.
    await ctx.bootstrap.createDemoSubject(registry.schemaName);
    logger.log(`Schema demo "${registry.schemaName}" diperbarui.`);
    return {
      schemaName: registry.schemaName,
      schemaVersion: registry.schemaVersion,
      tenantId: tenant.id,
    };
  }

  const provisioned = await ctx.provisioner.provision({
    tenantId: tenant.id,
    desiredUsername: demoSchema,
    businessName: 'PT Demo eBisnis Indonesia',
    businessType: 'Cafe & Retail',
    contactPerson: 'Pengguna Demo',
    isDemo: true,
    includeStarterTransactions: true,
  });

  logger.log(`Schema demo "${provisioned.schemaName}" siap.`);
  return {
    schemaName: provisioned.schemaName,
    schemaVersion: provisioned.schemaVersion,
    tenantId: tenant.id,
  };
}
