import { Module } from '@nestjs/common';
import { HospitalityPropertiController } from './hospitality-properti.controller';
import { HospitalityPropertiService } from './hospitality-properti.service';
import { HospitalityRoomBlockController } from './hospitality-room-block.controller';
import { HospitalityRoomBlockService } from './hospitality-room-block.service';
import { HospitalityGuestController } from './hospitality-guest.controller';
import { HospitalityGuestService } from './hospitality-guest.service';

@Module({
  controllers: [HospitalityPropertiController, HospitalityRoomBlockController, HospitalityGuestController],
  providers: [HospitalityPropertiService, HospitalityRoomBlockService, HospitalityGuestService],
})
export class HospitalityModule {}
