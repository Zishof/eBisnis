import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FilePlus2, Save, Send } from 'lucide-react';
import { api, formatDateTime } from '../../lib/api';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import { Code, LoadingState, PageHeader, StatusBadge, useToast } from '../../components/ui';

interface CmsPageSummary {
  id: string;
  code: string;
  slug: string;
  pageType: string;
  status: string;
  showInNavigation: boolean;
  sortOrder: number;
  versions: Array<{ id: string; versionNumber: number; title: string; status: string; publishedAt: string | null }>;
}

interface CmsBlockTranslation {
  localeCode: string;
  eyebrow: string | null;
  heading: string | null;
  subheading: string | null;
  body: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
}

interface CmsBlock {
  id: string;
  blockKey: string;
  blockType: string;
  sortOrder: number;
  translations: CmsBlockTranslation[];
}

interface CmsPageDetail extends CmsPageSummary {
  versions: Array<{
    id: string;
    versionNumber: number;
    title: string;
    status: string;
    publishedAt: string | null;
    summary: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    blocks: CmsBlock[];
  }>;
}

interface NewsRow {
  id: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  category: { code: string; defaultName: string } | null;
  versions: Array<{ title: string; status: string }>;
}

interface Announcement {
  id: string;
  code: string;
  title: string;
  severity: string;
  audience: string;
  startsAt: string | null;
  endsAt: string | null;
}

interface FaqCategory {
  id: string;
  code: string;
  defaultName: string;
  items: Array<{ id: string; code: string; defaultQuestion: string }>;
}

interface MediaFolder {
  id: string;
  code: string;
  name: string;
  assets: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number | string }>;
}

const BLOCK_FIELDS = [
  { key: 'eyebrow', label: 'Eyebrow' },
  { key: 'heading', label: 'Judul' },
  { key: 'subheading', label: 'Subjudul' },
  { key: 'body', label: 'Isi', multiline: true },
  { key: 'buttonLabel', label: 'Label tombol' },
  { key: 'buttonUrl', label: 'URL tombol' },
] as const;

export function PlatformCmsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();
  const { hasPlatformPermission } = useAuth();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});

  const canManage = hasPlatformPermission('PLATFORM.CMS.MANAGE');
  const canPublish = hasPlatformPermission('PLATFORM.CMS.PUBLISH');

  const pages = useQuery({
    queryKey: ['platform', 'cms', 'pages'],
    queryFn: () => api.get<CmsPageSummary[]>('/platform/cms/pages'),
  });

  const detail = useQuery({
    queryKey: ['platform', 'cms', 'page', selectedCode],
    queryFn: () => api.get<CmsPageDetail>(`/platform/cms/pages/${selectedCode}`),
    enabled: Boolean(selectedCode),
  });

  const news = useQuery({
    queryKey: ['platform', 'cms', 'news'],
    queryFn: () => api.get<NewsRow[]>('/platform/cms/news'),
  });

  const announcements = useQuery({
    queryKey: ['platform', 'cms', 'announcements'],
    queryFn: () => api.get<Announcement[]>('/platform/cms/announcements'),
  });

  const faqs = useQuery({
    queryKey: ['platform', 'cms', 'faqs'],
    queryFn: () => api.get<FaqCategory[]>('/platform/cms/faqs'),
  });

  const media = useQuery({
    queryKey: ['platform', 'cms', 'media'],
    queryFn: () => api.get<MediaFolder[]>('/platform/cms/media'),
  });

  const failure = (error: unknown) =>
    toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error');

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['platform', 'cms'] });

  const saveBlock = useMutation({
    mutationFn: (input: { blockId: string; values: Record<string, string> }) =>
      api.patch(`/platform/cms/blocks/${input.blockId}`, { localeCode: 'id', ...input.values }),
    onSuccess: (_result, input) => {
      toast.push('Blok konten disimpan. Website publik langsung memakai nilai baru.', 'success');
      setDraft((current) => {
        const next = { ...current };
        delete next[input.blockId];
        return next;
      });
      invalidate();
    },
    onError: failure,
  });

  const createDraft = useMutation({
    mutationFn: (code: string) => api.post(`/platform/cms/pages/${code}/versions`),
    onSuccess: () => {
      toast.push('Versi draft baru dibuat.', 'success');
      invalidate();
    },
    onError: failure,
  });

  const setStatus = useMutation({
    mutationFn: (input: { code: string; versionId: string; status: string }) =>
      api.post(`/platform/cms/pages/${input.code}/versions/${input.versionId}/status`, {
        status: input.status,
      }),
    onSuccess: (_result, input) => {
      toast.push(`Versi diubah menjadi ${input.status}.`, 'success');
      invalidate();
    },
    onError: failure,
  });

  const activeVersion = detail.data?.versions?.[0];

  return (
    <>
      <PageHeader
        title={t('platform.cms')}
        description="Seluruh konten homepage tersusun dari blok. Mengubah teks, tombol, dan tautan di sini tidak memerlukan perubahan source atau deployment."
        breadcrumbs={[{ label: t('platform.dashboard'), href: '/platform' }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Halaman</h2>
          {pages.isLoading ? (
            <LoadingState />
          ) : (
            <ul className="card divide-y divide-slate-200 dark:divide-slate-800">
              {(pages.data ?? []).map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    className={
                      selectedCode === page.code
                        ? 'flex w-full items-center justify-between gap-2 bg-brand-50 px-4 py-2.5 text-start text-sm dark:bg-brand-950/40'
                        : 'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800'
                    }
                    onClick={() => setSelectedCode(page.code)}
                  >
                    <span>
                      <span className="block font-medium text-slate-800 dark:text-slate-100">
                        {page.versions[0]?.title ?? page.code}
                      </span>
                      <Code>/{page.slug}</Code>
                    </span>
                    <StatusBadge status={page.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2">
          {!selectedCode ? (
            <div className="card px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              Pilih halaman untuk melihat dan mengubah bloknya.
            </div>
          ) : detail.isLoading ? (
            <LoadingState />
          ) : activeVersion ? (
            <div className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    {activeVersion.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Versi {activeVersion.versionNumber} <StatusBadge status={activeVersion.status} />
                    {activeVersion.publishedAt && ` · terbit ${formatDateTime(activeVersion.publishedAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && (
                    <button
                      type="button"
                      className="btn-outline px-3 py-1.5 text-xs"
                      disabled={createDraft.isPending}
                      onClick={() => createDraft.mutate(selectedCode)}
                    >
                      <FilePlus2 className="h-3.5 w-3.5" aria-hidden />
                      Versi draft baru
                    </button>
                  )}
                  {canPublish && activeVersion.status !== 'PUBLISHED' && (
                    <button
                      type="button"
                      className="btn-primary px-3 py-1.5 text-xs"
                      disabled={setStatus.isPending}
                      onClick={() =>
                        setStatus.mutate({
                          code: selectedCode,
                          versionId: activeVersion.id,
                          status: 'PUBLISHED',
                        })
                      }
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden />
                      Publikasikan
                    </button>
                  )}
                </div>
              </div>

              {activeVersion.status === 'PUBLISHED' && (
                <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  Versi yang sudah dipublikasikan tidak diedit langsung. Buat versi draft baru untuk
                  mengubah isi, lalu publikasikan.
                </p>
              )}

              <div className="space-y-4">
                {activeVersion.blocks.map((block) => {
                  const translation =
                    block.translations.find((item) => item.localeCode === 'id') ??
                    block.translations[0];
                  const values = draft[block.id] ?? {};
                  return (
                    <details key={block.id} className="rounded-lg border border-slate-200 dark:border-slate-800">
                      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                        <Code>{block.blockKey}</Code>{' '}
                        <span className="text-xs text-slate-500">({block.blockType})</span>
                      </summary>
                      <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
                        {BLOCK_FIELDS.map((field) => {
                          const current =
                            values[field.key] ??
                            ((translation?.[field.key as keyof CmsBlockTranslation] as string | null) ?? '');
                          return (
                            <div key={field.key}>
                              <label className="field-label" htmlFor={`${block.id}-${field.key}`}>
                                {field.label}
                              </label>
                              {'multiline' in field && field.multiline ? (
                                <textarea
                                  id={`${block.id}-${field.key}`}
                                  className="field-input"
                                  rows={4}
                                  value={current}
                                  disabled={!canManage}
                                  onChange={(event) =>
                                    setDraft((state) => ({
                                      ...state,
                                      [block.id]: { ...state[block.id], [field.key]: event.target.value },
                                    }))
                                  }
                                />
                              ) : (
                                <input
                                  id={`${block.id}-${field.key}`}
                                  className="field-input"
                                  value={current}
                                  disabled={!canManage}
                                  onChange={(event) =>
                                    setDraft((state) => ({
                                      ...state,
                                      [block.id]: { ...state[block.id], [field.key]: event.target.value },
                                    }))
                                  }
                                />
                              )}
                            </div>
                          );
                        })}
                        {canManage && (
                          <button
                            type="button"
                            className="btn-primary px-3 py-1.5 text-xs"
                            disabled={!draft[block.id] || saveBlock.isPending}
                            onClick={() => saveBlock.mutate({ blockId: block.id, values: draft[block.id] })}
                          >
                            <Save className="h-3.5 w-3.5" aria-hidden />
                            {t('common.save')}
                          </button>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <CmsList
          title="Berita"
          loading={news.isLoading}
          rows={(news.data ?? []).map((item) => ({
            id: item.id,
            primary: item.versions[0]?.title ?? item.slug,
            secondary: `/${item.slug} · ${item.category?.defaultName ?? 'Tanpa kategori'}`,
            status: item.status,
            meta: item.publishedAt ? formatDateTime(item.publishedAt) : null,
          }))}
        />
        <CmsList
          title="Pengumuman"
          loading={announcements.isLoading}
          rows={(announcements.data ?? []).map((item) => ({
            id: item.id,
            primary: item.title,
            secondary: `${item.code} · ${item.audience}`,
            status: item.severity,
            meta: item.startsAt ? formatDateTime(item.startsAt) : null,
          }))}
        />
        <CmsList
          title="FAQ"
          loading={faqs.isLoading}
          rows={(faqs.data ?? []).map((category) => ({
            id: category.id,
            primary: category.defaultName,
            secondary: category.code,
            status: `${category.items.length} pertanyaan`,
            meta: null,
          }))}
        />
        <CmsList
          title="Media"
          loading={media.isLoading}
          rows={(media.data ?? []).map((folder) => ({
            id: folder.id,
            primary: folder.name,
            secondary: folder.code,
            status: `${folder.assets.length} berkas`,
            meta: null,
          }))}
        />
      </div>
    </>
  );
}

function CmsList({
  title,
  loading,
  rows,
}: {
  title: string;
  loading: boolean;
  rows: Array<{ id: string; primary: string; secondary: string; status: string; meta: string | null }>;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-slate-500">Belum ada data.</p>
      ) : (
        <ul className="card divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
              <span>
                <span className="block font-medium text-slate-800 dark:text-slate-100">{row.primary}</span>
                <Code>{row.secondary}</Code>
              </span>
              <span className="shrink-0 text-end">
                <StatusBadge status={row.status} />
                {row.meta && (
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{row.meta}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
