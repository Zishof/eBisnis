/**
 * Modul akuntansi.
 *
 * Sebelum ini `posting-engine.ts` hanyalah sekumpulan fungsi murni tanpa modul
 * Nest sendiri — dan itu cukup selama katalog peristiwanya tertutup.
 *
 * Dengan IR-003 katalog itu menjadi terbuka bagi modul vertikal, dan sesuatu
 * harus memiliki registrinya. Modul inilah pemiliknya, dan ia mendaftarkan
 * katalog inti pada saat dimuat — lewat pintu yang sama dengan vertikal,
 * tanpa perlakuan istimewa.
 */

import { Module, type OnModuleInit } from '@nestjs/common';
import { AccountingEventCatalogRegistry } from './event-catalog.registry';
import { CORE_EVENT_CATALOGS } from './core-event-catalog';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountingEventsController } from './accounting-events.controller';

@Module({
  controllers: [AccountingEventsController],
  providers: [AccountingEventCatalogRegistry, AccountingPostingService],
  exports: [AccountingEventCatalogRegistry, AccountingPostingService],
})
export class AccountingModule implements OnModuleInit {
  constructor(private readonly registry: AccountingEventCatalogRegistry) {}

  onModuleInit(): void {
    /*
     * Katalog inti didaftarkan lebih dahulu supaya modul vertikal yang
     * mendaftar sesudahnya bertabrakan dengannya secara terbuka — bukan
     * menimpanya diam-diam.
     */
    for (const catalog of CORE_EVENT_CATALOGS) {
      if (this.registry.registeredCatalogs().includes(`${catalog.module}:${catalog.prefix}`)) {
        continue;
      }
      this.registry.register(catalog);
    }
  }
}
