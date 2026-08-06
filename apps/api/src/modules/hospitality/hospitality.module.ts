import { Module } from '@nestjs/common';
import { HospitalityPropertiController } from './hospitality-properti.controller';
import { HospitalityPropertiService } from './hospitality-properti.service';
import { HospitalityRoomBlockController } from './hospitality-room-block.controller';
import { HospitalityRoomBlockService } from './hospitality-room-block.service';

@Module({
  controllers: [HospitalityPropertiController, HospitalityRoomBlockController],
  providers: [HospitalityPropertiService, HospitalityRoomBlockService],
})
export class HospitalityModule {}
