export const STATUS_TUGAS_HK = ['ASSIGNED','IN_PROGRESS','PAUSED','COMPLETED','INSPECTION_REQUIRED','INSPECTED','CLOSED','REFUSED'] as const;
export type StatusTugasHk = (typeof STATUS_TUGAS_HK)[number];

const TRANSITIONS: Record<StatusTugasHk, readonly StatusTugasHk[]> = {
  ASSIGNED: ['IN_PROGRESS','REFUSED'], IN_PROGRESS: ['PAUSED','COMPLETED','REFUSED'],
  PAUSED: ['IN_PROGRESS','REFUSED'], COMPLETED: ['INSPECTION_REQUIRED','CLOSED'],
  INSPECTION_REQUIRED: ['INSPECTED','IN_PROGRESS'], INSPECTED: ['CLOSED','IN_PROGRESS'], CLOSED: [], REFUSED: [],
};

export function transisiTugasHkDiizinkan(from: StatusTugasHk, to: StatusTugasHk): boolean {
  return TRANSITIONS[from].includes(to);
}

export function statusTujuanUntukAksi(aksi: 'START'|'PAUSE'|'COMPLETE'|'REQUEST_INSPECTION'|'INSPECT_PASS'|'INSPECT_FAIL'|'CLOSE'|'REFUSE'): StatusTugasHk {
  return ({ START:'IN_PROGRESS', PAUSE:'PAUSED', COMPLETE:'COMPLETED', REQUEST_INSPECTION:'INSPECTION_REQUIRED',
    INSPECT_PASS:'INSPECTED', INSPECT_FAIL:'IN_PROGRESS', CLOSE:'CLOSED', REFUSE:'REFUSED' } as const)[aksi];
}

export function workloadPoints(kind: string, roomSizeM2 = 0, vip = false, dueIn = false): number {
  const base = kind === 'CHECKOUT' ? 5 : kind === 'TURNDOWN' ? 2 : 3;
  return base + Math.ceil(Math.max(0, roomSizeM2 - 20) / 20) + (vip ? 2 : 0) + (dueIn ? 2 : 0);
}

