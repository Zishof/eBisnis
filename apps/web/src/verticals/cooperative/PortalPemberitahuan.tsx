/**
 * Pemberitahuan untuk anggota.
 *
 * Tautan pada setiap pemberitahuan selalu relatif ke portal, tidak pernah ke
 * alamat luar — ditegakkan constraint di basis data dan diperiksa kembali di
 * sini. Melatih anggota menekan tautan yang dikirim mengatasnamakan koperasi
 * adalah cara paling mudah membuat mereka menekan tautan berikutnya yang
 * bukan dari koperasi.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { portalApi } from './portal-api';
import { formatTanggal } from './portal-menu';

const LABEL_JENIS: Record<string, string> = {
  INSTALLMENT_DUE: 'Angsuran jatuh tempo',
  INSTALLMENT_OVERDUE: 'Angsuran menunggak',
  INSTALLMENT_RECEIVED: 'Angsuran diterima',
  SAVING_RECEIVED: 'Simpanan diterima',
  SAVING_WITHDRAWN: 'Penarikan simpanan',
  MANDATORY_SAVING_DUE: 'Simpanan wajib jatuh tempo',
  LOAN_APPROVED: 'Pinjaman disetujui',
  LOAN_REJECTED: 'Pinjaman ditolak',
  LOAN_DISBURSED: 'Pinjaman dicairkan',
  SHU_ALLOCATED: 'SHU dialokasikan',
  SHU_PAID: 'SHU dibayarkan',
  MEETING_INVITATION: 'Undangan rapat',
  MEETING_RESULT: 'Hasil rapat',
  VOTE_OPEN: 'Pemungutan suara dibuka',
  COMPLAINT_RESPONDED: 'Pengaduan ditanggapi',
  COMPLAINT_RESOLVED: 'Pengaduan diselesaikan',
  APPLICATION_APPROVED: 'Pendaftaran disetujui',
  APPLICATION_REJECTED: 'Pendaftaran ditolak',
  ANNOUNCEMENT: 'Pengumuman',
  PORTAL_SECURITY: 'Keamanan akun',
};

/**
 * Menyaring tautan yang datang dari peladen.
 *
 * Constraint basis data sudah menegakkannya, dan pemeriksaan ini tidak
 * menggantikannya — ia hanya memastikan bahwa data lama, data yang dimasukkan
 * lewat jalur lain, atau cacat kelak tidak berakhir sebagai tautan luar yang
 * tampak resmi di layar anggota.
 */
function tautanAman(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//')) return null; // //situs-lain.example
  return path;
}

export function PortalPemberitahuan() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'notifications'],
    queryFn: portalApi.pemberitahuan,
    retry: false,
  });

  const tandai = useMutation({
    mutationFn: (id: string) => portalApi.tandaiDibaca(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cooperative', 'portal'] });
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500">Memuat pemberitahuan…</p>;

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Tidak ada pemberitahuan.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {data.map((n) => {
        const tautan = tautanAman(n.link_path);
        return (
          <li
            key={n.id}
            className={`rounded-xl border p-4 ${
              n.read_at
                ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <Bell
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  n.read_at ? 'text-slate-400' : 'text-emerald-600'
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {LABEL_JENIS[n.kind] ?? n.kind}
                </p>
                <p className="mt-0.5 font-medium">{n.title}</p>
                {n.body && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.body}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-500">{formatTanggal(n.created_at)}</span>
                  {tautan && (
                    <Link to={tautan} className="font-medium text-emerald-700 dark:text-emerald-400">
                      Buka
                    </Link>
                  )}
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={() => tandai.mutate(n.id)}
                      className="text-slate-500 underline"
                    >
                      Tandai sudah dibaca
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
