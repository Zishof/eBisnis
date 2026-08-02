/**
 * Validasi transaksi dompet santri (EP-L). Pola sama dengan
 * `pesantren-tagihan.ts`.
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanDompet {
  santriId?: string;
  batasHarian?: number;
}

export function validasiDompet(masukan: MasukanDompet): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.santriId?.trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }
  if (masukan.batasHarian !== undefined && masukan.batasHarian !== null) {
    if (typeof masukan.batasHarian !== 'number' || Number.isNaN(masukan.batasHarian) || masukan.batasHarian <= 0) {
      galat.push({
        field: 'batasHarian',
        code: 'TIDAK_SAH',
        message: 'Batas belanja harian harus berupa angka lebih besar dari nol, atau dikosongkan.',
      });
    }
  }
  return galat;
}

export interface MasukanTransaksi {
  jumlah?: number;
  keterangan?: string;
}

export function validasiTransaksi(masukan: MasukanTransaksi): Galat[] {
  const galat: Galat[] = [];
  if (typeof masukan.jumlah !== 'number' || Number.isNaN(masukan.jumlah) || masukan.jumlah <= 0) {
    galat.push({
      field: 'jumlah',
      code: 'TIDAK_SAH',
      message: 'Jumlah harus berupa angka lebih besar dari nol.',
    });
  }
  return galat;
}
