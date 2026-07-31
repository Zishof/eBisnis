/**
 * Notification Hub.
 *
 * Tabel `notification` sudah ada sejak V004 dan berisi **nol baris**: tidak ada
 * satu pun kode yang menulisinya, dan tidak ada satu pun endpoint yang
 * membacanya. Sepuluh templat tersemai dan tidak pernah dipakai.
 *
 * Modul ini yang membuatnya berguna.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { currentScope } from '../../common/context/request-context';
import type { AuthenticatedUser } from '../../common/decorators';
import {
  buildAdapters,
  missingPlaceholders,
  renderTemplate,
  type Channel,
  type ChannelAdapter,
} from './channel-adapter';

export interface NotifyInput {
  /** Kode templat, mis. SURAT_MENUNGGU_PERSETUJUAN. */
  templateCode?: string;
  /** Dipakai bila tidak memakai templat. */
  title?: string;
  body?: string;
  values?: Record<string, unknown>;

  recipientSubjectId?: string | null;
  recipientRoleCode?: string | null;

  deepLink?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  actionRequired?: boolean;
  groupKey?: string | null;
  expiresAt?: Date | null;
  channels?: Channel[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly adapters: ChannelAdapter[] = buildAdapters();

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Menerbitkan satu pemberitahuan.
   *
   * Tidak pernah melempar. Kegagalan memberi tahu tidak boleh menggagalkan
   * perbuatan yang memicunya: surat yang sudah disetujui tetap disetujui meski
   * pemberitahuannya gagal tersimpan.
   */
  async notify(schema: string, input: NotifyInput): Promise<{ id: string | null }> {
    try {
      return await this.notifyOrThrow(schema, input);
    } catch (error) {
      this.logger.warn(`Pemberitahuan gagal diterbitkan: ${(error as Error).message}`);
      return { id: null };
    }
  }

  private async notifyOrThrow(schema: string, input: NotifyInput): Promise<{ id: string }> {
    if (!input.recipientSubjectId && !input.recipientRoleCode) {
      throw new Error('Pemberitahuan wajib punya penerima — orang atau peran.');
    }

    let title = input.title ?? '';
    let body = input.body ?? '';
    let templateId: string | null = null;
    let channels: Channel[] = input.channels ?? ['IN_APP'];

    if (input.templateCode) {
      const rows = await this.tenantDb.query<{
        id: string;
        channel: string;
        subject_template: string;
        body_template: string;
      }>(
        schema,
        `SELECT id::text, channel, subject_template, body_template
           FROM "${schema}".notification_template
          WHERE code = $1 AND deleted_at IS NULL AND is_active = TRUE`,
        [input.templateCode],
      );
      const templat = rows[0];
      if (!templat) {
        throw new Error(`Templat pemberitahuan '${input.templateCode}' tidak ditemukan.`);
      }
      templateId = templat.id;
      title = renderTemplate(templat.subject_template, input.values ?? {});
      body = renderTemplate(templat.body_template, input.values ?? {});
      if (!input.channels) channels = [templat.channel as Channel];

      // Penanda yang tersisa dicatat, tidak menggagalkan. Pemberitahuan yang
      // sebagian kosong tetap lebih berguna daripada tidak ada pemberitahuan,
      // dan peringatan ini membuat nilai yang lupa diberikan terlihat.
      const kurang = [...missingPlaceholders(title), ...missingPlaceholders(body)];
      if (kurang.length) {
        this.logger.warn(
          `Templat ${input.templateCode} kekurangan nilai: ${[...new Set(kurang)].join(', ')}`,
        );
      }
    }

    if (!title) throw new Error('Pemberitahuan wajib punya judul.');

    const scope = currentScope();
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".notification
         (template_id, recipient_subject_id, recipient_role_code, channel, title, body,
          payload, entity_type, entity_id, severity, status, deep_link, action_required,
          group_key, expires_at, created_as_role_code, last_occurred_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9::uuid,
               COALESCE($10, 'INFO'), 'PENDING', $11, COALESCE($12, false), $13, $14::timestamptz,
               $15, now())
       ON CONFLICT (group_key,
                    COALESCE(recipient_subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
                    COALESCE(recipient_role_code, ''),
                    channel)
         WHERE group_key IS NOT NULL AND read_at IS NULL AND dismissed_at IS NULL
       DO UPDATE SET occurrence_count = notification.occurrence_count + 1,
                     last_occurred_at = now(),
                     title = EXCLUDED.title,
                     body = EXCLUDED.body
       RETURNING id::text`,
      [
        templateId,
        input.recipientSubjectId ?? null,
        input.recipientRoleCode ?? null,
        channels[0],
        title.slice(0, 255),
        body,
        input.values ? JSON.stringify(input.values) : null,
        input.entityType ?? null,
        input.entityId ?? null,
        input.severity ?? null,
        input.deepLink ?? null,
        input.actionRequired ?? null,
        input.groupKey ?? null,
        input.expiresAt ?? null,
        scope?.activeRoleCode ?? null,
      ],
    );

    const id = rows[0].id;
    await this.deliver(schema, id, channels, {
      notificationId: id,
      title,
      body,
      deepLink: input.deepLink ?? null,
      recipientSubjectId: input.recipientSubjectId ?? null,
      severity: input.severity ?? 'INFO',
      actionRequired: input.actionRequired ?? false,
    });

    return { id };
  }

  /**
   * Mengirim lewat setiap kanal, mencatat hasilnya masing-masing.
   *
   * Satu kanal yang gagal tidak menghentikan kanal lain. Itulah alasan
   * catatan pengirimannya satu baris per kanal.
   */
  private async deliver(
    schema: string,
    notificationId: string,
    channels: Channel[],
    payload: Parameters<ChannelAdapter['send']>[0],
  ): Promise<void> {
    let adaYangSampai = false;

    for (const channel of channels) {
      const adapter = this.adapters.find((a) => a.channel === channel);
      const hasil = adapter
        ? await adapter.send(payload).catch((error: Error) => ({
            status: 'FAILED' as const,
            note: error.message,
          }))
        : { status: 'FAILED' as const, note: `Kanal ${channel} tidak dikenal.` };

      if (hasil.status === 'SENT') adaYangSampai = true;

      // Kegagalan MENCATAT pengiriman tidak boleh menggagalkan pemberitahuannya.
      //
      // Sempat terjadi: satu galat SQL di sini membuat `notify()` melaporkan
      // gagal padahal barisnya sudah tersimpan dan sudah tampil pada lonceng.
      // Pemanggil yang mengira pemberitahuannya gagal dapat mengirim ulang, dan
      // penerimanya melihat pesan yang sama dua kali.
      await this.tenantDb.query(
        schema,
        `INSERT INTO "${schema}".notification_delivery
           (notification_id, channel, status, note, attempt_count, last_attempt_at, sent_at)
         VALUES ($1::uuid, $2, $3::varchar, $4, 1, now(),
                 CASE WHEN $3::text = 'SENT' THEN now() ELSE NULL END)
         ON CONFLICT (notification_id, channel) DO UPDATE
           SET status = EXCLUDED.status,
               note = EXCLUDED.note,
               attempt_count = notification_delivery.attempt_count + 1,
               last_attempt_at = now(),
               sent_at = COALESCE(notification_delivery.sent_at, EXCLUDED.sent_at)`,
        [notificationId, channel, hasil.status, hasil.note ?? null],
      ).catch((error: Error) => {
        this.logger.warn(`Catatan pengiriman gagal disimpan: ${error.message}`);
      });
    }

    // Status pada `notification` mencerminkan apakah SETIDAKNYA SATU kanal
    // sampai. Pemberitahuan yang sampai lewat aplikasi tetapi gagal lewat surel
    // tetap sampai; menandainya gagal akan menyembunyikan yang berhasil.
    await this.tenantDb
      .query(
        schema,
        `UPDATE "${schema}".notification
            SET status = $2::varchar,
                sent_at = CASE WHEN $2::text = 'SENT' THEN now() ELSE sent_at END
          WHERE id = $1::uuid`,
        [notificationId, adaYangSampai ? 'SENT' : 'PENDING'],
      )
      .catch((error: Error) => {
        this.logger.warn(`Status pengiriman gagal diperbarui: ${error.message}`);
      });
  }

  /**
   * Isi lonceng.
   *
   * Yang menuntut tindakan didahulukan, bukan yang terbaru. Lonceng yang
   * mengurutkan menurut waktu akan mengubur permintaan persetujuan kemarin di
   * bawah sepuluh kabar hari ini.
   */
  async bell(schema: string, user: AuthenticatedUser, limit = 20) {
    const subjectId = await this.subjectIdOf(schema, user.userId);
    const roles = user.activeRoleCode ? [user.activeRoleCode] : [];

    const rows = await this.tenantDb.query(
      schema,
      `SELECT n.id::text, n.title, n.body, n.severity, n.deep_link, n.action_required,
              n.acted_at, n.read_at, n.created_at, n.occurrence_count, n.last_occurred_at,
              n.entity_type, n.entity_id::text, n.group_key
         FROM "${schema}".notification n
        WHERE n.dismissed_at IS NULL
          AND (n.expires_at IS NULL OR n.expires_at > now())
          AND (n.recipient_subject_id = $1::uuid
               OR (n.recipient_role_code IS NOT NULL AND n.recipient_role_code = ANY($2::text[])))
        ORDER BY (n.action_required AND n.acted_at IS NULL) DESC,
                 (n.read_at IS NULL) DESC,
                 n.last_occurred_at DESC NULLS LAST,
                 n.created_at DESC
        LIMIT $3`,
      [subjectId, roles, Math.min(Math.max(limit, 1), 100)],
    );

    const hitung = await this.tenantDb.query<{ belum_dibaca: string; menunggu_tindakan: string }>(
      schema,
      `SELECT count(*) FILTER (WHERE read_at IS NULL) AS belum_dibaca,
              count(*) FILTER (WHERE action_required AND acted_at IS NULL) AS menunggu_tindakan
         FROM "${schema}".notification
        WHERE dismissed_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
          AND (recipient_subject_id = $1::uuid
               OR (recipient_role_code IS NOT NULL AND recipient_role_code = ANY($2::text[])))`,
      [subjectId, roles],
    );

    return {
      unreadCount: Number(hitung[0]?.belum_dibaca ?? 0),
      actionPendingCount: Number(hitung[0]?.menunggu_tindakan ?? 0),
      items: rows,
    };
  }

  /** Menandai sudah dibaca. */
  async markRead(schema: string, user: AuthenticatedUser, ids: string[]) {
    const subjectId = await this.subjectIdOf(schema, user.userId);
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".notification
          SET read_at = now()
        WHERE id = ANY($1::uuid[]) AND read_at IS NULL
          AND (recipient_subject_id = $2::uuid
               OR (recipient_role_code IS NOT NULL AND recipient_role_code = ANY($3::text[])))
       RETURNING id::text`,
      [ids, subjectId, user.activeRoleCode ? [user.activeRoleCode] : []],
    );
    return { marked: rows.length };
  }

  /**
   * Menandai sudah ditindaklanjuti.
   *
   * Berbeda dari dibaca. Melihat permintaan persetujuan tidak sama dengan
   * menyetujuinya, dan lonceng yang menganggapnya sama akan menyembunyikan
   * pekerjaan yang belum selesai.
   */
  async markActed(schema: string, user: AuthenticatedUser, id: string) {
    const subjectId = await this.subjectIdOf(schema, user.userId);
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".notification
          SET acted_at = now(), read_at = COALESCE(read_at, now())
        WHERE id = $1::uuid
          AND (recipient_subject_id = $2::uuid
               OR (recipient_role_code IS NOT NULL AND recipient_role_code = ANY($3::text[])))
       RETURNING id::text`,
      [id, subjectId, user.activeRoleCode ? [user.activeRoleCode] : []],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pemberitahuan tidak ditemukan.');
    }
    return { acted: true };
  }

  /** Menutup tanpa menindaklanjuti. */
  async dismiss(schema: string, user: AuthenticatedUser, id: string) {
    const subjectId = await this.subjectIdOf(schema, user.userId);
    const rows = await this.tenantDb.query<{ id: string; action_required: boolean }>(
      schema,
      `SELECT id::text, action_required FROM "${schema}".notification
        WHERE id = $1::uuid
          AND (recipient_subject_id = $2::uuid
               OR (recipient_role_code IS NOT NULL AND recipient_role_code = ANY($3::text[])))`,
      [id, subjectId, user.activeRoleCode ? [user.activeRoleCode] : []],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pemberitahuan tidak ditemukan.');
    }
    if (rows[0].action_required) {
      // Menutup permintaan persetujuan tanpa menanggapinya akan membuat
      // pekerjaan orang lain berhenti menunggu tanpa ada yang tahu sebabnya.
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Pemberitahuan yang menuntut tindakan tidak dapat ditutup begitu saja. ' +
          'Tindaklanjuti terlebih dahulu.',
      );
    }
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".notification SET dismissed_at = now() WHERE id = $1::uuid`,
      [id],
    );
    return { dismissed: true };
  }

  /** Keadaan setiap kanal — siap atau apa yang kurang. */
  channelStatus() {
    return {
      channels: this.adapters.map((a) => ({
        channel: a.channel,
        configured: a.isConfigured(),
        // Disebutkan apa yang kurang, bukan sekadar "tidak dikonfigurasi" yang
        // memaksa operatornya menebak apa yang harus disiapkan.
        missing: a.isConfigured() ? null : a.missingRequirement(),
      })),
    };
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
