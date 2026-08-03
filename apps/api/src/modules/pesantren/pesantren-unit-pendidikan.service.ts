import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanUnitPendidikan, validasiUnitPendidikan } from './pesantren-unit-pendidikan';

const DOMAIN_SANTRI = 'santri.info';
const VERTIKAL_SITUS_PESANTREN = 'pesantren';
const LABEL_SUBDOMAIN_TERLARANG = new Set([
  'www',
  'app',
  'auth',
  'api',
  'admin',
  'console',
  'support',
  'status',
  'docs',
  'assets',
  'cdn',
  'mail',
  'static',
  'media',
  'login',
  'register',
  'demo',
  'sandbox',
]);

export interface BarisUnitPendidikan {
  id: string;
  code: string;
  name: string;
  jenis: string;
  sort_order: number;
  is_active: boolean;
  website_enabled: boolean;
  public_slug: string | null;
  santri_subdomain: string | null;
  custom_domain: string | null;
  domain_status: string;
  welcome_title: string | null;
  welcome_body: string | null;
  created_at: string;
  updated_at: string;
}

const KOLOM_UNIT = `id::text, code, name, jenis, sort_order, is_active,
  website_enabled, public_slug, santri_subdomain, custom_domain, domain_status,
  welcome_title, welcome_body, created_at::text, updated_at::text`;

@Injectable()
export class PesantrenUnitPendidikanService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(schemaName: string, opsi: { cari?: string; aktif?: boolean }): Promise<BarisUnitPendidikan[]> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.cari?.trim()) {
      params.push(`%${opsi.cari.trim()}%`);
      kondisi.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    if (opsi.aktif != null) {
      params.push(opsi.aktif);
      kondisi.push(`is_active = $${params.length}`);
    }

    return this.tenantDb.query<BarisUnitPendidikan>(
      schemaName,
      `SELECT ${KOLOM_UNIT}
         FROM ${S}.pesantren_unit_pendidikan
        WHERE ${kondisi.join(' AND ')}
        ORDER BY sort_order ASC, name ASC`,
      params,
    );
  }

  async satu(schemaName: string, id: string): Promise<BarisUnitPendidikan | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisUnitPendidikan>(
      schemaName,
      `SELECT ${KOLOM_UNIT} FROM ${S}.pesantren_unit_pendidikan WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async catat(
    schemaName: string,
    tenantId: string,
    masukan: MasukanUnitPendidikan,
    actorUserId: string,
  ): Promise<BarisUnitPendidikan> {
    const payload = normalisasi(masukan);
    const galat = validasiUnitPendidikan(payload);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    validasiSubdomainDipesan(payload);

    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisUnitPendidikan>(
        schemaName,
        `INSERT INTO ${S}.pesantren_unit_pendidikan
           (code, name, jenis, sort_order, is_active, website_enabled, public_slug,
            santri_subdomain, custom_domain, domain_status, welcome_title, welcome_body,
            created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
         RETURNING ${KOLOM_UNIT}`,
        [
          payload.code,
          payload.name,
          payload.jenis,
          payload.sortOrder ?? 0,
          payload.isActive ?? true,
          payload.websiteEnabled ?? false,
          payload.publicSlug ?? null,
          payload.santriSubdomain ?? null,
          payload.customDomain ?? null,
          payload.customDomain || payload.santriSubdomain ? 'PENDING' : 'NONE',
          payload.welcomeTitle ?? null,
          payload.welcomeBody ?? null,
          actorUserId,
        ],
      );
      await this.sinkronkanDomainUnit(schemaName, tenantId, null, rows[0], actorUserId);
      return (await this.satu(schemaName, rows[0].id)) ?? rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_unit_pendidikan_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode unit "${payload.code}" sudah dipakai.`);
      }
      if (isUniqueViolation(error, 'ux_pesantren_unit_pendidikan_public_slug')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Slug halaman "${payload.publicSlug}" sudah dipakai.`);
      }
      if (isUniqueViolation(error, 'ux_pesantren_unit_pendidikan_santri_subdomain')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Subdomain "${payload.santriSubdomain}.santri.info" sudah dipakai.`);
      }
      if (isUniqueViolation(error, 'ux_pesantren_unit_pendidikan_custom_domain')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Domain "${payload.customDomain}" sudah dipakai.`);
      }
      throw error;
    }
  }

  async ubah(
    schemaName: string,
    tenantId: string,
    id: string,
    masukan: MasukanUnitPendidikan,
    actorUserId: string,
  ): Promise<BarisUnitPendidikan> {
    const sebelum = await this.satu(schemaName, id);
    if (!sebelum) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tidak ditemukan.');
    }

    const payload = normalisasi(masukan);
    const galat = validasiUnitPendidikan(payload);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    validasiSubdomainDipesan(payload);

    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisUnitPendidikan>(
        schemaName,
        `UPDATE ${S}.pesantren_unit_pendidikan
            SET code = $2,
                name = $3,
                jenis = $4,
                sort_order = $5,
                is_active = $6,
                website_enabled = $7,
                public_slug = $8,
                santri_subdomain = $9,
                custom_domain = $10,
                domain_status = CASE
                  WHEN COALESCE($9, $10) IS NULL THEN 'NONE'
                  WHEN COALESCE(santri_subdomain, '') IS DISTINCT FROM COALESCE($9, '')
                    OR COALESCE(custom_domain, '') IS DISTINCT FROM COALESCE($10, '')
                  THEN 'PENDING'
                  ELSE domain_status
                END,
                welcome_title = $11,
                welcome_body = $12,
                updated_at = now(),
                updated_by = $13,
                deactivated_at = CASE WHEN $6 = FALSE AND is_active = TRUE THEN now() ELSE deactivated_at END,
                deactivated_by = CASE WHEN $6 = FALSE AND is_active = TRUE THEN $13 ELSE deactivated_by END,
                version = version + 1
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING ${KOLOM_UNIT}`,
        [
          id,
          payload.code,
          payload.name,
          payload.jenis,
          payload.sortOrder ?? 0,
          payload.isActive ?? true,
          payload.websiteEnabled ?? false,
          payload.publicSlug ?? null,
          payload.santriSubdomain ?? null,
          payload.customDomain ?? null,
          payload.welcomeTitle ?? null,
          payload.welcomeBody ?? null,
          actorUserId,
        ],
      );
      await this.sinkronkanDomainUnit(schemaName, tenantId, sebelum, rows[0], actorUserId);
      return (await this.satu(schemaName, rows[0].id)) ?? rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_unit_pendidikan_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode unit "${payload.code}" sudah dipakai.`);
      }
      if (isUniqueViolation(error, 'ux_pesantren_unit_pendidikan_public_slug')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Slug halaman "${payload.publicSlug}" sudah dipakai.`);
      }
      if (isUniqueViolation(error, 'ux_pesantren_unit_pendidikan_santri_subdomain')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Subdomain "${payload.santriSubdomain}.santri.info" sudah dipakai.`);
      }
      if (isUniqueViolation(error, 'ux_pesantren_unit_pendidikan_custom_domain')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Domain "${payload.customDomain}" sudah dipakai.`);
      }
      throw error;
    }
  }

  async hapus(schemaName: string, id: string, actorUserId: string): Promise<{ id: string }> {
    const unit = await this.satu(schemaName, id);
    if (!unit) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tidak ditemukan.');
    }

    const S = `"${schemaName}"`;
    const dipakai = await this.tenantDb.queryOne<{ jumlah: string }>(
      schemaName,
      `SELECT (
          (SELECT COUNT(*) FROM ${S}.pesantren_santri WHERE unit_pendidikan_id = $1 AND deleted_at IS NULL) +
          (SELECT COUNT(*) FROM ${S}.pesantren_rombongan_belajar WHERE unit_pendidikan_id = $1 AND deleted_at IS NULL) +
          (SELECT COUNT(*) FROM ${S}.pesantren_kurikulum WHERE unit_pendidikan_id = $1 AND deleted_at IS NULL) +
          (SELECT COUNT(*) FROM ${S}.pesantren_psb_gelombang WHERE unit_pendidikan_id = $1 AND deleted_at IS NULL)
        )::text AS jumlah`,
      [id],
    );
    if (Number(dipakai?.jumlah ?? 0) > 0) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Unit pendidikan sudah dipakai oleh santri, rombongan, kurikulum, atau gelombang PSB. Nonaktifkan bila belum boleh dipakai lagi.',
      );
    }

    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_unit_pendidikan
          SET deleted_at = now(), deleted_by = $2, updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1 AND deleted_at IS NULL`,
      [id, actorUserId],
    );
    await this.nonaktifkanDomainTenant(unit, actorUserId);
    return { id };
  }

  private async sinkronkanDomainUnit(
    schemaName: string,
    tenantId: string,
    sebelum: BarisUnitPendidikan | null,
    sesudah: BarisUnitPendidikan,
    actorUserId: string,
  ): Promise<void> {
    const hostLama = hostsDariUnit(sebelum);
    const hostBaru = hostsDariUnit(sesudah);

    for (const host of hostLama.filter((h) => !hostBaru.some((baru) => baru.host === h.host))) {
      await this.tenantDb.queryAdmin(
        `UPDATE platform.vertical_site_domain
            SET status = 'REVOKED', updated_at = now(), version = version + 1
          WHERE tenant_id = $1 AND vertical = $2 AND host = $3`,
        [tenantId, VERTIKAL_SITUS_PESANTREN, host.host],
      );
    }

    for (const host of hostBaru) {
      const rows = await this.tenantDb.queryAdmin<{ id: string }>(
        `INSERT INTO platform.vertical_site_domain
           (tenant_id, host, vertical, status, verified_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (host) DO UPDATE
           SET tenant_id = EXCLUDED.tenant_id,
               vertical = EXCLUDED.vertical,
               status = EXCLUDED.status,
               verified_at = EXCLUDED.verified_at,
               updated_at = now(),
               version = platform.vertical_site_domain.version + 1
         WHERE platform.vertical_site_domain.tenant_id = EXCLUDED.tenant_id
         RETURNING id::text`,
        [
          tenantId,
          host.host,
          VERTIKAL_SITUS_PESANTREN,
          host.aktifLangsung ? 'ACTIVE' : 'PENDING',
          host.aktifLangsung ? new Date() : null,
        ],
      );
      if (rows.length === 0) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Domain "${host.host}" sudah dipakai tenant lain.`);
      }
    }

    const status = sesudah.santri_subdomain ? 'ACTIVE' : sesudah.custom_domain ? 'PENDING' : 'NONE';
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".pesantren_unit_pendidikan
          SET domain_status = $2, updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1 AND deleted_at IS NULL`,
      [sesudah.id, status, actorUserId],
    );
  }

  private async nonaktifkanDomainTenant(unit: BarisUnitPendidikan, actorUserId: string): Promise<void> {
    const hosts = hostsDariUnit(unit);
    for (const host of hosts) {
      await this.tenantDb.queryAdmin(
        `UPDATE platform.vertical_site_domain
            SET status = 'REVOKED', updated_at = now(), version = version + 1
          WHERE vertical = $1 AND host = $2`,
        [VERTIKAL_SITUS_PESANTREN, host.host],
      );
    }
    void actorUserId;
  }
}

function normalisasi(masukan: MasukanUnitPendidikan): MasukanUnitPendidikan {
  const name = masukan.name?.trim();
  const code = masukan.code?.trim().toUpperCase();
  const slugDefault = slugUnitPendidikan(name || code || '');
  return {
    code,
    name,
    jenis: masukan.jenis,
    sortOrder: masukan.sortOrder ?? 0,
    isActive: masukan.isActive ?? true,
    websiteEnabled: masukan.websiteEnabled ?? true,
    publicSlug: kosongJadiNull(masukan.publicSlug)?.toLowerCase() ?? slugDefault,
    santriSubdomain: kosongJadiNull(masukan.santriSubdomain)?.toLowerCase() ?? slugDefault,
    customDomain: normalisasiDomain(masukan.customDomain),
    welcomeTitle: kosongJadiNull(masukan.welcomeTitle),
    welcomeBody: kosongJadiNull(masukan.welcomeBody),
  };
}

function slugUnitPendidikan(value: string): string | null {
  const slug = value
    .toLowerCase()
    .replace(/\bmadrasah\b/g, '')
    .replace(/\bibtidaiyah\b/g, 'mi')
    .replace(/\bdiniyah\b/g, 'md')
    .replace(/\btakmiliyah\b/g, '')
    .replace(/\bbalai\s+latihan\s+kerja\b/g, 'blk')
    .replace(/\bkomunitas\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 63)
    .replace(/-+$/g, '');
  return slug || null;
}

function kosongJadiNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalisasiDomain(value: string | null | undefined): string | null {
  const trimmed = kosongJadiNull(value);
  if (!trimmed) return null;
  return trimmed.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/\.$/, '').toLowerCase();
}

function validasiSubdomainDipesan(masukan: MasukanUnitPendidikan): void {
  if (masukan.santriSubdomain && LABEL_SUBDOMAIN_TERLARANG.has(masukan.santriSubdomain)) {
    throw AppError.badRequest(
      ErrorCodes.VALIDATION_FAILED,
      `Subdomain "${masukan.santriSubdomain}.santri.info" dicadangkan untuk platform.`,
    );
  }
}

function hostsDariUnit(unit: BarisUnitPendidikan | null): Array<{ host: string; aktifLangsung: boolean }> {
  if (!unit) return [];
  const hosts: Array<{ host: string; aktifLangsung: boolean }> = [];
  if (unit.santri_subdomain) hosts.push({ host: `${unit.santri_subdomain}.${DOMAIN_SANTRI}`, aktifLangsung: true });
  if (unit.custom_domain) hosts.push({ host: unit.custom_domain, aktifLangsung: false });
  return hosts;
}

function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
