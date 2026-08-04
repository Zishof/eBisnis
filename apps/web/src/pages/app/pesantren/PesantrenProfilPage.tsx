import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image, Save, Upload } from 'lucide-react';
import { api } from '../../../lib/api';
import { PageHeader, StatusBadge, useToast } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface ProfilSitus {
  is_published: boolean;
  theme_code: string;
  nama_tampilan: string | null;
  tagline: string | null;
  muqodimah_html: string | null;
  sejarah_html: string | null;
  visi: string | null;
  misi: string | null;
  pengasuh: string | null;
  tahun_berdiri: number | null;
  afiliasi: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  hero_image_attribution: string | null;
  alamat_publik: string | null;
  kontak_telepon: string | null;
  kontak_whatsapp: string | null;
  kontak_email: string | null;
  map_embed_url: string | null;
  instagram_url: string | null;
  meta_description: string | null;
}

const TEMA = [
  { value: 'HIJAU_ISLAMI', label: 'Hijau Islami' },
  { value: 'EMAS_KHATULISTIWA', label: 'Emas Khatulistiwa' },
  { value: 'BIRU_LANGIT', label: 'Biru Langit' },
  { value: 'COKLAT_KAYU', label: 'Coklat Kayu' },
  { value: 'UNGU_LEMBUT', label: 'Ungu Lembut' },
];

const FORM_KOSONG = {
  isPublished: false,
  themeCode: 'HIJAU_ISLAMI',
  namaTampilan: '',
  tagline: '',
  muqodimahHtml: '',
  sejarahHtml: '',
  visi: '',
  misi: '',
  pengasuh: '',
  tahunBerdiri: '',
  afiliasi: '',
  logoUrl: '',
  heroImageUrl: '',
  heroImageAttribution: '',
  alamatPublik: '',
  kontakTelepon: '',
  kontakWhatsapp: '',
  kontakEmail: '',
  mapEmbedUrl: '',
  instagramUrl: '',
  metaDescription: '',
};

type FormState = typeof FORM_KOSONG;

function isiForm(data: ProfilSitus): FormState {
  return {
    isPublished: data.is_published,
    themeCode: data.theme_code,
    namaTampilan: data.nama_tampilan ?? '',
    tagline: data.tagline ?? '',
    muqodimahHtml: data.muqodimah_html ?? '',
    sejarahHtml: data.sejarah_html ?? '',
    visi: data.visi ?? '',
    misi: data.misi ?? '',
    pengasuh: data.pengasuh ?? '',
    tahunBerdiri: data.tahun_berdiri ? String(data.tahun_berdiri) : '',
    afiliasi: data.afiliasi ?? '',
    logoUrl: data.logo_url ?? '',
    heroImageUrl: data.hero_image_url ?? '',
    heroImageAttribution: data.hero_image_attribution ?? '',
    alamatPublik: data.alamat_publik ?? '',
    kontakTelepon: data.kontak_telepon ?? '',
    kontakWhatsapp: data.kontak_whatsapp ?? '',
    kontakEmail: data.kontak_email ?? '',
    mapEmbedUrl: data.map_embed_url ?? '',
    instagramUrl: data.instagram_url ?? '',
    metaDescription: data.meta_description ?? '',
  };
}

function payload(form: FormState) {
  return {
    isPublished: form.isPublished,
    themeCode: form.themeCode,
    namaTampilan: form.namaTampilan || undefined,
    tagline: form.tagline || undefined,
    muqodimahHtml: form.muqodimahHtml || undefined,
    sejarahHtml: form.sejarahHtml || undefined,
    visi: form.visi || undefined,
    misi: form.misi || undefined,
    pengasuh: form.pengasuh || undefined,
    tahunBerdiri: form.tahunBerdiri ? Number(form.tahunBerdiri) : undefined,
    afiliasi: form.afiliasi || undefined,
    logoUrl: form.logoUrl || undefined,
    heroImageUrl: form.heroImageUrl || undefined,
    heroImageAttribution: form.heroImageAttribution || undefined,
    alamatPublik: form.alamatPublik || undefined,
    kontakTelepon: form.kontakTelepon || undefined,
    kontakWhatsapp: form.kontakWhatsapp || undefined,
    kontakEmail: form.kontakEmail || undefined,
    mapEmbedUrl: form.mapEmbedUrl || undefined,
    instagramUrl: form.instagramUrl || undefined,
    metaDescription: form.metaDescription || undefined,
  };
}

export function PesantrenProfilPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(FORM_KOSONG);

  const profil = useQuery({
    queryKey: ['pesantren-profil'],
    queryFn: () => api.get<ProfilSitus>('/pesantren/profil'),
  });

  useEffect(() => {
    if (profil.data) setForm(isiForm(profil.data));
  }, [profil.data]);

  const simpan = useMutation({
    mutationFn: () => api.put<ProfilSitus>('/pesantren/profil', payload(form)),
    onSuccess: (data) => {
      toast.push('Profil situs pondok berhasil disimpan.', 'success');
      setForm(isiForm(data));
      void queryClient.invalidateQueries({ queryKey: ['pesantren-profil'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-public-site'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan profil.'), 'error'),
  });

  const unggahGambar = useMutation({
    mutationFn: async ({ kategori, file }: { kategori: 'LOGO' | 'HERO'; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      return api.post<ProfilSitus>(`/pesantren/profil/gambar/${kategori}`, body);
    },
    onSuccess: (data, variables) => {
      toast.push(variables.kategori === 'LOGO' ? 'Logo berhasil diunggah.' : 'Gambar hero berhasil diunggah.', 'success');
      setForm(isiForm(data));
      void queryClient.invalidateQueries({ queryKey: ['pesantren-profil'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-public-site'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengunggah gambar.'), 'error'),
  });

  return (
    <>
      <PageHeader
        title="Profil Situs Pondok"
        description="Pengaturan tampilan publik, kontak, visi-misi, dan status terbit di santri.info."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Profil Situs' }]}
        actions={
          <button type="button" className="btn-primary" disabled={simpan.isPending || profil.isLoading} onClick={() => simpan.mutate()}>
            <Save className="h-4 w-4" aria-hidden />
            Simpan
          </button>
        }
      />

      {profil.isError && (
        <div className="card mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {toMessage(profil.error, (_key, fallback) => fallback ?? 'Gagal memuat profil.')}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <div className="card p-5">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Identitas Publik</h2>
              <p className="text-sm text-slate-500">Data ini muncul di halaman welcome pondok.</p>
            </div>
            <StatusBadge status={form.isPublished ? 'TERBIT' : 'DRAFT'} />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              />
              Terbitkan situs pondok
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nama tampilan *">
                <input className="field-input" value={form.namaTampilan} onChange={(e) => setForm({ ...form, namaTampilan: e.target.value })} />
              </Field>
              <Field label="Tema">
                <select className="field-input" value={form.themeCode} onChange={(e) => setForm({ ...form, themeCode: e.target.value })}>
                  {TEMA.map((tema) => (
                    <option key={tema.value} value={tema.value}>
                      {tema.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Tagline">
              <input className="field-input" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            </Field>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Pengasuh">
                <input className="field-input" value={form.pengasuh} onChange={(e) => setForm({ ...form, pengasuh: e.target.value })} />
              </Field>
              <Field label="Tahun berdiri">
                <input
                  type="number"
                  min="1900"
                  className="field-input"
                  value={form.tahunBerdiri}
                  onChange={(e) => setForm({ ...form, tahunBerdiri: e.target.value })}
                />
              </Field>
              <Field label="Afiliasi">
                <input className="field-input" value={form.afiliasi} onChange={(e) => setForm({ ...form, afiliasi: e.target.value })} />
              </Field>
            </div>

            <Field label="Muqodimah">
              <textarea className="field-input min-h-28" value={form.muqodimahHtml} onChange={(e) => setForm({ ...form, muqodimahHtml: e.target.value })} />
            </Field>
            <Field label="Sejarah">
              <textarea className="field-input min-h-32" value={form.sejarahHtml} onChange={(e) => setForm({ ...form, sejarahHtml: e.target.value })} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Visi">
                <textarea className="field-input min-h-28" value={form.visi} onChange={(e) => setForm({ ...form, visi: e.target.value })} />
              </Field>
              <Field label="Misi">
                <textarea className="field-input min-h-28" value={form.misi} onChange={(e) => setForm({ ...form, misi: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Kontak</h2>
            <div className="space-y-3">
              <Field label="Alamat publik">
                <textarea className="field-input min-h-24" value={form.alamatPublik} onChange={(e) => setForm({ ...form, alamatPublik: e.target.value })} />
              </Field>
              <Field label="Telepon">
                <input className="field-input" value={form.kontakTelepon} onChange={(e) => setForm({ ...form, kontakTelepon: e.target.value })} />
              </Field>
              <Field label="WhatsApp">
                <input className="field-input" value={form.kontakWhatsapp} onChange={(e) => setForm({ ...form, kontakWhatsapp: e.target.value })} />
              </Field>
              <Field label="Email">
                <input type="email" className="field-input" value={form.kontakEmail} onChange={(e) => setForm({ ...form, kontakEmail: e.target.value })} />
              </Field>
              <Field label="Instagram URL">
                <input className="field-input" value={form.instagramUrl} onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <Image className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Media dan SEO</h2>
                <p className="text-xs text-slate-500">Gambar ini tampil di situs pondok dan halaman unit sekolah.</p>
              </div>
            </div>
            <div className="space-y-4">
              <MediaUpload
                title="Logo pondok"
                description="PNG/JPG/WEBP, maksimal 5 MB. Disarankan rasio 1:1."
                previewUrl={form.logoUrl}
                disabled={unggahGambar.isPending}
                onFile={(file) => unggahGambar.mutate({ kategori: 'LOGO', file })}
              />
              <MediaUpload
                title="Foto hero situs"
                description="Foto aktivitas pesantren/sekolah. Disarankan rasio lebar 16:9."
                previewUrl={form.heroImageUrl}
                disabled={unggahGambar.isPending}
                wide
                onFile={(file) => unggahGambar.mutate({ kategori: 'HERO', file })}
              />
              <Field label="Logo URL">
                <input className="field-input" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
              </Field>
              <Field label="Hero image URL">
                <input className="field-input" value={form.heroImageUrl} onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })} />
              </Field>
              <Field label="Atribusi hero">
                <input
                  className="field-input"
                  value={form.heroImageAttribution}
                  onChange={(e) => setForm({ ...form, heroImageAttribution: e.target.value })}
                />
              </Field>
              <Field label="Map embed URL">
                <input className="field-input" value={form.mapEmbedUrl} onChange={(e) => setForm({ ...form, mapEmbedUrl: e.target.value })} />
              </Field>
              <Field label="Meta description">
                <textarea className="field-input min-h-24" value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function MediaUpload({
  title,
  description,
  previewUrl,
  disabled,
  wide = false,
  onFile,
}: {
  title: string;
  description: string;
  previewUrl: string;
  disabled?: boolean;
  wide?: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex gap-3">
        <div className={wide ? 'h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-white dark:bg-slate-950' : 'h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white dark:bg-slate-950'}>
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-slate-300">
              <Image className="h-6 w-6" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <Upload className="h-4 w-4" aria-hidden />
            Unggah gambar
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
