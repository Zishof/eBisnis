/**
 * Endpoint pemetaan akuntansi kesehatan.
 *
 * **Tidak ada satu pun jalan di sini yang membuat jurnal.** Seluruhnya menyimpan
 * pemetaan, memeriksa kelengkapannya, atau melaporkan kesiapannya. Jurnalnya
 * milik mesin akuntansi bersama.
 *
 * Pemisahannya: yang memetakan akun bukan yang membaca rekam medis. Peran
 * `HEALTH_FINANCE_OFFICER` sengaja tidak diberi `HEALTH_PATIENT.READ` — petugas
 * keuangan perlu tahu bahwa pendapatan laboratorium masuk ke akun 4160; ia tidak
 * perlu tahu siapa yang diperiksa.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthAccountingService } from './health-accounting.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { PERISTIWA, SELURUH_PERAN } from './health-accounting';
import type { PeranAkun, PeristiwaKesehatan } from './health-accounting';

const KODE_PERISTIWA = PERISTIWA.map((p) => p.event);
const KODE_PERAN: string[] = [...SELURUH_PERAN];
const KODE_PERAN_ATAU_LAYANAN = [...KODE_PERAN, 'BY_SERVICE'];

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

class BuatProfilDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  legalEntityId?: string;

  @ApiPropertyOptional({
    enum: KODE_PERISTIWA,
    isArray: true,
    description:
      'Peristiwa yang MEMANG dipakai fasilitas ini. Menuntut penautan akun bagi peristiwa yang ' +
      'tidak akan pernah terjadi akan membuat seluruh daftar kekurangan diabaikan.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(KODE_PERISTIWA, { each: true })
  enabledEvents?: PeristiwaKesehatan[];
}

class TautkanAkunDto {
  @ApiProperty({ enum: KODE_PERAN })
  @IsIn(KODE_PERAN)
  role!: PeranAkun;

  @ApiProperty({ description: 'Akun milik bagan akun bersama. Kami menunjuknya, tidak membuatnya.' })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class AturanDto {
  @ApiProperty({ enum: KODE_PERISTIWA })
  @IsIn(KODE_PERISTIWA)
  eventCode!: PeristiwaKesehatan;

  @ApiPropertyOptional({ enum: KODE_PERAN_ATAU_LAYANAN })
  @IsOptional()
  @IsIn(KODE_PERAN_ATAU_LAYANAN)
  debitRole?: PeranAkun | 'BY_SERVICE';

  @ApiPropertyOptional({ enum: KODE_PERAN_ATAU_LAYANAN })
  @IsOptional()
  @IsIn(KODE_PERAN_ATAU_LAYANAN)
  creditRole?: PeranAkun | 'BY_SERVICE';

  @ApiPropertyOptional({
    description:
      'Nama medan nilai pada peristiwa. BUKAN rumus — rumus bebas pada data adalah pintu masuk ' +
      'eksekusi kode yang tidak diinginkan.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  @Matches(/^[a-zA-Z][a-zA-Z0-9]*$/, {
    message: 'Nama medan nilai hanya boleh huruf dan angka, dan tidak boleh berupa rumus.',
  })
  amountKey?: string;
}

class SelisihKlaimDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  submittedAmount!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  approvedAmount!: number;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Pemetaan Akuntansi')
@Controller('health/accounting')
export class HealthAccountingController {
  constructor(
    private readonly akuntansi: HealthAccountingService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Rujukan ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.READ')
  @Get('roles')
  @ApiOperation({
    summary: 'Daftar peran akun kesehatan',
    description:
      'Peran, bukan nomor akun. Rumah sakit yang memakai bagan akun berbeda menautkan perannya ' +
      'ke nomor akunnya sendiri; kodenya tidak berubah.',
  })
  peran() {
    return this.akuntansi.daftarPeran();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.READ')
  @Get('events')
  @ApiOperation({
    summary: 'Katalog peristiwa kesehatan beserta pemetaan bawaannya',
    description:
      'Baris "klaim disetujui kurang dari yang diajukan" yang paling sering terlupa. Selisihnya ' +
      'bukan pendapatan yang hilang begitu saja; ia beban yang harus terlihat.',
  })
  peristiwa() {
    return this.akuntansi.daftarPeristiwa();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.READ')
  @Get('coa-template')
  @ApiOperation({
    summary: 'Templat bagan akun kesehatan',
    description:
      'Templat, bukan bagan akun kedua. Yang menyemainya membuat baris pada bagan akun bersama, ' +
      'lalu menautkannya lewat peran.',
  })
  templat(@CurrentUser() user: AuthenticatedUser) {
    return this.akuntansi.templatCoa(requireSchema(user));
  }

  // --- Profil ----------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.CREATE')
  @Post('profiles')
  @ApiOperation({ summary: 'Membuat profil akuntansi fasilitas' })
  async buatProfil(@Body() dto: BuatProfilDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.akuntansi.buatProfil(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.UPDATE')
  @Post('profiles/:id/links')
  @ApiOperation({
    summary: 'Menautkan peran akun ke akun sungguhan',
    description:
      'Saldo normal akunnya harus cocok dengan golongan perannya. Menautkan pendapatan ke akun ' +
      'bersaldo normal debit akan membuat pendapatan bernilai negatif pada setiap laporan.',
  })
  async tautkan(
    @Param('id') id: string,
    @Body() dto: TautkanAkunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akuntansi.tautkanAkun(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.UPDATE')
  @Post('profiles/:id/rules')
  @ApiOperation({
    summary: 'Memasang aturan pemetaan satu peristiwa',
    description: 'Debit dan kredit tidak boleh peran yang sama.',
  })
  async pasang(
    @Param('id') id: string,
    @Body() dto: AturanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.akuntansi.pasangAturan(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.UPDATE')
  @Post('profiles/:id/rules/seed-defaults')
  @ApiOperation({
    summary: 'Menyemai seluruh aturan bawaan sekaligus',
    description:
      'Hanya bagi peristiwa yang memang dipakai fasilitas ini. Yang membiarkan peta kosong ' +
      'karena mengisinya satu per satu terlalu lama akan berakhir dengan peta kosong.',
  })
  async semai(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.akuntansi.semaiAturanBawaan(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.READ')
  @Get('profiles/:id/readiness')
  @ApiOperation({
    summary: 'Kesiapan menjurnal',
    description:
      'Memisahkan yang belum KAMI kerjakan dari yang menunggu mesin akuntansi bersama. Laporan ' +
      'yang menyatukan keduanya akan membuat orang mengerjakan hal yang memang tidak dapat ' +
      'dikerjakannya.',
  })
  kesiapan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.akuntansi.kesiapan(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.READ')
  @Get('profiles/:id/map')
  @ApiOperation({ summary: 'Peta lengkap peristiwa, peran, dan akun yang tertaut' })
  peta(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.akuntansi.peta(requireSchema(user), id);
  }

  // --- Selisih klaim ---------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.READ')
  @Get('claim-adjustment')
  @ApiOperation({
    summary: 'Menghitung selisih klaim',
    description:
      'TIDAK menjurnal apa pun — ia menyatakan peristiwa apa yang seharusnya terbentuk. ' +
      'Disetujui lebih besar daripada yang diajukan menuntut telaah, bukan jurnal.',
  })
  selisih(
    @Query('submitted') submitted: string,
    @Query('approved') approved: string,
  ) {
    const diajukan = Number(submitted);
    const disetujui = Number(approved);
    if (!Number.isFinite(diajukan) || !Number.isFinite(disetujui)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter submitted dan approved wajib berupa angka.',
      );
    }
    if (diajukan < 0 || disetujui < 0) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Nilai klaim tidak boleh negatif.',
      );
    }
    return this.akuntansi.hitungSelisih({
      submittedAmount: diajukan,
      approvedAmount: disetujui,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCOUNTING_MAP.READ')
  @Post('claim-adjustment')
  @ApiOperation({ summary: 'Menghitung selisih klaim (badan permintaan)' })
  selisihPost(@Body() dto: SelisihKlaimDto) {
    return this.akuntansi.hitungSelisih(dto);
  }
}
