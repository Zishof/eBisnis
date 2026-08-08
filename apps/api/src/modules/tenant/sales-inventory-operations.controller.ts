import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import type { PoolClient } from 'pg';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  Permissions,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { paritySummary, SALES_INVENTORY_PARITY } from './sales-inventory-parity.catalog';

class AllocationDto {
  @ApiProperty()
  @IsUUID()
  ledgerId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

class CreateSettlementDto {
  @ApiProperty()
  @IsUUID()
  partyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiProperty({ enum: ['CASH', 'TRANSFER', 'GIRO', 'RETURN', 'OTHER'] })
  @IsIn(['CASH', 'TRANSFER', 'GIRO', 'RETURN', 'OTHER'])
  method!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(96)
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  giroDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ type: [AllocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations!: AllocationDto[];
}

class HandoverLineDto {
  @ApiProperty()
  @IsUUID()
  receivableLedgerId!: string;
}

class CreateHandoverDto {
  @ApiProperty()
  @IsUUID()
  salespersonId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  handoverDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ type: [HandoverLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HandoverLineDto)
  lines!: HandoverLineDto[];
}

class ReturnHandoverLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty({ enum: ['RETURNED', 'COLLECTED', 'LOST'] })
  @IsIn(['RETURNED', 'COLLECTED', 'LOST'])
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;
}

class ReturnHandoverDto {
  @ApiProperty({ type: [ReturnHandoverLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnHandoverLineDto)
  lines!: ReturnHandoverLineDto[];
}

class CancelHandoverDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

class ReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}

class PrintLogDto {
  @ApiProperty({ enum: ['PDF', 'EXCEL', 'PRINT', 'CSV'] })
  @IsIn(['PDF', 'EXCEL', 'PRINT', 'CSV'])
  format!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(96)
  documentNumber?: string;
}

class SyncDeviceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  deviceId!: string;

  @ApiProperty({ enum: ['ANDROID', 'WINDOWS', 'WEB'] })
  @IsIn(['ANDROID', 'WINDOWS', 'WEB'])
  platform!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  appVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pendingOutbox?: number;
}

class ResolveConflictDto {
  @ApiProperty({ enum: ['CLIENT_WINS', 'SERVER_WINS', 'MERGED', 'DUPLICATE'] })
  @IsIn(['CLIENT_WINS', 'SERVER_WINS', 'MERGED', 'DUPLICATE'])
  resolution!: string;
}

class CreateStockOpnameDto {
  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  opnameDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CountStockOpnameLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  physicalQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CountStockOpnameDto {
  @ApiProperty({ type: [CountStockOpnameLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CountStockOpnameLineDto)
  lines!: CountStockOpnameLineDto[];
}

class PriceBookLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  minimumQty = 1;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;
}

class CreateInventoryPriceBookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ['TENANT', 'CUSTOMER', 'SUPPLIER'] })
  @IsIn(['TENANT', 'CUSTOMER', 'SUPPLIER'])
  scopeType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scopeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: [PriceBookLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PriceBookLineDto)
  lines!: PriceBookLineDto[];
}

class PriceBookTransitionDto {
  @ApiProperty({ enum: ['SUBMITTED', 'APPROVED', 'REJECTED', 'INACTIVE'] })
  @IsIn(['SUBMITTED', 'APPROVED', 'REJECTED', 'INACTIVE'])
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class JournalLineDto {
  @ApiProperty()
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debit = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credit = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

class CreateInventoryJournalDto {
  @ApiProperty()
  @IsUUID()
  fiscalPeriodId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  journalDate?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ type: [JournalLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

class PeriodCommandDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CreateInventoryAccountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] })
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  category!: string;

  @ApiProperty({ enum: ['DEBIT', 'CREDIT'] })
  @IsIn(['DEBIT', 'CREDIT'])
  normalBalance!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

@ApiTags('sales-inventory-operations')
@ApiBearerAuth('access-token')
@Controller()
export class SalesInventoryOperationsController {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  @Get('inventory/parity-contract')
  @Permissions('SALES.READ')
  @ApiOperation({ summary: 'Kontrak bukti paritas 48 layar untuk Web dan Flutter' })
  parityContract() {
    return { summary: paritySummary(), items: SALES_INVENTORY_PARITY };
  }

  @Get('inventory/party-master-balances/:kind')
  @Permissions('SALES.READ')
  @ApiOperation({ summary: 'Saldo dan beban kerja master pemasok, pelanggan, atau sales' })
  async partyMasterBalances(
    @Param('kind') kind: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const S = quotedSchema(user);
    const sql = partyMasterBalanceSql(kind, S);
    if (!sql) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Jenis master harus suppliers, customers, atau salespeople.',
      );
    }
    return this.tenantDb.query<Record<string, unknown>>(schemaOf(user), sql);
  }

  @Get('inventory/price-books')
  @Permissions('CATALOG_PRICE_BOOK.READ')
  async listInventoryPriceBooks(@CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    return this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT pb.id::text, pb.code, pb.name, pb.description, pb.scope_type,
              pb.scope_id::text, pb.valid_from::text, pb.valid_until::text,
              pb.currency_code, pb.approval_status, pb.approval_note, pb.is_active,
              count(pbi.id)::int AS item_count,
              min(pbi.price)::text AS minimum_price,
              max(pbi.price)::text AS maximum_price
         FROM ${S}.price_book pb
         LEFT JOIN ${S}.price_book_item pbi ON pbi.price_book_id = pb.id AND pbi.deleted_at IS NULL
        WHERE pb.deleted_at IS NULL
        GROUP BY pb.id ORDER BY pb.updated_at DESC, pb.code`,
    );
  }

  @Post('inventory/price-books')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('CATALOG_PRICE_BOOK.CREATE')
  async createInventoryPriceBook(
    @Body() body: CreateInventoryPriceBookDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    if (body.scopeType !== 'TENANT' && !body.scopeId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Customer atau supplier wajib dipilih untuk harga khusus.');
    }
    if (body.validUntil && body.validFrom && body.validUntil < body.validFrom) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Tanggal akhir harga tidak boleh sebelum tanggal mulai.');
    }
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const created = await client.query<{ id: string }>(
        `INSERT INTO ${S}.price_book
           (code, name, description, scope_type, scope_id, valid_from, valid_until,
            is_active, approval_status, created_by, updated_by)
         VALUES (upper($1), $2, $3, $4, $5::uuid, COALESCE($6::date, CURRENT_DATE),
                 $7::date, FALSE, 'DRAFT', $8::uuid, $8::uuid)
         RETURNING id::text`,
        [body.code.trim(), body.name.trim(), body.description ?? null, body.scopeType,
          body.scopeId ?? null, body.validFrom ?? null, body.validUntil ?? null, subjectId],
      );
      for (const line of body.lines) {
        await client.query(
          `INSERT INTO ${S}.price_book_item
             (price_book_id, product_id, uom_id, minimum_qty, price, valid_from, valid_until)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, COALESCE($6::date, CURRENT_DATE), $7::date)`,
          [created.rows[0].id, line.productId, line.uomId ?? null, line.minimumQty, line.price,
            body.validFrom ?? null, body.validUntil ?? null],
        );
      }
      await appendSyncEvent(client, S, subjectId, 'PRICE_BOOK', created.rows[0].id, 'PRICE_BOOK_CREATED', {
        code: body.code.toUpperCase(), scopeType: body.scopeType,
      });
      return { id: created.rows[0].id, code: body.code.toUpperCase(), status: 'DRAFT', itemCount: body.lines.length };
    }, auditOf(user, meta, 'CATALOG_PRICE_BOOK', 'CREATE'));
  }

  @Patch('inventory/price-books/:id/status')
  @BlockDemo()
  @Permissions('CATALOG_PRICE_BOOK.UPDATE')
  async transitionInventoryPriceBook(
    @Param('id') id: string,
    @Body() body: PriceBookTransitionDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const allowed: Record<string, string[]> = {
      DRAFT: ['SUBMITTED'], REJECTED: ['SUBMITTED'], SUBMITTED: ['APPROVED', 'REJECTED'], APPROVED: ['INACTIVE'],
    };
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const current = await client.query<{ approval_status: string; submitted_by: string | null }>(
        `SELECT approval_status, submitted_by::text AS submitted_by
           FROM ${S}.price_book WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE`, [id],
      );
      if (!current.rowCount) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Buku harga tidak ditemukan.');
      if (!(allowed[current.rows[0].approval_status] ?? []).includes(body.status)) {
        throw invalidTransition(`Buku harga ${current.rows[0].approval_status} tidak dapat diubah menjadi ${body.status}.`);
      }
      const subjectId = await subjectIdOf(client, S, user.userId);
      // Pengaju tidak boleh menyetujui pengajuannya sendiri -- aturan yang
      // sama dipakai pembatalan dan refund POS. Ditegakkan di sini dengan
      // pesan yang jelas, dan sekali lagi oleh constraint
      // `price_book_no_self_approval` (V055) bila jalan lain lupa memeriksa.
      if (body.status === 'APPROVED' && current.rows[0].submitted_by === subjectId) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak dapat menyetujui pengajuan buku harga Anda sendiri. Mintakan kepada supervisor lain.',
        );
      }
      await client.query(
        `UPDATE ${S}.price_book
            SET approval_status = $2, approval_note = $3,
                submitted_at = CASE WHEN $2 = 'SUBMITTED' THEN now() ELSE submitted_at END,
                submitted_by = CASE WHEN $2 = 'SUBMITTED' THEN $4::uuid ELSE submitted_by END,
                approved_at = CASE WHEN $2 = 'APPROVED' THEN now() ELSE approved_at END,
                approved_by = CASE WHEN $2 = 'APPROVED' THEN $4::uuid ELSE approved_by END,
                rejected_at = CASE WHEN $2 = 'REJECTED' THEN now() ELSE rejected_at END,
                rejected_by = CASE WHEN $2 = 'REJECTED' THEN $4::uuid ELSE rejected_by END,
                is_active = ($2 = 'APPROVED'), updated_at = now(), updated_by = $4::uuid, version = version + 1
          WHERE id = $1::uuid`,
        [id, body.status, body.note ?? null, subjectId],
      );
      await appendSyncEvent(client, S, subjectId, 'PRICE_BOOK', id, `PRICE_BOOK_${body.status}`, { note: body.note ?? null });
      return { id, status: body.status };
    }, auditOf(user, meta, 'CATALOG_PRICE_BOOK', body.status));
  }

  @Get('inventory/finance-workspace')
  @Permissions('FINANCE_JOURNAL.READ')
  async financeWorkspace(@CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    const [accounts, periods, journals, closeRuns, accountingEvents] = await Promise.all([
      this.tenantDb.query<Record<string, unknown>>(schemaOf(user),
        `SELECT coa.id::text, coa.code, coa.name, coa.account_type_id::text,
                at.category AS account_type, coa.normal_balance, coa.allow_posting
           FROM ${S}.chart_of_account coa
           LEFT JOIN ${S}.account_type at ON at.id = coa.account_type_id
          WHERE coa.deleted_at IS NULL AND coa.is_active ORDER BY coa.code`),
      this.tenantDb.query<Record<string, unknown>>(schemaOf(user),
        `SELECT id::text, code, name, fiscal_year, period_no, start_date::text, end_date::text, status
           FROM ${S}.fiscal_period WHERE deleted_at IS NULL ORDER BY start_date DESC LIMIT 36`),
      this.tenantDb.query<Record<string, unknown>>(schemaOf(user),
        `SELECT je.id::text, je.journal_number, je.journal_date::text, je.description, je.status,
                je.total_debit::text, je.total_credit::text, je.reversal_of_id::text
           FROM ${S}.journal_entry je ORDER BY je.journal_date DESC, je.created_at DESC LIMIT 200`),
      this.tenantDb.query<Record<string, unknown>>(schemaOf(user),
        `SELECT r.id::text, r.run_number, r.status, r.validation_result, r.started_at::text,
                r.completed_at::text, fp.code AS period_code
           FROM ${S}.inventory_period_close_run r JOIN ${S}.fiscal_period fp ON fp.id = r.fiscal_period_id
          ORDER BY r.started_at DESC LIMIT 50`),
      this.tenantDb.query<Record<string, unknown>>(schemaOf(user),
        `SELECT ae.id::text, ae.event_code, ae.source_type, ae.source_number,
                ae.occurred_at::text, ae.status, ae.failure_reason, ae.retry_count,
                ae.journal_entry_id::text, je.journal_number
           FROM ${S}.accounting_event ae
           LEFT JOIN ${S}.journal_entry je ON je.id = ae.journal_entry_id
          ORDER BY CASE ae.status WHEN 'FAILED' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
                   ae.occurred_at DESC
          LIMIT 100`),
    ]);
    return { accounts, periods, journals, closeRuns, accountingEvents };
  }

  @Post('inventory/chart-accounts')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('FINANCE_COA.CREATE')
  async createInventoryAccount(
    @Body() body: CreateInventoryAccountDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const typeCode = `INVENTORY_${body.category}`;
      const type = await client.query<{ id: string }>(
        `INSERT INTO ${S}.account_type
           (code, name, description, normal_balance, category, is_system, created_by)
         VALUES ($1, $2, $3, $4, $5, FALSE, $6::uuid)
         ON CONFLICT (code) WHERE deleted_at IS NULL
         DO UPDATE SET name = EXCLUDED.name, normal_balance = EXCLUDED.normal_balance,
                       category = EXCLUDED.category, updated_at = now(), version = ${S}.account_type.version + 1
         RETURNING id::text`,
        [typeCode, body.category, 'Tipe akun Inventory/Sales', body.normalBalance, body.category, subjectId],
      );
      const account = await client.query<Record<string, unknown>>(
        `INSERT INTO ${S}.chart_of_account
           (account_type_id, code, name, description, normal_balance, allow_posting, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5, TRUE, $6::uuid)
         RETURNING id::text, code, name, normal_balance, allow_posting`,
        [type.rows[0].id, body.code.trim(), body.name.trim(), body.description ?? null, body.normalBalance, subjectId],
      );
      await appendSyncEvent(client, S, subjectId, 'CHART_OF_ACCOUNT', account.rows[0].id as string, 'ACCOUNT_CREATED', {
        code: body.code.trim(), category: body.category,
      });
      return { ...account.rows[0], account_type: body.category, account_type_id: type.rows[0].id };
    }, auditOf(user, meta, 'FINANCE_COA', 'CREATE'));
  }

  @Post('inventory/journals')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('FINANCE_JOURNAL.CREATE')
  async createInventoryJournal(
    @Body() body: CreateInventoryJournalDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    if (!meta.idempotencyKey) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Header Idempotency-Key wajib untuk jurnal.');
    }
    const debit = body.lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = body.lines.reduce((sum, line) => sum + line.credit, 0);
    if (debit <= 0 || Math.abs(debit - credit) > 0.0001 || body.lines.some((line) => (line.debit > 0) === (line.credit > 0))) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Jurnal harus seimbang dan setiap baris hanya berisi debit atau kredit.');
    }
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const existing = await client.query<Record<string, unknown>>(
        `SELECT id::text, journal_number, status FROM ${S}.journal_entry WHERE posting_key = $1`, [meta.idempotencyKey],
      );
      if (existing.rowCount) return { ...existing.rows[0], idempotent: true };
      const date = body.journalDate ?? new Date().toISOString().slice(0, 10);
      const period = await client.query(
        `SELECT id FROM ${S}.fiscal_period WHERE id = $1::uuid AND status = 'OPEN'
          AND $2::date BETWEEN start_date AND end_date FOR UPDATE`, [body.fiscalPeriodId, date],
      );
      if (!period.rowCount) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Periode tidak terbuka atau tanggal jurnal berada di luar periode.');
      const subjectId = await subjectIdOf(client, S, user.userId);
      const number = `JRN-${date.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
      const created = await client.query<{ id: string }>(
        `INSERT INTO ${S}.journal_entry
           (fiscal_period_id, journal_number, journal_date, source_type, posting_key, description,
            total_debit, total_credit, status, created_by)
         VALUES ($1::uuid, $2, $3::date, 'INVENTORY_MANUAL', $4, $5, $6, $7, 'DRAFT', $8::uuid)
         RETURNING id::text`,
        [body.fiscalPeriodId, number, date, meta.idempotencyKey, body.description, debit, credit, subjectId],
      );
      for (const [index, line] of body.lines.entries()) {
        await client.query(
          `INSERT INTO ${S}.journal_entry_line
             (journal_entry_id, account_id, line_no, debit, credit, description)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
          [created.rows[0].id, line.accountId, index + 1, line.debit, line.credit, line.description ?? null],
        );
      }
      return { id: created.rows[0].id, journalNumber: number, status: 'DRAFT', totalDebit: debit.toString(), idempotent: false };
    }, auditOf(user, meta, 'FINANCE_JOURNAL', 'CREATE'));
  }

  @Post('inventory/journals/:id/post')
  @BlockDemo()
  @Permissions('FINANCE_JOURNAL.POST')
  async postInventoryJournal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const changed = await client.query(
        `UPDATE ${S}.journal_entry je SET status = 'POSTED', posted_at = now(), posted_by = $2::uuid,
                updated_at = now(), version = version + 1
          WHERE je.id = $1::uuid AND je.status = 'DRAFT' AND je.total_debit = je.total_credit
            AND je.total_debit > 0
            AND EXISTS (SELECT 1 FROM ${S}.fiscal_period fp WHERE fp.id = je.fiscal_period_id AND fp.status = 'OPEN')
          RETURNING je.id`, [id, subjectId],
      );
      if (!changed.rowCount) throw invalidTransition('Jurnal harus seimbang, masih draft, dan periodenya terbuka.');
      await appendSyncEvent(client, S, subjectId, 'JOURNAL', id, 'JOURNAL_POSTED', {});
      return { id, status: 'POSTED' };
    }, auditOf(user, meta, 'FINANCE_JOURNAL', 'POST'));
  }

  @Post('inventory/journals/:id/reverse')
  @BlockDemo()
  @Permissions('FINANCE_JOURNAL.REVERSE')
  async reverseInventoryJournal(
    @Param('id') id: string,
    @Body() body: PeriodCommandDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const original = await client.query<Record<string, unknown>>(
        `SELECT je.* FROM ${S}.journal_entry je
          JOIN ${S}.fiscal_period fp ON fp.id = je.fiscal_period_id AND fp.status = 'OPEN'
         WHERE je.id = $1::uuid AND je.status = 'POSTED' FOR UPDATE`, [id],
      );
      if (!original.rowCount) throw invalidTransition('Hanya jurnal posted pada periode terbuka yang dapat dibalik.');
      const subjectId = await subjectIdOf(client, S, user.userId);
      const number = `REV-${Date.now().toString(36).toUpperCase()}`;
      const reversal = await client.query<{ id: string }>(
        `INSERT INTO ${S}.journal_entry
           (legal_entity_id, fiscal_period_id, journal_number, journal_date, source_type, source_id,
            posting_key, description, currency_code, exchange_rate, total_debit, total_credit,
            status, posted_at, posted_by, reversal_of_id, created_by)
         SELECT legal_entity_id, fiscal_period_id, $2, CURRENT_DATE, 'INVENTORY_REVERSAL', id,
                $3, $4, currency_code, exchange_rate, total_credit, total_debit,
                'POSTED', now(), $5::uuid, id, $5::uuid
           FROM ${S}.journal_entry WHERE id = $1::uuid RETURNING id::text`,
        [id, number, `REVERSAL:${id}`, body.note ?? `Pembalikan jurnal ${id}`, subjectId],
      );
      await client.query(
        `INSERT INTO ${S}.journal_entry_line
           (journal_entry_id, account_id, line_no, debit, credit, description, dimensions)
         SELECT $2::uuid, account_id, line_no, credit, debit, COALESCE($3, description), dimensions
           FROM ${S}.journal_entry_line WHERE journal_entry_id = $1::uuid ORDER BY line_no`,
        [id, reversal.rows[0].id, body.note ?? null],
      );
      await appendSyncEvent(client, S, subjectId, 'JOURNAL', id, 'JOURNAL_REVERSED', { reversalId: reversal.rows[0].id });
      return { id: reversal.rows[0].id, journalNumber: number, status: 'POSTED', reversalOfId: id };
    }, auditOf(user, meta, 'FINANCE_JOURNAL', 'REVERSE'));
  }

  @Post('inventory/fiscal-periods/:id/close')
  @BlockDemo()
  @Permissions('FINANCE_JOURNAL.CLOSE_PERIOD')
  closeInventoryPeriod(
    @Param('id') id: string,
    @Body() body: PeriodCommandDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.changeInventoryPeriod(id, 'CLOSE', body.note, user, meta);
  }

  @Post('inventory/fiscal-periods/:id/reopen')
  @BlockDemo()
  @Permissions('FINANCE_JOURNAL.REOPEN')
  reopenInventoryPeriod(
    @Param('id') id: string,
    @Body() body: PeriodCommandDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.changeInventoryPeriod(id, 'REOPEN', body.note, user, meta);
  }

  @Get('stock-opnames')
  @Permissions('INVENTORY_STOCK_COUNT.READ')
  async listStockOpnames(@CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    const [warehouses, sessions] = await Promise.all([
      this.tenantDb.query<Record<string, unknown>>(
        schemaOf(user),
        `SELECT id::text, code, name FROM ${S}.warehouse
          WHERE deleted_at IS NULL AND is_active ORDER BY name`,
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schemaOf(user),
        `SELECT o.id::text, o.opname_number, o.opname_date::text, o.status, o.note,
                w.code AS warehouse_code, w.name AS warehouse_name,
                count(l.id)::int AS line_count,
                count(l.id) FILTER (WHERE l.physical_qty IS NOT NULL)::int AS counted_count,
                COALESCE(sum(l.variance_qty * l.unit_cost), 0)::text AS variance_value
           FROM ${S}.inventory_stock_opname_session o
           JOIN ${S}.warehouse w ON w.id = o.warehouse_id
           LEFT JOIN ${S}.inventory_stock_opname_line l ON l.opname_id = o.id
          GROUP BY o.id, w.code, w.name ORDER BY o.opname_date DESC, o.created_at DESC LIMIT 200`,
      ),
    ]);
    return { warehouses, sessions };
  }

  @Get('stock-opnames/:id')
  @Permissions('INVENTORY_STOCK_COUNT.READ')
  async stockOpnameDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    const header = await this.tenantDb.queryOne<Record<string, unknown>>(
      schemaOf(user),
      `SELECT o.*, o.id::text, w.code AS warehouse_code, w.name AS warehouse_name
         FROM ${S}.inventory_stock_opname_session o JOIN ${S}.warehouse w ON w.id = o.warehouse_id
        WHERE o.id = $1::uuid`,
      [id],
    );
    if (!header) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Stock opname tidak ditemukan.');
    const lines = await this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT l.id::text, p.code AS product_code, p.name AS product_name, u.code AS uom_code,
              lot.lot_number, lot.expiry_date::text, l.system_qty::text, l.physical_qty::text,
              l.variance_qty::text, l.unit_cost::text, (l.variance_qty * l.unit_cost)::text AS variance_value,
              l.note
         FROM ${S}.inventory_stock_opname_line l JOIN ${S}.product p ON p.id = l.product_id
         JOIN ${S}.uom u ON u.id = l.uom_id LEFT JOIN ${S}.inventory_lot lot ON lot.id = l.lot_id
        WHERE l.opname_id = $1::uuid ORDER BY p.code, lot.expiry_date NULLS LAST`,
      [id],
    );
    const custodyEvents = await this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT e.id::text, e.event_type, e.from_status, e.to_status,
              e.occurred_at::text, e.metadata, us.name AS actor_name
         FROM ${S}.sales_note_custody_event e
         JOIN ${S}.user_subject us ON us.id = e.actor_id
        WHERE e.handover_id = $1::uuid
        ORDER BY e.occurred_at, e.id`,
      [id],
    );
    return { ...header, lines, custody_events: custodyEvents };
  }

  @Post('stock-opnames')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.CREATE')
  createStockOpname(
    @Body() body: CreateStockOpnameDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const number = `OPN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
      const header = await client.query<{ id: string }>(
        `INSERT INTO ${S}.inventory_stock_opname_session
           (opname_number, warehouse_id, opname_date, note, created_by)
         VALUES ($1, $2::uuid, COALESCE($3::date, CURRENT_DATE), $4, $5::uuid)
         RETURNING id::text`,
        [number, body.warehouseId, body.opnameDate ?? null, body.note ?? null, subjectId],
      );
      await client.query(
        `INSERT INTO ${S}.inventory_stock_opname_line
           (opname_id, product_id, uom_id, lot_id, bin_id, system_qty, unit_cost)
         SELECT $1::uuid, sb.product_id, p.base_uom_id, sb.lot_id, sb.bin_id,
                sb.on_hand_qty, sb.average_cost
           FROM ${S}.stock_balance sb JOIN ${S}.product p ON p.id = sb.product_id
          WHERE sb.warehouse_id = $2::uuid`,
        [header.rows[0].id, body.warehouseId],
      );
      return { id: header.rows[0].id, opnameNumber: number, status: 'DRAFT' };
    }, auditOf(user, meta, 'STOCK_OPNAME', 'CREATE'));
  }

  @Patch('stock-opnames/:id')
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.CREATE')
  countStockOpname(
    @Param('id') id: string,
    @Body() body: CountStockOpnameDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const session = await client.query<{ status: string }>(
        `SELECT status FROM ${S}.inventory_stock_opname_session WHERE id = $1::uuid FOR UPDATE`,
        [id],
      );
      if (!session.rowCount || !['DRAFT', 'FROZEN', 'COUNTED'].includes(session.rows[0].status)) {
        throw invalidTransition('Stock opname tidak dapat dihitung pada status ini.');
      }
      const subjectId = await subjectIdOf(client, S, user.userId);
      for (const line of body.lines) {
        const updated = await client.query(
          `UPDATE ${S}.inventory_stock_opname_line
              SET physical_qty = $3, note = $4, counted_at = now(), counted_by = $5::uuid
            WHERE id = $1::uuid AND opname_id = $2::uuid`,
          [line.lineId, id, line.physicalQty, line.note ?? null, subjectId],
        );
        if (!updated.rowCount) throw AppError.notFound(ErrorCodes.NOT_FOUND, `Baris opname ${line.lineId} tidak ditemukan.`);
      }
      const pending = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${S}.inventory_stock_opname_line
          WHERE opname_id = $1::uuid AND physical_qty IS NULL`,
        [id],
      );
      const next = pending.rows[0].count === 0 ? 'COUNTED' : session.rows[0].status;
      await client.query(
        `UPDATE ${S}.inventory_stock_opname_session SET status = $2, updated_at = now(), version = version + 1
          WHERE id = $1::uuid`,
        [id, next],
      );
      return { id, status: next, pending: pending.rows[0].count };
    }, auditOf(user, meta, 'STOCK_OPNAME', 'COUNT'));
  }

  @Post('stock-opnames/:id/freeze')
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.CREATE')
  freezeStockOpname(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.transitionStockOpname(id, 'DRAFT', 'FROZEN', user, meta);
  }

  @Post('stock-opnames/:id/approve')
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.POST')
  approveStockOpname(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.transitionStockOpname(id, 'COUNTED', 'APPROVED', user, meta);
  }

  @Post('stock-opnames/:id/post')
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.POST')
  postStockOpname(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const header = await client.query<{ warehouse_id: string; opname_number: string }>(
        `SELECT warehouse_id::text, opname_number FROM ${S}.inventory_stock_opname_session
          WHERE id = $1::uuid AND status = 'APPROVED' FOR UPDATE`,
        [id],
      );
      if (!header.rowCount) throw invalidTransition('Stock opname harus APPROVED sebelum diposting.');
      const subjectId = await subjectIdOf(client, S, user.userId);
      const lines = await client.query<{
        id: string; product_id: string; uom_id: string; lot_id: string | null; bin_id: string | null;
        variance_qty: string; unit_cost: string;
      }>(
        `SELECT id::text, product_id::text, uom_id::text, lot_id::text, bin_id::text,
                variance_qty::text, unit_cost::text
           FROM ${S}.inventory_stock_opname_line WHERE opname_id = $1::uuid AND variance_qty <> 0`,
        [id],
      );
      for (const line of lines.rows) {
        const variance = Number(line.variance_qty);
        await client.query(
          `INSERT INTO ${S}.stock_movement
             (movement_number, movement_type, product_id, uom_id, lot_id, quantity, unit_cost,
              source_warehouse_id, source_bin_id, destination_warehouse_id, destination_bin_id,
              reference_type, reference_id, reference_number, posting_key, created_by, note)
           VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7,
             CASE WHEN $6 < 0 THEN $8::uuid END, CASE WHEN $6 < 0 THEN $9::uuid END,
             CASE WHEN $6 > 0 THEN $8::uuid END, CASE WHEN $6 > 0 THEN $9::uuid END,
             'STOCK_OPNAME', $10::uuid, $11, $12, $13::uuid, 'Selisih stock opname')`,
          [`${header.rows[0].opname_number}-${line.id.slice(0, 8)}`,
            variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', line.product_id, line.uom_id,
            line.lot_id, Math.abs(variance), line.unit_cost, header.rows[0].warehouse_id,
            line.bin_id, id, header.rows[0].opname_number, `STOCK_OPNAME:${id}:${line.id}`, subjectId],
        );
        await client.query(
          `UPDATE ${S}.stock_balance SET on_hand_qty = on_hand_qty + $5,
                  available_qty = available_qty + $5, updated_at = now(), version = version + 1
            WHERE warehouse_id = $1::uuid AND product_id = $2::uuid
              AND lot_id IS NOT DISTINCT FROM $3::uuid AND bin_id IS NOT DISTINCT FROM $4::uuid`,
          [header.rows[0].warehouse_id, line.product_id, line.lot_id, line.bin_id, variance],
        );
      }
      await client.query(
        `UPDATE ${S}.inventory_stock_opname_session SET status = 'POSTED', posted_at = now(),
                posted_by = $2::uuid, updated_at = now(), version = version + 1 WHERE id = $1::uuid`,
        [id, subjectId],
      );
      return { id, status: 'POSTED', movementCount: lines.rowCount };
    }, auditOf(user, meta, 'STOCK_OPNAME', 'POST'));
  }

  @Get('ap/payments')
  @Permissions('SALES.READ')
  listApPayments(@CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    return this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT p.id::text, p.payment_number, p.payment_date::text, p.method,
              p.total_amount::text, p.status, p.reference_number, p.bank_name,
              s.code AS supplier_code, s.name AS supplier_name, p.created_at::text
         FROM ${S}.inventory_ap_payment p
         JOIN ${S}.supplier s ON s.id = p.supplier_id
        ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 500`,
    );
  }

  @Get('inventory/supplier-workspace')
  @Permissions('PURCHASE_ORDER.READ')
  @ApiOperation({ summary: 'Workspace supplier terintegrasi untuk Web dan Flutter' })
  async supplierWorkspace(@CurrentUser() user: AuthenticatedUser) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    const [suppliers, purchases, payables, payments, topProducts] = await Promise.all([
      this.tenantDb.query<Record<string, unknown>>(
        schema,
        `SELECT s.id::text, s.code, s.name, s.tax_number, s.contact_person, s.phone, s.email,
                s.currency_code, s.lead_time_days, s.rating::text, s.is_blacklisted, s.is_active,
                s.legacy_payment_days, s.address_text, s.region_name, s.bank_account_number,
                s.bank_account_name, s.bank_name, s.bank_address, s.updated_at::text,
                COALESCE(debt.outstanding, 0)::text AS payable_balance,
                COALESCE(debt.document_count, 0)::int AS payable_document_count,
                COALESCE(po.purchase_count, 0)::int AS purchase_count,
                COALESCE(po.purchase_ytd, 0)::text AS purchase_ytd,
                po.last_purchase::text,
                COALESCE(pay.payment_ytd, 0)::text AS payment_ytd
           FROM ${S}.supplier s
           LEFT JOIN LATERAL (
             SELECT sum(GREATEST(abs(l.amount) - COALESCE(a.allocated, 0), 0)) AS outstanding,
                    count(*) FILTER (WHERE GREATEST(abs(l.amount) - COALESCE(a.allocated, 0), 0) > 0) AS document_count
               FROM ${S}.legacy_payable_ledger l
               LEFT JOIN LATERAL (
                 SELECT sum(pa.allocated_amount) AS allocated
                   FROM ${S}.inventory_ap_payment_allocation pa
                   JOIN ${S}.inventory_ap_payment p ON p.id = pa.payment_id AND p.status = 'POSTED'
                  WHERE pa.payable_ledger_id = l.id
               ) a ON TRUE
              WHERE l.supplier_id = s.id
           ) debt ON TRUE
           LEFT JOIN LATERAL (
             SELECT count(*) AS purchase_count,
                    sum(po.grand_total) FILTER (WHERE po.order_date >= date_trunc('year', CURRENT_DATE)) AS purchase_ytd,
                    max(po.order_date) AS last_purchase
               FROM ${S}.purchase_order po
              WHERE po.supplier_id = s.id AND po.deleted_at IS NULL
           ) po ON TRUE
           LEFT JOIN LATERAL (
             SELECT sum(p.total_amount) FILTER (WHERE p.payment_date >= date_trunc('year', CURRENT_DATE)
                                                AND p.status = 'POSTED') AS payment_ytd
               FROM ${S}.inventory_ap_payment p WHERE p.supplier_id = s.id
           ) pay ON TRUE
          WHERE s.deleted_at IS NULL
          ORDER BY s.name`,
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schema,
        `SELECT po.id::text, po.supplier_id::text, s.code AS supplier_code, s.name AS supplier_name,
                po.purchase_order_number, po.order_date::text, po.expected_date::text,
                po.subtotal::text, po.discount_total::text, po.tax_total::text,
                po.grand_total::text, po.status, w.name AS warehouse_name
           FROM ${S}.purchase_order po
           JOIN ${S}.supplier s ON s.id = po.supplier_id
           JOIN ${S}.warehouse w ON w.id = po.warehouse_id
          WHERE po.deleted_at IS NULL
          ORDER BY po.order_date DESC, po.created_at DESC LIMIT 1000`,
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schema,
        `SELECT l.id::text, l.supplier_id::text, s.code AS supplier_code, s.name AS supplier_name,
                l.legacy_invoice_number, l.transaction_date::text, l.due_date::text, l.paid_at::text,
                abs(l.amount)::text AS original_amount,
                GREATEST(abs(l.amount) - COALESCE(a.allocated, 0), 0)::text AS outstanding_amount,
                l.payment_note, l.bank_name,
                CASE
                  WHEN GREATEST(abs(l.amount) - COALESCE(a.allocated, 0), 0) <= 0 THEN 'LUNAS'
                  WHEN l.due_date IS NULL OR l.due_date >= CURRENT_DATE THEN 'BELUM JATUH TEMPO'
                  WHEN CURRENT_DATE - l.due_date <= 30 THEN '1-30 HARI'
                  WHEN CURRENT_DATE - l.due_date <= 60 THEN '31-60 HARI'
                  ELSE '> 60 HARI'
                END AS aging_bucket,
                CASE WHEN l.due_date IS NULL THEN NULL ELSE (CURRENT_DATE - l.due_date)::int END AS age_days
           FROM ${S}.legacy_payable_ledger l
           LEFT JOIN ${S}.supplier s ON s.id = l.supplier_id
           LEFT JOIN LATERAL (
             SELECT sum(pa.allocated_amount) AS allocated
               FROM ${S}.inventory_ap_payment_allocation pa
               JOIN ${S}.inventory_ap_payment p ON p.id = pa.payment_id AND p.status = 'POSTED'
              WHERE pa.payable_ledger_id = l.id
           ) a ON TRUE
          ORDER BY l.transaction_date DESC NULLS LAST, l.created_at DESC LIMIT 2000`,
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schema,
        `SELECT p.id::text, p.supplier_id::text, s.code AS supplier_code, s.name AS supplier_name,
                p.payment_number, p.payment_date::text, p.method, p.total_amount::text,
                p.status, p.reference_number, p.bank_name, p.created_at::text
           FROM ${S}.inventory_ap_payment p
           JOIN ${S}.supplier s ON s.id = p.supplier_id
          ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 1000`,
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schema,
        `SELECT po.supplier_id::text, s.name AS supplier_name, p.id::text AS product_id,
                p.code AS product_code, p.name AS product_name, u.code AS uom,
                sum(pol.ordered_qty)::text AS total_qty, sum(pol.line_total)::text AS total_value,
                max(po.order_date)::text AS last_purchase
           FROM ${S}.purchase_order_line pol
           JOIN ${S}.purchase_order po ON po.id = pol.purchase_order_id AND po.deleted_at IS NULL
           JOIN ${S}.supplier s ON s.id = po.supplier_id
           JOIN ${S}.product p ON p.id = pol.product_id
           JOIN ${S}.uom u ON u.id = pol.uom_id
          GROUP BY po.supplier_id, s.name, p.id, u.code
          ORDER BY sum(pol.line_total) DESC LIMIT 500`,
      ),
    ]);
    const numberOf = (row: Record<string, unknown>, key: string) => Number(row[key] ?? 0);
    const outstanding = payables.reduce((sum, row) => sum + numberOf(row, 'outstanding_amount'), 0);
    const purchasesMonth = purchases
      .filter((row) => String(row.order_date ?? '').slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((sum, row) => sum + numberOf(row, 'grand_total'), 0);
    const paymentsMonth = payments
      .filter((row) => row.status === 'POSTED'
        && String(row.payment_date ?? '').slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((sum, row) => sum + numberOf(row, 'total_amount'), 0);
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        total: suppliers.length,
        active: suppliers.filter((row) => row.is_active !== false).length,
        inactive: suppliers.filter((row) => row.is_active === false).length,
        withPayables: suppliers.filter((row) => numberOf(row, 'payable_balance') > 0).length,
        outstanding: outstanding.toString(),
        purchasesMonth: purchasesMonth.toString(),
        paymentsMonth: paymentsMonth.toString(),
      },
      suppliers,
      purchases,
      payables,
      payments,
      topProducts,
    };
  }

  @Post('ap/payments')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  createApPayment(
    @Body() body: CreateSettlementDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.createSettlement('AP', body, user, meta);
  }

  @Post('ap/payments/:id/post')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  postApPayment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.transitionSettlement('AP', id, 'POST', user, meta);
  }

  @Post('ap/payments/:id/reverse')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  reverseApPayment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.transitionSettlement('AP', id, 'REVERSE', user, meta);
  }

  @Get('ar/receipts')
  @Permissions('SALES.READ')
  listArReceipts(@CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    return this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT r.id::text, r.receipt_number, r.receipt_date::text, r.method,
              r.total_amount::text, r.status, r.reference_number, r.bank_name,
              c.code AS customer_code, c.name AS customer_name, r.created_at::text
         FROM ${S}.inventory_ar_receipt r
         JOIN ${S}.customer c ON c.id = r.customer_id
        ORDER BY r.receipt_date DESC, r.created_at DESC LIMIT 500`,
    );
  }

  @Post('ar/receipts')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  createArReceipt(
    @Body() body: CreateSettlementDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.createSettlement('AR', body, user, meta);
  }

  @Post('ar/receipts/:id/post')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  postArReceipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.transitionSettlement('AR', id, 'POST', user, meta);
  }

  @Post('ar/receipts/:id/reverse')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  reverseArReceipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.transitionSettlement('AR', id, 'REVERSE', user, meta);
  }

  @Get('sales-note-handovers')
  @Permissions('SALES.READ')
  listHandovers(@Query('status') status: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    return this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT h.id::text, h.handover_number, h.handover_date::text, h.status,
              h.note, us.name AS salesperson_name, count(l.id)::int AS invoice_count,
              COALESCE(sum(l.outstanding_amount), 0)::text AS outstanding_amount,
              h.created_at::text
         FROM ${S}.sales_note_handover h
         JOIN ${S}.user_subject us ON us.id = h.salesperson_id
         LEFT JOIN ${S}.sales_note_handover_line l ON l.handover_id = h.id
        WHERE ($1::text IS NULL OR h.status = $1)
        GROUP BY h.id, us.name
        ORDER BY h.handover_date DESC, h.created_at DESC LIMIT 500`,
      [status || null],
    );
  }

  @Get('sales-note-handovers/:id')
  @Permissions('SALES.READ')
  async handoverDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    const header = await this.tenantDb.queryOne<Record<string, unknown>>(
      schemaOf(user),
      `SELECT h.*, h.id::text, us.name AS salesperson_name
         FROM ${S}.sales_note_handover h
         JOIN ${S}.user_subject us ON us.id = h.salesperson_id
        WHERE h.id = $1::uuid`,
      [id],
    );
    if (!header) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Serah-terima nota tidak ditemukan.');
    const lines = await this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT id::text, invoice_number, customer_name, invoice_date::text,
              due_date::text, outstanding_amount::text, territory_code, status,
              returned_amount::text, collected_amount::text, collection_note
         FROM ${S}.sales_note_handover_line WHERE handover_id = $1::uuid
        ORDER BY due_date, invoice_number`,
      [id],
    );
    return { ...header, lines };
  }

  @Get('sales-note-handovers/:id/print-data')
  @Permissions('SALES.READ')
  async handoverPrintData(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const detail = await this.handoverDetail(id, user);
    return {
      document_type: 'SALES_NOTE_HANDOVER',
      generated_at: new Date().toISOString(),
      ...detail,
    };
  }

  @Post('sales-note-handovers')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  createHandover(
    @Body() body: CreateHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    const uniqueIds = [...new Set(body.lines.map((line) => line.receivableLedgerId))];
    if (uniqueIds.length !== body.lines.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nota yang sama tidak boleh dimasukkan dua kali.');
    }
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const ledgers = await client.query<{
        id: string; legacy_invoice_number: string; transaction_date: string | null;
        due_date: string | null; amount: string; customer_name: string; territory_code: string | null;
      }>(
        `SELECT lr.id::text, lr.legacy_invoice_number, lr.transaction_date::text,
                lr.due_date::text, lr.amount::text, COALESCE(c.name, 'Customer legacy') AS customer_name,
                c.metadata->>'legacy_area_code' AS territory_code
           FROM ${S}.legacy_receivable_ledger lr
           LEFT JOIN ${S}.customer c ON c.id = lr.customer_id
          WHERE lr.id = ANY($1::uuid[])
            AND NOT lr.is_settled
            AND lr.amount > 0
            AND (lr.salesperson_id IS NULL OR lr.salesperson_id = $2::uuid)
            AND NOT EXISTS (
              SELECT 1
                FROM ${S}.sales_note_handover_line existing_line
                JOIN ${S}.sales_note_handover existing_header
                  ON existing_header.id = existing_line.handover_id
               WHERE existing_line.receivable_ledger_id = lr.id
                 AND existing_header.status IN ('DRAFT', 'HANDED_OVER')
            )
          FOR UPDATE OF lr`,
        [uniqueIds, body.salespersonId],
      );
      if (ledgers.rowCount !== uniqueIds.length) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Sebagian nota tidak ditemukan, sudah lunas, berbeda sales, atau sedang berada dalam paket custody aktif.',
        );
      }
      const handoverNumber = `NOTA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
      const created = await client.query<{ id: string; handover_number: string }>(
        `INSERT INTO ${S}.sales_note_handover
           (handover_number, salesperson_id, handover_date, note, created_by)
         VALUES ($1, $2::uuid, COALESCE($3::date, CURRENT_DATE), $4, $5::uuid)
         RETURNING id::text, handover_number`,
        [handoverNumber, body.salespersonId, body.handoverDate ?? null, body.note ?? null, subjectId],
      );
      for (const row of ledgers.rows) {
        await client.query(
          `INSERT INTO ${S}.sales_note_handover_line
             (handover_id, receivable_ledger_id, invoice_number, customer_name,
              invoice_date, due_date, outstanding_amount, territory_code)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5::date, $6::date, $7, $8)`,
          [created.rows[0].id, row.id, row.legacy_invoice_number, row.customer_name,
            row.transaction_date, row.due_date, row.amount, row.territory_code],
        );
      }
      await client.query(
        `INSERT INTO ${S}.sales_note_custody_event
           (handover_id, event_type, from_status, to_status, actor_id, metadata)
         VALUES ($1::uuid, 'CREATED', NULL, 'DRAFT', $2::uuid, $3::jsonb)`,
        [created.rows[0].id, subjectId, JSON.stringify({ invoiceCount: ledgers.rowCount })],
      );
      return created.rows[0];
    }, auditOf(user, meta, 'SALES_NOTE_HANDOVER', 'CREATE'));
  }

  @Post('sales-note-handovers/:id/handover')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  handover(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.transitionHandover(id, 'DRAFT', 'HANDED_OVER', user, meta);
  }

  @Post('sales-note-handovers/:id/return')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  returnHandover(
    @Param('id') id: string,
    @Body() body: ReturnHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const changed = await client.query(
        `UPDATE ${S}.sales_note_handover
            SET status = 'RETURNED', returned_at = now(), returned_by = $2::uuid,
                updated_at = now(), version = version + 1
          WHERE id = $1::uuid AND status = 'HANDED_OVER' RETURNING id`,
        [id, subjectId],
      );
      if (!changed.rowCount) throw invalidTransition('Nota hanya dapat dikembalikan setelah diserahterimakan.');
      for (const line of body.lines) {
        const amount = line.amount ?? 0;
        const updated = await client.query(
          `UPDATE ${S}.sales_note_handover_line
              SET status = $3,
                  returned_amount = CASE WHEN $3 = 'RETURNED' THEN $4 ELSE returned_amount END,
                  collected_amount = CASE WHEN $3 = 'COLLECTED' THEN $4 ELSE collected_amount END
            WHERE id = $1::uuid AND handover_id = $2::uuid`,
          [line.lineId, id, line.status, amount],
        );
        if (!updated.rowCount) throw AppError.notFound(ErrorCodes.NOT_FOUND, `Baris nota ${line.lineId} tidak ditemukan.`);
      }
      await client.query(
        `INSERT INTO ${S}.sales_note_custody_event
           (handover_id, event_type, from_status, to_status, actor_id, metadata)
         VALUES ($1::uuid, 'RETURNED', 'HANDED_OVER', 'RETURNED', $2::uuid, $3::jsonb)`,
        [id, subjectId, JSON.stringify({ lines: body.lines })],
      );
      return { id, status: 'RETURNED' };
    }, auditOf(user, meta, 'SALES_NOTE_HANDOVER', 'RETURN'));
  }

  @Post('sales-note-handovers/:id/close')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  closeHandover(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.transitionHandover(id, 'RETURNED', 'CLOSED', user, meta);
  }

  @Post('sales-note-handovers/:id/cancel')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  cancelHandover(
    @Param('id') id: string,
    @Body() body: CancelHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const changed = await client.query(
        `UPDATE ${S}.sales_note_handover
            SET status = 'CANCELLED', note = concat_ws(E'\n', note, $2),
                updated_at = now(), version = version + 1
          WHERE id = $1::uuid AND status = 'DRAFT' RETURNING id`,
        [id, `Dibatalkan: ${body.reason}`],
      );
      if (!changed.rowCount) {
        throw invalidTransition('Hanya paket nota DRAFT yang dapat dibatalkan; paket yang sudah dibawa harus dikembalikan.');
      }
      await client.query(
        `INSERT INTO ${S}.sales_note_custody_event
           (handover_id, event_type, from_status, to_status, actor_id, metadata)
         VALUES ($1::uuid, 'CANCELLED', 'DRAFT', 'CANCELLED', $2::uuid, $3::jsonb)`,
        [id, subjectId, JSON.stringify({ reason: body.reason })],
      );
      return { id, status: 'CANCELLED' };
    }, auditOf(user, meta, 'SALES_NOTE_HANDOVER', 'CANCEL'));
  }

  @Post('reports/:code/preview')
  @Permissions('SALES.READ')
  previewReport(@Param('code') code: string, @Body() body: ReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.buildReport(code, body.asOfDate, body.filters, user);
  }

  @Post('reports/:code/snapshot')
  @HttpCode(201)
  @Permissions('SALES.READ')
  async snapshotReport(
    @Param('code') code: string,
    @Body() body: ReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.buildReport(code, body.asOfDate, body.filters, user);
    const S = quotedSchema(user);
    const subjectId = await this.subjectId(user);
    return this.tenantDb.queryOne<Record<string, unknown>>(
      schemaOf(user),
      `INSERT INTO ${S}.inventory_report_snapshot
         (report_code, as_of_date, filter_payload, result_payload, row_count, generated_by, source_revision)
       VALUES ($1, $2::date, $3::jsonb, $4::jsonb, $5, $6::uuid, 'V047')
       RETURNING id::text, report_code, as_of_date::text, row_count, generated_at::text, source_revision`,
      [code, result.asOfDate, JSON.stringify(body.filters ?? {}), JSON.stringify(result), result.rows.length, subjectId],
    );
  }

  @Get('report-snapshots/:id')
  @Permissions('SALES.READ')
  async reportSnapshot(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    const row = await this.tenantDb.queryOne<Record<string, unknown>>(
      schemaOf(user),
      `SELECT id::text, report_code, as_of_date::text, filter_payload, result_payload,
              row_count, generated_at::text, source_revision
         FROM ${S}.inventory_report_snapshot WHERE id = $1::uuid`,
      [id],
    );
    if (!row) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Snapshot laporan tidak ditemukan.');
    return row;
  }

  @Post('report-snapshots/:id/print-log')
  @HttpCode(201)
  @Permissions('SALES.READ')
  async logPrint(
    @Param('id') id: string,
    @Body() body: PrintLogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const S = quotedSchema(user);
    const subjectId = await this.subjectId(user);
    const row = await this.tenantDb.queryOne<Record<string, unknown>>(
      schemaOf(user),
      `INSERT INTO ${S}.inventory_print_log
         (report_code, snapshot_id, output_format, document_number, printed_by)
       SELECT report_code, id, $2, $3, $4::uuid
         FROM ${S}.inventory_report_snapshot WHERE id = $1::uuid
       RETURNING id::text, report_code, output_format, printed_at::text`,
      [id, body.format, body.documentNumber ?? null, subjectId],
    );
    if (!row) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Snapshot laporan tidak ditemukan.');
    return row;
  }

  @Get('sync/bootstrap')
  @Permissions('SALES_ORDER.READ')
  async syncBootstrap(@CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    const [customers, products, cursor] = await Promise.all([
      this.tenantDb.query<Record<string, unknown>>(
        schemaOf(user),
        `SELECT id::text, code, name FROM ${S}.customer
          WHERE deleted_at IS NULL AND is_active ORDER BY name LIMIT 1000`,
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schemaOf(user),
        `SELECT p.id::text, p.code, p.name, p.base_uom_id::text AS uom_id,
                 p.default_sale_price::text AS price,
                 COALESCE(sum(sb.available_qty), 0)::text AS available_qty,
                 '/inventory/public/products/' || p.id::text || '/image' AS image_url
           FROM ${S}.product p LEFT JOIN ${S}.stock_balance sb ON sb.product_id = p.id
          WHERE p.deleted_at IS NULL AND p.is_active AND p.is_sellable
          GROUP BY p.id ORDER BY p.name LIMIT 1000`,
      ),
      this.tenantDb.queryOne<{ cursor: string }>(
        schemaOf(user),
        `SELECT COALESCE(max(cursor_id), 0)::text AS cursor FROM ${S}.inventory_sync_event`,
      ),
    ]);
    return { customers, products, cursor: cursor?.cursor ?? '0', generatedAt: new Date().toISOString() };
  }

  @Get('sync/pull')
  @Permissions('SALES_ORDER.READ')
  async syncPull(
    @Query('afterCursor') afterCursor: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const cursor = /^\d+$/.test(afterCursor ?? '') ? Number(afterCursor) : 0;
    const limit = Math.min(Math.max(Number(limitRaw ?? 250) || 250, 1), 1000);
    const S = quotedSchema(user);
    const events = await this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT cursor_id::text, aggregate_type, aggregate_id, event_type, payload, occurred_at::text
         FROM ${S}.inventory_sync_event WHERE cursor_id > $1 ORDER BY cursor_id LIMIT $2`,
      [cursor, limit],
    );
    return {
      events,
      nextCursor: events.length ? String(events[events.length - 1].cursor_id) : String(cursor),
      hasMore: events.length === limit,
    };
  }

  @Post('sync/devices/register')
  @BlockDemo()
  @Permissions('SALES_ORDER.READ')
  async registerDevice(@Body() body: SyncDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    const subjectId = await this.subjectId(user);
    return this.tenantDb.queryOne<Record<string, unknown>>(
      schemaOf(user),
      `INSERT INTO ${S}.inventory_sync_device_state
         (device_id, platform, app_version, pending_outbox, user_subject_id)
       VALUES ($1, $2, $3, $4, $5::uuid)
       ON CONFLICT (device_id) DO UPDATE SET platform = EXCLUDED.platform,
         app_version = EXCLUDED.app_version, pending_outbox = EXCLUDED.pending_outbox,
         user_subject_id = EXCLUDED.user_subject_id, last_seen_at = now()
       RETURNING device_id, platform, app_version, pending_outbox, last_seen_at::text`,
      [body.deviceId, body.platform, body.appVersion ?? null, body.pendingOutbox ?? 0, subjectId],
    );
  }

  @Get('sync/status')
  @Permissions('SALES_ORDER.READ')
  async syncStatus(@Query('deviceId') deviceId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    const S = quotedSchema(user);
    const [devices, conflicts] = await Promise.all([
      this.tenantDb.query<Record<string, unknown>>(
        schemaOf(user),
        `SELECT device_id, platform, app_version, last_pull_cursor::text, pending_outbox,
                last_seen_at::text, last_sync_at::text
           FROM ${S}.inventory_sync_device_state
          WHERE ($1::text IS NULL OR device_id = $1)
          ORDER BY last_seen_at DESC LIMIT 100`,
        [deviceId || null],
      ),
      this.tenantDb.queryOne<{ open_conflicts: number }>(
        schemaOf(user),
        `SELECT count(*)::int AS open_conflicts FROM ${S}.inventory_sync_conflict WHERE status = 'OPEN'`,
      ),
    ]);
    return { devices, openConflicts: conflicts?.open_conflicts ?? 0 };
  }

  @Get('sync/conflicts')
  @Permissions('SALES.READ')
  listConflicts(
    @Query('pageSize') pageSizeRaw: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const pageSize = Math.min(Math.max(Number(pageSizeRaw ?? 100), 1), 500);
    const S = quotedSchema(user);
    return this.tenantDb.query<Record<string, unknown>>(
      schemaOf(user),
      `SELECT id::text, device_id, entity_type, entity_id::text, client_version,
              server_version, status, resolution, created_at::text, resolved_at::text
         FROM ${S}.inventory_sync_conflict ORDER BY created_at DESC LIMIT $1`,
      [pageSize],
    );
  }

  @Post('sync/conflicts/:id/resolve')
  @BlockDemo()
  @Permissions('SALES_ORDER.CREATE')
  async resolveConflict(
    @Param('id') id: string,
    @Body() body: ResolveConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const S = quotedSchema(user);
    const subjectId = await this.subjectId(user);
    const row = await this.tenantDb.queryOne<Record<string, unknown>>(
      schemaOf(user),
      `UPDATE ${S}.inventory_sync_conflict SET status = 'RESOLVED', resolution = $2,
              resolved_by = $3::uuid, resolved_at = now()
        WHERE id = $1::uuid AND status = 'OPEN'
        RETURNING id::text, status, resolution, resolved_at::text`,
      [id, body.resolution, subjectId],
    );
    if (!row) throw invalidTransition('Konflik sudah diselesaikan atau tidak ditemukan.');
    return row;
  }

  private async createSettlement(
    kind: 'AP' | 'AR',
    body: CreateSettlementDto,
    user: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    if (!meta.idempotencyKey) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Header Idempotency-Key wajib untuk pembayaran.');
    }
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    const config = settlementConfig(kind);
    return this.tenantDb.transaction(schema, async (client) => {
      const existing = await client.query<Record<string, unknown>>(
        `SELECT id::text, ${config.numberColumn} AS number, status FROM ${S}.${config.table} WHERE idempotency_key = $1`,
        [meta.idempotencyKey],
      );
      if (existing.rowCount) return { ...existing.rows[0], idempotent: true };
      const ledgerIds = [...new Set(body.allocations.map((item) => item.ledgerId))];
      if (ledgerIds.length !== body.allocations.length) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Satu dokumen hanya boleh dialokasikan sekali.');
      }
      const ledgers = await client.query<{ id: string; amount: string }>(
        `SELECT l.id::text,
                GREATEST(abs(l.amount) - COALESCE(posted.allocated_amount, 0), 0)::text AS amount
           FROM ${S}.${config.ledger} l
           LEFT JOIN LATERAL (
             SELECT sum(a.allocated_amount) AS allocated_amount
               FROM ${S}.${config.allocationTable} a
               JOIN ${S}.${config.table} p ON p.id = a.${config.parentColumn}
              WHERE a.${config.ledgerColumn} = l.id AND p.status = 'POSTED'
           ) posted ON TRUE
          WHERE l.id = ANY($1::uuid[]) AND l.${config.partyColumn} = $2::uuid
            AND NOT l.is_settled AND abs(l.amount) > COALESCE(posted.allocated_amount, 0)
          FOR UPDATE OF l`,
        [ledgerIds, body.partyId],
      );
      if (ledgers.rowCount !== ledgerIds.length) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Dokumen tidak ditemukan, sudah lunas, atau tidak cocok dengan pihak terpilih.');
      }
      const amountById = new Map(ledgers.rows.map((row) => [row.id, Number(row.amount)]));
      for (const allocation of body.allocations) {
        if (allocation.amount > (amountById.get(allocation.ledgerId) ?? 0)) {
          throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Alokasi tidak boleh melebihi nilai dokumen.');
        }
      }
      const total = body.allocations.reduce((sum, row) => sum + row.amount, 0);
      const subjectId = await subjectIdOf(client, S, user.userId);
      const number = `${kind}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
      const created = await client.query<{ id: string }>(
        `INSERT INTO ${S}.${config.table}
           (${config.numberColumn}, ${config.partyColumn}, ${config.dateColumn}, method, bank_name,
            reference_number, giro_due_date, total_amount, idempotency_key, note, created_by)
         VALUES ($1, $2::uuid, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7::date, $8, $9, $10, $11::uuid)
         RETURNING id::text`,
        [number, body.partyId, body.transactionDate ?? null, body.method, body.bankName ?? null,
          body.referenceNumber ?? null, body.giroDueDate ?? null, total, meta.idempotencyKey, body.note ?? null, subjectId],
      );
      for (const allocation of body.allocations) {
        await client.query(
          `INSERT INTO ${S}.${config.allocationTable}
             (${config.parentColumn}, ${config.ledgerColumn}, allocated_amount)
           VALUES ($1::uuid, $2::uuid, $3)`,
          [created.rows[0].id, allocation.ledgerId, allocation.amount],
        );
      }
      return { id: created.rows[0].id, number, totalAmount: total.toString(), status: 'DRAFT', idempotent: false };
    }, auditOf(user, meta, kind === 'AP' ? 'AP_PAYMENT' : 'AR_RECEIPT', 'CREATE'));
  }

  private transitionSettlement(
    kind: 'AP' | 'AR',
    id: string,
    action: 'POST' | 'REVERSE',
    user: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    const config = settlementConfig(kind);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const expected = action === 'POST' ? 'DRAFT' : 'POSTED';
      const next = action === 'POST' ? 'POSTED' : 'REVERSED';
      if (action === 'POST') {
        const allocations = await client.query<{
          id: string;
          document_amount: string;
          current_amount: string;
          posted_amount: string;
        }>(
          `SELECT l.id::text, abs(l.amount)::text AS document_amount,
                  a.allocated_amount::text AS current_amount,
                  COALESCE(posted.allocated_amount, 0)::text AS posted_amount
             FROM ${S}.${config.allocationTable} a
             JOIN ${S}.${config.ledger} l ON l.id = a.${config.ledgerColumn}
             LEFT JOIN LATERAL (
               SELECT sum(a2.allocated_amount) AS allocated_amount
                 FROM ${S}.${config.allocationTable} a2
                 JOIN ${S}.${config.table} p2 ON p2.id = a2.${config.parentColumn}
                WHERE a2.${config.ledgerColumn} = l.id
                  AND p2.status = 'POSTED' AND p2.id <> $1::uuid
             ) posted ON TRUE
            WHERE a.${config.parentColumn} = $1::uuid
            FOR UPDATE OF l`,
          [id],
        );
        if (!allocations.rowCount) {
          throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `${kind} tidak memiliki alokasi.`);
        }
        const overAllocated = allocations.rows.some(
          (row) => Number(row.posted_amount) + Number(row.current_amount) > Number(row.document_amount),
        );
        if (overAllocated) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            'Saldo dokumen berubah. Muat ulang data sebelum memposting pembayaran.',
          );
        }
      }
      const actorColumns = action === 'POST'
        ? 'posted_at = now(), posted_by = $2::uuid'
        : 'reversed_at = now(), reversed_by = $2::uuid';
      const changed = await client.query(
        `UPDATE ${S}.${config.table} SET status = '${next}', ${actorColumns},
                updated_at = now(), version = version + 1
          WHERE id = $1::uuid AND status = '${expected}' RETURNING id`,
        [id, subjectId],
      );
      if (!changed.rowCount) throw invalidTransition(`Status ${kind} tidak dapat diubah menjadi ${next}.`);
      const ledgerIds = await client.query<{ id: string }>(
        `SELECT ${config.ledgerColumn}::text AS id FROM ${S}.${config.allocationTable}
          WHERE ${config.parentColumn} = $1::uuid`,
        [id],
      );
      for (const ledger of ledgerIds.rows) {
        await client.query(
          `UPDATE ${S}.${config.ledger} l SET is_settled =
             COALESCE((SELECT sum(a.allocated_amount)
                         FROM ${S}.${config.allocationTable} a
                         JOIN ${S}.${config.table} p ON p.id = a.${config.parentColumn}
                        WHERE a.${config.ledgerColumn} = l.id AND p.status = 'POSTED'), 0) >= abs(l.amount)
            WHERE l.id = $1::uuid`,
          [ledger.id],
        );
      }
      return { id, status: next };
    }, auditOf(user, meta, kind === 'AP' ? 'AP_PAYMENT' : 'AR_RECEIPT', action));
  }

  private transitionHandover(
    id: string,
    expected: string,
    next: 'HANDED_OVER' | 'CLOSED',
    user: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const columns = next === 'HANDED_OVER'
        ? 'handed_over_at = now(), handed_over_by = $2::uuid'
        : 'closed_at = now(), closed_by = $2::uuid';
      const row = await client.query(
        `UPDATE ${S}.sales_note_handover SET status = $3, ${columns},
                updated_at = now(), version = version + 1
          WHERE id = $1::uuid AND status = $4 RETURNING id`,
        [id, subjectId, next, expected],
      );
      if (!row.rowCount) throw invalidTransition(`Serah-terima harus berstatus ${expected}.`);
      await client.query(
        `INSERT INTO ${S}.sales_note_custody_event
           (handover_id, event_type, from_status, to_status, actor_id)
         VALUES ($1::uuid, $2, $3, $4, $5::uuid)`,
        [id, next, expected, next, subjectId],
      );
      return { id, status: next };
    }, auditOf(user, meta, 'SALES_NOTE_HANDOVER', next));
  }

  private transitionStockOpname(
    id: string,
    expected: 'DRAFT' | 'COUNTED',
    next: 'FROZEN' | 'APPROVED',
    user: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const subjectId = await subjectIdOf(client, S, user.userId);
      const actorColumns = next === 'FROZEN'
        ? 'frozen_at = now(), frozen_by = $2::uuid'
        : 'approved_at = now(), approved_by = $2::uuid';
      const row = await client.query(
        `UPDATE ${S}.inventory_stock_opname_session SET status = $3, ${actorColumns},
                updated_at = now(), version = version + 1
          WHERE id = $1::uuid AND status = $4 RETURNING id`,
        [id, subjectId, next, expected],
      );
      if (!row.rowCount) throw invalidTransition(`Stock opname harus berstatus ${expected}.`);
      return { id, status: next };
    }, auditOf(user, meta, 'STOCK_OPNAME', next));
  }

  private changeInventoryPeriod(
    id: string,
    action: 'CLOSE' | 'REOPEN',
    note: string | undefined,
    user: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    const schema = schemaOf(user);
    const S = quotedSchema(user);
    return this.tenantDb.transaction(schema, async (client) => {
      const period = await client.query<{
        id: string; code: string; status: string; start_date: string; end_date: string;
      }>(
        `SELECT id::text, code, status, start_date::text, end_date::text
           FROM ${S}.fiscal_period WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE`, [id],
      );
      if (!period.rowCount) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Periode fiskal tidak ditemukan.');
      const current = period.rows[0];
      const subjectId = await subjectIdOf(client, S, user.userId);
      const runNumber = `PER-${current.code}-${Date.now().toString(36).toUpperCase()}`;

      if (action === 'REOPEN') {
        if (current.status !== 'CLOSED') throw invalidTransition('Hanya periode CLOSED yang dapat dibuka kembali.');
        const later = await client.query(
          `SELECT 1 FROM ${S}.fiscal_period WHERE deleted_at IS NULL AND status = 'CLOSED'
            AND end_date > $1::date LIMIT 1`, [current.end_date],
        );
        if (later.rowCount) throw invalidTransition('Buka kembali periode paling akhir terlebih dahulu.');
        await client.query(
          `UPDATE ${S}.fiscal_period SET status = 'OPEN', closed_at = NULL, closed_by = NULL,
                  updated_at = now(), version = version + 1 WHERE id = $1::uuid`, [id],
        );
        const run = await client.query<{ id: string }>(
          `INSERT INTO ${S}.inventory_period_close_run
             (fiscal_period_id, run_number, status, note, completed_at, created_by)
           VALUES ($1::uuid, $2, 'REOPENED', $3, now(), $4::uuid) RETURNING id::text`,
          [id, runNumber, note ?? null, subjectId],
        );
        await appendSyncEvent(client, S, subjectId, 'FISCAL_PERIOD', id, 'FISCAL_PERIOD_REOPENED', { code: current.code });
        return { id, runId: run.rows[0].id, status: 'OPEN', validation: {} };
      }

      if (current.status !== 'OPEN') throw invalidTransition('Hanya periode OPEN yang dapat ditutup.');
      const checksResult = await client.query<{
        draft_journals: number; draft_ap: number; draft_ar: number; incomplete_opnames: number;
        unposted_events: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM ${S}.journal_entry
             WHERE status = 'DRAFT' AND journal_date BETWEEN $1::date AND $2::date) AS draft_journals,
           (SELECT count(*)::int FROM ${S}.inventory_ap_payment
             WHERE status = 'DRAFT' AND payment_date BETWEEN $1::date AND $2::date) AS draft_ap,
           (SELECT count(*)::int FROM ${S}.inventory_ar_receipt
             WHERE status = 'DRAFT' AND receipt_date BETWEEN $1::date AND $2::date) AS draft_ar,
           (SELECT count(*)::int FROM ${S}.inventory_stock_opname_session
             WHERE status NOT IN ('POSTED', 'CANCELLED') AND opname_date BETWEEN $1::date AND $2::date) AS incomplete_opnames,
           (SELECT count(*)::int FROM ${S}.accounting_event
             WHERE status IN ('PENDING', 'FAILED') AND occurred_at::date BETWEEN $1::date AND $2::date) AS unposted_events`,
        [current.start_date, current.end_date],
      );
      const validation = checksResult.rows[0] ?? {
        draft_journals: 0, draft_ap: 0, draft_ar: 0, incomplete_opnames: 0, unposted_events: 0,
      };
      const blocked = Object.values(validation).some((value) => Number(value) > 0);
      const snapshotResult = await client.query<Record<string, unknown>>(
        `SELECT
           (SELECT count(*)::int FROM ${S}.journal_entry WHERE status = 'POSTED'
             AND journal_date BETWEEN $1::date AND $2::date) AS posted_journals,
           (SELECT COALESCE(sum(on_hand_qty * average_cost), 0)::text FROM ${S}.stock_balance) AS stock_value,
           (SELECT COALESCE(sum(amount), 0)::text FROM ${S}.legacy_receivable_ledger WHERE NOT is_settled) AS receivable_balance,
           (SELECT COALESCE(sum(abs(amount)), 0)::text FROM ${S}.legacy_payable_ledger WHERE NOT is_settled) AS payable_balance`,
        [current.start_date, current.end_date],
      );
      const run = await client.query<{ id: string }>(
        `INSERT INTO ${S}.inventory_period_close_run
           (fiscal_period_id, run_number, status, checklist, validation_result, snapshot_payload,
            note, completed_at, created_by)
         VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, now(), $8::uuid)
         RETURNING id::text`,
        [id, runNumber, blocked ? 'BLOCKED' : 'CLOSED',
          JSON.stringify({ backupConfirmed: true, reconciliationChecked: true, immutableSnapshot: true }),
          JSON.stringify(validation), JSON.stringify(snapshotResult.rows[0] ?? {}), note ?? null, subjectId],
      );
      if (blocked) return { id, runId: run.rows[0].id, status: 'BLOCKED', validation };
      await client.query(
        `UPDATE ${S}.fiscal_period SET status = 'CLOSED', closed_at = now(), closed_by = $2::uuid,
                updated_at = now(), version = version + 1 WHERE id = $1::uuid`, [id, subjectId],
      );
      await appendSyncEvent(client, S, subjectId, 'FISCAL_PERIOD', id, 'FISCAL_PERIOD_CLOSED', { code: current.code });
      return { id, runId: run.rows[0].id, status: 'CLOSED', validation, snapshot: snapshotResult.rows[0] ?? {} };
    }, auditOf(user, meta, 'FINANCE_JOURNAL', action === 'CLOSE' ? 'CLOSE_PERIOD' : 'REOPEN'));
  }

  private async buildReport(
    code: string,
    asOfRaw: string | undefined,
    filters: Record<string, unknown> | undefined,
    user: AuthenticatedUser,
  ) {
    const asOfDate = asOfRaw ?? new Date().toISOString().slice(0, 10);
    const S = quotedSchema(user);
    const report = reportSql(code, S);
    if (!report) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Kode laporan ${code} tidak didukung.`);
    const rows = await this.tenantDb.query<Record<string, unknown>>(schemaOf(user), report.sql, [asOfDate]);
    const totalKey = report.totalKey;
    return {
      reportCode: code,
      title: report.title,
      asOfDate,
      filters: filters ?? {},
      rowCount: rows.length,
      totals: totalKey
        ? { [totalKey]: rows.reduce((sum, row) => sum + Number(row[totalKey] ?? 0), 0).toString() }
        : {},
      rows,
      generatedAt: new Date().toISOString(),
      templateVersion: 'V047',
    };
  }

  private async subjectId(user: AuthenticatedUser): Promise<string> {
    const S = quotedSchema(user);
    const row = await this.tenantDb.queryOne<{ id: string }>(
      schemaOf(user),
      `SELECT id::text FROM ${S}.user_subject WHERE id = $1::uuid OR platform_user_id = $1::uuid LIMIT 1`,
      [user.userId],
    );
    if (!row) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Akun tidak terhubung ke subject tenant.');
    return row.id;
  }
}

export function partyMasterBalanceSql(kind: string, S: string): string | null {
  if (kind === 'suppliers') {
    return `SELECT s.id::text,
                   COALESCE(sum(CASE WHEN NOT COALESCE(l.is_settled, FALSE) THEN l.amount ELSE 0 END), 0)::text AS balance,
                   count(l.id)::int AS document_count
              FROM ${S}.supplier s
              LEFT JOIN ${S}.legacy_payable_ledger l ON l.supplier_id = s.id
             WHERE s.deleted_at IS NULL
             GROUP BY s.id`;
  }
  if (kind === 'customers') {
    return `SELECT c.id::text,
                   COALESCE(sum(CASE WHEN NOT COALESCE(l.is_settled, FALSE) THEN l.amount ELSE 0 END), 0)::text AS balance,
                   count(l.id)::int AS document_count
              FROM ${S}.customer c
              LEFT JOIN ${S}.legacy_receivable_ledger l ON l.customer_id = c.id
             WHERE c.deleted_at IS NULL
             GROUP BY c.id`;
  }
  if (kind === 'salespeople') {
    return `SELECT sp.id::text,
                   COALESCE(sum(CASE WHEN NOT COALESCE(l.is_settled, FALSE) THEN l.amount ELSE 0 END), 0)::text AS balance,
                   count(DISTINCT l.customer_id)::int AS customer_count,
                   count(l.id)::int AS document_count
              FROM ${S}.inventory_salesperson_profile sp
              LEFT JOIN ${S}.legacy_receivable_ledger l ON l.salesperson_id = sp.user_subject_id
             WHERE sp.deleted_at IS NULL
             GROUP BY sp.id`;
  }
  return null;
}

function schemaOf(user: AuthenticatedUser): string {
  if (!user.schemaName) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi tidak terhubung ke tenant.');
  return user.schemaName;
}

function quotedSchema(user: AuthenticatedUser): string {
  return `"${schemaOf(user)}"`;
}

async function subjectIdOf(client: PoolClient, S: string, userId: string): Promise<string> {
  const row = await client.query(
    `SELECT id::text FROM ${S}.user_subject WHERE id = $1::uuid OR platform_user_id = $1::uuid LIMIT 1`,
    [userId],
  );
  if (!row.rowCount) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Akun tidak terhubung ke subject tenant.');
  return row.rows[0].id as string;
}

async function appendSyncEvent(
  client: PoolClient,
  S: string,
  actorId: string,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await client.query(
    `INSERT INTO ${S}.inventory_sync_event
       (aggregate_type, aggregate_id, event_type, payload, actor_id)
     VALUES ($1, $2, $3, $4::jsonb, $5::uuid)`,
    [aggregateType, aggregateId, eventType, JSON.stringify(payload), actorId],
  );
}

function auditOf(user: AuthenticatedUser, meta: RequestMeta, moduleCode: string, actionCode: string) {
  return {
    requestId: meta.requestId,
    correlationId: meta.correlationId,
    userId: user.userId,
    username: user.username,
    sessionId: user.sessionId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    moduleCode,
    actionCode,
  };
}

function invalidTransition(message: string) {
  return AppError.conflict(ErrorCodes.CONFLICT, message);
}

function settlementConfig(kind: 'AP' | 'AR') {
  return kind === 'AP'
    ? {
        table: 'inventory_ap_payment', numberColumn: 'payment_number', partyColumn: 'supplier_id',
        dateColumn: 'payment_date', ledger: 'legacy_payable_ledger', allocationTable: 'inventory_ap_payment_allocation',
        parentColumn: 'payment_id', ledgerColumn: 'payable_ledger_id',
      }
    : {
        table: 'inventory_ar_receipt', numberColumn: 'receipt_number', partyColumn: 'customer_id',
        dateColumn: 'receipt_date', ledger: 'legacy_receivable_ledger', allocationTable: 'inventory_ar_receipt_allocation',
        parentColumn: 'receipt_id', ledgerColumn: 'receivable_ledger_id',
      };
}

export function reportSql(code: string, S: string): { title: string; sql: string; totalKey?: string } | null {
  const reports: Record<string, { title: string; sql: string; totalKey?: string }> = {
    'supplier-list': {
      title: 'Daftar Supplier',
      sql: `SELECT code, name, is_active FROM ${S}.supplier WHERE deleted_at IS NULL ORDER BY code`,
    },
    'customer-list': {
      title: 'Daftar Customer',
      sql: `SELECT code, name, is_active FROM ${S}.customer WHERE deleted_at IS NULL ORDER BY code`,
    },
    'stock-list': {
      title: 'Daftar dan Nilai Stok', totalKey: 'stock_value',
      sql: `SELECT p.code, p.name, u.code AS uom, COALESCE(sum(sb.on_hand_qty), 0)::text AS on_hand,
                   COALESCE(sum(sb.available_qty), 0)::text AS available,
                   COALESCE(sum(sb.on_hand_qty * sb.average_cost), 0)::text AS stock_value
              FROM ${S}.product p JOIN ${S}.uom u ON u.id = p.base_uom_id
              LEFT JOIN ${S}.stock_balance sb ON sb.product_id = p.id
             WHERE p.deleted_at IS NULL GROUP BY p.id, u.code ORDER BY p.code`,
    },
    'stock-opname': {
      // Baris `legacy_stock_opname` hanya diisi oleh impor CLI satu kali
      // (lihat onboard-cmn-inventory.cli.ts) — siklus opname yang benar-benar
      // dijalankan lewat freeze->count->approve->post tidak pernah masuk ke
      // sana. Digabung dengan UNION ALL supaya riwayat impor lama tetap
      // tampil bersisian dengan opname hidup, bukan digantikan.
      title: 'Laporan Stock Opname', totalKey: 'variance_value',
      sql: `SELECT opname_date::text, code, name, system_qty::text, physical_qty::text,
                   variance_qty::text, unit_cost::text, (variance_qty * unit_cost)::text AS variance_value
              FROM (
                SELECT o.opname_date AS opname_date, p.code AS code, p.name AS name,
                       l.system_qty AS system_qty, l.physical_qty AS physical_qty,
                       l.variance_qty AS variance_qty, l.unit_cost AS unit_cost
                  FROM ${S}.inventory_stock_opname_session o
                  JOIN ${S}.inventory_stock_opname_line l ON l.opname_id = o.id
                  LEFT JOIN ${S}.product p ON p.id = l.product_id
                 WHERE o.status IN ('APPROVED', 'POSTED')
                UNION ALL
                SELECT l.opname_date, p.code, p.name, l.system_qty, l.physical_qty, l.variance_qty, l.unit_cost
                  FROM ${S}.legacy_stock_opname l LEFT JOIN ${S}.product p ON p.id = l.product_id
              ) gabungan
             WHERE opname_date <= $1::date ORDER BY opname_date DESC, code`,
    },
    'price-sale': {
      title: 'Daftar Harga Jual Customer', totalKey: 'price',
      sql: `SELECT c.code AS customer_code, c.name AS customer_name, p.code AS product_code,
                   p.name AS product_name, h.effective_date::text, h.price::text
              FROM ${S}.legacy_price_history h LEFT JOIN ${S}.customer c ON c.id = h.customer_id
              LEFT JOIN ${S}.product p ON p.id = h.product_id
             WHERE h.party_type = 'CUSTOMER' AND COALESCE(h.effective_date, $1::date) <= $1::date
             ORDER BY c.code, p.code, h.effective_date DESC`,
    },
    'price-purchase': {
      title: 'Daftar Harga Beli Supplier', totalKey: 'price',
      sql: `SELECT s.code AS supplier_code, s.name AS supplier_name, p.code AS product_code,
                   p.name AS product_name, h.effective_date::text, h.price::text
              FROM ${S}.legacy_price_history h LEFT JOIN ${S}.supplier s ON s.id = h.supplier_id
              LEFT JOIN ${S}.product p ON p.id = h.product_id
             WHERE h.party_type = 'SUPPLIER' AND COALESCE(h.effective_date, $1::date) <= $1::date
             ORDER BY s.code, p.code, h.effective_date DESC`,
    },
    'purchase-invoice': {
      title: 'Faktur Pembelian Barang', totalKey: 'line_total',
      sql: `SELECT po.purchase_order_number AS invoice_number, po.order_date::text,
                   s.code AS supplier_code, s.name AS supplier_name, p.code AS product_code,
                   p.name AS product_name, pol.ordered_qty::text, u.code AS uom,
                   pol.unit_price::text, pol.discount_amount::text, pol.tax_amount::text,
                   pol.line_total::text, po.status
              FROM ${S}.purchase_order po JOIN ${S}.supplier s ON s.id = po.supplier_id
              JOIN ${S}.purchase_order_line pol ON pol.purchase_order_id = po.id
              JOIN ${S}.product p ON p.id = pol.product_id
              JOIN ${S}.uom u ON u.id = pol.uom_id
             WHERE po.deleted_at IS NULL AND po.order_date <= $1::date
             ORDER BY po.order_date DESC, po.purchase_order_number, pol.line_no`,
    },
    'purchase-register': {
      title: 'Laporan Pembelian per Periode', totalKey: 'grand_total',
      sql: `SELECT po.purchase_order_number, po.order_date::text, po.expected_date::text,
                   s.code AS supplier_code, s.name AS supplier_name, po.status,
                   po.subtotal::text, po.discount_total::text, po.tax_total::text,
                   po.grand_total::text
              FROM ${S}.purchase_order po JOIN ${S}.supplier s ON s.id = po.supplier_id
             WHERE po.deleted_at IS NULL AND po.order_date <= $1::date
             ORDER BY po.order_date DESC, po.purchase_order_number`,
    },
    'ap-payment-register': {
      title: 'Register Pembayaran Hutang', totalKey: 'total_amount',
      sql: `SELECT p.payment_number, p.payment_date::text, s.code AS supplier_code, s.name AS supplier_name,
                   p.method, p.reference_number, p.total_amount::text, p.status
              FROM ${S}.inventory_ap_payment p JOIN ${S}.supplier s ON s.id = p.supplier_id
             WHERE p.payment_date <= $1::date ORDER BY p.payment_date, p.payment_number`,
    },
    'ar-receipt-register': {
      title: 'Register Penerimaan Piutang', totalKey: 'total_amount',
      sql: `SELECT r.receipt_number, r.receipt_date::text, c.code AS customer_code, c.name AS customer_name,
                   r.method, r.reference_number, r.total_amount::text, r.status
              FROM ${S}.inventory_ar_receipt r JOIN ${S}.customer c ON c.id = r.customer_id
             WHERE r.receipt_date <= $1::date ORDER BY r.receipt_date, r.receipt_number`,
    },
    'ap-aging': {
      title: 'Aging Hutang Supplier', totalKey: 'amount',
      sql: agingReport(S, 'legacy_payable_ledger', 'supplier', 'supplier_id'),
    },
    'ar-aging-customer': {
      title: 'Aging Piutang Customer', totalKey: 'amount',
      sql: agingReport(S, 'legacy_receivable_ledger', 'customer', 'customer_id'),
    },
    'ar-aging-sales': {
      title: 'Aging Piutang per Sales', totalKey: 'amount',
      sql: `SELECT COALESCE(us.name, 'Tanpa sales') AS party_name, l.legacy_invoice_number,
                   l.transaction_date::text, l.due_date::text, l.amount::text,
                   GREATEST($1::date - COALESCE(l.due_date, l.transaction_date, $1::date), 0)::int AS overdue_days
              FROM ${S}.legacy_receivable_ledger l LEFT JOIN ${S}.user_subject us ON us.id = l.salesperson_id
             WHERE NOT l.is_settled AND l.amount > 0 AND COALESCE(l.transaction_date, $1::date) <= $1::date
             ORDER BY us.name, overdue_days DESC`,
    },
    'ar-outstanding': {
      title: 'Piutang Belum Lunas', totalKey: 'amount',
      sql: agingReport(S, 'legacy_receivable_ledger', 'customer', 'customer_id'),
    },
    'sales-note-handover': {
      title: 'Serah-terima Nota Sales', totalKey: 'outstanding_amount',
      sql: `SELECT h.handover_number, h.handover_date::text, us.name AS salesperson_name,
                   l.invoice_number, l.customer_name, l.due_date::text, l.outstanding_amount::text, l.status
              FROM ${S}.sales_note_handover h JOIN ${S}.user_subject us ON us.id = h.salesperson_id
              JOIN ${S}.sales_note_handover_line l ON l.handover_id = h.id
             WHERE h.handover_date <= $1::date ORDER BY h.handover_date, h.handover_number, l.invoice_number`,
    },
    'gross-profit': {
      title: 'Laba Kotor Penjualan', totalKey: 'gross_profit',
      sql: `SELECT so.order_number, so.order_date::text, p.code AS product_code, p.name AS product_name,
                   sol.ordered_qty::text, sol.line_total::text AS revenue,
                   (sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost))::text AS cogs,
                   (sol.line_total - sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost))::text AS gross_profit
              FROM ${S}.sales_order so JOIN ${S}.sales_order_line sol ON sol.sales_order_id = so.id
              JOIN ${S}.product p ON p.id = sol.product_id
             WHERE so.status = 'INVOICED' AND so.order_date <= $1::date
             ORDER BY so.order_date, so.order_number, sol.line_no`,
    },
  };
  if (code === 'profit-loss') {
    return {
      title: 'Laporan Laba Rugi Akuntansi', totalKey: 'balance',
      sql: `SELECT coa.code, coa.name, at.category AS account_type,
                   COALESCE(sum(CASE
                     WHEN coa.normal_balance = 'DEBIT' THEN jel.debit - jel.credit
                     ELSE jel.credit - jel.debit
                   END), 0)::text AS balance
              FROM ${S}.chart_of_account coa
              JOIN ${S}.account_type at ON at.id = coa.account_type_id
              LEFT JOIN ${S}.journal_entry_line jel ON jel.account_id = coa.id
              LEFT JOIN ${S}.journal_entry je ON je.id = jel.journal_entry_id
               AND je.status = 'POSTED' AND je.journal_date <= $1::date
             WHERE coa.deleted_at IS NULL AND at.category IN ('REVENUE', 'EXPENSE')
             GROUP BY coa.id, at.category ORDER BY coa.code`,
    };
  }
  return reports[code] ?? null;
}

function agingReport(S: string, ledger: string, party: string, partyId: string): string {
  return `SELECT COALESCE(p.name, 'Tanpa pihak') AS party_name, l.legacy_invoice_number,
                 l.transaction_date::text, l.due_date::text, l.amount::text,
                 GREATEST($1::date - COALESCE(l.due_date, l.transaction_date, $1::date), 0)::int AS overdue_days
            FROM ${S}.${ledger} l LEFT JOIN ${S}.${party} p ON p.id = l.${partyId}
           WHERE NOT l.is_settled AND l.amount > 0 AND COALESCE(l.transaction_date, $1::date) <= $1::date
           ORDER BY p.name, overdue_days DESC`;
}
