/**
 * Titik masuk HTTP situs pondok publik. Tanpa sesi, tanpa hak akses --
 * lihat catatan lengkap pada `PesantrenPublicService`.
 */

import { Controller, Get, Headers, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PesantrenPublicService } from './pesantren-public.service';
import { KATEGORI_GAMBAR_PROFIL, KategoriGambarProfil } from './pesantren-profil';
import { Public } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';

@ApiTags('pesantren-public')
@Controller('pesantren/public')
export class PesantrenPublicController {
  constructor(private readonly situs: PesantrenPublicService) {}

  @Public()
  @Get('site')
  @ApiOperation({
    summary: 'Isi situs pondok',
    description: 'Pondok ditentukan host permintaan, bukan alamat. Hanya yang situsnya sudah diterbitkan.',
  })
  isi(@Headers('host') host: string) {
    return this.situs.situs(host);
  }

  @Public()
  @Get('berita/:id')
  @ApiOperation({ summary: 'Satu berita pondok' })
  berita(@Headers('host') host: string, @Param('id') id: string) {
    return this.situs.beritaSatu(host, id);
  }

  /**
   * Logo/gambar latar situs pondok. Disajikan dari BLOB tersimpan di skema
   * penyewa (bukan folder server) -- lihat `TenantFileBlobService`.
   *
   * Tanpa cache header agresif: pengurus yang baru saja mengganti logonya
   * seharusnya melihat perubahan itu segera, bukan versi lama yang
   * tersimpan di singgahan peramban/CDN selama berhari-hari.
   */
  @Public()
  @Get('gambar/:kategori')
  @ApiParam({ name: 'kategori', enum: KATEGORI_GAMBAR_PROFIL })
  @ApiOperation({ summary: 'Logo atau gambar latar situs pondok' })
  async gambar(
    @Headers('host') host: string,
    @Param('kategori') kategori: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const kategoriUpper = kategori.toUpperCase();
    if (!KATEGORI_GAMBAR_PROFIL.includes(kategoriUpper as KategoriGambarProfil)) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    const berkas = await this.situs.gambar(host, kategoriUpper as KategoriGambarProfil);
    res.set({
      'Content-Type': berkas.mimeType,
      'Content-Disposition': `inline; filename="${berkas.namaFile}"`,
      'Cache-Control': 'public, max-age=300',
    });
    // rawResponse: ResponseEnvelopeInterceptor membungkus SETIAP balasan
    // menjadi {success,data,...} secara default -- termasuk StreamableFile,
    // yang tanpa ini di-JSON-kan utuh (isi stream internalnya ikut
    // ter-serialisasi) alih-alih dikirim sebagai berkas biner mentah.
    return rawResponse(new StreamableFile(berkas.buffer));
  }

  /** Gambar sampul satu berita -- lihat `PesantrenPublicService.beritaGambar`. */
  @Public()
  @Get('berita-gambar/:code')
  @ApiOperation({ summary: 'Gambar sampul satu berita pondok' })
  async beritaGambar(
    @Headers('host') host: string,
    @Param('code') code: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const berkas = await this.situs.beritaGambar(host, code);
    res.set({
      'Content-Type': berkas.mimeType,
      'Content-Disposition': `inline; filename="${berkas.namaFile}"`,
      'Cache-Control': 'public, max-age=300',
    });
    return rawResponse(new StreamableFile(berkas.buffer));
  }
}
