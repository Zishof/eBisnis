/**
 * Validasi tagihan pendidikan/SPP (EP-F). Pola sama dengan
 * `pesantren-santri.ts` dan `pesantren-presensi.ts`.
 */

export const STATUS_TAGIHAN = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'] as const;
export type StatusTagihan = (typeof STATUS_TAGIHAN)[number];

export interface MasukanItemTagihan {
  kode?: string;
  deskripsi?: string;
  jumlah?: number;
}

export interface MasukanTagihan {
  santriId?: string;
  periode?: string;
  jatuhTempo?: string;
  catatan?: string;
  items?: MasukanItemTagihan[];
}

export interface Galat {
  field: string;
  code: string;
  message: string;
}

function tanggalSah(nilai: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return false;
  const d = new Date(`${nilai}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

export function validasiTagihan(masukan: MasukanTagihan): Galat[] {
  const galat: Galat[] = [];

  if (!masukan.santriId || typeof masukan.santriId !== 'string') {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }

  if (!masukan.periode || typeof masukan.periode !== 'string') {
    galat.push({ field: 'periode', code: 'WAJIB', message: 'Periode tagihan wajib diisi.' });
  } else if (!/^\d{4}-\d{2}$/.test(masukan.periode)) {
    galat.push({
      field: 'periode',
      code: 'TIDAK_SAH',
      message: 'Format periode tidak dikenali. Pakai YYYY-MM, misalnya 2026-08.',
    });
  }

  if (!masukan.jatuhTempo || typeof masukan.jatuhTempo !== 'string') {
    galat.push({ field: 'jatuhTempo', code: 'WAJIB', message: 'Tanggal jatuh tempo wajib diisi.' });
  } else if (!tanggalSah(masukan.jatuhTempo)) {
    galat.push({
      field: 'jatuhTempo',
      code: 'TIDAK_SAH',
      message: 'Format tanggal jatuh tempo tidak dikenali. Pakai YYYY-MM-DD.',
    });
  }

  if (!masukan.items || masukan.items.length === 0) {
    galat.push({
      field: 'items',
      code: 'WAJIB',
      message: 'Tagihan wajib punya sekurang-kurangnya satu rincian biaya.',
    });
  } else {
    masukan.items.forEach((item, index) => {
      if (!item.kode?.trim()) {
        galat.push({ field: `items[${index}].kode`, code: 'WAJIB', message: `Rincian ke-${index + 1}: kode wajib diisi.` });
      }
      if (!item.deskripsi?.trim()) {
        galat.push({
          field: `items[${index}].deskripsi`,
          code: 'WAJIB',
          message: `Rincian ke-${index + 1}: deskripsi wajib diisi.`,
        });
      }
      if (typeof item.jumlah !== 'number' || Number.isNaN(item.jumlah) || item.jumlah <= 0) {
        galat.push({
          field: `items[${index}].jumlah`,
          code: 'TIDAK_SAH',
          message: `Rincian ke-${index + 1}: jumlah harus berupa angka lebih besar dari nol.`,
        });
      }
    });
  }

  return galat;
}

export function totalTagihan(items: MasukanItemTagihan[]): number {
  return items.reduce((total, item) => total + (item.jumlah ?? 0), 0);
}
