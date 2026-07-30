import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { apiRequestPaged, formatDate } from '../../lib/api';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { localeTag } from './HomePage';

interface NewsItem {
  slug: string;
  title: string;
  summary?: string | null;
  publishedAt?: string | null;
  category: { slug: string; name: string };
  tags: Array<{ slug: string; name: string }>;
}

export function NewsListPage() {
  const { t, i18n } = useTranslation();
  const toMessage = useErrorMessage();
  const [page, setPage] = useState(1);

  const news = useQuery({
    queryKey: ['news', page, i18n.language],
    // Memakai klien API agar header Accept-Language, envelope, dan penanganan
    // error mengikuti konvensi yang sama dengan halaman lain.
    queryFn: () => apiRequestPaged<NewsItem[]>(`/public/news?page=${page}&pageSize=9`),
  });

  return (
    <div className="py-14">
      <div className="container-page">
        <header className="mb-10 text-center">
          <p className="section-eyebrow">{t('nav.news')}</p>
          <h1 className="section-heading">Berita dan Pembaruan</h1>
        </header>

        {news.isLoading ? (
          <LoadingState />
        ) : news.isError ? (
          // Kegagalan permintaan TIDAK boleh tampak sama dengan "belum ada data".
          <ErrorState
            message={toMessage(news.error, (key, fallback) => t(key, fallback ?? key))}
            onRetry={() => void news.refetch()}
          />
        ) : !news.data?.data?.length ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {news.data.data.map((item) => (
                <article key={item.slug} className="card flex flex-col p-5">
                  <span className="badge w-fit bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {item.category.name}
                  </span>
                  <h2 className="mt-3 font-semibold leading-snug text-slate-900 dark:text-white">
                    <Link to={`/berita/${item.slug}`} className="hover:underline">
                      {item.title}
                    </Link>
                  </h2>
                  {item.summary && (
                    <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
                  )}
                  <time className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(item.publishedAt, localeTag(i18n.language))}
                  </time>
                </article>
              ))}
            </div>
            {news.data.meta && (
              <Pagination
                page={news.data.meta.page}
                totalPages={news.data.meta.totalPages}
                total={news.data.meta.total}
                onChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
