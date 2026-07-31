/**
 * Klien API kesehatan.
 *
 * Satu hal membedakannya dari `api` biasa: **setiap pembacaan data pasien
 * membawa tujuan penggunaan.** Peladen menolak permintaan tanpa tajuk
 * `X-Purpose-Of-Use`, dan itu memang disengaja — jejak "siapa membaca apa"
 * tanpa "untuk apa" tidak dapat dinilai wajar atau tidak.
 *
 * Membungkusnya di sini, bukan menyerahkannya ke setiap halaman, karena tajuk
 * yang harus diingat di dua puluh tempat adalah tajuk yang akan terlupa di
 * salah satunya — dan yang terlupa justru menjadi lubang pada jejak audit.
 */

import { api } from '../../lib/api';

export type PurposeOfUse =
  | 'TREATMENT'
  | 'PAYMENT'
  | 'OPERATIONS'
  | 'QUALITY'
  | 'RESEARCH'
  | 'PATIENT_REQUEST'
  | 'LEGAL'
  | 'EMERGENCY';

export const TUJUAN_LABEL: Record<PurposeOfUse, string> = {
  TREATMENT: 'Perawatan pasien',
  PAYMENT: 'Penagihan',
  OPERATIONS: 'Operasional fasilitas',
  QUALITY: 'Penjaminan mutu',
  RESEARCH: 'Penelitian',
  PATIENT_REQUEST: 'Permintaan pasien',
  LEGAL: 'Keperluan hukum',
  EMERGENCY: 'Kegawatdaruratan',
};

export interface KonteksAkses {
  purpose: PurposeOfUse;
  facilityId?: string | null;
  breakGlass?: boolean;
  breakGlassReason?: string;
}

function tajuk(ctx: KonteksAkses): Record<string, string> {
  const h: Record<string, string> = { 'X-Purpose-Of-Use': ctx.purpose };
  if (ctx.facilityId) h['X-Facility-Id'] = ctx.facilityId;
  if (ctx.breakGlass) {
    h['X-Break-Glass'] = 'true';
    h['X-Break-Glass-Reason'] = ctx.breakGlassReason ?? '';
  }
  return h;
}

// --- Bentuk data -------------------------------------------------------------

export interface Fasilitas {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  hospital_class: string | null;
  subdomain: string | null;
  timezone: string;
  is_active: boolean;
  facility_type_code: string;
  facility_type_name: string;
  category: string;
}

export interface RingkasPasien {
  id: string;
  enterprise_patient_id: string;
  full_name: string;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  identity_confidence: string;
  safety_alert: string | null;
  deceased_at: string | null;
  mrn: string | null;
}

export interface HasilCari {
  scope: 'FACILITY_LOCAL';
  scopeNote: string;
  total: number;
  results: RingkasPasien[];
}

export interface Alergi {
  id: string;
  type: string;
  name: string;
  severity: string;
  certainty: string;
  reaction: string | null;
}

export interface PasienLengkap extends RingkasPasien {
  identifiers: Array<{ type: string; value: string; verified: boolean }> | null;
  allergies: Alergi[] | null;
  address_text: string | null;
  merged_into_id: string | null;
}

export interface BarisAntrean {
  id: string;
  queue_label: string;
  priority: number;
  priority_reason: string | null;
  status: string;
  patient_name: string;
  registration_number: string;
  called_at: string | null;
}

export interface Antrean {
  businessDate: string;
  waiting: number;
  queue: BarisAntrean[];
  next: BarisAntrean | null;
}

export interface CatatanKlinis {
  id: string;
  note_type: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  signed_at: string | null;
  amended_from_id: string | null;
  amendment_reason: string | null;
  created_at: string;
}

export interface RingkasanKunjungan {
  encounter: Record<string, unknown>;
  notes: CatatanKlinis[];
  diagnoses: Array<{
    id: string;
    code: string | null;
    description: string;
    diagnosis_role: string;
    certainty: string;
  }>;
  vitals: Array<Record<string, unknown>>;
  orders: Array<{
    id: string;
    order_number: string;
    order_type: string;
    order_name: string;
    priority: string;
    status: string;
  }>;
}

export interface DugaanGanda {
  id: string;
  match_score: string;
  match_reason: Array<{ field: string; weight: number; detail: string }>;
  patient_id: string;
  patient_name: string;
  patient_birth: string | null;
  candidate_id: string;
  candidate_name: string;
  candidate_birth: string | null;
}

export interface JejakAkses {
  id: string;
  actor_user_id: string | null;
  purpose_of_use: PurposeOfUse;
  entity_type: string;
  action: string;
  break_glass: boolean;
  break_glass_reason: string | null;
  occurred_at: string;
}

// --- Panggilan ---------------------------------------------------------------

export const healthApi = {
  // Fasilitas dan katalog tidak menyentuh rekam medis, sehingga tidak menuntut
  // tujuan penggunaan.
  facilities: () => api.get<Fasilitas[]>('/health/facilities'),
  facility: (id: string) => api.get<Record<string, unknown>>(`/health/facilities/${id}`),
  units: (facilityId: string) =>
    api.get<Array<Record<string, unknown>>>(`/health/facilities/${facilityId}/units`),
  providers: (facilityId?: string) =>
    api.get<Array<Record<string, unknown>>>(
      `/health/providers${facilityId ? `?facilityId=${facilityId}` : ''}`,
    ),
  billingTiers: () =>
    api.get<{ tiers: Array<Record<string, unknown>>; health: { ok: boolean; problems: string[] } }>(
      '/health/billing/tiers',
    ),
  simulate: (registrations: number) =>
    api.get<Record<string, unknown>>(`/health/billing/simulate?registrations=${registrations}`),
  dailyBilling: (facilityId: string, businessDate: string) =>
    api.get<{
      businessDate: string;
      billable: number;
      total: number;
      excludedByReason: Record<string, number>;
    }>(`/health/billing/daily?facilityId=${facilityId}&businessDate=${businessDate}`),

  // --- Menyentuh rekam medis: tujuan penggunaan wajib -----------------------
  searchPatients: (
    kueri: { q?: string; nik?: string; phone?: string },
    ctx: KonteksAkses,
  ) => {
    const p = new URLSearchParams();
    if (kueri.q) p.set('q', kueri.q);
    if (kueri.nik) p.set('nik', kueri.nik);
    if (kueri.phone) p.set('phone', kueri.phone);
    return api.get<HasilCari>(`/health/patients?${p.toString()}`, { headers: tajuk(ctx) });
  },

  patient: (id: string, ctx: KonteksAkses) =>
    api.get<PasienLengkap>(`/health/patients/${id}`, { headers: tajuk(ctx) }),

  createPatient: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ patientId: string; medicalRecordNumber: string; enterprisePatientId: string }>(
      '/health/patients',
      body,
      { headers: tajuk(ctx) },
    ),

  duplicates: () => api.get<DugaanGanda[]>('/health/patients/duplicates/open'),

  notDuplicate: (id: string, note: string, ctx: KonteksAkses) =>
    api.post(`/health/patients/duplicates/${id}/not-duplicate`, { note }, { headers: tajuk(ctx) }),

  merge: (body: { sourceId: string; targetId: string; reason: string }, ctx: KonteksAkses) =>
    api.post<{ mergeId: string; moved: Record<string, number> }>('/health/patients/merge', body, {
      headers: tajuk(ctx),
    }),

  addAllergy: (patientId: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post(`/health/patients/${patientId}/allergies`, body, { headers: tajuk(ctx) }),

  accessLog: (patientId: string) =>
    api.get<JejakAkses[]>(`/health/patients/${patientId}/access-log`),

  register: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{
      registrationId: string;
      registrationNumber: string;
      businessDate: string;
      queueLabel: string;
      priority: number;
      priorityReason: string;
      isBillable: boolean;
      nonBillableReason: string | null;
    }>('/health/registrations', body, { headers: tajuk(ctx) }),

  queue: (facilityId: string, serviceUnitId?: string) =>
    api.get<Antrean>(
      `/health/queue?facilityId=${facilityId}${serviceUnitId ? `&serviceUnitId=${serviceUnitId}` : ''}`,
    ),

  callNext: (body: { facilityId: string; serviceUnitId?: string; counterCode?: string }, ctx: KonteksAkses) =>
    api.post<{ called: BarisAntrean | null; message: string | null }>(
      '/health/queue/call-next',
      body,
      { headers: tajuk(ctx) },
    ),

  startEncounter: (body: { registrationId: string; sensitivity?: string }, ctx: KonteksAkses) =>
    api.post<{ encounterId: string; encounterNumber: string }>('/health/encounters', body, {
      headers: tajuk(ctx),
    }),

  encounter: (id: string, ctx: KonteksAkses) =>
    api.get<RingkasanKunjungan>(`/health/encounters/${id}`, { headers: tajuk(ctx) }),

  saveNote: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ noteId: string; signed: boolean }>('/health/clinical-notes', body, {
      headers: tajuk(ctx),
    }),

  amendNote: (id: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ noteId: string; amendedFrom: string }>(
      `/health/clinical-notes/${id}/amend`,
      body,
      { headers: tajuk(ctx) },
    ),

  saveVitals: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post('/health/vital-signs', body, { headers: tajuk(ctx) }),

  saveDiagnosis: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post('/health/diagnoses', body, { headers: tajuk(ctx) }),

  saveOrder: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ orderId: string; orderNumber: string }>('/health/clinical-orders', body, {
      headers: tajuk(ctx),
    }),

  completeEncounter: (id: string, disposition?: string) =>
    api.post(`/health/encounters/${id}/complete`, { disposition }),
};

// --- Bantuan tampilan --------------------------------------------------------

export function umurDari(birthDate: string | null): string {
  if (!birthDate) return '—';
  const lahir = new Date(birthDate);
  if (Number.isNaN(lahir.getTime())) return '—';
  const tahun = (Date.now() - lahir.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (tahun < 1) return `${Math.max(0, Math.floor(tahun * 12))} bln`;
  return `${Math.floor(tahun)} th`;
}

export const LABEL_KEYAKINAN: Record<string, { teks: string; kelas: string }> = {
  VERIFIED: {
    teks: 'Terverifikasi',
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  HIGH: { teks: 'Tinggi', kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  MEDIUM: {
    teks: 'Sedang',
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  LOW: {
    teks: 'Rendah',
    kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  },
};

export const LABEL_KEGAWATAN: Record<string, string> = {
  FATAL: 'Fatal',
  SEVERE: 'Berat',
  MODERATE: 'Sedang',
  MILD: 'Ringan',
  UNKNOWN: 'Tidak diketahui',
};
