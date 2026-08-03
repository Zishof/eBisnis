/**
 * Endpoint registri alat kesehatan, gateway, dan hasil alat.
 *
 * Dua pemisahan menentukan bentuknya, dan yang pertama tidak lazim:
 *
 * ```
 * MANAGE_DEVICE mengelola alat  ≠  ACTIVATE menyalakan kendali jarak jauh
 * ASSIGN mengaitkan hasil       ≠  REVIEW menelaahnya
 * ```
 *
 * Teknisi biomedis mengenal alatnya dan justru karena itu ia orang yang paling
 * mudah membujuk dirinya sendiri bahwa kendali jarak jauh akan mempermudah
 * pekerjaannya. Ia benar; yang tidak dilihatnya adalah pompa infus yang
 * dosisnya dapat dinaikkan oleh siapa pun yang menembus jaringannya.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthDeviceService } from './health-device.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type { Protokol, StatusAlat } from './health-device';

const PROTOKOL = [
  'HL7V2', 'ASTM', 'IHE_PCD', 'IEEE_11073', 'TCP_SERIAL', 'SFTP',
  'DICOM', 'DICOMWEB', 'MODALITY_WORKLIST', 'MPPS', 'FHIR', 'VENDOR_API', 'MQTT',
  'MANUAL_ENTRY',
];
const STATUS = ['REGISTERED', 'ACTIVE', 'MAINTENANCE', 'DOWNTIME', 'RETIRED'];
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

class GatewayDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendor?: string;

  @ApiPropertyOptional({ description: 'Segmen jaringan tempat gateway ini berada.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  networkSegment?: string;

  @ApiPropertyOptional({
    description:
      'RUJUKAN ke brankas, misalnya vault://gateway/1. Bukan nilainya — administrator yang ' +
      'menyimpannya tidak dapat membacanya kembali.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  credentialSecretRef?: string;

  @ApiPropertyOptional({
    description:
      'SELALU DITOLAK. Medan ini ada supaya penolakannya jelas, bukan supaya nilainya diam-diam ' +
      'terbuang.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  credentialRawValue?: string;
}

class AlatDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional({ description: 'Wajib kecuali protokolnya MANUAL_ENTRY.' })
  @IsOptional()
  @IsUUID()
  gatewayId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceUnitId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiProperty({ example: 'INFUSION_PUMP' })
  @IsString()
  @MaxLength(48)
  deviceCategory!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  softwareVersion?: string;

  @ApiProperty({ enum: PROTOKOL })
  @IsIn(PROTOKOL)
  sourceProtocol!: Protokol;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  calibratedAt?: string;

  @ApiPropertyOptional({ example: '2027-01-01' })
  @IsOptional()
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  calibrationDueAt?: string;
}

class StatusDto {
  @ApiProperty({ enum: STATUS })
  @IsIn(STATUS)
  status!: StatusAlat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

class KendaliJauhDto {
  @ApiProperty({ description: 'Rujukan persetujuan tertulis manajemen.' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  writtenApprovalRef!: string;

  @ApiProperty({ description: 'Rujukan telaah risiko klinis.' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  riskReviewRef!: string;

  @ApiProperty({
    type: [String],
    description: 'Daftar PUTIH perintah yang diizinkan. Daftar hitam melewatkan yang baru.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  allowedCommands!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiProperty({ description: 'Batas atas. Wajib.' })
  @IsNumber()
  maxValue!: number;

  @ApiProperty()
  @IsBoolean()
  commandLogging!: boolean;

  @ApiProperty()
  @IsBoolean()
  emergencyStop!: boolean;
}

class PerintahDto {
  @ApiProperty()
  @IsString()
  @MaxLength(48)
  command!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  value?: number;
}

class HasilDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsUUID()
  deviceId!: string;

  @ApiPropertyOptional({ description: 'Pesan asli. Sidik jarinya dihitung dari sini.' })
  @IsOptional()
  @IsString()
  @MaxLength(65536)
  rawMessage?: string;

  @ApiPropertyOptional({ description: 'Sidik jari pesan asli, bila gateway sudah menghitungnya.' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  rawMessageHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  observationCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observationValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  observationUnit?: string;

  @ApiProperty({
    description: 'Waktu alat mengambilnya — BUKAN waktu tibanya. Keduanya disimpan terpisah.',
  })
  @IsString()
  capturedAt!: string;

  @ApiPropertyOptional({ description: 'Cara pengaitan yang paling dapat dipercaya.' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Hasil pemindaian gelang pasien di sisi alat.' })
  @IsOptional()
  @IsUUID()
  scannedPatientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

class KaitkanDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;
}

class TelaahDto {
  @ApiProperty()
  @IsBoolean()
  accept!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Alat Kesehatan')
@Controller('health/devices')
export class HealthDeviceController {
  constructor(
    private readonly alat: HealthDeviceService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Rujukan ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.READ')
  @Get('protocols')
  @ApiOperation({
    summary: 'Katalog protokol beserta status dan penghalangnya',
    description:
      'Yang terhalang menyebutkan penghalangnya. Daftar yang hanya berkata "tidak didukung" ' +
      'akan ditanyakan ulang setiap tiga bulan oleh orang yang berbeda.',
  })
  protokol() {
    return this.alat.daftarProtokol();
  }

  // --- Gateway ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_GATEWAY.CREATE')
  @Post('gateways')
  @ApiOperation({
    summary: 'Mendaftarkan gateway alat',
    description:
      'Kredensial disimpan sebagai RUJUKAN ke brankas, tidak pernah sebagai nilai. Nilai mentah ' +
      'ditolak sebelum apa pun tersimpan — kredensial yang sempat masuk basis data sudah bocor ' +
      'sekalipun barisnya dihapus kemudian.',
  })
  async buatGateway(@Body() dto: GatewayDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.alat.daftarkanGateway(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_GATEWAY.READ')
  @Get('gateways')
  @ApiOperation({
    summary: 'Daftar gateway',
    description: 'Rujukan brankasnya TIDAK ikut dikembalikan; hanya keterangan bahwa ia ada.',
  })
  daftarGateway(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.alat.daftarGateway(requireSchema(user), facilityId);
  }

  // --- Alat ------------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.CREATE')
  @Post()
  @ApiOperation({
    summary: 'Mendaftarkan alat',
    description:
      'Alat wajib menunjuk gateway-nya kecuali pencatatan manual. Kendali jarak jauhnya MATI ' +
      'sejak terdaftar.',
  })
  async buatAlat(@Body() dto: AlatDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.alat.daftarkanAlat(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.MANAGE_DEVICE')
  @Post(':id/status')
  @ApiOperation({
    summary: 'Mengubah status alat',
    description: 'Alat yang DOWNTIME tidak menerima pesanan baru.',
  })
  ubahStatus(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alat.ubahStatus(requireSchema(user), id, dto.status, dto.reason);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.ACTIVATE')
  @Post(':id/remote-control/enable')
  @ApiOperation({
    summary: 'Menyalakan kendali jarak jauh',
    description:
      'MENUNTUT KEENAM SYARATNYA SEKALIGUS. Wewenang ini sengaja TERPISAH dari pengelolaan ' +
      'alat: yang mengenal alatnya adalah orang yang paling mudah membujuk dirinya sendiri ' +
      'bahwa kendali jarak jauh akan mempermudah pekerjaannya.',
  })
  async nyalakan(
    @Param('id') id: string,
    @Body() dto: KendaliJauhDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.alat.nyalakanKendaliJauh(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.ACTIVATE')
  @Post(':id/remote-control/disable')
  @ApiOperation({ summary: 'Mematikan kendali jarak jauh' })
  matikan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alat.matikanKendaliJauh(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.MANAGE_DEVICE')
  @Post(':id/commands')
  @ApiOperation({
    summary: 'Mengirim perintah kepada alat',
    description:
      'Setiap perintah dicatat, TERMASUK yang ditolak — perintah yang ditolak justru yang ' +
      'paling berharga: ia menunjukkan ada yang mencoba.',
  })
  async perintah(
    @Param('id') id: string,
    @Body() dto: PerintahDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.alat.kirimPerintah(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar alat beserta status kalibrasinya' })
  daftarAlat(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.alat.daftarAlat(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE.READ')
  @Get(':id/commands')
  @ApiOperation({ summary: 'Jejak perintah satu alat, termasuk yang ditolak' })
  jejak(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alat.jejakPerintah(requireSchema(user), id);
  }

  // --- Hasil alat ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_INBOX.CREATE')
  @Post('observations')
  @ApiOperation({
    summary: 'Menerima satu hasil dari gateway',
    description:
      'Hasil yang tiba tanpa identitas pasien TIDAK DITEBAK — ia masuk antrean PENDING_LINK. ' +
      'Waktu pengambilan dan waktu penerimaan disimpan terpisah, dan selisih besar ditandai. ' +
      'Duplikat dikenali lewat sidik jari pesan, bukan lewat waktu.',
  })
  terima(@Body() dto: HasilDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alat.terimaHasil(requireSchema(user), dto);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_INBOX.READ')
  @Get('observations/pending-link')
  @ApiOperation({
    summary: 'Antrean hasil yang menunggu manusia mengaitkannya',
    description:
      'Mencocokkan berdasarkan nama, atau berdasarkan pasien yang sedang di ruangan itu, akan ' +
      'benar sembilan puluh sembilan kali dan salah sekali — dan yang sekali itu adalah hasil ' +
      'laboratorium orang lain di rekam medis seseorang.',
  })
  antrean(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.alat.antreanPengaitan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_INBOX.ASSIGN')
  @Post('observations/:id/link')
  @ApiOperation({
    summary: 'Mengaitkan hasil kepada pasien',
    description: 'Nama yang mengaitkannya tercatat, dan pengaitan yang sudah ada tidak ditimpa.',
  })
  async kaitkan(
    @Param('id') id: string,
    @Body() dto: KaitkanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.alat.kaitkanManual(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_INBOX.REVIEW')
  @Post('observations/:id/review')
  @ApiOperation({
    summary: 'Menelaah satu hasil alat',
    description:
      'Yang mengaitkan hasil tidak menelaahnya sendiri. Telaah oleh yang mengaitkannya hanya ' +
      'membaca ulang keyakinannya sendiri.',
  })
  async telaah(
    @Param('id') id: string,
    @Body() dto: TelaahDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.alat.telaahHasil(schema, id, dto, await this.aktor(schema, user));
  }
}
