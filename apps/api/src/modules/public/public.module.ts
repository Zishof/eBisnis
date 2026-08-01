import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicSiteService } from './public-site.service';
import { RegistrationService } from './registration.service';
import { PesantrenRegistrationController } from './pesantren-registration.controller';
import { PesantrenRegistrationService } from './pesantren-registration.service';
import { ContactService } from './contact.service';

@Module({
  controllers: [PublicController, PesantrenRegistrationController],
  providers: [
    PublicSiteService,
    RegistrationService,
    PesantrenRegistrationService,
    ContactService,
  ],
  exports: [PublicSiteService, RegistrationService, PesantrenRegistrationService],
})
export class PublicModule {}
