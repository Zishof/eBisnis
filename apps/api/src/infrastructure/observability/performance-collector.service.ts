/**
 * Pengumpul metrik kinerja.
 *
 * ## Mengukur tidak boleh membebani yang diukur
 *
 * Pengumpul yang berjalan setiap permintaan akan menjadi bagian dari masalah
 * yang hendak diukurnya. Karena itu cuplikan proses diambil berkala, dan
 * kinerja rute diagregasi dalam memori lalu ditulis sekali per jendela — bukan
 * satu baris per permintaan.
 *
 * ## Agregat di memori, bukan di basis data
 *
 * Menulis satu baris per permintaan berarti tabel yang tumbuh sebesar lalu
 * lintas, dan pertanyaan yang benar-benar ditanyakan hampir selalu tentang
 * persentil — bukan tentang satu permintaan tertentu.
 *
 * Konsekuensinya harus diakui: agregat yang belum tertulis **hilang** bila
 * proses mati mendadak. Itu pertukaran yang disengaja; kehilangan lima menit
 * data kinerja jauh lebih ringan daripada memperlambat setiap permintaan.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks';
import { PrismaService } from '../database/prisma.service';
import { normalizeRoute } from './telemetry-sanitizer';
import { percentile } from './leak-heuristics';

/** Lebar jendela agregasi, dalam menit. */
export const WINDOW_MINUTES = 5;
/** Jarak antar cuplikan proses, dalam milidetik. */
const SNAPSHOT_INTERVAL_MS = 60_000;

interface RouteBucket {
  routeTemplate: string;
  httpMethod: string;
  moduleCode: string | null;
  durations: number[];
  errorCount: number;
}

@Injectable()
export class PerformanceCollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PerformanceCollectorService.name);

  private readonly serviceName = process.env.SERVICE_NAME ?? 'ebisnis-api';
  private readonly releaseVersion = process.env.RELEASE_VERSION ?? null;
  private readonly hostName = process.env.HOSTNAME ?? null;

  /** Ember agregat untuk jendela yang sedang berjalan. */
  private buckets = new Map<string, RouteBucket>();
  private windowStart = alignToWindow(new Date());

  private eventLoopMonitor: ReturnType<typeof monitorEventLoopDelay> | null = null;
  private gcObserver: PerformanceObserver | null = null;
  private gcCount = 0;
  private gcDurationMs = 0;
  private lastCpu = process.cpuUsage();

  private snapshotTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Pemantau event loop bersifat pasif; ia tidak menambah pekerjaan pada
    // jalur permintaan.
    try {
      this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
      this.eventLoopMonitor.enable();
    } catch (error) {
      this.logger.warn(`Pemantau event loop tidak tersedia: ${(error as Error).message}`);
    }

    try {
      this.gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.gcCount += 1;
          this.gcDurationMs += entry.duration;
        }
      });
      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch (error) {
      this.logger.warn(`Pemantau GC tidak tersedia: ${(error as Error).message}`);
    }

    this.snapshotTimer = setInterval(() => {
      void this.captureSnapshot();
    }, SNAPSHOT_INTERVAL_MS);
    // `unref` supaya timer ini tidak menahan proses tetap hidup saat hendak
    // berhenti. Observability tidak boleh menghalangi penutupan.
    this.snapshotTimer.unref();

    this.flushTimer = setInterval(() => {
      void this.flushWindow();
    }, WINDOW_MINUTES * 60_000);
    this.flushTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.eventLoopMonitor?.disable();
    this.gcObserver?.disconnect();
    // Menulis sisa agregat sebelum berhenti; ini satu-satunya kesempatan
    // menyelamatkan jendela yang sedang berjalan.
    await this.flushWindow().catch(() => undefined);
  }

  /**
   * Mencatat satu permintaan.
   *
   * Dipanggil dari interceptor. Hanya menambah angka ke ember di memori —
   * tidak menyentuh basis data sama sekali.
   */
  record(input: {
    routePath: string;
    httpMethod: string;
    moduleCode?: string | null;
    durationMs: number;
    isError: boolean;
  }): void {
    const routeTemplate = normalizeRoute(input.routePath);
    const key = `${input.httpMethod} ${routeTemplate}`;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        routeTemplate,
        httpMethod: input.httpMethod,
        moduleCode: input.moduleCode ?? null,
        durations: [],
        errorCount: 0,
      };
      this.buckets.set(key, bucket);
    }

    // Batas jumlah sampel per ember. Persentil dari sepuluh ribu sampel tidak
    // lebih tepat daripada dari seribu, tetapi memakan sepuluh kali memori.
    if (bucket.durations.length < 1000) {
      bucket.durations.push(Math.round(input.durationMs));
    }
    if (input.isError) bucket.errorCount += 1;
  }

  /** Menulis agregat jendela yang sudah lewat. */
  async flushWindow(): Promise<number> {
    if (this.buckets.size === 0) return 0;

    const buckets = this.buckets;
    const windowStart = this.windowStart;

    // Ember diganti lebih dulu agar permintaan yang datang selagi penulisan
    // berjalan masuk ke jendela berikutnya, bukan hilang.
    this.buckets = new Map();
    this.windowStart = alignToWindow(new Date());

    let written = 0;
    for (const bucket of buckets.values()) {
      if (bucket.durations.length === 0) continue;

      try {
        await this.prisma.performanceRouteAggregate.upsert({
          where: {
            windowStart_routeTemplate_httpMethod_serviceName: {
              windowStart,
              routeTemplate: bucket.routeTemplate,
              httpMethod: bucket.httpMethod,
              serviceName: this.serviceName,
            },
          },
          create: {
            windowStart,
            windowMinutes: WINDOW_MINUTES,
            routeTemplate: bucket.routeTemplate,
            httpMethod: bucket.httpMethod,
            moduleCode: bucket.moduleCode,
            serviceName: this.serviceName,
            releaseVersion: this.releaseVersion,
            requestCount: bucket.durations.length,
            errorCount: bucket.errorCount,
            durationP50: percentile(bucket.durations, 50),
            durationP90: percentile(bucket.durations, 90),
            durationP95: percentile(bucket.durations, 95),
            durationP99: percentile(bucket.durations, 99),
            durationMax: Math.max(...bucket.durations),
            totalDurationMs: BigInt(bucket.durations.reduce((a, b) => a + b, 0)),
          },
          update: {
            requestCount: { increment: bucket.durations.length },
            errorCount: { increment: bucket.errorCount },
          },
        });
        written += 1;
      } catch (error) {
        this.logger.warn(
          `Agregat ${bucket.httpMethod} ${bucket.routeTemplate} gagal ditulis: ${(error as Error).message}`,
        );
      }
    }

    return written;
  }

  /** Mengambil cuplikan keadaan proses. */
  async captureSnapshot(): Promise<void> {
    try {
      const memory = process.memoryUsage();
      const cpu = process.cpuUsage(this.lastCpu);
      this.lastCpu = process.cpuUsage();

      const delay = this.eventLoopMonitor;
      const p50 = delay ? delay.percentile(50) / 1e6 : 0;
      const p99 = delay ? delay.percentile(99) / 1e6 : 0;
      delay?.reset();

      const gcCount = this.gcCount;
      const gcDurationMs = Math.round(this.gcDurationMs);
      this.gcCount = 0;
      this.gcDurationMs = 0;

      await this.prisma.performanceSnapshot.create({
        data: {
          serviceName: this.serviceName,
          hostName: this.hostName,
          releaseVersion: this.releaseVersion,
          rss: BigInt(memory.rss),
          heapTotal: BigInt(memory.heapTotal),
          heapUsed: BigInt(memory.heapUsed),
          external: BigInt(memory.external),
          arrayBuffers: BigInt(memory.arrayBuffers),
          gcCount,
          gcDurationMs,
          eventLoopDelayP50: p50,
          eventLoopDelayP99: p99,
          eventLoopUtilization: 0,
          activeHandles: countHandles(),
          activeRequests: countRequests(),
          cpuUserMicros: BigInt(cpu.user),
          cpuSystemMicros: BigInt(cpu.system),
          uptimeSeconds: Math.round(process.uptime()),
        },
      });
    } catch (error) {
      // Sama seperti penangkapan galat: kegagalan mencatat metrik tidak boleh
      // mengganggu apa pun.
      this.logger.warn(`Cuplikan kinerja gagal disimpan: ${(error as Error).message}`);
    }
  }
}

/** Membulatkan waktu ke awal jendela agregasi. */
export function alignToWindow(date: Date, windowMinutes = WINDOW_MINUTES): Date {
  const ms = windowMinutes * 60_000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

/**
 * Jumlah hal yang sedang menahan event loop.
 *
 * ## Mengapa bukan `_getActiveHandles`
 *
 * `process._getActiveHandles()` adalah API internal yang **tidak menghitung
 * timer**. Padahal `setInterval` yang tidak pernah dibersihkan justru salah satu
 * kebocoran paling sering terjadi. Diukur dengan API itu, kebocoran timer akan
 * tampak sebagai angka tetap — dan heuristiknya akan menyimpulkan NORMAL
 * selamanya.
 *
 * `process.getActiveResourcesInfo()` adalah API resmi sejak Node 17 dan
 * menghitung keduanya. Yang ditanyakan heuristik memang "apakah jumlah hal yang
 * menahan proses terus bertambah", jadi total inilah angka yang tepat.
 *
 * API lama tetap dipakai sebagai cadangan pada runtime yang belum memilikinya;
 * angka yang kurang tepat masih lebih berguna daripada nol.
 */
export function countHandles(): number {
  try {
    const modern = (process as { getActiveResourcesInfo?: () => string[] }).getActiveResourcesInfo;
    if (typeof modern === 'function') return modern.call(process).length;
    const legacy = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles;
    return typeof legacy === 'function' ? legacy.call(process).length : 0;
  } catch {
    // Metrik yang hilang lebih baik daripada proses yang jatuh.
    return 0;
  }
}

/**
 * Permintaan keluar yang belum selesai — kueri basis data, DNS, berkas.
 *
 * Hanya tersedia lewat API internal; ketiadaannya menghasilkan nol.
 */
export function countRequests(): number {
  try {
    const fn = (process as unknown as { _getActiveRequests?: () => unknown[] })._getActiveRequests;
    return typeof fn === 'function' ? fn.call(process).length : 0;
  } catch {
    return 0;
  }
}
