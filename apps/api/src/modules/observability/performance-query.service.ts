/**
 * Pembacaan metrik kinerja.
 *
 * Sama seperti galat: setiap pembacaan tercatat, dan hanya Super Admin yang
 * berhak.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  analyzeHandles,
  analyzeMemory,
  type MemorySample,
} from '../../infrastructure/observability/leak-heuristics';
import type { AccessActor } from './error-query.service';

/** Batas jendela yang boleh diminta sekaligus, dalam jam. */
const MAX_HOURS = 24 * 7;

@Injectable()
export class PerformanceQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kinerja per rute.
   *
   * Diurutkan menurut p95, bukan rata-rata. Rata-rata menyembunyikan ekor yang
   * justru dirasakan pengguna: rute dengan rata-rata 50 ms tetapi p95 3 detik
   * terasa lambat bagi satu dari dua puluh orang.
   */
  async routePerformance(hours: number, actor: AccessActor) {
    const since = new Date(Date.now() - Math.min(hours, MAX_HOURS) * 60 * 60 * 1000);

    const rows = await this.prisma.performanceRouteAggregate.groupBy({
      by: ['routeTemplate', 'httpMethod', 'moduleCode'],
      where: { windowStart: { gte: since } },
      _sum: { requestCount: true, errorCount: true, totalDurationMs: true },
      _max: { durationP95: true, durationP99: true, durationMax: true },
      _avg: { durationP50: true },
    });

    await this.recordAccess(actor, 'RoutePerformance');

    const items = rows
      .map((row) => {
        const requests = row._sum.requestCount ?? 0;
        const errors = row._sum.errorCount ?? 0;
        return {
          routeTemplate: row.routeTemplate,
          httpMethod: row.httpMethod,
          moduleCode: row.moduleCode,
          requestCount: requests,
          errorCount: errors,
          errorRate: requests > 0 ? Math.round((errors / requests) * 10000) / 100 : 0,
          durationP50: Math.round(row._avg.durationP50 ?? 0),
          durationP95: row._max.durationP95 ?? 0,
          durationP99: row._max.durationP99 ?? 0,
          durationMax: row._max.durationMax ?? 0,
          totalDurationMs: Number(row._sum.totalDurationMs ?? 0),
        };
      })
      .sort((a, b) => b.durationP95 - a.durationP95);

    return { sinceHours: Math.min(hours, MAX_HOURS), items };
  }

  /**
   * Analisis memori beserta buktinya.
   *
   * Yang dikembalikan bukan hanya kesimpulan, melainkan angka yang
   * mendasarinya — supaya pembacanya dapat menilai sendiri apakah
   * kesimpulannya masuk akal.
   */
  async memoryAnalysis(hours: number, actor: AccessActor) {
    const since = new Date(Date.now() - Math.min(hours, MAX_HOURS) * 60 * 60 * 1000);

    const rows = await this.prisma.performanceSnapshot.findMany({
      where: { capturedAt: { gte: since } },
      orderBy: { capturedAt: 'asc' },
      select: {
        capturedAt: true,
        heapUsed: true,
        heapTotal: true,
        rss: true,
        gcCount: true,
        activeHandles: true,
        eventLoopDelayP99: true,
      },
    });

    await this.recordAccess(actor, 'MemoryAnalysis');

    const samples: MemorySample[] = rows.map((row) => ({
      capturedAt: row.capturedAt,
      heapUsed: Number(row.heapUsed),
      rss: Number(row.rss),
      gcCount: row.gcCount,
      activeHandles: row.activeHandles,
    }));

    // Batas heap diambil dari heapTotal tertinggi yang teramati. Bukan batas
    // sesungguhnya dari V8, tetapi cukup untuk membedakan "banyak" dari
    // "hampir penuh" — dan lebih jujur daripada menebak angka tetap.
    const heapLimit = rows.length
      ? Math.max(...rows.map((r) => Number(r.heapTotal)))
      : null;

    return {
      memory: analyzeMemory(samples, heapLimit),
      handles: analyzeHandles(samples),
      eventLoop: {
        worstP99Ms: rows.length ? Math.max(...rows.map((r) => r.eventLoopDelayP99)) : 0,
        // Penundaan event loop di atas 100 ms berarti permintaan menunggu
        // giliran, dan itu terasa sebagai lambat meski kuerinya cepat.
        lagging: rows.some((r) => r.eventLoopDelayP99 > 100),
      },
      sampleCount: rows.length,
    };
  }

  private async recordAccess(actor: AccessActor, subjectType: string): Promise<void> {
    await this.prisma.observabilityAccessLog
      .create({
        data: {
          actorUserId: actor.userId,
          actorUsername: actor.username,
          action: 'READ',
          subjectType,
          requestId: actor.requestId ?? null,
          ipMasked: actor.ipAddress ?? null,
        },
      })
      .catch(() => undefined);
  }
}
