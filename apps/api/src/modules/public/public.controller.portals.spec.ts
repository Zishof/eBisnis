/**
 * Regresi `GET /public/portals`.
 *
 * Ditulis setelah MI-1 MitraInap menemukan lewat pengujian API sungguhan
 * bahwa `ecosystem` setiap portal menaut ke DIRINYA SENDIRI berulang kali,
 * bukan ke portal lain -- akibat memakai relasi `linksTo` (baris yang
 * menjadikan portal ini TARGET) padahal yang benar `linksFrom` (baris yang
 * menjadikan portal ini SUMBER). Uji ini mengikat perilakunya supaya
 * kesalahan arah relasi yang sama tidak lolos lagi tanpa satu pun galat.
 */

jest.mock('sanitize-html', () => jest.fn((value: string) => value));

import { PublicController } from './public.controller';

function portalPalsu(kode: string, targetKode: string[]) {
  return {
    code: kode,
    name: kode,
    tagline: `Tagline ${kode}`,
    verticalCode: 'CORE_ERP',
    brandPrimary: '#000000',
    brandAccent: '#000000',
    defaultLocale: 'id',
    domains: [{ host: `${kode.toLowerCase()}.test`, kind: 'PUBLIC', isCanonical: true, status: 'ACTIVE' }],
    // Baris cross-link dari portal ini ke portal lain -- `linksFrom`, bukan `linksTo`.
    linksFrom: targetKode.map((t) => ({
      isActive: true,
      sortOrder: 0,
      label: t,
      description: `Tautan ke ${t}`,
      target: {
        code: t,
        domains: [{ host: `${t.toLowerCase()}.test`, kind: 'PUBLIC', isCanonical: true, status: 'ACTIVE' }],
      },
    })),
    // `linksTo` diisi berbeda dari `linksFrom` justru untuk memastikan uji ini
    // GAGAL bila kode kembali membaca relasi yang salah.
    linksTo: [],
  };
}

describe('PublicController.getPortals', () => {
  it('ecosystem berisi portal LAIN, bukan dirinya sendiri', async () => {
    const prisma = {
      platformPortal: {
        findMany: jest.fn().mockResolvedValue([
          portalPalsu('EBISNIS', ['MITRAINAP']),
          portalPalsu('MITRAINAP', ['EBISNIS']),
        ]),
      },
    };

    const controller = new PublicController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      prisma as never,
    );

    const hasil = await controller.getPortals();

    const ebisnis = hasil.find((p) => p.code === 'EBISNIS')!;
    const mitrainap = hasil.find((p) => p.code === 'MITRAINAP')!;

    expect(ebisnis.ecosystem.map((e) => e.code)).toEqual(['MITRAINAP']);
    expect(mitrainap.ecosystem.map((e) => e.code)).toEqual(['EBISNIS']);
    // Tidak satu pun portal menaut ke dirinya sendiri.
    for (const p of hasil) {
      expect(p.ecosystem.some((e) => e.code === p.code)).toBe(false);
    }
  });
});
