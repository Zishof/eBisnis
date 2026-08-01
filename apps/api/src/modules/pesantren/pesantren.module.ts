import { Module } from '@nestjs/common';
import { PesantrenSantriController } from './pesantren-santri.controller';
import { PesantrenSantriService } from './pesantren-santri.service';
import { PesantrenPresensiController } from './pesantren-presensi.controller';
import { PesantrenPresensiService } from './pesantren-presensi.service';
import { PesantrenTagihanController } from './pesantren-tagihan.controller';
import { PesantrenTagihanService } from './pesantren-tagihan.service';
import { PesantrenAsramaController, PesantrenPenempatanController } from './pesantren-asrama.controller';
import { PesantrenAsramaService } from './pesantren-asrama.service';
import { PesantrenKitabController, PesantrenHalaqahController } from './pesantren-diniyah.controller';
import { PesantrenDiniyahService } from './pesantren-diniyah.service';
import { PesantrenTahfizController } from './pesantren-tahfiz.controller';
import { PesantrenTahfizService } from './pesantren-tahfiz.service';

@Module({
  controllers: [
    PesantrenSantriController,
    PesantrenPresensiController,
    PesantrenTagihanController,
    PesantrenAsramaController,
    PesantrenPenempatanController,
    PesantrenKitabController,
    PesantrenHalaqahController,
    PesantrenTahfizController,
  ],
  providers: [
    PesantrenSantriService,
    PesantrenPresensiService,
    PesantrenTagihanService,
    PesantrenAsramaService,
    PesantrenDiniyahService,
    PesantrenTahfizService,
  ],
})
export class PesantrenModule {}
