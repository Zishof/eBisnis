/**
 * Modul kasir (POS).
 *
 * Satu modul untuk seluruh jalur kasir — konteks, katalog, harga, dan kelak
 * keranjang serta pembayaran — supaya cakupan POS dapat dilihat dan diuji
 * sebagai satu kesatuan alih-alih tersebar.
 *
 * Aturan yang berlaku bagi setiap jalan di sini:
 *
 * 1. Nama skema tenant tidak pernah berasal dari permintaan; ia diambil dari
 *    token dan sudah dicocokkan ke daftar resmi oleh penjaga.
 * 2. Harga, pajak, diskon, dan total selalu dihitung peladen.
 * 3. Setiap penolakan menyebutkan alasannya dalam bentuk yang dapat dibaca
 *    kasir — bukan hanya kode HTTP.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthenticatedUser, BlockDemo, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PosCatalogService } from './pos-catalog.service';
import { PosContextService } from './pos-context.service';
import { PosSaleService } from './pos-sale.service';
import { PosStockService } from './pos-stock.service';
import { PosReturnService } from './pos-return.service';
import { PosShiftService } from './pos-shift.service';
import { PosReportService } from './pos-report.service';
import { PosSampleService, PROFIL_BAWAAN, PROFIL_RINGKAS } from './pos-sample.service';
import { PosOfflineService } from './pos-offline.service';
import { PosPromotionService } from './pos-promotion.service';
import { bersihkanPenyaring } from './pos-held';
import { AuthModule } from '../auth/auth.module';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { PosHospitalityController } from './pos-hospitality.controller';
import { PosHospitalityService } from './pos-hospitality.service';

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

// --- DTO --------------------------------------------------------------------

class DiskonManualDto {
  @ApiProperty({ enum: ['PERCENT', 'AMOUNT'] })
  @IsIn(['PERCENT', 'AMOUNT'])
  type!: 'PERCENT' | 'AMOUNT';

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

class KuotasiDto {
  @ApiProperty()
  @IsUUID()
  outletId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    description:
      'Harga yang diketik kasir. Hanya sah bila ia memiliki POS_SALE.PRICE_OVERRIDE; ' +
      'selalu menandai transaksi sebagai memerlukan persetujuan dan selalu tercatat pada audit.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ type: DiskonManualDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiskonManualDto)
  manualDiscount?: DiskonManualDto;

  @ApiPropertyOptional({ description: 'Saat transaksi; bawaannya sekarang.' })
  @IsOptional()
  @IsISO8601()
  at?: string;
}

class BukaShiftDto {
  @ApiProperty()
  @IsUUID()
  terminalId!: string;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(0)
  openingCash!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class PenugasanDto {
  @ApiProperty()
  @IsUUID()
  terminalId!: string;

  @ApiProperty()
  @IsUUID()
  userSubjectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

class BuatKeranjangDto {
  @ApiProperty()
  @IsUUID()
  outletId!: string;

  @ApiProperty()
  @IsUUID()
  terminalId!: string;

  @ApiProperty()
  @IsUUID()
  shiftId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

class TambahBarisDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiPropertyOptional({ description: 'Batch/lot farmasi yang dipilih dengan FEFO.' })
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ type: DiskonManualDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiskonManualDto)
  manualDiscount?: DiskonManualDto;
}

class UbahBarisDto {
  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity!: number;
}

class PembayaranDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId!: string;

  @ApiProperty({ example: 53900 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ description: 'Uang yang diserahkan pembeli; hanya tunai memberi kembalian.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tenderedAmount?: number;

  @ApiPropertyOptional({
    description: 'Nomor rujukan dari mesin EDC. Nomor kartu dan CVV TIDAK PERNAH disimpan.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  /*
   * Bukti sekali pakai dari layar milik penyedia saldo (IR-002).
   *
   * BUKAN PIN, dan itu bukan sekadar penamaan. Spesifikasi eKoperasi §14
   * menyebutnya tegas: PIN anggota tidak boleh terlihat kasir — dan sesuatu
   * yang melewati layar kasir adalah sesuatu yang terlihat kasir. Anggota
   * memasukkan PIN-nya pada perangkatnya sendiri; yang sampai ke sini hanya
   * bukti bahwa ia sudah melakukannya.
   *
   * Diteruskan apa adanya ke penangan dan tidak pernah disimpan.
   */
  @ApiPropertyOptional({
    description:
      'Bukti sekali pakai dari layar penyedia saldo. BUKAN PIN — PIN tidak pernah melewati kasir.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  authToken?: string;
}

class CekStokDto {
  @ApiProperty()
  @IsUUID()
  outletId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  quantity!: number;
}

// --- Transaksi luring -------------------------------------------------------

class BarisLuringDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ description: 'Harga satuan yang benar-benar ditagihkan, dari salinan katalog.' })
  @IsString()
  unitPrice!: string;

  @ApiProperty()
  @IsString()
  lineSubtotal!: string;

  @ApiProperty()
  @IsString()
  taxAmount!: string;

  @ApiProperty()
  @IsString()
  lineTotal!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taxRateId?: string;
}

class PembayaranLuringDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId!: string;

  @ApiProperty()
  @IsString()
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenderedAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

class TransaksiLuringDto {
  @ApiProperty({ description: 'Identitas yang dibuat mesin kasir; dasar idempotensi.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  offlineId!: string;

  @ApiProperty()
  @IsUUID()
  outletId!: string;

  @ApiProperty()
  @IsUUID()
  terminalId!: string;

  @ApiProperty()
  @IsUUID()
  shiftId!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsString()
  businessDate!: string;

  @ApiProperty({ description: 'Nomor yang sudah tercetak, dari jatah register ini.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  receiptNumber!: string;

  @ApiProperty()
  @IsISO8601()
  occurredAt!: string;

  @ApiProperty()
  @IsString()
  currencyCode!: string;

  @ApiProperty()
  @IsString()
  subtotal!: string;

  @ApiProperty()
  @IsString()
  taxTotal!: string;

  @ApiProperty()
  @IsString()
  grandTotal!: string;

  @ApiProperty()
  @IsString()
  changeTotal!: string;

  @ApiProperty({ description: 'Kapan salinan katalog yang menetapkan harga ini diambil.' })
  @IsString()
  catalogSyncedAt!: string;

  @ApiPropertyOptional({ description: 'Hash rantai buku besar lokal, untuk penelusuran.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  localHash?: string;

  @ApiProperty({ type: [BarisLuringDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BarisLuringDto)
  lines!: BarisLuringDto[];

  @ApiProperty({ type: [PembayaranLuringDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PembayaranLuringDto)
  payments!: PembayaranLuringDto[];
}

class JatahStrukDto {
  @ApiProperty()
  @IsUUID()
  terminalId!: string;
}

class AlasanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class BarisReturDto {
  @ApiProperty()
  @IsUUID()
  saleLineId!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({
    enum: ['RESTOCK', 'DAMAGED', 'DISPOSED'],
    description:
      'Ke mana barang kembali. Mengembalikan seluruh barang retur ke stok jual adalah cara ' +
      'tercepat membuat catatan stok berbeda dari kenyataan di rak.',
  })
  @IsOptional()
  @IsIn(['RESTOCK', 'DAMAGED', 'DISPOSED'])
  disposition?: 'RESTOCK' | 'DAMAGED' | 'DISPOSED';
}

class ReturDto {
  @ApiProperty({ type: [BarisReturDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BarisReturDto)
  lines!: BarisReturDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  reasonCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class RefundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

class VoidDto {
  @ApiProperty({ description: 'Alasan wajib: pembatalan yang tidak dapat ditelusuri tidak dapat dipertanggungjawabkan.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

class TutupShiftDto {
  @ApiProperty({ example: 1250000, description: 'Uang yang benar-benar dihitung di laci.' })
  @IsNumber()
  @Min(0)
  countedCash!: number;

  @ApiPropertyOptional({ description: 'Keterangan kasir bila ada selisih.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class GerakanKasDto {
  @ApiProperty({ enum: ['CASH_IN', 'CASH_OUT'] })
  @IsIn(['CASH_IN', 'CASH_OUT'])
  movementType!: 'CASH_IN' | 'CASH_OUT';

  @ApiProperty({ example: 200000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: 'Wajib: uang yang keluar tanpa alasan tercatat tidak dapat dibedakan dari uang yang hilang.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

class DataContohDto {
  @ApiPropertyOptional({
    enum: ['LENGKAP', 'RINGKAS'],
    description:
      'RINGKAS untuk sekadar melihat bentuknya; LENGKAP untuk mencoba laporan dengan angka yang ramai.',
  })
  @IsOptional()
  @IsIn(['LENGKAP', 'RINGKAS'])
  profile?: 'LENGKAP' | 'RINGKAS';
}

// --- Controller -------------------------------------------------------------

@ApiTags('POS')
@Controller('pos')
export class PosController {
  constructor(
    private readonly katalog: PosCatalogService,
    private readonly konteks: PosContextService,
    private readonly izin: TenantPermissionService,
    private readonly jual: PosSaleService,
    private readonly stokLayanan: PosStockService,
    private readonly retur: PosReturnService,
    private readonly shift: PosShiftService,
    private readonly laporan: PosReportService,
    private readonly contoh: PosSampleService,
    private readonly luring: PosOfflineService,
    private readonly promosi: PosPromotionService,
  ) {}

  /**
   * Identitas tenant dari identitas control plane.
   *
   * Diselesaikan di satu tempat supaya setiap jalan memakai id yang sama. Cacat
   * yang ditemukan pada POS-2 berawal dari dua tempat yang memakai id berbeda
   * tanpa ada yang menyadarinya: kuerinya berhasil dan mengembalikan nol baris.
   */
  private async subjek(schema: string, user: AuthenticatedUser): Promise<string> {
    return this.konteks.subjectIdPublik(schema, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('context')
  @ApiOperation({
    summary: 'Konteks kasir',
    description:
      'Brand, outlet, dan register yang boleh dipakai pengguna ini, beserta shift yang sedang ' +
      'terbuka. Jawabannya berasal dari cakupan data dan penugasan register — bukan dari ' +
      'parameter yang dikirim peramban.',
  })
  context(@CurrentUser() user: AuthenticatedUser) {
    return this.konteks.context(requireSchema(user), user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('catalog/search')
  @ApiOperation({ summary: 'Cari produk menurut nama, kode, SKU, atau barcode' })
  cari(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('outletId') outletId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.katalog.cariProduk(requireSchema(user), q ?? '', {
      categoryId: categoryId || undefined,
      outletId: outletId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // --- Transaksi luring ----------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('offline/receipt-blocks')
  @ApiOperation({
    summary: 'Memesan jatah nomor struk untuk register ini',
    description:
      'Dipanggil selagi masih daring. Urutan nomor struk dimajukan sejauh ukuran jatah, dan ' +
      'rentangnya dicatat sebagai milik register ini — sehingga penjualan daring tidak akan ' +
      'pernah memakai nomor di dalamnya. Jatah lama register ini dilepaskan; nomor yang belum ' +
      'terpakai padanya hangus, sebab nomor struk tidak perlu dihemat sedangkan nomor kembar mahal.',
  })
  async pesanJatah(@CurrentUser() user: AuthenticatedUser, @Body() body: JatahStrukDto) {
    const schema = requireSchema(user);
    const subjectId = await this.konteks.subjectIdPublik(schema, user.userId);
    return this.luring.alokasikanJatah(schema, body.terminalId, subjectId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('offline/receipt-blocks/current')
  @ApiOperation({ summary: 'Jatah nomor struk yang sedang aktif pada satu register' })
  jatahAktif(@CurrentUser() user: AuthenticatedUser, @Query('terminalId') terminalId: string) {
    return this.luring.jatahAktif(requireSchema(user), terminalId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('offline/sales')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mengirim transaksi yang terjadi saat luring',
    description:
      'Idempoten pada `offlineId`. Transaksi diputar ulang lewat jalur penjualan yang sama ' +
      'dengan transaksi daring, memakai nomor struk yang sudah tercetak. ' +
      'Bila peladen menghitung angka yang berbeda, atau stok tidak cukup, atau shift sudah ' +
      'ditutup, transaksinya **ditahan di karantina** beserta kedua angkanya — tidak ditolak ' +
      '(uangnya sudah berpindah tangan) dan tidak dibukukan diam-diam dengan angka lain ' +
      '(struk di tangan pembeli menyebut angka pada mesin kasir).',
  })
  async kirimLuring(@CurrentUser() user: AuthenticatedUser, @Body() body: TransaksiLuringDto) {
    const schema = requireSchema(user);
    const subjectId = await this.konteks.subjectIdPublik(schema, user.userId);
    return this.luring.terima(
      schema,
      {
        ...body,
        localHash: body.localHash ?? null,
        lines: body.lines.map((l) => ({
          ...l,
          uomId: l.uomId ?? null,
          taxRateId: l.taxRateId ?? null,
        })),
        payments: body.payments.map((p) => ({
          ...p,
          tenderedAmount: p.tenderedAmount ?? null,
          reference: p.reference ?? null,
        })),
      },
      user,
      subjectId,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_REPORT.READ')
  @Get('offline/quarantine')
  @ApiOperation({
    summary: 'Transaksi luring yang tertahan',
    description:
      'Setiap baris menyebut sebabnya beserta KEDUA angka — yang tercetak pada struk dan yang ' +
      'dihitung peladen. Menyebut salah satunya saja memaksa pemeriksa mencari sendiri angka ' +
      'pembandingnya, dan pencarian itu yang membuat pemeriksaan tidak pernah dikerjakan.',
  })
  karantina(
    @CurrentUser() user: AuthenticatedUser,
    @Query('outletId') outletId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.luring.karantina(requireSchema(user), {
      outletId: outletId || undefined,
      status: status || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('offline/reconcile')
  @ApiOperation({
    summary: 'Catatan peladen untuk diadu dengan buku besar mesin kasir',
    description:
      'Seluruh penjualan register pada satu tanggal usaha, daring maupun luring. Mesin kasir ' +
      'yang hanya menerima baris luring akan melaporkan setiap penjualan daring sebagai ' +
      '"hanya ada di server", dan laporan yang penuh selisih palsu tidak akan pernah dibaca.',
  })
  rekonsiliasiLuring(
    @CurrentUser() user: AuthenticatedUser,
    @Query('terminalId') terminalId: string,
    @Query('businessDate') businessDate: string,
  ) {
    return this.luring.catatanUntukRekonsiliasi(requireSchema(user), { terminalId, businessDate });
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('catalog/snapshot')
  @ApiOperation({
    summary: 'Salinan katalog untuk mesin kasir luring',
    description:
      'Produk beserta seluruh barcode (utama dan alternatif), tarif pajak, dan metode ' +
      'pembayaran, dalam satu jawaban. Dipakai layar kasir agar pencarian dan pemindaian ' +
      'tetap bekerja ketika peladen tidak terjangkau. Bila katalog lebih besar daripada ' +
      'batas salin, medan `truncated` bernilai benar dan layar wajib memberitahu kasir — ' +
      'katalog yang dipotong diam-diam membuat barang tampak "tidak ada" tanpa penjelasan.',
  })
  snapshotKatalog(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.katalog.snapshotLuring(requireSchema(user), {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('products/by-barcode')
  @ApiOperation({
    summary: 'Cari produk menurut barcode',
    description: 'Barcode utama maupun alternatif; pemindai tidak tahu bedanya.',
  })
  async barcode(@CurrentUser() user: AuthenticatedUser, @Query('code') code: string) {
    const produk = await this.katalog.produkDariBarcode(requireSchema(user), code ?? '');
    if (!produk) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        `Barcode ${code} tidak dikenali. Cari produk menurut namanya, atau daftarkan barcode ini pada master produk.`,
      );
    }
    return produk;
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Post('price/quote')
  @ApiOperation({
    summary: 'Kuotasi harga otoritatif',
    description:
      'Satu-satunya sumber harga yang sah pada jalur kasir. Mengembalikan harga satuan, bruto, ' +
      'diskon beserta asal-usulnya, pajak beserta tarif yang dipakai, neto, total, dan peringatan.',
  })
  async quote(@Body() dto: KuotasiDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);

    /*
     * Penggantian harga diperiksa di sini, bukan di dalam layanan.
     *
     * Layanan tidak mengenal hak akses, dan seharusnya memang tidak — tetapi
     * itu berarti seseorang yang memanggilnya dari tempat lain dapat melewati
     * pemeriksaan ini. Karena itu penggantian harga juga selalu menandai
     * transaksi sebagai memerlukan persetujuan, sehingga andaikan pemeriksaan
     * ini terlewat sekalipun, hasilnya tetap tidak dapat diselesaikan diam-diam.
     */
    if (dto.priceOverride !== undefined && dto.priceOverride !== null) {
      const kurang = await this.izin.findMissing(schema, user.userId, ['POS_SALE.PRICE_OVERRIDE'], {
        isDemo: user.isDemo,
        activeRoleId: user.activeRoleId ?? null,
      });
      if (kurang.length) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak berwenang mengubah harga secara manual. Mintakan persetujuan supervisor.',
        );
      }
    }
    if (dto.manualDiscount) {
      const kurang = await this.izin.findMissing(schema, user.userId, ['POS_SALE.DISCOUNT_LINE'], {
        isDemo: user.isDemo,
        activeRoleId: user.activeRoleId ?? null,
      });
      if (kurang.length) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak berwenang memberikan diskon manual. Mintakan persetujuan supervisor.',
        );
      }
    }

    return this.katalog.kuotasi(schema, {
      outletId: dto.outletId,
      productId: dto.productId,
      uomId: dto.uomId,
      quantity: dto.quantity,
      customerId: dto.customerId ?? null,
      brandId: dto.brandId ?? null,
      priceOverride: dto.priceOverride ?? null,
      manualDiscount: dto.manualDiscount ?? null,
      at: dto.at,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_REGISTER_ASSIGN.READ')
  @Get('register-assignments')
  @ApiOperation({ summary: 'Penugasan kasir pada register' })
  penugasan(@CurrentUser() user: AuthenticatedUser, @Query('terminalId') terminalId?: string) {
    return this.konteks.daftarPenugasan(requireSchema(user), terminalId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_REGISTER_ASSIGN.CREATE')
  @Post('register-assignments')
  @ApiOperation({ summary: 'Menugaskan kasir pada register' })
  tugaskan(@Body() dto: PenugasanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.konteks.tugaskan(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SHIFT.OPEN_SHIFT')
  @Post('shifts/open')
  @ApiOperation({
    summary: 'Membuka shift',
    description:
      'Menolak bila register tidak aktif, dalam perawatan, tidak ditugaskan kepada pengguna ini, ' +
      'atau sudah memiliki shift yang terbuka.',
  })
  bukaShift(@Body() dto: BukaShiftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.konteks.bukaShift(requireSchema(user), dto, user);
  }

  // --- Keranjang dan penjualan ---------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('sales')
  @ApiOperation({ summary: 'Membuka keranjang baru' })
  async buatKeranjang(@Body() dto: BuatKeranjangDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.jual.buatKeranjang(schema, dto, user, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('sales/:id')
  @ApiOperation({ summary: 'Membaca satu keranjang beserta barisnya' })
  ambilKeranjang(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jual.ambil(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('sales/:id/items')
  @ApiOperation({
    summary: 'Menambahkan baris',
    description:
      'Harga dikuotasi peladen dan stok ditahan; keduanya harus berhasil bersama. Baris yang ' +
      'masuk keranjang tanpa penahanan stok akan membuat dua kasir sama-sama menjual barang ' +
      'terakhir yang sama.',
  })
  async tambahBaris(
    @Param('id') id: string,
    @Body() dto: TambahBarisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    if (dto.priceOverride !== undefined && dto.priceOverride !== null) {
      const kurang = await this.izin.findMissing(schema, user.userId, ['POS_SALE.PRICE_OVERRIDE'], {
        isDemo: user.isDemo,
        activeRoleId: user.activeRoleId ?? null,
      });
      if (kurang.length) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak berwenang mengubah harga secara manual. Mintakan persetujuan supervisor.',
        );
      }
    }
    if (dto.manualDiscount) {
      const kurang = await this.izin.findMissing(schema, user.userId, ['POS_SALE.DISCOUNT_LINE'], {
        isDemo: user.isDemo,
        activeRoleId: user.activeRoleId ?? null,
      });
      if (kurang.length) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak berwenang memberikan diskon manual. Mintakan persetujuan supervisor.',
        );
      }
    }
    return this.jual.tambahBaris(schema, id, dto, user, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Patch('sales/:id/items/:lineId')
  @ApiOperation({ summary: 'Mengubah jumlah pada satu baris' })
  async ubahBaris(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UbahBarisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.ubahBaris(
      schema,
      id,
      lineId,
      dto.quantity,
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.UPDATE')
  @Delete('sales/:id/items/:lineId')
  @ApiOperation({ summary: 'Membatalkan satu baris sebelum pembayaran' })
  hapusBaris(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jual.hapusBaris(requireSchema(user), id, lineId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.APPROVE')
  @Post('sales/:id/items/:lineId/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyetujui baris yang menuntut persetujuan',
    description:
      'Baris yang ditandai `requiresApproval` (mis. harga di bawah HPP) memblokir penyelesaian ' +
      'transaksi sampai disetujui di sini. Pemohon (kasir pemilik transaksi) tidak dapat ' +
      'menyetujui barisnya sendiri.',
  })
  async setujuiBaris(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.setujuiBaris(schema, id, lineId, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.HOLD')
  @Post('sales/:id/hold')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menahan keranjang' })
  async tahan(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.pindahStatus(
      schema,
      id,
      'HELD',
      dto.reason ?? 'Ditahan kasir',
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.RESUME')
  @Post('sales/:id/resume')
  @HttpCode(200)
  @ApiOperation({ summary: 'Melanjutkan keranjang yang ditahan' })
  async lanjutkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.jual.pindahStatus(
      schema,
      id,
      'DRAFT',
      'Dilanjutkan kasir',
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.UPDATE')
  @Post('sales/:id/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Membatalkan keranjang sebelum pembayaran',
    description: 'Seluruh penahanan stoknya dilepaskan.',
  })
  async batal(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.pindahStatus(
      schema,
      id,
      'CANCELLED',
      dto.reason ?? 'Dibatalkan kasir',
      user,
      await this.subjek(schema, user),
    );
  }

  // --- Pembayaran ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('sales/:id/payments')
  @ApiOperation({
    summary: 'Menerima pembayaran',
    description:
      'Wajib menyertakan tajuk Idempotency-Key. Klik ganda pada layar yang lambat adalah ' +
      'keadaan yang pasti terjadi di lapangan, bukan kemungkinan.',
  })
  async bayar(
    @Param('id') id: string,
    @Body() dto: PembayaranDto,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    if (!kunci?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tajuk Idempotency-Key wajib disertakan pada penerimaan pembayaran.',
      );
    }
    // Penerima pembayaran dicatat tersendiri sejak V029: supervisor dapat
    // mengambil alih di tengah transaksi, sehingga ia belum tentu sama dengan
    // kasir yang membuka keranjangnya.
    return this.jual.tambahPembayaran(
      schema,
      id,
      dto,
      kunci.trim(),
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('sales/:id/complete')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyelesaikan transaksi',
    description:
      'Sepuluh langkah dalam satu transaksi basis data: validasi penjualan, shift, persetujuan, ' +
      'dan total pembayaran; nomor struk; potong persediaan; peristiwa akuntansi; terbitkan ' +
      'struk; tandai selesai; titipkan ke outbox. Bila satu gagal, seluruhnya digulung balik.',
  })
  async selesaikan(
    @Param('id') id: string,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.selesaikan(
      schema,
      id,
      kunci?.trim() || id,
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('payment-methods')
  @ApiOperation({
    summary: 'Metode pembayaran yang aktif',
    description: 'Dipakai layar kasir untuk menampilkan pilihan pembayaran beserta perilakunya.',
  })
  async metodePembayaran(@CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.katalog.metodePembayaran(schema);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SHIFT.READ')
  @Get('shifts/:id/cash-summary')
  @ApiOperation({
    summary: 'Ringkasan kas shift berjalan',
    description:
      'Kas yang diharapkan dihitung peladen dari kas awal, penjualan tunai, dan pergerakan kas — ' +
      'bukan dilaporkan kasir.',
  })
  ringkasanKas(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.shift.ringkasanKas(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_CASH.CASH_MOVE')
  @Post('shifts/:id/cash-movement')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mencatat kas masuk atau keluar di tengah shift' })
  async gerakanKas(
    @Param('id') id: string,
    @Body() dto: GerakanKasDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.shift.gerakanKas(schema, id, dto, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SHIFT.CLOSE_SHIFT')
  @Post('shifts/:id/close')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menutup shift dan merekonsiliasi kas',
    description:
      'Kasir melaporkan berapa uang yang ada di laci; berapa yang seharusnya ada dihitung ' +
      'peladen. Selisih di atas ambang menjadikan shift menunggu persetujuan supervisor.',
  })
  async tutupShift(
    @Param('id') id: string,
    @Body() dto: TutupShiftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.shift.tutupShift(schema, id, dto, user, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SHIFT.APPROVE')
  @Post('shifts/:id/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyetujui selisih kas',
    description: 'Tidak dapat dilakukan oleh orang yang menutup shiftnya sendiri.',
  })
  async setujuiShift(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.shift.setujuiShift(
      schema,
      id,
      dto.reason ?? 'Selisih kas disetujui',
      await this.subjek(schema, user),
    );
  }

  // --- Data contoh POS -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('sample-data')
  @ApiOperation({
    summary: 'Berapa data contoh POS yang masih ada',
    description: 'Tombol hapus hanya perlu ditampilkan bila `hasSampleData` benar.',
  })
  hitungContoh(@CurrentUser() user: AuthenticatedUser) {
    return this.contoh.hitung(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('MASTER_SEED_TOOLS.CREATE')
  @BlockDemo()
  @Post('sample-data')
  @ApiOperation({
    summary: 'Membangun data contoh POS',
    description:
      'Merek, outlet, gudang, register, produk berbarcode, pelanggan, stok, dan penjualan yang ' +
      'sudah selesai. Seluruhnya bertanda is_sample dan sample_batch_id. Data acuan — satuan, ' +
      'bagan akun, peran — tidak disentuh sama sekali.',
  })
  async bangunContoh(@Body() dto: DataContohDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    const profil = dto.profile === 'RINGKAS' ? PROFIL_RINGKAS : PROFIL_BAWAAN;
    return this.contoh.bangun(schema, profil, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('MASTER_SEED_TOOLS.DELETE')
  @BlockDemo()
  @Post('sample-data/cleanup')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menghapus seluruh data contoh POS',
    description:
      'Hanya baris bertanda is_sample. Outlet contoh yang telanjur menaungi penjualan sungguhan ' +
      'TIDAK dihapus dan dilaporkan sebagai tertahan.',
  })
  async bersihkanContoh(@Body() dto: AlasanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.contoh.bersihkan(
      schema,
      dto.reason ?? 'Hapus data contoh POS',
      await this.subjek(schema, user),
    );
  }

  // --- Laporan ---------------------------------------------------------------

  /**
   * Konteks laporan seorang pengguna.
   *
   * Cakupan outlet, hak melihat biaya, dan hak melihat kasir lain dihitung
   * SEKALI di sini dan diteruskan ke layanan. Menghitungnya di dalam setiap
   * laporan berarti lima belas kesempatan untuk lupa memeriksanya.
   */
  private async konteksLaporan(schema: string, user: AuthenticatedUser) {
    const subjectId = await this.subjek(schema, user);
    const kurang = await this.izin.findMissing(
      schema,
      user.userId,
      ['POS_REPORT.VIEW_COST', 'POS_REPORT.AUDIT_READ'],
      { isDemo: user.isDemo, activeRoleId: user.activeRoleId ?? null },
    );
    return {
      outletIds: await this.konteks.outletTerjangkau(schema, subjectId),
      bolehLihatBiaya: !kurang.includes('POS_REPORT.VIEW_COST'),
      // Melihat penjualan kasir lain adalah persoalan audit — melihat melampaui
      // aktivitas sendiri — dan POS_REPORT.AUDIT_READ sudah menyatakan itu.
      bolehLihatKasirLain: !kurang.includes('POS_REPORT.AUDIT_READ'),
      subjectId,
    };
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_REPORT.READ')
  @Get('reports')
  @ApiOperation({
    summary: 'Daftar laporan yang tersedia',
    description: 'Sudah disaring menurut hak pengguna; laporan berbiaya tidak muncul bagi kasir.',
  })
  async daftarLaporan(@CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.laporan.daftarLaporan(await this.konteksLaporan(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_REPORT.READ')
  @Get('reports/dashboard')
  @ApiOperation({
    summary: 'Dasbor satu tanggal usaha',
    description:
      'Menggabungkan ringkasan, per kasir, komposisi pembayaran, produk teratas, dan shift ' +
      'dalam satu permintaan — layar dasbor memanggilnya sekaligus.',
  })
  async dasbor(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    const schema = requireSchema(user);
    return this.laporan.dasbor(schema, date, await this.konteksLaporan(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_REPORT.READ')
  @Get('reports/:code')
  @ApiOperation({
    summary: 'Menjalankan satu laporan',
    description:
      'Rentang tanggal wajib dan dibatasi. Membaca business_date, bukan cap waktu: kasir yang ' +
      'bekerja melewati tengah malam tetap berada pada tanggal usaha yang sama.',
  })
  async jalankanLaporan(
    @Param('code') code: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('outletId') outletId?: string,
    @Query('cashierId') cashierId?: string,
    @Query('limit') limit?: string,
  ) {
    const schema = requireSchema(user);
    return this.laporan.jalankan(
      schema,
      { code, from, to, outletId, cashierId, limit: limit ? Number(limit) : undefined },
      await this.konteksLaporan(schema, user),
    );
  }

  // --- Struk -----------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('sales/:id/receipt')
  @ApiOperation({ summary: 'Membaca struk satu transaksi' })
  struk(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jual.struk(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.PRINT')
  @Post('sales/:id/receipt/reprint')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mencetak ulang struk',
    description:
      'Setiap cetak ulang tercatat. Struk kedua atas transaksi yang sama dapat dipakai menuntut ' +
      'barang dua kali, sehingga cetak ulang yang tidak tercatat adalah celah yang nyata.',
  })
  async cetakUlang(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.cetakUlangStruk(
      schema,
      id,
      dto.reason ?? 'Cetak ulang',
      await this.subjek(schema, user),
    );
  }

  // --- Pembatalan, retur, refund ---------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.CANCEL')
  @Post('sales/:id/void-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengajukan pembatalan transaksi yang sudah selesai' })
  async mintaVoid(
    @Param('id') id: string,
    @Body() dto: VoidDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.retur.ajukanVoid(schema, id, dto.reason, user, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.APPROVE')
  @Post('sales/:id/void-approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyetujui pembatalan',
    description:
      'Stok dikembalikan dan peristiwa akuntansi pembalik dibentuk — barisnya TIDAK dihapus. ' +
      'Pemohon tidak dapat menyetujui permintaannya sendiri.',
  })
  async setujuiVoid(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.retur.setujuiVoid(
      schema,
      id,
      dto.reason ?? 'Pembatalan disetujui',
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.APPROVE')
  @Post('sales/:id/void-reject')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menolak pembatalan',
    description:
      'Transaksi kembali COMPLETED apa adanya — tidak ada stok maupun akuntansi yang dibalik, ' +
      'sebab belum ada yang pernah dibalik untuk permintaan yang ditolak. Pemohon tidak dapat ' +
      'menolak permintaannya sendiri, sama seperti menyetujuinya.',
  })
  async tolakVoid(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.retur.tolakVoid(
      schema,
      id,
      dto.reason ?? 'Pembatalan ditolak',
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_RETURN.RETURN')
  @Post('sales/:id/returns')
  @ApiOperation({ summary: 'Mengajukan retur sebagian atau seluruhnya' })
  async buatRetur(
    @Param('id') id: string,
    @Body() dto: ReturDto,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    if (!kunci?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tajuk Idempotency-Key wajib disertakan pada pengajuan retur.',
      );
    }
    return this.retur.buatRetur(
      schema,
      id,
      dto,
      kunci.trim(),
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_RETURN.RETURN_APPROVE')
  @Post('returns/:id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menyetujui retur; barang kembali sesuai disposisinya' })
  async setujuiRetur(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.retur.setujuiRetur(schema, id, user, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_RETURN.REFUND_APPROVE')
  @Post('returns/:id/refund')
  @HttpCode(200)
  @ApiOperation({ summary: 'Membayarkan refund atas retur yang sudah disetujui' })
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundDto,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    if (!kunci?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tajuk Idempotency-Key wajib disertakan pada pembayaran refund.',
      );
    }
    return this.retur.refund(
      schema,
      id,
      dto,
      kunci.trim(),
      user,
      await this.subjek(schema, user),
    );
  }

  // --- Stok ------------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Post('stock/check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Memeriksa ketersediaan tanpa mengubah apa pun' })
  async cekStok(@Body() dto: CekStokDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    const gudang = await this.stokLayanan.gudangOutlet(schema, dto.outletId);
    if (!gudang) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Outlet ini belum memiliki gudang.');
    }
    const setelan = await this.katalog.setelanPos(schema);
    return this.stokLayanan.periksa(
      schema,
      { warehouseId: gudang, productId: dto.productId, quantity: dto.quantity },
      setelan.allowNegativeStock,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SHIFT.READ')
  @Get('shifts/current')
  @ApiOperation({ summary: 'Shift yang sedang terbuka bagi pengguna ini' })
  shiftBerjalan(@CurrentUser() user: AuthenticatedUser) {
    return this.konteks.shiftBerjalan(requireSchema(user), user);
  }

  // --- Transaksi ditahan -----------------------------------------------------
  //
  // Menu "Transaksi Ditahan" sudah lama menunjuk rute yang tidak ada. Kasir yang
  // menahan keranjang karena pembeli pergi mengambil satu barang lagi tidak
  // punya jalan mengambilnya kembali selain mengingat nomor struknya — dan yang
  // tidak ditemukan berakhir sebagai pemindaian ulang di depan antrean.

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.RESUME')
  @Get('held')
  @ApiOperation({
    summary: 'Daftar keranjang yang sedang ditahan',
    description:
      'Diurutkan: milik mesin yang sedang dipakai lebih dahulu, lalu yang paling baru ditahan. ' +
      'Cakupan outlet ditegakkan pada query, bukan disaring sesudahnya.',
  })
  async daftarTertahan(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('outletId') outletId?: string,
    @Query('terminalId') terminalId?: string,
    @Query('limit') limit?: string,
  ) {
    const schema = requireSchema(user);
    const subjectId = await this.subjek(schema, user);
    const shift = await this.konteks.shiftBerjalan(schema, user);

    return this.jual.daftarTertahan(
      schema,
      bersihkanPenyaring({ from, to, q, outletId, terminalId, limit }),
      {
        outletIds: await this.konteks.outletTerjangkau(schema, subjectId),
        // Terminal yang sedang dipakai diambil dari shift berjalan, bukan dari
        // query: kasir tidak memilih mesinnya sendiri, dan menerimanya dari
        // klien membuat badge "mesin ini" dapat dibuat menunjuk mesin mana pun.
        terminalId:
          (shift as { terminalId?: string | null } | null)?.terminalId ?? null,
      },
    );
  }

  // --- Aturan diskon --------------------------------------------------------
  //
  // Mesin promosinya sudah bekerja sejak lama; yang tidak ada adalah cara
  // membuat aturannya. Sampai sebelum bagian ini, satu-satunya jalan adalah SQL
  // langsung atau data contoh — dan mesin yang tidak dapat diisi sama saja
  // dengan mesin yang tidak ada.

  @ApiBearerAuth('access-token')
  @Permissions('POS_PROMO.READ')
  @Get('promotions')
  @ApiOperation({ summary: 'Daftar aturan diskon' })
  daftarPromosi(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.promosi.daftar(requireSchema(user), {
      includeInactive: includeInactive === 'true',
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_PROMO.READ')
  @Get('promotions/:id')
  @ApiOperation({ summary: 'Satu aturan diskon' })
  satuPromosi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.promosi.satu(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_PROMO.CREATE')
  @Post('promotions')
  @ApiOperation({
    summary: 'Membuat aturan diskon',
    description:
      'Menolak diskon persen di atas 100%, lingkup outlet atau brand tanpa id, dan jam ' +
      'mulai tanpa jam selesai. Seluruh masalah dilaporkan sekaligus.',
  })
  buatPromosi(@Body() dto: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.promosi.buat(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_PROMO.UPDATE')
  @Patch('promotions/:id')
  @ApiOperation({ summary: 'Mengubah aturan diskon' })
  ubahPromosi(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promosi.ubah(requireSchema(user), id, dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_PROMO.DELETE')
  @Post('promotions/:id/deactivate')
  @ApiOperation({
    summary: 'Menonaktifkan aturan diskon',
    description:
      'Dinonaktifkan, bukan dihapus: transaksi yang sudah terjadi menunjuk aturan ini, dan ' +
      'menghapusnya membuat struk lama tidak dapat dijelaskan lagi.',
  })
  nonaktifkanPromosi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.promosi.nonaktifkan(requireSchema(user), id, user);
  }
}

import { ExternalPaymentRegistry } from './external-payment.registry';

@Module({
  imports: [InfrastructureModule, AuthModule],
  controllers: [PosController, PosHospitalityController],
  providers: [
    ExternalPaymentRegistry,
    PosCatalogService,
    PosContextService,
    PosSaleService,
    PosStockService,
    PosReturnService,
    PosShiftService,
    PosReportService,
    PosSampleService,
    PosOfflineService,
    PosPromotionService,
    PosHospitalityService,
  ],
  exports: [
    ExternalPaymentRegistry,
    PosCatalogService,
    PosContextService,
    PosSaleService,
    PosStockService,
    PosReturnService,
    PosShiftService,
    PosReportService,
    PosSampleService,
  ],
})
export class PosModule {}
