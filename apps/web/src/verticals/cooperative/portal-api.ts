/**
 * Sambungan portal anggota ke API.
 *
 * Satu hal patut diperhatikan pada seluruh berkas ini:
 *
 *   **Tidak ada satu pun fungsi yang menerima `memberId`.**
 *
 * Bukan kelalaian melainkan cerminan rancangan di sisi peladen: identitas
 * anggota diturunkan dari sesi, tidak pernah dari permintaan. Bila kelak ada
 * yang hendak menambahkan `?memberId=` di sini, ketiadaan parameter itu di
 * seluruh berkas ini adalah petunjuk pertama bahwa hal itu keliru.
 *
 * Penyaringan cakupan data juga TIDAK dikerjakan di sini. Peramban dapat
 * diubah siapa saja yang menjalankannya; penyaring yang hanya hidup di
 * peramban bukan penyaring melainkan tampilan. Yang menegakkan adalah
 * `cooperative-portal.ts` di sisi peladen.
 */

import { apiRequest } from '../../lib/api';

const AWALAN = '/cooperative/portal';

export interface RingkasanPortal {
  memberNumber: string | null;
  fullName: string;
  status: string;
  totalSimpanan: string;
  jumlahRekening: number;
  sisaPinjaman: string;
  jumlahPinjaman: number;
  totalShu: string;
  pemberitahuanBelumDibaca: number;
  pengaduanTerbuka: number;
}

export interface RekeningSimpanan {
  id: string;
  account_number: string | null;
  balance: string;
  status: string;
  opened_at: string | null;
  product_name: string;
  saving_type: string;
  is_withdrawable: boolean;
}

export interface MutasiSimpanan {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: string;
  balance_after: string;
  description: string | null;
}

export interface PinjamanAnggota {
  id: string;
  loan_number: string;
  principal_amount: string;
  outstanding_principal: string;
  status: string;
  disbursed_at: string | null;
  tenor_months: number;
  method: string;
  product_name: string;
}

export interface BarisAngsuran {
  installment_no: number;
  due_date: string;
  principal_amount: string;
  interest_amount: string;
  total_amount: string;
  paid_amount: string;
  status: string;
}

export interface AlokasiShu {
  id: string;
  fiscal_year: number;
  capital_service_amount: string;
  patronage_service_amount: string;
  gross_amount: string;
  deduction_amount: string;
  net_amount: string;
  status: string;
}

export interface RapatAnggota {
  id: string;
  meeting_number: string;
  meeting_type: string;
  title: string;
  scheduled_at: string;
  location: string | null;
  status: string;
  quorum_reached: boolean | null;
}

export interface PengaduanAnggota {
  id: string;
  complaint_number: string;
  category: string;
  subject: string;
  body: string;
  severity: string;
  status: string;
  resolution: string | null;
  submitted_at: string;
  resolved_at: string | null;
}

export interface TanggapanPengaduan {
  id: string;
  author_type: string;
  body: string;
  created_at: string;
}

export interface PemberitahuanAnggota {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
}

export const portalApi = {
  ringkasan: () => apiRequest<RingkasanPortal>(`${AWALAN}/me`),

  simpanan: () => apiRequest<RekeningSimpanan[]>(`${AWALAN}/savings`),
  mutasi: (rekeningId: string) =>
    apiRequest<MutasiSimpanan[]>(`${AWALAN}/savings/${rekeningId}/transactions`),

  pinjaman: () => apiRequest<PinjamanAnggota[]>(`${AWALAN}/loans`),
  jadwal: (pinjamanId: string) =>
    apiRequest<BarisAngsuran[]>(`${AWALAN}/loans/${pinjamanId}/schedule`),

  shu: () => apiRequest<AlokasiShu[]>(`${AWALAN}/shu`),

  rapat: () => apiRequest<RapatAnggota[]>(`${AWALAN}/meetings`),

  pengaduan: () => apiRequest<PengaduanAnggota[]>(`${AWALAN}/complaints`),
  tanggapan: (pengaduanId: string) =>
    apiRequest<TanggapanPengaduan[]>(`${AWALAN}/complaints/${pengaduanId}/responses`),
  ajukanPengaduan: (input: {
    category: string;
    subject: string;
    body: string;
    isAnonymous: boolean;
  }) =>
    apiRequest<{ id: string; complaint_number: string; status: string }>(
      `${AWALAN}/complaints`,
      { method: 'POST', body: input },
    ),
  tanggapi: (pengaduanId: string, body: string) =>
    apiRequest<{ id: string }>(`${AWALAN}/complaints/${pengaduanId}/responses`, {
      method: 'POST',
      body: { body },
    }),

  pemberitahuan: () => apiRequest<PemberitahuanAnggota[]>(`${AWALAN}/notifications`),
  tandaiDibaca: (id: string) =>
    apiRequest<{ id: string; read: boolean }>(`${AWALAN}/notifications/${id}/read`, {
      method: 'PATCH',
    }),
};
