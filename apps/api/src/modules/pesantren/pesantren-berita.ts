/**
 * Berita/kabar pondok — bagian yang dapat dibuktikan tanpa basis data.
 * Pola sama dengan `pesantren-santri.ts`.
 */

export const STATUS_BERITA = ['DRAFT', 'TERBIT'] as const;
export type StatusBerita = (typeof STATUS_BERITA)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanBerita {
  judul?: string;
  ringkasan?: string | null;
  isiHtml?: string | null;
  gambarUrl?: string | null;
  sumberUrl?: string | null;
  tanggalTerbit?: string | null;
}

export function kodeBerkasGambarBerita(id: string): string {
  return `BERITA_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function lintasanGambarBerita(id: string): string {
  return `/api/v1/pesantren/public/berita-gambar/${kodeBerkasGambarBerita(id)}`;
}

export function validasiBerita(masukan: MasukanBerita): Galat[] {
  const galat: Galat[] = [];

  const judul = (masukan.judul ?? '').trim();
  if (!judul) {
    galat.push({ field: 'judul', code: 'WAJIB', message: 'Judul berita wajib diisi.' });
  } else if (judul.length > 255) {
    galat.push({ field: 'judul', code: 'TERLALU_PANJANG', message: 'Judul maksimal 255 karakter.' });
  }

  if (masukan.tanggalTerbit) {
    const d = new Date(masukan.tanggalTerbit);
    if (Number.isNaN(d.getTime())) {
      galat.push({ field: 'tanggalTerbit', code: 'TIDAK_SAH', message: 'Tanggal terbit tidak sah.' });
    }
  }

  return galat;
}
