/**
 * Pengujian permukaan situs publik.
 *
 * Yang dijaga: **tidak ada satu pun jalur tulis dari halaman tanpa
 * autentikasi.** Bukan karena belum dibuat, melainkan karena situs desa adalah
 * tempat yang paling mudah ditemukan dan paling jarang diperhatikan — terindeks
 * mesin pencari, dipindai otomatis, dan tidak ada seorang pun yang menatapnya
 * setiap hari. Satu endpoint tulis di sana bernilai lebih bagi penyerang
 * daripada seluruh halaman administrasi.
 *
 * Pengujian ini membaca metadata rute Nest, bukan berkasnya. Ia akan
 * menggagalkan berkas pada hari seseorang menambahkan `@Post` di sana, apa pun
 * nama metodenya.
 */

import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../common/decorators';
import { VillagePublicController } from './village.module';
import { METODE_SAH_BROADCAST, BroadcastBlockedAdapter } from './ports/broadcast.port';
import { ENDPOINT_TERLARANG_PORTAL } from './village-site';

type Handler = (...args: unknown[]) => unknown;

function metodeControllerPublik(): string[] {
  const proto = VillagePublicController.prototype as unknown as Record<string, Handler>;
  return Object.getOwnPropertyNames(proto).filter(
    (n) => n !== 'constructor' && Reflect.hasMetadata(PATH_METADATA, proto[n]),
  );
}

describe('situs publik hanya membaca', () => {
  it('memiliki rute', () => {
    expect(metodeControllerPublik().length).toBeGreaterThan(5);
  });

  it('SETIAP rute publik adalah GET', () => {
    const proto = VillagePublicController.prototype as unknown as Record<string, Handler>;
    for (const nama of metodeControllerPublik()) {
      const method = Reflect.getMetadata(METHOD_METADATA, proto[nama]);
      expect([nama, method]).toEqual([nama, RequestMethod.GET]);
    }
  });

  it('SETIAP rute publik bertanda @Public()', () => {
    // Rute yang lupa ditandai akan ditolak guard, tetapi kelupaan itu baru
    // ketahuan saat dicoba. Di sini ia ketahuan saat berkasnya disimpan.
    const proto = VillagePublicController.prototype as unknown as Record<string, Handler>;
    for (const nama of metodeControllerPublik()) {
      expect([nama, Reflect.getMetadata(IS_PUBLIC_KEY, proto[nama])]).toEqual([nama, true]);
    }
  });

  it('tidak satu pun rute publik menuntut permission', () => {
    // Rute publik yang menuntut permission adalah rute yang tidak pernah dapat
    // dipanggil — tanda bahwa maksudnya sesungguhnya bukan publik.
    const proto = VillagePublicController.prototype as unknown as Record<string, Handler>;
    for (const nama of metodeControllerPublik()) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, proto[nama])).toBeUndefined();
    }
  });

  it('tidak menyediakan metode bernama seperti jalur tulis', () => {
    const nama = metodeControllerPublik();
    for (const tulis of ['simpan', 'buat', 'ubah', 'hapus', 'kirim', 'create', 'update', 'delete']) {
      expect(nama.some((n) => n.toLowerCase().startsWith(tulis))).toBe(false);
    }
  });

  it('tidak menyediakan pencarian warga', () => {
    const nama = metodeControllerPublik();
    for (const terlarang of ENDPOINT_TERLARANG_PORTAL) {
      expect(nama).not.toContain(terlarang);
    }
  });
});

describe('adapter siaran yang terhalang', () => {
  const adapter = new BroadcastBlockedAdapter();

  it('hanya memiliki metode yang ada pada daftar sahnya', () => {
    const punya = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter)).filter(
      (n) => n !== 'constructor',
    );
    expect(punya.sort()).toEqual([...METODE_SAH_BROADCAST].sort());
  });

  it('menyatakan kanal berpenyedia belum siap', async () => {
    for (const kanal of ['WHATSAPP', 'SUREL', 'SMS'] as const) {
      expect(await adapter.siap(kanal)).toBe(false);
    }
  });

  it('papan informasi siap tanpa penyedia', async () => {
    expect(await adapter.siap('PAPAN_INFORMASI')).toBe(true);
  });

  it('TIDAK mengarang rujukan penyedia', async () => {
    const h = await adapter.kirim({
      channel: 'WHATSAPP',
      title: 'Uji',
      message: 'Uji',
      recipients: ['62812'],
    });
    expect(h.terkirim).toBe(false);
    expect(h.providerReference).toBeNull();
    expect(h.recipientCount).toBe(0);
    expect(h.blockedReason).toContain('jangan memberi tahu warga');
  });

  it('papan informasi mengembalikan rujukan yang menyebut sumbernya sendiri', async () => {
    const h = await adapter.kirim({
      channel: 'PAPAN_INFORMASI',
      title: 'Uji',
      message: 'Uji',
      recipients: ['a', 'b'],
    });
    expect(h.terkirim).toBe(true);
    expect(h.providerReference).toMatch(/^PAPAN:/);
    expect(h.recipientCount).toBe(2);
  });
});
