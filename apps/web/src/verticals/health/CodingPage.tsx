/**
 * Pengkodean rekam medis dan kekurangan berkas.
 *
 * ## Dua daftar, dan keduanya ditujukan kepada orang yang berbeda
 *
 * **Daftar kerja pengkodean** ditujukan kepada petugas koding: berkas mana yang
 * menunggu dikode, diurutkan menurut berapa banyak kekurangan yang
 * **menghalangi** — bukan menurut tanggal.
 *
 * **Kekurangan berkas** ditujukan kepada dokter atau perawat yang harus
 * melengkapinya: pekerjaannya sendiri, disebut satu per satu.
 *
 * Menggabungkan keduanya menjadi satu angka kelengkapan adalah cara paling
 * pasti membuat keduanya tidak dikerjakan. "Kelengkapan 87%" tidak memberi tahu
 * dokter mana pun berkas siapa yang harus ditandatanganinya sore ini.
 *
 * ## Yang menghalangi dibedakan dari yang tidak
 *
 * `blocks_coding` menentukan warna dan urutan. Kekurangan yang menghalangi
 * menahan tagihannya; yang tidak menghalangi sekadar menunggu. Menyamakan
 * keduanya membuat petugas mengejar yang mudah lebih dahulu, dan yang menahan
 * uang rumah sakit justru mengendap.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, FileWarning } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisKekurangan, type BarisKoding } from './health-api';

const PERAN = [
  { kode: 'DOCTOR', label: 'Dokter' },
  { kode: 'NURSE', label: 'Perawat' },
  { kode: 'CODER', label: 'Petugas Koding' },
  { kode: 'PHARMACIST', label: 'Apoteker' },
];

const LABEL_STATUS_KODING: Record<string, { teks: string; kelas: string }> = {
  PENDING: {
    teks: 'Menunggu',
    kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  IN_CODING: {
    teks: 'Sedang dikode',
    kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  },
  CODED: {
    teks: 'Sudah dikode',
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  },
  RETURNED: {
    teks: 'Dikembalikan',
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  },
};

export function CodingPage() {
  const toMessage = useErrorMessage();
  const [tab, setTab] = useState<'worklist' | 'deficiencies'>('worklist');
  const [peran, setPeran] = useState('DOCTOR');
  const [status, setStatus] = useState('');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const kerja = useQuery({
    queryKey: ['health', 'coding-worklist', dipakai, status],
    queryFn: () => healthApi.codingWorklist(dipakai as string, status || undefined),
    enabled: Boolean(dipakai) && tab === 'worklist',
  });

  const kurang = useQuery({
    queryKey: ['health', 'deficiencies', dipakai, peran],
    queryFn: () => healthApi.deficiencies(dipakai as string, peran),
    enabled: Boolean(dipakai) && tab === 'deficiencies',
  });

  const menghalangi = (kurang.data ?? []).filter((d) => d.blocks_coding);
  const tidakMenghalangi = (kurang.data ?? []).filter((d) => !d.blocks_coding);

  return (
    <>
      <PageHeader
        title="Pengkodean Rekam Medis"
        description="Berkas yang menunggu dikode, dan kekurangan yang harus dilengkapi — dua daftar untuk dua orang yang berbeda."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pengkodean' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-koding">
            Fasilitas
          </label>
          <select
            id="fasilitas-koding"
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

        {tab === 'worklist' ? (
          <div>
            <label className="field-label" htmlFor="status-koding">
              Status
            </label>
            <select
              id="status-koding"
              className="field-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Semua</option>
              {Object.entries(LABEL_STATUS_KODING).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.teks}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="field-label" htmlFor="peran-kekurangan">
              Kekurangan milik
            </label>
            <select
              id="peran-kekurangan"
              className="field-input"
              value={peran}
              onChange={(e) => setPeran(e.target.value)}
            >
              {PERAN.map((p) => (
                <option key={p.kode} value={p.kode}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Tampilan pengkodean">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'worklist'}
          className={tab === 'worklist' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('worklist')}
        >
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          Daftar kerja koding
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'deficiencies'}
          className={tab === 'deficiencies' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('deficiencies')}
        >
          <FileWarning className="h-4 w-4" aria-hidden />
          Kekurangan berkas
        </button>
      </div>

      {tab === 'worklist' && (
        <>
          {kerja.isLoading && <LoadingState label="Memuat daftar kerja…" />}
          {kerja.isError && (
            <ErrorState
              message={toMessage(kerja.error, (k, f) => f ?? k)}
              onRetry={() => void kerja.refetch()}
            />
          )}
          {kerja.data?.length === 0 && (
            <EmptyState
              title="Tidak ada berkas yang menunggu dikode"
              description="Seluruh berkas pada fasilitas ini sudah dikode atau belum sampai tahap pengkodean."
            />
          )}
          {kerja.data && kerja.data.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Pasien</th>
                    <th className="px-3 py-2 text-start font-medium">Tanggal layanan</th>
                    <th className="px-3 py-2 text-start font-medium">Jenis</th>
                    <th className="px-3 py-2 text-start font-medium">Status</th>
                    <th className="px-3 py-2 text-end font-medium">Menghalangi</th>
                    <th className="px-3 py-2 text-end font-medium">Kekurangan</th>
                  </tr>
                </thead>
                <tbody>
                  {kerja.data.map((r: BarisKoding) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-3 py-2 font-medium">{r.patient_name}</td>
                      <td className="px-3 py-2">{r.service_date ?? '—'}</td>
                      <td className="px-3 py-2">{r.encounter_type ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`badge ${LABEL_STATUS_KODING[r.status]?.kelas ?? ''}`}>
                          {LABEL_STATUS_KODING[r.status]?.teks ?? r.status}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 text-end font-semibold tabular-nums ${
                          r.blocking_count > 0
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {r.blocking_count}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums text-slate-600 dark:text-slate-300">
                        {r.open_deficiencies}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                Diurutkan menurut jumlah kekurangan yang MENGHALANGI, bukan menurut tanggal.
                Kekurangan yang menghalangi menahan tagihannya; yang tidak, sekadar menunggu.
              </p>
            </div>
          )}
        </>
      )}

      {tab === 'deficiencies' && (
        <>
          {kurang.isLoading && <LoadingState label="Memuat kekurangan…" />}
          {kurang.isError && (
            <ErrorState
              message={toMessage(kurang.error, (k, f) => f ?? k)}
              onRetry={() => void kurang.refetch()}
            />
          )}
          {kurang.data?.length === 0 && (
            <EmptyState
              title="Tidak ada kekurangan untuk peran ini"
              description="Layar ini menampilkan pekerjaan yang harus dilengkapi peran terpilih — bukan angka kelengkapan fasilitas."
            />
          )}

          {menghalangi.length > 0 && (
            <section className="mb-4">
              <h2 className="mb-2 font-medium text-rose-800 dark:text-rose-300">
                Menghalangi pengkodean ({menghalangi.length})
              </h2>
              <ul className="space-y-2">
                {menghalangi.map((d: BarisKekurangan) => (
                  <li key={d.id} className="card border-s-4 border-s-rose-400 px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {d.patient_name}{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        · {d.service_date ?? '—'}
                      </span>
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{d.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      <Code>{d.deficiency_type}</Code>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tidakMenghalangi.length > 0 && (
            <section>
              <h2 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
                Tidak menghalangi ({tidakMenghalangi.length})
              </h2>
              <ul className="space-y-2">
                {tidakMenghalangi.map((d: BarisKekurangan) => (
                  <li key={d.id} className="card px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {d.patient_name}{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        · {d.service_date ?? '—'}
                      </span>
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{d.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      <Code>{d.deficiency_type}</Code>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
