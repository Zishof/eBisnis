/**
 * Vertikal info-desa — Sistem Informasi Desa dan Kelurahan.
 *
 * Seluruh rute berawalan `/village`, seluruh hak akses berawalan `VILLAGE.`,
 * seluruh peristiwa berawalan `village.`. Batas ini ditegakkan uji
 * ketergantungan pada D-12, bukan hanya oleh kesepakatan.
 */

import { Body, Controller, Get, Headers, Module, Param, Post, Query } from '@nestjs/common';
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
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { VillageMigrationService } from './village-migration.service';
import { VillageUnitService } from './village-unit.service';
import { VillageResidentService } from './village-resident.service';
import { VillageScopeService } from './village-scope.service';
import { VillageWorkflowService } from './village-workflow.service';
import { VillageRequestService } from './village-request.service';
import { VillageParticipationService } from './village-participation.service';
import { VillageBudgetService } from './village-budget.service';
import { VillageAssetService } from './village-asset.service';
import { VillageAidService } from './village-aid.service';
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


class AlasanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

const JENIS_CAKUPAN = [
  'VILLAGE_UNIT',
  'VILLAGE_SUB_AREA',
  'VILLAGE_RW',
  'VILLAGE_RT',
  'VILLAGE_SELF',
  'VILLAGE_AGGREGATE_ONLY',
  'VILLAGE_NONE',
] as const;

class TugaskanCakupanDto {
  @ApiProperty()
  @IsUUID()
  userSubjectId!: string;

  @ApiProperty({ enum: JENIS_CAKUPAN })
  @IsIn(JENIS_CAKUPAN as unknown as string[])
  scopeType!: (typeof JENIS_CAKUPAN)[number];

  @ApiPropertyOptional({ description: 'Id dusun, RW, RT, atau penduduk — sesuai scopeType.' })
  @IsOptional()
  @IsUUID()
  scopeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}


class AjukanLayananDto {
  @ApiProperty({ example: 'SKD', description: 'Kode jenis layanan.' })
  @IsString()
  @MaxLength(48)
  serviceCode!: string;

  @ApiPropertyOptional({ description: 'Penduduk terdaftar, bila pemohonnya warga desa ini.' })
  @IsOptional()
  @IsUUID()
  residentId?: string;

  @ApiProperty({ example: 'Ahmad Fauzi' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  applicantName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  applicantNik?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  applicantPhone?: string;

  @ApiPropertyOptional({ description: 'Keperluan surat.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  purpose?: string;
}

class PutusanDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT', 'REQUEST_CHANGES'] })
  @IsIn(['APPROVE', 'REJECT', 'REQUEST_CHANGES'])
  action!: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

  @ApiPropertyOptional({
    description: 'WAJIB untuk REJECT dan REQUEST_CHANGES. Dibaca pemohon.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

class TerbitkanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  signedByOfficerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;
}

class AmbilAntreanDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @MaxLength(8)
  counterCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requestId?: string;
}


class AdukanDto {
  @ApiPropertyOptional({ example: 'PUNGLI' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  categoryCode?: string;

  @ApiProperty({
    enum: ['TERBUKA', 'ANONIM'],
    description:
      'ANONIM berarti identitas pelapor TIDAK DISIMPAN sama sekali — bukan disimpan lalu ' +
      'disembunyikan. Kategori yang menyangkut aparatur dipaksa anonim.',
  })
  @IsIn(['TERBUKA', 'ANONIM'])
  mode!: 'TERBUKA' | 'ANONIM';

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  rtId?: string;

  @ApiPropertyOptional({ description: 'Aparatur yang diadukan, bila ada.' })
  @IsOptional()
  @IsUUID()
  concernsOfficerId?: string;

  @ApiPropertyOptional({ description: 'Diabaikan bila mode ANONIM.' })
  @IsOptional()
  @IsUUID()
  reporterResidentId?: string;

  @ApiPropertyOptional({ description: 'Diabaikan bila mode ANONIM.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reporterName?: string;

  @ApiPropertyOptional({ description: 'Diabaikan bila mode ANONIM.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  reporterPhone?: string;
}

class TugaskanPengaduanDto {
  @ApiProperty()
  @IsUUID()
  officerId!: string;
}

const STATUS_ADUAN = [
  'DITERIMA',
  'DITUGASKAN',
  'DITINDAKLANJUTI',
  'SELESAI',
  'DITUTUP',
  'BUKAN_KEWENANGAN',
] as const;

class TindakLanjutDto {
  @ApiProperty({ enum: STATUS_ADUAN })
  @IsIn(STATUS_ADUAN as unknown as string[])
  status!: (typeof STATUS_ADUAN)[number];

  @ApiProperty({ description: 'WAJIB untuk penutupan dan penghentian.' })
  @IsString()
  @MaxLength(2000)
  note!: string;

  @ApiPropertyOptional({ description: 'Bawaannya terlihat pelapor.' })
  @IsOptional()
  @IsBoolean()
  visibleToReporter?: boolean;
}

class BukaMusrenbangDto {
  @ApiProperty({ example: 2027 })
  @IsInt()
  @Min(2000)
  fiscalYear!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  heldAt?: string;

  @ApiPropertyOptional({ description: 'Kuorum minimum. Ketentuannya berbeda antar daerah.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quorumMinimum?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetCeiling?: number;
}

const STATUS_USULAN_DTO = ['DIBAHAS', 'DISEPAKATI', 'DITUNDA', 'DITOLAK', 'MASUK_RKP'] as const;

class PutusanUsulanDto {
  @ApiProperty({ enum: STATUS_USULAN_DTO })
  @IsIn(STATUS_USULAN_DTO as unknown as string[])
  status!: (typeof STATUS_USULAN_DTO)[number];

  @ApiPropertyOptional({ description: 'WAJIB untuk DITOLAK dan DITUNDA.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

class AspirasiDto {
  @ApiProperty({ enum: ['TERBUKA', 'ANONIM'] })
  @IsIn(['TERBUKA', 'ANONIM'])
  mode!: 'TERBUKA' | 'ANONIM';

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reporterResidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reporterName?: string;
}


class SusunRkpDto {
  @ApiProperty({ example: 2027 })
  @IsInt()
  @Min(2000)
  fiscalYear!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ description: 'RPJM Desa induknya. Tahun RKP wajib di dalam periodenya.' })
  @IsOptional()
  @IsUUID()
  rpjmId?: string;
}

class TarikUsulanDto {
  @ApiProperty()
  @IsUUID()
  proposalId!: string;

  @ApiProperty({ example: '2.1.03' })
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  sector?: string;
}

class SusunApbdesDto {
  @ApiProperty({ example: 2027 })
  @IsInt()
  @Min(2000)
  fiscalYear!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  rkpId?: string;
}

const JENIS_ANGGARAN = [
  'PENDAPATAN',
  'BELANJA',
  'PEMBIAYAAN_PENERIMAAN',
  'PEMBIAYAAN_PENGELUARAN',
] as const;

class TetapkanPaguDto {
  @ApiProperty({ example: '4.1.01' })
  @IsString()
  @MaxLength(48)
  accountCode!: string;

  @ApiProperty({ example: 'Dana Desa' })
  @IsString()
  @MaxLength(300)
  accountName!: string;

  @ApiProperty({ enum: JENIS_ANGGARAN })
  @IsIn(JENIS_ANGGARAN as unknown as string[])
  budgetType!: (typeof JENIS_ANGGARAN)[number];

  @ApiProperty({ example: 500000000 })
  @IsNumber()
  @Min(0)
  ceilingAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  activityId?: string;
}

class TetapkanApbdesDto {
  @ApiProperty({
    example: 'Perdes Nomor 3 Tahun 2027',
    description: 'WAJIB. Anggaran tanpa dasar hukum bukan anggaran yang dapat dipertanggungjawabkan.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  regulationNumber!: string;
}

class IkatDto {
  @ApiProperty()
  @IsUUID()
  budgetLineId!: string;

  @ApiProperty({ example: 25000000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  counterparty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  documentReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  transactionDate?: string;
}

class RealisasiDto {
  @ApiProperty()
  @IsUUID()
  budgetLineId!: string;

  @ApiProperty({ description: 'Ikatan yang direalisasi. WAJIB — realisasi tanpa ikatan tidak berdasar.' })
  @IsUUID()
  parentTransactionId!: string;

  @ApiProperty({ example: 25000000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  documentReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  transactionDate?: string;
}


const GOLONGAN = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const KONDISI = ['BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT'] as const;
const KEPEMILIKAN = ['DESA', 'DAERAH', 'PIHAK_KETIGA'] as const;

class CatatAsetDto {
  @ApiProperty({ example: 'AST-B-0007' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  registerNumber!: string;

  @ApiProperty({ example: 'Proyektor Epson EB-X06' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  name!: string;

  @ApiProperty({ enum: GOLONGAN, description: 'Golongan KIB: A tanah, B peralatan dan mesin, C gedung, D jalan/irigasi, E aset tetap lainnya, F konstruksi dalam pengerjaan.' })
  @IsIn(GOLONGAN as unknown as string[])
  kibGroup!: string;

  @ApiPropertyOptional({ enum: KEPEMILIKAN, description: 'Kelurahan tidak dapat mencatat DESA: ia perangkat daerah dan tidak memiliki kekayaan sendiri.' })
  @IsOptional()
  @IsIn(KEPEMILIKAN as unknown as string[])
  ownership?: (typeof KEPEMILIKAN)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2027-02-14' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  acquisitionDate?: string;

  @ApiPropertyOptional({ example: 'PEMBELIAN' })
  @IsOptional()
  @IsIn(['PEMBELIAN', 'HIBAH', 'SWADAYA', 'WARISAN_DESA', 'PELIMPAHAN', 'LAINNYA'])
  acquisitionSource?: string;

  @ApiPropertyOptional({ example: 7500000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  acquisitionValue?: number;

  @ApiPropertyOptional({ description: 'Transaksi APBDes yang membiayainya. Uang desa yang berubah menjadi barang tetapi barangnya tidak masuk register adalah temuan pemeriksaan yang paling sering muncul.' })
  @IsOptional()
  @IsUUID()
  budgetTransactionId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ example: 'unit' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationNote?: string;

  @ApiPropertyOptional({ enum: KONDISI })
  @IsOptional()
  @IsIn(KONDISI as unknown as string[])
  condition?: (typeof KONDISI)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLendable?: boolean;
}

class PinjamAsetDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  borrowerName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  borrowerResidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  borrowerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  borrowerInstitution?: string;

  @ApiProperty({ example: 'Rapat RT 03 di balai dusun' })
  @IsString()
  @MinLength(3)
  purpose!: string;

  @ApiPropertyOptional({ example: '2027-03-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  borrowedAt?: string;

  @ApiProperty({
    example: '2027-03-05',
    description: 'WAJIB. Peminjaman tanpa batas waktu bukan peminjaman melainkan pemberian.',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueAt!: string;
}

class KembalikanAsetDto {
  @ApiPropertyOptional({ enum: KONDISI })
  @IsOptional()
  @IsIn(KONDISI as unknown as string[])
  condition?: (typeof KONDISI)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  returnedAt?: string;
}

class PemeliharaanDto {
  @ApiPropertyOptional({ enum: ['PERBAIKAN', 'PERAWATAN', 'KALIBRASI', 'PENGGANTIAN_SUKU_CADANG'] })
  @IsOptional()
  @IsIn(['PERBAIKAN', 'PERAWATAN', 'KALIBRASI', 'PENGGANTIAN_SUKU_CADANG'])
  maintenanceType?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  performedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ enum: KONDISI })
  @IsOptional()
  @IsIn(KONDISI as unknown as string[])
  conditionAfter?: (typeof KONDISI)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  budgetTransactionId?: string;
}

class HapusAsetDto {
  @ApiProperty({ enum: ['DIJUAL', 'DIHIBAHKAN', 'DIMUSNAHKAN', 'HILANG', 'TERTIMPA_BENCANA'] })
  @IsIn(['DIJUAL', 'DIHIBAHKAN', 'DIMUSNAHKAN', 'HILANG', 'TERTIMPA_BENCANA'])
  method!: 'DIJUAL' | 'DIHIBAHKAN' | 'DIMUSNAHKAN' | 'HILANG' | 'TERTIMPA_BENCANA';

  @ApiProperty({
    example: 'SK Kepala Desa Nomor 9 Tahun 2027',
    description: 'WAJIB. Aset yang lenyap dari register tanpa dasar keputusan adalah aset yang hilang, bukan aset yang dihapus.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  decisionNumber!: string;

  @ApiProperty({ example: '2027-06-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  decisionDate!: string;

  @ApiProperty({ description: 'Sekurang-kurangnya sepuluh huruf.' })
  @IsString()
  @MinLength(10)
  reason!: string;

  @ApiPropertyOptional({ description: 'Wajib bila dijual. Hasil penjualan aset desa adalah pendapatan desa.' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  disposalValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string;
}

class RencanaPengadaanDto {
  @ApiProperty({ example: 2027 })
  @IsInt()
  @Min(2000)
  fiscalYear!: number;

  @ApiProperty({ description: 'WAJIB. Pengadaan tanpa pagu akan ketahuan saat pembayarannya ditolak, ketika barangnya sudah telanjur dipesan.' })
  @IsUUID()
  budgetLineId!: string;

  @ApiProperty({ example: 'PBJ-2027-014' })
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  name!: string;

  @ApiProperty({ example: 45000000 })
  @IsNumber()
  @IsPositive()
  estimatedValue!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedQuarter?: number;

  @ApiPropertyOptional({ description: 'Batas swakelola. Berbeda antar kabupaten, karena itu dapat diatur.' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  swakelolaThreshold?: number;
}

class ProgramBantuanDto {
  @ApiProperty({ example: 'BLT-DD-2027' })
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiProperty({ example: 'Bantuan Langsung Tunai Dana Desa 2027' })
  @IsString()
  @MaxLength(300)
  name!: string;

  @ApiProperty({ example: 'BLT', description: 'Jenis inilah yang memutuskan apakah dua bantuan dianggap sejenis.' })
  @IsString()
  @MaxLength(48)
  aidCategory!: string;

  @ApiProperty({ example: 2027 })
  @IsInt()
  @Min(2000)
  fiscalYear!: number;

  @ApiProperty({ example: '2027-01-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart!: string;

  @ApiProperty({ example: '2027-12-31' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['UANG', 'BARANG', 'JASA'] })
  @IsOptional()
  @IsIn(['UANG', 'BARANG', 'JASA'])
  aidForm?: 'UANG' | 'BARANG' | 'JASA';

  @ApiPropertyOptional({ example: 'APBDES' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  fundingSource?: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quota?: number;

  @ApiPropertyOptional({ example: 300000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amountPerBeneficiary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  budgetLineId?: string;

  @ApiPropertyOptional({
    description:
      'Program yang memang dirancang menambah bantuan lain. Bawaannya tidak: bantuan yang ' +
      'diam-diam berganda bagi sebagian keluarga adalah cara pemerintah desa kehilangan ' +
      'kepercayaan warganya.',
  })
  @IsOptional()
  @IsBoolean()
  allowStacking?: boolean;
}

class KriteriaDto {
  @ApiProperty({ example: 'Kriteria BLT Dana Desa 2027' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    description:
      'Pohon kondisi terstruktur. TIDAK PERNAH dieksekusi: setiap daun wajib menunjuk satu ruas ' +
      'dari daftar tertutup, dengan satu pembanding dari daftar tertutup lainnya. Jenis simpul: ' +
      'SEMUA, SALAH_SATU, TIDAK, BANDING.',
    example: {
      jenis: 'SEMUA',
      anak: [
        { jenis: 'BANDING', ruas: 'penghasilanBulanan', pembanding: 'MAKSIMAL', nilai: 1500000 },
        { jenis: 'BANDING', ruas: 'memilikiKendaraanBermotor', pembanding: 'SAMA', nilai: false },
      ],
    },
  })
  criteria!: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

class SaringDto {
  @ApiPropertyOptional({
    enum: ['ATURAN', 'AI', 'MANUAL'],
    description:
      'Asal usulan. Yang berasal dari AI tetap berhenti sebagai calon; penetapannya oleh manusia.',
  })
  @IsOptional()
  @IsIn(['ATURAN', 'AI', 'MANUAL'])
  source?: 'ATURAN' | 'AI' | 'MANUAL';

  @ApiPropertyOptional({ example: 2027 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  surveyYear?: number;
}

class VerifikasiCalonDto {
  @ApiProperty({ enum: ['LAYAK', 'TIDAK_LAYAK'] })
  @IsIn(['LAYAK', 'TIDAK_LAYAK'])
  hasil!: 'LAYAK' | 'TIDAK_LAYAK';

  @ApiProperty({
    description:
      'Sekurang-kurangnya sepuluh huruf. Kunjungan yang tidak meninggalkan catatan tidak dapat ' +
      'dibedakan dari kunjungan yang tidak pernah terjadi.',
  })
  @IsString()
  @MinLength(10)
  note!: string;
}

class TetapkanPenerimaDto {
  @ApiProperty({
    description:
      'Sekurang-kurangnya lima belas huruf. Warga yang tidak menerima bantuan berhak mendapat ' +
      'jawaban dari seseorang.',
  })
  @IsString()
  @MinLength(15)
  decisionBasis!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  decisionNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  entitlementAmount?: number;
}

class PenyaluranDto {
  @ApiProperty()
  @IsUUID()
  beneficiaryId!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  installmentNo?: number;

  @ApiProperty({ example: 300000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  distributedAt?: string;

  @ApiPropertyOptional({ enum: ['PENERIMA', 'KUASA'] })
  @IsOptional()
  @IsIn(['PENERIMA', 'KUASA'])
  receivedBy?: 'PENERIMA' | 'KUASA';

  @ApiPropertyOptional({ description: 'Wajib bila diwakilkan.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  proxyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  proxyRelation?: string;

  @ApiPropertyOptional({ description: 'Wajib bila bantuannya berbentuk uang.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  receiptReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

class PendataanKeluargaDto {
  @ApiProperty()
  @IsUUID()
  familyId!: string;

  @ApiProperty({ example: 2027 })
  @IsInt()
  @Min(2000)
  surveyYear!: number;

  @ApiProperty({
    example: '2027-01-18',
    description:
      'Tanggal kunjungan. Penetapan bantuan atas data pendataan tiga tahun lalu adalah penetapan ' +
      'atas desa yang sudah tidak ada.',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  surveyedAt!: string;

  @ApiPropertyOptional({ example: 900000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyIncome?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  dependentCount?: number;

  @ApiPropertyOptional({ enum: ['MILIK', 'SEWA', 'MENUMPANG', 'DINAS', 'LAINNYA'] })
  @IsOptional()
  @IsIn(['MILIK', 'SEWA', 'MENUMPANG', 'DINAS', 'LAINNYA'])
  houseStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  floorType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  floorAreaM2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  waterSource?: string;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @IsInt()
  @Min(0)
  electricityVa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasMotorVehicle?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasPregnantMember?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasToddler?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDtksRegistered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

// --- Controller ---------------------------------------------------------------

@ApiTags('village')
@Controller('village')
export class VillageController {
  constructor(
    private readonly unit: VillageUnitService,
    private readonly migrasi: VillageMigrationService,
    private readonly penduduk: VillageResidentService,
    private readonly lingkup: VillageScopeService,
    private readonly permohonan: VillageRequestService,
    private readonly partisipasi: VillageParticipationService,
    private readonly anggaran: VillageBudgetService,
    private readonly aset: VillageAssetService,
    private readonly bantuan: VillageAidService,
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
  async daftarPenduduk(
    @Query('q') q: string | undefined,
    @Query('rtId') rtId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const cakupan = await this.lingkup.cakupanUntuk(schema, user);
    const rows = await this.penduduk.daftar(schema, { q, rtId }, cakupan, user);
    // Keterangan cakupan ikut dikembalikan. Pengguna yang tidak melihat data
    // perlu tahu sebabnya — "tidak ada data" dan "Anda tidak berwenang" adalah
    // dua hal yang sangat berbeda, dan menyamakannya membuat petugas mengira
    // sistemnya rusak.
    return { scope: { level: cakupan.level, description: cakupan.keterangan }, rows };
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_RESIDENT.READ')
  @Get('residents/:id')
  @ApiOperation({ summary: 'Rincian satu penduduk' })
  async detailPenduduk(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.penduduk.detail(schema, id, await this.lingkup.cakupanUntuk(schema, user), user);
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


  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_RESIDENT.READ')
  @Get('my-scope')
  @ApiOperation({
    summary: 'Cakupan wilayah saya',
    description:
      'Menerangkan sejauh mana pengguna ini melihat data kependudukan, dan dari mana cakupan itu ' +
      'berasal. Bawaannya menutup: cakupan yang tidak dapat ditentukan berarti NONE, bukan UNIT.',
  })
  async cakupanSaya(@CurrentUser() user: AuthenticatedUser) {
    const c = await this.lingkup.cakupanUntuk(requireSchema(user), user);
    return {
      level: c.level,
      source: c.sumber,
      description: c.keterangan,
      subAreaId: c.subAreaId,
      rwId: c.rwId,
      rtId: c.rtId,
    };
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_OFFICER.UPDATE')
  @Post('scopes')
  @ApiOperation({
    summary: 'Menugaskan cakupan wilayah kepada pengguna',
    description: 'Penugasan yang sama diperbarui, bukan digandakan.',
  })
  tugaskanCakupan(@Body() dto: TugaskanCakupanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lingkup.tugaskan(requireSchema(user), dto, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_OFFICER.UPDATE')
  @Post('scopes/:id/revoke')
  @ApiOperation({
    summary: 'Mencabut penugasan cakupan',
    description: 'Dicabut, bukan dihapus — riwayatnya bagian dari audit.',
  })
  cabutCakupan(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lingkup.cabut(requireSchema(user), id, dto.reason ?? 'Dicabut', user.userId);
  }


  // --- Layanan warga --------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_SERVICE_REQUEST.CREATE')
  @Post('requests')
  @ApiOperation({
    summary: 'Mengajukan permohonan layanan',
    description:
      'Cuplikan definisi alur diambil saat pengajuan. Bila katalog diubah esok hari, permohonan ' +
      'ini tetap memakai aturan yang berlaku saat ia masuk — warga yang mengajukan surat pada ' +
      'hari Senin tidak boleh tiba-tiba dituntut melengkapi berkas yang baru diwajibkan Rabu.',
  })
  ajukan(@Body() dto: AjukanLayananDto, @CurrentUser() user: AuthenticatedUser) {
    return this.permohonan.ajukan(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_SERVICE_REQUEST.UPDATE')
  @Post('requests/:id/verify')
  @ApiOperation({
    summary: 'Memverifikasi kelengkapan berkas',
    description:
      'Bila lengkap, janji layanan mulai berjalan DARI SINI — bukan sejak permohonan masuk. ' +
      'Bila kurang, permohonan dikembalikan beserta daftar berkas yang masih dibutuhkan.',
  })
  verifikasi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.permohonan.verifikasiBerkas(requireSchema(user), id, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_SERVICE_REQUEST.SUBMIT')
  @Post('requests/:id/submit-approval')
  @ApiOperation({ summary: 'Meneruskan permohonan untuk persetujuan' })
  teruskan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.permohonan.mulaiPersetujuan(requireSchema(user), id, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_SERVICE_REQUEST.APPROVE')
  @Post('requests/:id/decide')
  @ApiOperation({
    summary: 'Menyetujui, menolak, atau meminta perbaikan',
    description:
      'Pemohon tidak dapat memutuskan permohonannya sendiri. Penolakan dan permintaan perbaikan ' +
      'wajib beralasan — permohonan yang berhenti tanpa kabar adalah keluhan nomor satu ' +
      'pelayanan publik.',
  })
  putuskan(
    @Param('id') id: string,
    @Body() dto: PutusanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permohonan.putuskan(requireSchema(user), id, dto.action, dto.reason, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_SERVICE_REQUEST.PRINT')
  @Post('requests/:id/issue')
  @ApiOperation({
    summary: 'Menerbitkan surat',
    description:
      'Nomor surat diambil di dalam transaksi yang sama dengan penyimpanannya, dan keunikannya ' +
      'ditegakkan indeks unik — dua petugas yang menerbitkan pada milidetik yang sama tidak ' +
      'dapat memperoleh nomor yang sama.',
  })
  terbitkan(
    @Param('id') id: string,
    @Body() dto: TerbitkanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permohonan.terbitkan(requireSchema(user), id, dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_QUEUE.CREATE')
  @Post('queue/tickets')
  @ApiOperation({ summary: 'Mengambil nomor antrean' })
  ambilAntrean(@Body() dto: AmbilAntreanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.permohonan.ambilNomorAntrean(requireSchema(user), dto.counterCode, dto.requestId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_SERVICE_REQUEST.READ')
  @Get('requests/track/:number')
  @ApiOperation({
    summary: 'Melacak permohonan',
    description:
      'Hanya riwayat yang ditandai terlihat warga. Catatan internal petugas tidak perlu — dan ' +
      'tidak seharusnya — dibaca pemohonnya.',
  })
  lacak(@Param('number') number: string, @CurrentUser() user: AuthenticatedUser) {
    return this.permohonan.lacak(requireSchema(user), number);
  }


  // --- Pengaduan dan partisipasi --------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_COMPLAINT.CREATE')
  @Post('complaints')
  @ApiOperation({
    summary: 'Menyampaikan pengaduan',
    description:
      'Mode ANONIM berarti identitas pelapor TIDAK DISIMPAN sama sekali — bukan disimpan lalu ' +
      'disembunyikan. Kategori yang menyangkut aparatur dipaksa anonim, sebab warga yang lupa ' +
      'mencentangnya tidak boleh tanpa sengaja mengungkapkan diri kepada orang yang ia adukan. ' +
      'Kode pelacakan yang dikembalikan adalah satu-satunya cara pelapor anonim menengok kembali ' +
      'aduannya.',
  })
  adukan(@Body() dto: AdukanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.partisipasi.adukan(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_COMPLAINT.ASSIGN')
  @Post('complaints/:id/assign')
  @ApiOperation({
    summary: 'Menugaskan pengaduan',
    description:
      'Pengaduan tentang seorang aparatur tidak dapat ditugaskan kepadanya — menugaskan aduan ' +
      'kepada terlapor sama dengan menutupnya.',
  })
  tugaskanAduan(
    @Param('id') id: string,
    @Body() dto: TugaskanPengaduanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.partisipasi.tugaskan(requireSchema(user), id, dto.officerId, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_COMPLAINT.UPDATE')
  @Post('complaints/:id/follow-up')
  @ApiOperation({
    summary: 'Menindaklanjuti pengaduan',
    description: 'Penutupan dan penghentian wajib beralasan — warga berhak tahu mengapa aduannya berhenti.',
  })
  tindaklanjuti(
    @Param('id') id: string,
    @Body() dto: TindakLanjutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.partisipasi.tindaklanjuti(
      requireSchema(user),
      id,
      dto.status,
      dto.note,
      user,
      dto.visibleToReporter ?? true,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_COMPLAINT.READ')
  @Get('complaints/track/:token')
  @ApiOperation({
    summary: 'Melacak pengaduan dari kode',
    description: 'Tidak mengembalikan identitas siapa pun — untuk aduan anonim, tidak ada yang tersimpan.',
  })
  lacakAduan(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partisipasi.lacakPengaduan(requireSchema(user), token);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_COMPLAINT.READ')
  @Get('complaints/attention')
  @ApiOperation({
    summary: 'Pengaduan yang terlantar atau perlu diangkat',
    description: 'Dihitung dari terakhir ada tindakan, bukan dari tanggal masuk.',
  })
  perluPerhatian(@CurrentUser() user: AuthenticatedUser) {
    return this.partisipasi.perluPerhatian(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASPIRATION.CREATE')
  @Post('aspirations')
  @ApiOperation({ summary: 'Menyampaikan aspirasi' })
  aspirasi(@Body() dto: AspirasiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.partisipasi.sampaikanAspirasi(requireSchema(user), dto);
  }

  // --- Musrenbang -----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_MUSRENBANG.CREATE')
  @Post('musrenbang')
  @ApiOperation({
    summary: 'Membuka forum Musrenbang',
    description:
      'Jenis forum ditentukan profil penyewa: desa menyelenggarakan Musdes, kelurahan ' +
      'menyelenggarakan Muskel. Keduanya berbeda bentuk maupun jenjangnya.',
  })
  bukaMusrenbang(@Body() dto: BukaMusrenbangDto, @CurrentUser() user: AuthenticatedUser) {
    return this.partisipasi.bukaMusrenbang(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_MUSRENBANG.READ')
  @Get('musrenbang/:id/proposals')
  @ApiOperation({
    summary: 'Usulan terurut menurut prioritas musyawarah',
    description:
      'Skor musyawarah didahulukan atas jumlah penerima manfaat, dan keduanya mendahului biaya. ' +
      'Mengurutkan menurut biaya lebih dahulu akan membuat jalan setapak selalu mengalahkan ' +
      'jembatan, dan desa tidak pernah membangun apa pun yang besar.',
  })
  usulanTerurut(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partisipasi.usulanTerurut(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_MUSRENBANG.APPROVE')
  @Post('musrenbang/:id/finalize')
  @ApiOperation({
    summary: 'Menetapkan hasil musyawarah',
    description:
      'Menolak bila kuorum tidak terpenuhi. Usulan yang tidak tertampung pagu DITUNDA, bukan ' +
      'ditolak — menolaknya menghapus jejak bahwa warga pernah mengusulkannya.',
  })
  tetapkanMusrenbang(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partisipasi.tetapkanHasil(requireSchema(user), id, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_MUSRENBANG.UPDATE')
  @Post('proposals/:id/decide')
  @ApiOperation({ summary: 'Memutuskan satu usulan' })
  putuskanUsulan(
    @Param('id') id: string,
    @Body() dto: PutusanUsulanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.partisipasi.putuskanUsulan(requireSchema(user), id, dto.status, dto.note, user);
  }


  // --- Perencanaan dan APBDes -----------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_RKPDES.CREATE')
  @Post('rkp')
  @ApiOperation({
    summary: 'Menyusun RKP Desa',
    description:
      'Tahun RKP wajib berada di dalam periode RPJM Desa induknya. Rencana tahunan tanpa ' +
      'rencana jangka menengah adalah rencana yang tidak dapat dipertanggungjawabkan arahnya.',
  })
  susunRkp(@Body() dto: SusunRkpDto, @CurrentUser() user: AuthenticatedUser) {
    return this.anggaran.susunRkp(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_RKPDES.UPDATE')
  @Post('rkp/:id/pull-proposal')
  @ApiOperation({
    summary: 'Menarik usulan Musrenbang menjadi kegiatan RKP',
    description:
      'Hanya usulan yang sudah disepakati musyawarah. Tautannya eksplisit — warga yang bertanya ' +
      '"usulan saya jadi apa" dapat dijawab tanpa menebak.',
  })
  tarikUsulan(
    @Param('id') id: string,
    @Body() dto: TarikUsulanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.anggaran.tarikUsulan(requireSchema(user), id, dto.proposalId, dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_APBDES.CREATE')
  @Post('budgets')
  @ApiOperation({ summary: 'Menyusun APBDes' })
  susunApbdes(@Body() dto: SusunApbdesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.anggaran.susunApbdes(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_APBDES.UPDATE')
  @Post('budgets/:id/lines')
  @ApiOperation({
    summary: 'Menetapkan pagu baris anggaran',
    description:
      'Pagu yang sudah ditetapkan hanya dapat diubah melalui APBDes Perubahan, yang memerlukan ' +
      'persetujuan BPD dan peraturan desa tersendiri.',
  })
  tetapkanPagu(
    @Param('id') id: string,
    @Body() dto: TetapkanPaguDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.anggaran.tetapkanPagu(requireSchema(user), id, dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_APBDES.APPROVE')
  @Post('budgets/:id/establish')
  @ApiOperation({
    summary: 'Menetapkan APBDes',
    description:
      'Menolak bila tidak seimbang: surplus/defisit ditambah pembiayaan neto harus nol. ' +
      'APBDes yang tidak seimbang tidak dapat ditetapkan — bukan karena aturan sistem, ' +
      'melainkan karena begitulah anggaran disusun.',
  })
  tetapkanApbdes(
    @Param('id') id: string,
    @Body() dto: TetapkanApbdesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.anggaran.tetapkanApbdes(requireSchema(user), id, dto.regulationNumber, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REALIZATION.CREATE')
  @Post('budgets/commit')
  @ApiOperation({
    summary: 'Mengikat belanja',
    description:
      'MENOLAK bila melampaui pagu — bukan memperingatkan. Pada APBDes, belanja melampaui pagu ' +
      'adalah pelanggaran, dan sistem yang memperingatkan lalu menerima hanya memindahkan ' +
      'tanggung jawabnya kepada petugas yang menekan "lanjutkan". Wajib menyertakan ' +
      'Idempotency-Key.',
  })
  ikat(
    @Body() dto: IkatDto,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!kunci?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tajuk Idempotency-Key wajib disertakan pada transaksi anggaran.',
      );
    }
    return this.anggaran.ikat(requireSchema(user), dto, kunci.trim(), user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REALIZATION.POST')
  @Post('budgets/realize')
  @ApiOperation({
    summary: 'Merealisasi belanja yang sudah diikat',
    description:
      'Menuntut ikatan induknya. Uang yang keluar tanpa ikatan adalah pengeluaran tanpa dasar — ' +
      'temuan pemeriksaan, bukan sekadar kelalaian pencatatan.',
  })
  realisasikan(
    @Body() dto: RealisasiDto,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!kunci?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tajuk Idempotency-Key wajib disertakan pada transaksi anggaran.',
      );
    }
    return this.anggaran.realisasikan(requireSchema(user), dto, kunci.trim(), user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_REALIZATION.READ')
  @Get('budgets/:id/absorption')
  @ApiOperation({
    summary: 'Serapan anggaran per baris',
    description: 'Membedakan yang sudah diikat dari yang sudah direalisasi.',
  })
  serapan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.anggaran.serapanApbdes(requireSchema(user), id);
  }


  // --- Aset dan pengadaan ---------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASSET_LIST.READ')
  @Get('assets')
  @ApiOperation({
    summary: 'Register aset',
    description:
      'Aset desa tidak disusutkan. Yang disajikan kondisinya, sebab yang ditanyakan pada ' +
      'Musyawarah Desa adalah mana yang rusak dan perlu diperbaiki tahun ini.',
  })
  daftarAset(
    @Query('status') status: string | undefined,
    @Query('condition') condition: string | undefined,
    @Query('kib') kib: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aset.daftarAset(requireSchema(user), { status, kondisi: condition, kib });
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASSET_LIST.CREATE')
  @Post('assets')
  @ApiOperation({
    summary: 'Mencatat aset',
    description:
      'Kelurahan tidak dapat mencatat aset bertanda DESA: ia perangkat daerah dan tidak memiliki ' +
      'kekayaan sendiri.',
  })
  catatAset(@Body() dto: CatatAsetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.aset.catatAset(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASSET_LIST.UPDATE')
  @Post('assets/:id/borrow')
  @ApiOperation({
    summary: 'Meminjamkan aset',
    description:
      'Satu aset hanya dapat sedang dipinjam oleh satu orang, ditegakkan indeks. Tanggal rencana ' +
      'kembali wajib — peminjaman tanpa batas waktu bukan peminjaman melainkan pemberian.',
  })
  pinjamkan(
    @Param('id') id: string,
    @Body() dto: PinjamAsetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aset.pinjamkan(requireSchema(user), { assetId: id, ...dto }, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASSET_LIST.UPDATE')
  @Post('borrowings/:id/return')
  @ApiOperation({
    summary: 'Menerima pengembalian aset',
    description:
      'Kondisi aset mengikuti kondisi saat dikembalikan. Aset yang kembali rusak dan tetap ' +
      'tercatat baik akan dipinjamkan lagi kepada orang berikutnya, yang lalu dianggap merusaknya.',
  })
  kembalikanAset(
    @Param('id') id: string,
    @Body() dto: KembalikanAsetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aset.kembalikan(requireSchema(user), id, dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASSET_LIST.UPDATE')
  @Post('assets/:id/maintenance')
  @ApiOperation({ summary: 'Mencatat pemeliharaan aset' })
  catatPemeliharaan(
    @Param('id') id: string,
    @Body() dto: PemeliharaanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aset.catatPemeliharaan(requireSchema(user), { assetId: id, ...dto }, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASSET_LIST.DELETE')
  @Post('assets/:id/disposal')
  @ApiOperation({
    summary: 'Mengusulkan penghapusan aset',
    description:
      'Wajib berdasar keputusan yang bernomor. Sistem tidak boleh menjadi tempat sebuah barang ' +
      'berhenti ada diam-diam. Aset yang sedang dipinjam tidak dapat dihapus.',
  })
  usulkanPenghapusan(
    @Param('id') id: string,
    @Body() dto: HapusAsetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aset.usulkanPenghapusan(requireSchema(user), { assetId: id, ...dto }, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASSET_LIST.DELETE')
  @Post('disposals/:id/approve')
  @ApiOperation({
    summary: 'Menyetujui penghapusan aset',
    description: 'Pengusul bukan penyetuju.',
  })
  setujuiPenghapusan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.aset.setujuiPenghapusan(requireSchema(user), id, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_ASSET_LIST.CREATE')
  @Post('procurement-plans')
  @ApiOperation({
    summary: 'Menyusun rencana pengadaan',
    description:
      'Wajib menunjuk baris anggarannya. Metode ditentukan dari nilainya: swakelola untuk yang ' +
      'kecil, penyedia untuk yang besar.',
  })
  susunPengadaan(@Body() dto: RencanaPengadaanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.aset.susunPengadaan(requireSchema(user), dto, user);
  }

  // --- Bantuan sosial -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_AID_PROGRAM.CREATE')
  @Post('aid/programs')
  @ApiOperation({ summary: 'Menyusun program bantuan' })
  susunProgramBantuan(@Body() dto: ProgramBantuanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bantuan.susunProgram(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_AID_PROGRAM.UPDATE')
  @Post('aid/programs/:id/criteria')
  @ApiOperation({
    summary: 'Menyimpan kriteria kelayakan',
    description:
      'Kriteria adalah pohon kondisi terstruktur dan TIDAK PERNAH dieksekusi. Bentuknya ' +
      'diperiksa sebelum disimpan: ruas di luar daftar tertutup ditolak, pembanding yang tidak ' +
      'berlaku bagi tipenya ditolak, dan kedalaman serta jumlah simpulnya dibatasi.',
  })
  simpanKriteria(
    @Param('id') id: string,
    @Body() dto: KriteriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bantuan.simpanKriteria(requireSchema(user), id, dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_BENEFICIARY.CREATE')
  @Post('aid/programs/:id/screen')
  @ApiOperation({
    summary: 'Menyaring calon penerima',
    description:
      'Hasilnya DUGAAN, bukan temuan. Penyaringan otomatis berhenti pada calon; penetapannya ' +
      'oleh manusia. Setiap calon menyimpan jejak penilaiannya, sebab warga yang tidak masuk ' +
      'daftar akan bertanya mengapa.',
  })
  saringCalon(
    @Param('id') id: string,
    @Body() dto: SaringDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bantuan.saring(
      requireSchema(user),
      id,
      { sumber: dto.source, surveyYear: dto.surveyYear },
      user,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_BENEFICIARY.READ')
  @Get('aid/programs/:id/candidates')
  @ApiOperation({ summary: 'Daftar calon penerima beserta jejak penilaiannya' })
  daftarCalon(
    @Param('id') id: string,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bantuan.daftarCalon(
      requireSchema(user),
      id,
      status as 'DIUSULKAN' | 'DIVERIFIKASI' | 'DITETAPKAN' | 'DITOLAK' | undefined,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_BENEFICIARY.UPDATE')
  @Post('aid/candidates/:id/verify')
  @ApiOperation({
    summary: 'Memverifikasi calon penerima',
    description:
      'Hasil penyaringan adalah dugaan; yang menjadikannya temuan adalah kunjungan petugas.',
  })
  verifikasiCalon(
    @Param('id') id: string,
    @Body() dto: VerifikasiCalonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bantuan.verifikasi(requireSchema(user), id, dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_BENEFICIARY.APPROVE')
  @Post('aid/candidates/:id/establish')
  @ApiOperation({
    summary: 'Menetapkan calon menjadi penerima',
    description:
      'Penetapan oleh manusia, tercatat siapa dan atas dasar apa. Menolak bila: pengusul ' +
      'menetapkan usulannya sendiri, calon belum diverifikasi, dasar penetapan tidak diuraikan, ' +
      'kuota penuh, atau warga sudah menerima bantuan sejenis dari jalur lain pada tahun yang ' +
      'sama — yang terakhir juga ditahan indeks unik parsial.',
  })
  tetapkanPenerima(
    @Param('id') id: string,
    @Body() dto: TetapkanPenerimaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bantuan.tetapkan(requireSchema(user), id, dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_BENEFICIARY.UPDATE')
  @Post('aid/distributions')
  @ApiOperation({
    summary: 'Mencatat penyaluran bantuan',
    description:
      'Satu termin disalurkan satu kali kepada satu penerima. Penyaluran ganda pada termin yang ' +
      'sama adalah pembayaran kedua, bukan pencatatan kedua. Wajib menyertakan Idempotency-Key.',
  })
  salurkanBantuan(
    @Body() dto: PenyaluranDto,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!kunci?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tajuk Idempotency-Key wajib disertakan pada penyaluran bantuan.',
      );
    }
    return this.bantuan.salurkan(requireSchema(user), dto, kunci.trim(), user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_AID_PROGRAM.READ')
  @Get('aid/programs/:id/summary')
  @ApiOperation({
    summary: 'Ringkasan program bantuan',
    description: 'Termasuk berapa calon yang berasal dari penyaringan otomatis.',
  })
  ringkasanProgramBantuan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bantuan.ringkasanProgram(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('VILLAGE_BENEFICIARY.CREATE')
  @Post('aid/household-surveys')
  @ApiOperation({
    summary: 'Mencatat pendataan keadaan keluarga',
    description:
      'Yang sudah diketahui sistem tidak ditanyakan ulang; yang ditanyakan hanya yang diperoleh ' +
      'dengan mendatangi rumahnya.',
  })
  catatPendataan(@Body() dto: PendataanKeluargaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bantuan.catatPendataan(requireSchema(user), dto, user);
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
  providers: [
    VillageUnitService,
    VillageMigrationService,
    VillageResidentService,
    VillageScopeService,
    VillageWorkflowService,
    VillageRequestService,
    VillageParticipationService,
    VillageBudgetService,
    VillageAssetService,
    VillageAidService,
  ],
  exports: [
    VillageUnitService,
    VillageMigrationService,
    VillageResidentService,
    VillageScopeService,
    VillageWorkflowService,
    VillageRequestService,
    VillageParticipationService,
    VillageBudgetService,
    VillageAssetService,
    VillageAidService,
  ],
})
export class VillageModule {}
