/**
 * Pembacaan galat terpusat.
 *
 * ## Tampilan bawaan adalah galat unik
 *
 * Daftar kejadian mentah tidak dapat dibaca: satu kegagalan yang terjadi
 * sepuluh ribu kali menenggelamkan sembilan masalah lain. Yang ditampilkan
 * lebih dulu adalah kelompok; kejadiannya dibuka bila diperlukan.
 *
 * ## Setiap pembacaan tercatat
 *
 * Observability memuat jejak seluruh tenant. Siapa yang membacanya, kapan, dan
 * dengan alasan apa harus dapat dipertanggungjawabkan — termasuk ketika yang
 * membaca adalah Super Admin.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

/** Tampilan yang tersedia pada dasbor. */
export type ErrorView =
  | 'UNIQUE'
  | 'NEW'
  | 'REGRESSED'
  | 'UNHANDLED'
  | 'RESOLVED'
  | 'IGNORED';

export interface ErrorGroupFilter {
  view?: ErrorView;
  moduleCode?: string;
  severity?: string;
  status?: string;
  /** Kata kunci pada pesan yang sudah dinormalkan. */
  search?: string;
  sinceDays?: number;
  page?: number;
  limit?: number;
}

export interface AccessActor {
  userId: string;
  username: string;
  requestId?: string;
  ipAddress?: string;
  reason?: string;
}

@Injectable()
export class ErrorQueryService {
  private readonly logger = new Logger(ErrorQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Daftar kelompok galat. */
  async listGroups(filter: ErrorGroupFilter, actor: AccessActor) {
    const limit = Math.min(Math.max(filter.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(1, Math.floor(filter.page ?? 1));

    const where = this.buildWhere(filter);

    const [rows, total] = await Promise.all([
      this.prisma.errorGroup.findMany({
        where,
        orderBy: [{ lastSeenAt: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          fingerprint: true,
          errorType: true,
          messageNormalized: true,
          moduleCode: true,
          routeTemplate: true,
          severity: true,
          status: true,
          firstSeenAt: true,
          lastSeenAt: true,
          occurrenceCount: true,
          affectedTenantCount: true,
          affectedUserCount: true,
          regressed: true,
          assignedTo: true,
        },
      }),
      this.prisma.errorGroup.count({ where }),
    ]);

    await this.recordAccess(actor, 'READ', 'ErrorGroupList', null, null);

    return {
      items: rows.map((row) => ({
        ...row,
        // Sidik dipotong pada tampilan daftar. Enam puluh empat karakter
        // heksadesimal tidak menambah apa pun selain kebisingan.
        fingerprintShort: row.fingerprint.slice(0, 12),
      })),
      page,
      limit,
      total,
      hasMore: (page - 1) * limit + rows.length < total,
    };
  }

  /** Satu kelompok beserta contoh kejadian terakhirnya. */
  async getGroup(groupId: string, actor: AccessActor) {
    const group = await this.prisma.errorGroup.findUnique({
      where: { id: groupId },
      include: {
        occurrences: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
          select: {
            id: true,
            occurredAt: true,
            severity: true,
            messageSanitized: true,
            stackSanitized: true,
            causeChainSanitized: true,
            httpMethod: true,
            httpStatus: true,
            routeTemplate: true,
            requestId: true,
            tenantUsernameSnapshot: true,
            releaseVersion: true,
            serviceName: true,
            source: true,
          },
        },
      },
    });
    if (!group) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kelompok galat tidak ditemukan.');
    }

    await this.recordAccess(actor, 'READ', 'ErrorGroup', groupId, null);
    return group;
  }

  /** Kejadian pada satu kelompok, untuk penelusuran lebih dalam. */
  async listOccurrences(
    groupId: string,
    options: { page?: number; limit?: number; tenantId?: string },
    actor: AccessActor,
  ) {
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(1, Math.floor(options.page ?? 1));

    const where: Prisma.ErrorLogWhereInput = {
      errorGroupId: groupId,
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.errorLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.errorLog.count({ where }),
    ]);

    await this.recordAccess(
      actor,
      'READ',
      'ErrorOccurrenceList',
      groupId,
      options.tenantId ?? null,
    );

    return { items: rows, page, limit, total, hasMore: (page - 1) * limit + rows.length < total };
  }

  /**
   * Mengubah status kelompok.
   *
   * Alasan wajib untuk `IGNORED`. Galat yang diabaikan tanpa alasan akan
   * diabaikan lagi oleh orang berikutnya tanpa tahu mengapa.
   */
  async setStatus(
    groupId: string,
    status: string,
    actor: AccessActor,
    reason?: string,
  ) {
    if (status === 'IGNORED' && (!reason || reason.trim().length < 5)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Mengabaikan galat menuntut alasan tertulis.',
      );
    }

    const group = await this.prisma.errorGroup.findUnique({
      where: { id: groupId },
      select: { id: true, status: true },
    });
    if (!group) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kelompok galat tidak ditemukan.');
    }

    const updated = await this.prisma.errorGroup.update({
      where: { id: groupId },
      data: {
        status,
        ignoreReason: status === 'IGNORED' ? (reason ?? null) : undefined,
        resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
        resolvedBy: status === 'RESOLVED' ? actor.userId : undefined,
        // Menyatakan selesai mencatat rilis yang berlaku, sehingga kemunculan
        // berikutnya dapat dikenali sebagai regresi.
        lastResolvedRelease:
          status === 'RESOLVED' ? (process.env.RELEASE_VERSION ?? null) : undefined,
        regressed: status === 'RESOLVED' ? false : undefined,
      },
    });

    await this.recordAccess(actor, 'READ', 'ErrorGroupStatus', groupId, null, reason);
    this.logger.log(`Kelompok ${groupId}: ${group.status} -> ${status} oleh ${actor.username}.`);
    return updated;
  }

  /**
   * Menyusun paket konteks untuk dianalisis.
   *
   * Hanya memuat yang diperlukan untuk memahami galat. Seluruh isinya sudah
   * tersanitasi sejak disimpan — tidak ada penyamaran tambahan di sini, karena
   * penyamaran yang dilakukan dua kali di dua tempat akan berbeda.
   *
   * Alasan **wajib**: ekspor mengeluarkan data dari sistem, dan ekspor tanpa
   * alasan tidak dapat ditinjau kemudian.
   */
  async buildContext(groupId: string, actor: AccessActor): Promise<string> {
    if (!actor.reason || actor.reason.trim().length < 5) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Ekspor konteks menuntut alasan tertulis.',
      );
    }

    const group = await this.prisma.errorGroup.findUnique({
      where: { id: groupId },
      include: { occurrences: { orderBy: { occurredAt: 'desc' }, take: 3 } },
    });
    if (!group) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kelompok galat tidak ditemukan.');
    }

    await this.recordAccess(actor, 'EXPORT', 'ErrorGroup', groupId, null, actor.reason);

    const sample = group.occurrences[0];
    const lines = [
      `# Galat: ${group.errorType}`,
      '',
      `**Sidik:** \`${group.fingerprint.slice(0, 16)}\``,
      `**Pesan:** ${group.messageNormalized}`,
      `**Modul:** ${group.moduleCode ?? 'tidak diketahui'}`,
      `**Rute:** ${group.routeTemplate ?? 'tidak diketahui'}`,
      `**Tingkat:** ${group.severity}`,
      `**Status:** ${group.status}${group.regressed ? ' (REGRESI)' : ''}`,
      '',
      '## Dampak',
      '',
      `- Terjadi ${group.occurrenceCount} kali`,
      `- Pertama: ${group.firstSeenAt.toISOString()}`,
      `- Terakhir: ${group.lastSeenAt.toISOString()}`,
      `- Tenant terdampak: ${group.affectedTenantCount}`,
      `- Pengguna terdampak: ${group.affectedUserCount}`,
      `- Rilis saat pertama muncul: ${group.introducedRelease ?? 'tidak tercatat'}`,
      '',
    ];

    if (sample) {
      lines.push(
        '## Contoh kejadian',
        '',
        `- Waktu: ${sample.occurredAt.toISOString()}`,
        `- HTTP: ${sample.httpMethod ?? '-'} ${sample.routeTemplate ?? '-'} -> ${sample.httpStatus ?? '-'}`,
        `- Layanan: ${sample.serviceName ?? '-'} (${sample.source})`,
        `- Rilis: ${sample.releaseVersion ?? 'tidak tercatat'}`,
        '',
        '### Pesan',
        '',
        '```text',
        sample.messageSanitized,
        '```',
        '',
      );

      if (sample.stackSanitized) {
        lines.push('### Jejak tumpukan', '', '```text', sample.stackSanitized, '```', '');
      }
      if (sample.causeChainSanitized) {
        lines.push('### Rantai penyebab', '', '```text', sample.causeChainSanitized, '```', '');
      }
    }

    lines.push(
      '## Catatan',
      '',
      'Seluruh isi paket ini sudah melalui penyamaran: token, kata sandi, dan',
      'header di luar daftar izin tidak pernah tersimpan. Alamat IP hanya',
      'tersimpan tanpa oktet terakhir, dan id sesi hanya sebagai hash.',
      '',
      'Analisis apa pun atas paket ini adalah **saran**, bukan kebenaran.',
      'Perbaikan tetap menuntut cabang, test, dan peninjauan manusia.',
    );

    return lines.join('\n');
  }

  private buildWhere(filter: ErrorGroupFilter): Prisma.ErrorGroupWhereInput {
    const where: Prisma.ErrorGroupWhereInput = {};

    switch (filter.view) {
      case 'NEW':
        where.status = 'NEW';
        break;
      case 'REGRESSED':
        where.regressed = true;
        break;
      case 'UNHANDLED':
        // Belum ditangani siapa pun: belum berstatus lanjut dan belum ditugaskan.
        where.status = { in: ['NEW', 'TRIAGED'] };
        where.assignedTo = null;
        break;
      case 'RESOLVED':
        where.status = 'RESOLVED';
        break;
      case 'IGNORED':
        where.status = 'IGNORED';
        break;
      default:
        // Tampilan bawaan menyembunyikan yang sudah selesai dan yang sengaja
        // diabaikan — keduanya bukan pekerjaan yang menunggu.
        where.status = { notIn: ['RESOLVED', 'IGNORED', 'DUPLICATE', 'NOT_ACTIONABLE'] };
    }

    if (filter.moduleCode) where.moduleCode = filter.moduleCode;
    if (filter.severity) where.severity = filter.severity;
    if (filter.status) where.status = filter.status;

    if (filter.search && filter.search.trim().length >= 2) {
      where.messageNormalized = { contains: filter.search.trim(), mode: 'insensitive' };
    }

    if (filter.sinceDays && filter.sinceDays > 0) {
      where.lastSeenAt = { gte: new Date(Date.now() - filter.sinceDays * 24 * 60 * 60 * 1000) };
    }

    return where;
  }

  /**
   * Mencatat akses.
   *
   * Kegagalan mencatat tidak menghalangi pembacaan — tetapi dicatat pada log
   * proses, karena akses yang tidak tercatat adalah celah audit.
   */
  private async recordAccess(
    actor: AccessActor,
    action: string,
    subjectType: string,
    subjectId: string | null,
    affectedTenantId: string | null,
    reason?: string,
  ): Promise<void> {
    await this.prisma.observabilityAccessLog
      .create({
        data: {
          actorUserId: actor.userId,
          actorUsername: actor.username,
          action,
          subjectType,
          subjectId,
          affectedTenantId,
          reason: reason ?? actor.reason ?? null,
          requestId: actor.requestId ?? null,
          ipMasked: actor.ipAddress ?? null,
        },
      })
      .catch((error: Error) => {
        this.logger.error(`Akses observability gagal dicatat: ${error.message}`);
      });
  }
}
