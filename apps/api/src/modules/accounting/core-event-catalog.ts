/**
 * Katalog peristiwa akuntansi milik inti, dalam bentuk yang sama dengan modul.
 *
 * Inti mendaftarkan katalognya lewat pintu yang sama dengan vertikal, tanpa
 * perlakuan istimewa. Bila inti istimewa, jalur inti dan jalur modul akan
 * berbeda perilakunya — dan yang jarang dipakai akan membusuk tanpa ada yang
 * tahu, sampai vertikal pertama mencoba memakainya.
 *
 * Isinya diturunkan dari `ALL_EVENTS` dan `REQUIRED_AMOUNTS` yang sudah ada,
 * bukan disalin. Menyalinnya akan menghasilkan dua daftar yang harus dijaga
 * tetap sama, dan suatu hari salah satunya berubah sendiri.
 */

import type { AccountingEventCatalog } from './event-catalog.registry';
import {
  MARKETPLACE_EVENTS,
  POS_EVENTS,
  REQUIRED_AMOUNTS,
  type KnownEventCode,
} from './posting-engine';

function ambilNilaiWajib(events: readonly string[]): Record<string, readonly string[]> {
  return Object.fromEntries(
    events.map((e) => [e, REQUIRED_AMOUNTS[e as KnownEventCode]]),
  );
}

export const MARKETPLACE_EVENT_CATALOG: AccountingEventCatalog = {
  module: 'core',
  prefix: 'MARKETPLACE_',
  events: MARKETPLACE_EVENTS,
  requiredAmounts: ambilNilaiWajib(MARKETPLACE_EVENTS),
};

export const POS_EVENT_CATALOG: AccountingEventCatalog = {
  module: 'core',
  prefix: 'POS_',
  events: POS_EVENTS,
  requiredAmounts: ambilNilaiWajib(POS_EVENTS),
};

/**
 * Dua katalog, bukan satu.
 *
 * Marketplace dan kasir adalah dua kelompok peristiwa yang berbeda dan dapat
 * dimatikan sendiri-sendiri — penyewa yang hanya memakai kasir tidak perlu
 * peristiwa marketplace terdaftar sama sekali. Memisahkannya sekarang lebih
 * murah daripada memisahkannya nanti.
 */
export const CORE_EVENT_CATALOGS: AccountingEventCatalog[] = [
  MARKETPLACE_EVENT_CATALOG,
  POS_EVENT_CATALOG,
];
