import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MasterLifecycleService, LifecycleContext } from './master-lifecycle.service';
import { ErpPurchasingService } from './erp-purchasing.service';
import { ErpInventoryService } from './erp-inventory.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { MASTER_RESOURCES, MASTER_RESOURCE_PATTERN } from './master-resource.registry';
import { BaseQueryDto } from '../../common/dto/base-query.dto';
import {
  AuthenticatedOnly,
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  Permissions,
  RequestContext,
  RequestMeta,
  RequireStepUp,
  ResourcePermission,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { SalesInventoryOperationsController } from './sales-inventory-operations.controller';

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

class DeleteReasonDto {
  @ApiProperty({ description: 'Alasan wajib untuk soft delete dan purge.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

class MobileSalesOrderLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  uomId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  qty!: number;
}

class CreateMobileSalesOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  deviceId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  deviceEventId!: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  deliveryDate?: string;

  @ApiProperty({ type: [MobileSalesOrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileSalesOrderLineDto)
  lines!: MobileSalesOrderLineDto[];
}

class InventoryLegacyQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 200, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize = 200;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeSettled = false;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

class RequestOrderLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  requestedQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CreateRequestOrderDto {
  @ApiProperty()
  @IsUUID()
  requestingWarehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentWarehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  neededAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ type: [RequestOrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestOrderLineDto)
  lines!: RequestOrderLineDto[];
}

class PurchaseOrderLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  orderedQty!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requestOrderLineId?: string;
}

class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ type: [PurchaseOrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}

class GoodsReceiptLineDto {
  @ApiProperty()
  @IsUUID()
  purchaseOrderLineId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  receivedQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CreateGoodsReceiptDto {
  @ApiProperty()
  @IsUUID()
  purchaseOrderId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  supplierDoNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ type: [GoodsReceiptLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}

class InspectLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acceptedQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejectedQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  qualityStatus?: string;
}

class InspectGoodsReceiptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [InspectLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectLineDto)
  lines!: InspectLineDto[];
}

class CreateBackorderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replacementSupplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  redirectReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  dueDate?: string;
}

class AssignSupplierDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class TransferLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  requestedQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  sourceWarehouseId!: string;

  @ApiProperty()
  @IsUUID()
  destinationWarehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requestOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ type: [TransferLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines!: TransferLineDto[];
}

class ValidateTransferLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivedQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejectedQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class ValidateTransferDto {
  @ApiProperty({ type: [ValidateTransferLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateTransferLineDto)
  lines!: ValidateTransferLineDto[];
}

class StockTreeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeZero?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInTransit?: boolean;
}

// ---------------------------------------------------------------------------
// Controller: master CRUD generik + lifecycle
// ---------------------------------------------------------------------------

@ApiTags('tenant')
@ApiBearerAuth('access-token')
@Controller()
export class MasterController {
  constructor(private readonly lifecycle: MasterLifecycleService) {}

  @Get('master-resources')
  @AuthenticatedOnly()
  @ApiOperation({ summary: 'Daftar resource master yang tersedia beserta kebijakan purge' })
  listResources() {
    return MASTER_RESOURCES.map((resource) => ({
      resourceCode: resource.resourceCode,
      label: resource.label,
      menuCode: resource.menuCode,
      searchableFields: resource.searchableFields,
      sortableFields: resource.sortableFields,
      writableFields: resource.writableFields,
      hardDeletePolicy: resource.hardDeletePolicy,
      supportsPurge: resource.supportsPurge,
    }));
  }

  @Get(`:resource(${MASTER_RESOURCE_PATTERN})`)
  @ResourcePermission('READ')
  @ApiOperation({ summary: 'Daftar record master dengan pencarian, filter, sorting, dan pagination' })
  list(
    @Param('resource') resource: string,
    @Query() query: BaseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.list(context(user, meta), resource, query);
  }

  @Get(`:resource(${MASTER_RESOURCE_PATTERN})/:id`)
  @ResourcePermission('READ')
  @ApiOperation({ summary: 'Detail satu record master' })
  findOne(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.findById(context(user, meta), resource, id);
  }

  @Post(`:resource(${MASTER_RESOURCE_PATTERN})`)
  @ResourcePermission('CREATE')
  @HttpCode(201)
  @BlockDemo()
  @ApiOperation({ summary: 'Membuat record master' })
  create(
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.create(context(user, meta), resource, body);
  }

  @Patch(`:resource(${MASTER_RESOURCE_PATTERN})/:id`)
  @ResourcePermission('UPDATE')
  @BlockDemo()
  @ApiOperation({ summary: 'Mengubah record master (optimistic version opsional)' })
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown> & { version?: number },
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const { version, ...payload } = body;
    return this.lifecycle.update(context(user, meta), resource, id, payload, version);
  }

  @Post(`:resource(${MASTER_RESOURCE_PATTERN})/:id/deactivate`)
  @ResourcePermission('UPDATE')
  @HttpCode(200)
  @BlockDemo()
  @ApiOperation({ summary: 'Menonaktifkan record (isActive = false)' })
  deactivate(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.deactivate(context(user, meta), resource, id, body?.reason);
  }

  @Post(`:resource(${MASTER_RESOURCE_PATTERN})/:id/activate`)
  @ResourcePermission('UPDATE')
  @HttpCode(200)
  @BlockDemo()
  @ApiOperation({ summary: 'Mengaktifkan kembali record' })
  activate(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.activate(context(user, meta), resource, id);
  }

  @Delete(`:resource(${MASTER_RESOURCE_PATTERN})/:id`)
  @ResourcePermission('DELETE')
  @BlockDemo()
  @ApiOperation({ summary: 'Soft delete — audit dan referensi tetap terjaga' })
  softDelete(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: DeleteReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.softDelete(context(user, meta), resource, id, dto.reason);
  }

  @Post(`:resource(${MASTER_RESOURCE_PATTERN})/:id/restore`)
  @ResourcePermission('RESTORE')
  @HttpCode(200)
  @BlockDemo()
  @ApiOperation({ summary: 'Memulihkan record yang di-soft-delete' })
  restore(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.restore(context(user, meta), resource, id);
  }

  @Get(`:resource(${MASTER_RESOURCE_PATTERN})/:id/references`)
  @ResourcePermission('READ')
  @ApiOperation({ summary: 'Laporan referensi record — dipakai sebelum purge' })
  references(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.references(context(user, meta), resource, id);
  }

  @Post(`:resource(${MASTER_RESOURCE_PATTERN})/:id/purge`)
  @HttpCode(200)
  @BlockDemo()
  @RequireStepUp('HARD_DELETE')
  @ApiOperation({
    summary: 'Hapus permanen (purge)',
    description:
      'Memerlukan permission HARD_DELETE, step-up authentication, alasan, reference check, dan audit.',
  })
  purge(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: DeleteReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.purge(context(user, meta), resource, id, dto.reason);
  }

  @Get(`:resource(${MASTER_RESOURCE_PATTERN})/:id/audit`)
  @ResourcePermission('AUDIT_READ')
  @ApiOperation({ summary: 'Riwayat audit satu record dari schema audit tenant' })
  auditTrail(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.lifecycle.auditTrail(context(user, meta), resource, id);
  }
}

// ---------------------------------------------------------------------------
// Controller: administrasi sistem tenant
// ---------------------------------------------------------------------------

@ApiTags('tenant-admin')
@ApiBearerAuth('access-token')
@Controller('admin')
export class TenantAdminController {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  @Get('users')
  @Permissions('ADMIN_USER.READ')
  @ApiOperation({ summary: 'Daftar pengguna pada tenant aktif beserta role yang dipegang' })
  async users(@CurrentUser() user: AuthenticatedUser) {
    const schema = schemaOf(user);
    const rows = await this.tenantDb.query<{
      id: string;
      platform_user_id: string;
      code: string;
      name: string;
      username_snapshot: string;
      email_snapshot: string | null;
      status: string;
      is_owner: boolean;
      is_active: boolean;
      last_login_at: Date | null;
      updated_at: Date;
      roles: string | null;
      role_count: string;
    }>(
      schema,
      `SELECT us.id::text, us.platform_user_id::text, us.code, us.name,
              us.username_snapshot, us.email_snapshot, us.status,
              us.is_owner, us.is_active, us.last_login_at, us.updated_at,
              string_agg(r.code, ', ' ORDER BY r.code)
                FILTER (WHERE r.id IS NOT NULL) AS roles,
              count(r.id)::text AS role_count
         FROM "${schema}".user_subject us
         LEFT JOIN "${schema}".user_role_assignment ura ON ura.user_subject_id = us.id
           AND ura.valid_from <= now()
           AND (ura.valid_until IS NULL OR ura.valid_until >= now())
         LEFT JOIN "${schema}".role r ON r.id = ura.role_id
           AND r.deleted_at IS NULL
           AND r.is_active = TRUE
        WHERE us.deleted_at IS NULL
        GROUP BY us.id
        ORDER BY us.is_owner DESC, us.name, us.username_snapshot`,
    );

    return rows.map((row) => ({
      id: row.id,
      platformUserId: row.platform_user_id,
      code: row.code,
      name: row.name,
      username: row.username_snapshot,
      email: row.email_snapshot,
      status: row.status,
      isOwner: row.is_owner,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at,
      updatedAt: row.updated_at,
      roles: row.roles ? row.roles.split(', ') : [],
      roleCount: Number(row.role_count),
    }));
  }
}

// ---------------------------------------------------------------------------
// Controller: akuntansi baca-saja
// ---------------------------------------------------------------------------

@ApiTags('accounting')
@ApiBearerAuth('access-token')
@Controller()
export class AccountingDocumentController {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  @Get('journal-entries')
  @Permissions('FINANCE_JOURNAL.READ')
  @ApiOperation({ summary: 'Daftar jurnal akuntansi' })
  async listJournalEntries(@Query() query: BaseQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = schemaOf(user);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    const page = Math.max(Number(query.page ?? 1), 1);
    const offset = (page - 1) * pageSize;
    return this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT je.id::text, je.journal_number, je.journal_date::text, je.source_type,
              je.description, je.currency_code, je.total_debit::text, je.total_credit::text,
              je.status, je.posted_at::text, je.created_at::text,
              fp.code AS fiscal_period_code
         FROM "${schema}".journal_entry je
         LEFT JOIN "${schema}".fiscal_period fp ON fp.id = je.fiscal_period_id
        ORDER BY je.journal_date DESC, je.created_at DESC
        LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
  }

  @Get('journal-entries/:id')
  @Permissions('FINANCE_JOURNAL.READ')
  @ApiOperation({ summary: 'Detail jurnal akuntansi beserta baris debit/kredit' })
  async journalEntryDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = schemaOf(user);
    const header = await this.tenantDb.queryOne<Record<string, unknown>>(
      schema,
      `SELECT je.id::text, je.journal_number, je.journal_date::text, je.source_type,
              je.source_id::text, je.posting_key, je.description, je.currency_code,
              je.exchange_rate::text, je.total_debit::text, je.total_credit::text,
              je.status, je.posted_at::text, je.posted_by::text, je.reversal_of_id::text,
              je.created_at::text, je.updated_at::text, fp.code AS fiscal_period_code
         FROM "${schema}".journal_entry je
         LEFT JOIN "${schema}".fiscal_period fp ON fp.id = je.fiscal_period_id
        WHERE je.id = $1`,
      [id],
    );
    if (!header) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Jurnal tidak ditemukan.');
    }

    const lines = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT jel.id::text, jel.line_no, coa.code AS account_code, coa.name AS account_name,
              jel.debit::text, jel.credit::text, jel.description, jel.dimensions
         FROM "${schema}".journal_entry_line jel
         JOIN "${schema}".chart_of_account coa ON coa.id = jel.account_id
        WHERE jel.journal_entry_id = $1
        ORDER BY jel.line_no ASC`,
      [id],
    );

    return { ...header, lines };
  }
}

// ---------------------------------------------------------------------------
// Controller: ERP vertical slice
// ---------------------------------------------------------------------------

@ApiTags('tenant')
@ApiBearerAuth('access-token')
@Controller()
export class ErpController {
  constructor(
    private readonly purchasing: ErpPurchasingService,
    private readonly inventory: ErpInventoryService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  // --- Request Order -------------------------------------------------------

  @Get('request-orders')
  @Permissions('PURCHASING_REQUEST_ORDER.READ')
  @ApiOperation({ summary: 'Daftar Request Order' })
  async listRequestOrders(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const rows = await this.inventoryQuery(
      ctx,
      `SELECT ro.id::text, ro.request_number, ro.status, ro.request_type, ro.priority,
              ro.needed_at, ro.created_at,
              w.code AS requesting_warehouse_code, w.name AS requesting_warehouse_name,
              (SELECT count(*) FROM "${ctx.schemaName}".request_order_line l WHERE l.request_order_id = ro.id) AS line_count
       FROM "${ctx.schemaName}".request_order ro
       LEFT JOIN "${ctx.schemaName}".warehouse w ON w.id = ro.requesting_warehouse_id
       WHERE ro.deleted_at IS NULL
       ORDER BY ro.created_at DESC
       LIMIT ${query.pageSize} OFFSET ${query.skip}`,
    );
    return rows;
  }

  @Get('request-orders/:id')
  @Permissions('PURCHASING_REQUEST_ORDER.READ')
  @ApiOperation({ summary: 'Detail Request Order' })
  async getRequestOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const rows = await this.inventoryQuery(
      ctx,
      `SELECT ro.*, w.code AS requesting_warehouse_code
       FROM "${ctx.schemaName}".request_order ro
       LEFT JOIN "${ctx.schemaName}".warehouse w ON w.id = ro.requesting_warehouse_id
       WHERE ro.id = $1`,
      [id],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Request Order tidak ditemukan.');
    const lines = await this.inventoryQuery(
      ctx,
      `SELECT rol.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM "${ctx.schemaName}".request_order_line rol
       JOIN "${ctx.schemaName}".product p ON p.id = rol.product_id
       JOIN "${ctx.schemaName}".uom u ON u.id = rol.uom_id
       WHERE rol.request_order_id = $1 ORDER BY rol.line_no`,
      [id],
    );
    return { ...rows[0], lines };
  }

  @Post('request-orders')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('PURCHASING_REQUEST_ORDER.CREATE')
  @ApiOperation({ summary: 'Membuat Request Order manual' })
  createRequestOrder(
    @Body() dto: CreateRequestOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.createRequestOrder(context(user, meta), dto, meta.idempotencyKey);
  }

  @Post('request-orders/generate-min-stock')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_REQUEST_ORDER.CREATE')
  @ApiOperation({
    summary: 'Menghasilkan Request Order otomatis dari kebijakan minimum stok',
    description: 'Alert dideduplikasi; kebutuhan yang sudah punya Request Order tidak digandakan.',
  })
  generateMinStock(@CurrentUser() user: AuthenticatedUser, @RequestContext() meta: RequestMeta) {
    return this.purchasing.generateMinStockRequestOrders(context(user, meta));
  }

  @Post('request-orders/:id/submit')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_REQUEST_ORDER.SUBMIT')
  @ApiOperation({ summary: 'Mengajukan Request Order' })
  submitRequestOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.transitionRequestOrder(context(user, meta), id, 'submit');
  }

  @Post('request-orders/:id/approve')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_REQUEST_ORDER.APPROVE')
  @ApiOperation({ summary: 'Menyetujui Request Order' })
  approveRequestOrder(
    @Param('id') id: string,
    @Body() body: { approvedQty?: Record<string, number> },
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.transitionRequestOrder(context(user, meta), id, 'approve', {
      approvedQty: body?.approvedQty,
    });
  }

  @Post('request-orders/:id/reject')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_REQUEST_ORDER.REJECT')
  @ApiOperation({ summary: 'Menolak Request Order' })
  rejectRequestOrder(
    @Param('id') id: string,
    @Body() dto: DeleteReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.transitionRequestOrder(context(user, meta), id, 'reject', {
      reason: dto.reason,
    });
  }

  // --- Purchase Order ------------------------------------------------------

  @Get('products/:id/suppliers')
  @Permissions('CATALOG_PRODUCT.READ')
  @ApiOperation({ summary: 'Pemasok yang dapat memasok produk ini' })
  suppliersForProduct(
    @Param('id') productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.suppliersForProduct(context(user, meta), productId);
  }

  @Get('purchase-orders')
  @Permissions('PURCHASING_PO.READ')
  @ApiOperation({ summary: 'Daftar Purchase Order' })
  async listPurchaseOrders(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    return this.inventoryQuery(
      ctx,
      `SELECT po.id::text, po.purchase_order_number, po.status, po.order_date, po.expected_date,
              po.grand_total::text AS grand_total, s.code AS supplier_code, s.name AS supplier_name,
              w.code AS warehouse_code
       FROM "${ctx.schemaName}".purchase_order po
       JOIN "${ctx.schemaName}".supplier s ON s.id = po.supplier_id
       LEFT JOIN "${ctx.schemaName}".warehouse w ON w.id = po.warehouse_id
       WHERE po.deleted_at IS NULL
       ORDER BY po.created_at DESC
       LIMIT ${query.pageSize} OFFSET ${query.skip}`,
    );
  }

  @Get('purchase-orders/:id')
  @Permissions('PURCHASING_PO.READ')
  @ApiOperation({ summary: 'Detail Purchase Order' })
  async getPurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const header = await this.inventoryQuery(
      ctx,
      `SELECT po.*, s.code AS supplier_code, s.name AS supplier_name
       FROM "${ctx.schemaName}".purchase_order po
       JOIN "${ctx.schemaName}".supplier s ON s.id = po.supplier_id
       WHERE po.id = $1`,
      [id],
    );
    if (!header.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Purchase Order tidak ditemukan.');
    const lines = await this.inventoryQuery(
      ctx,
      `SELECT pol.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM "${ctx.schemaName}".purchase_order_line pol
       JOIN "${ctx.schemaName}".product p ON p.id = pol.product_id
       JOIN "${ctx.schemaName}".uom u ON u.id = pol.uom_id
       WHERE pol.purchase_order_id = $1 ORDER BY pol.line_no`,
      [id],
    );
    return { ...header[0], lines };
  }

  @Post('purchase-orders')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('PURCHASING_PO.CREATE')
  @ApiOperation({ summary: 'Membuat Purchase Order' })
  createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.createPurchaseOrder(context(user, meta), dto, meta.idempotencyKey);
  }

  @Post('purchase-orders/:id/submit')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_PO.SUBMIT')
  @ApiOperation({ summary: 'Mengajukan PO untuk persetujuan' })
  submitPurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.transitionPurchaseOrder(context(user, meta), id, 'submit');
  }

  @Post('purchase-orders/:id/approve')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_PO.APPROVE')
  @ApiOperation({ summary: 'Menyetujui PO' })
  approvePurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.transitionPurchaseOrder(context(user, meta), id, 'approve');
  }

  @Post('purchase-orders/:id/send')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_PO.SUBMIT')
  @ApiOperation({ summary: 'Mengirim PO ke pemasok' })
  sendPurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.transitionPurchaseOrder(context(user, meta), id, 'send');
  }

  // --- Goods Receipt -------------------------------------------------------

  @Get('goods-receipts')
  @Permissions('PURCHASING_RECEIPT.READ')
  @ApiOperation({ summary: 'Daftar penerimaan barang' })
  async listGoodsReceipts(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    return this.inventoryQuery(
      ctx,
      `SELECT gr.id::text, gr.receipt_number, gr.status, gr.validation_status, gr.receipt_date,
              po.purchase_order_number, s.name AS supplier_name, w.code AS warehouse_code
       FROM "${ctx.schemaName}".goods_receipt gr
       LEFT JOIN "${ctx.schemaName}".purchase_order po ON po.id = gr.purchase_order_id
       LEFT JOIN "${ctx.schemaName}".supplier s ON s.id = gr.supplier_id
       LEFT JOIN "${ctx.schemaName}".warehouse w ON w.id = gr.warehouse_id
       WHERE gr.deleted_at IS NULL
       ORDER BY gr.created_at DESC
       LIMIT ${query.pageSize} OFFSET ${query.skip}`,
    );
  }

  @Get('goods-receipts/:id')
  @Permissions('PURCHASING_RECEIPT.READ')
  @ApiOperation({ summary: 'Detail penerimaan barang' })
  async getGoodsReceipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const header = await this.inventoryQuery(
      ctx,
      `SELECT gr.*, po.purchase_order_number, s.name AS supplier_name
       FROM "${ctx.schemaName}".goods_receipt gr
       LEFT JOIN "${ctx.schemaName}".purchase_order po ON po.id = gr.purchase_order_id
       LEFT JOIN "${ctx.schemaName}".supplier s ON s.id = gr.supplier_id
       WHERE gr.id = $1`,
      [id],
    );
    if (!header.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penerimaan tidak ditemukan.');
    const lines = await this.inventoryQuery(
      ctx,
      `SELECT grl.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM "${ctx.schemaName}".goods_receipt_line grl
       JOIN "${ctx.schemaName}".product p ON p.id = grl.product_id
       JOIN "${ctx.schemaName}".uom u ON u.id = grl.uom_id
       WHERE grl.goods_receipt_id = $1 ORDER BY grl.line_no`,
      [id],
    );
    return { ...header[0], lines };
  }

  @Post('goods-receipts')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('PURCHASING_RECEIPT.CREATE')
  @ApiOperation({
    summary: 'Membuat penerimaan barang',
    description: 'Penerimaan TIDAK menambah stok sebelum divalidasi.',
  })
  createGoodsReceipt(
    @Body() dto: CreateGoodsReceiptDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.createGoodsReceipt(context(user, meta), dto, meta.idempotencyKey);
  }

  @Post('goods-receipts/:id/inspect')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_RECEIPT.REVIEW')
  @ApiOperation({ summary: 'Pemeriksaan fisik penerimaan (belum menambah stok)' })
  inspectGoodsReceipt(
    @Param('id') id: string,
    @Body() dto: InspectGoodsReceiptDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.inspectGoodsReceipt(context(user, meta), id, dto);
  }

  @Post('goods-receipts/:id/validate')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_RECEIPT.POST')
  @ApiOperation({
    summary: 'Validasi penerimaan — stok bertambah di sini',
    description: 'Movement dan balance diperbarui dalam satu transaksi database.',
  })
  validateGoodsReceipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.validateGoodsReceipt(context(user, meta), id);
  }

  @Post('goods-receipts/:id/reverse-validation')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_RECEIPT.CANCEL')
  @ApiOperation({ summary: 'Membatalkan validasi dengan movement lawan (reversal)' })
  reverseValidation(
    @Param('id') id: string,
    @Body() dto: DeleteReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.reverseGoodsReceiptValidation(context(user, meta), id, dto.reason);
  }

  @Post('goods-receipts/:id/create-backorder')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('PURCHASING_BACKORDER.CREATE')
  @ApiOperation({ summary: 'Membuat Backorder dari kekurangan penerimaan' })
  createBackorder(
    @Param('id') id: string,
    @Body() dto: CreateBackorderDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.createBackorderFromReceipt(
      context(user, meta),
      id,
      dto,
      meta.idempotencyKey,
    );
  }

  // --- Backorder -----------------------------------------------------------

  @Get('backorders')
  @Permissions('PURCHASING_BACKORDER.READ')
  @ApiOperation({ summary: 'Daftar Backorder' })
  async listBackorders(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    return this.inventoryQuery(
      ctx,
      `SELECT bo.id::text, bo.backorder_number, bo.status, bo.due_date, bo.created_at,
              po.purchase_order_number AS source_purchase_order_number,
              gr.receipt_number AS source_receipt_number,
              os.name AS original_supplier_name, rs.name AS replacement_supplier_name
       FROM "${ctx.schemaName}".purchase_backorder bo
       LEFT JOIN "${ctx.schemaName}".purchase_order po ON po.id = bo.source_purchase_order_id
       LEFT JOIN "${ctx.schemaName}".goods_receipt gr ON gr.id = bo.source_goods_receipt_id
       LEFT JOIN "${ctx.schemaName}".supplier os ON os.id = bo.original_supplier_id
       LEFT JOIN "${ctx.schemaName}".supplier rs ON rs.id = bo.replacement_supplier_id
       WHERE bo.deleted_at IS NULL
       ORDER BY bo.created_at DESC
       LIMIT ${query.pageSize} OFFSET ${query.skip}`,
    );
  }

  @Get('backorders/:id')
  @Permissions('PURCHASING_BACKORDER.READ')
  @ApiOperation({ summary: 'Detail Backorder' })
  async getBackorder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const header = await this.inventoryQuery(
      ctx,
      `SELECT bo.*, po.purchase_order_number AS source_purchase_order_number,
              gr.receipt_number AS source_receipt_number
       FROM "${ctx.schemaName}".purchase_backorder bo
       LEFT JOIN "${ctx.schemaName}".purchase_order po ON po.id = bo.source_purchase_order_id
       LEFT JOIN "${ctx.schemaName}".goods_receipt gr ON gr.id = bo.source_goods_receipt_id
       WHERE bo.id = $1`,
      [id],
    );
    if (!header.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Backorder tidak ditemukan.');
    const lines = await this.inventoryQuery(
      ctx,
      `SELECT bol.*, p.code AS product_code, p.name AS product_name
       FROM "${ctx.schemaName}".purchase_backorder_line bol
       JOIN "${ctx.schemaName}".product p ON p.id = bol.product_id
       WHERE bol.backorder_id = $1 ORDER BY bol.line_no`,
      [id],
    );
    return { ...header[0], lines };
  }

  @Post('backorders/:id/assign-supplier')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('PURCHASING_BACKORDER.APPROVE')
  @ApiOperation({ summary: 'Menetapkan pemasok awal atau pemasok pengganti' })
  assignBackorderSupplier(
    @Param('id') id: string,
    @Body() dto: AssignSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.assignBackorderSupplier(context(user, meta), id, dto);
  }

  @Post('backorders/:id/create-purchase-order')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('PURCHASING_BACKORDER.CREATE')
  @ApiOperation({ summary: 'Membuat PO lanjutan dari Backorder (tetap terlacak ke PO sumber)' })
  createBackorderPurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.purchasing.createPurchaseOrderFromBackorder(context(user, meta), id);
  }

  // --- Inventory -----------------------------------------------------------

  @Get('inventory/stock-tree')
  @Permissions('INVENTORY_STOCK_TREE.READ')
  @ApiOperation({ summary: 'Monitoring stok berbentuk tree wilayah → gudang' })
  stockTree(
    @Query() query: StockTreeQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.stockTree(context(user, meta), query);
  }

  @Get('inventory/balances')
  @Permissions('INVENTORY_STOCK_TREE.READ')
  @ApiOperation({ summary: 'Saldo stok per gudang dan produk' })
  balances(
    @Query('warehouseId') warehouseId: string | undefined,
    @Query('productId') productId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.listBalances(context(user, meta), { warehouseId, productId });
  }

  @Get('inventory/movements')
  @Permissions('INVENTORY_MOVEMENT.READ')
  @ApiOperation({ summary: 'Kartu stok (ledger immutable)' })
  movements(
    @Query('productId') productId: string | undefined,
    @Query('warehouseId') warehouseId: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.listMovements(context(user, meta), {
      productId,
      warehouseId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('stock-alerts')
  @Permissions('INVENTORY_ALERT.READ')
  @ApiOperation({ summary: 'Notifikasi stok minimum yang masih terbuka' })
  stockAlerts(
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.listStockAlerts(context(user, meta), status ?? 'OPEN');
  }

  @Get('sales/orders')
  @Permissions('SALES_ORDER.READ')
  @ApiOperation({ summary: 'Daftar pesanan penjualan dan pipeline sales' })
  async listSalesOrders(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const search = query.search?.trim() || null;
    return this.inventoryQuery(
      ctx,
      `SELECT so.id::text, so.order_number, so.order_date::text, so.delivery_date::text,
              so.channel, so.currency_code, so.subtotal::text, so.discount_total::text,
              so.tax_total::text, so.grand_total::text, so.status,
              COALESCE(c.name, 'Pelanggan umum') AS customer_name,
              COALESCE(us.name, us.username_snapshot, 'Tanpa sales') AS sales_name,
              count(sol.id)::int AS line_count,
              COALESCE(sum(sol.ordered_qty), 0)::text AS ordered_qty,
              COALESCE(sum(sol.delivered_qty), 0)::text AS delivered_qty
         FROM ${S}.sales_order so
         LEFT JOIN ${S}.customer c ON c.id = so.customer_id
         LEFT JOIN ${S}.user_subject us ON us.id = so.created_by
         LEFT JOIN ${S}.sales_order_line sol ON sol.sales_order_id = so.id
        WHERE ($1::text IS NULL
           OR so.order_number ILIKE '%' || $1 || '%'
           OR so.channel ILIKE '%' || $1 || '%'
           OR so.status ILIKE '%' || $1 || '%'
           OR c.name ILIKE '%' || $1 || '%'
           OR us.name ILIKE '%' || $1 || '%'
           OR us.username_snapshot ILIKE '%' || $1 || '%')
        GROUP BY so.id, c.name, us.name, us.username_snapshot
        ORDER BY so.order_date DESC, so.created_at DESC
        LIMIT ${query.pageSize} OFFSET ${query.skip}`,
      [search],
    );
  }

  @Get('sales/orders/:id')
  @Permissions('SALES_ORDER.READ')
  @ApiOperation({ summary: 'Detail pesanan penjualan' })
  async getSalesOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const header = await this.inventoryQuery(
      ctx,
      `SELECT so.*, so.id::text AS id,
              COALESCE(c.name, 'Pelanggan umum') AS customer_name,
              COALESCE(us.name, us.username_snapshot, 'Tanpa sales') AS sales_name
         FROM ${S}.sales_order so
         LEFT JOIN ${S}.customer c ON c.id = so.customer_id
         LEFT JOIN ${S}.user_subject us ON us.id = so.created_by
        WHERE so.id = $1`,
      [id],
    );
    if (!header.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesanan penjualan tidak ditemukan.');
    const lines = await this.inventoryQuery(
      ctx,
      `SELECT sol.id::text, sol.line_no, sol.ordered_qty::text, sol.delivered_qty::text,
              sol.unit_price::text, sol.discount_amount::text, sol.tax_amount::text,
              sol.line_total::text, p.code AS product_code, p.name AS product_name, u.code AS uom_code
         FROM ${S}.sales_order_line sol
         JOIN ${S}.product p ON p.id = sol.product_id
         JOIN ${S}.uom u ON u.id = sol.uom_id
        WHERE sol.sales_order_id = $1
        ORDER BY sol.line_no`,
      [id],
    );
    return { ...header[0], lines };
  }

  @Get('inventory/sales-dashboard')
  @Permissions('SALES.READ')
  @ApiOperation({ summary: 'Dashboard sales dan inventory untuk pemilik, admin, dan sales lapangan' })
  async salesInventoryDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const [summary, topSales, topProducts, topCustomers, expiringLots, recentOrders] =
      await Promise.all([
        this.inventoryQuery(
          ctx,
          `SELECT
             (SELECT count(*)::int FROM ${S}.product WHERE deleted_at IS NULL) AS products,
             (SELECT count(*)::int FROM ${S}.customer WHERE deleted_at IS NULL) AS customers,
             (SELECT count(*)::int FROM ${S}.supplier WHERE deleted_at IS NULL) AS suppliers,
             (SELECT count(*)::int FROM ${S}.sales_order WHERE order_date = CURRENT_DATE) AS orders_today,
             (SELECT COALESCE(sum(grand_total), 0)::text FROM ${S}.sales_order WHERE order_date = CURRENT_DATE) AS revenue_today,
             (SELECT count(*)::int FROM ${S}.sales_order WHERE order_date >= date_trunc('month', CURRENT_DATE)::date) AS orders_month,
             (SELECT COALESCE(sum(grand_total), 0)::text FROM ${S}.sales_order WHERE order_date >= date_trunc('month', CURRENT_DATE)::date) AS revenue_month,
             (SELECT COALESCE(sum(sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost)), 0)::text
                FROM ${S}.sales_order_line sol
                JOIN ${S}.sales_order so ON so.id = sol.sales_order_id
                JOIN ${S}.product p ON p.id = sol.product_id
               WHERE so.order_date >= date_trunc('month', CURRENT_DATE)::date) AS cogs_month,
             (SELECT COALESCE(sum(sol.line_total - (sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost))), 0)::text
                FROM ${S}.sales_order_line sol
                JOIN ${S}.sales_order so ON so.id = sol.sales_order_id
                JOIN ${S}.product p ON p.id = sol.product_id
               WHERE so.order_date >= date_trunc('month', CURRENT_DATE)::date) AS gross_profit_month,
             (SELECT COALESCE(sum(on_hand_qty), 0)::text FROM ${S}.stock_balance) AS on_hand_qty,
             (SELECT COALESCE(sum(available_qty), 0)::text FROM ${S}.stock_balance) AS available_qty,
             (SELECT count(*)::int FROM ${S}.inventory_lot WHERE expiry_date < CURRENT_DATE AND deleted_at IS NULL) AS expired_lots,
             (SELECT count(*)::int FROM ${S}.inventory_lot WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days' AND deleted_at IS NULL) AS expiring_lots`,
        ),
        this.inventoryQuery(
          ctx,
          `SELECT COALESCE(us.name, us.username_snapshot, 'Tanpa sales') AS sales_name,
                  count(DISTINCT so.id)::int AS orders,
                  COALESCE(sum(sol.line_total), 0)::text AS revenue,
                  COALESCE(sum(sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost)), 0)::text AS cogs,
                  COALESCE(sum(sol.line_total - (sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost))), 0)::text AS gross_profit
             FROM ${S}.sales_order so
             JOIN ${S}.sales_order_line sol ON sol.sales_order_id = so.id
             JOIN ${S}.product p ON p.id = sol.product_id
             LEFT JOIN ${S}.user_subject us ON us.id = so.created_by
            WHERE so.order_date >= date_trunc('month', CURRENT_DATE)::date
            GROUP BY us.name, us.username_snapshot
            ORDER BY COALESCE(sum(sol.line_total), 0) DESC
            LIMIT 8`,
        ),
        this.inventoryQuery(
          ctx,
          `SELECT p.code AS product_code, p.name AS product_name,
                  COALESCE(sum(sol.ordered_qty), 0)::text AS qty,
                  COALESCE(sum(sol.line_total), 0)::text AS revenue,
                  COALESCE(sum(sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost)), 0)::text AS cogs,
                  COALESCE(sum(sol.line_total - (sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost))), 0)::text AS gross_profit
             FROM ${S}.sales_order_line sol
             JOIN ${S}.sales_order so ON so.id = sol.sales_order_id
             JOIN ${S}.product p ON p.id = sol.product_id
            WHERE so.order_date >= date_trunc('month', CURRENT_DATE)::date
            GROUP BY p.code, p.name
            ORDER BY COALESCE(sum(sol.line_total), 0) DESC
            LIMIT 10`,
        ),
        this.inventoryQuery(
          ctx,
          `SELECT COALESCE(c.name, 'Pelanggan umum') AS customer_name,
                  count(so.id)::int AS orders,
                  COALESCE(sum(so.grand_total), 0)::text AS revenue
             FROM ${S}.sales_order so
             LEFT JOIN ${S}.customer c ON c.id = so.customer_id
            WHERE so.order_date >= date_trunc('month', CURRENT_DATE)::date
            GROUP BY c.name
            ORDER BY COALESCE(sum(so.grand_total), 0) DESC
            LIMIT 8`,
        ),
        this.inventoryQuery(
          ctx,
          `SELECT p.code AS product_code, p.name AS product_name, l.lot_number, l.expiry_date::text
             FROM ${S}.inventory_lot l
             JOIN ${S}.product p ON p.id = l.product_id
            WHERE l.expiry_date IS NOT NULL
              AND l.expiry_date <= CURRENT_DATE + INTERVAL '180 days'
              AND l.deleted_at IS NULL
            ORDER BY l.expiry_date ASC
            LIMIT 10`,
        ),
        this.inventoryQuery(
          ctx,
          `SELECT so.id::text, so.order_number, so.order_date::text, so.status,
                  so.grand_total::text, COALESCE(c.name, 'Pelanggan umum') AS customer_name,
                  COALESCE(us.name, us.username_snapshot, 'Tanpa sales') AS sales_name
             FROM ${S}.sales_order so
             LEFT JOIN ${S}.customer c ON c.id = so.customer_id
             LEFT JOIN ${S}.user_subject us ON us.id = so.created_by
            ORDER BY so.order_date DESC, so.created_at DESC
            LIMIT 12`,
        ),
      ]);

    return {
      summary: summary[0] ?? {},
      topSales,
      topProducts,
      topCustomers,
      expiringLots,
      recentOrders,
    };
  }

  @Get('inventory/mobile-catalog')
  @Permissions('SALES_ORDER.READ')
  @ApiOperation({ summary: 'Katalog ringkas customer dan produk untuk klien Flutter sales' })
  async mobileInventoryCatalog(
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const [customers, products] = await Promise.all([
      this.inventoryQuery(
        ctx,
        `SELECT id::text, code, name
           FROM ${S}.customer
          WHERE deleted_at IS NULL AND is_active
          ORDER BY name
          LIMIT 1000`,
      ),
      this.inventoryQuery(
        ctx,
        `SELECT p.id::text, p.code, p.name, p.base_uom_id::text AS uom_id,
                p.default_sale_price::text AS price,
                COALESCE(sum(sb.available_qty), 0)::text AS available_qty
           FROM ${S}.product p
           LEFT JOIN ${S}.stock_balance sb ON sb.product_id = p.id
          WHERE p.deleted_at IS NULL AND p.is_active AND p.is_sellable
          GROUP BY p.id
          ORDER BY p.name
          LIMIT 1000`,
      ),
    ]);
    return { customers, products };
  }

  @Get('inventory/master-data')
  @Permissions('SALES.READ')
  @ApiOperation({ summary: 'Master produk, customer, dan supplier lengkap untuk workspace Inventory web' })
  async inventoryMasterData(
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const [products, customers, suppliers] = await Promise.all([
      this.inventoryQuery(
        ctx,
        `SELECT id::text, code, name, is_active, metadata
           FROM ${S}.product
          WHERE deleted_at IS NULL
          ORDER BY name
          LIMIT 1000`,
      ),
      this.inventoryQuery(
        ctx,
        `SELECT id::text, code, name, is_active, metadata
           FROM ${S}.customer
          WHERE deleted_at IS NULL
          ORDER BY name
          LIMIT 1000`,
      ),
      this.inventoryQuery(
        ctx,
        `SELECT id::text, code, name, is_active, metadata
           FROM ${S}.supplier
          WHERE deleted_at IS NULL
          ORDER BY name
          LIMIT 1000`,
      ),
    ]);
    return { products, customers, suppliers };
  }

  @Post('inventory/mobile-orders')
  @Permissions('SALES_ORDER.CREATE')
  @BlockDemo()
  @HttpCode(201)
  @ApiOperation({ summary: 'Kirim order sales Flutter secara idempoten' })
  async createMobileInventoryOrder(
    @Body() body: CreateMobileSalesOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    if (!body.lines.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Order harus memiliki minimal satu barang.');
    }
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    return this.tenantDb.transaction(ctx.schemaName, async (client) => {
      const subject = await client.query<{ id: string }>(
        `SELECT id::text FROM ${S}.user_subject
          WHERE id = $1::uuid OR platform_user_id = $1::uuid LIMIT 1`,
        [ctx.userId],
      );
      if (!subject.rowCount) {
        throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Akun tidak terhubung ke subject tenant.');
      }
      const subjectId = subject.rows[0].id;
      const deviceId = body.deviceId?.trim() || 'legacy-mobile-client';
      await client.query(
        `INSERT INTO ${S}.inventory_mobile_command
           (device_id, device_event_id, command_type, payload, status, user_subject_id)
         VALUES ($1, $2, 'CREATE_SALES_ORDER', $3::jsonb, 'PROCESSING', $4::uuid)
         ON CONFLICT (device_id, device_event_id) DO NOTHING`,
        [deviceId, body.deviceEventId, JSON.stringify(body), subjectId],
      );
      const existing = await client.query<{ id: string; order_number: string }>(
        `SELECT id::text, order_number FROM ${S}.sales_order WHERE source_event_id = $1`,
        [body.deviceEventId],
      );
      if (existing.rowCount) {
        await client.query(
          `UPDATE ${S}.inventory_mobile_command
              SET status = 'PROCESSED', result_payload = $3::jsonb, processed_at = now()
            WHERE device_id = $1 AND device_event_id = $2`,
          [deviceId, body.deviceEventId, JSON.stringify(existing.rows[0])],
        );
        return { ...existing.rows[0], idempotent: true };
      }
      const customer = await client.query<{ id: string }>(
        `SELECT id::text FROM ${S}.customer WHERE id = $1::uuid AND deleted_at IS NULL AND is_active`,
        [body.customerId],
      );
      if (!customer.rowCount) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Customer tidak ditemukan atau tidak aktif.');
      const productIds = Array.from(new Set(body.lines.map((line) => line.productId)));
      const products = await client.query<{ id: string; standard_cost: string; default_sale_price: string }>(
        `SELECT id::text, standard_cost::text, default_sale_price::text
           FROM ${S}.product
          WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL AND is_active AND is_sellable`,
        [productIds],
      );
      const productMap = new Map(products.rows.map((row) => [row.id, row]));
      if (productMap.size !== productIds.length) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Satu atau lebih produk tidak tersedia untuk dijual.');
      }
      const subtotal = body.lines.reduce((sum, line) => sum + line.qty * Number(productMap.get(line.productId)?.default_sale_price ?? 0), 0);
      const orderNumber = `MOB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${body.deviceEventId.replace(/[^a-zA-Z0-9]/g, '').slice(-16)}`.slice(0, 48);
      const outlet = await client.query<{ id: string }>(`SELECT id::text FROM ${S}.outlet WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`);
      const order = await client.query<{ id: string; order_number: string }>(
        `INSERT INTO ${S}.sales_order
           (customer_id, outlet_id, order_number, order_date, delivery_date, channel, subtotal, grand_total, status, created_by, source_event_id)
         VALUES ($1::uuid, $2::uuid, $3, CURRENT_DATE, $4::date, 'FIELD_SALES', $5, $5, 'CONFIRMED', $6::uuid, $7)
         RETURNING id::text, order_number`,
        [body.customerId, outlet.rows[0]?.id ?? null, orderNumber, body.deliveryDate ?? null, subtotal, subjectId, body.deviceEventId],
      );
      for (const [index, line] of body.lines.entries()) {
        const product = productMap.get(line.productId)!;
        const price = Number(product.default_sale_price);
        await client.query(
          `INSERT INTO ${S}.sales_order_line
             (sales_order_id, product_id, uom_id, line_no, ordered_qty, unit_price, line_total, legacy_unit_cost)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)`,
          [order.rows[0].id, line.productId, line.uomId, index + 1, line.qty, price, line.qty * price, Number(product.standard_cost)],
        );
      }
      const result = { ...order.rows[0], idempotent: false, subtotal: subtotal.toString() };
      await client.query(
        `UPDATE ${S}.inventory_mobile_command
            SET status = 'PROCESSED', result_payload = $3::jsonb, processed_at = now()
          WHERE device_id = $1 AND device_event_id = $2`,
        [deviceId, body.deviceEventId, JSON.stringify(result)],
      );
      await client.query(
        `INSERT INTO ${S}.inventory_sync_event
           (aggregate_type, aggregate_id, event_type, payload, actor_id)
         VALUES ('SALES_ORDER', $1, 'SALES_ORDER_CREATED', $2::jsonb, $3::uuid)`,
        [order.rows[0].id, JSON.stringify({ orderNumber: order.rows[0].order_number }), subjectId],
      );
      return result;
    });
  }

  @Get('inventory/parity-summary')
  @Permissions('SALES.READ')
  @ApiOperation({ summary: 'Ringkasan paritas 48 layar, laba kotor nyata, dan aging piutang/hutang' })
  async salesInventoryParitySummary(
    @Query('asOf') asOf: string | undefined,
    @Query('includeSettled') includeSettledRaw: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const asOfDate = asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf)
      ? asOf
      : new Date().toISOString().slice(0, 10);
    const includeSettled = includeSettledRaw === 'true' || includeSettledRaw === '1';
    const agingSql = (table: 'legacy_receivable_ledger' | 'legacy_payable_ledger') => `
      SELECT
        count(*)::int AS documents,
        COALESCE(sum(amount), 0)::text AS total,
        COALESCE(sum(amount) FILTER (WHERE is_settled), 0)::text AS settled,
        COALESCE(sum(amount) FILTER (WHERE NOT is_settled AND COALESCE(due_date, transaction_date, $1::date) >= $1::date), 0)::text AS not_due,
        COALESCE(sum(amount) FILTER (WHERE NOT is_settled AND $1::date - COALESCE(due_date, transaction_date, $1::date) BETWEEN 1 AND 30), 0)::text AS bucket_1_30,
        COALESCE(sum(amount) FILTER (WHERE NOT is_settled AND $1::date - COALESCE(due_date, transaction_date, $1::date) BETWEEN 31 AND 60), 0)::text AS bucket_31_60,
        COALESCE(sum(amount) FILTER (WHERE NOT is_settled AND $1::date - COALESCE(due_date, transaction_date, $1::date) BETWEEN 61 AND 90), 0)::text AS bucket_61_90,
        COALESCE(sum(amount) FILTER (WHERE NOT is_settled AND $1::date - COALESCE(due_date, transaction_date, $1::date) > 90), 0)::text AS bucket_over_90
      FROM ${S}.${table}
      WHERE ($2::boolean OR NOT is_settled)`;
    const [receivables, payables, profitBySales, profitByProduct, parityEvidence] = await Promise.all([
      this.inventoryQuery(ctx, agingSql('legacy_receivable_ledger'), [asOfDate, includeSettled]),
      this.inventoryQuery(ctx, agingSql('legacy_payable_ledger'), [asOfDate, includeSettled]),
      this.inventoryQuery(
        ctx,
        `SELECT COALESCE(us.name, us.username_snapshot, 'Tanpa sales') AS sales_name,
                count(DISTINCT so.id)::int AS invoices,
                COALESCE(sum(sol.line_total), 0)::text AS revenue,
                COALESCE(sum(sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost)), 0)::text AS cogs,
                COALESCE(sum(sol.line_total - sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost)), 0)::text AS gross_profit
           FROM ${S}.sales_order so
           JOIN ${S}.sales_order_line sol ON sol.sales_order_id = so.id
           JOIN ${S}.product p ON p.id = sol.product_id
           LEFT JOIN ${S}.user_subject us ON us.id = so.created_by
          WHERE so.order_date <= COALESCE($1::date, CURRENT_DATE)
          GROUP BY us.name, us.username_snapshot
          ORDER BY sum(sol.line_total) DESC`,
        [asOfDate],
      ),
      this.inventoryQuery(
        ctx,
        `SELECT p.code AS product_code, p.name AS product_name,
                COALESCE(sum(sol.ordered_qty), 0)::text AS qty,
                COALESCE(sum(sol.line_total), 0)::text AS revenue,
                COALESCE(sum(sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost)), 0)::text AS cogs,
                COALESCE(sum(sol.line_total - sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost)), 0)::text AS gross_profit
           FROM ${S}.sales_order so
           JOIN ${S}.sales_order_line sol ON sol.sales_order_id = so.id
           JOIN ${S}.product p ON p.id = sol.product_id
          WHERE so.order_date <= COALESCE($1::date, CURRENT_DATE)
          GROUP BY p.code, p.name
          ORDER BY sum(sol.line_total) DESC
          LIMIT 1000`,
        [asOfDate],
      ),
      this.inventoryQuery(
        ctx,
        `SELECT
           (SELECT count(*)::int FROM ${S}.product WHERE deleted_at IS NULL) AS products,
           (SELECT count(*)::int FROM ${S}.customer WHERE deleted_at IS NULL) AS customers,
           (SELECT count(*)::int FROM ${S}.supplier WHERE deleted_at IS NULL) AS suppliers,
           (SELECT count(*)::int FROM ${S}.sales_order) AS sales_orders,
           (SELECT count(*)::int FROM ${S}.purchase_order WHERE source_type = 'CMN_LEGACY_DBF') AS purchase_orders,
           (SELECT count(*)::int FROM ${S}.legacy_import_record) AS raw_records,
           (SELECT count(*)::int FROM ${S}.legacy_receivable_ledger WHERE source_deleted) AS settled_receivable_rows,
           (SELECT count(*)::int FROM ${S}.legacy_payable_ledger WHERE source_deleted) AS settled_payable_rows,
           (SELECT count(*)::int FROM ${S}.legacy_price_history) AS price_history_rows,
           (SELECT count(*)::int FROM ${S}.legacy_stock_opname) AS stock_opname_rows,
           (SELECT count(*)::int FROM ${S}.sales_note_handover) AS note_handovers,
           (SELECT count(*)::int FROM ${S}.inventory_report_snapshot) AS report_snapshots`,
      ),
    ]);
    return {
      asOf: asOfDate,
      includeSettled,
      receivables: receivables[0] ?? {},
      payables: payables[0] ?? {},
      profitBySales,
      profitByProduct,
      evidence: parityEvidence[0] ?? {},
      parity: { screens: 48, mapped: 48, requiresBusinessUat: ['Sales Bawa Nota', 'Proses Akhir Periode'] },
    };
  }

  @Get('inventory/legacy-import-reconciliation')
  @Permissions('SALES.READ')
  @ApiOperation({ summary: 'Rekonsiliasi impor legacy inventory CMN per file sumber' })
  async legacyImportReconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const [files, totals, salesMap, statusSummary] = await Promise.all([
      this.inventoryQuery(
        ctx,
        `SELECT f.file_name, f.status, f.total_records, f.active_records, f.deleted_records, f.imported_records,
                COUNT(r.id)::int AS raw_records,
                COUNT(r.id) FILTER (WHERE r.projection_status <> 'RAW_ONLY')::int AS projected_records,
                COUNT(r.id) FILTER (WHERE r.projection_status = 'RAW_ONLY')::int AS raw_only_records,
                COALESCE(jsonb_array_length(f.metadata->'fields'), 0)::int AS field_count,
                f.metadata->>'projectedTable' AS projected_table,
                f.metadata->>'projectionClass' AS projection_class,
                f.metadata->>'projectionNote' AS projection_note,
                f.imported_at::text
           FROM ${S}.legacy_import_file f
           LEFT JOIN ${S}.legacy_import_record r ON r.import_file_id = f.id
          GROUP BY f.id, f.file_name, f.status, f.total_records, f.active_records, f.deleted_records,
                   f.imported_records, f.metadata, f.imported_at
          ORDER BY
            CASE f.status
              WHEN 'PROJECTED' THEN 1
              WHEN 'RAW_VAULT_ONLY' THEN 2
              WHEN 'DUPLICATE_SUMMARY' THEN 3
              WHEN 'SECURITY_ARCHIVE' THEN 4
              WHEN 'BROKEN_ARCHIVE' THEN 5
              WHEN 'RUNTIME_ARTIFACT' THEN 6
              ELSE 7
            END,
            f.file_name`,
      ),
      this.inventoryQuery(
        ctx,
        `SELECT
           (SELECT count(*)::int FROM ${S}.legacy_import_record) AS raw_records,
           (SELECT count(*)::int FROM ${S}.legacy_import_file) AS files,
           (SELECT count(*)::int FROM ${S}.legacy_receivable_ledger) AS receivable_rows,
           (SELECT COALESCE(sum(amount), 0)::text FROM ${S}.legacy_receivable_ledger) AS receivable_amount,
           (SELECT count(*)::int FROM ${S}.legacy_payable_ledger) AS payable_rows,
           (SELECT COALESCE(sum(amount), 0)::text FROM ${S}.legacy_payable_ledger) AS payable_amount,
           (SELECT count(*)::int FROM ${S}.legacy_price_history) AS price_history_rows,
           (SELECT count(*)::int FROM ${S}.legacy_stock_opname) AS stock_opname_rows,
           (SELECT count(*)::int FROM ${S}.purchase_order WHERE source_type = 'CMN_LEGACY_DBF') AS purchase_orders,
           (SELECT count(*)::int FROM ${S}.supplier_invoice WHERE status = 'APPROVED') AS supplier_invoices`,
      ),
      this.inventoryQuery(
        ctx,
        `SELECT legacy_code, legacy_name, mapped_username, COALESCE(us.name, us.username_snapshot) AS mapped_name
           FROM ${S}.legacy_salesperson_map lsm
           LEFT JOIN ${S}.user_subject us ON us.id = lsm.user_subject_id
          WHERE lsm.is_active
          ORDER BY legacy_name`,
      ),
      this.inventoryQuery(
        ctx,
        `SELECT f.status,
                count(*)::int AS files,
                COALESCE(sum(f.active_records), 0)::int AS active_records,
                COALESCE(sum(f.deleted_records), 0)::int AS deleted_records,
                COALESCE(sum(raw.raw_records), 0)::int AS raw_records,
                COALESCE(sum(raw.raw_only_records), 0)::int AS raw_only_records
           FROM ${S}.legacy_import_file f
           LEFT JOIN LATERAL (
             SELECT count(*)::int AS raw_records,
                    count(*) FILTER (WHERE r.projection_status = 'RAW_ONLY')::int AS raw_only_records
               FROM ${S}.legacy_import_record r
              WHERE r.import_file_id = f.id
           ) raw ON TRUE
          GROUP BY f.status
          ORDER BY f.status`,
      ),
    ]);
    return { files, totals: totals[0] ?? {}, salesMap, statusSummary };
  }

  @Get('inventory/legacy/receivables')
  @Permissions('SALES.READ')
  @ApiOperation({ summary: 'Piutang legacy CMN dari Tran_Piut dan PIUTSEMEN' })
  async legacyReceivables(
    @Query() query: InventoryLegacyQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const search = query.search?.trim() || null;
    return this.inventoryQuery(
      ctx,
      `SELECT lr.id::text, lr.source_file, lr.legacy_invoice_number, lr.transaction_date::text,
              lr.due_date::text, lr.paid_at::text, lr.amount::text AS original_amount,
              GREATEST(abs(lr.amount) - COALESCE(settlement.allocated_amount, 0), 0)::text AS amount,
              lr.payment_note,
              lr.giro_number, lr.bank_name, lr.return_number, lr.is_settled, lr.source_deleted, lr.status,
              CASE
                WHEN lr.is_settled THEN 'LUNAS'
                WHEN lr.due_date IS NULL OR lr.due_date >= CURRENT_DATE THEN 'BELUM JATUH TEMPO'
                WHEN CURRENT_DATE - lr.due_date <= 30 THEN '1-30'
                WHEN CURRENT_DATE - lr.due_date <= 60 THEN '31-60'
                WHEN CURRENT_DATE - lr.due_date <= 90 THEN '61-90'
                ELSE '>90'
              END AS aging_bucket,
              lr.customer_id::text AS customer_id, lr.salesperson_id::text AS salesperson_id,
              COALESCE(c.name, lr.metadata->>'KODECUST', 'Pelanggan tidak dikenal') AS customer_name,
              COALESCE(us.name, us.username_snapshot, lr.metadata->>'KODESALES', 'Tanpa sales') AS sales_name
         FROM ${S}.legacy_receivable_ledger lr
         LEFT JOIN ${S}.customer c ON c.id = lr.customer_id
         LEFT JOIN ${S}.user_subject us ON us.id = lr.salesperson_id
         LEFT JOIN LATERAL (
           SELECT sum(a.allocated_amount) AS allocated_amount
             FROM ${S}.inventory_ar_receipt_allocation a
             JOIN ${S}.inventory_ar_receipt r ON r.id = a.receipt_id
            WHERE a.receivable_ledger_id = lr.id AND r.status = 'POSTED'
         ) settlement ON TRUE
        WHERE ($2::boolean OR NOT lr.is_settled)
          AND ($1::text IS NULL
           OR lr.legacy_invoice_number ILIKE '%' || $1 || '%'
           OR c.name ILIKE '%' || $1 || '%'
           OR us.name ILIKE '%' || $1 || '%'
           OR lr.bank_name ILIKE '%' || $1 || '%')
        ORDER BY lr.due_date DESC NULLS LAST, lr.transaction_date DESC NULLS LAST
        LIMIT ${query.pageSize} OFFSET ${query.skip}`,
      [search, query.includeSettled],
    );
  }

  @Get('inventory/legacy/payables')
  @Permissions('PURCHASE_ORDER.READ')
  @ApiOperation({ summary: 'Hutang legacy CMN dari Tran_Hut' })
  async legacyPayables(
    @Query() query: InventoryLegacyQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const search = query.search?.trim() || null;
    return this.inventoryQuery(
      ctx,
      `SELECT lp.id::text, lp.source_file, lp.legacy_invoice_number, lp.transaction_date::text,
              lp.due_date::text, lp.paid_at::text, lp.amount::text AS original_amount,
              GREATEST(abs(lp.amount) - COALESCE(settlement.allocated_amount, 0), 0)::text AS amount,
              lp.payment_note,
              lp.giro_number, lp.bank_name, lp.is_settled, lp.source_deleted, lp.status,
              CASE
                WHEN lp.is_settled THEN 'LUNAS'
                WHEN lp.due_date IS NULL OR lp.due_date >= CURRENT_DATE THEN 'BELUM JATUH TEMPO'
                WHEN CURRENT_DATE - lp.due_date <= 30 THEN '1-30'
                WHEN CURRENT_DATE - lp.due_date <= 60 THEN '31-60'
                WHEN CURRENT_DATE - lp.due_date <= 90 THEN '61-90'
                ELSE '>90'
              END AS aging_bucket,
              lp.supplier_id::text AS supplier_id,
              COALESCE(s.name, lp.metadata->>'KODESUPPL', 'Supplier tidak dikenal') AS supplier_name
         FROM ${S}.legacy_payable_ledger lp
         LEFT JOIN ${S}.supplier s ON s.id = lp.supplier_id
         LEFT JOIN LATERAL (
           SELECT sum(a.allocated_amount) AS allocated_amount
             FROM ${S}.inventory_ap_payment_allocation a
             JOIN ${S}.inventory_ap_payment p ON p.id = a.payment_id
            WHERE a.payable_ledger_id = lp.id AND p.status = 'POSTED'
         ) settlement ON TRUE
        WHERE ($2::boolean OR NOT lp.is_settled)
          AND ($1::text IS NULL
           OR lp.legacy_invoice_number ILIKE '%' || $1 || '%'
           OR s.name ILIKE '%' || $1 || '%'
           OR lp.bank_name ILIKE '%' || $1 || '%')
        ORDER BY lp.due_date DESC NULLS LAST, lp.transaction_date DESC NULLS LAST
        LIMIT ${query.pageSize} OFFSET ${query.skip}`,
      [search, query.includeSettled],
    );
  }

  @Get('inventory/legacy/price-history')
  @Permissions('SALES.READ')
  @ApiOperation({ summary: 'Riwayat harga jual dan beli legacy CMN' })
  async legacyPriceHistory(
    @Query() query: InventoryLegacyQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const search = query.search?.trim() || null;
    return this.inventoryQuery(
      ctx,
      `SELECT lph.id::text, lph.source_file, lph.party_type, lph.effective_date::text,
              lph.price::text, p.code AS product_code, p.name AS product_name,
              COALESCE(c.name, s.name, 'Mitra tidak dikenal') AS party_name
         FROM ${S}.legacy_price_history lph
         LEFT JOIN ${S}.product p ON p.id = lph.product_id
         LEFT JOIN ${S}.customer c ON c.id = lph.customer_id
         LEFT JOIN ${S}.supplier s ON s.id = lph.supplier_id
        WHERE ($1::text IS NULL
           OR p.code ILIKE '%' || $1 || '%'
           OR p.name ILIKE '%' || $1 || '%'
           OR c.name ILIKE '%' || $1 || '%'
           OR s.name ILIKE '%' || $1 || '%')
        ORDER BY lph.effective_date DESC NULLS LAST, p.name
        LIMIT ${query.pageSize} OFFSET ${query.skip}`,
      [search],
    );
  }

  @Get('inventory/legacy/stock-opname')
  @Permissions('INVENTORY_STOCK_COUNT.READ')
  @ApiOperation({ summary: 'Stock opname legacy CMN dari dataopn' })
  async legacyStockOpname(
    @Query() query: InventoryLegacyQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const S = `"${ctx.schemaName}"`;
    const search = query.search?.trim() || null;
    return this.inventoryQuery(
      ctx,
      `SELECT lso.id::text, lso.source_file, lso.opname_date::text, lso.system_qty::text,
              lso.physical_qty::text, lso.variance_qty::text, lso.unit_cost::text,
              p.code AS product_code, p.name AS product_name
         FROM ${S}.legacy_stock_opname lso
         LEFT JOIN ${S}.product p ON p.id = lso.product_id
        WHERE ($1::text IS NULL
           OR p.code ILIKE '%' || $1 || '%'
           OR p.name ILIKE '%' || $1 || '%')
        ORDER BY lso.opname_date DESC NULLS LAST, p.name
        LIMIT ${query.pageSize} OFFSET ${query.skip}`,
      [search],
    );
  }

  // --- Internal Transfer ---------------------------------------------------

  @Get('internal-transfers')
  @Permissions('INVENTORY_TRANSFER.READ')
  @ApiOperation({ summary: 'Daftar Internal Transfer' })
  async listTransfers(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    return this.inventoryQuery(
      ctx,
      `SELECT it.id::text, it.transfer_number, it.status, it.dispatch_date, it.received_date,
              sw.code AS source_warehouse_code, dw.code AS destination_warehouse_code
       FROM "${ctx.schemaName}".internal_transfer it
       JOIN "${ctx.schemaName}".warehouse sw ON sw.id = it.source_warehouse_id
       JOIN "${ctx.schemaName}".warehouse dw ON dw.id = it.destination_warehouse_id
       WHERE it.deleted_at IS NULL
       ORDER BY it.created_at DESC
       LIMIT ${query.pageSize} OFFSET ${query.skip}`,
    );
  }

  @Get('internal-transfers/:id')
  @Permissions('INVENTORY_TRANSFER.READ')
  @ApiOperation({ summary: 'Detail Internal Transfer' })
  async getTransfer(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const ctx = context(user, meta);
    const header = await this.inventoryQuery(
      ctx,
      `SELECT it.*, sw.code AS source_warehouse_code, dw.code AS destination_warehouse_code
       FROM "${ctx.schemaName}".internal_transfer it
       JOIN "${ctx.schemaName}".warehouse sw ON sw.id = it.source_warehouse_id
       JOIN "${ctx.schemaName}".warehouse dw ON dw.id = it.destination_warehouse_id
       WHERE it.id = $1`,
      [id],
    );
    if (!header.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transfer tidak ditemukan.');
    const lines = await this.inventoryQuery(
      ctx,
      `SELECT itl.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM "${ctx.schemaName}".internal_transfer_line itl
       JOIN "${ctx.schemaName}".product p ON p.id = itl.product_id
       JOIN "${ctx.schemaName}".uom u ON u.id = itl.uom_id
       WHERE itl.internal_transfer_id = $1 ORDER BY itl.line_no`,
      [id],
    );
    return { ...header[0], lines };
  }

  @Post('internal-transfers')
  @HttpCode(201)
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.CREATE')
  @ApiOperation({ summary: 'Membuat Internal Transfer' })
  createTransfer(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.createTransfer(context(user, meta), dto, meta.idempotencyKey);
  }

  @Post('internal-transfers/:id/approve')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.APPROVE')
  @ApiOperation({ summary: 'Menyetujui transfer' })
  approveTransfer(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.approveTransfer(context(user, meta), id);
  }

  @Post('internal-transfers/:id/allocate')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.UPDATE')
  @ApiOperation({ summary: 'Mengalokasikan stok gudang sumber' })
  allocateTransfer(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.allocateTransfer(context(user, meta), id);
  }

  @Post('internal-transfers/:id/dispatch')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.POST')
  @ApiOperation({
    summary: 'Mengirim transfer',
    description: 'Available sumber berkurang, in-transit bertambah, stok tujuan belum bertambah.',
  })
  dispatchTransfer(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.dispatchTransfer(context(user, meta), id);
  }

  @Post('internal-transfers/:id/arrive')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.UPDATE')
  @ApiOperation({ summary: 'Menandai transfer tiba di tujuan' })
  arriveTransfer(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.arriveTransfer(context(user, meta), id);
  }

  @Post('internal-transfers/:id/validate-receipt')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('INVENTORY_TRANSFER.POST')
  @ApiOperation({
    summary: 'Validasi penerimaan tujuan',
    description: 'In-transit berkurang, on-hand tujuan bertambah, selisih menjadi discrepancy.',
  })
  validateTransferReceipt(
    @Param('id') id: string,
    @Body() dto: ValidateTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.inventory.validateTransferReceipt(context(user, meta), id, dto);
  }

  // -------------------------------------------------------------------------

  /** Query baca-saja pada schema tenant untuk daftar dan detail dokumen. */
  private async inventoryQuery(
    ctx: LifecycleContext,
    sql: string,
    params: unknown[] = [],
  ): Promise<Array<Record<string, unknown>>> {
    return this.tenantDb.query<Record<string, unknown>>(ctx.schemaName, sql, params);
  }
}

function context(user: AuthenticatedUser, meta: RequestMeta): LifecycleContext {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terhubung ke tenant mana pun.');
  }
  return {
    schemaName: user.schemaName,
    tenantId: user.tenantId,
    userId: user.userId,
    username: user.username,
    audit: {
      requestId: meta.requestId,
      correlationId: meta.correlationId,
      userId: user.userId,
      username: user.username,
      sessionId: user.sessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  };
}

function schemaOf(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terhubung ke tenant mana pun.');
  }
  return user.schemaName;
}

@Module({
  // Controller route spesifik lebih dahulu: ia harus menang atas
  // wildcard `:resource` pada MasterController.
  controllers: [SalesInventoryOperationsController, ErpController, AccountingDocumentController, MasterController, TenantAdminController],
  providers: [MasterLifecycleService, ErpPurchasingService, ErpInventoryService],
  exports: [MasterLifecycleService, ErpPurchasingService, ErpInventoryService],
})
export class TenantModule {}
