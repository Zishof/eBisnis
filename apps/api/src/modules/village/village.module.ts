/**
 * Vertikal info-desa — Sistem Informasi Desa dan Kelurahan.
 *
 * Seluruh rute berawalan `/village`, seluruh hak akses berawalan `VILLAGE.`,
 * seluruh peristiwa berawalan `village.`. Batas ini ditegakkan uji
 * ketergantungan pada D-12, bukan hanya oleh kesepakatan.
 */

import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { VillageMigrationService } from './village-migration.service';
import { VillageUnitService } from './village-unit.service';
import { VillageResidentService, type CakupanWilayah } from './village-resident.service';
import { KATALOG_KELAYAKAN, layak, type KodeFitur } from './village-profile';

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terikat pada tenant mana pun.');
  }
  return user.schemaName;
}

// --- DTO ---------------------------------------------------------------------

class BuatSubWilayahDto {
  @ApiProperty({ example: 'DSN-01' })
  @IsString()
  @MinLength(1)
  @MaxLength(48)
  code!: string;

  @ApiProperty({ example: 'Dusun Krajan' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  headPhone?: string;
}

class BuatRwDto {
  @ApiProperty({ example: '001' })
  @IsString()
  @MaxLength(8)
  number!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subAreaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headName?: string;
}

class BuatRtDto {
  @ApiProperty()
  @IsUUID()
  rwId!: string;

  @ApiProperty({ example: '003' })
  @IsString()
  @MaxLength(8)
  number!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headName?: string;
}

class DaftarDomainDto {
  @ApiProperty({ example: 'sukoanyar.info-desa.id' })
  @IsString()
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9.-]+$/, { message: 'Nama host hanya boleh huruf, angka, titik, dan tanda hubung.' })
  hostname!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  makePrimary?: boolean;
}


class BuatPendudukDto {
  @ApiPropertyOptional({
    example: '3507121708900001',
    description: 'NIK. Yang janggal DITANDAI, bukan ditolak.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  nationalId?: string;

  @ApiProperty({ example: 'Ahmad Fauzi' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  birthPlace?: string;

  @ApiPropertyOptional({ example: '1990-08-17' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string;

  @ApiPropertyOptional({ enum: ['L', 'P'] })
  @IsOptional()
  @IsIn(['L', 'P'])
  gender?: 'L' | 'P';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  familyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  familyRelation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  rtId?: string;
}

class SuntingPendudukDto {
  @ApiProperty({
    description: 'Alasan perubahan. WAJIB — data kependudukan tidak berubah tanpa sebab.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ description: 'Rujukan dokumen yang mendasari perubahan.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  documentReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveDate?: string;

  @ApiProperty({ description: 'Medan yang diubah beserta nilai barunya.' })
  changes!: Record<string, string | null>;
}

const JENIS_PERISTIWA = [
  'KELAHIRAN',
  'KEMATIAN',
  'PINDAH_MASUK',
  'PINDAH_KELUAR',
  'PERKAWINAN',
  'PERCERAIAN',
] as const;

class PeristiwaDto {
  @ApiProperty({ enum: JENIS_PERISTIWA })
  @IsIn(JENIS_PERISTIWA as unknown as string[])
  eventType!: (typeof JENIS_PERISTIWA)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  residentId?: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eventDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eventPlace?: string;

  @ApiPropertyOptional({ description: 'Nama bayi, untuk peristiwa kelahiran.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  childName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  documentReference?: string;
}

// --- Controller ---------------------------------------------------------------

@ApiTags('village')
@Controller('village')
export class VillageController {
  constructor(
    private readonly unit: VillageUnitService,
    private readonly migrasi: VillageMigrationService,
    private readonly penduduk: VillageResidentService,
  ) {}

  /**
   * Cakupan wilayah pengguna.
   *
   * Sementara ini seluruh pengguna berhak-akses memperoleh cakupan UNIT. D-3
   * menyambungkannya ke `user_scope_assignment` yang sudah ada pada Core,
   * sehingga Ketua RT benar-benar terbatas pada RT-nya. Disebutkan terbuka di
   * sini alih-alih dibiarkan tampak sudah berlaku — mesin penyaringnya sudah
   * ada dan teruji, yang belum adalah sumber cakupannya.
   */
  private cakupan(_user: AuthenticatedUser): CakupanWilayah {
    return { level: 'UNIT' };
  }

  // --- Profil dan kelayakan ------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_UNIT.READ')
  @Get('unit')
  @ApiOperation({ summary: 'Profil unit pemerintahan penyewa ini' })
  ambilUnit(@CurrentUser() user: AuthenticatedUser) {
    return this.unit.unit(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_UNIT.READ')
  @Get('eligibility')
  @ApiOperation({
    summary: 'Kelayakan seluruh fitur bagi profil penyewa',
    description:
      'Dipakai antarmuka untuk menyusun menu. Antarmuka BOLEH menyembunyikan yang tidak layak, ' +
      'tetapi penegakan sesungguhnya ada pada setiap endpoint — menu tersembunyi dengan ' +
      'endpoint terbuka bukan pembatasan melainkan penyamaran.',
  })
  async kelayakan(@CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    const u = await this.unit.unit(schema);
    const aktif = new Set(u.enabledFeatures);
    const fitur: Record<string, { eligibility: string; allowed: boolean; reason?: string }> = {};
    for (const kode of Object.keys(KATALOG_KELAYAKAN) as KodeFitur[]) {
      const h = layak(kode, u.profileType, { aktif });
      fitur[kode] = { eligibility: h.kelayakan, allowed: h.layak, reason: h.alasan };
    }
    return { profileType: u.profileType, enabledFeatures: u.enabledFeatures, features: fitur };
  }

  // --- Sub-wilayah ----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REGION.READ')
  @Get('sub-areas')
  @ApiOperation({
    summary: 'Dusun (desa) atau lingkungan (kelurahan)',
    description: 'Jenisnya ditentukan profil penyewa, bukan oleh permintaan.',
  })
  daftarSubWilayah(@CurrentUser() user: AuthenticatedUser) {
    return this.unit.daftarSubWilayah(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REGION.CREATE')
  @Post('sub-areas')
  @ApiOperation({ summary: 'Menambah dusun atau lingkungan' })
  buatSubWilayah(@Body() dto: BuatSubWilayahDto, @CurrentUser() user: AuthenticatedUser) {
    return this.unit.buatSubWilayah(requireSchema(user), dto, user.userId);
  }

  // --- RW dan RT ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REGION.READ')
  @Get('rw')
  @ApiOperation({ summary: 'Daftar RW' })
  daftarRw(@CurrentUser() user: AuthenticatedUser) {
    return this.unit.daftarRw(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REGION.CREATE')
  @Post('rw')
  @ApiOperation({ summary: 'Menambah RW' })
  buatRw(@Body() dto: BuatRwDto, @CurrentUser() user: AuthenticatedUser) {
    return this.unit.buatRw(requireSchema(user), dto, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REGION.READ')
  @Get('rt')
  @ApiOperation({ summary: 'Daftar RT' })
  daftarRt(@Query('rwId') rwId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.unit.daftarRt(requireSchema(user), rwId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REGION.CREATE')
  @Post('rt')
  @ApiOperation({ summary: 'Menambah RT' })
  buatRt(@Body() dto: BuatRtDto, @CurrentUser() user: AuthenticatedUser) {
    return this.unit.buatRt(requireSchema(user), dto, user.userId);
  }

  // --- Batas dan potensi ----------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REGION.READ')
  @Get('boundaries')
  @ApiOperation({ summary: 'Batas wilayah empat penjuru' })
  batas(@CurrentUser() user: AuthenticatedUser) {
    return this.unit.batas(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REGION.READ')
  @Get('potentials')
  @ApiOperation({
    summary: 'Potensi wilayah',
    description: 'Fitur CONFIGURABLE — harus diaktifkan penyewa lebih dahulu.',
  })
  potensi(@CurrentUser() user: AuthenticatedUser) {
    return this.unit.potensi(requireSchema(user));
  }

  // --- Domain ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_DOMAIN.READ')
  @Get('domains')
  @ApiOperation({ summary: 'Domain situs desa' })
  daftarDomain(@CurrentUser() user: AuthenticatedUser) {
    return this.unit.daftarDomain(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_DOMAIN.CREATE')
  @Post('domains')
  @ApiOperation({
    summary: 'Mendaftarkan domain',
    description:
      'Subdomain info-desa.id langsung terverifikasi. Domain sendiri memperoleh token dan ' +
      'berstatus PENDING sampai kepemilikannya dibuktikan — tanpa itu, siapa pun dapat ' +
      'mengarahkan domain orang lain ke situs desanya.',
  })
  daftarkanDomain(@Body() dto: DaftarDomainDto, @CurrentUser() user: AuthenticatedUser) {
    return this.unit.daftarkanDomain(requireSchema(user), dto, user.userId);
  }


  // --- Kependudukan ---------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_RESIDENT.READ')
  @Get('residents')
  @ApiOperation({
    summary: 'Daftar penduduk',
    description:
      'Cakupan ditegakkan pada kueri, bukan dengan menyaring hasil. Setiap pembacaan dicatat ' +
      'pada village_resident_access_log — pada kependudukan, penyalahgunaan berbentuk pembacaan.',
  })
  daftarPenduduk(
    @Query('q') q: string | undefined,
    @Query('rtId') rtId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.penduduk.daftar(requireSchema(user), { q, rtId }, this.cakupan(user), user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_RESIDENT.READ')
  @Get('residents/:id')
  @ApiOperation({ summary: 'Rincian satu penduduk' })
  detailPenduduk(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.penduduk.detail(requireSchema(user), id, this.cakupan(user), user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_RESIDENT.CREATE')
  @Post('residents')
  @ApiOperation({
    summary: 'Mendaftarkan penduduk',
    description:
      'NIK yang janggal DITANDAI, bukan ditolak. NIK yang tercetak keliru pada KTP sungguhan ' +
      'ada, dan menolaknya memaksa petugas mengarang NIK lain agar datanya dapat masuk.',
  })
  buatPenduduk(@Body() dto: BuatPendudukDto, @CurrentUser() user: AuthenticatedUser) {
    return this.penduduk.buat(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_RESIDENT.UPDATE')
  @Post('residents/:id/amend')
  @ApiOperation({
    summary: 'Menyunting data penduduk',
    description:
      'Wajib menyertakan alasan. Setiap medan yang berubah menghasilkan satu baris riwayat — ' +
      'pertanyaan "sejak kapan alamatnya begini, atas dasar surat apa" pasti muncul di kantor desa.',
  })
  suntingPenduduk(
    @Param('id') id: string,
    @Body() dto: SuntingPendudukDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.penduduk.sunting(
      requireSchema(user),
      id,
      dto.changes ?? {},
      {
        reason: dto.reason,
        documentReference: dto.documentReference,
        effectiveDate: dto.effectiveDate,
      },
      user,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_FAMILY.READ')
  @Get('families/:id/validate')
  @ApiOperation({ summary: 'Memeriksa susunan kartu keluarga' })
  periksaKeluarga(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.penduduk.periksaKeluarga(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_VITAL_EVENT.CREATE')
  @Post('vital-events')
  @ApiOperation({ summary: 'Melaporkan peristiwa kependudukan' })
  catatPeristiwa(@Body() dto: PeristiwaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.penduduk.catatPeristiwa(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_VITAL_EVENT.APPROVE')
  @Post('vital-events/:id/approve')
  @ApiOperation({
    summary: 'Menyetujui peristiwa kependudukan',
    description:
      'Persetujuan dan perubahan status penduduk terjadi dalam satu transaksi. Peristiwa yang ' +
      'disetujui tanpa status yang ikut berubah akan membuat penduduk yang sudah meninggal ' +
      'tetap tampak hidup pada daftar.',
  })
  setujuiPeristiwa(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.penduduk.setujuiPeristiwa(requireSchema(user), id, user);
  }

  // --- Penyiapan ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_UNIT.UPDATE')
  @Post('provision')
  @ApiOperation({
    summary: 'Menerapkan migrasi vertikal info-desa pada schema penyewa',
    description:
      'Idempoten. Migrasi yang sudah tercatat dilewati; isi yang berbeda dari yang tercatat ' +
      'ditolak, bukan diterapkan ulang.',
  })
  async provision(@CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    const hasil = await this.migrasi.applyTo(schema);
    return { schemaName: schema, ...hasil };
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_UNIT.READ')
  @Get('provision/status')
  @ApiOperation({ summary: 'Versi migrasi village yang terpasang' })
  async statusProvision(@CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return {
      schemaName: schema,
      provisioned: await this.migrasi.isProvisioned(schema),
      currentVersion: await this.migrasi.currentVersion(schema),
      latestVersion:
        this.migrasi.getManifest().migrations.at(-1)?.version ?? null,
    };
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [VillageController],
  providers: [VillageUnitService, VillageMigrationService, VillageResidentService],
  exports: [VillageUnitService, VillageMigrationService, VillageResidentService],
})
export class VillageModule {}
