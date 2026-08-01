/**
 * Pembacaan situs desa.
 *
 * Seluruhnya `GET`, dan tidak ada satu pun fungsi tulis di berkas ini — sengaja
 * dan permanen. Situs desa adalah halaman yang paling mudah ditemukan dan
 * paling jarang diperhatikan; menaruh satu jalur tulis di sini akan
 * menjadikannya sasaran yang lebih berharga daripada seluruh halaman
 * administrasi.
 *
 * Ketika permintaan gagal, halaman **tidak** boleh menampilkan "belum ada data".
 * Keduanya dibedakan sampai ke tampilan: `isError` menghasilkan pesan galat,
 * `data.length === 0` menghasilkan keadaan kosong. Warga yang membuka halaman
 * berita desa dan melihat "belum ada berita" padahal servernya sedang
 * bermasalah akan berhenti membukanya lagi.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export interface ProfilDesa {
  name: string;
  profileType: 'DESA' | 'KELURAHAN';
  administrativeCode?: string | null;
  address?: string | null;
  motto?: string | null;
  phone?: string | null;
  email?: string | null;
  provinceName?: string | null;
  regencyName?: string | null;
  districtName?: string | null;
  areaKm2?: string | null;
  establishedYear?: number | null;
}

export interface BeritaDesa {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  coverPath?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
  category?: string | null;
}

export interface AgendaDesa {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
}

export interface WisataDesa {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  address?: string | null;
  openHours?: string | null;
  entryFee?: string | null;
  isFree?: boolean;
  managerName?: string | null;
  managerContact?: string | null;
  facilities?: string | null;
}

export interface UmkmDesa {
  id: string;
  businessName: string;
  businessSector?: string | null;
  description?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface ApbdesRingkas {
  fiscalYear: number;
  totalRevenue: string;
  totalExpenditure: string;
  regulationNumber?: string | null;
  establishedAt?: string | null;
}

export interface MenuDesa {
  slug: string;
  label: string;
  sortOrder: number;
}

export interface HalamanDesa {
  id: string;
  slug: string;
  title: string;
  body: string;
  updatedAt?: string | null;
}

const dasar = (slug: string) => `/village/public/${encodeURIComponent(slug)}`;

export function useProfilDesa(slug: string) {
  return useQuery({
    queryKey: ['desa', slug, 'profil'],
    queryFn: () => api.get<ProfilDesa>(`${dasar(slug)}/profile`),
    enabled: Boolean(slug),
  });
}

export function useMenuDesa(slug: string) {
  return useQuery({
    queryKey: ['desa', slug, 'menu'],
    queryFn: () => api.get<MenuDesa[]>(`${dasar(slug)}/menu`),
    enabled: Boolean(slug),
  });
}

export function useHalamanDesa(slug: string, halaman: string) {
  return useQuery({
    queryKey: ['desa', slug, 'halaman', halaman],
    queryFn: () => api.get<HalamanDesa>(`${dasar(slug)}/pages/${encodeURIComponent(halaman)}`),
    enabled: Boolean(slug && halaman),
  });
}

export function useBeritaDesa(slug: string, limit = 9) {
  return useQuery({
    queryKey: ['desa', slug, 'berita', limit],
    queryFn: () => api.get<BeritaDesa[]>(`${dasar(slug)}/news?limit=${limit}`),
    enabled: Boolean(slug),
  });
}

export function useBeritaSatu(slug: string, beritaSlug: string) {
  return useQuery({
    queryKey: ['desa', slug, 'berita', beritaSlug],
    queryFn: () => api.get<BeritaDesa>(`${dasar(slug)}/news/${encodeURIComponent(beritaSlug)}`),
    enabled: Boolean(slug && beritaSlug),
  });
}

export function useAgendaDesa(slug: string) {
  return useQuery({
    queryKey: ['desa', slug, 'agenda'],
    queryFn: () => api.get<AgendaDesa[]>(`${dasar(slug)}/agenda`),
    enabled: Boolean(slug),
  });
}

export function useWisataDesa(slug: string) {
  return useQuery({
    queryKey: ['desa', slug, 'wisata'],
    queryFn: () => api.get<WisataDesa[]>(`${dasar(slug)}/tourism`),
    enabled: Boolean(slug),
  });
}

export function useUmkmDesa(slug: string) {
  return useQuery({
    queryKey: ['desa', slug, 'umkm'],
    queryFn: () => api.get<UmkmDesa[]>(`${dasar(slug)}/umkm`),
    enabled: Boolean(slug),
  });
}

export function useApbdesDesa(slug: string) {
  return useQuery({
    queryKey: ['desa', slug, 'apbdes'],
    queryFn: () => api.get<ApbdesRingkas[]>(`${dasar(slug)}/budget`),
    enabled: Boolean(slug),
  });
}

/** Rupiah penuh. Sen tidak dipakai pada pembukuan desa. */
export function rupiah(nilai: string | number | null | undefined): string {
  if (nilai === null || nilai === undefined || nilai === '') return '—';
  const n = Number(nilai);
  if (!Number.isFinite(n)) return '—';
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

/**
 * Tarif masuk destinasi.
 *
 * Nol dan "belum diisi" tidak pernah disamakan: yang gratis ditulis Gratis,
 * yang belum diisi ditulis apa adanya. Destinasi yang tarifnya tidak diketahui
 * adalah destinasi yang tarifnya ditentukan di pintu masuk.
 */
export function tarifMasuk(w: Pick<WisataDesa, 'isFree' | 'entryFee'>): string {
  if (w.isFree) return 'Gratis';
  if (w.entryFee === null || w.entryFee === undefined || w.entryFee === '') {
    return 'Tarif belum dicantumkan';
  }
  return rupiah(w.entryFee);
}
