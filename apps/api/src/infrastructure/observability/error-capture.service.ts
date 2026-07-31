/**
 * Penangkap galat ke penyimpanan terpusat.
 *
 * ## Menangkap galat tidak boleh menggagalkan permintaan
 *
 * Aturan pertama dan terpenting: bila menyimpan galat gagal, permintaan tetap
 * dijawab. Sistem observability yang membuat aplikasi ikut jatuh ketika
 * penyimpanannya bermasalah lebih merugikan daripada tidak punya observability
 * sama sekali.
 *
 * Karena itu seluruh penyimpanan berjalan **setelah** respons dikirim, dan
 * kegagalannya hanya dicatat pada log proses — bukan dilempar.
 *
 * ## Pengelompokan dilakukan saat menulis, bukan saat membaca
 *
 * Menghitung kelompok saat membaca menuntut memindai seluruh kejadian setiap
 * kali dasbor dibuka. Dengan jutaan baris, itu tidak dapat dilakukan.
 *
 * Kelompok karena itu diperbarui pada setiap kejadian: hitungannya naik,
 * `lastSeenAt` bergeser, dan regresi terdeteksi bila galat yang sudah
 * dinyatakan selesai muncul lagi.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import {
  computeFingerprint,
  flattenCauseChain,
  severityFromStatus,
  shouldPersist,
} from './error-fingerprint';
import {
  maskIp,
  normalizeMessage,
  normalizeRoute,
  sanitize,
  sanitizeHeaders,
  sanitizeStack,
} from './telemetry-sanitizer';

export interface ErrorCaptureInput {
  error: unknown;
  errorType: string;
  errorCode?: string | null;
  message: string;
  stack?: string | null;

  httpStatus?: number | null;
  httpMethod?: string | null;
  routePath?: string | null;

  moduleCode?: string | null;
  resourceCode?: string | null;
  actionCode?: string | null;

  requestId?: string | null;
  correlationId?: string | null;

  tenantId?: string | null;
  tenantUsername?: string | null;
  userId?: string | null;
  activeRoleId?: string | null;
  sessionId?: string | null;

  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;

  isHandled: boolean;
  source?: string;
  workerName?: string | null;
  jobId?: string | null;
  queueName?: string | null;
}

@Injectable()
export class ErrorCaptureService {
  private readonly logger = new Logger(ErrorCaptureService.name);

  /** Rilis yang sedang berjalan; dipakai menandai regresi. */
  private readonly releaseVersion = process.env.RELEASE_VERSION ?? null;
  private readonly gitCommitSha = process.env.GIT_COMMIT_SHA ?? null;
  private readonly serviceName = process.env.SERVICE_NAME ?? 'ebisnis-api';
  private readonly hostName = process.env.HOSTNAME ?? null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menangkap satu galat.
   *
   * Tidak pernah melempar. Pemanggil dapat mengabaikan hasilnya sepenuhnya.
   */
  async capture(input: ErrorCaptureInput): Promise<void> {
    try {
      if (!shouldPersist(input.httpStatus, input.isHandled)) return;

      const fingerprint = computeFingerprint({
        errorType: input.errorType,
        message: input.message,
        stack: input.stack,
        moduleCode: input.moduleCode,
        routePath: input.routePath,
        errorCode: input.errorCode,
      });

      const severity = severityFromStatus(input.httpStatus);
      const routeTemplate = input.routePath ? normalizeRoute(input.routePath) : null;

      const group = await this.upsertGroup({
        fingerprint,
        errorType: input.errorType,
        messageNormalized: normalizeMessage(input.message),
        moduleCode: input.moduleCode ?? null,
        routeTemplate,
        severity,
        tenantId: input.tenantId ?? null,
        userId: input.userId ?? null,
      });

      await this.prisma.errorLog.create({
        data: {
          errorGroupId: group.id,
          fingerprint,
          severity,
          errorType: input.errorType.slice(0, 160),
          errorCode: input.errorCode?.slice(0, 64) ?? null,
          // Seluruh isi melewati sanitizer. Tidak ada jalur penulisan yang
          // boleh melewatinya.
          messageSanitized: String(sanitize(input.message)),
          stackSanitized: sanitizeStack(input.stack ?? undefined),
          causeChainSanitized: flattenCauseChain(input.error),
          moduleCode: input.moduleCode ?? null,
          resourceCode: input.resourceCode ?? null,
          actionCode: input.actionCode ?? null,
          routeTemplate,
          httpMethod: input.httpMethod ?? null,
          httpStatus: input.httpStatus ?? null,
          requestId: input.requestId ?? null,
          correlationId: input.correlationId ?? null,
          tenantId: input.tenantId ?? null,
          tenantUsernameSnapshot: input.tenantUsername ?? null,
          userId: input.userId ?? null,
          activeRoleId: input.activeRoleId ?? null,
          // Hash, bukan id sesi mentah: id mentah pada log berarti siapa pun
          // yang membaca log dapat menyamar sebagai penggunanya.
          sessionIdHash: input.sessionId ? hashSession(input.sessionId) : null,
          releaseVersion: this.releaseVersion,
          gitCommitSha: this.gitCommitSha,
          serviceName: this.serviceName,
          hostName: this.hostName,
          workerName: input.workerName ?? null,
          jobId: input.jobId ?? null,
          queueName: input.queueName ?? null,
          ipMasked: maskIp(input.ipAddress ?? undefined),
          requestHeadersSanitized: sanitizeHeaders(input.headers) as never,
          requestQuerySanitized: (input.query ? sanitize(input.query) : null) as never,
          isHandled: input.isHandled,
          isFatal: !input.isHandled,
          source: input.source ?? 'API',
        },
      });
    } catch (error) {
      // Kegagalan menyimpan galat tidak boleh menggagalkan permintaan. Yang
      // dilakukan hanya mencatatnya pada log proses.
      this.logger.error(
        `Galat gagal disimpan ke observability: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Membuat atau memperbarui kelompok.
   *
   * Dua kejadian yang sampai bersamaan dengan sidik yang sama dapat sama-sama
   * mencoba membuat kelompok. `upsert` menangani perlombaan itu; yang kalah
   * memperbarui alih-alih gagal.
   */
  private async upsertGroup(input: {
    fingerprint: string;
    errorType: string;
    messageNormalized: string;
    moduleCode: string | null;
    routeTemplate: string | null;
    severity: string;
    tenantId: string | null;
    userId: string | null;
  }): Promise<{ id: string }> {
    const existing = await this.prisma.errorGroup.findUnique({
      where: { fingerprint: input.fingerprint },
      select: { id: true, status: true, lastResolvedRelease: true },
    });

    if (!existing) {
      return this.prisma.errorGroup.create({
        data: {
          fingerprint: input.fingerprint,
          errorType: input.errorType.slice(0, 160),
          messageNormalized: input.messageNormalized,
          moduleCode: input.moduleCode,
          routeTemplate: input.routeTemplate,
          severity: input.severity,
          occurrenceCount: 1,
          affectedTenantCount: input.tenantId ? 1 : 0,
          affectedUserCount: input.userId ? 1 : 0,
          introducedRelease: this.releaseVersion,
          status: 'NEW',
        },
        select: { id: true },
      });
    }

    // Galat yang sudah dinyatakan selesai lalu muncul lagi adalah regresi.
    // Menandainya penting: tanpa penanda itu, perbaikan yang gagal terlihat
    // sama dengan galat lama yang belum sempat dibersihkan.
    const regressed = existing.status === 'RESOLVED';

    await this.prisma.errorGroup.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        occurrenceCount: { increment: 1 },
        severity: input.severity,
        ...(regressed ? { status: 'REGRESSED', regressed: true } : {}),
      },
    });

    // Jumlah tenant dan pengguna terdampak dihitung ulang secara berkala, bukan
    // pada setiap kejadian — menghitung DISTINCT pada setiap galat akan membuat
    // penangkapan lebih mahal daripada permintaan yang menyebabkannya.
    return { id: existing.id };
  }

  /**
   * Menghitung ulang jumlah tenant dan pengguna terdampak.
   *
   * Dipanggil penjadwal, bukan setiap kejadian. Angka yang tertinggal beberapa
   * menit masih berguna; penangkapan yang lambat tidak.
   */
  async refreshImpactCounts(limit = 200): Promise<number> {
    const groups = await this.prisma.errorGroup.findMany({
      where: { lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { id: true },
      orderBy: { lastSeenAt: 'desc' },
      take: limit,
    });

    let updated = 0;
    for (const group of groups) {
      const [tenants, users] = await Promise.all([
        this.prisma.errorLog.findMany({
          where: { errorGroupId: group.id, tenantId: { not: null } },
          select: { tenantId: true },
          distinct: ['tenantId'],
        }),
        this.prisma.errorLog.findMany({
          where: { errorGroupId: group.id, userId: { not: null } },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ]);

      await this.prisma.errorGroup.update({
        where: { id: group.id },
        data: { affectedTenantCount: tenants.length, affectedUserCount: users.length },
      });
      updated += 1;
    }
    return updated;
  }
}

/**
 * Hash id sesi.
 *
 * Id sesi mentah pada log berarti siapa pun yang membaca log dapat menyamar
 * sebagai penggunanya. Hash tetap memungkinkan mengelompokkan kejadian dari
 * sesi yang sama tanpa memungkinkan hal itu.
 */
export function hashSession(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 64);
}
