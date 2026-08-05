import { Module } from '@nestjs/common';
import { EcampusController, EducationController, EschoolController } from './education.controller';
import { EschoolDapodikController } from './eschool-dapodik.controller';
import { EducationService } from './education.service';
import { PesantrenDapodikService } from '../pesantren/pesantren-dapodik.service';

@Module({
  controllers: [EducationController, EschoolController, EschoolDapodikController, EcampusController],
  providers: [EducationService, PesantrenDapodikService],
  exports: [EducationService],
})
export class EducationModule {}
