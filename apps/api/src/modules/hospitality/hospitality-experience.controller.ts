import{Body,Controller,Get,Headers,Param,Post,Query}from'@nestjs/common';import{ApiBearerAuth,ApiTags}from'@nestjs/swagger';import{AuthenticatedUser,CurrentUser,Permissions,Public}from'../../common/decorators';import{AppError,ErrorCodes}from'../../common/errors/app-error';import{HospitalityExperienceService}from'./hospitality-experience.service';function sc(u:AuthenticatedUser){if(!u.schemaName)throw AppError.forbidden(ErrorCodes.FORBIDDEN,'Tenant tidak tersedia.');return u.schemaName}@ApiTags('hospitality-experience')@ApiBearerAuth('access-token')@Controller('hospitality/experience')export class HospitalityExperienceController{constructor(private readonly s:HospitalityExperienceService){}@Permissions('HOSPITALITY_EXPERIENCE.CREATE')@Post('portal-sessions')session(@Body()b:any,@CurrentUser()u:AuthenticatedUser){return this.s.portalSession(sc(u),b)}
  /*
   * `portal`/`kiosk`/`kiosk/:id/verify` -- TIGA endpoint TAMU/KIOSK, bukan
   * staf. Sebelumnya memakai `@CurrentUser()` staf seperti endpoint biasa,
   * padahal `HospitalityExperienceService` di baliknya SUDAH dirancang
   * benar sebagai mekanisme tanpa login staf (verifikasi lewat hash token
   * sesi tamu/kiosk, bukan JWT) -- tamu/perangkat kiosk sungguhan (tanpa
   * kredensial staf) tidak pernah bisa mencapainya sama sekali. Ditemukan
   * lewat UAT sungguhan, bukan tsc/lint (lihat
   * docs/mitrainap/24-uat-persona-execution-2026-08-10.md).
   *
   * Diperbaiki dengan `@Public()` + resolusi tenant dari HOST permintaan
   * lewat `PublicTenantResolver` (IR-005) -- pola sama persis dengan situs
   * properti publik MI-3 (`HospitalityPublicSiteService`), BUKAN mekanisme
   * baru. `propertyId` pada `kiosk()` SENGAJA tidak lagi dipercaya dari
   * body permintaan (siapa pun dapat mengirim body apa pun ke endpoint
   * publik) -- diambil dari hasil resolusi host, konsisten dengan
   * "properti implisit aktif" yang sudah dipakai `HospitalityPublicSiteService`.
   */
  @Public()@Get('portal')async portal(@Headers('host')host:string,@Headers('x-guest-session')t:string){const{schemaName}=await this.s.konteksTamu(host);return this.s.portal(schemaName,t)}
  @Public()@Post('kiosk')async kiosk(@Headers('host')host:string,@Body()b:any){const{schemaName,propertyId}=await this.s.konteksTamu(host);return this.s.kiosk(schemaName,propertyId,b)}
  @Public()@Post('kiosk/:id/verify')async verify(@Headers('host')host:string,@Param('id')id:string,@Body()b:any){const{schemaName}=await this.s.konteksTamu(host);return this.s.verifyKiosk(schemaName,id,b)}
@Permissions('HOSPITALITY_EXPERIENCE.UPDATE')@Post('providers')provider(@Body()b:any,@CurrentUser()u:AuthenticatedUser){return this.s.provider(sc(u),b)}@Permissions('HOSPITALITY_EXPERIENCE.UPDATE')@Post('mobile/sync')mobile(@Body()b:any,@CurrentUser()u:AuthenticatedUser){return this.s.mobile(sc(u),b,u.userId)}@Permissions('HOSPITALITY_EXPERIENCE.APPROVE')@Post('privacy/purge')purge(@CurrentUser()u:AuthenticatedUser){return this.s.purge(sc(u))}@Permissions('HOSPITALITY_EXPERIENCE.READ')@Get('providers')dash(@Query('propertyId')p:string,@CurrentUser()u:AuthenticatedUser){return this.s.dashboard(sc(u),p)}}
