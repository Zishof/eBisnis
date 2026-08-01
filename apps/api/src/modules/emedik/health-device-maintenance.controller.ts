/**
 * Endpoint pemeliharaan biomedis, kalibrasi, dan keamanan siber alat.
 *
 * Pemisahan yang menentukan bentuknya:
 *
 * ```
 * HEALTH_DEVICE_SECURITY.CREATE menilai  ≠  APPROVE memutuskan menanggung
 * HEALTH_DEVICE_MAINTENANCE.RELEASE menutup pekerjaan
 *   ≠  HEALTH_DEVICE.MANAGE_DEVICE mengembalikan alat ke pelayanan
 * ```
 *
 * Dan satu hal yang tidak ada: **tidak ada satu pun jalan di sini yang
 * mematikan alat.** Tidak ada `POST /devices/:id/disable`, tidak ada
 * `POST /risk/:id/quarantine`, tidak ada tindakan otomatis pada skor CRITICAL.
 * Ketiadaannya disengaja, dan alasannya sederhana: yang tahu apakah alat itu
 * sedang menopang seseorang bukan perangkat lunak ini.
 *
 * Tajuk tujuan penggunaan sengaja TIDAK dituntut di sini. Pemeliharaan alat dan
 * penilaian risiko siber tidak menyentuh data pasien — menuntut tajuknya akan
 * mengajarkan penggunanya bahwa tajuk itu sekadar formalitas, dan pelajaran itu
 * terbawa ke jalan-jalan yang benar-benar membuka rekam medis.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthDeviceMaintenanceService } from './health-device-maintenance.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import {
  FAKTOR_RISIKO,
  PENAHAN_PENGGANTI,
  type JenisInsidenSiber,
  type JenisPekerjaan,
  type Keputusan,
  type KodeFaktor,
  type KodePenahan,
} from './health-device-maintenance';

const JENIS_PEKERJAAN = [
  'PREVENTIVE',
  'CORRECTIVE',
  'CALIBRATION',
  'SAFETY_INSPECTION',
  'SOFTWARE_UPDATE',
];
const HASIL_INSPEKSI = ['PASS', 'FAIL', 'PASS_WITH_NOTE'];
const PRIORITAS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const TINGKAT = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const KEPUTUSAN = ['ACCEPT', 'MITIGATE', 'RETIRE'];
const JENIS_INSIDEN = [
  'MALWARE',
  'UNAUTHORIZED_ACCESS',
  'UNAUTHORIZED_COMMAND',
  'DATA_EXFILTRATION',
  'RANSOMWARE',
  'DENIAL_OF_SERVICE',
  'UNPATCHED_EXPLOIT',
  'PHYSICAL_TAMPERING',
  'OTHER',
];
const KODE_FAKTOR = Object.keys(FAKTOR_RISIKO);
const KODE_PENAHAN = Object.keys(PENAHAN_PENGGANTI);
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

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

class PekerjaanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsUUID()
  deviceId!: string;

  @ApiProperty({ enum: JENIS_PEKERJAAN })
  @IsIn(JENIS_PEKERJAAN)
  workType!: JenisPekerjaan;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ enum: PRIORITAS })
  @IsOptional()
  @IsIn(PRIORITAS)
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({
    description:
      'Apakah kejadian yang melahirkan pekerjaan ini mengenai pasien. Bila ya, laporan ' +
      'insiden keselamatannya WAJIB ditunjuk.',
  })
  @IsOptional()
  @IsBoolean()
  affectedPatient?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  safetyIncidentId?: string;
}

class TutupPekerjaanDto {
  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  completionNote!: string;

  @ApiPropertyOptional({ enum: HASIL_INSPEKSI })
  @IsOptional()
  @IsIn(HASIL_INSPEKSI)
  inspectionResult?: 'PASS' | 'FAIL' | 'PASS_WITH_NOTE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  measuredValues?: string;

  @ApiPropertyOptional({
    description: 'Standar acuan kalibrasi. WAJIB bila kalibrasinya lulus.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  referenceStandard?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  downtimeMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  partsNote?: string;

  @ApiPropertyOptional({ description: 'Masa berlaku kalibrasi, YYYY-MM-DD.' })
  @IsOptional()
  @Matches(TANGGAL)
  validUntil?: string;
}

class PenahanDto {
  @ApiProperty({ enum: KODE_PENAHAN })
  @IsIn(KODE_PENAHAN)
  kode!: KodePenahan;

  @ApiPropertyOptional({
    description: 'Rujukan bukti. Tanpa ini penahannya TIDAK dihitung sama sekali.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  buktiRef?: string;
}

class NilaiRisikoDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsUUID()
  deviceId!: string;

  @ApiProperty({
    isArray: true,
    enum: KODE_FAKTOR,
    description: 'Faktor risiko bawaan yang berlaku pada alat ini.',
  })
  @IsArray()
  @IsIn(KODE_FAKTOR, { each: true })
  faktor!: KodeFaktor[];

  @ApiPropertyOptional({ type: () => [PenahanDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PenahanDto)
  penahan?: PenahanDto[];
}

class KeputusanRisikoDto {
  @ApiProperty({ enum: KEPUTUSAN })
  @IsIn(KEPUTUSAN)
  decision!: Keputusan;

  @ApiProperty({ minLength: 20 })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  reason!: string;

  @ApiPropertyOptional({
    description: 'WAJIB bila keputusannya ACCEPT. Penerimaan tanpa tanggal tinjau berlaku selamanya.',
  })
  @IsOptional()
  @Matches(TANGGAL)
  reviewDueOn?: string;

  @ApiPropertyOptional({ description: 'WAJIB bila keputusannya MITIGATE atau RETIRE.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  planRef?: string;
}

class InsidenSiberDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gatewayId?: string;

  @ApiProperty({ enum: JENIS_INSIDEN })
  @IsIn(JENIS_INSIDEN)
  incidentType!: JenisInsidenSiber;

  @ApiProperty({ enum: TINGKAT })
  @IsIn(TINGKAT)
  severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty()
  @IsString()
  detectedAt!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({
    description:
      'Apakah insiden ini mempengaruhi perawatan pasien. Bila ya, laporan keselamatan ' +
      'pasiennya WAJIB ditunjuk.',
  })
  @IsOptional()
  @IsBoolean()
  affectedPatientCare?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  safetyIncidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  containmentNote?: string;
}

class IsolasiDto {
  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  containmentNote!: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Pemeliharaan dan Keamanan Alat')
@Controller('health/device-maintenance')
export class HealthDeviceMaintenanceController {
  constructor(
    private readonly rawat: HealthDeviceMaintenanceService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Pemeliharaan ----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MAINTENANCE.CREATE')
  @Post('work-orders')
  @ApiOperation({
    summary: 'Membuka pekerjaan pemeliharaan',
    description:
      'TIDAK mengubah status alat. Membuka pekerjaan tidak berarti alatnya berhenti — teknisi ' +
      'yang mencatat "perlu diganti selangnya bulan depan" tidak bermaksud menghentikan ' +
      'pelayanan hari ini, dan perangkat lunak yang menghentikannya akan membuat teknisi ' +
      'berhenti mencatat.',
  })
  async buka(@Body() dto: PekerjaanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.rawat.bukaPekerjaan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MAINTENANCE.RELEASE')
  @Post('work-orders/:id/close')
  @ApiOperation({
    summary: 'Menutup pekerjaan pemeliharaan',
    description:
      'Kalibrasi dan inspeksi keselamatan wajib menyebut hasilnya; kalibrasi yang lulus wajib ' +
      'menyebut standar acuannya pula. Uji keselamatan listrik yang GAGAL menahan alat dari ' +
      'pelayanan — satu-satunya penahan keras pada modul ini.',
  })
  async tutup(
    @Param('id') id: string,
    @Body() dto: TutupPekerjaanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.rawat.tutupPekerjaan(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.MANAGE_DEVICE')
  @Post('devices/:id/return-to-service')
  @ApiOperation({
    summary: 'Mengembalikan alat ke pelayanan',
    description:
      'Sengaja jalan tersendiri, bukan efek samping penutupan pekerjaan. Yang menutup pekerjaan ' +
      'menyatakan pekerjaannya selesai; yang mengembalikan alat menyatakan alatnya layak dipakai ' +
      'pasien. Dua pernyataan yang berbeda, dan yang kedua sering dibuat orang yang berbeda pula.',
  })
  async kembalikan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.rawat.kembalikanMelayani(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MAINTENANCE.READ')
  @Get('work-orders')
  @ApiOperation({ summary: 'Daftar pekerjaan pemeliharaan' })
  daftar(
    @Query('facilityId') facilityId: string,
    @Query('deviceId') deviceId: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.rawat.daftarPekerjaan(requireSchema(user), { facilityId, deviceId, status });
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MAINTENANCE.READ')
  @Get('schedule')
  @ApiOperation({
    summary: 'Papan jadwal pemeliharaan',
    description: 'Keterlambatan MENANDAI, tidak menghentikan alat.',
  })
  papan(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.rawat.papanPemeliharaan(requireSchema(user), facilityId);
  }

  // --- Kalibrasi -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MAINTENANCE.READ')
  @Get('devices/:id/calibrations')
  @ApiOperation({ summary: 'Riwayat kalibrasi alat' })
  riwayat(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rawat.riwayatKalibrasi(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MAINTENANCE.READ')
  @Get('devices/:id/calibrated-on')
  @ApiOperation({
    summary: 'Apakah alat terkalibrasi pada tanggal tertentu',
    description:
      'Pertanyaan yang muncul ketika hasil laboratorium dipersengketakan, dan yang tidak dapat ' +
      'dijawab kolom kalibrasi terakhir — kolom itu hanya tahu yang TERAKHIR.',
  })
  terkalibrasi(
    @Param('id') id: string,
    @Query('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!TANGGAL.test(date ?? '')) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter date wajib berbentuk YYYY-MM-DD.',
      );
    }
    return this.rawat.terkalibrasiPada(requireSchema(user), id, date);
  }

  // --- Risiko siber ----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_SECURITY.READ')
  @Get('risk/catalog')
  @ApiOperation({
    summary: 'Katalog faktor risiko dan penahannya',
    description:
      'Bobotnya ada di satu tempat saja, beserta alasan masing-masing. Bobot yang tersebar di ' +
      'beberapa berkas akan berbeda satu sama lain dalam waktu enam bulan.',
  })
  katalog() {
    return this.rawat.katalogRisiko();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_SECURITY.CREATE')
  @Post('risk')
  @ApiOperation({
    summary: 'Menilai risiko siber alat',
    description:
      'TIDAK mengubah status alat dan TIDAK memutus alat dari pasien, pada tingkat mana pun. ' +
      'Penahan tanpa rujukan bukti tidak dihitung sama sekali, dan risiko sisa tidak pernah ' +
      'turun ke nol selama ada faktor bawaan.',
  })
  async nilai(@Body() dto: NilaiRisikoDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    const faktor: Partial<Record<KodeFaktor, boolean>> = {};
    for (const f of dto.faktor) faktor[f] = true;
    return this.rawat.nilaiRisiko(
      schema,
      {
        facilityId: dto.facilityId,
        deviceId: dto.deviceId,
        faktor,
        penahan: (dto.penahan ?? []).map((p) => ({ kode: p.kode, buktiRef: p.buktiRef ?? null })),
      },
      await this.aktor(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_SECURITY.APPROVE')
  @Post('risk/:id/decide')
  @ApiOperation({
    summary: 'Memutuskan penerimaan risiko',
    description:
      'Yang menilai TIDAK memutuskan penerimaannya sendiri. Penerimaan wajib bertanggal tinjau; ' +
      'pengurangan dan pemensiunan wajib menunjuk rencananya.',
  })
  async putuskan(
    @Param('id') id: string,
    @Body() dto: KeputusanRisikoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.rawat.putuskanRisiko(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_SECURITY.READ')
  @Get('risk')
  @ApiOperation({
    summary: 'Papan alat yang menuntut perhatian',
    description:
      'Yang tenggat keputusannya sudah lewat didahulukan atas yang skornya lebih tinggi.',
  })
  papanRisiko(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.rawat.papanRisiko(requireSchema(user), facilityId);
  }

  // --- Insiden siber ---------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_SECURITY.CREATE')
  @Post('security-incidents')
  @ApiOperation({
    summary: 'Melaporkan insiden keamanan siber alat',
    description:
      'Yang mempengaruhi perawatan pasien WAJIB pula tertaut laporan keselamatan pasien. Dua ' +
      'daftar tentang satu kejadian yang sama adalah cara paling rapi untuk membuat kejadian itu ' +
      'tidak pernah dihitung. Pencatatannya TIDAK mengisolasi alat.',
  })
  async lapor(@Body() dto: InsidenSiberDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.rawat.laporkanInsidenSiber(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_SECURITY.UPDATE')
  @Post('security-incidents/:id/isolate')
  @ApiOperation({
    summary: 'Mencatat isolasi jaringan yang sudah dilakukan',
    description:
      'Yang dicatat adalah isolasi JARINGAN yang sudah dilakukan orang, bukan perintah kepada ' +
      'alat untuk memutuskan dirinya.',
  })
  async isolasi(
    @Param('id') id: string,
    @Body() dto: IsolasiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.rawat.catatIsolasi(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_SECURITY.READ')
  @Get('security-incidents')
  @ApiOperation({ summary: 'Daftar insiden keamanan siber alat' })
  daftarInsiden(
    @Query('facilityId') facilityId: string,
    @Query('openOnly') openOnly: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.rawat.daftarInsidenSiber(requireSchema(user), {
      facilityId,
      openOnly: openOnly === 'true',
    });
  }
}
