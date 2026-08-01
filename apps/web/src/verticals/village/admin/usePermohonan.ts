/**
 * Pembacaan dan penulisan satu permohonan surat.
 *
 * ## Setiap penulisan memuat ulang rinciannya
 *
 * Bukan karena malas menghitung keadaan barunya di layar, melainkan karena
 * keadaan itu **ditentukan peladen**: verifikasi dapat berakhir `DIVERIFIKASI`
 * atau `BERKAS_KURANG` tergantung kelengkapan, dan persetujuan dapat berakhir
 * `DISETUJUI` atau tetap `MENUNGGU_PERSETUJUAN` tergantung berapa jenjang yang
 * tersisa.
 *
 * Layar yang menebak sendiri akan menampilkan keadaan yang berbeda dari yang
 * sebenarnya tersimpan — dan petugas berikutnya yang membuka permohonan yang
 * sama akan melihat sesuatu yang lain.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export type StatusPermohonan =
  | 'DRAF'
  | 'DIAJUKAN'
  | 'BERKAS_KURANG'
  | 'DIVERIFIKASI'
  | 'MENUNGGU_PERSETUJUAN'
  | 'DISETUJUI'
  | 'DITOLAK'
  | 'DITERBITKAN'
  | 'DISERAHKAN'
  | 'DIBATALKAN';

export interface Persyaratan {
  code: string;
  name: string;
  description?: string | null;
  is_mandatory: boolean;
  accepts_upload: boolean;
  sort_order: number;
  /** Terisi bila berkasnya sudah dicatat diterima. */
  document_id?: string | null;
  received_physically?: boolean | null;
  note?: string | null;
  verified_at?: string | null;
}

export interface RiwayatPermohonan {
  from_status: string | null;
  to_status: string;
  reason: string | null;
  visible_to_citizen: boolean;
  occurred_at: string;
}

export interface LangkahAlur {
  sequence: number;
  code: string;
  name: string;
  roleCode: string;
  status: 'MENUNGGU' | 'SELESAI' | 'DILEWATI' | 'DITOLAK';
  actedAt?: string | null;
  reason?: string | null;
}

export interface RincianPermohonan {
  request: Record<string, unknown> & { id: string; status: StatusPermohonan };
  requirements: Persyaratan[];
  history: RiwayatPermohonan[];
  workflow: {
    instanceId: string;
    status: string;
    currentStep: LangkahAlur | null;
    steps: LangkahAlur[];
  } | null;
  /** Langkah yang sah menurut peladen — bukan tebakan layar. */
  nextStates: Array<{ to: StatusPermohonan; allowed: boolean; reasonRequired: boolean }>;
  /**
   * Salah bila pemanggil adalah pemohonnya sendiri.
   *
   * Di desa kecil, operator layanan juga warga yang suatu saat mengajukan surat
   * untuk dirinya sendiri. Ia boleh mengajukannya; yang tidak boleh adalah ia
   * sendiri yang memverifikasi dan menyetujuinya.
   */
  processableByMe: boolean;
  finalState: boolean;
}

export function useRincianPermohonan(id: string | undefined) {
  return useQuery({
    queryKey: ['village-request', id],
    queryFn: () => api.get<RincianPermohonan>(`/village/requests/${id}`),
    enabled: Boolean(id),
    // Nol: layar loket dipakai sambil warga berdiri menunggu, dan keadaan yang
    // berumur setengah menit sudah cukup untuk membuat petugas menekan tombol
    // yang sudah tidak berlaku lagi.
    staleTime: 0,
  });
}

/** Seluruh penulisan memuat ulang rincian dan daftar permohonan sesudahnya. */
function useTindakan<T>(id: string, jalan: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jalan,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['village-request', id] });
      void qc.invalidateQueries({ queryKey: ['village-list', 'permohonan'] });
    },
  });
}

export function useCatatBerkas(id: string) {
  return useTindakan(id, (v: { requirementCode: string; note?: string }) =>
    api.post(`/village/requests/${id}/documents`, v),
  );
}

export function useHapusBerkas(id: string) {
  return useTindakan(id, (code: string) =>
    api.delete(`/village/requests/${id}/documents/${encodeURIComponent(code)}`),
  );
}

export function useVerifikasi(id: string) {
  return useTindakan(id, () => api.post(`/village/requests/${id}/verify`));
}

export function useTeruskan(id: string) {
  return useTindakan(id, () => api.post(`/village/requests/${id}/submit-approval`));
}

export function usePutuskan(id: string) {
  return useTindakan(id, (v: { action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'; reason?: string }) =>
    api.post(`/village/requests/${id}/decide`, v),
  );
}

export function useTerbitkan(id: string) {
  return useTindakan(id, (v: { signedByOfficerId?: string; body?: string }) =>
    api.post(`/village/requests/${id}/issue`, v),
  );
}

export function useSerahkan(id: string) {
  return useTindakan(id, (v: { receivedBy: string; relation?: string; note?: string }) =>
    api.post(`/village/requests/${id}/handover`, v),
  );
}

// --- Kelengkapan, dihitung di layar HANYA untuk menampilkan --------------------

/**
 * Berapa syarat wajib yang masih kurang.
 *
 * Perhitungan yang sama ada di peladen dan **itulah yang menentukan**. Yang di
 * sini hanya untuk memberi tahu petugas sebelum ia menekan tombol verifikasi;
 * bila keduanya berbeda, yang berlaku adalah jawaban peladen.
 */
export function kurangnyaApa(syarat: Persyaratan[]): Persyaratan[] {
  return syarat.filter((s) => s.is_mandatory && !s.document_id);
}

/** Label yang dapat dibaca petugas, bukan kode dalam huruf besar. */
export const LABEL_STATUS: Record<StatusPermohonan, string> = {
  DRAF: 'Draf',
  DIAJUKAN: 'Diajukan',
  BERKAS_KURANG: 'Berkas kurang',
  DIVERIFIKASI: 'Berkas lengkap',
  MENUNGGU_PERSETUJUAN: 'Menunggu persetujuan',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
  DITERBITKAN: 'Surat terbit',
  DISERAHKAN: 'Sudah diserahkan',
  DIBATALKAN: 'Dibatalkan',
};
