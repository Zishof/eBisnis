/**
 * Adapter alat: protokol, pesan masuk, dan pemetaan kode.
 *
 * ## Protokol yang belum siap disebut beserta sebabnya
 *
 * DICOM terhalang arsitektur PACS — menyimpan berkas DICOM utuh pada basis data
 * relasional adalah keputusan yang tidak dapat ditarik kembali. Layar ini
 * menampilkan sebab itu apa adanya, bukan meringkasnya menjadi "belum
 * tersedia".
 *
 * Perbedaan `ready` dan `hasParser` juga ditampilkan terpisah: protokol yang
 * siap tetapi belum punya pengurai dapat menerima pesan dan menyimpannya, tetapi
 * belum dapat membacanya. Petugas yang melihat "siap" tanpa mengetahui itu akan
 * mengira hasilnya sudah masuk ke rekam medis.
 *
 * ## Pemetaan kode yang menunggu diurut menurut yang paling sering
 *
 * Peladen mengurutkannya begitu, dan sebabnya ditulis pada catatannya: kode yang
 * muncul tiga ratus kali sehari menahan tiga ratus hasil; kode yang muncul
 * sekali mungkin salah ketik pada alatnya.
 *
 * Layar ini tidak mengurutkan ulang.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cable, ListTree, MessageSquare } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi } from './health-api';

export function DeviceAdapterPage() {
  const toMessage = useErrorMessage();
  const [tab, setTab] = useState<'protocols' | 'messages' | 'codemap'>('protocols');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const protokol = useQuery({
    queryKey: ['health', 'adapter-protocols'],
    queryFn: () => healthApi.adapterProtocols(),
  });

  const pesan = useQuery({
    queryKey: ['health', 'adapter-messages', dipakai],
    queryFn: () => healthApi.adapterMessages(dipakai as string),
    enabled: Boolean(dipakai) && tab === 'messages',
  });

  const menunggu = useQuery({
    queryKey: ['health', 'code-map-pending', dipakai],
    queryFn: () => healthApi.codeMapPending(dipakai as string),
    enabled: Boolean(dipakai) && tab === 'codemap',
  });

  const daftarProtokol = protokol.data?.protocols ?? [];
  const belumSiap = daftarProtokol.filter((p) => !p.ready);
  const siapTanpaPengurai = daftarProtokol.filter((p) => p.ready && !p.hasParser);

  return (
    <>
      <PageHeader
        title="Adapter Alat"
        description="Protokol yang belum siap disebut beserta sebabnya — dan 'siap' tidak sama dengan 'dapat dibaca'."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Adapter Alat' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-adapter">
            Fasilitas
          </label>
          <select
            id="fasilitas-adapter"
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
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Belum siap</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              belumSiap.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
            }`}
          >
            {belumSiap.length}
          </p>
        </div>
        {/*
          Angka kedua yang paling mudah terlewat: protokol yang SIAP tetapi
          belum punya pengurai. Ia menerima pesan dan menyimpannya, tetapi belum
          dapat membacanya — dan petugas yang melihat "siap" akan mengira
          hasilnya sudah masuk ke rekam medis.
        */}
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Siap, belum ada pengurai
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              siapTanpaPengurai.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'
            }`}
          >
            {siapTanpaPengurai.length}
          </p>
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          Protokol yang siap tanpa pengurai dapat <em>menerima</em> pesan tetapi belum dapat
          <em> membacanya</em>. Hasilnya tersimpan, dan tidak sampai ke rekam medis.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Tampilan adapter">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'protocols'}
          className={tab === 'protocols' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('protocols')}
        >
          <Cable className="h-4 w-4" aria-hidden />
          Protokol
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'messages'}
          className={tab === 'messages' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('messages')}
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          Pesan alat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'codemap'}
          className={tab === 'codemap' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('codemap')}
        >
          <ListTree className="h-4 w-4" aria-hidden />
          Pemetaan kode
        </button>
      </div>

      {tab === 'protocols' && (
        <>
          {protokol.isLoading && <LoadingState label="Memuat protokol…" />}
          {protokol.isError && (
            <ErrorState
              message={toMessage(protokol.error, (k, f) => f ?? k)}
              onRetry={() => void protokol.refetch()}
            />
          )}
          {daftarProtokol.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Protokol</th>
                    <th className="px-3 py-2 text-start font-medium">Siap</th>
                    <th className="px-3 py-2 text-start font-medium">Pengurai</th>
                    <th className="px-3 py-2 text-start font-medium">Penghalang</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarProtokol.map((p) => (
                    <tr
                      key={p.code}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                        !p.ready ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <Code>{p.code}</Code>
                      </td>
                      <td className="px-3 py-2">
                        {p.ready ? (
                          <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            siap
                          </span>
                        ) : (
                          <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                            belum
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.hasParser ? (
                          <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            ada
                          </span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            belum ada
                          </span>
                        )}
                      </td>
                      {/* Sebabnya APA ADANYA, bukan diringkas jadi "belum tersedia". */}
                      <td className="px-3 py-2 text-rose-800 dark:text-rose-300">
                        {p.blockedBy ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {protokol.data?.note && (
                <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {protokol.data.note}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'messages' && (
        <>
          {pesan.isLoading && <LoadingState label="Memuat pesan alat…" />}
          {pesan.data?.length === 0 && (
            <EmptyState
              title="Belum ada pesan alat tercatat"
              description="Pesan mentah disimpan apa adanya sebelum diurai — supaya yang gagal terurai tetap dapat diperiksa orang."
            />
          )}
          {pesan.data && pesan.data.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Diterima</th>
                    <th className="px-3 py-2 text-start font-medium">Protokol</th>
                    <th className="px-3 py-2 text-start font-medium">Jenis</th>
                    <th className="px-3 py-2 text-end font-medium">Observasi</th>
                    <th className="px-3 py-2 text-start font-medium">Penguraian</th>
                  </tr>
                </thead>
                <tbody>
                  {pesan.data.map((m) => (
                    <tr
                      key={m.id}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                        m.parse_status === 'FAILED' ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2">{m.received_at?.slice(0, 16) ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Code>{m.source_protocol}</Code>
                      </td>
                      <td className="px-3 py-2">{m.message_type ?? '—'}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{m.observation_count}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`badge ${
                            m.parse_status === 'PARSED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                              : m.parse_status === 'FAILED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                          }`}
                        >
                          {m.parse_status}
                        </span>
                        {/*
                          Temuan penguraian ditampilkan APA ADANYA. Pesan yang
                          gagal terurai disimpan mentah supaya masih dapat
                          diperiksa orang — dan temuannya satu-satunya petunjuk
                          mengapa hasilnya tidak sampai ke rekam medis.
                        */}
                        {/*
                          `Boolean(...)`, bukan `m.parse_findings &&`. Medannya
                          bertipe `unknown`, dan nilai jatuh sebuah `&&`
                          bertipe sama dengan operan kirinya — sehingga React
                          diminta merender `unknown`. Galat kompilasi yang
                          bermanfaat: ia menolak tepat pada tempat yang akan
                          melempar saat dijalankan.
                        */}
                        {Boolean(m.parse_findings) && (
                          <span className="mt-0.5 block text-xs text-rose-800 dark:text-rose-300">
                            {typeof m.parse_findings === 'string'
                              ? m.parse_findings
                              : JSON.stringify(m.parse_findings)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'codemap' && (
        <>
          {menunggu.isLoading && <LoadingState label="Memuat pemetaan yang menunggu…" />}
          {menunggu.data?.items.length === 0 && (
            <EmptyState
              title="Tidak ada kode alat yang menunggu dipetakan"
              description="Setiap kode yang dikirim alat sudah punya padanan pada terminologi resmi."
            />
          )}
          {menunggu.data && menunggu.data.items.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Kode alat</th>
                    <th className="px-3 py-2 text-start font-medium">Satuan</th>
                    <th className="px-3 py-2 text-start font-medium">Contoh nilai</th>
                    <th className="px-3 py-2 text-end font-medium">Kemunculan</th>
                    <th className="px-3 py-2 text-start font-medium">Pertama terlihat</th>
                  </tr>
                </thead>
                <tbody>
                  {menunggu.data.items.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <Code>{m.device_code}</Code>
                      </td>
                      <td className="px-3 py-2">{m.device_unit ?? '—'}</td>
                      <td className="px-3 py-2">{m.sample_value ?? '—'}</td>
                      <td className="px-3 py-2 text-end font-semibold tabular-nums">
                        {m.occurrence_count}
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                        {m.first_seen_at?.slice(0, 10) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/*
                Catatan peladen ditampilkan apa adanya — ia menerangkan urutan,
                dan layar ini TIDAK mengurutkan ulang.
              */}
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                {menunggu.data.note}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
