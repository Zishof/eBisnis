import{Injectable}from'@nestjs/common';import{createHash,randomBytes}from'node:crypto';import{TenantConnectionService}from'../../infrastructure/database/tenant-connection.service';import{PublicTenantResolver}from'../../infrastructure/tenant/public-tenant-resolver.service';import{AppError,ErrorCodes}from'../../common/errors/app-error';

/**
 * Vertikal yang sama dipakai `HospitalityPublicSiteService` (MI-3) --
 * satu string, dua tempat, sengaja bukan kebetulan: keduanya membaca
 * baris `vertical_site_domain` yang SAMA yang ditulis pendaftaran
 * properti (`VERTIKAL_SITUS_HOSPITALITY` pada `hospitality-registration.service.ts`).
 */
const VERTIKAL='hospitality';

@Injectable()export class HospitalityExperienceService{constructor(private readonly db:TenantConnectionService,private readonly resolver:PublicTenantResolver){}

  /**
   * Resolusi tenant untuk endpoint TAMU/KIOSK (bukan staf) dari host
   * permintaan -- `PublicTenantResolver` (IR-005) yang SAMA dipakai situs
   * properti publik MI-3, BUKAN mekanisme baru.
   *
   * Ditemukan lewat UAT sungguhan (bukan tsc/lint): `portal()`/`kiosk()`/
   * `verifyKiosk()` sebelumnya memakai `@CurrentUser()` staf seperti
   * endpoint biasa, padahal metode di bawah SUDAH dirancang benar sebagai
   * mekanisme tanpa login staf (verifikasi lewat hash token sesi tamu,
   * bukan JWT) -- akibatnya tamu/perangkat kiosk sungguhan (tanpa
   * kredensial staf) tidak pernah bisa mencapainya sama sekali.
   */
  async konteksTamu(host:string|undefined):Promise<{schemaName:string;propertyId:string}>{
    const domain=await this.resolver.resolve(host,VERTIKAL);
    const S=`"${domain.schemaName}"`;
    const properti=await this.db.queryOne<{id:string}>(domain.schemaName,
      `SELECT id FROM ${S}.hospitality_property WHERE deleted_at IS NULL AND status='ACTIVE' ORDER BY created_at ASC LIMIT 1`);
    if(!properti)throw AppError.notFound(ErrorCodes.NOT_FOUND,'Situs tidak ditemukan.');
    return{schemaName:domain.schemaName,propertyId:properti.id};
  }

  portalSession(sc:string,b:any){const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex'),s=`"${sc}"`;return this.db.query(sc,`INSERT INTO ${s}.hospitality_guest_portal_session(guest_id,stay_id,token_hash,expires_at)VALUES($1,$2,$3,$4)RETURNING id::text,expires_at::text`,[b.guestId,b.stayId??null,hash,b.expiresAt]).then(r=>({...r[0],token}))}portal(sc:string,token:string){const hash=createHash('sha256').update(token).digest('hex'),s=`"${sc}"`;return this.db.transaction(sc,async c=>{const ses=await c.query<any>(`UPDATE ${s}.hospitality_guest_portal_session SET last_seen_at=now() WHERE token_hash=$1 AND status='ACTIVE' AND expires_at>now() RETURNING guest_id::text,stay_id::text`,[hash]);if(!ses.rows[0])throw AppError.forbidden(ErrorCodes.FORBIDDEN,'Sesi portal tidak valid.');const x=ses.rows[0];const stay=x.stay_id?await c.query(`SELECT st.id::text,st.status,st.actual_checkin_at::text,st.actual_checkout_at::text,r.room_number AS room_code FROM ${s}.hospitality_guest_stay st LEFT JOIN ${s}.hospitality_room r ON r.id=st.room_id WHERE st.id=$1 AND st.guest_id=$2`,[x.stay_id,x.guest_id]):{rows:[]};const folio=x.stay_id?await c.query(`SELECT f.id::text,f.status,COALESCE(sum(t.signed_total),0)::text AS balance FROM ${s}.hospitality_folio f LEFT JOIN ${s}.hospitality_folio_transaction t ON t.folio_id=f.id WHERE f.stay_id=$1 GROUP BY f.id`,[x.stay_id]):{rows:[]};return{stay:stay.rows[0]??null,folio:folio.rows[0]??null}})}kiosk(sc:string,propertyId:string,b:any){const s=`"${sc}"`;return this.db.query(sc,`INSERT INTO ${s}.hospitality_kiosk_session(property_id,stay_id,device_code,expires_at)VALUES($1,$2,$3,now()+interval '15 minutes')RETURNING id::text,status,expires_at::text`,[propertyId,b.stayId??null,b.deviceCode]).then(r=>r[0])}verifyKiosk(sc:string,id:string,b:any){const s=`"${sc}"`;return this.db.query(sc,`UPDATE ${s}.hospitality_kiosk_session SET status='VERIFIED',identity_result=$2::jsonb WHERE id=$1 AND status='STARTED' AND expires_at>now() RETURNING id::text,status`,[id,JSON.stringify({verified:b.verified===true,reference:b.reference??null})]).then(r=>r[0])}provider(sc:string,b:any){const s=`"${sc}"`;return this.db.query(sc,`INSERT INTO ${s}.hospitality_provider_contract(property_id,provider_type,provider_key,credential_reference,contract_version,capabilities,status)VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)ON CONFLICT(property_id,provider_type,provider_key)DO UPDATE SET credential_reference=EXCLUDED.credential_reference,contract_version=EXCLUDED.contract_version,capabilities=EXCLUDED.capabilities,status=EXCLUDED.status RETURNING id::text,status`,[b.propertyId,b.providerType,b.providerKey,b.credentialReference??null,b.contractVersion??null,JSON.stringify(b.capabilities??[]),b.status??'BLOCKED_PROVIDER_INPUT']).then(r=>r[0])}mobile(sc:string,b:any,actor:string){const s=`"${sc}"`;return this.db.query(sc,`INSERT INTO ${s}.hospitality_mobile_operation(actor_id,workspace,client_operation_id,operation_type,payload,occurred_offline_at)VALUES($1,$2,$3,$4,$5::jsonb,$6)ON CONFLICT(actor_id,workspace,client_operation_id)DO UPDATE SET client_operation_id=EXCLUDED.client_operation_id RETURNING id::text,status,(xmax<>0) AS replayed`,[actor,b.workspace,b.clientOperationId,b.operationType,JSON.stringify(b.payload??{}),b.occurredOfflineAt??null]).then(r=>r[0])}purge(sc:string){const s=`"${sc}"`;return this.db.transaction(sc,async c=>{const p=await c.query(`UPDATE ${s}.hospitality_guest_portal_session SET status='EXPIRED',residue_purged_at=now() WHERE expires_at<now() AND residue_purged_at IS NULL`);const k=await c.query(`UPDATE ${s}.hospitality_kiosk_session SET identity_result=NULL,status=CASE WHEN status IN('COMPLETED','ABANDONED') THEN status ELSE 'EXPIRED' END,residue_purged_at=now() WHERE expires_at<now() AND residue_purged_at IS NULL`);return{portal:p.rowCount,kiosk:k.rowCount}})}dashboard(sc:string,p:string){const s=`"${sc}"`;return this.db.query(sc,`SELECT id::text,provider_type,provider_key,status,contract_version,last_health_at::text FROM ${s}.hospitality_provider_contract WHERE property_id=$1 ORDER BY provider_type,provider_key`,[p])}}
