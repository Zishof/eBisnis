import { Injectable, Logger } from '@nestjs/common';
import {
  MarketplaceEnrollmentStatus,
  MarketplaceSellerStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { canTransition, nextStatusFromReadiness } from './enrollment-state-machine';
import { MarketplaceReadinessService, type ReadinessReport } from './marketplace-readiness.service';

/** Kode program bawaan; satu marketplace publik. */
export const DEFAULT_PROGRAM_CODE = 'EBISNIS_MARKETPLACE';

export interface EnrollmentActor {
  userId: string;
  username: string;
  requestId?: string;
}

@Injectable()
export class MarketplaceEnrollmentService {
  private readonly logger = new Logger(MarketplaceEnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly readiness: MarketplaceReadinessService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Mendaftarkan tenant ke program marketplace, atau mengembalikan pendaftaran
   * yang sudah ada.
   *
   * Idempoten: batasan unik `(programId, tenantId)` menjamin satu tenant hanya
   * menjadi satu seller, sehingga menekan tombol dua kali tidak menghasilkan dua
   * berkas — larangan "jangan membuat duplicate saat provisioning retry".
   */
  async enroll(
    tenantId: string,
    input: { displayName: string; supportEmail?: string; supportPhone?: string },
    actor: EnrollmentActor,
  ) {
    const program = await this.prisma.marketplaceProgram.findFirst({
      where: { code: DEFAULT_PROGRAM_CODE, deletedAt: null },
    });
    if (!program) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Program marketplace belum tersedia. Hubungi dukungan platform.',
      );
    }

    const existing = await this.prisma.marketplaceSeller.findUnique({
      where: { programId_tenantId: { programId: program.id, tenantId } },
      include: { enrollments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (existing) return this.load(existing.id);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const seller = await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketplaceSeller.create({
        data: {
          programId: program.id,
          tenantId,
          sellerCode: await this.nextSellerCode(tx, tenant.code),
          displayName: input.displayName,
          supportEmail: input.supportEmail ?? null,
          supportPhone: input.supportPhone ?? null,
          status: MarketplaceSellerStatus.PROSPECT,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      });
      const enrollment = await tx.marketplaceSellerEnrollment.create({
        data: {
          sellerId: created.id,
          status: MarketplaceEnrollmentStatus.DRAFT,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      });
      await tx.marketplaceEnrollmentTransition.create({
        data: {
          enrollmentId: enrollment.id,
          fromStatus: null,
          toStatus: MarketplaceEnrollmentStatus.DRAFT,
          reason: 'Pendaftaran dibuat.',
          actorId: actor.userId,
          requestId: actor.requestId ?? null,
        },
      });
      return created;
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'SELLER_ENROLLED',
      entityType: 'marketplace_seller',
      entityId: seller.id,
      tenantId,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
    });

    return this.load(seller.id);
  }

  /**
   * Memeriksa kesiapan lalu memindahkan status bila hasilnya menuntut.
   *
   * Sistem yang menentukan berkasnya berhenti di mana, bukan tenant yang memilih
   * sendiri — itulah yang membuat status berarti sesuatu.
   */
  async refreshReadiness(sellerId: string, actor: EnrollmentActor) {
    const enrollment = await this.currentEnrollment(sellerId);
    const report = await this.readiness.evaluate(sellerId);

    const target = nextStatusFromReadiness(enrollment.status, {
      profileComplete: report.profileComplete,
      paymentAccountReady: report.paymentAccountReady,
      activationTicketOpen: report.activationTicketOpen,
    });

    await this.prisma.marketplaceSellerEnrollment.update({
      where: { id: enrollment.id },
      data: {
        readinessSnapshot: report as unknown as Prisma.InputJsonValue,
        readinessCheckedAt: new Date(),
        updatedBy: actor.userId,
      },
    });

    if (target !== enrollment.status && canTransition(enrollment.status, target).allowed) {
      await this.transition(sellerId, target, 'Hasil pemeriksaan kesiapan.', actor);
    }

    return this.load(sellerId);
  }

  /**
   * Memindahkan status pendaftaran.
   *
   * Transisi yang tidak sah ditolak dengan alasan yang menyebut apa yang mungkin,
   * bukan sekadar "tidak diizinkan". Setiap perpindahan dicatat pada tabel
   * transisi supaya pertanyaan "berapa lama berkas ini menunggu provider" dapat
   * dijawab.
   */
  async transition(
    sellerId: string,
    to: MarketplaceEnrollmentStatus,
    reason: string,
    actor: EnrollmentActor,
  ) {
    const enrollment = await this.currentEnrollment(sellerId);
    const check = canTransition(enrollment.status, to);
    if (!check.allowed) {
      throw AppError.conflict(ErrorCodes.INVALID_STATE_TRANSITION, check.reason!);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.marketplaceSellerEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: to,
          updatedBy: actor.userId,
          ...(to === MarketplaceEnrollmentStatus.UNDER_REVIEW
            ? { submittedAt: new Date(), submittedBy: actor.userId }
            : {}),
          ...(to === MarketplaceEnrollmentStatus.ACTIVE ||
          to === MarketplaceEnrollmentStatus.REJECTED
            ? { decidedAt: new Date(), decidedBy: actor.userId, decisionNote: reason }
            : {}),
        },
      });
      await tx.marketplaceEnrollmentTransition.create({
        data: {
          enrollmentId: enrollment.id,
          fromStatus: enrollment.status,
          toStatus: to,
          reason,
          actorId: actor.userId,
          requestId: actor.requestId ?? null,
        },
      });

      // Status seller mengikuti status berkasnya. Dijaga agar tidak ada seller
      // ACTIVE yang berkas pendaftarannya belum disetujui.
      const sellerStatus = SELLER_STATUS_BY_ENROLLMENT[to];
      if (sellerStatus) {
        await tx.marketplaceSeller.update({
          where: { id: sellerId },
          data: {
            status: sellerStatus,
            updatedBy: actor.userId,
            ...(sellerStatus === MarketplaceSellerStatus.ACTIVE
              ? { approvedAt: new Date(), approvedBy: actor.userId }
              : {}),
            ...(sellerStatus === MarketplaceSellerStatus.SUSPENDED
              ? { suspendedAt: new Date(), suspendedBy: actor.userId, suspendReason: reason }
              : {}),
          },
        });
      }
    });

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: `ENROLLMENT_${to}`,
      entityType: 'marketplace_seller_enrollment',
      entityId: enrollment.id,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
      metadata: { from: enrollment.status, to, reason },
    });

    this.logger.log(`Pendaftaran ${sellerId}: ${enrollment.status} -> ${to}`);
    return this.load(sellerId);
  }

  /** Berkas pendaftaran terbaru milik seller. */
  private async currentEnrollment(sellerId: string) {
    const enrollment = await this.prisma.marketplaceSellerEnrollment.findFirst({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
    if (!enrollment) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftaran marketplace tidak ditemukan.');
    }
    return enrollment;
  }

  async load(sellerId: string) {
    return this.prisma.marketplaceSeller.findUniqueOrThrow({
      where: { id: sellerId },
      include: {
        program: { select: { code: true, name: true, publicHost: true, minimumListingImages: true } },
        stores: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        enrollments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { transitions: { orderBy: { occurredAt: 'desc' }, take: 20 } },
        },
      },
    });
  }

  async findByTenant(tenantId: string) {
    const seller = await this.prisma.marketplaceSeller.findFirst({
      where: { tenantId, deletedAt: null },
    });
    return seller ? this.load(seller.id) : null;
  }

  async readinessFor(sellerId: string): Promise<ReadinessReport> {
    return this.readiness.evaluate(sellerId);
  }

  /**
   * Kode seller yang stabil dan dapat dibaca. Ditambah akhiran angka bila kode
   * tenant sudah dipakai, sebab kode tenant tidak dijamin unik lintas program.
   */
  private async nextSellerCode(tx: Prisma.TransactionClient, tenantCode: string): Promise<string> {
    const base = `SLR-${tenantCode.toUpperCase()}`.slice(0, 40);
    for (let suffix = 0; suffix < 100; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}-${suffix}`;
      const taken = await tx.marketplaceSeller.findUnique({ where: { sellerCode: candidate } });
      if (!taken) return candidate;
    }
    throw AppError.conflict(ErrorCodes.CONFLICT, 'Tidak dapat menentukan kode seller yang unik.');
  }
}

/**
 * Status seller yang mengikuti status berkas pendaftaran.
 *
 * Status yang tidak disebut di sini tidak mengubah status seller — berkas yang
 * sedang menunggu credential, misalnya, tidak mengubah apa pun pada seller.
 */
const SELLER_STATUS_BY_ENROLLMENT: Partial<
  Record<MarketplaceEnrollmentStatus, MarketplaceSellerStatus>
> = {
  [MarketplaceEnrollmentStatus.UNDER_REVIEW]: MarketplaceSellerStatus.PENDING_APPROVAL,
  [MarketplaceEnrollmentStatus.ACTIVE]: MarketplaceSellerStatus.ACTIVE,
  [MarketplaceEnrollmentStatus.SUSPENDED]: MarketplaceSellerStatus.SUSPENDED,
  [MarketplaceEnrollmentStatus.REJECTED]: MarketplaceSellerStatus.REJECTED,
  [MarketplaceEnrollmentStatus.CLOSED]: MarketplaceSellerStatus.CLOSED,
};
