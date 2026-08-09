import { Body,Controller,Get,Param,Post,Query } from '@nestjs/common';
import { ApiBearerAuth,ApiProperty,ApiPropertyOptional,ApiTags } from '@nestjs/swagger';
import { IsArray,IsBoolean,IsIn,IsNumber,IsOptional,IsString,Min } from 'class-validator';
import { AuthenticatedUser,CurrentUser,Permissions,RequestContext,type RequestMeta } from '../../common/decorators';
import { AppError,ErrorCodes } from '../../common/errors/app-error';
import { HospitalityHousekeepingService } from './hospitality-housekeeping.service';

function schema(u:AuthenticatedUser){if(!u.schemaName)throw AppError.forbidden(ErrorCodes.FORBIDDEN,'Konteks ruang kerja tidak ditemukan.');return u.schemaName;}
class BoardQ{@ApiProperty()@IsString()propertyId!:string}
class TaskDto{@ApiProperty()@IsString()propertyId!:string;@ApiProperty()@IsString()roomId!:string;@ApiPropertyOptional()@IsOptional()@IsString()stayId?:string;@ApiProperty()@IsString()taskKind!:string;@ApiPropertyOptional()@IsOptional()@IsString()priority?:string;@ApiPropertyOptional()@IsOptional()@IsString()assignedTo?:string;@ApiPropertyOptional()@IsOptional()@IsString()shiftCode?:string;@ApiPropertyOptional()@IsOptional()@IsString()dueAt?:string;@ApiPropertyOptional({type:[Object]})@IsOptional()@IsArray()checklist?:unknown[];}
const ACTIONS=['START','PAUSE','COMPLETE','REQUEST_INSPECTION','INSPECT_PASS','INSPECT_FAIL','CLOSE','REFUSE'] as const;
class EventDto{@ApiProperty({enum:ACTIONS})@IsIn(ACTIONS as unknown as string[])action!:typeof ACTIONS[number];@ApiProperty()@IsString()clientOperationId!:string;@ApiProperty()@IsString()occurredAt!:string;@ApiPropertyOptional()@IsOptional()@IsString()note?:string;@ApiPropertyOptional({type:[Object]})@IsOptional()@IsArray()supplies?:unknown[];@ApiPropertyOptional({type:[Object]})@IsOptional()@IsArray()linen?:unknown[];@ApiPropertyOptional({type:[Object]})@IsOptional()@IsArray()minibar?:unknown[];@ApiPropertyOptional({type:[String]})@IsOptional()@IsArray()photos?:unknown[];@ApiPropertyOptional({type:[Object]})@IsOptional()@IsArray()checklistResult?:unknown[];}
class FlagsDto{@ApiProperty()@IsString()propertyId!:string;@ApiProperty()@IsBoolean()dnd!:boolean;@ApiProperty()@IsBoolean()serviceRefused!:boolean;@ApiPropertyOptional()@IsOptional()@IsString()discrepancyNote?:string;}
class LinenDto{@ApiProperty()@IsString()propertyId!:string;@ApiProperty()@IsString()itemCode!:string;@ApiProperty()@IsString()movement!:string;@ApiProperty()@IsNumber()@Min(0.001)quantity!:number;@ApiProperty()@IsString()occurredAt!:string;@ApiProperty()@IsString()clientOperationId!:string;@ApiPropertyOptional()@IsOptional()@IsString()fromLocation?:string;@ApiPropertyOptional()@IsOptional()@IsString()toLocation?:string;@ApiPropertyOptional()@IsOptional()@IsString()vendorName?:string;@ApiPropertyOptional()@IsOptional()@IsNumber()expectedQuantity?:number;@ApiPropertyOptional()@IsOptional()@IsNumber()discrepancyQuantity?:number;@ApiPropertyOptional()@IsOptional()@IsNumber()unitCost?:number;@ApiPropertyOptional()@IsOptional()@IsString()reason?:string;}
class LostDto{@ApiProperty()@IsString()propertyId!:string;@ApiPropertyOptional()@IsOptional()@IsString()roomId?:string;@ApiProperty()@IsString()category!:string;@ApiProperty()@IsString()description!:string;@ApiProperty()@IsString()foundLocation!:string;@ApiProperty()@IsString()foundAt!:string;@ApiProperty()@IsString()secureStorage!:string;@ApiProperty()@IsString()clientOperationId!:string;@ApiPropertyOptional({type:[String]})@IsOptional()@IsArray()photos?:unknown[];@ApiPropertyOptional()@IsOptional()@IsString()expiresAt?:string;}

@ApiTags('hospitality-housekeeping')@ApiBearerAuth('access-token')@Controller('hospitality/housekeeping')
export class HospitalityHousekeepingController{
 constructor(private readonly service:HospitalityHousekeepingService){}
 @Permissions('HOSPITALITY_HOUSEKEEPING.READ')@Get('board')board(@Query()q:BoardQ,@CurrentUser()u:AuthenticatedUser){return this.service.board(schema(u),q.propertyId);}
 @Permissions('HOSPITALITY_HOUSEKEEPING.ASSIGN')@Post('tasks')task(@Body()d:TaskDto,@RequestContext()m:RequestMeta,@CurrentUser()u:AuthenticatedUser){return this.service.createTask(schema(u),d,m.idempotencyKey,u.userId);}
 @Permissions('HOSPITALITY_HOUSEKEEPING.UPDATE')@Post('tasks/:id/event')event(@Param('id')id:string,@Body()d:EventDto,@CurrentUser()u:AuthenticatedUser){return this.service.transition(schema(u),id,d,u.userId);}
 @Permissions('HOSPITALITY_HOUSEKEEPING.UPDATE')@Post('rooms/:id/flags')flags(@Param('id')id:string,@Body()d:FlagsDto,@CurrentUser()u:AuthenticatedUser){return this.service.setRoomFlags(schema(u),id,d,u.userId);}
 @Permissions('HOSPITALITY_HOUSEKEEPING.IMPORT')@Post('linen')linen(@Body()d:LinenDto,@CurrentUser()u:AuthenticatedUser){return this.service.linen(schema(u),d,u.userId);}
 @Permissions('HOSPITALITY_HOUSEKEEPING.CREATE')@Post('lost-found')lost(@Body()d:LostDto,@CurrentUser()u:AuthenticatedUser){return this.service.lostFound(schema(u),d,u.userId);}
}
