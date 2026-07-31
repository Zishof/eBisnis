/**
 * Panel bantuan yang menyertai layar koperasi.
 *
 * Bagian "Tidak dapat diubah" sengaja **selalu terbuka**, sedangkan langkahnya
 * dapat dilipat. Yang menyebabkan kerugian bukanlah orang yang tidak tahu
 * caranya — ia akan bertanya — melainkan orang yang mengerjakan sesuatu tanpa
 * tahu bahwa hal itu tidak dapat ditarik kembali.
 */

import { useState } from 'react';
import { ChevronDown, CircleAlert, HelpCircle, Lightbulb } from 'lucide-react';
import { bantuanUntuk } from './bantuan';

export function PanelBantuan({ menuCode }: { menuCode: string }) {
  const [langkahTerbuka, setLangkahTerbuka] = useState(false);
  const bantuan = bantuanUntuk(menuCode);

  if (!bantuan) return null;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 font-semibold">
        <HelpCircle className="h-4 w-4 text-emerald-600" aria-hidden />
        {bantuan.judul}
      </h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{bantuan.ringkas}</p>

      <button
        type="button"
        onClick={() => setLangkahTerbuka((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left font-medium dark:bg-slate-800/60"
      >
        Langkah-langkahnya
        <ChevronDown
          className={`h-4 w-4 transition ${langkahTerbuka ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {langkahTerbuka && (
        <ol className="mt-2 list-inside list-decimal space-y-1.5 pl-1 text-slate-600 dark:text-slate-400">
          {bantuan.langkah.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
      )}

      {/* Selalu terbuka. Lihat catatan di kepala berkas. */}
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
        <h3 className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
          <CircleAlert className="h-4 w-4" aria-hidden />
          Yang tidak dapat diubah kemudian
        </h3>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-amber-800 dark:text-amber-300">
          {bantuan.tidakDapatDiubah.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      {bantuan.seringKeliru && bantuan.seringKeliru.length > 0 && (
        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
          <h3 className="flex items-center gap-2 font-medium text-sky-900 dark:text-sky-200">
            <Lightbulb className="h-4 w-4" aria-hidden />
            Sering keliru
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sky-800 dark:text-sky-300">
            {bantuan.seringKeliru.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
