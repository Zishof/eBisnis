import { Controller, Get, Headers, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';
import { InventoryPublicService } from './inventory-public.service';

@ApiTags('inventory-public')
@Controller('inventory/public')
export class InventoryPublicController {
  constructor(private readonly inventory: InventoryPublicService) {}

  @Public()
  @Get('catalog')
  @ApiOperation({ summary: 'Katalog produk publik tenant Sales dan Inventory' })
  catalog(
    @Headers('host') host: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(1, Math.min(10_000, Number.parseInt(pageRaw ?? '1', 10) || 1));
    const limit = Math.max(12, Math.min(48, Number.parseInt(limitRaw ?? '24', 10) || 24));
    return this.inventory.catalog(host, { q, category, page, limit });
  }

  @Public()
  @Get('products/:productId/image')
  @ApiOperation({ summary: 'Gambar produk dari BLOB bersama atau override tenant' })
  async image(
    @Headers('host') host: string,
    @Param('productId') productId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const media = await this.inventory.image(host, productId);
    res.set({
      'Content-Type': media.mimeType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: `"${media.etag}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    return rawResponse(new StreamableFile(media.buffer));
  }
}
