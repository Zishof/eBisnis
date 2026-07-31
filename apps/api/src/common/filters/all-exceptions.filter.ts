import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCodes } from '../errors/app-error';
import { ErrorCaptureService } from '../../infrastructure/observability/error-capture.service';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  /**
   * Penangkap galat bersifat opsional.
   *
   * Filter ini juga dipakai sebelum modul infrastruktur siap — mis. pada galat
   * saat aplikasi menyala. Menuntut penangkap selalu ada akan membuat kegagalan
   * penyalaan tidak terjawab sama sekali.
   */
  constructor(@Optional() private readonly capture?: ErrorCaptureService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = ErrorCodes.INTERNAL_ERROR;
    let message = 'Terjadi kesalahan pada server.';
    let params: Record<string, unknown> = {};
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        errorCode = mapStatusToCode(status);
      } else if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        errorCode = (record.errorCode as string) ?? mapStatusToCode(status);
        message = (record.message as string) ?? message;
        params = (record.params as Record<string, unknown>) ?? {};
        if (Array.isArray(record.message)) {
          errorCode = ErrorCodes.VALIDATION_FAILED;
          message = 'Validasi permintaan gagal.';
          details = record.message;
        }
      }
    } else if (exception instanceof Error) {
      message = this.isProduction ? 'Terjadi kesalahan pada server.' : exception.message;
      // PostgreSQL raise dari trigger immutability.
      const pgMessage = (exception as { message?: string }).message ?? '';
      if (pgMessage.includes('LEDGER_IMMUTABLE') || pgMessage.includes('JOURNAL_IMMUTABLE')) {
        status = HttpStatus.CONFLICT;
        errorCode = ErrorCodes.LEDGER_IMMUTABLE;
        message = 'Data ledger bersifat immutable. Gunakan reversal.';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${errorCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status} ${errorCode}: ${message}`);
    }

    response.status(status).json({
      success: false,
      error: {
        code: errorCode,
        message,
        params,
        ...(details ? { details } : {}),
      },
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });

    // Penyimpanan berjalan SETELAH respons dikirim, dan hasilnya sengaja tidak
    // ditunggu. Permintaan tidak boleh melambat karena observability, dan tidak
    // boleh gagal karena penyimpanannya bermasalah.
    //
    // Pesan yang dikirim ke penangkap adalah pesan ASLI, bukan pesan yang sudah
    // disamarkan untuk produksi — observability memang ada untuk melihat
    // penyebab sesungguhnya, dan penyamaran datanya dilakukan sanitizer.
    void this.capture
      ?.capture({
        error: exception,
        errorType: exception instanceof Error ? exception.name : typeof exception,
        errorCode,
        message: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : null,
        httpStatus: status,
        httpMethod: request.method,
        routePath: request.url,
        requestId: (request as Request & { requestId?: string }).requestId ?? null,
        correlationId: (request as Request & { correlationId?: string }).correlationId ?? null,
        tenantId: (request as Request & { user?: { tenantId?: string } }).user?.tenantId ?? null,
        userId: (request as Request & { user?: { userId?: string } }).user?.userId ?? null,
        headers: request.headers as Record<string, string | string[] | undefined>,
        query: request.query as Record<string, unknown>,
        ipAddress: request.ip,
        // Galat yang bukan HttpException berarti tidak ada yang menanganinya
        // dengan sengaja.
        isHandled: exception instanceof HttpException,
        source: 'API',
      })
      .catch(() => undefined);
  }
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCodes.VALIDATION_FAILED;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCodes.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ErrorCodes.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCodes.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCodes.CONFLICT;
    default:
      return ErrorCodes.INTERNAL_ERROR;
  }
}
