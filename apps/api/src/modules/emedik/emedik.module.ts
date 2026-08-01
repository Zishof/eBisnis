/**
 * Modul eMedik — vertical kesehatan.
 *
 * Nama direktori `emedik/`, bukan `health/`, dan itu keputusan sadar.
 * `modules/health/` sudah dipakai pemeriksa ketersediaan aplikasi (liveness
 * probe) milik Core. Rutenya tidak bertabrakan — `main.ts` mengecualikan
 * `health` dari awalan global — tetapi nama direktorinya bertabrakan, dan
 * CODEOWNERS akan memberikan kepemilikan pemeriksa platform kepada tim
 * kesehatan.
 *
 * Rute API tetap `/api/v1/health/**` sesuai perintah §6.
 * Lihat docs/integration-requests/health/001-health-namespace-collision.md.
 */

import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthFacilityService } from './health-facility.service';
import { HealthPatientService } from './health-patient.service';
import { HealthVisitService } from './health-visit.service';
import { HealthPharmacyService } from './health-pharmacy.service';
import { HealthLabService } from './health-lab.service';
import { HealthInpatientService } from './health-inpatient.service';
import { HealthAcuteService } from './health-acute.service';
import { HealthCommunityService } from './health-community.service';
import { HealthHimService } from './health-him.service';
import { HealthMasterDataService } from './health-master-data.service';
import { HealthAccountingService } from './health-accounting.service';
import { HealthTariffService } from './health-tariff.service';
import { HealthFeeService } from './health-fee.service';
import { HealthSettlementService } from './health-settlement.service';
import { HealthFeeContractService } from './health-fee-contract.service';
import { HealthClaimService } from './health-claim.service';
import { HealthDeviceService } from './health-device.service';
import { HealthDeviceMaintenanceService } from './health-device-maintenance.service';
import { HealthInvestorService } from './health-investor.service';
import { HealthDeviceAdapterService } from './health-device-adapter.service';
import { HealthSatusehatService } from './health-satusehat.service';
import { HealthBpjsService } from './health-bpjs.service';
import { HealthKfaService } from './health-kfa.service';
import { HealthPortalService } from './health-portal.service';
import { HealthSampleService } from './health-sample.service';
import { HealthSecurityService } from './health-security.service';
import { HealthClinicalController } from './health-clinical.controller';
import { HealthPharmacyController } from './health-pharmacy.controller';
import { HealthLabController } from './health-lab.controller';
import { HealthInpatientController } from './health-inpatient.controller';
import { HealthAcuteController } from './health-acute.controller';
import { HealthCommunityController } from './health-community.controller';
import { HealthHimController } from './health-him.controller';
import { HealthMasterDataController } from './health-master-data.controller';
import { HealthAccountingController } from './health-accounting.controller';
import { HealthTariffController } from './health-tariff.controller';
import { HealthFeeController } from './health-fee.controller';
import { HealthSettlementController } from './health-settlement.controller';
import { HealthFeeContractController } from './health-fee-contract.controller';
import { HealthClaimController } from './health-claim.controller';
import { HealthDeviceController } from './health-device.controller';
import { HealthDeviceMaintenanceController } from './health-device-maintenance.controller';
import { HealthInvestorController } from './health-investor.controller';
import { HealthDeviceAdapterController } from './health-device-adapter.controller';
import { HealthSatusehatController } from './health-satusehat.controller';
import { HealthBpjsController } from './health-bpjs.controller';
import { HealthKfaController } from './health-kfa.controller';
import {
  HealthPortalController,
  HealthPortalAdminController,
  HealthPublicWebController,
} from './health-portal.controller';
import { HealthSampleController } from './health-sample.controller';
import { HealthSecurityController } from './health-security.controller';
import {
  CoreAuditAdapter,
  CoreIdentityAdapter,
  CoreNotificationAdapter,
} from './adapters/core.adapters';
import { CoreInventoryAdapter } from './adapters/inventory.adapter';
import { AUDIT_PORT, IDENTITY_PORT, INVENTORY_PORT, NOTIFICATION_PORT } from './ports';
import { HEALTH_MENU, HEALTH_ROLES, HEALTH_SOD_RULES } from './health-catalog';
import { JENJANG_BAWAAN, hitungTarifHarian, periksaJenjang } from './health-billing';

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

class BuatFasilitasDto {
  @ApiProperty({ example: 'CLINIC' })
  @IsString()
  @MaxLength(48)
  facilityTypeCode!: string;

  @ApiProperty({ example: 'KLN-01' })
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  code!: string;

  @ApiProperty({ example: 'Klinik Mitra Sehat' })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  legalEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentFacilityId?: string;

  @ApiPropertyOptional({
    enum: ['A', 'B', 'C', 'D', 'D_PRATAMA'],
    description: 'Hanya berlaku bagi fasilitas berjenis rumah sakit.',
  })
  @IsOptional()
  @IsIn(['A', 'B', 'C', 'D', 'D_PRATAMA'])
  hospitalClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(96)
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Asia/Jakarta' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'mitrasehat',
    description: 'Subdomain pada emedik.id. Huruf kecil, angka, dan tanda hubung.',
  })
  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9-]{1,62}$/, {
    message: 'Subdomain hanya boleh berisi huruf kecil, angka, dan tanda hubung.',
  })
  subdomain?: string;
}

class BuatUnitDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ example: 'POLYCLINIC' })
  @IsString()
  @MaxLength(32)
  unitType!: string;

  @ApiProperty({ example: 'POLI-UMUM' })
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiProperty({ example: 'Poliklinik Umum' })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptsOutpatient?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptsInpatient?: boolean;
}

class BuatPemberiLayananDto {
  @ApiProperty({ example: 'DR-001' })
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiProperty({ example: 'dr. Siti Aminah' })
  @IsString()
  @MaxLength(180)
  fullName!: string;

  @ApiProperty({ example: 'DOCTOR' })
  @IsString()
  @MaxLength(32)
  providerType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryFacilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userSubjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Wajib bagi dokter, dokter gigi, perawat, bidan, dan apoteker.' })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  practiceLicenseNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  practiceLicenseValidUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  specialtyCode?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik')
@Controller('health')
export class HealthController {
  constructor(
    private readonly fasilitas: HealthFacilityService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private async subjek(schema: string, user: AuthenticatedUser): Promise<string> {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Fasilitas -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FACILITY.READ')
  @Get('facilities')
  @ApiOperation({ summary: 'Daftar fasilitas kesehatan' })
  daftarFasilitas(@CurrentUser() user: AuthenticatedUser) {
    return this.fasilitas.daftarFasilitas(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FACILITY.CREATE')
  @Post('facilities')
  @ApiOperation({
    summary: 'Mendaftarkan fasilitas',
    description:
      'Kelas rumah sakit ditolak pada fasilitas yang bukan rumah sakit — data yang tampak sah ' +
      'tetapi tidak berarti kelak dipakai laporan yang menghitung rumah sakit menurut kelasnya.',
  })
  async buatFasilitas(@Body() dto: BuatFasilitasDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.fasilitas.buatFasilitas(schema, dto, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FACILITY.READ')
  @Get('facilities/:id')
  @ApiOperation({ summary: 'Satu fasilitas beserta kemampuan jenisnya' })
  ambilFasilitas(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.fasilitas.ambilFasilitas(requireSchema(user), id);
  }

  // --- Unit layanan ----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SERVICE_UNIT.READ')
  @Get('facilities/:id/units')
  @ApiOperation({ summary: 'Unit layanan pada satu fasilitas' })
  daftarUnit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.fasilitas.daftarUnit(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SERVICE_UNIT.CREATE')
  @Post('service-units')
  @ApiOperation({
    summary: 'Membuat unit layanan',
    description:
      'Menolak unit yang tidak masuk akal bagi jenis fasilitasnya. Bangsal di bawah Posyandu ' +
      'akan menghasilkan tempat tidur yang tidak pernah dapat diisi, dan laporan hunian yang ' +
      'menghitungnya akan salah selamanya.',
  })
  async buatUnit(@Body() dto: BuatUnitDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.fasilitas.buatUnit(schema, dto, await this.subjek(schema, user));
  }

  // --- Pemberi layanan -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PROVIDER.READ')
  @Get('providers')
  @ApiOperation({ summary: 'Daftar pemberi layanan' })
  daftarPemberiLayanan(
    @Query('facilityId') facilityId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fasilitas.daftarPemberiLayanan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PROVIDER.CREATE')
  @Post('providers')
  @ApiOperation({
    summary: 'Mendaftarkan pemberi layanan',
    description:
      'Izin praktik wajib bagi dokter, dokter gigi, perawat, bidan, dan apoteker; tidak bagi ' +
      'kader — Posyandu dijalankan kader, dan menuntutnya akan menghentikan pendaftaran mereka.',
  })
  async buatPemberiLayanan(
    @Body() dto: BuatPemberiLayananDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.fasilitas.buatPemberiLayanan(schema, dto, await this.subjek(schema, user));
  }

  // --- Jenjang tarif ---------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BILLING_TIER.READ')
  @Get('billing/tiers')
  @ApiOperation({
    summary: 'Jenjang tarif pendaftaran pasien',
    description:
      'Marginal bertingkat: setiap jenjang menagih hanya bagian yang jatuh di dalamnya. ' +
      'Jenjang tertinggi bernilai null karena spesifikasi menyebutnya dinegosiasikan — ' +
      'menaruh angka di sana berarti menagihkan tarif yang tidak pernah disepakati.',
  })
  jenjangTarif() {
    return { tiers: JENJANG_BAWAAN, health: periksaJenjang(JENJANG_BAWAAN) };
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BILLING_TIER.READ')
  @Get('billing/simulate')
  @ApiOperation({ summary: 'Simulasi biaya harian untuk sejumlah pendaftaran' })
  simulasiTarif(@Query('registrations') registrations: string) {
    return hitungTarifHarian(Number(registrations));
  }

  // --- Katalog ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH.READ')
  @Get('catalog')
  @ApiOperation({
    summary: 'Katalog menu, peran, dan aturan pemisahan wewenang kesehatan',
    description:
      'Katalog modular sesuai panduan koordinasi §9. Registri global mengimpornya lewat kontrak ' +
      'plugin yang dikelola Core; kontrak itu belum ada dan permintaannya sudah dicatat.',
  })
  katalog() {
    return {
      menus: HEALTH_MENU,
      roles: HEALTH_ROLES,
      segregationOfDuty: HEALTH_SOD_RULES,
    };
  }
}

// --- Module ------------------------------------------------------------------

@Module({
  imports: [InfrastructureModule, AuthModule],
  controllers: [HealthController, HealthClinicalController, HealthPharmacyController, HealthLabController, HealthInpatientController, HealthAcuteController, HealthCommunityController, HealthHimController, HealthMasterDataController, HealthAccountingController, HealthTariffController, HealthFeeController, HealthSettlementController, HealthFeeContractController, HealthClaimController, HealthDeviceController, HealthDeviceMaintenanceController, HealthInvestorController, HealthDeviceAdapterController, HealthSatusehatController, HealthBpjsController, HealthKfaController, HealthPortalController, HealthPortalAdminController, HealthPublicWebController, HealthSampleController, HealthSecurityController],
  providers: [
    HealthFacilityService,
    HealthPatientService,
    HealthVisitService,
    HealthPharmacyService,
    HealthLabService,
    HealthInpatientService,
    HealthAcuteService,
    HealthCommunityService,
    HealthHimService,
    HealthMasterDataService,
    HealthAccountingService,
    HealthTariffService,
    HealthFeeService,
    HealthSettlementService,
    HealthFeeContractService,
    HealthClaimService,
    HealthDeviceService,
    HealthDeviceMaintenanceService,
    HealthInvestorService,
    HealthDeviceAdapterService,
    HealthSatusehatService,
    HealthBpjsService,
    HealthKfaService,
    HealthPortalService,
    HealthSampleService,
    HealthSecurityService,
    CoreIdentityAdapter,
    CoreAuditAdapter,
    CoreNotificationAdapter,
    CoreInventoryAdapter,
    // Port disediakan lewat token supaya layanan kesehatan bergantung pada
    // antarmuka, bukan pada adapter. Mengganti adapter kelak — misalnya ketika
    // Core menyediakan layanan resmi — tidak menyentuh satu pun layanan.
    { provide: IDENTITY_PORT, useExisting: CoreIdentityAdapter },
    { provide: AUDIT_PORT, useExisting: CoreAuditAdapter },
    { provide: NOTIFICATION_PORT, useExisting: CoreNotificationAdapter },
    { provide: INVENTORY_PORT, useExisting: CoreInventoryAdapter },
  ],
  exports: [
    HealthFacilityService,
    HealthPatientService,
    HealthVisitService,
    HealthPharmacyService,
    HealthLabService,
    HealthInpatientService,
    HealthAcuteService,
    HealthCommunityService,
    HealthHimService,
    HealthMasterDataService,
    HealthAccountingService,
    HealthTariffService,
    HealthFeeService,
    HealthSettlementService,
    HealthFeeContractService,
    HealthClaimService,
    HealthDeviceService,
    HealthDeviceMaintenanceService,
    HealthInvestorService,
    HealthDeviceAdapterService,
    HealthSatusehatService,
    HealthBpjsService,
    HealthKfaService,
    HealthPortalService,
    HealthSampleService,
    HealthSecurityService,
    IDENTITY_PORT,
    AUDIT_PORT,
    NOTIFICATION_PORT,
    INVENTORY_PORT,
  ],
})
export class EmedikModule {}
