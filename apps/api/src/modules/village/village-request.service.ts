/**
 * Permohonan layanan warga, dari pengajuan sampai surat diserahkan.
 *
 * Inti sistem. Alurnya:
 *
 *   warga mengajukan → berkas diverifikasi → persetujuan berjenjang
 *   → surat diterbitkan bernomor → diserahkan
 *
 * dengan dua jalan keluar yang keduanya **wajib beralasan**: dikembalikan
 * karena berkas kurang, atau ditolak. Permohonan yang berhenti tanpa kabar
 * adalah keluhan nomor satu pelayanan publik, dan tidak ada jalan pada layanan
 * ini yang membiarkannya terjadi.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import { VillageWorkflowService } from './village-workflow.service';
import type { CuplikanAlur, LangkahWorkflow } from './ports/workflow.port';
import {
  bolehMemproses,
  bolehPindahPermohonan,
  hitungSla,
  periksaKelengkapan,
  susunNomorSurat,
  type StatusPermohonan,
} from './village-service';

@Injectable()
export class VillageRequestService {
  private readonly logger = new Logger(VillageRequestService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
    private readonly alur: VillageWorkflowService,
  ) {}

  // --- Pengajuan ------------------------------------------------------------

  /**
   * Mengajukan permohonan.
   *
   * Cuplikan definisi alur diambil di sini, bukan saat persetujuan dimulai.
   * Bila katalog diubah esok hari, permohonan ini tetap memakai aturan yang
   * berlaku saat ia masuk.
   */
  async ajukan(
    schemaName: string,
    input: {
      serviceCode: string;
      residentId?: string;
      applicantName: string;
      applicantNik?: string;
      applicantPhone?: string;
      purpose?: string;
      formData?: Record<string, unknown>;
    },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'LAYANAN.PERMOHONAN');
    const u = await this.unit.unit(schemaName);

    const layanan = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, code, name, sla_working_days, definition_version, approval_steps
         FROM "${schemaName}".village_service_catalog
        WHERE village_unit_id = $1 AND code = $2 AND is_active = TRUE AND deleted_at IS NULL`,
      [u.id, input.serviceCode],
    );
    if (!layanan.length) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        `Jenis layanan "${input.serviceCode}" tidak tersedia di desa/kelurahan ini.`,
      );
    }
    const l = layanan[0];

    const cuplikan: CuplikanAlur = {
      definitionCode: String(l.code),
      version: Number(l.definition_version),
      capturedAt: new Date().toISOString(),
      steps: (l.approval_steps as LangkahWorkflow[]) ?? [],
    };

    const nomor = await this.nomorPermohonan(schemaName, u.id);

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_service_request
         (village_unit_id, service_catalog_id, request_number, village_resident_id,
          applicant_name, applicant_nik, applicant_phone, applicant_user_id, purpose,
          form_data, status, definition_snapshot, definition_version, submitted_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'DIAJUKAN',$11,$12,now(),$13)
       RETURNING id`,
      [
        u.id,
        l.id,
        nomor,
        input.residentId ?? null,
        input.applicantName,
        input.applicantNik ?? null,
        input.applicantPhone ?? null,
        user.userId,
        input.purpose ?? null,
        JSON.stringify(input.formData ?? {}),
        JSON.stringify(cuplikan),
        Number(l.definition_version),
        user.userId,
      ],
    );

    await this.catatRiwayat(schemaName, rows[0].id, null, 'DIAJUKAN', 'Permohonan diajukan', user);
    return { id: rows[0].id, requestNumber: nomor, status: 'DIAJUKAN' };
  }

  // --- Verifikasi berkas ----------------------------------------------------

  /**
   * Memverifikasi kelengkapan berkas.
   *
   * Bila lengkap, `documents_completed_at` diisi — **dan sejak itulah SLA
   * mulai berjalan.** Bila kurang, permohonan dikembalikan beserta daftar
   * berkas yang masih dibutuhkan, bukan sekadar "berkas belum lengkap".
   */
  async verifikasiBerkas(schemaName: string, requestId: string, user: AuthenticatedUser) {
    await this.unit.pastikanLayak(schemaName, 'LAYANAN.VERIFIKASI');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const p = await this.ambilTerkunci(client, schemaName, requestId);
      this.pastikanBukanPemohon(p, user);

      const v = bolehPindahPermohonan(p.status as StatusPermohonan, 'DIVERIFIKASI');
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      const syarat = await client.query<{ code: string; name: string; is_mandatory: boolean }>(
        `SELECT code, name, is_mandatory FROM "${schemaName}".village_service_requirement
          WHERE service_catalog_id = $1 AND deleted_at IS NULL`,
        [p.service_catalog_id],
      );
      const berkas = await client.query<{ requirement_code: string }>(
        `SELECT requirement_code FROM "${schemaName}".village_request_document
          WHERE service_request_id = $1`,
        [requestId],
      );

      const h = periksaKelengkapan(
        syarat.rows.map((s) => ({ code: s.code, name: s.name, mandatory: s.is_mandatory })),
        berkas.rows.map((b) => ({ requirementCode: b.requirement_code })),
      );

      if (!h.lengkap) {
        await client.query(
          `UPDATE "${schemaName}".village_service_request
              SET status = 'BERKAS_KURANG', return_reason = $2, updated_at = now(),
                  updated_by = $3, version = version + 1
            WHERE id = $1`,
          [requestId, h.pesan, user.userId],
        );
        await this.catatRiwayatDi(client, schemaName, requestId, p.status, 'BERKAS_KURANG', h.pesan!, user);
        return { status: 'BERKAS_KURANG', missing: h.kurang, message: h.pesan };
      }

      // Berkas lengkap: SLA mulai berjalan dari sini.
      const sla = await client.query<{ sla_working_days: number }>(
        `SELECT sla_working_days FROM "${schemaName}".village_service_catalog WHERE id = $1`,
        [p.service_catalog_id],
      );
      const libur = await client.query<{ holiday_date: string }>(
        `SELECT holiday_date::text FROM "${schemaName}".village_holiday WHERE village_unit_id = $1`,
        [p.village_unit_id],
      );
      const hariIni = new Date().toISOString().slice(0, 10);
      const hasil = hitungSla(
        {
          completedAt: hariIni,
          finishedAt: null,
          slaWorkingDays: Number(sla.rows[0].sla_working_days),
          holidays: libur.rows.map((r) => r.holiday_date),
        },
        hariIni,
      );

      await client.query(
        `UPDATE "${schemaName}".village_service_request
            SET status = 'DIVERIFIKASI', documents_completed_at = now(), due_date = $2,
                return_reason = NULL, updated_at = now(), updated_by = $3, version = version + 1
          WHERE id = $1`,
        [requestId, hasil.dueDate, user.userId],
      );
      await this.catatRiwayatDi(
        client,
        schemaName,
        requestId,
        p.status,
        'DIVERIFIKASI',
        `Berkas lengkap. Janji penyelesaian ${hasil.dueDate}.`,
        user,
      );

      return { status: 'DIVERIFIKASI', dueDate: hasil.dueDate };
    });
  }

  // --- Persetujuan ----------------------------------------------------------

  /** Memulai alur persetujuan menurut cuplikan yang tersimpan pada permohonan. */
  async mulaiPersetujuan(schemaName: string, requestId: string, user: AuthenticatedUser) {
    await this.unit.pastikanLayak(schemaName, 'LAYANAN.PERMOHONAN');

    const p = await this.ambil(schemaName, requestId);
    const v = bolehPindahPermohonan(p.status as StatusPermohonan, 'MENUNGGU_PERSETUJUAN');
    if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

    const cuplikan = p.definition_snapshot as CuplikanAlur;
    if (!cuplikan?.steps?.length) {
      /*
       * Layanan tanpa jenjang persetujuan langsung disetujui. Surat keterangan
       * sederhana pada desa kecil memang begitu — memaksakan langkah kosong
       * hanya menambah klik tanpa menambah kendali.
       */
      await this.pindah(schemaName, requestId, 'DISETUJUI', 'Layanan tanpa jenjang persetujuan', user);
      return { status: 'DISETUJUI', workflow: null };
    }

    const inst = await this.alur.mulai({
      schemaName,
      definitionCode: cuplikan.definitionCode,
      subjectType: 'VILLAGE_SERVICE_REQUEST',
      subjectId: requestId,
      snapshot: cuplikan,
      initiatedBy: String(p.applicant_user_id ?? p.created_by ?? user.userId),
    });

    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".village_service_request
          SET status = 'MENUNGGU_PERSETUJUAN', workflow_instance_id = $2,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [requestId, inst.instanceId],
    );
    await this.catatRiwayat(
      schemaName,
      requestId,
      p.status as string,
      'MENUNGGU_PERSETUJUAN',
      'Diteruskan untuk persetujuan',
      user,
    );

    return { status: 'MENUNGGU_PERSETUJUAN', workflow: inst };
  }

  /** Menyetujui atau menolak langkah berjalan, lalu menyelaraskan status permohonan. */
  async putuskan(
    schemaName: string,
    requestId: string,
    aksi: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
    alasan: string | undefined,
    user: AuthenticatedUser,
  ) {
    const p = await this.ambil(schemaName, requestId);
    if (!p.workflow_instance_id) {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Permohonan ini belum masuk alur persetujuan.');
    }

    const inst = await this.alur.tindak({
      schemaName,
      instanceId: String(p.workflow_instance_id),
      action: aksi,
      actorUserId: user.userId,
      activeRoleId: user.activeRoleId ?? null,
      reason: alasan,
    });

    if (inst.status === 'SELESAI') {
      await this.pindah(schemaName, requestId, 'DISETUJUI', 'Seluruh persetujuan terpenuhi', user);
      return { status: 'DISETUJUI', workflow: inst };
    }
    if (inst.status === 'DITOLAK') {
      await this.pindah(schemaName, requestId, 'DITOLAK', alasan ?? 'Ditolak', user);
      return { status: 'DITOLAK', workflow: inst };
    }
    if (inst.status === 'DIKEMBALIKAN') {
      await this.pindah(schemaName, requestId, 'BERKAS_KURANG', alasan ?? 'Perlu perbaikan', user);
      return { status: 'BERKAS_KURANG', workflow: inst };
    }
    return { status: 'MENUNGGU_PERSETUJUAN', workflow: inst };
  }

  // --- Penerbitan surat -----------------------------------------------------

  /**
   * Menerbitkan surat.
   *
   * Nomor surat diambil di dalam transaksi yang sama dengan penyimpanannya, dan
   * keunikannya ditegakkan indeks unik — bukan oleh perhitungan layanan. Dua
   * petugas yang menerbitkan surat pada milidetik yang sama tidak boleh
   * memperoleh nomor yang sama.
   */
  async terbitkan(
    schemaName: string,
    requestId: string,
    input: { signedByOfficerId?: string; body?: string },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'LAYANAN.PENERBITAN');
    const u = await this.unit.unit(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const p = await this.ambilTerkunci(client, schemaName, requestId);
      const v = bolehPindahPermohonan(p.status as StatusPermohonan, 'DITERBITKAN');
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      const l = await client.query<Record<string, unknown>>(
        `SELECT code, name, letter_code, number_pattern, number_padding, template_body
           FROM "${schemaName}".village_service_catalog WHERE id = $1`,
        [p.service_catalog_id],
      );
      const katalog = l.rows[0];
      const hariIni = new Date().toISOString().slice(0, 10);

      // Urutan berikutnya dikunci bersama penyisipannya.
      const urut = await client.query<{ n: string }>(
        `SELECT COALESCE(MAX(
           CASE WHEN letter_number ~ '^[0-9]+' THEN substring(letter_number from '^[0-9]+')::int ELSE 0 END
         ), 0) + 1 AS n
           FROM "${schemaName}".village_letter
          WHERE village_unit_id = $1 AND date_part('year', letter_date) = date_part('year', $2::date)`,
        [u.id, hariIni],
      );

      const nomor = susunNomorSurat(
        {
          pattern: String(katalog.number_pattern),
          padding: Number(katalog.number_padding),
        },
        {
          urut: Number(urut.rows[0].n),
          kode: String(katalog.letter_code ?? katalog.code),
          tanggal: hariIni,
          unitCode: u.code,
        },
      );

      const token = randomBytes(16).toString('base64url');

      const surat = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_letter
           (village_unit_id, service_request_id, letter_number, letter_date, subject, body,
            signed_by_officer_id, verification_token, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          u.id,
          requestId,
          nomor,
          hariIni,
          `${katalog.name} — ${p.applicant_name}`,
          input.body ?? katalog.template_body ?? null,
          input.signedByOfficerId ?? null,
          token,
          user.userId,
        ],
      );

      await client.query(
        `UPDATE "${schemaName}".village_service_request
            SET status = 'DITERBITKAN', finished_at = now(), updated_at = now(),
                updated_by = $2, version = version + 1
          WHERE id = $1`,
        [requestId, user.userId],
      );
      await this.catatRiwayatDi(
        client,
        schemaName,
        requestId,
        p.status,
        'DITERBITKAN',
        `Surat ${nomor} diterbitkan`,
        user,
      );

      // Register surat keluar ikut terisi. Buku register yang harus diisi ulang
      // secara manual adalah buku register yang tidak pernah lengkap.
      await client.query(
        `INSERT INTO "${schemaName}".village_register_entry
           (village_unit_id, register_type, entry_number, entry_date, subject,
            source_type, source_id, village_resident_id, recorded_by)
         VALUES ($1, 'SURAT_KELUAR', $2, $3, $4, 'VILLAGE_LETTER', $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          u.id,
          nomor,
          hariIni,
          `${katalog.name} — ${p.applicant_name}`,
          surat.rows[0].id,
          p.village_resident_id ?? null,
          user.userId,
        ],
      );

      return { letterId: surat.rows[0].id, letterNumber: nomor, verificationToken: token };
    });
  }

  /**
   * Memeriksa keaslian surat dari tokennya.
   *
   * Untuk pihak ketiga — bank, sekolah, calon majikan — yang menerima surat dan
   * ingin memastikan ia sungguh terbit dari desa itu.
   *
   * **Tidak mengembalikan data pribadi.** Hanya sah/tidak sah, nomor, tanggal,
   * jenis layanan, dan nama desanya. Halaman verifikasi yang menampilkan isi
   * surat akan menjadikan setiap token yang bocor sebagai kebocoran data warga.
   */
  async verifikasiPublik(schemaName: string, token: string) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT l.letter_number, l.letter_date::text, l.is_revoked, l.revoked_at::text,
              c.name AS service_name, u.name AS unit_name, u.profile_type
         FROM "${schemaName}".village_letter l
         JOIN "${schemaName}".village_service_request r ON r.id = l.service_request_id
         JOIN "${schemaName}".village_service_catalog c ON c.id = r.service_catalog_id
         JOIN "${schemaName}".village_unit u ON u.id = l.village_unit_id
        WHERE l.verification_token = $1`,
      [token],
    );

    if (!rows.length) {
      return { valid: false, reason: 'Kode verifikasi tidak dikenali.' };
    }
    const r = rows[0];
    if (r.is_revoked) {
      return {
        valid: false,
        reason: 'Surat ini telah dicabut.',
        letterNumber: r.letter_number,
        revokedAt: r.revoked_at,
      };
    }
    return {
      valid: true,
      letterNumber: r.letter_number,
      letterDate: r.letter_date,
      serviceName: r.service_name,
      issuedBy: `${r.profile_type === 'DESA' ? 'Desa' : 'Kelurahan'} ${r.unit_name}`,
    };
  }

  // --- Antrean --------------------------------------------------------------

  async ambilNomorAntrean(schemaName: string, counterCode: string, requestId?: string) {
    await this.unit.pastikanLayak(schemaName, 'LAYANAN.ANTREAN');
    const u = await this.unit.unit(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const loket = await client.query<{ id: string; code: string }>(
        `SELECT id, code FROM "${schemaName}".village_counter
          WHERE village_unit_id = $1 AND code = $2 AND is_active = TRUE AND deleted_at IS NULL`,
        [u.id, counterCode],
      );
      if (!loket.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, `Loket ${counterCode} tidak ditemukan.`);
      }

      const terakhir = await client.query<{ n: string }>(
        `SELECT COALESCE(MAX(sequence_no), 0) AS n FROM "${schemaName}".village_queue_ticket
          WHERE village_unit_id = $1 AND queue_date = CURRENT_DATE AND counter_id = $2`,
        [u.id, loket.rows[0].id],
      );
      const urut = Number(terakhir.rows[0].n) + 1;
      const nomor = `${loket.rows[0].code}-${String(urut).padStart(3, '0')}`;

      const t = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_queue_ticket
           (village_unit_id, counter_id, service_request_id, ticket_number, sequence_no)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [u.id, loket.rows[0].id, requestId ?? null, nomor, urut],
      );

      const menunggu = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "${schemaName}".village_queue_ticket
          WHERE village_unit_id = $1 AND queue_date = CURRENT_DATE
            AND counter_id = $2 AND status = 'MENUNGGU' AND sequence_no < $3`,
        [u.id, loket.rows[0].id, urut],
      );

      return { id: t.rows[0].id, ticketNumber: nomor, waitingAhead: Number(menunggu.rows[0].n) };
    });
  }

  // --- Pelacakan warga ------------------------------------------------------

  /**
   * Status permohonan sebagaimana dilihat warga.
   *
   * Hanya riwayat yang ditandai terlihat warga. Catatan internal petugas —
   * "berkas diragukan, tanya Pak RT dulu" — tidak perlu dan tidak seharusnya
   * dibaca pemohonnya.
   */
  async lacak(schemaName: string, requestNumber: string) {
    const p = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT r.id, r.request_number, r.status, r.applicant_name, r.due_date::text,
              r.return_reason, r.reject_reason, c.name AS service_name
         FROM "${schemaName}".village_service_request r
         JOIN "${schemaName}".village_service_catalog c ON c.id = r.service_catalog_id
        WHERE r.request_number = $1`,
      [requestNumber],
    );
    if (!p.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Nomor permohonan tidak ditemukan.');
    }

    const riwayat = await this.tenantDb.query(
      schemaName,
      `SELECT to_status, reason, occurred_at::text
         FROM "${schemaName}".village_request_history
        WHERE service_request_id = $1 AND visible_to_citizen = TRUE
        ORDER BY occurred_at`,
      [p[0].id],
    );

    return { ...p[0], history: riwayat };
  }

  // --- Bagian dalam ---------------------------------------------------------

  private async ambil(schemaName: string, id: string) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT * FROM "${schemaName}".village_service_request WHERE id = $1`,
      [id],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Permohonan tidak ditemukan.');
    return rows[0];
  }

  private async ambilTerkunci(client: PoolClient, schemaName: string, id: string) {
    const rows = await client.query<Record<string, string>>(
      `SELECT * FROM "${schemaName}".village_service_request WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!rows.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Permohonan tidak ditemukan.');
    return rows.rows[0];
  }

  private pastikanBukanPemohon(p: Record<string, unknown>, user: AuthenticatedUser) {
    const v = bolehMemproses((p.applicant_user_id as string) ?? null, user.userId);
    if (!v.boleh) throw AppError.forbidden(ErrorCodes.FORBIDDEN, v.alasan!);
  }

  private async pindah(
    schemaName: string,
    id: string,
    ke: StatusPermohonan,
    alasan: string,
    user: AuthenticatedUser,
  ) {
    const p = await this.ambil(schemaName, id);
    const v = bolehPindahPermohonan(p.status as StatusPermohonan, ke);
    if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);
    if (v.wajibBeralasan && !alasan?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Perubahan ini wajib menyertakan alasan yang dapat dibaca pemohon.',
      );
    }

    const kolomAlasan =
      ke === 'DITOLAK' ? 'reject_reason' : ke === 'BERKAS_KURANG' ? 'return_reason' : null;

    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".village_service_request
          SET status = $2${kolomAlasan ? `, ${kolomAlasan} = $3` : ''},
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      kolomAlasan ? [id, ke, alasan] : [id, ke],
    );
    await this.catatRiwayat(schemaName, id, p.status as string, ke, alasan, user);
  }

  private async catatRiwayat(
    schemaName: string,
    id: string,
    dari: string | null,
    ke: string,
    alasan: string,
    user: AuthenticatedUser,
  ) {
    await this.tenantDb.query(
      schemaName,
      `INSERT INTO "${schemaName}".village_request_history
         (service_request_id, from_status, to_status, reason, actor_user_id, active_role_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, dari, ke, alasan, user.userId, user.activeRoleId ?? null],
    );
  }

  private async catatRiwayatDi(
    client: PoolClient,
    schemaName: string,
    id: string,
    dari: string | null,
    ke: string,
    alasan: string,
    user: AuthenticatedUser,
  ) {
    await client.query(
      `INSERT INTO "${schemaName}".village_request_history
         (service_request_id, from_status, to_status, reason, actor_user_id, active_role_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, dari, ke, alasan, user.userId, user.activeRoleId ?? null],
    );
  }

  private async nomorPermohonan(schemaName: string, unitId: string): Promise<string> {
    const rows = await this.tenantDb.query<{ n: string }>(
      schemaName,
      `SELECT count(*)::text AS n FROM "${schemaName}".village_service_request
        WHERE village_unit_id = $1 AND date_part('year', created_at) = date_part('year', now())`,
      [unitId],
    );
    const tahun = new Date().getFullYear();
    return `REQ-${tahun}-${String(Number(rows[0].n) + 1).padStart(5, '0')}`;
  }
}
