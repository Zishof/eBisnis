import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  BlockedDigitalKeyAdapter,
  type HospitalityDigitalKeyAdapter,
  type JenisKunci,
  transisiInapDiizinkan,
  validasiCheckin,
} from './hospitality-frontdesk';

export interface StayRow {
  id: string; reservation_id: string; room_stay_id: string; property_id: string; guest_id: string;
  room_id: string | null; status: 'PRE_ARRIVAL' | 'ASSIGNED' | 'IN_HOUSE' | 'CHECKED_OUT' | 'WALKED';
  eta: string | null; identity_verified: boolean; guarantee_confirmed: boolean;
  registration_card_signed: boolean; actual_checkin_at: string | null; actual_checkout_at: string | null;
  late_checkout_until: string | null; version: number;
}

const STAY_COLUMNS = `id::text,reservation_id::text,room_stay_id::text,property_id::text,guest_id::text,
 room_id::text,status,eta::text,identity_verified,guarantee_confirmed,registration_card_signed,
 actual_checkin_at::text,actual_checkout_at::text,late_checkout_until::text,version`;

@Injectable()
export class HospitalityFrontdeskService {
  private readonly digitalKey: HospitalityDigitalKeyAdapter;

  constructor(private readonly tenantDb: TenantConnectionService) {
    this.digitalKey = new BlockedDigitalKeyAdapter();
  }

  async board(schema: string, propertyId: string, businessDate?: string) {
    const S = `"${schema}"`;
    const date = businessDate ?? new Date().toISOString().slice(0, 10);
    return this.tenantDb.query(
      schema,
      `SELECT rrs.id::text AS room_stay_id,r.id::text AS reservation_id,r.code,r.status AS reservation_status,
              g.full_name,rrs.checkin_date::text,rrs.checkout_date::text,rrs.room_id::text,
              rm.nomor_kamar AS room_number,COALESCE(gs.status,'PRE_ARRIVAL') AS stay_status,gs.id::text AS stay_id,gs.eta::text
         FROM ${S}.hospitality_reservation_room_stay rrs
         JOIN ${S}.hospitality_reservation r ON r.id=rrs.reservation_id AND r.deleted_at IS NULL
         JOIN ${S}.hospitality_guest g ON g.id=COALESCE(rrs.guest_id,r.guest_id)
         LEFT JOIN ${S}.hospitality_guest_stay gs ON gs.room_stay_id=rrs.id
         LEFT JOIN ${S}.hospitality_room rm ON rm.id=rrs.room_id
        WHERE r.property_id=$1 AND rrs.deleted_at IS NULL
          AND (rrs.checkin_date=$2 OR rrs.checkout_date=$2 OR gs.status='IN_HOUSE')
        ORDER BY rrs.checkin_date,r.code`,
      [propertyId, date],
    );
  }

  async preArrival(schema: string, roomStayId: string, input: {
    eta?: string; transportNote?: string; preArrivalNote?: string; specialRequestNote?: string;
    digitalKeyEligible?: boolean;
  }, actor: string): Promise<StayRow> {
    const S = `"${schema}"`;
    return this.tenantDb.transaction(schema, async (client) => {
      const base = await this.lockRoomStay(client, S, roomStayId);
      if (base.reservation_status !== 'CONFIRMED') {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Hanya reservasi terkonfirmasi yang dapat dipersiapkan.');
      }
      const row = await client.query<StayRow>(
        `INSERT INTO ${S}.hospitality_guest_stay
          (reservation_id,room_stay_id,property_id,guest_id,room_id,eta,transport_note,pre_arrival_note,special_request_note,digital_key_eligible,created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
         ON CONFLICT (room_stay_id) DO UPDATE SET eta=EXCLUDED.eta,transport_note=EXCLUDED.transport_note,
          pre_arrival_note=EXCLUDED.pre_arrival_note,special_request_note=EXCLUDED.special_request_note,
          digital_key_eligible=EXCLUDED.digital_key_eligible,updated_at=now(),updated_by=EXCLUDED.updated_by,
          version=${S}.hospitality_guest_stay.version+1
         RETURNING ${STAY_COLUMNS}`,
        [base.reservation_id, roomStayId, base.property_id, base.guest_id, base.room_id,
          input.eta ?? null, clean(input.transportNote), clean(input.preArrivalNote), clean(input.specialRequestNote),
          input.digitalKeyEligible === true, actor],
      );
      return row.rows[0];
    });
  }

  async checkin(schema: string, roomStayId: string, input: {
    roomId: string; identityVerified: boolean; guaranteeConfirmed: boolean; registrationCardSigned: boolean;
    roomReady: boolean; keyType: JenisKunci; keyValidUntil: string; lateCheckoutUntil?: string;
  }, idempotencyKey: string | undefined, actor: string): Promise<{ stay: StayRow; replayed: boolean }> {
    if (!idempotencyKey) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Idempotency-Key wajib untuk check-in.');
    const S = `"${schema}"`;
    return this.tenantDb.transaction(schema, async (client) => {
      const replay = await client.query<StayRow>(`SELECT ${STAY_COLUMNS} FROM ${S}.hospitality_guest_stay WHERE checkin_idempotency_key=$1`, [idempotencyKey]);
      if (replay.rows[0]) return { stay: replay.rows[0], replayed: true };
      const base = await this.lockRoomStay(client, S, roomStayId);
      const errors = validasiCheckin({ ...input, adults: base.adults, children: base.children });
      if (errors.length) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Syarat check-in belum lengkap.', { errors });
      if (base.reservation_status !== 'CONFIRMED') throw AppError.conflict(ErrorCodes.CONFLICT, 'Reservasi belum terkonfirmasi.');
      const room = await client.query<{ id: string }>(
        `SELECT rm.id FROM ${S}.hospitality_room rm JOIN ${S}.hospitality_room_type rt ON rt.id=rm.room_type_id
          WHERE rm.id=$1 AND rm.room_type_id=$2 AND rt.property_id=$3 AND rm.status='AVAILABLE' AND rm.deleted_at IS NULL FOR UPDATE`,
        [input.roomId, base.room_type_id, base.property_id],
      );
      if (!room.rows[0]) throw AppError.conflict(ErrorCodes.CONFLICT, 'Kamar tidak tersedia atau tidak sesuai tipe reservasi.');
      const blocked = await client.query(
        `SELECT 1 FROM ${S}.hospitality_room_block WHERE room_id=$1 AND deleted_at IS NULL AND stay_date >= $2 AND stay_date < $3 LIMIT 1`,
        [input.roomId, base.checkin_date, base.checkout_date],
      );
      if (blocked.rows[0]) throw AppError.conflict(ErrorCodes.CONFLICT, 'Kamar diblokir pada rentang masa inap.');
      const current = await client.query<StayRow>(`SELECT ${STAY_COLUMNS} FROM ${S}.hospitality_guest_stay WHERE room_stay_id=$1 FOR UPDATE`, [roomStayId]);
      if (current.rows[0] && !transisiInapDiizinkan(current.rows[0].status, 'IN_HOUSE')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Stay berstatus ${current.rows[0].status} tidak dapat check-in.`);
      }
      let externalReference: string | null = null;
      let keyStatus = 'ACTIVE';
      if (input.keyType === 'DIGITAL') {
        const result = await this.digitalKey.grant({ stayId: current.rows[0]?.id ?? roomStayId, roomId: input.roomId,
          validFrom: new Date().toISOString(), validUntil: input.keyValidUntil, idempotencyKey });
        externalReference = result.externalReference ?? null;
        keyStatus = result.granted ? 'ACTIVE' : 'FAILED';
        if (!result.granted) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Digital key belum tersedia: kontrak provider belum dikonfigurasi.');
      }
      const stayResult = await client.query<StayRow>(
        `INSERT INTO ${S}.hospitality_guest_stay
          (reservation_id,room_stay_id,property_id,guest_id,room_id,status,identity_verified,guarantee_confirmed,
           registration_card_signed,actual_checkin_at,late_checkout_until,checkin_idempotency_key,created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,'IN_HOUSE',TRUE,TRUE,TRUE,now(),$6,$7,$8,$8)
         ON CONFLICT (room_stay_id) DO UPDATE SET room_id=EXCLUDED.room_id,status='IN_HOUSE',identity_verified=TRUE,
          guarantee_confirmed=TRUE,registration_card_signed=TRUE,actual_checkin_at=COALESCE(${S}.hospitality_guest_stay.actual_checkin_at,now()),
          late_checkout_until=EXCLUDED.late_checkout_until,checkin_idempotency_key=EXCLUDED.checkin_idempotency_key,
          updated_at=now(),updated_by=EXCLUDED.updated_by,version=${S}.hospitality_guest_stay.version+1
         RETURNING ${STAY_COLUMNS}`,
        [base.reservation_id, roomStayId, base.property_id, base.guest_id, input.roomId,
          input.lateCheckoutUntil ?? null, idempotencyKey, actor],
      );
      const stay = stayResult.rows[0];
      await client.query(`UPDATE ${S}.hospitality_reservation_room_stay SET room_id=$2,updated_at=now(),updated_by=$3,version=version+1 WHERE id=$1`, [roomStayId, input.roomId, actor]);
      await client.query(
        `INSERT INTO ${S}.hospitality_key_issuance(stay_id,room_id,key_type,provider_key,external_reference,status,valid_until,idempotency_key,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [stay.id, input.roomId, input.keyType, input.keyType === 'DIGITAL' ? this.digitalKey.key : null,
          externalReference, keyStatus, input.keyValidUntil, `${idempotencyKey}:key`, actor],
      );
      return { stay, replayed: false };
    });
  }

  async moveRoom(schema: string, stayId: string, input: { toRoomId: string; reason: string; keyType: JenisKunci; keyValidUntil: string }, idempotencyKey: string | undefined, actor: string) {
    if (!idempotencyKey || !clean(input.reason)) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Idempotency-Key dan alasan room move wajib.');
    const S = `"${schema}"`;
    return this.tenantDb.transaction(schema, async (client) => {
      const replay = await client.query(`SELECT * FROM ${S}.hospitality_room_move WHERE idempotency_key=$1`, [idempotencyKey]);
      if (replay.rows[0]) return { move: replay.rows[0], replayed: true };
      const stay = await client.query<StayRow & { room_type_id: string; checkout_date: string }>(
        `SELECT ${STAY_COLUMNS},rrs.room_type_id::text,rrs.checkout_date::text FROM ${S}.hospitality_guest_stay gs
         JOIN ${S}.hospitality_reservation_room_stay rrs ON rrs.id=gs.room_stay_id WHERE gs.id=$1 FOR UPDATE`, [stayId]);
      const s = stay.rows[0];
      if (!s || s.status !== 'IN_HOUSE' || !s.room_id) throw AppError.conflict(ErrorCodes.CONFLICT, 'Hanya tamu in-house yang dapat dipindahkan.');
      const target = await client.query(`SELECT id FROM ${S}.hospitality_room WHERE id=$1 AND room_type_id=$2 AND status='AVAILABLE' AND deleted_at IS NULL FOR UPDATE`, [input.toRoomId, s.room_type_id]);
      if (!target.rows[0]) throw AppError.conflict(ErrorCodes.CONFLICT, 'Kamar tujuan tidak tersedia atau berbeda tipe.');
      const blocked = await client.query(`SELECT 1 FROM ${S}.hospitality_room_block WHERE room_id=$1 AND deleted_at IS NULL AND stay_date >= CURRENT_DATE AND stay_date < $2 LIMIT 1`, [input.toRoomId, s.checkout_date]);
      if (blocked.rows[0]) throw AppError.conflict(ErrorCodes.CONFLICT, 'Kamar tujuan diblokir pada sisa masa inap.');
      if (input.keyType === 'DIGITAL') {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Digital key belum tersedia: kontrak provider belum dikonfigurasi.');
      }
      const inserted = await client.query(
        `INSERT INTO ${S}.hospitality_room_move(stay_id,from_room_id,to_room_id,reason,moved_by,idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id::text,stay_id::text,from_room_id::text,to_room_id::text,reason,moved_at::text`,
        [stayId, s.room_id, input.toRoomId, clean(input.reason), actor, idempotencyKey],
      );
      await client.query(`UPDATE ${S}.hospitality_guest_stay SET room_id=$2,updated_at=now(),updated_by=$3,version=version+1 WHERE id=$1`, [stayId, input.toRoomId, actor]);
      await client.query(`UPDATE ${S}.hospitality_reservation_room_stay SET room_id=$2,updated_at=now(),updated_by=$3,version=version+1 WHERE id=$1`, [s.room_stay_id, input.toRoomId, actor]);
      await client.query(`UPDATE ${S}.hospitality_key_issuance SET status='REVOKED',revoked_at=now() WHERE stay_id=$1 AND status='ACTIVE'`, [stayId]);
      await client.query(
        `INSERT INTO ${S}.hospitality_key_issuance(stay_id,room_id,key_type,status,valid_until,idempotency_key,created_by)
         VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6)`,
        [stayId, input.toRoomId, input.keyType, input.keyValidUntil, `${idempotencyKey}:replacement-key`, actor],
      );
      return { move: inserted.rows[0], replayed: false };
    });
  }

  async changeStayDates(schema: string, stayId: string, input: { checkinDate: string; checkoutDate: string; lateCheckoutUntil?: string }, actor: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.checkinDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.checkoutDate) || input.checkoutDate <= input.checkinDate)
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Rentang tanggal tidak sah.');
    const S = `"${schema}"`;
    const rows = await this.tenantDb.query<StayRow>(schema,
      `UPDATE ${S}.hospitality_reservation_room_stay rrs SET checkin_date=$2,checkout_date=$3,updated_at=now(),updated_by=$4,version=version+1
       FROM ${S}.hospitality_guest_stay gs WHERE gs.id=$1 AND gs.room_stay_id=rrs.id AND gs.status IN ('PRE_ARRIVAL','ASSIGNED','IN_HOUSE')
       RETURNING gs.id::text,gs.reservation_id::text,gs.room_stay_id::text,gs.property_id::text,gs.guest_id::text,gs.room_id::text,gs.status,
        gs.eta::text,gs.identity_verified,gs.guarantee_confirmed,gs.registration_card_signed,gs.actual_checkin_at::text,gs.actual_checkout_at::text,gs.late_checkout_until::text,gs.version`,
      [stayId, input.checkinDate, input.checkoutDate, actor]);
    if (!rows[0]) throw AppError.conflict(ErrorCodes.CONFLICT, 'Masa inap tidak dapat diubah pada status saat ini.');
    if (input.lateCheckoutUntil) await this.tenantDb.query(schema, `UPDATE ${S}.hospitality_guest_stay SET late_checkout_until=$2,updated_by=$3,updated_at=now(),version=version+1 WHERE id=$1`, [stayId, input.lateCheckoutUntil, actor]);
    return rows[0];
  }

  async checkout(schema: string, stayId: string, input: { forwardingPreference?: string }, idempotencyKey: string | undefined, actor: string) {
    if (!idempotencyKey) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Idempotency-Key wajib untuk check-out.');
    const S = `"${schema}"`;
    return this.tenantDb.transaction(schema, async (client) => {
      const replay = await client.query<StayRow>(`SELECT ${STAY_COLUMNS} FROM ${S}.hospitality_guest_stay WHERE checkout_idempotency_key=$1`, [idempotencyKey]);
      if (replay.rows[0]) return { stay: replay.rows[0], replayed: true };
      const existing = await client.query<StayRow>(`SELECT ${STAY_COLUMNS} FROM ${S}.hospitality_guest_stay WHERE id=$1 FOR UPDATE`, [stayId]);
      if (!existing.rows[0] || !transisiInapDiizinkan(existing.rows[0].status, 'CHECKED_OUT')) throw AppError.conflict(ErrorCodes.CONFLICT, 'Hanya tamu in-house yang dapat check-out.');
      const updated = await client.query<StayRow>(
        `UPDATE ${S}.hospitality_guest_stay SET status='CHECKED_OUT',actual_checkout_at=now(),forwarding_preference=$2,
          checkout_idempotency_key=$3,updated_at=now(),updated_by=$4,version=version+1 WHERE id=$1 RETURNING ${STAY_COLUMNS}`,
        [stayId, clean(input.forwardingPreference), idempotencyKey, actor]);
      await client.query(`UPDATE ${S}.hospitality_key_issuance SET status='REVOKED',revoked_at=now() WHERE stay_id=$1 AND status='ACTIVE'`, [stayId]);
      return { stay: updated.rows[0], replayed: false };
    });
  }

  async handover(schema: string, input: { propertyId: string; shiftCode: string; notes: string; unresolvedItems?: unknown[] }, actor: string) {
    if (!clean(input.shiftCode) || !clean(input.notes)) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Shift dan catatan handover wajib.');
    const S = `"${schema}"`;
    const rows = await this.tenantDb.query(schema,
      `INSERT INTO ${S}.hospitality_frontdesk_handover(property_id,shift_code,notes,unresolved_items,handed_over_by)
       VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING id::text,property_id::text,shift_code,notes,unresolved_items,handed_over_at::text`,
      [input.propertyId, clean(input.shiftCode), clean(input.notes), JSON.stringify(input.unresolvedItems ?? []), actor]);
    return rows[0];
  }

  private async lockRoomStay(client: PoolClient, S: string, id: string) {
    const result = await client.query<{
      id: string; reservation_id: string; property_id: string; guest_id: string; room_id: string | null;
      room_type_id: string; checkin_date: string; checkout_date: string; adults: number; children: number; reservation_status: string;
    }>(`SELECT rrs.id::text,rrs.reservation_id::text,r.property_id::text,COALESCE(rrs.guest_id,r.guest_id)::text AS guest_id,
      rrs.room_id::text,rrs.room_type_id::text,rrs.checkin_date::text,rrs.checkout_date::text,rrs.adults,rrs.children,r.status AS reservation_status
      FROM ${S}.hospitality_reservation_room_stay rrs JOIN ${S}.hospitality_reservation r ON r.id=rrs.reservation_id
      WHERE rrs.id=$1 AND rrs.deleted_at IS NULL AND r.deleted_at IS NULL FOR UPDATE OF rrs`, [id]);
    if (!result.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Room stay reservasi tidak ditemukan.');
    return result.rows[0];
  }
}

function clean(value?: string): string | null { const v = value?.trim(); return v ? v : null; }
