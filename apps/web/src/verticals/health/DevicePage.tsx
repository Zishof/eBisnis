/**
 * Registri alat medis dan gateway-nya.
 *
 * ## Kendali jarak jauh mati secara bawaan, dan layar mengatakannya
 *
 * `remote_control_enabled` bawaannya `false`, dan `remote_allowed_commands`
 * kosong. Itu bukan kekurangan yang perlu ditutupi — itu keputusan: alat medis
 * menyentuh pasien, dan perintah jarak jauh yang menyala secara bawaan akan
 * menyala pada alat yang tidak seorang pun ingat masih tersambung.
 *
 * Layar ini menampilkan keadaannya apa adanya, dan **menghitung berapa alat yang
 * kendali jarak jauhnya menyala** — angka yang seharusnya nol pada sebagian
 * besar rumah sakit, dan yang perlu ditanyakan bila bukan.
 *
 * Perintah yang diizinkan ditampilkan satu per satu. "Kendali jarak jauh
 * menyala" tanpa daftar perintahnya tidak memberi tahu apakah yang menyala
 * sekadar pembacaan status atau penyetelan dosis.
 *
 * ## Alat yang gagal uji keselamatan
 *
 * Ditandai, dan **tidak dihentikan otomatis**. Alat yang dihentikan sendiri oleh
 * penjadwal berhenti pada saat yang dipilih kalender, bukan pada saat yang
 * dipilih orang yang tahu ada pasien memakainya atau tidak.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Radio, TriangleAlert, WifiOff } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisAlat } from './health-api';

const RUPA_STATUS: Record<string, { kelas: string; label: string }> = {
  ACTIVE: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Melayani',
  },
  MAINTENANCE: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Dirawat',
  },
  QUARANTINED: {
    kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    label: 'Dikarantina',
  },
  RETIRED: {
    kelas: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    label: 'Ditarik',
  },
  REGISTERED: {
    kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    label: 'Terdaftar',
  },
};

const tanggal = (t: string | null) => (t ? t.slice(0, 10) : '—');

export function DevicePage() {
  const toMessage = useErrorMessage();
  const [tab, setTab] = useState<'devices' | 'gateways'>('devices');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const alat = useQuery({
    queryKey: ['health', 'devices', dipakai],
    queryFn: () => healthApi.devices(dipakai as string),
    enabled: Boolean(dipakai),
  });

  const gateway = useQuery({
    queryKey: ['health', 'device-gateways', dipakai],
    queryFn: () => healthApi.deviceGateways(dipakai as string),
    enabled: Boolean(dipakai) && tab === 'gateways',
  });

  const protokol = useQuery({
    queryKey: ['health', 'device-protocols'],
    queryFn: () => healthApi.deviceProtocols(),
  });

  const daftar = alat.data ?? [];
  const kendaliMenyala = daftar.filter((a) => a.remote_control_enabled);
  const kalibrasiLewat = daftar.filter((a) => a.calibration_overdue);
  const protokolTerhalang = (protokol.data ?? []).filter((p) => !p.usable);

  return (
    <>
      <PageHeader
        title="Alat Medis"
        description="Kendali jarak jauh mati secara bawaan — dan berapa yang menyala dihitung, bukan disembunyikan."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Alat Medis' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-alat">
            Fasilitas
          </label>
          <select
            id="fasilitas-alat"
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
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Alat terdaftar</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {daftar.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Kendali jarak jauh menyala
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              kendaliMenyala.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700'
            }`}
          >
            {kendaliMenyala.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Kalibrasi lewat</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              kalibrasiLewat.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'
            }`}
          >
            {kalibrasiLewat.length}
          </p>
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          Angka kedua seharusnya nol pada sebagian besar fasilitas. Bila bukan, pertanyaannya bukan
          &ldquo;siapa yang menyalakannya&rdquo; melainkan &ldquo;perintah apa saja yang
          diizinkan&rdquo; — dan itu ada pada kolomnya.
        </p>
      </div>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Tampilan alat">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'devices'}
          className={tab === 'devices' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('devices')}
        >
          <Cpu className="h-4 w-4" aria-hidden />
          Alat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'gateways'}
          className={tab === 'gateways' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('gateways')}
        >
          <Radio className="h-4 w-4" aria-hidden />
          Gateway
        </button>
      </div>

      {tab === 'devices' && (
        <>
          {alat.isLoading && <LoadingState label="Memuat registri alat…" />}
          {alat.isError && (
            <ErrorState
              message={toMessage(alat.error, (k, f) => f ?? k)}
              onRetry={() => void alat.refetch()}
            />
          )}
          {alat.data?.length === 0 && (
            <EmptyState
              title="Belum ada alat terdaftar"
              description="Alat didaftarkan lebih dahulu, baru disambungkan. Alat yang mengirim data tanpa terdaftar tidak dapat ditelusuri ke siapa pun."
            />
          )}

          {daftar.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Kode</th>
                    <th className="px-3 py-2 text-start font-medium">Nama</th>
                    <th className="px-3 py-2 text-start font-medium">Jenis</th>
                    <th className="px-3 py-2 text-start font-medium">Protokol</th>
                    <th className="px-3 py-2 text-start font-medium">Kalibrasi</th>
                    <th className="px-3 py-2 text-start font-medium">Kendali jarak jauh</th>
                    <th className="px-3 py-2 text-start font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((a: BarisAlat) => (
                    <tr
                      key={a.id}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                        a.remote_control_enabled ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <Code>{a.code}</Code>
                      </td>
                      <td className="px-3 py-2 font-medium">{a.name}</td>
                      <td className="px-3 py-2">{a.device_category}</td>
                      <td className="px-3 py-2">
                        {a.source_protocol ? <Code>{a.source_protocol}</Code> : '—'}
                      </td>
                      <td
                        className={`px-3 py-2 ${
                          a.calibration_overdue ? 'text-amber-700 dark:text-amber-400' : ''
                        }`}
                      >
                        {tanggal(a.calibration_due_at)}
                        {a.calibration_overdue && (
                          <span className="ms-1 text-xs font-medium">lewat</span>
                        )}
                      </td>
                      {/*
                        Perintah yang diizinkan ditampilkan SATU PER SATU.
                        "Kendali jarak jauh menyala" tanpa daftar perintahnya
                        tidak memberi tahu apakah yang menyala sekadar pembacaan
                        status atau penyetelan dosis.
                      */}
                      <td className="px-3 py-2">
                        {a.remote_control_enabled ? (
                          <span className="flex flex-wrap items-center gap-1">
                            <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                              menyala
                            </span>
                            {a.remote_allowed_commands.length === 0 ? (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                tanpa perintah yang diizinkan
                              </span>
                            ) : (
                              a.remote_allowed_commands.map((p) => <Code key={p}>{p}</Code>)
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <WifiOff className="h-3.5 w-3.5" aria-hidden />
                            mati
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`badge ${RUPA_STATUS[a.status]?.kelas ?? ''}`}>
                          {RUPA_STATUS[a.status]?.label ?? a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                Kalibrasi yang lewat <strong>menandai</strong>, tidak menghentikan alatnya. Alat
                yang dihentikan sendiri oleh penjadwal berhenti pada saat yang dipilih kalender,
                bukan pada saat yang dipilih orang yang tahu ada pasien memakainya atau tidak.
              </p>
            </div>
          )}
        </>
      )}

      {tab === 'gateways' && (
        <>
          {gateway.isLoading && <LoadingState label="Memuat gateway…" />}
          {gateway.data?.length === 0 && (
            <EmptyState title="Belum ada gateway terdaftar pada fasilitas ini" />
          )}
          {gateway.data && gateway.data.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Kode</th>
                    <th className="px-3 py-2 text-start font-medium">Nama</th>
                    <th className="px-3 py-2 text-start font-medium">Segmen jaringan</th>
                    <th className="px-3 py-2 text-end font-medium">Alat</th>
                    <th className="px-3 py-2 text-start font-medium">Kredensial</th>
                    <th className="px-3 py-2 text-start font-medium">Terakhir terlihat</th>
                  </tr>
                </thead>
                <tbody>
                  {gateway.data.map((g) => (
                    <tr key={g.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <Code>{g.code}</Code>
                      </td>
                      <td className="px-3 py-2 font-medium">{g.name}</td>
                      <td className="px-3 py-2">
                        {g.network_segment ? <Code>{g.network_segment}</Code> : '—'}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">{g.device_count}</td>
                      <td className="px-3 py-2">
                        {g.has_credential ? (
                          <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            terpasang
                          </span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            belum ada
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{g.last_seen_at?.slice(0, 16) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                Alat berbicara kepada gateway; gateway berbicara kepada sistem. Alat tidak pernah
                menulis langsung ke basis data — sambungan langsung berarti alat yang salah kirim
                merusak rekam medis tanpa satu pun lapisan yang dapat menolaknya.
              </p>
            </div>
          )}
        </>
      )}

      {protokolTerhalang.length > 0 && (
        <div className="card mt-4 flex items-start gap-2 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {protokolTerhalang.length} protokol belum dapat dipakai
            </p>
            <ul className="mt-1 space-y-1">
              {protokolTerhalang.map((p) => (
                <li key={p.code} className="text-slate-600 dark:text-slate-300">
                  <Code>{p.code}</Code> — {p.blockedBy}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
