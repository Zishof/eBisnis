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
import { HospitalityChannelController } from './hospitality-channel.controller';
import { HospitalityChannelService } from './hospitality-channel.service';
import { HospitalityPlatformController } from './hospitality-platform.controller';
import { HospitalityPlatformService } from './hospitality-platform.service';
import { HospitalityFrontdeskController } from './hospitality-frontdesk.controller';
import { HospitalityFrontdeskService } from './hospitality-frontdesk.service';
import { HospitalityHousekeepingController } from './hospitality-housekeeping.controller';
import { HospitalityHousekeepingService } from './hospitality-housekeeping.service';
import { HospitalityMaintenanceController } from './hospitality-maintenance.controller';
import { HospitalityMaintenanceService } from './hospitality-maintenance.service';

@Module({
  controllers: [
    HospitalityPropertiController,
    HospitalityRoomBlockController,
    HospitalityGuestController,
    HospitalityReservationController,
    HospitalityBookingEngineController,
    HospitalityRateController,
    HospitalityPublicSiteController,
    HospitalityChannelController,
    HospitalityPlatformController,
    HospitalityFrontdeskController,
    HospitalityHousekeepingController,
    HospitalityMaintenanceController,
  ],
  providers: [
    HospitalityPropertiService,
    HospitalityRoomBlockService,
    HospitalityGuestService,
    HospitalityReservationService,
    HospitalityBookingEngineService,
    HospitalityRateService,
    HospitalityPublicSiteService,
    HospitalityChannelService,
    HospitalityPlatformService,
    HospitalityFrontdeskService,
    HospitalityHousekeepingService,
    HospitalityMaintenanceService,
  ],
})
export class HospitalityModule {}
