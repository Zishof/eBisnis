import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PesantrenDapodikService } from '../pesantren/pesantren-dapodik.service';

const DATASET = [
  'unit-pendidikan',
  'tahun-ajaran',
  'santri',
  'psb-pendaftar',
  'guru',
  'mata-pelajaran',
  'rombongan',
  'anggota-rombel',
  'kurikulum',
  'jadwal',
  'komponen-nilai',
  'nilai',
  'ref-pekerjaan',
  'ref-pendidikan',
  'ref-penghasilan',
  'ref-transportasi',
  'ref-jenis-tinggal',
  'ref-kebutuhan-khusus',
] as const;
const REFERENSI_KATEGORI = ['PEKERJAAN', 'PENDIDIKAN', 'PENGHASILAN', 'TRANSPORTASI', 'JENIS_TINGGAL', 'KEBUTUHAN_KHUSUS'] as const;

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DatasetParam {
  @ApiProperty({ enum: DATASET })
  @IsIn(DATASET as unknown as string[])
  dataset!: (typeof DATASET)[number];
}

class ReferensiParam {
  @ApiProperty({ enum: REFERENSI_KATEGORI })
  @IsIn(REFERENSI_KATEGORI as unknown as string[])
  kategori!: (typeof REFERENSI_KATEGORI)[number];
}

class ImporDapodikDto {
  @ApiProperty({ enum: ['csv', 'json'], default: 'csv' })
  @IsIn(['csv', 'json'])
  format!: 'csv' | 'json';

  @ApiProperty({ description: 'Isi file CSV atau JSON array yang akan diimpor.' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dryRun?: boolean;
}

class EksporQuery {
  @ApiPropertyOptional({ enum: ['csv'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv';
}

@ApiTags('eschool')
@ApiBearerAuth('access-token')
@Controller('eschool/dapodik')
export class EschoolDapodikController {
  constructor(private readonly dapodik: PesantrenDapodikService) {}

  @Permissions('EPESANTREN_DAPODIK.READ')
  @Get('datasets')
  @ApiOperation({ summary: 'Dataset DAPODIK yang didukung eSchool' })
  daftarDataset() {
    return this.dapodik.daftarDataset();
  }

  @Permissions('EPESANTREN_DAPODIK.READ')
  @Get('referensi/:kategori')
  @ApiOperation({ summary: 'Referensi DAPODIK aktif untuk form eSchool' })
  referensi(@Param() param: ReferensiParam, @CurrentUser() user: AuthenticatedUser) {
    return this.dapodik.referensi(schemaWajib(user), param.kategori);
  }

  @Permissions('EPESANTREN_DAPODIK.EXPORT')
  @Get(':dataset/template')
  @ApiOperation({ summary: 'Template CSV DAPODIK untuk dataset eSchool' })
  template(@Param() param: DatasetParam) {
    return {
      filename: `template-eschool-dapodik-${param.dataset}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: this.dapodik.template(param.dataset),
    };
  }

  @Permissions('EPESANTREN_DAPODIK.EXPORT')
  @Get(':dataset/export')
  @ApiOperation({ summary: 'Ekspor dataset eSchool ke format DAPODIK CSV' })
  ekspor(@Param() param: DatasetParam, @Query() _query: EksporQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.dapodik.ekspor(schemaWajib(user), param.dataset);
  }

  @Permissions('EPESANTREN_DAPODIK.CREATE')
  @Post(':dataset/import')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validasi atau impor dataset DAPODIK eSchool dari CSV/JSON' })
  impor(@Param() param: DatasetParam, @Body() dto: ImporDapodikDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dapodik.impor(schemaWajib(user), {
      dataset: param.dataset,
      format: dto.format,
      content: dto.content,
      dryRun: dto.dryRun ?? true,
      actorUserId: user.userId,
    });
  }
}
