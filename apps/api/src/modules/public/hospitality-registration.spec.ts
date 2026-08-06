/**
 * Pengujian aturan pendaftaran properti hospitality (MI-3).
 *
 * Pola sama dengan `pesantren-registration.spec.ts`: yang dijaga adalah dua
 * hal yang tidak dapat ditarik kembali setelah terjadi -- schema yang
 * telanjur dibuat, dan host yang telanjur diklaim.
 */

import { LABEL_TERPESAN } from '../../infrastructure/portal/portal-host';
import {
  hostSitus,
  slugSitusBoleh,
  usulanSlugDariNama,
  usulanUsernameDariNama,
  validasiPendaftaranHospitality,
} from './hospitality-registration';

const SAH = {
  namaProperti: 'Grand Sun Hotel',
  email: 'owner@grandsunhotel.com',
  desiredUsername: 'grand_sun_hotel',
  slugSitus: 'grand-sun-hotel',
  acceptTerms: true,
  acceptPrivacy: true,
};

describe('slug situs', () => {
  it('menerima label DNS yang sah', () => {
    expect(slugSitusBoleh('grand-sun-hotel')).toBeNull();
    expect(slugSitusBoleh('hotel2')).toBeNull();
    expect(slugSitusBoleh('  Grand-Sun  ')).toBeNull();
  });

  it('MENOLAK garis bawah', () => {
    const galat = slugSitusBoleh('grand_sun_hotel');
    expect(galat?.code).toBe('SLUG_TIDAK_SAH');
    expect(galat?.message).toContain('Garis bawah');
  });

  it('menolak label terpesan platform', () => {
    for (const label of LABEL_TERPESAN) {
      expect(slugSitusBoleh(label)?.code).toBe('SLUG_TERPESAN');
    }
  });

  it('menolak bentuk yang bukan label DNS', () => {
    expect(slugSitusBoleh('-awal')?.code).toBe('SLUG_TIDAK_SAH');
    expect(slugSitusBoleh('akhir-')?.code).toBe('SLUG_TIDAK_SAH');
    expect(slugSitusBoleh('a'.repeat(64))?.code).toBe('SLUG_TIDAK_SAH');
    expect(slugSitusBoleh('ada.titik')?.code).toBe('SLUG_TIDAK_SAH');
  });

  it('menolak slug kosong atau terlalu pendek', () => {
    expect(slugSitusBoleh('')?.code).toBe('SLUG_KOSONG');
    expect(slugSitusBoleh('ab')?.code).toBe('SLUG_TERLALU_PENDEK');
  });
});

describe('host situs', () => {
  it('menyusun host penuh dari slug', () => {
    expect(hostSitus('grand-sun-hotel')).toBe('grand-sun-hotel.mitrainap.id');
    expect(hostSitus('  Grand-Sun  ')).toBe('grand-sun.mitrainap.id');
  });
});

describe('usulan slug dan nama pengguna', () => {
  it('slug memakai tanda hubung, nama pengguna memakai garis bawah', () => {
    expect(usulanSlugDariNama('Grand Sun Hotel')).toBe('grand-sun-hotel');
    expect(usulanUsernameDariNama('Grand Sun Hotel')).toBe('grand_sun_hotel');
  });

  it('nama pengguna yang diawali angka diberi awalan huruf', () => {
    expect(usulanUsernameDariNama('3 Bintang Homestay')).toBe('h3_bintang_homestay');
  });

  it('membuang aksen sebelum mengganti karakter tidak sah', () => {
    expect(usulanSlugDariNama("Hotel D'Aurora")).toBe('hotel-d-aurora');
  });

  it('mengembalikan string kosong bila tidak ada yang tersisa', () => {
    expect(usulanUsernameDariNama('!!!')).toBe('');
  });
});

describe('validasi pendaftaran hospitality', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiPendaftaranHospitality(SAH)).toEqual([]);
  });

  it('nama properti dan surel wajib diisi', () => {
    const galat = validasiPendaftaranHospitality({ ...SAH, namaProperti: '', email: '' });
    expect(galat.map((g) => g.field)).toEqual(expect.arrayContaining(['namaProperti', 'email']));
  });

  it('bentuk surel diperiksa', () => {
    const galat = validasiPendaftaranHospitality({ ...SAH, email: 'bukan-surel' });
    expect(galat.some((g) => g.field === 'email' && g.code === 'TIDAK_SAH')).toBe(true);
  });

  it('persetujuan syarat dan privasi wajib', () => {
    const galat = validasiPendaftaranHospitality({ ...SAH, acceptTerms: false, acceptPrivacy: false });
    expect(galat.map((g) => g.field)).toEqual(expect.arrayContaining(['acceptTerms', 'acceptPrivacy']));
  });

  it('slug yang tidak sah ikut dilaporkan', () => {
    const galat = validasiPendaftaranHospitality({ ...SAH, slugSitus: 'app' });
    expect(galat.some((g) => g.field === 'slugSitus' && g.code === 'SLUG_TERPESAN')).toBe(true);
  });
});
