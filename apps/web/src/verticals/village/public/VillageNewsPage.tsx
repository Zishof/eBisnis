/**
 * Satu berita desa.
 *
 * Hanya membaca. Isi berita ditampilkan sebagai teks, **bukan** sebagai HTML:
 * situs desa disunting operator yang menyalin-tempel dari mana saja, dan
 * `dangerouslySetInnerHTML` di halaman publik berarti siapa pun yang dapat
 * menyunting berita dapat menjalankan skrip pada peramban warga yang
 * membacanya.
 */

import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ErrorState, LoadingState } from '../../../components/ui';
import { formatDate } from '../../../lib/api';
import { useBeritaSatu } from './useVillagePublic';

export function VillageNewsPage() {
  const { slug = '', beritaSlug = '' } = useParams();
  const berita = useBeritaSatu(slug, beritaSlug);

  if (berita.isLoading) return <LoadingState label="Memuat berita…" />;
  if (berita.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState message="Berita tidak dapat dimuat." onRetry={() => void berita.refetch()} />
      </div>
    );
  }

  const b = berita.data!;

  return (
    <article className="container-page py-10">
      <Link
        to={`/desa/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:underline dark:text-slate-400"
      >
        <ArrowLeft size={15} aria-hidden /> Kembali ke situs desa
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">{b.title}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {b.publishedAt ? formatDate(b.publishedAt) : '—'}
        {b.authorName ? ` · ${b.authorName}` : ''}
        {b.category ? ` · ${b.category}` : ''}
      </p>

      {b.summary ? (
        <p className="mt-6 text-lg text-slate-700 dark:text-slate-200">{b.summary}</p>
      ) : null}

      {/*
        Ditampilkan sebagai teks, bukan HTML. Paragraf dipisah baris kosong.
        Yang hilang hanyalah penataan; yang dihindari adalah skrip yang berjalan
        pada peramban warga.
      */}
      <div className="mt-6 space-y-4 text-slate-800 dark:text-slate-200">
        {(b.body ?? '')
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((paragraf, i) => (
            <p key={i} className="whitespace-pre-line leading-relaxed">
              {paragraf}
            </p>
          ))}
      </div>
    </article>
  );
}
