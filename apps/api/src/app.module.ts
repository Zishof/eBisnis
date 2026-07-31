import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { appConfig } from './config/configuration';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { PublicModule } from './modules/public/public.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { BillingModule } from './modules/billing/billing.module';
import { PaymentModule } from './modules/payment/payment.module';
import { CmsModule } from './modules/cms/cms.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { SeedAdminModule } from './modules/seed-admin/seed-admin.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { ListingModule } from './modules/listing/listing.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CheckoutModule } from './modules/checkout/checkout.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig], cache: true }),
    // Dipakai memeriksa bahwa setiap route menyatakan hak aksesnya saat aplikasi
    // menyala; lihat common/security/route-authorization.audit.ts.
    DiscoveryModule,
    ScheduleModule.forRoot(),
    // Batas rate berasal dari konfigurasi agar environment pengujian otomatis
    // (Playwright, smoke test) tidak menabrak proteksi yang ditujukan untuk
    // trafik produksi. Nilai bawaan tetap konservatif.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { name: 'default', ttl: 60_000, limit: config.get<number>('throttle.defaultLimit', 300) },
        { name: 'auth', ttl: 60_000, limit: config.get<number>('throttle.authLimit', 10) },
      ],
    }),
    InfrastructureModule,
    HealthModule,
    AuthModule,
    PublicModule,
    PlatformAdminModule,
    PricingModule,
    BillingModule,
    PaymentModule,
    CmsModule,
    SeedAdminModule,
    MarketplaceModule,
    StorefrontModule,
    ListingModule,
    CatalogModule,
    CheckoutModule,
    // TenantModule didaftarkan TERAKHIR: MasterController memakai route
    // wildcard `:resource`, sehingga harus dicocokkan setelah seluruh route
    // spesifik seperti /devices, /sample-data, dan /billing.
    TenantModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
