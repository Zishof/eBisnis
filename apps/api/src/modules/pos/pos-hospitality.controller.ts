import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PosHospitalityService } from './pos-hospitality.service';
function schema(u:AuthenticatedUser){if(!u.schemaName)throw AppError.forbidden(ErrorCodes.FORBIDDEN,'Konteks tenant tidak tersedia.');return u.schemaName;}
@ApiTags('POS Hospitality') @ApiBearerAuth('access-token') @Controller('pos/hospitality') export class PosHospitalityController{constructor(private readonly s:PosHospitalityService){}
@Permissions('POS_SALE.UPDATE') @Post('outlets') outlet(@Body()b:any,@CurrentUser()u:AuthenticatedUser){return this.s.linkOutlet(schema(u),b)}
@Permissions('POS_SALE.READ') @Get('guests') guests(@Query('propertyId')p:string,@Query('q')q:string,@CurrentUser()u:AuthenticatedUser){return this.s.lookup(schema(u),p,q??'')}
@Permissions('POS_SALE.UPDATE') @Post('sales/:id/context') context(@Param('id')id:string,@Body()b:any,@CurrentUser()u:AuthenticatedUser){return this.s.attach(schema(u),id,b)}
@Permissions('POS_SALE.SELL') @Post('meal-entitlements/consume') meal(@Body()b:any,@Headers('idempotency-key')k:string|undefined,@CurrentUser()u:AuthenticatedUser){return this.s.consumeMeal(schema(u),b,k)}
@Permissions('POS_SALE.SELL') @Post('sales/:id/room-charge') charge(@Param('id')id:string,@Headers('idempotency-key')k:string|undefined,@CurrentUser()u:AuthenticatedUser){return this.s.chargeRoom(schema(u),id,k,u.userId)}
@Permissions('POS_SALE.UPDATE') @Post('sales/:id/kitchen/:status') kitchen(@Param('id')id:string,@Param('status')status:string,@CurrentUser()u:AuthenticatedUser){return this.s.kitchen(schema(u),id,status)} }
