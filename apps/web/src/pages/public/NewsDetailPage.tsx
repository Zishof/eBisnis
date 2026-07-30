import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { api, formatDate } from '../../lib/api';
import { ErrorState, LoadingState } from '../../components/ui';
import { localeTag } from './HomePage';

interface NewsDetail {
  slug: string;
  title: string;
  summary?: string | null;
  content: string;
  publishedAt?: string | null;
  author?: string | null;
  category: { slug: string; name: string };
  tags: Array<{ slug: string; name: string }>;
}

export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();

  const article = useQuery({
    queryKey: ['news-detail', slug, i18n.language],
    queryFn: () => api.get<NewsDetail>(`/public/news/${slug}`),
    enabled: Boolean(slug),
  });

  if (article.isLoading) return <LoadingState />;
  if (article.isError || !article.data) {
    return (
      <div className="container-page py-20">
        <ErrorState message={t('common.error')} onRetry={() => void article.refetch()} />
      </div>
    );
  }

  return (
    <article className="py-14">
      <div className="container-page max-w-3xl">
        <Link to="/berita" className="btn-ghost mb-6 -ms-3">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t('web.allNews')}
        </Link>
        <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          {article.data.category.name}
        </span>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 dark:text-white">
          {article.data.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <time>{formatDate(article.data.publishedAt, localeTag(i18n.language))}</time>
          {article.data.author && <span>· {article.data.author}</span>}
        </div>
        <div
          className="prose-cms mt-8"
          // Konten berita disanitasi di server.
          dangerouslySetInnerHTML={{ __html: article.data.content }}
        />
        {article.data.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {article.data.tags.map((tag) => (
              <span key={tag.slug} className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
