import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

@Injectable()
export class NumberSequenceService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Mengambil nomor dokumen berikutnya dengan row lock sehingga aman terhadap
   * pemanggilan bersamaan. Harus dipanggil di dalam transaksi.
   */
  async next(client: PoolClient, schemaName: string, code: string): Promise<string> {
    const result = await client.query<{
      id: string;
      prefix: string;
      suffix: string;
      padding: number;
      next_number: string;
      reset_policy: string;
      last_reset_at: Date | null;
    }>(
      `SELECT id::text AS id, prefix, suffix, padding, next_number::text AS next_number,
              reset_policy, last_reset_at
       FROM "${schemaName}".number_sequence
       WHERE code = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [code],
    );

    const row = result.rows[0];
    if (!row) {
      throw AppError.internal(
        ErrorCodes.RESOURCE_NOT_CONFIGURED,
        `Penomoran dokumen "${code}" belum dikonfigurasi pada schema ${schemaName}.`,
      );
    }

    let nextNumber = Number(row.next_number);
    const now = new Date();
    let resetApplied = false;

    if (row.reset_policy !== 'NEVER' && row.last_reset_at) {
      const last = new Date(row.last_reset_at);
      const needsReset =
        (row.reset_policy === 'DAILY' && last.toDateString() !== now.toDateString()) ||
        (row.reset_policy === 'MONTHLY' &&
          (last.getUTCFullYear() !== now.getUTCFullYear() ||
            last.getUTCMonth() !== now.getUTCMonth())) ||
        (row.reset_policy === 'YEARLY' && last.getUTCFullYear() !== now.getUTCFullYear());
      if (needsReset) {
        nextNumber = 1;
        resetApplied = true;
      }
    } else if (row.reset_policy !== 'NEVER' && !row.last_reset_at) {
      resetApplied = true;
    }

    await client.query(
      `UPDATE "${schemaName}".number_sequence
       SET next_number = $2, updated_at = now(), version = version + 1
           ${resetApplied ? ', last_reset_at = now()' : ''}
       WHERE id = $1`,
      [row.id, nextNumber + 1],
    );

    const datePart =
      row.reset_policy === 'DAILY'
        ? `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1, 2)}${pad(now.getUTCDate(), 2)}-`
        : row.reset_policy === 'MONTHLY'
          ? `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1, 2)}-`
          : row.reset_policy === 'YEARLY'
            ? `${now.getUTCFullYear()}-`
            : '';

    return `${row.prefix}${datePart}${pad(nextNumber, row.padding)}${row.suffix}`;
  }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
