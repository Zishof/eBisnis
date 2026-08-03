/**
 * Ruang kerja kunjungan: catatan klinis, tanda vital, diagnosis, dan order.
 *
 * Satu keputusan tampilan menentukan seluruh halaman ini: **tanda tangan
 * diperlakukan sebagai tindakan yang tidak dapat ditarik kembali**, dan
 * layarnya mengatakannya sebelum ditekan, bukan sesudah.
 *
 * Catatan yang sudah ditandatangani ditampilkan terkunci beserta amandemennya,
 * berurutan, sehingga pembaca melihat apa yang semula ditulis dan apa yang
 * kemudian dikoreksi — bukan hanya versi terakhirnya.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileSignature, Lock, Pencil, Stethoscope } from 'lucide-react';
import { Code, ErrorState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type CatatanKlinis } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

export function EncounterPage() {
  const { id } = useParams<{ id: string }>();
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [amandemenUntuk, setAmandemenUntuk] = useState<string | null>(null);
  const [alasanAmandemen, setAlasanAmandemen] = useState('');
  const [vital, setVital] = useState({
    systolicMmhg: '',
    diastolicMmhg: '',
    pulseBpm: '',
    temperatureC: '',
    spo2Percent: '',
  });
  const [diagnosis, setDiagnosis] = useState({ code: '', description: '', diagnosisRole: 'PRIMARY' });
  const [order, setOrder] = useState({ orderType: 'LABORATORY', orderName: '' });

  const kunjungan = useQuery({
    queryKey: ['health', 'encounter', id, ctx.purpose],
    queryFn: () => healthApi.encounter(id as string, ctx),
    enabled: Boolean(id),
  });

  const segarkan = () => void queryClient.invalidateQueries({ queryKey: ['health', 'encounter', id] });
  const gagal = (e: unknown) => toast.push(toMessage(e, (k, f) => f ?? k), 'error');

  const simpanCatatan = useMutation({
    mutationFn: (tandatangani: boolean) =>
      healthApi.saveNote({ encounterId: id, ...soap, sign: tandatangani }, ctx),
    onSuccess: (h) => {
      toast.push(h.signed ? 'Catatan ditandatangani dan terkunci.' : 'Draf catatan tersimpan.', 'success');
      setSoap({ subjective: '', objective: '', assessment: '', plan: '' });
      segarkan();
    },
    onError: gagal,
  });

  const amandemen = useMutation({
    mutationFn: () =>
      healthApi.amendNote(amandemenUntuk as string, { ...soap, reason: alasanAmandemen }, ctx),
    onSuccess: () => {
      toast.push('Amandemen tersimpan. Catatan asli tetap terbaca.', 'success');
      setAmandemenUntuk(null);
      setAlasanAmandemen('');
      setSoap({ subjective: '', objective: '', assessment: '', plan: '' });
      segarkan();
    },
    onError: gagal,
  });

  const simpanVital = useMutation({
    mutationFn: () =>
      healthApi.saveVitals(
        {
          encounterId: id,
          ...Object.fromEntries(
            Object.entries(vital)
              .filter(([, v]) => v !== '')
              .map(([k, v]) => [k, Number(v)]),
          ),
        },
        ctx,
      ),
    onSuccess: () => {
      toast.push('Tanda vital tersimpan.', 'success');
      setVital({ systolicMmhg: '', diastolicMmhg: '', pulseBpm: '', temperatureC: '', spo2Percent: '' });
      segarkan();
    },
    onError: gagal,
  });

  const simpanDiagnosis = useMutation({
    mutationFn: () => healthApi.saveDiagnosis({ encounterId: id, ...diagnosis }, ctx),
    onSuccess: () => {
      toast.push('Diagnosis tersimpan.', 'success');
      setDiagnosis({ code: '', description: '', diagnosisRole: 'SECONDARY' });
      segarkan();
    },
    onError: gagal,
  });

  const simpanOrder = useMutation({
    mutationFn: () => healthApi.saveOrder({ encounterId: id, ...order }, ctx),
    onSuccess: (h) => {
      toast.push(`Order ${h.orderNumber} dibuat.`, 'success');
      setOrder({ orderType: 'LABORATORY', orderName: '' });
      segarkan();
    },
    onError: gagal,
  });

  const selesaikan = useMutation({
    mutationFn: () => healthApi.completeEncounter(id as string, 'HOME'),
    onSuccess: () => {
      toast.push('Kunjungan diselesaikan.', 'success');
      segarkan();
    },
    onError: gagal,
  });

  if (kunjungan.isError) {
    return (
      <ErrorState
        message={toMessage(kunjungan.error, (k, f) => f ?? k)}
        onRetry={() => void kunjungan.refetch()}
      />
    );
  }

  const data = kunjungan.data;
  const enc = (data?.encounter ?? {}) as Record<string, string>;
  const selesai = enc.status === 'COMPLETED';

  /** Catatan tersusun sebagai rantai: yang asli lebih dahulu, amandemennya menyusul. */
  const rantai = (data?.notes ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <>
      <PageHeader
        title="Kunjungan"
        description={enc.encounter_number ? `Nomor ${enc.encounter_number}` : 'Memuat…'}
        breadcrumbs={[{ label: 'eMedik' }, { label: 'Kunjungan' }]}
        actions={
          <>
            <PurposeSelector />
            {!selesai && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => selesaikan.mutate()}
                disabled={selesaikan.isPending}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Selesaikan kunjungan
              </button>
            )}
          </>
        }
      />

      {selesai && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
          Kunjungan ini sudah diselesaikan.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* --- Catatan klinis -------------------------------------------- */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Stethoscope className="h-4 w-4" aria-hidden />
            Catatan klinis
          </h2>

          {rantai.length > 0 && (
            <ol className="mb-4 space-y-3">
              {rantai.map((n: CatatanKlinis) => (
                <li
                  key={n.id}
                  className={
                    n.amended_from_id
                      ? 'card border-s-4 border-s-amber-400 p-4'
                      : 'card p-4'
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {n.amended_from_id ? 'Amandemen' : n.note_type}
                    </span>
                    {n.signed_at ? (
                      <span className="badge flex items-center gap-1 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        <Lock className="h-3 w-3" aria-hidden />
                        Ditandatangani — terkunci
                      </span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        Draf
                      </span>
                    )}
                  </div>

                  {n.amendment_reason && (
                    <p className="mt-2 text-xs italic text-amber-800 dark:text-amber-200">
                      Alasan amandemen: {n.amendment_reason}
                    </p>
                  )}

                  <dl className="mt-2 space-y-1 text-sm">
                    {n.subjective && (
                      <div><dt className="inline font-medium">S: </dt><dd className="inline">{n.subjective}</dd></div>
                    )}
                    {n.objective && (
                      <div><dt className="inline font-medium">O: </dt><dd className="inline">{n.objective}</dd></div>
                    )}
                    {n.assessment && (
                      <div><dt className="inline font-medium">A: </dt><dd className="inline">{n.assessment}</dd></div>
                    )}
                    {n.plan && (
                      <div><dt className="inline font-medium">P: </dt><dd className="inline">{n.plan}</dd></div>
                    )}
                  </dl>

                  {n.signed_at && !selesai && (
                    <button
                      type="button"
                      className="btn-ghost mt-2 py-1 text-xs"
                      onClick={() => {
                        setAmandemenUntuk(n.id);
                        setSoap({
                          subjective: n.subjective ?? '',
                          objective: n.objective ?? '',
                          assessment: n.assessment ?? '',
                          plan: n.plan ?? '',
                        });
                      }}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      Buat amandemen
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}

          {!selesai && (
            <div className="card p-4">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                {amandemenUntuk ? 'Amandemen catatan' : 'Catatan baru'}
              </h3>

              {(['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => (
                <div key={k} className="mt-3">
                  <label className="field-label" htmlFor={`soap-${k}`}>
                    {{ subjective: 'Subjektif', objective: 'Objektif', assessment: 'Penilaian', plan: 'Rencana' }[k]}
                  </label>
                  <textarea
                    id={`soap-${k}`}
                    className="field-input min-h-[4rem]"
                    value={soap[k]}
                    onChange={(e) => setSoap({ ...soap, [k]: e.target.value })}
                  />
                </div>
              ))}

              {amandemenUntuk && (
                <div className="mt-3">
                  <label className="field-label" htmlFor="alasan-amandemen">
                    Alasan amandemen *
                  </label>
                  <input
                    id="alasan-amandemen"
                    className="field-input"
                    value={alasanAmandemen}
                    onChange={(e) => setAlasanAmandemen(e.target.value)}
                    placeholder="Contoh: Koreksi diagnosis setelah hasil pemeriksaan lanjutan."
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Sekurang-kurangnya sepuluh huruf. Perubahan catatan medis tanpa alasan tidak
                    dapat dibedakan dari penyembunyian.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {amandemenUntuk ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => { setAmandemenUntuk(null); setAlasanAmandemen(''); }}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={alasanAmandemen.trim().length < 10 || amandemen.isPending}
                      onClick={() => amandemen.mutate()}
                    >
                      Simpan amandemen
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => simpanCatatan.mutate(false)}
                      disabled={simpanCatatan.isPending}
                    >
                      Simpan draf
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        // Peringatan diberikan SEBELUM, bukan sesudah.
                        if (
                          window.confirm(
                            'Menandatangani catatan ini mengunci isinya secara permanen.\n\n' +
                              'Sesudah ini, perubahan hanya dapat dilakukan lewat amandemen yang ' +
                              'menunjuk catatan ini — dan catatan aslinya tetap terbaca oleh siapa ' +
                              'pun yang membukanya kemudian.\n\nTandatangani sekarang?',
                          )
                        ) {
                          simpanCatatan.mutate(true);
                        }
                      }}
                      disabled={simpanCatatan.isPending}
                    >
                      <FileSignature className="h-4 w-4" aria-hidden />
                      Tandatangani
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* --- Sisi kanan -------------------------------------------------- */}
        <aside className="space-y-5">
          <section className="card p-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">Tanda vital</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ['systolicMmhg', 'Sistolik'],
                ['diastolicMmhg', 'Diastolik'],
                ['pulseBpm', 'Nadi'],
                ['temperatureC', 'Suhu °C'],
                ['spo2Percent', 'SpO₂ %'],
              ] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="field-label text-xs" htmlFor={`v-${k}`}>{label}</label>
                  <input
                    id={`v-${k}`}
                    className="field-input py-1"
                    inputMode="decimal"
                    value={vital[k]}
                    onChange={(e) => setVital({ ...vital, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-outline mt-3 w-full"
              onClick={() => simpanVital.mutate()}
              disabled={selesai || simpanVital.isPending}
            >
              Simpan
            </button>
            {(data?.vitals ?? []).length > 0 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {(data?.vitals ?? []).length} pengukuran tercatat.
              </p>
            )}
          </section>

          <section className="card p-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">Diagnosis</h3>
            {(data?.diagnoses ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {(data?.diagnoses ?? []).map((d) => (
                  <li key={d.id}>
                    {d.code ? <Code>{d.code}</Code> : null} {d.description}{' '}
                    <span className="text-xs text-slate-500">
                      ({d.diagnosis_role === 'PRIMARY' ? 'utama' : 'sekunder'})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 space-y-2">
              <input
                className="field-input py-1"
                placeholder="Kode ICD-10 (boleh kosong)"
                value={diagnosis.code}
                onChange={(e) => setDiagnosis({ ...diagnosis, code: e.target.value })}
                aria-label="Kode diagnosis"
              />
              <input
                className="field-input py-1"
                placeholder="Uraian diagnosis"
                value={diagnosis.description}
                onChange={(e) => setDiagnosis({ ...diagnosis, description: e.target.value })}
                aria-label="Uraian diagnosis"
              />
              <select
                className="field-input py-1"
                value={diagnosis.diagnosisRole}
                onChange={(e) => setDiagnosis({ ...diagnosis, diagnosisRole: e.target.value })}
                aria-label="Peran diagnosis"
              >
                <option value="PRIMARY">Utama</option>
                <option value="SECONDARY">Sekunder</option>
                <option value="COMPLICATION">Komplikasi</option>
                <option value="COMORBIDITY">Penyerta</option>
              </select>
            </div>
            <button
              type="button"
              className="btn-outline mt-3 w-full"
              onClick={() => simpanDiagnosis.mutate()}
              disabled={selesai || !diagnosis.description.trim() || simpanDiagnosis.isPending}
            >
              Tambah
            </button>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Kode boleh dikosongkan; koder melengkapinya kemudian. Satu kunjungan hanya boleh punya
              satu diagnosis utama.
            </p>
          </section>

          <section className="card p-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">Order</h3>
            {(data?.orders ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {(data?.orders ?? []).map((o) => (
                  <li key={o.id}>
                    <Code>{o.order_number}</Code> {o.order_name}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 space-y-2">
              <select
                className="field-input py-1"
                value={order.orderType}
                onChange={(e) => setOrder({ ...order, orderType: e.target.value })}
                aria-label="Jenis order"
              >
                <option value="LABORATORY">Laboratorium</option>
                <option value="RADIOLOGY">Radiologi</option>
                <option value="PROCEDURE">Tindakan</option>
                <option value="CONSULTATION">Konsultasi</option>
                <option value="THERAPY">Terapi</option>
                <option value="DIET">Diet</option>
              </select>
              <input
                className="field-input py-1"
                placeholder="Nama pemeriksaan atau tindakan"
                value={order.orderName}
                onChange={(e) => setOrder({ ...order, orderName: e.target.value })}
                aria-label="Nama order"
              />
            </div>
            <button
              type="button"
              className="btn-outline mt-3 w-full"
              onClick={() => simpanOrder.mutate()}
              disabled={selesai || !order.orderName.trim() || simpanOrder.isPending}
            >
              Buat order
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
