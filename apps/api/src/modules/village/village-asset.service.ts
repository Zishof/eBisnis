/**
 * Register aset, peminjaman, pemeliharaan, penghapusan, dan rencana pengadaan.
 *
 * ## Yang ditegakkan indeks, bukan layanan
 *
 * Satu aset hanya dapat sedang dipinjam oleh satu orang. Dua permintaan pinjam
 * yang tiba bersamaan akan sama-sama membaca status `AKTIF` dan keduanya lolos
 * pemeriksaan layanan; indeks unik parsial tidak dapat dilewati dengan cara
 * itu. Layanan tetap memeriksa lebih dahulu supaya pesannya dapat dibaca —
 * "sedang dipinjam Pak Karto sampai 12 Maret" jauh lebih berguna daripada
 * pelanggaran constraint.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import {
  adalahGolonganKib,
  bolehCatatKepemilikan,
  bolehHapusAset,
  bolehPinjam,
  bolehTetapkanPengadaan,
  keterlambatan,
  metodePengadaan,
  periksaJangkaPinjam,
  type CaraPenghapusan,
  type GolonganKib,
  type KepemilikanAset,
  type KondisiAset,
  type StatusAset,
} from './village-asset';

/** Batas swakelola bawaan; berbeda antar kabupaten, karena itu dapat diatur per unit. */
const BATAS_SWAKELOLA_BAWAAN = 200_000_000;

@Injectable()
export class VillageAssetService {
  private readonly logger = new Logger(VillageAssetService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  // --- Register -------------------------------------------------------------

  async daftarAset(
    schemaName: string,
    filter: { status?: string; kondisi?: string; kib?: string; dapatDipinjam?: boolean } = {},
  ) {
    const u = await this.unit.unit(schemaName);
    await this.unit.pastikanLayak(
      schemaName,
      u.profileType === 'DESA' ? 'ASET.ASET_DESA' : 'ASET.ASET_DAERAH',
    );

    return this.tenantDb.query(
      schemaName,
      `SELECT a.id, a.register_number, a.name, a.kib_group, a.ownership, a.condition, a.status,
              a.acquisition_date, a.acquisition_source, a.acquisition_value::text,
              a.quantity::text, a.unit, a.location_note, a.is_lendable,
              c.name AS category_name,
              b.borrower_name, b.due_at
         FROM "${schemaName}".village_asset a
    LEFT JOIN "${schemaName}".village_asset_category c ON c.id = a.category_id
    LEFT JOIN "${schemaName}".village_asset_borrowing b
           ON b.village_asset_id = a.id AND b.status IN ('DIPINJAM','TERLAMBAT')
        WHERE a.village_unit_id = $1 AND a.deleted_at IS NULL
          AND ($2::varchar IS NULL OR a.status = $2::varchar)
          AND ($3::varchar IS NULL OR a.condition = $3::varchar)
          AND ($4::varchar IS NULL OR a.kib_group = $4::varchar)
          AND ($5::boolean IS NULL OR a.is_lendable = $5::boolean)
        ORDER BY a.kib_group, a.register_number`,
      [
        u.id,
        filter.status ?? null,
        filter.kondisi ?? null,
        filter.kib ?? null,
        filter.dapatDipinjam ?? null,
      ],
    );
  }

  /**
   * Mencatat aset ke dalam register.
   *
   * Kelurahan tidak dapat mencatat aset bertanda `DESA`: ia perangkat daerah
   * dan tidak memiliki kekayaan sendiri. Daftar aset kelurahan yang menyatakan
   * kepemilikan desa akan berselisih dengan KIB daerah pada pemeriksaan
   * berikutnya.
   */
  async catatAset(
    schemaName: string,
    input: {
      registerNumber: string;
      name: string;
      kibGroup: string;
      ownership?: KepemilikanAset;
      categoryId?: string;
      description?: string;
      acquisitionDate?: string;
      acquisitionSource?: string;
      acquisitionValue?: number;
      budgetTransactionId?: string;
      quantity?: number;
      unit?: string;
      locationNote?: string;
      condition?: KondisiAset;
      isLendable?: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.unit(schemaName);
    await this.unit.pastikanLayak(
      schemaName,
      u.profileType === 'DESA' ? 'ASET.ASET_DESA' : 'ASET.ASET_DAERAH',
    );

    if (!adalahGolonganKib(input.kibGroup)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Golongan KIB "${input.kibGroup}" tidak dikenal. Yang dikenal: A sampai F.`,
      );
    }

    const kepemilikan: KepemilikanAset =
      input.ownership ?? (u.profileType === 'DESA' ? 'DESA' : 'DAERAH');
    const v = bolehCatatKepemilikan(u.profileType, kepemilikan);
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_asset
         (village_unit_id, category_id, register_number, name, description, kib_group, ownership,
          acquisition_date, acquisition_source, acquisition_value, budget_transaction_id,
          quantity, unit, location_note, condition, is_lendable, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        u.id,
        input.categoryId ?? null,
        input.registerNumber,
        input.name,
        input.description ?? null,
        input.kibGroup as GolonganKib,
        kepemilikan,
        input.acquisitionDate ?? null,
        input.acquisitionSource ?? 'PEMBELIAN',
        input.acquisitionValue ?? 0,
        input.budgetTransactionId ?? null,
        input.quantity ?? 1,
        input.unit ?? null,
        input.locationNote ?? null,
        input.condition ?? 'BAIK',
        input.isLendable ?? false,
        user.userId,
      ],
    ).catch(terjemahkanBentrok('Nomor register aset sudah dipakai.'));

    return { id: rows[0].id, ownership: kepemilikan };
  }

  // --- Peminjaman -----------------------------------------------------------

  async pinjamkan(
    schemaName: string,
    input: {
      assetId: string;
      borrowerName: string;
      borrowerResidentId?: string;
      borrowerPhone?: string;
      borrowerInstitution?: string;
      purpose: string;
      borrowedAt?: string;
      dueAt: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'ASET.PEMINJAMAN');
    const mulai = input.borrowedAt ?? hariIni();

    const jangka = periksaJangkaPinjam({ mulai, rencanaKembali: input.dueAt });
    if (!jangka.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, jangka.alasan!);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const a = await client.query<Record<string, string>>(
        `SELECT id, name, status, condition, is_lendable
           FROM "${schemaName}".village_asset
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL
          FOR UPDATE`,
        [input.assetId, u.id],
      );
      if (!a.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Aset tidak ditemukan.');

      if (!a.rows[0].is_lendable) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `${a.rows[0].name} tidak ditandai sebagai aset yang dapat dipinjamkan.`,
        );
      }

      const v = bolehPinjam(a.rows[0].status as StatusAset, a.rows[0].condition as KondisiAset);
      if (!v.boleh) {
        // Menyebutkan siapa yang sedang meminjam dan sampai kapan. Warga yang
        // datang ke balai desa berhak tahu kapan ia dapat kembali, bukan sekadar
        // diberi tahu "tidak tersedia".
        const p = await client.query<Record<string, string>>(
          `SELECT borrower_name, due_at::text FROM "${schemaName}".village_asset_borrowing
            WHERE village_asset_id = $1 AND status IN ('DIPINJAM','TERLAMBAT') LIMIT 1`,
          [input.assetId],
        );
        const keterangan = p.rows.length
          ? ` Sedang dipinjam ${p.rows[0].borrower_name} sampai ${p.rows[0].due_at}.`
          : '';
        throw AppError.conflict(ErrorCodes.CONFLICT, `${v.alasan}${keterangan}`);
      }

      const b = await client
        .query<{ id: string }>(
          `INSERT INTO "${schemaName}".village_asset_borrowing
             (village_unit_id, village_asset_id, borrower_resident_id, borrower_name,
              borrower_phone, borrower_institution, purpose, borrowed_at, due_at,
              approved_by, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id`,
          [
            u.id,
            input.assetId,
            input.borrowerResidentId ?? null,
            input.borrowerName,
            input.borrowerPhone ?? null,
            input.borrowerInstitution ?? null,
            input.purpose,
            mulai,
            input.dueAt,
            user.userId,
          ],
        )
        .catch(
          terjemahkanBentrok(
            'Aset ini baru saja dipinjam orang lain. Muat ulang daftarnya untuk melihat keadaan terbaru.',
          ),
        );

      await client.query(
        `UPDATE "${schemaName}".village_asset
            SET status = 'DIPINJAM', updated_at = now(), version = version + 1
          WHERE id = $1`,
        [input.assetId],
      );

      return { id: b.rows[0].id, dueAt: input.dueAt };
    });
  }

  async kembalikan(
    schemaName: string,
    borrowingId: string,
    input: { condition?: KondisiAset; note?: string; returnedAt?: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'ASET.PEMINJAMAN');
    const tgl = input.returnedAt ?? hariIni();

    return this.tenantDb.transaction(schemaName, async (client) => {
      const b = await client.query<Record<string, string>>(
        `SELECT id, village_asset_id, status, due_at::text
           FROM "${schemaName}".village_asset_borrowing
          WHERE id = $1 AND village_unit_id = $2 FOR UPDATE`,
        [borrowingId, u.id],
      );
      if (!b.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Peminjaman tidak ditemukan.');
      if (b.rows[0].status === 'DIKEMBALIKAN') {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Peminjaman ini sudah dikembalikan.');
      }

      const telat = keterlambatan(b.rows[0].due_at, tgl);
      const kondisi = input.condition ?? 'BAIK';

      await client.query(
        `UPDATE "${schemaName}".village_asset_borrowing
            SET status = 'DIKEMBALIKAN', returned_at = $2, condition_on_return = $3,
                return_note = $4, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [borrowingId, tgl, kondisi, input.note ?? null],
      );

      // Kondisi aset mengikuti kondisi saat dikembalikan. Aset yang kembali
      // rusak dan tetap tercatat baik akan dipinjamkan lagi kepada orang
      // berikutnya, yang lalu dianggap merusaknya.
      await client.query(
        `UPDATE "${schemaName}".village_asset
            SET status = 'AKTIF', condition = $2, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [b.rows[0].village_asset_id, kondisi],
      );

      this.logger.log(`Peminjaman ${borrowingId} dikembalikan oleh ${user.userId}`);
      return { id: borrowingId, lateDays: telat, condition: kondisi };
    });
  }

  /** Menandai peminjaman yang lewat tenggat, untuk ditagih. */
  async tandaiTerlambat(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'ASET.PEMINJAMAN');
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE "${schemaName}".village_asset_borrowing
          SET status = 'TERLAMBAT', updated_at = now(), version = version + 1
        WHERE village_unit_id = $1 AND status = 'DIPINJAM' AND due_at < CURRENT_DATE
        RETURNING id`,
      [u.id],
    );
    return { marked: rows.length };
  }

  // --- Pemeliharaan ---------------------------------------------------------

  async catatPemeliharaan(
    schemaName: string,
    input: {
      assetId: string;
      maintenanceType?: string;
      description: string;
      scheduledAt?: string;
      performedAt?: string;
      vendorName?: string;
      cost?: number;
      conditionAfter?: KondisiAset;
      budgetTransactionId?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'ASET.PEMELIHARAAN');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const a = await client.query<Record<string, string>>(
        `SELECT id, condition, status FROM "${schemaName}".village_asset
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [input.assetId, u.id],
      );
      if (!a.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Aset tidak ditemukan.');
      if (a.rows[0].status === 'DIHAPUS') {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Aset ini sudah dihapus dari register.');
      }

      const selesai = Boolean(input.performedAt);
      const m = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_asset_maintenance
           (village_unit_id, village_asset_id, maintenance_type, scheduled_at, performed_at,
            description, vendor_name, cost, budget_transaction_id, condition_before,
            condition_after, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          u.id,
          input.assetId,
          input.maintenanceType ?? 'PERBAIKAN',
          input.scheduledAt ?? null,
          input.performedAt ?? null,
          input.description,
          input.vendorName ?? null,
          input.cost ?? 0,
          input.budgetTransactionId ?? null,
          a.rows[0].condition,
          input.conditionAfter ?? null,
          selesai ? 'SELESAI' : 'DIRENCANAKAN',
          user.userId,
        ],
      );

      if (selesai && input.conditionAfter) {
        await client.query(
          `UPDATE "${schemaName}".village_asset
              SET condition = $2, status = 'AKTIF', updated_at = now(), version = version + 1
            WHERE id = $1`,
          [input.assetId, input.conditionAfter],
        );
      } else if (!selesai) {
        await client.query(
          `UPDATE "${schemaName}".village_asset
              SET status = 'DIPELIHARA', updated_at = now(), version = version + 1
            WHERE id = $1 AND status = 'AKTIF'`,
          [input.assetId],
        );
      }

      return { id: m.rows[0].id, status: selesai ? 'SELESAI' : 'DIRENCANAKAN' };
    });
  }

  // --- Penghapusan ----------------------------------------------------------

  /**
   * Mengusulkan penghapusan aset.
   *
   * Wajib berdasar keputusan yang bernomor. Sistem tidak boleh menjadi tempat
   * sebuah barang berhenti ada diam-diam.
   */
  async usulkanPenghapusan(
    schemaName: string,
    input: {
      assetId: string;
      method: CaraPenghapusan;
      decisionNumber: string;
      decisionDate: string;
      reason: string;
      disposalValue?: number;
      recipientName?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.unit(schemaName);
    await this.unit.pastikanLayak(
      schemaName,
      u.profileType === 'DESA' ? 'ASET.ASET_DESA' : 'ASET.ASET_DAERAH',
    );

    return this.tenantDb.transaction(schemaName, async (client) => {
      const a = await client.query<Record<string, string>>(
        `SELECT id, name, status FROM "${schemaName}".village_asset
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [input.assetId, u.id],
      );
      if (!a.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Aset tidak ditemukan.');

      const v = bolehHapusAset(a.rows[0].status as StatusAset, {
        cara: input.method,
        nomorKeputusan: input.decisionNumber,
        alasan: input.reason,
        nilaiPelepasan: input.disposalValue,
      });
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      const d = await client
        .query<{ id: string }>(
          `INSERT INTO "${schemaName}".village_asset_disposal
             (village_unit_id, village_asset_id, method, decision_number, decision_date, reason,
              disposal_value, recipient_name, proposed_by, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`,
          [
            u.id,
            input.assetId,
            input.method,
            input.decisionNumber,
            input.decisionDate,
            input.reason,
            input.disposalValue ?? null,
            input.recipientName ?? null,
            user.userId,
          ],
        )
        .catch(terjemahkanBentrok('Aset ini sudah memiliki usulan penghapusan yang berjalan.'));

      return { id: d.rows[0].id, status: 'DIUSULKAN' };
    });
  }

  /**
   * Menyetujui penghapusan.
   *
   * Pengusul bukan penyetuju. Satu orang yang mengusulkan sekaligus menyetujui
   * penghapusan aset berarti tidak ada yang memeriksa apa pun — dan aset adalah
   * tempat pemeriksaan itu paling diperlukan.
   */
  async setujuiPenghapusan(schemaName: string, disposalId: string, user: AuthenticatedUser) {
    const u = await this.unit.unit(schemaName);
    await this.unit.pastikanLayak(
      schemaName,
      u.profileType === 'DESA' ? 'ASET.ASET_DESA' : 'ASET.ASET_DAERAH',
    );

    return this.tenantDb.transaction(schemaName, async (client) => {
      const d = await client.query<Record<string, string>>(
        `SELECT id, village_asset_id, status, proposed_by
           FROM "${schemaName}".village_asset_disposal
          WHERE id = $1 AND village_unit_id = $2 FOR UPDATE`,
        [disposalId, u.id],
      );
      if (!d.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Usulan penghapusan tidak ditemukan.');
      if (d.rows[0].status !== 'DIUSULKAN') {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Usulan penghapusan berstatus ${d.rows[0].status}.`,
        );
      }
      if (d.rows[0].proposed_by === user.userId) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak dapat menyetujui penghapusan yang Anda usulkan sendiri. ' +
            'Mintakan persetujuan kepada pejabat lain.',
        );
      }

      await client.query(
        `UPDATE "${schemaName}".village_asset_disposal
            SET status = 'SELESAI', approved_by = $2, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [disposalId, user.userId],
      );
      await client.query(
        `UPDATE "${schemaName}".village_asset
            SET status = 'DIHAPUS', updated_at = now(), version = version + 1
          WHERE id = $1`,
        [d.rows[0].village_asset_id],
      );

      return { id: disposalId, status: 'SELESAI' };
    });
  }

  // --- Rencana pengadaan ----------------------------------------------------

  async susunPengadaan(
    schemaName: string,
    input: {
      fiscalYear: number;
      budgetLineId: string;
      code: string;
      name: string;
      estimatedValue: number;
      specification?: string;
      quantity?: number;
      unit?: string;
      activityId?: string;
      plannedQuarter?: number;
      swakelolaThreshold?: number;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'PENGADAAN.RENCANA');

    const v = bolehTetapkanPengadaan({
      budgetLineId: input.budgetLineId,
      nilai: input.estimatedValue,
    });
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    const metode = metodePengadaan(
      input.estimatedValue,
      input.swakelolaThreshold ?? BATAS_SWAKELOLA_BAWAAN,
    );

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_procurement_plan
         (village_unit_id, fiscal_year, budget_line_id, village_activity_id, code, name,
          specification, quantity, unit, estimated_value, method, planned_quarter, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        u.id,
        input.fiscalYear,
        input.budgetLineId,
        input.activityId ?? null,
        input.code,
        input.name,
        input.specification ?? null,
        input.quantity ?? 1,
        input.unit ?? null,
        input.estimatedValue,
        metode,
        input.plannedQuarter ?? null,
        user.userId,
      ],
    ).catch(terjemahkanBentrok('Kode rencana pengadaan sudah dipakai pada tahun ini.'));

    return { id: rows[0].id, method: metode };
  }
}

// --- Bagian dalam ------------------------------------------------------------

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Menerjemahkan pelanggaran indeks unik menjadi pesan yang dapat dibaca.
 *
 * Constraint-lah yang menahan keadaan berbarengan, tetapi pesannya menyebut
 * nama indeks — yang tidak berarti apa pun bagi petugas desa.
 */
function terjemahkanBentrok(pesan: string) {
  return (error: unknown): never => {
    if ((error as { code?: string })?.code === '23505') {
      throw AppError.conflict(ErrorCodes.CONFLICT, pesan);
    }
    throw error;
  };
}
