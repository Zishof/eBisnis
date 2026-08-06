import { Module } from '@nestjs/common';
import { HospitalityPropertiController } from './hospitality-properti.controller';
import { HospitalityPropertiService } from './hospitality-properti.service';

@Module({
  controllers: [HospitalityPropertiController],
  providers: [HospitalityPropertiService],
})
export class HospitalityModule {}
