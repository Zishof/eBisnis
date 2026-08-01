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

// --- Rawat inap --------------------------------------------------------------

export interface BarisPapanBangsal {
  admission_id: string;
  admission_number: string;
  patient_name: string;
  bed_code: string | null;
  room_name: string | null;
  admitted_at: string;
  isolation_type: string;
  status: string;
  early_warning_score: number | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  last_observed_at: string | null;
  next_due_at: string | null;
  observation: { overdue: boolean; minutesLate: number };
}

export interface TempatTidurBaris {
  id: string;
  code: string;
  status: string;
  care_class: string | null;
  last_cleaned_at: string | null;
  room_id: string;
  room_name: string;
  capacity: number;
  isolation_capability: string[];
  current_sex: string | null;
  patient_name: string | null;
  admission_number: string | null;
}

export interface HasilPengamatan {
  id: string;
  score: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  observationMinutes: number;
  nextDueAt: string;
  missing: string[];
}

// --- Gawat darurat, bedah, intensif ------------------------------------------

export type TingkatTriase = 1 | 2 | 3 | 4 | 5;

export interface HasilTriase {
  id: string;
  visitNumber: string;
  level: TingkatTriase;
  requestedLevel: TingkatTriase;
  escalated: boolean;
  redFlags: string[];
  maxWaitMinutes: number;
  message: string;
}

export interface BarisPapanIgd {
  id: string;
  visit_number: string;
  patient_name: string | null;
  chief_complaint: string | null;
  triage_level: TingkatTriase;
  requested_level: TingkatTriase | null;
  triage_red_flags: string[] | null;
  arrived_at: string;
  seen_by_doctor_at: string | null;
  max_wait_minutes: number;
  status: string;
  wait: { overdue: boolean; waitedMinutes: number; lateMinutes: number };
}

export interface BarisJadwalOperasi {
  id: string;
  case_number: string;
  procedure_name: string;
  urgency: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  requires_site_marking: boolean;
  consent_site: string | null;
  marked_site: string | null;
  sign_in_at: string | null;
  time_out_at: string | null;
  incision_at: string | null;
  left_theatre_at: string | null;
  patient_name: string;
  theatre_name: string | null;
}

export interface BarisPapanIcu {
  id: string;
  started_at: string;
  admission_reason: string | null;
  patient_name: string;
  admission_number: string;
  severity_score: number | null;
  organ_support: number | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  last_assessed_at: string | null;
  on_ventilator: boolean | null;
  on_vasopressor: boolean | null;
  on_dialysis: boolean | null;
}

// --- Panggilan ---------------------------------------------------------------

export interface AnggotaKeluarga {
  id: string;
  relationship: string;
  joined_at: string | null;
  patient_id: string;
  full_name: string;
  birth_date: string | null;
  gender: string | null;
  haz_status: string | null;
  whz_status: string | null;
  waz_status: string | null;
  last_measured_at: string | null;
  weight_flat_count: number | null;
}

export interface BarisPertumbuhan {
  id: string;
  measured_at: string;
  age_months: number;
  weight_kg: number;
  height_cm: number;
  height_measured_as: string | null;
  height_adjusted: boolean | null;
  waz: number | null;
  haz: number | null;
  whz: number | null;
  waz_status: string | null;
  haz_status: string | null;
  whz_status: string | null;
  weight_flat_count: number | null;
  posyandu_name: string | null;
}

export interface HasilPengukuran {
  id: string;
  waz: number | null;
  haz: number | null;
  whz: number | null;
  wazStatus: string | null;
  hazStatus: string | null;
  whzStatus: string | null;
  weightFlatCount: number | null;
  alerts?: string[];
}

/**
 * DISALIN dari `PutusanImunisasi` pada `health-community.ts`.
 *
 * Perhatikan bahwa `reason` adalah **KODE**, bukan kalimat — dan `message`
 * yang berisi kalimatnya. Rancangan pertama layar ini merender `reason`,
 * sehingga kader membaca `TOO_YOUNG` alih-alih "Umur minimum 9 bulan".
 *
 * `earliestDate` adalah jawaban atas pertanyaan yang paling sering diajukan
 * ibu: kapan giliran anak saya. Peladen menyediakannya sejak awal.
 */
export interface PutusanImunisasi {
  allowed: boolean;
  reason?: 'TOO_YOUNG' | 'INTERVAL_TOO_SHORT' | 'ALREADY_GIVEN' | 'OUT_OF_ORDER';
  message?: string;
  earliestDate?: string;
}

export interface JadwalImunisasi {
  vaccineCode: string;
  doseNumber: number;
  minAgeDays: number;
  minIntervalDays?: number | null;
  recommendedAgeDays?: number | null;
  verdict: PutusanImunisasi;
}

export interface ImunisasiTertunggak {
  vaccineCode: string;
  doseNumber: number;
  overdueDays: number;
}

export interface StatusImunisasi {
  given: Array<{
    id: string;
    vaccine_code: string;
    dose_number: number;
    given_at: string;
    batch_number?: string | null;
  }>;
  overdue: ImunisasiTertunggak[];
  upcoming: JadwalImunisasi[];
  dueToday: JadwalImunisasi[];
}

export interface BarisCakupan {
  id: string;
  program_code: string;
  program_name: string;
  village: string | null;
  target_count: number;
  achieved_count: number;
  period_year: number;
  period_month: number | null;
  /*
   * `coverage`, `gap`, `message` — DISALIN dari nilai kembali `hitungCakupan`
   * pada `health-community.ts`, tidak disusun sendiri.
   *
   * Rancangan pertamanya menamainya `percentage` dan `shortfall`. Keduanya
   * nama yang masuk akal dan keduanya tidak ada, sehingga
   * `r.percentage.toFixed(1)` MELEMPAR dan seluruh halamannya kosong — bukan
   * menampilkan angka yang salah, melainkan tidak menampilkan apa pun.
   */
  coverage: number;
  gap: number;
  message: string;
}

export interface BarisKunjunganRumah {
  patient_id: string;
  full_name: string;
  birth_date: string | null;
  family_folder_id: string | null;
  folder_number: string | null;
  village: string | null;
  rt: string | null;
  rw: string | null;
  haz_status: string | null;
  whz_status: string | null;
  weight_flat_count: number | null;
  last_measured_at: string | null;
  severelyWasted: boolean;
  wasted: boolean;
  stunted: boolean;
  weightFlat: boolean;
  overdueDays: number;
}

/*
 * --- W-2: rekam medis, penahanan, pelepasan, jejak akses, telaah darurat ----
 *
 * SELURUH bentuk di bawah diperiksa langsung ke peladen sungguhan sebelum satu
 * baris layar ditulis, bukan disimpulkan dari nama yang masuk akal. Pelajaran
 * W-1: `percentage` dan `shortfall` keduanya nama yang masuk akal, keduanya
 * tidak ada, dan halamannya kosong sama sekali.
 */

export interface BarisKoding {
  id: string;
  status: string;
  service_date: string | null;
  encounter_type: string | null;
  deficiency_count: number;
  blocking_count: number;
  checked_at: string | null;
  patient_name: string;
  open_deficiencies: number;
}

export interface BarisKekurangan {
  id: string;
  deficiency_type: string;
  message: string;
  blocks_coding: boolean;
  detected_at: string | null;
  coding_id: string;
  service_date: string | null;
  patient_name: string;
}

export interface BarisPenahanan {
  id: string;
  reason: string;
  case_reference: string | null;
  placed_at: string | null;
  released_at: string | null;
}

/** `canAmend` = bolehkah berkasnya diubah. Penahanan aktif membekukannya. */
export interface StatusPenahanan {
  holds: BarisPenahanan[];
  canAmend: boolean;
  message: string | null;
}

export interface AntreanTelaah {
  queue: Array<{
    accessLogId: string;
    alasan: string;
    prioritas: 'HIGH' | 'MEDIUM' | 'LOW';
    patientId: string | null;
    actorUserId: string | null;
    purposeOfUse: string | null;
    occurredAt: string | null;
    breakGlassReason: string | null;
  }>;
  total: number;
  note: string;
}

export interface RiwayatTelaah {
  reviews: Array<{
    id: string;
    access_log_id: string;
    reviewed_by: string;
    reviewed_at: string;
    verdict: string;
    notes: string;
    follow_up: string | null;
    patient_id: string | null;
    actor_user_id: string | null;
    occurred_at: string;
    break_glass_reason: string | null;
  }>;
  note: string;
}

export interface RingkasTelaah {
  total: number;
  reviewed: number;
  pending: number;
  adverse: number;
  note: string;
}

export interface BarisInsiden {
  id: string;
  incident_number: string;
  incident_type: string;
  grade: string;
  harm_level: string;
  occurred_at: string;
  review_due_at: string | null;
  closed_at: string | null;
  is_anonymous: boolean;
  action_count: number;
}

export interface PapanMutu {
  indicators: Array<{
    id: string;
    code: string;
    name: string;
    category: string | null;
    direction: string;
    target_value: number | null;
    value: number | null;
    meets_target: boolean | null;
  }>;
  recordCompleteness: { score: number; message: string };
}

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

  // --- Rawat inap -----------------------------------------------------------
  admit: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; admissionNumber: string; bedId: string; bedCode: string }>(
      '/health/inpatient/admissions',
      body,
      { headers: tajuk(ctx) },
    ),

  transferBed: (id: string, body: { bedId: string; note?: string }, ctx: KonteksAkses) =>
    api.post<{ id: string; bedId: string; bedCode: string }>(
      `/health/inpatient/admissions/${id}/transfer`,
      body,
      { headers: tajuk(ctx) },
    ),

  discharge: (
    id: string,
    body: { disposition: string; reason?: string; deathAt?: string },
    ctx: KonteksAkses,
  ) =>
    api.post<{ id: string; disposition: string; lengthOfStay: number }>(
      `/health/inpatient/admissions/${id}/discharge`,
      body,
      { headers: tajuk(ctx) },
    ),

  dischargeSummary: (id: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; admissionId: string }>(
      `/health/inpatient/admissions/${id}/summary`,
      body,
      { headers: tajuk(ctx) },
    ),

  recordObservation: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<HasilPengamatan>('/health/inpatient/observations', body, { headers: tajuk(ctx) }),

  wardBoard: (facilityId: string) =>
    api.get<BarisPapanBangsal[]>(`/health/inpatient/board?facilityId=${facilityId}`),

  beds: (facilityId: string) =>
    api.get<TempatTidurBaris[]>(`/health/inpatient/beds?facilityId=${facilityId}`),

  setBedStatus: (id: string, body: { status: string }, ctx: KonteksAkses) =>
    api.post<{ id: string; code: string; status: string }>(
      `/health/inpatient/beds/${id}/status`,
      body,
      { headers: tajuk(ctx) },
    ),

  // --- Gawat darurat, bedah, intensif ---------------------------------------
  triage: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<HasilTriase>('/health/acute/ed/visits', body, { headers: tajuk(ctx) }),

  retriage: (id: string, body: { level: number; reason?: string }, ctx: KonteksAkses) =>
    api.post<{ id: string; level: number; from: number }>(
      `/health/acute/ed/visits/${id}/triage`,
      body,
      { headers: tajuk(ctx) },
    ),

  markSeen: (id: string, ctx: KonteksAkses) =>
    api.post<{ id: string; seen: boolean }>(`/health/acute/ed/visits/${id}/seen`, {}, {
      headers: tajuk(ctx),
    }),

  edDisposition: (
    id: string,
    body: { disposition: string; reason?: string; admissionId?: string },
    ctx: KonteksAkses,
  ) =>
    api.post<{ id: string; disposition: string }>(
      `/health/acute/ed/visits/${id}/disposition`,
      body,
      { headers: tajuk(ctx) },
    ),

  edBoard: (facilityId: string) =>
    api.get<BarisPapanIgd[]>(`/health/acute/ed/board?facilityId=${facilityId}`),

  scheduleSurgery: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; caseNumber: string }>('/health/acute/ot/cases', body, {
      headers: tajuk(ctx),
    }),

  markSite: (id: string, body: { site: string }, ctx: KonteksAkses) =>
    api.post<{ id: string; markedSite: string; matchesConsent: boolean }>(
      `/health/acute/ot/cases/${id}/mark-site`,
      body,
      { headers: tajuk(ctx) },
    ),

  surgicalChecklist: (
    id: string,
    body: { phase: 'SIGN_IN' | 'TIME_OUT' | 'SIGN_OUT'; items: string[]; note?: string },
    ctx: KonteksAkses,
  ) =>
    api.post<{ id: string; phase: string; complete: boolean }>(
      `/health/acute/ot/cases/${id}/checklist`,
      body,
      { headers: tajuk(ctx) },
    ),

  checklistItems: () =>
    api.get<Record<'SIGN_IN' | 'TIME_OUT' | 'SIGN_OUT', string[]>>('/health/acute/ot/checklist-items'),

  surgicalCount: (id: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; itemType: string }>(`/health/acute/ot/cases/${id}/counts`, body, {
      headers: tajuk(ctx),
    }),

  incision: (id: string, ctx: KonteksAkses) =>
    api.post<{ id: string; incisionAt: string }>(`/health/acute/ot/cases/${id}/incision`, {}, {
      headers: tajuk(ctx),
    }),

  leaveTheatre: (id: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; status: string }>(`/health/acute/ot/cases/${id}/leave`, body, {
      headers: tajuk(ctx),
    }),

  surgerySchedule: (facilityId: string, date?: string) =>
    api.get<BarisJadwalOperasi[]>(
      `/health/acute/ot/schedule?facilityId=${facilityId}${date ? `&date=${date}` : ''}`,
    ),

  icuAssessment: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; score: number; organSupport: number; risk: string }>(
      '/health/acute/icu/assessments',
      body,
      { headers: tajuk(ctx) },
    ),

  icuBoard: (facilityId: string) =>
    api.get<BarisPapanIcu[]>(`/health/acute/icu/board?facilityId=${facilityId}`),

  // --- Puskesmas: keluarga, pertumbuhan, imunisasi, kunjungan rumah ---------
  //
  // Cakupan dan daftar kunjungan TIDAK membawa tujuan penggunaan, dan itu
  // bukan kelalaian: keduanya endpoint agregat/kerja yang peladennya sengaja
  // tidak menuntut tajuk. Yang menyentuh satu pasien — isi folder, riwayat
  // pertumbuhan, status imunisasi — membawanya.

  createFamilyFolder: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; folderNumber: string; alreadyElsewhere: string[] }>(
      '/health/community/folders',
      body,
      { headers: tajuk(ctx) },
    ),

  familyFolder: (id: string, ctx: KonteksAkses) =>
    api.get<{ id: string; members: AnggotaKeluarga[] }>(`/health/community/folders/${id}`, {
      headers: tajuk(ctx),
    }),

  recordGrowth: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<HasilPengukuran>('/health/community/growth', body, { headers: tajuk(ctx) }),

  growthHistory: (patientId: string, ctx: KonteksAkses) =>
    api.get<BarisPertumbuhan[]>(`/health/community/growth/${patientId}`, { headers: tajuk(ctx) }),

  immunizationStatus: (patientId: string, ctx: KonteksAkses) =>
    api.get<StatusImunisasi>(`/health/community/immunization/${patientId}`, {
      headers: tajuk(ctx),
    }),

  recordImmunization: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; vaccineCode: string; doseNumber: number }>(
      '/health/community/immunization',
      body,
      { headers: tajuk(ctx) },
    ),

  coverage: (facilityId: string, year: number, month?: number) =>
    api.get<BarisCakupan[]>(
      `/health/community/coverage?facilityId=${facilityId}&year=${year}${
        month ? `&month=${month}` : ''
      }`,
    ),

  homeVisitWorklist: (facilityId: string, limit = 50) =>
    api.get<BarisKunjunganRumah[]>(
      `/health/community/home-visits/worklist?facilityId=${facilityId}&limit=${limit}`,
    ),

  recordHomeVisit: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; visitedAt: string }>('/health/community/home-visits', body, {
      headers: tajuk(ctx),
    }),

  // --- W-2: rekam medis ------------------------------------------------------
  //
  // Daftar kerja pengkodean, kekurangan berkas, papan insiden, dan papan mutu
  // TIDAK membawa tujuan penggunaan: peladennya tidak menuntutnya, sebab
  // seluruhnya daftar kerja dan agregat. Yang menyentuh satu pasien — penahanan
  // hukum, pelepasan informasi, jejak akses — membawanya.

  codingWorklist: (facilityId: string, status?: string) =>
    api.get<BarisKoding[]>(
      `/health/him/coding/worklist?facilityId=${facilityId}${status ? `&status=${status}` : ''}`,
    ),

  deficiencies: (facilityId: string, role: string) =>
    api.get<BarisKekurangan[]>(
      `/health/him/deficiencies?facilityId=${facilityId}&role=${encodeURIComponent(role)}`,
    ),

  checkRecord: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<Record<string, unknown>>('/health/him/records/check', body, { headers: tajuk(ctx) }),

  addCode: (codingId: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<Record<string, unknown>>(`/health/him/coding/${codingId}/code`, body, {
      headers: tajuk(ctx),
    }),

  verifyCoding: (codingId: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<Record<string, unknown>>(`/health/him/coding/${codingId}/verify`, body, {
      headers: tajuk(ctx),
    }),

  legalHolds: (patientId: string, ctx: KonteksAkses) =>
    api.get<StatusPenahanan>(`/health/him/legal-holds/${patientId}`, { headers: tajuk(ctx) }),

  placeLegalHold: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string }>('/health/him/legal-holds', body, { headers: tajuk(ctx) }),

  releaseLegalHold: (id: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string }>(`/health/him/legal-holds/${id}/release`, body, {
      headers: tajuk(ctx),
    }),

  requestRelease: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<Record<string, unknown>>('/health/him/releases', body, { headers: tajuk(ctx) }),

  fulfilRelease: (id: string, body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<Record<string, unknown>>(`/health/him/releases/${id}/release`, body, {
      headers: tajuk(ctx),
    }),

  incidents: (facilityId: string) =>
    api.get<BarisInsiden[]>(`/health/him/incidents?facilityId=${facilityId}`),

  qualityDashboard: (facilityId: string, year: number) =>
    api.get<PapanMutu>(`/health/him/quality/dashboard?facilityId=${facilityId}&year=${year}`),

  // --- W-2: telaah darurat ---------------------------------------------------

  breakGlassQueue: (limit = 50, ctx: KonteksAkses) =>
    api.get<AntreanTelaah>(`/health/security/break-glass/queue?limit=${limit}`, {
      headers: tajuk(ctx),
    }),

  breakGlassReviews: (limit = 50, ctx: KonteksAkses) =>
    api.get<RiwayatTelaah>(`/health/security/break-glass/reviews?limit=${limit}`, {
      headers: tajuk(ctx),
    }),

  breakGlassSummary: () => api.get<RingkasTelaah>('/health/security/break-glass/summary'),

  reviewBreakGlass: (body: Record<string, unknown>, ctx: KonteksAkses) =>
    api.post<{ id: string; reviewed: boolean }>('/health/security/break-glass/review', body, {
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

/**
 * Rupa tingkat risiko keperawatan.
 *
 * Angkanya bukan diagnosis; ia penentu seberapa sering pasien dilihat lagi.
 * Karena itu labelnya menyebut tindakan yang dituntut, bukan sekadar tingkatnya.
 */
export const RUPA_RISIKO: Record<string, { kelas: string; label: string }> = {
  HIGH: {
    kelas: 'bg-rose-600 text-white dark:bg-rose-700',
    label: 'Amati tiap 30 menit',
  },
  MEDIUM: {
    kelas: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
    label: 'Amati tiap jam',
  },
  LOW: {
    kelas: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    label: 'Amati tiap 4 jam',
  },
};

export const LABEL_ISOLASI: Record<string, string> = {
  NONE: 'Tanpa isolasi',
  CONTACT: 'Isolasi kontak',
  DROPLET: 'Isolasi droplet',
  AIRBORNE: 'Isolasi udara',
  PROTECTIVE: 'Isolasi protektif',
};

export const LABEL_STATUS_TEMPAT_TIDUR: Record<string, string> = {
  AVAILABLE: 'Siap dipakai',
  OCCUPIED: 'Ditempati',
  RESERVED: 'Dipesan',
  // Bukan "kosong". Tempat tidur yang baru ditinggalkan belum siap dipakai, dan
  // menyebutnya kosong akan membuat orang menempatkan pasien di sana.
  CLEANING: 'Menunggu pembersihan',
  MAINTENANCE: 'Dalam perbaikan',
  CLOSED: 'Ditutup',
};

export const LABEL_CARA_PULANG: Record<string, string> = {
  ROUTINE: 'Pulang biasa',
  TRANSFER_OUT: 'Dirujuk keluar',
  AGAINST_MEDICAL_ADVICE: 'Pulang paksa',
  ABSCONDED: 'Menghilang',
  DECEASED: 'Meninggal',
};

/**
 * Rupa tingkat triase.
 *
 * Tingkat 1 dan 2 berwarna pekat; sisanya menurun. Bukan gradasi cantik:
 * perawat yang memindai papan dari seberang ruangan harus dapat melihat siapa
 * yang tidak boleh menunggu, tanpa membaca satu angka pun.
 */
export const RUPA_TRIASE: Record<number, { kelas: string; label: string }> = {
  1: { kelas: 'bg-rose-600 text-white dark:bg-rose-700', label: 'Resusitasi' },
  2: { kelas: 'bg-orange-500 text-white dark:bg-orange-600', label: 'Gawat darurat' },
  3: { kelas: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200', label: 'Darurat' },
  4: { kelas: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200', label: 'Kurang darurat' },
  5: { kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', label: 'Tidak darurat' },
};

export const LABEL_DISPOSISI_IGD: Record<string, string> = {
  DISCHARGED: 'Pulang',
  ADMITTED: 'Rawat inap',
  TRANSFERRED: 'Dirujuk',
  OBSERVATION: 'Observasi',
  // Disebut apa adanya. Menyamarkannya menjadi "pulang" akan menyembunyikan
  // angka yang paling penting bagi mutu IGD.
  LEFT_WITHOUT_BEING_SEEN: 'Pergi tanpa dilihat',
  DIED_IN_ED: 'Meninggal di IGD',
  DOA: 'Meninggal sebelum tiba',
};

export const LABEL_TAHAP_BEDAH: Record<string, string> = {
  SIGN_IN: 'Sebelum pembiusan',
  TIME_OUT: 'Jeda sebelum sayatan',
  SIGN_OUT: 'Sebelum keluar',
};

/**
 * Rupa status gizi.
 *
 * Yang `actionable` diberi warna yang menuntut perhatian; yang normal tidak.
 * Layar Posyandu dipakai kader sambil berdiri di antara puluhan ibu, dan warna
 * yang dipakai untuk segalanya sama saja dengan tidak berwarna.
 */
export const RUPA_GIZI: Record<string, { kelas: string; label: string; mendesak: boolean }> = {
  SEVERELY_WASTED: {
    kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    label: 'Gizi buruk',
    mendesak: true,
  },
  WASTED: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Gizi kurang',
    mendesak: true,
  },
  SEVERELY_STUNTED: {
    kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    label: 'Sangat pendek',
    mendesak: true,
  },
  STUNTED: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Pendek',
    mendesak: true,
  },
  SEVERELY_UNDERWEIGHT: {
    kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    label: 'Berat sangat kurang',
    mendesak: true,
  },
  UNDERWEIGHT: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Berat kurang',
    mendesak: true,
  },
  OBESE: {
    kelas: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    label: 'Obesitas',
    mendesak: true,
  },
  OVERWEIGHT: {
    kelas: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    label: 'Gizi lebih',
    mendesak: true,
  },
  RISK_OVERWEIGHT: {
    kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    label: 'Berisiko gizi lebih',
    mendesak: false,
  },
  TALL: {
    kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    label: 'Tinggi',
    mendesak: false,
  },
  NORMAL: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Normal',
    mendesak: false,
  },
};

/**
 * Terjemahan kode penolakan imunisasi.
 *
 * Cadangan saja: peladen hampir selalu mengirim `message` yang sudah berupa
 * kalimat lengkap beserta tanggalnya. Yang ini dipakai bila `message` kosong —
 * supaya yang muncul di layar tetap bahasa manusia, bukan `TOO_YOUNG`.
 */
export const LABEL_TOLAK_IMUNISASI: Record<string, string> = {
  TOO_YOUNG: 'Umurnya belum cukup.',
  INTERVAL_TOO_SHORT: 'Jaraknya dari dosis sebelumnya belum cukup.',
  ALREADY_GIVEN: 'Dosis ini sudah pernah diberikan.',
  OUT_OF_ORDER: 'Dosis sebelumnya belum lengkap.',
};

export const LABEL_HUBUNGAN_KELUARGA: Record<string, string> = {
  HEAD: 'Kepala keluarga',
  SPOUSE: 'Istri/suami',
  CHILD: 'Anak',
  PARENT: 'Orang tua',
  SIBLING: 'Saudara',
  GRANDPARENT: 'Kakek/nenek',
  GRANDCHILD: 'Cucu',
  OTHER: 'Lainnya',
};

export const LABEL_KEGAWATAN: Record<string, string> = {
  FATAL: 'Fatal',
  SEVERE: 'Berat',
  MODERATE: 'Sedang',
  MILD: 'Ringan',
  UNKNOWN: 'Tidak diketahui',
};
