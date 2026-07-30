/**
 * Profil hak aksi P0–P12 sesuai blueprint Versi 8 Revisi 1.
 *
 * Profil adalah cetakan: satu role menyatakan profil apa yang berlaku pada modul
 * apa, lalu seeder menurunkannya menjadi baris role_menu_permission. Tanpa
 * lapisan ini, 140 role dikali ratusan menu dikali 26 aksi berarti menulis dan
 * memelihara ratusan ribu baris satu per satu.
 *
 * Menambah menu baru otomatis terwarisi seluruh role, karena role menunjuk modul
 * dan bukan daftar menu.
 */

/** Kode profil hak aksi. */
export type ProfileCode =
  | 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6'
  | 'P7' | 'P8' | 'P9' | 'P10' | 'P11' | 'P12';

/**
 * Tingkat pembatasan data. Menentukan baris mana yang terlihat, bukan tombol
 * mana yang tampil — keduanya lapisan berbeda dan keduanya ditegakkan server.
 */
export type DataScopeCode =
  | 'PLATFORM'        // seluruh platform
  | 'TENANT'          // seluruh organisasi tenant
  | 'LEGAL_ENTITY'    // badan hukum yang ditugaskan
  | 'BRAND'           // brand yang ditugaskan
  | 'OUTLET'          // outlet yang ditugaskan
  | 'OUTLET_TERMINAL' // outlet + terminal + shift, khusus kasir
  | 'WAREHOUSE'       // gudang yang ditugaskan
  | 'DEPARTMENT'      // unit kerja
  | 'TEAM'            // bawahan langsung
  | 'SELF'            // hanya data milik sendiri
  | 'ASSIGNED_TRIP'   // perjalanan yang ditugaskan
  | 'ASSIGNED_QUEUE'  // antrean tiket yang ditugaskan
  | 'OWNERSHIP'       // kepemilikan investor sendiri
  | 'API_SCOPE';      // scope klien API

const READ_ONLY = ['READ', 'PRINT'] as const;

const OPERATOR = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'] as const;

const OPERATOR_IMPORT = [...OPERATOR, 'DELETE', 'IMPORT'] as const;

const APPROVER = ['READ', 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'PRINT'] as const;

const SUPERVISOR = [
  'READ', 'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
  'EXPORT', 'IMPORT', 'PRINT', 'SUBMIT', 'REVIEW',
] as const;

const MODULE_MANAGER = [
  ...SUPERVISOR,
  'APPROVE', 'REJECT', 'CANCEL', 'POST', 'REVERSE', 'RETURN', 'CHECK_ALL',
  'VIEW_AMOUNT',
] as const;

const MODULE_ADMIN = [
  ...MODULE_MANAGER,
  'AUDIT_READ', 'MANAGE_DEVICE', 'DELEGATE', 'VIEW_COST',
] as const;

const TENANT_ADMIN = [
  ...MODULE_ADMIN,
  'VIEW_PROFIT', 'CLOSE_PERIOD', 'REOPEN',
] as const;

const AUDITOR = ['READ', 'EXPORT', 'PRINT', 'AUDIT_READ'] as const;

const SELF_SERVICE = ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'PRINT'] as const;

const EXECUTIVE = [
  'READ', 'PRINT', 'EXPORT', 'APPROVE', 'REJECT',
  'VIEW_AMOUNT', 'VIEW_COST', 'VIEW_PROFIT', 'AUDIT_READ',
] as const;

const SERVICE_ACCOUNT = ['READ', 'CREATE', 'UPDATE'] as const;

/**
 * Aksi yang diberikan tiap profil.
 *
 * Catatan penting tentang P8: HARD_DELETE sengaja TIDAK termasuk. Blueprint
 * menyebut "seluruh hak tenant kecuali platform dan hard purge terbatas".
 * Penghapusan permanen tetap menuntut permission tersendiri dan step-up,
 * sehingga tidak ikut terbawa hanya karena seseorang administrator tenant.
 */
export const PROFILE_ACTIONS: Record<ProfileCode, readonly string[]> = {
  P0: [],
  P1: READ_ONLY,
  P2: OPERATOR,
  P3: OPERATOR_IMPORT,
  P4: APPROVER,
  P5: SUPERVISOR,
  P6: MODULE_MANAGER,
  P7: MODULE_ADMIN,
  P8: TENANT_ADMIN,
  P9: AUDITOR,
  P10: SELF_SERVICE,
  P11: EXECUTIVE,
  P12: SERVICE_ACCOUNT,
};

export const PROFILE_LABELS: Record<ProfileCode, string> = {
  P0: 'Tanpa akses',
  P1: 'Lihat',
  P2: 'Operator',
  P3: 'Operator Impor',
  P4: 'Penyetuju',
  P5: 'Supervisor',
  P6: 'Manajer Modul',
  P7: 'Admin Modul',
  P8: 'Administrator Tenant',
  P9: 'Auditor',
  P10: 'Layanan Mandiri',
  P11: 'Eksekutif/Investor',
  P12: 'Perangkat/Service Account',
};

/**
 * Syarat tombol Upload pada blueprint bagian 15: tampil hanya bila UPDATE dan
 * DELETE keduanya dimiliki. Dihitung dari profil, bukan ditulis ulang di UI,
 * supaya UI dan server memakai sumber yang sama.
 */
export function profileAllowsUpload(profile: ProfileCode): boolean {
  const actions = PROFILE_ACTIONS[profile];
  return actions.includes('UPDATE') && actions.includes('DELETE');
}

/** Profil yang memenuhi syarat unggah. Dipakai pengujian agar tidak melenceng. */
export const UPLOAD_CAPABLE_PROFILES: ProfileCode[] = (
  Object.keys(PROFILE_ACTIONS) as ProfileCode[]
).filter(profileAllowsUpload);
