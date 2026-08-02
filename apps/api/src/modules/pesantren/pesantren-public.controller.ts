/**
 * Titik masuk HTTP situs pondok publik. Tanpa sesi, tanpa hak akses --
 * lihat catatan lengkap pada `PesantrenPublicService`.
 */

import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PesantrenPublicService } from './pesantren-public.service';
import { Public } from '../../common/decorators';

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
}
