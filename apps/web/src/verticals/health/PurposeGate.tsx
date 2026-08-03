/**
 * Gerbang tujuan penggunaan.
 *
 * Sebelum satu rekam medis pun terbuka, pengguna menyatakan **untuk apa** ia
 * membukanya. Terasa merepotkan, dan memang begitu maksudnya: yang paling
 * sering terjadi pada sistem kesehatan bukan peretasan dari luar, melainkan
 * tenaga kesehatan yang membuka rekam medis orang yang tidak dirawatnya —
 * tetangga, mantan pasangan, orang terkenal.
 *
 * Hak akses berbasis peran tidak menahannya, sebab perawat memang berhak
 * membaca rekam medis. Yang menahannya adalah kesadaran bahwa perbuatannya
 * tercatat beserta alasannya.
 *
 * Pilihannya disimpan selama sesi peramban, bukan ditanyakan ulang setiap
 * halaman. Bertanya terlalu sering akan membuat orang memilih apa pun demi
 * lewat, dan pilihan yang asal justru merusak nilai jejaknya.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ShieldAlert, Stethoscope } from 'lucide-react';
import { TUJUAN_LABEL, type KonteksAkses, type PurposeOfUse } from './health-api';

interface NilaiKonteks {
  ctx: KonteksAkses;
  setPurpose: (p: PurposeOfUse) => void;
  /** Menyalakan akses darurat untuk satu pembacaan berikutnya. */
  mintaBreakGlass: (reason: string) => void;
  clearBreakGlass: () => void;
}

const KUNCI = 'emedik.purpose';
const Konteks = createContext<NilaiKonteks | null>(null);

export function PurposeProvider({ children }: { children: ReactNode }) {
  const [purpose, setPurposeState] = useState<PurposeOfUse>(() => {
    const tersimpan = sessionStorage.getItem(KUNCI);
    return (tersimpan as PurposeOfUse) || 'TREATMENT';
  });
  const [breakGlass, setBreakGlass] = useState<{ on: boolean; reason: string }>({
    on: false,
    reason: '',
  });

  const setPurpose = useCallback((p: PurposeOfUse) => {
    sessionStorage.setItem(KUNCI, p);
    setPurposeState(p);
  }, []);

  const nilai = useMemo<NilaiKonteks>(
    () => ({
      ctx: {
        purpose,
        breakGlass: breakGlass.on,
        breakGlassReason: breakGlass.reason,
      },
      setPurpose,
      mintaBreakGlass: (reason: string) => setBreakGlass({ on: true, reason }),
      clearBreakGlass: () => setBreakGlass({ on: false, reason: '' }),
    }),
    [purpose, breakGlass, setPurpose],
  );

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export function usePurpose(): NilaiKonteks {
  const v = useContext(Konteks);
  if (!v) throw new Error('usePurpose harus dipakai di dalam PurposeProvider.');
  return v;
}

/** Pemilih tujuan yang selalu terlihat di kepala halaman kesehatan. */
export function PurposeSelector() {
  const { ctx, setPurpose, clearBreakGlass } = usePurpose();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
        htmlFor="purpose-of-use"
      >
        <Stethoscope className="h-4 w-4" aria-hidden />
        Tujuan akses
      </label>
      <select
        id="purpose-of-use"
        className="field-input w-auto py-1 text-sm"
        value={ctx.purpose}
        onChange={(e) => setPurpose(e.target.value as PurposeOfUse)}
      >
        {(Object.keys(TUJUAN_LABEL) as PurposeOfUse[])
          // Kegawatdaruratan tidak dipilih dari daftar ini: ia menuntut alasan
          // tertulis dan hak akses tersendiri, lewat dialog akses darurat.
          .filter((p) => p !== 'EMERGENCY')
          .map((p) => (
            <option key={p} value={p}>
              {TUJUAN_LABEL[p]}
            </option>
          ))}
      </select>

      {ctx.breakGlass && (
        <span className="badge flex items-center gap-1 bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          Akses darurat aktif
          <button
            type="button"
            className="ms-1 underline"
            onClick={clearBreakGlass}
          >
            matikan
          </button>
        </span>
      )}
    </div>
  );
}

/**
 * Dialog akses darurat.
 *
 * Menuntut alasan tertulis sekurang-kurangnya sepuluh huruf — sama dengan yang
 * ditegakkan peladen dan basis data. Diulang di sini bukan karena tidak percaya
 * pada peladen, melainkan supaya penolakannya terjadi sebelum pengguna mengira
 * ia sudah berhasil.
 */
export function BreakGlassDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  if (!open) return null;

  const cukup = reason.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="card w-full max-w-lg p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-rose-700 dark:text-rose-300">
          <ShieldAlert className="h-5 w-5" aria-hidden />
          Akses darurat rekam medis
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Anda akan membuka rekam medis pasien yang <strong>tidak sedang Anda rawat</strong>.
          Tindakan ini diizinkan karena menolaknya dapat membahayakan nyawa di keadaan gawat —
          tetapi ia dicatat beserta alasan Anda, dan ditelaah petugas mutu.
        </p>

        <label className="field-label mt-4" htmlFor="break-glass-reason">
          Alasan membuka rekam medis ini *
        </label>
        <textarea
          id="break-glass-reason"
          className="field-input min-h-[6rem]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Contoh: Pasien tidak sadar di IGD, riwayat alergi diperlukan segera."
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Sekurang-kurangnya sepuluh huruf. Alasan yang tidak dapat ditelaah sama saja dengan
          tidak dicatat.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onCancel}>
            Batal
          </button>
          <button
            type="button"
            className="btn bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
            disabled={!cukup}
            onClick={() => onConfirm(reason.trim())}
          >
            Buka dan catat alasannya
          </button>
        </div>
      </div>
    </div>
  );
}
