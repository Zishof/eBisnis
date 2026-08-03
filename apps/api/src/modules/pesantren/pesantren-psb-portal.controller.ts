/**
 * Portal pendaftar PSB -- dasbor untuk CALON SANTRI SENDIRI, bukan pengurus.
 *
 * Auth terpisah total dari staf: lihat `PsbApplicantAuthGuard` untuk alasan
 * lengkapnya. Setiap endpoint di sini ditandai `@Public()` (supaya guard
 * global staf lewat begitu saja) SEKALIGUS `@UseGuards(PsbApplicantAuthGuard)`
 * (yang benar-benar memeriksa token portal ini).
 *
 * Setiap operasi hanya menyentuh data pendaftar YANG SEDANG MASUK
 * (`ctx.pendaftarId` dari token, bukan parameter permintaan) -- pola sama
 * dengan `PesantrenPortalWaliController`: pemanggil tidak pernah dapat
 * memilih baris siapa pun selain miliknya sendiri.
 */

import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import { Public } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';
import { PesantrenPsbService } from './pesantren-psb.service';
import { TenantFileBlobService } from '../../infrastructure/files/tenant-file-blob.service';
import { CurrentPendaftar, PsbApplicantAuthGuard, PsbApplicantContext } from './psb-applicant-auth.guard';
import { DataOrangTuaDto } from './pesantren-santri.controller';

const MIME_BUKTI_BAYAR_SAH = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const UKURAN_MAKSIMUM_BYTES = 5 * 1024 * 1024;

type BerkasUnggahan = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

/** Kode `file_object` bukti bayar -- satu per pendaftar, unggah ulang mengganti. */
function kodeBuktiBayar(pendaftarId: string): string {
  return `PSB_BUKTI_BAYAR_${pendaftarId}`;
}

class PerbaruiBiodataSendiriDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  alamat?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  telepon?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  hp?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(255)
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  namaOrangTua?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32)
  noHpOrangTua?: string;

  @ApiPropertyOptional({ type: DataOrangTuaDto })
  @IsOptional() @ValidateNested() @Type(() => DataOrangTuaDto)
  ayah?: DataOrangTuaDto;

  @ApiPropertyOptional({ type: DataOrangTuaDto })
  @IsOptional() @ValidateNested() @Type(() => DataOrangTuaDto)
  ibu?: DataOrangTuaDto;

  @ApiPropertyOptional({ type: DataOrangTuaDto, description: 'Diisi hanya bila bukan ayah/ibu kandung.' })
  @IsOptional() @ValidateNested() @Type(() => DataOrangTuaDto)
  wali?: DataOrangTuaDto;
}

@ApiTags('pesantren-psb-portal')
@Controller('pesantren/psb-portal')
export class PesantrenPsbPortalController {
  constructor(
    private readonly psb: PesantrenPsbService,
    private readonly fileBlob: TenantFileBlobService,
  ) {}

  @Public()
  @UseGuards(PsbApplicantAuthGuard)
  @Get('saya')
  @ApiOperation({ summary: 'Status dan biodata pendaftar yang sedang masuk' })
  async saya(@CurrentPendaftar() ctx: PsbApplicantContext) {
    const pendaftar = await this.psb.satuPendaftar(ctx.schemaName, ctx.pendaftarId);
    if (!pendaftar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftar tidak ditemukan.');
    }
    return pendaftar;
  }

  @Public()
  @UseGuards(PsbApplicantAuthGuard)
  @Put('biodata')
  @ApiOperation({ summary: 'Memperbarui biodata dan data orang tua sendiri' })
  perbaruiBiodata(@Body() dto: PerbaruiBiodataSendiriDto, @CurrentPendaftar() ctx: PsbApplicantContext) {
    return this.psb.perbaruiBiodataSendiri(ctx.schemaName, ctx.pendaftarId, dto);
  }

  @Public()
  @UseGuards(PsbApplicantAuthGuard)
  @Get('jadwal')
  @ApiOperation({ summary: 'Jadwal ujian/wawancara sendiri' })
  jadwal(@CurrentPendaftar() ctx: PsbApplicantContext) {
    return this.psb.daftarJadwal(ctx.schemaName, ctx.pendaftarId);
  }

  /**
   * Bukti pembayaran biaya pendaftaran -- disimpan BLOB per pendaftar,
   * unggah ulang mengganti (pola sama dengan logo/hero pondok, lihat
   * `TenantFileBlobService`). Verifikasi pembayarannya sendiri tetap
   * pekerjaan pengurus lewat panel admin -- endpoint ini hanya penyimpanan
   * berkasnya.
   */
  @Public()
  @UseGuards(PsbApplicantAuthGuard)
  @Post('bukti-bayar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mengunggah/mengganti bukti pembayaran biaya pendaftaran' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UKURAN_MAKSIMUM_BYTES } }))
  async unggahBuktiBayar(
    @UploadedFile() file: BerkasUnggahan | undefined,
    @CurrentPendaftar() ctx: PsbApplicantContext,
  ) {
    if (!file) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Berkas bukti pembayaran wajib disertakan.');
    }
    if (!MIME_BUKTI_BAYAR_SAH.has(file.mimetype)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Jenis berkas tidak didukung. Gunakan JPEG, PNG, WEBP, atau PDF.',
      );
    }
    await this.fileBlob.simpanTunggal(
      ctx.schemaName,
      {
        code: kodeBuktiBayar(ctx.pendaftarId),
        name: `Bukti Bayar Pendaftaran - ${ctx.pendaftarId}`,
        filename: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      },
      ctx.pendaftarId,
    );
    return { status: 'ok' as const };
  }

  @Public()
  @UseGuards(PsbApplicantAuthGuard)
  @Get('bukti-bayar')
  @ApiOperation({ summary: 'Mengunduh bukti pembayaran yang sudah diunggah sendiri' })
  async lihatBuktiBayar(
    @CurrentPendaftar() ctx: PsbApplicantContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const berkas = await this.fileBlob.ambilByCode(ctx.schemaName, kodeBuktiBayar(ctx.pendaftarId));
    if (!berkas) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Bukti pembayaran belum diunggah.');
    }
    res.set({
      'Content-Type': berkas.mimeType,
      'Content-Disposition': `inline; filename="${berkas.namaFile}"`,
    });
    return rawResponse(new StreamableFile(berkas.buffer));
  }
}
