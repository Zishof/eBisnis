/**
 * Titik masuk HTTP resolusi situs properti dari subdomain (MI-3). Pola
 * sama dengan `pesantren-public.controller.ts`.
 */

import { Controller, Get, Headers } from '@nestjs/common';
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
      'Dipakai halaman pemesanan publik untuk memperoleh schemaName + propertyId dari host, ' +
      'lalu memanggil endpoint booking engine (MI-9) yang sudah ada seperti biasa.',
  })
  context(@Headers('host') host: string) {
    return this.situs.konteks(host);
  }
}
