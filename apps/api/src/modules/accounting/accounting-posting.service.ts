import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PoolClient } from 'pg';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { buildJournalLines, type AccountingEvent, type PostingRule } from './posting-engine';
import {
  decideReversal,
  reversalJournalNumber,
  reversalPostingKey,
  reverseLines,
  totalsOf,
  type PostedJournalLine,
  type ReversalRefusal,
} from './reversal-journal';

interface EventRow {
  id: string;
  event_code: string;
  source_type: string;
  source_id: string;
  source_number: string | null;
  legal_entity_id: string | null;
  occurred_at: Date;
  amounts: Record<string, unknown>;
  currency_code: string;
  created_by: string | null;
}

export interface PostingAttempt {
  eventId: string;
  status: 'POSTED' | 'FAILED';
  journalEntryId?: string;
  issues?: string[];
}

export interface ReversalAttempt {
  eventId: string;
  status: 'REVERSED' | 'ALREADY_REVERSED' | 'SKIPPED';
  journalEntryId?: string;
  reason?: ReversalRefusal;
}

@Injectable()
export class AccountingPostingService {
  private readonly logger = new Logger(AccountingPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  /** Pekerja asinkron: kegagalan jurnal tidak membatalkan transaksi bisnis. */
  @Cron(CronExpression.EVERY_MINUTE)
  async processAllReadyTenants(): Promise<void> {
    const tenants = await this.prisma.tenantSchemaRegistry.findMany({
      where: { status: 'READY' },
      select: { schemaName: true },
    });
    for (const tenant of tenants) {
      try {
        const result = await this.processPending(tenant.schemaName, 100);
        if (result.posted || result.failed) {
          this.logger.log(
            `${tenant.schemaName}: ${result.posted} event diposting, ${result.failed} gagal.`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Pemrosesan event akuntansi ${tenant.schemaName} gagal: ${(error as Error).message}`,
        );
      }
    }
  }

  async processPending(schemaName: string, limit = 100) {
    const attempts: PostingAttempt[] = [];
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    for (let index = 0; index < safeLimit; index += 1) {
      const attempt = await this.processOne(schemaName);
      if (!attempt) break;
      attempts.push(attempt);
    }
    return {
      processed: attempts.length,
      posted: attempts.filter((item) => item.status === 'POSTED').length,
      failed: attempts.filter((item) => item.status === 'FAILED').length,
      attempts,
    };
  }

  async retry(schemaName: string, eventId: string): Promise<PostingAttempt> {
    const changed = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE "${schemaName}".accounting_event
          SET status = 'PENDING', failure_reason = NULL, updated_at = now(), version = version + 1
        WHERE id = $1::uuid AND status = 'FAILED'
        RETURNING id::text`,
      [eventId],
    );
    if (!changed.length) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Event gagal tidak ditemukan atau sudah diproses oleh pekerja lain.',
      );
    }
    const result = await this.processOne(schemaName, eventId);
    if (!result) {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Event sedang diproses oleh pekerja lain.');
    }
    return result;
  }

  async processOne(schemaName: string, eventId?: string): Promise<PostingAttempt | null> {
    if (!eventId) {
      const next = await this.tenantDb.queryOne<{ id: string }>(
        schemaName,
        `SELECT id::text
           FROM "${schemaName}".accounting_event
          WHERE status = 'PENDING'
          ORDER BY occurred_at, created_at
          LIMIT 1`,
      );
      if (!next) return null;
      return this.processOne(schemaName, next.id);
    }
    try {
      return await this.tenantDb.transaction(schemaName, (client) =>
        this.postLockedEvent(client, schemaName, eventId),
      );
    } catch (error) {
      const detail = this.safeFailure(error);
      await this.markFailed(schemaName, eventId, detail);
      return { eventId, status: 'FAILED', issues: [detail] };
    }
  }

  private async postLockedEvent(
    client: PoolClient,
    schemaName: string,
    eventId?: string,
  ): Promise<PostingAttempt | null> {
    const selected = await client.query<EventRow>(
      `SELECT id::text, event_code, source_type, source_id::text, source_number,
              legal_entity_id::text, occurred_at, amounts, currency_code, created_by::text
         FROM "${schemaName}".accounting_event
        WHERE status = 'PENDING' AND ($1::uuid IS NULL OR id = $1::uuid)
        ORDER BY occurred_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
      [eventId ?? null],
    );
    const row = selected.rows[0];
    if (!row) return null;

    const postingKey = `ACCOUNTING_EVENT:${row.id}`;
    const existing = await client.query<{ id: string }>(
      `SELECT id::text FROM "${schemaName}".journal_entry WHERE posting_key = $1`,
      [postingKey],
    );
    if (existing.rowCount) {
      await this.markPosted(client, schemaName, row.id, existing.rows[0].id);
      return { eventId: row.id, status: 'POSTED', journalEntryId: existing.rows[0].id };
    }

    const rulesResult = await client.query<{
      code: string;
      event_code: string;
      sort_order: number;
      account_id: string;
      side: 'DEBIT' | 'CREDIT';
      amount_key: string;
      skip_when_zero: boolean;
      description_template: string | null;
      effective_from: string;
      effective_to: string | null;
      is_active: boolean;
    }>(
      `SELECT code, event_code, sort_order, account_id::text, side, amount_key,
              skip_when_zero, description_template, effective_from::text,
              effective_to::text, is_active
         FROM "${schemaName}".accounting_posting_rule
        WHERE event_code = $1 AND deleted_at IS NULL
        ORDER BY sort_order, code`,
      [row.event_code],
    );
    const rules: PostingRule[] = rulesResult.rows.map((rule) => ({
      code: rule.code,
      eventCode: rule.event_code,
      sortOrder: rule.sort_order,
      accountId: rule.account_id,
      side: rule.side,
      amountKey: rule.amount_key,
      skipWhenZero: rule.skip_when_zero,
      descriptionTemplate: rule.description_template,
      effectiveFrom: new Date(`${rule.effective_from}T00:00:00.000Z`),
      effectiveTo: rule.effective_to
        ? new Date(`${rule.effective_to}T23:59:59.999Z`)
        : null,
      isActive: rule.is_active,
    }));
    const event: AccountingEvent = {
      eventCode: row.event_code,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceNumber: row.source_number,
      occurredAt: new Date(row.occurred_at),
      amounts: Object.fromEntries(
        Object.entries(row.amounts ?? {}).map(([key, value]) => [key, Number(value)]),
      ),
      currencyCode: row.currency_code,
    };
    const built = buildJournalLines(event, rules);
    if (!built.ok) {
      const issues = built.issues.map((issue) => `${issue.code}: ${issue.detail}`);
      await this.markFailedInTransaction(client, schemaName, row.id, issues.join(' | '));
      return { eventId: row.id, status: 'FAILED', issues };
    }

    const date = event.occurredAt.toISOString().slice(0, 10);
    const period = await client.query<{ id: string }>(
      `SELECT id::text
         FROM "${schemaName}".fiscal_period
        WHERE deleted_at IS NULL AND status = 'OPEN'
          AND $1::date BETWEEN start_date AND end_date
        ORDER BY period_no
        LIMIT 1
        FOR UPDATE`,
      [date],
    );
    if (!period.rowCount) {
      const issue = `NO_OPEN_PERIOD: Tidak ada periode terbuka untuk ${date}.`;
      await this.markFailedInTransaction(client, schemaName, row.id, issue);
      return { eventId: row.id, status: 'FAILED', issues: [issue] };
    }

    const journalNumber = `AE-${date.replace(/-/g, '')}-${row.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const journal = await client.query<{ id: string }>(
      `INSERT INTO "${schemaName}".journal_entry
         (legal_entity_id, fiscal_period_id, journal_number, journal_date,
          source_type, source_id, posting_key, description, currency_code,
          total_debit, total_credit, status, posted_at, posted_by, created_by)
       VALUES ($1::uuid, $2::uuid, $3, $4::date, $5, $6::uuid, $7, $8, $9,
               $10, $11, 'POSTED', now(), $12::uuid, $12::uuid)
       RETURNING id::text`,
      [
        row.legal_entity_id,
        period.rows[0].id,
        journalNumber,
        date,
        row.source_type,
        row.source_id,
        postingKey,
        `${row.event_code} ${row.source_number ?? row.source_id}`,
        row.currency_code,
        built.totalDebit,
        built.totalCredit,
        row.created_by,
      ],
    );
    for (const [index, line] of built.lines.entries()) {
      await client.query(
        `INSERT INTO "${schemaName}".journal_entry_line
           (journal_entry_id, account_id, line_no, debit, credit, description)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
        [
          journal.rows[0].id,
          line.accountId,
          index + 1,
          line.side === 'DEBIT' ? line.amount : 0,
          line.side === 'CREDIT' ? line.amount : 0,
          line.description,
        ],
      );
    }
    await this.markPosted(client, schemaName, row.id, journal.rows[0].id);
    return { eventId: row.id, status: 'POSTED', journalEntryId: journal.rows[0].id };
  }

  /**
   * Membentuk jurnal pembalik bagi seluruh peristiwa satu dokumen yang sudah
   * terjurnal.
   *
   * Dipanggil DI DALAM transaksi bisnis yang membalik dokumennya, dengan
   * `client` yang sama — supaya stok, hutang, dan buku besar bergerak bersama
   * atau tidak sama sekali.
   *
   * Peristiwa aslinya sengaja TETAP `POSTED`. Ia memang pernah terjurnal, dan
   * itu bagian dari riwayat yang tidak boleh dihapus; pembaliknya ditautkan
   * lewat `journal_entry.reversal_of_id` dan dicatat pada `metadata`.
   */
  async reversePostedEvents(
    client: PoolClient,
    schemaName: string,
    ctx: { sourceType: string; sourceId: string; reason: string; userId: string | null },
  ): Promise<ReversalAttempt[]> {
    const events = await client.query<{ id: string }>(
      `SELECT ae.id::text
         FROM "${schemaName}".accounting_event ae
        WHERE ae.source_type = $1 AND ae.source_id = $2::uuid AND ae.status = 'POSTED'
        ORDER BY ae.occurred_at, ae.created_at
        FOR UPDATE`,
      [ctx.sourceType, ctx.sourceId],
    );

    const attempts: ReversalAttempt[] = [];
    for (const row of events.rows) {
      attempts.push(await this.reverseOneEvent(client, schemaName, row.id, ctx));
    }
    return attempts;
  }

  private async reverseOneEvent(
    client: PoolClient,
    schemaName: string,
    eventId: string,
    ctx: { reason: string; userId: string | null },
  ): Promise<ReversalAttempt> {
    const postingKey = reversalPostingKey(eventId);

    const info = await client.query<{
      event_status: string;
      journal_entry_id: string | null;
      journal_status: string | null;
      journal_is_reversal: boolean | null;
      existing_reversal_id: string | null;
      line_count: string;
      legal_entity_id: string | null;
      currency_code: string;
      source_type: string;
      source_id: string;
      source_number: string | null;
      event_code: string;
    }>(
      `SELECT ae.status AS event_status,
              ae.journal_entry_id::text AS journal_entry_id,
              ae.legal_entity_id::text AS legal_entity_id,
              ae.currency_code, ae.source_type, ae.source_id::text AS source_id,
              ae.source_number, ae.event_code,
              je.status AS journal_status,
              (je.reversal_of_id IS NOT NULL) AS journal_is_reversal,
              (SELECT r.id::text FROM "${schemaName}".journal_entry r
                WHERE r.posting_key = $2) AS existing_reversal_id,
              (SELECT count(*)::text FROM "${schemaName}".journal_entry_line l
                WHERE l.journal_entry_id = je.id) AS line_count
         FROM "${schemaName}".accounting_event ae
    LEFT JOIN "${schemaName}".journal_entry je ON je.id = ae.journal_entry_id
        WHERE ae.id = $1::uuid
          FOR UPDATE OF ae`,
      [eventId, postingKey],
    );
    const e = info.rows[0];
    if (!e) return { eventId, status: 'SKIPPED', reason: 'NO_JOURNAL' };

    const decision = decideReversal({
      eventStatus: e.event_status,
      journalEntryId: e.journal_entry_id,
      journalStatus: e.journal_status,
      journalIsReversal: e.journal_is_reversal === true,
      existingReversalId: e.existing_reversal_id,
      lineCount: Number(e.line_count ?? 0),
    });
    if (decision.action === 'ALREADY_REVERSED') {
      return {
        eventId,
        status: 'ALREADY_REVERSED',
        journalEntryId: decision.journalEntryId,
      };
    }
    if (decision.action === 'SKIP') {
      return { eventId, status: 'SKIPPED', reason: decision.reason };
    }

    const original = await client.query<{
      account_id: string;
      line_no: number;
      debit: string;
      credit: string;
      description: string | null;
    }>(
      `SELECT account_id::text, line_no, debit::text, credit::text, description
         FROM "${schemaName}".journal_entry_line
        WHERE journal_entry_id = $1::uuid
        ORDER BY line_no`,
      [e.journal_entry_id],
    );
    const lines: PostedJournalLine[] = original.rows.map((l) => ({
      accountId: l.account_id,
      lineNo: l.line_no,
      debit: Number(l.debit),
      credit: Number(l.credit),
      description: l.description,
    }));
    const balikan = reverseLines(lines);
    const total = totalsOf(balikan);

    /*
     * Periode fiskal pembalik: HARI INI, dan wajib terbuka.
     *
     * Pembalik tidak pernah ditanggalkan mundur ke periode aslinya. Periode
     * yang sudah ditutup berarti angkanya sudah dilaporkan; menyisipkan jurnal
     * ke dalamnya membuat laporan yang sudah tercetak tidak lagi cocok dengan
     * basis data, dan tidak ada yang tahu mana yang benar.
     *
     * Bila tidak ada periode terbuka, seluruh pembalikan dokumen ini digulung
     * balik. Itu disengaja: membalik stok tetapi meninggalkan jurnalnya berdiri
     * adalah persis selisih diam-diam yang pembalik ini ada untuk mencegah.
     * Yang dibutuhkan pemakainya adalah membuka periode, bukan pembatalan yang
     * setengah jadi.
     */
    const period = await client.query<{ id: string; today: string }>(
      `SELECT id::text, CURRENT_DATE::text AS today
         FROM "${schemaName}".fiscal_period
        WHERE deleted_at IS NULL AND status = 'OPEN'
          AND CURRENT_DATE BETWEEN start_date AND end_date
        ORDER BY period_no
        LIMIT 1
        FOR UPDATE`,
    );
    if (!period.rowCount) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Tidak ada periode akuntansi yang terbuka hari ini, sehingga jurnal pembalik tidak dapat dibentuk. ' +
          'Buka periode berjalan lebih dahulu, lalu ulangi pembatalan ini.',
      );
    }

    const reversal = await client.query<{ id: string }>(
      `INSERT INTO "${schemaName}".journal_entry
         (legal_entity_id, fiscal_period_id, journal_number, journal_date,
          source_type, source_id, posting_key, description, currency_code,
          total_debit, total_credit, status, posted_at, posted_by,
          reversal_of_id, created_by)
       VALUES ($1::uuid, $2::uuid, $3, CURRENT_DATE,
               $4, $5::uuid, $6, $7, $8,
               $9, $10, 'POSTED', now(), $11::uuid,
               $12::uuid, $11::uuid)
       RETURNING id::text`,
      [
        e.legal_entity_id,
        period.rows[0].id,
        reversalJournalNumber(period.rows[0].today, eventId),
        e.source_type,
        e.source_id,
        postingKey,
        `PEMBALIK ${e.event_code} ${e.source_number ?? e.source_id} — ${ctx.reason}`,
        e.currency_code,
        total.totalDebit,
        total.totalCredit,
        ctx.userId,
        e.journal_entry_id,
      ],
    );
    const reversalId = reversal.rows[0].id;

    for (const line of balikan) {
      await client.query(
        `INSERT INTO "${schemaName}".journal_entry_line
           (journal_entry_id, account_id, line_no, debit, credit, description)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
        [reversalId, line.accountId, line.lineNo, line.debit, line.credit, line.description],
      );
    }

    await client.query(
      `UPDATE "${schemaName}".accounting_event
          SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'reversedAt', now(),
                'reversedBy', $2::text,
                'reversalReason', $3::text,
                'reversalJournalEntryId', $4::text
              ),
              updated_at = now(), updated_by = $2::uuid, version = version + 1
        WHERE id = $1::uuid`,
      [eventId, ctx.userId, ctx.reason, reversalId],
    );

    this.logger.log(
      `Jurnal pembalik dibentuk untuk peristiwa ${eventId} (${e.event_code}) -> ${reversalId}`,
    );
    return { eventId, status: 'REVERSED', journalEntryId: reversalId };
  }

  private markPosted(client: PoolClient, schemaName: string, eventId: string, journalId: string) {
    return client.query(
      `UPDATE "${schemaName}".accounting_event
          SET status = 'POSTED', journal_entry_id = $2::uuid, posted_at = now(),
              failure_reason = NULL, updated_at = now(), version = version + 1
        WHERE id = $1::uuid`,
      [eventId, journalId],
    );
  }

  private markFailedInTransaction(
    client: PoolClient,
    schemaName: string,
    eventId: string,
    reason: string,
  ) {
    return client.query(
      `UPDATE "${schemaName}".accounting_event
          SET status = 'FAILED', failure_reason = $2, retry_count = retry_count + 1,
              updated_at = now(), version = version + 1
        WHERE id = $1::uuid`,
      [eventId, reason.slice(0, 4000)],
    );
  }

  private async markFailed(schemaName: string, eventId: string, reason: string) {
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".accounting_event
          SET status = 'FAILED', failure_reason = $2, retry_count = retry_count + 1,
              updated_at = now(), version = version + 1
        WHERE id = $1::uuid AND status = 'PENDING'`,
      [eventId, reason.slice(0, 4000)],
    );
  }

  private safeFailure(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Kesalahan pemrosesan tidak dikenal.';
    return `POSTING_ERROR: ${message}`.slice(0, 4000);
  }
}
