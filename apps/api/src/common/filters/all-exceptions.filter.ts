import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCodes } from '../errors/app-error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

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
