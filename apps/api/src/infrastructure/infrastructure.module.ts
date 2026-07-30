import { Global, Module } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { TenantConnectionService } from './database/tenant-connection.service';
import { TenantMigrationService } from './provisioning/tenant-migration.service';
import { TenantBootstrapService } from './provisioning/tenant-bootstrap.service';
import { SchemaProvisionerService } from './provisioning/schema-provisioner.service';
import { AuditService } from './audit/audit.service';
import { NumberSequenceService } from './sequence/number-sequence.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { MasterSeedService } from '../modules/master-seed/master-seed.service';
import { PlatformSeedService } from '../modules/master-seed/platform-seed.service';
import { CmsSeedService } from '../modules/master-seed/cms-seed.service';
import { DataScopeResolver } from './authorization/data-scope.resolver';
import { SecretBoxService } from './crypto/secret-box.service';

/**
 * Modul infrastruktur global: akses database platform, akses schema tenant,
 * provisioner, audit, penomoran dokumen, idempotency, dan seed registry.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    TenantConnectionService,
    TenantMigrationService,
    TenantBootstrapService,
    SchemaProvisionerService,
    AuditService,
    NumberSequenceService,
    IdempotencyService,
    DataScopeResolver,
    SecretBoxService,
    MasterSeedService,
    PlatformSeedService,
    CmsSeedService,
  ],
  exports: [
    PrismaService,
    TenantConnectionService,
    TenantMigrationService,
    TenantBootstrapService,
    SchemaProvisionerService,
    AuditService,
    NumberSequenceService,
    IdempotencyService,
    DataScopeResolver,
    SecretBoxService,
    MasterSeedService,
    PlatformSeedService,
    CmsSeedService,
  ],
})
export class InfrastructureModule {}
