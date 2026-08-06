/**
 * Profil tamu, consent, do-not-rent, penggabungan, dan permintaan privasi
 * (MI-7). Pola query sama dengan `hospitality-properti.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanDoNotRent,
  MasukanGabung,
  MasukanPermintaanPrivasi,
  MasukanProsesPermintaanPrivasi,
  MasukanTamu,
  validasiDoNotRent,
  validasiGabung,
  validasiPermintaanPrivasi,
  validasiProsesPermintaanPrivasi,
  validasiTamu,
} from './hospitality-guest';

export interface BarisTamu {
  id: string;
  code: string;
  full_name: string;
  identifier_type: string | null;
  identifier_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  preferences: string | null;
  marketing_consent: boolean;
  do_not_rent: boolean;
  do_not_rent_reason: string | null;
  merged_into_id: string | null;
  created_at: string;
}

export interface BarisPermintaanPrivasi {
  id: string;
  guest_id: string;
  request_type: string;
  status: string;
  notes: string | null;
  requested_at: string;
  completed_at: string | null;
}

const KOLOM_TAMU = `id::text, code, full_name, identifier_type, identifier_number, email, phone, address,
  nationality, date_of_birth::text, preferences, marketing_consent, do_not_rent, do_not_rent_reason,
  merged_into_id::text, created_at::text`;

@Injectable()
export class HospitalityGuestService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftarTamu(
    schemaName: string,
    opsi: { cari?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisTamu[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.cari?.trim()) {
      params.push(`%${opsi.cari.trim()}%`);
      kondisi.push(`(full_name ILIKE $${params.length} OR phone ILIKE $${params.length} OR identifier_number ILIKE $${params.length})`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.hospitality_guest WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisTamu>(
      schemaName,
      `SELECT ${KOLOM_TAMU} FROM ${S}.hospitality_guest
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  /**
   * Kemiripan nama/telepon TANPA nomor identitas yang sama -- kasus yang
   * tidak dapat ditegakkan indeks unik (lihat catatan migrasi). Dipanggil
   * layar "Tambah Tamu" SEBELUM menyimpan, sebagai anjuran ("mungkin tamu
   * ini sudah pernah terdaftar?"), bukan penolakan -- staf tetap dapat
   * melanjutkan bila memang dua orang berbeda.
   */
  async cariKemiripan(
    schemaName: string,
    kriteria: { namaLengkap?: string; telepon?: string },
  ): Promise<BarisTamu[]> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (kriteria.telepon?.trim()) {
      params.push(kriteria.telepon.trim());
      kondisi.push(`phone = $${params.length}`);
    }
    if (kriteria.namaLengkap?.trim()) {
      params.push(`%${kriteria.namaLengkap.trim()}%`);
      kondisi.push(`full_name ILIKE $${params.length}`);
    }
    if (params.length === 0) return [];

    return this.tenantDb.query<BarisTamu>(
      schemaName,
      `SELECT ${KOLOM_TAMU} FROM ${S}.hospitality_guest WHERE ${kondisi.join(' OR ')} LIMIT 10`,
      params,
    );
  }

  async detailTamu(schemaName: string, id: string): Promise<BarisTamu> {
    const S = `"${schemaName}"`;
    const tamu = await this.tenantDb.queryOne<BarisTamu>(
      schemaName,
      `SELECT ${KOLOM_TAMU} FROM ${S}.hospitality_guest WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!tamu) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tamu tidak ditemukan.');
    }
    return tamu;
  }

  async catatTamu(schemaName: string, masukan: MasukanTamu, createdBy: string): Promise<BarisTamu> {
    const galat = validasiTamu(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisTamu>(
        schemaName,
        `INSERT INTO ${S}.hospitality_guest
           (full_name, identifier_type, identifier_number, email, phone, address, nationality,
            date_of_birth, preferences, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         RETURNING ${KOLOM_TAMU}`,
        [
          masukan.namaLengkap!.trim(),
          bersihkan(masukan.jenisIdentitas),
          bersihkan(masukan.nomorIdentitas),
          bersihkan(masukan.email),
          bersihkan(masukan.telepon),
          bersihkan(masukan.alamat),
          bersihkan(masukan.kewarganegaraan),
          masukan.tanggalLahir || null,
          bersihkan(masukan.preferensi),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_hospitality_guest_identitas')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Nomor identitas "${masukan.nomorIdentitas}" sudah terdaftar pada profil tamu lain.`,
        );
      }
      throw error;
    }
  }

  async aturConsent(schemaName: string, id: string, marketingConsent: boolean, actorUserId: string): Promise<BarisTamu> {
    await this.detailTamu(schemaName, id);
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisTamu>(
      schemaName,
      `UPDATE ${S}.hospitality_guest
          SET marketing_consent = $2,
              marketing_consent_at = CASE WHEN $2 THEN now() ELSE NULL END,
              updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_TAMU}`,
      [id, marketingConsent, actorUserId],
    );
    return rows[0];
  }

  async aturDoNotRent(
    schemaName: string,
    id: string,
    masukan: MasukanDoNotRent,
    actorUserId: string,
  ): Promise<BarisTamu> {
    const galat = validasiDoNotRent(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    await this.detailTamu(schemaName, id);
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisTamu>(
      schemaName,
      `UPDATE ${S}.hospitality_guest
          SET do_not_rent = $2, do_not_rent_reason = $3,
              updated_at = now(), updated_by = $4, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_TAMU}`,
      [id, !!masukan.doNotRent, masukan.doNotRent ? masukan.alasan!.trim() : null, actorUserId],
    );
    return rows[0];
  }

  /**
   * Menggabungkan profil `sourceId` ke dalam `masukan.intoGuestId`.
   *
   * Baris sumber TIDAK dihapus fisik -- ditandai `merged_into_id` dan
   * di-soft-delete, supaya riwayat (nanti reservasi, folio) yang pernah
   * menunjuknya tetap punya tempat berpijak. Status do-not-rent
   * digabung dengan OR: bila salah satu profil pernah dilarang menginap,
   * profil hasil gabungan tetap dilarang -- larangan keamanan tidak boleh
   * hilang hanya karena penggabungan catatan administratif.
   */
  async gabungkan(
    schemaName: string,
    sourceId: string,
    masukan: MasukanGabung,
    actorUserId: string,
  ): Promise<BarisTamu> {
    const galat = validasiGabung(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    if (sourceId === masukan.intoGuestId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Profil tidak dapat digabung ke dirinya sendiri.');
    }
    const source = await this.detailTamu(schemaName, sourceId);
    const target = await this.detailTamu(schemaName, masukan.intoGuestId!);

    const S = `"${schemaName}"`;
    return this.tenantDb.transaction(schemaName, async (client) => {
      if (source.do_not_rent && !target.do_not_rent) {
        await client.query(
          `UPDATE ${S}.hospitality_guest
              SET do_not_rent = TRUE, do_not_rent_reason = $2,
                  updated_at = now(), updated_by = $3, version = version + 1
            WHERE id = $1`,
          [target.id, source.do_not_rent_reason ?? 'Digabung dari profil dengan status do-not-rent.', actorUserId],
        );
      }
      const rows = await client.query<BarisTamu>(
        `UPDATE ${S}.hospitality_guest
            SET merged_into_id = $2, deleted_at = now(), deleted_by = $3,
                delete_reason = 'Digabung ke profil lain', updated_at = now(),
                updated_by = $3, version = version + 1
          WHERE id = $1
          RETURNING ${KOLOM_TAMU}`,
        [sourceId, masukan.intoGuestId, actorUserId],
      );
      return rows.rows[0];
    });
  }

  async daftarPermintaanPrivasi(schemaName: string, guestId: string): Promise<BarisPermintaanPrivasi[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisPermintaanPrivasi>(
      schemaName,
      `SELECT id::text, guest_id::text, request_type, status, notes,
              requested_at::text, completed_at::text
         FROM ${S}.hospitality_guest_privacy_request
        WHERE guest_id = $1 AND deleted_at IS NULL
        ORDER BY requested_at DESC`,
      [guestId],
    );
  }

  async ajukanPermintaanPrivasi(
    schemaName: string,
    guestId: string,
    masukan: MasukanPermintaanPrivasi,
    createdBy: string,
  ): Promise<BarisPermintaanPrivasi> {
    const galat = validasiPermintaanPrivasi(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    await this.detailTamu(schemaName, guestId);
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisPermintaanPrivasi>(
      schemaName,
      `INSERT INTO ${S}.hospitality_guest_privacy_request
         (guest_id, request_type, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id::text, guest_id::text, request_type, status, notes,
                 requested_at::text, completed_at::text`,
      [guestId, masukan.jenis, bersihkan(masukan.catatan), createdBy],
    );
    return rows[0];
  }

  /**
   * Menyelesaikan (atau menolak) permintaan privasi.
   *
   * `ERASURE` + `COMPLETED` benar-benar menganonimkan data pribadi tamu --
   * nama, kontak, alamat, nomor identitas. Status `do_not_rent` dan
   * alasannya SENGAJA DIPERTAHANKAN: itu catatan keamanan tersendiri,
   * bukan data pemasaran/CRM, dan menghapusnya berarti tamu dapat
   * "menghapus jalan keluar" dari larangan menginap lewat permintaan
   * privasi -- bukan itu tujuan hak penghapusan data.
   */
  async prosesPermintaanPrivasi(
    schemaName: string,
    requestId: string,
    masukan: MasukanProsesPermintaanPrivasi,
    actorUserId: string,
  ): Promise<BarisPermintaanPrivasi> {
    const galat = validasiProsesPermintaanPrivasi(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const permintaan = await this.tenantDb.queryOne<{ id: string; guest_id: string; request_type: string; status: string }>(
      schemaName,
      `SELECT id, guest_id::text, request_type, status
         FROM ${S}.hospitality_guest_privacy_request WHERE id = $1 AND deleted_at IS NULL`,
      [requestId],
    );
    if (!permintaan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Permintaan privasi tidak ditemukan.');
    }
    if (permintaan.status !== 'PENDING') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Permintaan ini sudah diproses sebelumnya.');
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      if (permintaan.request_type === 'ERASURE' && masukan.status === 'COMPLETED') {
        await client.query(
          `UPDATE ${S}.hospitality_guest
              SET full_name = 'Tamu Dihapus', identifier_type = NULL, identifier_number = NULL,
                  email = NULL, phone = NULL, address = NULL, preferences = NULL,
                  marketing_consent = FALSE, marketing_consent_at = NULL,
                  updated_at = now(), updated_by = $2, version = version + 1
            WHERE id = $1`,
          [permintaan.guest_id, actorUserId],
        );
      }
      const rows = await client.query<BarisPermintaanPrivasi>(
        `UPDATE ${S}.hospitality_guest_privacy_request
            SET status = $2, notes = COALESCE($3, notes), completed_at = now(),
                updated_at = now(), updated_by = $4, version = version + 1
          WHERE id = $1
          RETURNING id::text, guest_id::text, request_type, status, notes,
                    requested_at::text, completed_at::text`,
        [requestId, masukan.status, bersihkan(masukan.catatan), actorUserId],
      );
      return rows.rows[0];
    });
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
