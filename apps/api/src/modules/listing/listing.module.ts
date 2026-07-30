import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  Permissions,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { OnlineListingService, type ListingActor } from './online-listing.service';
import { buildEmbedUrl, parseYoutubeUrl } from './youtube.util';

class CreateListingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: ['NEW', 'USED', 'REFURBISHED'] })
  @IsOptional()
  @IsIn(['NEW', 'USED', 'REFURBISHED'])
  condition?: string;
}

class YoutubeDto {
  @ApiPropertyOptional({
    description: 'URL video YouTube. Kosongkan untuk melepas video.',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;
}

class UnpublishDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

function actorOf(user: AuthenticatedUser, meta: RequestMeta): ListingActor {
  if (!user.tenantId || !user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terhubung ke tenant mana pun.');
  }
  return {
    userId: user.userId,
    username: user.username,
    tenantId: user.tenantId,
    schemaName: user.schemaName,
    requestId: meta.requestId,
  };
}

@ApiTags('listing')
@ApiBearerAuth('access-token')
@Controller('seller/listings')
export class SellerListingController {
  constructor(private readonly listings: OnlineListingService) {}

  @Get()
  @Permissions('ONLINE_LISTING.READ')
  @ApiOperation({ summary: 'Daftar listing online tenant' })
  list(
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.listings.list(actorOf(user, meta), status);
  }

  @Get(':id')
  @Permissions('ONLINE_LISTING.READ')
  @ApiOperation({ summary: 'Detail listing beserta varian dan medianya' })
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.listings.load(actorOf(user, meta), id);
  }

  @Post()
  @Permissions('ONLINE_LISTING.CREATE')
  @BlockDemo()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Membuat listing untuk satu produk',
    description: 'Idempoten: satu produk hanya boleh punya satu listing aktif.',
  })
  create(
    @Body() dto: CreateListingDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.listings.create(actorOf(user, meta), dto);
  }

  @Get(':id/publication-gate')
  @Permissions('ONLINE_LISTING.READ')
  @ApiOperation({
    summary: 'Syarat publikasi beserta yang belum terpenuhi',
    description:
      'Seluruh syarat diperiksa, bukan berhenti pada yang pertama gagal, agar penjual ' +
      'dapat menyelesaikan semuanya sekaligus.',
  })
  gate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.listings.evaluateGate(actorOf(user, meta), id);
  }

  @Post(':id/youtube')
  @Permissions('ONLINE_LISTING.UPDATE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyimpan video YouTube produk',
    description:
      'Yang disimpan adalah id video, bukan URL yang dikirim. Alamat embed dibangun ' +
      'sistem, sehingga masukan penjual tidak pernah menjadi bagian dari HTML.',
  })
  setYoutube(
    @Param('id') id: string,
    @Body() dto: YoutubeDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.listings.setYoutubeUrl(actorOf(user, meta), id, dto.url ?? null);
  }

  @Post('youtube/preview')
  @Permissions('ONLINE_LISTING.READ')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Memeriksa URL YouTube tanpa menyimpannya',
    description: 'Dipakai UI untuk menampilkan pratinjau sebelum penjual menyimpan.',
  })
  previewYoutube(@Body() dto: YoutubeDto) {
    const parsed = parseYoutubeUrl(dto.url ?? null);
    if (!parsed.ok) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `URL tidak dapat dipakai: ${parsed.reason}`);
    }
    return {
      videoId: parsed.videoId,
      embedUrl: parsed.embedUrl,
      thumbnailUrl: parsed.thumbnailUrl,
    };
  }

  @Post(':id/publish')
  @Permissions('ONLINE_LISTING.PUBLISH')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menerbitkan listing',
    description:
      'Gerbang dijalankan ulang, tidak mengandalkan hasil tersimpan. Hasil lama dapat ' +
      'sudah usang bila gambar dihapus atau penjual ditangguhkan sejak pemeriksaan terakhir.',
  })
  publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.listings.publish(actorOf(user, meta), id);
  }

  @Post(':id/unpublish')
  @Permissions('ONLINE_LISTING.UNPUBLISH')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({ summary: 'Menarik listing dari publikasi' })
  unpublish(
    @Param('id') id: string,
    @Body() dto: UnpublishDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.listings.unpublish(actorOf(user, meta), id, dto.reason);
  }

  @Get(':id/youtube/embed')
  @Permissions('ONLINE_LISTING.READ')
  @ApiOperation({ summary: 'Alamat embed yang dibangun dari id tersimpan' })
  async embed(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const listing = (await this.listings.load(actorOf(user, meta), id)) as {
      youtube_video_id?: string | null;
    };
    const videoId = listing.youtube_video_id;
    if (!videoId) return { videoId: null, embedUrl: null };
    return { videoId, embedUrl: buildEmbedUrl(videoId) };
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [SellerListingController],
  providers: [OnlineListingService],
  exports: [OnlineListingService],
})
export class ListingModule {}
