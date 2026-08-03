/**
 * Settlement jasa: perhitungan, koreksi, dan pembayaran.
 *
 * ## Simulasi dan yang sungguhan tidak boleh terlihat sama
 *
 * `is_simulation` menentukan apakah baris ini pernah menyentuh uang. Simulasi
 * dipakai untuk melihat "kalau persentasenya diubah, siapa dapat berapa" —
 * berguna, dan berbahaya bila tertukar.
 *
 * Layar ini menandainya besar dan memisahkan hitungannya, sebab dokter yang
 * ditunjukkan angka simulasi akan mengingatnya sebagai janji.
 *
 * ## Koreksi tidak menghapus, ia menambah baris
 *
 * `corrected_amount` berbeda dari jumlah baris aslinya berarti ada koreksi.
 * Keduanya ditampilkan: yang dihitung semula dan yang berlaku sesudah koreksi.
 * Menampilkan hanya yang terakhir membuat pertanyaan "mengapa bagian saya
 * berubah" tidak dapat dijawab.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, FlaskConical, TriangleAlert } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisSettlement } from './health-api';

const LABEL_PENERIMA: Record<string, string> = {
  DOCTOR_FEE: 'Jasa dokter',
  FACILITY_FEE: 'Jasa fasilitas',
  NURSE_FEE: 'Jasa perawat',
  ANESTHETIST_FEE: 'Jasa anestesi',
  SYSTEM_FEE: 'Fee sistem',
  INVESTOR_FEE: 'Fee investor',
  OTHER: 'Lainnya',
};

const RUPA_STATUS: Record<string, { kelas: string; label: string }> = {
  DRAFT: { kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', label: 'Draf' },
  CALCULATED: { kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', label: 'Terhitung' },
  APPROVED: {
    kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    label: 'Disetujui',
  },
  LOCKED: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Terkunci',
  },
  PAID: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Dibayar',
  },
  REVERSED: { kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200', label: 'Dibalik' },
};

const rupiah = (n: number | null | undefined) =>
  n == null
    ? '—'
    : n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function SettlementPage() {
  const toMessage = useErrorMessage();
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [dibuka, setDibuka] = useState<string | null>(null);

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const daftar = useQuery({
    queryKey: ['health', 'settlements', dipakai, tahun],
    queryFn: () => healthApi.settlements(dipakai as string, tahun),
    enabled: Boolean(dipakai),
  });

  const rinci = useQuery({
    queryKey: ['health', 'settlement', dibuka],
    queryFn: () => healthApi.settlement(dibuka as string),
    enabled: Boolean(dibuka),
  });

  const baris = daftar.data ?? [];
  const simulasi = baris.filter((s) => s.is_simulation);
  const sungguhan = baris.filter((s) => !s.is_simulation);
  const dikoreksi = sungguhan.filter(
    (s) => s.corrected_amount != null && s.corrected_amount !== s.basis_amount,
  );

  return (
    <>
      <PageHeader
        title="Settlement Jasa"
        description="Simulasi dan yang sungguhan tidak boleh terlihat sama — dokter yang ditunjukkan angka simulasi akan mengingatnya sebagai janji."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Settlement' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-settlement">
            Fasilitas
          </label>
          <select
            id="fasilitas-settlement"
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
          <label className="field-label" htmlFor="tahun-settlement">
            Tahun
          </label>
          <input
            id="tahun-settlement"
            className="field-input w-28"
            inputMode="numeric"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value) || new Date().getFullYear())}
          />
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Sungguhan</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {sungguhan.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Simulasi</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-500 dark:text-slate-400">
            {simulasi.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Dikoreksi</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              dikoreksi.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'
            }`}
          >
            {dikoreksi.length}
          </p>
        </div>
      </div>

      {daftar.isLoading && <LoadingState label="Memuat settlement…" />}
      {daftar.isError && (
        <ErrorState
          message={toMessage(daftar.error, (k, f) => f ?? k)}
          onRetry={() => void daftar.refetch()}
        />
      )}
      {daftar.data?.length === 0 && (
        <EmptyState
          title="Belum ada settlement pada periode ini"
          description="Settlement dihitung dari kebijakan jasa yang aktif. Tanpa kebijakan, tidak ada yang dapat dihitung."
        />
      )}

      {baris.length > 0 && (
        <div className="card mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Nomor</th>
                <th className="px-3 py-2 text-start font-medium">Periode</th>
                <th className="px-3 py-2 text-start font-medium">Kebijakan</th>
                <th className="px-3 py-2 text-end font-medium">Dasar</th>
                <th className="px-3 py-2 text-end font-medium">Sesudah koreksi</th>
                <th className="px-3 py-2 text-start font-medium">Keadaan</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((s: BarisSettlement) => (
                <tr
                  key={s.id}
                  className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                    s.is_simulation ? 'bg-slate-50/70 dark:bg-slate-800/40' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <Code>{s.settlement_number}</Code>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {s.period_month ? `${s.period_month}/` : ''}
                    {s.period_year}
                  </td>
                  <td className="px-3 py-2">
                    <Code>{s.policy_code}</Code>{' '}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      v{s.policy_version}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{rupiah(s.basis_amount)}</td>
                  <td
                    className={`px-3 py-2 text-end tabular-nums ${
                      s.corrected_amount != null && s.corrected_amount !== s.basis_amount
                        ? 'font-semibold text-amber-700 dark:text-amber-400'
                        : ''
                    }`}
                  >
                    {rupiah(s.corrected_amount)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {/*
                        SIMULASI ditandai lebih dahulu daripada statusnya.
                        Simulasi yang berstatus "dibayar" tidak pernah membayar
                        siapa pun, dan lencana status sendirian membacanya
                        seperti pembayaran sungguhan.
                      */}
                      {s.is_simulation && (
                        <span className="badge inline-flex items-center gap-1 bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                          <FlaskConical className="h-3 w-3" aria-hidden />
                          simulasi
                        </span>
                      )}
                      <span className={`badge ${RUPA_STATUS[s.status]?.kelas ?? ''}`}>
                        {RUPA_STATUS[s.status]?.label ?? s.status}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-sm text-brand-700 hover:underline dark:text-brand-300"
                      onClick={() => setDibuka(s.id === dibuka ? null : s.id)}
                    >
                      {s.id === dibuka ? 'Tutup' : 'Rincian'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dibuka && rinci.data && (
        <div className="card space-y-3 px-4 py-4">
          <h2 className="inline-flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
            <Calculator className="h-4 w-4" aria-hidden />
            <Code>{rinci.data.settlementNumber}</Code>
            {rinci.data.isSimulation && (
              <span className="badge bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                simulasi — tidak pernah membayar siapa pun
              </span>
            )}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 text-start font-medium">Penerima</th>
                  <th className="px-3 py-2 text-start font-medium">Nama</th>
                  <th className="px-3 py-2 text-end font-medium">Bruto</th>
                  <th className="px-3 py-2 text-end font-medium">Pajak</th>
                  <th className="px-3 py-2 text-end font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {rinci.data.lines.map((b, i) => (
                  <tr
                    key={`${b.recipient}-${i}`}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-3 py-2">{LABEL_PENERIMA[b.recipient] ?? b.recipient}</td>
                    <td className="px-3 py-2">{b.provider_name ?? '—'}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{rupiah(b.gross_amount)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{rupiah(b.tax_amount)}</td>
                    <td className="px-3 py-2 text-end font-medium tabular-nums">
                      {rupiah(b.net_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rinci.data.corrections.length > 0 && (
            <div>
              <h3 className="mb-1 inline-flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                Koreksi ({rinci.data.corrections.length})
              </h3>
              {/*
                Koreksi TIDAK menghapus baris aslinya. Keduanya tetap ada, dan
                keduanya ditampilkan — pertanyaan "mengapa bagian saya berubah"
                hanya dapat dijawab bila keduanya masih terlihat.
              */}
              <ul className="space-y-1.5 text-sm">
                {rinci.data.corrections.map((k, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  >
                    {JSON.stringify(k)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
