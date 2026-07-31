/**
 * Pembacaan jejak perubahan baris.
 *
 * ## Datanya sudah ada sejak V003
 *
 * Trigger audit sudah menulis `audit_row_change` sejak skema tenant pertama
 * dibuat, dan pada basis data pengembangan sudah terkumpul belasan ribu baris.
 * Yang belum ada adalah cara membacanya: tanpa itu, jejak yang lengkap sama
 * tidak bergunanya dengan jejak yang tidak ada.
 *
 * ## Tiga pertanyaan yang dijawab
 *
 * 1. *Apa yang berubah belakangan ini, dan pada tabel apa?*
 * 2. *Siapa mengubah apa?*
 * 3. *Seluruh riwayat satu baris tertentu* — pertanyaan yang paling sering
 *    muncul saat ada yang janggal pada sebuah dokumen.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/** Batas baris per halaman. */
const MAX_LIMIT = 200;

/**
 * Kolom yang isinya tidak boleh ikut ditampilkan.
 *
 * `old_data` dan `new_data` memuat isi baris apa adanya, termasuk kolom yang
 * seharusnya tidak pernah dibaca ulang. Trigger audit sudah menyaringnya saat
 * menulis, tetapi penyaringan kedua di sini menjaga agar tabel lama yang
 * ditulis sebelum penyaringan itu ada tetap aman dibaca.
 */
const KOLOM_RAHASIA = new Set([
  'password_hash',
  'password',
  'token_hash',
  'refresh_token',
  'access_token',
  'secret',
  'api_key',
  'private_key',
  'credential',
  'client_secret',
]);

@Injectable()
export class TableAuditService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Ringkasan per tabel.
   *
   * Yang menarik biasanya bukan tabel dengan perubahan terbanyak — tabel
   * transaksi memang selalu paling banyak — melainkan tabel **master** yang
   * berubah sering. Master data yang berubah tiap hari menandai konfigurasi
   * yang belum mapan, atau seseorang yang mengubahnya berulang kali.
   */
  async tableSummary(schema: string, days: number) {
    const rows = await this.tenantDb.query<{
      table_name: string;
      inserts: string;
      updates: string;
      deletes: string;
      editors: string;
      last_change: Date;
    }>(
      schema,
      `SELECT rc.table_name,
              count(*) FILTER (WHERE rc.operation = 'INSERT') AS inserts,
              count(*) FILTER (WHERE rc.operation = 'UPDATE') AS updates,
              count(*) FILTER (WHERE rc.operation = 'DELETE') AS deletes,
              count(DISTINCT e.actor_user_id) AS editors,
              max(rc.statement_timestamp) AS last_change
         FROM "${schema}__audit".audit_row_change rc
         LEFT JOIN "${schema}__audit".audit_event e ON e.id = rc.audit_event_id
        WHERE rc.statement_timestamp >= now() - ($1 || ' days')::interval
        GROUP BY rc.table_name
        ORDER BY count(*) DESC`,
      [String(days)],
    );

    return {
      sinceDays: days,
      items: rows.map((row) => ({
        tableName: row.table_name,
        inserts: Number(row.inserts),
        updates: Number(row.updates),
        deletes: Number(row.deletes),
        total: Number(row.inserts) + Number(row.updates) + Number(row.deletes),
        distinctEditors: Number(row.editors),
        lastChangeAt: row.last_change,
      })),
    };
  }

  /**
   * Ringkasan per pelaku.
   *
   * Penghapusan ditampilkan tersendiri, bukan dilebur ke dalam total. Seratus
   * penyuntingan dan seratus penghapusan adalah dua keadaan yang sangat
   * berbeda, dan angka gabungan menyembunyikan perbedaan itu.
   */
  async actorSummary(schema: string, days: number) {
    const rows = await this.tenantDb.query<{
      actor_user_id: string | null;
      actor_username: string | null;
      inserts: string;
      updates: string;
      deletes: string;
      tables: string;
      last_change: Date;
    }>(
      schema,
      `SELECT e.actor_user_id::text, e.actor_username,
              count(*) FILTER (WHERE rc.operation = 'INSERT') AS inserts,
              count(*) FILTER (WHERE rc.operation = 'UPDATE') AS updates,
              count(*) FILTER (WHERE rc.operation = 'DELETE') AS deletes,
              count(DISTINCT rc.table_name) AS tables,
              max(rc.statement_timestamp) AS last_change
         FROM "${schema}__audit".audit_row_change rc
         JOIN "${schema}__audit".audit_event e ON e.id = rc.audit_event_id
        WHERE rc.statement_timestamp >= now() - ($1 || ' days')::interval
        GROUP BY e.actor_user_id, e.actor_username
        ORDER BY count(*) DESC
        LIMIT 100`,
      [String(days)],
    );

    return {
      sinceDays: days,
      items: rows.map((row) => ({
        actorUserId: row.actor_user_id,
        actorUsername: row.actor_username,
        inserts: Number(row.inserts),
        updates: Number(row.updates),
        deletes: Number(row.deletes),
        distinctTables: Number(row.tables),
        lastChangeAt: row.last_change,
      })),
    };
  }

  /**
   * Seluruh riwayat satu baris.
   *
   * Inilah pertanyaan yang paling sering muncul: "dokumen ini nilainya salah,
   * siapa yang mengubahnya dan kapan". Yang dikembalikan bukan hanya daftar
   * perubahan melainkan kolom mana yang berubah beserta nilai sebelum dan
   * sesudahnya.
   */
  async rowHistory(schema: string, tableName: string, rowPk: string) {
    // Nama tabel dipakai sebagai NILAI parameter, bukan disisipkan ke dalam
    // teks kueri. Nama tabel dari permintaan yang disisipkan langsung adalah
    // jalan masuk injeksi yang paling sering terlewat.
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(tableName)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nama tabel tidak sah.');
    }

    /*
     * `row_pk` bukan teks melainkan jsonb berisi seluruh kolom kunci, mis.
     * `{"id": "8f3c…"}`. Bentuk itu memang perlu: sebagian tabel berkunci
     * gabungan, dan menyimpannya sebagai satu teks akan membuat kunci
     * gabungan tidak dapat dipisahkan kembali.
     *
     * Akibatnya pencocokan tidak dapat memakai kesamaan biasa. Dua bentuk
     * diterima: id tunggal untuk tabel berkunci tunggal, dan JSON utuh untuk
     * tabel berkunci gabungan.
     */
    const rows = await this.tenantDb.query<{
      id: string;
      operation: string;
      row_pk: Record<string, unknown>;
      changed_columns: string[] | null;
      old_data: Record<string, unknown> | null;
      new_data: Record<string, unknown> | null;
      statement_timestamp: Date;
      actor_username: string | null;
      action_code: string | null;
      active_role_code: string | null;
      request_id: string | null;
    }>(
      schema,
      `SELECT rc.id::text, rc.operation, rc.row_pk, rc.changed_columns, rc.old_data, rc.new_data,
              rc.statement_timestamp, e.actor_username, e.action_code, e.active_role_code,
              e.request_id
         FROM "${schema}__audit".audit_row_change rc
         LEFT JOIN "${schema}__audit".audit_event e ON e.id = rc.audit_event_id
        WHERE rc.table_name = $1
          AND (rc.row_pk->>'id' = $2 OR rc.row_pk::text = $2)
        ORDER BY rc.statement_timestamp DESC
        LIMIT ${MAX_LIMIT}`,
      [tableName, rowPk],
    );

    return {
      tableName,
      rowPk,
      changeCount: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        operation: row.operation,
        occurredAt: row.statement_timestamp,
        actorUsername: row.actor_username,
        // Dalam kapasitas apa perubahan ini dibuat. Terisi sejak V10-5;
        // kosong pada baris yang lebih tua.
        activeRoleCode: row.active_role_code,
        actionCode: row.action_code,
        requestId: row.request_id,
        rowKey: row.row_pk,
        changes: describeChanges(row.changed_columns, row.old_data, row.new_data),
      })),
    };
  }
}

/**
 * Menjelaskan apa yang berubah, kolom demi kolom.
 *
 * Menampilkan `old_data` dan `new_data` utuh berarti pembacanya harus
 * membandingkan dua objek besar dengan mata sendiri untuk menemukan satu kolom
 * yang berubah. Yang berguna adalah perbedaannya, bukan kedua keadaannya.
 */
export function describeChanges(
  changedColumns: string[] | null,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): Array<{ column: string; before: unknown; after: unknown }> {
  // `changed_columns` diisi trigger hanya pada UPDATE. Untuk INSERT dan DELETE
  // seluruh kolom yang terisi dianggap berubah — dan itu memang benar: sebelum
  // INSERT tidak ada apa pun, sesudah DELETE tidak tersisa apa pun.
  const kolom =
    changedColumns && changedColumns.length > 0
      ? changedColumns
      : [...new Set([...Object.keys(newData ?? {}), ...Object.keys(oldData ?? {})])];

  return kolom
    .filter((nama) => !KOLOM_RAHASIA.has(nama))
    .map((nama) => ({
      column: nama,
      before: ringkas(oldData?.[nama]),
      after: ringkas(newData?.[nama]),
    }))
    // Kolom yang nilainya tidak benar-benar berbeda dibuang. Trigger kadang
    // menandai kolom sebagai berubah padahal nilainya sama — mis. saat baris
    // ditulis ulang utuh — dan menampilkannya membuat pembacanya mencari
    // perbedaan yang tidak ada.
    .filter((c) => JSON.stringify(c.before) !== JSON.stringify(c.after));
}

/**
 * Memotong nilai yang terlalu panjang.
 *
 * Satu kolom teks berisi seratus ribu karakter akan membuat riwayat satu baris
 * tidak dapat dibuka sama sekali.
 */
function ringkas(nilai: unknown): unknown {
  if (typeof nilai === 'string' && nilai.length > 500) {
    return `${nilai.slice(0, 500)}… (${nilai.length} karakter)`;
  }
  return nilai ?? null;
}
