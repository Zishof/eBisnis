/**
 * Titik masuk HTTP booking engine publik (MI-9) -- TANPA login staf.
 *
 * Tenant dan properti selalu ditentukan dari host terverifikasi melalui
 * `PublicTenantResolver`. Nama schema tidak pernah diterima dari URL/body.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { HospitalityBookingEngineService } from './hospitality-booking-engine.service';
import { HospitalityPublicSiteService } from './hospitality-public-site.service';
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

@ApiTags('hospitality-public')
@Controller('public/hospitality-booking')
export class HospitalityBookingEngineController {
  constructor(
    private readonly booking: HospitalityBookingEngineService,
    private readonly situs: HospitalityPublicSiteService,
  ) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Mencari tipe kamar tersedia dan terpublikasi untuk rentang menginap' })
  async cari(@Headers('host') host: string, @Query() query: CariKetersediaanQuery) {
    const konteks = await this.situs.konteks(host);
    return this.booking.cariKetersediaan(konteks.schemaName, konteks.propertyId, query);
  }

  @Public()
  @Post('reservations')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Memesan mandiri tanpa staf',
    description: 'Wajib menyertakan tajuk Idempotency-Key -- klik ganda pada koneksi lambat tidak menghasilkan pemesanan ganda.',
  })
  async pesan(
    @Headers('host') host: string,
    @Body() dto: PesanPublikDto,
    @RequestContext() meta: RequestMeta,
  ) {
    // Diratakan (bukan { reservasi, diulang } bersarang) -- pola yang
    // sama dengan HospitalityReservationController.catat(), supaya
    // kedua jalur (staf dan publik) mengembalikan bentuk yang sama bagi
    // pemanggil yang sama-sama membaca objek reservasi. Ketidaksamaan
    // ini pernah menyebabkan layar publik gagal membaca `room_stays`
    // (undefined.map) -- ditemukan lewat pengujian peramban sungguhan.
    const konteks = await this.situs.konteks(host);
    const { reservasi, diulang } = await this.booking.pesanPublik(
      konteks.schemaName,
      { ...dto, propertyId: konteks.propertyId },
      meta.idempotencyKey,
    );
    return { ...reservasi, _diulangDariPermintaanSebelumnya: diulang };
  }

  @Public()
  @Get('reservations/:code')
  @ApiOperation({ summary: 'Melihat pemesanan lewat kode + verifikasi kontak' })
  async lihat(
    @Headers('host') host: string,
    @Param('code') code: string,
    @Query('kontak') kontak: string,
  ) {
    if (!kontak?.trim()) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Kontak (email atau telepon) wajib diisi untuk verifikasi.');
    }
    const konteks = await this.situs.konteks(host);
    return this.booking.lihatPemesanan(konteks.schemaName, code, kontak.trim());
  }

  @Public()
  @Post('reservations/:code/cancel')
  @ApiOperation({ summary: 'Membatalkan pemesanan sendiri + verifikasi kontak' })
  async batalkan(
    @Headers('host') host: string,
    @Param('code') code: string,
    @Body() dto: BatalkanPublikDto,
  ) {
    const konteks = await this.situs.konteks(host);
    return this.booking.batalkanPemesanan(konteks.schemaName, code, dto.kontak.trim(), dto.alasan);
  }
}
