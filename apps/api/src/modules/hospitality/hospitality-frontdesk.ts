/** Aturan domain front office MI-12, bebas dari HTTP dan database. */
export const STATUS_INAP = ['PRE_ARRIVAL', 'ASSIGNED', 'IN_HOUSE', 'CHECKED_OUT', 'WALKED'] as const;
export type StatusInap = (typeof STATUS_INAP)[number];

export const JENIS_KUNCI = ['PHYSICAL', 'DIGITAL'] as const;
export type JenisKunci = (typeof JENIS_KUNCI)[number];

export interface SyaratCheckin {
  identityVerified?: boolean;
  guaranteeConfirmed?: boolean;
  registrationCardSigned?: boolean;
  roomReady?: boolean;
  adults?: number;
  children?: number;
}

export interface GalatFrontdesk { field: string; code: string; message: string }

export function validasiCheckin(input: SyaratCheckin): GalatFrontdesk[] {
  const errors: GalatFrontdesk[] = [];
  if (!input.identityVerified) errors.push({ field: 'identityVerified', code: 'WAJIB', message: 'Identitas tamu harus diverifikasi.' });
  if (!input.guaranteeConfirmed) errors.push({ field: 'guaranteeConfirmed', code: 'WAJIB', message: 'Jaminan atau deposit harus dikonfirmasi.' });
  if (!input.registrationCardSigned) errors.push({ field: 'registrationCardSigned', code: 'WAJIB', message: 'Registration card dan consent harus disetujui.' });
  if (!input.roomReady) errors.push({ field: 'roomReady', code: 'KAMAR_BELUM_SIAP', message: 'Kamar harus berstatus siap sebelum check-in.' });
  if ((input.adults ?? 0) < 1) errors.push({ field: 'adults', code: 'TIDAK_SAH', message: 'Minimal satu tamu dewasa.' });
  if ((input.children ?? 0) < 0) errors.push({ field: 'children', code: 'TIDAK_SAH', message: 'Jumlah anak tidak boleh negatif.' });
  return errors;
}

export function transisiInapDiizinkan(from: StatusInap, to: StatusInap): boolean {
  const transitions: Record<StatusInap, readonly StatusInap[]> = {
    PRE_ARRIVAL: ['ASSIGNED', 'IN_HOUSE', 'WALKED'],
    ASSIGNED: ['PRE_ARRIVAL', 'IN_HOUSE', 'WALKED'],
    IN_HOUSE: ['CHECKED_OUT'],
    CHECKED_OUT: [],
    WALKED: [],
  };
  return transitions[from].includes(to);
}

export interface DigitalKeyCommand {
  stayId: string;
  roomId: string;
  validFrom: string;
  validUntil: string;
  idempotencyKey: string;
}

export interface DigitalKeyResult { granted: boolean; externalReference?: string; errorCode?: string }

/** Port provider-neutral. Tidak ada endpoint/vendor yang direka. */
export interface HospitalityDigitalKeyAdapter {
  readonly key: string;
  readonly live: boolean;
  grant(command: DigitalKeyCommand): Promise<DigitalKeyResult>;
  revoke(externalReference: string, idempotencyKey: string): Promise<DigitalKeyResult>;
}

export class BlockedDigitalKeyAdapter implements HospitalityDigitalKeyAdapter {
  readonly key = 'BLOCKED';
  readonly live = false;
  async grant(_command: DigitalKeyCommand): Promise<DigitalKeyResult> {
    return { granted: false, errorCode: 'BLOCKED_PROVIDER_INPUT' };
  }
  async revoke(_externalReference: string, _idempotencyKey: string): Promise<DigitalKeyResult> {
    return { granted: false, errorCode: 'BLOCKED_PROVIDER_INPUT' };
  }
}
