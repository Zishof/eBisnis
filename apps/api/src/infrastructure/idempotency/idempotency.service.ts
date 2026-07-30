import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export interface IdempotentResult<T> {
  replayed: boolean;
  value: T;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashRequest(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
  }

  /**
   * Menjalankan operasi sekali saja untuk pasangan (key, operation).
   * Retry dengan payload sama mengembalikan hasil tersimpan.
   * Payload berbeda dengan key sama menghasilkan konflik.
   */
  async execute<T>(
    params: {
      key: string | undefined;
      operation: string;
      payload: unknown;
      tenantId?: string;
      ttlSeconds?: number;
      resourceType?: string;
    },
    handler: () => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    if (!params.key) {
      return { replayed: false, value: await handler() };
    }

    const requestHash = this.hashRequest(params.payload);
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { idempotencyKey_operation: { idempotencyKey: params.key, operation: params.operation } },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw AppError.conflict(
          ErrorCodes.IDEMPOTENCY_CONFLICT,
          'Idempotency-Key yang sama dipakai dengan payload berbeda.',
        );
      }
      return { replayed: true, value: existing.responseBody as T };
    }

    const value = await handler();

    await this.prisma.idempotencyRecord.create({
      data: {
        tenantId: params.tenantId ?? null,
        idempotencyKey: params.key,
        operation: params.operation,
        requestHash,
        responseStatus: 200,
        responseBody: JSON.parse(JSON.stringify(value ?? null)),
        resourceType: params.resourceType ?? null,
        expiresAt: new Date(Date.now() + (params.ttlSeconds ?? 86_400) * 1000),
      },
    });

    return { replayed: false, value };
  }
}
