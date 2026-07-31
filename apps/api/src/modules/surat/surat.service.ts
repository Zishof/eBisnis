/**
 * Surat masuk, surat keluar, disposisi, dan persetujuan.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/decorators';
import { SuratNumberService } from './surat-number.service';
import {
  canTransition,
  isEditable,
  statusAfterDecision,
  type SuratOutgoingStatus,
} from './surat-state';

@Injectable()
export class SuratService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly numbers: SuratNumberService,
    private readonly audit: AuditService,
  ) {}

  // -- Surat masuk ----------------------------------------------------------

  /**
   * Mencatat surat masuk.
   *
   * Nomor agendanya diterbitkan sistem; nomor dari pengirim disimpan apa adanya
   * dan boleh kembar — dua instansi berbeda dapat mengirim surat bernomor sama.
   */
  async registerIncoming(
    schema: string,
    input: {
      classificationId?: string;
      natureId?: string;
      lockerId?: string;
      senderName: string;
      senderNumber?: string;
      senderAddress?: string;
      subject: string;
      summary?: string;
      letterDate?: string;
      confidentiality?: string;
      addressedRoleCode?: string;
      attachmentNote?: string;
    },
    user: AuthenticatedUser,
  ) {
    const agenda = await this.nextAgendaNumber(schema);
    const subjectId = await this.subjectIdOf(schema, user.userId);

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".surat_incoming
         (agenda_number, sender_number, classification_id, nature_id, locker_id,
          sender_name, sender_address, subject, summary, attachment_note,
          letter_date, confidentiality, addressed_role_code,
          registered_by_user_subject_id)
       VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, $9, $10,
               $11::date, COALESCE($12, 'BIASA'), $13, $14::uuid)
       RETURNING id::text`,
      [
        agenda,
        input.senderNumber ?? null,
        input.classificationId ?? null,
        input.natureId ?? null,
        input.lockerId ?? null,
        input.senderName,
        input.senderAddress ?? null,
        input.subject,
        input.summary ?? null,
        input.attachmentNote ?? null,
        input.letterDate ?? null,
        input.confidentiality ?? null,
        input.addressedRoleCode ?? null,
        subjectId,
      ],
    );

    await this.audit.record({
      moduleCode: 'SURAT',
      actionCode: 'SURAT_MASUK_DICATAT',
      entityType: 'SuratIncoming',
      entityId: rows[0].id,
      documentNumber: agenda,
      tenantSchema: schema,
    });

    return { id: rows[0].id, agendaNumber: agenda };
  }

  /** Mendisposisikan surat masuk. */
  async disposition(
    schema: string,
    incomingId: string,
    input: {
      toUserSubjectId?: string;
      toRoleCode?: string;
      instruction: string;
      dueDate?: string;
      parentId?: string;
    },
    user: AuthenticatedUser,
  ) {
    const surat = await this.incomingOf(schema, incomingId);
    if (surat.status === 'DIARSIPKAN') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Surat yang sudah diarsipkan tidak dapat didisposisikan.',
      );
    }
    if (!input.toUserSubjectId && !input.toRoleCode) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Disposisi wajib punya tujuan — kepada orang atau kepada peran.',
      );
    }

    const fromId = await this.subjectIdOf(schema, user.userId);
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".surat_disposition
         (incoming_id, parent_id, from_user_subject_id, to_user_subject_id,
          to_role_code, instruction, due_date)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::date)
       RETURNING id::text`,
      [
        incomingId,
        input.parentId ?? null,
        fromId,
        input.toUserSubjectId ?? null,
        input.toRoleCode ?? null,
        input.instruction,
        input.dueDate ?? null,
      ],
    );

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".surat_incoming
          SET status = 'DIDISPOSISI', updated_at = now()
        WHERE id = $1 AND status = 'DITERIMA'`,
      [incomingId],
    );

    await this.audit.record({
      moduleCode: 'SURAT',
      actionCode: 'SURAT_MASUK_DIDISPOSISI',
      entityType: 'SuratIncoming',
      entityId: incomingId,
      documentNumber: surat.agenda_number,
      tenantSchema: schema,
      metadata: { dispositionId: rows[0].id, toRoleCode: input.toRoleCode ?? null },
    });

    return { id: rows[0].id };
  }

  // -- Surat keluar ---------------------------------------------------------

  /** Membuat konsep surat keluar. Belum bernomor — nomor menyusul setelah disetujui. */
  async draftOutgoing(
    schema: string,
    input: {
      classificationId: string;
      natureId?: string;
      recipientName: string;
      recipientAddress?: string;
      subject: string;
      body?: string;
      letterDate?: string;
      inReplyToIncomingId?: string;
      attachmentNote?: string;
    },
    user: AuthenticatedUser,
  ) {
    const klasifikasi = await this.classificationOf(schema, input.classificationId, 'OUT');

    // Jendela penerbitan diperiksa saat konsep dibuat, bukan saat diterbitkan:
    // menulis surat lengkap lalu ditolak pada langkah terakhir membuang
    // pekerjaan orang.
    const hariIni = new Date().toISOString().slice(0, 10);
    if (klasifikasi.issuable_from && hariIni < klasifikasi.issuable_from) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Surat jenis ${klasifikasi.code} baru dapat diterbitkan mulai ${klasifikasi.issuable_from}.`,
      );
    }
    if (klasifikasi.issuable_until && hariIni > klasifikasi.issuable_until) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Surat jenis ${klasifikasi.code} sudah tidak dapat diterbitkan sejak ${klasifikasi.issuable_until}.`,
      );
    }

    const subjectId = await this.subjectIdOf(schema, user.userId);
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".surat_outgoing
         (classification_id, nature_id, letterhead_id, approval_flow_id,
          recipient_name, recipient_address, subject, body, attachment_note,
          letter_date, in_reply_to_incoming_id, drafted_by_user_subject_id, status)
       VALUES ($1::uuid, COALESCE($2::uuid, $3::uuid), $4::uuid, $5::uuid, $6, $7, $8, $9, $10,
               $11::date, $12::uuid, $13::uuid, 'KONSEP')
       RETURNING id::text`,
      [
        input.classificationId,
        input.natureId ?? null,
        klasifikasi.nature_id,
        klasifikasi.letterhead_id,
        klasifikasi.approval_flow_id,
        input.recipientName,
        input.recipientAddress ?? null,
        input.subject || klasifikasi.default_subject,
        input.body ?? klasifikasi.template_body ?? null,
        input.attachmentNote ?? null,
        input.letterDate ?? null,
        input.inReplyToIncomingId ?? null,
        subjectId,
      ],
    );

    await this.audit.record({
      moduleCode: 'SURAT',
      actionCode: 'SURAT_KELUAR_DIKONSEP',
      entityType: 'SuratOutgoing',
      entityId: rows[0].id,
      tenantSchema: schema,
    });

    return { id: rows[0].id, status: 'KONSEP' as const };
  }

  /**
   * Mengajukan konsep untuk disetujui.
   *
   * Tidak menerima pelakunya sebagai argumen: sejak V10-5, siapa yang bertindak
   * dan dalam kapasitas apa dipungut sendiri oleh `AuditService` dari konteks
   * permintaan.
   */
  async submitOutgoing(schema: string, outgoingId: string) {
    const surat = await this.outgoingOf(schema, outgoingId);
    this.assertTransition(surat.status, 'DIAJUKAN');

    if (!surat.approval_flow_id) {
      // Tanpa alur, tidak ada yang perlu menyetujui — suratnya langsung siap
      // diterbitkan. Ini keadaan yang sah untuk surat rutin, dan dinyatakan
      // terang-terangan supaya tidak tampak sebagai alur yang terlewat.
      await this.setStatus(schema, outgoingId, 'DISETUJUI', null);
      await this.audit.record({
        moduleCode: 'SURAT',
        actionCode: 'SURAT_KELUAR_DISETUJUI',
        entityType: 'SuratOutgoing',
        entityId: outgoingId,
        tenantSchema: schema,
        reason: 'Klasifikasi ini tidak menuntut alur persetujuan.',
      });
      return { status: 'DISETUJUI' as const, currentStep: null, note: 'Tanpa alur persetujuan.' };
    }

    const langkah = await this.stepsOf(schema, surat.approval_flow_id);
    if (langkah.length === 0) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Alur persetujuan tidak memiliki satu pun langkah.',
      );
    }

    await this.setStatus(schema, outgoingId, 'DIAJUKAN', langkah[0].step_order);
    await this.openStep(schema, outgoingId, langkah[0]);

    await this.audit.record({
      moduleCode: 'SURAT',
      actionCode: 'SURAT_KELUAR_DIAJUKAN',
      entityType: 'SuratOutgoing',
      entityId: outgoingId,
      tenantSchema: schema,
      metadata: { totalSteps: langkah.length },
    });

    return { status: 'DIAJUKAN' as const, currentStep: langkah[0].step_order };
  }

  /** Memutuskan satu langkah persetujuan. */
  async decide(
    schema: string,
    outgoingId: string,
    input: {
      decision: 'DISETUJUI' | 'DITOLAK' | 'DIKEMBALIKAN' | 'DILEWATI';
      note?: string;
      finalize?: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const surat = await this.outgoingOf(schema, outgoingId);
    if (surat.status !== 'DIAJUKAN') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Surat berstatus ${surat.status} tidak sedang menunggu keputusan.`,
      );
    }
    if (
      (input.decision === 'DITOLAK' || input.decision === 'DIKEMBALIKAN') &&
      (input.note ?? '').trim().length < 5
    ) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Penolakan dan pengembalian wajib beralasan — tanpa keterangan, penyusunnya ' +
          'hanya dapat menebak apa yang harus diperbaiki.',
      );
    }

    const langkah = await this.stepsOf(schema, surat.approval_flow_id!);
    const flow = await this.flowOf(schema, surat.approval_flow_id!);
    const stepOrder = surat.current_step_order ?? langkah[0].step_order;
    const subjectId = await this.subjectIdOf(schema, user.userId);

    const hasil = statusAfterDecision({
      decision: input.decision,
      stepOrder,
      totalSteps: langkah.length,
      enforceAllSteps: flow.enforce_all_steps,
      finalize: input.finalize,
    });

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".surat_approval
          SET decision = $3, decided_by_user_subject_id = $4, decided_at = now(),
              decided_as_role_code = $5, note = $6, updated_at = now()
        WHERE outgoing_id = $1 AND step_order = $2 AND decision = 'MENUNGGU'`,
      [
        outgoingId,
        stepOrder,
        input.decision,
        subjectId,
        user.activeRoleCode ?? null,
        input.note ?? null,
      ],
    );

    await this.setStatus(schema, outgoingId, hasil.status, hasil.nextStep);

    if (hasil.nextStep) {
      const berikutnya = langkah.find((l) => l.step_order === hasil.nextStep);
      if (berikutnya) await this.openStep(schema, outgoingId, berikutnya);
    }

    await this.audit.record({
      moduleCode: 'SURAT',
      actionCode: `SURAT_KELUAR_${input.decision}`,
      entityType: 'SuratOutgoing',
      entityId: outgoingId,
      tenantSchema: schema,
      reason: input.note,
      metadata: { stepOrder, resultStatus: hasil.status, nextStep: hasil.nextStep },
    });

    return { status: hasil.status, currentStep: hasil.nextStep };
  }

  /**
   * Menerbitkan surat yang sudah disetujui — di sinilah nomor resmi diberikan.
   *
   * Nomor diambil SETELAH persetujuan, bukan saat konsep dibuat. Nomor yang
   * sudah keluar tidak dapat ditarik kembali, dan konsep yang batal akan
   * meninggalkan lubang pada penomoran yang tidak dapat dijelaskan saat diaudit.
   */
  async issue(schema: string, outgoingId: string, user: AuthenticatedUser) {
    const surat = await this.outgoingOf(schema, outgoingId);

    // Pemeriksaan idempotensi HARUS mendahului pemeriksaan perpindahan status.
    //
    // Surat yang sudah terbit berstatus DITERBITKAN, dan DITERBITKAN ->
    // DITERBITKAN bukan perpindahan yang sah. Diperiksa dengan urutan terbalik,
    // permintaan ulang akan ditolak alih-alih menjawab nomor yang sudah ada —
    // dan pemanggil yang koneksinya terputus tepat sebelum menerima jawaban
    // tidak punya cara mengetahui nomor suratnya sendiri.
    if (surat.letter_number) {
      return { letterNumber: surat.letter_number, alreadyIssued: true };
    }

    this.assertTransition(surat.status, 'DITERBITKAN');

    const klasifikasi = await this.classificationOf(schema, surat.classification_id, 'OUT');
    const alokasi = await this.numbers.allocate(schema, klasifikasi.number_scheme_id!, {
      classificationCode: klasifikasi.code,
    });

    const subjectId = await this.subjectIdOf(schema, user.userId);
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".surat_outgoing
          SET letter_number = $2, number_issued_at = now(), status = 'DITERBITKAN',
              current_step_order = NULL, signed_by_user_subject_id = $3,
              signed_at = now(), updated_at = now()
        WHERE id = $1`,
      [outgoingId, alokasi.number, subjectId],
    );

    await this.audit.record({
      moduleCode: 'SURAT',
      actionCode: 'SURAT_KELUAR_DITERBITKAN',
      entityType: 'SuratOutgoing',
      entityId: outgoingId,
      documentNumber: alokasi.number,
      tenantSchema: schema,
      metadata: { sequence: alokasi.sequence, periodKey: alokasi.periodKey },
    });

    return { letterNumber: alokasi.number, alreadyIssued: false };
  }

  /** Daftar surat keluar yang menunggu keputusan seseorang. */
  async pendingApprovals(schema: string, roleCode: string | undefined) {
    return this.tenantDb.query(
      schema,
      `SELECT o.id::text, o.subject, o.recipient_name, o.status, o.current_step_order,
              c.code AS classification_code, s.name AS step_name, s.role_code,
              a.due_at
         FROM "${schema}".surat_outgoing o
         JOIN "${schema}".surat_classification c ON c.id = o.classification_id
         LEFT JOIN "${schema}".surat_approval a
                ON a.outgoing_id = o.id AND a.step_order = o.current_step_order
               AND a.decision = 'MENUNGGU'
         LEFT JOIN "${schema}".surat_approval_flow_step s ON s.id = a.flow_step_id
        WHERE o.status = 'DIAJUKAN' AND o.deleted_at IS NULL
          AND ($1::varchar IS NULL OR s.role_code IS NULL OR s.role_code = $1)
        ORDER BY a.due_at NULLS LAST, o.created_at`,
      [roleCode ?? null],
    );
  }

  // -- Penolong -------------------------------------------------------------

  private assertTransition(from: string, to: SuratOutgoingStatus): void {
    const hasil = canTransition(from as SuratOutgoingStatus, to);
    if (!hasil.allowed) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, hasil.reason!);
    }
  }

  private async setStatus(
    schema: string,
    outgoingId: string,
    status: SuratOutgoingStatus,
    currentStep: number | null,
  ): Promise<void> {
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".surat_outgoing
          SET status = $2, current_step_order = $3, updated_at = now()
        WHERE id = $1`,
      [outgoingId, status, currentStep],
    );
  }

  /** Membuka satu langkah persetujuan beserta batas waktunya. */
  private async openStep(
    schema: string,
    outgoingId: string,
    step: { id: string; step_order: number; sla_hours: number | null },
  ): Promise<void> {
    await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".surat_approval
         (outgoing_id, flow_step_id, step_order, decision, due_at)
       VALUES ($1, $2, $3, 'MENUNGGU',
               CASE WHEN $4::int IS NULL THEN NULL ELSE now() + ($4 || ' hours')::interval END)
       ON CONFLICT DO NOTHING`,
      [outgoingId, step.id, step.step_order, step.sla_hours],
    );
  }

  private async nextAgendaNumber(schema: string): Promise<string> {
    // Nomor agenda tidak menuntut pola khusus — ia internal dan tidak pernah
    // keluar dari organisasi. Yang penting hanya keunikan dan keterurutannya.
    const tahun = new Date().getFullYear();
    const rows = await this.tenantDb.query<{ berikutnya: number }>(
      schema,
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(agenda_number, '^AG-\\d{4}-', ''), '')::int), 0) + 1
              AS berikutnya
         FROM "${schema}".surat_incoming
        WHERE agenda_number LIKE $1`,
      [`AG-${tahun}-%`],
    );
    return `AG-${tahun}-${String(rows[0].berikutnya).padStart(5, '0')}`;
  }

  private async subjectIdOf(schema: string, platformUserId: string): Promise<string | null> {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `SELECT id::text FROM "${schema}".user_subject
        WHERE platform_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [platformUserId],
    );
    return rows[0]?.id ?? null;
  }

  private async incomingOf(schema: string, id: string) {
    const rows = await this.tenantDb.query<{ id: string; status: string; agenda_number: string }>(
      schema,
      `SELECT id::text, status, agenda_number FROM "${schema}".surat_incoming
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Surat masuk tidak ditemukan.');
    return rows[0];
  }

  private async outgoingOf(schema: string, id: string) {
    const rows = await this.tenantDb.query<{
      id: string;
      status: string;
      letter_number: string | null;
      classification_id: string;
      approval_flow_id: string | null;
      current_step_order: number | null;
    }>(
      schema,
      `SELECT id::text, status, letter_number, classification_id::text,
              approval_flow_id::text, current_step_order
         FROM "${schema}".surat_outgoing
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Surat keluar tidak ditemukan.');
    return rows[0];
  }

  private async classificationOf(schema: string, id: string, direction: 'IN' | 'OUT') {
    const rows = await this.tenantDb.query<{
      id: string;
      code: string;
      direction: string;
      number_scheme_id: string | null;
      approval_flow_id: string | null;
      nature_id: string | null;
      letterhead_id: string | null;
      default_subject: string | null;
      template_body: string | null;
      issuable_from: string | null;
      issuable_until: string | null;
      is_active: boolean;
    }>(
      schema,
      `SELECT id::text, code, direction, number_scheme_id::text, approval_flow_id::text,
              nature_id::text, letterhead_id::text, default_subject, template_body,
              issuable_from::text, issuable_until::text, is_active
         FROM "${schema}".surat_classification
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (!row) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Klasifikasi surat tidak ditemukan.');
    if (row.direction !== direction) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Klasifikasi ${row.code} ditujukan untuk surat ${row.direction === 'IN' ? 'masuk' : 'keluar'}.`,
      );
    }
    if (!row.is_active) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Klasifikasi ${row.code} sudah tidak aktif.`,
      );
    }
    return row;
  }

  private async flowOf(schema: string, flowId: string) {
    const rows = await this.tenantDb.query<{ id: string; enforce_all_steps: boolean }>(
      schema,
      `SELECT id::text, enforce_all_steps FROM "${schema}".surat_approval_flow
        WHERE id = $1 AND deleted_at IS NULL`,
      [flowId],
    );
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alur persetujuan tidak ditemukan.');
    return rows[0];
  }

  private async stepsOf(schema: string, flowId: string) {
    return this.tenantDb.query<{
      id: string;
      step_order: number;
      name: string;
      role_code: string | null;
      sla_hours: number | null;
      is_skippable: boolean;
    }>(
      schema,
      `SELECT id::text, step_order, name, role_code, sla_hours, is_skippable
         FROM "${schema}".surat_approval_flow_step
        WHERE flow_id = $1 ORDER BY step_order`,
      [flowId],
    );
  }

  /** Melihat isi surat keluar beserta riwayat persetujuannya. */
  async outgoingDetail(schema: string, id: string) {
    const surat = await this.outgoingOf(schema, id);
    const approvals = await this.tenantDb.query(
      schema,
      `SELECT a.step_order, a.decision, a.decided_at, a.decided_as_role_code, a.note, a.due_at,
              s.name AS step_name, s.role_code, u.name AS decided_by
         FROM "${schema}".surat_approval a
         LEFT JOIN "${schema}".surat_approval_flow_step s ON s.id = a.flow_step_id
         LEFT JOIN "${schema}".user_subject u ON u.id = a.decided_by_user_subject_id
        WHERE a.outgoing_id = $1
        ORDER BY a.step_order, a.created_at`,
      [id],
    );
    return { ...surat, editable: isEditable(surat.status as SuratOutgoingStatus), approvals };
  }
}
