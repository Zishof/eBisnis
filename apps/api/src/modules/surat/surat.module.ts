/**
 * Tata kelola surat.
 *
 * Surat masuk, disposisi, surat keluar, persetujuan berjenjang, dan penomoran
 * resmi.
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
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedUser,
  CurrentUser,
  Permissions,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { SuratService } from './surat.service';
import { SuratNumberService } from './surat-number.service';

const CONFIDENTIALITY = ['BIASA', 'TERBATAS', 'RAHASIA', 'SANGAT_RAHASIA'];
const DECISIONS = ['DISETUJUI', 'DITOLAK', 'DIKEMBALIKAN', 'DILEWATI'];

class RegisterIncomingDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(255) senderName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(500) subject!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() classificationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() natureId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lockerId?: string;
  @ApiPropertyOptional({ description: 'Nomor menurut pengirim; boleh kembar.' })
  @IsOptional() @IsString() @MaxLength(96) senderNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() senderAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) attachmentNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() letterDate?: string;
  @ApiPropertyOptional({ enum: CONFIDENTIALITY })
  @IsOptional() @IsIn(CONFIDENTIALITY) confidentiality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) addressedRoleCode?: string;
}

class DispositionDto {
  @ApiProperty({ description: 'Perintah tindak lanjut.' })
  @IsString() @MinLength(3) instruction!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toUserSubjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) toRoleCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
}

class DraftOutgoingDto {
  @ApiProperty() @IsUUID() classificationId!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(255) recipientName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(500) subject!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() natureId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recipientAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) attachmentNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() letterDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() inReplyToIncomingId?: string;
}

class DecisionDto {
  @ApiProperty({ enum: DECISIONS }) @IsIn(DECISIONS)
  decision!: 'DISETUJUI' | 'DITOLAK' | 'DIKEMBALIKAN' | 'DILEWATI';

  @ApiPropertyOptional({ description: 'Wajib untuk DITOLAK dan DIKEMBALIKAN.' })
  @IsOptional() @IsString() @MaxLength(2000) note?: string;

  @ApiPropertyOptional({
    description:
      'Menyatakan alur selesai di langkah ini. Hanya dihormati bila alurnya tidak wajib ' +
      'dilalui seluruhnya.',
  })
  @IsOptional() @IsBoolean() finalize?: boolean;
}

class ValidatePatternDto {
  @ApiProperty({ example: '{NOMOR}/{KODE_KLASIFIKASI}/{BULAN_ROMAWI}/{TAHUN}' })
  @IsString() @MaxLength(255) pattern!: string;
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

@ApiTags('surat')
@ApiBearerAuth('access-token')
@Controller('surat/masuk')
export class SuratMasukController {
  constructor(private readonly surat: SuratService) {}

  @Post()
  @Permissions('SURAT_MASUK.CREATE')
  @ApiOperation({
    summary: 'Mencatat surat masuk',
    description:
      'Nomor agenda internal diterbitkan sistem. Nomor dari pengirim disimpan apa adanya ' +
      'dan boleh kembar — dua instansi berbeda dapat mengirim surat bernomor sama.',
  })
  register(@Body() dto: RegisterIncomingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surat.registerIncoming(schemaOf(user), dto, user);
  }

  @Post(':id/disposisi')
  @Permissions('SURAT_MASUK.UPDATE')
  @ApiOperation({
    summary: 'Mendisposisikan surat masuk',
    description:
      'Wajib punya tujuan — kepada orang atau kepada peran. Tanpa tujuan, disposisi hanya ' +
      'catatan yang tidak pernah sampai kepada siapa pun.',
  })
  disposition(
    @Param('id') id: string,
    @Body() dto: DispositionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surat.disposition(schemaOf(user), id, dto, user);
  }
}

@ApiTags('surat')
@ApiBearerAuth('access-token')
@Controller('surat/keluar')
export class SuratKeluarController {
  constructor(
    private readonly surat: SuratService,
    private readonly numbers: SuratNumberService,
  ) {}

  @Post()
  @Permissions('SURAT_KELUAR.CREATE')
  @ApiOperation({
    summary: 'Membuat konsep surat keluar',
    description: 'Belum bernomor. Nomor resmi baru diberikan setelah surat disetujui.',
  })
  draft(@Body() dto: DraftOutgoingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surat.draftOutgoing(schemaOf(user), dto, user);
  }

  @Get(':id')
  @Permissions('SURAT_KELUAR.READ')
  @ApiOperation({ summary: 'Isi surat keluar beserta riwayat persetujuannya' })
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surat.outgoingDetail(schemaOf(user), id);
  }

  @Post(':id/ajukan')
  @Permissions('SURAT_KELUAR.UPDATE')
  @ApiOperation({
    summary: 'Mengajukan konsep untuk disetujui',
    description:
      'Klasifikasi tanpa alur persetujuan langsung berstatus DISETUJUI, dan itu dinyatakan ' +
      'terang-terangan supaya tidak tampak sebagai alur yang terlewat.',
  })
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surat.submitOutgoing(schemaOf(user), id);
  }

  @Post(':id/putuskan')
  @Permissions('SURAT_KELUAR.APPROVE')
  @ApiOperation({
    summary: 'Memutuskan satu langkah persetujuan',
    description:
      'Penolakan dan pengembalian wajib beralasan. Surat yang dikembalikan tanpa keterangan ' +
      'memaksa penyusunnya menebak apa yang harus diperbaiki.',
  })
  decide(
    @Param('id') id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surat.decide(schemaOf(user), id, dto, user);
  }

  @Post(':id/terbitkan')
  @Permissions('SURAT_KELUAR.APPROVE')
  @ApiOperation({
    summary: 'Menerbitkan surat yang sudah disetujui',
    description:
      'Di sinilah nomor resmi diberikan — setelah persetujuan, bukan saat konsep dibuat. ' +
      'Nomor yang sudah keluar tidak dapat ditarik kembali, dan konsep yang batal akan ' +
      'meninggalkan lubang penomoran yang tidak dapat dijelaskan saat diaudit. ' +
      'Idempoten: surat yang sudah bernomor mengembalikan nomor yang sama.',
  })
  issue(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surat.issue(schemaOf(user), id, user);
  }

  @Get('antrian/persetujuan')
  @Permissions('SURAT_KELUAR.APPROVE')
  @ApiOperation({ summary: 'Surat yang menunggu keputusan, terlama lebih dulu' })
  @ApiQuery({ name: 'peran', required: false })
  pending(@CurrentUser() user: AuthenticatedUser, @Query('peran') roleCode?: string) {
    return this.surat.pendingApprovals(schemaOf(user), roleCode ?? user.activeRoleCode);
  }
}

@ApiTags('surat')
@ApiBearerAuth('access-token')
@Controller('surat/penomoran')
export class SuratNomorController {
  constructor(private readonly numbers: SuratNumberService) {}

  @Post('periksa-pola')
  @Permissions('SURAT_PENOMORAN.UPDATE')
  @ApiOperation({
    summary: 'Memeriksa pola penomoran',
    description:
      'Dijalankan saat skema disimpan, bukan saat surat diterbitkan — menolak pola yang ' +
      'salah pada saat penerbitan berarti menghentikan pekerjaan orang yang sedang ' +
      'menunggu nomornya. Penanda di luar daftar ditolak, bukan dibiarkan menjadi teks ' +
      'apa adanya.',
  })
  validate(@Body() dto: ValidatePatternDto) {
    return this.numbers.validate(dto.pattern);
  }

  @Get(':schemeId/pratinjau')
  @Permissions('SURAT_PENOMORAN.READ')
  @ApiOperation({
    summary: 'Pratinjau nomor berikutnya TANPA mengambilnya',
    description:
      'Pratinjau yang diam-diam mengambil nomor akan meninggalkan lubang pada penomoran ' +
      'setiap kali seseorang membuka formulir lalu membatalkannya.',
  })
  preview(@Param('schemeId') schemeId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.numbers.preview(schemaOf(user), schemeId);
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [SuratMasukController, SuratKeluarController, SuratNomorController],
  providers: [SuratService, SuratNumberService],
  exports: [SuratService, SuratNumberService],
})
export class SuratModule {}
