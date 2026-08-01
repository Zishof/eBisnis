import { Module } from '@nestjs/common';
import { PesantrenSantriController } from './pesantren-santri.controller';
import { PesantrenSantriService } from './pesantren-santri.service';

@Module({
  controllers: [PesantrenSantriController],
  providers: [PesantrenSantriService],
})
export class PesantrenModule {}
