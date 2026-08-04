/**
 * Telaah akses darurat.
 *
 * ## Layar yang seharusnya ada sebelas fase lalu
 *
 * Break-glass punya dua sifat yang harus ada bersama: **tidak pernah ditolak**,
 * dan **selalu ditelaah**. Yang pertama berdiri sejak H-2. Yang kedua tidak ada
 * sama sekali sampai H-12 membangun API-nya — dan bahkan sesudah itu, tidak ada
 * layar untuk memakainya.
 *
 * Yang pertama tanpa yang kedua bukan akses darurat melainkan **pintu
 * belakang**: ia dipakai setiap hari oleh orang yang merasa lebih cepat begitu,
 * dan tidak ada yang pernah melihatnya.
 *
 * ## Angka yang diletakkan paling atas
 *
 * `pending` — berapa akses darurat yang belum ditelaah. Diletakkan di atas
 * antreannya sendiri, dan dengan sengaja: angka yang terus naik berarti sifat
 * kedua sudah berhenti berlaku, dan itu tidak terlihat dari membaca antrean
 * halaman per halaman.
 *
 * ## Urutannya milik peladen
 *
 * Sama seperti daftar kunjungan rumah pada W-1: diurut menurut yang paling
 * mencurigakan, bukan menurut waktu. Antrean yang diurut waktu membuat yang
 * paling mencurigakan tenggelam di bawah ratusan akses yang wajar, dan yang
 * menelaahnya berhenti pada halaman kedua.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, TUJUAN_LABEL, type PurposeOfUse } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

const PUTUSAN = [
  { kode: 'JUSTIFIED', label: 'Wajar', perluTindakLanjut: false },
  { kode: 'NOT_JUSTIFIED', label: 'Tidak wajar', perluTindakLanjut: true },
  { kode: 'NEEDS_INVESTIGATION', label: 'Perlu diselidiki', perluTindakLanjut: true },
];

const RUPA_PRIORITAS: Record<string, { kelas: string; label: string }> = {
  HIGH: {
    kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    label: 'Perlu segera',
  },
  MEDIUM: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Perlu dilihat',
  },
  LOW: {
    kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    label: 'Wajar',
  },
};

const RUPA_PUTUSAN: Record<string, string> = {
  JUSTIFIED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  NOT_JUSTIFIED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  NEEDS_INVESTIGATION: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
};

const waktu = (t: string | null) => (t ? t.replace('T', ' ').slice(0, 16) : '—');

export function BreakGlassPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [ditelaah, setDitelaah] = useState<string | null>(null);
  const [putusan, setPutusan] = useState('JUSTIFIED');
  const [catatan, setCatatan] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');

  const ringkas = useQuery({
    queryKey: ['health', 'bg-summary'],
    queryFn: () => healthApi.breakGlassSummary(),
  });

  const antrean = useQuery({
    queryKey: ['health', 'bg-queue'],
    queryFn: () => healthApi.breakGlassQueue(200, ctx),
  });

  const riwayat = useQuery({
    queryKey: ['health', 'bg-reviews'],
    queryFn: () => healthApi.breakGlassReviews(50, ctx),
  });

  const telaah = useMutation({
    mutationFn: (body: Record<string, unknown>) => healthApi.reviewBreakGlass(body, ctx),
    onSuccess: () => {
      toast.push('Telaah tercatat. Ia tidak dapat diubah maupun dihapus.', 'success');
      setDitelaah(null);
      setCatatan('');
      setTindakLanjut('');
      void queryClient.invalidateQueries({ queryKey: ['health', 'bg-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['health', 'bg-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['health', 'bg-summary'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const perluTindakLanjut = PUTUSAN.find((p) => p.kode === putusan)?.perluTindakLanjut ?? false;
  const catatanCukup = catatan.trim().length >= 20;
  const tindakLanjutCukup = !perluTindakLanjut || tindakLanjut.trim().length >= 10;

  return (
    <>
      <PageHeader
        title="Telaah Akses Darurat"
        description="Break-glass tidak pernah ditolak, dan selalu ditelaah. Yang pertama tanpa yang kedua adalah pintu belakang."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Telaah Darurat' }]}
      />

      <PurposeSelector />

      {ringkas.data && (
        <div className="card mb-4 flex flex-wrap items-center gap-6 px-4 py-4">
          <div>
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Belum ditelaah</p>
            <p
              className={`text-3xl font-semibold tabular-nums ${
                ringkas.data.pending > 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {ringkas.data.pending}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Sudah ditelaah</p>
            <p className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {ringkas.data.reviewed}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Tidak wajar</p>
            <p
              className={`text-3xl font-semibold tabular-nums ${
                ringkas.data.adverse > 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {ringkas.data.adverse}
            </p>
          </div>
          <p className="max-w-lg text-xs text-slate-500 dark:text-slate-400">
            Angka pertama yang paling berguna. Bila ia terus naik, &ldquo;selalu ditelaah&rdquo;
            sudah berhenti berlaku — dan yang tersisa hanyalah pintu yang tidak pernah menolak
            siapa pun.
          </p>
        </div>
      )}

      <h2 className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        Antrean telaah
      </h2>

      {antrean.isLoading && <LoadingState label="Menyusun antrean telaah…" />}
      {antrean.isError && (
        <ErrorState message={toMessage(antrean.error, (k, f) => f ?? k)} onRetry={() => void antrean.refetch()} />
      )}

      {antrean.data?.queue.length === 0 && (
        <EmptyState
          title="Tidak ada akses darurat yang menunggu telaah"
          description="Seluruh akses darurat sudah ditelaah. Ini keadaan yang benar, bukan keadaan yang jarang."
        />
      )}

      {antrean.data && antrean.data.queue.length > 0 && (
        <>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            <strong>{antrean.data.total}</strong> menunggu telaah, diurutkan menurut yang paling
            mencurigakan — bukan menurut waktu.
          </p>

          <ol className="space-y-2" aria-label="Antrean telaah akses darurat menurut kecurigaan">
            {antrean.data.queue.map((t, i) => (
              <li key={t.accessLogId} className="card flex flex-wrap items-start gap-4 px-4 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  aria-label={`Urutan ${i + 1}`}
                >
                  {i + 1}
                </span>

                <div className="min-w-[16rem] flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${RUPA_PRIORITAS[t.prioritas]?.kelas ?? ''}`}>
                      {RUPA_PRIORITAS[t.prioritas]?.label ?? t.prioritas}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {waktu(t.occurredAt)}
                    </span>
                    {t.purposeOfUse && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {TUJUAN_LABEL[t.purposeOfUse as PurposeOfUse] ?? t.purposeOfUse}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{t.alasan}</p>
                  {/*
                    Alasan yang DITULIS PELAKUNYA, dikutip apa adanya. Penelaah
                    perlu membacanya persis, bukan ringkasannya: yang menuliskan
                    "cek" pada kolom alasan sedang tergesa atau sedang tidak
                    jujur, dan keduanya hilang bila kalimatnya diperhalus.
                  */}
                  {t.breakGlassReason && (
                    <blockquote className="mt-1 border-s-2 border-slate-300 ps-2 text-sm italic text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      {t.breakGlassReason}
                    </blockquote>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    Pasien <Code>{t.patientId?.slice(0, 8) ?? '—'}</Code> · pelaku{' '}
                    <Code>{t.actorUserId?.slice(0, 8) ?? '—'}</Code>
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => {
                    setDitelaah(t.accessLogId);
                    setPutusan('JUSTIFIED');
                    setCatatan('');
                    setTindakLanjut('');
                  }}
                >
                  Telaah
                </button>
              </li>
            ))}
          </ol>
        </>
      )}

      {ditelaah && (
        <div className="card mt-4 space-y-3 px-4 py-4">
          <h2 className="font-medium text-slate-900 dark:text-slate-100">
            Telaah akses <Code>{ditelaah}</Code>
          </h2>

          <p className="inline-flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Telaah <strong>tidak menyetujui</strong> aksesnya — aksesnya sudah terjadi dan tidak
            pernah dapat ditarik kembali. Yang dinilai di sini adalah kewajarannya sesudah
            kejadian. Sekali tersimpan, telaahnya tidak dapat diubah maupun dihapus.
          </p>

          <div>
            <label className="field-label" htmlFor="putusan">
              Putusan
            </label>
            <select
              id="putusan"
              className="field-input"
              value={putusan}
              onChange={(e) => setPutusan(e.target.value)}
            >
              {PUTUSAN.map((p) => (
                <option key={p.kode} value={p.kode}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="catatan-telaah">
              Catatan telaah
            </label>
            <textarea
              id="catatan-telaah"
              className="field-input min-h-[5rem]"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Apa yang diperiksa, dan apa yang ditemukan."
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Sekurang-kurangnya 20 huruf. Telaah yang boleh berisi &ldquo;ok&rdquo; akan berisi
              &ldquo;ok&rdquo; — dan seratus baris berisi &ldquo;ok&rdquo; tidak dapat dibedakan
              dari seratus baris yang tidak pernah dibaca.
            </p>
          </div>

          {perluTindakLanjut && (
            <div>
              <label className="field-label" htmlFor="tindak-lanjut">
                Langkah berikutnya *
              </label>
              <textarea
                id="tindak-lanjut"
                className="field-input min-h-[4rem]"
                value={tindakLanjut}
                onChange={(e) => setTindakLanjut(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Wajib bila putusannya bukan &ldquo;wajar&rdquo;. Telaah yang menemukan sesuatu
                tanpa menyebutkan langkah berikutnya berhenti pada dirinya sendiri.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={telaah.isPending || !catatanCukup || !tindakLanjutCukup}
              onClick={() =>
                telaah.mutate({
                  accessLogId: ditelaah,
                  verdict: putusan,
                  notes: catatan,
                  followUp: perluTindakLanjut ? tindakLanjut : undefined,
                })
              }
            >
              Simpan telaah
            </button>
            <button type="button" className="btn-ghost" onClick={() => setDitelaah(null)}>
              Batal
            </button>
          </div>
        </div>
      )}

      <h2 className="mb-2 mt-6 inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
        <CircleCheck className="h-4 w-4" aria-hidden />
        Telaah yang sudah tercatat
      </h2>

      {riwayat.data?.reviews.length === 0 && (
        <EmptyState title="Belum ada telaah tercatat" />
      )}

      {riwayat.data && riwayat.data.reviews.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Ditelaah</th>
                <th className="px-3 py-2 text-start font-medium">Putusan</th>
                <th className="px-3 py-2 text-start font-medium">Alasan pelaku</th>
                <th className="px-3 py-2 text-start font-medium">Catatan penelaah</th>
                <th className="px-3 py-2 text-start font-medium">Langkah berikutnya</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.data.reviews.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-3 py-2 whitespace-nowrap">{waktu(r.reviewed_at)}</td>
                  <td className="px-3 py-2">
                    <span className={`badge ${RUPA_PUTUSAN[r.verdict] ?? ''}`}>
                      {PUTUSAN.find((p) => p.kode === r.verdict)?.label ?? r.verdict}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[18rem] text-slate-600 dark:text-slate-300">
                    {r.break_glass_reason ?? '—'}
                  </td>
                  <td className="px-3 py-2 max-w-[18rem]">{r.notes}</td>
                  <td className="px-3 py-2 max-w-[16rem] text-slate-600 dark:text-slate-300">
                    {r.follow_up ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
