/**
 * Pengelolaan sesi dan peran aktif.
 *
 * ## Yang dijawab modul ini
 *
 * 1. *Di mana saja saya sedang masuk?* — daftar sesi beserta perangkat dan
 *    waktu terakhir dipakai, dengan sesi yang sedang berjalan ditandai.
 * 2. *Bagaimana saya mengakhiri sesi yang bukan milik saya?* — pencabutan satu
 *    sesi, atau seluruhnya kecuali yang sedang dipakai.
 * 3. *Dalam kapasitas apa saya bertindak?* — pemilihan peran aktif beserta
 *    riwayatnya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantPermissionService } from './tenant-permission.service';
import type { AuthenticatedUser } from '../../common/decorators';

/** Berapa lama sesi yang sudah kedaluwarsa masih ditampilkan pada daftar. */
const RIWAYAT_HARI = 30;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPermissions: TenantPermissionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Sesi milik pengguna sendiri.
   *
   * Hanya sesi miliknya — tidak ada parameter untuk melihat sesi orang lain,
   * dan tidak akan ada. Melihat "di mana orang lain sedang masuk" adalah
   * kemampuan pengawasan yang berbeda sifatnya dan menuntut izin tersendiri.
   */
  async mySessions(user: AuthenticatedUser) {
    const sejak = new Date(Date.now() - RIWAYAT_HARI * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.platformSession.findMany({
      where: { userId: user.userId, issuedAt: { gte: sejak } },
      orderBy: [{ lastSeenAt: 'desc' }, { issuedAt: 'desc' }],
      select: {
        id: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        revokedReason: true,
        lastSeenAt: true,
        ipAddress: true,
        deviceLabel: true,
        deviceFingerprint: true,
        activeRoleCode: true,
        tenantId: true,
      },
    });

    const sekarang = Date.now();
    return {
      items: rows.map((row) => ({
        id: row.id,
        // Ditandai supaya orang tidak mencabut sesi yang sedang dipakainya
        // sendiri tanpa sadar.
        isCurrent: row.id === user.sessionId,
        status: row.revokedAt
          ? ('REVOKED' as const)
          : row.expiresAt.getTime() < sekarang
            ? ('EXPIRED' as const)
            : ('ACTIVE' as const),
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        revokedReason: row.revokedReason,
        lastSeenAt: row.lastSeenAt,
        // Alamat IP ditampilkan utuh kepada pemilik sesinya sendiri: yang
        // hendak dijawab adalah "apakah ini saya", dan itu tidak terjawab oleh
        // alamat yang disamarkan.
        ipAddress: row.ipAddress,
        deviceLabel: row.deviceLabel,
        activeRoleCode: row.activeRoleCode,
      })),
    };
  }

  /** Mencabut satu sesi milik sendiri. */
  async revokeSession(user: AuthenticatedUser, sessionId: string, reason?: string) {
    const session = await this.prisma.platformSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, revokedAt: true },
    });

    // Sesi milik orang lain dijawab sama seperti sesi yang tidak ada. Membedakan
    // keduanya akan memberi tahu penebak bahwa suatu id memang dipakai orang.
    if (!session || session.userId !== user.userId) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Sesi tidak ditemukan.');
    }
    if (session.revokedAt) return { revoked: 0, alreadyRevoked: true };

    await this.prisma.$transaction([
      this.prisma.platformRefreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.platformSession.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokedReason: (reason ?? 'DICABUT_PENGGUNA').slice(0, 96),
        },
      }),
    ]);

    return { revoked: 1, alreadyRevoked: false, wasCurrent: sessionId === user.sessionId };
  }

  /**
   * Mencabut seluruh sesi lain, menyisakan yang sedang dipakai.
   *
   * Sesi berjalan sengaja disisakan: mencabut semuanya termasuk yang sedang
   * dipakai akan mengeluarkan orang tepat saat ia sedang mengamankan akunnya,
   * dan itu justru menghalangi langkah pengamanan berikutnya.
   */
  async revokeOtherSessions(user: AuthenticatedUser) {
    const targets = await this.prisma.platformSession.findMany({
      where: { userId: user.userId, revokedAt: null, id: { not: user.sessionId } },
      select: { id: true },
    });
    if (targets.length === 0) return { revoked: 0 };

    const ids = targets.map((t) => t.id);
    await this.prisma.$transaction([
      this.prisma.platformRefreshToken.updateMany({
        where: { sessionId: { in: ids }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.platformSession.updateMany({
        where: { id: { in: ids } },
        data: { revokedAt: new Date(), revokedReason: 'DICABUT_SESI_LAIN' },
      }),
    ]);

    return { revoked: ids.length };
  }

  /** Peran yang dipegang pengguna pada tenant aktif, dan mana yang sedang dipakai. */
  async myRoles(user: AuthenticatedUser) {
    if (!user.schemaName) {
      return { activeRoleId: null, activeRoleCode: null, canNarrow: false, items: [] };
    }

    const roles = await this.tenantPermissions.rolesOf(user.schemaName, user.userId);
    const penuh = await this.tenantPermissions.resolve(user.schemaName, user.userId);
    const efektif = await this.tenantPermissions.resolve(
      user.schemaName,
      user.userId,
      user.activeRoleId,
    );

    return {
      activeRoleId: user.activeRoleId ?? null,
      activeRoleCode: user.activeRoleCode ?? null,
      // Memilih peran hanya berguna bagi yang memegang lebih dari satu. Bagi
      // yang memegang satu, memilihnya tidak mengubah apa pun.
      canNarrow: roles.length > 1,
      permissionCountFull: penuh.size,
      permissionCountEffective: efektif.size,
      items: roles.map((role) => ({
        ...role,
        isActive: role.roleId === user.activeRoleId,
      })),
    };
  }

  /**
   * Memilih peran aktif, atau kembali ke gabungan seluruh peran dengan `null`.
   *
   * Perannya wajib benar-benar dipegang pengguna. Tanpa pemeriksaan itu,
   * siapa pun dapat menuliskan id peran apa saja ke sesinya — dan meskipun
   * penyempitan tidak dapat menambah izin, sesi akan menyebut kapasitas yang
   * tidak pernah dimilikinya, sehingga jejak auditnya berbohong.
   */
  async setActiveRole(
    user: AuthenticatedUser,
    roleId: string | null,
    meta: { reason?: string; ipAddress?: string; requestId?: string },
  ) {
    if (!user.schemaName) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Sesi ini tidak terhubung ke tenant mana pun, sehingga tidak ada peran yang dapat dipilih.',
      );
    }

    const roles = await this.tenantPermissions.rolesOf(user.schemaName, user.userId);
    let target: { roleId: string; code: string } | null = null;

    if (roleId !== null) {
      const found = roles.find((r) => r.roleId === roleId);
      if (!found) {
        throw AppError.forbidden(
          ErrorCodes.PERMISSION_DENIED,
          'Peran itu tidak Anda pegang pada tenant ini.',
        );
      }
      target = { roleId: found.roleId, code: found.code };
    }

    const sebelum = await this.tenantPermissions.resolve(
      user.schemaName,
      user.userId,
      user.activeRoleId,
    );
    const sesudah = await this.tenantPermissions.resolve(
      user.schemaName,
      user.userId,
      target?.roleId ?? null,
    );

    await this.prisma.platformSession.update({
      where: { id: user.sessionId },
      data: {
        activeRoleId: target?.roleId ?? null,
        activeRoleCode: target?.code ?? null,
      },
    });

    await this.prisma.platformRoleSwitchLog.create({
      data: {
        userId: user.userId,
        sessionId: user.sessionId,
        tenantId: user.tenantId ?? null,
        schemaName: user.schemaName,
        fromRoleId: user.activeRoleId ?? null,
        fromRoleCode: user.activeRoleCode ?? null,
        toRoleId: target?.roleId ?? null,
        toRoleCode: target?.code ?? null,
        permissionsBefore: sebelum.size,
        permissionsAfter: sesudah.size,
        reason: meta.reason?.slice(0, 500) ?? null,
        ipAddress: meta.ipAddress ?? null,
        requestId: meta.requestId ?? null,
      },
    });

    // Berganti kapasitas adalah perbuatan yang perlu dicatat, bukan sekadar
    // penyetelan tampilan: seluruh perbuatan berikutnya akan dinilai menurut
    // kapasitas ini.
    //
    // Dicatat SETELAH sesi diperbarui, sehingga kapasitas yang terisi sendiri
    // dari konteks masih menunjuk peran LAMA — dan memang itulah yang benar:
    // keputusan berganti diambil selagi masih memakai topi sebelumnya.
    await this.audit.record({
      moduleCode: 'AUTH',
      actionCode: 'ACTIVE_ROLE_CHANGED',
      entityType: 'PlatformSession',
      entityId: user.sessionId,
      metadata: {
        fromRoleCode: user.activeRoleCode ?? null,
        toRoleCode: target?.code ?? null,
        permissionsBefore: sebelum.size,
        permissionsAfter: sesudah.size,
      },
      reason: meta.reason,
    });

    return {
      activeRoleId: target?.roleId ?? null,
      activeRoleCode: target?.code ?? null,
      permissionsBefore: sebelum.size,
      permissionsAfter: sesudah.size,
      // Disebutkan terang-terangan supaya pengguna tahu akibatnya sebelum
      // menemukan tombol yang hilang.
      permissionsRemoved: [...sebelum].filter((p) => !sesudah.has(p)).sort(),
    };
  }

  /** Riwayat pergantian peran pada satu tenant. Untuk auditor. */
  async roleSwitchHistory(tenantId: string | undefined, limit: number) {
    return this.prisma.platformRoleSwitchLog.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Menandai sesi masih terpakai.
   *
   * Gagal diam-diam: memperbarui waktu terakhir dipakai bukan alasan yang cukup
   * untuk menggagalkan permintaan yang sah.
   */
  async touch(sessionId: string): Promise<void> {
    await this.prisma.platformSession
      .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
      .catch((error: Error) => {
        this.logger.debug(`Gagal memperbarui lastSeenAt: ${error.message}`);
      });
  }
}
