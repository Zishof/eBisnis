/**
 * Katalog peristiwa akuntansi pembelian.
 *
 * Didaftarkan ke `AccountingEventCatalogRegistry` milik Core lewat
 * `TenantModule`, mengikuti pola yang sama dengan
 * `cooperative-events.catalog.ts` (IR-003).
 *
 * ## Yang disediakan di sini, dan yang tidak
 *
 * Pendaftaran ini membuat `PURCHASE_GOODS_RECEIPT_VALUED` dikenal mesin
 * akuntansi — peristiwa yang diterbitkan dapat diperiksa kelengkapannya
 * sebelum ditulis. Ia TIDAK membuat peristiwanya dijurnal: saluran
 * peristiwa-ke-jurnal belum dibangun untuk modul mana pun pada codebase ini
 * — POS dan koperasi pun peristiwanya masih menunggu (lihat komentar
 * `cooperative-events.catalog.ts`). Ini bukan celah yang dibuka berkas ini,
 * melainkan keadaan yang sudah ada sebelumnya dan berlaku sama bagi seluruh
 * modul.
 *
 * Satu peristiwa, satu nilai (`inventoryValue`), dipakai KEDUA sisi jurnal
 * (debit persediaan, kredit hutang dagang) lewat dua baris
 * `accounting_posting_rule` yang menunjuk medan yang sama — bukan dua
 * peristiwa terpisah. Itulah yang membuat jurnalnya seimbang dengan
 * sendirinya begitu aturan postingnya disemai oleh operator tenant.
 */

import type { AccountingEventCatalog } from '../accounting/event-catalog.registry';

const EVENTS = ['PURCHASE_GOODS_RECEIPT_VALUED'] as const;

export type PurchaseEventCode = (typeof EVENTS)[number];

export const PURCHASE_EVENT_CATALOG: AccountingEventCatalog = {
  module: 'purchasing',
  prefix: 'PURCHASE_',
  events: EVENTS,
  requiredAmounts: {
    PURCHASE_GOODS_RECEIPT_VALUED: ['inventoryValue'],
  },
};
