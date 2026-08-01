import { Module } from '@nestjs/common';
import { PesantrenSantriController } from './pesantren-santri.controller';
import { PesantrenSantriService } from './pesantren-santri.service';
import { PesantrenPresensiController } from './pesantren-presensi.controller';
import { PesantrenPresensiService } from './pesantren-presensi.service';

@Module({
  controllers: [PesantrenSantriController, PesantrenPresensiController],
  providers: [PesantrenSantriService, PesantrenPresensiService],
})
export class PesantrenModule {}
