import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export const NIGHT_AUDIT_STEPS = ['PRECHECK','ROOM_POSTING','INTERFACE_CHECK','BALANCE_RECONCILIATION','REPORT_SNAPSHOT'] as const;

@Injectable()
export class HospitalityNightAuditService {
  constructor(private readonly db: TenantConnectionService) {}

  async start(schema: string, input: { propertyId: string; businessDate: string }, key: string | undefined, actor: string) {
    if (!key) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Idempotency-Key wajib.');
    const s = `"${schema}"`;
    return this.db.transaction(schema, async (client) => {
      await client.query(`INSERT INTO ${s}.hospitality_business_date(property_id,business_date,status) VALUES($1,$2,'AUDITING') ON CONFLICT(property_id) DO UPDATE SET status='AUDITING',updated_at=now() WHERE ${s}.hospitality_business_date.business_date=$2`, [input.propertyId, input.businessDate]);
      const run = await client.query(`INSERT INTO ${s}.hospitality_night_audit_run(property_id,business_date,started_by,idempotency_key,current_step) VALUES($1,$2,$3,$4,'PRECHECK') ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id::text,status,current_step,business_date::text`, [input.propertyId, input.businessDate, actor, key]);
      return run.rows[0];
    });
  }

  detail(schema: string, id: string) {
    const s = `"${schema}"`;
    return Promise.all([
      this.db.query(schema, `SELECT id::text,property_id::text,business_date::text,status,current_step,started_at::text,completed_at::text FROM ${s}.hospitality_night_audit_run WHERE id=$1`, [id]),
      this.db.query(schema, `SELECT step_code,status,result,attempt,completed_at::text FROM ${s}.hospitality_night_audit_step WHERE run_id=$1 ORDER BY started_at`, [id]),
      this.db.query(schema, `SELECT id::text,rule_code,severity,message,status,resolution FROM ${s}.hospitality_night_audit_exception WHERE run_id=$1 ORDER BY created_at`, [id]),
    ]).then(([run, steps, exceptions]) => ({ ...run[0], steps, exceptions }));
  }

  async executeStep(schema: string, runId: string, step: string, key: string | undefined) {
    if (!key || !NIGHT_AUDIT_STEPS.includes(step as (typeof NIGHT_AUDIT_STEPS)[number])) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Step atau Idempotency-Key tidak valid.');
    const s = `"${schema}"`;
    return this.db.transaction(schema, async (client) => {
      const existing = await client.query(`SELECT status,result FROM ${s}.hospitality_night_audit_step WHERE idempotency_key=$1`, [key]);
      if (existing.rows[0]) return { ...existing.rows[0], replayed: true };
      const run = await client.query<{ property_id: string; business_date: string; status: string }>(`SELECT property_id::text,business_date::text,status FROM ${s}.hospitality_night_audit_run WHERE id=$1 FOR UPDATE`, [runId]);
      if (!run.rows[0] || run.rows[0].status === 'COMPLETED') throw AppError.conflict(ErrorCodes.CONFLICT, 'Night audit tidak aktif.');
      const r = run.rows[0];
      const counts = await client.query(`SELECT (SELECT count(*) FROM ${s}.hospitality_cashier_shift WHERE property_id=$1 AND business_date=$2 AND status='OPEN')::int AS open_cashiers,(SELECT count(*) FROM ${s}.hospitality_folio f WHERE f.property_id=$1 AND f.status='OPEN' AND EXISTS(SELECT 1 FROM ${s}.hospitality_folio_transaction t WHERE t.folio_id=f.id AND t.business_date<=$2 GROUP BY t.folio_id HAVING sum(t.signed_total)<>0))::int AS unbalanced_folios`, [r.property_id, r.business_date]);
      const result = { step, ...counts.rows[0], checkedAt: new Date().toISOString() };
      const blocked = step === 'PRECHECK' && Number(counts.rows[0].open_cashiers) > 0;
      if (blocked) await client.query(`INSERT INTO ${s}.hospitality_night_audit_exception(run_id,rule_code,severity,message) VALUES($1,'OPEN_CASHIER','BLOCKING','Masih ada shift kasir terbuka.')`, [runId]);
      if (step === 'REPORT_SNAPSHOT') {
        const payload = JSON.stringify(result), hash = createHash('sha256').update(payload).digest('hex');
        await client.query(`INSERT INTO ${s}.hospitality_night_audit_snapshot(run_id,snapshot_type,payload,document_hash) VALUES($1,'END_OF_DAY',$2::jsonb,$3) ON CONFLICT(run_id,snapshot_type) DO NOTHING`, [runId, payload, hash]);
      }
      const row = await client.query(`INSERT INTO ${s}.hospitality_night_audit_step(run_id,step_code,status,result,completed_at,idempotency_key) VALUES($1,$2,$3,$4::jsonb,now(),$5) RETURNING step_code,status,result`, [runId, step, blocked ? 'BLOCKED' : 'PASSED', JSON.stringify(result), key]);
      await client.query(`UPDATE ${s}.hospitality_night_audit_run SET status=$2,current_step=$3,version=version+1 WHERE id=$1`, [runId, blocked ? 'BLOCKED' : (step === 'REPORT_SNAPSHOT' ? 'READY' : 'STARTED'), step]);
      return { ...row.rows[0], replayed: false };
    });
  }

  async resolveException(schema: string, id: string, resolution: string, actor: string) {
    const s = `"${schema}"`;
    return this.db.query(schema, `UPDATE ${s}.hospitality_night_audit_exception SET status='RESOLVED',resolution=$2,resolved_by=$3,resolved_at=now() WHERE id=$1 AND status='OPEN' RETURNING id::text,status`, [id, resolution, actor]).then((r) => r[0]);
  }

  async finalize(schema: string, id: string, stepUpReference: string | undefined, actor: string) {
    if (!stepUpReference) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Step-up authentication wajib untuk roll tanggal bisnis.');
    const s = `"${schema}"`;
    return this.db.transaction(schema, async (client) => {
      const run = await client.query<{ property_id: string; business_date: string }>(`SELECT property_id::text,business_date::text FROM ${s}.hospitality_night_audit_run WHERE id=$1 AND status='READY' AND NOT EXISTS(SELECT 1 FROM ${s}.hospitality_night_audit_exception WHERE run_id=$1 AND status='OPEN' AND severity='BLOCKING') FOR UPDATE`, [id]);
      if (!run.rows[0]) throw AppError.conflict(ErrorCodes.CONFLICT, 'Night audit belum siap atau masih memiliki exception blocking.');
      await client.query(`UPDATE ${s}.hospitality_night_audit_run SET status='COMPLETED',completed_at=now(),finalized_by=$2,step_up_reference=$3,version=version+1 WHERE id=$1`, [id, actor, stepUpReference]);
      await client.query(`UPDATE ${s}.hospitality_business_date SET business_date=business_date+1,status='OPEN',version=version+1,updated_at=now() WHERE property_id=$1 AND business_date=$2`, [run.rows[0].property_id, run.rows[0].business_date]);
      await client.query(`INSERT INTO ${s}.hospitality_income_audit_review(run_id) VALUES($1) ON CONFLICT(run_id) DO NOTHING`, [id]);
      const next = new Date(`${run.rows[0].business_date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      return { id, status: 'COMPLETED', nextBusinessDate: next.toISOString().slice(0, 10) };
    });
  }

  review(schema: string, id: string, input: { status: 'APPROVED' | 'REJECTED'; notes?: string }, actor: string) {
    const s = `"${schema}"`;
    return this.db.query(schema, `UPDATE ${s}.hospitality_income_audit_review SET status=$2,notes=$3,reviewed_by=$4,reviewed_at=now() WHERE run_id=$1 AND status='PENDING' RETURNING id::text,status`, [id, input.status, input.notes ?? null, actor]).then((r) => r[0]);
  }
}
