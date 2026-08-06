/**
 * Titik masuk HTTP booking engine publik (MI-9) -- TANPA login staf.
 *
 * `schemaName` diterima eksplisit pada jalur URL. Ini interim: mekanisme
 * pemesanannya sendiri (pencarian, validasi, pemesanan, kelola) sudah
 * nyata dan teruji; yang BELUM ada adalah resolusi tenant lewat host/
 * subdomain (`PublicTenantResolver`, pola `pesantren-public.service.ts`)
 * karena MI-3 (subdomain properti) masih diblokir -- lihat catatan
 * migrasi. Begitu MI-3 selesai, jalur ini tinggal disambung ke resolver
 * host, bukan ditulis ulang.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { HospitalityBookingEngineService } from './hospitality-booking-engine.service';
import { METODE_PEMBAYARAN } from './hospitality-booking-engine';
import { Public, RequestContext, type RequestMeta } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

class CariKetersediaanQuery {
  @ApiProperty({ example: '2026-09-10' })
  @IsString()
  checkin!: string;

  @ApiProperty({ example: '2026-09-12' })
  @IsString()
  checkout!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  dewasa?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  anak?: number;
}

class PesanPublikDto {
  @ApiProperty()
  @IsString()
  propertyId!: string;

  @ApiProperty()
  @IsString()
  roomTypeId!: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsString()
  checkin!: string;

  @ApiProperty({ example: '2026-09-12' })
  @IsString()
  checkout!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1)
  dewasa?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Min(0)
  anak?: number;

  @ApiProperty()
  @IsString()
  namaLengkap!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  telepon?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  permintaanKhusus?: string;

  @ApiPropertyOptional({ enum: METODE_PEMBAYARAN, default: 'PAY_AT_PROPERTY' })
  @IsOptional() @IsIn(METODE_PEMBAYARAN as unknown as string[])
  metodePembayaran?: string;
}

class BatalkanPublikDto {
  @ApiProperty({ description: 'Email atau telepon yang tercatat pada pemesanan -- verifikasi kepemilikan.' })
  @IsString()
  kontak!: string;

  @ApiProperty()
  @IsString()
  alasan!: string;
}

function schemaDariUrl(schemaName: string): string {
  // Bukan validasi keamanan (itu tugas basis data -- query pada schema
  // yang tidak ada gagal wajar) -- hanya penjaga kewarasan awal supaya
  // galat yang muncul jelas, bukan galat SQL mentah.
  if (!schemaName?.trim()) {
    throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Identitas penyewa tidak sah.');
  }
  return schemaName;
}

@ApiTags('hospitality-public')
@Controller('public/hospitality/:schemaName')
export class HospitalityBookingEngineController {
  constructor(private readonly booking: HospitalityBookingEngineService) {}

  @Public()
  @Get('properti/:propertyId/cari')
  @ApiOperation({ summary: 'Mencari tipe kamar tersedia dan terpublikasi untuk rentang menginap' })
  cari(
    @Param('schemaName') schemaName: string,
    @Param('propertyId') propertyId: string,
    @Query() query: CariKetersediaanQuery,
  ) {
    return this.booking.cariKetersediaan(schemaDariUrl(schemaName), propertyId, query);
  }

  @Public()
  @Post('reservasi')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Memesan mandiri tanpa staf',
    description: 'Wajib menyertakan tajuk Idempotency-Key -- klik ganda pada koneksi lambat tidak menghasilkan pemesanan ganda.',
  })
  async pesan(
    @Param('schemaName') schemaName: string,
    @Body() dto: PesanPublikDto,
    @RequestContext() meta: RequestMeta,
  ) {
    // Diratakan (bukan { reservasi, diulang } bersarang) -- pola yang
    // sama dengan HospitalityReservationController.catat(), supaya
    // kedua jalur (staf dan publik) mengembalikan bentuk yang sama bagi
    // pemanggil yang sama-sama membaca objek reservasi. Ketidaksamaan
    // ini pernah menyebabkan layar publik gagal membaca `room_stays`
    // (undefined.map) -- ditemukan lewat pengujian peramban sungguhan.
    const { reservasi, diulang } = await this.booking.pesanPublik(
      schemaDariUrl(schemaName),
      dto,
      meta.idempotencyKey,
    );
    return { ...reservasi, _diulangDariPermintaanSebelumnya: diulang };
  }

  @Public()
  @Get('reservasi/:code')
  @ApiOperation({ summary: 'Melihat pemesanan lewat kode + verifikasi kontak' })
  lihat(
    @Param('schemaName') schemaName: string,
    @Param('code') code: string,
    @Query('kontak') kontak: string,
  ) {
    if (!kontak?.trim()) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Kontak (email atau telepon) wajib diisi untuk verifikasi.');
    }
    return this.booking.lihatPemesanan(schemaDariUrl(schemaName), code, kontak.trim());
  }

  @Public()
  @Post('reservasi/:code/batalkan')
  @ApiOperation({ summary: 'Membatalkan pemesanan sendiri + verifikasi kontak' })
  batalkan(
    @Param('schemaName') schemaName: string,
    @Param('code') code: string,
    @Body() dto: BatalkanPublikDto,
  ) {
    return this.booking.batalkanPemesanan(schemaDariUrl(schemaName), code, dto.kontak.trim(), dto.alasan);
  }
}
