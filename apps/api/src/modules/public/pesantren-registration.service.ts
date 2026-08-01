/**
 * Pendaftaran pondok pesantren.
 *
 * ## Mengapa jalur tersendiri, bukan cabang di dalam pendaftaran eBisnis
 *
 * Yang ditanyakan berbeda — NSPP, tipe pesantren, jenjang, pengasuh — dan yang
 * dihasilkan juga berbeda: selain schema dan credential, pendaftaran ini
 * membuat **situs pondok** dan menandai penyewanya sebagai pesantren.
 *
 * Menaruhnya sebagai cabang `if` di dalam `RegistrationService` berarti setiap
 * perubahan pada salah satunya menanggung risiko merusak yang lain, pada jalur
 * yang membuat schema dan credential — jalur yang kegagalannya paling mahal.
 *
 * ## Yang tetap dipakai bersama
 *
 * Pembuatan schema, pengguna, dan credential **tidak** disalin. Ia dipanggil
 * dari `RegistrationService`. Dua penyalin jalur provisioning akan berselisih
 * pada perubahan pertama yang terburu-buru, dan yang berselisih di jalur ini
 * meninggalkan schema setengah jadi.
 *
 * ## Urutan, dan mengapa begitu
 *
 *   1. Validasi bentuk (murni, tanpa basis data)
 *   2. Kunci penasihat atas host situs
 *   3. Pastikan host belum diklaim siapa pun
 *   4. Pendaftaran umum: schema, penyewa, pengguna, credential
 *   5. Identitas pesantren, penanda vertikal, dan situs — satu transaksi
 *
 * Langkah 3 sengaja mendahului langkah 4. Kegagalan yang paling mungkin adalah
 * "alamat situs sudah dipakai", dan menemukannya sesudah schema dibuat berarti
 * meninggalkan schema yang tidak dipakai siapa pun.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { TenantBootstrapService } from '../../infrastructure/provisioning/tenant-bootstrap.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { RegistrationService } from './registration.service';
import { ROLE_ADMIN_EPESANTREN } from '../pesantren/rbac/pesantren-vertical.catalog';
import {
  AFILIASI_PESANTREN,
  JENJANG_PESANTREN,
  SANTRI_DILAYANI,
  TIPE_PESANTREN,
  hostSitus,
  usulanSlugDariNama,
  usulanUsernameDariNama,
  validasiPendaftaranPesantren,
} from './pesantren-registration';

/** Kode vertikal penyewa pesantren. Sama dengan CHECK di basis data. */
export const VERTICAL_PESANTREN = 'PESANTREN';

/**
 * Kode vertikal pada `vertical_site_domain`.
 *
 * Berbeda dari `VERTICAL_PESANTREN` karena tabel itu memakai huruf kecil untuk
 * seluruh vertikal yang sudah ada (`cooperative`, `health`, `village`). Dua
 * bentuk penulisan pada satu konsep memang tidak ideal — tetapi menyeragamkannya
 * sekarang berarti menyunting baris yang sudah ada, dan itu bukan perubahan
 * aditif.
 */
export const VERTIKAL_SITUS_PESANTREN = 'pesantren';

export interface MasukanPendaftaranPesantren {
  namaPondok: string;
  slugSitus: string;
  desiredUsername: string;
  email: string;

  tipePesantren: string;
  santriDilayani: string;
  jenjang: string[];

  nomorStatistik?: string;
  nomorIzinOperasional?: string;
  tanggalIzin?: string;
  tahunBerdiri?: number;
  namaYayasan?: string;
  aktaYayasan?: string;
  namaPengasuh?: string;
  afiliasi?: string;

  jumlahSantriMukim?: number;
  jumlahSantriNonmukim?: number;
  jumlahUstaz?: number;

  provinsi?: string;
  kabupatenKota?: string;
  kecamatan?: string;
  desaKelurahan?: string;
  alamat?: string;
  kodePos?: string;

  penanggungJawab?: string;
  teleponPenanggungJawab?: string;
  teleponPondok?: string;
  whatsapp?: string;
  situsWeb?: string;

  acceptTerms: boolean;
  acceptPrivacy: boolean;
  localeCode?: string;
  includeSampleData?: boolean;
}

export interface HasilPendaftaranPesantren {
  status: string;
  registrationId: string;
  tenantId: string;
  username: string;
  schemaName: string;
  /** Hanya pada response pertama, dan tidak pernah disimpan. */
  temporaryPassword?: string;
  mustChangePassword: boolean;
  slugSitus: string;
  siteHost: string;
  siteUrl: string;
  loginUrl: string;
}

@Injectable()
export class PesantrenRegistrationService {
  private readonly logger = new Logger(PesantrenRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly registrations: RegistrationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly bootstrap: TenantBootstrapService,
  ) {}

  /** Pilihan yang ditawarkan formulir. Satu sumber untuk formulir dan pemeriksa. */
  async getConfig() {
    return {
      tipePesantren: TIPE_PESANTREN.map((code) => ({ code, label: labelTipe(code) })),
      santriDilayani: SANTRI_DILAYANI.map((code) => ({ code, label: labelSantri(code) })),
      jenjang: JENJANG_PESANTREN.map((j) => ({ code: j.code, label: j.label })),
      afiliasi: [...AFILIASI_PESANTREN],
      domainSitus: 'santri.info',
      /*
       * Kata sandi selalu dibuat peladen pada jalur ini.
       *
       * Pendaftar tidak memilih kata sandinya sendiri di sini — bukan untuk
       * menyederhanakan formulir, melainkan karena kata sandi yang dipilih pada
       * formulir publik adalah kata sandi yang paling sering dipakai ulang dari
       * tempat lain. Yang dibuat peladen wajib diganti saat masuk pertama.
       */
      passwordSelaluDibuatPeladen: true,
      hargaPerSantriPerBulan: await this.hargaPerSantriPerBulan(),
    };
  }

  /**
   * Harga penawaran bawaan, dibaca dari katalog harga berversi.
   *
   * Sebelum EP-B, angka ini tertulis langsung sebagai `2000` di sini —
   * persis larangan §6 "menghard-code harga Rp2.000 di controller atau
   * frontend". Sekarang dibaca dari `EPESANTREN_SCHOOL_FIRST`, katalog yang
   * sama yang dipakai `PlatformSeedService.seedEpesantrenCatalog()`.
   *
   * Angka bawaan `2000` di sini HANYA dipakai bila katalognya belum diseed —
   * misalnya pada basis data yang belum menjalankan `pnpm seed:platform`
   * sesudah EP-B. Formulir tetap dapat digambar; yang berbeda hanyalah
   * sumber angkanya belum otoritatif.
   */
  private async hargaPerSantriPerBulan(): Promise<number> {
    const harga = await this.prisma.subscriptionPlanPrice.findFirst({
      where: {
        billingMetric: 'PER_ACTIVE_SANTRI',
        isActive: true,
        deletedAt: null,
        planVersion: {
          plan: { code: 'EPESANTREN_SCHOOL_FIRST' },
          status: 'PUBLISHED',
        },
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { unitPrice: true },
    });
    return harga ? Number(harga.unitPrice) : 2000;
  }

  /** Apakah alamat situs ini masih bebas? Tanpa memesan apa pun. */
  async cekSlugSitus(slug: string) {
    const bersih = (slug ?? '').trim().toLowerCase();
    const galat = validasiPendaftaranPesantren({
      // Hanya slug yang diperiksa; sisanya diisi nilai yang sah supaya galat
      // yang muncul benar-benar milik slug.
      namaPondok: 'x',
      email: 'x@y.id',
      slugSitus: bersih,
      tipePesantren: 'SALAFIYAH',
      santriDilayani: 'PUTRA',
      jenjang: ['TAHFIZ'],
      acceptTerms: true,
      acceptPrivacy: true,
    }).filter((g) => g.field === 'slugSitus');

    if (galat.length) {
      return {
        tersedia: false,
        slug: bersih,
        host: bersih ? hostSitus(bersih) : null,
        alasan: galat[0].code,
        pesan: galat[0].message,
      };
    }

    const host = hostSitus(bersih);
    const dipakai = await this.prisma.verticalSiteDomain.findUnique({
      where: { host },
      select: { id: true },
    });

    return {
      tersedia: !dipakai,
      slug: bersih,
      host,
      alasan: dipakai ? 'HOST_SUDAH_DIPAKAI' : null,
      pesan: dipakai
        ? 'Alamat situs tersebut sudah dipakai pondok lain. Silakan pilih yang lain.'
        : 'Alamat situs tersedia.',
    };
  }

  /**
   * Usulan alamat situs DAN nama pengguna dari nama pondok. Tidak memesan apa pun.
   *
   * Keduanya dikembalikan sekaligus supaya formulir cukup memanggil sekali.
   * Bentuknya sengaja berbeda — tanda hubung untuk alamat situs, garis bawah
   * untuk nama pengguna — dan perbedaan itu diikat uji.
   */
  usulkan(namaPondok: string): { slug: string; username: string } {
    const nama = namaPondok ?? '';
    return {
      slug: usulanSlugDariNama(nama),
      username: usulanUsernameDariNama(nama),
    };
  }

  async register(
    input: MasukanPendaftaranPesantren,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<HasilPendaftaranPesantren> {
    const galat = validasiPendaftaranPesantren(input);
    if (galat.length) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Ada isian yang belum benar. Periksa kembali formulir.',
        { errors: galat },
      );
    }

    const slug = input.slugSitus.trim().toLowerCase();
    const host = hostSitus(slug);

    return this.tenantDb.withAdvisoryLock(`pesantren:${host}`, async () => {
      const ketersediaan = await this.cekSlugSitus(slug);
      if (!ketersediaan.tersedia) {
        throw AppError.conflict(ErrorCodes.CONFLICT, ketersediaan.pesan);
      }

      /*
       * Pendaftaran umum. `generatePassword` dipaksa true — bukan diambil dari
       * masukan. Nilai dari luar yang menentukan apakah kata sandi dibuat
       * peladen berarti pendaftar dapat memilih kata sandinya sendiri lewat
       * permintaan langsung, melewati formulir yang tidak menawarkannya.
       */
      const umum = await this.registrations.register(
        {
          businessName: input.namaPondok,
          businessType: 'Pondok Pesantren',
          country: 'Indonesia',
          province: input.provinsi,
          cityRegency: input.kabupatenKota,
          district: input.kecamatan,
          address: input.alamat,
          contactPerson: input.penanggungJawab,
          contactPhone: input.teleponPenanggungJawab,
          businessPhone: input.teleponPondok,
          email: input.email,
          desiredUsername: input.desiredUsername,
          generatePassword: true,
          acceptTerms: input.acceptTerms,
          acceptPrivacy: input.acceptPrivacy,
          localeCode: input.localeCode ?? 'id',
          includeSampleData: input.includeSampleData ?? true,
        },
        meta,
      );

      try {
        await this.prisma.$transaction([
          this.prisma.registrationPesantren.create({
            data: {
              registrationId: umum.registrationId,
              nomorStatistik: bersihkan(input.nomorStatistik),
              nomorIzinOperasional: bersihkan(input.nomorIzinOperasional),
              tanggalIzin: input.tanggalIzin ? new Date(input.tanggalIzin) : null,
              tahunBerdiri: input.tahunBerdiri ?? null,
              namaYayasan: bersihkan(input.namaYayasan),
              aktaYayasan: bersihkan(input.aktaYayasan),
              namaPengasuh: bersihkan(input.namaPengasuh),
              afiliasi: bersihkan(input.afiliasi),
              tipePesantren: input.tipePesantren,
              santriDilayani: input.santriDilayani,
              jenjang: input.jenjang,
              jumlahSantriMukim: input.jumlahSantriMukim ?? null,
              jumlahSantriNonmukim: input.jumlahSantriNonmukim ?? null,
              jumlahUstaz: input.jumlahUstaz ?? null,
              desaKelurahan: bersihkan(input.desaKelurahan),
              kodePos: bersihkan(input.kodePos),
              whatsapp: bersihkan(input.whatsapp),
              situsWeb: bersihkan(input.situsWeb),
              slugSitus: slug,
            },
          }),

          this.prisma.tenant.update({
            where: { id: umum.tenantId },
            data: { verticalCode: VERTICAL_PESANTREN },
          }),

          /*
           * Situs pondok langsung aktif dan terverifikasi.
           *
           * Berbeda dari domain milik pondok sendiri. `<slug>.santri.info` ada
           * di dalam zona kita; tidak ada yang perlu dibuktikan kepada diri
           * sendiri. Domain pondok sendiri tetap wajib melewati verifikasi —
           * tanpa itu siapa pun dapat mendaftarkan nama yang bukan miliknya.
           */
          this.prisma.verticalSiteDomain.create({
            data: {
              tenantId: umum.tenantId,
              host,
              vertical: VERTIKAL_SITUS_PESANTREN,
              status: 'ACTIVE',
              verifiedAt: new Date(),
            },
          }),
        ]);

      } catch (error) {
        /*
         * Sampai di sini penyewanya sudah jadi dan credential-nya sudah dibuat.
         * Membatalkannya berarti membuang ruang kerja yang sebenarnya sehat,
         * dan credential yang sudah dibuat tidak dapat ditarik kembali.
         *
         * Karena itu yang dilakukan adalah mencatat dan meneruskan — pendaftar
         * tetap memperoleh akunnya, dan yang kurang hanyalah situsnya.
         */
        const pesan = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Identitas pesantren untuk pendaftaran ${umum.registrationId} gagal disimpan: ${pesan}`,
        );
        await this.audit.record({
          moduleCode: 'REGISTRATION',
          actionCode: 'PESANTREN_PROFILE_FAILED',
          entityType: 'Registration',
          entityId: umum.registrationId,
          tenantId: umum.tenantId,
          result: 'FAILURE',
          reason: pesan.slice(0, 1000),
          requestId: meta.requestId,
        });
        throw AppError.internal(
          ErrorCodes.PROVISIONING_FAILED,
          'Akun pondok berhasil dibuat, tetapi situs pondok gagal disiapkan. ' +
            'Silakan masuk seperti biasa dan hubungi kami untuk menyiapkan alamat situsnya.',
          { registrationId: umum.registrationId, username: umum.username },
        );
      }

      /*
       * Peran EPESANTREN_ADMIN ditambahkan sebagai peran KEDUA, bukan
       * pengganti OWNER.
       *
       * OWNER (`PEMILIK_USAHA`) memegang `allModules: true` pada profil P11 —
       * READ, PRINT, EXPORT, APPROVE, TANPA CREATE/UPDATE. Tanpa peran
       * tambahan ini, pengurus yang baru mendaftar tidak dapat menambahkan
       * satu pun santri.
       *
       * Dibungkus try/catch TERSENDIRI, terpisah dari blok identitas pesantren
       * di atas. Kegagalan di sini tidak boleh memicu pesan "situs pondok
       * gagal disiapkan" — pesan itu tentang hal lain, dan menyalahgunakannya
       * di sini menyesatkan pendaftar yang sebenarnya situsnya baik-baik saja.
       */
      try {
        const pemilik = await this.prisma.tenantMembership.findFirst({
          where: { tenantId: umum.tenantId, isOwner: true },
          select: { platformUserId: true },
        });
        const hasil = pemilik
          ? await this.bootstrap.assignAdditionalRole(
              umum.schemaName,
              pemilik.platformUserId,
              ROLE_ADMIN_EPESANTREN,
            )
          : { assigned: false };
        if (!hasil.assigned) {
          this.logger.warn(
            `Peran ${ROLE_ADMIN_EPESANTREN} tidak diberikan pada ${umum.schemaName}: ` +
              'pemilik, peran, atau subjek pengguna tidak ditemukan.',
          );
        }
      } catch (error) {
        const pesan = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Pemberian peran ${ROLE_ADMIN_EPESANTREN} pada ${umum.schemaName} gagal: ${pesan}`,
        );
      }

      await this.audit.record({
        moduleCode: 'REGISTRATION',
        actionCode: 'PESANTREN_REGISTERED',
        entityType: 'Registration',
        entityId: umum.registrationId,
        tenantId: umum.tenantId,
        tenantSchema: umum.schemaName,
        actorUsername: umum.username,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
        metadata: {
          namaPondok: input.namaPondok,
          host,
          tipePesantren: input.tipePesantren,
          jenjang: input.jenjang,
        },
      });

      const webUrl = this.config.get<string>('webUrl', 'http://localhost:5173');

      return {
        status: umum.status,
        registrationId: umum.registrationId,
        tenantId: umum.tenantId,
        username: umum.username,
        schemaName: umum.schemaName,
        ...(umum.temporaryPassword ? { temporaryPassword: umum.temporaryPassword } : {}),
        mustChangePassword: umum.mustChangePassword,
        slugSitus: slug,
        siteHost: host,
        siteUrl: `https://${host}`,
        /*
         * Masuk langsung menuju beranda pesantren, bukan beranda eBisnis.
         *
         * Tujuannya ikut pada alamat supaya tombol "masuk sekarang" tepat
         * sesudah pendaftaran mendarat di tempat yang benar, tanpa bergantung
         * pada sesi yang belum ada saat halaman itu digambar.
         */
        loginUrl: `${webUrl}/masuk?lanjut=${encodeURIComponent('/pesantren')}`,
      };
    });
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

function labelTipe(code: string): string {
  switch (code) {
    case 'SALAFIYAH':
      return 'Salafiyah (kajian kitab kuning)';
    case 'KHALAFIYAH':
      return 'Khalafiyah (sekolah/madrasah formal)';
    default:
      return 'Kombinasi salafiyah dan khalafiyah';
  }
}

function labelSantri(code: string): string {
  switch (code) {
    case 'PUTRA':
      return 'Putra';
    case 'PUTRI':
      return 'Putri';
    default:
      return 'Putra dan putri';
  }
}
