import { hashSession } from './error-capture.service';
import { shouldPersist } from './error-fingerprint';
import { PLATFORM_PERMISSION_SEED, PLATFORM_ROLE_SEED } from '../../modules/master-seed/registry/platform-master-seeds';

describe('hash id sesi', () => {
  it('menghasilkan hash yang sama untuk sesi yang sama', () => {
    expect(hashSession('sesi-abc')).toBe(hashSession('sesi-abc'));
  });

  it('membedakan sesi yang berbeda', () => {
    expect(hashSession('sesi-abc')).not.toBe(hashSession('sesi-def'));
  });

  it('tidak dapat dikembalikan ke id aslinya', () => {
    // Id sesi mentah pada log berarti siapa pun yang membaca log dapat
    // menyamar sebagai penggunanya.
    const asli = 'sesi-rahasia-12345';
    const hash = hashSession(asli);
    expect(hash).not.toContain(asli);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('permission observability', () => {
  const observability = PLATFORM_PERMISSION_SEED.filter((p) => p.includes('OBSERVABILITY'));

  it('mendefinisikan empat tingkat hak', () => {
    expect(observability).toEqual([
      'PLATFORM.OBSERVABILITY.READ',
      'PLATFORM.OBSERVABILITY.EXPORT',
      'PLATFORM.OBSERVABILITY.MANAGE',
      'PLATFORM.OBSERVABILITY.PURGE',
    ]);
  });

  it('tidak diberikan kepada satu pun role selain Super Admin', () => {
    // Observability memuat jejak seluruh tenant; siapa pun yang dapat
    // membacanya dapat melihat data tenant mana pun tanpa melewati support
    // session yang tercatat.
    const pelanggar = PLATFORM_ROLE_SEED.filter(
      (role) =>
        role.permissions !== '*' &&
        Array.isArray(role.permissions) &&
        role.permissions.some((p) => p.includes('OBSERVABILITY')),
    ).map((role) => role.code);

    expect(pelanggar).toEqual([]);
  });

  it('tidak diberikan kepada Auditor maupun Support', () => {
    // Keduanya paling mungkin dianggap "boleh saja" — dan justru itu yang
    // membuatnya perlu diuji secara khusus.
    const berisiko = PLATFORM_ROLE_SEED.filter((r) =>
      ['PLATFORM_AUDITOR', 'PLATFORM_SUPPORT'].includes(r.code),
    );
    expect(berisiko.length).toBe(2);

    for (const role of berisiko) {
      const punya = Array.isArray(role.permissions)
        ? role.permissions.filter((p) => p.includes('OBSERVABILITY'))
        : [];
      expect(punya).toEqual([]);
    }
  });

  it('memberikannya kepada Super Admin lewat wildcard, bukan daftar', () => {
    // Menambah permission observability baru tidak boleh menuntut mengubah
    // definisi role Super Admin.
    const superAdmin = PLATFORM_ROLE_SEED.find((r) => r.roleType === 'SUPER_ADMIN');
    expect(superAdmin?.permissions).toBe('*');
  });
});

describe('keputusan menyimpan pada jalur penangkapan', () => {
  it('tidak menyimpan banjir 404 dari pemindai', () => {
    // Pemindai otomatis menghasilkan ribuan 404 per jam. Menyimpannya
    // menghabiskan penyimpanan tanpa menambah pengetahuan.
    expect(shouldPersist(404, true)).toBe(false);
  });

  it('menyimpan banjir 403 dari usaha menembus', () => {
    // Polanya justru yang menarik.
    expect(shouldPersist(403, true)).toBe(true);
  });

  it('selalu menyimpan galat yang tidak ada yang menangani', () => {
    expect(shouldPersist(500, false)).toBe(true);
    expect(shouldPersist(404, false)).toBe(true);
  });
});
