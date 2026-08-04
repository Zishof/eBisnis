/**
 * Titik masuk HTTP situs pondok publik. Tanpa sesi, tanpa hak akses --
 * lihat catatan lengkap pada `PesantrenPublicService`.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PesantrenPublicService } from './pesantren-public.service';
import { KATEGORI_GAMBAR_PROFIL, KategoriGambarProfil } from './pesantren-profil';
import { KATEGORI_GAMBAR_UNIT_PENDIDIKAN, KategoriGambarUnitPendidikan } from './pesantren-unit-pendidikan';
import { DaftarkanPendaftarDto } from './pesantren-psb.controller';
import { Public } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';

class MasukPsbDto {
  @ApiProperty({ description: 'Nomor pendaftaran, diberikan sesaat setelah mendaftar' })
  @IsString()
  @MaxLength(40)
  nomorPendaftaran!: string;

  @ApiProperty({ description: 'Tanggal lahir sebagai kata sandi, format YYYY-MM-DD' })
  @IsString()
  tanggalLahir!: string;
}

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
  @Get('unit/:slug')
  @ApiOperation({ summary: 'Halaman publik satu unit pendidikan' })
  unit(@Headers('host') host: string, @Param('slug') slug: string) {
    return this.situs.unit(host, slug);
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

  /** Logo/foto hero satu unit pendidikan. */
  @Public()
  @Get('unit-gambar/:id/:kategori')
  @ApiParam({ name: 'kategori', enum: KATEGORI_GAMBAR_UNIT_PENDIDIKAN })
  @ApiOperation({ summary: 'Logo atau gambar latar satu unit pendidikan' })
  async unitGambar(
    @Headers('host') host: string,
    @Param('id') id: string,
    @Param('kategori') kategori: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const kategoriUpper = kategori.toUpperCase();
    if (!KATEGORI_GAMBAR_UNIT_PENDIDIKAN.includes(kategoriUpper as KategoriGambarUnitPendidikan)) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    const berkas = await this.situs.unitGambar(host, id, kategoriUpper as KategoriGambarUnitPendidikan);
    res.set({
      'Content-Type': berkas.mimeType,
      'Content-Disposition': `inline; filename="${berkas.namaFile}"`,
      'Cache-Control': 'public, max-age=300',
    });
    return rawResponse(new StreamableFile(berkas.buffer));
  }

  /** Daftar agama untuk combobox formulir -- lihat `PesantrenPublicService.daftarAgama`. */
  @Public()
  @Get('agama')
  @ApiOperation({ summary: 'Daftar agama (combobox formulir)' })
  agama(@Headers('host') host: string) {
    return this.situs.daftarAgama(host);
  }

  /** Seluruh gelombang PSB yang layak ditampilkan publik -- lihat `PesantrenPublicService.psbGelombangPublik`. */
  @Public()
  @Get('psb/gelombang')
  @ApiOperation({ summary: 'Seluruh gelombang PSB (dibuka, ditutup, selesai) untuk halaman landing PSB' })
  psbGelombang(@Headers('host') host: string) {
    return this.situs.psbGelombangPublik(host);
  }

  /**
   * Pendaftaran calon santri baru lewat situs publik -- lihat
   * `PesantrenPublicService.psbDaftar`.
   *
   * Pembatas laju MEWAJIBKAN, bukan sekadar berjaga-jaga: tanpa sesi dan
   * tanpa hak akses, jalur ini adalah satu-satunya permukaan tulis publik
   * pada modul pesantren yang benar-benar membuat baris baru di basis
   * data. Angkanya (10/jam) sengaja longgar bagi pendaftar sungguhan
   * (yang mengirim sekali) tetapi memangkas kiriman bertubi-tubi dari satu
   * sumber -- pola sama dengan `CooperativePublicController`.
   */
  @Public()
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  @Post('psb/daftar')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mendaftarkan calon santri baru lewat situs publik' })
  psbDaftar(@Headers('host') host: string, @Body() dto: DaftarkanPendaftarDto) {
    return this.situs.psbDaftar(host, dto);
  }

  /**
   * Masuk ke portal pendaftar PSB -- lihat `PesantrenPublicService.psbMasuk`.
   *
   * Pembatas laju MEWAJIBKAN di sini juga: "kata sandi"-nya hanya tanggal
   * lahir (~29.200 kemungkinan dalam rentang wajar), jauh lebih mudah
   * ditebak daripada kata sandi sungguhan. Lebih ketat dari `psb/daftar`
   * (5/15 menit, bukan 10/jam) sebab ini percobaan masuk berulang per
   * sumber, bukan pengiriman formulir sekali.
   */
  @Public()
  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  @Post('psb/masuk')
  @HttpCode(200)
  @ApiOperation({ summary: 'Masuk ke portal pendaftar PSB (nomor pendaftaran + tanggal lahir)' })
  psbMasuk(@Headers('host') host: string, @Body() dto: MasukPsbDto) {
    return this.situs.psbMasuk(host, dto);
  }
}
