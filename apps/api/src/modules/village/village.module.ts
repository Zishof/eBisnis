/**
 * Vertikal info-desa — Sistem Informasi Desa dan Kelurahan.
 *
 * Seluruh rute berawalan `/village`, seluruh hak akses berawalan `VILLAGE.`,
 * seluruh peristiwa berawalan `village.`. Batas ini ditegakkan uji
 * ketergantungan pada D-12, bukan hanya oleh kesepakatan.
 */

import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
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

// --- Controller ---------------------------------------------------------------

@ApiTags('village')
@Controller('village')
export class VillageController {
  constructor(
    private readonly unit: VillageUnitService,
    private readonly migrasi: VillageMigrationService,
  ) {}

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
  providers: [VillageUnitService, VillageMigrationService],
  exports: [VillageUnitService, VillageMigrationService],
})
export class VillageModule {}
