/**
 * Endpoint gawat darurat, kamar operasi, dan perawatan intensif.
 *
 * Hak akses menriase terpisah dari hak akses menetapkan disposisi, dan hak
 * akses mencatat daftar periksa terpisah dari hak akses memulai sayatan.
 * Pemisahan itu bukan kerapian: yang menriase adalah perawat di depan pintu,
 * yang memutuskan disposisi adalah dokter, dan tidak seorang pun boleh
 * mencentang daftar periksa lalu langsung menyayat.
 */

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { HealthAcuteService } from './health-acute.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { BUTIR_DAFTAR_PERIKSA, type Disposisi, type TahapDaftarPeriksa, type TingkatTriase } from './health-acute';
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

const DISPOSISI = [
  'DISCHARGED',
  'ADMITTED',
  'TRANSFERRED',
  'OBSERVATION',
  'LEFT_WITHOUT_BEING_SEEN',
  'DIED_IN_ED',
  'DOA',
];

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

class TandaVitalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  respiratoryRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  spo2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  systolicBp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  heartRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional({ enum: ['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE'] })
  @IsOptional()
  @IsIn(['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE'])
  consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painScore?: number;
}

class TriaseDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional({ description: 'Boleh kosong: pasien tidak sadar yang identitasnya belum diketahui.' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  arrivalMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  chiefComplaint?: string;

  @ApiProperty({
    minimum: 1,
    maximum: 5,
    description:
      'Tingkat yang dinilai petugas. Tanda vital yang mengancam nyawa akan MENAIKKAN tingkat ' +
      'ini secara otomatis; ia tidak pernah diturunkan.',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  requestedLevel!: TingkatTriase;

  @ApiPropertyOptional({ type: TandaVitalDto })
  @IsOptional()
  vitals?: TandaVitalDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  redFlagComplaints?: string[];
}

class UbahTriaseDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  level!: TingkatTriase;

  @ApiPropertyOptional({ description: 'Wajib bila tingkatnya diturunkan.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

class DisposisiDto {
  @ApiProperty({ enum: DISPOSISI })
  @IsIn(DISPOSISI)
  disposition!: Disposisi;

  @ApiPropertyOptional({ description: 'Wajib bila pasien triase tingkat 1 atau 2 dipulangkan.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  admissionId?: string;
}

class JadwalOperasiDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  theatreId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  procedureName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  procedureCode?: string;

  @ApiPropertyOptional({
    description: 'Prosedur yang punya sisi kiri dan kanan. Wajib disertai consentSite.',
  })
  @IsOptional()
  @IsBoolean()
  requiresSiteMarking?: boolean;

  @ApiPropertyOptional({ description: 'Sisi yang tertulis pada persetujuan tindakan.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  consentSite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  surgeonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  anaesthetistId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  anaesthesiaType?: string;

  @ApiPropertyOptional({ enum: ['ELECTIVE', 'URGENT', 'EMERGENCY'] })
  @IsOptional()
  @IsIn(['ELECTIVE', 'URGENT', 'EMERGENCY'])
  urgency?: 'ELECTIVE' | 'URGENT' | 'EMERGENCY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduledStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduledEnd?: string;
}

class TandaiSisiDto {
  @ApiProperty({ example: 'KIRI' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  site!: string;
}

class DaftarPeriksaDto {
  @ApiProperty({ enum: ['SIGN_IN', 'TIME_OUT', 'SIGN_OUT'] })
  @IsIn(['SIGN_IN', 'TIME_OUT', 'SIGN_OUT'])
  phase!: TahapDaftarPeriksa;

  @ApiProperty({ type: [String], description: 'Butir yang dicentang. Seluruhnya wajib.' })
  @IsArray()
  @IsString({ each: true })
  items!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

class HitunganDto {
  @ApiProperty({ example: 'KASA' })
  @IsString()
  @MaxLength(48)
  itemType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  countedIn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  countedOut?: number;

  @ApiPropertyOptional({ description: 'Penghitung kedua. Tidak boleh sama dengan penghitung pertama.' })
  @IsOptional()
  @IsUUID()
  verifiedBy?: string;
}

class KeluarKamarOperasiDto {
  @ApiPropertyOptional({
    description:
      'Keterangan pencarian bila hitungannya tidak cocok, biasanya hasil foto sinar-X.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  discrepancyResolution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  operativeNote?: string;
}

class AsesmenIntensifDto {
  @ApiProperty()
  @IsUUID()
  icuStayId!: string;

  @ApiPropertyOptional({ type: TandaVitalDto })
  @IsOptional()
  vitals?: TandaVitalDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onVentilator?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onVasopressor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onDialysis?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Gawat Darurat, Bedah, Intensif')
@Controller('health/acute')
export class HealthAcuteController {
  constructor(
    private readonly akut: HealthAcuteService,
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

  // --- Gawat darurat ---------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_EMERGENCY.TRIAGE')
  @Post('ed/visits')
  @ApiOperation({
    summary: 'Menerima dan menriase pasien gawat darurat',
    description:
      'Tanda vital yang mengancam nyawa MENAIKKAN tingkat triase secara otomatis, dan tidak ' +
      'pernah menurunkannya. Petugas boleh menilai lebih gawat daripada tanda vitalnya — ia ' +
      'melihat pasiennya, sistem tidak — tetapi tidak boleh menilai lebih ringan. Tingkat yang ' +
      'diusulkan dan tingkat akhir disimpan keduanya.',
  })
  async triase(
    @Body() dto: TriaseDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.terimaGawatDarurat(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_EMERGENCY.TRIAGE')
  @Post('ed/visits/:id/triage')
  @ApiOperation({
    summary: 'Mengubah tingkat triase',
    description:
      'Menaikkan selalu boleh — keadaan pasien memang dapat memburuk sambil menunggu. ' +
      'Menurunkan menuntut alasan sekurang-kurangnya sepuluh huruf, karena penurunan tingkatlah ' +
      'yang membuat pasien menunggu lebih lama, dan karena di sanalah tekanan antrean paling ' +
      'mudah menyusup. Setiap perubahan meninggalkan barisnya sendiri.',
  })
  async ubahTriase(
    @Param('id') id: string,
    @Body() dto: UbahTriaseDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.ubahTriase(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_EMERGENCY.UPDATE')
  @Post('ed/visits/:id/seen')
  @ApiOperation({ summary: 'Mencatat bahwa pasien sudah dilihat dokter' })
  async dilihat(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.dilihatDokter(schema, id, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_EMERGENCY.DISCHARGE')
  @Post('ed/visits/:id/disposition')
  @ApiOperation({
    summary: 'Menetapkan disposisi kunjungan gawat darurat',
    description:
      '"Pergi tanpa dilihat" hanya dapat dipakai pada pasien yang memang belum pernah dilihat ' +
      'dokter. Menyamakannya dengan pemulangan biasa akan menyembunyikan angka yang paling ' +
      'penting bagi mutu IGD: berapa banyak orang yang menyerah menunggu.',
  })
  async disposisi(
    @Param('id') id: string,
    @Body() dto: DisposisiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.tetapkanDisposisi(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_EMERGENCY.READ')
  @Get('ed/board')
  @ApiOperation({
    summary: 'Papan gawat darurat',
    description:
      'Diurutkan tingkat lebih dahulu, lalu lama menunggu. Pasien tingkat 1 yang baru tiba ' +
      'mendahului pasien tingkat 4 yang sudah menunggu dua jam.',
  })
  papanIgd(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.akut.papanGawatDarurat(requireSchema(user), facilityId);
  }

  // --- Kamar operasi ---------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SURGERY.CREATE')
  @Post('ot/cases')
  @ApiOperation({
    summary: 'Menjadwalkan operasi',
    description:
      'Kamar operasi tidak dapat dijadwalkan dua kali pada rentang waktu yang sama — ' +
      'ditegakkan constraint pengecualian, bukan hanya layanan. Prosedur bersisi wajib menyebut ' +
      'sisi pada persetujuan tindakan sejak dijadwalkan: menambahkannya di kamar operasi berarti ' +
      'menambahkannya ketika pasien sudah terbius.',
  })
  async jadwalkan(
    @Body() dto: JadwalOperasiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.jadwalkanOperasi(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SURGERY.UPDATE')
  @Post('ot/cases/:id/mark-site')
  @ApiOperation({
    summary: 'Menandai sisi operasi pada tubuh pasien',
    description: 'Dibandingkan dengan sisi pada persetujuan tindakan sebelum sayatan dimulai.',
  })
  async tandai(
    @Param('id') id: string,
    @Body() dto: TandaiSisiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.tandaiSisi(schema, id, dto.site, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SURGERY.CHECKLIST')
  @Post('ot/cases/:id/checklist')
  @ApiOperation({
    summary: 'Menyelesaikan satu tahap daftar periksa keselamatan bedah',
    description:
      'Seluruh butir tahap itu wajib tercentang; tahap yang tersimpan setengah lengkap akan ' +
      'terbaca kelak sebagai tahap yang dilakukan. Jeda sebelum sayatan tidak dapat dicatat ' +
      'setelah sayatan dimulai — ditegakkan constraint basis data pula.',
  })
  async daftarPeriksa(
    @Param('id') id: string,
    @Body() dto: DaftarPeriksaDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.selesaikanDaftarPeriksa(
      schema,
      id,
      dto,
      await this.konteks(schema, user, { purpose, facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SURGERY.READ')
  @Get('ot/checklist-items')
  @ApiOperation({
    summary: 'Butir wajib tiap tahap daftar periksa',
    description: 'Daftar tertutup, supaya laporan mutu dapat menghitung butir mana yang paling sering terlewat.',
  })
  butirDaftarPeriksa() {
    return BUTIR_DAFTAR_PERIKSA;
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SURGERY.CHECKLIST')
  @Post('ot/cases/:id/counts')
  @ApiOperation({
    summary: 'Mencatat hitungan kasa, jarum, atau instrumen',
    description: 'Penghitung kedua tidak boleh sama dengan penghitung pertama.',
  })
  async hitungan(
    @Param('id') id: string,
    @Body() dto: HitunganDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.catatHitungan(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SURGERY.INCISE')
  @Post('ot/cases/:id/incision')
  @ApiOperation({
    summary: 'Memulai sayatan',
    description:
      'Inilah titik yang seluruh daftar periksa ada untuknya. Jeda sebelum sayatan harus SUDAH ' +
      'selesai dan lengkap, dan sisi yang ditandai harus cocok dengan persetujuan tindakan. ' +
      'Bila salah satunya belum terpenuhi, jawabannya bukan peringatan melainkan penolakan.',
  })
  async sayatan(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.mulaiSayatan(schema, id, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SURGERY.UPDATE')
  @Post('ot/cases/:id/leave')
  @ApiOperation({
    summary: 'Menyatakan pasien meninggalkan kamar operasi',
    description:
      'Hitungan yang tidak cocok MENAHAN, kecuali ada keterangan pencarian. Menahannya tanpa ' +
      'jalan keluar sama sekali akan membuat orang mematikan sistemnya, dan sistem yang ' +
      'dimatikan tidak menahan apa pun.',
  })
  async keluar(
    @Param('id') id: string,
    @Body() dto: KeluarKamarOperasiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.keluarKamarOperasi(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SURGERY.READ')
  @Get('ot/schedule')
  @ApiOperation({ summary: 'Jadwal operasi' })
  jadwal(
    @Query('facilityId') facilityId: string,
    @Query('date') date: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.akut.jadwalOperasi(requireSchema(user), facilityId, date);
  }

  // --- Perawatan intensif ----------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ICU.CREATE')
  @Post('icu/assessments')
  @ApiOperation({
    summary: 'Mencatat asesmen perawatan intensif',
    description:
      'Dukungan organ ganda langsung dinyatakan kritis apa pun skornya. Pasien dengan ' +
      'ventilator dan vasopresor sekaligus adalah pasien yang tanda vitalnya tampak baik JUSTRU ' +
      'KARENA mesin yang menahannya — dan skor yang membaca tanda vital saja akan menyimpulkan ' +
      'ia sedang membaik.',
  })
  async asesmenIntensif(
    @Body() dto: AsesmenIntensifDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akut.catatAsesmenIntensif(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ICU.READ')
  @Get('icu/board')
  @ApiOperation({ summary: 'Papan perawatan intensif, diurutkan menurut keparahan' })
  papanIcu(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.akut.papanIntensif(requireSchema(user), facilityId);
  }
}
