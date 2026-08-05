import { Module, OnModuleInit } from '@nestjs/common';
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
import { PesantrenKajianController } from './pesantren-dakwah.controller';
import { PesantrenDakwahService } from './pesantren-dakwah.service';
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
import { PesantrenDompetPaymentHandler } from './pesantren-dompet-payment.handler';
import { ExternalPaymentRegistry } from '../pos/external-payment.registry';
import { PosModule } from '../pos/pos.module';
import { PesantrenNilaiController } from './pesantren-nilai.controller';
import { PesantrenNilaiService } from './pesantren-nilai.service';
import { PesantrenPsbGelombangController, PesantrenPsbPendaftarController } from './pesantren-psb.controller';
import { PesantrenPsbService } from './pesantren-psb.service';
import { PesantrenPsbPortalController } from './pesantren-psb-portal.controller';
import { PsbApplicantAuthGuard } from './psb-applicant-auth.guard';
import { PesantrenRombonganController } from './pesantren-rombongan.controller';
import { PesantrenRombonganService } from './pesantren-rombongan.service';
import { PesantrenKurikulumController } from './pesantren-kurikulum.controller';
import { PesantrenKurikulumService } from './pesantren-kurikulum.service';
import { PesantrenLaporanController } from './pesantren-laporan.controller';
import { PesantrenLaporanService } from './pesantren-laporan.service';
import { PesantrenPelanggaranController } from './pesantren-pelanggaran.controller';
import { PesantrenPelanggaranService } from './pesantren-pelanggaran.service';
import { PesantrenGuruController } from './pesantren-guru.controller';
import { PesantrenGuruService } from './pesantren-guru.service';
import { PesantrenAbsensiGuruController } from './pesantren-absensi-guru.controller';
import { PesantrenAbsensiGuruService } from './pesantren-absensi-guru.service';
import { PesantrenEkstrakurikulerController } from './pesantren-ekstrakurikuler.controller';
import { PesantrenEkstrakurikulerService } from './pesantren-ekstrakurikuler.service';
import { PesantrenPrestasiController } from './pesantren-prestasi.controller';
import { PesantrenPrestasiService } from './pesantren-prestasi.service';
import { PesantrenKateringController } from './pesantren-katering.controller';
import { PesantrenKateringService } from './pesantren-katering.service';
import { PesantrenBukuPenghubungController } from './pesantren-buku-penghubung.controller';
import { PesantrenBukuPenghubungService } from './pesantren-buku-penghubung.service';
import { PesantrenProfilController } from './pesantren-profil.controller';
import { PesantrenProfilService } from './pesantren-profil.service';
import { PesantrenBeritaController } from './pesantren-berita.controller';
import { PesantrenBeritaService } from './pesantren-berita.service';
import { PesantrenMediaController } from './pesantren-media.controller';
import { PesantrenMediaService } from './pesantren-media.service';
import { PesantrenPublicController } from './pesantren-public.controller';
import { PesantrenPublicService } from './pesantren-public.service';
import { PesantrenUnitPendidikanController } from './pesantren-unit-pendidikan.controller';
import { PesantrenUnitPendidikanService } from './pesantren-unit-pendidikan.service';
import { PesantrenDapodikController } from './pesantren-dapodik.controller';
import { PesantrenDapodikService } from './pesantren-dapodik.service';
import { PesantrenAkademikController } from './pesantren-akademik.controller';
import { PesantrenAkademikService } from './pesantren-akademik.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  /*
   * `PosModule` diimpor demi `ExternalPaymentRegistry` saja (EP-N) — pola
   * yang sama dengan `CooperativeModule`. Arahnya sengaja begini: ePesantren
   * bergantung pada POS, bukan sebaliknya. POS tidak mengetahui apa pun
   * tentang dompet santri.
   */
  imports: [PosModule, NotificationModule],
  controllers: [
    PesantrenSantriController,
    PesantrenPresensiController,
    PesantrenTagihanController,
    PesantrenAsramaController,
    PesantrenPenempatanController,
    PesantrenKitabController,
    PesantrenHalaqahController,
    PesantrenKajianController,
    PesantrenTahfizController,
    PesantrenPerizinanController,
    PesantrenGerbangController,
    PesantrenPortalWaliController,
    PesantrenDompetController,
    PesantrenKartuController,
    PesantrenKioskController,
    PesantrenNilaiController,
    PesantrenPsbGelombangController,
    PesantrenPsbPendaftarController,
    PesantrenPsbPortalController,
    PesantrenRombonganController,
    PesantrenKurikulumController,
    PesantrenLaporanController,
    PesantrenPelanggaranController,
    PesantrenGuruController,
    PesantrenAbsensiGuruController,
    PesantrenEkstrakurikulerController,
    PesantrenPrestasiController,
    PesantrenKateringController,
    PesantrenBukuPenghubungController,
    PesantrenProfilController,
    PesantrenBeritaController,
    PesantrenMediaController,
    PesantrenPublicController,
    PesantrenUnitPendidikanController,
    PesantrenDapodikController,
    PesantrenAkademikController,
  ],
  providers: [
    PesantrenSantriService,
    PesantrenPresensiService,
    PesantrenTagihanService,
    PesantrenAsramaService,
    PesantrenDiniyahService,
    PesantrenDakwahService,
    PesantrenTahfizService,
    PesantrenPerizinanService,
    PesantrenGerbangService,
    PesantrenPortalWaliService,
    PesantrenDompetService,
    PesantrenKartuService,
    PesantrenKioskService,
    PesantrenDompetPaymentHandler,
    PesantrenNilaiService,
    PesantrenPsbService,
    PsbApplicantAuthGuard,
    PesantrenRombonganService,
    PesantrenKurikulumService,
    PesantrenLaporanService,
    PesantrenPelanggaranService,
    PesantrenGuruService,
    PesantrenAbsensiGuruService,
    PesantrenEkstrakurikulerService,
    PesantrenPrestasiService,
    PesantrenKateringService,
    PesantrenBukuPenghubungService,
    PesantrenProfilService,
    PesantrenBeritaService,
    PesantrenMediaService,
    PesantrenPublicService,
    PesantrenUnitPendidikanService,
    PesantrenDapodikService,
    PesantrenAkademikService,
  ],
})
export class PesantrenModule implements OnModuleInit {
  constructor(
    private readonly pembayaranEksternal: ExternalPaymentRegistry,
    private readonly penanganDompet: PesantrenDompetPaymentHandler,
  ) {}

  /**
   * Mendaftarkan penangan pembayaran dompet santri (EP-N, IR-002).
   *
   * Satu-satunya tempat modul ePesantren menyentuh alur kasir — lewat
   * kontrak milik Core, bukan dengan menyunting POS. Pola sama dengan
   * `CooperativeModule.onModuleInit()`.
   */
  onModuleInit(): void {
    if (!this.pembayaranEksternal.has(this.penanganDompet.handlerCode)) {
      this.pembayaranEksternal.register(this.penanganDompet);
    }
  }
}
