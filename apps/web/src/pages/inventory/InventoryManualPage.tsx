import { BookOpen, CheckCircle2, Download, FileText, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import manual from './inventory-manual-content.json';

const assetBase = '/panduan/inventory-sales';

export function InventoryManualPage() {
  const [query, setQuery] = useState('');
  const chapters = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id');
    return needle
      ? manual.chapters.filter((chapter) => JSON.stringify(chapter).toLocaleLowerCase('id').includes(needle))
      : manual.chapters;
  }, [query]);

  return (
    <div className="bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:py-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <BookOpen className="h-4 w-4" aria-hidden /> Panduan resmi Inventory / Sales
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{manual.meta.title}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">{manual.meta.subtitle}. Dari persiapan data, order sales, batch dan expiry, hingga laporan pemilik serta tutup periode.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn-primary" href={`${assetBase}/Panduan-Pengguna-eBisnis-Inventory-Sales.pdf`} download><Download className="h-4 w-4" aria-hidden /> Unduh PDF</a>
              <a className="btn-outline" href={`${assetBase}/Panduan-Pengguna-eBisnis-Inventory-Sales.docx`} download><FileText className="h-4 w-4" aria-hidden /> Unduh Word</a>
            </div>
            <p className="mt-4 text-sm text-slate-500">Versi {manual.meta.version} / diperbarui {manual.meta.updated}</p>
          </div>
          <img src={`${assetBase}/images/alur-end-to-end.png`} alt="Ilustrasi alur sales, gudang, admin, dan pemilik" className="aspect-[16/10] w-full rounded-lg border border-slate-200 object-cover shadow-sm dark:border-slate-800" />
        </div>
      </section>

      <main className="container-page py-10">
        <section aria-labelledby="quick-start-title">
          <h2 id="quick-start-title" className="text-2xl font-black">Mulai dalam {manual.quickStart.length} langkah</h2>
          <ol className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {manual.quickStart.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-black text-white">{index + 1}</span>
                <span className="text-sm leading-6 text-slate-700 dark:text-slate-200">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 border-y border-slate-200 py-10 dark:border-slate-800">
          <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div><h2 className="text-2xl font-black">Hak akses per peran</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Setiap pengguna hanya menerima menu yang relevan dengan pekerjaannya.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {manual.roles.map((role) => (
                <article key={role.role} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />{role.role}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{role.purpose}</p>
                  <p className="mt-3 text-xs font-semibold uppercase text-slate-500">{role.platform}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><p className="text-xs font-bold uppercase text-brand-700">Baca online</p><h2 className="mt-1 text-3xl font-black">Panduan end to end</h2></div>
            <label className="relative block w-full md:max-w-sm"><span className="sr-only">Cari isi panduan</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 dark:border-slate-700 dark:bg-slate-900" placeholder="Cari order, expiry, piutang..." /></label>
          </div>
          <div className="mt-6 space-y-4">
            {chapters.map((chapter, index) => {
              const chapterNumber = manual.chapters.findIndex((item) => item.title === chapter.title) + 1;
              return (
              <details key={chapter.title} open={index < 2 && !query} className="group rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5"><span className="flex items-center gap-3"><span className="text-sm font-bold text-brand-700">{String(chapterNumber).padStart(2, '0')}</span><span className="text-lg font-bold">{chapter.title}</span></span><span className="text-2xl text-slate-400 transition group-open:rotate-45">+</span></summary>
                <div className="border-t border-slate-200 px-5 py-5 dark:border-slate-800">
                  <p className="max-w-4xl leading-7 text-slate-700 dark:text-slate-200">{chapter.summary}</p>
                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    {chapter.sections.map((section) => <div key={section.title}><h3 className="font-bold">{section.title}</h3>{'paragraphs' in section ? section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{paragraph}</p>) : null}{('bullets' in section && section.bullets) || ('steps' in section && section.steps) ? <ul className="mt-2 space-y-2">{(('bullets' in section ? section.bullets : section.steps) ?? []).map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{item}</li>)}</ul> : null}{'warning' in section && section.warning ? <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"><strong>Perhatian:</strong> {section.warning}</p> : null}</div>)}
                  </div>
                </div>
              </details>
              );
            })}
            {chapters.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">Topik tidak ditemukan.</p> : null}
          </div>
        </section>

        <section className="mt-12 grid gap-8 border-t border-slate-200 pt-10 lg:grid-cols-[minmax(0,1fr)_420px] dark:border-slate-800">
          <div><h2 className="text-2xl font-black">Paritas 48 layar aplikasi lama</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Seluruh fungsi legacy dipetakan ke modul ERP baru, bukan disalin sebagai tampilan lama.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">{manual.parityGroups.map((group) => <article key={group.group} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{group.group}</h3><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{group.count} layar</span></div><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{group.features.join(' / ')}</p></article>)}</div>
          </div>
          <img src={`${assetBase}/images/kontrol-web-desktop.png`} alt="Ilustrasi kontrol inventory pada web dan desktop" className="aspect-[4/3] w-full rounded-lg border border-slate-200 object-cover dark:border-slate-800" />
        </section>
      </main>
    </div>
  );
}
