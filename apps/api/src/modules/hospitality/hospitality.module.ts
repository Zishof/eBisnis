import { Module } from '@nestjs/common';
import { HospitalityPropertiController } from './hospitality-properti.controller';
import { HospitalityPropertiService } from './hospitality-properti.service';
import { HospitalityRoomBlockController } from './hospitality-room-block.controller';
import { HospitalityRoomBlockService } from './hospitality-room-block.service';
import { HospitalityGuestController } from './hospitality-guest.controller';
import { HospitalityGuestService } from './hospitality-guest.service';
import { HospitalityReservationController } from './hospitality-reservation.controller';
import { HospitalityReservationService } from './hospitality-reservation.service';

@Module({
  controllers: [
    HospitalityPropertiController,
    HospitalityRoomBlockController,
    HospitalityGuestController,
    HospitalityReservationController,
  ],
  providers: [
    HospitalityPropertiService,
    HospitalityRoomBlockService,
    HospitalityGuestService,
    HospitalityReservationService,
  ],
})
export class HospitalityModule {}
