/**
 * Konteks kasir dan shift — sisi basis datanya.
 *
 * Aturannya ada pada `pos-context.ts` sebagai fungsi murni; berkas ini hanya
 * mengambil keadaan, memanggil aturan itu, lalu menuliskan hasilnya. Pemisahan
 * ini yang membuat "siapa boleh berjualan di mana" dapat diuji tanpa menyiapkan
 * basis data sama sekali.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import {
  bolehBukaShift,
  registerYangBoleh,
  tanggalUsaha,
  type AssignmentInfo,
  type OpenShiftInfo,
  type RegisterInfo,
} from './pos-context';
import { PosCatalogService } from './pos-catalog.service';

@Injectable()
export class PosContextService {
  private readonly logger = new Logger(PosContextService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly katalog: PosCatalogService,
  ) {}

  /**
   * Menerjemahkan identitas control plane menjadi identitas tenant.
   *
   * `AuthenticatedUser.userId` adalah id pada `platform.platform_user`,
   * sedangkan seluruh tabel tenant — termasuk penugasan register dan shift —
   * menunjuk `user_subject.id`. Keduanya berbeda, dan memakai yang satu di
   * tempat yang menuntut yang lain tidak menghasilkan galat: kuerinya berhasil
   * dan mengembalikan nol baris. Kasir yang sudah ditugaskan akan tampak tidak
   * punya register sama sekali, tanpa satu pun pesan yang menjelaskan sebabnya.
   */
  private async subjectId(schemaName: string, platformUserId: string): Promise<string> {
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `SELECT id FROM "${schemaName}".user_subject
        WHERE platform_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [platformUserId],
    );
    if (!rows.length) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun Anda belum terdaftar sebagai pengguna pada ruang kerja ini.',
      );
    }
    return rows[0].id;
  }

  /** Konteks lengkap untuk layar kasir. */
  async context(schemaName: string, user: AuthenticatedUser) {
    const subject = await this.subjectId(schemaName, user.userId);
    const setelan = await this.katalog.setelanPos(schemaName);
    const [registers, assignments, shift] = await Promise.all([
      this.registers(schemaName),
      this.assignments(schemaName, subject),
      this.shiftTerbuka(schemaName, subject),
    ]);

    const businessDate = tanggalUsaha(new Date(), setelan.timezone, setelan.cutoverHour);
    const boleh = registerYangBoleh(registers, assignments, subject, businessDate);

    const outletIds = [...new Set(boleh.map((r) => r.outletId))];
    const outlets = outletIds.length ? await this.outlets(schemaName, outletIds) : [];

    return {
      businessDate,
      currency: setelan.currency,
      timezone: setelan.timezone,
      thresholds: {
        discountApprovalPct: setelan.discountApprovalPct,
        voidApprovalAmount: setelan.voidApprovalAmount,
        cashVarianceThreshold: setelan.cashVarianceThreshold,
        allowNegativeStock: setelan.allowNegativeStock,
      },
      outlets,
      registers: boleh.map((r) => ({
        terminalId: r.terminalId,
        outletId: r.outletId,
        registerStatus: r.registerStatus,
      })),
      openShift: shift,
      /*
       * Disebutkan apa adanya supaya antarmuka dapat menjelaskan keadaannya.
       * Kasir yang tidak melihat satu pun register perlu tahu apakah ia belum
       * ditugaskan atau seluruh registernya sedang tidak aktif — dua keadaan
       * yang tindak lanjutnya berbeda.
       */
      hasAssignments: assignments.length > 0,
    };
  }

  async shiftBerjalan(schemaName: string, user: AuthenticatedUser) {
    const subject = await this.subjectId(schemaName, user.userId);
    const shift = await this.shiftTerbuka(schemaName, subject);
    if (!shift) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Belum ada shift yang terbuka. Buka shift terlebih dahulu untuk mulai bertransaksi.',
      );
    }
    return shift;
  }

  async bukaShift(
    schemaName: string,
    dto: { terminalId: string; openingCash: number; note?: string },
    user: AuthenticatedUser,
  ) {
    const subject = await this.subjectId(schemaName, user.userId);
    const setelan = await this.katalog.setelanPos(schemaName);
    const [registers, assignments, shift] = await Promise.all([
      this.registers(schemaName, dto.terminalId),
      this.assignments(schemaName, subject),
      this.shiftTerbukaTerminal(schemaName, dto.terminalId),
    ]);

    const register = registers[0];
    const businessDate = tanggalUsaha(new Date(), setelan.timezone, setelan.cutoverHour);

    const verdict = bolehBukaShift({
      register,
      assignments,
      userSubjectId: subject,
      tanggalUsaha: businessDate,
      shiftTerbuka: shift,
    });
    if (!verdict.allowed) {
      // Kode penolakan ikut dikirim supaya antarmuka dapat menawarkan tindak
      // lanjut yang tepat — melanjutkan shift, atau menghubungi supervisor.
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, verdict.message ?? 'Tidak diizinkan.', {
        reason: verdict.code,
      });
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const nomor = await client.query<{ n: string }>(
        // shift_number bertipe teks pada skema yang ada; dikonversi lebih dahulu
        // supaya penomoran tetap urut angka, bukan urut leksikografis (yang akan
        // menempatkan "10" sebelum "9").
        `SELECT COALESCE(MAX(NULLIF(shift_number, '')::integer), 0) + 1 AS n
           FROM "${schemaName}".pos_shift
          WHERE terminal_id = $1 AND business_date = $2`,
        [dto.terminalId, businessDate],
      );

      const hasil = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".pos_shift
           (terminal_id, outlet_id, cashier_id, shift_number, business_date,
            opened_at, opening_cash, status, opened_by, active_role_id, note)
         VALUES ($1, $2, $3, $4, $5, now(), $6, 'OPEN', $3, $7, $8)
         RETURNING id`,
        [
          dto.terminalId,
          register.outletId,
          subject,
          Number(nomor.rows[0].n),
          businessDate,
          dto.openingCash,
          user.activeRoleId ?? null,
          dto.note ?? null,
        ],
      );

      await client.query(
        `UPDATE "${schemaName}".pos_terminal
            SET register_status = 'OPEN', last_opened_at = now()
          WHERE id = $1`,
        [dto.terminalId],
      );

      // Kas awal dicatat sebagai pergerakan kas, bukan hanya sebagai kolom pada
      // shift. Saat rekonsiliasi mempertanyakan selisih, yang menolong adalah
      // rangkaian pergerakannya — dan kas awal adalah pergerakan pertama.
      await client.query(
        `INSERT INTO "${schemaName}".cash_drawer_movement
           (shift_id, movement_type, amount, reason, source_type, source_id, occurred_at, created_by, active_role_id)
         VALUES ($1, 'OPENING', $2, 'Kas awal shift', 'POS_SHIFT', $1, now(), $3, $4)`,
        [hasil.rows[0].id, dto.openingCash, subject, user.activeRoleId ?? null],
      );

      return {
        shiftId: hasil.rows[0].id,
        terminalId: dto.terminalId,
        outletId: register.outletId,
        businessDate,
        shiftNumber: Number(nomor.rows[0].n),
        openingCash: dto.openingCash,
        status: 'OPEN' as const,
      };
    });
  }

  async daftarPenugasan(schemaName: string, terminalId?: string) {
    return this.tenantDb.query(
      schemaName,
      `SELECT a.id, a.terminal_id, a.user_subject_id, a.is_primary,
              to_char(a.valid_from, 'YYYY-MM-DD') AS valid_from,
              to_char(a.valid_until, 'YYYY-MM-DD') AS valid_until,
              a.is_active, t.code AS terminal_code, t.name AS terminal_name,
              u.username, u.display_name
         FROM "${schemaName}".pos_register_assignment a
         JOIN "${schemaName}".pos_terminal t ON t.id = a.terminal_id
    LEFT JOIN "${schemaName}".user_subject u ON u.id = a.user_subject_id
        WHERE a.deleted_at IS NULL
          AND ($1::uuid IS NULL OR a.terminal_id = $1::uuid)
        ORDER BY t.code, u.username`,
      [terminalId ?? null],
    );
  }

  async tugaskan(
    schemaName: string,
    dto: {
      terminalId: string;
      userSubjectId: string;
      validFrom?: string;
      validUntil?: string;
      isPrimary?: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".pos_register_assignment
         (terminal_id, user_subject_id, valid_from, valid_until, is_primary, created_by)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4::date, COALESCE($5, FALSE), $6)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        dto.terminalId,
        dto.userSubjectId,
        dto.validFrom ?? null,
        dto.validUntil ?? null,
        dto.isPrimary ?? false,
        user.userId,
      ],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Penugasan dengan masa berlaku yang sama sudah ada untuk kasir dan register ini.',
      );
    }
    return { id: rows[0].id };
  }

  // --- Pengambilan keadaan ---------------------------------------------------

  private async registers(schemaName: string, terminalId?: string): Promise<RegisterInfo[]> {
    const rows = await this.tenantDb.query<{
      id: string;
      outlet_id: string;
      outlet_active: boolean;
      terminal_active: boolean;
      register_status: string;
    }>(
      schemaName,
      `SELECT t.id, t.outlet_id,
              (o.is_active AND o.deleted_at IS NULL) AS outlet_active,
              (t.is_active AND t.deleted_at IS NULL) AS terminal_active,
              t.register_status
         FROM "${schemaName}".pos_terminal t
         JOIN "${schemaName}".outlet o ON o.id = t.outlet_id
        WHERE ($1::uuid IS NULL OR t.id = $1::uuid)
        ORDER BY t.code`,
      [terminalId ?? null],
    );
    return rows.map((r) => ({
      terminalId: r.id,
      outletId: r.outlet_id,
      outletActive: r.outlet_active,
      terminalActive: r.terminal_active,
      registerStatus: r.register_status as RegisterInfo['registerStatus'],
    }));
  }

  private async assignments(schemaName: string, userId: string): Promise<AssignmentInfo[]> {
    const rows = await this.tenantDb.query<{
      terminal_id: string;
      user_subject_id: string;
      is_active: boolean;
      valid_from: string;
      valid_until: string | null;
    }>(
      schemaName,
      `SELECT terminal_id, user_subject_id, is_active,
              to_char(valid_from, 'YYYY-MM-DD') AS valid_from,
              to_char(valid_until, 'YYYY-MM-DD') AS valid_until
         FROM "${schemaName}".pos_register_assignment
        WHERE user_subject_id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    return rows.map((r) => ({
      terminalId: r.terminal_id,
      userSubjectId: r.user_subject_id,
      isActive: r.is_active,
      validFrom: r.valid_from,
      validUntil: r.valid_until,
    }));
  }

  private async shiftTerbuka(schemaName: string, userId: string): Promise<OpenShiftInfo | null> {
    const rows = await this.tenantDb.query<{
      id: string;
      terminal_id: string;
      cashier_id: string;
    }>(
      schemaName,
      `SELECT id, terminal_id, cashier_id
         FROM "${schemaName}".pos_shift
        WHERE cashier_id = $1 AND status = 'OPEN'
        ORDER BY opened_at DESC LIMIT 1`,
      [userId],
    );
    if (!rows.length) return null;
    return { shiftId: rows[0].id, terminalId: rows[0].terminal_id, cashierId: rows[0].cashier_id };
  }

  private async shiftTerbukaTerminal(
    schemaName: string,
    terminalId: string,
  ): Promise<OpenShiftInfo | null> {
    const rows = await this.tenantDb.query<{
      id: string;
      terminal_id: string;
      cashier_id: string;
    }>(
      schemaName,
      `SELECT id, terminal_id, cashier_id
         FROM "${schemaName}".pos_shift
        WHERE terminal_id = $1 AND status = 'OPEN' LIMIT 1`,
      [terminalId],
    );
    if (!rows.length) return null;
    return { shiftId: rows[0].id, terminalId: rows[0].terminal_id, cashierId: rows[0].cashier_id };
  }

  private async outlets(schemaName: string, ids: string[]) {
    return this.tenantDb.query(
      schemaName,
      `SELECT o.id, o.code, o.name, o.timezone, o.brand_id, b.name AS brand_name
         FROM "${schemaName}".outlet o
    LEFT JOIN "${schemaName}".brand b ON b.id = o.brand_id
        WHERE o.id = ANY($1::uuid[])
        ORDER BY o.name`,
      [ids],
    );
  }
}
