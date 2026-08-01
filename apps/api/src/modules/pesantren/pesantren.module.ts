import { Module } from '@nestjs/common';
import { PesantrenSantriController } from './pesantren-santri.controller';
import { PesantrenSantriService } from './pesantren-santri.service';
import { PesantrenPresensiController } from './pesantren-presensi.controller';
import { PesantrenPresensiService } from './pesantren-presensi.service';
import { PesantrenTagihanController } from './pesantren-tagihan.controller';
import { PesantrenTagihanService } from './pesantren-tagihan.service';

@Module({
  controllers: [PesantrenSantriController, PesantrenPresensiController, PesantrenTagihanController],
  providers: [PesantrenSantriService, PesantrenPresensiService, PesantrenTagihanService],
})
export class PesantrenModule {}
