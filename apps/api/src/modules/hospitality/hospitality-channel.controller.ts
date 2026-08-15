import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { JENIS_PEKERJAAN_DISTRIBUSI, type JenisPekerjaanDistribusi } from './hospitality-channel';
import { HospitalityChannelService } from './hospitality-channel.service';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan.');
  return user.schemaName;
}

class AkunChannelDto {
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() providerKey!: string;
  @ApiProperty() @IsString() displayName!: string;
  @ApiProperty({ enum: ['OTA','WHOLESALER','GDS','METASEARCH','TRAVEL_AGENT','AFFILIATE'] })
  @IsIn(['OTA','WHOLESALER','GDS','METASEARCH','TRAVEL_AGENT','AFFILIATE']) channelType!: string;
}

class MappingDto {
  @ApiProperty({ enum: ['PROPERTY','ROOM_TYPE','RATE_PLAN'] })
  @IsIn(['PROPERTY','ROOM_TYPE','RATE_PLAN']) resourceType!: string;
  @ApiProperty() @IsString() localId!: string;
  @ApiProperty() @IsString() providerCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() providerParentCode?: string;
}

class PekerjaanDto {
  @ApiProperty({ enum: JENIS_PEKERJAAN_DISTRIBUSI }) @IsIn(JENIS_PEKERJAAN_DISTRIBUSI)
  type!: JenisPekerjaanDistribusi;
  @ApiProperty() @IsString() sourceVersion!: string;
  @ApiProperty() @IsString() idempotencyKey!: string;
  @ApiProperty() @IsString() correlationId!: string;
  @ApiProperty() @IsObject() payload!: Record<string, unknown>;
}

@ApiTags('hospitality-channel')
@ApiBearerAuth('access-token')
@Controller('hospitality/properti/:propertyId/channels')
export class HospitalityChannelController {
  constructor(private readonly channel: HospitalityChannelService) {}

  @Get() @Permissions('HOSPITALITY_PROPERTI.READ')
  @ApiOperation({ summary: 'Daftar akun channel dan status koneksi' })
  daftar(@Param('propertyId') propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.channel.daftarAkun(schemaWajib(user), propertyId);
  }

  @Post() @HttpCode(201) @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @ApiOperation({ summary: 'Mencatat akun channel; provider live tetap blocked sampai credential tersedia' })
  catat(@Param('propertyId') propertyId: string, @Body() dto: AkunChannelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.channel.catatAkun(schemaWajib(user), propertyId, dto, user.userId);
  }

  @Post(':accountId/mappings') @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  aturMapping(
    @Param('propertyId') propertyId: string,
    @Param('accountId') accountId: string,
    @Body() dto: MappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channel.aturMapping(schemaWajib(user), propertyId, accountId, dto);
  }

  @Post(':accountId/jobs') @HttpCode(202) @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  antrekan(@Param('propertyId') propertyId: string, @Param('accountId') accountId: string, @Body() dto: PekerjaanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.channel.antrekan(schemaWajib(user), propertyId, accountId, dto);
  }

  @Get('jobs') @Permissions('HOSPITALITY_PROPERTI.READ')
  daftarPekerjaan(@Param('propertyId') propertyId: string, @Query('status') status: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.channel.daftarPekerjaan(schemaWajib(user), propertyId, status);
  }

  @Get('reconciliation') @Permissions('HOSPITALITY_PROPERTI.READ')
  rekonsiliasi(@Param('propertyId') propertyId: string, @Query('status') status: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.channel.daftarRekonsiliasi(schemaWajib(user), propertyId, status);
  }
}
