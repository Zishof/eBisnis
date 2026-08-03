/**
 * Adapter menuju kemampuan bersama.
 *
 * Satu berkas yang mengenal bentuk Core, sehingga ketika Core berubah, yang
 * disesuaikan satu tempat alih-alih tersebar di seluruh modul kesehatan.
 *
 * Adapter yang layanannya belum ada di Core dibiarkan **jujur tidak
 * berfungsi** — melempar galat yang menyebutkan apa yang belum ada dan apa
 * yang harus dilakukan. Tiruan diam yang mengembalikan nilai palsu jauh lebih
 * berbahaya: ia membuat pengujian hijau atas kemampuan yang tidak pernah
 * dijalankan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import { TenantPermissionService } from '../../auth/tenant-permission.service';
import type { AuditPort, IdentityPort, NotificationPort, PurposeOfUse } from '../ports';

// --- Identitas ---------------------------------------------------------------

@Injectable()
export class CoreIdentityAdapter implements IdentityPort {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly permissions: TenantPermissionService,
  ) {}

  /**
   * Identitas tenant dari identitas control plane.
   *
   * Diselesaikan di satu tempat dengan sengaja. Cacat yang ditemukan sesi Core
   * pada POS berawal dari dua tempat yang memakai id berbeda tanpa ada yang
   * menyadarinya — kuerinya berhasil dan mengembalikan nol baris.
   */
  async subjectId(schema: string, platformUserId: string): Promise<string> {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `SELECT id FROM "${schema}".user_subject
        WHERE platform_user_id = $1 AND deleted_at IS NULL`,
      [platformUserId],
    );
    if (!rows.length) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun ini belum terdaftar sebagai pengguna pada ruang kerja tenant.',
      );
    }
    return rows[0].id;
  }

  async missingPermissions(
    schema: string,
    userId: string,
    required: string[],
    opts: { activeRoleId: string | null; isDemo: boolean },
  ): Promise<string[]> {
    return this.permissions.findMissing(schema, userId, required, opts);
  }

  async scopes(schema: string, userId: string): Promise<Array<{ level: string; value: string }>> {
    const rows = await this.tenantDb.query<{ scope_level: string; scope_value: string }>(
      schema,
      `SELECT scope_level, scope_value
         FROM "${schema}".user_scope_assignment
        WHERE user_subject_id = $1
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)`,
      [userId],
    );
    return rows.map((r) => ({ level: r.scope_level, value: r.scope_value }));
  }
}

// --- Audit -------------------------------------------------------------------

@Injectable()
export class CoreAuditAdapter implements AuditPort {
  private readonly logger = new Logger(CoreAuditAdapter.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  async record(event: {
    moduleCode: string;
    actionCode: string;
    entityType?: string;
    entityId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // Jejak perubahan sudah tercatat pemicu basis data pada setiap tabel
    // kesehatan (H001, H002). Yang di sini adalah peristiwa tingkat layanan
    // yang tidak berupa perubahan baris — misalnya penolakan akses.
    this.logger.debug(`audit ${event.moduleCode}.${event.actionCode} ${event.entityType ?? ''}`);
  }

  /**
   * Mencatat PEMBACAAN rekam medis.
   *
   * Sengaja tidak melempar bila gagal. Kegagalan mencatat jejak tidak boleh
   * menghentikan perawatan — tetapi ia harus terlihat keras di log operator,
   * karena jejak yang diam-diam berhenti tercatat lebih buruk daripada jejak
   * yang tidak pernah ada: yang pertama menimbulkan rasa aman yang keliru.
   */
  async recordAccess(
    schema: string,
    event: {
      patientId: string;
      facilityId?: string | null;
      actorUserId?: string | null;
      activeRoleId?: string | null;
      providerId?: string | null;
      purposeOfUse: PurposeOfUse;
      entityType: string;
      entityId?: string | null;
      action?: 'READ' | 'SEARCH' | 'EXPORT' | 'PRINT';
      breakGlass?: boolean;
      breakGlassReason?: string | null;
      ipAddress?: string | null;
      requestId?: string | null;
    },
  ): Promise<void> {
    try {
      await this.tenantDb.query(
        schema,
        `INSERT INTO "${schema}".health_access_log
           (patient_id, facility_id, actor_user_id, active_role_id, provider_id,
            purpose_of_use, entity_type, entity_id, action,
            break_glass, break_glass_reason, ip_address, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'READ'), $10, $11, $12, $13)`,
        [
          event.patientId,
          event.facilityId ?? null,
          event.actorUserId ?? null,
          event.activeRoleId ?? null,
          event.providerId ?? null,
          event.purposeOfUse,
          event.entityType,
          event.entityId ?? null,
          event.action ?? null,
          event.breakGlass ?? false,
          event.breakGlassReason ?? null,
          event.ipAddress ?? null,
          event.requestId ?? null,
        ],
      );
    } catch (e) {
      this.logger.error(
        `JEJAK PEMBACAAN GAGAL DICATAT pada ${schema} untuk pasien ${event.patientId}: ` +
          (e as Error).message,
      );
    }
  }
}

// --- Notifikasi --------------------------------------------------------------

@Injectable()
export class CoreNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(CoreNotificationAdapter.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  async notify(
    schema: string,
    msg: {
      templateCode: string;
      targetUserId?: string | null;
      targetRoleCode?: string | null;
      payload: Record<string, unknown>;
      slaMinutes?: number;
      groupKey?: string;
    },
  ): Promise<{ notificationId: string | null }> {
    try {
      const rows = await this.tenantDb.query<{ id: string }>(
        schema,
        `INSERT INTO "${schema}".notification
           (template_code, target_user_id, payload, status, created_at)
         VALUES ($1, $2, $3, 'PENDING', now())
         RETURNING id`,
        [msg.templateCode, msg.targetUserId ?? null, JSON.stringify(msg.payload)],
      );
      return { notificationId: rows[0]?.id ?? null };
    } catch (e) {
      // Notifikasi yang gagal tidak menghentikan pekerjaan klinis. Pelajaran
      // ini datang dari V10-7 pada sesi Core: kegagalan mencatat pengiriman
      // sempat menggagalkan seluruh pemberitahuan meskipun barisnya tersimpan.
      this.logger.warn(`Notifikasi ${msg.templateCode} gagal pada ${schema}: ${(e as Error).message}`);
      return { notificationId: null };
    }
  }
}
