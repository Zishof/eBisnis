import { clampDuration, normalizeUiRoute, parseClientTime } from './ui-activity.service';
import { describeChanges } from './table-audit.service';

describe('normalizeUiRoute', () => {
  it('membuang kueri string', () => {
    /*
     * Kata kunci pencarian pada URL menyingkap isi data yang dicari: seseorang
     * yang membuka /pelanggan?cari=Budi+Santoso menyatakan bahwa ia mencari
     * orang itu, dan analitik pemakaian tidak berhak menyimpan pengetahuan
     * tersebut.
     */
    expect(normalizeUiRoute('/pelanggan?cari=Budi+Santoso')).toBe('/pelanggan');
    expect(normalizeUiRoute('/faktur?nomor=INV-2026-0001&status=LUNAS')).toBe('/faktur');
  });

  it('membuang fragmen', () => {
    expect(normalizeUiRoute('/laporan#bagian-3')).toBe('/laporan');
  });

  it('memotong jalur yang terlalu panjang agar muat kolomnya', () => {
    expect(normalizeUiRoute(`/${'a'.repeat(1000)}`)!.length).toBeLessThanOrEqual(255);
  });

  it('kosong dan tidak ada sama-sama menghasilkan null', () => {
    expect(normalizeUiRoute(undefined)).toBeNull();
    expect(normalizeUiRoute(null)).toBeNull();
    expect(normalizeUiRoute('')).toBeNull();
    expect(normalizeUiRoute('?hanya=kueri')).toBeNull();
  });
});

describe('clampDuration', () => {
  it('membatasi tab yang dibiarkan terbuka semalaman', () => {
    // Delapan jam bukan berarti orang menatap layar selama itu.
    const delapanJam = 8 * 60 * 60 * 1000;
    expect(clampDuration(delapanJam)).toBe(2 * 60 * 60 * 1000);
  });

  it('menolak nilai yang tidak berarti', () => {
    expect(clampDuration(-1)).toBeNull();
    expect(clampDuration(Number.NaN)).toBeNull();
    expect(clampDuration(Number.POSITIVE_INFINITY)).toBeNull();
    expect(clampDuration(undefined)).toBeNull();
    expect(clampDuration(null)).toBeNull();
  });

  it('meneruskan durasi wajar apa adanya', () => {
    expect(clampDuration(4500)).toBe(4500);
    expect(clampDuration(0)).toBe(0);
    expect(clampDuration(1234.7)).toBe(1235);
  });
});

describe('parseClientTime', () => {
  it('membuang jam peramban yang salah bertahun-tahun', () => {
    // Satu baris bertahun 1970 atau 2099 akan merusak setiap rentang tanggal
    // yang dihitung darinya.
    expect(parseClientTime('1970-01-01T00:00:00Z')).toBeNull();
    expect(parseClientTime('2099-01-01T00:00:00Z')).toBeNull();
  });

  it('menerima waktu sekarang', () => {
    const sekarang = new Date().toISOString();
    expect(parseClientTime(sekarang)).toBeInstanceOf(Date);
  });

  it('menerima laporan yang tertunda beberapa jam', () => {
    // Peramban mengirim secara berkelompok; laporan yang menumpuk sah.
    const tigaJamLalu = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(parseClientTime(tigaJamLalu)).toBeInstanceOf(Date);
  });

  it('menolak masukan yang bukan waktu', () => {
    expect(parseClientTime('bukan tanggal')).toBeNull();
    expect(parseClientTime(undefined)).toBeNull();
    expect(parseClientTime('')).toBeNull();
  });
});

describe('describeChanges', () => {
  it('menyebut kolom yang berubah beserta nilai sebelum dan sesudahnya', () => {
    const hasil = describeChanges(
      ['status', 'total'],
      { status: 'DRAFT', total: 1000, catatan: 'sama' },
      { status: 'POSTED', total: 1500, catatan: 'sama' },
    );
    expect(hasil).toEqual([
      { column: 'status', before: 'DRAFT', after: 'POSTED' },
      { column: 'total', before: 1000, after: 1500 },
    ]);
  });

  it('membuang kolom yang ditandai berubah padahal nilainya sama', () => {
    // Trigger kadang menandai seluruh kolom saat baris ditulis ulang utuh, dan
    // menampilkannya membuat pembacanya mencari perbedaan yang tidak ada.
    const hasil = describeChanges(['status', 'catatan'], { status: 'DRAFT', catatan: 'x' }, {
      status: 'POSTED',
      catatan: 'x',
    });
    expect(hasil.map((c) => c.column)).toEqual(['status']);
  });

  it('tidak pernah menampilkan kolom rahasia', () => {
    const hasil = describeChanges(
      ['password_hash', 'token_hash', 'username'],
      { password_hash: '$argon2id$lama', token_hash: 'abc', username: 'budi' },
      { password_hash: '$argon2id$baru', token_hash: 'def', username: 'budi.s' },
    );
    expect(hasil.map((c) => c.column)).toEqual(['username']);
    expect(JSON.stringify(hasil)).not.toContain('argon2');
  });

  it('menganggap seluruh kolom berubah pada INSERT', () => {
    // Sebelum INSERT tidak ada apa pun — jadi memang seluruhnya berubah.
    const hasil = describeChanges(null, null, { kode: 'A1', nama: 'Barang' });
    expect(hasil).toEqual([
      { column: 'kode', before: null, after: 'A1' },
      { column: 'nama', before: null, after: 'Barang' },
    ]);
  });

  it('menganggap seluruh kolom berubah pada DELETE', () => {
    const hasil = describeChanges(null, { kode: 'A1' }, null);
    expect(hasil).toEqual([{ column: 'kode', before: 'A1', after: null }]);
  });

  it('memotong nilai teks yang sangat panjang', () => {
    const panjang = 'x'.repeat(10_000);
    const hasil = describeChanges(['isi'], { isi: '' }, { isi: panjang });
    expect(String(hasil[0].after)).toContain('10000 karakter');
    expect(String(hasil[0].after).length).toBeLessThan(600);
  });

  it('daftar kosong tidak menghasilkan galat', () => {
    expect(describeChanges(null, null, null)).toEqual([]);
    expect(describeChanges([], {}, {})).toEqual([]);
  });
});
