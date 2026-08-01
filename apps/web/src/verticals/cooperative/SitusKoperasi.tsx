/**
 * Situs koperasi untuk pengunjung.
 *
 * Sejak jalur publik disambungkan, halaman ini memanggil
 * `/cooperative/public/site` — tanpa sesi, tanpa hak akses. Koperasi mana yang
 * ditampilkan ditentukan **host permintaan**, dicocokkan ke baris terdaftar di
 * control plane (IR-005).
 *
 * Alamatnya tidak memuat slug koperasi sama sekali, dan itu disengaja: nama
 * skema maupun pengenal penyewa tidak boleh dapat ditebak dari alamat.
 */

import { useQuery } from '@tanstack/react-query';
import { Globe, Mail, MapPin, Phone } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface IsiSitus {
  koperasi: {
    name: string;
    slug: string;
    tagline: string | null;
    aboutHtml: string | null;
    logoUrl: string | null;
    heroImageUrl: string | null;
    metaDescription: string | null;
  };
  kontak: {
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
  };
  pendaftaran: { dibuka: { allowed: boolean; message?: string }; noticeHtml: string | null };
  jumlahAnggota: number | null;
  halaman: Array<{ slug: string; title: string; page_type: string }>;
  pengumuman: Array<{ id: string; title: string; body_html: string | null; published_at: string }>;
}

export function SitusKoperasi() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cooperative', 'situs-publik'],
    // Tanpa slug: koperasinya ditentukan host permintaan, bukan alamat.
    queryFn: () => apiRequest<IsiSitus>('/cooperative/public/site'),
    retry: false,
  });

  if (isLoading) {
    return <div className="container-page py-16 text-center text-slate-500">Memuat situs…</div>;
  }

  if (isError || !data) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold">Situs koperasi belum dapat ditampilkan</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {(error as Error | undefined)?.message ?? 'Situs koperasi tidak ditemukan.'}
          </p>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            Alamat ini belum terdaftar sebagai situs koperasi, atau situsnya belum diterbitkan
            pengurus.
          </p>
        </div>
      </div>
    );
  }

  const { koperasi, kontak, pendaftaran, jumlahAnggota, halaman, pengumuman } = data;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-gradient-to-b from-emerald-50 to-white py-12 dark:border-slate-800 dark:from-emerald-950/40 dark:to-slate-950">
        <div className="container-page">
          {koperasi.logoUrl && (
            <img src={koperasi.logoUrl} alt="" className="mb-4 h-16 w-auto" />
          )}
          <h1 className="text-3xl font-semibold">{koperasi.name}</h1>
          {koperasi.tagline && (
            <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{koperasi.tagline}</p>
          )}
          {jumlahAnggota !== null && (
            <p className="mt-4 text-sm text-slate-500">
              Melayani {jumlahAnggota.toLocaleString('id-ID')} anggota
            </p>
          )}
          {pendaftaran.dibuka.allowed ? (
            <p className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
              Pendaftaran anggota baru dibuka
            </p>
          ) : (
            <p className="mt-6 text-sm text-slate-500">{pendaftaran.dibuka.message}</p>
          )}
        </div>
      </header>

      <main className="container-page grid gap-10 py-10 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-8">
          {koperasi.aboutHtml && (
            <section>
              <h2 className="text-xl font-semibold">Tentang Kami</h2>
              {/*
                Isi disusun pengurus koperasi lewat layar CMS, bukan diterima
                dari pengunjung. Penyaringannya dilakukan saat disimpan.
              */}
              <div
                className="prose prose-slate mt-3 max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: koperasi.aboutHtml }}
              />
            </section>
          )}

          {pengumuman.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">Pengumuman</h2>
              <ul className="mt-3 space-y-3">
                {pengumuman.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <h3 className="font-medium">{p.title}</h3>
                    {p.body_html && (
                      <div
                        className="prose prose-sm mt-2 max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: p.body_html }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="font-semibold">Hubungi Kami</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {kontak.address && (
                <li className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {kontak.address}
                </li>
              )}
              {kontak.phone && (
                <li className="flex gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {kontak.phone}
                </li>
              )}
              {kontak.email && (
                <li className="flex gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {kontak.email}
                </li>
              )}
            </ul>
          </section>

          {halaman.length > 0 && (
            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="flex items-center gap-2 font-semibold">
                <Globe className="h-4 w-4 text-slate-400" aria-hidden />
                Halaman
              </h2>
              <ul className="mt-3 space-y-1 text-sm">
                {halaman.map((h) => (
                  <li key={h.slug} className="text-slate-600 dark:text-slate-400">
                    {h.title}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
