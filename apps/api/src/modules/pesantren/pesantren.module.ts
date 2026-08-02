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
import { PesantrenPerizinanController } from './pesantren-perizinan.controller';
import { PesantrenPerizinanService } from './pesantren-perizinan.service';
import { PesantrenGerbangController } from './pesantren-gerbang.controller';
import { PesantrenGerbangService } from './pesantren-gerbang.service';
import { PesantrenPortalWaliController } from './pesantren-portal-wali.controller';
import { PesantrenPortalWaliService } from './pesantren-portal-wali.service';
import { PesantrenDompetController } from './pesantren-dompet.controller';
import { PesantrenDompetService } from './pesantren-dompet.service';
import { PesantrenKartuController } from './pesantren-kartu.controller';
import { PesantrenKartuService } from './pesantren-kartu.service';
import { PesantrenKioskController } from './pesantren-kiosk.controller';
import { PesantrenKioskService } from './pesantren-kiosk.service';

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
    PesantrenPerizinanController,
    PesantrenGerbangController,
    PesantrenPortalWaliController,
    PesantrenDompetController,
    PesantrenKartuController,
    PesantrenKioskController,
  ],
  providers: [
    PesantrenSantriService,
    PesantrenPresensiService,
    PesantrenTagihanService,
    PesantrenAsramaService,
    PesantrenDiniyahService,
    PesantrenTahfizService,
    PesantrenPerizinanService,
    PesantrenGerbangService,
    PesantrenPortalWaliService,
    PesantrenDompetService,
    PesantrenKartuService,
    PesantrenKioskService,
  ],
})
export class PesantrenModule {}
