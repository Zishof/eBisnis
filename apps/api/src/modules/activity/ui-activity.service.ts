/**
 * Jejak pemakaian antarmuka.
 *
 * ## Yang dilaporkan peramban tidak sama dengan yang disaksikan server
 *
 * Seluruh isi tabel ini datang dari peramban. Ketika peramban berkata "saya
 * membuka menu Pembelian", server tidak punya cara memastikannya — tidak ada
 * permintaan yang wajib menyertainya, dan siapa pun yang memegang token dapat
 * mengirim laporan apa saja.
 *
 * Karena itu ia disimpan terpisah dari `audit_event` dan **tidak boleh** dipakai
 * sebagai bukti perbuatan. Gunanya analitik pemakaian: menu mana yang tidak
 * pernah dibuka, tombol mana yang ditekan lalu dibatalkan.
 *
 * ## Yang tetap dijaga meski datanya tidak dapat diverifikasi
 *
 * Tidak dapat diverifikasi bukan berarti boleh menerima apa saja:
 *
 * 1. **Identitas diambil dari sesi, bukan dari badan permintaan.** Tanpa itu,
 *    seseorang dapat melaporkan aktivitas atas nama orang lain — dan analitik
 *    yang dapat difitnah lebih buruk daripada tidak ada analitik.
 * 2. **Kode menu wajib benar-benar ada.** Kode karangan akan memenuhi laporan
 *    dengan menu yang tidak pernah dibuat siapa pun.
 * 3. **Jalur dinormalkan dan kueri stringnya dibuang.** Kata kunci pencarian
 *    pada URL dapat menyingkap isi data yang dicari.
 * 4. **Ada batas jumlah per permintaan.** Tanpa batas, satu permintaan dapat
 *    menulis sejuta baris.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/decorators';

/** Jenis aktivitas yang diterima. Tertutup — jenis bebas tidak dapat diringkas. */
export const ACTIVITY_TYPES = ['MENU_OPEN', 'PAGE_VIEW', 'UI_ACTION'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const OUTCOMES = ['SUCCESS', 'CANCELLED', 'FAILED'] as const;

/**
 * Batas jumlah peristiwa per permintaan.
 *
 * Peramban mengirim secara berkelompok supaya tidak satu permintaan per klik.
 * Lima puluh cukup untuk beberapa menit pemakaian; lebih dari itu berarti
 * kesalahan atau penyalahgunaan.
 */
export const MAX_BATCH = 50;

export interface UiActivityInput {
  activityType: ActivityType;
  menuCode?: string;
  routePath?: string;
  actionCode?: string;
  outcome?: (typeof OUTCOMES)[number];
  durationMs?: number;
  clientTime?: string;
}

@Injectable()
export class UiActivityService {
  private readonly logger = new Logger(UiActivityService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Menerima sekelompok peristiwa dari peramban.
   *
   * Mengembalikan jumlah yang diterima dan jumlah yang ditolak beserta
   * alasannya — bukan sekadar "ok". Peramban yang melaporkan kode menu yang
   * salah perlu tahu, dan diam-diam membuang laporannya akan membuat
   * kesalahan itu bertahan berbulan-bulan.
   */
  async record(
    user: AuthenticatedUser,
    events: UiActivityInput[],
  ): Promise<{ accepted: number; rejected: Array<{ index: number; reason: string }> }> {
    if (!user.schemaName) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Sesi ini tidak terhubung ke tenant mana pun.',
      );
    }
    if (events.length > MAX_BATCH) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Paling banyak ${MAX_BATCH} peristiwa per permintaan.`,
      );
    }

    const schema = user.schemaName;
    const menuValid = await this.knownMenuCodes(schema);
    const subjectId = await this.subjectIdOf(schema, user.userId);

    const rejected: Array<{ index: number; reason: string }> = [];
    const diterima: UiActivityInput[] = [];

    events.forEach((event, index) => {
      if (event.menuCode && !menuValid.has(event.menuCode)) {
        rejected.push({ index, reason: `Kode menu '${event.menuCode}' tidak dikenal.` });
        return;
      }
      if (event.activityType === 'UI_ACTION' && !event.actionCode) {
        rejected.push({ index, reason: 'UI_ACTION wajib menyertakan actionCode.' });
        return;
      }
      diterima.push(event);
    });

    for (const event of diterima) {
      try {
        await this.tenantDb.query(
          schema,
          `INSERT INTO "${schema}".ui_activity_log
             (activity_type, menu_code, route_path, action_code, outcome, duration_ms,
              user_subject_id, platform_user_id, session_id, active_role_code,
              client_time, request_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            event.activityType,
            event.menuCode ?? null,
            normalizeUiRoute(event.routePath),
            event.actionCode ?? null,
            event.outcome ?? null,
            clampDuration(event.durationMs),
            subjectId,
            // Identitas dari sesi, bukan dari badan permintaan.
            user.userId,
            user.sessionId,
            user.activeRoleCode ?? null,
            parseClientTime(event.clientTime),
            null,
          ],
        );
      } catch (error) {
        // Kegagalan mencatat analitik tidak boleh menggagalkan apa pun.
        this.logger.warn(`Aktivitas antarmuka gagal disimpan: ${(error as Error).message}`);
      }
    }

    return { accepted: diterima.length, rejected };
  }

  /**
   * Ringkasan pemakaian menu.
   *
   * Yang paling berguna justru bukan menu terpopuler melainkan menu yang
   * **tidak pernah dibuka**: itulah yang menandai fitur yang tidak terpakai,
   * dan menghapus fitur yang tidak terpakai lebih murah daripada merawatnya.
   */
  async menuUsage(schema: string, days: number) {
    const rows = await this.tenantDb.query<{
      code: string;
      name: string;
      module_code: string | null;
      opens: string;
      users: string;
      last_opened: Date | null;
    }>(
      schema,
      `SELECT m.code, m.name, m.module_code,
              count(a.id) AS opens,
              count(DISTINCT a.platform_user_id) AS users,
              max(a.occurred_at) AS last_opened
         FROM "${schema}".menu m
         LEFT JOIN "${schema}".ui_activity_log a
                ON a.menu_code = m.code
               AND a.activity_type IN ('MENU_OPEN', 'PAGE_VIEW')
               AND a.occurred_at >= now() - ($1 || ' days')::interval
        WHERE m.deleted_at IS NULL AND m.is_active = TRUE
        GROUP BY m.code, m.name, m.module_code
        ORDER BY count(a.id) DESC, m.code`,
      [String(days)],
    );

    const items = rows.map((row) => ({
      code: row.code,
      name: row.name,
      moduleCode: row.module_code,
      opens: Number(row.opens),
      distinctUsers: Number(row.users),
      lastOpenedAt: row.last_opened,
    }));

    return {
      sinceDays: days,
      items,
      neverOpened: items.filter((i) => i.opens === 0).map((i) => i.code),
      // Disebutkan supaya angka nol tidak disalahartikan sebagai "tidak
      // terpakai" padahal sebenarnya "belum ada yang melaporkan".
      note:
        'Angka berasal dari laporan peramban dan hanya mencakup pemakaian yang ' +
        'antarmukanya sudah mengirim laporan. Menu dengan nol pembukaan berarti ' +
        'tidak ada laporan — belum tentu tidak dipakai.',
    };
  }

  /** Tindakan antarmuka yang paling sering dibatalkan. */
  async abandonedActions(schema: string, days: number) {
    const rows = await this.tenantDb.query<{
      menu_code: string | null;
      action_code: string;
      total: string;
      cancelled: string;
      failed: string;
    }>(
      schema,
      `SELECT menu_code, action_code,
              count(*) AS total,
              count(*) FILTER (WHERE outcome = 'CANCELLED') AS cancelled,
              count(*) FILTER (WHERE outcome = 'FAILED') AS failed
         FROM "${schema}".ui_activity_log
        WHERE activity_type = 'UI_ACTION'
          AND occurred_at >= now() - ($1 || ' days')::interval
        GROUP BY menu_code, action_code
       HAVING count(*) FILTER (WHERE outcome IN ('CANCELLED', 'FAILED')) > 0
        ORDER BY count(*) FILTER (WHERE outcome IN ('CANCELLED', 'FAILED')) DESC
        LIMIT 50`,
      [String(days)],
    );

    return {
      sinceDays: days,
      items: rows.map((row) => {
        const total = Number(row.total);
        const cancelled = Number(row.cancelled);
        const failed = Number(row.failed);
        return {
          menuCode: row.menu_code,
          actionCode: row.action_code,
          total,
          cancelled,
          failed,
          // Rasio ditinggalkan tinggi menandai kendali yang membingungkan atau
          // alur yang terlalu panjang — dan itu dapat diperbaiki.
          abandonRate: Math.round(((cancelled + failed) / total) * 1000) / 10,
        };
      }),
    };
  }

  /** Kode menu yang benar-benar ada, untuk menolak kode karangan. */
  private async knownMenuCodes(schema: string): Promise<Set<string>> {
    const rows = await this.tenantDb.query<{ code: string }>(
      schema,
      `SELECT code FROM "${schema}".menu WHERE deleted_at IS NULL`,
    );
    return new Set(rows.map((r) => r.code));
  }

  private async subjectIdOf(schema: string, platformUserId: string): Promise<string | null> {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `SELECT id::text FROM "${schema}".user_subject
        WHERE platform_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [platformUserId],
    );
    return rows[0]?.id ?? null;
  }
}

/**
 * Membuang kueri string dan memotong jalur antarmuka.
 *
 * Kata kunci pencarian pada URL menyingkap isi data yang dicari: seseorang yang
 * membuka `/pelanggan?cari=Budi+Santoso` menyatakan bahwa ia mencari orang itu,
 * dan analitik pemakaian tidak berhak menyimpan pengetahuan tersebut.
 */
export function normalizeUiRoute(routePath: string | undefined | null): string | null {
  if (!routePath) return null;
  const tanpaKueri = routePath.split('?')[0].split('#')[0];
  return tanpaKueri.slice(0, 255) || null;
}

/**
 * Membatasi durasi yang dilaporkan.
 *
 * Nilai negatif tidak berarti apa-apa, dan nilai yang sangat besar berasal dari
 * tab yang dibiarkan terbuka semalaman — bukan dari orang yang menatap layar
 * selama itu. Dibatasi dua jam supaya rata-ratanya tidak dirusak satu tab yang
 * terlupakan.
 */
export function clampDuration(durationMs: number | undefined | null): number | null {
  if (durationMs === undefined || durationMs === null) return null;
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  const DUA_JAM = 2 * 60 * 60 * 1000;
  return Math.min(Math.round(durationMs), DUA_JAM);
}

/**
 * Membaca waktu yang dilaporkan peramban.
 *
 * Jam peramban dapat salah — kadang bertahun-tahun. Waktu yang jauh di luar
 * jangkauan wajar dibuang alih-alih disimpan, karena satu baris bertahun 1970
 * atau 2099 akan merusak setiap rentang tanggal yang dihitung darinya.
 */
export function parseClientTime(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const waktu = new Date(raw);
  if (Number.isNaN(waktu.getTime())) return null;
  const sekarang = Date.now();
  const SEHARI = 24 * 60 * 60 * 1000;
  // Toleransi sehari ke belakang untuk laporan tertunda, dan satu jam ke depan
  // untuk jam yang sedikit maju.
  if (waktu.getTime() < sekarang - SEHARI) return null;
  if (waktu.getTime() > sekarang + 60 * 60 * 1000) return null;
  return waktu;
}
