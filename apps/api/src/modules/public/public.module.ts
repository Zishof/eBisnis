import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicSiteService } from './public-site.service';
import { RegistrationService } from './registration.service';
import { PesantrenRegistrationController } from './pesantren-registration.controller';
import { PesantrenRegistrationService } from './pesantren-registration.service';
import { ContactService } from './contact.service';
import { PosUpdateController } from './pos-update.controller';

@Module({
  controllers: [PublicController, PesantrenRegistrationController, PosUpdateController],
  providers: [
    PublicSiteService,
    RegistrationService,
    PesantrenRegistrationService,
    ContactService,
  ],
  exports: [PublicSiteService, RegistrationService, PesantrenRegistrationService],
})
export class PublicModule {}
