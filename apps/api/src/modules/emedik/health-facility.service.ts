/**
 * Fasilitas kesehatan, unit layanan, dan pemberi layanan.
 *
 * Aturan yang berlaku bagi setiap jalan di sini:
 *
 * 1. Nama skema tenant tidak pernah berasal dari permintaan; ia diambil dari
 *    token dan sudah dicocokkan ke daftar resmi oleh penjaga.
 * 2. Kemampuan fasilitas ditentukan JENISNYA. Posyandu tidak punya rawat inap,
 *    dan membiarkan bangsal dibuat di bawahnya akan menghasilkan tempat tidur
 *    yang tidak pernah dapat diisi.
 * 3. Setiap penolakan menyebutkan alasannya dalam bentuk yang dapat dibaca
 *    petugas — bukan hanya kode HTTP.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export interface BuatFasilitasInput {
  facilityTypeCode: string;
  code: string;
  name: string;
  shortName?: string;
  legalEntityId?: string | null;
  parentFacilityId?: string | null;
  hospitalClass?: string | null;
  licenseNumber?: string | null;
  timezone?: string;
  phone?: string | null;
  email?: string | null;
  subdomain?: string | null;
}

export interface BuatUnitInput {
  facilityId: string;
  unitType: string;
  code: string;
  name: string;
  parentUnitId?: string | null;
  departmentId?: string | null;
  acceptsOutpatient?: boolean;
  acceptsInpatient?: boolean;
}

/** Unit yang hanya masuk akal pada fasilitas dengan kemampuan tertentu. */
const UNIT_BUTUH_KEMAMPUAN: Record<string, keyof KemampuanJenis> = {
  WARD: 'supportsInpatient',
  ICU: 'supportsInpatient',
  OPERATING_THEATRE: 'supportsInpatient',
  EMERGENCY: 'supportsEmergency',
  PHARMACY: 'supportsPharmacy',
  LABORATORY: 'supportsLaboratory',
};

interface KemampuanJenis {
  supportsInpatient: boolean;
  supportsEmergency: boolean;
  supportsPharmacy: boolean;
  supportsLaboratory: boolean;
}

@Injectable()
export class HealthFacilityService {
  private readonly logger = new Logger(HealthFacilityService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Fasilitas -------------------------------------------------------------

  async daftarFasilitas(schema: string) {
    return this.tenantDb.query(
      schema,
      `SELECT f.id, f.code, f.name, f.short_name, f.hospital_class, f.subdomain,
              f.timezone, f.is_active, f.parent_facility_id,
              t.code AS facility_type_code, t.name AS facility_type_name, t.category
         FROM "${schema}".health_facility f
         JOIN "${schema}".health_facility_type t ON t.id = f.facility_type_id
        WHERE f.deleted_at IS NULL
        ORDER BY f.sort_order, f.name`,
    );
  }

  async buatFasilitas(schema: string, input: BuatFasilitasInput, userId: string) {
    const jenis = await this.jenisFasilitas(schema, input.facilityTypeCode);

    /*
     * Kelas rumah sakit hanya berlaku bagi rumah sakit. Membiarkannya diisi
     * pada klinik menghasilkan data yang tampak sah tetapi tidak berarti — dan
     * kelak dipakai laporan yang menghitung rumah sakit menurut kelasnya.
     */
    if (input.hospitalClass && jenis.category !== 'HOSPITAL') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Kelas rumah sakit hanya berlaku bagi fasilitas berjenis rumah sakit, bukan ${jenis.name}.`,
      );
    }

    if (input.parentFacilityId) {
      const induk = await this.tenantDb.query<{ id: string }>(
        schema,
        `SELECT id FROM "${schema}".health_facility WHERE id = $1 AND deleted_at IS NULL`,
        [input.parentFacilityId],
      );
      if (!induk.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas induk tidak ditemukan.');
      }
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_facility
         (facility_type_id, legal_entity_id, parent_facility_id, code, name, short_name,
          hospital_class, license_number, timezone, phone, email, subdomain, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'Asia/Jakarta'), $10, $11, $12, $13)
       RETURNING id`,
      [
        jenis.id,
        input.legalEntityId ?? null,
        input.parentFacilityId ?? null,
        input.code,
        input.name,
        input.shortName ?? null,
        input.hospitalClass ?? null,
        input.licenseNumber ?? null,
        input.timezone ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.subdomain ? input.subdomain.toLowerCase() : null,
        userId,
      ],
    );

    this.logger.log(`Fasilitas ${input.code} dibuat pada ${schema}`);
    return this.ambilFasilitas(schema, rows[0].id);
  }

  async ambilFasilitas(schema: string, id: string) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT f.*, t.code AS facility_type_code, t.category,
              t.supports_inpatient, t.supports_emergency,
              t.supports_pharmacy, t.supports_laboratory
         FROM "${schema}".health_facility f
         JOIN "${schema}".health_facility_type t ON t.id = f.facility_type_id
        WHERE f.id = $1 AND f.deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');
    return rows[0];
  }

  // --- Unit layanan ----------------------------------------------------------

  async daftarUnit(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id, code, name, unit_type, parent_unit_id,
              accepts_outpatient, accepts_inpatient, is_active
         FROM "${schema}".health_service_unit
        WHERE facility_id = $1 AND deleted_at IS NULL
        ORDER BY unit_type, sort_order, name`,
      [facilityId],
    );
  }

  /**
   * Membuat unit layanan.
   *
   * Menolak unit yang tidak masuk akal bagi jenis fasilitasnya. Ini bukan
   * kerewelan: bangsal di bawah Posyandu akan menghasilkan tempat tidur yang
   * tidak pernah dapat diisi, dan laporan hunian yang menghitungnya akan salah
   * selamanya tanpa ada yang tahu sebabnya.
   */
  async buatUnit(schema: string, input: BuatUnitInput, userId: string) {
    const fasilitas = (await this.ambilFasilitas(schema, input.facilityId)) as Record<string, unknown>;

    const butuh = UNIT_BUTUH_KEMAMPUAN[input.unitType];
    if (butuh) {
      const kolom = {
        supportsInpatient: 'supports_inpatient',
        supportsEmergency: 'supports_emergency',
        supportsPharmacy: 'supports_pharmacy',
        supportsLaboratory: 'supports_laboratory',
      }[butuh];

      if (!fasilitas[kolom]) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Fasilitas berjenis ${String(fasilitas.facility_type_code)} tidak memiliki kemampuan yang ` +
            `dibutuhkan unit ${input.unitType}. Ubah jenis fasilitas bila memang seharusnya punya.`,
        );
      }
    }

    if (input.parentUnitId) {
      const induk = await this.tenantDb.query<{ facility_id: string }>(
        schema,
        `SELECT facility_id FROM "${schema}".health_service_unit WHERE id = $1 AND deleted_at IS NULL`,
        [input.parentUnitId],
      );
      if (!induk.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit induk tidak ditemukan.');
      }
      // Unit induk pada fasilitas lain akan menghasilkan pohon yang melintasi
      // fasilitas, dan setiap laporan per fasilitas menjadi salah.
      if (induk[0].facility_id !== input.facilityId) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Unit induk berada pada fasilitas yang berbeda.',
        );
      }
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_service_unit
         (facility_id, parent_unit_id, department_id, unit_type, code, name,
          accepts_outpatient, accepts_inpatient, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.facilityId,
        input.parentUnitId ?? null,
        input.departmentId ?? null,
        input.unitType,
        input.code,
        input.name,
        input.acceptsOutpatient ?? input.unitType === 'POLYCLINIC',
        input.acceptsInpatient ?? ['WARD', 'ICU'].includes(input.unitType),
        userId,
      ],
    );
    return rows[0];
  }

  // --- Pemberi layanan -------------------------------------------------------

  async daftarPemberiLayanan(schema: string, facilityId?: string) {
    return this.tenantDb.query(
      schema,
      `SELECT p.id, p.code, p.full_name, p.provider_type, p.specialty_code,
              p.practice_license_no, p.practice_license_valid_until,
              p.user_subject_id, p.employee_id, p.is_active
         FROM "${schema}".health_provider p
        WHERE p.deleted_at IS NULL
          ${facilityId ? 'AND p.primary_facility_id = $1' : ''}
        ORDER BY p.full_name`,
      facilityId ? [facilityId] : [],
    );
  }

  /**
   * Jenis pemberi layanan yang wajib memiliki izin praktik.
   *
   * Kader Posyandu dan asisten tidak. Menuntutnya kepada mereka akan
   * menghentikan pendaftaran kader — dan Posyandu dijalankan kader.
   */
  private static readonly WAJIB_IZIN = new Set([
    'DOCTOR',
    'DENTIST',
    'NURSE',
    'MIDWIFE',
    'PHARMACIST',
    'RADIOLOGIST',
  ]);

  async buatPemberiLayanan(
    schema: string,
    input: {
      code: string;
      fullName: string;
      providerType: string;
      primaryFacilityId?: string | null;
      userSubjectId?: string | null;
      employeeId?: string | null;
      practiceLicenseNo?: string | null;
      practiceLicenseValidUntil?: string | null;
      specialtyCode?: string | null;
    },
    userId: string,
  ) {
    if (HealthFacilityService.WAJIB_IZIN.has(input.providerType) && !input.practiceLicenseNo?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Pemberi layanan berjenis ${input.providerType} wajib mencantumkan nomor izin praktik.`,
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_provider
         (code, full_name, provider_type, primary_facility_id, user_subject_id, employee_id,
          practice_license_no, practice_license_valid_until, specialty_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        input.code,
        input.fullName,
        input.providerType,
        input.primaryFacilityId ?? null,
        input.userSubjectId ?? null,
        input.employeeId ?? null,
        input.practiceLicenseNo ?? null,
        input.practiceLicenseValidUntil ?? null,
        input.specialtyCode ?? null,
        userId,
      ],
    );
    return rows[0];
  }

  /**
   * Apakah pemberi layanan ini punya kewenangan klinis tertentu?
   *
   * Terpisah dari hak akses peran: peran menentukan menu apa yang terbuka,
   * kewenangan klinis menentukan tindakan apa yang boleh dilakukan. Dokter umum
   * dan dokter bedah memakai peran yang sama.
   */
  async punyaKewenangan(
    schema: string,
    providerId: string,
    privilegeCode: string,
    facilityId?: string | null,
  ): Promise<boolean> {
    const rows = await this.tenantDb.query<{ n: string }>(
      schema,
      `SELECT count(*)::text AS n
         FROM "${schema}".health_clinical_privilege
        WHERE provider_id = $1
          AND privilege_code = $2
          AND revoked_at IS NULL
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
          AND (facility_id IS NULL OR facility_id = $3::uuid)`,
      [providerId, privilegeCode, facilityId ?? null],
    );
    return Number(rows[0]?.n ?? '0') > 0;
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async jenisFasilitas(schema: string, code: string) {
    const rows = await this.tenantDb.query<{
      id: string;
      code: string;
      name: string;
      category: string;
    }>(
      schema,
      `SELECT id, code, name, category FROM "${schema}".health_facility_type
        WHERE code = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [code],
    );
    if (!rows.length) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Jenis fasilitas "${code}" tidak dikenal.`,
      );
    }
    return rows[0];
  }
}
