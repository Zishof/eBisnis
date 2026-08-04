/**
 * Cakupan program Puskesmas.
 *
 * ## Penyebutnya SASARAN, bukan yang datang
 *
 * Itu satu-satunya hal yang benar-benar menentukan layar ini, dan ia perlu
 * ditulis di layarnya — bukan hanya di dokumentasi.
 *
 * Menghitung "berapa persen yang datang sudah diimunisasi" akan selalu
 * mendekati seratus persen dan tidak memberi tahu apa pun. Yang perlu diketahui
 * justru **berapa banyak yang tidak pernah datang**, dan angka itu hanya muncul
 * bila penyebutnya sasaran.
 *
 * Karena itu kolom yang ditonjolkan bukan persentasenya melainkan
 * **kekurangannya** — berapa anak yang belum tersentuh. Persentase 82% terbaca
 * lumayan; "134 anak belum diimunisasi" tidak terbaca lumayan oleh siapa pun.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChartColumn, Info } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisCakupan } from './health-api';

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Warna menurut kekurangannya, bukan menurut persentase.
 *
 * Ambangnya sengaja tidak simetris: 95% ke atas hijau, di bawah 75% merah.
 * Cakupan imunisasi di bawah 95% tidak menghasilkan kekebalan kelompok, jadi
 * "cukup baik" pada program ini berarti nyaris seluruhnya — bukan mayoritas.
 */
function rupaCakupan(persen: number): string {
  if (persen >= 95) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (persen >= 75) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
}

export function CoveragePage() {
  const toMessage = useErrorMessage();
  const sekarang = new Date();
  const [tahun, setTahun] = useState(sekarang.getFullYear());
  const [bulan, setBulan] = useState<number | ''>('');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const cakupan = useQuery({
    queryKey: ['health', 'coverage', dipakai, tahun, bulan],
    queryFn: () => healthApi.coverage(dipakai as string, tahun, bulan === '' ? undefined : bulan),
    enabled: Boolean(dipakai),
  });

  const baris = cakupan.data ?? [];
  const totalSasaran = baris.reduce((n, r) => n + r.target_count, 0);
  const totalTercapai = baris.reduce((n, r) => n + r.achieved_count, 0);
  const totalKurang = totalSasaran - totalTercapai;

  return (
    <>
      <PageHeader
        title="Cakupan Program"
        description="Penyebutnya SASARAN, bukan yang datang — sebab yang perlu diketahui adalah berapa yang tidak pernah datang."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Cakupan' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-cakupan">
            Fasilitas
          </label>
          <select
            id="fasilitas-cakupan"
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
          <label className="field-label" htmlFor="tahun">
            Tahun
          </label>
          <input
            id="tahun"
            className="field-input w-28"
            inputMode="numeric"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value) || sekarang.getFullYear())}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="bulan">
            Bulan
          </label>
          <select
            id="bulan"
            className="field-input"
            value={bulan}
            onChange={(e) => setBulan(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Setahun penuh</option>
            {BULAN.map((b, i) => (
              <option key={b} value={i + 1}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {cakupan.isLoading && <LoadingState label="Menghitung cakupan…" />}
      {cakupan.isError && (
        <ErrorState message={toMessage(cakupan.error, (k, f) => f ?? k)} onRetry={() => void cakupan.refetch()} />
      )}

      {cakupan.data?.length === 0 && (
        <EmptyState
          title="Belum ada sasaran program pada periode ini"
          description="Cakupan tidak dapat dihitung tanpa sasaran. Sasaran ditetapkan lebih dahulu, bukan disimpulkan dari yang datang."
        />
      )}

      {baris.length > 0 && (
        <>
          <div className="card mb-4 flex flex-wrap items-center gap-6 px-4 py-4">
            <div>
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Sasaran</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {totalSasaran.toLocaleString('id-ID')}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Tercapai</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {totalTercapai.toLocaleString('id-ID')}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                Belum tersentuh
              </p>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  totalKurang > 0
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {totalKurang.toLocaleString('id-ID')}
              </p>
            </div>
            <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
              Angka ketiga yang paling berguna. Persentase 82% terbaca lumayan; &ldquo;134 anak
              belum diimunisasi&rdquo; tidak terbaca lumayan oleh siapa pun.
            </p>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 text-start font-medium">Program</th>
                  <th className="px-3 py-2 text-start font-medium">Wilayah</th>
                  <th className="px-3 py-2 text-end font-medium">Sasaran</th>
                  <th className="px-3 py-2 text-end font-medium">Tercapai</th>
                  <th className="px-3 py-2 text-end font-medium">Belum tersentuh</th>
                  <th className="px-3 py-2 text-start font-medium">Cakupan</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((r: BarisCakupan) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-3 py-2">
                      <span className="font-medium">{r.program_name}</span>{' '}
                      <Code>{r.program_code}</Code>
                    </td>
                    <td className="px-3 py-2">{r.village ?? 'Seluruh wilayah'}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{r.target_count}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{r.achieved_count}</td>
                    <td
                      className={`px-3 py-2 text-end font-semibold tabular-nums ${
                        r.gap > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {r.gap}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge ${rupaCakupan(r.coverage)}`}>
                        {r.coverage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 inline-flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Warna cakupan sengaja tidak simetris: hijau mulai 95%, merah di bawah 75%. Cakupan
              imunisasi di bawah 95% tidak menghasilkan kekebalan kelompok — jadi &ldquo;cukup
              baik&rdquo; pada program ini berarti nyaris seluruhnya, bukan mayoritas.
            </span>
          </p>

          <p className="mt-2 inline-flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ChartColumn className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Seluruh angka di halaman ini agregat — tidak menyebut satu pasien pun, dan karena itu
              tidak menuntut tujuan penggunaan.
            </span>
          </p>
        </>
      )}
    </>
  );
}
