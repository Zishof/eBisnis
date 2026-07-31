/**
 * Rapat anggota di portal.
 *
 * Satu-satunya layar portal yang menampilkan data milik bersama, bukan milik
 * pembacanya. Anggota berhak mengetahui jalannya rapat — agenda, kuorum,
 * keputusannya — sebab pengawasan koperasi memang ada pada anggotanya, bukan
 * pada pengurus.
 *
 * Yang tetap perorangan adalah suaranya sendiri, dan itu dibaca lewat jalur
 * terpisah.
 */

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, MapPin } from 'lucide-react';
import { portalApi } from './portal-api';
import { formatTanggal } from './portal-menu';

const LABEL_JENIS: Record<string, string> = {
  ANNUAL: 'Rapat Anggota Tahunan',
  SPECIAL: 'Rapat Anggota Luar Biasa',
  BOARD: 'Rapat Pengurus',
  SUPERVISORY: 'Rapat Pengawas',
};

const LABEL_STATUS: Record<string, string> = {
  PLANNED: 'Direncanakan',
  INVITED: 'Undangan disebar',
  OPEN: 'Sedang berlangsung',
  QUORUM_REACHED: 'Kuorum tercapai',
  CLOSED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export function PortalRat() {
  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'meetings'],
    queryFn: portalApi.rapat,
    retry: false,
  });

  if (isLoading) return <p className="text-sm text-slate-500">Memuat rapat…</p>;

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Belum ada rapat anggota yang tercatat.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {LABEL_JENIS[r.meeting_type] ?? r.meeting_type}
              </p>
              <h2 className="mt-0.5 font-medium">{r.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {formatTanggal(r.scheduled_at)}
                {r.location && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {r.location}
                  </span>
                )}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {LABEL_STATUS[r.status] ?? r.status}
            </span>
          </div>

          {/*
            Kuorum ditampilkan apa adanya, termasuk ketika TIDAK tercapai.
            Rapat yang tidak kuorum tetap tercatat dan keputusannya ditandai
            tidak sah — menyembunyikannya dari anggota justru menghilangkan hal
            yang paling perlu diketahui anggota.
          */}
          {r.status === 'CLOSED' || r.status === 'QUORUM_REACHED' ? (
            <p
              className={`mt-3 inline-flex items-center gap-1.5 text-sm ${
                r.quorum_reached ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {r.quorum_reached ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : (
                <CircleAlert className="h-4 w-4" aria-hidden />
              )}
              {r.quorum_reached
                ? 'Kuorum tercapai — keputusan rapat ini sah'
                : 'Kuorum tidak tercapai — keputusan rapat ini ditandai tidak sah'}
            </p>
          ) : null}

          <p className="mt-2 text-xs text-slate-500">Nomor rapat {r.meeting_number}</p>
        </div>
      ))}

      <p className="text-xs text-slate-500">
        Dalam koperasi, satu anggota memiliki satu suara — berapa pun besar simpanannya. Itu
        pembeda mendasar koperasi dari perseroan terbatas.
      </p>
    </div>
  );
}
