import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Prisma } from '@prisma/client';

const RAW_RESPONSE = 'ebisnis:raw-response';

/**
 * Membungkus response menjadi envelope konsisten dan menserialisasi Decimal
 * sebagai string (aturan: jangan pernah mengirim uang sebagai float JS).
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const requestId: string | undefined = request?.requestId;

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && RAW_RESPONSE in (data as object)) {
          return (data as Record<string, unknown>)[RAW_RESPONSE];
        }
        const serialized = serializeDecimals(data);
        if (
          serialized &&
          typeof serialized === 'object' &&
          'items' in (serialized as object) &&
          'meta' in (serialized as object)
        ) {
          const paged = serialized as { items: unknown; meta: unknown };
          return { success: true, data: paged.items, meta: paged.meta, requestId };
        }
        return { success: true, data: serialized, requestId };
      }),
    );
  }
}

export function rawResponse<T>(value: T): Record<string, T> {
  return { [RAW_RESPONSE]: value };
}

export function serializeDecimals(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return value.toFixed();
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDecimals);
  if (typeof value === 'object') {
    // Objek Decimal dari driver pg diserialisasi via toString jika bertanda decimal.
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = serializeDecimals(v);
      }
      return out;
    }
    return value;
  }
  return value;
}
