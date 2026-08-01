/**
 * Unit pemerintahan, sub-wilayah, dan domain.
 *
 * Layanan pertama vertikal info-desa. Yang paling penting di sini bukan CRUD-nya
 * melainkan **penegakan kelayakan profil**: setiap operasi yang menyentuh fitur
 * bertanda `DESA_ONLY` atau `KELURAHAN_ONLY` memanggil `pastikanLayak()` lebih
 * dahulu.
 *
 * Menyembunyikan menu saja tidak cukup. Menu yang tidak tampil tetapi
 * endpoint-nya terbuka bukan pembatasan melainkan penyamaran, dan URL dapat
 * ditebak siapa pun yang pernah melihat sistem yang sama pada desa tetangga.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  layak,
  sebutanSubWilayah,
  type KodeFitur,
  type ProfilPemerintahan,
} from './village-profile';

export interface UnitView {
  id: string;
  profileType: ProfilPemerintahan;
  code: string;
  name: string;
  slug: string;
  administrativeCode: string | null;
  enabledFeatures: string[];
}

@Injectable()
export class VillageUnitService {
  private readonly logger = new Logger(VillageUnitService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Profil ---------------------------------------------------------------

  /**
   * Unit pemerintahan penyewa ini.
   *
   * Satu penyewa = satu desa/kelurahan. Bila kelak ada penyewa yang menaungi
   * beberapa unit (misalnya kecamatan), yang berubah hanyalah metode ini —
   * karena itu ia dipisahkan alih-alih dibaca langsung dari mana-mana.
   */
  async unit(schemaName: string): Promise<UnitView> {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, profile_type, code, name, slug, administrative_code, enabled_features
         FROM "${schemaName}".village_unit
        WHERE deleted_at IS NULL AND is_active = TRUE
        ORDER BY created_at LIMIT 1`,
    );
    if (!rows.length) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Unit pemerintahan belum disiapkan. Lengkapi profil desa/kelurahan terlebih dahulu.',
      );
    }
    const r = rows[0];
    return {
      id: String(r.id),
      profileType: String(r.profile_type) as ProfilPemerintahan,
      code: String(r.code),
      name: String(r.name),
      slug: String(r.slug),
      administrativeCode: (r.administrative_code as string | null) ?? null,
      enabledFeatures: (r.enabled_features as string[]) ?? [],
    };
  }

  /**
   * Menolak bila fitur tidak layak bagi profil penyewa.
   *
   * Dipanggil setiap layanan village sebelum bekerja. Melemparkan galat 403
   * beserta alasan yang dapat dibaca — bukan 404 yang menyamarkan keberadaan
   * fiturnya, sebab petugas kelurahan yang membuka menu APBDes perlu tahu bahwa
   * itu memang bukan untuknya, bukan mengira sistemnya rusak.
   */
  async pastikanLayak(schemaName: string, kode: KodeFitur): Promise<UnitView> {
    const u = await this.unit(schemaName);
    const hasil = layak(kode, u.profileType, { aktif: new Set(u.enabledFeatures) });
    if (!hasil.layak) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, hasil.alasan ?? 'Fitur tidak berlaku.', {
        feature: kode,
        eligibility: hasil.kelayakan,
        profileType: u.profileType,
      });
    }
    return u;
  }

  // --- Sub-wilayah ----------------------------------------------------------

  /**
   * Dusun (desa) atau lingkungan (kelurahan).
   *
   * Satu metode, bukan dua. `kind` ditentukan dari profil penyewa, bukan dari
   * permintaan — membiarkan pemanggil menentukannya akan memungkinkan kelurahan
   * membuat dusun hanya dengan mengirim nilai yang lain.
   */
  async daftarSubWilayah(schemaName: string) {
    const u = await this.unit(schemaName);
    const kode: KodeFitur = u.profileType === 'DESA' ? 'WILAYAH.DUSUN' : 'WILAYAH.LINGKUNGAN';
    await this.pastikanLayak(schemaName, kode);

    return this.tenantDb.query(
      schemaName,
      `SELECT id, kind, code, name, head_name, head_phone, area_km2::text, sort_order
         FROM "${schemaName}".village_sub_area
        WHERE village_unit_id = $1 AND deleted_at IS NULL
        ORDER BY sort_order, code`,
      [u.id],
    );
  }

  async buatSubWilayah(
    schemaName: string,
    input: { code: string; name: string; headName?: string; headPhone?: string },
    userId: string,
  ) {
    const u = await this.unit(schemaName);
    const kode: KodeFitur = u.profileType === 'DESA' ? 'WILAYAH.DUSUN' : 'WILAYAH.LINGKUNGAN';
    await this.pastikanLayak(schemaName, kode);

    const kind = u.profileType === 'DESA' ? 'DUSUN' : 'LINGKUNGAN';
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_sub_area
         (village_unit_id, kind, code, name, head_name, head_phone, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [u.id, kind, input.code, input.name, input.headName ?? null, input.headPhone ?? null, userId],
    );
    this.logger.log(`${sebutanSubWilayah(u.profileType)} ${input.code} dibuat pada ${schemaName}`);
    return { id: rows[0].id, kind };
  }

  // --- RW dan RT ------------------------------------------------------------

  async daftarRw(schemaName: string) {
    const u = await this.unit(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT w.id, w.number, w.name, w.head_name, w.sub_area_id, a.name AS sub_area_name,
              (SELECT count(*)::int FROM "${schemaName}".village_rt t
                WHERE t.village_rw_id = w.id AND t.deleted_at IS NULL) AS rt_count
         FROM "${schemaName}".village_rw w
    LEFT JOIN "${schemaName}".village_sub_area a ON a.id = w.sub_area_id
        WHERE w.village_unit_id = $1 AND w.deleted_at IS NULL
        ORDER BY w.number`,
      [u.id],
    );
  }

  async buatRw(
    schemaName: string,
    input: { number: string; name?: string; subAreaId?: string; headName?: string },
    userId: string,
  ) {
    const u = await this.unit(schemaName);
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_rw
         (village_unit_id, sub_area_id, number, name, head_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [u.id, input.subAreaId ?? null, input.number, input.name ?? null, input.headName ?? null, userId],
    );
    return { id: rows[0].id };
  }

  async daftarRt(schemaName: string, rwId?: string) {
    const u = await this.unit(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT t.id, t.number, t.head_name, t.household_count, t.village_rw_id, w.number AS rw_number
         FROM "${schemaName}".village_rt t
         JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
        WHERE w.village_unit_id = $1 AND t.deleted_at IS NULL
          AND ($2::uuid IS NULL OR t.village_rw_id = $2::uuid)
        ORDER BY w.number, t.number`,
      [u.id, rwId ?? null],
    );
  }

  async buatRt(
    schemaName: string,
    input: { rwId: string; number: string; headName?: string },
    userId: string,
  ) {
    const u = await this.unit(schemaName);
    // RW harus milik unit ini. Tanpa pemeriksaan ini, id RW dari penyewa lain
    // yang kebetulan diketahui akan diterima begitu saja.
    const rw = await this.tenantDb.query(
      schemaName,
      `SELECT 1 FROM "${schemaName}".village_rw
        WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL`,
      [input.rwId, u.id],
    );
    if (!rw.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'RW tidak ditemukan.');

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_rt (village_rw_id, number, head_name, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.rwId, input.number, input.headName ?? null, userId],
    );
    return { id: rows[0].id };
  }

  // --- Domain ---------------------------------------------------------------

  async daftarDomain(schemaName: string) {
    const u = await this.unit(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT id, hostname, domain_type, verification_status, verified_at, is_primary, is_active
         FROM "${schemaName}".village_domain
        WHERE village_unit_id = $1 AND deleted_at IS NULL
        ORDER BY is_primary DESC, created_at`,
      [u.id],
    );
  }

  /**
   * Mendaftarkan domain.
   *
   * Subdomain `<slug>.info-desa.id` langsung terverifikasi — kita yang memiliki
   * domain induknya. Domain sendiri memperoleh token dan berstatus `PENDING`
   * sampai kepemilikannya dibuktikan; tanpa itu, siapa pun dapat mengarahkan
   * domain orang lain ke situs desanya.
   */
  async daftarkanDomain(
    schemaName: string,
    input: { hostname: string; makePrimary?: boolean },
    userId: string,
  ) {
    const u = await this.unit(schemaName);
    const host = input.hostname.trim().toLowerCase();

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nama host tidak sah.');
    }

    const bawaan = host === `${u.slug}.info-desa.id`;
    const tipe = host.endsWith('.info-desa.id') ? 'SUBDOMAIN' : 'CUSTOM';

    if (tipe === 'SUBDOMAIN' && !bawaan) {
      // Subdomain info-desa.id hanya boleh yang sesuai slug penyewa. Tanpa
      // aturan ini, satu desa dapat mengambil subdomain bernama desa lain.
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        `Subdomain info-desa.id untuk tenant ini hanya boleh ${u.slug}.info-desa.id.`,
      );
    }

    const token =
      tipe === 'CUSTOM'
        ? `info-desa-verify=${Buffer.from(`${u.id}:${host}`).toString('base64url').slice(0, 40)}`
        : null;

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_domain
         (village_unit_id, hostname, domain_type, verification_token, verification_status,
          verified_at, is_primary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        u.id,
        host,
        tipe,
        token,
        tipe === 'SUBDOMAIN' ? 'VERIFIED' : 'PENDING',
        tipe === 'SUBDOMAIN' ? new Date() : null,
        input.makePrimary === true && tipe === 'SUBDOMAIN',
        userId,
      ],
    );

    return {
      id: rows[0].id,
      hostname: host,
      domainType: tipe,
      verificationStatus: tipe === 'SUBDOMAIN' ? 'VERIFIED' : 'PENDING',
      verificationToken: token,
      instruction:
        tipe === 'CUSTOM'
          ? `Tambahkan data TXT bernilai "${token}" pada domain ${host}, lalu jalankan verifikasi.`
          : undefined,
    };
  }

  // --- Batas dan potensi ----------------------------------------------------

  async batas(schemaName: string) {
    const u = await this.unit(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT direction, adjacent_name, note FROM "${schemaName}".village_boundary
        WHERE village_unit_id = $1 ORDER BY
          CASE direction WHEN 'UTARA' THEN 1 WHEN 'TIMUR' THEN 2
                         WHEN 'SELATAN' THEN 3 ELSE 4 END`,
      [u.id],
    );
  }

  async potensi(schemaName: string) {
    await this.pastikanLayak(schemaName, 'WILAYAH.POTENSI');
    const u = await this.unit(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT id, category, name, description, quantity::text, unit, is_published
         FROM "${schemaName}".village_potential
        WHERE village_unit_id = $1 AND deleted_at IS NULL
        ORDER BY category, name`,
      [u.id],
    );
  }
}
