/**
 * Modul AI.
 *
 * Seluruh endpoint di sini berjalan di sisi server. Peramban tidak pernah
 * memanggil penyedia AI langsung — alamatnya tidak pernah meninggalkan server.
 */

import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedOnly,
  AuthenticatedUser,
  CurrentUser,
  PlatformPermissions,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { ModelCatalogService } from '../../infrastructure/ai/model-catalog.service';
import { AiGatewayService } from './ai-gateway.service';
import { KnowledgeService } from './knowledge.service';
import { CopilotService } from './copilot.service';
import { listUseCases } from './ai-use-case.registry';

class EvidenceDto {
  @ApiProperty() @IsString() @MaxLength(200) source!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) reference?: string;
  @ApiProperty() @IsString() @MaxLength(20_000) content!: string;
}

class AskDto {
  @ApiProperty({ description: 'Kode keperluan; hanya yang terdaftar diterima.' })
  @IsString()
  @MaxLength(64)
  useCaseCode!: string;

  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2_000) question!: string;

  @ApiPropertyOptional({ type: [EvidenceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EvidenceDto)
  evidence?: EvidenceDto[];

  @ApiPropertyOptional({ description: 'Nama model; wajib ada pada katalog.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  preferModel?: string;
}

class CopilotDto {
  @ApiProperty({ description: 'Kode keperluan copilot.' })
  @IsString() @MaxLength(64) useCaseCode!: string;

  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2_000) question!: string;

  @ApiPropertyOptional({ description: 'Rute yang sedang dibuka; menentukan konteksnya.' })
  @IsOptional() @IsString() @MaxLength(255) routePath?: string;

  @ApiPropertyOptional({ description: 'Data yang sedang dilihat pengguna.' })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => EvidenceDto)
  evidence?: EvidenceDto[];
}

class FeedbackDto {
  @ApiProperty({ enum: ['ACCEPTED', 'EDITED', 'REJECTED'] })
  @IsIn(['ACCEPTED', 'EDITED', 'REJECTED'])
  verdict!: 'ACCEPTED' | 'EDITED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Wajib untuk REJECTED.' })
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}

function schemaOf(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.badRequest(
      ErrorCodes.VALIDATION_FAILED,
      'Sesi ini tidak terhubung ke tenant mana pun.',
    );
  }
  return user.schemaName;
}

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai')
export class AiController {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly copilot: CopilotService,
    private readonly knowledge: KnowledgeService,
  ) {}

  @Get('use-cases')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Keperluan AI yang tersedia',
    description:
      'Daftar tertutup. Keperluan yang tidak ada di sini tidak dapat dipanggil — tanpa ' +
      'daftar tertutup, siapa pun dapat mengirim pertanyaan apa saja beserta data apa saja ' +
      'ke penyedia, dan tidak ada yang dapat memeriksanya belakangan.',
  })
  useCases() {
    return {
      items: listUseCases().map((u) => ({
        code: u.code,
        name: u.name,
        description: u.description,
        outputKind: u.outputKind,
        riskClass: u.riskClass,
        requiresEvidence: u.requiresEvidence,
        hourlyQuotaPerUser: u.hourlyQuotaPerUser,
        requiredPermission: `${u.menuCode}.${u.action}`,
      })),
      note:
        'Seluruh keluaran AI berupa DRAFT, ANALYSIS, atau RECOMMENDATION. Tidak ada ' +
        'keperluan yang membuat AI melakukan pembayaran, posting, persetujuan, penghapusan, ' +
        'maupun perubahan hak akses.',
    };
  }

  @Post('ask')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Bertanya kepada AI dengan bukti yang disertakan sendiri',
    description:
      'Izin diperiksa terhadap menu keperluannya — AI tidak memberi akses yang tidak Anda ' +
      'miliki. Data disamarkan sebelum meninggalkan server, dan apa yang disamarkan ' +
      'dilaporkan pada jawabannya.',
  })
  ask(@Body() dto: AskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gateway.ask(user, dto);
  }

  @Post('copilot')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Copilot sadar-rute',
    description:
      'Selain bukti yang disertakan pemanggil, copilot mencari bukti tambahan dari basis ' +
      'pengetahuan sesuai izin penggunanya. Pencariannya LEKSIKAL, bukan semantik — ' +
      'penyedia menolak embedding pada tingkat konfigurasi server.',
  })
  askCopilot(@Body() dto: CopilotDto, @CurrentUser() user: AuthenticatedUser) {
    return this.copilot.ask(user, dto);
  }

  @Post('invocations/:id/feedback')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Menilai keluaran AI',
    description:
      'Penolakan wajib beralasan — mutu AI hanya dapat diperbaiki dari alasan penolakannya.',
  })
  feedback(
    @Param('id') id: string,
    @Body() dto: FeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gateway.giveFeedback(user, id, dto.verdict, dto.reason);
  }

  @Get('knowledge/stats')
  @AuthenticatedOnly()
  @ApiOperation({ summary: 'Keadaan basis pengetahuan beserta jenis pencariannya' })
  knowledgeStats(@CurrentUser() user: AuthenticatedUser) {
    return this.knowledge.stats(schemaOf(user));
  }

  @Post('knowledge/reindex')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Menyegarkan indeks dari surat yang ada',
    description:
      'Surat berlabel RAHASIA dan SANGAT_RAHASIA TIDAK diindeks sama sekali. Menyaringnya ' +
      'saat pencarian saja berarti salinannya tetap ada pada tabel yang lebih mudah dibaca ' +
      'daripada tabel aslinya.',
  })
  reindex(@CurrentUser() user: AuthenticatedUser) {
    return this.knowledge.reindexSurat(schemaOf(user));
  }
}

/**
 * Pengelolaan penyedia dan katalog model — untuk Super Admin.
 *
 * Dipisahkan karena sifatnya berbeda: yang ini mengubah keadaan penyedia yang
 * dipakai seluruh tenant.
 */
@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('platform/ai')
export class AiAdminController {
  constructor(
    private readonly catalog: ModelCatalogService,
    private readonly gateway: AiGatewayService,
  ) {}

  @Get('health')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.READ')
  @ApiOperation({
    summary: 'Kesehatan penyedia AI beserta keadaan pemutus arus',
    description:
      'Pemutus arus terbuka setelah tiga kegagalan berturut-turut. Tanpa itu, penyedia yang ' +
      'mati membuat setiap permintaan menunggu penuh sampai batas waktunya.',
  })
  health() {
    return this.catalog.healthSummary();
  }

  @Get('models')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.READ')
  @ApiOperation({ summary: 'Katalog model yang tersedia' })
  models() {
    return this.catalog.usableForChat();
  }

  @Post('models/sync')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.MANAGE')
  @ApiOperation({
    summary: 'Menyelaraskan katalog dengan penyedia',
    description:
      'Nama model tidak pernah ditulis sebagai konstanta; katalog diisi dengan bertanya ' +
      'kepada penyedianya. Model yang hilang ditandai, bukan dihapus — menghapusnya akan ' +
      'memutus riwayat pemakaian yang menunjuknya.',
  })
  sync() {
    return this.catalog.sync();
  }

  @Post('models/probe')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.MANAGE')
  @ApiOperation({
    summary: 'Menguji kemampuan setiap model dengan MENCOBANYA',
    description:
      'Kemampuan tidak ditebak dari nama. Sebuah server dapat menolak embedding meski ' +
      'modelnya secara teori mampu — dan itu benar-benar terjadi di sini.',
  })
  probe() {
    return this.catalog.probeAll();
  }

  @Get('usage')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.READ')
  @ApiOperation({
    summary: 'Metrik pemakaian AI',
    description:
      'Yang paling berguna bukan jumlah pemanggilan melainkan berapa yang diterima: ' +
      'keperluan yang jawabannya selalu ditolak sebaiknya dimatikan, bukan dibiarkan ' +
      'memakan waktu penggunanya.',
  })
  @ApiQuery({ name: 'jam', required: false, type: Number })
  usage(@Query('jam') hours?: string) {
    return this.gateway.usage(Number(hours) || 24);
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [AiController, AiAdminController],
  providers: [AiGatewayService, KnowledgeService, CopilotService],
  exports: [AiGatewayService, KnowledgeService],
})
export class AiModule {}
