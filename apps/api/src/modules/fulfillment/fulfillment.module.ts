/**
 * Pemenuhan pesanan marketplace.
 *
 * Seluruh endpoint di sini milik penjual: gudangnya, barangnya, petugasnya.
 * Tidak ada endpoint publik — pembeli melihat kemajuan lewat status pesanan,
 * bukan lewat isi gudang penjual.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
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
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FulfillmentService, type FulfillmentActor } from './fulfillment.service';

class CreateFulfillmentDto {
  @ApiProperty()
  @IsUUID()
  marketplaceOrderId!: string;
}

class PickLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  pickedQty!: number;

  @ApiPropertyOptional({ description: 'Wajib bila jumlah yang diambil kurang dari yang dipesan.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  discrepancyReason?: string;
}

class RecordPickDto {
  @ApiProperty({ type: [PickLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickLineDto)
  picks!: PickLineDto[];
}

class PackageLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

class CreatePackageDto {
  @ApiProperty({ minimum: 1, description: 'Berat setelah dikemas, bukan jumlah berat barang.' })
  @IsInt()
  @Min(1)
  weightGram!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  lengthMm!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  widthMm!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  heightMm!: number;

  @ApiProperty({ type: [PackageLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageLineDto)
  lines!: PackageLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class ShipDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  carrierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  serviceCode?: string;

  @ApiPropertyOptional({ description: 'Nomor resi dari ekspedisi. Kosong bila belum ada.' })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  trackingNumber?: string;
}

class TrackingEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(48)
  eventCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiProperty()
  @IsISO8601()
  occurredAt!: string;

  @ApiPropertyOptional({ description: 'Pengenal peristiwa dari ekspedisi, untuk menolak kiriman ulang.' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceEventId?: string;
}

@ApiTags('pemenuhan')
@ApiBearerAuth('access-token')
@Controller('seller/fulfillment')
export class FulfillmentController {
  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Permissions('FULFILLMENT_ORDER.READ')
  @ApiQuery({ name: 'status', required: false })
  @ApiOperation({ summary: 'Perintah pemenuhan pada gudang tenant' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
    @Query('status') status?: string,
  ) {
    return this.fulfillment.list(await this.actorOf(user, meta), status);
  }

  @Get(':id')
  @Permissions('FULFILLMENT_ORDER.READ')
  @ApiOperation({ summary: 'Detail perintah pemenuhan' })
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.fulfillment.load(await this.actorOf(user, meta), id);
  }

  @Post()
  @Permissions('FULFILLMENT_ORDER.CREATE')
  @BlockDemo()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Membuat perintah pemenuhan dari pesanan yang sudah dibayar',
    description:
      'Idempoten. Pesanan yang belum lunas ditolak — menyiapkan barang untuk pesanan yang ' +
      'mungkin tidak pernah jadi membuang pekerjaan gudang.',
  })
  async create(
    @Body() dto: CreateFulfillmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const actor = await this.actorOf(user, meta);
    const id = await this.fulfillment.createFromOrder(actor, dto.marketplaceOrderId);
    return this.fulfillment.load(actor, id);
  }

  @Post(':id/pick')
  @Permissions('FULFILLMENT_ORDER.UPDATE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mencatat hasil pengambilan',
    description:
      'Kekurangan diizinkan bila beralasan; kelebihan ditolak karena berarti barang milik ' +
      'pesanan lain ikut terbawa.',
  })
  async pick(
    @Param('id') id: string,
    @Body() dto: RecordPickDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.fulfillment.recordPick(await this.actorOf(user, meta), id, dto.picks);
  }

  @Post(':id/packages')
  @Permissions('FULFILLMENT_ORDER.UPDATE')
  @BlockDemo()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Membuat paket dari barang yang sudah diambil',
    description:
      'Berat dan dimensi wajib: ekspedisi menagih berdasarkan yang ditimbang, bukan ' +
      'berdasarkan berat barang yang dijumlahkan.',
  })
  async pack(
    @Param('id') id: string,
    @Body() dto: CreatePackageDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.fulfillment.createPackage(await this.actorOf(user, meta), id, dto);
  }

  @Post(':id/ship')
  @Permissions('FULFILLMENT_ORDER.UPDATE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mencatat penyerahan ke ekspedisi',
    description:
      'Nomor resi diisi pemanggil, bukan dibuat sistem. Pemesanan kurir lewat API belum ' +
      'tersambung, dan nomor yang dikarang membuat pembeli melacak ke halaman yang tidak ada.',
  })
  async ship(
    @Param('id') id: string,
    @Body() dto: ShipDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.fulfillment.ship(await this.actorOf(user, meta), id, dto);
  }

  @Post('shipments/:id/tracking')
  @Permissions('FULFILLMENT_ORDER.UPDATE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mencatat peristiwa pelacakan',
    description: 'Peristiwa yang sama dari ekspedisi tidak tercatat berulang.',
  })
  async track(
    @Param('id') id: string,
    @Body() dto: TrackingEventDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    await this.fulfillment.recordTrackingEvent(await this.actorOf(user, meta), id, {
      eventCode: dto.eventCode,
      description: dto.description,
      location: dto.location,
      occurredAt: new Date(dto.occurredAt),
      sourceEventId: dto.sourceEventId,
    });
    return { recorded: true };
  }

  /**
   * Nama schema diambil dari registry, tidak pernah dari permintaan.
   *
   * Ini yang menjaga agar sesi satu tenant tidak dapat menyentuh gudang tenant
   * lain dengan mengirim nama schema yang berbeda.
   */
  private async actorOf(user: AuthenticatedUser, meta: RequestMeta): Promise<FulfillmentActor> {
    if (!user.tenantId) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terhubung ke tenant mana pun.');
    }
    const registry = await this.prisma.tenantSchemaRegistry.findFirst({
      where: { tenantId: user.tenantId },
      select: { schemaName: true },
    });
    if (!registry) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Schema tenant tidak ditemukan.');
    }
    return {
      tenantId: user.tenantId,
      schemaName: registry.schemaName,
      userId: user.userId,
      username: user.username,
      requestId: meta.requestId,
    };
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
