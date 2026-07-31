/**
 * Mesin alur persetujuan milik village.
 *
 * Mengimplementasikan `WorkflowPort` yang didefinisikan village sendiri, sebab
 * mesin bersama yang disebut perintah §7 tidak ada — tabel `workflow_*` Core
 * ada sejak V007 tanpa satu baris kode pun yang menjalankannya. Lihat
 * `docs/integration-requests/village/001-workflow-port.md`.
 *
 * Polanya meniru modul `surat` yang sudah terbukti: langkah tersimpan sebagai
 * baris, bukan sebagai keadaan yang dihitung ulang. Riwayat persetujuan surat
 * desa adalah bagian dari arsipnya, dan arsip tidak boleh bergantung pada kode
 * yang menghitungnya kembali.
 *
 * Dua aturan ditegakkan di sini, bukan diserahkan kepada pemanggil:
 *
 * 1. **Pemohon tidak dapat menyetujui permohonannya sendiri.**
 * 2. **Penolakan wajib beralasan.**
 *
 * Aturan yang diserahkan kepada pemanggil akan benar pada sebagian besar jalan
 * dan terlewat pada satu.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import type {
  MulaiWorkflowInput,
  TilikanInstansi,
  TilikanLangkah,
  TindakanWorkflowInput,
  WorkflowPort,
} from './ports/workflow.port';

@Injectable()
export class VillageWorkflowService implements WorkflowPort {
  private readonly logger = new Logger(VillageWorkflowService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  async mulai(input: MulaiWorkflowInput): Promise<TilikanInstansi> {
    const { schemaName, snapshot } = input;

    if (!snapshot.steps.length) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Alur tanpa langkah tidak dapat dimulai.',
      );
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const unit = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".village_unit
          WHERE deleted_at IS NULL AND is_active = TRUE ORDER BY created_at LIMIT 1`,
      );

      const inst = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_workflow_instance
           (village_unit_id, definition_code, definition_version, subject_type, subject_id,
            status, current_sequence, initiated_by)
         VALUES ($1, $2, $3, $4, $5, 'BERJALAN', $6, $7)
         RETURNING id`,
        [
          unit.rows[0].id,
          snapshot.definitionCode,
          snapshot.version,
          input.subjectType,
          input.subjectId,
          snapshot.steps[0].sequence,
          input.initiatedBy,
        ],
      );
      const id = inst.rows[0].id;

      for (const s of snapshot.steps) {
        await client.query(
          `INSERT INTO "${schemaName}".village_workflow_step
             (instance_id, sequence, code, name, role_code)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, s.sequence, s.code, s.name, s.roleCode],
        );
      }

      return this.bacaInstansi(client, schemaName, id);
    });
  }

  async tindak(input: TindakanWorkflowInput): Promise<TilikanInstansi> {
    const { schemaName, instanceId } = input;

    if ((input.action === 'REJECT' || input.action === 'REQUEST_CHANGES') && !input.reason?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        input.action === 'REJECT'
          ? 'Penolakan wajib menyertakan alasan yang dapat dibaca pemohon.'
          : 'Permintaan perbaikan wajib menyebutkan apa yang perlu diperbaiki.',
      );
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const inst = await client.query<Record<string, string>>(
        `SELECT id, status, current_sequence, initiated_by, subject_type, subject_id
           FROM "${schemaName}".village_workflow_instance WHERE id = $1 FOR UPDATE`,
        [instanceId],
      );
      if (!inst.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alur persetujuan tidak ditemukan.');
      }
      const i = inst.rows[0];

      if (i.status !== 'BERJALAN') {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Alur ini sudah berstatus ${i.status} dan tidak menunggu tindakan.`,
        );
      }

      /*
       * Pemohon tidak dapat menyetujui permohonannya sendiri. Di desa kecil,
       * perangkat desa juga warga yang suatu saat mengajukan surat untuk
       * dirinya — ia boleh mengajukannya, yang tidak boleh adalah ia sendiri
       * yang menyetujuinya.
       */
      if (
        (input.action === 'APPROVE' || input.action === 'REJECT') &&
        i.initiated_by &&
        i.initiated_by === input.actorUserId
      ) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak dapat menyetujui atau menolak permohonan yang Anda ajukan sendiri. ' +
            'Mintakan kepada petugas lain.',
        );
      }

      const langkah = await client.query<Record<string, string>>(
        `SELECT id, sequence, role_code, status FROM "${schemaName}".village_workflow_step
          WHERE instance_id = $1 AND sequence = $2 FOR UPDATE`,
        [instanceId, Number(i.current_sequence)],
      );
      if (!langkah.rows.length || langkah.rows[0].status !== 'MENUNGGU') {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Langkah ini tidak sedang menunggu tindakan.');
      }
      const l = langkah.rows[0];

      if (input.action === 'DELEGATE') {
        if (!input.delegateTo) {
          throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Tujuan pelimpahan wajib disebutkan.');
        }
        await client.query(
          `UPDATE "${schemaName}".village_workflow_step
              SET delegated_to = $2, reason = $3 WHERE id = $1`,
          [l.id, input.delegateTo, input.reason ?? null],
        );
        return this.bacaInstansi(client, schemaName, instanceId);
      }

      const statusLangkah =
        input.action === 'APPROVE' ? 'SELESAI' : input.action === 'REJECT' ? 'DITOLAK' : 'MENUNGGU';

      await client.query(
        `UPDATE "${schemaName}".village_workflow_step
            SET status = $2, actor_user_id = $3, active_role_id = $4,
                acted_at = now(), reason = $5
          WHERE id = $1`,
        [l.id, statusLangkah, input.actorUserId, input.activeRoleId, input.reason ?? null],
      );

      if (input.action === 'REJECT') {
        await client.query(
          `UPDATE "${schemaName}".village_workflow_instance
              SET status = 'DITOLAK', finished_at = now(), version = version + 1
            WHERE id = $1`,
          [instanceId],
        );
      } else if (input.action === 'REQUEST_CHANGES') {
        /*
         * Dikembalikan kepada pemohon. Alurnya tidak dibatalkan — pemohon
         * melengkapi lalu mengajukan kembali, dan langkah yang sudah disetujui
         * tidak diulang. Membatalkan dan memulai ulang akan menghapus jejak
         * siapa yang sudah menyetujui apa.
         */
        await client.query(
          `UPDATE "${schemaName}".village_workflow_instance
              SET status = 'DIKEMBALIKAN', version = version + 1
            WHERE id = $1`,
          [instanceId],
        );
      } else {
        const berikut = await client.query<{ sequence: number }>(
          `SELECT sequence FROM "${schemaName}".village_workflow_step
            WHERE instance_id = $1 AND sequence > $2 AND status = 'MENUNGGU'
            ORDER BY sequence LIMIT 1`,
          [instanceId, Number(l.sequence)],
        );
        if (berikut.rows.length) {
          await client.query(
            `UPDATE "${schemaName}".village_workflow_instance
                SET current_sequence = $2, version = version + 1 WHERE id = $1`,
            [instanceId, berikut.rows[0].sequence],
          );
        } else {
          await client.query(
            `UPDATE "${schemaName}".village_workflow_instance
                SET status = 'SELESAI', finished_at = now(), version = version + 1
              WHERE id = $1`,
            [instanceId],
          );
        }
      }

      return this.bacaInstansi(client, schemaName, instanceId);
    });
  }

  /** Melanjutkan alur yang dikembalikan, setelah pemohon melengkapi. */
  async lanjutkanSetelahPerbaikan(schemaName: string, instanceId: string): Promise<TilikanInstansi> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const inst = await client.query<{ status: string }>(
        `SELECT status FROM "${schemaName}".village_workflow_instance WHERE id = $1 FOR UPDATE`,
        [instanceId],
      );
      if (!inst.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alur persetujuan tidak ditemukan.');
      }
      if (inst.rows[0].status !== 'DIKEMBALIKAN') {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Alur berstatus ${inst.rows[0].status} tidak sedang menunggu perbaikan.`,
        );
      }
      await client.query(
        `UPDATE "${schemaName}".village_workflow_instance
            SET status = 'BERJALAN', version = version + 1 WHERE id = $1`,
        [instanceId],
      );
      return this.bacaInstansi(client, schemaName, instanceId);
    });
  }

  async keadaan(schemaName: string, instanceId: string): Promise<TilikanInstansi> {
    return this.tenantDb.transaction(schemaName, (client) =>
      this.bacaInstansi(client, schemaName, instanceId),
    );
  }

  async menungguUntuk(schemaName: string, roleCodes: string[]) {
    if (!roleCodes.length) return [];
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT i.id AS instance_id, i.subject_type, i.subject_id,
              s.sequence, s.code, s.name, s.role_code, s.status
         FROM "${schemaName}".village_workflow_instance i
         JOIN "${schemaName}".village_workflow_step s
           ON s.instance_id = i.id AND s.sequence = i.current_sequence
        WHERE i.status = 'BERJALAN' AND s.status = 'MENUNGGU' AND s.role_code = ANY($1)
        ORDER BY i.started_at`,
      [roleCodes],
    );
    return rows.map((r) => ({
      instanceId: r.instance_id,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      step: {
        sequence: Number(r.sequence),
        code: r.code,
        name: r.name,
        roleCode: r.role_code,
        status: r.status as TilikanLangkah['status'],
      },
    }));
  }

  private async bacaInstansi(
    client: PoolClient,
    schemaName: string,
    instanceId: string,
  ): Promise<TilikanInstansi> {
    const inst = await client.query<Record<string, string>>(
      `SELECT id, status, current_sequence FROM "${schemaName}".village_workflow_instance WHERE id = $1`,
      [instanceId],
    );
    if (!inst.rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alur persetujuan tidak ditemukan.');
    }

    const langkah = await client.query<Record<string, string>>(
      `SELECT sequence, code, name, role_code, status, actor_user_id, active_role_id,
              acted_at::text, reason
         FROM "${schemaName}".village_workflow_step
        WHERE instance_id = $1 ORDER BY sequence`,
      [instanceId],
    );

    const steps: TilikanLangkah[] = langkah.rows.map((r) => ({
      sequence: Number(r.sequence),
      code: r.code,
      name: r.name,
      roleCode: r.role_code,
      status: r.status as TilikanLangkah['status'],
      actorUserId: r.actor_user_id ?? null,
      activeRoleId: r.active_role_id ?? null,
      actedAt: r.acted_at ?? null,
      reason: r.reason ?? null,
    }));

    const kini = Number(inst.rows[0].current_sequence);
    return {
      instanceId,
      status: inst.rows[0].status as TilikanInstansi['status'],
      currentStep: steps.find((s) => s.sequence === kini && s.status === 'MENUNGGU') ?? null,
      steps,
    };
  }
}
