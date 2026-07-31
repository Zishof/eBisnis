/**
 * Pembacaan dan penulisan Anjungan Mandiri Desa.
 *
 * ## Kenapa anjungan punya berkasnya sendiri, bukan memakai halaman biasa
 *
 * Anjungan dipakai berdiri, dengan jari, oleh orang yang tidak memilih memakai
 * sistem ini. Ia tidak boleh memakai komponen yang dirancang untuk tetikus dan
 * layar besar: tombol yang nyaman ditekan tetikus terlalu kecil untuk jari
 * orang tua yang membawa map.
 *
 * ## Sesi berakhir sendiri dan menghapus jejaknya
 *
 * Kiosk di balai desa dipakai bergantian. Warga berikutnya berdiri di depan
 * layar yang sama kurang dari satu menit setelah yang sebelumnya pergi, sering
 * tanpa menekan apa pun untuk keluar. Karena itu `useKioskIdle` menghitung
 * mundur pada peramban, dan setiap perpindahan layar mengosongkan isian.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const DASAR = '/village/kiosk';

export interface MenuAnjungan {
  code: string;
  label: string;
  description: string;
  icon: string;
  needsClaimCode: boolean;
}

export interface LayarUtama {
  unitName: string;
  profileType: 'DESA' | 'KELURAHAN';
  greeting: string;
  menu: MenuAnjungan[];
}

export interface LangkahPanduan {
  nomor: number;
  judul: string;
  uraian: string;
}

export interface Panduan {
  kode: string;
  judul: string;
  ringkas: string;
  langkah: LangkahPanduan[];
}

export interface StatusPermohonan {
  requestNumber?: string | null;
  serviceName?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  submittedAt?: string | null;
  dueDate?: string | null;
  canPrintHere?: boolean;
}

export interface SuratCetak {
  letterNumber: string;
  letterDate: string;
  subject: string;
  body: string;
  signedPosition?: string | null;
  verificationToken?: string | null;
  printsRemaining: number;
}

export interface Antrean {
  ticketNumber: string;
  status: string;
  aheadCount: number;
  estimatedWaitMinutes: number;
}

export interface Pengumuman {
  news: Array<{ title: string; summary?: string | null; publishedAt?: string | null }>;
  agenda: Array<{ title: string; startAt: string; location?: string | null }>;
  aidPrograms: Array<{
    programName: string;
    aidCategory: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    quota?: number | null;
  }>;
}

export interface LayananAnjungan {
  id: string;
  code: string;
  name: string;
}

export function useLayarUtama() {
  return useQuery({
    queryKey: ['anjungan', 'menu'],
    queryFn: () => api.get<LayarUtama>(`${DASAR}/menu`),
    // Menu jarang berubah, dan anjungan yang memuat ulang menunya setiap kali
    // berkedip di depan warga.
    staleTime: 5 * 60_000,
  });
}

export function usePanduan() {
  return useQuery({
    queryKey: ['anjungan', 'panduan'],
    queryFn: () => api.get<Panduan[]>(`${DASAR}/guides`),
    staleTime: 30 * 60_000,
  });
}

export function usePengumuman() {
  return useQuery({
    queryKey: ['anjungan', 'pengumuman'],
    queryFn: () => api.get<Pengumuman>(`${DASAR}/announcements`),
    staleTime: 60_000,
  });
}

export function useLayanan() {
  return useQuery({
    queryKey: ['anjungan', 'layanan'],
    queryFn: () => api.get<LayananAnjungan[]>(`${DASAR}/services`),
    staleTime: 5 * 60_000,
  });
}

export function useCekStatus() {
  return useMutation({
    mutationFn: (claimCode: string) =>
      api.post<StatusPermohonan>(`${DASAR}/status`, { claimCode }),
  });
}

export function useCetakSurat() {
  return useMutation({
    mutationFn: (claimCode: string) => api.post<SuratCetak>(`${DASAR}/print`, { claimCode }),
  });
}

export function useAmbilAntrean() {
  return useMutation({
    mutationFn: (serviceCatalogId?: string) =>
      api.post<Antrean>(`${DASAR}/queue`, { serviceCatalogId }),
  });
}

export function useAjukanSurat() {
  return useMutation({
    mutationFn: (body: {
      serviceCatalogId: string;
      applicantName: string;
      applicantPhone?: string;
      purpose?: string;
    }) => api.post<{ claimCode: string; display: string; note: string }>(`${DASAR}/requests`, body),
  });
}

export function useLapor() {
  return useMutation({
    mutationFn: (body: {
      title: string;
      description: string;
      locationNote?: string;
      reporterName?: string;
      reporterPhone?: string;
      isAnonymous?: boolean;
    }) =>
      api.post<{ complaintNumber: string; display: string; anonymous: boolean; note: string }>(
        `${DASAR}/complaints`,
        body,
      ),
  });
}

export function useBukuTamu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      guestName: string;
      purpose: string;
      phone?: string;
      institution?: string;
    }) => api.post<{ note: string }>(`${DASAR}/guestbook`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['anjungan', 'bukutamu'] }),
  });
}

export function useAbsenRonda() {
  return useMutation({
    mutationFn: (body: { memberName: string; note?: string }) =>
      api.post<{ recognised: boolean; note: string }>(`${DASAR}/patrol-attendance`, body),
  });
}

// --- Sesi menganggur ---------------------------------------------------------

/** Sama dengan ambang pada layanan: dua menit tanpa sentuhan. */
export const MENGANGGUR_DETIK = 120;

/** Peringatan muncul pada sisa waktu ini. */
export const PERINGATAN_DETIK = 20;

export interface KeadaanMenganggur {
  sisaDetik: number;
  memperingatkan: boolean;
  sentuh: () => void;
}

/**
 * Menghitung mundur sesi anjungan pada peramban.
 *
 * Ketika habis, `onSelesai` dipanggil — dan halaman yang memakainya wajib
 * kembali ke layar utama **sambil mengosongkan seluruh isian**. Menutupi layar
 * tidak cukup: tombol "kembali" mengembalikannya.
 *
 * Peringatan muncul dua puluh detik sebelum habis. Tanpa peringatan, warga yang
 * sedang membaca surat di layar akan kehilangannya di tengah kalimat dan
 * mengira anjungannya rusak.
 */
export function useKioskIdle(onSelesai: () => void, aktif = true): KeadaanMenganggur {
  const [sisaDetik, setSisa] = useState(MENGANGGUR_DETIK);
  const selesaiRef = useRef(onSelesai);
  selesaiRef.current = onSelesai;

  const sentuh = useCallback(() => setSisa(MENGANGGUR_DETIK), []);

  useEffect(() => {
    if (!aktif) {
      setSisa(MENGANGGUR_DETIK);
      return;
    }
    const t = window.setInterval(() => {
      setSisa((n) => {
        if (n <= 1) {
          selesaiRef.current();
          return MENGANGGUR_DETIK;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [aktif]);

  useEffect(() => {
    if (!aktif) return;
    const reset = () => sentuh();
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(ev, reset, { passive: true });
    }
    return () => {
      for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
        window.removeEventListener(ev, reset);
      }
    };
  }, [aktif, sentuh]);

  return { sisaDetik, memperingatkan: sisaDetik <= PERINGATAN_DETIK, sentuh };
}

/** Huruf yang dipakai papan ketik anjungan. Tanpa 0, O, 1, I, L. */
export const HURUF_KODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function formatKode(kode: string): string {
  return kode.length === 8 ? `${kode.slice(0, 4)}-${kode.slice(4)}` : kode;
}
