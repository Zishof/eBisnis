/**
 * Pendaftaran properti hospitality (MI-3).
 *
 * Jalur tersendiri, bukan cabang di dalam `RegistrationService`, dengan
 * alasan yang sama persis dengan `PesantrenRegistrationService` (lihat
 * komentar di sana): yang dihasilkan berbeda -- selain schema dan
 * credential, pendaftaran ini membuat SITUS PROPERTI dan menandai
 * penyewanya sebagai hospitality.
 *
 * ## Yang SENGAJA tidak ada di sini
 *
 * Tidak ada tabel profil properti terpisah (bandingkan
 * `registration_pesantren`). Properti (`hospitality_property`) dibuat
 * pengurus SESUDAH masuk lewat `HospitalityPropertiService.catatProperti()`
 * (MI-5) yang sudah ada dan sudah teruji -- pendaftaran hanya menyiapkan
 * ruang kerja (schema + akun + situs), bukan mengulang formulir tambah
 * properti yang sudah ada di dalam aplikasi.
 *
 * Urutan sama dengan pesantren: validasi murni -> kunci penasihat atas
 * host -> pastikan host belum diklaim -> pendaftaran umum (schema, akun,
 * credential) -> tandai vertikal + situs dalam satu transaksi -> beri
 * peran HOSPITALITY_ADMIN.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { TenantBootstrapService } from '../../infrastructure/provisioning/tenant-bootstrap.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { RegistrationService } from './registration.service';
import { ROLE_ADMIN_HOSPITALITY } from '../hospitality/rbac/hospitality-vertical.catalog';
import { HOSPITALITY_PLAN_SEED } from '../master-seed/registry/platform-master-seeds';
import {
  hostSitus,
  usulanSlugDariNama,
  usulanUsernameDariNama,
  validasiPendaftaranHospitality,
} from './hospitality-registration';

/** Kode vertikal penyewa hospitality. Sama dengan CHECK di basis data. */
export const VERTICAL_HOSPITALITY = 'HOSPITALITY';

/**
 * Kode vertikal pada `vertical_site_domain` -- huruf kecil, mengikuti pola
 * `pesantren`/`cooperative`/`health`/`village` yang sudah ada (lihat
 * catatan yang sama pada `pesantren-registration.service.ts`).
 */
export const VERTIKAL_SITUS_HOSPITALITY = 'hospitality';

export interface MasukanPendaftaranHospitality {
  namaProperti: string;
  slugSitus: string;
  desiredUsername: string;
  email: string;
  teleponPenanggungJawab?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  localeCode?: string;
  includeSampleData?: boolean;
}

export interface HasilPendaftaranHospitality {
  status: string;
  registrationId: string;
  tenantId: string;
  username: string;
  schemaName: string;
  /** Hanya pada response pertama, dan tidak pernah disimpan. */
  temporaryPassword?: string;
  mustChangePassword: boolean;
  slugSitus: string;
  siteHost: string;
  siteUrl: string;
  loginUrl: string;
}

@Injectable()
export class HospitalityRegistrationService {
  private readonly logger = new Logger(HospitalityRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly registrations: RegistrationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly bootstrap: TenantBootstrapService,
  ) {}

  /** Pilihan yang ditawarkan formulir. Satu sumber untuk formulir dan pemeriksa. */
  getConfig() {
    return {
      domainSitus: DOMAIN_SITUS_LABEL,
      passwordSelaluDibuatPeladen: true,
    };
  }

  /** Apakah alamat situs ini masih bebas? Tanpa memesan apa pun. */
  async cekSlugSitus(slug: string) {
    const bersih = (slug ?? '').trim().toLowerCase();
    const galat = validasiPendaftaranHospitality({
      namaProperti: 'x',
      email: 'x@y.id',
      slugSitus: bersih,
      acceptTerms: true,
      acceptPrivacy: true,
    }).filter((g) => g.field === 'slugSitus');

    if (galat.length) {
      return {
        tersedia: false,
        slug: bersih,
        host: bersih ? hostSitus(bersih) : null,
        alasan: galat[0].code,
        pesan: galat[0].message,
      };
    }

    const host = hostSitus(bersih);
    const dipakai = await this.prisma.verticalSiteDomain.findUnique({
      where: { host },
      select: { id: true },
    });

    return {
      tersedia: !dipakai,
      slug: bersih,
      host,
      alasan: dipakai ? 'HOST_SUDAH_DIPAKAI' : null,
      pesan: dipakai
        ? 'Alamat situs tersebut sudah dipakai properti lain. Silakan pilih yang lain.'
        : 'Alamat situs tersedia.',
    };
  }

  /** Usulan alamat situs DAN nama pengguna dari nama properti. Tidak memesan apa pun. */
  usulkan(namaProperti: string): { slug: string; username: string } {
    const nama = namaProperti ?? '';
    return {
      slug: usulanSlugDariNama(nama),
      username: usulanUsernameDariNama(nama),
    };
  }

  async register(
    input: MasukanPendaftaranHospitality,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<HasilPendaftaranHospitality> {
    const galat = validasiPendaftaranHospitality(input);
    if (galat.length) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Ada isian yang belum benar. Periksa kembali formulir.',
        { errors: galat },
      );
    }

    const slug = input.slugSitus.trim().toLowerCase();
    const host = hostSitus(slug);

    return this.tenantDb.withAdvisoryLock(`hospitality:${host}`, async () => {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { code: HOSPITALITY_PLAN_SEED.code },
        include: {
          versions: {
            where: { status: 'PUBLISHED', deletedAt: null },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
      });
      const planVersion = plan?.versions[0];
      if (!planVersion) {
        throw AppError.internal(
          ErrorCodes.PROVISIONING_FAILED,
          'Katalog paket MitraInap belum siap. Jalankan master seed sebelum menerima pendaftaran.',
        );
      }
      const ketersediaan = await this.cekSlugSitus(slug);
      if (!ketersediaan.tersedia) {
        throw AppError.conflict(ErrorCodes.CONFLICT, ketersediaan.pesan);
      }

      const umum = await this.registrations.register(
        {
          businessName: input.namaProperti,
          businessType: 'Hotel / Penginapan',
          country: 'Indonesia',
          contactPhone: input.teleponPenanggungJawab,
          email: input.email,
          desiredUsername: input.desiredUsername,
          generatePassword: true,
          acceptTerms: input.acceptTerms,
          acceptPrivacy: input.acceptPrivacy,
          localeCode: input.localeCode ?? 'id',
          includeSampleData: input.includeSampleData ?? false,
        },
        meta,
      );

      try {
        await this.prisma.$transaction([
          this.prisma.tenant.update({
            where: { id: umum.tenantId },
            data: { verticalCode: VERTICAL_HOSPITALITY },
          }),

          // Situs properti langsung aktif dan terverifikasi -- <slug>.mitrainap.id
          // ada di dalam zona kita, sama alasannya dengan <slug>.santri.info
          // pada pendaftaran pesantren (lihat komentar di sana).
          this.prisma.verticalSiteDomain.create({
            data: {
              tenantId: umum.tenantId,
              host,
              vertical: VERTIKAL_SITUS_HOSPITALITY,
              status: 'ACTIVE',
              verifiedAt: new Date(),
            },
          }),
          this.prisma.packageAssignment.create({
            data: {
              tenantId: umum.tenantId,
              planVersionId: planVersion.id,
              scopeType: 'TENANT',
              status: 'ACTIVE',
            },
          }),
        ]);
      } catch (error) {
        const pesan = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Situs untuk pendaftaran hospitality ${umum.registrationId} gagal disimpan: ${pesan}`,
        );
        await this.audit.record({
          moduleCode: 'REGISTRATION',
          actionCode: 'HOSPITALITY_SITE_FAILED',
          entityType: 'Registration',
          entityId: umum.registrationId,
          tenantId: umum.tenantId,
          result: 'FAILURE',
          reason: pesan.slice(0, 1000),
          requestId: meta.requestId,
        });
        throw AppError.internal(
          ErrorCodes.PROVISIONING_FAILED,
          'Akun properti berhasil dibuat, tetapi situs propertinya gagal disiapkan. ' +
            'Silakan masuk seperti biasa dan hubungi kami untuk menyiapkan alamat situsnya.',
          { registrationId: umum.registrationId, username: umum.username },
        );
      }

      /*
       * HOSPITALITY_ADMIN ditambahkan sebagai peran KEDUA, bukan pengganti
       * OWNER -- pola sama dengan EPESANTREN_ADMIN pada pendaftaran
       * pesantren. Dibungkus try/catch tersendiri: kegagalan di sini tidak
       * boleh memicu pesan "situs gagal disiapkan", sebab situsnya sendiri
       * sudah baik-baik saja.
       */
      try {
        const pemilik = await this.prisma.tenantMembership.findFirst({
          where: { tenantId: umum.tenantId, isOwner: true },
          select: { platformUserId: true },
        });
        const hasil = pemilik
          ? await this.bootstrap.assignAdditionalRole(umum.schemaName, pemilik.platformUserId, ROLE_ADMIN_HOSPITALITY)
          : { assigned: false };
        if (!hasil.assigned) {
          this.logger.warn(
            `Peran ${ROLE_ADMIN_HOSPITALITY} tidak diberikan pada ${umum.schemaName}: ` +
              'pemilik, peran, atau subjek pengguna tidak ditemukan.',
          );
        }
      } catch (error) {
        const pesan = error instanceof Error ? error.message : String(error);
        this.logger.error(`Pemberian peran ${ROLE_ADMIN_HOSPITALITY} pada ${umum.schemaName} gagal: ${pesan}`);
      }

      await this.audit.record({
        moduleCode: 'REGISTRATION',
        actionCode: 'HOSPITALITY_REGISTERED',
        entityType: 'Registration',
        entityId: umum.registrationId,
        tenantId: umum.tenantId,
        tenantSchema: umum.schemaName,
        actorUsername: umum.username,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
        metadata: { namaProperti: input.namaProperti, host },
      });

      const webUrl = this.config.get<string>('webUrl', 'http://localhost:5173');

      return {
        status: umum.status,
        registrationId: umum.registrationId,
        tenantId: umum.tenantId,
        username: umum.username,
        schemaName: umum.schemaName,
        ...(umum.temporaryPassword ? { temporaryPassword: umum.temporaryPassword } : {}),
        mustChangePassword: umum.mustChangePassword,
        slugSitus: slug,
        siteHost: host,
        siteUrl: `https://${host}`,
        loginUrl: `${webUrl}/masuk?lanjut=${encodeURIComponent('/app/hospitality/properti')}`,
      };
    });
  }
}

const DOMAIN_SITUS_LABEL = 'mitrainap.id';
