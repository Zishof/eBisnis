/**
 * Pencatat durasi permintaan.
 *
 * Hanya menambah angka ke ember di memori — tidak menyentuh basis data sama
 * sekali. Pengumpul yang menulis pada setiap permintaan akan menjadi bagian
 * dari masalah yang hendak diukurnya.
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PerformanceCollectorService } from '../../infrastructure/observability/performance-collector.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  /**
   * Pengumpul bersifat opsional dengan alasan yang sama seperti pada filter
   * galat: interceptor ini juga aktif sebelum modul infrastruktur siap.
   */
  constructor(@Optional() private readonly collector?: PerformanceCollectorService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.collector || context.getType() !== 'http') return next.handle();

    const started = process.hrtime.bigint();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const catat = (gagal: boolean) => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      this.collector?.record({
        // Templat rute dipakai bila tersedia; `request.url` memuat id yang
        // membuat setiap permintaan terlihat sebagai rute berbeda.
        routePath: request.route?.path ?? request.url,
        httpMethod: request.method,
        durationMs,
        // Yang dihitung galat hanya kegagalan server. Penolakan validasi adalah
        // hasil yang benar, dan memasukkannya membuat tingkat galat per rute
        // tidak berarti apa-apa.
        //
        // Galat yang dilempar sebelum status ditetapkan dihitung sebagai
        // kegagalan server, karena status pada respons belum mencerminkan apa
        // yang akan dikembalikan filter.
        isError: gagal ? true : response.statusCode >= 500,
      });
    };

    return next.handle().pipe(
      tap({
        next: () => catat(false),
        error: () => catat(true),
      }),
    );
  }
}
