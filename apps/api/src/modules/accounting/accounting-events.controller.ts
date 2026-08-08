import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  Permissions,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AccountingPostingService } from './accounting-posting.service';

class AccountingEventQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'POSTED', 'FAILED', 'SKIPPED'])
  status?: 'PENDING' | 'POSTED' | 'FAILED' | 'SKIPPED';
}

@ApiTags('accounting')
@ApiBearerAuth('access-token')
@Controller('accounting-events')
export class AccountingEventsController {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly posting: AccountingPostingService,
  ) {}

  @Get()
  @Permissions('FINANCE_JOURNAL.READ')
  @ApiOperation({ summary: 'Daftar event akuntansi dan status penjurnalannya' })
  list(@Query() query: AccountingEventQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = schemaOf(user);
    return this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT ae.id::text, ae.event_code, ae.source_type, ae.source_id::text,
              ae.source_number, ae.occurred_at::text, ae.amounts, ae.currency_code,
              ae.status, ae.journal_entry_id::text, ae.posted_at::text,
              ae.failure_reason, ae.retry_count, ae.created_at::text,
              je.journal_number
         FROM "${schema}".accounting_event ae
         LEFT JOIN "${schema}".journal_entry je ON je.id = ae.journal_entry_id
        WHERE ($1::text IS NULL OR ae.status = $1)
        ORDER BY ae.occurred_at DESC, ae.created_at DESC
        LIMIT 200`,
      [query.status ?? null],
    );
  }

  @Post('process-pending')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('FINANCE_JOURNAL.POST')
  @ApiOperation({ summary: 'Memproses event akuntansi tertunda secara idempoten' })
  processPending(@CurrentUser() user: AuthenticatedUser) {
    return this.posting.processPending(schemaOf(user), 100);
  }

  @Post(':id/retry')
  @HttpCode(200)
  @BlockDemo()
  @Permissions('FINANCE_JOURNAL.POST')
  @ApiOperation({ summary: 'Mencoba ulang event akuntansi yang gagal' })
  retry(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.posting.retry(schemaOf(user), id);
  }
}

function schemaOf(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi tidak terhubung ke tenant.');
  }
  return user.schemaName;
}
