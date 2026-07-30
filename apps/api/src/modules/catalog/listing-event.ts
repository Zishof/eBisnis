/**
 * Peristiwa listing yang dititipkan tenant untuk katalog publik.
 *
 * Ditulis ke `sync_outbox` **di dalam transaksi yang sama** dengan perubahan
 * listing. Itu intinya: kalau penerbitan berhasil tetapi peristiwanya gagal
 * ditulis, katalog publik akan diam-diam tertinggal tanpa ada yang tahu.
 * Satu transaksi membuat keduanya berhasil bersama atau gagal bersama.
 *
 * Tabel `sync_outbox` sudah ada sejak V007 tetapi belum dipakai satu pun
 * layanan — audit V9-0 mencatatnya sebagai tabel tanpa pemakai. Katalog
 * menjadi pemakai pertamanya; tidak ada tabel antrean kedua yang dibuat.
 */

import type { PoolClient } from 'pg';

export type ListingEventOperation = 'PUBLISH' | 'UPDATE' | 'UNPUBLISH';

export interface ListingEventPayload {
  listingId: string;
  /** Alasan penarikan, hanya untuk `UNPUBLISH`. Ikut agar jejaknya lengkap. */
  reason?: string;
}

/**
 * Menitipkan peristiwa listing pada outbox tenant.
 *
 * `eventId` dibentuk dari operasi, id listing, dan cap waktu transaksi.
 * Cap waktu diambil dari `clock_timestamp()` basis data, bukan dari jam
 * aplikasi, sehingga dua server aplikasi dengan jam yang berbeda tidak
 * menghasilkan urutan yang bertentangan.
 */
export async function enqueueListingEvent(
  client: PoolClient,
  schemaName: string,
  operation: ListingEventOperation,
  payload: ListingEventPayload,
): Promise<void> {
  await client.query(
    `INSERT INTO "${schemaName}".sync_outbox
       (event_id, entity_type, entity_id, operation, payload, status)
     VALUES (
       $1 || ':' || $2 || ':' || extract(epoch from clock_timestamp())::bigint::text,
       'online_listing', $2::uuid, $1, $3::jsonb, 'PENDING'
     )`,
    [operation, payload.listingId, JSON.stringify(payload)],
  );
}
