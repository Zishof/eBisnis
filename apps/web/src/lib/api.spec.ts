/**
 * Pengujian penyegaran token.
 *
 * ## Mengapa berkas ini ada
 *
 * Cacat yang dijaga di sini ditemukan dari jejak jaringan satu kegagalan uji
 * peramban di CI: layar kasir mendadak berpindah ke halaman masuk di tengah
 * transaksi. Sebabnya bukan sesi yang kedaluwarsa, melainkan **429 sesaat** dari
 * pembatas laju — dan kode penyegaran memperlakukan setiap jawaban tidak-OK
 * sebagai "sesi Anda tidak sah lagi", lalu membuang refresh token sehingga tidak
 * ada jalan kembali.
 *
 * Pada kasir, akibatnya keranjang yang sedang dilayani lenyap karena peladen
 * sesaat sibuk, di depan pembeli yang sudah menunggu. Tidak ada galat yang
 * menyebutkan sebabnya; yang terlihat hanya layar masuk.
 *
 * Karena itu yang diuji bukan "apakah refresh bekerja", melainkan **apa yang
 * TIDAK boleh terjadi ketika refresh gagal untuk alasan yang sementara.**
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  _setelUlangUntukUji,
  apiRequest,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './api';

const asli = globalThis.fetch;

/** Jawaban JSON ringkas, dalam bentuk amplop yang dipakai peladen. */
function jawab(status: number, data: unknown = {}, success = status < 400) {
  return new Response(JSON.stringify({ success, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  _setelUlangUntukUji();
  setAccessToken('token-lama');
  setRefreshToken('refresh-lama');
});

afterEach(() => {
  globalThis.fetch = asli;
  setAccessToken(null);
  setRefreshToken(null);
  vi.restoreAllMocks();
});

describe('penyegaran token saat gagal sementara', () => {
  it('429 pada refresh TIDAK membuang sesi', async () => {
    /*
     * Inilah cacat aslinya. Dibatasi laju bukan berarti sesinya tidak sah —
     * ia berarti "coba lagi sebentar lagi". Membuang refresh token karenanya
     * membuat pemulihan mustahil: tidak ada lagi yang dapat dipakai mencoba.
     */
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) return jawab(429, {}, false);
      return jawab(401, {}, false);
    }) as typeof fetch;

    await expect(apiRequest('/apa-saja')).rejects.toBeInstanceOf(ApiError);

    expect(getRefreshToken()).toBe('refresh-lama');
  });

  it('5xx pada refresh TIDAK membuang sesi', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) return jawab(503, {}, false);
      return jawab(401, {}, false);
    }) as typeof fetch;

    await expect(apiRequest('/apa-saja')).rejects.toBeInstanceOf(ApiError);
    expect(getRefreshToken()).toBe('refresh-lama');
  });

  it('galat jaringan pada refresh TIDAK membuang sesi', async () => {
    // Justru ketika jaringan bermasalah refresh token paling dibutuhkan.
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/auth/refresh')) throw new TypeError('Failed to fetch');
      return jawab(401, {}, false);
    }) as typeof fetch;

    await expect(apiRequest('/apa-saja')).rejects.toBeInstanceOf(ApiError);
    expect(getRefreshToken()).toBe('refresh-lama');
  });

  it('401 pada refresh MEMANG mengakhiri sesi', async () => {
    // Kebalikannya harus tetap berlaku: token yang benar-benar dicabut tidak
    // boleh disimpan seolah masih berguna.
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/auth/refresh')) return jawab(401, {}, false);
      return jawab(401, {}, false);
    }) as typeof fetch;

    await expect(apiRequest('/apa-saja')).rejects.toBeInstanceOf(ApiError);
    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('403 pada refresh juga mengakhiri sesi', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/auth/refresh')) return jawab(403, {}, false);
      return jawab(401, {}, false);
    }) as typeof fetch;

    await expect(apiRequest('/apa-saja')).rejects.toBeInstanceOf(ApiError);
    expect(getRefreshToken()).toBeNull();
  });
});

describe('jumlah penyegaran', () => {
  it('satu kali kedaluwarsa hanya menghasilkan satu refresh, meski banyak permintaan bersamaan', async () => {
    /*
     * Rotasi token berarti setiap refresh menghanguskan yang sebelumnya.
     * Permintaan yang sudah terbang saat token disegarkan kembali membawa 401
     * yang sudah basi; menyegarkan lagi untuk itu memutar token dua kali dan
     * menggandakan lalu lintas auth — persis yang mendorong pembatas laju
     * melewati batasnya pada rangkaian uji peramban.
     */
    let refreshKe = 0;
    let sudahSegar = false;

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshKe += 1;
        sudahSegar = true;
        return jawab(200, { accessToken: 'token-baru', refreshToken: 'refresh-baru' });
      }
      // Sebelum disegarkan seluruh permintaan ditolak; sesudahnya diterima.
      return sudahSegar ? jawab(200, { ok: true }) : jawab(401, {}, false);
    }) as typeof fetch;

    await Promise.all([apiRequest('/a'), apiRequest('/b'), apiRequest('/c')]);

    expect(refreshKe).toBe(1);
    expect(getRefreshToken()).toBe('refresh-baru');
  });

  it('401 yang datang tepat sesudah penyegaran tidak memicu penyegaran kedua', async () => {
    let refreshKe = 0;
    let permintaanKe = 0;

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshKe += 1;
        return jawab(200, { accessToken: 'token-baru', refreshToken: 'refresh-baru' });
      }
      permintaanKe += 1;
      /*
       * Percobaan ke-1 memicu penyegaran, dan percobaan ulangnya (ke-2)
       * berhasil. Percobaan ke-3 adalah permintaan yang sudah terbang lebih
       * dahulu dan kembali membawa 401 yang sudah basi — percobaan ulangnya
       * (ke-4) harus berhasil TANPA penyegaran kedua.
       */
      if (permintaanKe === 1 || permintaanKe === 3) return jawab(401, {}, false);
      return jawab(200, { ok: true });
    }) as typeof fetch;

    await apiRequest('/a');
    await apiRequest('/b');

    expect(refreshKe).toBe(1);
  });

  it('tanpa refresh token, tidak ada permintaan refresh sama sekali', async () => {
    setRefreshToken(null);
    let refreshKe = 0;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/auth/refresh')) refreshKe += 1;
      return jawab(401, {}, false);
    }) as typeof fetch;

    await expect(apiRequest('/a')).rejects.toBeInstanceOf(ApiError);
    expect(refreshKe).toBe(0);
  });
});

/*
 * Cacat yang sama pernah ada di DUA tempat.
 *
 * `lib/api.ts` menangani penyegaran otomatis saat sebuah permintaan menerima
 * 401. `app/auth-context.tsx` menangani pemulihan sesi saat aplikasi baru
 * dimuat — dan ia memanggil `/auth/refresh` sendiri dengan `skipRefresh`,
 * sehingga tidak melewati jalur di atas sama sekali.
 *
 * Memperbaiki satu tanpa yang lain tidak menyelesaikan apa pun: jalur kedualah
 * yang menyala pada kegagalan CI, sebab `/auth/me` yang dijawab 429 ikut
 * menjatuhkan sesinya. Uji berikut menjaga pembeda yang dipakai keduanya.
 */
describe('pembeda penolakan yang mengakhiri sesi', () => {
  it('ApiError membawa status HTTP-nya, sehingga 429 dapat dibedakan dari 401', async () => {
    globalThis.fetch = vi.fn(async () => jawab(429, {}, false)) as typeof fetch;

    const galat = await apiRequest('/a', { skipRefresh: true }).catch((e) => e);

    // `instanceof` harus benar-benar bekerja saat dijalankan. Bila `ApiError`
    // hanya diimpor sebagai tipe di tempat pemakaiannya, perbandingannya terhapus
    // saat kompilasi dan SELURUH galat dianggap sementara — tanpa satu pun galat.
    expect(galat).toBeInstanceOf(ApiError);
    expect((galat as ApiError).status).toBe(429);
  });

  it('status 401 terbaca apa adanya', async () => {
    globalThis.fetch = vi.fn(async () => jawab(401, {}, false)) as typeof fetch;
    const galat = await apiRequest('/a', { skipRefresh: true }).catch((e) => e);
    expect((galat as ApiError).status).toBe(401);
  });
});
