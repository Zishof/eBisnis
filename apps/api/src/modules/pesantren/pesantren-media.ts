export const KATEGORI_MEDIA_PESANTREN = ['GALERI', 'PROGRAM', 'FASILITAS', 'KEGIATAN', 'PRESTASI'] as const;
export type KategoriMediaPesantren = (typeof KATEGORI_MEDIA_PESANTREN)[number];

export function kodeBerkasMediaPesantren(id: string): string {
  return `PESANTREN_MEDIA_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function lintasanMediaPesantren(id: string): string {
  return `/api/v1/pesantren/public/media/${id}`;
}
