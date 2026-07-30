import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { TenantMigrationService } from '../../infrastructure/provisioning/tenant-migration.service';
import { Public } from '../../common/decorators';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';

@ApiTags('public')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly migrations: TenantMigrationService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check aplikasi dan database' })
  async health() {
    const startedAt = Date.now();
    let database: 'up' | 'down' = 'down';
    let tenantCount = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
      tenantCount = await this.prisma.tenantSchemaRegistry.count({ where: { status: 'READY' } });
    } catch {
      database = 'down';
    }

    return rawResponse({
      status: database === 'up' ? 'ok' : 'degraded',
      app: this.config.get<string>('appName', 'eBisnis.id'),
      version: '0.1.0',
      environment: this.config.get<string>('nodeEnv', 'development'),
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks: {
        database,
        tenantSchemas: tenantCount,
        tenantClientCache: this.tenantDb.cacheSize(),
        tenantMigrationVersion: this.migrations.latestVersion(),
      },
    });
  }

  @Public()
  @Get('api/v1/health')
  @ApiOperation({ summary: 'Health check (prefixed)' })
  async healthPrefixed() {
    return this.health();
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
