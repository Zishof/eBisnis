/**
 * Pengujian penyempitan izin oleh peran aktif.
 *
 * Yang diuji di sini adalah satu sifat yang harus selalu benar: memilih peran
 * hanya boleh mengurangi izin, tidak pernah menambah. Sifat itulah yang
 * membedakan fitur pembatasan dari peningkatan hak yang tidak disengaja.
 */

import { narrowToRole, unionOf, type PermissionRow } from './tenant-permission.service';

const PERAN_A = '11111111-1111-1111-1111-111111111111';
const PERAN_B = '22222222-2222-2222-2222-222222222222';

const dariPeran = (roleId: string, permission: string, effect = 'ALLOW'): PermissionRow => ({
  permission,
  effect,
  source: 'ROLE',
  role_id: roleId,
});

const langsung = (permission: string, effect = 'ALLOW'): PermissionRow => ({
  permission,
  effect,
  source: 'DIRECT',
  role_id: null,
});

describe('unionOf', () => {
  it('menggabungkan izin dari seluruh peran', () => {
    const hasil = unionOf([
      dariPeran(PERAN_A, 'PEMBELIAN.READ'),
      dariPeran(PERAN_B, 'KAS.READ'),
    ]);
    expect([...hasil].sort()).toEqual(['KAS.READ', 'PEMBELIAN.READ']);
  });

  it('DENY menang atas ALLOW dari peran mana pun', () => {
    const hasil = unionOf([
      dariPeran(PERAN_A, 'KAS.APPROVE'),
      dariPeran(PERAN_B, 'KAS.APPROVE', 'DENY'),
    ]);
    expect(hasil.has('KAS.APPROVE')).toBe(false);
  });

  it('DENY menang tanpa memandang urutan baris', () => {
    const hasil = unionOf([
      dariPeran(PERAN_B, 'KAS.APPROVE', 'DENY'),
      dariPeran(PERAN_A, 'KAS.APPROVE'),
    ]);
    expect(hasil.has('KAS.APPROVE')).toBe(false);
  });
});

describe('narrowToRole', () => {
  it('menyisakan izin peran aktif saja', () => {
    const rows = [
      dariPeran(PERAN_A, 'PEMBELIAN.READ'),
      dariPeran(PERAN_A, 'PEMBELIAN.CREATE'),
      dariPeran(PERAN_B, 'KAS.READ'),
      dariPeran(PERAN_B, 'KAS.APPROVE'),
    ];
    expect([...narrowToRole(rows, PERAN_A)].sort()).toEqual(['PEMBELIAN.CREATE', 'PEMBELIAN.READ']);
    expect([...narrowToRole(rows, PERAN_B)].sort()).toEqual(['KAS.APPROVE', 'KAS.READ']);
  });

  it('TIDAK PERNAH menambah izin — larangan peran lain tetap berlaku', () => {
    /*
     * Inilah celah yang aturan ini tutup.
     *
     * Peran A melarang KAS.APPROVE, peran B mengizinkannya. Gabungan keduanya
     * menolak karena DENY menang. Bila penyempitan hanya melihat peran B,
     * larangan peran A ikut hilang dan memilih peran B justru MEMBERI izin
     * yang tadinya tidak dimiliki — pembatasan yang diam-diam menjadi
     * peningkatan hak.
     */
    const rows = [
      dariPeran(PERAN_A, 'KAS.APPROVE', 'DENY'),
      dariPeran(PERAN_B, 'KAS.APPROVE'),
      dariPeran(PERAN_B, 'KAS.READ'),
    ];

    const penuh = unionOf(rows);
    const sempit = narrowToRole(rows, PERAN_B);

    expect(penuh.has('KAS.APPROVE')).toBe(false);
    expect(sempit.has('KAS.APPROVE')).toBe(false);
    expect([...sempit]).toEqual(['KAS.READ']);
  });

  it('hasil penyempitan selalu himpunan bagian dari gabungan penuh', () => {
    const rows = [
      dariPeran(PERAN_A, 'PEMBELIAN.READ'),
      dariPeran(PERAN_A, 'PEMBELIAN.APPROVE'),
      dariPeran(PERAN_A, 'KAS.READ', 'DENY'),
      dariPeran(PERAN_B, 'KAS.READ'),
      dariPeran(PERAN_B, 'KAS.APPROVE'),
      dariPeran(PERAN_B, 'PEMBELIAN.APPROVE', 'DENY'),
      langsung('LAPORAN.EXPORT'),
    ];

    const penuh = unionOf(rows);
    for (const peran of [PERAN_A, PERAN_B]) {
      for (const izin of narrowToRole(rows, peran)) {
        expect(penuh.has(izin)).toBe(true);
      }
    }
  });

  it('izin langsung tetap berlaku karena diberikan kepada orangnya', () => {
    const rows = [
      dariPeran(PERAN_A, 'PEMBELIAN.READ'),
      dariPeran(PERAN_B, 'KAS.READ'),
      langsung('LAPORAN.EXPORT'),
    ];
    expect(narrowToRole(rows, PERAN_A).has('LAPORAN.EXPORT')).toBe(true);
  });

  it('izin langsung pun kalah oleh DENY dari peran mana pun', () => {
    const rows = [
      langsung('LAPORAN.EXPORT'),
      dariPeran(PERAN_B, 'LAPORAN.EXPORT', 'DENY'),
      dariPeran(PERAN_A, 'PEMBELIAN.READ'),
    ];
    expect(narrowToRole(rows, PERAN_A).has('LAPORAN.EXPORT')).toBe(false);
    expect(unionOf(rows).has('LAPORAN.EXPORT')).toBe(false);
  });

  it('peran yang tidak dipegang menghasilkan izin langsung saja', () => {
    // Bukan galat: peran yang sudah dicabut menyisakan sesi yang menunjuknya.
    // Jawabannya paling sedikit, bukan paling banyak.
    const rows = [dariPeran(PERAN_A, 'PEMBELIAN.READ'), langsung('LAPORAN.EXPORT')];
    expect([...narrowToRole(rows, '99999999-9999-9999-9999-999999999999')]).toEqual([
      'LAPORAN.EXPORT',
    ]);
  });

  it('peran tunggal menghasilkan izin yang sama dengan gabungan', () => {
    // Sifat yang membuat perubahan ini aman bagi mayoritas pengguna: yang hanya
    // memegang satu peran tidak merasakan perbedaan apa pun.
    const rows = [
      dariPeran(PERAN_A, 'PEMBELIAN.READ'),
      dariPeran(PERAN_A, 'PEMBELIAN.CREATE'),
      langsung('LAPORAN.EXPORT'),
    ];
    expect([...narrowToRole(rows, PERAN_A)].sort()).toEqual([...unionOf(rows)].sort());
  });

  it('tidak ada peran yang dipilih berarti tidak ada penyempitan', () => {
    const rows = [dariPeran(PERAN_A, 'PEMBELIAN.READ'), dariPeran(PERAN_B, 'KAS.READ')];
    expect([...unionOf(rows)].sort()).toEqual(['KAS.READ', 'PEMBELIAN.READ']);
  });

  it('daftar kosong menghasilkan himpunan kosong, bukan galat', () => {
    expect(narrowToRole([], PERAN_A).size).toBe(0);
    expect(unionOf([]).size).toBe(0);
  });

  it('izin yang sama dari dua peran tidak digandakan', () => {
    const rows = [dariPeran(PERAN_A, 'KAS.READ'), dariPeran(PERAN_B, 'KAS.READ')];
    expect(narrowToRole(rows, PERAN_A).size).toBe(1);
    expect(unionOf(rows).size).toBe(1);
  });
});
