/**
 * Status imunisasi seorang anak.
 *
 * ## Yang paling menentukan bentuk layar ini
 *
 * **Yang belum boleh diberikan hari ini tidak diberi tombol.**
 *
 * Peladen menolak vaksin yang terlalu cepat — bukan memperingatkan, menolak —
 * sebab vaksin sebelum umur minimum tidak membentuk kekebalan yang cukup, dan
 * yang lebih berbahaya: ia akan **tercatat sebagai diberikan**. Anak itu lalu
 * tampak lengkap pada laporan cakupan dan tidak akan dikejar siapa pun.
 *
 * Menampilkan tombol yang pasti ditolak akan membuat kader menekannya, membaca
 * galat, dan menekannya lagi. Karena itu layar ini memisahkan tiga daftar:
 *
 * ```
 * tertunggak   → merah, paling atas, paling lama dahulu
 * boleh hari ini → bertombol
 * belum boleh   → tanpa tombol, dengan SEBAB dan TANGGALNYA
 * ```
 *
 * Yang ketiga tetap ditampilkan — bukan disembunyikan — sebab ibu yang bertanya
 * "kapan giliran anak saya" berhak dijawab dengan tanggal, bukan dengan
 * "belum waktunya".
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Clock, Search, Syringe, TriangleAlert } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import {
  healthApi,
  umurDari,
  LABEL_TOLAK_IMUNISASI,
  type JadwalImunisasi,
  type RingkasPasien,
} from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

export function ImmunizationPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [kata, setKata] = useState('');
  const [dicari, setDicari] = useState('');
  const [anak, setAnak] = useState<RingkasPasien | null>(null);
  const [diberikan, setDiberikan] = useState<JadwalImunisasi | null>(null);
  const [batch, setBatch] = useState('');
  const [kedaluwarsa, setKedaluwarsa] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [posyandu, setPosyandu] = useState('');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const pencarian = useQuery({
    queryKey: ['health', 'patients', dicari],
    queryFn: () => healthApi.searchPatients({ q: dicari }, ctx),
    enabled: dicari.length >= 2,
  });
  /*
   * `searchPatients` mengembalikan objek berlingkup, bukan larik — dan
   * lingkupnya penting: pencarian pasien SELALU terbatas pada fasilitas yang
   * sedang dibuka. Diambil di sini supaya lingkupnya tidak hilang diam-diam.
   */
  const hasilCari = pencarian.data?.results ?? [];

  const status = useQuery({
    queryKey: ['health', 'immunization', anak?.id],
    queryFn: () => healthApi.immunizationStatus(anak?.id as string, ctx),
    enabled: Boolean(anak),
  });

  const catat = useMutation({
    mutationFn: (body: Record<string, unknown>) => healthApi.recordImmunization(body, ctx),
    onSuccess: () => {
      toast.push('Imunisasi tercatat.', 'success');
      setDiberikan(null);
      setBatch('');
      setKedaluwarsa('');
      void queryClient.invalidateQueries({ queryKey: ['health', 'immunization'] });
      void queryClient.invalidateQueries({ queryKey: ['health', 'home-visits'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const belumBoleh = (status.data?.upcoming ?? []).filter((u) => !u.verdict.allowed);

  return (
    <>
      <PageHeader
        title="Imunisasi"
        description="Yang belum boleh diberikan hari ini tidak diberi tombol — tetapi sebab dan tanggalnya tetap ditampilkan."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Imunisasi' }]}
      />

      <PurposeSelector />

      <div className="card mb-4 px-4 py-4">
        <label className="field-label" htmlFor="cari-anak-imunisasi">
          Cari anak
        </label>
        <div className="flex gap-2">
          <input
            id="cari-anak-imunisasi"
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

        {hasilCari.length > 0 && !anak && (
          <ul className="mt-3 space-y-1">
            {hasilCari.slice(0, 8).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => setAnak(p)}
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

      {anak && (
        <>
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{anak.full_name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {umurDari(anak.birth_date)}
                {anak.mrn && (
                  <>
                    {' · '}
                    <Code>{anak.mrn}</Code>
                  </>
                )}
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setAnak(null)}>
              Ganti anak
            </button>
          </div>

          {status.isLoading && <LoadingState label="Memuat jadwal imunisasi…" />}
          {status.isError && (
            <ErrorState message={toMessage(status.error, (k, f) => f ?? k)} onRetry={() => void status.refetch()} />
          )}

          {status.data && (
            <div className="space-y-4">
              {status.data.overdue.length > 0 && (
                <section className="card border-2 border-rose-300 px-4 py-4 dark:border-rose-800">
                  <h2 className="mb-2 inline-flex items-center gap-2 font-medium text-rose-800 dark:text-rose-300">
                    <TriangleAlert className="h-4 w-4" aria-hidden />
                    Tertunggak ({status.data.overdue.length})
                  </h2>
                  <ul className="space-y-1.5">
                    {status.data.overdue.map((o) => (
                      <li
                        key={`${o.vaccineCode}-${o.doseNumber}`}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <Code>{o.vaccineCode}</Code>
                        <span>dosis {o.doseNumber}</span>
                        <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                          terlambat {o.overdueDays} hari
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    Yang tertunggak tetap boleh diberikan hari ini bila umurnya sudah cukup —
                    cari pada daftar di bawah.
                  </p>
                </section>
              )}

              <section className="card px-4 py-4">
                <h2 className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <Syringe className="h-4 w-4" aria-hidden />
                  Boleh diberikan hari ini ({status.data.dueToday.length})
                </h2>
                {status.data.dueToday.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Tidak ada yang boleh diberikan hari ini.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {status.data.dueToday.map((u) => (
                      <li
                        key={`${u.vaccineCode}-${u.doseNumber}`}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <Code>{u.vaccineCode}</Code>
                        <span className="flex-1">dosis {u.doseNumber}</span>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setDiberikan(u);
                            setBatch('');
                            setKedaluwarsa('');
                            setLokasi('');
                          }}
                        >
                          Berikan
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {belumBoleh.length > 0 && (
                <section className="card px-4 py-4">
                  <h2 className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                    <Clock className="h-4 w-4" aria-hidden />
                    Belum boleh diberikan ({belumBoleh.length})
                  </h2>
                  <ul className="space-y-1.5">
                    {belumBoleh.map((u) => (
                      <li key={`${u.vaccineCode}-${u.doseNumber}`} className="text-sm">
                        <span className="flex flex-wrap items-center gap-2">
                          <Code>{u.vaccineCode}</Code>
                          <span>dosis {u.doseNumber}</span>
                        </span>
                        {/*
                          `message`, BUKAN `reason`. `reason` adalah kode
                          (TOO_YOUNG, OUT_OF_ORDER); kader yang membaca
                          "TOO_YOUNG" tidak tahu itu artinya apa.
                        */}
                        <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                          {u.verdict.message ?? LABEL_TOLAK_IMUNISASI[u.verdict.reason ?? ''] ?? 'Belum boleh diberikan.'}
                        </span>
                        {/*
                          Tanggalnya, bila peladen menyebutkannya. Ibu yang
                          bertanya "kapan giliran anak saya" berhak dijawab
                          dengan tanggal, bukan dengan "belum waktunya".
                        */}
                        {u.verdict.earliestDate && (
                          <span className="mt-0.5 block font-medium text-slate-700 dark:text-slate-200">
                            Paling awal {u.verdict.earliestDate}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Sengaja tanpa tombol. Vaksin sebelum umur minimum tidak membentuk kekebalan yang
                    cukup, dan yang lebih berbahaya: ia akan tercatat sebagai diberikan, sehingga
                    anaknya tampak lengkap pada laporan cakupan dan tidak akan dikejar siapa pun.
                  </p>
                </section>
              )}

              <section className="card px-4 py-4">
                <h2 className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <CircleCheck className="h-4 w-4" aria-hidden />
                  Sudah diberikan ({status.data.given.length})
                </h2>
                {status.data.given.length === 0 ? (
                  <EmptyState title="Belum ada imunisasi tercatat" />
                ) : (
                  <ul className="space-y-1.5">
                    {status.data.given.map((g) => (
                      <li key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Code>{g.vaccine_code}</Code>
                        <span>dosis {g.dose_number}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {g.given_at?.slice(0, 10)}
                        </span>
                        {g.batch_number && (
                          <span className="text-xs text-slate-400">batch {g.batch_number}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {diberikan && (
            <div className="card mt-4 space-y-3 px-4 py-4">
              <h2 className="font-medium text-slate-900 dark:text-slate-100">
                Memberikan {diberikan.vaccineCode} dosis {diberikan.doseNumber}
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="batch">
                    Nomor batch
                  </label>
                  <input
                    id="batch"
                    className="field-input"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Dicatat supaya bila satu batch ditarik, anak yang menerimanya dapat ditemukan
                    kembali — dan itu tidak mungkin bila nomornya tidak pernah dicatat.
                  </p>
                </div>
                <div>
                  <label className="field-label" htmlFor="kedaluwarsa">
                    Kedaluwarsa
                  </label>
                  <input
                    id="kedaluwarsa"
                    className="field-input"
                    type="date"
                    value={kedaluwarsa}
                    onChange={(e) => setKedaluwarsa(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="lokasi">
                    Lokasi suntikan
                  </label>
                  <input
                    id="lokasi"
                    className="field-input"
                    value={lokasi}
                    onChange={(e) => setLokasi(e.target.value)}
                    placeholder="mis. paha kiri"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="posyandu-imunisasi">
                    Posyandu
                  </label>
                  <input
                    id="posyandu-imunisasi"
                    className="field-input"
                    value={posyandu}
                    onChange={(e) => setPosyandu(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={catat.isPending}
                  onClick={() =>
                    catat.mutate({
                      patientId: anak.id,
                      facilityId,
                      vaccineCode: diberikan.vaccineCode,
                      doseNumber: diberikan.doseNumber,
                      batchNumber: batch || undefined,
                      expiryDate: kedaluwarsa || undefined,
                      site: lokasi || undefined,
                      posyanduName: posyandu || undefined,
                    })
                  }
                >
                  Catat pemberian
                </button>
                <button type="button" className="btn-ghost" onClick={() => setDiberikan(null)}>
                  Batal
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
