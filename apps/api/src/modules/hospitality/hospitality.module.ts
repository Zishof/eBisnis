import { Module } from '@nestjs/common';
import { HospitalityPropertiController } from './hospitality-properti.controller';
import { HospitalityPropertiService } from './hospitality-properti.service';
import { HospitalityRoomBlockController } from './hospitality-room-block.controller';
import { HospitalityRoomBlockService } from './hospitality-room-block.service';
import { HospitalityGuestController } from './hospitality-guest.controller';
import { HospitalityGuestService } from './hospitality-guest.service';
import { HospitalityReservationController } from './hospitality-reservation.controller';
import { HospitalityReservationService } from './hospitality-reservation.service';
import { HospitalityBookingEngineController } from './hospitality-booking-engine.controller';
import { HospitalityBookingEngineService } from './hospitality-booking-engine.service';
import { HospitalityRateController } from './hospitality-rate.controller';
import { HospitalityRateService } from './hospitality-rate.service';
import { HospitalityPublicSiteController } from './hospitality-public-site.controller';
import { HospitalityPublicSiteService } from './hospitality-public-site.service';

@Module({
  controllers: [
    HospitalityPropertiController,
    HospitalityRoomBlockController,
    HospitalityGuestController,
    HospitalityReservationController,
    HospitalityBookingEngineController,
    HospitalityRateController,
    HospitalityPublicSiteController,
  ],
  providers: [
    HospitalityPropertiService,
    HospitalityRoomBlockService,
    HospitalityGuestService,
    HospitalityReservationService,
    HospitalityBookingEngineService,
    HospitalityRateService,
    HospitalityPublicSiteService,
  ],
})
export class HospitalityModule {}
