import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicSiteService } from './public-site.service';
import { RegistrationService } from './registration.service';
import { ContactService } from './contact.service';

@Module({
  controllers: [PublicController],
  providers: [PublicSiteService, RegistrationService, ContactService],
  exports: [PublicSiteService, RegistrationService],
})
export class PublicModule {}
