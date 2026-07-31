/**
 * Endpoint rekam medis, pengkodean, mutu, dan keselamatan pasien.
 *
 * Dua hal yang membedakannya dari controller lain di modul ini.
 *
 * Pertama, **pelaporan insiden sengaja berhak akses longgar.** Setiap petugas
 * boleh melapor, dan boleh melapor anonim. Program keselamatan pasien
 * bergantung pada orang yang mau melapor; membatasi pelaporannya kepada peran
 * tertentu akan menghentikan laporan dari orang yang justru paling sering
 * melihat kejadiannya.
 *
 * Kedua, **penahanan hukum menuntut peran tersendiri.** Ia menahan perubahan
 * rekam medis seluruh pasien tertentu, dan wewenang sebesar itu tidak boleh
 * melekat pada peran yang dipegang puluhan orang.
 */

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { HealthHimService } from './health-him.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type { PemintaInformasi, TingkatBahaya } from './health-him';
import type { KonteksAkses } from './health-patient.service';
import type { PurposeOfUse } from './ports';

const TUJUAN: PurposeOfUse[] = [
  'TREATMENT',
  'PAYMENT',
  'OPERATIONS',
  'QUALITY',
  'RESEARCH',
  'PATIENT_REQUEST',
  'LEGAL',
  'EMERGENCY',
];

const PEMINTA = [
  'PATIENT',
  'LEGAL_GUARDIAN',
  'INSURER',
  'COURT',
  'POLICE',
  'OTHER_FACILITY',
  'RESEARCHER',
  'EMPLOYER',
  'OTHER',
];

const BAHAYA = ['NEAR_MISS', 'NO_HARM', 'MILD', 'MODERATE', 'SEVERE', 'DEATH'];

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

// --- DTO ---------------------------------------------------------------------

class PeriksaBerkasDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  admissionId?: string;
}

class KodeItemDto {
  @ApiProperty({ enum: ['DIAGNOSIS', 'PROCEDURE'] })
  @IsIn(['DIAGNOSIS', 'PROCEDURE'])
  itemType!: 'DIAGNOSIS' | 'PROCEDURE';

  @ApiProperty({ example: 'A09.9' })
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiProperty({ example: 'ICD10' })
  @IsString()
  @MaxLength(24)
  codeSystem!: string;

  @ApiPropertyOptional({ description: 'Tepat satu diagnosis wajib bertanda utama.' })
  @IsOptional()
  @IsBoolean()
  isPrincipal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sequenceNo?: number;
}

class KodeDto {
  @ApiProperty({ type: [KodeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KodeItemDto)
  items!: KodeItemDto[];
}

class VerifikasiKodingDto {
  @ApiProperty()
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional({ description: 'Wajib bila berkas dikembalikan.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    description:
      'Menuntut verifikator berbeda dari koder. Fasilitas dengan satu koder dapat ' +
      'mematikannya secara sah dan tercatat — jangan disiasati.',
  })
  @IsOptional()
  @IsBoolean()
  requireSeparation?: boolean;
}

class TahanHukumDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiProperty({ description: 'Sekurang-kurangnya sepuluh huruf.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  caseReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  requestedBy?: string;
}

class CabutPenahananDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

class MintaInformasiDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: PEMINTA })
  @IsIn(PEMINTA)
  requesterType!: PemintaInformasi;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  requesterName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  purpose!: string;

  @ApiProperty({
    type: [String],
    description: '"Kirimkan rekam medisnya" bukan permintaan; ia jaring.',
  })
  @IsArray()
  @IsString({ each: true })
  requestedScope!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasPatientConsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  consentReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasLegalBasis?: boolean;

  @ApiPropertyOptional({ description: 'Wajib bagi pengadilan dan kepolisian.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  legalBasisDocument?: string;
}

class LepaskanInformasiDto {
  @ApiProperty({ type: [String], description: 'Apa yang BENAR-BENAR dilepas.' })
  @IsArray()
  @IsString({ each: true })
  releasedScope!: string[];
}

class InsidenDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceUnitId?: string;

  @ApiProperty({ example: 'MEDICATION_ERROR' })
  @IsString()
  @MaxLength(48)
  incidentType!: string;

  @ApiProperty()
  @IsString()
  occurredAt!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  immediateAction?: string;

  @ApiProperty({ enum: BAHAYA })
  @IsIn(BAHAYA)
  harmLevel!: TingkatBahaya;

  @ApiProperty()
  @IsBoolean()
  reachedPatient!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSentinel?: boolean;

  @ApiPropertyOptional({
    description:
      'Pelapor boleh anonim. Sebagian orang tidak akan melapor bila namanya tercatat — ' +
      'terutama ketika yang keliru adalah atasannya.',
  })
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;
}

class TindakanPerbaikanDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  action!: string;

  @ApiPropertyOptional({
    enum: ['PROCESS', 'TRAINING', 'EQUIPMENT', 'STAFFING', 'POLICY', 'SYSTEM', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['PROCESS', 'TRAINING', 'EQUIPMENT', 'STAFFING', 'POLICY', 'SYSTEM', 'OTHER'])
  actionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueAt?: string;
}

class TutupInsidenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  closureNote?: string;

  @ApiPropertyOptional({ description: 'Wajib bila tingkat kejadiannya mewajibkan telaah akar masalah.' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  rcaSummary?: string;
}

class IndikatorDto {
  @ApiProperty()
  @IsUUID()
  indicatorId!: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Max(2200)
  periodYear!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  numerator!: number;

  @ApiProperty({ description: 'Penyebut wajib. Indikator tanpa penyebut adalah jumlah.' })
  @IsInt()
  @Min(0)
  denominator!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Rekam Medis, Mutu, dan Keselamatan')
@Controller('health/him')
export class HealthHimController {
  constructor(
    private readonly him: HealthHimService,
    private readonly identity: CoreIdentityAdapter,
    private readonly izin: TenantPermissionService,
  ) {}

  private async konteks(
    schema: string,
    user: AuthenticatedUser,
    tajuk: { purpose?: string; breakGlass?: string; reason?: string; facilityId?: string },
  ): Promise<KonteksAkses> {
    const purpose = (tajuk.purpose ?? '').toUpperCase() as PurposeOfUse;
    if (!TUJUAN.includes(purpose)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Tajuk X-Purpose-Of-Use wajib dan harus salah satu dari: ${TUJUAN.join(', ')}.`,
      );
    }

    const breakGlass = tajuk.breakGlass === 'true' || tajuk.breakGlass === '1';
    if (breakGlass) {
      if ((tajuk.reason ?? '').trim().length < 10) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Akses darurat wajib disertai tajuk X-Break-Glass-Reason sekurang-kurangnya sepuluh huruf.',
        );
      }
      const kurang = await this.izin.findMissing(schema, user.userId, ['HEALTH_PATIENT.BREAK_GLASS'], {
        isDemo: user.isDemo,
        activeRoleId: user.activeRoleId ?? null,
      });
      if (kurang.length) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak berwenang melakukan akses darurat. Mintakan kepada dokter penanggung jawab.',
        );
      }
    }

    return {
      actorUserId: await this.identity.subjectId(schema, user.userId),
      activeRoleId: user.activeRoleId ?? null,
      purposeOfUse: purpose,
      facilityId: tajuk.facilityId ?? null,
      breakGlass,
      breakGlassReason: breakGlass ? (tajuk.reason ?? '').trim() : null,
    };
  }

  // --- Kelengkapan dan pengkodean --------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_HIM_CODING.READ')
  @Post('records/check')
  @ApiOperation({
    summary: 'Memeriksa kelengkapan berkas rekam medis',
    description:
      'Kekurangan dilaporkan NAMANYA beserta siapa yang dapat memperbaikinya, bukan sebagai ' +
      'persentase. Dokter yang membaca "resume medis belum ditandatangani" akan ' +
      'menandatanganinya; dokter yang membaca "82%" akan menutup layarnya.',
  })
  async periksa(
    @Body() dto: PeriksaBerkasDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.periksaBerkas(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_HIM_CODING.CREATE')
  @Post('coding/:id/code')
  @ApiOperation({
    summary: 'Mengode kunjungan',
    description:
      'Setiap kode diperiksa terhadap terminologi yang berlaku pada TANGGAL LAYANANNYA, dan ' +
      'versinya disalin ke barisnya. Kode yang sudah dicabut ditolak beserta penggantinya. ' +
      'Harus ada tepat satu diagnosis utama.',
  })
  async kode(
    @Param('id') id: string,
    @Body() dto: KodeDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.kode(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_HIM_CODING.VERIFY')
  @Post('coding/:id/verify')
  @ApiOperation({
    summary: 'Memverifikasi pengkodean',
    description: 'Koder tidak memverifikasi pengkodeannya sendiri, kecuali pemisahannya dimatikan kebijakan.',
  })
  async verifikasi(
    @Param('id') id: string,
    @Body() dto: VerifikasiKodingDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.verifikasiKoding(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_HIM_CODING.READ')
  @Get('coding/worklist')
  @ApiOperation({ summary: 'Daftar kerja pengkodean' })
  daftarKerja(
    @Query('facilityId') facilityId: string,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.him.daftarKerjaKoding(requireSchema(user), facilityId, status);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_HIM_CODING.READ')
  @Get('deficiencies')
  @ApiOperation({
    summary: 'Kekurangan berkas menurut peran',
    description: 'Layar dokter menampilkan daftar pekerjaannya sendiri, bukan angka kelengkapan.',
  })
  kekurangan(
    @Query('facilityId') facilityId: string,
    @Query('role') role: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !role) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId dan role wajib diisi.',
      );
    }
    return this.him.kekuranganPerPeran(requireSchema(user), facilityId, role);
  }

  // --- Penahanan hukum -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LEGAL_HOLD.CREATE')
  @Post('legal-holds')
  @ApiOperation({
    summary: 'Memasang penahanan hukum pada rekam medis',
    description:
      'Menahan PERUBAHAN dan penghapusan, bukan pembacaan — menahan pembacaan akan ' +
      'menghentikan perawatan pasien yang rekamnya kebetulan diperkarakan, dan pasien itu ' +
      'tetap sakit. Ditegakkan trigger basis data, bukan hanya layanan.',
  })
  async tahan(
    @Body() dto: TahanHukumDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.tahanHukum(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LEGAL_HOLD.DELETE')
  @Post('legal-holds/:id/release')
  @ApiOperation({
    summary: 'Mencabut penahanan hukum',
    description: 'Yang memasang penahanan tidak mencabutnya sendiri.',
  })
  async cabut(
    @Param('id') id: string,
    @Body() dto: CabutPenahananDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.cabutPenahanan(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LEGAL_HOLD.READ')
  @Get('legal-holds/:patientId')
  @ApiOperation({ summary: 'Penahanan pada satu pasien' })
  penahanan(@Param('patientId') patientId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.him.statusPenahanan(requireSchema(user), patientId);
  }

  // --- Pelepasan informasi ---------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INFO_RELEASE.CREATE')
  @Post('releases')
  @ApiOperation({
    summary: 'Mencatat permintaan pelepasan informasi dan memutuskannya',
    description:
      'Yang menentukan bukan siapa yang meminta, melainkan dasar hukumnya. Kepolisian yang ' +
      'meminta tanpa nomor surat berkedudukan sama dengan orang asing yang meminta; pemberi ' +
      'kerja yang meminta dengan persetujuan pasien pun tetap menerima yang tersamarkan.',
  })
  async minta(
    @Body() dto: MintaInformasiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.mintaInformasi(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INFO_RELEASE.EXPORT')
  @Post('releases/:id/release')
  @ApiOperation({
    summary: 'Mencatat apa yang benar-benar dilepas',
    description:
      'Sering berbeda dari yang diminta, dan yang penting bagi audit adalah yang kedua. ' +
      'Permintaan mencatat niat; pelepasan mencatat perbuatan.',
  })
  async lepaskan(
    @Param('id') id: string,
    @Body() dto: LepaskanInformasiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.lepaskanInformasi(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Keselamatan pasien ----------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAFETY.CREATE')
  @Post('incidents')
  @ApiOperation({
    summary: 'Melaporkan insiden keselamatan pasien',
    description:
      'Nyaris cedera TETAP ditelaah — ia menunjukkan celah sebelum ada yang terluka, dan jauh ' +
      'lebih sering terjadi daripada cedera sehingga polanya lebih cepat terlihat. Pelapor ' +
      'boleh anonim.',
  })
  async lapor(
    @Body() dto: InsidenDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.laporkanInsiden(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAFETY.UPDATE')
  @Post('incidents/:id/actions')
  @ApiOperation({ summary: 'Menambah tindakan perbaikan' })
  tindakan(@Param('id') id: string, @Body() dto: TindakanPerbaikanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.him.tambahTindakanPerbaikan(requireSchema(user), id, dto);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAFETY.APPROVE')
  @Post('incidents/:id/close')
  @ApiOperation({
    summary: 'Menutup laporan insiden',
    description:
      'Insiden yang ditutup tanpa tindakan perbaikan akan terjadi lagi — itulah satu-satunya ' +
      'hal yang dapat dikatakan dengan pasti tentangnya. Pelapor tidak menutup laporannya ' +
      'sendiri pada kejadian berat.',
  })
  async tutup(
    @Param('id') id: string,
    @Body() dto: TutupInsidenDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.tutupInsiden(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAFETY.READ')
  @Get('incidents')
  @ApiOperation({
    summary: 'Papan insiden',
    description:
      'Yang lewat tenggat mendahului yang lebih berat tetapi masih dalam tenggat. Kejadian ' +
      'berat yang sedang dikerjakan bukan pekerjaan yang menumpuk; kejadian ringan yang ' +
      'terlupa dua pekan adalah.',
  })
  papanInsiden(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.him.papanInsiden(requireSchema(user), facilityId);
  }

  // --- Mutu ------------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_QUALITY.CREATE')
  @Post('quality/measurements')
  @ApiOperation({
    summary: 'Mencatat pengukuran indikator mutu',
    description:
      'Penyebut nol TIDAK menghasilkan nol — ia menghasilkan "belum ada datanya". Nol akan ' +
      'terbaca sebagai mutu terburuk.',
  })
  async indikator(
    @Body() dto: IndikatorDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.him.catatIndikator(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_QUALITY.READ')
  @Get('quality/dashboard')
  @ApiOperation({ summary: 'Papan mutu beserta kelengkapan rekam medis' })
  papanMutu(
    @Query('facilityId') facilityId: string,
    @Query('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !year) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId dan year wajib diisi.',
      );
    }
    return this.him.papanMutu(requireSchema(user), facilityId, Number(year));
  }
}
