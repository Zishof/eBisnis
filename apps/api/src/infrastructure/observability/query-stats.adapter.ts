/**
 * Adapter statistik kueri PostgreSQL.
 *
 * ## Melaporkan tidak tersedia, bukan mengarang angka
 *
 * Agregat kueri menuntut ekstensi `pg_stat_statements`. Ekstensi itu **tidak
 * terpasang** pada basis data pengembangan, dan memasangnya menuntut mengubah
 * `shared_preload_libraries` lalu memulai ulang server — perubahan konfigurasi
 * yang bukan wewenang aplikasi.
 *
 * Yang dilakukan adapter ini: memeriksa keberadaannya, dan mengatakan apa
 * adanya bila tidak ada. Mengarang angka kinerja kueri akan membuat orang
 * mengoptimalkan sesuatu yang tidak pernah diukur.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type QueryStatsStatus = 'AVAILABLE' | 'EXTENSION_MISSING' | 'NOT_PERMITTED' | 'ERROR';

export interface QueryStatsResult {
  status: QueryStatsStatus;
  /** Penjelasan yang dapat dibaca, termasuk cara mengaktifkannya. */
  note: string;
  rows: QueryStatRow[];
}

export interface QueryStatRow {
  queryId: string;
  /** Teks kueri sudah dinormalkan PostgreSQL: nilainya sudah diganti `$1`. */
  queryText: string;
  calls: number;
  totalExecMs: number;
  meanExecMs: number;
  maxExecMs: number;
  rows: number;
  sharedBlksHit: number;
  sharedBlksRead: number;
}

@Injectable()
export class QueryStatsAdapter {
  private readonly logger = new Logger(QueryStatsAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Apakah ekstensinya terpasang. */
  async isAvailable(): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRaw<{ ada: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) AS ada`;
      return rows[0]?.ada === true;
    } catch {
      return false;
    }
  }

  /**
   * Kueri paling lambat.
   *
   * Teks kueri yang dikembalikan `pg_stat_statements` sudah dinormalkan: nilai
   * literal diganti `$1`, `$2`, dan seterusnya. Itu berarti nomor rekening dan
   * kata sandi yang pernah masuk kueri **tidak** muncul di sini — normalisasinya
   * dilakukan PostgreSQL, bukan oleh kita.
   */
  async topSlowQueries(limit = 20): Promise<QueryStatsResult> {
    if (!(await this.isAvailable())) {
      return {
        status: 'EXTENSION_MISSING',
        note:
          'Ekstensi pg_stat_statements belum terpasang. Mengaktifkannya menuntut ' +
          "menambahkan 'pg_stat_statements' pada shared_preload_libraries, memulai " +
          'ulang PostgreSQL, lalu menjalankan CREATE EXTENSION pg_stat_statements. ' +
          'Keduanya perubahan konfigurasi server yang perlu dilakukan operator.',
        rows: [],
      };
    }

    try {
      const rows = await this.prisma.$queryRaw<
        {
          queryid: bigint | null;
          query: string;
          calls: bigint;
          total_exec_time: number;
          mean_exec_time: number;
          max_exec_time: number;
          rows: bigint;
          shared_blks_hit: bigint;
          shared_blks_read: bigint;
        }[]
      >`
        SELECT queryid, query, calls, total_exec_time, mean_exec_time, max_exec_time,
               rows, shared_blks_hit, shared_blks_read
          FROM pg_stat_statements
         WHERE query NOT ILIKE '%pg_stat_statements%'
         ORDER BY total_exec_time DESC
         LIMIT ${limit}`;

      return {
        status: 'AVAILABLE',
        note: `${rows.length} kueri teratas menurut total waktu eksekusi.`,
        rows: rows.map((row) => ({
          queryId: String(row.queryid ?? ''),
          // Dipotong: satu kueri yang sangat panjang dapat memenuhi tampilan.
          queryText: row.query.length > 1000 ? `${row.query.slice(0, 1000)}…` : row.query,
          calls: Number(row.calls),
          totalExecMs: Math.round(row.total_exec_time),
          meanExecMs: Math.round(row.mean_exec_time * 100) / 100,
          maxExecMs: Math.round(row.max_exec_time),
          rows: Number(row.rows),
          sharedBlksHit: Number(row.shared_blks_hit),
          sharedBlksRead: Number(row.shared_blks_read),
        })),
      };
    } catch (error) {
      const message = (error as Error).message;
      // Ekstensi terpasang tetapi pengguna basis data tidak berhak membacanya.
      // Ini keadaan yang berbeda dari ekstensi yang tidak ada, dan penyelesaiannya
      // juga berbeda.
      const notPermitted = /permission denied|must be superuser/i.test(message);
      this.logger.warn(`Statistik kueri gagal dibaca: ${message}`);
      return {
        status: notPermitted ? 'NOT_PERMITTED' : 'ERROR',
        note: notPermitted
          ? 'Ekstensi terpasang tetapi pengguna basis data tidak berhak membacanya. ' +
            'Berikan pg_read_all_stats kepada pengguna aplikasi.'
          : `Statistik kueri tidak dapat dibaca: ${message}`,
        rows: [],
      };
    }
  }
}

/**
 * Menilai rasio cache dari statistik blok.
 *
 * Rasio rendah berarti banyak pembacaan dari cakram — sering kali penyebab
 * kueri lambat yang tidak terlihat dari rencana eksekusi.
 */
export function cacheHitRatio(sharedBlksHit: number, sharedBlksRead: number): number | null {
  const total = sharedBlksHit + sharedBlksRead;
  // Kueri yang tidak menyentuh blok sama sekali tidak punya rasio cache;
  // mengembalikan 1 akan menyiratkan kondisi sempurna yang tidak pernah diukur.
  if (total === 0) return null;
  return Math.round((sharedBlksHit / total) * 1000) / 1000;
}
