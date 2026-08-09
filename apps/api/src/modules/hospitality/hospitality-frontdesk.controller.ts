import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions, RequestContext, type RequestMeta } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HospitalityFrontdeskService } from './hospitality-frontdesk.service';
import { JENIS_KUNCI } from './hospitality-frontdesk';

function schema(user: AuthenticatedUser): string {
  if (!user.schemaName) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan.');
  return user.schemaName;
}

class BoardQuery {
  @ApiProperty() @IsString() propertyId!: string;
  @ApiPropertyOptional({ example: '2026-08-09' }) @IsOptional() @IsString() businessDate?: string;
}
class PreArrivalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() eta?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() transportNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preArrivalNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specialRequestNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() digitalKeyEligible?: boolean;
}
class CheckinDto {
  @ApiProperty() @IsString() roomId!: string;
  @ApiProperty() @IsBoolean() identityVerified!: boolean;
  @ApiProperty() @IsBoolean() guaranteeConfirmed!: boolean;
  @ApiProperty() @IsBoolean() registrationCardSigned!: boolean;
  @ApiProperty() @IsBoolean() roomReady!: boolean;
  @ApiProperty({ enum: JENIS_KUNCI }) @IsIn(JENIS_KUNCI as unknown as string[]) keyType!: 'PHYSICAL' | 'DIGITAL';
  @ApiProperty() @IsString() keyValidUntil!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lateCheckoutUntil?: string;
}
class MoveDto {
  @ApiProperty() @IsString() toRoomId!: string;
  @ApiProperty() @IsString() reason!: string;
  @ApiProperty({ enum: JENIS_KUNCI }) @IsIn(JENIS_KUNCI as unknown as string[]) keyType!: 'PHYSICAL' | 'DIGITAL';
  @ApiProperty() @IsString() keyValidUntil!: string;
}
class DatesDto {
  @ApiProperty() @IsString() checkinDate!: string;
  @ApiProperty() @IsString() checkoutDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lateCheckoutUntil?: string;
}
class CheckoutDto { @ApiPropertyOptional() @IsOptional() @IsString() forwardingPreference?: string; }
class HandoverDto {
  @ApiProperty() @IsString() propertyId!: string;
  @ApiProperty() @IsString() shiftCode!: string;
  @ApiProperty() @IsString() notes!: string;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() unresolvedItems?: unknown[];
}

@ApiTags('hospitality-frontdesk')
@ApiBearerAuth('access-token')
@Controller('hospitality/frontdesk')
export class HospitalityFrontdeskController {
  constructor(private readonly service: HospitalityFrontdeskService) {}

  @Permissions('HOSPITALITY_FRONTDESK.READ')
  @Get('board')
  @ApiOperation({ summary: 'Arrivals, departures, dan in-house pada business date' })
  board(@Query() q: BoardQuery, @CurrentUser() u: AuthenticatedUser) { return this.service.board(schema(u), q.propertyId, q.businessDate); }

  @Permissions('HOSPITALITY_FRONTDESK.UPDATE')
  @Post('room-stays/:id/pre-arrival')
  preArrival(@Param('id') id: string, @Body() dto: PreArrivalDto, @CurrentUser() u: AuthenticatedUser) {
    return this.service.preArrival(schema(u), id, dto, u.userId);
  }

  @Permissions('HOSPITALITY_FRONTDESK.CHECKIN')
  @Post('room-stays/:id/check-in')
  checkin(@Param('id') id: string, @Body() dto: CheckinDto, @RequestContext() meta: RequestMeta, @CurrentUser() u: AuthenticatedUser) {
    return this.service.checkin(schema(u), id, dto, meta.idempotencyKey, u.userId);
  }

  @Permissions('HOSPITALITY_FRONTDESK.ROOM_MOVE')
  @Post('stays/:id/room-move')
  move(@Param('id') id: string, @Body() dto: MoveDto, @RequestContext() meta: RequestMeta, @CurrentUser() u: AuthenticatedUser) {
    return this.service.moveRoom(schema(u), id, dto, meta.idempotencyKey, u.userId);
  }

  @Permissions('HOSPITALITY_FRONTDESK.UPDATE')
  @Post('stays/:id/dates')
  dates(@Param('id') id: string, @Body() dto: DatesDto, @CurrentUser() u: AuthenticatedUser) {
    return this.service.changeStayDates(schema(u), id, dto, u.userId);
  }

  @Permissions('HOSPITALITY_FRONTDESK.CHECKOUT')
  @Post('stays/:id/check-out')
  checkout(@Param('id') id: string, @Body() dto: CheckoutDto, @RequestContext() meta: RequestMeta, @CurrentUser() u: AuthenticatedUser) {
    return this.service.checkout(schema(u), id, dto, meta.idempotencyKey, u.userId);
  }

  @Permissions('HOSPITALITY_FRONTDESK.HANDOVER')
  @Post('handover')
  handover(@Body() dto: HandoverDto, @CurrentUser() u: AuthenticatedUser) { return this.service.handover(schema(u), dto, u.userId); }
}
