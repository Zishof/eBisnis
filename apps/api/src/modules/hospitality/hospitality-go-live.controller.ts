import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HospitalityGoLiveService } from './hospitality-go-live.service';

function schema(user: AuthenticatedUser): string {
  if (!user.schemaName) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan.');
  return user.schemaName;
}

@ApiTags('hospitality-go-live')
@ApiBearerAuth('access-token')
@Controller('hospitality/go-live')
export class HospitalityGoLiveController {
  constructor(private readonly service: HospitalityGoLiveService) {}

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get(':propertyId/readiness')
  @ApiOperation({ summary: 'Ringkasan kelengkapan operasional properti' })
  readiness(@Param('propertyId') propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.readiness(schema(user), propertyId);
  }

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get('site/content')
  listContent(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listContent(schema(user));
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post('site/content')
  saveContent(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.saveContent(schema(user), body, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post('site/content/:id/publish')
  publishContent(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.publishContent(schema(user), id, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Post(':propertyId/active-context')
  setActiveContext(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.setActiveContext(schema(user), user.userId, propertyId, String(body.roleCode ?? 'HOSPITALITY_ADMIN'));
  }

  @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @Post(':propertyId/buildings')
  createBuilding(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createBuilding(schema(user), propertyId, body, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @Post('buildings/:buildingId/floors')
  createFloor(@Param('buildingId') buildingId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createFloor(schema(user), buildingId, body, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @Post(':propertyId/zones')
  createZone(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createZone(schema(user), propertyId, body, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @Post(':propertyId/sellable-spaces')
  createSellableSpace(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createSellableSpace(schema(user), propertyId, body, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':propertyId/inventory/reconcile')
  reconcileInventory(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reconcileInventory(schema(user), propertyId, body, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':propertyId/allotments')
  createAllotment(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createAllotment(schema(user), propertyId, body, user.userId);
  }

  @Permissions('HOSPITALITY_TAMU.UPDATE')
  @Post('guests/:guestId/relationships')
  linkGuest(@Param('guestId') guestId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.linkGuest(schema(user), guestId, body, user.userId);
  }

  @Permissions('HOSPITALITY_TAMU.UPDATE')
  @Post('guests/:guestId/loyalty')
  addLoyalty(@Param('guestId') guestId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addLoyalty(schema(user), guestId, body);
  }

  @Permissions('HOSPITALITY_RESERVASI.CREATE')
  @Post(':propertyId/quotes')
  createQuote(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createQuote(schema(user), propertyId, body, user.userId);
  }

  @Permissions('HOSPITALITY_RESERVASI.CREATE')
  @Post(':propertyId/waitlist')
  createWaitlist(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createWaitlist(schema(user), propertyId, body, user.userId);
  }

  @Permissions('HOSPITALITY_RESERVASI.CREATE')
  @Post(':propertyId/payment-intents')
  createPaymentIntent(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createPaymentIntent(schema(user), propertyId, body);
  }

  @Permissions('HOSPITALITY_RESERVASI.CREATE')
  @Post(':propertyId/booking-recovery')
  saveRecovery(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.saveRecovery(schema(user), propertyId, body);
  }

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Post(':propertyId/revenue/forecast')
  generateForecast(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.generateForecast(schema(user), propertyId, String(body.startDate ?? ''), Number(body.days ?? 30));
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':propertyId/revenue/recommendations')
  createRecommendation(@Param('propertyId') propertyId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createRecommendation(schema(user), propertyId, body);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post('revenue/recommendations/:id/review')
  reviewRecommendation(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reviewRecommendation(schema(user), id, String(body.decision ?? ''), typeof body.note === 'string' ? body.note : undefined, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post('revenue/recommendations/:id/publish')
  publishRecommendation(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.publishRecommendation(schema(user), id, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':propertyId/channels/process')
  processChannel(@Param('propertyId') propertyId: string, @Query('limit') limit: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.service.processChannel(schema(user), propertyId, Number(limit ?? 20));
  }
}
