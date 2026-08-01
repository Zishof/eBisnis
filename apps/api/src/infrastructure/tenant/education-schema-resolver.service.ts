/**
 * Menerjemahkan (tenant, modul pendidikan) menjadi nama schema.
 *
 * ## Yang membuatnya aman
 *
 * Nama schema **tidak pernah** disusun dari permintaan, dan tidak pernah
 * dihitung dari username. Ia dibaca dari `platform.tenant_vertical_module` —
 * baris yang hanya dapat dibuat provisioning.
 *
 * `bangunNamaSchema` memang dapat menyusun nama yang sama, dan justru karena itu
 * ia tidak dipakai di sini: nama yang dihitung selalu "ada", termasuk untuk
 * modul yang belum pernah diprovision. Membacanya dari registri membuat modul
 * yang belum ada berakhir sebagai penolakan, bukan sebagai kueri ke schema yang
 * tidak pernah dibuat.
 *
 * ## Tidak ada jalur cadangan
 *
 * Modul yang belum diprovision, gagal, atau ditangguhkan menghasilkan penolakan
 * — bukan schema inti. Membiarkannya jatuh ke schema inti berarti kueri
 * pendidikan berjalan di tempat yang salah dan berhasil: tabelnya tidak ada,
 * galatnya menyebut relasi yang hilang, dan yang membacanya akan menyimpulkan
 * migrasinya belum jalan alih-alih modulnya belum aktif.
 */

import { Injectable, Logger } from '@nestjs/common';

import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import {
  CORE_MODULE_CODE,
  bacaKodeVertical,
  EDUCATION_COMMON_MODULE,
} from '../provisioning/education-module.registry';
import {
  sedangTerpakai,
  type EducationProvisioningState,
} from '../provisioning/education-provisioning.state';
import type { EducationRouteModule } from './education-schema-route';

export interface SchemaModul {
  moduleCode: string;
  schemaName: string;
  auditSchemaName: string;
  status: string;
}

@Injectable()
export class EducationSchemaResolver {
  private readonly logger = new Logger(EducationSchemaResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Nama schema untuk sebuah modul pendidikan milik tenant.
   *
   * Melempar bila modulnya belum aktif. Pemanggil tidak perlu — dan tidak
   * boleh — punya cabang cadangan.
   */
  async resolve(tenantId: string, module: EducationRouteModule): Promise<SchemaModul> {
    if (module === CORE_MODULE_CODE) {
      throw AppError.internal(
        ErrorCodes.INTERNAL_ERROR,
        'Modul inti tidak diselesaikan di sini. Schema inti berasal dari konteks sesi.',
      );
    }

    // Kode modul diperiksa ulang meski berasal dari rute. Rute baru ditambahkan
    // manusia, dan salah eja pada tabel segmen menghasilkan kueri ke modul yang
    // tidak pernah ada — yang tanpa pemeriksaan ini berakhir sebagai "belum
    // diprovision" alih-alih "kode modulnya salah".
    if (module !== EDUCATION_COMMON_MODULE) {
      const kode = bacaKodeVertical(module);
      if (!kode.valid) {
        throw AppError.internal(
          ErrorCodes.INTERNAL_ERROR,
          `Rute menyebut modul "${module}" yang tidak canonical. ${kode.message ?? ''}`,
        );
      }
    }

    const baris = await this.prisma.tenantVerticalModule.findUnique({
      where: { tenantId_moduleCode: { tenantId, moduleCode: module } },
      select: { moduleCode: true, schemaName: true, auditSchemaName: true, status: true },
    });

    if (!baris) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        `Modul "${module}" belum diaktifkan untuk tenant ini.`,
      );
    }

    if (!sedangTerpakai(baris.status as EducationProvisioningState)) {
      /*
       * Ditolak, bukan dijatuhkan ke schema inti.
       *
       * Modul yang sedang diprovision, gagal, atau dibatalkan punya schema yang
       * isinya belum tentu lengkap. Membacanya menghasilkan hasil yang tampak
       * sah tetapi tidak lengkap — dan itu lebih buruk daripada penolakan.
       */
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Modul "${module}" berstatus ${baris.status} dan belum dapat dipakai.`,
      );
    }

    if (baris.status === 'SUSPENDED') {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        `Modul "${module}" sedang ditangguhkan. Datanya tetap tersimpan; ` +
          'aktifkan kembali langganan untuk membukanya.',
      );
    }

    return baris;
  }
}
