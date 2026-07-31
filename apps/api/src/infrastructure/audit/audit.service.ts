import { Injectable, Logger } from '@nestjs/common';
import { Prisma, AuditResult } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { withRequestScope } from '../../common/context/request-context';

export interface AuditEventInput {
  moduleCode: string;
  actionCode: string;
  entityType?: string;
  entityId?: string;
  documentNumber?: string;
  result?: AuditResult;
  reason?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  tenantSchema?: string;
  requestId?: string;
  correlationId?: string;
  actorUserId?: string;
  actorUsername?: string;
  actorRoleCodes?: string[];
  /**
   * Peran yang sedang dipakai pelaku.
   *
   * Terisi sendiri dari konteks permintaan; menyebutkannya di sini hanya perlu
   * bila mencatat perbuatan atas nama orang lain.
   */
  activeRoleCode?: string;
  sessionId?: string;
  supportSessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'tokenHash',
  'refreshToken',
  'accessToken',
  'secret',
  'clientSecret',
  'apiKey',
  'pin',
  'cardNumber',
  'cvv',
  'challengeHash',
  'fingerprintHash',
  'temporaryPassword',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menulis audit event pada `platform__audit`. Kegagalan audit tidak
   * menggagalkan request.
   *
   * Bidang pelaku — siapa, dari sesi mana, dalam kapasitas apa — dilengkapi
   * sendiri dari konteks permintaan bila pemanggil tidak menyebutkannya.
   * Sebelum V10-5 bidang itu bergantung pada ingatan penulis tujuh puluh enam
   * pemanggilan, dan akibatnya `actor_role_codes` kosong pada seluruh 258 baris
   * yang pernah ditulis.
   */
  async record(rawInput: AuditEventInput): Promise<string | null> {
    const input = withRequestScope(rawInput);
    try {
      const event = await this.prisma.auditEvent.create({
        data: {
          moduleCode: input.moduleCode,
          actionCode: input.actionCode,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          documentNumber: input.documentNumber ?? null,
          result: input.result ?? 'SUCCESS',
          reason: input.reason ?? null,
          metadata: (mask(input.metadata) ?? undefined) as Prisma.InputJsonValue | undefined,
          tenantId: input.tenantId ?? null,
          tenantSchema: input.tenantSchema ?? null,
          requestId: input.requestId ?? null,
          correlationId: input.correlationId ?? null,
          actorUserId: input.actorUserId ?? null,
          actorUsername: input.actorUsername ?? null,
          actorRoleCodes: (input.actorRoleCodes ?? undefined) as Prisma.InputJsonValue | undefined,
          activeRoleCode: input.activeRoleCode ?? null,
          sessionId: input.sessionId ?? null,
          supportSessionId: input.supportSessionId ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
        select: { id: true },
      });
      return event.id;
    } catch (error) {
      this.logger.error(
        `Gagal menulis audit ${input.moduleCode}.${input.actionCode}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  async recordSecurity(rawSecurityInput: {
    eventCode: string;
    severity?: string;
    actorUserId?: string;
    actorUsername?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    result?: AuditResult;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    // Peristiwa keamanan pun melengkapi diri dari konteks — kecuali pelakunya
    // memang belum diketahui, seperti pada percobaan masuk yang gagal.
    const input = withRequestScope(rawSecurityInput);
    try {
      await this.prisma.auditSecurityEvent.create({
        data: {
          eventCode: input.eventCode,
          severity: input.severity ?? 'INFO',
          actorUserId: input.actorUserId ?? null,
          actorUsername: input.actorUsername ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          requestId: input.requestId ?? null,
          result: input.result ?? 'FAILURE',
          detail: (mask(input.detail) ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      // Kegagalan menulis audit tidak boleh menggagalkan permintaan, tetapi
      // penyebabnya wajib terlihat pada log operasional.
      this.logger.error(
        `Gagal menulis audit keamanan ${input.eventCode}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async recordExport(input: {
    actorUserId?: string;
    tenantId?: string;
    resourceCode: string;
    filterSnapshot?: Record<string, unknown>;
    rowCount: number;
    format?: string;
    requestId?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditExportEvent.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          tenantId: input.tenantId ?? null,
          resourceCode: input.resourceCode,
          filterSnapshot: (input.filterSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          rowCount: input.rowCount,
          format: input.format ?? 'CSV',
          requestId: input.requestId ?? null,
        },
      });
    } catch {
      this.logger.error(`Gagal menulis audit ekspor ${input.resourceCode}`);
    }
  }

  async recordPermissionChange(input: {
    actorUserId?: string;
    targetType: string;
    targetId: string;
    tenantId?: string;
    beforeSnapshot?: unknown;
    afterSnapshot?: unknown;
    reason?: string;
    requestId?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditPermissionChange.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          targetType: input.targetType,
          targetId: input.targetId,
          tenantId: input.tenantId ?? null,
          beforeSnapshot: (input.beforeSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          afterSnapshot: (input.afterSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          reason: input.reason ?? null,
          requestId: input.requestId ?? null,
        },
      });
    } catch {
      this.logger.error('Gagal menulis audit perubahan permission');
    }
  }
}

function mask(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(mask);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key) ? '***MASKED***' : mask(item);
    }
    return out;
  }
  return value;
}
