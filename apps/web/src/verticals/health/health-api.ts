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

// --- Farmasi -----------------------------------------------------------------

export interface PeringatanObat {
  type:
    | 'ALLERGY'
    | 'INTERACTION'
    | 'DOSE_HIGH'
    | 'DOSE_LOW'
    | 'DUPLICATE_THERAPY'
    | 'HIGH_ALERT'
    | 'LASA'
    | 'CONTROLLED';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'BLOCKING';
  message: string;
  blocking: boolean;
  detail?: Record<string, unknown>;
}

export interface HasilPeriksaObat {
  alerts: PeringatanObat[];
  blocked: boolean;
}

export interface AntrianResep {
  id: string;
  prescription_number: string;
  status: string;
  prescribed_at: string;
  patient_name: string;
  medical_record_number: string | null;
  line_count: number;
  has_controlled: boolean | null;
  has_high_alert: boolean | null;
}

export interface BarisResep {
  id: string;
  line_no: number;
  dose_value: number;
  dose_unit: string;
  route: string;
  frequency_code: string;
  frequency_per_day: number | null;
  duration_days: number | null;
  quantity: number;
  dispensed_qty: number;
  instruction: string | null;
  is_prn: boolean;
  override_alerts: { alerts: PeringatanObat[]; overrideReason: string | null } | null;
  drug_id: string;
  generic_name: string;
  brand_name: string | null;
  active_ingredient: string;
  drug_class: string;
  is_controlled: boolean;
  is_high_alert: boolean;
  is_lasa: boolean;
}

export interface ResepLengkap {
  id: string;
  prescription_number: string;
  status: string;
  prescribed_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  note: string | null;
  patient_name: string;
  medical_record_number: string | null;
  birth_date: string | null;
  lines: BarisResep[];
}

// --- Laboratorium ------------------------------------------------------------

export type PenilaianHasil =
  | 'NORMAL'
  | 'LOW'
  | 'HIGH'
  | 'CRITICAL_LOW'
  | 'CRITICAL_HIGH'
  | 'ABNORMAL'
  | 'UNKNOWN';

export interface PemeriksaanKatalog {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  department: string;
  category: string | null;
  result_type: string;
  unit: string | null;
  specimen_type: string | null;
  container_type: string | null;
  turnaround_minutes: number | null;
  requires_fasting: boolean;
  price: number;
  range_count: number;
}

export interface BarisKerjaLab {
  id: string;
  order_number: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  ordered_at: string;
  status: string;
  department: string;
  patient_name: string;
  item_count: number;
  resulted_count: number;
  isCritical: boolean;
  overdue: boolean;
}

export interface HasilMasuk {
  id: string;
  flag: PenilaianHasil;
  critical: boolean;
  message: string;
  delta: { suspicious: boolean; changePercent: number | null; message?: string };
  autoVerified: boolean;
  autoVerifyBlockedBecause: string | null;
}

export interface HasilLab {
  id: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  range_low: number | null;
  range_high: number | null;
  flag: PenilaianHasil;
  is_critical: boolean;
  status: string;
  released_at: string | null;
  impression: string | null;
  image_reference: string | null;
  test_name: string;
  test_code: string;
  department: string;
  order_number: string;
  ordered_at: string;
  amendment_count: number;
}

export interface NilaiKritis {
  id: string;
  result_id: string;
  critical_at: string;
  acknowledged_at: string | null;
  notified_at: string | null;
  escalated_at: string | null;
  patient_name: string;
  test_name: string;
  value_numeric: string | null;
  value_text: string | null;
  unit: string | null;
  flag: PenilaianHasil;
  order_number: string;
  delivery: {
    state: 'ACKNOWLEDGED' | 'PENDING' | 'OVERDUE';
    minutesElapsed: number;
    message: string;
  };
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

  // --- Farmasi --------------------------------------------------------------
  //
  // Semuanya membawa tujuan penggunaan — termasuk `checkDrug`, yang tidak
  // menyimpan apa pun tetapi membaca alergi dan riwayat obat pasien. Pembacaan
  // yang tidak berujung pada penyimpanan tetap pembacaan.
  checkDrug: (
    body: {
      patientId: string;
      drugId: string;
      doseValue: number;
      doseUnit: string;
      frequencyPerDay?: number;
      prescriptionId?: string;
    },
    ctx: KonteksAkses,
  ) => api.post<HasilPeriksaObat>('/health/pharmacy/check', body, { headers: tajuk(ctx) }),

  createPrescription: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{
      id: string;
      prescriptionNumber: string;
      alerts: Array<HasilPeriksaObat & { line: number }>;
    }>('/health/pharmacy/prescriptions', body, { headers: tajuk(ctx) }),

  pharmacyQueue: (facilityId: string, status?: string) =>
    api.get<AntrianResep[]>(
      `/health/pharmacy/prescriptions?facilityId=${facilityId}${status ? `&status=${status}` : ''}`,
    ),

  prescription: (id: string, ctx: KonteksAkses) =>
    api.get<ResepLengkap>(`/health/pharmacy/prescriptions/${id}`, { headers: tajuk(ctx) }),

  reviewPrescription: (id: string, body: { approve: boolean; note?: string }, ctx: KonteksAkses) =>
    api.post<{ id: string; status: string }>(`/health/pharmacy/prescriptions/${id}/review`, body, {
      headers: tajuk(ctx),
    }),

  dispense: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; movementId: string; replayed: boolean; substitution: boolean }>(
      '/health/pharmacy/dispensings',
      body,
      { headers: tajuk(ctx) },
    ),

  administer: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; status: string }>('/health/pharmacy/administrations', body, {
      headers: tajuk(ctx),
    }),

  skipAdministration: (
    body: {
      administrationId: string;
      status: 'OMITTED' | 'REFUSED' | 'HELD';
      reason: string;
      note?: string;
    },
    ctx: KonteksAkses,
  ) =>
    api.post<{ id: string; status: string }>('/health/pharmacy/administrations/skip', body, {
      headers: tajuk(ctx),
    }),

  // --- Laboratorium dan radiologi -------------------------------------------
  labTests: (department?: string) =>
    api.get<PemeriksaanKatalog[]>(`/health/lab/tests${department ? `?department=${department}` : ''}`),

  labWorklist: (facilityId: string, department?: string) =>
    api.get<BarisKerjaLab[]>(
      `/health/lab/worklist?facilityId=${facilityId}${department ? `&department=${department}` : ''}`,
    ),

  createLabOrder: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{
      id: string;
      orderNumber: string;
      specimens: Array<{ id: string; specimenNumber: string; specimenType: string }>;
    }>('/health/lab/orders', body, { headers: tajuk(ctx) }),

  collectSpecimen: (id: string, body: { volumeMl?: number }, ctx: KonteksAkses) =>
    api.post<{ id: string; status: string }>(`/health/lab/specimens/${id}/collect`, body, {
      headers: tajuk(ctx),
    }),

  receiveSpecimen: (id: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; status: string }>(`/health/lab/specimens/${id}/receive`, body, {
      headers: tajuk(ctx),
    }),

  enterResult: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<HasilMasuk>('/health/lab/results', body, { headers: tajuk(ctx) }),

  verifyResult: (id: string, ctx: KonteksAkses) =>
    api.post<{ id: string; status: string }>(`/health/lab/results/${id}/verify`, {}, {
      headers: tajuk(ctx),
    }),

  releaseResult: (id: string, ctx: KonteksAkses) =>
    api.post<{ id: string; status: string; critical: boolean }>(
      `/health/lab/results/${id}/release`,
      {},
      { headers: tajuk(ctx) },
    ),

  amendResult: (
    id: string,
    body: { valueNumeric?: number; valueText?: string; reason: string },
    ctx: KonteksAkses,
  ) =>
    api.post<{ id: string; status: string; flag: string; critical: boolean }>(
      `/health/lab/results/${id}/amend`,
      body,
      { headers: tajuk(ctx) },
    ),

  patientLabResults: (patientId: string, ctx: KonteksAkses) =>
    api.get<HasilLab[]>(`/health/lab/patients/${patientId}/results`, { headers: tajuk(ctx) }),

  // Daftar nilai kritis tidak menuntut tujuan penggunaan: ia daftar kerja, bukan
  // pembacaan rekam medis seorang pasien tertentu. Yang menuntutnya adalah
  // penerimaannya, karena di sanalah isinya benar-benar dibaca.
  criticalPending: (facilityId?: string) =>
    api.get<NilaiKritis[]>(`/health/lab/critical${facilityId ? `?facilityId=${facilityId}` : ''}`),

  notifyCritical: (id: string, body: { channel: string; notifiedTo: string }, ctx: KonteksAkses) =>
    api.post<{ id: string; notified: boolean }>(`/health/lab/critical/${id}/notify`, body, {
      headers: tajuk(ctx),
    }),

  acknowledgeCritical: (id: string, body: { readBackValue: string }, ctx: KonteksAkses) =>
    api.post<{ id: string; acknowledged: boolean }>(`/health/lab/critical/${id}/acknowledge`, body, {
      headers: tajuk(ctx),
    }),
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

/**
 * Rupa peringatan obat menurut tingkatnya.
 *
 * Sengaja hanya tingkat BLOCKING yang berwarna merah pekat. Bila semua
 * peringatan tampak sama mendesak, tidak ada yang tampak mendesak — dan yang
 * benar-benar berbahaya tenggelam di antara pengingat biasa.
 */
export const RUPA_PERINGATAN: Record<string, { kelas: string; label: string }> = {
  BLOCKING: {
    kelas: 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100',
    label: 'Ditahan',
  },
  CRITICAL: {
    kelas: 'border-orange-400 bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-100',
    label: 'Perlu perhatian',
  },
  WARNING: {
    kelas: 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    label: 'Peringatan',
  },
  INFO: {
    kelas: 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
    label: 'Catatan',
  },
};

export const LABEL_STATUS_RESEP: Record<string, string> = {
  DRAFT: 'Draf',
  PRESCRIBED: 'Menunggu telaah',
  UNDER_REVIEW: 'Sedang ditelaah',
  REVIEWED: 'Siap diserahkan',
  PARTIALLY_DISPENSED: 'Sebagian diserahkan',
  DISPENSED: 'Selesai diserahkan',
  CANCELLED: 'Dibatalkan',
  REJECTED: 'Ditolak apoteker',
};

export const LABEL_GOLONGAN_OBAT: Record<string, string> = {
  OTC: 'Bebas',
  OTC_LIMITED: 'Bebas terbatas',
  PRESCRIPTION: 'Keras',
  PSYCHOTROPIC: 'Psikotropika',
  NARCOTIC: 'Narkotika',
};

/**
 * Rupa penilaian hasil laboratorium.
 *
 * Sama seperti peringatan obat: hanya yang kritis berwarna merah pekat. Hasil
 * tinggi dan rendah memang perlu terlihat, tetapi bila semuanya merah, yang
 * benar-benar membahayakan tidak lagi menonjol.
 */
export const RUPA_HASIL: Record<string, { kelas: string; label: string; singkat: string }> = {
  CRITICAL_HIGH: {
    kelas: 'bg-rose-600 text-white dark:bg-rose-700',
    label: 'Kritis tinggi',
    singkat: 'KT',
  },
  CRITICAL_LOW: {
    kelas: 'bg-rose-600 text-white dark:bg-rose-700',
    label: 'Kritis rendah',
    singkat: 'KR',
  },
  HIGH: {
    kelas: 'bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200',
    label: 'Tinggi',
    singkat: 'T',
  },
  LOW: {
    kelas: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
    label: 'Rendah',
    singkat: 'R',
  },
  ABNORMAL: {
    kelas: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
    label: 'Tidak normal',
    singkat: 'A',
  },
  NORMAL: {
    kelas: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    label: 'Normal',
    singkat: 'N',
  },
  /*
   * Sengaja TIDAK berwarna hijau. Hasil tanpa rentang rujukan yang berlaku
   * bukan hasil normal — ia hasil yang belum dapat dinilai, dan mewarnainya
   * hijau akan membuat pembacanya berhenti melihat.
   */
  UNKNOWN: {
    kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    label: 'Belum dapat dinilai',
    singkat: '—',
  },
};

export const LABEL_PRIORITAS_LAB: Record<string, string> = {
  STAT: 'Segera',
  URGENT: 'Mendesak',
  ROUTINE: 'Rutin',
};

export const LABEL_STATUS_SPESIMEN: Record<string, string> = {
  ORDERED: 'Menunggu pengambilan',
  COLLECTED: 'Sudah diambil',
  RECEIVED: 'Diterima laboratorium',
  REJECTED: 'Ditolak',
  IN_PROCESS: 'Sedang dikerjakan',
  COMPLETED: 'Selesai',
};

export const LABEL_TOLAK_SPESIMEN: Record<string, string> = {
  UNLABELLED: 'Tanpa label',
  MISLABELLED: 'Label tidak cocok',
  HEMOLYSED: 'Hemolisis',
  CLOTTED: 'Menggumpal',
  INSUFFICIENT_VOLUME: 'Volume kurang',
  WRONG_CONTAINER: 'Tabung keliru',
  CONTAMINATED: 'Terkontaminasi',
  EXPIRED_TUBE: 'Tabung kedaluwarsa',
  DELAYED_TRANSPORT: 'Terlambat tiba',
  LEAKED: 'Bocor',
};

export const LABEL_KEGAWATAN: Record<string, string> = {
  FATAL: 'Fatal',
  SEVERE: 'Berat',
  MODERATE: 'Sedang',
  MILD: 'Ringan',
  UNKNOWN: 'Tidak diketahui',
};
