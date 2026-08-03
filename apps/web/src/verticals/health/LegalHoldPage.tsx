/**
 * Penahanan hukum dan jejak pembacaan rekam medis.
 *
 * Dua hal yang tampak berbeda dan berada pada satu layar dengan sengaja:
 * keduanya menjawab pertanyaan yang sama dari sisi yang berlawanan.
 *
 * ```
 * penahanan  → siapa yang TIDAK BOLEH mengubah berkas ini, dan sampai kapan
 * jejak akses → siapa yang SUDAH MEMBACA berkas ini, dan untuk apa
 * ```
 *
 * Petugas rekam medis yang menerima surat pengadilan menanyakan keduanya dalam
 * satu napas, dan memisahkannya ke dua layar berarti ia harus mencari nomor
 * pasien yang sama dua kali.
 *
 * ## Yang tidak dilakukan layar ini
 *
 * Ia **tidak menyediakan tombol hapus jejak akses**, dan tidak akan pernah.
 * Jejak yang dapat dihapus adalah jejak yang akan dihapus tepat ketika ia
 * paling berguna.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Gavel, Search, ShieldAlert } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, umurDari, TUJUAN_LABEL, type PurposeOfUse, type RingkasPasien } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

const waktu = (t: string | null) => (t ? t.replace('T', ' ').slice(0, 16) : '—');

export function LegalHoldPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [kata, setKata] = useState('');
  const [dicari, setDicari] = useState('');
  const [pasien, setPasien] = useState<RingkasPasien | null>(null);
  const [tahanBaru, setTahanBaru] = useState(false);
  const [alasan, setAlasan] = useState('');
  const [nomorPerkara, setNomorPerkara] = useState('');
  const [diminta, setDiminta] = useState('');
  const [dicabut, setDicabut] = useState<string | null>(null);
  const [alasanCabut, setAlasanCabut] = useState('');

  const pencarian = useQuery({
    queryKey: ['health', 'patients', dicari],
    queryFn: () => healthApi.searchPatients({ q: dicari }, ctx),
    enabled: dicari.length >= 2,
  });
  const hasilCari = pencarian.data?.results ?? [];

  const penahanan = useQuery({
    queryKey: ['health', 'legal-holds', pasien?.id],
    queryFn: () => healthApi.legalHolds(pasien?.id as string, ctx),
    enabled: Boolean(pasien),
  });

  const jejak = useQuery({
    queryKey: ['health', 'access-log', pasien?.id],
    /*
     * TANPA tujuan penggunaan, dan itu bukan kelalaian: jalannya memang tidak
     * menuntutnya. Yang dibaca di sini metadata tentang pembacaan — siapa
     * membaca apa — bukan rekam medisnya sendiri, dan hak HEALTH_ACCESS_LOG.READ
     * yang menjaganya.
     */
    queryFn: () => healthApi.accessLog(pasien?.id as string),
    enabled: Boolean(pasien),
  });

  const tahan = useMutation({
    mutationFn: (body: Record<string, unknown>) => healthApi.placeLegalHold(body, ctx),
    onSuccess: () => {
      toast.push('Penahanan hukum dipasang. Berkasnya kini beku.', 'success');
      setTahanBaru(false);
      setAlasan('');
      setNomorPerkara('');
      setDiminta('');
      void queryClient.invalidateQueries({ queryKey: ['health', 'legal-holds'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const cabut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      healthApi.releaseLegalHold(id, { reason }, ctx),
    onSuccess: () => {
      toast.push('Penahanan dicabut.', 'success');
      setDicabut(null);
      setAlasanCabut('');
      void queryClient.invalidateQueries({ queryKey: ['health', 'legal-holds'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const aktif = (penahanan.data?.holds ?? []).filter((h) => !h.released_at);
  const lampau = (penahanan.data?.holds ?? []).filter((h) => h.released_at);
  const darurat = (jejak.data ?? []).filter((j) => j.break_glass);

  return (
    <>
      <PageHeader
        title="Penahanan Hukum dan Jejak Akses"
        description="Siapa yang tidak boleh mengubah berkas ini, dan siapa yang sudah membacanya."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Penahanan Hukum' }]}
      />

      <PurposeSelector />

      <div className="card mb-4 px-4 py-4">
        <label className="field-label" htmlFor="cari-pasien-penahanan">
          Cari pasien
        </label>
        <div className="flex gap-2">
          <input
            id="cari-pasien-penahanan"
            className="field-input"
            value={kata}
            onChange={(e) => setKata(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setDicari(kata.trim());
            }}
            placeholder="Nama atau nomor rekam medis"
          />
          <button type="button" className="btn-secondary" onClick={() => setDicari(kata.trim())}>
            <Search className="h-4 w-4" aria-hidden />
            Cari
          </button>
        </div>

        {hasilCari.length > 0 && !pasien && (
          <ul className="mt-3 space-y-1">
            {hasilCari.slice(0, 8).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => setPasien(p)}
                >
                  <span className="font-medium">{p.full_name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{umurDari(p.birth_date)}</span>
                  {p.mrn && <Code>{p.mrn}</Code>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pasien && (
        <>
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{pasien.full_name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {umurDari(pasien.birth_date)}
                {pasien.mrn && (
                  <>
                    {' · '}
                    <Code>{pasien.mrn}</Code>
                  </>
                )}
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setPasien(null)}>
              Ganti pasien
            </button>
          </div>

          {/* --- Penahanan hukum ------------------------------------------- */}
          <section className="mb-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                <Gavel className="h-4 w-4" aria-hidden />
                Penahanan hukum
              </h2>
              <button type="button" className="btn-secondary" onClick={() => setTahanBaru((v) => !v)}>
                Pasang penahanan
              </button>
            </div>

            {penahanan.data && (
              <p
                className={`mb-2 rounded-lg px-3 py-2 text-sm ${
                  penahanan.data.canAmend
                    ? 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                }`}
              >
                {penahanan.data.canAmend
                  ? 'Berkas pasien ini masih dapat diubah dan diamandemen.'
                  : (penahanan.data.message ??
                    'Berkas pasien ini BEKU: ada penahanan hukum yang aktif.')}
              </p>
            )}

            {tahanBaru && (
              <div className="card mb-3 space-y-3 px-4 py-4">
                <div>
                  <label className="field-label" htmlFor="alasan-tahan">
                    Alasan penahanan *
                  </label>
                  <textarea
                    id="alasan-tahan"
                    className="field-input min-h-[4rem]"
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    placeholder="Mis. permintaan pengadilan perkara nomor ..., berkas tidak boleh diubah sampai putusan."
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Sekurang-kurangnya 10 huruf. Penahanan membekukan berkas seorang pasien —
                    alasannya akan dibaca orang yang bertanya mengapa berkasnya tidak dapat
                    diperbaiki.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="nomor-perkara">
                      Nomor perkara
                    </label>
                    <input
                      id="nomor-perkara"
                      className="field-input"
                      value={nomorPerkara}
                      onChange={(e) => setNomorPerkara(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="diminta-oleh">
                      Diminta oleh
                    </label>
                    <input
                      id="diminta-oleh"
                      className="field-input"
                      value={diminta}
                      onChange={(e) => setDiminta(e.target.value)}
                      placeholder="Mis. Pengadilan Negeri Bandung"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={tahan.isPending || alasan.trim().length < 10}
                    onClick={() =>
                      tahan.mutate({
                        patientId: pasien.id,
                        reason: alasan,
                        caseReference: nomorPerkara || undefined,
                        requestedBy: diminta || undefined,
                      })
                    }
                  >
                    Pasang
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setTahanBaru(false)}>
                    Batal
                  </button>
                </div>
              </div>
            )}

            {penahanan.isLoading && <LoadingState label="Memuat penahanan…" />}
            {penahanan.isError && (
              <ErrorState
                message={toMessage(penahanan.error, (k, f) => f ?? k)}
                onRetry={() => void penahanan.refetch()}
              />
            )}

            {penahanan.data && aktif.length === 0 && lampau.length === 0 && (
              <EmptyState title="Tidak ada penahanan hukum atas pasien ini" />
            )}

            {aktif.length > 0 && (
              <ul className="space-y-2">
                {aktif.map((h) => (
                  <li key={h.id} className="card border-s-4 border-s-amber-400 px-4 py-3">
                    <p className="text-sm text-slate-800 dark:text-slate-200">{h.reason}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Dipasang {waktu(h.placed_at)}
                      {h.case_reference && (
                        <>
                          {' · perkara '}
                          <Code>{h.case_reference}</Code>
                        </>
                      )}
                    </p>
                    {dicabut === h.id ? (
                      <div className="mt-2 space-y-2">
                        <input
                          className="field-input"
                          value={alasanCabut}
                          onChange={(e) => setAlasanCabut(e.target.value)}
                          placeholder="Alasan pencabutan (min. 5 huruf)"
                          aria-label="Alasan pencabutan"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={cabut.isPending || alasanCabut.trim().length < 5}
                            onClick={() => cabut.mutate({ id: h.id, reason: alasanCabut })}
                          >
                            Cabut penahanan
                          </button>
                          <button type="button" className="btn-ghost" onClick={() => setDicabut(null)}>
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost mt-2"
                        onClick={() => {
                          setDicabut(h.id);
                          setAlasanCabut('');
                        }}
                      >
                        Cabut
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {lampau.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-slate-500 dark:text-slate-400">
                  {lampau.length} penahanan yang sudah dicabut
                </summary>
                <ul className="mt-2 space-y-2">
                  {lampau.map((h) => (
                    <li key={h.id} className="card px-4 py-3 text-sm">
                      <p className="text-slate-700 dark:text-slate-200">{h.reason}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {waktu(h.placed_at)} — dicabut {waktu(h.released_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* --- Jejak akses ------------------------------------------------ */}
          <section>
            <h2 className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
              <Eye className="h-4 w-4" aria-hidden />
              Jejak pembacaan rekam medis
            </h2>

            {darurat.length > 0 && (
              <p className="mb-2 inline-flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {darurat.length} pembacaan memakai akses darurat. Telaahnya ada pada layar{' '}
                <strong>Telaah Darurat</strong>.
              </p>
            )}

            {jejak.isLoading && <LoadingState label="Memuat jejak akses…" />}
            {jejak.data?.length === 0 && (
              <EmptyState
                title="Belum ada pembacaan tercatat"
                description="Setiap pembacaan rekam medis dicatat sejak H-2 — termasuk pembacaan yang tidak mengubah apa pun."
              />
            )}

            {jejak.data && jejak.data.length > 0 && (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-800">
                    <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2 text-start font-medium">Waktu</th>
                      <th className="px-3 py-2 text-start font-medium">Tujuan</th>
                      <th className="px-3 py-2 text-start font-medium">Tindakan</th>
                      <th className="px-3 py-2 text-start font-medium">Bagian</th>
                      <th className="px-3 py-2 text-start font-medium">Darurat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jejak.data.map((j) => (
                      <tr
                        key={j.id}
                        className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                          j.break_glass ? 'bg-rose-50/50 dark:bg-rose-950/30' : ''
                        }`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">{waktu(j.occurred_at)}</td>
                        <td className="px-3 py-2">
                          {TUJUAN_LABEL[j.purpose_of_use as PurposeOfUse] ?? j.purpose_of_use}
                        </td>
                        <td className="px-3 py-2">
                          <Code>{j.action}</Code>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {j.entity_type ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {j.break_glass ? (
                            <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                              {j.break_glass_reason ?? 'darurat'}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/*
                  TIDAK ADA tombol hapus di sini, dan tidak akan pernah ada.
                  Jejak yang dapat dihapus adalah jejak yang akan dihapus tepat
                  ketika ia paling berguna.
                */}
                <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  Jejak ini tidak dapat dihapus dari layar mana pun. Membuka layar ini pun
                  tercatat sebagai pembacaan.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
