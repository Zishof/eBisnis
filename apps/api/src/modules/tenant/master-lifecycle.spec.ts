/**
 * Pengujian penyamaran field sensitif (data bank pemasok/pelanggan).
 *
 * Sebelumnya nomor rekening penuh terkirim ke setiap pemanggil ber-hak READ
 * dasar -- "penyamaran" yang ada hanya state komponen React lokal tanpa
 * pemeriksaan hak akses sama sekali. Berkas ini menguji aturan murninya:
 * kosong tetap kosong, terisi menjadi disamarkan kecuali diizinkan.
 */

import { maskAuditRows, maskFields, NILAI_DISAMARKAN, resolveReferenceMatchValue } from './master-lifecycle.service';

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

/**
 * Jalur audit trail TIDAK memakai maskFields -- nilai sensitif hidup di
 * dalam old_data/new_data (snapshot JSONB baris penuh dari trigger basis
 * data), bukan sebagai kolom pada baris riwayatnya sendiri. Ditemukan lewat
 * audit langsung: siapa pun ber-AUDIT_READ bisa membaca nomor rekening penuh
 * dari riwayat perubahan walau tidak punya VIEW_BANK_DETAILS -- endpoint
 * list()/findById() sudah bergerbang, endpoint audit ini belum.
 */
describe('maskAuditRows', () => {
  it('tidak mengubah apa pun bila revealed benar', () => {
    const rows = [{ id: '1', old_data: { bank_account_number: '1234567890' }, new_data: null }];
    expect(maskAuditRows(rows, FIELDS, true)).toEqual(rows);
  });

  it('menyamarkan field sensitif di dalam old_data dan new_data ketika revealed salah', () => {
    const rows = [
      {
        id: '1',
        operation: 'UPDATE',
        old_data: { name: 'Bank BCA', bank_account_number: '1234567890' },
        new_data: { name: 'Bank BCA', bank_account_number: '0987654321' },
      },
    ];
    const hasil = maskAuditRows(rows, FIELDS, false);
    expect((hasil[0].old_data as Record<string, unknown>).bank_account_number).toBe(NILAI_DISAMARKAN);
    expect((hasil[0].new_data as Record<string, unknown>).bank_account_number).toBe(NILAI_DISAMARKAN);
    // Field lain (termasuk kolom baris riwayat itu sendiri) tidak ikut tersamar.
    expect((hasil[0].old_data as Record<string, unknown>).name).toBe('Bank BCA');
    expect(hasil[0].operation).toBe('UPDATE');
  });

  it('old_data/new_data null (mis. INSERT tanpa old_data) tidak menyebabkan galat', () => {
    const rows = [{ id: '1', operation: 'INSERT', old_data: null, new_data: { bank_account_number: '111' } }];
    const hasil = maskAuditRows(rows, FIELDS, false);
    expect(hasil[0].old_data).toBeNull();
    expect((hasil[0].new_data as Record<string, unknown>).bank_account_number).toBe(NILAI_DISAMARKAN);
  });

  it('field kosong di dalam snapshot tetap kosong, bukan ikut disamarkan', () => {
    const rows = [{ id: '1', old_data: { bank_account_number: '' }, new_data: null }];
    const hasil = maskAuditRows(rows, FIELDS, false);
    expect((hasil[0].old_data as Record<string, unknown>).bank_account_number).toBe('');
  });

  it('tidak memodifikasi baris atau snapshot asli (imutabel)', () => {
    const originalOldData = { bank_account_number: '1234567890' };
    const rows = [{ id: '1', old_data: originalOldData, new_data: null }];
    maskAuditRows(rows, FIELDS, false);
    expect(originalOldData.bank_account_number).toBe('1234567890');
  });
});

/**
 * Guard referensi purge salesperson bergantung pada ini: transaksi
 * (sales_order dkk.) menunjuk `user_subject_id` milik salesperson, bukan id
 * profil salesperson itu sendiri -- referential guard lama (`references: []`)
 * membiarkan salesperson berpiutang riwayat transaksi terhapus permanen
 * karena tidak ada kolom manapun pada tabel transaksi yang cocok dengan
 * id record yang dihapus.
 */
describe('resolveReferenceMatchValue', () => {
  it('tanpa viaColumn, cocokkan langsung terhadap id record', () => {
    const record = { id: 'sales-1', user_subject_id: 'user-9' };
    expect(resolveReferenceMatchValue(record, 'sales-1')).toBe('sales-1');
  });

  it('dengan viaColumn, cocokkan terhadap record[viaColumn], bukan id', () => {
    const record = { id: 'sales-1', user_subject_id: 'user-9' };
    expect(resolveReferenceMatchValue(record, 'sales-1', 'user_subject_id')).toBe('user-9');
  });

  it('viaColumn menunjuk kolom yang belum terisi menghasilkan null/undefined (harus dilewati)', () => {
    const record = { id: 'sales-1', user_subject_id: null };
    expect(resolveReferenceMatchValue(record, 'sales-1', 'user_subject_id')).toBeNull();
    expect(resolveReferenceMatchValue({ id: 'sales-1' }, 'sales-1', 'user_subject_id')).toBeUndefined();
  });
});
