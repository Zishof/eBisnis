import { Global, Module, type OnModuleInit } from '@nestjs/common';
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
import { ErrorCaptureService } from './observability/error-capture.service';
import { PerformanceCollectorService } from './observability/performance-collector.service';
import { QueryStatsAdapter } from './observability/query-stats.adapter';
import { OllamaAdapter } from './ai/ollama.adapter';
import { ModelCatalogService } from './ai/model-catalog.service';
import { EmbeddingService } from './ai/embedding.service';
import { VerticalCatalogRegistry } from './provisioning/vertical-catalog.registry';
import { VERTICAL_CATALOGS } from './provisioning/vertical-catalogs';
import { PublicTenantResolver } from './tenant/public-tenant-resolver.service';
import { TenantFileBlobService } from './files/tenant-file-blob.service';
import { ProductMediaService } from './files/product-media.service';

/**
 * Modul infrastruktur global: akses database platform, akses schema tenant,
 * provisioner, audit, penomoran dokumen, idempotency, dan seed registry.
 */
@Global()
@Module({
  providers: [
    VerticalCatalogRegistry,
    PublicTenantResolver,
    TenantFileBlobService,
    ProductMediaService,
    OllamaAdapter,
    ModelCatalogService,
    EmbeddingService,
    PerformanceCollectorService,
    QueryStatsAdapter,
    ErrorCaptureService,
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
    VerticalCatalogRegistry,
    PublicTenantResolver,
    TenantFileBlobService,
    ProductMediaService,
    OllamaAdapter,
    ModelCatalogService,
    EmbeddingService,
    PerformanceCollectorService,
    QueryStatsAdapter,
    ErrorCaptureService,
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
export class InfrastructureModule implements OnModuleInit {
  constructor(private readonly catalogs: VerticalCatalogRegistry) {}

  /**
   * Katalog inti didaftarkan lebih dahulu, sebelum modul vertikal mana pun.
   *
   * Urutan ini penting: vertikal yang mendaftar sesudahnya akan bertabrakan
   * dengan menu inti secara terbuka, bukan menimpanya diam-diam.
   */
  onModuleInit(): void {
    for (const catalog of VERTICAL_CATALOGS) {
      if (this.catalogs.registeredCodes().includes(catalog.code)) continue;
      this.catalogs.register(catalog);
    }
    /*
     * Diperiksa setelah semuanya terdaftar. Menu yatim tidak menimbulkan galat
     * apa pun — ia hanya tidak pernah muncul di layar — jadi lebih baik
     * ditolak saat aplikasi dimuat daripada ditemukan penyewa.
     */
    this.catalogs.validateTree();
  }
}
