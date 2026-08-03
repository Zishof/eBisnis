import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
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
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Media dan SEO</h2>
            <div className="space-y-3">
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
