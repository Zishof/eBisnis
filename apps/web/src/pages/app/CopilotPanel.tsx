/**
 * Panel Copilot.
 *
 * ## Jawaban AI tidak pernah disajikan seperti kebenaran
 *
 * Yang membedakan panel ini dari kotak obrolan biasa:
 *
 * 1. **Bukti selalu tampil**, dan dapat dibuka. Kesimpulan tanpa sumber yang
 *    terlihat akan dipercaya begitu saja.
 * 2. **Peringatan selalu tampil**, bukan disembunyikan di balik tanda tanya.
 * 3. **Jenis pencarian disebutkan.** Pengguna yang tidak menemukan sesuatu
 *    berhak tahu apakah pencariannya berbasis kata atau makna — keduanya gagal
 *    dengan cara berbeda.
 * 4. **Penyamaran dilaporkan.** Tanpa itu, pengguna mengira modelnya tidak
 *    becus padahal datanya memang sengaja tidak dikirim.
 * 5. **Penilaian diminta.** Mutu AI hanya dapat diperbaiki dari alasan
 *    penolakannya.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';

interface UseCase {
  code: string;
  name: string;
  description: string;
  outputKind: string;
  riskClass: string;
  requiresEvidence: boolean;
  requiredPermission: string;
}

interface EvidenceRef {
  source: string;
  reference?: string;
  score?: number;
}

interface CopilotAnswer {
  useCaseCode: string;
  outputKind: string;
  model: string;
  output: Record<string, unknown>;
  evidenceUsed: EvidenceRef[];
  evidenceDropped: number;
  retrievedEvidence: EvidenceRef[];
  retriever: string;
  retrieverNote: string;
  redacted: Array<{ kind: string; count: number }>;
  durationMs: number;
  invocationId: string;
  disclaimer: string;
}

/**
 * Aksi yang ditawarkan menurut rute yang sedang dibuka.
 *
 * Rute hanya menentukan SARAN, bukan izin. Izin tetap ditentukan server;
 * keperluan yang tidak berhak dipakai pengguna akan ditolak di sana.
 */
function suggestedUseCases(pathname: string, all: UseCase[]): UseCase[] {
  const relevan = (kode: string[]) => all.filter((u) => kode.includes(u.code));

  if (pathname.includes('/surat/masuk')) {
    return relevan(['RINGKAS_SURAT_MASUK', 'BUAT_KESIMPULAN', 'BERIKAN_REKOMENDASI']);
  }
  if (pathname.includes('/surat/keluar')) {
    return relevan(['DRAFT_SURAT_KELUAR', 'BUAT_KESIMPULAN']);
  }
  if (pathname.includes('/audit') || pathname.includes('/observability')) {
    return relevan(['JELASKAN_GALAT', 'TEMUKAN_ANOMALI']);
  }
  if (pathname.includes('/laporan') || pathname.includes('/reporting')) {
    return relevan(['TEMUKAN_ANOMALI', 'BERIKAN_REKOMENDASI', 'JELASKAN_ANGKA']);
  }
  // Bawaan: yang paling umum dipakai di mana pun.
  return relevan(['BUAT_KESIMPULAN', 'JELASKAN_ANGKA', 'BERIKAN_REKOMENDASI']);
}

export function CopilotPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();

  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [rated, setRated] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ items: UseCase[]; note: string }>('/ai/use-cases')
      .then((r) => {
        setUseCases(r.items);
        const saran = suggestedUseCases(location.pathname, r.items);
        setSelected(saran[0]?.code ?? r.items[0]?.code ?? '');
      })
      .catch(() => setError(t('ai.loadFailed')));
  }, [location.pathname, t]);

  const saran = suggestedUseCases(location.pathname, useCases);
  const dipilih = useCases.find((u) => u.code === selected);

  async function tanya() {
    if (!selected || question.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    setRated(null);

    try {
      const hasil = await api.post<CopilotAnswer>('/ai/copilot', {
        useCaseCode: selected,
        question: question.trim(),
        routePath: location.pathname,
        // Konteks yang ditempel pengguna menjadi bukti. Ia disamarkan di sisi
        // server sebelum dikirim ke model — bukan di sini, karena penyamaran
        // yang dikerjakan peramban dapat dilewati begitu saja.
        evidence: context.trim()
          ? [{ source: t('ai.pastedContext'), content: context.trim() }]
          : undefined,
      });
      setAnswer(hasil);
      setShowEvidence(false);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function nilai(verdict: 'ACCEPTED' | 'REJECTED') {
    if (!answer) return;
    // Penolakan wajib beralasan — server menolak yang tanpa alasan, dan pesan
    // itu memang perlu sampai kepada penggunanya.
    const reason =
      verdict === 'REJECTED'
        ? window.prompt(t('ai.rejectReasonPrompt') ?? 'Mengapa jawaban ini tidak dipakai?')
        : undefined;
    if (verdict === 'REJECTED' && (!reason || reason.trim().length < 5)) return;

    try {
      await api.post(`/ai/invocations/${answer.invocationId}/feedback`, {
        verdict,
        reason: reason ?? undefined,
      });
      setRated(verdict);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <aside
      className="fixed inset-y-0 end-0 z-40 flex w-full max-w-md flex-col border-s border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      aria-label={t('ai.title')}
    >
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <Sparkles className="h-4 w-4 text-brand-700 dark:text-brand-400" aria-hidden />
        <h2 className="flex-1 text-sm font-semibold">{t('ai.title')}</h2>
        <button type="button" className="btn-ghost px-2 py-1" onClick={onClose} aria-label={t('common.close')}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {/* Aksi disarankan menurut halaman yang sedang dibuka. */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('ai.action')}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {saran.map((u) => (
              <button
                key={u.code}
                type="button"
                onClick={() => setSelected(u.code)}
                className={
                  selected === u.code
                    ? 'rounded-lg bg-brand-700 px-2.5 py-1 text-xs font-medium text-white'
                    : 'rounded-lg border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }
              >
                {u.name}
              </button>
            ))}
          </div>
          {dipilih && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{dipilih.description}</p>
          )}
        </div>

        {dipilih?.requiresEvidence && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t('ai.evidenceRequired')}</span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="ai-q">
            {t('ai.question')}
          </label>
          <textarea
            id="ai-q"
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('ai.questionPlaceholder') ?? ''}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="ai-ctx">
            {t('ai.context')}
          </label>
          <textarea
            id="ai-ctx"
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={t('ai.contextPlaceholder') ?? ''}
          />
        </div>

        <button
          type="button"
          className="btn-primary w-full justify-center"
          disabled={busy || question.trim().length < 3}
          onClick={() => void tanya()}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('ai.thinking')}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden /> {t('ai.ask')}
            </>
          )}
        </button>

        {busy && (
          // Disebutkan supaya orang tidak mengira aplikasinya menggantung.
          // Model 3B pada perangkat keras biasa memang belasan detik.
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">{t('ai.slowNotice')}</p>
        )}

        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-900 dark:bg-rose-950 dark:text-rose-100">
            {error}
          </div>
        )}

        {answer && (
          <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            {/* Peringatan mendahului jawabannya, bukan menyusul. */}
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{answer.disclaimer}</span>
            </div>

            <AnswerBody output={answer.output} />

            {answer.redacted.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('ai.redactedNotice')}{' '}
                {answer.redacted.map((r) => `${r.count} ${r.kind}`).join(', ')}.
              </p>
            )}

            {/* Bukti selalu ada, dan dapat dibuka. */}
            <div>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                onClick={() => setShowEvidence((v) => !v)}
              >
                <ChevronDown
                  className={showEvidence ? 'h-3.5 w-3.5 rotate-180' : 'h-3.5 w-3.5'}
                  aria-hidden
                />
                {t('ai.evidenceCount', {
                  count: answer.evidenceUsed.length + answer.retrievedEvidence.length,
                })}
              </button>

              {showEvidence && (
                <ul className="mt-1.5 space-y-1">
                  {[...answer.evidenceUsed, ...answer.retrievedEvidence].map((e, i) => (
                    <li
                      key={`${e.source}-${i}`}
                      className="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
                    >
                      <span className="font-medium">{e.source}</span>
                      {e.reference && <span className="ms-1 ltr-code text-slate-500">{e.reference}</span>}
                    </li>
                  ))}
                  {answer.evidenceDropped > 0 && (
                    <li className="text-xs text-slate-500 dark:text-slate-400">
                      {t('ai.evidenceDropped', { count: answer.evidenceDropped })}
                    </li>
                  )}
                </ul>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">{answer.retriever}</span> — {answer.retrieverNote}
            </p>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              <span className="ltr-code">{answer.model}</span> · {(answer.durationMs / 1000).toFixed(1)}s
            </p>

            {/* Penilaian: mutu AI hanya dapat diperbaiki dari alasan penolakannya. */}
            <div className="flex items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('ai.rate')}</span>
              <button
                type="button"
                className={rated === 'ACCEPTED' ? 'btn-ghost px-2 py-1 text-emerald-600' : 'btn-ghost px-2 py-1'}
                onClick={() => void nilai('ACCEPTED')}
                aria-label={t('ai.accept')}
                disabled={rated !== null}
              >
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className={rated === 'REJECTED' ? 'btn-ghost px-2 py-1 text-rose-600' : 'btn-ghost px-2 py-1'}
                onClick={() => void nilai('REJECTED')}
                aria-label={t('ai.reject')}
                disabled={rated !== null}
              >
                <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
              </button>
              {rated && <span className="text-xs text-slate-500">{t('ai.rated')}</span>}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Menampilkan keluaran terstruktur.
 *
 * Bentuknya berbeda-beda menurut keperluan, dan sengaja ditangani secara umum:
 * komponen yang mengenali setiap bentuk akan menampilkan halaman kosong pada
 * hari sebuah keperluan baru ditambahkan.
 */
function AnswerBody({ output }: { output: Record<string, unknown> }) {
  if (!output || typeof output !== 'object') return null;

  return (
    <div className="space-y-2 text-sm">
      {Object.entries(output).map(([kunci, nilai]) => (
        <div key={kunci}>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {kunci}
          </div>
          {Array.isArray(nilai) ? (
            <ul className="mt-0.5 list-inside list-disc space-y-0.5">
              {nilai.map((item, i) => (
                <li key={i} className="text-sm">
                  {typeof item === 'object' && item !== null
                    ? Object.entries(item as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' — ')
                    : String(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap">{String(nilai)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
