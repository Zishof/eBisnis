import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { api } from '../../lib/api';
import { ErrorState, LoadingState } from '../../components/ui';
import type { CmsPageData } from './HomePage';

/** Halaman statis yang seluruh isinya berasal dari CMS. */
export function CmsPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const page = useQuery({
    queryKey: ['cms-page', slug, i18n.language],
    queryFn: () => api.get<CmsPageData>(`/public/pages/${slug}`),
  });

  useEffect(() => {
    if (page.data?.seo?.title) document.title = page.data.seo.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && page.data?.seo?.description) {
      meta.setAttribute('content', page.data.seo.description);
    }
  }, [page.data]);

  if (page.isLoading) return <LoadingState />;
  if (page.isError || !page.data) {
    return (
      <div className="container-page py-20">
        <ErrorState message={t('common.error')} onRetry={() => void page.refetch()} />
      </div>
    );
  }

  const blocks = [...page.data.blocks].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <article className="py-14">
      <div className="container-page max-w-3xl">
        <header className="mb-8">
          <h1 className="section-heading">{page.data.title}</h1>
          {page.data.summary && <p className="section-lead">{page.data.summary}</p>}
        </header>
        {blocks.map((block) => (
          <section key={block.key} className="mb-8">
            {block.heading && block.type !== 'PAGE_HEADER' && (
              <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">{block.heading}</h2>
            )}
            {block.subheading && block.type === 'PAGE_HEADER' && (
              <p className="text-slate-600 dark:text-slate-300">{block.subheading}</p>
            )}
            {block.body && (
              <div
                className="prose-cms"
                // Konten CMS disanitasi di server dengan whitelist tag.
                dangerouslySetInnerHTML={{ __html: block.body }}
              />
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
