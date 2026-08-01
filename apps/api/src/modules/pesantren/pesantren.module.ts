import { Module } from '@nestjs/common';
import { PesantrenSantriController } from './pesantren-santri.controller';
import { PesantrenSantriService } from './pesantren-santri.service';
import { PesantrenPresensiController } from './pesantren-presensi.controller';
import { PesantrenPresensiService } from './pesantren-presensi.service';
import { PesantrenTagihanController } from './pesantren-tagihan.controller';
import { PesantrenTagihanService } from './pesantren-tagihan.service';
import { PesantrenAsramaController, PesantrenPenempatanController } from './pesantren-asrama.controller';
import { PesantrenAsramaService } from './pesantren-asrama.service';

@Module({
  controllers: [
    PesantrenSantriController,
    PesantrenPresensiController,
    PesantrenTagihanController,
    PesantrenAsramaController,
    PesantrenPenempatanController,
  ],
  providers: [
    PesantrenSantriService,
    PesantrenPresensiService,
    PesantrenTagihanService,
    PesantrenAsramaService,
  ],
})
export class PesantrenModule {}
