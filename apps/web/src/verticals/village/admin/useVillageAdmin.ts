/**
 * Pembacaan untuk layar petugas desa.
 *
 * ## Tiga keadaan, bukan dua — dan yang ketiga yang paling sering keliru
 *
 * Aturan yang sama dengan situs publik dan aplikasi warga: "gagal memuat" dan
 * "belum ada isi" tidak boleh terlihat sama. Di layar petugas akibatnya lebih
 * berat daripada di situs: petugas yang melihat "belum ada permohonan" padahal
 * peladennya bermasalah akan **pulang**, dan warga yang berkasnya sudah masuk
 * menunggu tanpa ada yang mengerjakannya.
 *
 * ## Keadaan keempat: cakupan wilayah
 *
 * Sebagian layar kependudukan mengembalikan `scope`. Petugas RT hanya melihat
 * RT-nya, dan bila ia tidak melihat apa pun, sebabnya bisa dua: memang tidak
 * ada, atau ia tidak berwenang. Keduanya sangat berbeda dan penyelesaiannya
 * juga berbeda — karena itu keterangan cakupan ikut ditampilkan, bukan
 * disembunyikan.
 */

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';
import { useErrorMessage } from '../../../app/auth-context';

/** Satu baris daftar. Bentuknya ditentukan peladen, bukan layar. */
export type BarisDaftar = Record<string, unknown>;

export interface HasilDaftar {
  kode: string;
  judul: string;
  rows: BarisDaftar[];
  total: number;
  limit: number;
  offset: number;
  appliedFilters: string[];
  /**
   * Saringan yang **diabaikan** peladen karena nilainya tidak sah.
   *
   * Ditampilkan, tidak didiamkan. Saringan yang diabaikan diam-diam
   * menghasilkan daftar penuh, dan petugas menyimpulkan saringannya tidak
   * berfungsi — padahal yang salah nilainya.
   */
  ignoredFilters: string[];
}

export interface Cakupan {
  level: string;
  description?: string | null;
}

export interface HasilBercakupan {
  scope: Cakupan;
  rows: BarisDaftar[];
}

/** Membuang saringan kosong supaya tidak ikut menjadi kueri. */
function bersihkan(saringan: Record<string, string | undefined>): Record<string, string> {
  const keluar: Record<string, string> = {};
  for (const [k, v] of Object.entries(saringan)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') keluar[k] = String(v);
  }
  return keluar;
}

/**
 * Menyusun alamat beserta kuerinya.
 *
 * `URLSearchParams` yang menyandikan nilainya, bukan penggabungan teks. Nama
 * warga mengandung spasi, dan alamat mengandung garis miring — keduanya
 * merusak alamat bila disambung apa adanya.
 */
function denganKueri(jalur: string, kueri: Record<string, string>): string {
  const q = new URLSearchParams(kueri).toString();
  return q ? `${jalur}?${q}` : jalur;
}

/**
 * Pesan galat yang sudah terikat penerjemah.
 *
 * `useErrorMessage` milik Core meminta fungsi `t` sebagai argumen kedua.
 * Membungkusnya di sini membuat seluruh layar desa memanggilnya dengan satu
 * argumen, dan tidak ada satu layar pun yang lupa menerjemahkan.
 */
export function usePesanGalat() {
  const { t } = useTranslation();
  const dasar = useErrorMessage();
  // `t` milik i18next punya beban tipe yang lebih longgar daripada yang diminta
  // `useErrorMessage`; dibungkus supaya keduanya cocok tanpa `as` di mana pun.
  return useCallback(
    (e: unknown) => dasar(e, (kunci: string, cadangan?: string) => t(kunci, cadangan ?? kunci)),
    [dasar, t],
  );
}

/**
 * Menjalankan satu daftar.
 *
 * `kode` adalah kode daftar pada `village-listing.ts` di peladen — bukan nama
 * tabel. Peladenlah yang memutuskan tabel, kolom, dan urutannya; layar ini
 * hanya menyebut daftar mana yang ia mau.
 */
export function useDaftarDesa(
  kode: string,
  saringan: Record<string, string | undefined> = {},
  halaman = { limit: 50, offset: 0 },
) {
  const bersih = bersihkan(saringan);
  return useQuery({
    queryKey: ['village-list', kode, bersih, halaman.limit, halaman.offset],
    queryFn: () =>
      api.get<HasilDaftar>(
        denganKueri(`/village/lists/${kode}`, {
          ...bersih,
          limit: String(halaman.limit),
          offset: String(halaman.offset),
        }),
      ),
    // Layar petugas dibuka berulang kali sepanjang hari; data yang berumur
    // setengah menit masih benar dan menghemat sambungan kantor desa.
    staleTime: 30_000,
  });
}

/** Daftar yang tersedia beserta hak akses dan saringannya. */
export function useKatalogDaftar() {
  return useQuery({
    queryKey: ['village-list-catalog'],
    queryFn: () =>
      api.get<
        Array<{
          code: string;
          title: string;
          permission: string;
          feature: string;
          filters: Array<{ key: string; type: string; options: string[] | null }>;
        }>
      >('/village/lists'),
    staleTime: 10 * 60_000,
  });
}

/** Pembacaan berbercakupan: kependudukan. */
export function useBercakupan(
  jalur: string,
  kunci: string,
  saringan: Record<string, string | undefined> = {},
  aktif = true,
) {
  const bersih = bersihkan(saringan);
  return useQuery({
    queryKey: ['village-scoped', kunci, bersih],
    queryFn: () => api.get<HasilBercakupan>(denganKueri(jalur, bersih)),
    enabled: aktif,
    staleTime: 30_000,
  });
}

/** Profil unit. Bentuknya sengaja sempit — lihat `village-unit.service.ts`. */
export interface UnitDesa {
  id: string;
  profileType: 'DESA' | 'KELURAHAN';
  code: string;
  name: string;
  slug: string;
  administrativeCode?: string | null;
  enabledFeatures: string[];
}

export function useUnitDesa() {
  return useQuery({
    queryKey: ['village-unit'],
    queryFn: () => api.get<UnitDesa>('/village/unit'),
    staleTime: 5 * 60_000,
  });
}

export interface Kelayakan {
  profileType: 'DESA' | 'KELURAHAN';
  enabledFeatures: string[];
  features: Record<string, { eligibility: string; allowed: boolean; reason?: string }>;
}

export function useKelayakan() {
  return useQuery({
    queryKey: ['village-eligibility'],
    queryFn: () => api.get<Kelayakan>('/village/eligibility'),
    staleTime: 5 * 60_000,
  });
}

/** Pembacaan D-1 yang bentuknya sudah ditentukan layanannya masing-masing. */
export function useBacaDesa<T>(jalur: string, kunci: unknown[], aktif = true) {
  return useQuery({
    queryKey: ['village-read', ...kunci],
    queryFn: () => api.get<T>(jalur),
    enabled: aktif,
    staleTime: 60_000,
  });
}

// --- Pembacaan nilai baris ---------------------------------------------------
//
// Baris datang sebagai `Record<string, unknown>` karena bentuknya ditentukan
// konfigurasi peladen. Pembaca di bawah menyempitkan tipenya di satu tempat,
// bukan dengan `as string` yang bertaburan di seluruh layar.

export function teks(row: BarisDaftar, kunci: string): string | null {
  const v = row[kunci];
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

export function angka(row: BarisDaftar, kunci: string): number | null {
  const v = row[kunci];
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function benar(row: BarisDaftar, kunci: string): boolean {
  return row[kunci] === true || row[kunci] === 'true';
}

export function id(row: BarisDaftar): string {
  return String(row.id ?? '');
}
