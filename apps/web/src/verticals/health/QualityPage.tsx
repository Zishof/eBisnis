/**
 * Indikator mutu dan kelengkapan berkas.
 *
 * ## Arah menentukan warna, bukan besarnya angka
 *
 * `direction` menyatakan apakah indikator itu lebih baik ketika **naik** atau
 * ketika **turun**. Angka infeksi luka operasi 2% jauh lebih baik daripada 12%;
 * kepatuhan cuci tangan 2% jauh lebih buruk daripada 12%.
 *
 * Layar yang mewarnai menurut besarnya angka akan menghijaukan yang buruk pada
 * separuh indikatornya — dan tidak seorang pun akan menyadarinya, sebab warna
 * hijau tidak pernah ditanyakan.
 *
 * Karena itu warna di sini datang dari `meets_target` yang dihitung peladen,
 * bukan dari perbandingan yang dilakukan layar ini sendiri.
 *
 * ## Indikator tanpa pengukuran ditampilkan, bukan disembunyikan
 *
 * Yang `value`-nya kosong berarti belum ada yang mengukurnya periode ini.
 * Menyembunyikannya menghasilkan papan yang seluruhnya hijau — dan papan yang
 * seluruhnya hijau karena separuh indikatornya tidak diukur adalah keadaan yang
 * paling menyesatkan yang dapat ditampilkan sebuah dasbor mutu.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChartNoAxesCombined, CircleHelp, FileCheck } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi } from './health-api';

const LABEL_ARAH: Record<string, string> = {
  HIGHER_IS_BETTER: 'makin tinggi makin baik',
  LOWER_IS_BETTER: 'makin rendah makin baik',
};

export function QualityPage() {
  const toMessage = useErrorMessage();
  const [tahun, setTahun] = useState(new Date().getFullYear());

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const papan = useQuery({
    queryKey: ['health', 'quality', dipakai, tahun],
    queryFn: () => healthApi.qualityDashboard(dipakai as string, tahun),
    enabled: Boolean(dipakai),
  });

  const indikator = papan.data?.indicators ?? [];
  const terukur = indikator.filter((i) => i.value != null);
  const belumDiukur = indikator.filter((i) => i.value == null);
  const takTercapai = terukur.filter((i) => i.meets_target === false);

  return (
    <>
      <PageHeader
        title="Indikator Mutu"
        description="Arah menentukan warnanya, bukan besarnya angka — dan yang belum diukur tetap ditampilkan."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Indikator Mutu' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-mutu">
            Fasilitas
          </label>
          <select
            id="fasilitas-mutu"
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
          <label className="field-label" htmlFor="tahun-mutu">
            Tahun
          </label>
          <input
            id="tahun-mutu"
            className="field-input w-28"
            inputMode="numeric"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value) || new Date().getFullYear())}
          />
        </div>
      </div>

      {papan.isLoading && <LoadingState label="Memuat indikator mutu…" />}
      {papan.isError && (
        <ErrorState
          message={toMessage(papan.error, (k, f) => f ?? k)}
          onRetry={() => void papan.refetch()}
        />
      )}

      {papan.data && (
        <>
          {/* --- Kelengkapan berkas -------------------------------------- */}
          <div className="card mb-4 flex flex-wrap items-center gap-6 px-4 py-4">
            <div>
              <p className="inline-flex items-center gap-1 text-xs uppercase text-slate-500 dark:text-slate-400">
                <FileCheck className="h-3.5 w-3.5" aria-hidden />
                Kelengkapan berkas
              </p>
              <p className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {papan.data.recordCompleteness.score.toFixed(1)}%
              </p>
            </div>
            <p className="max-w-lg text-sm text-slate-600 dark:text-slate-300">
              {papan.data.recordCompleteness.message}
            </p>
          </div>

          <div className="card mb-4 flex flex-wrap items-center gap-6 px-4 py-4">
            <div>
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Terukur</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {terukur.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Tak tercapai</p>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  takTercapai.length > 0
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {takTercapai.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Belum diukur</p>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  belumDiukur.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'
                }`}
              >
                {belumDiukur.length}
              </p>
            </div>
            <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
              Angka ketiga yang paling mudah diabaikan. Papan yang seluruhnya hijau karena separuh
              indikatornya tidak diukur adalah keadaan paling menyesatkan yang dapat ditampilkan
              sebuah dasbor mutu.
            </p>
          </div>

          {indikator.length === 0 && (
            <EmptyState
              title="Belum ada indikator mutu pada periode ini"
              description="Indikator ditetapkan lebih dahulu, lalu diukur. Tanpa indikator, tidak ada yang dapat dibandingkan."
            />
          )}

          {indikator.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Indikator</th>
                    <th className="px-3 py-2 text-start font-medium">Kategori</th>
                    <th className="px-3 py-2 text-start font-medium">Arah</th>
                    <th className="px-3 py-2 text-end font-medium">Sasaran</th>
                    <th className="px-3 py-2 text-end font-medium">Capaian</th>
                    <th className="px-3 py-2 text-start font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {indikator.map((i) => (
                    <tr
                      key={i.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium">{i.name}</span> <Code>{i.code}</Code>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {i.category ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                        {LABEL_ARAH[i.direction] ?? i.direction}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {i.target_value == null ? '—' : i.target_value.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {i.value == null ? (
                          <span className="text-slate-400">belum diukur</span>
                        ) : (
                          i.value.toFixed(1)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {/*
                          Warna dari `meets_target` yang DIHITUNG PELADEN, bukan
                          dari perbandingan yang dilakukan layar ini. Layar yang
                          membandingkan sendiri akan menghijaukan yang buruk
                          pada setiap indikator yang makin rendah makin baik.
                        */}
                        {i.value == null ? (
                          <span className="badge inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            <CircleHelp className="h-3 w-3" aria-hidden />
                            Belum diukur
                          </span>
                        ) : i.meets_target ? (
                          <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            Tercapai
                          </span>
                        ) : (
                          <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                            Tak tercapai
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="inline-flex items-start gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                <ChartNoAxesCombined className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Status dihitung peladen menurut <strong>arah</strong> tiap indikator. Infeksi luka
                  operasi 2% jauh lebih baik daripada 12%; kepatuhan cuci tangan 2% jauh lebih
                  buruk daripada 12%.
                </span>
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
