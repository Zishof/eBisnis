/**
 * BPJS: kemampuan adapter, akun, kepesertaan, dan SEP.
 *
 * ## Layar yang tugas utamanya MENGATAKAN APA YANG BELUM ADA
 *
 * Hampir seluruh adapter BPJS berstatus `BLOCKED`, dan sebabnya sama:
 * kredensial belum ada. Itu bukan cacat yang perlu disembunyikan — itu keadaan
 * sesungguhnya, dan menyembunyikannya jauh lebih berbahaya.
 *
 * Layar yang menampilkan tombol "Cek kepesertaan" yang selalu gagal akan
 * ditekan petugas pendaftaran puluhan kali sehari di depan pasien yang
 * menunggu. Layar yang berkata *"adapter VClaim belum punya kredensial; yang
 * dapat dilakukan sekarang adalah mencatat nomor kartunya"* membuat petugas
 * berhenti mencoba dan mulai bekerja.
 *
 * Karena itu penghalang (`blocker`) ditampilkan besar dan apa adanya, bukan
 * diringkas menjadi lencana merah.
 *
 * ## Yang TETAP dapat dikerjakan tanpa kredensial
 *
 * Pencatatan lokal: nomor kartu, kelas hak, nomor SEP yang diterbitkan lewat
 * jalan lain. Itu disebutkan di layar supaya jelas bahwa tidak adanya sambungan
 * bukan berarti tidak ada pekerjaan.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlugZap, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi } from './health-api';

const RUPA_STATUS_ADAPTER: Record<string, { kelas: string; label: string }> = {
  BLOCKED: {
    kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    label: 'Terhalang',
  },
  CONFIGURED: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Terkonfigurasi',
  },
  VERIFIED: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Terverifikasi',
  },
  ACTIVE: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Aktif',
  },
};

export function BpjsPage() {
  const toMessage = useErrorMessage();

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const katalog = useQuery({
    queryKey: ['health', 'bpjs-catalog'],
    queryFn: () => healthApi.bpjsCatalog(),
  });

  const adapter = useQuery({
    queryKey: ['health', 'bpjs-adapters', dipakai],
    queryFn: () => healthApi.bpjsAdapters(dipakai as string),
    enabled: Boolean(dipakai),
  });

  const sep = useQuery({
    queryKey: ['health', 'bpjs-sep', dipakai],
    queryFn: () => healthApi.bpjsSep(dipakai as string),
    enabled: Boolean(dipakai),
  });

  const daftarAdapter = adapter.data?.items ?? [];
  const terhalang = daftarAdapter.filter((a) => a.status === 'BLOCKED');

  return (
    <>
      <PageHeader
        title="BPJS / JKN"
        description="Yang belum tersambung disebutkan apa adanya, beserta apa yang tetap dapat dikerjakan tanpanya."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'BPJS' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-bpjs">
            Fasilitas
          </label>
          <select
            id="fasilitas-bpjs"
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
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Adapter terhalang</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              terhalang.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700'
            }`}
          >
            {terhalang.length}
            <span className="text-base font-normal text-slate-400"> / {daftarAdapter.length}</span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">SEP tercatat</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {sep.data?.length ?? 0}
          </p>
        </div>
      </div>

      {terhalang.length > 0 && (
        <div className="card mb-4 flex items-start gap-2 border-s-4 border-s-amber-400 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              Sebagian besar sambungan BPJS belum aktif — dan itu keadaan sesungguhnya, bukan galat.
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Yang <strong>tetap dapat dikerjakan</strong> tanpa kredensial: mencatat nomor kartu
              peserta, kelas hak, dan nomor SEP yang diterbitkan lewat jalan lain. Klaim tetap dapat
              disusun dan diverifikasi; yang belum dapat dilakukan hanyalah mengirimkannya secara
              otomatis.
            </p>
          </div>
        </div>
      )}

      <h2 className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
        <PlugZap className="h-4 w-4" aria-hidden />
        Kemampuan adapter
      </h2>

      {adapter.isLoading && <LoadingState label="Memuat kemampuan adapter…" />}
      {adapter.isError && (
        <ErrorState
          message={toMessage(adapter.error, (k, f) => f ?? k)}
          onRetry={() => void adapter.refetch()}
        />
      )}
      {adapter.data && daftarAdapter.length === 0 && (
        <EmptyState title="Belum ada adapter terdaftar pada fasilitas ini" />
      )}

      {daftarAdapter.length > 0 && (
        <ul className="mb-6 space-y-2" aria-label="Kemampuan adapter BPJS">
          {daftarAdapter.map((a) => (
            <li key={a.id} className="card px-4 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <Code>{a.adapterCode}</Code>
                <span className={`badge ${RUPA_STATUS_ADAPTER[a.status]?.kelas ?? ''}`}>
                  {RUPA_STATUS_ADAPTER[a.status]?.label ?? a.status}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-300">{a.scope}</span>
              </p>
              {/*
                Penghalang ditampilkan APA ADANYA, tidak diringkas menjadi
                lencana merah. Petugas yang tahu "kredensial belum ada" berhenti
                mencoba; petugas yang hanya melihat merah akan mencoba lagi
                besok, dan besoknya lagi.
              */}
              {a.blocker && (
                <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">{a.blocker}</p>
              )}
              {a.verifiedAt && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Diverifikasi {a.verifiedAt.slice(0, 10)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {katalog.data && (
        <>
          <h2 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
            Cakupan tiap adapter
          </h2>
          <div className="card mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 text-start font-medium">Adapter</th>
                  <th className="px-3 py-2 text-start font-medium">Cakupan</th>
                  <th className="px-3 py-2 text-start font-medium">Penghalang</th>
                </tr>
              </thead>
              <tbody>
                {katalog.data.adapters.map((a) => (
                  <tr key={a.kode} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-3 py-2">
                      <Code>{a.kode}</Code>
                    </td>
                    <td className="px-3 py-2">{a.cakupan}</td>
                    <td className="px-3 py-2 text-rose-800 dark:text-rose-300">{a.penghalang}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {katalog.data.note && (
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">{katalog.data.note}</p>
          )}
        </>
      )}

      <h2 className="mb-2 font-medium text-slate-900 dark:text-slate-100">SEP tercatat</h2>
      {sep.data?.length === 0 && (
        <EmptyState
          title="Belum ada SEP tercatat"
          description="SEP dapat dicatat secara lokal sekalipun adapter VClaim belum tersambung — nomornya diterbitkan lewat jalan lain, dan pencatatannya tetap diperlukan klaim."
        />
      )}
      {sep.data && sep.data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Nomor SEP</th>
                <th className="px-3 py-2 text-start font-medium">Pasien</th>
                <th className="px-3 py-2 text-start font-medium">Jenis</th>
                <th className="px-3 py-2 text-start font-medium">Tanggal</th>
                <th className="px-3 py-2 text-start font-medium">Kelas</th>
                <th className="px-3 py-2 text-start font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sep.data.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-3 py-2">
                    <Code>{s.sep_number}</Code>
                  </td>
                  <td className="px-3 py-2 font-medium">{s.patient_name}</td>
                  <td className="px-3 py-2">{s.service_type ?? '—'}</td>
                  <td className="px-3 py-2">{s.sep_date?.slice(0, 10) ?? '—'}</td>
                  {/*
                    Kelas hak dan kelas yang ditempati ditampilkan BERSAMA.
                    Selisihnya adalah naik kelas — sah dan lazim, tetapi ia
                    mengubah siapa yang membayar selisihnya, dan pada layar yang
                    hanya menampilkan satu kolom kelas ia tidak terlihat sama
                    sekali sampai klaimnya ditolak.
                  */}
                  <td className="px-3 py-2">
                    {s.benefit_class === s.occupied_class ? (
                      <Code>{s.benefit_class ?? '—'}</Code>
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <Code>{s.benefit_class ?? '—'}</Code>
                        <span aria-hidden>→</span>
                        <Code>{s.occupied_class ?? '—'}</Code>
                        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          naik kelas
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{s.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
