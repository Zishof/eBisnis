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
import { HospitalityFolioController } from './hospitality-folio.controller';
import { HospitalityFolioService } from './hospitality-folio.service';
import { HospitalityCashierController } from './hospitality-cashier.controller';
import { HospitalityFolioOperationsController } from './hospitality-folio-operations.controller';
import { HospitalityNightAuditController } from './hospitality-night-audit.controller';
import { HospitalityNightAuditService } from './hospitality-night-audit.service';
import { HospitalityMiceController } from './hospitality-mice.controller';
import { HospitalityMiceService } from './hospitality-mice.service';
import { HospitalityGuestServiceController } from './hospitality-guest-service.controller';
import { HospitalityGuestServiceOperations } from './hospitality-guest-service.service';
import { HospitalityLongstayController } from './hospitality-longstay.controller';
import { HospitalityLongstayService } from './hospitality-longstay.service';
import { HospitalityExperienceController } from './hospitality-experience.controller';
import { HospitalityExperienceService } from './hospitality-experience.service';
import { HospitalityErpController } from './hospitality-erp.controller';
import { HospitalityErpService } from './hospitality-erp.service';

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
    HospitalityFolioController,
    HospitalityCashierController,
    HospitalityFolioOperationsController,
    HospitalityNightAuditController,
    HospitalityMiceController,
    HospitalityGuestServiceController,
    HospitalityLongstayController,
    HospitalityExperienceController,
    HospitalityErpController,
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
    HospitalityFolioService,
    HospitalityNightAuditService,
    HospitalityMiceService,
    HospitalityGuestServiceOperations,
    HospitalityLongstayService,
    HospitalityExperienceService,
    HospitalityErpService,
  ],
})
export class HospitalityModule {}
