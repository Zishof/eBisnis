/**
 * Titik masuk HTTP resolusi situs properti dari subdomain (MI-3). Pola
 * sama dengan `pesantren-public.controller.ts`.
 */

import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HospitalityPublicSiteService } from './hospitality-public-site.service';
import { Public } from '../../common/decorators';

@ApiTags('hospitality-public')
@Controller('public/hospitality-site')
export class HospitalityPublicSiteController {
  constructor(private readonly situs: HospitalityPublicSiteService) {}

  @Public()
  @Get('context')
  @ApiOperation({
    summary: 'Resolusi properti dari subdomain permintaan (<slug>.mitrainap.id)',
    description:
      'Dipakai halaman pemesanan publik untuk memperoleh identitas properti dari host. ' +
      'Nama schema tetap hanya berada di backend.',
  })
  async context(@Headers('host') host: string) {
    const konteks = await this.situs.konteks(host);
    return {
      propertyId: konteks.propertyId,
      propertyName: konteks.propertyName,
      timezone: konteks.timezone,
    };
  }

  @Public()
  @Get('content')
  @ApiOperation({ summary: 'Konten CMS terpublikasi untuk situs properti pada host aktif' })
  content(@Headers('host') host: string, @Query('slug') slug?: string) {
    return this.situs.konten(host, slug);
  }
}
