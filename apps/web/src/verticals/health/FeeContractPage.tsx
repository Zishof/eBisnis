/**
 * Kontrak fee sistem dan investor.
 *
 * ## Gerbang yang menentukan seluruh layar ini
 *
 * > **Fee sistem dan fee investor bernilai NONE sampai ada kontraknya.**
 *
 * Itu bukan kebijakan yang dapat dilonggarkan sementara. Fee yang dipungut
 * tanpa kontrak adalah uang yang diambil dari pendapatan rumah sakit tanpa
 * dasar tertulis — dan yang menemukannya biasanya auditor, bukan yang
 * memungutnya.
 *
 * Karena itu layar ini menampilkan **tiga tahap yang berbeda** dan tidak pernah
 * meringkasnya:
 *
 * ```
 * legal_reviewed_at → sudah ditelaah bagian hukum
 * approved_at       → sudah disetujui
 * status = ACTIVE   → baru sekarang fee-nya berlaku
 * ```
 *
 * Kontrak yang disetujui tanpa telaah hukum lebih berbahaya daripada kontrak
 * yang belum disetujui sama sekali: yang kedua tidak berlaku, yang pertama
 * berlaku tanpa ada yang membaca pasalnya.
 *
 * ## Ringkasan investor sudah disaring, dan penyaringannya ditampilkan
 *
 * Peladen mengembalikan `_filtered`: berapa medan yang **dibuang** karena tidak
 * ada pada daftar putih. Angka itu ditampilkan, bukan disembunyikan — pemegang
 * kontrak investor berhak tahu bahwa ia sedang melihat pandangan yang disaring,
 * dan rumah sakit berhak menunjukkan bahwa penyaringannya bekerja.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSignature, Scale, ShieldCheck } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisKontrakFee } from './health-api';

const LABEL_JENIS: Record<string, string> = {
  SYSTEM_FEE: 'Fee sistem',
  INVESTOR_SHARE: 'Bagi hasil investor',
  MANAGEMENT_FEE: 'Fee manajemen',
  OTHER: 'Lainnya',
};

const RUPA_STATUS: Record<string, { kelas: string; label: string }> = {
  DRAFT: { kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', label: 'Draf' },
  UNDER_LEGAL_REVIEW: {
    kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    label: 'Telaah hukum',
  },
  APPROVED: {
    kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    label: 'Disetujui',
  },
  ACTIVE: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Berlaku',
  },
  TERMINATED: {
    kelas: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    label: 'Berakhir',
  },
  CANCELLED: {
    kelas: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    label: 'Batal',
  },
};

const rupiah = (n: number | null | undefined) =>
  n == null
    ? '—'
    : n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

const tanggal = (t: string | null) => (t ? t.slice(0, 10) : '—');

export function FeeContractPage() {
  const toMessage = useErrorMessage();
  const [tahun, setTahun] = useState(new Date().getFullYear());

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const kontrak = useQuery({
    queryKey: ['health', 'fee-contracts', dipakai],
    queryFn: () => healthApi.feeContracts(dipakai as string),
    enabled: Boolean(dipakai),
  });

  const investor = useQuery({
    queryKey: ['health', 'investor-summary', dipakai, tahun],
    queryFn: () => healthApi.investorSummary(dipakai as string, tahun),
    enabled: Boolean(dipakai),
  });

  const daftar = kontrak.data ?? [];
  const berlaku = daftar.filter((k) => k.status === 'ACTIVE');
  /*
   * Disetujui tanpa telaah hukum. Lebih berbahaya daripada yang belum
   * disetujui sama sekali: yang kedua tidak berlaku, yang pertama berlaku
   * tanpa ada yang membaca pasalnya.
   */
  const tanpaTelaahHukum = daftar.filter((k) => k.approved_at && !k.legal_reviewed_at);

  return (
    <>
      <PageHeader
        title="Kontrak Fee"
        description="Fee sistem dan fee investor bernilai NONE sampai ada kontraknya — dan telaah hukum bukan formalitas yang dapat dilewati."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Kontrak Fee' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-kontrak">
            Fasilitas
          </label>
          <select
            id="fasilitas-kontrak"
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
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Kontrak berlaku</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {berlaku.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Disetujui tanpa telaah hukum
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              tanpaTelaahHukum.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
            }`}
          >
            {tanpaTelaahHukum.length}
          </p>
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          Angka kedua lebih penting daripada tampaknya: kontrak yang belum disetujui tidak berlaku,
          sedangkan kontrak yang disetujui tanpa telaah hukum <em>berlaku</em> tanpa ada yang
          membaca pasalnya.
        </p>
      </div>

      {berlaku.length === 0 && daftar.length >= 0 && (
        <div className="card mb-4 flex items-start gap-2 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Tidak ada kontrak fee yang berlaku pada fasilitas ini, jadi <strong>fee sistem dan fee
            investor bernilai NONE</strong>. Itu keadaan bawaan dan keadaan yang benar — fee yang
            dipungut tanpa kontrak adalah uang yang diambil tanpa dasar tertulis.
          </p>
        </div>
      )}

      {kontrak.isLoading && <LoadingState label="Memuat kontrak fee…" />}
      {kontrak.isError && (
        <ErrorState
          message={toMessage(kontrak.error, (k, f) => f ?? k)}
          onRetry={() => void kontrak.refetch()}
        />
      )}
      {kontrak.data?.length === 0 && (
        <EmptyState
          title="Belum ada kontrak fee"
          description="Tanpa kontrak, tidak ada fee sistem maupun fee investor yang dipungut. Itu bawaannya, bukan kekurangannya."
        />
      )}

      {daftar.length > 0 && (
        <div className="card mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Rujukan</th>
                <th className="px-3 py-2 text-start font-medium">Jenis</th>
                <th className="px-3 py-2 text-start font-medium">Pihak</th>
                <th className="px-3 py-2 text-end font-medium">Batas %</th>
                <th className="px-3 py-2 text-start font-medium">Berlaku</th>
                <th className="px-3 py-2 text-start font-medium">Tahapan</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((k: BarisKontrakFee) => (
                <tr
                  key={k.id}
                  className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                    k.approved_at && !k.legal_reviewed_at ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <Code>{k.contract_reference}</Code>
                  </td>
                  <td className="px-3 py-2">{LABEL_JENIS[k.contract_type] ?? k.contract_type}</td>
                  <td className="px-3 py-2 font-medium">{k.counterparty_name}</td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {k.maximum_percent == null ? '—' : `${Number(k.maximum_percent).toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2">
                    {tanggal(k.effective_from)}
                    {k.effective_to && ` – ${tanggal(k.effective_to)}`}
                  </td>
                  {/*
                    TIGA TAHAP, tidak diringkas. Kontrak yang disetujui tanpa
                    telaah hukum berlaku tanpa ada yang membaca pasalnya, dan
                    satu lencana status tidak dapat menunjukkannya.
                  */}
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {k.legal_reviewed_at ? (
                        <span className="badge inline-flex items-center gap-1 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          <Scale className="h-3 w-3" aria-hidden />
                          telaah hukum
                        </span>
                      ) : (
                        <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                          tanpa telaah hukum
                        </span>
                      )}
                      {k.approved_at && (
                        <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          disetujui
                        </span>
                      )}
                      <span className={`badge ${RUPA_STATUS[k.status]?.kelas ?? ''}`}>
                        {RUPA_STATUS[k.status]?.label ?? k.status}
                      </span>
                      {k.is_sample_data && (
                        <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          data contoh
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

      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
          <FileSignature className="h-4 w-4" aria-hidden />
          Ringkasan bagi pemegang kontrak investor
        </h2>
        <div>
          <label className="field-label" htmlFor="tahun-investor">
            Tahun
          </label>
          <input
            id="tahun-investor"
            className="field-input w-28"
            inputMode="numeric"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value) || new Date().getFullYear())}
          />
        </div>
      </div>

      {investor.data && (
        <div className="card space-y-3 px-4 py-4">
          <dl className="grid gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">Fasilitas</dt>
              <dd className="text-xl font-semibold tabular-nums">{investor.data.facilityCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">
                Pendapatan kotor
              </dt>
              <dd className="text-xl font-semibold tabular-nums">
                {rupiah(investor.data.grossRevenue)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">Distribusi</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {rupiah(investor.data.distributionAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">
                Medan yang disaring
              </dt>
              <dd className="text-xl font-semibold tabular-nums text-sky-700 dark:text-sky-400">
                {investor.data._filtered}
              </dd>
            </div>
          </dl>

          {/*
            Angka `_filtered` DITAMPILKAN, bukan disembunyikan. Pemegang kontrak
            berhak tahu bahwa ia melihat pandangan yang disaring, dan rumah
            sakit berhak menunjukkan bahwa penyaringannya bekerja.
          */}
          {investor.data.note && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{investor.data.note}</p>
          )}
        </div>
      )}
    </>
  );
}
