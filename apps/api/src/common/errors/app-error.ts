import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Error aplikasi dengan `errorCode` stabil.
 * Frontend menerjemahkan `errorCode`; pesan bahasa Inggris hanya untuk log.
 * Jangan memakai pesan error sebagai identifier logika.
 */
export class AppError extends HttpException {
  constructor(
    readonly errorCode: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly params: Record<string, unknown> = {},
  ) {
    super({ errorCode, message, params }, status);
  }

  static badRequest(errorCode: string, message: string, params?: Record<string, unknown>) {
    return new AppError(errorCode, message, HttpStatus.BAD_REQUEST, params);
  }

  static unauthorized(errorCode: string, message: string, params?: Record<string, unknown>) {
    return new AppError(errorCode, message, HttpStatus.UNAUTHORIZED, params);
  }

  static forbidden(errorCode: string, message: string, params?: Record<string, unknown>) {
    return new AppError(errorCode, message, HttpStatus.FORBIDDEN, params);
  }

  static notFound(errorCode: string, message: string, params?: Record<string, unknown>) {
    return new AppError(errorCode, message, HttpStatus.NOT_FOUND, params);
  }

  static conflict(errorCode: string, message: string, params?: Record<string, unknown>) {
    return new AppError(errorCode, message, HttpStatus.CONFLICT, params);
  }

  static unprocessable(errorCode: string, message: string, params?: Record<string, unknown>) {
    return new AppError(errorCode, message, HttpStatus.UNPROCESSABLE_ENTITY, params);
  }

  /**
   * Kuota atau batas laju terlampaui.
   *
   * Dibedakan dari `conflict`: klien memperlakukan 429 sebagai "coba lagi
   * nanti" dan 409 sebagai "permintaanmu bertabrakan dengan keadaan sekarang".
   * Memakai 409 untuk kuota membuat klien mencoba ulang seketika, dan
   * percobaan ulang seketika pada kuota yang habis hanya memperburuknya.
   */
  static tooManyRequests(errorCode: string, message: string, params?: Record<string, unknown>) {
    return new AppError(errorCode, message, HttpStatus.TOO_MANY_REQUESTS, params);
  }

  static internal(errorCode: string, message: string, params?: Record<string, unknown>) {
    return new AppError(errorCode, message, HttpStatus.INTERNAL_SERVER_ERROR, params);
  }
}

export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REUSED: 'TOKEN_REUSED',
  FORBIDDEN: 'FORBIDDEN',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  STEP_UP_REQUIRED: 'STEP_UP_REQUIRED',
  STEP_UP_INVALID: 'STEP_UP_INVALID',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  USERNAME_OR_SCHEMA_ALREADY_EXISTS: 'USERNAME_OR_SCHEMA_ALREADY_EXISTS',
  RESERVED_SCHEMA_NAME: 'RESERVED_SCHEMA_NAME',
  INVALID_SCHEMA_NAME: 'INVALID_SCHEMA_NAME',
  TENANT_NOT_READY: 'TENANT_NOT_READY',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  SCHEMA_NOT_REGISTERED: 'SCHEMA_NOT_REGISTERED',
  PROVISIONING_FAILED: 'PROVISIONING_FAILED',
  DEMO_ACTION_DISABLED: 'DEMO_ACTION_DISABLED',
  RATE_LIMITED: 'RATE_LIMITED',
  RECORD_REFERENCED: 'RECORD_REFERENCED',
  PURGE_NOT_ALLOWED: 'PURGE_NOT_ALLOWED',
  RECORD_ALREADY_DELETED: 'RECORD_ALREADY_DELETED',
  RECORD_NOT_DELETED: 'RECORD_NOT_DELETED',
  SAMPLE_DATA_IN_USE: 'SAMPLE_DATA_IN_USE',
  RESOURCE_NOT_CONFIGURED: 'RESOURCE_NOT_CONFIGURED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  PLAN_VERSION_PUBLISHED: 'PLAN_VERSION_PUBLISHED',
  PLAN_PRICE_REQUIRED: 'PLAN_PRICE_REQUIRED',
  PLAN_EFFECTIVE_OVERLAP: 'PLAN_EFFECTIVE_OVERLAP',
  MODULE_DEPENDENCY_MISSING: 'MODULE_DEPENDENCY_MISSING',
  MODULE_CIRCULAR_DEPENDENCY: 'MODULE_CIRCULAR_DEPENDENCY',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  QUOTE_ALREADY_ACCEPTED: 'QUOTE_ALREADY_ACCEPTED',
  INVOICE_IMMUTABLE: 'INVOICE_IMMUTABLE',
  PAYMENT_PROVIDER_DISABLED: 'PAYMENT_PROVIDER_DISABLED',
  PAYMENT_ORDER_INVALID_STATE: 'PAYMENT_ORDER_INVALID_STATE',
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  PAYMENT_PROVIDER_ERROR: 'PAYMENT_PROVIDER_ERROR',
  CALLBACK_HOST_NOT_ALLOWED: 'CALLBACK_HOST_NOT_ALLOWED',
  CALLBACK_PAYLOAD_INVALID: 'CALLBACK_PAYLOAD_INVALID',
  BATCH_LIMIT_EXCEEDED: 'BATCH_LIMIT_EXCEEDED',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  RECEIPT_ALREADY_VALIDATED: 'RECEIPT_ALREADY_VALIDATED',
  RECEIPT_NOT_VALIDATED: 'RECEIPT_NOT_VALIDATED',
  PAYABLE_ALREADY_PAID: 'PAYABLE_ALREADY_PAID',
  RECEIVED_QTY_EXCEEDS_ORDER: 'RECEIVED_QTY_EXCEEDS_ORDER',
  NO_SHORTAGE_FOR_BACKORDER: 'NO_SHORTAGE_FOR_BACKORDER',
  SUPPLIER_CANNOT_SUPPLY_PRODUCT: 'SUPPLIER_CANNOT_SUPPLY_PRODUCT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  LEDGER_IMMUTABLE: 'LEDGER_IMMUTABLE',
  WAREHOUSE_FROZEN: 'WAREHOUSE_FROZEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
