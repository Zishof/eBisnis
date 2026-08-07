/**
 * Pengujian penyamaran field sensitif (data bank pemasok/pelanggan).
 *
 * Sebelumnya nomor rekening penuh terkirim ke setiap pemanggil ber-hak READ
 * dasar -- "penyamaran" yang ada hanya state komponen React lokal tanpa
 * pemeriksaan hak akses sama sekali. Berkas ini menguji aturan murninya:
 * kosong tetap kosong, terisi menjadi disamarkan kecuali diizinkan.
 */

import { maskFields, NILAI_DISAMARKAN } from './master-lifecycle.service';

const FIELDS = ['bank_account_number', 'bank_account_name'];

describe('maskFields', () => {
  it('tidak mengubah apa pun bila revealed benar', () => {
    const rows = [{ id: '1', bank_account_number: '1234567890' }];
    expect(maskFields(rows, FIELDS, true)).toEqual(rows);
  });

  it('menyamarkan field yang terisi ketika revealed salah', () => {
    const rows = [{ id: '1', name: 'Bank BCA', bank_account_number: '1234567890' }];
    const hasil = maskFields(rows, FIELDS, false);
    expect(hasil[0].bank_account_number).toBe(NILAI_DISAMARKAN);
    // Field lain tidak ikut tersamar.
    expect(hasil[0].name).toBe('Bank BCA');
  });

  it('field kosong tetap kosong, bukan ikut disamarkan', () => {
    // Membedakan "kosong" dari "disembunyikan": kolom yang memang tidak
    // pernah diisi tidak boleh terlihat seolah menyembunyikan sesuatu.
    for (const kosong of [null, undefined, '']) {
      const rows = [{ id: '1', bank_account_number: kosong }];
      const hasil = maskFields(rows, FIELDS, false);
      expect(hasil[0].bank_account_number).toBe(kosong);
    }
  });

  it('tidak memodifikasi baris asli (imutabel)', () => {
    const original = { id: '1', bank_account_number: '1234567890' };
    const rows = [original];
    maskFields(rows, FIELDS, false);
    expect(original.bank_account_number).toBe('1234567890');
  });

  it('baris tanpa field sensitif tidak berubah', () => {
    const rows = [{ id: '1', code: 'SUP-001' }];
    expect(maskFields(rows, FIELDS, false)).toEqual(rows);
  });

  it('daftar field kosong berarti tidak ada yang disamarkan', () => {
    const rows = [{ id: '1', bank_account_number: '1234567890' }];
    expect(maskFields(rows, [], false)).toEqual(rows);
  });
});
