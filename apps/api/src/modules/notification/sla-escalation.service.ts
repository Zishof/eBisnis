/**
 * Eskalasi batas waktu persetujuan surat.
 *
 * V10-6 menghitung dan menyimpan `due_at` pada setiap langkah persetujuan,
 * tetapi tidak ada yang membacanya. Batas waktu yang tercatat tanpa ada yang
 * menindaklanjutinya sama tidak bergunanya dengan tidak ada batas waktu —
 * suratnya tetap menunggu, dan tidak ada seorang pun yang tahu.
 *
 * Berjalan berkala, memeriksa langkah yang batas waktunya terlampaui, lalu
 * menerbitkan pemberitahuan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { NotificationService } from './notification.service';

@Injectable()
export class SlaEscalationService {
  private readonly logger = new Logger(SlaEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Diperiksa tiap jam.
   *
   * Bukan tiap menit: batas waktu persetujuan diukur dalam jam, dan memeriksa
   * tiap menit hanya membebani basis data untuk ketelitian yang tidak
   * dibutuhkan siapa pun.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepAll(): Promise<void> {
    const tenants = await this.prisma.tenantSchemaRegistry.findMany({
      where: { status: 'READY' },
      select: { schemaName: true },
    });

    for (const tenant of tenants) {
      try {
        await this.sweep(tenant.schemaName);
      } catch (error) {
        // Satu tenant yang gagal tidak menghentikan tenant lain.
        this.logger.warn(
          `Eskalasi SLA gagal pada ${tenant.schemaName}: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Memeriksa satu tenant.
   *
   * Mengembalikan jumlah eskalasi yang diterbitkan supaya dapat diuji dan
   * dipanggil manual.
   */
  async sweep(schema: string): Promise<{ escalated: number }> {
    const terlambat = await this.tenantDb.query<{
      approval_id: string;
      outgoing_id: string;
      subject: string;
      letter_number: string | null;
      step_order: number;
      step_name: string | null;
      role_code: string | null;
      due_at: Date;
      jam_terlambat: string;
    }>(
      schema,
      `SELECT a.id::text AS approval_id, o.id::text AS outgoing_id, o.subject,
              o.letter_number, a.step_order, s.name AS step_name, s.role_code, a.due_at,
              EXTRACT(EPOCH FROM (now() - a.due_at)) / 3600 AS jam_terlambat
         FROM "${schema}".surat_approval a
         JOIN "${schema}".surat_outgoing o ON o.id = a.outgoing_id
         LEFT JOIN "${schema}".surat_approval_flow_step s ON s.id = a.flow_step_id
        WHERE a.decision = 'MENUNGGU'
          AND a.due_at IS NOT NULL
          AND a.due_at < now()
          AND o.deleted_at IS NULL
        ORDER BY a.due_at`,
    );

    let escalated = 0;
    for (const baris of terlambat) {
      const jam = Math.floor(Number(baris.jam_terlambat));
      const hasil = await this.notifications.notify(schema, {
        title: `Persetujuan surat terlambat ${jam} jam`,
        body:
          `Surat "${baris.subject}" menunggu keputusan pada langkah ${baris.step_order}` +
          `${baris.step_name ? ` (${baris.step_name})` : ''} sejak ${baris.due_at.toISOString()}.`,
        recipientRoleCode: baris.role_code,
        deepLink: `/app/surat/keluar/${baris.outgoing_id}`,
        entityType: 'SuratOutgoing',
        entityId: baris.outgoing_id,
        // Terlambat lebih dari sehari naik menjadi kritis.
        severity: jam >= 24 ? 'CRITICAL' : 'WARNING',
        actionRequired: true,
        // Dikelompokkan per langkah persetujuan.
        //
        // Tanpa ini, pemeriksaan tiap jam akan menerbitkan satu pemberitahuan
        // baru setiap jam untuk surat yang sama — dan surat yang terlambat tiga
        // hari akan menghasilkan tujuh puluh dua baris pada lonceng, yang
        // menenggelamkan segala hal lain dan membuat lonceng itu diabaikan.
        //
        // Dengan kunci kelompok, ia menjadi satu baris berpenghitung yang naik.
        groupKey: `SLA_SURAT:${baris.approval_id}`,
      });
      if (hasil.id) escalated += 1;
    }

    if (escalated > 0) {
      this.logger.log(`${escalated} eskalasi SLA diterbitkan pada ${schema}.`);
    }
    return { escalated };
  }
}
