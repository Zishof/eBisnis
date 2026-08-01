/**
 * Pengujian penyelesaian nama schema modul pendidikan.
 *
 * Yang diuji adalah **ketiadaan jalur cadangan**. Setiap keadaan yang tidak sah
 * harus berakhir sebagai penolakan; tidak satu pun boleh jatuh ke schema inti,
 * sebab kueri pendidikan yang berjalan di schema inti berhasil dijalankan dan
 * gagal dengan pesan yang menyesatkan.
 */

import { AppError } from '../../common/errors/app-error';
import type { PrismaService } from '../database/prisma.service';
import { EducationSchemaResolver } from './education-schema-resolver.service';

const TENANT = '11111111-1111-1111-1111-111111111111';

interface BarisModul {
  moduleCode: string;
  schemaName: string;
  auditSchemaName: string;
  status: string;
}

/** Prisma tiruan seminimal mungkin: hanya yang dipanggil resolver. */
function prismaDengan(baris: BarisModul | null): PrismaService {
  return {
    tenantVerticalModule: {
      findUnique: jest.fn(async () => baris),
    },
  } as unknown as PrismaService;
}

const modulAktif = (status = 'ACTIVE'): BarisModul => ({
  moduleCode: 'eschool',
  schemaName: 'joniutama_eschool',
  auditSchemaName: 'joniutama_eschool__audit',
  status,
});

describe('modul yang aktif', () => {
  it('mengembalikan nama schema dari registri', async () => {
    const r = new EducationSchemaResolver(prismaDengan(modulAktif()));
    const hasil = await r.resolve(TENANT, 'eschool');

    expect(hasil.schemaName).toBe('joniutama_eschool');
    expect(hasil.auditSchemaName).toBe('joniutama_eschool__audit');
  });

  it('nama schema DIBACA, bukan disusun dari username', async () => {
    /*
     * `bangunNamaSchema` dapat menyusun nama yang sama, dan justru karena itu
     * tidak dipakai: nama yang dihitung selalu "ada", termasuk untuk modul yang
     * belum pernah diprovision.
     *
     * Diuji dengan memberi registri nama yang TIDAK dapat dihitung dari
     * usernamenya. Bila resolver menyusun sendiri, hasilnya akan berbeda.
     */
    const r = new EducationSchemaResolver(
      prismaDengan({ ...modulAktif(), schemaName: 'schema_lama_hasil_migrasi' }),
    );
    expect((await r.resolve(TENANT, 'eschool')).schemaName).toBe('schema_lama_hasil_migrasi');
  });

  it('modul yang siap dikonfigurasi sudah dapat dipakai', async () => {
    // Administrator perlu masuk untuk menyiapkannya sebelum diaktifkan.
    const r = new EducationSchemaResolver(prismaDengan(modulAktif('READY_FOR_CONFIGURATION')));
    await expect(r.resolve(TENANT, 'eschool')).resolves.toBeDefined();
  });
});

describe('tidak ada jalur cadangan', () => {
  it('modul yang belum diaktifkan DITOLAK, bukan jatuh ke schema inti', async () => {
    const r = new EducationSchemaResolver(prismaDengan(null));
    await expect(r.resolve(TENANT, 'eschool')).rejects.toBeInstanceOf(AppError);
  });

  it.each([['DRAFT'], ['QUEUED'], ['PROVISIONING_VERTICAL'], ['SEEDING'], ['FAILED'], ['ARCHIVED']])(
    'status %s ditolak',
    async (status) => {
      /*
       * Modul yang sedang diprovision, gagal, atau diarsipkan punya schema yang
       * isinya belum tentu lengkap. Membacanya menghasilkan hasil yang tampak
       * sah tetapi tidak lengkap — dan itu lebih buruk daripada penolakan.
       */
      const r = new EducationSchemaResolver(prismaDengan(modulAktif(status)));
      await expect(r.resolve(TENANT, 'eschool')).rejects.toBeInstanceOf(AppError);
    },
  );

  it('modul yang ditangguhkan ditolak, dan pesannya menyebut datanya tetap ada', async () => {
    // Berlangganan yang berakhir menutup akses, tidak menghapus schema.
    const r = new EducationSchemaResolver(prismaDengan(modulAktif('SUSPENDED')));
    await expect(r.resolve(TENANT, 'eschool')).rejects.toThrow(/tetap tersimpan/);
  });

  it('modul inti tidak diselesaikan di sini', async () => {
    // Schema inti berasal dari konteks sesi. Menyelesaikannya di sini membuat
    // dua sumber untuk satu nama.
    const r = new EducationSchemaResolver(prismaDengan(null));
    await expect(r.resolve(TENANT, 'core')).rejects.toThrow(/konteks sesi/);
  });
});

describe('kode modul diperiksa ulang', () => {
  it('kode tidak canonical dari rute ditolak sebagai galat internal', async () => {
    /*
     * Rute ditambahkan manusia. Salah eja pada tabel segmen menghasilkan kueri
     * ke modul yang tidak pernah ada — yang tanpa pemeriksaan ini berakhir
     * sebagai "belum diprovision" alih-alih "kode modulnya salah", dan yang
     * membacanya akan mencari sebabnya pada provisioning.
     */
    const r = new EducationSchemaResolver(prismaDengan(modulAktif()));
    await expect(
      r.resolve(TENANT, 'escholl' as unknown as 'eschool'),
    ).rejects.toThrow(/tidak canonical/);
  });

  it('kernel pendidikan diterima tanpa pemeriksaan vertical', async () => {
    // `education` bukan vertical yang dijual, sehingga tidak lolos
    // `bacaKodeVertical` — dan memang tidak perlu.
    const r = new EducationSchemaResolver(
      prismaDengan({
        moduleCode: 'education',
        schemaName: 'joniutama_education',
        auditSchemaName: 'joniutama_education__audit',
        status: 'ACTIVE',
      }),
    );
    await expect(r.resolve(TENANT, 'education')).resolves.toBeDefined();
  });
});
