/**
 * Katalog peristiwa akuntansi pesanan penjualan (Sales Order).
 *
 * Didaftarkan ke `AccountingEventCatalogRegistry` milik Core lewat
 * `TenantModule`, pola yang sama dengan `purchasing-events.catalog.ts` dan
 * `cooperative-events.catalog.ts` (IR-003).
 *
 * Bentuknya sengaja disamakan persis dengan peristiwa kasir (`POS_SALE`,
 * `POS_DISCOUNT`, `POS_COGS`, `POS_INVENTORY_RELEASE` pada
 * `posting-engine.ts`) — nama medan nilai yang sama (`gross`, `net`, `tax`,
 * `discountAmount`, `cost`, `inventoryValue`) berarti operator tenant yang
 * sudah menyemai aturan posting untuk kasir dapat menyalinnya untuk pesanan
 * penjualan, bukan mempelajari kosakata baru.
 *
 * Pendaftaran ini TIDAK membuat peristiwanya dijurnal — lihat catatan yang
 * sama pada `purchasing-events.catalog.ts`.
 */

import type { AccountingEventCatalog } from '../accounting/event-catalog.registry';

const EVENTS = [
  'SALES_ORDER_INVOICED',
  'SALES_ORDER_DISCOUNT',
  'SALES_ORDER_COGS',
  'SALES_ORDER_INVENTORY_RELEASE',
] as const;

export type SalesOrderEventCode = (typeof EVENTS)[number];

export const SALES_ORDER_EVENT_CATALOG: AccountingEventCatalog = {
  module: 'sales',
  prefix: 'SALES_ORDER_',
  events: EVENTS,
  requiredAmounts: {
    // Gross adalah subtotal SEBELUM diskon; net adalah grand_total dikurangi
    // pajak. Pendapatan dan pajak keluaran masuk akun berbeda, dan menebak
    // pembagiannya dari gross saja berarti menebak berapa pajak terutang —
    // sama seperti alasan POS_SALE menuntut ketiganya.
    SALES_ORDER_INVOICED: ['gross', 'net', 'tax'],
    SALES_ORDER_DISCOUNT: ['discountAmount'],
    SALES_ORDER_COGS: ['cost'],
    SALES_ORDER_INVENTORY_RELEASE: ['inventoryValue'],
  },
};
