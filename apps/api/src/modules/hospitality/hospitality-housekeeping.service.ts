import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { statusTujuanUntukAksi, transisiTugasHkDiizinkan, workloadPoints, type StatusTugasHk } from './hospitality-housekeeping';

@Injectable()
export class HospitalityHousekeepingService {
  constructor(private readonly db: TenantConnectionService) {}

  board(schema: string, propertyId: string) {
    const S=`"${schema}"`;
    return this.db.query(schema, `SELECT rm.id::text AS room_id,rm.room_number AS nomor_kamar,rm.floor AS lantai,rt.name AS room_type,
      COALESCE(os.condition,CASE WHEN gs.status='CHECKED_OUT' THEN 'DIRTY' ELSE 'CLEAN' END) AS room_condition,
      COALESCE(os.dnd,FALSE) AS dnd,gs.status AS frontdesk_status,g.full_name AS guest_name,
      t.id::text AS task_id,t.task_kind,t.status AS task_status,t.priority,t.assigned_to::text,t.due_at::text,t.workload_points
      FROM ${S}.hospitality_room rm JOIN ${S}.hospitality_room_type rt ON rt.id=rm.room_type_id
      LEFT JOIN ${S}.hospitality_room_operation_state os ON os.room_id=rm.id
      LEFT JOIN ${S}.hospitality_guest_stay gs ON gs.room_id=rm.id AND gs.status IN ('IN_HOUSE','CHECKED_OUT')
      LEFT JOIN ${S}.hospitality_guest g ON g.id=gs.guest_id
      LEFT JOIN LATERAL (SELECT * FROM ${S}.hospitality_housekeeping_task x WHERE x.room_id=rm.id AND x.status NOT IN ('CLOSED','REFUSED') ORDER BY x.created_at DESC LIMIT 1) t ON TRUE
      WHERE rt.property_id=$1 AND rm.deleted_at IS NULL ORDER BY rm.floor NULLS LAST,rm.room_number`, [propertyId]);
  }

  async createTask(schema: string, input: { propertyId:string; roomId:string; stayId?:string; taskKind:string; priority?:string; assignedTo?:string; shiftCode?:string; dueAt?:string; checklist?:unknown[]; roomSizeM2?:number; vip?:boolean; dueIn?:boolean }, key:string|undefined, actor:string) {
    if(!key) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED,'Idempotency-Key wajib.');
    const S=`"${schema}"`;
    const existing=await this.db.query(schema,`SELECT id::text,status FROM ${S}.hospitality_housekeeping_task WHERE idempotency_key=$1`,[key]);
    if(existing[0]) return {...existing[0],replayed:true};
    const room=await this.db.query(schema,`SELECT rm.id FROM ${S}.hospitality_room rm JOIN ${S}.hospitality_room_type rt ON rt.id=rm.room_type_id WHERE rm.id=$1 AND rt.property_id=$2 AND rm.deleted_at IS NULL`,[input.roomId,input.propertyId]);
    if(!room[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND,'Kamar tidak ditemukan pada properti ini.');
    const rows=await this.db.query(schema,`INSERT INTO ${S}.hospitality_housekeeping_task
      (property_id,room_id,stay_id,task_kind,priority,assigned_to,shift_code,due_at,workload_points,checklist,idempotency_key,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$12)
      ON CONFLICT(idempotency_key) DO NOTHING RETURNING id::text,status`,[input.propertyId,input.roomId,input.stayId??null,input.taskKind,input.priority??'NORMAL',input.assignedTo??null,input.shiftCode??null,input.dueAt??null,workloadPoints(input.taskKind,input.roomSizeM2,input.vip,input.dueIn),JSON.stringify(input.checklist??[]),key,actor]);
    return {...rows[0],replayed:false};
  }

  async transition(schema:string, taskId:string, input:{ action:'START'|'PAUSE'|'COMPLETE'|'REQUEST_INSPECTION'|'INSPECT_PASS'|'INSPECT_FAIL'|'CLOSE'|'REFUSE'; clientOperationId:string; occurredAt:string; note?:string; supplies?:unknown[]; linen?:unknown[]; minibar?:unknown[]; photos?:unknown[]; checklistResult?:unknown[] }, actor:string) {
    const S=`"${schema}"`;
    return this.db.transaction(schema,async(client)=>{
      const replay=await client.query(`SELECT id::text,task_id::text,to_status FROM ${S}.hospitality_housekeeping_task_event WHERE client_operation_id=$1`,[input.clientOperationId]);
      if(replay.rows[0]) return {...replay.rows[0],replayed:true};
      const locked=await client.query<{status:StatusTugasHk;room_id:string;stay_id:string|null}>(`SELECT status,room_id::text,stay_id::text FROM ${S}.hospitality_housekeeping_task WHERE id=$1 FOR UPDATE`,[taskId]);
      if(!locked.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND,'Tugas housekeeping tidak ditemukan.');
      const from=locked.rows[0].status,to=statusTujuanUntukAksi(input.action);
      if(!transisiTugasHkDiizinkan(from,to)) throw AppError.conflict(ErrorCodes.CONFLICT,`Transisi ${from} ke ${to} tidak diizinkan.`);
      await client.query(`INSERT INTO ${S}.hospitality_housekeeping_task_event(task_id,client_operation_id,action,from_status,to_status,note,supplies,linen,minibar,photos,occurred_at,actor_id)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12)`,[taskId,input.clientOperationId,input.action,from,to,clean(input.note),JSON.stringify(input.supplies??[]),JSON.stringify(input.linen??[]),JSON.stringify(input.minibar??[]),JSON.stringify(input.photos??[]),input.occurredAt,actor]);
      await client.query(`UPDATE ${S}.hospitality_housekeeping_task SET status=$2::varchar,started_at=CASE WHEN $2::varchar='IN_PROGRESS' THEN COALESCE(started_at,now()) ELSE started_at END,completed_at=CASE WHEN $2::varchar='COMPLETED' THEN now() ELSE completed_at END,closed_at=CASE WHEN $2::varchar='CLOSED' THEN now() ELSE closed_at END,updated_at=now(),updated_by=$3,version=version+1 WHERE id=$1`,[taskId,to,actor]);
      const condition=to==='IN_PROGRESS'?'CLEANING':to==='COMPLETED'?'CLEAN':to==='INSPECTED'||to==='CLOSED'?'INSPECTED':null;
      if(condition) await client.query(`INSERT INTO ${S}.hospitality_room_operation_state(room_id,property_id,condition,updated_by)
        SELECT room_id,property_id,$2,$3 FROM ${S}.hospitality_housekeeping_task WHERE id=$1
        ON CONFLICT(room_id) DO UPDATE SET condition=EXCLUDED.condition,updated_at=now(),updated_by=EXCLUDED.updated_by,version=${S}.hospitality_room_operation_state.version+1`,[taskId,condition,actor]);
      if(input.action.startsWith('INSPECT_')) await client.query(`INSERT INTO ${S}.hospitality_housekeeping_inspection(task_id,passed,checklist_result,note,inspected_by,client_operation_id) VALUES($1,$2,$3::jsonb,$4,$5,$6)`,[taskId,input.action==='INSPECT_PASS',JSON.stringify(input.checklistResult??[]),clean(input.note),actor,`${input.clientOperationId}:inspection`]);
      if((input.minibar?.length??0)>0) await client.query(`INSERT INTO ${S}.hospitality_minibar_posting_outbox(task_id,stay_id,items,idempotency_key) VALUES($1,$2,$3::jsonb,$4)`,[taskId,locked.rows[0].stay_id,JSON.stringify(input.minibar),`${input.clientOperationId}:minibar`]);
      return {taskId,fromStatus:from,toStatus:to,replayed:false};
    });
  }

  async setRoomFlags(schema:string,roomId:string,input:{propertyId:string;dnd:boolean;serviceRefused:boolean;discrepancyNote?:string},actor:string){
    const S=`"${schema}"`; const rows=await this.db.query(schema,`INSERT INTO ${S}.hospitality_room_operation_state(room_id,property_id,dnd,service_refused,discrepancy_note,updated_by)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(room_id) DO UPDATE SET dnd=EXCLUDED.dnd,service_refused=EXCLUDED.service_refused,discrepancy_note=EXCLUDED.discrepancy_note,updated_at=now(),updated_by=EXCLUDED.updated_by,version=${S}.hospitality_room_operation_state.version+1 RETURNING room_id::text,condition,dnd,service_refused,discrepancy_note,version`,[roomId,input.propertyId,input.dnd,input.serviceRefused,clean(input.discrepancyNote),actor]); return rows[0];
  }

  linen(schema:string,input:{propertyId:string;itemCode:string;movement:string;quantity:number;fromLocation?:string;toLocation?:string;vendorName?:string;expectedQuantity?:number;discrepancyQuantity?:number;unitCost?:number;reason?:string;occurredAt:string;clientOperationId:string},actor:string){
    const S=`"${schema}"`; return this.db.query(schema,`INSERT INTO ${S}.hospitality_linen_transaction(property_id,item_code,movement,quantity,from_location,to_location,vendor_name,expected_quantity,discrepancy_quantity,unit_cost,reason,occurred_at,client_operation_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(client_operation_id) DO UPDATE SET client_operation_id=EXCLUDED.client_operation_id RETURNING id::text,movement,quantity::text,client_operation_id`,[input.propertyId,input.itemCode,input.movement,input.quantity,clean(input.fromLocation),clean(input.toLocation),clean(input.vendorName),input.expectedQuantity??null,input.discrepancyQuantity??null,input.unitCost??null,clean(input.reason),input.occurredAt,input.clientOperationId,actor]).then(r=>r[0]);
  }

  lostFound(schema:string,input:{propertyId:string;roomId?:string;category:string;description:string;foundLocation:string;foundAt:string;secureStorage:string;photos?:unknown[];expiresAt?:string;clientOperationId:string},actor:string){
    const S=`"${schema}"`; return this.db.transaction(schema,async c=>{const replay=await c.query(`SELECT item_id::text AS id FROM ${S}.hospitality_lost_found_custody WHERE client_operation_id=$1`,[input.clientOperationId]);if(replay.rows[0])return {...replay.rows[0],replayed:true};const item=await c.query(`INSERT INTO ${S}.hospitality_lost_found_item(property_id,room_id,category,description,found_location,found_at,found_by,secure_storage,photos,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING id::text,status`,[input.propertyId,input.roomId??null,input.category,input.description,input.foundLocation,input.foundAt,actor,input.secureStorage,JSON.stringify(input.photos??[]),input.expiresAt??null]);await c.query(`INSERT INTO ${S}.hospitality_lost_found_custody(item_id,action,to_location,actor_id,client_operation_id) VALUES($1,'STORED',$2,$3,$4)`,[item.rows[0].id,input.secureStorage,actor,input.clientOperationId]);return {...item.rows[0],replayed:false};});
  }
}
function clean(v?:string){const x=v?.trim();return x||null;}

