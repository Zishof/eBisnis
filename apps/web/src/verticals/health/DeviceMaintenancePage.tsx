/**
 * Pemeliharaan alat, uji keselamatan, dan risiko keamanan siber.
 *
 * ## Yang terlambat MENANDAI, bukan menghentikan
 *
 * `menghentikanLayanan` selalu `false` pada jawaban peladen, dan itu keputusan
 * yang perlu dijelaskan di layar: alat yang dihentikan sendiri oleh penjadwal
 * berhenti pada saat yang dipilih kalender — bukan pada saat yang dipilih orang
 * yang tahu ada pasien memakainya atau tidak.
 *
 * Ventilator yang mati sendiri karena jadwal kalibrasinya lewat adalah bahaya
 * yang lebih besar daripada ventilator yang kalibrasinya lewat.
 *
 * ## Uji keselamatan yang GAGAL ditandai terpisah dari pemeliharaan yang lewat
 *
 * Keduanya sering disamakan dan berbeda sama sekali. Pemeliharaan yang lewat
 * berarti belum diperiksa; uji keselamatan yang gagal berarti **sudah
 * diperiksa dan hasilnya buruk**. Yang kedua jauh lebih mendesak, dan
 * menggabungkannya ke satu angka membuat yang mendesak tenggelam.
 *
 * ## Risiko siber: penilaian tanpa keputusan bukan penilaian
 *
 * `adaKeputusanBerlaku` membedakan risiko yang sudah diputuskan seseorang dari
 * risiko yang hanya dinilai lalu ditinggalkan. `tenggatKeputusan` yang sudah
 * lewat tanpa keputusan ditandai — itu keadaan yang paling sering terjadi dan
 * paling jarang terlihat.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ShieldAlert, Wrench } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi } from './health-api';

const RUPA_TINGKAT: Record<string, { kelas: string; label: string }> = {
  CRITICAL: { kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200', label: 'Kritis' },
  HIGH: { kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200', label: 'Tinggi' },
  MEDIUM: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Sedang',
  },
  LOW: { kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', label: 'Rendah' },
};

const LABEL_HASIL: Record<string, { kelas: string; label: string }> = {
  PASS: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Lulus',
  },
  FAIL: { kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200', label: 'Gagal' },
  CONDITIONAL: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Bersyarat',
  },
};

const hariIni = () => new Date().toISOString().slice(0, 10);

export function DeviceMaintenancePage() {
  const toMessage = useErrorMessage();
  const [tab, setTab] = useState<'schedule' | 'orders' | 'risk'>('schedule');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const jadwal = useQuery({
    queryKey: ['health', 'device-schedule', dipakai],
    queryFn: () => healthApi.deviceSchedule(dipakai as string),
    enabled: Boolean(dipakai),
  });

  const perintah = useQuery({
    queryKey: ['health', 'device-work-orders', dipakai],
    queryFn: () => healthApi.deviceWorkOrders(dipakai as string),
    enabled: Boolean(dipakai) && tab === 'orders',
  });

  const risiko = useQuery({
    queryKey: ['health', 'device-risk', dipakai],
    queryFn: () => healthApi.deviceRisk(dipakai as string),
    enabled: Boolean(dipakai) && tab === 'risk',
  });

  const butir = jadwal.data?.items ?? [];
  const gagalUji = butir.filter((b) => b.safetyInspectionFailed);
  const kalibrasiLewat = butir.filter((b) => b.calibrationOverdue);
  const risikoButir = risiko.data?.items ?? [];
  const tanpaKeputusan = risikoButir.filter(
    (r) => !r.adaKeputusanBerlaku && r.tenggatKeputusan != null && r.tenggatKeputusan < hariIni(),
  );

  return (
    <>
      <PageHeader
        title="Pemeliharaan dan Keamanan Alat"
        description="Yang terlambat menandai, tidak menghentikan — ventilator yang mati sendiri karena jadwal lebih berbahaya daripada ventilator yang jadwalnya lewat."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pemeliharaan Alat' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-rawat">
            Fasilitas
          </label>
          <select
            id="fasilitas-rawat"
            className="field-input"
            value={dipakai ?? ''}
            onChange={(e) => setFacilityId(e.target.value)}
          >
            {(fasilitas.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Pemeliharaan lewat</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              (jadwal.data?.overdueCount ?? 0) > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-400'
            }`}
          >
            {jadwal.data?.overdueCount ?? 0}
          </p>
        </div>
        {/*
          Uji keselamatan yang GAGAL dihitung TERPISAH dari pemeliharaan yang
          lewat. Yang pertama berarti sudah diperiksa dan hasilnya buruk; yang
          kedua berarti belum diperiksa. Menggabungkannya membuat yang mendesak
          tenggelam.
        */}
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Gagal uji keselamatan
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              gagalUji.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
            }`}
          >
            {gagalUji.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Kalibrasi lewat</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {kalibrasiLewat.length}
          </p>
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          Gagal uji keselamatan berarti <strong>sudah diperiksa dan hasilnya buruk</strong>;
          pemeliharaan lewat berarti belum diperiksa. Keduanya sering disamakan dan berbeda sama
          sekali.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Tampilan pemeliharaan">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'schedule'}
          className={tab === 'schedule' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('schedule')}
        >
          <CalendarClock className="h-4 w-4" aria-hidden />
          Jadwal
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          className={tab === 'orders' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('orders')}
        >
          <Wrench className="h-4 w-4" aria-hidden />
          Perintah kerja
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'risk'}
          className={tab === 'risk' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('risk')}
        >
          <ShieldAlert className="h-4 w-4" aria-hidden />
          Risiko keamanan
        </button>
      </div>

      {tab === 'schedule' && (
        <>
          {jadwal.isLoading && <LoadingState label="Memuat jadwal…" />}
          {jadwal.isError && (
            <ErrorState
              message={toMessage(jadwal.error, (k, f) => f ?? k)}
              onRetry={() => void jadwal.refetch()}
            />
          )}
          {butir.length === 0 && <EmptyState title="Belum ada alat pada jadwal pemeliharaan" />}

          {butir.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Kode</th>
                    <th className="px-3 py-2 text-start font-medium">Nama</th>
                    <th className="px-3 py-2 text-start font-medium">Jatuh tempo</th>
                    <th className="px-3 py-2 text-end font-medium">Terlambat (hari)</th>
                    <th className="px-3 py-2 text-start font-medium">Tanda</th>
                  </tr>
                </thead>
                <tbody>
                  {butir.map((b) => (
                    <tr
                      key={b.id}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                        b.safetyInspectionFailed ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <Code>{b.code}</Code>
                      </td>
                      <td className="px-3 py-2 font-medium">{b.name}</td>
                      <td className="px-3 py-2">{b.maintenance?.jatuhTempo ?? '—'}</td>
                      <td
                        className={`px-3 py-2 text-end tabular-nums ${
                          (b.maintenance?.terlambatHari ?? 0) > 0
                            ? 'font-semibold text-amber-700 dark:text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {b.maintenance?.terlambatHari ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          {b.safetyInspectionFailed && (
                            <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                              gagal uji keselamatan
                            </span>
                          )}
                          {b.calibrationOverdue && (
                            <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                              kalibrasi lewat
                            </span>
                          )}
                          {!b.safetyInspectionFailed && !b.calibrationOverdue && (
                            <span className="text-slate-400">—</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {jadwal.data?.note && (
                <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {jadwal.data.note}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'orders' && (
        <>
          {perintah.isLoading && <LoadingState label="Memuat perintah kerja…" />}
          {perintah.data?.length === 0 && <EmptyState title="Belum ada perintah kerja" />}
          {perintah.data && perintah.data.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Nomor</th>
                    <th className="px-3 py-2 text-start font-medium">Alat</th>
                    <th className="px-3 py-2 text-start font-medium">Jenis</th>
                    <th className="px-3 py-2 text-start font-medium">Hasil uji</th>
                    <th className="px-3 py-2 text-end font-medium">Henti layanan</th>
                    <th className="px-3 py-2 text-start font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {perintah.data.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                        p.inspection_result === 'FAIL' ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <Code>{p.work_order_number}</Code>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{p.device_name}</span>{' '}
                        <Code>{p.device_code}</Code>
                      </td>
                      <td className="px-3 py-2">{p.work_type}</td>
                      <td className="px-3 py-2">
                        {p.inspection_result ? (
                          <span className={`badge ${LABEL_HASIL[p.inspection_result]?.kelas ?? ''}`}>
                            {LABEL_HASIL[p.inspection_result]?.label ?? p.inspection_result}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {p.downtime_minutes ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {p.status}
                          </span>
                          {p.affected_patient && (
                            <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                              mengenai pasien
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'risk' && (
        <>
          {risiko.isLoading && <LoadingState label="Memuat penilaian risiko…" />}
          {risikoButir.length === 0 && !risiko.isLoading && (
            <EmptyState title="Belum ada penilaian risiko keamanan siber" />
          )}

          {tanpaKeputusan.length > 0 && (
            <div className="card mb-3 flex items-start gap-2 border-s-4 border-s-rose-400 px-4 py-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              <p className="text-sm text-slate-800 dark:text-slate-200">
                <strong>{tanpaKeputusan.length} penilaian sudah lewat tenggat tanpa
                keputusan.</strong>{' '}
                Penilaian tanpa keputusan bukan penilaian — ia catatan bahwa seseorang pernah
                melihat masalahnya dan tidak melakukan apa pun.
              </p>
            </div>
          )}

          {risikoButir.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Alat</th>
                    <th className="px-3 py-2 text-start font-medium">Tingkat</th>
                    <th className="px-3 py-2 text-end font-medium">Skor sisa</th>
                    <th className="px-3 py-2 text-start font-medium">Tenggat keputusan</th>
                    <th className="px-3 py-2 text-start font-medium">Keputusan</th>
                  </tr>
                </thead>
                <tbody>
                  {risikoButir.map((r) => {
                    const lewat =
                      !r.adaKeputusanBerlaku &&
                      r.tenggatKeputusan != null &&
                      r.tenggatKeputusan < hariIni();
                    return (
                      <tr
                        key={r.assessmentId}
                        className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                          lewat ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          <span className="font-medium">{r.deviceName}</span>{' '}
                          <Code>{r.deviceCode}</Code>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`badge ${RUPA_TINGKAT[r.tingkat]?.kelas ?? ''}`}>
                            {RUPA_TINGKAT[r.tingkat]?.label ?? r.tingkat}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums">{r.skorSisa}</td>
                        <td
                          className={`px-3 py-2 ${lewat ? 'font-semibold text-rose-700 dark:text-rose-400' : ''}`}
                        >
                          {r.tenggatKeputusan ?? '—'}
                          {lewat && <span className="ms-1 text-xs">lewat</span>}
                        </td>
                        <td className="px-3 py-2">
                          {r.adaKeputusanBerlaku ? (
                            <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                              {r.decision ?? 'ada'}
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">
                              {r.keterangan}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {risiko.data?.note && (
                <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {risiko.data.note}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
