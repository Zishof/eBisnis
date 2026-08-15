import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';

type Input = Record<string, unknown>;

@Injectable()
export class HospitalityGoLiveService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async readiness(schemaName: string, propertyId: string) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<Record<string, string | number>>(schemaName, `
      SELECT
        (SELECT count(*)::int FROM ${S}.hospitality_building WHERE property_id=$1 AND deleted_at IS NULL) AS buildings,
        (SELECT count(*)::int FROM ${S}.hospitality_sellable_space WHERE property_id=$1 AND deleted_at IS NULL) AS sellable_spaces,
        (SELECT count(*)::int FROM ${S}.hospitality_inventory_ledger WHERE property_id=$1) AS inventory_days,
        (SELECT count(*)::int FROM ${S}.hospitality_waitlist WHERE property_id=$1 AND status IN ('WAITING','OFFERED')) AS waitlist_open,
        (SELECT count(*)::int FROM ${S}.hospitality_revenue_recommendation WHERE property_id=$1 AND status='PENDING_REVIEW') AS revenue_pending,
        (SELECT count(*)::int FROM ${S}.hospitality_distribution_job WHERE property_id=$1 AND status IN ('PENDING','RETRY')) AS channel_pending,
        (SELECT count(*)::int FROM ${S}.hospitality_channel_reconciliation_exception WHERE property_id=$1 AND status='OPEN') AS channel_exceptions,
        (SELECT count(*)::int FROM ${S}.hospitality_site_content WHERE status='PUBLISHED' AND deleted_at IS NULL) AS published_content
      WHERE EXISTS (SELECT 1 FROM ${S}.hospitality_property WHERE id=$1 AND deleted_at IS NULL)
    `, [propertyId]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    return rows[0];
  }

  listContent(schemaName: string) {
    const S = `"${schemaName}"`;
    return this.tenantDb.query(schemaName, `SELECT id::text,content_type,slug,title,summary,body_json,seo_json,status,published_at,version,updated_at
      FROM ${S}.hospitality_site_content WHERE deleted_at IS NULL ORDER BY content_type,slug`);
  }

  async saveContent(schemaName: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const type = required(input.contentType, 'contentType').toUpperCase();
    if (!['PAGE','ARTICLE','GALLERY','MENU','FAQ'].includes(type)) invalid('contentType tidak valid.');
    const slug = required(input.slug, 'slug').toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) invalid('slug tidak valid.');
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_site_content(content_type,slug,title,summary,body_json,seo_json,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$7)
      ON CONFLICT(content_type,slug) WHERE deleted_at IS NULL DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,
        body_json=EXCLUDED.body_json,seo_json=EXCLUDED.seo_json,status=CASE WHEN ${S}.hospitality_site_content.status='PUBLISHED' THEN 'REVIEW' ELSE ${S}.hospitality_site_content.status END,
        updated_at=now(),updated_by=EXCLUDED.updated_by,version=${S}.hospitality_site_content.version+1
      RETURNING id::text,content_type,slug,title,summary,body_json,seo_json,status,published_at,version
    `, [type, slug, required(input.title, 'title'), stringOrNull(input.summary), JSON.stringify(objectValue(input.body)), JSON.stringify(objectValue(input.seo)), actorId]);
    return rows[0];
  }

  async publishContent(schemaName: string, id: string, actorId: string) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `UPDATE ${S}.hospitality_site_content SET status='PUBLISHED',published_at=now(),updated_at=now(),updated_by=$2,version=version+1
      WHERE id=$1 AND deleted_at IS NULL RETURNING id::text,content_type,slug,title,status,published_at,version`, [id, actorId]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Konten tidak ditemukan.');
    return rows[0];
  }

  async setActiveContext(schemaName: string, userId: string, propertyId: string, roleCode: string) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_active_context(user_id, property_id, role_code, business_date, timezone)
      SELECT $1,id,$3,business_date,timezone FROM ${S}.hospitality_property
       WHERE id=$2 AND status='ACTIVE' AND deleted_at IS NULL
      ON CONFLICT(user_id) DO UPDATE SET property_id=EXCLUDED.property_id, role_code=EXCLUDED.role_code,
        business_date=EXCLUDED.business_date, timezone=EXCLUDED.timezone, updated_at=now()
      RETURNING user_id::text, property_id::text, role_code, business_date::text, timezone, updated_at
    `, [userId, propertyId, required(roleCode, 'roleCode')]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti aktif tidak ditemukan.');
    return rows[0];
  }

  async createBuilding(schemaName: string, propertyId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_building(property_id,code,name,created_by,updated_by)
      SELECT id,$2,$3,$4,$4 FROM ${S}.hospitality_property WHERE id=$1 AND deleted_at IS NULL
      RETURNING id::text,property_id::text,code,name,status,version
    `, [propertyId, required(input.code, 'code'), required(input.name, 'name'), actorId]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    return rows[0];
  }

  async createFloor(schemaName: string, buildingId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_floor(building_id,code,name,sort_order,created_by,updated_by)
      SELECT id,$2,$3,$4,$5,$5 FROM ${S}.hospitality_building WHERE id=$1 AND deleted_at IS NULL
      RETURNING id::text,building_id::text,code,name,sort_order,version
    `, [buildingId, required(input.code, 'code'), required(input.name, 'name'), integer(input.sortOrder, 0), actorId]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gedung tidak ditemukan.');
    return rows[0];
  }

  async createZone(schemaName: string, propertyId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_zone(property_id,building_id,floor_id,code,name,zone_type,created_by,updated_by)
      SELECT p.id,$2::uuid,$3::uuid,$4,$5,$6,$7,$7 FROM ${S}.hospitality_property p
       WHERE p.id=$1 AND p.deleted_at IS NULL
         AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM ${S}.hospitality_building b WHERE b.id=$2 AND b.property_id=p.id AND b.deleted_at IS NULL))
         AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM ${S}.hospitality_floor f JOIN ${S}.hospitality_building b ON b.id=f.building_id WHERE f.id=$3 AND b.property_id=p.id AND f.deleted_at IS NULL))
      RETURNING id::text,property_id::text,building_id::text,floor_id::text,code,name,zone_type,version
    `, [propertyId, optionalUuid(input.buildingId), optionalUuid(input.floorId), required(input.code, 'code'), required(input.name, 'name'), stringValue(input.zoneType, 'GUEST_ROOM'), actorId]);
    if (!rows[0]) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Properti, gedung, atau lantai tidak konsisten.');
    return rows[0];
  }

  async createSellableSpace(schemaName: string, propertyId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const type = stringValue(input.spaceType, 'ROOM').toUpperCase();
    if (!['ROOM', 'UNIT', 'BED', 'SPACE'].includes(type)) invalid('spaceType tidak valid.');
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_sellable_space(property_id,room_id,parent_space_id,code,name,space_type,capacity,features,created_by,updated_by)
      SELECT p.id,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::jsonb,$9,$9 FROM ${S}.hospitality_property p
       WHERE p.id=$1 AND p.deleted_at IS NULL
         AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM ${S}.hospitality_room r WHERE r.id=$2 AND r.property_id=p.id AND r.deleted_at IS NULL))
         AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM ${S}.hospitality_sellable_space s WHERE s.id=$3 AND s.property_id=p.id AND s.deleted_at IS NULL))
      RETURNING id::text,property_id::text,room_id::text,parent_space_id::text,code,name,space_type,capacity,status,features,version
    `, [propertyId, optionalUuid(input.roomId), optionalUuid(input.parentSpaceId), required(input.code, 'code'), required(input.name, 'name'), type, positive(input.capacity, 1), JSON.stringify(arrayValue(input.features)), actorId]);
    if (!rows[0]) invalid('Properti, kamar, atau ruang induk tidak konsisten.');
    return rows[0];
  }

  async reconcileInventory(schemaName: string, propertyId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const roomTypeId = required(input.roomTypeId, 'roomTypeId');
    const start = isoDate(input.startDate, 'startDate');
    const end = isoDate(input.endDate, 'endDate');
    if (end <= start) invalid('endDate harus setelah startDate.');
    return this.tenantDb.transaction(schemaName, async (client) => {
      await client.query(`SELECT id FROM ${S}.hospitality_room_type WHERE id=$1 AND property_id=$2 AND deleted_at IS NULL FOR UPDATE`, [roomTypeId, propertyId]);
      const result = await client.query(`
        INSERT INTO ${S}.hospitality_inventory_ledger(property_id,room_type_id,stay_date,physical_capacity,out_of_inventory,sold,held,allotted,overbooking_limit,updated_by,reconciled_at)
        SELECT $1,$2,d::date,
          (SELECT count(*)::int FROM ${S}.hospitality_room WHERE property_id=$1 AND room_type_id=$2 AND deleted_at IS NULL),
          (SELECT count(DISTINCT rb.room_id)::int FROM ${S}.hospitality_room_block rb JOIN ${S}.hospitality_room r ON r.id=rb.room_id WHERE r.room_type_id=$2 AND rb.stay_date=d::date AND rb.deleted_at IS NULL),
          (SELECT count(*)::int FROM ${S}.hospitality_reservation_room_stay rs JOIN ${S}.hospitality_reservation r ON r.id=rs.reservation_id WHERE rs.room_type_id=$2 AND r.status IN ('HOLD','CONFIRMED','IN_HOUSE') AND rs.checkin_date<=d::date AND rs.checkout_date>d::date AND r.deleted_at IS NULL),
          0,
          COALESCE((SELECT sum(a.quantity-a.pickup)::int FROM ${S}.hospitality_allotment a WHERE a.room_type_id=$2 AND a.status='ACTIVE' AND a.start_date<=d::date AND a.end_date>d::date),0),
          COALESCE((SELECT overbooking_limit FROM ${S}.hospitality_room_type WHERE id=$2),0),$5,now()
        FROM generate_series($3::date, $4::date - 1, interval '1 day') d
        ON CONFLICT(room_type_id,stay_date) DO UPDATE SET
          physical_capacity=EXCLUDED.physical_capacity,out_of_inventory=EXCLUDED.out_of_inventory,sold=EXCLUDED.sold,
          allotted=EXCLUDED.allotted,overbooking_limit=EXCLUDED.overbooking_limit,reconciled_at=now(),updated_at=now(),updated_by=EXCLUDED.updated_by,
          version=${S}.hospitality_inventory_ledger.version+1
        RETURNING stay_date::text,physical_capacity,out_of_inventory,sold,held,allotted,overbooking_limit,
          greatest(0,physical_capacity-out_of_inventory-sold-held-allotted+overbooking_limit) AS available,version
      `, [propertyId, roomTypeId, start, end, actorId]);
      if (!result.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tipe kamar tidak ditemukan pada properti.');
      return result.rows;
    });
  }

  async createAllotment(schemaName: string, propertyId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const start = isoDate(input.startDate, 'startDate');
    const end = isoDate(input.endDate, 'endDate');
    if (end <= start) invalid('endDate harus setelah startDate.');
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_allotment(property_id,room_type_id,business_account_id,code,start_date,end_date,quantity,release_days,created_by,updated_by)
      SELECT p.id,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$9 FROM ${S}.hospitality_property p
       WHERE p.id=$1 AND p.deleted_at IS NULL
         AND EXISTS(SELECT 1 FROM ${S}.hospitality_room_type rt WHERE rt.id=$2 AND rt.property_id=p.id AND rt.deleted_at IS NULL)
      RETURNING id::text,property_id::text,room_type_id::text,business_account_id::text,code,start_date::text,end_date::text,quantity,pickup,release_days,status,version
    `, [propertyId, required(input.roomTypeId, 'roomTypeId'), optionalUuid(input.businessAccountId), required(input.code, 'code'), start, end, positive(input.quantity, 1), integer(input.releaseDays, 0), actorId]);
    if (!rows[0]) invalid('Properti atau tipe kamar tidak ditemukan.');
    return rows[0];
  }

  async linkGuest(schemaName: string, guestId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_guest_relationship(guest_id,related_guest_id,relationship_type,is_companion,created_by)
      SELECT g.id,r.id,$3,$4,$5 FROM ${S}.hospitality_guest g CROSS JOIN ${S}.hospitality_guest r
       WHERE g.id=$1 AND r.id=$2 AND g.deleted_at IS NULL AND r.deleted_at IS NULL
      ON CONFLICT(guest_id,related_guest_id,relationship_type) DO UPDATE SET is_companion=EXCLUDED.is_companion
      RETURNING id::text,guest_id::text,related_guest_id::text,relationship_type,is_companion,created_at
    `, [guestId, required(input.relatedGuestId, 'relatedGuestId'), required(input.relationshipType, 'relationshipType'), Boolean(input.isCompanion), actorId]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tamu terkait tidak ditemukan.');
    return rows[0];
  }

  async addLoyalty(schemaName: string, guestId: string, input: Input) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_guest_loyalty(guest_id,program_code,member_number,tier_code,points_balance)
      SELECT id,$2,$3,$4,$5 FROM ${S}.hospitality_guest WHERE id=$1 AND deleted_at IS NULL
      ON CONFLICT(program_code,member_number) DO UPDATE SET tier_code=EXCLUDED.tier_code,points_balance=EXCLUDED.points_balance,updated_at=now(),version=${S}.hospitality_guest_loyalty.version+1
      RETURNING id::text,guest_id::text,program_code,member_number,tier_code,points_balance::text,status,version
    `, [guestId, required(input.programCode, 'programCode'), required(input.memberNumber, 'memberNumber'), stringOrNull(input.tierCode), money(input.pointsBalance ?? 0, 'pointsBalance')]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tamu tidak ditemukan.');
    return rows[0];
  }

  async createQuote(schemaName: string, propertyId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const checkin = isoDate(input.checkinDate, 'checkinDate');
    const checkout = isoDate(input.checkoutDate, 'checkoutDate');
    if (checkout <= checkin) invalid('Tanggal check-out harus setelah check-in.');
    const quoteNumber = `Q-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_availability_quote(property_id,quote_number,checkin_date,checkout_date,currency,total_amount,price_snapshot,restriction_snapshot,availability_snapshot,guest_json,expires_at,created_by)
      SELECT id,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,now()+($11::int*interval '1 minute'),$12
      FROM ${S}.hospitality_property WHERE id=$1 AND deleted_at IS NULL
      RETURNING id::text,property_id::text,quote_number,checkin_date::text,checkout_date::text,currency,total_amount::text,status,expires_at,version
    `, [propertyId, quoteNumber, checkin, checkout, stringValue(input.currency, 'IDR').toUpperCase(), money(input.totalAmount, 'totalAmount'), JSON.stringify(objectValue(input.priceSnapshot)), JSON.stringify(objectValue(input.restrictionSnapshot)), JSON.stringify(objectValue(input.availabilitySnapshot)), JSON.stringify(objectValue(input.guest)), Math.min(Math.max(integer(input.expiresInMinutes, 30), 5), 1440), actorId]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    return rows[0];
  }

  async createWaitlist(schemaName: string, propertyId: string, input: Input, actorId: string) {
    const S = `"${schemaName}"`;
    const checkin = isoDate(input.checkinDate, 'checkinDate');
    const checkout = isoDate(input.checkoutDate, 'checkoutDate');
    if (checkout <= checkin) invalid('Tanggal check-out harus setelah check-in.');
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_waitlist(property_id,room_type_id,guest_id,checkin_date,checkout_date,adults,children,priority,contact_json,created_by,updated_by)
      SELECT id,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::jsonb,$10,$10 FROM ${S}.hospitality_property WHERE id=$1 AND deleted_at IS NULL
      RETURNING id::text,property_id::text,room_type_id::text,guest_id::text,checkin_date::text,checkout_date::text,adults,children,priority,status,version
    `, [propertyId, optionalUuid(input.roomTypeId), optionalUuid(input.guestId), checkin, checkout, positive(input.adults, 1), integer(input.children, 0), integer(input.priority, 100), JSON.stringify(objectValue(input.contact)), actorId]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    return rows[0];
  }

  async createPaymentIntent(schemaName: string, propertyId: string, input: Input) {
    const S = `"${schemaName}"`;
    const provider = required(input.providerKey, 'providerKey').toUpperCase();
    const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey');
    const amount = money(input.amount, 'amount');
    const requestHash = hash({ propertyId, reservationId: input.reservationId ?? null, amount, currency: input.currency ?? 'IDR', provider });
    const status = provider === 'TEST' ? 'PENDING' : 'BLOCKED_PROVIDER_INPUT';
    const rows = await this.tenantDb.query<ArrayRecord>(schemaName, `
      INSERT INTO ${S}.hospitality_booking_payment_intent(property_id,reservation_id,idempotency_key,request_hash,provider_key,provider_secret_alias,amount,currency,status,client_token_reference,expires_at)
      SELECT id,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '30 minutes' FROM ${S}.hospitality_property WHERE id=$1 AND deleted_at IS NULL
      ON CONFLICT(property_id,idempotency_key) DO UPDATE SET updated_at=${S}.hospitality_booking_payment_intent.updated_at
      RETURNING id::text,request_hash,provider_key,amount::text,currency,status,provider_reference,client_token_reference,expires_at
    `, [propertyId, optionalUuid(input.reservationId), idempotencyKey, requestHash, provider, stringOrNull(input.providerSecretAlias), amount, stringValue(input.currency, 'IDR').toUpperCase(), status, stringOrNull(input.clientTokenReference)]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    if (rows[0].request_hash !== requestHash) throw AppError.conflict(ErrorCodes.CONFLICT, 'Idempotency key sudah dipakai dengan permintaan berbeda.');
    return rows[0];
  }

  async saveRecovery(schemaName: string, propertyId: string, input: Input) {
    const S = `"${schemaName}"`;
    const token = randomBytes(32).toString('base64url');
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_booking_recovery(property_id,recovery_token_hash,booking_state,consented,expires_at)
      SELECT id,$2,$3::jsonb,$4,now()+interval '24 hours' FROM ${S}.hospitality_property WHERE id=$1 AND deleted_at IS NULL
      RETURNING id::text,status,expires_at
    `, [propertyId, hash(token), JSON.stringify(objectValue(input.bookingState)), Boolean(input.consented)]);
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    return { ...rows[0], recoveryToken: token };
  }

  async generateForecast(schemaName: string, propertyId: string, startDate: string, days: number) {
    const S = `"${schemaName}"`;
    const start = isoDate(startDate, 'startDate');
    const horizon = Math.min(Math.max(days, 1), 365);
    return this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_revenue_forecast(property_id,stay_date,room_type_id,on_books,pickup_7d,pickup_30d,forecast_rooms,forecast_revenue,model_version,evidence_json)
      SELECT $1,d::date,rt.id,
        count(rs.id)::int,
        count(rs.id) FILTER (WHERE r.created_at>=now()-interval '7 days')::int,
        count(rs.id) FILTER (WHERE r.created_at>=now()-interval '30 days')::int,
        count(rs.id)::numeric + (count(rs.id) FILTER (WHERE r.created_at>=now()-interval '7 days')::numeric * 0.5),
        COALESCE(sum((rs.rate_snapshot->>'total')::numeric),0),
        'PACE_V1',jsonb_build_object('generatedFrom','reservation_room_stay','asOf',now(),'horizonDays',$3)
      FROM generate_series($2::date,$2::date+($3-1),interval '1 day') d
      CROSS JOIN ${S}.hospitality_room_type rt
      LEFT JOIN ${S}.hospitality_reservation_room_stay rs ON rs.room_type_id=rt.id AND rs.checkin_date<=d::date AND rs.checkout_date>d::date
      LEFT JOIN ${S}.hospitality_reservation r ON r.id=rs.reservation_id AND r.status IN ('HOLD','CONFIRMED','IN_HOUSE') AND r.deleted_at IS NULL
      WHERE rt.property_id=$1 AND rt.deleted_at IS NULL
      GROUP BY d,rt.id
      ON CONFLICT(property_id,room_type_id,stay_date,model_version) DO UPDATE SET on_books=EXCLUDED.on_books,pickup_7d=EXCLUDED.pickup_7d,
        pickup_30d=EXCLUDED.pickup_30d,forecast_rooms=EXCLUDED.forecast_rooms,forecast_revenue=EXCLUDED.forecast_revenue,
        evidence_json=EXCLUDED.evidence_json,generated_at=now()
      RETURNING id::text,stay_date::text,room_type_id::text,on_books,pickup_7d,pickup_30d,forecast_rooms::text,forecast_revenue::text,model_version
    `, [propertyId, start, horizon]);
  }

  async createRecommendation(schemaName: string, propertyId: string, input: Input) {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `
      INSERT INTO ${S}.hospitality_revenue_recommendation(property_id,rate_plan_id,stay_date,current_amount,recommended_amount,reason_json)
      SELECT rt.property_id,rp.id,$3,$4,$5,$6::jsonb FROM ${S}.hospitality_rate_plan rp
      JOIN ${S}.hospitality_room_type rt ON rt.id=rp.room_type_id
      WHERE rp.id=$2 AND rt.property_id=$1 AND rp.deleted_at IS NULL AND rt.deleted_at IS NULL
      RETURNING id::text,property_id::text,rate_plan_id::text,stay_date::text,current_amount::text,recommended_amount::text,reason_json,status,version
    `, [propertyId, required(input.ratePlanId, 'ratePlanId'), isoDate(input.stayDate, 'stayDate'), money(input.currentAmount, 'currentAmount'), money(input.recommendedAmount, 'recommendedAmount'), JSON.stringify(objectValue(input.reason))]);
    if (!rows[0]) invalid('Rate plan tidak ditemukan pada properti.');
    return rows[0];
  }

  async publishRecommendation(schemaName: string, id: string, actorId: string) {
    const S = `"${schemaName}"`;
    return this.tenantDb.transaction(schemaName, async (client) => {
      const rec = await client.query<ArrayRecord>(`SELECT * FROM ${S}.hospitality_revenue_recommendation WHERE id=$1 AND status='APPROVED' FOR UPDATE`, [id]);
      if (!rec.rows[0]) throw AppError.conflict(ErrorCodes.CONFLICT, 'Rekomendasi harus disetujui sebelum diterbitkan.');
      const row = rec.rows[0];
      await client.query(`INSERT INTO ${S}.hospitality_rate_calendar(rate_plan_id,stay_date,amount,status,created_by,updated_by)
        VALUES($1,$2,$3,'PUBLISHED',$4,$4)
        ON CONFLICT(rate_plan_id,stay_date) WHERE deleted_at IS NULL DO UPDATE SET amount=EXCLUDED.amount,status='PUBLISHED',updated_at=now(),updated_by=EXCLUDED.updated_by,version=${S}.hospitality_rate_calendar.version+1`, [row.rate_plan_id, row.stay_date, row.recommended_amount, actorId]);
      const result = await client.query(`UPDATE ${S}.hospitality_revenue_recommendation SET status='PUBLISHED',published_by=$2,published_at=now(),updated_at=now(),version=version+1 WHERE id=$1 RETURNING id::text,status,published_by::text,published_at,version`, [id, actorId]);
      return result.rows[0];
    });
  }

  async reviewRecommendation(schemaName: string, id: string, decision: string, note: string | undefined, actorId: string) {
    const status = decision.toUpperCase() === 'APPROVE' ? 'APPROVED' : decision.toUpperCase() === 'REJECT' ? 'REJECTED' : '';
    if (!status) invalid('decision harus APPROVE atau REJECT.');
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query(schemaName, `
      UPDATE ${S}.hospitality_revenue_recommendation SET status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4,updated_at=now(),version=version+1
       WHERE id=$1 AND status='PENDING_REVIEW'
      RETURNING id::text,status,reviewed_by::text,reviewed_at,review_note,version
    `, [id, status, actorId, note?.trim() || null]);
    if (!rows[0]) throw AppError.conflict(ErrorCodes.CONFLICT, 'Rekomendasi tidak ditemukan atau sudah ditinjau.');
    return rows[0];
  }

  async processChannel(schemaName: string, propertyId: string, limit: number) {
    const S = `"${schemaName}"`;
    return this.tenantDb.transaction(schemaName, async (client) => {
      const picked = await client.query<ArrayRecord>(`
        SELECT j.id::text,j.payload_hash,j.retry_count,j.max_retry,ca.provider_key
        FROM ${S}.hospitality_distribution_job j JOIN ${S}.hospitality_channel_account ca ON ca.id=j.channel_account_id
        WHERE j.property_id=$1 AND j.status IN ('PENDING','RETRY') AND j.next_attempt_at<=now()
        ORDER BY j.created_at FOR UPDATE SKIP LOCKED LIMIT $2
      `, [propertyId, Math.min(Math.max(limit, 1), 100)]);
      const output: ArrayRecord[] = [];
      for (const job of picked.rows) {
        const attempt = Number(job.retry_count) + 1;
        const test = job.provider_key === 'TEST';
        const attemptStatus = test ? 'ACKNOWLEDGED' : 'BLOCKED_PROVIDER_INPUT';
        await client.query(`INSERT INTO ${S}.hospitality_channel_delivery_attempt(distribution_job_id,attempt_number,adapter_key,status,request_hash,finished_at)
          VALUES($1,$2,$3,$4,$5,now())`, [job.id, attempt, job.provider_key, attemptStatus, job.payload_hash]);
        await client.query(`UPDATE ${S}.hospitality_distribution_job SET status=$2::varchar,retry_count=$3,acknowledged_at=CASE WHEN $2::varchar='ACKNOWLEDGED' THEN now() ELSE acknowledged_at END,
          error_code=CASE WHEN $2::varchar='ACKNOWLEDGED' THEN NULL ELSE 'BLOCKED_PROVIDER_INPUT' END,updated_at=now() WHERE id=$1`, [job.id, test ? 'ACKNOWLEDGED' : 'DEAD_LETTER', attempt]);
        output.push({ id: job.id, status: attemptStatus, attempt });
      }
      return output;
    });
  }
}

type ArrayRecord = Record<string, unknown>;

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} wajib diisi.`);
  return value.trim();
}
function stringValue(value: unknown, fallback: string): string { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function stringOrNull(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function optionalUuid(value: unknown): string | null { return stringOrNull(value); }
function integer(value: unknown, fallback: number): number { const n = Number(value); return Number.isInteger(n) ? n : fallback; }
function positive(value: unknown, fallback: number): number { const n = integer(value, fallback); if (n <= 0) invalid('Nilai harus lebih dari nol.'); return n; }
function money(value: unknown, field: string): number { const n = Number(value); if (!Number.isFinite(n) || n < 0) invalid(`${field} tidak valid.`); return n; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function isoDate(value: unknown, field: string): string { const v = required(value, field); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) invalid(`${field} harus YYYY-MM-DD.`); return v; }
function hash(value: unknown): string { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function invalid(message: string): never { throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, message); }
