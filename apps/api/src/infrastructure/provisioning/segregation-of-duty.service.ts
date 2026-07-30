import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';

/**
 * Penegakan pemisahan tugas saat role ditetapkan ke pengguna.
 *
 * Tanpa lapisan ini tabel SoD hanya menjadi dokumentasi: aturannya tercatat
 * rapi tetapi tidak ada yang menghalangi satu orang memegang penyiap sekaligus
 * penyetuju jurnal.
 *
 * Pemeriksaan dilakukan saat PENETAPAN, bukan saat transaksi. Alasannya, pada
 * saat transaksi konfliknya sudah terlanjur ada dan yang tersisa hanyalah
 * menolak pekerjaan orang yang sudah terlanjur diberi hak.
 */

export interface SodConflict {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  severity: string;
  enforcement: string;
  existingRoleId: string;
  existingRoleCode: string;
  existingRoleName: string;
  existingSide: string;
  attemptedSide: string;
}

export interface SodCheckResult {
  allowed: boolean;
  conflicts: SodConflict[];
  /** Konflik yang dilewatkan karena ada pengecualian tertulis yang masih berlaku. */
  waived: SodConflict[];
}

@Injectable()
export class SegregationOfDutyService {
  private readonly logger = new Logger(SegregationOfDutyService.name);

  /**
   * Memeriksa apakah `roleId` boleh ditetapkan kepada `userSubjectId`.
   *
   * Konflik terjadi bila pengguna sudah memegang role lain yang berada dalam
   * kelompok aturan yang sama tetapi pada SISI berbeda. Sisi yang sama tidak
   * pernah berkonflik: dua penyetuju jurnal adalah hal biasa.
   */
  async check(
    client: PoolClient,
    schema: string,
    userSubjectId: string,
    roleId: string,
  ): Promise<SodCheckResult> {
    const { rows } = await client.query<{
      rule_id: string;
      rule_code: string;
      rule_name: string;
      severity: string;
      enforcement: string;
      existing_role_id: string;
      existing_role_code: string;
      existing_role_name: string;
      existing_side: string;
      attempted_side: string;
      exception_id: string | null;
    }>(
      `SELECT r.id::text            AS rule_id,
              r.code                AS rule_code,
              r.name                AS rule_name,
              r.severity            AS severity,
              r.enforcement         AS enforcement,
              held.id::text         AS existing_role_id,
              held.code             AS existing_role_code,
              held.name             AS existing_role_name,
              held_side.side        AS existing_side,
              new_side.side         AS attempted_side,
              exc.id::text          AS exception_id
         FROM ${schema}.segregation_of_duty_role new_side
         JOIN ${schema}.segregation_of_duty_rule r
           ON r.id = new_side.rule_id
          AND r.is_active = TRUE
          AND r.deleted_at IS NULL
         JOIN ${schema}.segregation_of_duty_role held_side
           ON held_side.rule_id = new_side.rule_id
          AND held_side.side <> new_side.side
         JOIN ${schema}.role held
           ON held.id = held_side.role_id
          AND held.deleted_at IS NULL
         JOIN ${schema}.user_role_assignment ura
           ON ura.role_id = held.id
          AND ura.user_subject_id = $1
          AND ura.valid_from <= now()
          AND (ura.valid_until IS NULL OR ura.valid_until > now())
         LEFT JOIN ${schema}.segregation_of_duty_exception exc
           ON exc.rule_id = r.id
          AND exc.user_subject_id = $1
          AND exc.revoked_at IS NULL
          AND exc.valid_from <= now()
          AND exc.valid_until > now()
        WHERE new_side.role_id = $2`,
      [userSubjectId, roleId],
    );

    const conflicts: SodConflict[] = [];
    const waived: SodConflict[] = [];

    for (const row of rows) {
      const conflict: SodConflict = {
        ruleId: row.rule_id,
        ruleCode: row.rule_code,
        ruleName: row.rule_name,
        severity: row.severity,
        enforcement: row.enforcement,
        existingRoleId: row.existing_role_id,
        existingRoleCode: row.existing_role_code,
        existingRoleName: row.existing_role_name,
        existingSide: row.existing_side,
        attemptedSide: row.attempted_side,
      };
      // Pengecualian tertulis dan aturan bersifat WARN sama-sama diteruskan,
      // tetapi keduanya tetap dicatat. Pelanggaran yang diloloskan justru yang
      // benar-benar berjalan di produksi; jika hanya yang ditolak yang tercatat,
      // laporan audit memuat risiko yang tidak pernah terjadi dan melewatkan
      // yang terjadi.
      if (row.exception_id || row.enforcement === 'WARN') waived.push(conflict);
      else conflicts.push(conflict);
    }

    return { allowed: conflicts.length === 0, conflicts, waived };
  }

  /** Mencatat hasil pemeriksaan. Dipanggil baik saat ditolak maupun diloloskan. */
  async record(
    client: PoolClient,
    schema: string,
    userSubjectId: string,
    attemptedRoleId: string,
    result: SodCheckResult,
    context: { actorId?: string | null; requestId?: string | null } = {},
  ): Promise<void> {
    const entries: Array<[SodConflict, string]> = [
      ...result.conflicts.map((c) => [c, 'BLOCKED'] as [SodConflict, string]),
      ...result.waived.map(
        (c) => [c, c.enforcement === 'WARN' ? 'WARNED' : 'ALLOWED_BY_EXCEPTION'] as [SodConflict, string],
      ),
    ];

    for (const [conflict, outcome] of entries) {
      await client.query(
        `INSERT INTO ${schema}.segregation_of_duty_violation
           (rule_id, user_subject_id, existing_role_id, attempted_role_id, outcome, detected_by, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          conflict.ruleId,
          userSubjectId,
          conflict.existingRoleId,
          attemptedRoleId,
          outcome,
          context.actorId ?? null,
          context.requestId ?? null,
        ],
      );
    }
  }

  /**
   * Memeriksa, mencatat, lalu menolak bila perlu — dipakai jalur penetapan role.
   *
   * Pesan penolakan menyebut role yang bertabrakan beserta nama aturannya,
   * karena "ditolak karena SoD" tanpa keterangan memaksa administrator menebak
   * role mana yang harus dicabut lebih dulu.
   */
  async enforce(
    client: PoolClient,
    schema: string,
    userSubjectId: string,
    roleId: string,
    context: { actorId?: string | null; requestId?: string | null } = {},
  ): Promise<SodCheckResult> {
    const result = await this.check(client, schema, userSubjectId, roleId);
    await this.record(client, schema, userSubjectId, roleId, result, context);

    if (result.waived.length > 0) {
      this.logger.warn(
        `Pemisahan tugas dilewati untuk subject ${userSubjectId}: ` +
          result.waived.map((c) => c.ruleCode).join(', '),
      );
    }

    if (!result.allowed) {
      const detail = result.conflicts
        .map((c) => `${c.ruleName} (bertabrakan dengan role ${c.existingRoleName})`)
        .join('; ');
      throw new ForbiddenException(
        `Penetapan role ditolak karena pemisahan tugas: ${detail}. ` +
          'Cabut role yang bertabrakan, atau catat pengecualian tertulis beserta alasan dan masa berlakunya.',
      );
    }

    return result;
  }
}
